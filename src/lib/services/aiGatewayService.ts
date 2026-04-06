import { prisma } from '@/lib/prisma';
import { encryptData } from '@/lib/encryption';
import { CreditService } from '@/lib/services/creditService';
import { getLiteLLMClient } from '@/lib/litellm';
import { getPartnerTier, PartnerTier } from '@/lib/portalModes';
import { logger } from '@/lib/logger';
import { Decimal } from '@prisma/client/runtime/library';

// ============================================
// Types
// ============================================

export interface CreateAiGatewayKeyInput {
  partnerId: string;
  customerId?: string;
  name: string;
  description?: string;
  budgetUsd: number; // total budget in USD (pass 9999 for customer pay-as-you-go keys)
  allowedModels: string[];
  profitMultiplier?: number; // default 1.0
  customerCreditPriceCents?: number; // price of 1 customer AI credit in cents (default: 1)
  autoTopUpEnabled?: boolean;
  autoTopUpThresholdUsd?: number;
  autoTopUpAmountUsd?: number;
  allowedDomains?: string;
  rateLimit?: number;
  dailyLimit?: number;
  monthlyLimit?: number;
  expiresAt?: Date;
  /** When true, bypasses budget-based credit reserve and instead reserves a fixed
   *  CUSTOMER_KEY_CREDIT_RESERVE (1000) Knotie credits from the partner. */
  isCustomerKey?: boolean;
}

export interface AiGatewayKeyResult {
  id: string;
  name: string;
  description: string | null;
  status: string;
  keyPrefix: string;
  virtualKey?: string; // only returned on create/regenerate (shown once)
  allowedModels: string[];
  budgetUsd: number;
  budgetCreditsReserved: number;
  budgetCreditsUsed: number;
  totalSpendUsd: number;
  profitMultiplier: number;
  customerCreditPriceCents: number;
  adminFeePercent: number;
  autoTopUpEnabled: boolean;
  autoTopUpThresholdUsd: number | null;
  autoTopUpAmountUsd: number | null;
  rateLimit: number | null;
  dailyLimit: number | null;
  monthlyLimit: number | null;
  allowedDomains: string | null;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  lastSyncedAt: Date | null;
  totalRequests: number;
  totalTokens: number;
  createdAt: Date;
  updatedAt: Date;
  customerId: string | null;
}

export interface UpdateAiGatewayKeyInput {
  keyId: string;
  partnerId: string;
  name?: string;
  description?: string;
  allowedModels?: string[];
  autoTopUpEnabled?: boolean;
  autoTopUpThresholdUsd?: number | null;
  autoTopUpAmountUsd?: number | null;
  allowedDomains?: string | null;
  rateLimit?: number | null;
  dailyLimit?: number | null;
  monthlyLimit?: number | null;
  expiresAt?: Date | null;
}

export interface TopUpInput {
  aiGatewayKeyId: string;
  partnerId: string;
  additionalBudgetUsd: number;
}

export interface AdminConfig {
  gatewayEnabled: boolean;
  freeTierAdminFeePercent: number;
  supportedModels: SupportedModel[];
  maxBudgetCapUsd: number | null;
  globalRateLimitRpm: number | null;
  maxKeysPerPartner: number | null;
}

export interface SupportedModel {
  modelId: string;
  displayName: string;
  provider: string;
  category: 'budget' | 'mid_tier' | 'premium';
  tierAccess: string[]; // e.g., ['free_forever', 'solo_agency', 'ultimate_scale']
  enabled: boolean;
  inputCostPer1MTokens: number;
  outputCostPer1MTokens: number;
}

// ============================================
// Constants
// ============================================

/** 1 Knotie Credit = $0.01 */
const CREDITS_PER_DOLLAR = 100;

/**
 * Fixed Knotie credits reserved from the partner for each customer key.
 * Ensures the partner has skin-in-the-game to cover underlying provider costs.
 * 1000 credits ≈ $10. The key is suspended when the customer's AI Credits run out,
 * and separately when the partner's balance drops below this threshold.
 */
const CUSTOMER_KEY_CREDIT_RESERVE = 1000;

/**
 * Partner balance threshold (in Knotie credits) below which all their
 * customer keys are suspended. Same as the per-key reserve so that a partner
 * with exactly 1 key active can still be covered.
 */
const PARTNER_SUSPEND_THRESHOLD = 1000;

