import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Get all headers for debugging
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Get the partner ID from the x-partner-id header (set by our middleware)
    const partnerId = request.headers.get('x-partner-id');
    const partnerType = request.headers.get('x-partner-type');
    const partnerSubdomain = request.headers.get('x-partner-subdomain');

    // Get the host from the request
    const host = request.headers.get('host');
    const url = request.url;

    let partner = null;
    if (partnerId) {
      // Look up the partner in the database
      partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: {
          id: true,
          businessName: true,
          subdomain: true,
          customDomain: true,
          customDomainVerified: true,
          customerPortalEnabled: true,
          logo: true,
          primaryColor: true,
          secondaryColor: true,
          portalTitle: true,
        }
      });
    }

    return NextResponse.json({
      headers,
      partnerId,
      partnerType,
      partnerSubdomain,
      host,
      url,
      partner
    });
  } catch (error) {
    console.error('Error checking partner:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
