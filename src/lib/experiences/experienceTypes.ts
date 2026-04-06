/**
 * Experience Type Definitions & Configuration Map
 *
 * Central registry of all experience types with their metadata.
 * This is the single source of truth for experience type information.
 */

import { ExperienceType, ExperienceStatus, ExperienceTypeConfig } from '@/types/experience';

// Reserved URL paths that cannot be used as experience aliases
export const RESERVED_ALIASES = [
  '/api',
  '/partner',
  '/admin',
  '/whitelabel',
  '/platform',
  '/onboarding',
  '/dashboard',
  '/login',
  '/signup',
  '/auth',
  '/settings',
  '/billing',
  '/docs',
  '/help',
  '/support',
  '/status',
  '/health',
  '/webhook',
  '/webhooks',
  '/_next',
  '/static',
  '/public',
  '/favicon.ico',
];

/**
 * Master configuration map for all experience types.
 * Each entry defines the static metadata for an experience type.
 */
export const EXPERIENCE_CONFIGS: Record<ExperienceType, ExperienceTypeConfig> = {
  [ExperienceType.AI_RECEPTIONIST]: {
    type: ExperienceType.AI_RECEPTIONIST,
    name: 'AI Receptionist',
    shortDescription: 'Automated phone receptionist for businesses',
    longDescription: 'Deploy an AI-powered phone receptionist that handles incoming calls, books appointments, answers FAQs, and routes calls to the right team members — 24/7.',
    icon: 'FiPhone',
    color: '#3B82F6', // blue-500
    status: ExperienceStatus.AVAILABLE,
    defaultAlias: null, // Root domain — no alias
    defaultDisplayName: 'AI Receptionist',
    onboardingSteps: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    totalOnboardingSteps: 9,
    category: 'support',
  },
  [ExperienceType.AI_PERSONAL_ASSISTANT]: {
    type: ExperienceType.AI_PERSONAL_ASSISTANT,
    name: 'AI Personal Assistant',
    shortDescription: 'WhatsApp-based AI assistant for business owners',
    longDescription: 'Give your customers a personal AI assistant on WhatsApp that manages their schedule, answers questions, handles tasks, and keeps them organized — all through simple chat messages.',
    icon: 'FiMessageCircle',
    color: '#10B981', // emerald-500
    status: ExperienceStatus.AVAILABLE,
    defaultAlias: '/assistant',
    defaultDisplayName: 'AI Personal Assistant',
    onboardingSteps: [1, 3, 5, 6, 9],
    totalOnboardingSteps: 5,
    category: 'operations',
  },
  [ExperienceType.AI_OUTBOUND_SDR]: {
    type: ExperienceType.AI_OUTBOUND_SDR,
    name: 'AI Outbound SDR',
    shortDescription: 'Automated outbound sales development',
    longDescription: 'An AI sales development representative that makes outbound calls, qualifies leads, and books meetings with your sales team.',
    icon: 'FiTrendingUp',
    color: '#F59E0B', // amber-500
    status: ExperienceStatus.COMING_SOON,
    defaultAlias: '/sdr',
    defaultDisplayName: 'AI Outbound SDR',
    onboardingSteps: [1, 3, 4, 6, 9],
    totalOnboardingSteps: 5,
    category: 'sales',
  },
  [ExperienceType.AI_CUSTOMER_SUPPORT]: {
    type: ExperienceType.AI_CUSTOMER_SUPPORT,
    name: 'AI Customer Support',
    shortDescription: '24/7 customer support automation',
    longDescription: 'Deploy an AI customer support agent that handles tickets, resolves common issues, and escalates complex problems to your human team.',
    icon: 'FiHeadphones',
    color: '#8B5CF6', // violet-500
    status: ExperienceStatus.COMING_SOON,
    defaultAlias: '/support',
    defaultDisplayName: 'AI Customer Support',
    onboardingSteps: [1, 3, 4, 5, 6, 9],
    totalOnboardingSteps: 6,
    category: 'support',
  },
  [ExperienceType.AI_APPOINTMENT_SETTER]: {
    type: ExperienceType.AI_APPOINTMENT_SETTER,
    name: 'AI Appointment Setter',
    shortDescription: 'Specialized appointment booking agent',
    longDescription: 'An AI agent dedicated to booking appointments, managing calendars, sending reminders, and reducing no-shows.',
    icon: 'FiCalendar',
    color: '#EC4899', // pink-500
    status: ExperienceStatus.COMING_SOON,
    defaultAlias: '/appointments',
    defaultDisplayName: 'AI Appointment Setter',
    onboardingSteps: [1, 3, 6, 8, 9],
    totalOnboardingSteps: 5,
    category: 'operations',
  },
  [ExperienceType.AI_LEAD_QUALIFIER]: {
    type: ExperienceType.AI_LEAD_QUALIFIER,
    name: 'AI Lead Qualifier',
    shortDescription: 'Inbound lead qualification and routing',
    longDescription: 'Automatically qualify inbound leads through intelligent conversations, score them, and route hot leads to your sales team instantly.',
    icon: 'FiFilter',
    color: '#06B6D4', // cyan-500
    status: ExperienceStatus.COMING_SOON,
    defaultAlias: '/qualify',
    defaultDisplayName: 'AI Lead Qualifier',
    onboardingSteps: [1, 3, 4, 6, 9],
    totalOnboardingSteps: 5,
    category: 'sales',
  },
  [ExperienceType.AI_SURVEY_AGENT]: {
    type: ExperienceType.AI_SURVEY_AGENT,
    name: 'AI Survey Agent',
    shortDescription: 'Automated feedback and survey collection',
    longDescription: 'Collect customer feedback and run surveys through natural AI conversations — get higher response rates than traditional forms.',
    icon: 'FiClipboard',
    color: '#14B8A6', // teal-500
    status: ExperienceStatus.COMING_SOON,
    defaultAlias: '/survey',
    defaultDisplayName: 'AI Survey Agent',
    onboardingSteps: [1, 3, 6, 9],
    totalOnboardingSteps: 4,
    category: 'engagement',
  },
  [ExperienceType.AI_COLLECTIONS_AGENT]: {
    type: ExperienceType.AI_COLLECTIONS_AGENT,
    name: 'AI Collections Agent',
    shortDescription: 'Automated payment reminders and collections',
    longDescription: 'A professional AI agent that handles payment reminders, negotiates payment plans, and improves collection rates — all while maintaining customer relationships.',
    icon: 'FiDollarSign',
    color: '#EF4444', // red-500
    status: ExperienceStatus.COMING_SOON,
    defaultAlias: '/collections',
    defaultDisplayName: 'AI Collections Agent',
    onboardingSteps: [1, 3, 6, 9],
    totalOnboardingSteps: 4,
    category: 'operations',
  },
  [ExperienceType.AI_ONBOARDING_SPECIALIST]: {
    type: ExperienceType.AI_ONBOARDING_SPECIALIST,
    name: 'AI Onboarding Specialist',
    shortDescription: 'New customer/employee onboarding automation',
    longDescription: 'Automate the onboarding process for new customers or employees with an AI guide that walks them through every step.',
    icon: 'FiUserPlus',
    color: '#6366F1', // indigo-500
    status: ExperienceStatus.COMING_SOON,
    defaultAlias: '/onboard',
    defaultDisplayName: 'AI Onboarding Specialist',
    onboardingSteps: [1, 3, 5, 6, 9],
    totalOnboardingSteps: 5,
    category: 'engagement',
  },
  [ExperienceType.OPENCLAW_WHITELABEL_SERVICE]: {
    type: ExperienceType.OPENCLAW_WHITELABEL_SERVICE,
    name: 'Whitelabel OpenClaw Service',
    shortDescription: 'Sell whitelabel AI team setup & implementation to your clients',
    longDescription: 'Let your clients get a full AI team — marketing, sales, support & operations specialists — built and deployed for them. You sell the service, the platform handles the tech.',
    icon: 'FiZap',
    color: '#00C4B4', // OpenClaw teal
    status: ExperienceStatus.COMING_SOON,
    defaultAlias: '/openclaw',
    defaultDisplayName: 'OpenClaw Setup as a Service',
    onboardingSteps: [1, 3, 9],
    totalOnboardingSteps: 3,
    category: 'operations',
  },
  [ExperienceType.OPENCLAW_AUTOINSTALL]: {
    type: ExperienceType.OPENCLAW_AUTOINSTALL,
    name: 'OpenClaw Auto-Install',
    shortDescription: 'One-click personal AI setup — Telegram, Gmail, Calendar & more',
    longDescription: 'Give your clients a personal AI that lives in Telegram and connects to Gmail, Google Calendar, Notion and more — auto-installed in one click. No app to build. No tech team needed.',
    icon: 'FiZap',
    color: '#00C4B4', // OpenClaw teal
    status: ExperienceStatus.COMING_SOON,
    defaultAlias: '/openclaw-autoinstall',
    defaultDisplayName: 'OpenClaw Auto-Install',
    onboardingSteps: [1, 3, 9],
    totalOnboardingSteps: 3,
    category: 'operations',
  },
  [ExperienceType.OPENCLAW_SETUP_SERVICE]: {
    type: ExperienceType.OPENCLAW_SETUP_SERVICE,
    name: 'OpenClaw Setup Service',
    shortDescription: 'Book a guided setup call — experts configure your AI tools with you',
    longDescription: 'Sell a hands-on setup service where prospects book a call with your agency. You walk them through configuring OpenClaw, connecting their apps, and getting their personal AI live — together.',
    icon: 'FiCalendar',
    color: '#F97316', // Orange — distinct from teal used by the other two
    status: ExperienceStatus.BETA,
    defaultAlias: '/openclaw-setup',
    defaultDisplayName: 'OpenClaw Setup Service',
    onboardingSteps: [1, 3, 9],
    totalOnboardingSteps: 3,
    category: 'operations',
  },
};

