// Type definitions for Partner and related models

// Plan Features - defines features that can be configured at subscription plan level
// and automatically applied to customers when they subscribe
export interface PlanFeatures {
  // Analytics Features
  enableAdvancedAnalytics?: boolean;
  enableDetailedCallAnalysis?: boolean;
  enableActionPointAnalysis?: boolean;
  
  // Menu Visibility Features
  showIntegration?: boolean;
  showDocsAndMedia?: boolean;
  showPhoneNumbers?: boolean;
  
  // Integration Apps (tier-wise selection)
  allowedApps?: string[];
  
  // AI Credits Features
  aiCreditsEnabled?: boolean;
  lowCreditNotificationsEnabled?: boolean;
  lowCreditThreshold?: number;
  initialAiCredits?: number;
}

export interface Partner {
  id: string;
  businessName: string;
  contactName: string;
  businessAddress: string;
  emailAddress: string;
  phoneNumber: string;
  areaOfBusiness: string;
  expertise: string;
  learningSource?: string;
  partnershipType: string;
  approvalStatus: string;
  partnerCode: string;

  // White-label fields
  subdomain?: string;
  customDomain?: string;
  customDomainVerified: boolean;
  customDomainStatus?: string; // "pending", "verified", "failed"
  customDomainVerificationToken?: string;
  customDomainTxtToken?: string; // TXT record verification token
  customDomainVerificationStartedAt?: Date;
  customDomainTarget?: string;
  customDomainCloudflareId?: string; // Cloudflare custom hostname ID
  customDomainHttpValidationUrl?: string; // HTTP validation URL from Cloudflare
  customDomainHttpValidationBody?: string; // HTTP validation response body
  customerPortalEnabled: boolean;
  enableCustomerSignup?: boolean; // Allow customers to sign up through the portal

  // SMTP settings for white-label emails
  smtpHost?: string;
  smtpPort?: number;
  smtpUsername?: string;
  smtpPassword?: string;
  smtpFromEmail?: string;
  smtpFromName?: string;
  useCustomSmtp: boolean;

  // Branding fields
  logo?: string;
  logoSize?: string;
  favicon?: string;
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  portalTitle?: string;
  portalSlogan?: string;
  themePreference?: string;
  basicPortalLanguage?: string;
  saasPortalLanguage?: string;
  saasAgentTier?: string; // ESSENTIALS, MODERATE, PREMIUM

  // Advanced AI Analytics (global kill switch for this partner)
  enableAiAnalytics?: boolean;

  // Voice AI Agent Configuration
  voiceAiAgentEnabled?: boolean;
  voiceAiAgentPricingNote?: string;
  voiceAiAgentSpecialOffer?: string;
  voiceAiAgentName?: string;
  voiceAiAgentVoiceType?: string;

  // Enhanced Landing Page Configuration
  supportEmail?: string;
  companyAddress?: string;
  companyPhone?: string;
  privacyPolicyUrl?: string;
  termsOfServiceUrl?: string;
  statusPageUrl?: string;
  customLandingPageUrl?: string; // Starter/Enterprise: override root URL in customer emails

  // Social Media Links
  twitterUrl?: string;
  linkedinUrl?: string;
  facebookUrl?: string;
  instagramUrl?: string;

  // Landing Page Content
  testimonials?: string; // JSON string of testimonials array
  faqs?: string; // JSON string of FAQs array
  features?: string; // JSON string of enhanced features array
  trustIndicators?: string; // JSON string of trust indicators array

  // API keys
  ghlCalendarId?: string;
  ghlApiKey?: string;
  vapiApiKey?: string;
  retellApiKey?: string;

  // Billing
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  planId?: string;
  billingInterval?: string;
  subscriptionStatus: string;
  hasStartedTrial: boolean;
  hasSeenOffer: boolean;

  // Manual SaaS mode enablement for special offers
  manualSaasModeEnabled?: boolean;
  // Manual BYOA mode enablement for special offers (non-enterprise partners)
  manualBYOAModeEnabled?: boolean;

  // Stripe Connect
  stripeAccountId?: string;
  stripeAccountType?: string;
  stripeCapabilities?: any;
  stripeChargesEnabled?: boolean;
  stripeDetailsSubmitted?: boolean;
  stripeOnboardingCompleted?: boolean;
  stripePayoutsEnabled?: boolean;
  stripeRequirements?: any;