/** Resolve partner tier using the project-wide getPartnerTier() which handles Stripe price IDs */
function resolvePartnerTier(planId: string | null, approvalStatus: string | null): { tierKey: string; isFreeTier: boolean } {
  const tier = getPartnerTier(planId, approvalStatus);
  return {
    tierKey: tier as string, // e.g. 'free_forever', 'starter', 'pro', 'enterprise', 'lifetime'
    isFreeTier: tier === PartnerTier.FREE_FOREVER,
  };
}

// ============================================
// Service Class
// ============================================

export class AiGatewayService {
  // ------------------------------------------
  // Admin Config
  // ------------------------------------------

  /**
   * Get or create the singleton admin configuration.
   */
  static async getAdminConfig(): Promise<AdminConfig> {
    let config = await prisma.aiGatewayAdminConfig.findUnique({
      where: { id: 'singleton' },
    });

    if (!config) {
      config = await prisma.aiGatewayAdminConfig.create({
        data: { id: 'singleton' },
      });
    }

    // Migrate legacy tier names in supportedModels (solo_agency → starter, ultimate_scale → enterprise)
    const LEGACY_TIER_MAP: Record<string, string> = {
      'solo_agency': 'starter',
      'ultimate_scale': 'enterprise',
    };
    const rawModels = (config.supportedModels as unknown as SupportedModel[]) || [];
    const models = rawModels.map(m => ({
      ...m,
      tierAccess: m.tierAccess.map(t => LEGACY_TIER_MAP[t] || t),
    }));

    return {
      gatewayEnabled: config.gatewayEnabled,
      freeTierAdminFeePercent: config.freeTierAdminFeePercent,
      supportedModels: models,
      maxBudgetCapUsd: config.maxBudgetCapUsd ? Number(config.maxBudgetCapUsd) : null,
      globalRateLimitRpm: config.globalRateLimitRpm,
      maxKeysPerPartner: config.maxKeysPerPartner,
    };
  }

