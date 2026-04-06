/**
 * Agent Tier Configuration Module
 *
 * Defines the agent tiers available for SaaS partners:
 * - ESSENTIALS: 5 Knotie Credits/min - Cerebras LLM, Inworld TTS, Deepgram STT
 * - MODERATE: 7 Knotie Credits/min - OpenAI GPT-4.1-mini, Cartesia TTS, Deepgram STT
 * - PREMIUM: 10 Knotie Credits/min - OpenAI GPT-4.1, Cartesia TTS, Deepgram STT
 * - BYOA: Bring Your Own Agent - Enterprise only, partner uses their own Retell API key
 */

export type AgentTierType = 'ESSENTIALS' | 'MODERATE' | 'PREMIUM' | 'BYOA';

export interface AgentTierConfig {
  name: AgentTierType;
  displayName: string;
  description: string;
  creditsPerMinute: number;
  llmProvider: string;
  llmModel: string;
  ttsProvider: string;
  sttProvider: string;
}

// Default tier configurations (can be overridden by environment variables)
export const AGENT_TIER_DEFAULTS: Record<AgentTierType, AgentTierConfig> = {
  ESSENTIALS: {
    name: 'ESSENTIALS',
    displayName: 'Essentials',
    description: 'Cost-effective tier with Cerebras LLM and Inworld TTS',
    creditsPerMinute: 5,
    llmProvider: 'cerebras',
    llmModel: 'llama-3.3-70b',
    ttsProvider: 'inworld',
    sttProvider: 'deepgram',
  },
  MODERATE: {
    name: 'MODERATE',
    displayName: 'Moderate',
    description: 'Balanced tier with OpenAI GPT-4.1-mini and Cartesia TTS',
    creditsPerMinute: 7,
    llmProvider: 'openai',
    llmModel: 'gpt-4.1-mini',
    ttsProvider: 'cartesia',
    sttProvider: 'deepgram',
  },
  PREMIUM: {
    name: 'PREMIUM',
    displayName: 'Premium',
    description: 'Ultra-realistic tier with xAI Grok and premium voices',
    creditsPerMinute: 10,
    llmProvider: 'xai',
    llmModel: 'grok-3-fast',
    ttsProvider: 'grok',
    sttProvider: 'deepgram',
  },
  BYOA: {
    name: 'BYOA',
    displayName: 'Bring Your Own Agent',
    description: 'Enterprise tier - Use your own Retell API key for full control and unlimited agents',
    creditsPerMinute: 0, // No credit consumption - partner uses their own Retell account
    llmProvider: 'custom',
    llmModel: 'custom',
    ttsProvider: 'custom',
    sttProvider: 'custom',
  },
};

/**
 * Get agent tier configuration from environment variables or defaults.
 *
 * ⚠️ SERVER-ONLY: This function reads process.env which is only available
 * on the server. For client components, use getAgentTierConfigClient() instead.
 *
 * Environment variable naming convention:
 * - AGENT_TIER_{TIER}_LLM_PROVIDER
 * - AGENT_TIER_{TIER}_LLM_MODEL
 * - AGENT_TIER_{TIER}_TTS_PROVIDER
 * - AGENT_TIER_{TIER}_STT_PROVIDER
 * - AGENT_TIER_{TIER}_CREDITS_PER_MIN
 */
export function getAgentTierConfig(tier: AgentTierType): AgentTierConfig {
  const defaults = AGENT_TIER_DEFAULTS[tier];

  // Check for environment variable overrides (server-side only)
  // In client components, process.env values will be undefined
  const envPrefix = `AGENT_TIER_${tier}`;

  return {
    name: tier,
    displayName: defaults.displayName,
    description: defaults.description,
    creditsPerMinute:
      parseInt(process.env[`${envPrefix}_CREDITS_PER_MIN`] || '', 10) ||
      defaults.creditsPerMinute,
    llmProvider:
      process.env[`${envPrefix}_LLM_PROVIDER`] || defaults.llmProvider,
    llmModel: process.env[`${envPrefix}_LLM_MODEL`] || defaults.llmModel,
    ttsProvider:
      process.env[`${envPrefix}_TTS_PROVIDER`] || defaults.ttsProvider,
    sttProvider:
      process.env[`${envPrefix}_STT_PROVIDER`] || defaults.sttProvider,
  };
}

