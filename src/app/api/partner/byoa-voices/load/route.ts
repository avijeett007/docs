import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { getPartnerTier, isEnterpriseTier } from '@/lib/portalModes';

export const dynamic = 'force-dynamic';

interface RetellVoice {
  voice_id: string;
  voice_name: string;
  provider: string;
  accent?: string;
  gender: string;
  age?: string;
  preview_audio_url?: string;
}

interface VoiceResponse {
  id: string;
  name: string;
  provider: string;
  language: string;
  gender: string;
  accent?: string;
  age?: string;
  previewUrl?: string;
}

// Helper function to determine language from provider and accent
function getLanguageFromProvider(provider: string, accent?: string): string {
  if (provider === 'elevenlabs') {
    if (accent?.toLowerCase().includes('british')) return 'en-GB';
    if (accent?.toLowerCase().includes('american')) return 'en-US';
    if (accent?.toLowerCase().includes('australian')) return 'en-AU';
    if (accent?.toLowerCase().includes('spanish')) return 'es-ES';
    if (accent?.toLowerCase().includes('french')) return 'fr-FR';
    if (accent?.toLowerCase().includes('german')) return 'de-DE';
    if (accent?.toLowerCase().includes('indian')) return 'en-IN';
    return 'en-US';
  }
  if (provider === 'openai' || provider === 'deepgram') {
    return 'en-US';
  }
  return 'en-US';
}

// Helper function to fetch voices from Retell API
async function fetchVoicesFromRetell(apiKey: string): Promise<VoiceResponse[]> {
  const response = await fetch('https://api.retellai.com/list-voices', {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    cache: 'no-store', // Disable Next.js caching
    next: { revalidate: 0 }, // Ensure no ISR caching
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid Retell API key');
    }
    throw new Error(`Retell API error: ${response.status}`);
  }

  const retellVoices: RetellVoice[] = await response.json();

  const voices: VoiceResponse[] = retellVoices.map((voice) => ({
    id: voice.voice_id,
    name: voice.voice_name,
    provider: voice.provider,
    language: getLanguageFromProvider(voice.provider, voice.accent),
    gender: voice.gender || 'unknown', // Handle missing gender for custom voices
    accent: voice.accent,
    age: voice.age,
    previewUrl: voice.preview_audio_url,
  }));

  // Sort voices by provider and name
  voices.sort((a, b) => {
    if (a.provider !== b.provider) return a.provider.localeCompare(b.provider);
    return a.name.localeCompare(b.name);
  });

  return voices;
}

// GET - Load available voices from Retell using partner's saved API key
export async function GET(req: NextRequest) {
  try {
    const authResult = await verifyPartnerToken(req);
    if (authResult.error) {
      return authResult.error;
    }

    const partnerId = authResult.partner!.id;
    const partner = authResult.partner!;

    // Verify partner is enterprise tier
    const partnerTier = getPartnerTier(partner.planId, partner.approvalStatus);
    if (!isEnterpriseTier(partnerTier)) {
      return NextResponse.json(
        { error: 'BYOA is only available for Enterprise tier partners' },
        { status: 403 }
      );
    }

    // Get partner's Retell API key
    const partnerWithKey = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: { retellApiKey: true },
    });

    if (!partnerWithKey?.retellApiKey) {
      return NextResponse.json(
        { error: 'RETELL_API_KEY_MISSING', message: 'Please add your Retell API key first' },
        { status: 400 }
      );
    }

    const decryptedApiKey = await decrypt(partnerWithKey.retellApiKey);
    const trimmedKey = decryptedApiKey.trim();

    const voices = await fetchVoicesFromRetell(trimmedKey);

    // Also get partner's currently saved voices to mark them
    const savedVoices = await prisma.partnerBYOAVoice.findMany({
      where: { partnerId, isActive: true },
      select: { voiceId: true },
    });
    const savedVoiceIds = new Set(savedVoices.map(v => v.voiceId));

    // Mark which voices are already saved
    const voicesWithSavedStatus = voices.map(v => ({
      ...v,
      isSaved: savedVoiceIds.has(v.id),
    }));

    return NextResponse.json({
      success: true,
      voices: voicesWithSavedStatus,
      count: voices.length,
    });
  } catch (error: any) {
    console.error('[byoa-voices/load] Error loading voices:', error);
    if (error.message?.includes('Invalid Retell API key')) {
      return NextResponse.json({ error: 'Invalid Retell API key' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to load voices from Retell' }, { status: 500 });
  }
}

