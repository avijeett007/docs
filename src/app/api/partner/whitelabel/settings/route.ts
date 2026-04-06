import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WhiteLabelSettings } from '@/types/partner';
import { generateRandomAlphanumeric } from '@/lib/util';
import { DomainCacheInvalidationService } from '@/lib/domain-cache-invalidation';
import { logger } from '@/lib/logger';
import { CredentialManager } from '@/lib/services/phoneNumberProviders/CredentialManager';
import { getPartnerTier, PartnerTier } from '@/lib/portalModes';
import { verifyPartnerToken } from '@/lib/auth';

export const dynamic = 'force-dynamic'; // Required to make the GET request work correctly

export async function GET(request: NextRequest) {
  try {
    // Verify partner token with proper JWT signature verification
    const authResult = await verifyPartnerToken(request);
    if (authResult.error) {
      return authResult.error;
    }
    const partner = authResult.partner;

    // Extract the white-label settings from the partner object
    // Using a separate object to avoid TypeScript errors with the schema
    const partnerWithSettings = partner ? {
      id: partner.id,
      businessName: partner.businessName,
      logo: partner.logo,
      // @ts-ignore - New field that TypeScript doesn't know about yet
      logoSize: partner.logoSize || 'medium',
      subdomain: partner.subdomain,
      customDomain: partner.customDomain,
      customDomainVerified: partner.customDomainVerified,
      customDomainStatus: partner.customDomainStatus,
      customDomainTarget: partner.customDomainTarget,
      customDomainTxtToken: partner.customDomainTxtToken,
      customerPortalEnabled: partner.customerPortalEnabled,
      // @ts-ignore - New field that TypeScript doesn't know about yet
      enableCustomerSignup: partner.enableCustomerSignup || false,
      primaryColor: partner.primaryColor,
      secondaryColor: partner.secondaryColor,
      fontFamily: partner.fontFamily,
      portalTitle: partner.portalTitle,
      portalSlogan: partner.portalSlogan,
      // @ts-ignore - New field that TypeScript doesn't know about yet
      themePreference: partner.themePreference,
      // @ts-ignore - New language fields
      basicPortalLanguage: partner.basicPortalLanguage || 'en',
      saasPortalLanguage: partner.saasPortalLanguage || 'en',
      saasAgentTier: partner.saasAgentTier || 'ESSENTIALS',
      // Tier detection fields - computed server-side for client safety
      planId: partner.planId,
      approvalStatus: partner.approvalStatus,
      // Computed partner tier (uses server-side env vars for accurate Stripe price ID matching)
      partnerTier: getPartnerTier(partner.planId, partner.approvalStatus),
      // @ts-ignore - Voice AI Agent fields
      voiceAiAgentEnabled: partner.voiceAiAgentEnabled || false,
      voiceAiAgentPricingNote: partner.voiceAiAgentPricingNote || '',
      // @ts-ignore - Business Lookup fields
      businessLookupEnabled: partner.businessLookupEnabled || false,
      businessLookupDailyLimit: partner.businessLookupDailyLimit || 1000,
      businessLookupMonthlyBudgetUsd: partner.businessLookupMonthlyBudgetUsd || 100.00,
      voiceAiAgentSpecialOffer: partner.voiceAiAgentSpecialOffer || '',
      voiceAiAgentName: partner.voiceAiAgentName || 'Knotie',
      voiceAiAgentVoiceType: partner.voiceAiAgentVoiceType || 'female',
      // @ts-ignore - New voice agent fields
      voiceAiAgentLanguage: partner.voiceAiAgentLanguage || 'en',
      voiceAiAgentVoiceConfig: partner.voiceAiAgentVoiceConfig || null,
      voiceAiAgentId: (partner as any).voiceAiAgentId || null,
      // Enhanced Landing Page Configuration
      // @ts-ignore
      supportEmail: (partner as any).supportEmail || null,
      // @ts-ignore
      companyAddress: (partner as any).companyAddress || null,
      // @ts-ignore
      companyPhone: (partner as any).companyPhone || null,
      // @ts-ignore
      privacyPolicyUrl: (partner as any).privacyPolicyUrl || null,
      // @ts-ignore
      termsOfServiceUrl: (partner as any).termsOfServiceUrl || null,
      // @ts-ignore
      statusPageUrl: (partner as any).statusPageUrl || null,
      // @ts-ignore
      customLandingPageUrl: (partner as any).customLandingPageUrl || null,
      // Social Media Links
      // @ts-ignore
      twitterUrl: (partner as any).twitterUrl || null,
      // @ts-ignore
      linkedinUrl: (partner as any).linkedinUrl || null,
      // @ts-ignore
      facebookUrl: (partner as any).facebookUrl || null,
      // @ts-ignore
      instagramUrl: (partner as any).instagramUrl || null,
      // Landing Page Content
      // @ts-ignore
      features: (partner as any).features || null,
      // @ts-ignore
      testimonials: (partner as any).testimonials || null,
      // @ts-ignore
      faqs: (partner as any).faqs || null,
      // @ts-ignore
      trustIndicators: (partner as any).trustIndicators || null,
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
      communityUrl: (partner as any).communityUrl || null,
      // @ts-ignore
      moreTestimonialsUrl: (partner as any).moreTestimonialsUrl || null,
      // @ts-ignore - SaaS Portal Configuration fields
      characterName: (partner as any).characterName || null,
      freeTrialEnabled: (partner as any).freeTrialEnabled || false,
      saasOnboardingEnabled: (partner as any).saasOnboardingEnabled || false,
      portalMode: (partner as any).portalMode || 'BASIC',
      // @ts-ignore
      manualSaasModeEnabled: (partner as any).manualSaasModeEnabled || false,
      manualBYOAModeEnabled: (partner as any).manualBYOAModeEnabled || false,
      // @ts-ignore
      freeAiCredits: (partner as any).freeAiCredits || 50,
      // @ts-ignore
      pricingModel: (partner as any).pricingModel || 'subscription',
      // @ts-ignore
      payAsYouGoRate: parseFloat((partner as any).payAsYouGoRate || '0.10'),
      // @ts-ignore
      autoDeployEnabled: (partner as any).autoDeployEnabled || false,
      // @ts-ignore - Partner Telephony Provider Configuration
      useOwnTelephonyProvider: (partner as any).useOwnTelephonyProvider || false,
      // @ts-ignore
      telephonyProvider: (partner as any).telephonyProvider || null,
      // Credentials are decrypted below after partnerWithSettings is created
      telephonyAccountSid: null as string | null,
      telephonyAuthToken: null as string | null,
      telephonyApiKey: null as string | null,
      // @ts-ignore
      telephonyCredentialsVerified: (partner as any).telephonyCredentialsVerified || false,
      // @ts-ignore - Fixed Price Configuration (Display Only)
      fixedPrice: parseFloat((partner as any).fixedPrice || '0'),
      // @ts-ignore
      fixedPriceCurrency: (partner as any).fixedPriceCurrency || 'USD',
      // @ts-ignore
      fixedPricePeriod: (partner as any).fixedPricePeriod || 'month',
      // @ts-ignore
      fixedPriceFeatures: (partner as any).fixedPriceFeatures || null,
      // Stripe Connect fields
      stripeAccountId: partner.stripeAccountId,
      stripeOnboardingCompleted: partner.stripeOnboardingCompleted,
      stripeChargesEnabled: partner.stripeChargesEnabled,
      stripePayoutsEnabled: partner.stripePayoutsEnabled,
      // AI Analytics global kill switch
      enableAiAnalytics: (partner as any).enableAiAnalytics || false,
      // Retell API Key (for BYOA tier) - just indicate if it exists, don't expose the actual key
      retellApiKey: partner.retellApiKey ? '••••••••' : null
    } : null;

    if (!partnerWithSettings) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    // Decrypt telephony credentials if they exist
    const encryptedCredentials = (partner as any).telephonyCredentials;
    if (encryptedCredentials && partnerWithSettings.telephonyProvider) {
      try {
        const decryptedCredentials = await CredentialManager.decryptCredentials(encryptedCredentials);

        if (partnerWithSettings.telephonyProvider === 'twilio') {
          partnerWithSettings.telephonyAccountSid = decryptedCredentials.accountSid || null;
          partnerWithSettings.telephonyAuthToken = decryptedCredentials.authToken || null;
        } else if (partnerWithSettings.telephonyProvider === 'telnyx') {
          partnerWithSettings.telephonyApiKey = decryptedCredentials.apiKey || null;
        }
      } catch (error) {
        logger.error('Failed to decrypt telephony credentials', error as Error, {
          partnerId: partnerWithSettings.id,
          operation: 'decrypt_telephony_credentials'
        });
        // Don't fail the request, just leave credentials as null
      }
    }

    // Debug logging for footer controls and social media links
    logger.debug('Whitelabel settings retrieved successfully', {
      partnerId: partnerWithSettings.id,
      operation: 'get_whitelabel_settings',
      footerControls: {
        showQuickLinks: partnerWithSettings.showQuickLinks,
        showResources: partnerWithSettings.showResources,
        showNewsletter: partnerWithSettings.showNewsletter,
        showLegal: partnerWithSettings.showLegal,
        showSocialMedia: partnerWithSettings.showSocialMedia,
        showContactInfo: partnerWithSettings.showContactInfo,
      },
      socialMediaLinks: {
        twitterUrl: partnerWithSettings.twitterUrl,
        linkedinUrl: partnerWithSettings.linkedinUrl,
        facebookUrl: partnerWithSettings.facebookUrl,
        instagramUrl: partnerWithSettings.instagramUrl,
      }
    });

    return NextResponse.json({
      success: true,
      partner: partnerWithSettings
    });
  } catch (error) {
    logger.error('Failed to fetch whitelabel settings', error as Error, {
      operation: 'get_whitelabel_settings'
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify partner token with proper JWT signature verification
    const authResult = await verifyPartnerToken(request);
    if (authResult.error) {
      return authResult.error;
    }
    const partnerId = authResult.partner!.id;

    // Parse the form data
    const formData = await request.formData();
    const subdomainRaw = formData.get('subdomain') as string;
    // Fix 1: Lowercase subdomain value before saving to ensure case-insensitive lookups work
    const subdomain = subdomainRaw ? subdomainRaw.toLowerCase().trim() : subdomainRaw;
    const customerPortalEnabled = formData.get('customerPortalEnabled') === 'true';
    const enableCustomerSignup = formData.get('enableCustomerSignup') === 'true';
    const primaryColor = formData.get('primaryColor') as string;
    const secondaryColor = formData.get('secondaryColor') as string;
    const fontFamily = formData.get('fontFamily') as string;
    const portalTitle = formData.get('portalTitle') as string;
    const portalSlogan = formData.get('portalSlogan') as string;
    const themePreference = formData.get('themePreference') as string;
    const basicPortalLanguage = formData.get('basicPortalLanguage') as string;
    const saasPortalLanguage = formData.get('saasPortalLanguage') as string;
    const saasAgentTier = formData.get('saasAgentTier') as string;
    const logoFileEntry = formData.get('logo');
    const logoFile = (logoFileEntry && typeof logoFileEntry !== 'string') ? logoFileEntry as File : null;
    const logoSize = formData.get('logoSize') as string;
    const faviconFileEntry = formData.get('favicon');
    const faviconFile = (faviconFileEntry && typeof faviconFileEntry !== 'string') ? faviconFileEntry as File : null;
    const removeLogo = formData.get('removeLogo') === 'true';
    const removeFavicon = formData.get('removeFavicon') === 'true';

    // Voice AI Agent fields
    const voiceAiAgentEnabled = formData.get('voiceAiAgentEnabled') === 'true';
    const voiceAiAgentPricingNote = formData.get('voiceAiAgentPricingNote') as string;
    const voiceAiAgentSpecialOffer = formData.get('voiceAiAgentSpecialOffer') as string;
    const voiceAiAgentName = formData.get('voiceAiAgentName') as string || 'Knotie';
    const voiceAiAgentVoiceType = formData.get('voiceAiAgentVoiceType') as string || 'female';
    const voiceAiAgentLanguage = formData.get('voiceAiAgentLanguage') as string || 'en';

    // Business Lookup Configuration
    const businessLookupEnabled = formData.get('businessLookupEnabled') === 'true';
    const businessLookupDailyLimit = parseInt(formData.get('businessLookupDailyLimit') as string) || 1000;
    const businessLookupMonthlyBudgetUsd = parseFloat(formData.get('businessLookupMonthlyBudgetUsd') as string) || 100.00;
    const voiceAiAgentVoiceConfigStr = formData.get('voiceAiAgentVoiceConfig') as string;
    let voiceAiAgentVoiceConfig = null;
    if (voiceAiAgentVoiceConfigStr && voiceAiAgentVoiceConfigStr.trim()) {
      try {
        voiceAiAgentVoiceConfig = JSON.parse(voiceAiAgentVoiceConfigStr);
      } catch (error) {
        logger.warn('Failed to parse voice config JSON', {
          operation: 'update_whitelabel_settings',
          voiceConfigString: voiceAiAgentVoiceConfigStr,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Custom domain fields
    const customDomainRaw = formData.get('customDomain') as string;
    // Fix 1: Lowercase custom domain value before saving to ensure case-insensitive lookups work
    const customDomain = customDomainRaw ? customDomainRaw.toLowerCase().trim() : customDomainRaw;
    const customDomainVerified = formData.get('customDomainVerified') === 'true';
    const customDomainStatus = formData.get('customDomainStatus') as string;

    // Enhanced Landing Page Configuration
    const supportEmail = formData.get('supportEmail') as string;
    const companyAddress = formData.get('companyAddress') as string;
    const companyPhone = formData.get('companyPhone') as string;
    const privacyPolicyUrl = formData.get('privacyPolicyUrl') as string;
    const termsOfServiceUrl = formData.get('termsOfServiceUrl') as string;
    const statusPageUrl = formData.get('statusPageUrl') as string;
    const customLandingPageUrlRaw = formData.get('customLandingPageUrl') as string | null;

    // Social Media Links
    const twitterUrl = formData.get('twitterUrl') as string;
    const linkedinUrl = formData.get('linkedinUrl') as string;
    const facebookUrl = formData.get('facebookUrl') as string;
    const instagramUrl = formData.get('instagramUrl') as string;

    // Landing Page Content
    const features = formData.get('features') as string;
    const testimonials = formData.get('testimonials') as string;
    const faqs = formData.get('faqs') as string;
    const trustIndicators = formData.get('trustIndicators') as string;

    // Footer Section Controls
    const showQuickLinks = formData.get('showQuickLinks') === 'true';
    const showResources = formData.get('showResources') === 'true';
    const showNewsletter = formData.get('showNewsletter') === 'true';
    const showLegal = formData.get('showLegal') === 'true';
    const showSocialMedia = formData.get('showSocialMedia') === 'true';
    const showContactInfo = formData.get('showContactInfo') === 'true';
    const showCommunity = formData.get('showCommunity') === 'true';
    const communityUrl = formData.get('communityUrl') as string;
    const moreTestimonialsUrl = formData.get('moreTestimonialsUrl') as string;

    // SaaS Portal Configuration
    const characterName = formData.get('characterName') as string;
    const freeTrialEnabled = formData.get('freeTrialEnabled') === 'true';
    const saasOnboardingEnabled = formData.get('saasOnboardingEnabled') === 'true';
    const portalMode = formData.get('portalMode') as string;
    const autoDeployEnabled = formData.get('autoDeployEnabled') === 'true';

    // Telephony Provider Configuration
    const useOwnTelephonyProvider = formData.get('useOwnTelephonyProvider') === 'true';
    const telephonyProvider = formData.get('telephonyProvider') as string;
    // Twilio credentials
    const telephonyAccountSid = formData.get('telephonyAccountSid') as string;
    const telephonyAuthToken = formData.get('telephonyAuthToken') as string;
    // Telnyx credentials
    const telephonyApiKey = formData.get('telephonyApiKey') as string;

    // Validate landing page content JSON fields
    const jsonFields = [
      { name: 'features', value: features },
      { name: 'testimonials', value: testimonials },
      { name: 'faqs', value: faqs },
      { name: 'trustIndicators', value: trustIndicators }
    ];

    for (const field of jsonFields) {
      if (field.value && field.value.trim()) {
        try {
          JSON.parse(field.value);
        } catch (error) {
          return NextResponse.json(
            { error: `Invalid ${field.name} JSON format` },
            { status: 400 }
          );
        }
      }
    }

    // Check if subdomain is already taken by another partner
    // Fix 2: Use case-insensitive lookup for existing data compatibility
    if (subdomain) {
      const existingPartner = await prisma.partner.findFirst({
        where: {
          // @ts-ignore - subdomain field might not be recognized by TypeScript yet
          subdomain: { equals: subdomain, mode: 'insensitive' },
          id: { not: partnerId }
        }
      });

      if (existingPartner) {
        return NextResponse.json({ error: 'Subdomain is already taken' }, { status: 400 });
      }
    }

    // Encrypt telephony credentials if provided
    let encryptedTelephonyCredentials: string | null = null;
    if (useOwnTelephonyProvider && telephonyProvider) {
      let credentials: Record<string, string> = {};

      if (telephonyProvider === 'twilio' && telephonyAccountSid && telephonyAuthToken) {
        credentials = {
          accountSid: telephonyAccountSid,
          authToken: telephonyAuthToken
        };
      } else if (telephonyProvider === 'telnyx' && telephonyApiKey) {
        credentials = {
          apiKey: telephonyApiKey
        };
      }

      // Only encrypt if we have valid credentials
      if (Object.keys(credentials).length > 0) {
        try {
          encryptedTelephonyCredentials = await CredentialManager.encryptCredentials(credentials);
          logger.debug('Telephony credentials encrypted successfully', {
            partnerId,
            provider: telephonyProvider,
            operation: 'encrypt_telephony_credentials'
          });
        } catch (error) {
          logger.error('Failed to encrypt telephony credentials', error as Error, {
            partnerId,
            provider: telephonyProvider,
            operation: 'encrypt_telephony_credentials'
          });
          return NextResponse.json(
            { error: 'Failed to encrypt telephony credentials' },
            { status: 500 }
          );
        }
      }
    }

    // Create update data object with proper typings
    const updateData: any = {
      // These fields are new additions to the Partner model
      subdomain,
      customerPortalEnabled,
      enableCustomerSignup,
      logoSize,
      primaryColor,
      secondaryColor,
      fontFamily,
      portalTitle,
      portalSlogan,
      themePreference,
      basicPortalLanguage: basicPortalLanguage || 'en',
      saasPortalLanguage: saasPortalLanguage || 'en',
      saasAgentTier: saasAgentTier || 'ESSENTIALS',
      voiceAiAgentEnabled,
      voiceAiAgentPricingNote,
      voiceAiAgentSpecialOffer,
      voiceAiAgentName,
      voiceAiAgentVoiceType,
      voiceAiAgentLanguage,
      voiceAiAgentVoiceConfig,
      // Business Lookup Configuration
      businessLookupEnabled,
      businessLookupDailyLimit,
      businessLookupMonthlyBudgetUsd,
      // Enhanced Landing Page Configuration
      supportEmail,
      companyAddress,
      companyPhone,
      privacyPolicyUrl,
      termsOfServiceUrl,
      statusPageUrl,
      customLandingPageUrl: await (async () => {
        // Only Starter, Lifetime, and Enterprise partners may set a custom landing page URL
        if (!customLandingPageUrlRaw && customLandingPageUrlRaw !== '') return undefined;
        const partnerForTier = await prisma.partner.findUnique({
          where: { id: partnerId },
          select: { planId: true, approvalStatus: true }
        });
        const tier = getPartnerTier(
          partnerForTier?.planId ?? null,
          partnerForTier?.approvalStatus ?? null
        );
        const isEligible =
          tier === PartnerTier.STARTER ||
          tier === PartnerTier.LIFETIME ||
          tier === PartnerTier.ENTERPRISE;
        if (!isEligible) {
          return undefined; // silently ignore for ineligible tiers
        }
        return customLandingPageUrlRaw || null;
      })(),
      // Social Media Links
      twitterUrl,
      linkedinUrl,
      facebookUrl,
      instagramUrl,
      // Landing Page Content
      features: features || null,
      testimonials: testimonials || null,
      faqs: faqs || null,
      trustIndicators: trustIndicators || null,
      // Footer Section Controls
      showQuickLinks,
      showResources,
      showNewsletter,
      showLegal,
      showSocialMedia,
      showContactInfo,
      showCommunity,
      communityUrl: communityUrl || null,
      moreTestimonialsUrl: moreTestimonialsUrl || null,
      // SaaS Portal Configuration
      characterName: characterName || null,
      freeTrialEnabled,
      saasOnboardingEnabled,
      freeAiCredits: parseInt(formData.get('freeAiCredits') as string) || 50,
      pricingModel: formData.get('pricingModel') as string,
      payAsYouGoRate: parseFloat(formData.get('payAsYouGoRate') as string) || 0.10,
      portalMode: portalMode || 'BASIC',
      autoDeployEnabled,
      // Telephony Provider Configuration (credentials are encrypted)
      useOwnTelephonyProvider,
      telephonyProvider: telephonyProvider || null,
      telephonyCredentials: encryptedTelephonyCredentials,
      // Fixed Price Configuration (Display Only)
      fixedPrice: parseFloat(formData.get('fixedPrice') as string) || 0,
      fixedPriceCurrency: formData.get('fixedPriceCurrency') as string || 'USD',
      fixedPricePeriod: formData.get('fixedPricePeriod') as string || 'month',
      fixedPriceFeatures: formData.get('fixedPriceFeatures') as string || null
    };

    // Add custom domain fields if provided
    if (customDomain) {
      updateData.customDomain = customDomain;
    }

    // Only update verification status if explicitly provided
    if (formData.has('customDomainVerified')) {
      updateData.customDomainVerified = customDomainVerified;
    }

    if (formData.has('customDomainStatus')) {
      updateData.customDomainStatus = customDomainStatus;
    }

    // Handle logo upload if provided
    if (logoFile) {
      // Convert logo to base64
      const arrayBuffer = await logoFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64Logo = `data:${logoFile.type};base64,${buffer.toString('base64')}`;

      // Set the logo as base64 string
      updateData.logo = base64Logo;
      logger.info('Logo uploaded and converted to base64', {
        operation: 'update_whitelabel_settings',
        logoFileType: logoFile.type,
        logoFileSize: logoFile.size
      });
    } else if (removeLogo) {
      // If removeLogo is true, set logo to null
      updateData.logo = null;
      logger.info('Logo removed', {
        operation: 'update_whitelabel_settings'
      });
    }

    // Handle favicon upload if provided
    if (faviconFile) {
      // Validate favicon file type
      const validFaviconTypes = ['image/x-icon', 'image/vnd.microsoft.icon', 'image/png', 'image/jpeg', 'image/gif', 'image/svg+xml'];
      if (!validFaviconTypes.includes(faviconFile.type)) {
        return NextResponse.json(
          { error: 'Invalid favicon file type. Please use ICO, PNG, JPG, GIF, or SVG format.' },
          { status: 400 }
        );
      }

      // Validate favicon file size (max 1MB)
      if (faviconFile.size > 1024 * 1024) {
        return NextResponse.json(
          { error: 'Favicon file size must be less than 1MB' },
          { status: 400 }
        );
      }

      // Convert favicon to base64
      const arrayBuffer = await faviconFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64Favicon = `data:${faviconFile.type};base64,${buffer.toString('base64')}`;

      // Set the favicon as base64 string
      updateData.favicon = base64Favicon;
      logger.info('Favicon uploaded and converted to base64', {
        operation: 'update_whitelabel_settings',
        faviconFileType: faviconFile.type,
        faviconFileSize: faviconFile.size
      });
    } else if (removeFavicon) {
      // If removeFavicon is true, set favicon to null
      updateData.favicon = null;
      logger.info('Favicon removed', {
        operation: 'update_whitelabel_settings'
      });
    }

    // Handle KnovaAgent creation/update if voice AI agent is enabled
    let agentId = null;
    if (voiceAiAgentEnabled) {
      try {
        // Check if partner already has a voice AI agent
        const existingAgent = await prisma.knovaAgent.findFirst({
          where: {
            partnerId: partnerId,
            agentType: 'website',
            communicationChannel: 'web'
          }
        });

        if (existingAgent) {
          // Update existing agent
          const updatedAgent = await prisma.knovaAgent.update({
            where: { id: existingAgent.id },
            data: {
              name: voiceAiAgentName,
              systemPrompt: `You are ${voiceAiAgentName}, a helpful AI assistant for whitelabel voice interactions. You provide excellent customer service and support.`,
              greetingMessage: `Hello! I'm ${voiceAiAgentName}, your AI assistant. How can I help you today?`,
              voiceConfig: voiceAiAgentVoiceConfig,
              isActive: true,
              status: 'active',
              updatedAt: new Date()
            }
          });
          agentId = updatedAgent.id;
        } else {
          // Create new agent
          const newAgent = await prisma.knovaAgent.create({
            data: {
              id: `whitelabel-${partnerId}-${generateRandomAlphanumeric(8)}`,
              partnerId: partnerId,
              name: voiceAiAgentName,
              agentType: 'website',
              communicationChannel: 'web',
              systemPrompt: `You are ${voiceAiAgentName}, a helpful AI assistant for whitelabel voice interactions. You provide excellent customer service and support.`,
              greetingMessage: `Hello! I'm ${voiceAiAgentName}, your AI assistant. How can I help you today?`,
              voiceConfig: voiceAiAgentVoiceConfig,
              isActive: true,
              status: 'active',
              createdAt: new Date(),
              updatedAt: new Date()
            }
          });
          agentId = newAgent.id;
        }

        // Update partner with agent ID
        updateData.voiceAiAgentId = agentId;
      } catch (error) {
        logger.error('Failed to create/update KnovaAgent', error as Error, {
          operation: 'update_whitelabel_settings',
          voiceAiAgentEnabled,
          agentId: updateData.voiceAiAgentId
        });
        // Continue with partner update even if agent creation fails
      }
    }

    // Get current partner data to track changes for cache invalidation
    const currentPartner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        subdomain: true,
        customDomain: true,
        approvalStatus: true
      }
    });

    // Update partner settings
    const updatedPartner = await prisma.partner.update({
      where: { id: partnerId },
      data: updateData
    });

    // Create a sanitized response without type errors
    // Since TypeScript doesn't recognize the new fields yet, we need to cast
    const typedPartner = updatedPartner as any;

    const partnerSettings: WhiteLabelSettings = {
      subdomain: typedPartner.subdomain,
      customDomain: typedPartner.customDomain,
      customDomainVerified: typedPartner.customDomainVerified,
      customDomainStatus: typedPartner.customDomainStatus,
      customDomainTarget: typedPartner.customDomainTarget,
      customDomainTxtToken: typedPartner.customDomainTxtToken,
      customerPortalEnabled: typedPartner.customerPortalEnabled || false,
      enableCustomerSignup: typedPartner.enableCustomerSignup || false,
      logoSize: typedPartner.logoSize,
      primaryColor: typedPartner.primaryColor,
      secondaryColor: typedPartner.secondaryColor,
      fontFamily: typedPartner.fontFamily,
      portalTitle: typedPartner.portalTitle,
      portalSlogan: typedPartner.portalSlogan,
      themePreference: typedPartner.themePreference,
      basicPortalLanguage: typedPartner.basicPortalLanguage || 'en',
      saasPortalLanguage: typedPartner.saasPortalLanguage || 'en',
      saasAgentTier: typedPartner.saasAgentTier || 'ESSENTIALS',
      // Computed partner tier (uses server-side env vars for accurate Stripe price ID matching)
      partnerTier: getPartnerTier(typedPartner.planId, typedPartner.approvalStatus),
      // Landing Page Content
      features: typedPartner.features,
      testimonials: typedPartner.testimonials,
      faqs: typedPartner.faqs,
      trustIndicators: typedPartner.trustIndicators,
      // Footer Section Controls
      showQuickLinks: typedPartner.showQuickLinks,
      showResources: typedPartner.showResources,
      showNewsletter: typedPartner.showNewsletter,
      showLegal: typedPartner.showLegal,
      showSocialMedia: typedPartner.showSocialMedia,
      showContactInfo: typedPartner.showContactInfo,
      showCommunity: typedPartner.showCommunity,
      communityUrl: typedPartner.communityUrl,
      moreTestimonialsUrl: typedPartner.moreTestimonialsUrl,
      // SaaS Portal Configuration
      characterName: typedPartner.characterName,
      freeTrialEnabled: typedPartner.freeTrialEnabled,
      saasOnboardingEnabled: typedPartner.saasOnboardingEnabled,
      portalMode: typedPartner.portalMode,
      autoDeployEnabled: typedPartner.autoDeployEnabled,
      manualBYOAModeEnabled: typedPartner.manualBYOAModeEnabled || false,
      // Retell API Key (for BYOA tier) - just indicate if it exists
      retellApiKey: typedPartner.retellApiKey ? '••••••••' : null,
      // Custom Landing Page (Starter/Enterprise only)
      customLandingPageUrl: typedPartner.customLandingPageUrl || null
    };

    // Invalidate domain cache for changed settings
    try {
      const changes = {
        subdomain: currentPartner?.subdomain !== updatedPartner.subdomain
          ? { old: currentPartner?.subdomain || undefined, new: updatedPartner.subdomain || undefined }
          : undefined,
        customDomain: currentPartner?.customDomain !== updatedPartner.customDomain
          ? { old: currentPartner?.customDomain || undefined, new: updatedPartner.customDomain || undefined }
          : undefined,
        branding: true, // Always invalidate branding cache on settings update
        approval: currentPartner?.approvalStatus !== updatedPartner.approvalStatus
      };

      await DomainCacheInvalidationService.invalidatePartnerCache(partnerId, changes);
      logger.info('Domain cache invalidated successfully', {
        partnerId,
        operation: 'update_whitelabel_settings',
        cacheChanges: changes
      });
    } catch (cacheError) {
      logger.warn('Failed to invalidate domain cache', {
        partnerId,
        operation: 'update_whitelabel_settings',
        error: cacheError instanceof Error ? cacheError.message : 'Unknown error'
      });
      // Don't fail the request if cache invalidation fails
    }

    logger.info('Whitelabel settings updated successfully', {
      partnerId: updatedPartner.id,
      operation: 'update_whitelabel_settings',
      autoDeployEnabled: updatedPartner.autoDeployEnabled,
      voiceAiAgentEnabled: updatedPartner.voiceAiAgentEnabled,
      hasLogo: !!typedPartner.logo,
      hasFavicon: !!typedPartner.favicon
    });

    return NextResponse.json({
      success: true,
      partner: {
        id: updatedPartner.id,
        logo: typedPartner.logo,
        businessName: typedPartner.businessName,
        ...partnerSettings
      }
    });
  } catch (error) {
    logger.error('Failed to update whitelabel settings', error as Error, {
      operation: 'update_whitelabel_settings'
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
