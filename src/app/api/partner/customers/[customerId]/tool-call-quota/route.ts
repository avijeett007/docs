/**
 * Tool Call Quota Management API
 * GET - Get customer's current quota usage and configuration
 * PUT - Update customer's quota tier
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { prisma } from '@/lib/prisma';
import { TOOL_CALL_QUOTA_TIERS, getQuotaTier, getUpgradeRecommendation } from '@/lib/toolCallQuotas';

interface RouteParams {
  params: {
    customerId: string;
  };
}

/**
 * GET /api/partner/customers/[customerId]/tool-call-quota
 * Get customer's current quota usage and configuration
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customerId } = params;

    console.log(`[Tool Call Quota GET] Fetching quota for customerId: ${customerId}, partnerId: ${partner.id}`);

    // Input validation
    if (!customerId || !customerId.match(/^[a-zA-Z0-9-_]+$/)) {
      return NextResponse.json({ error: 'Invalid customer ID format' }, { status: 400 });
    }

    // Helper function to check if string is UUID format
    const isUuid = (str: string): boolean => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      return uuidRegex.test(str);
    };

    // Determine search strategy based on ID format to prevent ambiguous matches
    const searchField = isUuid(customerId) ? 'id' : 'customerId';

    // Find customer through UserOnboarding relationship with explicit field matching
    const userOnboarding = await prisma.userOnboarding.findFirst({
      where: {
        [searchField]: customerId,
        partnerId: partner.id
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            toolCallQuotaEnabled: true,
            toolCallQuotaLimit: true,
            toolCallQuotaWindow: true,
            toolCallQuotaTier: true,
            toolCallQuotaStripeProductId: true,
            toolCallQuotaSubscriptionId: true,
            toolCallQuotaLastReset: true,
            toolCallQuotaUsedInWindow: true,
          },
        },
      },
    });

    if (!userOnboarding || !userOnboarding.customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const customer = userOnboarding.customer;

    console.log(`[Tool Call Quota GET] Found customer: ${customer.id}, tier: ${customer.toolCallQuotaTier}, limit: ${customer.toolCallQuotaLimit}`);

    // Get current usage from Connect Hub (if available)
    let currentUsage = customer.toolCallQuotaUsedInWindow || 0;
    let resetTime = Date.now() + customer.toolCallQuotaWindow;

    try {
      // Try to get real-time usage from Connect Hub
      const connectHubUrl = process.env.CONNECT_HUB_URL;
      if (connectHubUrl) {
        const response = await fetch(`${connectHubUrl}/api/quota/usage/${customerId}`, {
          headers: {
            'Authorization': `Bearer ${process.env.CONNECT_HUB_API_KEY}`,
          },
        });

        if (response.ok) {
          const usageData = await response.json();
          currentUsage = usageData.count || 0;
          resetTime = usageData.resetTime || resetTime;
        }
      }
    } catch (error) {
      console.warn('Failed to fetch real-time usage from Connect Hub:', error);
      // Continue with database values
    }

    // Calculate window reset time
    const now = Date.now();
    const windowStart = Math.floor(now / customer.toolCallQuotaWindow) * customer.toolCallQuotaWindow;
    const calculatedResetTime = windowStart + customer.toolCallQuotaWindow;

    const usage = {
      current: currentUsage,
      limit: customer.toolCallQuotaLimit,
      tier: customer.toolCallQuotaTier,
      resetTime: Math.max(resetTime, calculatedResetTime),
      windowMs: customer.toolCallQuotaWindow,
    };

    // Get upgrade recommendation
    const recommendation = getUpgradeRecommendation(
      customer.toolCallQuotaTier,
      currentUsage
    );

    return NextResponse.json({
      success: true,
      usage,
      recommendation: recommendation.shouldUpgrade ? recommendation : undefined,
      customer: {
        id: customer.id,
        name: `${customer.firstName} ${customer.lastName}`,
        quotaEnabled: customer.toolCallQuotaEnabled,
      },
    });
  } catch (error) {
    console.error('Error fetching tool call quota:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quota information' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/partner/customers/[customerId]/tool-call-quota
 * Update customer's quota tier
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customerId } = params;
    const body = await request.json();
    const { tier, enabled } = body;

    // Input validation
    if (!customerId || !customerId.match(/^[a-zA-Z0-9-_]+$/)) {
      return NextResponse.json({ error: 'Invalid customer ID format' }, { status: 400 });
    }

    console.log(`[Tool Call Quota PUT] Updating quota for customerId: ${customerId}, partnerId: ${partner.id}, tier: ${tier}, enabled: ${enabled}`);

    // Validate tier if provided
    const validTiers = Object.keys(TOOL_CALL_QUOTA_TIERS);
    if (tier && !validTiers.includes(tier)) {
      return NextResponse.json({
        error: 'Invalid quota tier',
        validTiers: validTiers
      }, { status: 400 });
    }

    // Helper function to check if string is UUID format
    const isUuid = (str: string): boolean => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      return uuidRegex.test(str);
    };

    // Determine search strategy based on ID format to prevent ambiguous matches
    const searchField = isUuid(customerId) ? 'id' : 'customerId';

    // Find customer through UserOnboarding relationship with explicit field matching
    const userOnboarding = await prisma.userOnboarding.findFirst({
      where: {
        [searchField]: customerId,
        partnerId: partner.id
      },
      include: {
        customer: true,
      },
    });

    if (!userOnboarding || !userOnboarding.customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const customer = userOnboarding.customer;

    console.log(`[Tool Call Quota PUT] Found customer: ${customer.id}, current tier: ${customer.toolCallQuotaTier}, current limit: ${customer.toolCallQuotaLimit}`);

    // Prepare update data
    const updateData: any = {};

    if (tier) {
      const quotaTier = getQuotaTier(tier);
      if (quotaTier) {
        updateData.toolCallQuotaTier = tier;
        updateData.toolCallQuotaLimit = quotaTier.limit;
        updateData.toolCallQuotaWindow = quotaTier.windowMs;
        updateData.toolCallQuotaLastReset = new Date();
        updateData.toolCallQuotaUsedInWindow = 0; // Reset usage when changing tier
      }
    }

    if (typeof enabled === 'boolean') {
      updateData.toolCallQuotaEnabled = enabled;
    }

    console.log(`[Tool Call Quota PUT] Update data:`, updateData);

    // Update customer
    const updatedCustomer = await prisma.customer.update({
      where: { id: customer.id }, // Use customer.id instead of customerId to ensure we're updating the right record
      data: updateData,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        toolCallQuotaEnabled: true,
        toolCallQuotaLimit: true,
        toolCallQuotaWindow: true,
        toolCallQuotaTier: true,
      },
    });

    console.log(`[Tool Call Quota PUT] Updated customer: ${updatedCustomer.id}, new tier: ${updatedCustomer.toolCallQuotaTier}, new limit: ${updatedCustomer.toolCallQuotaLimit}`);

    // Reset rate limit in Connect Hub
    try {
      const connectHubUrl = process.env.CONNECT_HUB_URL;
      if (connectHubUrl) {
        await fetch(`${connectHubUrl}/api/quota/reset/${customerId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.CONNECT_HUB_API_KEY}`,
          },
        });
      }
    } catch (error) {
      console.warn('Failed to reset rate limit in Connect Hub:', error);
      // Continue - this is not critical
    }

    return NextResponse.json({
      success: true,
      message: 'Quota configuration updated successfully',
      customer: {
        id: updatedCustomer.id,
        name: `${updatedCustomer.firstName} ${updatedCustomer.lastName}`,
        quotaEnabled: updatedCustomer.toolCallQuotaEnabled,
        quotaTier: updatedCustomer.toolCallQuotaTier,
        quotaLimit: updatedCustomer.toolCallQuotaLimit,
        quotaWindow: updatedCustomer.toolCallQuotaWindow,
      },
    });
  } catch (error) {
    console.error('Error updating tool call quota:', error);
    return NextResponse.json(
      { error: 'Failed to update quota configuration' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/partner/customers/[customerId]/tool-call-quota
 * Reset customer's quota usage (admin function)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customerId } = params;

    // Find customer through UserOnboarding relationship
    const userOnboarding = await prisma.userOnboarding.findFirst({
      where: {
        OR: [
          { id: customerId, partnerId: partner.id }, // customerId is UserOnboarding ID
          { customerId: customerId, partnerId: partner.id }, // customerId is actual Customer ID
        ],
      },
      include: {
        customer: true,
      },
    });

    if (!userOnboarding || !userOnboarding.customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const customer = userOnboarding.customer;

    // Reset usage in database
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        toolCallQuotaUsedInWindow: 0,
        toolCallQuotaLastReset: new Date(),
      },
    });

    // Reset rate limit in Connect Hub
    try {
      const connectHubUrl = process.env.CONNECT_HUB_URL;
      if (connectHubUrl) {
        await fetch(`${connectHubUrl}/api/quota/reset/${customerId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.CONNECT_HUB_API_KEY}`,
          },
        });
      }
    } catch (error) {
      console.warn('Failed to reset rate limit in Connect Hub:', error);
    }

    return NextResponse.json({
      success: true,
      message: 'Quota usage reset successfully',
    });
  } catch (error) {
    console.error('Error resetting tool call quota:', error);
    return NextResponse.json(
      { error: 'Failed to reset quota usage' },
      { status: 500 }
    );
  }
}