/**
 * Get agent tier configuration using NEXT_PUBLIC_ environment variables or default values.
 *
 * ✅ CLIENT-SAFE: This function uses NEXT_PUBLIC_ environment variables which are
 * available in both client and server components. Use this in 'use client' components.
 *
 * Note: We must access NEXT_PUBLIC_ variables directly (not via bracket notation)
 * because Next.js only inlines direct references at build time.
 */
export function getAgentTierConfigClient(tier: AgentTierType): AgentTierConfig {
  const defaults = AGENT_TIER_DEFAULTS[tier];

  // Access NEXT_PUBLIC_ environment variables directly for each tier
  // Next.js requires direct access (not bracket notation) for build-time inlining
  let config: AgentTierConfig;

  switch (tier) {
    case 'ESSENTIALS':
      config = {
        name: tier,
        displayName: defaults.displayName,
        description: defaults.description,
        creditsPerMinute:
          parseInt(process.env.NEXT_PUBLIC_AGENT_TIER_ESSENTIALS_CREDITS_PER_MIN || '', 10) ||
          defaults.creditsPerMinute,
        llmProvider:
          process.env.NEXT_PUBLIC_AGENT_TIER_ESSENTIALS_LLM_PROVIDER || defaults.llmProvider,
        llmModel:
          process.env.NEXT_PUBLIC_AGENT_TIER_ESSENTIALS_LLM_MODEL || defaults.llmModel,
        ttsProvider:
          process.env.NEXT_PUBLIC_AGENT_TIER_ESSENTIALS_TTS_PROVIDER || defaults.ttsProvider,
        sttProvider:
          process.env.NEXT_PUBLIC_AGENT_TIER_ESSENTIALS_STT_PROVIDER || defaults.sttProvider,
      };
      break;

    case 'MODERATE':
      config = {
        name: tier,
        displayName: defaults.displayName,
        description: defaults.description,
        creditsPerMinute:
          parseInt(process.env.NEXT_PUBLIC_AGENT_TIER_MODERATE_CREDITS_PER_MIN || '', 10) ||
          defaults.creditsPerMinute,
        llmProvider:
          process.env.NEXT_PUBLIC_AGENT_TIER_MODERATE_LLM_PROVIDER || defaults.llmProvider,
        llmModel:
          process.env.NEXT_PUBLIC_AGENT_TIER_MODERATE_LLM_MODEL || defaults.llmModel,
        ttsProvider:
          process.env.NEXT_PUBLIC_AGENT_TIER_MODERATE_TTS_PROVIDER || defaults.ttsProvider,
        sttProvider:
          process.env.NEXT_PUBLIC_AGENT_TIER_MODERATE_STT_PROVIDER || defaults.sttProvider,
      };
      break;

    case 'PREMIUM':
      config = {
        name: tier,
        displayName: defaults.displayName,
        description: defaults.description,
        creditsPerMinute:
          parseInt(process.env.NEXT_PUBLIC_AGENT_TIER_PREMIUM_CREDITS_PER_MIN || '', 10) ||
          defaults.creditsPerMinute,
        llmProvider:
          process.env.NEXT_PUBLIC_AGENT_TIER_PREMIUM_LLM_PROVIDER || defaults.llmProvider,
        llmModel:
          process.env.NEXT_PUBLIC_AGENT_TIER_PREMIUM_LLM_MODEL || defaults.llmModel,
        ttsProvider:
          process.env.NEXT_PUBLIC_AGENT_TIER_PREMIUM_TTS_PROVIDER || defaults.ttsProvider,
        sttProvider:
          process.env.NEXT_PUBLIC_AGENT_TIER_PREMIUM_STT_PROVIDER || defaults.sttProvider,
      };
      break;

    case 'BYOA':
      // BYOA tier uses defaults - no env var overrides needed since it's custom/partner-managed
      config = defaults;
      break;

    default:
      config = defaults;
  }

  return config;
}

/**
 * Get all agent tier configurations
 *
 * ⚠️ SERVER-ONLY: Uses process.env for overrides. For client components,
 * use getAllAgentTiersClient() instead.
 */
export function getAllAgentTiers(): AgentTierConfig[] {
  return Object.keys(AGENT_TIER_DEFAULTS).map((tier) =>
    getAgentTierConfig(tier as AgentTierType)
  );
}

