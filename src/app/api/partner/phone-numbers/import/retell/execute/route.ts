import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/encryption';
import { isFeatureEnabled } from '@/config/featureFlags';
import { registerAgentInAnalytics, generateWebhookUrl } from '@/lib/analytics';
import { logger } from '@/lib/logger';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const agentConfigSchema = z.object({
  id: z.string(),
  role: z.enum(['inbound', 'outbound', 'both']).default('both'),
  enableWebhook: z.boolean().default(true),
  webhookMode: z.enum(['manual', 'automatic']).default('automatic'),
  preExistingWebhookUrl: z.string().optional(),
  forwardToPreExisting: z.boolean().default(true),
});

const executeSchema = z.object({
  apiKey: z.string().min(1),
  customerId: z.string().uuid(),
  profitMultiplier: z.number().min(0.1).max(10).default(1.2),
  numbers: z.array(z.object({
    phone_number: z.string(),
    phone_number_type: z.enum(['retell-twilio', 'retell-telnyx']),
    nickname: z.string().optional(),
    inbound_agent_id: z.string().optional(),
    outbound_agent_id: z.string().optional(),
  })).min(1).max(50),
  importAgents: z.boolean().default(false),
  agents: z.array(agentConfigSchema).optional().default([]),
});

/**
 * POST /api/partner/phone-numbers/import/retell/execute
 *
 * Import selected Retell phone numbers with customer mapping and webhook configuration.
 * This is the main execution endpoint for the Retell provider phone import wizard.
 */