  /**
   * Update admin configuration (Mission Control).
   */
  static async updateAdminConfig(
    updates: Partial<Omit<AdminConfig, 'supportedModels'>> & { supportedModels?: SupportedModel[] },
    updatedBy: string
  ): Promise<AdminConfig> {
    const data: Record<string, any> = { updatedBy };

    if (updates.gatewayEnabled !== undefined) data.gatewayEnabled = updates.gatewayEnabled;
    if (updates.freeTierAdminFeePercent !== undefined) data.freeTierAdminFeePercent = updates.freeTierAdminFeePercent;
    if (updates.supportedModels !== undefined) data.supportedModels = updates.supportedModels;
    if (updates.maxBudgetCapUsd !== undefined) data.maxBudgetCapUsd = updates.maxBudgetCapUsd;
    if (updates.globalRateLimitRpm !== undefined) data.globalRateLimitRpm = updates.globalRateLimitRpm;
    if (updates.maxKeysPerPartner !== undefined) data.maxKeysPerPartner = updates.maxKeysPerPartner;

    await prisma.aiGatewayAdminConfig.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', ...data },
      update: data,
    });

    return this.getAdminConfig();
  }

  // ------------------------------------------
  // Key Creation
  // ------------------------------------------

  /**
   * Create a new AI Gateway key for a partner.
   *
   * Flow:
   * 1. Validate partner, gateway enabled, key cap
   * 2. Validate budget cap
   * 3. Validate model access based on partner tier
   * 4. For customer keys: validate customer has AI Credits enabled + balance >= 1
   * 5. Calculate credits to reserve (including admin fee for free tier)
   * 6. Check partner balance covers the reservation
   * 7. Create LiteLLM team + virtual key
   * 8. Reserve credits from partner balance
   * 9. Encrypt and store key in DB
   * 10. Return key (virtual key shown once, then only prefix is visible)
   */
  static async createAiGatewayKey(input: CreateAiGatewayKeyInput): Promise<AiGatewayKeyResult> {
    const { partnerId, budgetUsd, allowedModels } = input;

    logger.info('Creating AI Gateway key', {
      operation: 'ai_gateway',
      partnerId,
      budgetUsd,
      modelCount: allowedModels.length,
    });

    // 1. Load admin config + partner in parallel
    const [adminConfig, partner] = await Promise.all([
      this.getAdminConfig(),
      prisma.partner.findUnique({
        where: { id: partnerId },
        select: {
          id: true,
          planId: true,
          approvalStatus: true,
          creditBalance: true,
          businessName: true,
          _count: { select: { aiGatewayKeys: { where: { status: 'active' } } } },
        },
      }),
    ]);

    if (!partner) throw new AiGatewayError('Partner not found', 'PARTNER_NOT_FOUND');
    if (!adminConfig.gatewayEnabled) throw new AiGatewayError('AI Gateway is currently disabled', 'GATEWAY_DISABLED');

    // 2. Check max keys per partner
    if (adminConfig.maxKeysPerPartner && partner._count.aiGatewayKeys >= adminConfig.maxKeysPerPartner) {
      throw new AiGatewayError(
        `Maximum ${adminConfig.maxKeysPerPartner} active keys allowed`,
        'MAX_KEYS_EXCEEDED'
      );
    }

    // 3. Check budget cap
    if (adminConfig.maxBudgetCapUsd && budgetUsd > Number(adminConfig.maxBudgetCapUsd)) {
      throw new AiGatewayError(
        `Budget exceeds maximum cap of $${adminConfig.maxBudgetCapUsd}`,
        'BUDGET_CAP_EXCEEDED'
      );
    }

    // 4. Validate model access based on tier (resolves Stripe price IDs to tier names)
    const { tierKey: partnerTierKey, isFreeTier } = resolvePartnerTier(partner.planId, partner.approvalStatus);

    for (const modelId of allowedModels) {
      const modelConfig = adminConfig.supportedModels.find(m => m.modelId === modelId && m.enabled);
      if (!modelConfig) {
        throw new AiGatewayError(`Model "${modelId}" is not available`, 'MODEL_NOT_AVAILABLE');
      }
      if (!modelConfig.tierAccess.includes(partnerTierKey)) {
        throw new AiGatewayError(
          `Model "${modelId}" is not available for your plan tier`,
          'MODEL_TIER_RESTRICTED'
        );
      }
    }

    // 5. If a customer key, validate the customer has AI Credits enabled and sufficient balance.
    const isCustomerKey = !!input.isCustomerKey;
    if (isCustomerKey && input.customerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: input.customerId },
        select: { id: true, aiCreditsEnabled: true, creditBalance: true },
      });
      if (!customer) {
        throw new AiGatewayError('Customer not found', 'CUSTOMER_NOT_FOUND');
      }
      if (!customer.aiCreditsEnabled) {
        throw new AiGatewayError(
          'This customer does not have AI Credits enabled. Enable AI Credits for this customer in their settings before creating an AI Gateway key.',
          'CUSTOMER_AI_CREDIT_DISABLED'
        );
      }
      if (customer.creditBalance < 1) {
        throw new AiGatewayError(
          'This customer has insufficient AI Credits (balance is 0). Add credits to this customer\'s account before creating an AI Gateway key.',
          'CUSTOMER_INSUFFICIENT_AI_CREDITS'
        );
      }
      logger.info('Customer AI Credit validation passed', {
        operation: 'ai_gateway',
        partnerId,
        customerId: input.customerId,
        creditBalance: customer.creditBalance,
      });
    }

    // 6. Calculate credits to reserve
    const adminFeePercent = isFreeTier ? adminConfig.freeTierAdminFeePercent : 0;

    // Customer keys (pay-as-you-go): reserve a fixed CUSTOMER_KEY_CREDIT_RESERVE
    // from the partner. This acts as a deposit/guarantee that the partner can
    // cover costs while the customer is using the key.
    // Partner keys: reserve proportional to the requested budgetUsd.
    const creditsToReserve = isCustomerKey
      ? CUSTOMER_KEY_CREDIT_RESERVE
      : Math.ceil(budgetUsd * (1 + adminFeePercent / 100) * CREDITS_PER_DOLLAR);

    // 6. Check partner balance
    const creditBalance = await CreditService.getPartnerCreditBalance(partnerId);
    if (!creditBalance || creditBalance.currentBalance < creditsToReserve) {
      const neededMsg = isCustomerKey
        ? `${CUSTOMER_KEY_CREDIT_RESERVE} Knotie Credits`
        : `${creditsToReserve} credits`;
      throw new AiGatewayError(
        `Insufficient partner credits. Need ${neededMsg}, have ${creditBalance?.currentBalance || 0}`,
        'INSUFFICIENT_CREDITS'
      );
    }

    // 7. Generate unique team alias
    const teamAlias = `kn-gw-${partnerId.substring(0, 8)}-${Date.now()}`;

    // 8. Create LiteLLM team + key
    const litellmClient = getLiteLLMClient();
    let litellmTeam;
    let litellmKey;

    try {
      litellmTeam = await litellmClient.createTeam({
        team_alias: teamAlias,
        models: allowedModels,
        max_budget: budgetUsd,
        ...(input.rateLimit ? { rpm_limit: input.rateLimit } : {}),
        metadata: {
          knotie_partner_id: partnerId,
          knotie_customer_id: input.customerId || null,
          knotie_allowed_domains: input.allowedDomains || null,
        },
      });

      litellmKey = await litellmClient.generateKey({
        team_id: litellmTeam.team_id,
        models: allowedModels,
        max_budget: budgetUsd,
        key_alias: `${input.name}-${partnerId.substring(0, 8)}-${Date.now()}`,
        duration: input.expiresAt ? undefined : undefined, // LiteLLM uses duration string; we handle expiry ourselves
        metadata: {
          knotie_partner_id: partnerId,
          knotie_customer_id: input.customerId || null,
          knotie_key_name: input.name,
        },
      });
    } catch (error) {
      // Clean up team if key generation failed
      if (litellmTeam) {
        try {
          await litellmClient.deleteTeam([litellmTeam.team_id]);
        } catch (cleanupError) {
          logger.error('Failed to cleanup LiteLLM team after key generation failure', cleanupError as Error, {
            operation: 'ai_gateway',
            teamId: litellmTeam.team_id,
          });
        }
      }
      throw new AiGatewayError(
        `Failed to create LiteLLM resources: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LITELLM_ERROR'
      );
    }

    // 9. Encrypt virtual key and build key prefix
    const encryptedVirtualKey = await encryptData(litellmKey.key);
    const keyPrefix = litellmKey.key.substring(0, 8) + '...';

    // 10. Reserve credits from partner
    const reserveDescription = isCustomerKey
      ? `AI Gateway customer key "${input.name}" — reserved ${CUSTOMER_KEY_CREDIT_RESERVE} Knotie credits (pay-as-you-go deposit)`
      : `AI Gateway key "${input.name}" — reserved ${creditsToReserve} credits ($${budgetUsd} budget${adminFeePercent > 0 ? ` + ${adminFeePercent}% admin fee` : ''})`;
    const reserveResult = await CreditService.addCredits(
      partnerId,
      -creditsToReserve,
      'ai_gateway_reserve',
      reserveDescription,
      undefined, // referenceId — set after DB record created
      undefined, // createdBy
      {
        aiGatewayKeyName: input.name,
        budgetUsd,
        adminFeePercent,
        creditsReserved: creditsToReserve,
      }
    );

    if (!reserveResult.success) {
      // Clean up LiteLLM resources
      try {
        await litellmClient.deleteKey([litellmKey.token]);
        await litellmClient.deleteTeam([litellmTeam.team_id]);
      } catch (cleanupError) {
        logger.error('Failed to cleanup LiteLLM resources after credit reservation failure', cleanupError as Error, {
          operation: 'ai_gateway',
        });
      }
      throw new AiGatewayError(
        `Failed to reserve credits: ${reserveResult.error}`,
        'CREDIT_RESERVE_FAILED'
      );
    }

    // 11. Persist to database
    const dbKey = await prisma.aiGatewayKey.create({
      data: {
        partnerId,
        customerId: input.customerId || null,
        name: input.name,
        description: input.description || null,
        status: 'active',
        litellmTeamId: litellmTeam.team_id,
        litellmTeamAlias: teamAlias,
        litellmKeyToken: litellmKey.token,
        litellmKeyAlias: litellmKey.key_alias,
        encryptedVirtualKey,
        keyPrefix,
        allowedModels: allowedModels,
        budgetUsd: new Decimal(budgetUsd),
        budgetCreditsReserved: new Decimal(creditsToReserve),
        profitMultiplier: input.profitMultiplier ?? 1.0,
        customerCreditPriceCents: input.customerCreditPriceCents ?? 1,
        adminFeePercent,
        autoTopUpEnabled: input.autoTopUpEnabled ?? false,
        autoTopUpThresholdUsd: input.autoTopUpThresholdUsd ? new Decimal(input.autoTopUpThresholdUsd) : null,
        autoTopUpAmountUsd: input.autoTopUpAmountUsd ? new Decimal(input.autoTopUpAmountUsd) : null,
        allowedDomains: input.allowedDomains || null,
        rateLimit: input.rateLimit || null,
        dailyLimit: input.dailyLimit || null,
        monthlyLimit: input.monthlyLimit || null,
        expiresAt: input.expiresAt || null,
      },
    });

    logger.info('AI Gateway key created successfully', {
      operation: 'ai_gateway',
      partnerId,
      keyId: dbKey.id,
      creditsReserved: creditsToReserve,
    });

    return this.formatKeyResult(dbKey, litellmKey.key);
  }

  // ------------------------------------------
  // Key Revocation
  // ------------------------------------------

  /**
   * Revoke an AI Gateway key.
   * For customer keys (customerId set): always refunds the fixed CUSTOMER_KEY_CREDIT_RESERVE
   *   deposit — the $9999 LiteLLM budget ceiling is just a bypass mechanism.
   * For partner-owned keys: refunds based on unspent USD budget.
   * Allows revoking both 'active' and 'suspended' keys.
   */
  static async revokeAiGatewayKey(
    keyId: string,
    partnerId: string
  ): Promise<{ refundedCredits: number }> {
    const key = await prisma.aiGatewayKey.findFirst({
      where: { id: keyId, partnerId, status: { in: ['active', 'suspended'] } },
    });

    if (!key) {
      throw new AiGatewayError('Key not found or already revoked', 'KEY_NOT_FOUND');
    }

    logger.info('Revoking AI Gateway key', {
      operation: 'ai_gateway',
      partnerId,
      keyId,
    });

    // 1. Delete LiteLLM resources
    const litellmClient = getLiteLLMClient();
    try {
      await litellmClient.deleteKey([key.litellmKeyToken]);
    } catch (error) {
      logger.warn('Failed to delete LiteLLM key during revocation (may already be deleted)', {
        operation: 'ai_gateway',
        keyId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
    try {
      await litellmClient.deleteTeam([key.litellmTeamId]);
    } catch (error) {
      logger.warn('Failed to delete LiteLLM team during revocation (may already be deleted)', {
        operation: 'ai_gateway',
        keyId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }

    // 2. Calculate refund
    //
    //    Customer keys use a $9999 LiteLLM budget ceiling purely to bypass LiteLLM's
    //    internal enforcement — actual usage is charged from the customer's AI Credit
    //    balance. The partner never "owns" that $9999 budget, so we always refund the
    //    fixed CUSTOMER_KEY_CREDIT_RESERVE deposit (1000 credits / $10) regardless
    //    of how much the customer spent.
    //
    //    Partner-owned keys: refund based on unspent USD budget (standard logic).
    const isCustomerKey = key.customerId !== null;
    let refundCredits: number;
    let refundDescription: string;

    if (isCustomerKey) {
      // Fixed deposit refund — always return the full reserve to the partner
      refundCredits = CUSTOMER_KEY_CREDIT_RESERVE;
      refundDescription = `AI Gateway customer key "${key.name}" revoked — refunded ${CUSTOMER_KEY_CREDIT_RESERVE} credit reserve`;
    } else {
      const spentUsd = Number(key.totalSpendUsd);
      const budgetUsd = Number(key.budgetUsd);
      const unspentUsd = Math.max(0, budgetUsd - spentUsd);
      const adminFeePercent = key.adminFeePercent || 0;
      const unspentWithFee = unspentUsd * (1 + adminFeePercent / 100);
      refundCredits = Math.floor(unspentWithFee * CREDITS_PER_DOLLAR);
      refundDescription = `AI Gateway key "${key.name}" revoked — refunded ${refundCredits} credits ($${unspentUsd.toFixed(2)} unspent)`;
    }

    // 3. Refund credits
    if (refundCredits > 0) {
      await CreditService.addCredits(
        partnerId,
        refundCredits,
        'ai_gateway_refund',
        refundDescription,
        keyId,
        undefined,
        {
          aiGatewayKeyId: keyId,
          isCustomerKey,
          refundCredits,
        }
      );
    }

    // 4. Mark key as revoked
    await prisma.aiGatewayKey.update({
      where: { id: keyId },
      data: { status: 'revoked' },
    });

    logger.info('AI Gateway key revoked', {
      operation: 'ai_gateway',
      keyId,
      refundedCredits: refundCredits,
    });

    return { refundedCredits: refundCredits };
  }

  // ------------------------------------------
  // Key Regeneration
  // ------------------------------------------

  /**
   * Regenerate an AI Gateway key (new key value, same configuration).
   * Returns the new virtual key (shown once).
   */
  static async regenerateAiGatewayKey(
    keyId: string,
    partnerId: string
  ): Promise<AiGatewayKeyResult> {
    const key = await prisma.aiGatewayKey.findFirst({
      where: { id: keyId, partnerId, status: 'active' },
    });

    if (!key) {
      throw new AiGatewayError('Active key not found', 'KEY_NOT_FOUND');
    }

    logger.info('Regenerating AI Gateway key', {
      operation: 'ai_gateway',
      partnerId,
      keyId,
    });

    const litellmClient = getLiteLLMClient();
    let newLitellmKey;

    try {
      newLitellmKey = await litellmClient.regenerateKey(key.litellmKeyToken);
    } catch (error) {
      throw new AiGatewayError(
        `Failed to regenerate key: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LITELLM_ERROR'
      );
    }

    // Encrypt new key and update DB
    const encryptedVirtualKey = await encryptData(newLitellmKey.key);
    const keyPrefix = newLitellmKey.key.substring(0, 8) + '...';

    const updatedKey = await prisma.aiGatewayKey.update({
      where: { id: keyId },
      data: {
        litellmKeyToken: newLitellmKey.token,
        encryptedVirtualKey,
        keyPrefix,
      },
    });

    logger.info('AI Gateway key regenerated', {
      operation: 'ai_gateway',
      keyId,
    });

    return this.formatKeyResult(updatedKey, newLitellmKey.key);
  }

  // ------------------------------------------
  // Top-Up
  // ------------------------------------------

  /**
   * Add additional budget to an existing key.
   * Deducts additional credits from partner balance and increases LiteLLM budget.
   */
  static async topUpAiGatewayKey(input: TopUpInput): Promise<AiGatewayKeyResult> {
    const { aiGatewayKeyId, partnerId, additionalBudgetUsd } = input;

    if (additionalBudgetUsd <= 0) {
      throw new AiGatewayError('Top-up amount must be positive', 'INVALID_AMOUNT');
    }

    const key = await prisma.aiGatewayKey.findFirst({
      where: { id: aiGatewayKeyId, partnerId, status: 'active' },
    });

    if (!key) {
      throw new AiGatewayError('Active key not found', 'KEY_NOT_FOUND');
    }

    logger.info('Topping up AI Gateway key', {
      operation: 'ai_gateway',
      partnerId,
      keyId: aiGatewayKeyId,
      additionalBudgetUsd,
    });

    // Calculate credits including admin fee
    const adminFeePercent = key.adminFeePercent || 0;
    const totalCostWithFee = additionalBudgetUsd * (1 + adminFeePercent / 100);
    const additionalCredits = Math.ceil(totalCostWithFee * CREDITS_PER_DOLLAR);

    // Check balance
    const creditBalance = await CreditService.getPartnerCreditBalance(partnerId);
    if (!creditBalance || creditBalance.currentBalance < additionalCredits) {
      throw new AiGatewayError(
        `Insufficient credits. Need ${additionalCredits}, have ${creditBalance?.currentBalance || 0}`,
        'INSUFFICIENT_CREDITS'
      );
    }

    // Deduct credits
    const deductResult = await CreditService.addCredits(
      partnerId,
      -additionalCredits,
      'ai_gateway_topup',
      `AI Gateway key "${key.name}" top-up — ${additionalCredits} credits ($${additionalBudgetUsd})`,
      aiGatewayKeyId,
      undefined,
      {
        aiGatewayKeyId,
        additionalBudgetUsd,
        adminFeePercent,
        additionalCredits,
      }
    );

    if (!deductResult.success) {
      throw new AiGatewayError(
        `Failed to deduct credits: ${deductResult.error}`,
        'CREDIT_DEDUCT_FAILED'
      );
    }

    // Update LiteLLM team budget
    const newBudgetUsd = Number(key.budgetUsd) + additionalBudgetUsd;
    const litellmClient = getLiteLLMClient();
    try {
      await litellmClient.updateTeam({
        team_id: key.litellmTeamId,
        max_budget: newBudgetUsd,
      });
    } catch (error) {
      logger.error('Failed to update LiteLLM team budget during top-up', error as Error, {
        operation: 'ai_gateway',
        keyId: aiGatewayKeyId,
      });
      // Don't throw — credits are deducted, we'll reconcile via cron
    }

    // Update DB
    const updatedKey = await prisma.aiGatewayKey.update({
      where: { id: aiGatewayKeyId },
      data: {
        budgetUsd: new Decimal(newBudgetUsd),
        budgetCreditsReserved: new Decimal(Number(key.budgetCreditsReserved) + additionalCredits),
      },
    });

    logger.info('AI Gateway key topped up', {
      operation: 'ai_gateway',
      keyId: aiGatewayKeyId,
      newBudgetUsd,
    });

    return this.formatKeyResult(updatedKey);
  }

  // ------------------------------------------
  // Key Update
  // ------------------------------------------

  /**
   * Update an existing AI Gateway key's settings.
   * Budget changes are NOT allowed here — use topUpAiGatewayKey instead.
   * If allowedModels changes, the LiteLLM team is updated too.
   */
  static async updateAiGatewayKey(input: UpdateAiGatewayKeyInput): Promise<AiGatewayKeyResult> {
    const { keyId, partnerId } = input;

    const key = await prisma.aiGatewayKey.findFirst({
      where: { id: keyId, partnerId, status: 'active' },
    });

    if (!key) {
      throw new AiGatewayError('Active key not found', 'KEY_NOT_FOUND');
    }

    // If models are being changed, validate them against admin config
    if (input.allowedModels && input.allowedModels.length > 0) {
      const adminConfig = await this.getAdminConfig();
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: { planId: true, approvalStatus: true },
      });
      const { tierKey: partnerTierKey } = resolvePartnerTier(partner?.planId ?? null, partner?.approvalStatus ?? null);

      for (const modelId of input.allowedModels) {
        const modelConfig = adminConfig.supportedModels.find(m => m.modelId === modelId && m.enabled);
        if (!modelConfig) {
          throw new AiGatewayError(`Model "${modelId}" is not available`, 'MODEL_NOT_AVAILABLE');
        }
        if (!modelConfig.tierAccess.includes(partnerTierKey)) {
          throw new AiGatewayError(
            `Model "${modelId}" is not available for your plan tier`,
            'MODEL_TIER_RESTRICTED'
          );
        }
      }

      // Update LiteLLM team models
      const litellmClient = getLiteLLMClient();
      try {
        await litellmClient.updateTeam({
          team_id: key.litellmTeamId,
          models: input.allowedModels,
        });
      } catch (error) {
        logger.error('Failed to update LiteLLM team models', error as Error, {
          operation: 'ai_gateway',
          keyId,
        });
        throw new AiGatewayError(
          `Failed to update models on LiteLLM: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'LITELLM_ERROR'
        );
      }
    }

    // Sync rate limit changes to LiteLLM team
    if (input.rateLimit !== undefined) {
      const litellmClient = getLiteLLMClient();
      try {
        await litellmClient.updateTeam({
          team_id: key.litellmTeamId,
          ...(input.rateLimit ? { rpm_limit: input.rateLimit } : {}),
        });
      } catch (error) {
        logger.warn('Failed to sync rate limit to LiteLLM (non-blocking)', {
          operation: 'ai_gateway',
          keyId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Sync domain metadata to LiteLLM team
    if (input.allowedDomains !== undefined) {
      const litellmClient = getLiteLLMClient();
      try {
        await litellmClient.updateTeam({
          team_id: key.litellmTeamId,
          metadata: {
            knotie_partner_id: key.partnerId,
            knotie_customer_id: key.customerId || null,
            knotie_allowed_domains: input.allowedDomains || null,
          },
        });
      } catch (error) {
        logger.warn('Failed to sync domain metadata to LiteLLM (non-blocking)', {
          operation: 'ai_gateway',
          keyId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Build update data
    const data: Record<string, any> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.allowedModels !== undefined) data.allowedModels = input.allowedModels;
    if (input.autoTopUpEnabled !== undefined) data.autoTopUpEnabled = input.autoTopUpEnabled;
    if (input.autoTopUpThresholdUsd !== undefined) {
      data.autoTopUpThresholdUsd = input.autoTopUpThresholdUsd !== null
        ? new Decimal(input.autoTopUpThresholdUsd) : null;
    }
    if (input.autoTopUpAmountUsd !== undefined) {
      data.autoTopUpAmountUsd = input.autoTopUpAmountUsd !== null
        ? new Decimal(input.autoTopUpAmountUsd) : null;
    }
    if (input.allowedDomains !== undefined) data.allowedDomains = input.allowedDomains;
    if (input.rateLimit !== undefined) data.rateLimit = input.rateLimit;
    if (input.dailyLimit !== undefined) data.dailyLimit = input.dailyLimit;
    if (input.monthlyLimit !== undefined) data.monthlyLimit = input.monthlyLimit;
    if (input.expiresAt !== undefined) data.expiresAt = input.expiresAt;

    const updatedKey = await prisma.aiGatewayKey.update({
      where: { id: keyId },
      data,
    });

    logger.info('AI Gateway key updated', {
      operation: 'ai_gateway',
      keyId,
      updatedFields: Object.keys(data),
    });

    return this.formatKeyResult(updatedKey);
  }

  // ------------------------------------------
  // Read Operations
  // ------------------------------------------

  /**
   * Get a single AI Gateway key by ID (for the owning partner).
   */
  static async getAiGatewayKey(keyId: string, partnerId: string): Promise<AiGatewayKeyResult> {
    const key = await prisma.aiGatewayKey.findFirst({
      where: { id: keyId, partnerId },
    });

    if (!key) {
      throw new AiGatewayError('Key not found', 'KEY_NOT_FOUND');
    }

    return this.formatKeyResult(key);
  }

  /**
   * List all AI Gateway keys for a partner, with optional filters.
   */
  static async listAiGatewayKeys(
    partnerId: string,
    filters?: { status?: string; customerId?: string }
  ): Promise<AiGatewayKeyResult[]> {
    const where: Record<string, any> = { partnerId };
    if (filters?.status) where.status = filters.status;
    if (filters?.customerId) where.customerId = filters.customerId;

    const keys = await prisma.aiGatewayKey.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return keys.map(k => this.formatKeyResult(k));
  }

  // ------------------------------------------
  // Helpers
  // ------------------------------------------

  /**
   * Format a DB record into the public result shape.
   * @param virtualKey - only provided on create/regenerate (shown once)
   */
  private static formatKeyResult(dbKey: any, virtualKey?: string): AiGatewayKeyResult {
    return {
      id: dbKey.id,
      name: dbKey.name,
      description: dbKey.description,
      status: dbKey.status,
      keyPrefix: dbKey.keyPrefix,
      virtualKey, // undefined unless just created/regenerated
      allowedModels: (dbKey.allowedModels as string[]) || [],
      budgetUsd: Number(dbKey.budgetUsd),
      budgetCreditsReserved: Number(dbKey.budgetCreditsReserved),
      budgetCreditsUsed: Number(dbKey.budgetCreditsUsed),
      totalSpendUsd: Number(dbKey.totalSpendUsd),
      profitMultiplier: dbKey.profitMultiplier,
      customerCreditPriceCents: Number(dbKey.customerCreditPriceCents ?? 1),
      adminFeePercent: dbKey.adminFeePercent,
      autoTopUpEnabled: dbKey.autoTopUpEnabled,
      autoTopUpThresholdUsd: dbKey.autoTopUpThresholdUsd ? Number(dbKey.autoTopUpThresholdUsd) : null,
      autoTopUpAmountUsd: dbKey.autoTopUpAmountUsd ? Number(dbKey.autoTopUpAmountUsd) : null,
      rateLimit: dbKey.rateLimit,
      dailyLimit: dbKey.dailyLimit,
      monthlyLimit: dbKey.monthlyLimit,
      allowedDomains: dbKey.allowedDomains,
      expiresAt: dbKey.expiresAt,
      lastUsedAt: dbKey.lastUsedAt,
      lastSyncedAt: dbKey.lastSyncedAt,
      totalRequests: dbKey.totalRequests,
      totalTokens: dbKey.totalTokens,
      createdAt: dbKey.createdAt,
      updatedAt: dbKey.updatedAt,
      customerId: dbKey.customerId,
    };
  }
}

// ============================================
// Error Class
// ============================================

export type AiGatewayErrorCode =
  | 'PARTNER_NOT_FOUND'
  | 'GATEWAY_DISABLED'
  | 'MAX_KEYS_EXCEEDED'
  | 'BUDGET_CAP_EXCEEDED'
  | 'MODEL_NOT_AVAILABLE'
  | 'CUSTOMER_NOT_FOUND'
  | 'CUSTOMER_AI_CREDIT_DISABLED'
  | 'CUSTOMER_INSUFFICIENT_AI_CREDITS'
  | 'MODEL_TIER_RESTRICTED'
  | 'INSUFFICIENT_CREDITS'
  | 'LITELLM_ERROR'
  | 'CREDIT_RESERVE_FAILED'
  | 'CREDIT_DEDUCT_FAILED'
  | 'KEY_NOT_FOUND'
  | 'INVALID_AMOUNT';

export class AiGatewayError extends Error {
  code: AiGatewayErrorCode;

  constructor(message: string, code: AiGatewayErrorCode) {
    super(message);
    this.name = 'AiGatewayError';
    this.code = code;
  }
}
