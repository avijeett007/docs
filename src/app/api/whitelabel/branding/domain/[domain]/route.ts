import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma, ensureConnectionReady, prismaWithRecovery } from '@/lib/prisma';
import { domainCache } from '@/lib/domain-cache';



export async function GET(
  request: NextRequest,
  { params }: { params: { domain: string } }
) {
  try {
    const domain = decodeURIComponent(params.domain);

    if (!domain) {
      return NextResponse.json({ error: 'Domain parameter is required' }, { status: 400 });
    }

    // Try cache first
    const cached = await domainCache.get(domain, 'customDomain');
    if (cached) {
      console.log(`[DomainCache] Serving cached data for custom domain: ${domain}`);
      return NextResponse.json(cached.branding);
    }

    // PRODUCTION FIX: Ensure connection is ready before database operation
    await ensureConnectionReady();

    // Find partner by custom domain with auto-recovery
    // Include byoaVoices for BYOA tier partners
    const partner = await prismaWithRecovery(
      () => prisma.partner.findFirst({
        where: {
          customDomain: { equals: domain, mode: 'insensitive' },
          customerPortalEnabled: true
        },
        include: {
          byoaVoices: {
            where: { isActive: true },
            orderBy: { displayOrder: 'asc' }
          }
        }
      }),
      `partner_lookup_domain_${domain}`
    );

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found for this domain' }, { status: 404 });
    }

    // Return partner branding information directly (not nested under 'partner')
    // This matches the format expected by the frontend
    const brandingData = {
      id: partner.id,
      businessName: partner.businessName,
      logo: partner.logo,
      // @ts-ignore - New field that TypeScript doesn't know about yet
      logoSize: (partner as any).logoSize || 'medium',
      // @ts-ignore - New field that TypeScript doesn't know about yet
      favicon: (partner as any).favicon,
      primaryColor: partner.primaryColor || '#3B82F6',
      secondaryColor: partner.secondaryColor || '#10B981',
      fontFamily: partner.fontFamily || 'Inter',
      portalTitle: partner.portalTitle || `${partner.businessName} AI Portal`,
      portalSlogan: partner.portalSlogan || 'Powered by advanced voice AI technology',
      customerPortalEnabled: partner.customerPortalEnabled !== undefined ? partner.customerPortalEnabled : true,
      enableCustomerSignup: partner.enableCustomerSignup === true,
      themePreference: partner.themePreference || 'MODERN',
      // Enhanced Landing Page Configuration
      // @ts-ignore - New fields that TypeScript doesn't know about yet
      supportEmail: (partner as any).supportEmail || undefined,
      // @ts-ignore
      companyAddress: (partner as any).companyAddress || undefined,
      // @ts-ignore
      companyPhone: (partner as any).companyPhone || undefined,
      // @ts-ignore
      privacyPolicyUrl: (partner as any).privacyPolicyUrl || undefined,
      // @ts-ignore
      termsOfServiceUrl: (partner as any).termsOfServiceUrl || undefined,
      // @ts-ignore
      statusPageUrl: (partner as any).statusPageUrl || undefined,
      // Social Media Links
      // @ts-ignore
      twitterUrl: (partner as any).twitterUrl || undefined,
      // @ts-ignore
      linkedinUrl: (partner as any).linkedinUrl || undefined,
      // @ts-ignore
      facebookUrl: (partner as any).facebookUrl || undefined,
      // @ts-ignore
      instagramUrl: (partner as any).instagramUrl || undefined,
      // Landing Page Content
      // @ts-ignore
      features: (partner as any).features || undefined,
      // @ts-ignore
      testimonials: (partner as any).testimonials || undefined,
      // @ts-ignore
      faqs: (partner as any).faqs || undefined,
      // @ts-ignore
      trustIndicators: (partner as any).trustIndicators || undefined,
      // Footer Section Controls
      // @ts-ignore
      showQuickLinks: (partner as any).showQuickLinks !== false,
      // @ts-ignore
      showResources: (partner as any).showResources !== false,
      // @ts-ignore
      showNewsletter: (partner as any).showNewsletter !== false,
      // @ts-ignore
      showLegal: (partner as any).showLegal !== false,
      // @ts-ignore
      showSocialMedia: (partner as any).showSocialMedia !== false,
      // @ts-ignore
      showContactInfo: (partner as any).showContactInfo !== false,
      // @ts-ignore
      showCommunity: (partner as any).showCommunity || false,
      // @ts-ignore
      communityUrl: (partner as any).communityUrl || undefined,
      // @ts-ignore
      moreTestimonialsUrl: (partner as any).moreTestimonialsUrl || undefined,
      // SaaS Portal Configuration
      // @ts-ignore
      portalMode: (partner as any).portalMode || 'BASIC',
      // @ts-ignore
      characterName: (partner as any).character_name || (partner as any).characterName || undefined,
      // @ts-ignore
      freeTrialEnabled: (partner as any).free_trial_enabled === true || (partner as any).freeTrialEnabled === true,
      // @ts-ignore
      saasOnboardingEnabled: (partner as any).saas_onboarding_enabled === true || (partner as any).saasOnboardingEnabled === true,
      // Pricing Configuration
      // @ts-ignore
      freeAiCredits: (partner as any).freeAiCredits || (partner as any).free_ai_credits || 50,
      // @ts-ignore
      pricingModel: (partner as any).pricingModel || (partner as any).pricing_model || 'subscription',
      // @ts-ignore
      payAsYouGoRate: parseFloat((partner as any).payAsYouGoRate || (partner as any).pay_as_you_go_rate || '0.10'),
      // @ts-ignore
      autoDeployEnabled: (partner as any).autoDeployEnabled === true || (partner as any).auto_deploy_enabled === true,
      // @ts-ignore
      saasAgentTier: (partner as any).saasAgentTier || (partner as any).saas_agent_tier || 'ESSENTIALS',

      // Fixed Price Configuration (Display Only)
      // @ts-ignore
      fixedPrice: parseFloat((partner as any).fixedPrice || (partner as any).fixed_price || '0'),
      // @ts-ignore
      fixedPriceCurrency: (partner as any).fixedPriceCurrency || (partner as any).fixed_price_currency || 'USD',
      // @ts-ignore
      fixedPricePeriod: (partner as any).fixedPricePeriod || (partner as any).fixed_price_period || 'month',
      // @ts-ignore
      fixedPriceFeatures: (partner as any).fixedPriceFeatures || (partner as any).fixed_price_features || undefined,

      // AI Translation System
      translatedTexts: (partner as any).translatedTexts || undefined,
      translationEnabled: (partner as any).translationEnabled || false,

      // BYOA Voices - Include partner's saved voices when using BYOA tier
      // @ts-ignore - Dynamic field for BYOA tier partners
      byoaVoices: (partner as any).saasAgentTier === 'BYOA' && (partner as any).byoaVoices?.length > 0
        ? (partner as any).byoaVoices.map((v: any) => ({
            id: v.id,
            voiceId: v.voiceId,
            voiceName: v.voiceName,
            provider: v.provider,
            gender: v.gender,
            language: v.language,
            accent: v.accent,
            previewUrl: v.previewUrl
          }))
        : undefined
    };

    // Cache the result for future requests
    const isApproved = partner.approvalStatus === 'APPROVED';

    await domainCache.set(domain, 'customDomain', {
      partnerId: partner.id,
      branding: brandingData,
      type: 'customDomain',
      cachedAt: Date.now(),
      isApproved
    });

    return NextResponse.json(brandingData);
  } catch (error: any) {
    console.error('Error fetching partner by custom domain:', error);

    // Handle specific Prisma errors
    if (error.code === 'P1017') {
      console.error('Database connection closed. This may indicate connection pool issues.');
      return NextResponse.json({
        error: 'Database connection error. Please try again.'
      }, { status: 503 }); // Service Unavailable
    }

    if (error.code?.startsWith('P')) {
      console.error('Prisma error:', error.code, error.message);
      return NextResponse.json({
        error: 'Database error occurred'
      }, { status: 500 });
    }

    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}
