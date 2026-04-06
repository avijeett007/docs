/**
 * Experience Booking Service
 *
 * Shared logic for converting a prospect (from a One-Click Experience landing page)
 * into a full Customer with portal access, credentials, and a welcome email.
 *
 * Called by:
 *  - Stripe webhook (paid flow): after checkout.session.completed
 *  - Experience leads API (free flow): immediately after the prospect is saved
 */

import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { logger } from '@/lib/logger';
import { generateSecurePassword } from '@/lib/passwordUtils';
import { sendWhitelabelSignupEmail } from '@/lib/services/email-service';
import { getEffectivePortalLoginUrl } from '@/lib/portalUrlUtils';
import { getPartnerDefaultPlan, applyPlanFeaturesToCustomer } from '@/lib/services/planFeatureService';

// ── Shared types ─────────────────────────────────────────────────────────────

export type ProspectForConversion = {
  id: string;
  partnerId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  businessName: string | null;
  ghlContactId: string | null;
  convertedToCustomerId: string | null;
};

export type PartnerForConversion = {
  id: string;
  businessName: string;
  subdomain: string | null;
  customDomain: string | null;
  customDomainVerified: boolean;
  logo: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  autoDeployEnabled: boolean;
  planId: string | null;
  approvalStatus: string | null;
  customLandingPageUrl: string | null;
  // AI Gateway / Credits — used for new-customer auto-enablement
  customerGatewayEnabled?: boolean;
  customerGatewayForNewCustomers?: boolean;
};

// ── Main conversion function ──────────────────────────────────────────────────

/**
 * Converts a prospect into a Customer with CustomerCredential, UserOnboarding,
 * applies the partner's default plan features, and sends a branded signup email.
 *
 * Idempotent: if credentials already exist for this partner + email, the
 * prospect is linked to the pre-existing customer and the function returns early.
 */
export async function convertExperienceProspectToCustomer(
  prospect: ProspectForConversion,
  partner: PartnerForConversion,
): Promise<void> {
  const firstName = prospect.firstName?.trim() || '';
  const lastName = prospect.lastName?.trim() || '';
  const email = prospect.email?.toLowerCase().trim() || '';

  if (!firstName || !email) {
    throw new Error(
      `Prospect ${prospect.id} is missing firstName or email — cannot create customer account`,
    );
  }

  // Idempotency: check if a credential already exists for this partner + email
  const existingCredential = await prisma.customerCredential.findUnique({
    where: { partnerId_email: { partnerId: partner.id, email } },
    select: { customerId: true },
  });

  if (existingCredential) {
    await prisma.prospect.update({
      where: { id: prospect.id },
      data: { convertedToCustomerId: existingCredential.customerId, convertedAt: new Date() },
    });
    logger.info('[ExperienceBooking] Prospect linked to pre-existing customer account', {
      operation: 'experience_booking_convert',
      prospectId: prospect.id,
      customerId: existingCredential.customerId,
    });
    return;
  }

  // Generate temporary login credentials
  const temporaryPassword = generateSecurePassword();
  const hashedPassword = await bcrypt.hash(temporaryPassword, 12);
  const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  // Determine AI Credits / Gateway flags from partner settings
  const enableAiCredits = true; // Always enable AI Credits for experience-sourced customers
  const enableAiGateway =
    (partner.customerGatewayEnabled ?? false) &&
    (partner.customerGatewayForNewCustomers ?? false);

  // Create Customer + CustomerCredential + UserOnboarding
  const customer = await prisma.customer.create({
    data: {
      userId,
      email,
      firstName,
      lastName,
      businessName: prospect.businessName || `${firstName} ${lastName}`,
      status: 'active',
      customerPortalEnabled: true,
      ghlContactId: prospect.ghlContactId || null,
      isGhlSynced: prospect.ghlContactId ? true : false,
      ghlSyncStatus: prospect.ghlContactId ? 'synced' : 'pending',
      // AI Credits: always enabled for experience-sourced customers
      aiCreditsEnabled: enableAiCredits,
    },
  });

  await prisma.customerCredential.create({
    data: {
      customerId: customer.id,
      partnerId: partner.id,
      email,
      passwordHash: hashedPassword,
    },
  });

  await prisma.userOnboarding.create({
    data: {
      userId: customer.userId,
      email,
      firstName,
      lastName,
      companyName: prospect.businessName || `${firstName} ${lastName}`,
      partnerId: partner.id,
      customerId: customer.id,
      customerPortalEnabled: true,
      isOnboardingCompleted: false,
      orderStatus: 'pending',
      autoEmbeddingEnabled: partner.autoDeployEnabled === true,
      // AI Gateway: show menu if partner has enabled self-service for new customers
      showAiGateway: enableAiGateway,
    },
  });

  // Link prospect → customer
  await prisma.prospect.update({
    where: { id: prospect.id },
    data: { convertedToCustomerId: customer.id, convertedAt: new Date() },
  });

  // Apply partner's default plan features (non-blocking)
  try {
    const defaultPlanId = await getPartnerDefaultPlan(partner.id);
    if (defaultPlanId) {
      await applyPlanFeaturesToCustomer(defaultPlanId, customer.id, partner.id);
      logger.info('[ExperienceBooking] Plan features applied to new customer', {
        operation: 'experience_booking_convert',
        customerId: customer.id,
        planId: defaultPlanId,
      });
    }
  } catch (planErr) {
    logger.error(
      '[ExperienceBooking] Failed to apply plan features (non-fatal)',
      planErr instanceof Error ? planErr : new Error(String(planErr)),
      { operation: 'experience_booking_convert', customerId: customer.id },
    );
  }

  // Send welcome email with login credentials
  const loginUrl = getEffectivePortalLoginUrl(partner);
  await sendWhitelabelSignupEmail({
    to: email,
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

  logger.info('[ExperienceBooking] Prospect successfully converted to customer', {
    operation: 'experience_booking_convert',
    prospectId: prospect.id,
    customerId: customer.id,
    partnerId: partner.id,
    aiCreditsEnabled: enableAiCredits,
    showAiGateway: enableAiGateway,
  });
}

