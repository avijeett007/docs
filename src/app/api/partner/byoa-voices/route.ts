import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getPartnerTier, isEnterpriseTier } from '@/lib/portalModes';
import { DomainCacheInvalidationService } from '@/lib/domain-cache-invalidation';

export const dynamic = 'force-dynamic';

const MAX_BYOA_VOICES = 5;

// GET - List partner's saved BYOA voices
export async function GET(req: NextRequest) {
  try {
    const authResult = await verifyPartnerToken(req);
    if (authResult.error) {
      return authResult.error;
    }

    const partnerId = authResult.partner!.id;
    const partner = authResult.partner!;

    // Verify partner is enterprise tier
    const partnerTier = getPartnerTier(partner.planId, partner.approvalStatus);
    if (!isEnterpriseTier(partnerTier)) {
      return NextResponse.json(
        { error: 'BYOA voices are only available for Enterprise tier partners' },
        { status: 403 }
      );
    }

    // Get partner's saved BYOA voices
    const voices = await prisma.partnerBYOAVoice.findMany({
      where: {
        partnerId,
        isActive: true,
      },
      orderBy: {
        displayOrder: 'asc',
      },
    });

    return NextResponse.json({
      success: true,
      voices,
      count: voices.length,
      maxVoices: MAX_BYOA_VOICES,
    });
  } catch (error) {
    console.error('[byoa-voices] Error fetching voices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch BYOA voices' },
      { status: 500 }
    );
  }
}

// POST - Add a new BYOA voice
export async function POST(req: NextRequest) {
  try {
    const authResult = await verifyPartnerToken(req);
    if (authResult.error) {
      return authResult.error;
    }

    const partnerId = authResult.partner!.id;
    const partner = authResult.partner!;

    // Verify partner is enterprise tier
    const partnerTier = getPartnerTier(partner.planId, partner.approvalStatus);
    if (!isEnterpriseTier(partnerTier)) {
      return NextResponse.json(
        { error: 'BYOA voices are only available for Enterprise tier partners' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { voiceId, provider, voiceName, gender, language, accent, previewUrl, sampleText, metadata } = body;

    if (!voiceId || !provider || !voiceName) {
      return NextResponse.json(
        { error: 'voiceId, provider, and voiceName are required' },
        { status: 400 }
      );
    }

    // Check current voice count
    const currentCount = await prisma.partnerBYOAVoice.count({
      where: { partnerId, isActive: true },
    });

    if (currentCount >= MAX_BYOA_VOICES) {
      return NextResponse.json(
        { error: `Maximum of ${MAX_BYOA_VOICES} voices allowed. Please remove a voice first.` },
        { status: 400 }
      );
    }

    // Check if voice already exists for this partner
    const existingVoice = await prisma.partnerBYOAVoice.findUnique({
      where: { partnerId_voiceId: { partnerId, voiceId } },
    });

    if (existingVoice) {
      // Reactivate if was deactivated
      if (!existingVoice.isActive) {
        const updated = await prisma.partnerBYOAVoice.update({
          where: { id: existingVoice.id },
          data: { isActive: true, displayOrder: currentCount },
        });

        // Invalidate domain cache so branding API returns updated voices
        await DomainCacheInvalidationService.invalidatePartner(partnerId);
        console.log('[byoa-voices] Cache invalidated after reactivating voice for partner:', partnerId);

        return NextResponse.json({ success: true, voice: updated });
      }
      return NextResponse.json(
        { error: 'Voice already exists' },
        { status: 400 }
      );
    }

    // Create new voice
    const voice = await prisma.partnerBYOAVoice.create({
      data: {
        partnerId,
        voiceId,
        provider,
        voiceName,
        gender: gender || null,
        language: language || null,
        accent: accent || null,
        previewUrl: previewUrl || null,
        sampleText: sampleText || null,
        metadata: metadata || null,
        displayOrder: currentCount,
        isActive: true,
      },
    });

    // Invalidate domain cache so branding API returns updated voices
    await DomainCacheInvalidationService.invalidatePartner(partnerId);
    console.log('[byoa-voices] Cache invalidated after adding voice for partner:', partnerId);

    return NextResponse.json({ success: true, voice });
  } catch (error) {
    console.error('[byoa-voices] Error adding voice:', error);
    return NextResponse.json(
      { error: 'Failed to add BYOA voice' },
      { status: 500 }
    );
  }
}

// DELETE - Remove a BYOA voice
export async function DELETE(req: NextRequest) {
  try {
    const authResult = await verifyPartnerToken(req);
    if (authResult.error) {
      return authResult.error;
    }

    const partnerId = authResult.partner!.id;
    const partner = authResult.partner!;

    // Verify partner is enterprise tier
    const partnerTier = getPartnerTier(partner.planId, partner.approvalStatus);
    if (!isEnterpriseTier(partnerTier)) {
      return NextResponse.json(
        { error: 'BYOA voices are only available for Enterprise tier partners' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const voiceId = searchParams.get('voiceId');

    if (!voiceId) {
      return NextResponse.json(
        { error: 'voiceId is required' },
        { status: 400 }
      );
    }

    // Find and deactivate the voice
    const voice = await prisma.partnerBYOAVoice.findFirst({
      where: { partnerId, voiceId, isActive: true },
    });

    if (!voice) {
      return NextResponse.json(
        { error: 'Voice not found' },
        { status: 404 }
      );
    }

    // Soft delete by marking as inactive
    await prisma.partnerBYOAVoice.update({
      where: { id: voice.id },
      data: { isActive: false },
    });

    // Reorder remaining voices
    const remainingVoices = await prisma.partnerBYOAVoice.findMany({
      where: { partnerId, isActive: true },
      orderBy: { displayOrder: 'asc' },
    });

    for (let i = 0; i < remainingVoices.length; i++) {
      if (remainingVoices[i].displayOrder !== i) {
        await prisma.partnerBYOAVoice.update({
          where: { id: remainingVoices[i].id },
          data: { displayOrder: i },
        });
      }
    }

    // Invalidate domain cache so branding API returns updated voices
    await DomainCacheInvalidationService.invalidatePartner(partnerId);
    console.log('[byoa-voices] Cache invalidated after removing voice for partner:', partnerId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[byoa-voices] Error removing voice:', error);
    return NextResponse.json(
      { error: 'Failed to remove BYOA voice' },
      { status: 500 }
    );
  }
}

