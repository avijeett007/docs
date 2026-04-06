import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, voiceId, modelId = 'sonic-3' } = body;

    // Validation
    if (!text || !voiceId) {
      return NextResponse.json(
        { error: 'Text and voiceId are required' },
        { status: 400 }
      );
    }

    // Limit text length to 160 characters
    if (text.length > 160) {
      return NextResponse.json(
        { error: 'Text must be 160 characters or less' },
        { status: 400 }
      );
    }

    const cartesiaApiKey = process.env.CARTESIA_API_KEY;
    if (!cartesiaApiKey) {
      return NextResponse.json(
        { error: 'Cartesia API key not configured' },
        { status: 500 }
      );
    }

    // Prepare TTS request payload
    const ttsPayload = {
      model_id: modelId,
      transcript: text,
      voice: {
        mode: 'id',
        id: voiceId
      },
      language: 'en',
      output_format: {
        container: 'wav',
        encoding: 'pcm_s16le',
        sample_rate: 22050
      },
      generation_config: {
        volume: 1.0,
        speed: 1.0,
        emotion: 'neutral'
      }
    };

    // Call Cartesia TTS API
    const response = await fetch('https://api.cartesia.ai/tts/bytes', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cartesiaApiKey}`,
        'Cartesia-Version': '2025-04-16',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ttsPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Cartesia TTS API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to generate speech from Cartesia' },
        { status: response.status }
      );
    }

    // Get the audio data as buffer
    const audioBuffer = await response.arrayBuffer();
    
    // Convert to base64 for JSON response
    const base64Audio = Buffer.from(audioBuffer).toString('base64');

    return NextResponse.json({
      success: true,
      audioData: base64Audio,
      contentType: 'audio/wav',
      text: text,
      voiceId: voiceId
    });

  } catch (error) {
    console.error('Error generating TTS:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
