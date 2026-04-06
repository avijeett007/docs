import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gender = searchParams.get('gender') || 'feminine'; // Default to feminine
    const limit = searchParams.get('limit') || '50';

    const cartesiaApiKey = process.env.CARTESIA_API_KEY;
    if (!cartesiaApiKey) {
      return NextResponse.json(
        { error: 'Cartesia API key not configured' },
        { status: 500 }
      );
    }

    // Build query parameters
    const queryParams = new URLSearchParams();
    if (gender && gender !== 'all') {
      const targetGender = gender === 'male' ? 'masculine' : gender === 'female' ? 'feminine' : 'gender_neutral';
      queryParams.append('gender', targetGender);
    }
    queryParams.append('limit', limit);

    // Call Cartesia API to list voices
    const response = await fetch(`https://api.cartesia.ai/voices?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cartesiaApiKey}`,
        'Cartesia-Version': '2025-04-16',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Cartesia API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to fetch voices from Cartesia' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Filter voices by gender if specified
    let voices = data.data || [];
    if (gender && gender !== 'all') {
      const targetGender = gender === 'male' ? 'masculine' : gender === 'female' ? 'feminine' : 'gender_neutral';
      voices = voices.filter((voice: any) => voice.gender === targetGender);
    }

    return NextResponse.json({
      success: true,
      voices: voices,
      total: voices.length
    });

  } catch (error) {
    console.error('Error fetching Cartesia voices:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
