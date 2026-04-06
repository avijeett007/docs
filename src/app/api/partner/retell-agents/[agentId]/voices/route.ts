import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

export const dynamic = 'force-dynamic';

interface RetellVoice {
  voice_id: string;
  voice_name: string;
  provider: string;
  accent: string;
  gender: string;
  age: string;
  preview_audio_url: string;
}

interface VoiceResponse {
  id: string;
  name: string;
  provider: string;
  language: string;
  gender: string;
  accent: string;
  age: string;
  previewUrl: string;
}

// Helper function to map provider to language
function getLanguageFromProvider(provider: string, accent: string): string {
  const providerLanguageMap: { [key: string]: string } = {
    'elevenlabs': 'English',
    'openai': 'English',
    'deepgram': 'English',
    'azure': 'English',
  };

  // You can extend this logic based on accent if needed
  return providerLanguageMap[provider.toLowerCase()] || 'English';
}

// Helper function to fetch voices from Retell API
async function fetchVoicesFromRetell(apiKey: string): Promise<VoiceResponse[]> {
  console.log('[agent-voices/route] Fetching voices from Retell API');
  const response = await fetch('https://api.retellai.com/list-voices', {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    console.error('[agent-voices/route] Retell API error:', response.status, response.statusText);
    
    if (response.status === 401) {
      throw new Error('Invalid Retell API key');
    }
    
    throw new Error(`Retell API error: ${response.status}`);
  }

  const retellVoices: RetellVoice[] = await response.json();
  console.log('[agent-voices/route] Retrieved', retellVoices.length, 'voices from Retell');

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

export async function GET(
  req: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    // Verify the partner JWT token
    const decoded = await verifyPartnerJWT(req);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;
    const { agentId } = params;

    // Get the agent from database
    const agent = await prisma.retellAgent.findFirst({
      where: {
        id: agentId,
        partnerId: partnerId
      }
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Determine which API key to use (agent's own key or partner's key)
    let apiKey = null;

    if (agent.apiKey) {
      // Agent has its own API key
      apiKey = await decrypt(agent.apiKey);
      console.log('[agent-voices/route] Using agent\'s own API key');
    } else {
      // Use partner's API key as fallback
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: { retellApiKey: true }
      });

      if (partner?.retellApiKey) {
        apiKey = await decrypt(partner.retellApiKey);
        console.log('[agent-voices/route] Using partner\'s API key as fallback');
      }
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'RETELL_API_KEY_MISSING' },
        { status: 400 }
      );
    }

    // Fetch voices using the determined API key
    const voices = await fetchVoicesFromRetell(apiKey);

    return NextResponse.json({
      success: true,
      voices,
    });

  } catch (error: any) {
    console.error('[agent-voices/route] Error fetching voices:', error);

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