  // Multi-factor authentication
  mfaEnabled: boolean;
  mfaSecret?: string;
  mfaBackupCodes: string[];
  mfaLastUsedAt?: Date;
  mfaWarningDismissedAt?: Date;

  // Timestamps
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PartnerBranding {
  id: string;
  businessName: string;
  logo?: string;
  logoSize?: string;
  favicon?: string;
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  portalTitle?: string;
  portalSlogan?: string;
  email?: string;
  customerPortalEnabled?: boolean;
  enableCustomerSignup?: boolean;
  themePreference?: string;
  portalMode?: string; // Portal mode: BASIC, PROFESSIONAL, SAAS

  // SaaS Portal Configuration
  characterName?: string; // Optional character name for SaaS branding
  freeTrialEnabled?: boolean; // Enable free trial button on landing page
  saasOnboardingEnabled?: boolean; // Enable SaaS onboarding flow
  autoDeployEnabled?: boolean; // Enable auto-deployment for AI Receptionist SaaS
  freeAiCredits?: number; // Free AI credits for new customers
  pricingModel?: string; // 'subscription', 'payasyougo', or 'fixedprice'
  payAsYouGoRate?: number; // Rate per minute for pay-as-you-go model
  manualSaasModeEnabled?: boolean; // Manually enabled SaaS mode for special offers
  manualBYOAModeEnabled?: boolean; // Manually enabled BYOA mode for special offers

  // Fixed Price Configuration (Display Only)
  fixedPrice?: number;
  fixedPriceCurrency?: string;
  fixedPricePeriod?: string;
  fixedPriceFeatures?: string;

  voiceAiAgentEnabled?: boolean;
  voiceAiAgentPricingNote?: string;
  voiceAiAgentSpecialOffer?: string;
  voiceAiAgentName?: string;
  voiceAiAgentVoiceType?: string;

  // Enhanced Landing Page Configuration
  supportEmail?: string;
  companyAddress?: string;
  companyPhone?: string;
  privacyPolicyUrl?: string;
  termsOfServiceUrl?: string;
  statusPageUrl?: string;
  customLandingPageUrl?: string; // Starter/Enterprise: override root URL in customer emails

  // Social Media Links
  twitterUrl?: string;
  linkedinUrl?: string;
  facebookUrl?: string;
  instagramUrl?: string;

  // Landing Page Content
  testimonials?: string; // JSON string of testimonials array
  faqs?: string; // JSON string of FAQs array
  features?: string; // JSON string of enhanced features array
  trustIndicators?: string; // JSON string of trust indicators array

  // Footer Section Controls
  showQuickLinks?: boolean;
  showResources?: boolean;
  showNewsletter?: boolean;
  showLegal?: boolean;
  showSocialMedia?: boolean;
  showContactInfo?: boolean;
  showCommunity?: boolean;
  communityUrl?: string;
  moreTestimonialsUrl?: string;
  hasSubscriptionPlans?: boolean;

  // Multi-language support
  basicPortalLanguage?: string;
  saasPortalLanguage?: string;
  saasAgentTier?: string; // ESSENTIALS, MODERATE, PREMIUM

  // AI Translation System
  translatedTexts?: Record<string, any>; // JSON object storing translations for all languages
  translationEnabled?: boolean;
}

export interface WhiteLabelSettings {
  subdomain?: string;
  customDomain?: string;
  customDomainVerified?: boolean;
  customDomainStatus?: string;
  customDomainTarget?: string;
  customDomainTxtToken?: string; // TXT token field
  customDomainCloudflareId?: string; // Cloudflare custom hostname ID
  customDomainHttpValidationUrl?: string; // HTTP validation URL from Cloudflare
  customDomainHttpValidationBody?: string; // HTTP validation response body
  customerPortalEnabled: boolean;
  enableCustomerSignup?: boolean; // Allow customers to sign up through the portal
  logoSize?: string; // Logo size setting
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  portalTitle?: string;
  portalSlogan?: string;
  themePreference?: string;
  basicPortalLanguage?: string;
  saasPortalLanguage?: string;
  saasAgentTier?: string; // ESSENTIALS, MODERATE, PREMIUM, BYOA
  portalMode?: string;

