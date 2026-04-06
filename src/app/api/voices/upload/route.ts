import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { uploadToR2 } from '@/lib/r2';
import { parseVoiceFileName, generateVoiceDisplayName, sanitizeFileName } from '@/utils/voiceUtils';

// POST /api/voices/upload - Upload a voice sample (protected, requires admin API key)
export async function POST(req: NextRequest) {
  try {
    const adminApiKey = req.headers.get('x-admin-api-key');
    if (adminApiKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const fileObj = file as File;

    // Extract optional metadata from form data
    const voiceModelId = formData.get('voiceModelId') as string | null;
    const languageCapabilities = formData.get('languageCapabilities') as string | null;
    const useCases = formData.get('useCases') as string | null;
    const language = formData.get('language') as string | null;

    // Parse language capabilities if provided (expect comma-separated string)
    let parsedLanguageCapabilities: string[] = [];
    if (languageCapabilities) {
      parsedLanguageCapabilities = languageCapabilities
        .split(',')
        .map(lang => {
          const trimmed = lang.trim().toLowerCase();
          // Convert common language names to codes
          const languageMap: Record<string, string> = {
            'spanish': 'es',
            'english': 'en',
            'arabic': 'ar',
            'hindi': 'hi',
            'italian': 'it',
            'german': 'de',
            'bengali': 'bn'
          };
          return languageMap[trimmed] || trimmed;
        })
        .filter(lang => lang.length > 0);
    }

    // Parse use cases if provided (expect comma-separated string)
    let parsedUseCases: string[] = [];
    if (useCases) {
      parsedUseCases = useCases
        .split(',')
        .map(useCase => useCase.trim().toLowerCase())
        .filter(useCase => useCase.length > 0);
    }

    // Validate language capabilities if provided
    const validLanguages = [
      'en', 'english',
      'es', 'spanish',
      'ar', 'arabic',
      'hi', 'hindi',
      'it', 'italian',
      'de', 'german',
      'bn', 'bengali',
      'multilingual'
    ];

    if (parsedLanguageCapabilities.length > 0) {
      const invalidLanguages = parsedLanguageCapabilities.filter(lang =>
        !validLanguages.includes(lang) && !lang.startsWith('multilingual')
      );

      if (invalidLanguages.length > 0) {
        return NextResponse.json(
          {
            error: `Invalid language capabilities: ${invalidLanguages.join(', ')}. Valid options: ${validLanguages.join(', ')}`
          },
          { status: 400 }
        );
      }
    }

    // Validate use cases if provided
    const validUseCases = [
      'customer_service', 'customer service',
      'sales', 'sales calls',
      'support', 'technical support',
      'marketing', 'marketing campaigns',
      'education', 'educational content',
      'entertainment', 'entertainment content',
      'healthcare', 'healthcare assistance',
      'finance', 'financial services',
      'real_estate', 'real estate',
      'hospitality', 'hospitality services',
      'retail', 'retail assistance',
      'automotive', 'automotive services',
      'insurance', 'insurance services',
      'legal', 'legal services',
      'travel', 'travel assistance',
      'food_service', 'food service',
      'appointment_booking', 'appointment booking',
      'lead_qualification', 'lead qualification',
      'survey_collection', 'survey collection',
      'general_inquiry', 'general inquiry',
      'multilingual_support', 'multilingual support'
    ];

    if (parsedUseCases.length > 0) {
      const invalidUseCases = parsedUseCases.filter(useCase =>
        !validUseCases.includes(useCase)
      );

      if (invalidUseCases.length > 0) {
        return NextResponse.json(
          {
            error: `Invalid use cases: ${invalidUseCases.join(', ')}. Valid options include: customer_service, sales, support, marketing, education, entertainment, healthcare, finance, real_estate, hospitality, retail, automotive, insurance, legal, travel, food_service, appointment_booking, lead_qualification, survey_collection, general_inquiry, multilingual_support`
          },
          { status: 400 }
        );
      }
    }

    // Parse voice information from filename
    const parsedInfo = parseVoiceFileName(fileObj.name);
    if (!parsedInfo) {
      return NextResponse.json(
        { error: 'Invalid filename format. Expected: provider-name-type-sex.extension or provider-name-language-type-sex.extension (e.g., azure-luna-neural-female.wav or cartesia-mila-spanish-female.wav)' },
        { status: 400 }
      );
    }

    // Generate a safe filename
    const safeFileName = sanitizeFileName(fileObj.name);

    // Upload to R2
    const buffer = Buffer.from(await fileObj.arrayBuffer());
    const bucket = process.env.VOICE_SAMPLES_BUCKET || 'voice-samples';
    const uploadResult = await uploadToR2({
      file: buffer,
      fileName: `voices/${safeFileName}`,
      mimeType: fileObj.type,
      userId: 'system', // Use 'system' for voice samples since they are global resources
      metadata: {
        provider: parsedInfo.provider,
        voiceType: parsedInfo.voiceType,
        sex: parsedInfo.sex
      },
      bucket // Pass the bucket to use for voice samples
    });

    if (!uploadResult.url) {
      return NextResponse.json(
        { error: 'Failed to upload voice sample' },
        { status: 500 }
      );
    }

    // Create voice record in database
    const voice = await prisma.voice.create({
      data: {
        name: parsedInfo.name,
        displayName: generateVoiceDisplayName(parsedInfo.name, parsedInfo.voiceType),
        sex: parsedInfo.sex,
        voiceType: parsedInfo.voiceType,
        provider: parsedInfo.provider,
        voiceModelId: voiceModelId || null, // Provider-specific voice ID
        sampleUrl: uploadResult.url,
        language: (() => {
          if (!language) return 'en';
          const normalizedLang = language.toLowerCase();
          // Convert common language names/formats to codes
          const languageMap: Record<string, string> = {
            'spanish': 'es',
            'spanish (mexico)': 'es',
            'english': 'en',
            'english (us)': 'en',
            'arabic': 'ar',
            'hindi': 'hi',
            'italian': 'it',
            'german': 'de',
            'bengali': 'bn'
          };
          return languageMap[normalizedLang] || normalizedLang;
        })(), // Convert language name to code
        languageCapabilities: parsedLanguageCapabilities.length > 0 ? parsedLanguageCapabilities : ['en'], // Default to English if not provided
        useCases: parsedUseCases.length > 0 ? parsedUseCases : [], // Use cases for this voice
        isActive: true, // Set voice as active by default
      } as any, // Temporary type assertion until Prisma client is updated
    });

    return NextResponse.json({
      success: true,
      voice,
      sampleUrl: uploadResult.url,
      message: `Voice uploaded successfully with ${parsedLanguageCapabilities.length > 0 ? parsedLanguageCapabilities.join(', ') : 'default English'} language capabilities`,
    });
  } catch (error) {
    console.error('Error uploading voice:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