export async function POST(req: NextRequest) {
  try {
    // Check feature flag
    if (!isFeatureEnabled('providerPhoneImport.enabled')) {
      return NextResponse.json(
        { success: false, error: 'Feature not available' },
        { status: 404 }
      );
    }

    // Authenticate partner
    const partnerAuth = await verifyPartnerJWT(req);
    if (!partnerAuth || !partnerAuth.isValid || !partnerAuth.payload?.partnerId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partnerId = partnerAuth.payload.partnerId;

    // Parse and validate request body
    const body = await req.json();
    const validation = executeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_REQUEST_DATA',
          message: 'Invalid request data',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { apiKey, customerId, profitMultiplier, numbers, importAgents, agents } = validation.data;

    // Validate API key format
    if (!apiKey.trim().startsWith('key_')) {
      return NextResponse.json(
        { success: false, error: 'Valid Retell API key is required (must start with key_)' },
        { status: 400 }
      );
    }

    // The customerId from frontend is actually the UserOnboarding ID
    // We need to find the UserOnboarding record first, then get the actual Customer
    const userOnboarding = await prisma.userOnboarding.findFirst({
      where: {
        id: customerId,
        partnerId,
      },
      include: {
        customer: true,
      },
    });

    if (!userOnboarding) {
      return NextResponse.json(
        { success: false, error: 'Customer not found or does not belong to this partner' },
        { status: 404 }
      );
    }

    if (!userOnboarding.customerId || !userOnboarding.customer) {
      return NextResponse.json(
        { success: false, error: 'Customer record not found. Please ensure the customer is properly set up.' },
        { status: 404 }
      );
    }

    const customer = userOnboarding.customer;
    // Use the actual Customer ID for all downstream operations
    const actualCustomerId = customer.id;

    // Validate the API key against Retell
    const retellValidation = await fetch('https://api.retellai.com/list-phone-numbers', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!retellValidation.ok) {
      return NextResponse.json(
        { success: false, error: 'Invalid Retell API key or Retell API error' },
        { status: 401 }
      );
    }

    // Encrypt the API key for storage
    const encryptedApiKey = await encrypt(apiKey.trim());

    // Results tracking
    const importedNumbers: any[] = [];
    const failedNumbers: any[] = [];
    const importedAgents: any[] = [];
    const failedAgents: any[] = [];

    // Execute import in a transaction
    await prisma.$transaction(async (tx) => {
      // Step 1: Create or update PhoneNumberProvider credential record
      const providerCredential = await upsertProviderCredential(
        tx, partnerId, encryptedApiKey, apiKey.trim()
      );

      // Step 2: Import phone numbers
      for (const number of numbers) {
        try {
          const phoneNumber = await importPhoneNumber(
            tx, partnerId, actualCustomerId, number, providerCredential.id
          );
          importedNumbers.push({
            phone_number: number.phone_number,
            id: phoneNumber.id,
            status: 'imported',
          });
        } catch (error: any) {
          failedNumbers.push({
            phone_number: number.phone_number,
            error: error.message,
          });
        }
      }

      // Step 3: Import agents (RetellAgent record + analytics + webhook) — no mapping yet
      if (importAgents && agents.length > 0) {
        for (const agentConfig of agents) {
          try {
            const result = await importRetellAgent(
              tx, partnerId, actualCustomerId, profitMultiplier,
              agentConfig, apiKey.trim(), encryptedApiKey,
            );
            importedAgents.push(result);
          } catch (error: any) {
            failedAgents.push({
              agent_id: agentConfig.id,
              error: error.message,
            });
          }
        }

        // Step 4: Create one AgentPhoneMapping per imported phone number with correct
        // inbound/outbound agent roles derived from the phone number's Retell data.
        for (const importedNumber of importedNumbers) {
          const numberData = numbers.find((n) => n.phone_number === importedNumber.phone_number);
          if (!numberData) continue;

          const inboundAgentId = numberData.inbound_agent_id || null;
          const outboundAgentId = numberData.outbound_agent_id || null;
          const primaryAgentId = inboundAgentId || outboundAgentId;
          if (!primaryAgentId) continue;

          const primaryAgentResult = importedAgents.find((a) => a.agent_id === primaryAgentId);
          const primaryAgentName = primaryAgentResult?.agent_name || primaryAgentId;

          const hasInbound = !!inboundAgentId;
          const hasOutbound = !!outboundAgentId;
          // Two separate agents: store outbound agent ID in providerConfig
          const isDualAgent = hasInbound && hasOutbound && inboundAgentId !== outboundAgentId;

          const providerConfigData: Record<string, any> = {
            importedVia: 'retell_provider_import',
            providerLocked: true,
            configuredAt: new Date().toISOString(),
          };
          if (isDualAgent) {
            providerConfigData.outboundAgentId = outboundAgentId;
          }

          try {
            await tx.agentPhoneMapping.upsert({
              where: {
                phoneNumberId_agentProvider: {
                  phoneNumberId: importedNumber.id,
                  agentProvider: 'retell',
                },
              },
              create: {
                phoneNumberId: importedNumber.id,
                agentProvider: 'retell',
                agentId: primaryAgentId,
                agentName: primaryAgentName,
                customerId: actualCustomerId,
                partnerId,
                inboundEnabled: hasInbound,
                outboundEnabled: hasOutbound,
                status: 'active',
                providerConfig: providerConfigData,
              },
              update: {
                agentId: primaryAgentId,
                agentName: primaryAgentName,
                customerId: actualCustomerId,
                inboundEnabled: hasInbound,
                outboundEnabled: hasOutbound,
                status: 'active',
                providerConfig: providerConfigData,
                updatedAt: new Date(),
              },
            });
          } catch (mappingError: any) {
            logger.warn('[retell-execute] Failed to create mapping for number', {
              operation: 'retell_phone_import_execute',
              phoneNumberId: importedNumber.id,
              primaryAgentId,
              error: mappingError.message,
            });
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        numbers: {
          imported: importedNumbers,
          failed: failedNumbers,
          total: numbers.length,
        },
        agents: {
          imported: importedAgents,
          failed: failedAgents,
          total: agents.length,
        },
        customerId: actualCustomerId,
        partnerId,
      },
    });
  } catch (error: any) {
    logger.error('[retell-execute] Error executing Retell phone import', error instanceof Error ? error : new Error(String(error.message)), { operation: 'retell_phone_import_execute' });
    return NextResponse.json(
      { success: false, error: 'Failed to execute Retell phone import', message: error.message },
      { status: 500 }
    );
  }
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Create or update the PhoneNumberProvider credential record for Retell
 */
async function upsertProviderCredential(
  tx: any,
  partnerId: string,
  encryptedApiKey: string,
  rawApiKey: string
) {
  const crypto = await import('crypto');
  const accountIdentifier = `retell_${crypto.createHash('sha256').update(rawApiKey).digest('hex').substring(0, 16)}`;

  const existing = await tx.phoneNumberProvider.findFirst({
    where: {
      partnerId,
      customerId: null,
      provider: 'retell',
      accountIdentifier,
    },
  });

  if (existing) {
    return tx.phoneNumberProvider.update({
      where: { id: existing.id },
      data: {
        credentials: encryptedApiKey,
        isActive: true,
        lastValidated: new Date(),
        validationError: null,
      },
    });
  }

  return tx.phoneNumberProvider.create({
    data: {
      partnerId,
      provider: 'retell',
      accountIdentifier,
      credentials: encryptedApiKey,
      isActive: true,
      lastValidated: new Date(),
    },
  });
}

/**
 * Import a single phone number from Retell into our system
 */
async function importPhoneNumber(
  tx: any,
  partnerId: string,
  customerId: string,
  number: { phone_number: string; phone_number_type: string; nickname?: string },
  providerCredentialId: string
) {
  const existing = await tx.phoneNumber.findUnique({
    where: { phoneNumber: number.phone_number },
  });

  if (existing) {
    throw new Error(`Phone number ${number.phone_number} already exists in the system`);
  }

  const countryCode = extractCountryCode(number.phone_number);
  const originalProvider = number.phone_number_type === 'retell-twilio' ? 'twilio' : 'telnyx';

  return tx.phoneNumber.create({
    data: {
      partnerId,
      customerId,
      phoneNumber: number.phone_number,
      friendlyName: number.nickname || `Retell ${number.phone_number}`,
      countryCode,
      capabilities: JSON.stringify({ voice: true, sms: false }),
      type: 'local',
      status: 'active',
      monthlyRecurringCost: 0,
      isImported: true,
      provider: 'retell_provider',
      importedAt: new Date(),
      originalProvider,
      importMetadata: JSON.stringify({
        retellPhoneType: number.phone_number_type,
        importedVia: 'retell_provider_import',
        importedAt: new Date().toISOString(),
      }),
      providerCredentialId,
      providerLock: 'retell',
      regulatoryStatus: 'approved',
      verificationStatus: 'verified',
    },
  });
}

/**
 * Extract country code from E.164 phone number
 */
function extractCountryCode(phoneNumber: string): string {
  const countryMap: Record<string, string> = {
    '+1': 'US', '+44': 'GB', '+61': 'AU', '+91': 'IN', '+49': 'DE',
    '+33': 'FR', '+81': 'JP', '+86': 'CN', '+55': 'BR', '+52': 'MX',
    '+34': 'ES', '+39': 'IT', '+82': 'KR', '+31': 'NL', '+46': 'SE',
    '+47': 'NO', '+45': 'DK', '+41': 'CH', '+64': 'NZ', '+65': 'SG',
  };
  for (const [prefix, code] of Object.entries(countryMap)) {
    if (phoneNumber.startsWith(prefix)) return code;
  }
  return 'US';
}


/**
 * Import a Retell agent: create/update RetellAgent record, register with analytics,
 * and configure webhook. Does NOT create AgentPhoneMapping — that is handled separately
 * in the main transaction once all agents are imported, so inbound/outbound roles can
 * be assigned correctly per phone number.
 */
async function importRetellAgent(
  tx: any,
  partnerId: string,
  customerId: string,
  profitMultiplier: number,
  agentConfig: { id: string; role: string; enableWebhook: boolean; webhookMode: string; preExistingWebhookUrl?: string; forwardToPreExisting: boolean },
  rawApiKey: string,
  encryptedApiKey: string,
) {
  const agentId = agentConfig.id;

  // Step 1: Fetch agent details from Retell API
  const agentResponse = await fetch(`https://api.retellai.com/get-agent/${agentId}`, {
    headers: {
      'Authorization': `Bearer ${rawApiKey}`,
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!agentResponse.ok) {
    throw new Error(`Failed to fetch agent ${agentId} from Retell: ${agentResponse.status}`);
  }

  const agentDetails = await agentResponse.json();
  const agentName = agentDetails.agent_name || 'Imported Agent';

  // Step 2: Check if agent already exists in our database
  const existingAgent = await tx.retellAgent.findUnique({
    where: { id: agentId },
  });

  if (existingAgent) {
    // Update existing agent with customer mapping and profit multiplier
    await tx.retellAgent.update({
      where: { id: agentId },
      data: {
        customerId,
        profitMultiplier,
        apiKey: encryptedApiKey,
        apiKeyStatus: 'valid',
        apiKeyLastVerified: new Date(),
        updatedAt: new Date(),
      },
    });
  } else {
    // Create new RetellAgent record (same pattern as agents/import/execute)
    await tx.retellAgent.create({
      data: {
        id: agentId,
        partnerId,
        customerId,
        name: agentName,
        voiceId: agentDetails.voice_id || '',
        voiceModel: agentDetails.voice_model || null,
        responseEngine: agentDetails.response_engine || {},
        voiceConfig: agentDetails.voice_config || {},
        callConfig: agentDetails.call_config || {},
        webhookUrl: agentDetails.webhook_url || null,
        language: agentDetails.language || 'en',
        recordingEnabled: true,
        importedAt: new Date(),
        lastSyncedAt: new Date(),
        createdAt: new Date(agentDetails.creation_timestamp || Date.now()),
        updatedAt: new Date(agentDetails.last_modification_timestamp || Date.now()),
        isActive: true,
        profitMultiplier,
        apiKey: encryptedApiKey,
        apiKeyStatus: 'valid',
        apiKeyLastVerified: new Date(),
        preExistingWebhookUrl: agentDetails.webhook_url || null,
        forwardToPreExisting: agentConfig.forwardToPreExisting,
        historicalAnalyticsProcessed: false,
        historicalProcessingStatus: null,
        historicalDataStartDate: null,
        historicalDataEndDate: null,
        historicalCallsProcessed: 0,
        historicalCallsTotal: 0,
      },
    });
  }

  // Step 3: Register agent with analytics service (outside transaction — external call)
  let analyticsAgentId: string | null = null;
  let webhookUrl: string | null = null;
  let webhookEnabled = false;

  // Note: registerAgentInAnalytics is an external HTTP call, so we do it outside the tx
  // but we still track the result to update the agent record
  const analyticsResult = await registerAgentInAnalytics({
    agentId,
    provider: 'retell',
    partnerId,
    agentName,
    customerId,
    profitMultiplier,
  });

  if (analyticsResult.success && analyticsResult.analyticsAgentId) {
    analyticsAgentId = analyticsResult.analyticsAgentId;
    webhookUrl = generateWebhookUrl({
      provider: 'retell',
      analyticsAgentId,
    });

    // Step 4: Configure webhook in Retell if automatic mode
    if (agentConfig.enableWebhook && agentConfig.webhookMode === 'automatic' && webhookUrl) {
      try {
        const updateResponse = await fetch(`https://api.retellai.com/update-agent/${agentId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${rawApiKey}`,
          },
          body: JSON.stringify({ webhook_url: webhookUrl }),
          signal: AbortSignal.timeout(10000),
        });

        webhookEnabled = updateResponse.ok;
        if (!updateResponse.ok) {
          logger.warn('[retell-execute] Failed to set webhook in Retell for agent', { operation: 'retell_phone_import_execute', agentId, status: updateResponse.status });
        }
      } catch (webhookError) {
        logger.warn('[retell-execute] Error setting webhook for agent', { operation: 'retell_phone_import_execute', agentId, error: webhookError instanceof Error ? webhookError.message : String(webhookError) });
      }
    }

    // Update agent with analytics and webhook info
    await tx.retellAgent.update({
      where: { id: agentId },
      data: {
        analyticsAgentId,
        webhookUrl,
        webhookEnabled,
        webhookMode: webhookEnabled ? 'automatic' : 'manual',
        updatedAt: new Date(),
      },
    });
  }

  return {
    agent_id: agentId,
    agent_name: agentName,
    status: 'imported',
    analytics_registered: !!analyticsAgentId,
    analytics_agent_id: analyticsAgentId,
    webhook_url: webhookUrl,
    webhook_enabled: webhookEnabled,
    webhook_mode: webhookEnabled ? 'automatic' : 'manual',
    existed_before: !!existingAgent,
  };
}