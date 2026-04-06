/**
 * One-Click Experiences Type Definitions
 */

// Experience type identifiers
export enum ExperienceType {
  AI_RECEPTIONIST = 'AI_RECEPTIONIST',
  AI_PERSONAL_ASSISTANT = 'AI_PERSONAL_ASSISTANT',
  AI_OUTBOUND_SDR = 'AI_OUTBOUND_SDR',
  AI_CUSTOMER_SUPPORT = 'AI_CUSTOMER_SUPPORT',
  AI_APPOINTMENT_SETTER = 'AI_APPOINTMENT_SETTER',
  AI_LEAD_QUALIFIER = 'AI_LEAD_QUALIFIER',
  AI_SURVEY_AGENT = 'AI_SURVEY_AGENT',
  AI_COLLECTIONS_AGENT = 'AI_COLLECTIONS_AGENT',
  AI_ONBOARDING_SPECIALIST = 'AI_ONBOARDING_SPECIALIST',
  OPENCLAW_WHITELABEL_SERVICE = 'OPENCLAW_WHITELABEL_SERVICE',
  OPENCLAW_AUTOINSTALL = 'OPENCLAW_AUTOINSTALL',
  OPENCLAW_SETUP_SERVICE = 'OPENCLAW_SETUP_SERVICE',
}

// Experience availability status
export enum ExperienceStatus {
  AVAILABLE = 'AVAILABLE',
  COMING_SOON = 'COMING_SOON',
  BETA = 'BETA',
}

// Landing page section content
export interface ExperienceFeature {
  title: string;
  description: string;
  icon: string; // Icon name from react-icons
}

export interface ExperienceTestimonial {
  name: string;
  role: string;
  content: string;
  rating: number;
}

export interface ExperienceFAQ {
  question: string;
  answer: string;
}

// Per-experience branding overrides
// When set, these override the partner's whitelabel branding for this specific experience.
// When not set, the partner's default whitelabel branding is used.
export interface ExperienceBranding {
  logo?: string;           // Logo URL override
  logoSize?: string;       // Logo size override ('small' | 'medium' | 'large' | 'extra-large')
  favicon?: string;        // Favicon URL override
  primaryColor?: string;   // Primary color override (hex, e.g., '#10B981')
  secondaryColor?: string; // Secondary color override (hex)
  businessName?: string;   // Business name override for this experience
  assistantName?: string;  // Character/assistant name (e.g., 'Aria', 'Max') for branding
  portalTitle?: string;    // Portal title override
  portalSlogan?: string;   // Slogan override
}

// Landing page configuration (stored in JSON column)
export interface LandingPageConfig {
  heroTitle?: string;
  heroSubtitle?: string;
  ctaText?: string;
  features?: ExperienceFeature[];
  testimonials?: ExperienceTestimonial[];
  faqs?: ExperienceFAQ[];
  customSections?: Array<{ type: string; content: unknown }>;
  branding?: ExperienceBranding; // Per-experience branding overrides
  calendarUrl?: string;          // Booking URL sent via email (or embedded when showEmbeddedCalendar is true)
  showEmbeddedCalendar?: boolean; // When true, embed the calendar in the onboarding flow; when false (default), send as a link in the confirmation email
}

// Onboarding configuration (stored in JSON column)
export interface OnboardingConfig {
  enabledSteps?: number[];
  stepOverrides?: Record<number, { title?: string; description?: string }>;
  skipSteps?: number[];
}

// Pricing tier for experience (Lite, Pro, etc.)
export interface PricingTier {
  name: string;              // Internal name: 'lite' | 'pro' | 'max'
  displayName: string;       // Display name: 'Lite', 'Pro', 'Max'
  description: string;       // Short description of the tier
  price: number;             // Price in cents (e.g., 1900 = $19.00)
  currency: string;          // Currency code (e.g., 'usd')
  interval: 'month' | 'year'; // Billing interval
  features: string[];        // List of feature descriptions
  highlighted?: boolean;     // Whether this tier is highlighted (e.g., "Most Popular")
  highlightLabel?: string;   // Label for highlighted tier (e.g., "MOST POPULAR")
  stripePriceId?: string;    // Stripe Price ID (created on save)
  stripeProductId?: string;  // Stripe Product ID (created on save)
}

// Pricing configuration (stored in JSON column)
export interface PricingConfig {
  pricingModel?: 'fixedprice' | 'subscription' | 'payasyougo' | 'free_trial';
  fixedPrice?: number;
  fixedPricePeriod?: string;
  fixedPriceCurrency?: string;
  fixedPriceFeatures?: string;
  tiers?: PricingTier[];     // Pricing tiers (Lite, Pro, etc.)
}

// Deployment configuration (stored in JSON column)
export interface DeploymentConfig {
  agentTier?: 'ESSENTIALS' | 'MODERATE' | 'PREMIUM' | 'BYOA';
  agentTemplate?: string;
  defaultPrompt?: string;
  requiredTools?: string[];
  autoDeployEnabled?: boolean;
}

// Experience metadata (static config, not stored in DB)
export interface ExperienceTypeConfig {
  type: ExperienceType;
  name: string;
  shortDescription: string;
  longDescription: string;
  icon: string;
  color: string;
  status: ExperienceStatus;
  defaultAlias: string | null; // null = root domain (AI Receptionist)
  defaultDisplayName: string;
  onboardingSteps: number[];
  totalOnboardingSteps: number;
  category: 'sales' | 'support' | 'operations' | 'engagement';
}

// API response types
export interface ExperienceListItem {
  type: ExperienceType;
  name: string;
  status: ExperienceStatus;
  enabled: boolean;
  alias: string | null;
  displayName: string | null;
  totalProspects: number;
  totalCustomers: number;
  createdAt: string | null;
  id?: string;
  config: ExperienceTypeConfig;
}

export interface ExperienceListResponse {
  experiences: ExperienceListItem[];
  partnerTier: string;
  canCreateExperiences: boolean;
}

// Partner experience record (from DB)
export interface PartnerExperienceRecord {
  id: string;
  partnerId: string;
  experienceType: string;
  alias: string | null;
  displayName: string;
  description: string | null;
  enabled: boolean;
  isDefault: boolean;
  landingPageConfig: LandingPageConfig;
  onboardingConfig: OnboardingConfig;
  pricingConfig: PricingConfig;
  deploymentConfig: DeploymentConfig;
  totalProspects: number;
  totalCustomers: number;
  createdAt: Date;
  updatedAt: Date;
}

// Create experience request
export interface CreateExperienceRequest {
  experienceType: ExperienceType;
  displayName?: string;
  alias?: string;
}

// Update experience request
export interface UpdateExperienceRequest {
  displayName?: string;
  alias?: string;
  enabled?: boolean;
  landingPageConfig?: Partial<LandingPageConfig>;
  onboardingConfig?: Partial<OnboardingConfig>;
  pricingConfig?: Partial<PricingConfig>;
  deploymentConfig?: Partial<DeploymentConfig>;
}

