import { NextResponse, type NextRequest } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { headers } from 'next/headers';

/**
 * API route to fetch partner branding information for white-label portal
 * This is used by the white-label portal to load the correct branding
 */
export async function GET(_request: NextRequest) {
  try {
    // Get partner ID from headers (set by middleware)
    const headersList = headers();
    const partnerId = headersList.get('x-partner-id');
    const partnerDetails = headersList.get('x-partner-details');

    // For our implementation without schema changes, we'll use a combination
    // of direct header data and database queries

    // If partner details are already in headers (from middleware)
    if (partnerDetails) {
      try {
        const details = JSON.parse(partnerDetails);
        return NextResponse.json(details);
      } catch (e) {
        console.error('Failed to parse partner details from header:', e);
      }
    }

    // If we have a partner ID, fetch from database
    if (partnerId) {
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: {
          id: true,
          businessName: true,
          logo: true,
          logoSize: true,
          favicon: true,
          primaryColor: true,
          secondaryColor: true,
          fontFamily: true,
          portalTitle: true,
          portalSlogan: true,
          customDomain: true,
          customerPortalEnabled: true,
          enableCustomerSignup: true,
          themePreference: true,
          voiceAiAgentEnabled: true,
          voiceAiAgentPricingNote: true,
          voiceAiAgentSpecialOffer: true,
          voiceAiAgentName: true,
          voiceAiAgentVoiceType: true,
          voiceAiAgentLanguage: true,
          voiceAiAgentVoiceConfig: true,
          // Enhanced Landing Page Configuration
          supportEmail: true,
          companyAddress: true,
          companyPhone: true,
          privacyPolicyUrl: true,
          termsOfServiceUrl: true,
          statusPageUrl: true,
          // Social Media Links
          twitterUrl: true,
          linkedinUrl: true,
          facebookUrl: true,
          instagramUrl: true,
          // Landing Page Content
          features: true,
          testimonials: true,
          faqs: true,
          trustIndicators: true,
          // SaaS Portal Configuration
          portalMode: true,
          characterName: true,
          freeTrialEnabled: true,
          saasOnboardingEnabled: true,
          freeAiCredits: true,
          pricingModel: true,
          payAsYouGoRate: true,
          // Fixed Price Configuration (Display Only)
          fixedPrice: true,
          fixedPriceCurrency: true,
          fixedPricePeriod: true,
          fixedPriceFeatures: true,
          // AI Translation System
          translatedTexts: true,
          translationEnabled: true
        }
      });

      if (partner) {
        // Ensure all required fields have default values
        const completePartnerData = {
          id: partner.id,
          businessName: partner.businessName,
          logo: partner.logo,
          // @ts-ignore - New field that TypeScript doesn't know about yet
          logoSize: partner.logoSize || 'medium',
          // @ts-ignore - New field that TypeScript doesn't know about yet
          favicon: partner.favicon,
          primaryColor: partner.primaryColor || '#3B82F6',
          secondaryColor: partner.secondaryColor || '#10B981',
          fontFamily: partner.fontFamily || 'Inter',
          portalTitle: partner.portalTitle || `${partner.businessName} AI Portal`,
          portalSlogan: partner.portalSlogan || 'Powered by advanced voice AI technology',
          customerPortalEnabled: partner.customerPortalEnabled !== false,
          enableCustomerSignup: partner.enableCustomerSignup === true,
          themePreference: partner.themePreference || 'MODERN',
          // @ts-ignore - Voice AI Agent fields
          voiceAiAgentEnabled: partner.voiceAiAgentEnabled === true,
          voiceAiAgentPricingNote: partner.voiceAiAgentPricingNote || '',
          voiceAiAgentSpecialOffer: partner.voiceAiAgentSpecialOffer || '',
          voiceAiAgentName: partner.voiceAiAgentName || 'Knotie',
          voiceAiAgentVoiceType: partner.voiceAiAgentVoiceType || 'female',
          // @ts-ignore - New voice configuration fields
          voiceAiAgentLanguage: partner.voiceAiAgentLanguage || 'en',
          voiceAiAgentVoiceConfig: partner.voiceAiAgentVoiceConfig || null,
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
          // SaaS Portal Configuration
          // @ts-ignore - SaaS fields
          portalMode: (partner as any).portalMode || (partner as any).portal_mode || 'BASIC',
          characterName: (partner as any).characterName || (partner as any).character_name || undefined,
          freeTrialEnabled: (partner as any).freeTrialEnabled === true || (partner as any).free_trial_enabled === true,
          saasOnboardingEnabled: (partner as any).saasOnboardingEnabled === true || (partner as any).saas_onboarding_enabled === true,
          freeAiCredits: (partner as any).freeAiCredits || (partner as any).free_ai_credits || 50,
          pricingModel: (partner as any).pricingModel || (partner as any).pricing_model || 'subscription',
          payAsYouGoRate: parseFloat((partner as any).payAsYouGoRate || (partner as any).pay_as_you_go_rate || '0.10'),
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
          translationEnabled: (partner as any).translationEnabled || false
        };

        return NextResponse.json(completePartnerData);
      }
    }

    // If we don't have a partner ID or couldn't find the partner,
    // return default branding values with all required fields
    return NextResponse.json({
      id: 'default',
      businessName: 'Knotie AI',
      logo: null,
      logoSize: 'medium',
      favicon: null,
      primaryColor: '#3B82F6',
      secondaryColor: '#10B981',
      fontFamily: 'Inter',
      portalTitle: 'Knotie AI Pro',
      portalSlogan: 'Experience the future of AI-powered voice conversations',
      customerPortalEnabled: true,
      enableCustomerSignup: false,
      themePreference: 'MODERN',
      voiceAiAgentEnabled: false,
      voiceAiAgentPricingNote: '',
      voiceAiAgentSpecialOffer: '',
      voiceAiAgentName: 'Knotie',
      voiceAiAgentVoiceType: 'female',
      voiceAiAgentLanguage: 'en',
      voiceAiAgentVoiceConfig: null,
      // Landing Page Content
      features: undefined,
      testimonials: undefined,
      faqs: undefined,
      trustIndicators: undefined,
      // Footer Section Controls
      showQuickLinks: true,
      showResources: true,
      showNewsletter: true,
      showLegal: true,
      showSocialMedia: true,
      showContactInfo: true,
      showCommunity: false,
      communityUrl: undefined,
      moreTestimonialsUrl: undefined,
      // SaaS Portal Configuration
      portalMode: 'BASIC',
      characterName: undefined,
      freeTrialEnabled: false,
      saasOnboardingEnabled: false,

      // AI Translation System
      translatedTexts: undefined,
      translationEnabled: false
    });
  } catch (error) {
    console.error('Error fetching partner branding:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