/**
 * Get all agent tier configurations (client-safe version)
 *
 * ✅ CLIENT-SAFE: Uses default values, works in 'use client' components
 */
export function getAllAgentTiersClient(): AgentTierConfig[] {
  return Object.keys(AGENT_TIER_DEFAULTS).map((tier) =>
    getAgentTierConfigClient(tier as AgentTierType)
  );
}

/**
 * Validate if a string is a valid agent tier
 */
export function isValidAgentTier(tier: string | null | undefined): tier is AgentTierType {
  return tier === 'ESSENTIALS' || tier === 'MODERATE' || tier === 'PREMIUM' || tier === 'BYOA';
}

/**
 * Validate if a string is a valid standard agent tier (excludes BYOA)
 * Used for filtering out enterprise-only tiers in standard tier lists
 */
export function isStandardAgentTier(tier: string | null | undefined): tier is Exclude<AgentTierType, 'BYOA'> {
  return tier === 'ESSENTIALS' || tier === 'MODERATE' || tier === 'PREMIUM';
}

/**
 * Get all standard agent tier configurations (excludes BYOA)
 * Used in contexts where only standard tiers should be shown (non-enterprise partners)
 *
 * ✅ CLIENT-SAFE: Uses default values, works in 'use client' components
 */
export function getStandardAgentTiersClient(): AgentTierConfig[] {
  const standardTiers: AgentTierType[] = ['ESSENTIALS', 'MODERATE', 'PREMIUM'];
  return standardTiers.map((tier) => getAgentTierConfigClient(tier));
}

/**
 * Get the BYOA tier configuration
 *
 * ✅ CLIENT-SAFE: Uses default values, works in 'use client' components
 */
export function getBYOATierConfigClient(): AgentTierConfig {
  return getAgentTierConfigClient('BYOA');
}

/**
 * Get the default agent tier
 */
export function getDefaultAgentTier(): AgentTierType {
  return 'ESSENTIALS';
}

/**
 * Get TTS provider for a given tier (used in onboarding step 6)
 *
 * ✅ CLIENT-SAFE: Uses default values, works in 'use client' components
 */
export function getTtsProviderForTier(tier: AgentTierType | string | null | undefined): string {
  const validTier = isValidAgentTier(tier) ? tier : getDefaultAgentTier();
  // Use client-safe function to avoid process.env issues in browser
  return getAgentTierConfigClient(validTier).ttsProvider;
}

/**
 * Get LLM configuration for a given tier
 *
 * ⚠️ SERVER-ONLY: Uses process.env for overrides. For client components,
 * use getLlmConfigForTierClient() instead.
 */
export function getLlmConfigForTier(tier: AgentTierType | string | null | undefined): {
  provider: string;
  model: string;
} {
  const validTier = isValidAgentTier(tier) ? tier : getDefaultAgentTier();
  const config = getAgentTierConfig(validTier);
  return {
    provider: config.llmProvider,
    model: config.llmModel,
  };
}

/**
 * Get LLM configuration for a given tier (client-safe version)
 *
 * ✅ CLIENT-SAFE: Uses default values, works in 'use client' components
 */
export function getLlmConfigForTierClient(tier: AgentTierType | string | null | undefined): {
  provider: string;
  model: string;
} {
  const validTier = isValidAgentTier(tier) ? tier : getDefaultAgentTier();
  const config = getAgentTierConfigClient(validTier);
  return {
    provider: config.llmProvider,
    model: config.llmModel,
  };
}

/**
 * Get STT provider for a given tier
 *
 * ✅ CLIENT-SAFE: Uses default values, works in 'use client' components
 */
export function getSttProviderForTier(tier: AgentTierType | string | null | undefined): string {
  const validTier = isValidAgentTier(tier) ? tier : getDefaultAgentTier();
  // Use client-safe function to avoid process.env issues in browser
  return getAgentTierConfigClient(validTier).sttProvider;
}

/**
 * Get credits per minute for a given tier
 *
 * ✅ CLIENT-SAFE: Uses default values, works in 'use client' components
 */
export function getCreditsPerMinuteForTier(tier: AgentTierType | string | null | undefined): number {
  const validTier = isValidAgentTier(tier) ? tier : getDefaultAgentTier();
  // Use client-safe function to avoid process.env issues in browser
  return getAgentTierConfigClient(validTier).creditsPerMinute;
}

