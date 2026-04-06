/**
 * API endpoint for translating partner custom texts using AI
 * 
 * POST /api/partner/whitelabel/translate-texts
 * 
 * This endpoint:
 * 1. Validates partner authentication
 * 2. Extracts custom texts from partner data
 * 3. Uses Azure OpenAI to translate texts to all supported languages
 * 4. Deducts Knotie credits for the service
 * 5. Stores translations in the database
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { prisma } from '@/lib/prisma';
import { TranslationService, TranslatableTexts } from '@/lib/services/translationService';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Authenticate partner
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const partnerId = partner.id;

    // Get partner data with current custom texts
    const partnerData = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        id: true,
        businessName: true,
        portalTitle: true,
        portalSlogan: true,
        voiceAiAgentPricingNote: true,
        voiceAiAgentSpecialOffer: true,
        supportEmail: true,
        companyAddress: true,
        companyPhone: true,
        characterName: true,
        features: true,
        testimonials: true,
        faqs: true,
        trustIndicators: true,
        creditBalance: true
      }
    });

    if (!partnerData) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Check if partner has sufficient credits
    const translationCost = TranslationService.getTranslationCost();
    if (partnerData.creditBalance < translationCost) {
      return NextResponse.json(
        {
          error: 'Insufficient credits for translation service',
          required: translationCost,
          current: partnerData.creditBalance
        },
        { status: 402 }
      );
    }

    // Prepare texts for translation
    const textsToTranslate: TranslatableTexts = {
      portalTitle: partnerData.portalTitle || undefined,
      portalSlogan: partnerData.portalSlogan || undefined,
      voiceAiAgentPricingNote: partnerData.voiceAiAgentPricingNote || undefined,
      voiceAiAgentSpecialOffer: partnerData.voiceAiAgentSpecialOffer || undefined,
      supportEmail: partnerData.supportEmail || undefined,
      companyAddress: partnerData.companyAddress || undefined,
      companyPhone: partnerData.companyPhone || undefined,
      characterName: partnerData.characterName || undefined,
      features: partnerData.features || undefined,
      testimonials: partnerData.testimonials || undefined,
      faqs: partnerData.faqs || undefined,
      trustIndicators: partnerData.trustIndicators || undefined
    };

    // Filter out empty/null values
    const filteredTexts = Object.entries(textsToTranslate)
      .filter(([_, value]) => value && value.trim())
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {} as TranslatableTexts);

    if (Object.keys(filteredTexts).length === 0) {
      return NextResponse.json(
        { error: 'No custom texts found to translate' },
        { status: 400 }
      );
    }

    // Perform translation
    const translationResult = await TranslationService.translatePartnerTexts(
      partnerId,
      filteredTexts,
      partnerData.businessName
    );

    if (!translationResult.success) {
      return NextResponse.json(
        { error: translationResult.error },
        { status: 500 }
      );
    }

    // Store translations in database using proper Prisma update
    await prisma.partner.update({
      where: { id: partnerId },
      data: {
        translatedTexts: translationResult.translations as any, // Type assertion needed until Prisma client is fully regenerated
        translationEnabled: true,
        lastTranslationAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Texts translated successfully',
      creditsUsed: translationResult.creditsUsed,
      languagesTranslated: Object.keys(translationResult.translations || {}),
      translatedFields: Object.keys(filteredTexts)
    });

  } catch (error) {
    console.error('Translation API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
