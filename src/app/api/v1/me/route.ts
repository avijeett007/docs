import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { withApiKeyAuthAndRateLimit } from '@/lib/auth/apiKeyAuth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/v1/me
 * Get information about the authenticated entity (partner or customer)
 * This is a simple example of an API endpoint that can be accessed using API keys
 */
export async function GET(request: NextRequest) {
  return withApiKeyAuthAndRateLimit(request, async (_, keyInfo) => {
    try {
      if (keyInfo.type === 'partner') {
        // Get partner information
        const partner = await prisma.partner.findUnique({
          where: { id: keyInfo.partnerId },
          select: {
            id: true,
            businessName: true,
            contactName: true,
            emailAddress: true,
            phoneNumber: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        if (!partner) {
          return NextResponse.json(
            { error: 'Partner not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          type: 'partner',
          data: partner,
        });
      } else if (keyInfo.type === 'customer') {
        // Get customer information
        const customer = await prisma.customer.findUnique({
          where: { id: keyInfo.customerId },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        if (!customer) {
          return NextResponse.json(
            { error: 'Customer not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          type: 'customer',
          data: customer,
        });
      }

      return NextResponse.json(
        { error: 'Invalid API key type' },
        { status: 400 }
      );
    } catch (error) {
      console.error('Error getting entity information:', error);
      return NextResponse.json(
        { error: 'Failed to get entity information' },
        { status: 500 }
      );
    }
  });
}
