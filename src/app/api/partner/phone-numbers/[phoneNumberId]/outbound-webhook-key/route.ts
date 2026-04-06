import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { partnerRateLimit } from '@/lib/rateLimit';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/phone-numbers/[phoneNumberId]/outbound-webhook-key
 * Retrieve existing outbound webhook token info for the phone number
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { phoneNumberId: string } }
) {
  try {
    const rateLimitResult = partnerRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json({ success: false, error: 'Rate limit exceeded' }, { status: 429 });
    }

    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { phoneNumberId } = params;

    // Verify the phone number belongs to this partner
    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: { id: phoneNumberId, partnerId: partner.id },
    });
    if (!phoneNumber) {
      return NextResponse.json({ success: false, error: 'Phone number not found' }, { status: 404 });
    }

    const tokenRecord = await prisma.outboundWebhookToken.findUnique({
      where: { phoneNumberId },
    });

    if (!tokenRecord) {
      return NextResponse.json({ success: true, data: null });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: tokenRecord.id,
        apiKeyPrefix: tokenRecord.apiKeyPrefix,
        isActive: tokenRecord.isActive,
        partnerId: tokenRecord.partnerId,
        createdAt: tokenRecord.createdAt,
        updatedAt: tokenRecord.updatedAt,
      },
    });
  } catch (error) {
    logger.error('[OUTBOUND-WEBHOOK-KEY] GET error', error instanceof Error ? error : new Error(String(error)), { operation: 'outbound_webhook_key' });
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/partner/phone-numbers/[phoneNumberId]/outbound-webhook-key
 * Generate (or regenerate) the outbound webhook API key for a phone number
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { phoneNumberId: string } }
) {
  try {
    const rateLimitResult = partnerRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json({ success: false, error: 'Rate limit exceeded' }, { status: 429 });
    }

    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { phoneNumberId } = params;

    // Verify the phone number belongs to this partner and has an outbound agent assigned
    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: { id: phoneNumberId, partnerId: partner.id },
      include: {
        agentMappings: {
          where: { outboundEnabled: true, status: 'active' },
          take: 1,
        },
      },
    });
    if (!phoneNumber) {
      return NextResponse.json({ success: false, error: 'Phone number not found' }, { status: 404 });
    }

    if (!phoneNumber.agentMappings || phoneNumber.agentMappings.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No outbound agent assigned to this phone number. Assign an outbound agent first.' },
        { status: 400 }
      );
    }

    // Call ConnectHub to generate the API key
    const connectHubUrl = process.env.CONNECT_HUB_URL;
    if (!connectHubUrl) {
      return NextResponse.json(
        { success: false, error: 'ConnectHub not configured' },
        { status: 500 }
      );
    }

    const connectHubResponse = await fetch(`${connectHubUrl}/api/tokens/outbound-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CONNECT_HUB_API_KEY || ''}`
      },
      body: JSON.stringify({ partnerId: partner.id, phoneNumberId })
    });

    if (!connectHubResponse.ok) {
      const errData = await connectHubResponse.json().catch(() => ({ error: 'Unknown error' }));
      return NextResponse.json(
        { success: false, error: errData.error || 'Failed to generate webhook key via ConnectHub' },
        { status: 500 }
      );
    }

    const tokenData = await connectHubResponse.json();

    if (!tokenData.success || !tokenData.apiKey) {
      return NextResponse.json(
        { success: false, error: 'Invalid response from ConnectHub' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        apiKey: tokenData.apiKey,  // Raw key — shown only once
        apiKeyPrefix: tokenData.apiKeyPrefix,
        isActive: tokenData.isActive,
        partnerId: partner.id,
        phoneNumberId,
        createdAt: tokenData.createdAt,
      },
    });
  } catch (error) {
    logger.error('[OUTBOUND-WEBHOOK-KEY] POST error', error instanceof Error ? error : new Error(String(error)), { operation: 'outbound_webhook_key' });
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/partner/phone-numbers/[phoneNumberId]/outbound-webhook-key
 * Deactivate (revoke) the outbound webhook key for a phone number
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { phoneNumberId: string } }
) {
  try {
    const rateLimitResult = partnerRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json({ success: false, error: 'Rate limit exceeded' }, { status: 429 });
    }

    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { phoneNumberId } = params;

    // Verify the phone number belongs to this partner
    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: { id: phoneNumberId, partnerId: partner.id },
    });
    if (!phoneNumber) {
      return NextResponse.json({ success: false, error: 'Phone number not found' }, { status: 404 });
    }

    // Call ConnectHub to revoke the key
    const connectHubUrl = process.env.CONNECT_HUB_URL;
    if (!connectHubUrl) {
      return NextResponse.json(
        { success: false, error: 'ConnectHub not configured' },
        { status: 500 }
      );
    }

    const connectHubResponse = await fetch(`${connectHubUrl}/api/tokens/outbound-webhook`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CONNECT_HUB_API_KEY || ''}`
      },
      body: JSON.stringify({ partnerId: partner.id, phoneNumberId })
    });

    if (!connectHubResponse.ok) {
      const errData = await connectHubResponse.json().catch(() => ({ error: 'Unknown error' }));
      // If token not found, that's fine — it's already gone
      if (connectHubResponse.status === 404) {
        return NextResponse.json({ success: true, message: 'Webhook key already revoked or not found' });
      }
      return NextResponse.json(
        { success: false, error: errData.error || 'Failed to revoke webhook key via ConnectHub' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'Webhook key revoked successfully' });
  } catch (error) {
    logger.error('[OUTBOUND-WEBHOOK-KEY] DELETE error', error instanceof Error ? error : new Error(String(error)), { operation: 'outbound_webhook_key' });
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

