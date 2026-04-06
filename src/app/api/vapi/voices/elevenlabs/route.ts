import { NextRequest, NextResponse } from 'next/server';

export async function GET(_request: NextRequest) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 500 }
      );
    }

    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('ElevenLabs API error:', response.status, response.statusText);
      return NextResponse.json(
        { error: 'Failed to fetch voices from ElevenLabs' },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Transform the response to match our expected format
    const voices = data.voices?.map((voice: any) => ({
      id: voice.voice_id,
      name: voice.name,
      provider: 'elevenlabs',
      providerId: voice.voice_id,
      gender: voice.labels?.gender || 'unknown',
      language: voice.labels?.language || 'unknown',
      description: voice.description || '',
      previewUrl: voice.preview_url || null,
      category: voice.category || 'general',
    })) || [];

    return NextResponse.json({
      success: true,
      data: voices,
    });
  } catch (error) {
    console.error('Error fetching ElevenLabs voices:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