  // Computed partner tier from server (uses server-side env vars for Stripe price ID matching)
  partnerTier?: string; // FREE_FOREVER, STARTER, PRO, ENTERPRISE, LIFETIME

  // BYOA (Bring Your Own Agent) - Enterprise only
  retellApiKey?: string | null; // Masked indicator if Retell API key is configured

  // SaaS Portal Configuration
  characterName?: string;
  freeTrialEnabled?: boolean;
  saasOnboardingEnabled?: boolean;
  freeAiCredits?: number;
  pricingModel?: string;
  payAsYouGoRate?: number;
  manualSaasModeEnabled?: boolean;
  manualBYOAModeEnabled?: boolean;
  autoDeployEnabled?: boolean;

  // Partner Telephony Provider Configuration
  useOwnTelephonyProvider?: boolean;
  telephonyProvider?: string;
  // For form display only - not stored directly, credentials are encrypted into telephonyCredentials
  telephonyAccountSid?: string;  // Twilio: Account SID
  telephonyAuthToken?: string;   // Twilio: Auth Token
  telephonyApiKey?: string;      // Telnyx: API Key
  telephonyCredentialsVerified?: boolean;

  // Fixed Price Configuration (Display Only)
  fixedPrice?: number;
  fixedPriceCurrency?: string;
  fixedPricePeriod?: string;
  fixedPriceFeatures?: string;

  // Voice AI Agent Configuration
  voiceAiAgentEnabled?: boolean;
  voiceAiAgentPricingNote?: string;
  voiceAiAgentSpecialOffer?: string;
  voiceAiAgentName?: string;
  voiceAiAgentVoiceType?: string;
  voiceAiAgentLanguage?: string;
  voiceAiAgentVoiceConfig?: any;
  voiceAiAgentId?: string;

  // Enhanced Landing Page Configuration
  supportEmail?: string;
  companyAddress?: string;
  companyPhone?: string;
  privacyPolicyUrl?: string;
  termsOfServiceUrl?: string;
  statusPageUrl?: string;
  customLandingPageUrl?: string; // Starter/Enterprise: override root URL in customer emails

  // Social Media Links
  twitterUrl?: string;
  linkedinUrl?: string;
  facebookUrl?: string;
  instagramUrl?: string;

  // Landing Page Content
  testimonials?: string; // JSON string of testimonials array
  faqs?: string; // JSON string of FAQs array
  features?: string; // JSON string of enhanced features array
  trustIndicators?: string; // JSON string of trust indicators array

  // Footer Section Controls
  showQuickLinks?: boolean;
  showResources?: boolean;
  showNewsletter?: boolean;
  showLegal?: boolean;
  showSocialMedia?: boolean;
  showContactInfo?: boolean;
  showCommunity?: boolean;
  communityUrl?: string;
  moreTestimonialsUrl?: string;

  // Business Lookup Configuration
  businessLookupEnabled?: boolean;
  businessLookupDailyLimit?: number;
  businessLookupMonthlyBudgetUsd?: number;

  // AI Translation System
  translatedTexts?: Record<string, any>; // JSON object storing translations for all languages
  translationEnabled?: boolean;
}

// Phone Service Activation types
export interface PhoneActivationDocument {
  type: string; // 'business_registration', 'address_proof', 'identity_proof', 'authorization_letter'
  name: string;
  url: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
}

export interface PhoneActivationAddress {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface PhoneServiceActivation {
  id: string;
  partnerId: string;
  customerId?: string | null;
  initiatedBy: 'partner' | 'customer';
  country: string;
  businessName: string;
  businessType?: string | null;
  businessAddress: PhoneActivationAddress;
  businessRegistrationNumber?: string | null;
  businessRegistrationAuthority?: string | null;
  businessWebsite?: string | null;
  contactFirstName?: string | null;
  contactLastName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  documents: PhoneActivationDocument[];
  twilioSubaccountSid?: string | null;
  twilioAddressSid?: string | null;
  regulatoryBundleSid?: string | null;
  regulatoryBundleStatus: string;
  regulatoryBundleType?: string | null;
  rejectionReason?: string | null;
  status: 'draft' | 'submitted' | 'processing' | 'pending_review' | 'active' | 'rejected' | 'resubmission_needed';
  submittedAt?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}
