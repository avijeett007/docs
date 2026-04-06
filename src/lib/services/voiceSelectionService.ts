/**
 * Voice Selection Service
 *
 * Intelligently selects a voice for prospect onboarding based on partner configuration.
 * Decision flow:
 * 1. If voice_id is provided → use it directly
 * 2. If partner is Enterprise with BYOA voices → select from PartnerBYOAVoice table
 * 3. If partner has autoDeployEnabled → select from tier's TTS provider (Inworld/Cartesia/Premium)
 * 4. If autoDeployEnabled is false → select from Retell voices
 */

import { prisma } from '@/lib/prisma';
import { getTtsProviderForTier } from '@/lib/agentTiers';
import { getPartnerTier, isEnterpriseTier } from '@/lib/portalModes';
import { logger } from '@/lib/logger';
import {
  getCachedVoices,
  setCachedVoices,
  isApprovedVoice,
  type CachedVoice,
} from '@/lib/retell-voices-config';

export interface VoiceSelectionResult {
  voiceId: string;
  voiceType: 'male' | 'female';
  provider: string;
  selectionMethod: 'provided' | 'byoa' | 'tier_based' | 'retell_fallback';
}

interface PartnerConfig {
  id: string;
  autoDeployEnabled: boolean;
  saasAgentTier: string | null;
  planId: string | null;
  approvalStatus: string | null;
  retellApiKey?: string | null;
}

/**
 * Select a voice for a prospect based on partner configuration
 */
export async function selectVoiceForProspect(
  partner: PartnerConfig,
  providedVoiceId?: string | null,
  providedVoiceType?: 'male' | 'female' | null
): Promise<VoiceSelectionResult> {
  // Determine voice type (random 50/50 if not provided)
  const voiceType = providedVoiceType || (Math.random() < 0.5 ? 'male' : 'female');

  // 1. If voice_id is explicitly provided, use it directly
  if (providedVoiceId) {
    logger.info('[VoiceSelection] Using provided voice_id', { voiceId: providedVoiceId, voiceType });
    return {
      voiceId: providedVoiceId,
      voiceType,
      provider: 'provided',
      selectionMethod: 'provided',
    };
  }

  // 2. Check if partner is Enterprise tier with BYOA voices
  const partnerTier = getPartnerTier(partner.planId, partner.approvalStatus);
  if (isEnterpriseTier(partnerTier)) {
    const byoaVoice = await selectBYOAVoice(partner.id, voiceType);
    if (byoaVoice) {
      logger.info('[VoiceSelection] Selected BYOA voice', { voiceId: byoaVoice, voiceType, partnerId: partner.id });
      return {
        voiceId: byoaVoice,
        voiceType,
        provider: 'retell_byoa',
        selectionMethod: 'byoa',
      };
    }
    // Fall through if no BYOA voices configured
    logger.info('[VoiceSelection] Enterprise partner has no BYOA voices, falling through to tier-based selection');
  }

  // 3. If autoDeployEnabled, select from tier's TTS provider
  if (partner.autoDeployEnabled) {
    const ttsProvider = getTtsProviderForTier(partner.saasAgentTier);
    const tierVoice = await selectVoiceFromProvider(ttsProvider, voiceType);
    if (tierVoice) {
      logger.info('[VoiceSelection] Selected tier-based voice', {
        voiceId: tierVoice, voiceType, provider: ttsProvider, tier: partner.saasAgentTier,
      });
      return {
        voiceId: tierVoice,
        voiceType,
        provider: ttsProvider,
        selectionMethod: 'tier_based',
      };
    }
    logger.warn('[VoiceSelection] Failed to select voice from tier provider, falling back to Retell', {
      provider: ttsProvider, tier: partner.saasAgentTier,
    });
  }

  // 4. Fallback: select from Retell voices
  const retellVoice = await selectRetellVoice(voiceType);
  if (retellVoice) {
    logger.info('[VoiceSelection] Selected Retell fallback voice', { voiceId: retellVoice, voiceType });
    return {
      voiceId: retellVoice,
      voiceType,
      provider: 'retell',
      selectionMethod: 'retell_fallback',
    };
  }

  // Ultimate fallback - should rarely happen
  logger.error('[VoiceSelection] Could not select any voice, using empty string');
  return {
    voiceId: '',
    voiceType,
    provider: 'none',
    selectionMethod: 'retell_fallback',
  };
}

/**
 * Select a random voice from partner's BYOA voices
 */
async function selectBYOAVoice(partnerId: string, voiceType: 'male' | 'female'): Promise<string | null> {
  try {
    const byoaVoices = await prisma.partnerBYOAVoice.findMany({
      where: {
        partnerId,
        isActive: true,
        ...(voiceType ? { gender: voiceType } : {}),
      },
    });

    if (byoaVoices.length === 0) {
      // Try without gender filter
      const allVoices = await prisma.partnerBYOAVoice.findMany({
        where: { partnerId, isActive: true },
      });
      if (allVoices.length === 0) return null;
      return allVoices[Math.floor(Math.random() * allVoices.length)].voiceId;
    }

    return byoaVoices[Math.floor(Math.random() * byoaVoices.length)].voiceId;
  } catch (error) {
    logger.error('[VoiceSelection] Error selecting BYOA voice', error instanceof Error ? error : undefined);
    return null;
  }
}

/**
 * Select a random voice from a TTS provider (Inworld, Cartesia, or Premium/Grok)
 * Makes direct API calls instead of going through HTTP routes
 */
