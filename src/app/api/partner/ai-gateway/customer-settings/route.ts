import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/ai-gateway/customer-settings
 * Return the partner's customer self-service gateway configuration.
 */
export async function GET(request: NextRequest) {
  try {
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await prisma.partner.findUnique({
      where: { id: (partner as any).id },
      select: {
        customerGatewayEnabled: true,
        customerGatewayForNewCustomers: true,
        customerGatewayForExistingCustomers: true,
        gatewayProfitMultiplier: true,
        gatewayCreditToUsdCents: true,
      },
    });

    if (!data) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, settings: data });
  } catch (error) {
    logger.error('Error fetching gateway customer settings', error as Error, {
      operation: 'get_gateway_customer_settings',
    });
    return NextResponse.json(
      { error: 'Failed to fetch gateway customer settings' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/partner/ai-gateway/customer-settings
 * Update the partner's customer self-service gateway configuration.
 */
export async function PATCH(request: NextRequest) {
  try {
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      customerGatewayEnabled,
      customerGatewayForNewCustomers,
      customerGatewayForExistingCustomers,
      gatewayProfitMultiplier,
      gatewayCreditToUsdCents,
    } = body;

    // Build the update payload with only fields that were sent
    const updateData: Record<string, unknown> = {};

    if (customerGatewayEnabled !== undefined) {
      updateData.customerGatewayEnabled = Boolean(customerGatewayEnabled);
    }
    if (customerGatewayForNewCustomers !== undefined) {
      updateData.customerGatewayForNewCustomers = Boolean(customerGatewayForNewCustomers);
    }
    if (customerGatewayForExistingCustomers !== undefined) {
      updateData.customerGatewayForExistingCustomers = Boolean(customerGatewayForExistingCustomers);
    }
    if (gatewayProfitMultiplier !== undefined) {
      const val = parseFloat(gatewayProfitMultiplier);
      if (isNaN(val) || val < 1.0) {
        return NextResponse.json(
          { error: 'gatewayProfitMultiplier must be a number ≥ 1.0' },
          { status: 400 }
        );
      }
      updateData.gatewayProfitMultiplier = val;
    }
    if (gatewayCreditToUsdCents !== undefined) {
      const val = parseFloat(gatewayCreditToUsdCents);
      if (isNaN(val) || val <= 0) {
        return NextResponse.json(
          { error: 'gatewayCreditToUsdCents must be a positive number' },
          { status: 400 }
        );
      }
      updateData.gatewayCreditToUsdCents = val;
    }

    const updated = await prisma.partner.update({
      where: { id: (partner as any).id },
      data: updateData,
      select: {
        customerGatewayEnabled: true,
        customerGatewayForNewCustomers: true,
        customerGatewayForExistingCustomers: true,
        gatewayProfitMultiplier: true,
        gatewayCreditToUsdCents: true,
      },
    });

    logger.info('Gateway customer settings updated', {
      partnerId: (partner as any).id,
      operation: 'update_gateway_customer_settings',
    });

    return NextResponse.json({ success: true, settings: updated });
  } catch (error) {
    logger.error('Error updating gateway customer settings', error as Error, {
      operation: 'update_gateway_customer_settings',
    });
    return NextResponse.json(
      { error: 'Failed to update gateway customer settings' },
      { status: 500 }
    );
  }
}

