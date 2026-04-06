import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

// This route uses dynamic features, so it must be server-rendered
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

// Helper function to fetch voices from Retell API
async function fetchVoicesFromRetell(apiKey: string): Promise<VoiceResponse[]> {
  console.log('[voices/route] Fetching voices from Retell API');
  const response = await fetch('https://api.retellai.com/list-voices', {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    console.error('[voices/route] Retell API error:', response.status, response.statusText);

    if (response.status === 401) {
      throw new Error('Invalid Retell API key');
    }

    throw new Error(`Retell API error: ${response.status}`);
  }

  const retellVoices: RetellVoice[] = await response.json();
  console.log('[voices/route] Retrieved', retellVoices.length, 'voices from Retell');

  // Transform voices to our format
  const voices: VoiceResponse[] = retellVoices.map((voice) => ({
    id: voice.voice_id,
    name: voice.voice_name,
    provider: voice.provider,
    language: getLanguageFromProvider(voice.provider, voice.accent),
    gender: voice.gender,
    accent: voice.accent,
    age: voice.age,
    previewUrl: voice.preview_audio_url,
  }));

  // Sort voices by provider and name for better UX
  voices.sort((a, b) => {
    if (a.provider !== b.provider) {
      return a.provider.localeCompare(b.provider);
    }
    return a.name.localeCompare(b.name);
  });

  return voices;
}

export async function GET(req: NextRequest) {
  try {
    // Verify the partner JWT token
    const decoded = await verifyPartnerJWT(req);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;

    // Get the partner's Retell API key
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        retellApiKey: true,
      },
    });

    if (!partner?.retellApiKey) {
      return NextResponse.json(
        { error: 'RETELL_API_KEY_MISSING' },
        { status: 400 }
      );
    }

    // Decrypt the Retell API key
    const decryptedApiKey = await decrypt(partner.retellApiKey);

    // Fetch voices using the helper function
    const voices = await fetchVoicesFromRetell(decryptedApiKey);

    return NextResponse.json({
      success: true,
      voices,
    });

  } catch (error: any) {
    console.error('[voices/route] Error fetching voices:', error);

    // Determine the specific error type and return appropriate response
    if (error instanceof Error) {
      if (error.message.includes('RETELL_API_KEY_MISSING')) {
        return NextResponse.json({ error: 'RETELL_API_KEY_MISSING' }, { status: 400 });
      } else if (error.message.includes('Invalid Retell API key')) {
        return NextResponse.json({ error: 'Invalid Retell API key' }, { status: 401 });
      } else if (error.message.includes('net::ERR_NAME_NOT_RESOLVED')) {
        return NextResponse.json({ error: 'Could not connect to Retell API' }, { status: 500 });
      }

      return NextResponse.json(
        { error: 'Failed to fetch voices', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch voices', details: 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Verify the partner JWT token
    const decoded = await verifyPartnerJWT(req);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await req.json();
    const { apiKey } = body;

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    // Fetch voices using the provided API key
    const voices = await fetchVoicesFromRetell(apiKey.trim());

    return NextResponse.json({
      success: true,
      voices,
    });

  } catch (error: any) {
    console.error('[voices/route] Error fetching voices with provided API key:', error);

    // Determine the specific error type and return appropriate response
    if (error instanceof Error) {
      if (error.message.includes('Invalid Retell API key')) {
        return NextResponse.json({ error: 'Invalid Retell API key' }, { status: 401 });
      } else if (error.message.includes('net::ERR_NAME_NOT_RESOLVED')) {
        return NextResponse.json({ error: 'Could not connect to Retell API' }, { status: 500 });
      }

      return NextResponse.json(
        { error: 'Failed to fetch voices', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch voices', details: 'Unknown error' },
      { status: 500 }
    );
  }
}

// Helper function to determine language from provider and accent
function getLanguageFromProvider(provider: string, accent?: string): string {
  // Default language mapping based on provider and accent
  if (provider === 'elevenlabs') {
    if (accent?.toLowerCase().includes('british')) return 'en-GB';
    if (accent?.toLowerCase().includes('american')) return 'en-US';
    if (accent?.toLowerCase().includes('australian')) return 'en-AU';
    return 'en-US'; // Default for ElevenLabs
  }
  
  if (provider === 'openai') {
    return 'en-US'; // OpenAI voices are primarily English
  }
  
  if (provider === 'deepgram') {
    return 'en-US'; // Deepgram voices are primarily English
  }
  
  return 'en-US'; // Default fallback
}
