import { NextRequest, NextResponse } from 'next/server';
import {
  getCachedVoices,
  setCachedVoices,
  isApprovedVoice,
  type CachedVoice
} from '@/lib/retell-voices-config';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gender = searchParams.get('gender') || 'all'; // male, female, or all
    const limit = parseInt(searchParams.get('limit') || '10');

    // Check cache first
    const cachedVoices = getCachedVoices(gender as 'male' | 'female' | 'all');
    if (cachedVoices) {
      const limitedVoices = cachedVoices.slice(0, limit);
      return NextResponse.json({
        success: true,
        voices: limitedVoices,
        total: limitedVoices.length,
        cached: true
      });
    }

    const retellApiKey = process.env.SAAS_RETELL_API_KEY;
    if (!retellApiKey) {
      return NextResponse.json(
        { error: 'Retell API key not configured' },
        { status: 500 }
      );
    }

    // Call Retell API to list voices
    const response = await fetch('https://api.retellai.com/list-voices', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${retellApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Retell API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to fetch voices from Retell' },
        { status: response.status }
      );
    }

    const allVoices = await response.json();

    // Filter voices by approved list and gender
    let filteredVoices: CachedVoice[] = [];

    if (gender === 'all') {
      // Filter for both male and female approved voices
      filteredVoices = allVoices.filter((voice: any) => {
        const voiceGender = voice.gender.toLowerCase() as 'male' | 'female';
        return (voiceGender === 'male' || voiceGender === 'female') &&
               isApprovedVoice(voice.voice_name, voiceGender);
      });
    } else {
      // Filter for specific gender and approved voices
      filteredVoices = allVoices.filter((voice: any) =>
        voice.gender.toLowerCase() === gender.toLowerCase() &&
        isApprovedVoice(voice.voice_name, gender as 'male' | 'female')
      );
    }

    // Cache the filtered voices
    setCachedVoices(gender as 'male' | 'female' | 'all', filteredVoices);

    // Apply limit
    const limitedVoices = filteredVoices.slice(0, limit);

    return NextResponse.json({
      success: true,
      voices: limitedVoices,
      total: limitedVoices.length,
      cached: false
    });

  } catch (error) {
    console.error('Error fetching Retell voices:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
