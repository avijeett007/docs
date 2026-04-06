import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, voiceId, modelId = 'inworld-tts-1' } = body;

    // Validation
    if (!text || !voiceId) {
      return NextResponse.json(
        { error: 'Text and voiceId are required' },
        { status: 400 }
      );
    }

    // Inworld supports up to 2000 characters, but we'll limit to 500 for previews
    if (text.length > 500) {
      return NextResponse.json(
        { error: 'Text must be 500 characters or less for preview' },
        { status: 400 }
      );
    }

    const inworldCredential = process.env.INWORLD_RUNTIME_BASE64_CREDENTIAL;
    if (!inworldCredential) {
      console.error('Inworld API credentials not configured - INWORLD_RUNTIME_BASE64_CREDENTIAL is missing');
      return NextResponse.json(
        { error: 'Inworld API credentials not configured' },
        { status: 500 }
      );
    }

    // Prepare TTS request payload for Inworld
    // Use MP3 format for better browser compatibility
    const ttsPayload = {
      text: text,
      voiceId: voiceId,
      modelId: modelId, // 'inworld-tts-1' or 'inworld-tts-1-max'
      audioConfig: {
        audioEncoding: 'MP3', // MP3 for better browser compatibility
        sampleRateHertz: 22050,
        speakingRate: 1.0
      },
      temperature: 1.1 // Default recommended value
    };

    console.log('🎙️ Inworld TTS request:', { voiceId, textLength: text.length, modelId });

    // Call Inworld TTS API
    const response = await fetch('https://api.inworld.ai/tts/v1/voice', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${inworldCredential}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ttsPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Inworld TTS API error:', response.status, errorText);
      return NextResponse.json(
        { error: `Failed to generate speech from Inworld: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Inworld returns audioContent as base64 encoded audio
    if (!data.audioContent) {
      console.error('Inworld TTS: No audio content in response', data);
      return NextResponse.json(
        { error: 'No audio content received from Inworld' },
        { status: 500 }
      );
    }

    console.log('🎙️ Inworld TTS success, audio data length:', data.audioContent.length);

    return NextResponse.json({
      success: true,
      audioData: data.audioContent, // Already base64 encoded
      contentType: 'audio/mp3',
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

