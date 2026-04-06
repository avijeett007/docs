import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { partnerRateLimit } from '@/lib/rateLimit';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/customers/[customerId]/credit-check-token
 * Retrieve existing credit check token info for the customer
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { customerId: string } }
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

    const { customerId } = params;

    // Verify the customer belongs to this partner
    const userOnboarding = await prisma.userOnboarding.findFirst({
      where: { id: customerId, partnerId: partner.id },
    });
    if (!userOnboarding) {
      return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
    }

    const tokenRecord = await prisma.customerCreditCheckToken.findUnique({
      where: { customerId },
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
    console.error('[CREDIT-CHECK-TOKEN] GET error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/partner/customers/[customerId]/credit-check-token
 * Generate (or regenerate) the credit check API key for a customer
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { customerId: string } }
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

    const { customerId } = params;

    // Verify the customer belongs to this partner
    const userOnboarding = await prisma.userOnboarding.findFirst({
      where: { id: customerId, partnerId: partner.id },
    });
    if (!userOnboarding) {
      return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
    }

    // Call ConnectHub to generate the API key (same pattern as MCP tokens)
    const connectHubUrl = process.env.CONNECT_HUB_URL;
    if (!connectHubUrl) {
      return NextResponse.json(
        { success: false, error: 'ConnectHub not configured' },
        { status: 500 }
      );
    }

    const connectHubResponse = await fetch(`${connectHubUrl}/api/tokens/credit-check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CONNECT_HUB_API_KEY || ''}`
      },
      body: JSON.stringify({ partnerId: partner.id, customerId })
    });

    if (!connectHubResponse.ok) {
      const errData = await connectHubResponse.json().catch(() => ({ error: 'Unknown error' }));
      return NextResponse.json(
        { success: false, error: errData.error || 'Failed to generate credit check key via ConnectHub' },
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

    // Fetch the stored record so we can return its id
    const tokenRecord = await prisma.customerCreditCheckToken.findUnique({
      where: { customerId }
    });

    return NextResponse.json({
      success: true,
      data: {
        id: tokenRecord?.id,
        apiKey: tokenData.apiKey,  // Raw key — shown only once
        apiKeyPrefix: tokenData.apiKeyPrefix,
        isActive: tokenData.isActive,
        partnerId: partner.id,
        createdAt: tokenData.createdAt,
      },
    });
  } catch (error) {
    console.error('[CREDIT-CHECK-TOKEN] POST error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/partner/customers/[customerId]/credit-check-token
 * Deactivate (revoke) the credit check token for a customer
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { customerId: string } }
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

    const { customerId } = params;

    const tokenRecord = await prisma.customerCreditCheckToken.findFirst({
      where: { customerId, partnerId: partner.id },
    });

    if (!tokenRecord) {
      return NextResponse.json({ success: false, error: 'Token not found' }, { status: 404 });
    }

    await prisma.customerCreditCheckToken.update({
      where: { customerId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true, message: 'Token revoked successfully' });
  } catch (error) {
    console.error('[CREDIT-CHECK-TOKEN] DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

