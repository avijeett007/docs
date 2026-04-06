import { NextRequest, NextResponse } from 'next/server';

export async function GET(_request: NextRequest) {
  try {
    const apiKey = process.env.CARTESIA_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Cartesia API key not configured' },
        { status: 500 }
      );
    }

    const response = await fetch('https://api.cartesia.ai/voices/', {
      method: 'GET',
      headers: {
        'Cartesia-Version': '2025-04-16',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Cartesia API error:', response.status, response.statusText);
      return NextResponse.json(
        { error: 'Failed to fetch voices from Cartesia' },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Handle different possible response structures
    let voicesArray = data;
    if (data.voices) {
      voicesArray = data.voices;
    } else if (data.data) {
      voicesArray = data.data;
    } else if (!Array.isArray(data)) {
      console.error('Unexpected Cartesia API response structure:', data);
      voicesArray = [];
    }

    // Transform the response to match our expected format
    const voices = voicesArray.map((voice: any) => ({
      id: voice.id,
      name: voice.name,
      provider: 'cartesia',
      providerId: voice.id,
      description: voice.description || '',
      language: voice.language || 'unknown',
      gender: voice.gender || 'unknown',
      age: voice.age || 'unknown',
      accent: voice.accent || 'unknown',
    }));

    return NextResponse.json({
      success: true,
      data: voices,
    });
  } catch (error) {
    console.error('Error fetching Cartesia voices:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