async function selectVoiceFromProvider(provider: string, voiceType: 'male' | 'female'): Promise<string | null> {
  try {
    switch (provider) {
      case 'inworld':
        return await selectInworldVoice(voiceType);
      case 'cartesia':
        return await selectCartesiaVoice(voiceType);
      case 'grok':
        return await selectPremiumVoice(voiceType);
      default:
        logger.warn('[VoiceSelection] Unknown TTS provider', { provider });
        return null;
    }
  } catch (error) {
    logger.error('[VoiceSelection] Error selecting voice from provider', error instanceof Error ? error : undefined);
    return null;
  }
}

/**
 * Select a random Inworld voice by gender
 */
async function selectInworldVoice(voiceType: 'male' | 'female'): Promise<string | null> {
  const inworldCredential = process.env.INWORLD_RUNTIME_BASE64_CREDENTIAL;
  if (!inworldCredential) {
    logger.warn('[VoiceSelection] Inworld credentials not configured');
    return null;
  }

  const response = await fetch('https://api.inworld.ai/tts/v1/voices?filter=language=en', {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${inworldCredential}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    logger.error('[VoiceSelection] Inworld API error', undefined, { status: response.status });
    return null;
  }

  const data = await response.json();
  const allVoices = data.voices || [];

  // Filter by gender using tags
  const targetGender = voiceType.toLowerCase();
  const filtered = allVoices.filter((voice: any) => {
    const tags = (voice.tags || []).map((t: string) => t.toLowerCase());
    return tags.includes(targetGender);
  });

  const voicePool = filtered.length > 0 ? filtered : allVoices;
  if (voicePool.length === 0) return null;

  const selected = voicePool[Math.floor(Math.random() * voicePool.length)];
  return selected.voiceId || null;
}

/**
 * Select a random Cartesia voice by gender
 */
async function selectCartesiaVoice(voiceType: 'male' | 'female'): Promise<string | null> {
  const cartesiaApiKey = process.env.CARTESIA_API_KEY;
  if (!cartesiaApiKey) {
    logger.warn('[VoiceSelection] Cartesia API key not configured');
    return null;
  }

  const targetGender = voiceType === 'male' ? 'masculine' : 'feminine';
  const queryParams = new URLSearchParams({ gender: targetGender, limit: '20' });

  const response = await fetch(`https://api.cartesia.ai/voices?${queryParams.toString()}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${cartesiaApiKey}`,
      'Cartesia-Version': '2025-04-16',
    },
  });

  if (!response.ok) {
    logger.error('[VoiceSelection] Cartesia API error', undefined, { status: response.status });
    return null;
  }

  const data = await response.json();
  let voices = data.data || [];

  // Double-filter by gender
  voices = voices.filter((voice: any) => voice.gender === targetGender);
  if (voices.length === 0) return null;

  const selected = voices[Math.floor(Math.random() * voices.length)];
  return selected.id || null;
}

/**
 * Select a random Premium/Grok voice by gender from the database
 */
async function selectPremiumVoice(voiceType: 'male' | 'female'): Promise<string | null> {
  try {
    const voices = await prisma.voice.findMany({
      where: {
        isActive: true,
        provider: 'grok',
        sex: voiceType,
      },
      take: 20,
    });

    if (voices.length === 0) {
      // Try without gender filter
      const allVoices = await prisma.voice.findMany({
        where: { isActive: true, provider: 'grok' },
        take: 20,
      });
      if (allVoices.length === 0) return null;
      return allVoices[Math.floor(Math.random() * allVoices.length)].id;
    }

    return voices[Math.floor(Math.random() * voices.length)].id;
  } catch (error) {
    logger.error('[VoiceSelection] Error selecting premium voice', error instanceof Error ? error : undefined);
    return null;
  }
}

/**
 * Select a random Retell voice by gender (using SAAS_RETELL_API_KEY)
 * Uses caching to avoid repeated API calls
 */
async function selectRetellVoice(voiceType: 'male' | 'female'): Promise<string | null> {
  try {
    // Check cache first
    const cachedVoices = getCachedVoices(voiceType);
    if (cachedVoices && cachedVoices.length > 0) {
      const selected = cachedVoices[Math.floor(Math.random() * cachedVoices.length)];
      return selected.voice_id;
    }

    const retellApiKey = process.env.SAAS_RETELL_API_KEY;
    if (!retellApiKey) {
      logger.warn('[VoiceSelection] SAAS_RETELL_API_KEY not configured');
      return null;
    }

    const response = await fetch('https://api.retellai.com/list-voices', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${retellApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      logger.error('[VoiceSelection] Retell API error', undefined, { status: response.status });
      return null;
    }

    const allVoices = await response.json();

    // Filter by gender and approved list
    const filteredVoices: CachedVoice[] = allVoices.filter((voice: any) =>
      voice.gender.toLowerCase() === voiceType.toLowerCase() &&
      isApprovedVoice(voice.voice_name, voiceType)
    );

    // Cache the filtered voices
    if (filteredVoices.length > 0) {
      setCachedVoices(voiceType, filteredVoices);
    }

    if (filteredVoices.length === 0) return null;

    const selected = filteredVoices[Math.floor(Math.random() * filteredVoices.length)];
    return selected.voice_id;
  } catch (error) {
    logger.error('[VoiceSelection] Error selecting Retell voice', error instanceof Error ? error : undefined);
    return null;
  }
}

