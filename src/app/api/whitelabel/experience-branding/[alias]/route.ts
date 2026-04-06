import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PartnerBranding } from '@/types/partner';
import { ExperienceBranding } from '@/types/experience';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/whitelabel/experience-branding/[alias]
 *
 * Public endpoint (no auth required) for landing pages.
 * Fetches partner branding merged with experience-specific branding overrides.
 *
 * The partner is determined from the hostname (subdomain or custom domain).
 * The experience is looked up by alias (e.g., "assistant" → "/assistant").
 *
 * Returns: PartnerBranding with experience-specific overrides applied.
 * If no experience-specific branding is set, returns the partner's default branding.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { alias: string } }
) {
  const { alias } = params;
  const normalizedAlias = alias.startsWith('/') ? alias : `/${alias}`;

  try {
    // Determine the partner from the hostname
    const hostname = request.headers.get('host') || '';
    const partnerId = request.headers.get('x-partner-id');

    let partner;

    if (partnerId) {
      // Partner ID set by middleware
      partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        include: {
          subscriptionPlans: true,
          byoaVoices: {
            where: { isActive: true },
            orderBy: { displayOrder: 'asc' },
          },
        },
      });
    } else {
      // Fallback: determine partner from hostname
      const subdomain = extractSubdomain(hostname);
      if (subdomain) {
        partner = await prisma.partner.findFirst({
          where: { subdomain: { equals: subdomain, mode: 'insensitive' } },
          include: {
            subscriptionPlans: true,
            byoaVoices: {
              where: { isActive: true },
              orderBy: { displayOrder: 'asc' },
            },
          },
        });
      }

      // Try custom domain if subdomain lookup failed
      if (!partner) {
        partner = await prisma.partner.findFirst({
          where: { customDomain: { equals: hostname.split(':')[0], mode: 'insensitive' } },
          include: {
            subscriptionPlans: true,
            byoaVoices: {
              where: { isActive: true },
              orderBy: { displayOrder: 'asc' },
            },
          },
        });
      }
    }

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    // Find the experience by alias for this partner
    const experience = await prisma.partnerExperience.findFirst({
      where: {
        partnerId: partner.id,
        alias: normalizedAlias,
        enabled: true,
      },
    });

    // Build base partner branding (same structure as /api/whitelabel/branding/[subdomain])
    const baseBranding = buildPartnerBranding(partner);

    // If experience has branding overrides, merge them
    if (experience) {
      const landingConfig = (experience.landingPageConfig as Record<string, unknown>) || {};
      const expBranding = (landingConfig.branding as ExperienceBranding) || {};

      // Override only the fields that are explicitly set in experience branding
      if (expBranding.logo) baseBranding.logo = expBranding.logo;
      if (expBranding.logoSize) baseBranding.logoSize = expBranding.logoSize;
      if (expBranding.favicon) baseBranding.favicon = expBranding.favicon;
      if (expBranding.primaryColor) baseBranding.primaryColor = expBranding.primaryColor;
      if (expBranding.secondaryColor) baseBranding.secondaryColor = expBranding.secondaryColor;
      if (expBranding.businessName) baseBranding.businessName = expBranding.businessName;
      if (expBranding.portalTitle) baseBranding.portalTitle = expBranding.portalTitle;
      if (expBranding.portalSlogan) baseBranding.portalSlogan = expBranding.portalSlogan;

      // Pass through experience-specific fields as extra data
      const calendarUrl = typeof landingConfig.calendarUrl === 'string' ? landingConfig.calendarUrl : undefined;
      const showEmbeddedCalendar = landingConfig.showEmbeddedCalendar === true;
      const prepaidBooking = (landingConfig.prepaidBooking as Record<string, unknown> | undefined) || undefined;
      return NextResponse.json({
        ...baseBranding,
        assistantName: expBranding.assistantName || undefined,
        calendarUrl,
        showEmbeddedCalendar,
        prepaidBooking: prepaidBooking?.enabled
          ? {
              enabled: true,
              amount: Number(prepaidBooking.amount) || 0,
              currency: (prepaidBooking.currency as string) || 'usd',
              description: (prepaidBooking.description as string) || '',
            }
          : undefined,
      });
    }

    return NextResponse.json(baseBranding);
  } catch (error) {
    logger.error(`Error fetching experience branding for alias ${alias}`, error instanceof Error ? error : new Error(String(error)), { operation: 'get_experience_branding' });
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development'
          ? (error instanceof Error ? error.message : String(error))
          : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * Extract subdomain from hostname.
 * e.g., "knolabs.lvh.me:3000" → "knolabs"
 * e.g., "knolabs.knotie-ai.pro" → "knolabs"
 */
function extractSubdomain(hostname: string): string | null {
  const host = hostname.split(':')[0]; // Remove port
  if (host.includes('.lvh.me')) return host.split('.')[0];
  if (host.includes('.knotie-ai.pro')) return host.split('.')[0];
  return null;
}

/**
 * Build PartnerBranding from partner record.
 * Mirrors the logic in /api/whitelabel/branding/[subdomain]/route.ts
 */
function buildPartnerBranding(partner: any): PartnerBranding {
  return {
    id: partner.id,
    businessName: partner.businessName,
    logo: partner.logo || undefined,
    logoSize: partner.logoSize || 'medium',
    favicon: partner.favicon || undefined,
    primaryColor: partner.primaryColor || '#3B82F6',
    secondaryColor: partner.secondaryColor || '#10B981',
    fontFamily: partner.fontFamily || 'Inter',
    portalTitle: partner.portalTitle || undefined,
    portalSlogan: partner.portalSlogan || undefined,
    customerPortalEnabled: partner.customerPortalEnabled !== undefined ? partner.customerPortalEnabled : false,
    enableCustomerSignup: partner.enableCustomerSignup === true,
    themePreference: partner.themePreference || 'MODERN',
    voiceAiAgentEnabled: partner.voiceAiAgentEnabled === true,
    voiceAiAgentPricingNote: partner.voiceAiAgentPricingNote || '',
    voiceAiAgentSpecialOffer: partner.voiceAiAgentSpecialOffer || '',
    voiceAiAgentName: partner.voiceAiAgentName || 'Knotie',
    voiceAiAgentVoiceType: partner.voiceAiAgentVoiceType || 'female',
    supportEmail: partner.supportEmail || undefined,
    companyAddress: partner.companyAddress || undefined,
    companyPhone: partner.companyPhone || undefined,
    privacyPolicyUrl: partner.privacyPolicyUrl || undefined,
    termsOfServiceUrl: partner.termsOfServiceUrl || undefined,
    statusPageUrl: partner.statusPageUrl || undefined,
    twitterUrl: partner.twitterUrl || undefined,
    linkedinUrl: partner.linkedinUrl || undefined,
    facebookUrl: partner.facebookUrl || undefined,
    instagramUrl: partner.instagramUrl || undefined,
    testimonials: partner.testimonials || undefined,
    features: partner.features || undefined,
    faqs: partner.faqs || undefined,
    trustIndicators: partner.trustIndicators || undefined,
    showQuickLinks: partner.showQuickLinks !== false,
    showResources: partner.showResources !== false,
    showNewsletter: partner.showNewsletter !== false,
    showLegal: partner.showLegal !== false,
    showSocialMedia: partner.showSocialMedia !== false,
    showContactInfo: partner.showContactInfo !== false,
    showCommunity: partner.showCommunity || false,
    communityUrl: partner.communityUrl || undefined,
    moreTestimonialsUrl: partner.moreTestimonialsUrl || undefined,
    hasSubscriptionPlans: partner.subscriptionPlans && partner.subscriptionPlans.length > 0,
    portalMode: partner.portalMode || 'BASIC',
    characterName: partner.character_name || partner.characterName || undefined,
    freeTrialEnabled: partner.free_trial_enabled === true || partner.freeTrialEnabled === true,
    saasOnboardingEnabled: partner.saas_onboarding_enabled === true || partner.saasOnboardingEnabled === true,
    autoDeployEnabled: partner.autoDeployEnabled === true || partner.auto_deploy_enabled === true,
    freeAiCredits: partner.freeAiCredits || partner.free_ai_credits || 50,
    pricingModel: partner.pricingModel || partner.pricing_model || 'subscription',
    payAsYouGoRate: parseFloat(partner.payAsYouGoRate || partner.pay_as_you_go_rate || '0.10'),
    fixedPrice: parseFloat(partner.fixedPrice || partner.fixed_price || '0'),
    fixedPriceCurrency: partner.fixedPriceCurrency || partner.fixed_price_currency || 'USD',
    fixedPricePeriod: partner.fixedPricePeriod || partner.fixed_price_period || 'month',
    fixedPriceFeatures: partner.fixedPriceFeatures || partner.fixed_price_features || undefined,
    basicPortalLanguage: partner.basicPortalLanguage || 'en',
    saasPortalLanguage: partner.saasPortalLanguage || 'en',
    saasAgentTier: partner.saasAgentTier || 'ESSENTIALS',
    translatedTexts: partner.translatedTexts || undefined,
    translationEnabled: partner.translationEnabled || false,
    byoaVoices: partner.saasAgentTier === 'BYOA' && partner.byoaVoices?.length > 0
      ? partner.byoaVoices.map((v: any) => ({
          id: v.id,
          voiceId: v.voiceId,
          voiceName: v.voiceName,
          provider: v.provider,
          gender: v.gender,
          language: v.language,
          accent: v.accent,
          previewUrl: v.previewUrl,
        }))
      : undefined,
  } as PartnerBranding;
}

