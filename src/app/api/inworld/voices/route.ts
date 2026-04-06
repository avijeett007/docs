import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Helper function to check if a voice matches the target gender
 * Inworld voices have a tags array that may include 'male' or 'female'
 */
function voiceMatchesGender(voice: any, targetGender: string): boolean {
  const tags = voice.tags || [];
  // Check if any tag matches the target gender (case-insensitive)
  const hasGenderTag = tags.some((tag: string) =>
    tag.toLowerCase() === targetGender.toLowerCase()
  );

  // Also check description as fallback (some voices might not have gender tags)
  const description = (voice.description || '').toLowerCase();
  const hasGenderInDescription = description.includes(targetGender.toLowerCase() + ' voice') ||
    description.includes(targetGender.toLowerCase() + '-');

  return hasGenderTag || hasGenderInDescription;
}

/**
 * Extract gender from voice data
 */
function extractGenderFromVoice(voice: any): 'male' | 'female' | 'neutral' {
  const tags = voice.tags || [];
  const tagsLower = tags.map((t: string) => t.toLowerCase());

  if (tagsLower.includes('male')) return 'male';
  if (tagsLower.includes('female')) return 'female';

  // Fallback: check description
  const description = (voice.description || '').toLowerCase();
  if (description.includes('male voice') || description.includes('male,') || description.includes(' man ')) {
    return 'male';
  }
  if (description.includes('female voice') || description.includes('female,') || description.includes(' woman ')) {
    return 'female';
  }

  return 'neutral';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gender = searchParams.get('gender') || 'female'; // Default to female
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const inworldCredential = process.env.INWORLD_RUNTIME_BASE64_CREDENTIAL;
    if (!inworldCredential) {
      console.error('Inworld API credentials not configured - INWORLD_RUNTIME_BASE64_CREDENTIAL is missing');
      return NextResponse.json(
        { error: 'Inworld API credentials not configured', success: false },
        { status: 500 }
      );
    }

    console.log('🎙️ Fetching Inworld voices for gender:', gender);

    // Call Inworld API to list voices - filter by English language
    const response = await fetch('https://api.inworld.ai/tts/v1/voices?filter=language=en', {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${inworldCredential}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Inworld API error:', response.status, errorText);
      return NextResponse.json(
        { error: `Failed to fetch voices from Inworld: ${errorText}`, success: false },
        { status: response.status }
      );
    }

    const data = await response.json();
    const allVoices = data.voices || [];
    console.log('🎙️ Inworld voices response, total voices:', allVoices.length);

    // Log all voices with their tags for debugging gender filtering
    if (allVoices.length > 0) {
      console.log('🎙️ All Inworld voices with gender info:');
      allVoices.forEach((v: any) => {
        const detectedGender = extractGenderFromVoice(v);
        console.log(`   - ${v.voiceId}: tags=[${(v.tags || []).join(', ')}], detected=${detectedGender}`);
      });
    }

    // Filter voices by gender using tags
    // Inworld uses tags like 'male', 'female' in the tags array
    let voices = allVoices;

    if (gender && gender !== 'all') {
      const targetGender = gender.toLowerCase(); // 'male' or 'female'
      const filteredVoices = voices.filter((voice: any) => voiceMatchesGender(voice, targetGender));

      console.log(`🎙️ Filtered by gender '${targetGender}': ${filteredVoices.length} voices found out of ${allVoices.length}`);

      // Use filtered voices (even if empty - don't fall back to all voices)
      voices = filteredVoices;

      // Log which voices matched
      if (filteredVoices.length > 0) {
        console.log(`🎙️ Matched ${targetGender} voices:`, filteredVoices.map((v: any) => v.voiceId).join(', '));
      } else {
        console.warn(`🎙️ WARNING: No voices found matching gender '${targetGender}'. Available tags in voices:`,
          allVoices.map((v: any) => ({ id: v.voiceId, tags: v.tags }))
        );
      }
    }

    // Limit results
    voices = voices.slice(0, limit);

    // Transform to consistent format (similar to Cartesia)
    const transformedVoices = voices.map((voice: any) => ({
      id: voice.voiceId, // Use 'id' to match Cartesia format for frontend compatibility
      voiceId: voice.voiceId,
      name: voice.displayName,
      displayName: voice.displayName,
      description: voice.description,
      tags: voice.tags,
      languages: voice.languages,
      // Determine gender from tags and description for UI display
      gender: extractGenderFromVoice(voice)
    }));

    console.log(`🎙️ Returning ${transformedVoices.length} ${gender} voices for Inworld`);

    return NextResponse.json({
      success: true,
      voices: transformedVoices,
      total: transformedVoices.length,
      requestedGender: gender
    });

  } catch (error) {
    console.error('Error fetching Inworld voices:', error);
    return NextResponse.json(
      { error: 'Internal server error', success: false },
      { status: 500 }
    );
  }
}

