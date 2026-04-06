/**
 * Prospect Onboarding Service
 *
 * Core service for processing prospect onboarding steps via the webhook API.
 * Extracts and reuses logic from existing API routes:
 * - convert-to-customer/route.ts (Step 3)
 * - save-onboarding-details/route.ts (Step 9)
 * - enable-ai-credits/route.ts (post-processing)
 * - deployment-notification/route.ts (post-processing)
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import bcrypt from 'bcryptjs';
import { generateSecurePassword } from '@/lib/passwordUtils';
import { sendWhitelabelSignupEmail } from '@/lib/services/email-service';
import { sendEmail } from '@/lib/email';
import { getEffectivePortalLoginUrl } from '@/lib/portalUrlUtils';
import { getGreetingForServices } from '@/lib/greetingTemplates';
import { selectVoiceForProspect } from '@/lib/services/voiceSelectionService';
import type { WebhookOnboardingRequest } from '@/lib/validators/webhookOnboardingValidator';

// KnotieManager URL for auto-deploy jobs
const KNOTIE_MANAGER_URL = process.env.KNOTIE_MANAGER_URL || 'http://localhost:3003';
const KNOTIE_MANAGER_API_KEY = process.env.KNOTIE_MANAGER_API_KEY;

// --- Types ---

export interface OnboardingResult {
  success: boolean;
  message: string;
  prospect: {
    id: string;
    current_step: number;
    is_completed: boolean;
    completed_steps: number[];
  };
  customer?: {
    id: string;
    email: string;
    name: string;
  };
  deployment?: {
    auto_deploy_enabled: boolean;
    status: string;
    job_id?: string;
  };
  steps_processed: number[];
  steps_skipped: number[];
  steps_failed?: { step: number; error: string }[];
  error?: string;
}

interface PartnerInfo {
  id: string;
  businessName: string;
  subdomain: string | null;
  customDomain: string | null;
  customDomainVerified: boolean;
  logo: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  autoDeployEnabled: boolean;
  saasAgentTier: string | null;
  planId: string | null;
  approvalStatus: string | null;
  customLandingPageUrl?: string | null;
  emailAddress: string;
  telephonyCreditBalanceCents: number;
  creditBalance: number;
}

interface ProspectRecord {
  id: string;
  partnerId: string;
  businessName: string | null;
  businessWebsite: string | null;
  hasNoWebsite: boolean;
  businessCountry: string | null;
  websiteAnalysis: any;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  serviceCategories: any;
  knowledgeBaseFiles: any;
  knowledgeBaseUrls: any;
  greetingText: string | null;
  voiceType: string | null;
  selectedVoiceId: string | null;
  informationSettings: any;
  meetingUrl: string | null;
  smsEnabled: boolean;
  callTransferEnabled: boolean;
  transferNumber: string | null;
  deploymentSettings: any;
  selectedPricingPlan: string | null;
  billingModel: string | null;
  currentStep: number;
  completedSteps: any;
  isCompleted: boolean;
  convertedToCustomerId: string | null;
  ghlContactId: string | null;
}

// --- Main Orchestrator ---

/**
 * Process prospect onboarding steps sequentially
 */