/**
 * Get configuration for a specific experience type
 */
export function getExperienceConfig(type: ExperienceType): ExperienceTypeConfig {
  return EXPERIENCE_CONFIGS[type];
}

/**
 * Get all available experience types (not COMING_SOON)
 */
export function getAvailableExperiences(): ExperienceTypeConfig[] {
  return Object.values(EXPERIENCE_CONFIGS).filter(
    (config) => config.status === ExperienceStatus.AVAILABLE
  );
}

/**
 * Get all coming soon experience types
 */
export function getComingSoonExperiences(): ExperienceTypeConfig[] {
  return Object.values(EXPERIENCE_CONFIGS).filter(
    (config) => config.status === ExperienceStatus.COMING_SOON
  );
}

/**
 * Get all experience types
 */
export function getAllExperiences(): ExperienceTypeConfig[] {
  return Object.values(EXPERIENCE_CONFIGS);
}

/**
 * Validate that an alias is not reserved
 */
export function isAliasReserved(alias: string): boolean {
  const normalizedAlias = alias.startsWith('/') ? alias : `/${alias}`;
  return RESERVED_ALIASES.some(
    (reserved) => normalizedAlias === reserved || normalizedAlias.startsWith(`${reserved}/`)
  );
}

/**
 * Validate alias format
 */
export function isValidAlias(alias: string): boolean {
  if (!alias) return false;
  const normalizedAlias = alias.startsWith('/') ? alias : `/${alias}`;
  // Must start with /, only contain lowercase letters, numbers, hyphens
  return /^\/[a-z0-9][a-z0-9-]*$/.test(normalizedAlias) && !isAliasReserved(normalizedAlias);
}

/**
 * Get experience type from alias
 */
export function getExperienceTypeFromDefaultAlias(alias: string): ExperienceType | null {
  const normalizedAlias = alias.startsWith('/') ? alias : `/${alias}`;
  const config = Object.values(EXPERIENCE_CONFIGS).find(
    (c) => c.defaultAlias === normalizedAlias
  );
  return config?.type || null;
}

