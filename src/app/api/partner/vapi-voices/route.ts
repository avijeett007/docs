export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';

// GET /api/partner/vapi-voices - Get available VAPI voices for partner
export async function GET(request: NextRequest) {
  try {
    // Verify partner authentication
    const auth = await verifyPartnerJWT(request);
    if (!auth.isValid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[partner/vapi-voices] Fetching VAPI voices for partner');

    // Get VAPI API key from environment
    const vapiApiKey = process.env.VAPI_API_KEY;
    if (!vapiApiKey) {
      console.error('[partner/vapi-voices] VAPI API key not configured');
      return NextResponse.json(
        { error: 'VAPI service not configured' },
        { status: 500 }
      );
    }

    try {
      // Fetch voices from VAPI API
      const response = await fetch('https://api.vapi.ai/voice', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${vapiApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[partner/vapi-voices] VAPI API error:', response.status, errorText);
        
        // Return a fallback response instead of failing completely
        return NextResponse.json([
          {
            id: 'fallback-voice-1',
            name: 'sarah',
            displayName: 'Sarah - Professional Female',
            provider: 'elevenlabs',
            voiceModelId: '21m00Tcm4TlvDq8ikWAM',
            sampleUrl: null,
            sex: 'female',
            voiceType: 'standard',
            language: 'en',
            accent: 'american',
            description: 'Professional female voice suitable for business calls'
          },
          {
            id: 'fallback-voice-2',
            name: 'daniel',
            displayName: 'Daniel - Professional Male',
            provider: 'elevenlabs',
            voiceModelId: 'onwK4e9ZLuTAKqWW03F9',
            sampleUrl: null,
            sex: 'male',
            voiceType: 'standard',
            language: 'en',
            accent: 'american',
            description: 'Professional male voice suitable for business calls'
          }
        ]);
      }

      const voices = await response.json();
      console.log(`[partner/vapi-voices] Successfully fetched ${voices.length || 0} voices from VAPI`);

      // Transform VAPI voice data to match our interface
      const transformedVoices = Array.isArray(voices) ? voices.map((voice: any) => ({
        id: voice.id,
        name: voice.name || voice.id,
        displayName: voice.name || voice.id,
        provider: voice.provider || 'vapi',
        voiceModelId: voice.voiceId || voice.id,
        sampleUrl: voice.sampleUrl || null,
        sex: voice.gender || 'unknown',
        voiceType: voice.type || 'standard',
        language: voice.language || 'en',
        accent: voice.accent || null,
        description: voice.description || null
      })) : [];

      return NextResponse.json(transformedVoices);

    } catch (fetchError: any) {
      console.error('[partner/vapi-voices] Error fetching from VAPI API:', fetchError);
      
      // Return fallback voices if VAPI API is unavailable
      return NextResponse.json([
        {
          id: 'fallback-voice-1',
          name: 'sarah',
          displayName: 'Sarah - Professional Female',
          provider: 'elevenlabs',
          voiceModelId: '21m00Tcm4TlvDq8ikWAM',
          sampleUrl: null,
          sex: 'female',
          voiceType: 'standard',
          language: 'en',
          accent: 'american',
          description: 'Professional female voice suitable for business calls'
        },
        {
          id: 'fallback-voice-2',
          name: 'daniel',
          displayName: 'Daniel - Professional Male',
          provider: 'elevenlabs',
          voiceModelId: 'onwK4e9ZLuTAKqWW03F9',
          sampleUrl: null,
          sex: 'male',
          voiceType: 'standard',
          language: 'en',
          accent: 'american',
          description: 'Professional male voice suitable for business calls'
        },
        {
          id: 'fallback-voice-3',
          name: 'emma',
          displayName: 'Emma - Friendly Female',
          provider: 'openai',
          voiceModelId: 'alloy',
          sampleUrl: null,
          sex: 'female',
          voiceType: 'neural',
          language: 'en',
          accent: 'american',
          description: 'Friendly and approachable female voice'
        },
        {
          id: 'fallback-voice-4',
          name: 'james',
          displayName: 'James - Confident Male',
          provider: 'openai',
          voiceModelId: 'echo',
          sampleUrl: null,
          sex: 'male',
          voiceType: 'neural',
          language: 'en',
          accent: 'american',
          description: 'Confident and clear male voice'
        }
      ]);
    }

  } catch (error: any) {
    console.error('[partner/vapi-voices] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch VAPI voices',
        message: error.message || 'An unexpected error occurred'
      },
      { status: 500 }
    );
  }
}
