import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Get partner settings including API keys
export async function GET(request: NextRequest) {
  try {
    console.log('[partner/settings] API endpoint called');

    // Verify JWT and get partner
    const auth = await verifyPartnerJWT(request);
    if (!auth.isValid) {
      console.log('[partner/settings] Authentication failed');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partnerId = auth.payload?.partnerId;
    if (!partnerId) {
      console.log('[partner/settings] No partner ID in token');
      return NextResponse.json(
        { error: 'Invalid partner ID' },
        { status: 401 }
      );
    }

    console.log('[partner/settings] Fetching partner data for ID:', partnerId);

    // Get partner data
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        id: true,
        businessName: true,
        emailAddress: true,
        retellApiKey: true,
        vapiApiKey: true,
        subscriptionStatus: true,
        approvalStatus: true
      }
    });

    if (!partner) {
      console.log('[partner/settings] Partner not found');
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    console.log('[partner/settings] Partner found:', {
      id: partner.id,
      hasRetellApiKey: !!partner.retellApiKey,
      hasVapiApiKey: !!partner.vapiApiKey
    });

    // Decrypt API keys if they exist
    let decryptedRetellApiKey = null;
    let decryptedVapiApiKey = null;

    try {
      if (partner.retellApiKey) {
        decryptedRetellApiKey = await decrypt(partner.retellApiKey);
      }
    } catch (error) {
      console.error('Error decrypting Retell API key:', error);
    }

    try {
      if (partner.vapiApiKey) {
        decryptedVapiApiKey = await decrypt(partner.vapiApiKey);
      }
    } catch (error) {
      console.error('Error decrypting VAPI API key:', error);
    }

    return NextResponse.json({
      success: true,
      partner: {
        id: partner.id,
        businessName: partner.businessName,
        emailAddress: partner.emailAddress,
        subscriptionStatus: partner.subscriptionStatus,
        approvalStatus: partner.approvalStatus,
        hasRetellApiKey: !!partner.retellApiKey,
        hasVapiApiKey: !!partner.vapiApiKey
      },
      // Only return decrypted API keys for form pre-population
      retellApiKey: decryptedRetellApiKey,
      vapiApiKey: decryptedVapiApiKey
    });

  } catch (error) {
    console.error('Error getting partner settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


// Schema for PATCH updates
const partnerSettingsUpdateSchema = z.object({
  enableAiAnalytics: z.boolean().optional(),
});

// Update partner settings
export async function PATCH(request: NextRequest) {
  try {
    // Verify JWT and get partner
    const auth = await verifyPartnerJWT(request);
    if (!auth.isValid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partnerId = auth.payload?.partnerId;
    if (!partnerId) {
      return NextResponse.json(
        { error: 'Invalid partner ID' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = partnerSettingsUpdateSchema.parse(body);

    // Only update fields that were provided
    const updateData: Record<string, unknown> = {};
    if (validatedData.enableAiAnalytics !== undefined) {
      updateData.enableAiAnalytics = validatedData.enableAiAnalytics;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const updatedPartner = await prisma.partner.update({
      where: { id: partnerId },
      data: updateData,
      select: {
        id: true,
        enableAiAnalytics: true,
      },
    });

    return NextResponse.json({
      success: true,
      partner: updatedPartner,
    });

  } catch (error) {
    console.error('Error updating partner settings:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Validation error',
        details: error.errors,
      }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}