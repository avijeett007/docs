import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PartnerBranding } from '@/types/partner';
import { domainCache } from '@/lib/domain-cache';

export const dynamic = 'force-dynamic'; // Ensure dynamic responses

export async function GET(
  request: NextRequest,
  { params }: { params: { subdomain: string } }
) {
  const { subdomain } = params;

  try {
    // Try cache first
    const cached = await domainCache.get(subdomain, 'subdomain');
    if (cached) {
      console.log(`[DomainCache] Serving cached data for subdomain: ${subdomain}`);
      return NextResponse.json(cached.branding);
    }

    // Log incoming request for debugging (trace level)
    if (process.env.ENABLE_TRACE_LOGS === 'true') {
      console.log(`Fetching partner branding for domain: ${subdomain}`);
      console.log(`Checking database for partner with subdomain or custom domain: '${subdomain}'`);
    }

    // Find the partner using Prisma - check both subdomain and customDomain fields
    // First try to find by subdomain (for cases like agency.knotie-ai.pro)
    // Fix 2: Use case-insensitive lookup for existing data compatibility
    let partner = await prisma.partner.findFirst({
      where: {
        subdomain: { equals: subdomain, mode: 'insensitive' }
      },
      include: {
        subscriptionPlans: true, // Include subscription plans to check if partner has any
        byoaVoices: {
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' }
        }
      }
    });

    // If not found by subdomain, try to find by custom domain (for cases like app.viddescriptor.com)
    if (!partner) {
      // Try cache for custom domain
      const customDomainCached = await domainCache.get(subdomain, 'customDomain');
      if (customDomainCached) {
        console.log(`[DomainCache] Serving cached data for custom domain: ${subdomain}`);
        return NextResponse.json(customDomainCached.branding);
      }

      if (process.env.ENABLE_TRACE_LOGS === 'true') {
        console.log(`No partner found with subdomain '${subdomain}', trying custom domain lookup...`);
      }

      // First, let's check if there's a partner with this custom domain (regardless of verification status)
      // Fix 2: Use case-insensitive lookup for existing data compatibility
      const customDomainPartner = await prisma.partner.findFirst({
        where: {
          customDomain: { equals: subdomain, mode: 'insensitive' }
        },
        select: {
          id: true,
          businessName: true,
          customDomain: true,
          customDomainVerified: true
        }
      });

      if (customDomainPartner) {
        // Return the partner regardless of verification status (matching middleware behavior)
        // Fix 2: Use case-insensitive lookup for existing data compatibility
        partner = await prisma.partner.findFirst({
          where: {
            customDomain: { equals: subdomain, mode: 'insensitive' }
          },
          include: {
            subscriptionPlans: true,
            byoaVoices: {
              where: { isActive: true },
              orderBy: { displayOrder: 'asc' }
            }
          }
        });

        if (!customDomainPartner.customDomainVerified && process.env.ENABLE_TRACE_LOGS === 'true') {
          console.log(`Custom domain '${subdomain}' found but not verified. Proceeding anyway to match middleware behavior.`);
        }
      } else if (process.env.ENABLE_TRACE_LOGS === 'true') {
        console.log(`No partner found with custom domain '${subdomain}' at all`);
      }
    }

    // Log the found partner (sensitive details removed) - trace level
    if (process.env.ENABLE_TRACE_LOGS === 'true') {
      if (partner) {
        const domainType = partner.subdomain === subdomain ? 'subdomain' : 'custom domain';
        console.log(`Found partner by ${domainType}: ${partner.id}, portal enabled: ${partner.customerPortalEnabled}`);
        console.log(`Partner enableCustomerSignup value: ${partner.enableCustomerSignup}`);
        console.log(`Partner enableCustomerSignup type: ${typeof partner.enableCustomerSignup}`);
      } else {
        console.log(`No partner found with subdomain or custom domain: '${subdomain}'`);
      }
    }

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    if (partner.customerPortalEnabled === false) {
      return NextResponse.json({ error: 'Customer portal is not enabled for this partner' }, { status: 403 });
    }

    // Create a properly typed response object
    const brandingData: PartnerBranding = {
      id: partner.id,
      businessName: partner.businessName,
      logo: partner.logo || undefined,
      // @ts-ignore - New field that TypeScript doesn't know about yet
      logoSize: (partner as any).logoSize || 'medium',
      // @ts-ignore - New field that TypeScript doesn't know about yet
      favicon: (partner as any).favicon || undefined,
      primaryColor: partner.primaryColor || '#3B82F6',
      secondaryColor: partner.secondaryColor || '#10B981',
      fontFamily: partner.fontFamily || 'Inter',
      portalTitle: partner.portalTitle || undefined,
      portalSlogan: partner.portalSlogan || undefined,
      customerPortalEnabled: partner.customerPortalEnabled !== undefined ? partner.customerPortalEnabled : false,
      enableCustomerSignup: partner.enableCustomerSignup === true,
      // Handle theme preference - Prisma automatically maps theme_preference to themePreference
      themePreference: partner.themePreference || 'MODERN',
      // Voice AI Agent fields
      voiceAiAgentEnabled: partner.voiceAiAgentEnabled === true,
      voiceAiAgentPricingNote: partner.voiceAiAgentPricingNote || '',
      voiceAiAgentSpecialOffer: partner.voiceAiAgentSpecialOffer || '',
      voiceAiAgentName: partner.voiceAiAgentName || 'Knotie',
      voiceAiAgentVoiceType: partner.voiceAiAgentVoiceType || 'female',
      // Enhanced Landing Page Configuration
      supportEmail: (partner as any).supportEmail || undefined,
      companyAddress: (partner as any).companyAddress || undefined,
      companyPhone: (partner as any).companyPhone || undefined,
      privacyPolicyUrl: (partner as any).privacyPolicyUrl || undefined,
      termsOfServiceUrl: (partner as any).termsOfServiceUrl || undefined,
      statusPageUrl: (partner as any).statusPageUrl || undefined,
      // Social Media Links
      twitterUrl: (partner as any).twitterUrl || undefined,
      linkedinUrl: (partner as any).linkedinUrl || undefined,
      facebookUrl: (partner as any).facebookUrl || undefined,
      instagramUrl: (partner as any).instagramUrl || undefined,
      // Landing Page Content
      testimonials: (partner as any).testimonials || undefined,
      features: (partner as any).features || undefined,
      faqs: (partner as any).faqs || undefined,
      trustIndicators: (partner as any).trustIndicators || undefined,
      // Footer Section Controls
      showQuickLinks: (partner as any).showQuickLinks !== false,
      showResources: (partner as any).showResources !== false,
      showNewsletter: (partner as any).showNewsletter !== false,
      showLegal: (partner as any).showLegal !== false,
      showSocialMedia: (partner as any).showSocialMedia !== false,
      showContactInfo: (partner as any).showContactInfo !== false,
      showCommunity: (partner as any).showCommunity || false,
      communityUrl: (partner as any).communityUrl || undefined,
      moreTestimonialsUrl: (partner as any).moreTestimonialsUrl || undefined,
      // Subscription Plans Check
      hasSubscriptionPlans: partner.subscriptionPlans && partner.subscriptionPlans.length > 0,
      // SaaS Portal Configuration
      portalMode: partner.portalMode || 'BASIC',
      characterName: (partner as any).character_name || (partner as any).characterName || undefined,
      freeTrialEnabled: (partner as any).free_trial_enabled === true || (partner as any).freeTrialEnabled === true,
      saasOnboardingEnabled: (partner as any).saas_onboarding_enabled === true || (partner as any).saasOnboardingEnabled === true,
      autoDeployEnabled: (partner as any).autoDeployEnabled === true || (partner as any).auto_deploy_enabled === true,
      // Pricing Configuration
      freeAiCredits: (partner as any).freeAiCredits || (partner as any).free_ai_credits || 50,
      pricingModel: (partner as any).pricingModel || (partner as any).pricing_model || 'subscription',
      payAsYouGoRate: parseFloat((partner as any).payAsYouGoRate || (partner as any).pay_as_you_go_rate || '0.10'),

      // Fixed Price Configuration (Display Only)
      fixedPrice: parseFloat((partner as any).fixedPrice || (partner as any).fixed_price || '0'),
      fixedPriceCurrency: (partner as any).fixedPriceCurrency || (partner as any).fixed_price_currency || 'USD',
      fixedPricePeriod: (partner as any).fixedPricePeriod || (partner as any).fixed_price_period || 'month',
      fixedPriceFeatures: (partner as any).fixedPriceFeatures || (partner as any).fixed_price_features || undefined,

      // Multi-language support
      basicPortalLanguage: (partner as any).basicPortalLanguage || 'en',
      saasPortalLanguage: (partner as any).saasPortalLanguage || 'en',
      saasAgentTier: (partner as any).saasAgentTier || 'ESSENTIALS',

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

    // Debug logs - trace level only
    if (process.env.ENABLE_TRACE_LOGS === 'true') {
      console.log('Returning brandingData with enableCustomerSignup:', brandingData.enableCustomerSignup);
      console.log('🎨 BRANDING API DEBUG - Returning theme preference:', brandingData.themePreference);
      console.log('🎨 BRANDING API DEBUG - Partner raw themePreference:', partner.themePreference);
      console.log('💰 PRICING API DEBUG - Pricing model:', brandingData.pricingModel);
      console.log('💰 PRICING API DEBUG - Pay as you go rate:', brandingData.payAsYouGoRate);
      console.log('💰 PRICING API DEBUG - Free AI credits:', brandingData.freeAiCredits);

      // Debug footer controls and social media
      console.log('🔍 SUBDOMAIN API DEBUG - Footer controls being returned:', {
        showQuickLinks: brandingData.showQuickLinks,
        showResources: brandingData.showResources,
        showNewsletter: brandingData.showNewsletter,
        showLegal: brandingData.showLegal,
        showSocialMedia: brandingData.showSocialMedia,
        showContactInfo: brandingData.showContactInfo,
      });
      console.log('🔍 SUBDOMAIN API DEBUG - Social media links being returned:', {
        twitterUrl: brandingData.twitterUrl,
        linkedinUrl: brandingData.linkedinUrl,
        facebookUrl: brandingData.facebookUrl,
        instagramUrl: brandingData.instagramUrl,
      });
      console.log('🔍 SUBDOMAIN API DEBUG - Raw partner data from DB:', {
        showQuickLinks: (partner as any).showQuickLinks,
        showSocialMedia: (partner as any).showSocialMedia,
        twitterUrl: (partner as any).twitterUrl,
        linkedinUrl: (partner as any).linkedinUrl,
      });
    }

    // Cache the result for future requests
    const domainType = partner.subdomain === subdomain ? 'subdomain' : 'customDomain';
    const isApproved = partner.approvalStatus === 'APPROVED';

    await domainCache.set(subdomain, domainType, {
      partnerId: partner.id,
      branding: brandingData,
      type: domainType,
      cachedAt: Date.now(),
      isApproved
    });

    return NextResponse.json(brandingData);
  } catch (error) {
    // Enhanced error logging with more details
    console.error(`Error fetching partner branding for subdomain ${subdomain}:`, error);

    // Safely extract error properties with type checking
    const errorObj: Record<string, any> = {};
    if (error instanceof Error) {
      errorObj.name = error.name;
      errorObj.message = error.message;
      errorObj.stack = error.stack;
      if ('cause' in error) {
        errorObj.cause = error.cause;
      }
    } else {
      errorObj.rawError = String(error);
    }

    console.error('Error details:', JSON.stringify(errorObj, null, 2));

    // Return a more descriptive error for debugging in production
    return NextResponse.json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ?
        (error instanceof Error ? error.message : String(error)) : undefined
    }, { status: 500 });
  }
}
