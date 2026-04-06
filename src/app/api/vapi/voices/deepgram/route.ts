import { NextRequest, NextResponse } from 'next/server';

export async function GET(_request: NextRequest) {
  try {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Deepgram API key not configured' },
        { status: 500 }
      );
    }

    const response = await fetch('https://api.deepgram.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Deepgram API error:', response.status, response.statusText);
      return NextResponse.json(
        { error: 'Failed to fetch models from Deepgram' },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Deepgram returns models, not specifically TTS voices
    // Let's include all models that could be used for TTS
    const allModels = data.models || [];

    // For now, let's create some common Deepgram TTS voices
    // since the models API doesn't return TTS-specific voices
    const voices = [
      {
        id: 'aura-asteria-en',
        name: 'Aura Asteria (English)',
        provider: 'deepgram',
        providerId: 'aura-asteria-en',
        language: 'en',
        gender: 'female',
        description: 'Natural, conversational female voice'
      },
      {
        id: 'aura-luna-en',
        name: 'Aura Luna (English)',
        provider: 'deepgram',
        providerId: 'aura-luna-en',
        language: 'en',
        gender: 'female',
        description: 'Warm, friendly female voice'
      },
      {
        id: 'aura-stella-en',
        name: 'Aura Stella (English)',
        provider: 'deepgram',
        providerId: 'aura-stella-en',
        language: 'en',
        gender: 'female',
        description: 'Professional, clear female voice'
      },
      {
        id: 'aura-athena-en',
        name: 'Aura Athena (English)',
        provider: 'deepgram',
        providerId: 'aura-athena-en',
        language: 'en',
        gender: 'female',
        description: 'Confident, articulate female voice'
      },
      {
        id: 'aura-hera-en',
        name: 'Aura Hera (English)',
        provider: 'deepgram',
        providerId: 'aura-hera-en',
        language: 'en',
        gender: 'female',
        description: 'Mature, authoritative female voice'
      },
      {
        id: 'aura-orion-en',
        name: 'Aura Orion (English)',
        provider: 'deepgram',
        providerId: 'aura-orion-en',
        language: 'en',
        gender: 'male',
        description: 'Deep, resonant male voice'
      },
      {
        id: 'aura-arcas-en',
        name: 'Aura Arcas (English)',
        provider: 'deepgram',
        providerId: 'aura-arcas-en',
        language: 'en',
        gender: 'male',
        description: 'Friendly, approachable male voice'
      },
      {
        id: 'aura-perseus-en',
        name: 'Aura Perseus (English)',
        provider: 'deepgram',
        providerId: 'aura-perseus-en',
        language: 'en',
        gender: 'male',
        description: 'Professional, confident male voice'
      },
      {
        id: 'aura-angus-en',
        name: 'Aura Angus (English)',
        provider: 'deepgram',
        providerId: 'aura-angus-en',
        language: 'en',
        gender: 'male',
        description: 'Mature, distinguished male voice'
      }
    ];

    return NextResponse.json({
      success: true,
      data: voices,
    });
  } catch (error) {
    console.error('Error fetching Deepgram models:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