export async function processProspectOnboarding(
  partnerId: string,
  prospect: ProspectRecord,
  request: WebhookOnboardingRequest
): Promise<OnboardingResult> {
  const stepData = request.step_data || {};
  const stepsProcessed: number[] = [];
  const stepsSkipped: number[] = [];
  const stepsFailed: { step: number; error: string }[] = [];

  // Determine starting step
  let completedSteps: number[] = [];
  try {
    completedSteps = Array.isArray(prospect.completedSteps)
      ? prospect.completedSteps
      : JSON.parse(prospect.completedSteps || '[]');
  } catch { completedSteps = []; }

  let startStep = request.complete_from_step || (Math.max(...completedSteps, 0) + 1);
  if (startStep < 1) startStep = 1;
  if (startStep > 9) startStep = 9;

  // Fetch partner info
  const partner = await fetchPartnerInfo(partnerId);
  if (!partner) {
    return buildErrorResult(prospect, completedSteps, 'Partner not found');
  }

  let customerId = prospect.convertedToCustomerId;
  let customerEmail = prospect.email;
  let customerName = prospect.firstName ? `${prospect.firstName} ${prospect.lastName || ''}`.trim() : '';

  // Process steps sequentially
  for (let step = startStep; step <= 9; step++) {
    try {
      if (completedSteps.includes(step) && !request.complete_from_step) {
        stepsSkipped.push(step);
        continue;
      }

      switch (step) {
        case 1:
          await processStep1(prospect, stepData.business_info);
          break;
        case 2:
          // Website analysis is skipped for webhook flow
          break;
        case 3: {
          const result = await processStep3(prospect, partner, stepData.customer_details);
          customerId = result.customerId;
          customerEmail = result.email;
          customerName = result.name;
          break;
        }
        case 4:
          await processStep4(prospect, customerId, stepData.service_categories);
          break;
        case 5:
          await processStep5(prospect, stepData.knowledge_base);
          break;
        case 6:
          await processStep6(prospect, partner, customerId, stepData.greeting);
          break;
        case 7:
          await processStep7(prospect, customerId, stepData.information_collection);
          break;
        case 8:
          await processStep8(prospect, customerId, stepData.communication);
          break;
        case 9:
          await processStep9(prospect, partner, customerId, stepData.deployment);
          break;
      }

      // Mark step as completed
      if (!completedSteps.includes(step)) {
        completedSteps.push(step);
      }
      stepsProcessed.push(step);

      // Update prospect progress
      await prisma.prospect.update({
        where: { id: prospect.id },
        data: {
          currentStep: step,
          completedSteps: JSON.stringify(completedSteps),
          ...(step === 9 ? { isCompleted: true } : {}),
        },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[WebhookOnboarding] Step ${step} failed`, error instanceof Error ? error : undefined, {
        prospectId: prospect.id, step,
      });
      stepsFailed.push({ step, error: errorMsg });
      break; // Stop processing on failure
    }
  }

  // Post-processing after all steps complete
  if (completedSteps.includes(9) && customerId) {
    try {
      await postProcessOnboarding(prospect, partner, customerId, customerEmail || '', customerName);
    } catch (error) {
      logger.error('[WebhookOnboarding] Post-processing error (non-fatal)', error instanceof Error ? error : undefined);
    }
  }

  // Build response
  const isCompleted = completedSteps.includes(9);
  const hasFailures = stepsFailed.length > 0;

  return {
    success: !hasFailures,
    message: isCompleted
      ? 'Onboarding completed successfully'
      : hasFailures
        ? 'Onboarding partially completed'
        : 'Onboarding steps processed',
    prospect: {
      id: prospect.id,
      current_step: Math.max(...completedSteps, startStep),
      is_completed: isCompleted,
      completed_steps: completedSteps,
    },
    customer: customerId ? {
      id: customerId,
      email: customerEmail || '',
      name: customerName,
    } : undefined,
    deployment: isCompleted && partner ? {
      auto_deploy_enabled: partner.autoDeployEnabled,
      status: partner.autoDeployEnabled ? 'queued' : 'pending_manual',
    } : undefined,
    steps_processed: stepsProcessed,
    steps_skipped: stepsSkipped,
    ...(hasFailures ? { steps_failed: stepsFailed } : {}),
  };
}

// --- Helper Functions ---

function buildErrorResult(prospect: ProspectRecord, completedSteps: number[], error: string): OnboardingResult {
  return {
    success: false,
    message: error,
    error,
    prospect: {
      id: prospect.id,
      current_step: prospect.currentStep,
      is_completed: prospect.isCompleted,
      completed_steps: completedSteps,
    },
    steps_processed: [],
    steps_skipped: [],
  };
}

async function fetchPartnerInfo(partnerId: string): Promise<PartnerInfo | null> {
  return prisma.partner.findUnique({
    where: { id: partnerId },
    select: {
      id: true,
      businessName: true,
      subdomain: true,
      customDomain: true,
      customDomainVerified: true,
      logo: true,
      primaryColor: true,
      secondaryColor: true,
      autoDeployEnabled: true,
      saasAgentTier: true,
      planId: true,
      approvalStatus: true,
      customLandingPageUrl: true,
      emailAddress: true,
      telephonyCreditBalanceCents: true,
      creditBalance: true,
    },
  });
}

// --- Step Processors ---

/**
 * Step 1: Business Information
 */
async function processStep1(
  prospect: ProspectRecord,
  stepData?: WebhookOnboardingRequest['step_data'] extends infer T ? T extends { business_info?: infer B } ? B : never : never
): Promise<void> {
  const businessName = stepData?.business_name || prospect.businessName;
  const businessWebsite = stepData?.business_website ?? prospect.businessWebsite;
  const hasNoWebsite = stepData?.has_no_website ?? prospect.hasNoWebsite;
  const businessCountry = stepData?.business_country || prospect.businessCountry;

  if (!businessName) {
    throw new Error('Business name is required for Step 1');
  }

  await prisma.prospect.update({
    where: { id: prospect.id },
    data: {
      businessName,
      businessWebsite: businessWebsite || null,
      hasNoWebsite: hasNoWebsite || false,
      businessCountry: businessCountry || null,
    },
  });

  // Update local prospect reference
  prospect.businessName = businessName;
  prospect.businessWebsite = businessWebsite || null;
  prospect.hasNoWebsite = hasNoWebsite || false;
  prospect.businessCountry = businessCountry || null;
}

/**
 * Step 3: Customer Details & Conversion (prospect → customer)
 * Replicates logic from convert-to-customer/route.ts
 */
async function processStep3(
  prospect: ProspectRecord,
  partner: PartnerInfo,
  stepData?: WebhookOnboardingRequest['step_data'] extends infer T ? T extends { customer_details?: infer B } ? B : never : never
): Promise<{ customerId: string; email: string; name: string }> {
  const firstName = stepData?.first_name || prospect.firstName;
  const lastName = stepData?.last_name || prospect.lastName;
  const email = stepData?.email || prospect.email;
  const phone = stepData?.phone || prospect.phone;

  if (!firstName || !lastName || !email) {
    throw new Error('First name, last name, and email are required for Step 3');
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Update prospect with customer details
  await prisma.prospect.update({
    where: { id: prospect.id },
    data: {
      firstName,
      lastName,
      email: normalizedEmail,
      phone: phone || null,
      businessCountry: stepData?.country || prospect.businessCountry,
    },
  });

  // Update local prospect reference
  prospect.firstName = firstName;
  prospect.lastName = lastName;
  prospect.email = normalizedEmail;
  prospect.phone = phone || null;

  // Check if already converted (idempotent)
  if (prospect.convertedToCustomerId) {
    const existingCustomer = await prisma.customer.findUnique({
      where: { id: prospect.convertedToCustomerId },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    if (existingCustomer) {
      return {
        customerId: existingCustomer.id,
        email: existingCustomer.email,
        name: `${existingCustomer.firstName || ''} ${existingCustomer.lastName || ''}`.trim(),
      };
    }
  }

  // Check if customer already exists for this partner
  const existingCredential = await prisma.customerCredential.findUnique({
    where: { partnerId_email: { partnerId: partner.id, email: normalizedEmail } },
  });

  if (existingCredential) {
    // Link existing customer to prospect
    await prisma.prospect.update({
      where: { id: prospect.id },
      data: { convertedToCustomerId: existingCredential.customerId, convertedAt: new Date() },
    });
    prospect.convertedToCustomerId = existingCredential.customerId;
    return {
      customerId: existingCredential.customerId,
      email: normalizedEmail,
      name: `${firstName} ${lastName}`,
    };
  }

  // Create new customer
  const temporaryPassword = generateSecurePassword();
  const hashedPassword = await bcrypt.hash(temporaryPassword, 12);
  const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  const customer = await prisma.customer.create({
    data: {
      userId,
      email: normalizedEmail,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      businessName: prospect.businessName || `${firstName} ${lastName}`,
      status: 'active',
      customerPortalEnabled: true,
      ghlContactId: prospect.ghlContactId || null,
      isGhlSynced: prospect.ghlContactId ? true : false,
      ghlSyncStatus: prospect.ghlContactId ? 'synced' : 'pending',
    },
  });

  await prisma.customerCredential.create({
    data: {
      customerId: customer.id,
      partnerId: partner.id,
      email: normalizedEmail,
      passwordHash: hashedPassword,
    },
  });

  await prisma.userOnboarding.create({
    data: {
      userId: customer.userId,
      email: normalizedEmail,
      firstName,
      lastName,
      companyName: prospect.businessName || `${firstName} ${lastName}`,
      partnerId: partner.id,
      customerId: customer.id,
      customerPortalEnabled: true,
      isOnboardingCompleted: false,
      orderStatus: 'pending',
      autoEmbeddingEnabled: partner.autoDeployEnabled === true,
    },
  });

  // Update prospect with conversion info
  await prisma.prospect.update({
    where: { id: prospect.id },
    data: { convertedToCustomerId: customer.id, convertedAt: new Date() },
  });
  prospect.convertedToCustomerId = customer.id;

  // Send signup email
  // getEffectivePortalLoginUrl returns the partner's custom landing page URL for
  // Starter/Enterprise partners, or the standard portal login URL otherwise.
  const loginUrl = getEffectivePortalLoginUrl(partner);

  try {
    await sendWhitelabelSignupEmail({
      to: normalizedEmail,
      firstName,
      businessName: partner.businessName,
      temporaryPassword,
      loginUrl,
      partnerId: partner.id,
      partnerBranding: {
        logo: partner.logo || undefined,
        primaryColor: partner.primaryColor || undefined,
        secondaryColor: partner.secondaryColor || undefined,
        businessName: partner.businessName || 'Partner',
      },
    });
  } catch (emailError) {
    logger.error('[WebhookOnboarding] Failed to send signup email (non-fatal)', emailError instanceof Error ? emailError : undefined);
  }

  return { customerId: customer.id, email: normalizedEmail, name: `${firstName} ${lastName}` };
}


/**
 * Step 4: Service Categories
 */
async function processStep4(
  prospect: ProspectRecord,
  customerId: string | null,
  stepData?: WebhookOnboardingRequest['step_data'] extends infer T ? T extends { service_categories?: infer B } ? B : never : never
): Promise<void> {
  const categories = stepData?.categories || (Array.isArray(prospect.serviceCategories) ? prospect.serviceCategories : []);
  const customServices = stepData?.custom_services || '';

  if (!categories || categories.length === 0) {
    throw new Error('At least one service category is required for Step 4');
  }

  const serviceCategoriesData = customServices
    ? [...categories, `custom:${customServices}`]
    : categories;

  await prisma.prospect.update({
    where: { id: prospect.id },
    data: { serviceCategories: JSON.stringify(serviceCategoriesData) },
  });

  prospect.serviceCategories = serviceCategoriesData;
}

/**
 * Step 5: Knowledge Base (URLs only for webhook flow)
 */
async function processStep5(
  prospect: ProspectRecord,
  stepData?: WebhookOnboardingRequest['step_data'] extends infer T ? T extends { knowledge_base?: infer B } ? B : never : never
): Promise<void> {
  const urls = stepData?.urls || [];

  // Knowledge base is optional - just save URLs if provided
  await prisma.prospect.update({
    where: { id: prospect.id },
    data: {
      knowledgeBaseUrls: JSON.stringify(urls),
      knowledgeBaseFiles: JSON.stringify([]), // No file uploads via webhook
    },
  });

  prospect.knowledgeBaseUrls = urls;
}

/**
 * Step 6: Personalized Greeting & Voice Selection
 */
async function processStep6(
  prospect: ProspectRecord,
  partner: PartnerInfo,
  customerId: string | null,
  stepData?: WebhookOnboardingRequest['step_data'] extends infer T ? T extends { greeting?: infer B } ? B : never : never
): Promise<void> {
  // Generate greeting if not provided
  let greetingText = stepData?.greeting_text || prospect.greetingText;
  if (!greetingText) {
    const categories = Array.isArray(prospect.serviceCategories)
      ? prospect.serviceCategories
      : (() => { try { return JSON.parse(prospect.serviceCategories || '[]'); } catch { return []; } })();
    greetingText = getGreetingForServices(categories, prospect.businessName || 'our business');
  }

  // Select voice using intelligent voice selection service
  const voiceResult = await selectVoiceForProspect(
    {
      id: partner.id,
      autoDeployEnabled: partner.autoDeployEnabled,
      saasAgentTier: partner.saasAgentTier,
      planId: partner.planId,
      approvalStatus: partner.approvalStatus,
    },
    stepData?.voice_id || prospect.selectedVoiceId,
    (stepData?.voice_type || prospect.voiceType) as 'male' | 'female' | null
  );

  await prisma.prospect.update({
    where: { id: prospect.id },
    data: {
      greetingText,
      voiceType: voiceResult.voiceType,
      selectedVoiceId: voiceResult.voiceId,
    },
  });

  prospect.greetingText = greetingText;
  prospect.voiceType = voiceResult.voiceType;
  prospect.selectedVoiceId = voiceResult.voiceId;

  logger.info('[WebhookOnboarding] Voice selected', {
    prospectId: prospect.id,
    voiceId: voiceResult.voiceId,
    voiceType: voiceResult.voiceType,
    provider: voiceResult.provider,
    selectionMethod: voiceResult.selectionMethod,
  });
}

/**
 * Step 7: Information Collection Settings
 */
async function processStep7(
  prospect: ProspectRecord,
  customerId: string | null,
  stepData?: WebhookOnboardingRequest['step_data'] extends infer T ? T extends { information_collection?: infer B } ? B : never : never
): Promise<void> {
  // Default information fields if none provided
  const defaultFields = ['name', 'email', 'phone', 'service'];
  const fields = stepData?.fields || defaultFields;
  const customFields = stepData?.custom_fields || [];

  const informationSettings = {
    selectedFields: fields,
    collectName: fields.includes('name'),
    collectEmail: fields.includes('email'),
    collectPhone: fields.includes('phone'),
    collectService: fields.includes('service'),
    collectPreferredTime: fields.includes('preferred_time'),
    collectCompany: fields.includes('company'),
    customFields,
  };

  await prisma.prospect.update({
    where: { id: prospect.id },
    data: { informationSettings: JSON.stringify(informationSettings) },
  });

  prospect.informationSettings = informationSettings;
}

/**
 * Step 8: Communication Settings
 */
async function processStep8(
  prospect: ProspectRecord,
  customerId: string | null,
  stepData?: WebhookOnboardingRequest['step_data'] extends infer T ? T extends { communication?: infer B } ? B : never : never
): Promise<void> {
  const meetingUrl = stepData?.meeting_url ?? prospect.meetingUrl ?? '';
  const smsEnabled = stepData?.sms_enabled ?? prospect.smsEnabled ?? false;
  const callTransferEnabled = stepData?.call_transfer_enabled ?? prospect.callTransferEnabled ?? false;
  const transferNumber = stepData?.transfer_number ?? prospect.transferNumber ?? null;

  await prisma.prospect.update({
    where: { id: prospect.id },
    data: {
      meetingUrl: meetingUrl || null,
      smsEnabled,
      callTransferEnabled,
      transferNumber: transferNumber || null,
    },
  });

  prospect.meetingUrl = meetingUrl || null;
  prospect.smsEnabled = smsEnabled;
  prospect.callTransferEnabled = callTransferEnabled;
  prospect.transferNumber = transferNumber || null;
}


/**
 * Step 9: Summary & Deploy
 * Updates deployment settings and billing model on the prospect.
 * The actual deployment logic is handled in postProcessOnboarding.
 */
async function processStep9(
  prospect: ProspectRecord,
  partner: PartnerInfo,
  customerId: string | null,
  stepData?: WebhookOnboardingRequest['step_data'] extends infer T ? T extends { deployment?: infer B } ? B : never : never
): Promise<void> {
  const billingModel = stepData?.billing_model || prospect.billingModel || 'free_trial';

  await prisma.prospect.update({
    where: { id: prospect.id },
    data: {
      billingModel,
      deploymentSettings: JSON.stringify({ completedViaWebhook: true }),
      selectedPricingPlan: billingModel,
    },
  });

  prospect.billingModel = billingModel;
}

// --- Post-Processing ---

/**
 * Post-processing after all 9 steps complete.
 * Handles: AI credits, deployment status, auto-deploy queue, notifications.
 * Replicates logic from save-onboarding-details/route.ts and enable-ai-credits/route.ts
 */
async function postProcessOnboarding(
  prospect: ProspectRecord,
  partner: PartnerInfo,
  customerId: string,
  customerEmail: string,
  customerName: string
): Promise<void> {
  // 1. Enable AI credits for the customer
  await enableAiCredits(customerId, partner.id);

  // 2. Determine deployment status based on auto-deploy and credits
  const isFreeForever = isFreeForeverPartner(partner.planId);
  const MIN_TELEPHONY_CREDITS_CENTS = isFreeForever ? 1000 : 500;
  const MIN_KNOTIE_CREDITS = 200;

  const hasSufficientCredits =
    (partner.telephonyCreditBalanceCents || 0) >= MIN_TELEPHONY_CREDITS_CENTS &&
    (partner.creditBalance || 0) >= MIN_KNOTIE_CREDITS;

  let deploymentStatus = 'not_started';
  if (partner.autoDeployEnabled) {
    deploymentStatus = hasSufficientCredits ? 'queued' : 'pending_credits';
  }

  // 3. Update customer deployment status
  await prisma.customer.update({
    where: { id: customerId },
    data: {
      deploymentStatus,
      deploymentRequestedAt: new Date(),
    },
  });

  logger.info(`[WebhookOnboarding] Onboarding completed for customer ${customerId}`, {
    autoDeployEnabled: partner.autoDeployEnabled,
    partnerId: partner.id,
    hasSufficientCredits,
    deploymentStatus,
  });

  // 4. Handle auto-deploy or send notification
  if (partner.autoDeployEnabled) {
    if (!hasSufficientCredits) {
      // Insufficient credits - notify partner
      await sendInsufficientCreditsEmail(partner, customerId, customerEmail, customerName, prospect, {
        telephonyCreditBalanceCents: partner.telephonyCreditBalanceCents,
        creditBalance: partner.creditBalance,
        minTelephonyCreditsCents: MIN_TELEPHONY_CREDITS_CENTS,
        minKnotieCredits: MIN_KNOTIE_CREDITS,
      });
    } else {
      // Queue auto-deploy job
      const result = await queueAutoDeployJob({
        customerId,
        partnerId: partner.id,
        prospectId: prospect.id,
        customerEmail,
        customerFirstName: prospect.firstName || '',
        customerLastName: prospect.lastName || '',
        customerPhone: prospect.phone || undefined,
        businessName: prospect.businessName || '',
        country: prospect.businessCountry || undefined,
      });

      if (!result.success) {
        logger.warn('[WebhookOnboarding] Auto-deploy queue failed, sending failure notification', {
          customerId, error: result.error,
        });
        await sendAutoDeployFailureEmail(partner, customerId, customerEmail, customerName, prospect, result.error || 'Unknown error');
      }
    }
  }

  // 5. Send deployment notification to partner
  await sendDeploymentNotificationEmail(partner, customerId, customerEmail, customerName, prospect);
}

// --- Utility Functions ---

function isFreeForeverPartner(planId: string | null): boolean {
  if (!planId) return false;
  const freeForeverPriceId = process.env.STRIPE_FREE_FOREVER_PRICE_ID;
  return (
    planId === 'free_forever_trial' ||
    planId === 'free_forever' ||
    (freeForeverPriceId !== undefined && planId === freeForeverPriceId)
  );
}

/**
 * Enable AI credits for a customer (replicates enable-ai-credits/route.ts)
 */
async function enableAiCredits(customerId: string, partnerId: string): Promise<void> {
  const FREE_CREDITS = 50;

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, creditBalance: true, aiCreditsEnabled: true },
  });

  if (!customer) return;

  // Skip if already enabled
  if (customer.aiCreditsEnabled) return;

  const userOnboarding = await prisma.userOnboarding.findFirst({
    where: { customerId, partnerId },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.customer.update({
      where: { id: customerId },
      data: {
        aiCreditsEnabled: true,
        creditBalance: { increment: FREE_CREDITS },
        deploymentStatus: 'not_started',
        deploymentRequestedAt: new Date(),
      },
    });

    if (userOnboarding) {
      await tx.userOnboarding.update({
        where: { id: userOnboarding.id },
        data: { showPricingInformation: false },
      });
    }

    await tx.creditTransaction.create({
      data: {
        customerId,
        partnerId,
        type: 'credit',
        amount: FREE_CREDITS,
        balanceAfter: (customer.creditBalance || 0) + FREE_CREDITS,
        description: 'Free AI Credits - Webhook Onboarding Completion',
        metadata: {
          source: 'webhook_onboarding',
          grantType: 'one_time',
          reason: 'Automatic credit grant after completing webhook onboarding',
        },
      },
    });
  });

  logger.info('[WebhookOnboarding] AI credits enabled', { customerId, credits: FREE_CREDITS });
}

/**
 * Queue auto-deploy job to KnotieManager
 */
async function queueAutoDeployJob(params: {
  customerId: string;
  partnerId: string;
  prospectId: string;
  customerEmail: string;
  customerFirstName: string;
  customerLastName: string;
  customerPhone?: string;
  businessName: string;
  country?: string;
}): Promise<{ success: boolean; jobId?: string; error?: string }> {
  try {
    if (!KNOTIE_MANAGER_API_KEY) {
      logger.error('[WebhookOnboarding] KNOTIE_MANAGER_API_KEY not configured');
      return { success: false, error: 'KnotieManager API key not configured' };
    }

    const response = await fetch(`${KNOTIE_MANAGER_URL}/api/auto-deploy/queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-api-key': KNOTIE_MANAGER_API_KEY,
      },
      body: JSON.stringify(params),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || data.message };
    }

    logger.info('[WebhookOnboarding] Auto-deploy job queued', {
      customerId: params.customerId,
      jobId: data.jobId,
    });

    return { success: true, jobId: data.jobId };
  } catch (error) {
    logger.error('[WebhookOnboarding] Error queuing auto-deploy', error instanceof Error ? error : undefined);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// --- Email Notification Functions ---

/**
 * Send insufficient credits notification to partner
 */
async function sendInsufficientCreditsEmail(
  partner: PartnerInfo,
  customerId: string,
  customerEmail: string,
  customerName: string,
  prospect: ProspectRecord,
  credits: {
    telephonyCreditBalanceCents: number;
    creditBalance: number;
    minTelephonyCreditsCents: number;
    minKnotieCredits: number;
  }
): Promise<void> {
  try {
    const telephonyBalanceDollars = (credits.telephonyCreditBalanceCents / 100).toFixed(2);
    const minTelephonyDollars = (credits.minTelephonyCreditsCents / 100).toFixed(2);

    await sendEmail({
      to: partner.emailAddress,
      subject: `⚠️ Auto-Deployment Pending - Credits Required - ${prospect.businessName || customerName}`,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #b45309;">⚠️ Auto-Deployment Pending - Credits Required</h2>
        <p><strong>Customer:</strong> ${customerName} (${customerEmail})</p>
        <p><strong>Business:</strong> ${prospect.businessName || 'N/A'}</p>
        <p><strong>Source:</strong> Webhook Onboarding API</p>
        <hr/>
        <p>Your telephony credits: <strong>$${telephonyBalanceDollars}</strong> (min: $${minTelephonyDollars})</p>
        <p>Your Knotie credits: <strong>${credits.creditBalance}</strong> (min: ${credits.minKnotieCredits})</p>
        <p>Please add credits and resume deployment from the Partner Portal.</p>
      </div>`,
      from: 'notification@knotie-ai.pro',
      fromName: 'Knotie AI Pro',
      emailType: 'insufficient_credits_notification',
    });
  } catch (error) {
    logger.error('[WebhookOnboarding] Failed to send insufficient credits email', error instanceof Error ? error : undefined);
  }
}

/**
 * Send auto-deploy failure notification to support
 */
async function sendAutoDeployFailureEmail(
  partner: PartnerInfo,
  customerId: string,
  customerEmail: string,
  customerName: string,
  prospect: ProspectRecord,
  errorMessage: string
): Promise<void> {
  try {
    await sendEmail({
      to: 'support@knotie-ai.pro',
      subject: `[Auto-Deploy Failed] ${partner.businessName} - ${prospect.businessName || customerName} (Webhook)`,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #dc2626;">⚠️ Auto-Deploy Failed (Webhook Onboarding)</h2>
        <p><strong>Error:</strong> ${errorMessage}</p>
        <p><strong>Partner:</strong> ${partner.businessName} (${partner.id})</p>
        <p><strong>Customer:</strong> ${customerName} (${customerEmail})</p>
        <p><strong>Customer ID:</strong> ${customerId}</p>
        <p><strong>Business:</strong> ${prospect.businessName || 'N/A'}</p>
        <p style="color: #92400e;">Action Required: Investigate and assist with manual deployment.</p>
      </div>`,
      from: 'notification@knotie-ai.pro',
      fromName: 'Knotie AI Pro - System Alert',
      emailType: 'auto_deploy_failure',
    });
  } catch (error) {
    logger.error('[WebhookOnboarding] Failed to send auto-deploy failure email', error instanceof Error ? error : undefined);
  }
}

/**
 * Send deployment notification to partner
 */
async function sendDeploymentNotificationEmail(
  partner: PartnerInfo,
  customerId: string,
  customerEmail: string,
  customerName: string,
  prospect: ProspectRecord
): Promise<void> {
  try {
    const isAutoDeploy = partner.autoDeployEnabled;
    const subject = isAutoDeploy
      ? `🤖 New Customer Onboarded via API - Auto-Deployment in Progress - ${prospect.businessName || customerName}`
      : `🚀 New AI Agent Deployment Request (via API) - ${prospect.businessName || customerName}`;

    const html = isAutoDeploy
      ? `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #059669;">🤖 Auto-Deployment in Progress</h2>
          <p><strong>Customer:</strong> ${customerName} (${customerEmail})</p>
          <p><strong>Business:</strong> ${prospect.businessName || 'N/A'}</p>
          <p><strong>Source:</strong> Webhook Onboarding API</p>
          <p>Knotie AI Pro is automatically provisioning a phone number and configuring the AI agent.</p>
          <p>You and your customer will be notified once the agent is ready.</p>
        </div>`
      : `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #3B82F6;">🚀 New Deployment Request</h2>
          <p><strong>Customer:</strong> ${customerName} (${customerEmail})</p>
          <p><strong>Business:</strong> ${prospect.businessName || 'N/A'}</p>
          <p><strong>Customer ID:</strong> ${customerId}</p>
          <p><strong>Source:</strong> Webhook Onboarding API</p>
          <p>Please review the customer's details in your partner portal and proceed with deployment.</p>
        </div>`;

    await sendEmail({
      to: partner.emailAddress,
      subject,
      html,
      from: 'notification@knotie-ai.pro',
      fromName: 'Knotie AI Pro',
    });
  } catch (error) {
    logger.error('[WebhookOnboarding] Failed to send deployment notification', error instanceof Error ? error : undefined);
  }
}