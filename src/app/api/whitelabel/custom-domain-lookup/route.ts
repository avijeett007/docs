import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';

/**
 * API endpoint to look up a partner by custom domain
 * This is used by the middleware to handle requests to custom.knotie-ai.pro
 */
export async function GET(request: NextRequest) {
  try {
    // Get the original domain from the request headers
    const originalDomain = request.headers.get('x-original-domain') || 
                          request.headers.get('cf-connecting-domain') || '';
    
    if (!originalDomain) {
      return NextResponse.json({ error: 'No domain provided' }, { status: 400 });
    }
    
    console.log(`Looking up partner for custom domain: ${originalDomain}`);
    
    // Find the partner by custom domain
    // Fix 2: Use case-insensitive lookup for existing data compatibility
    const partner = await prisma.partner.findFirst({
      where: {
        customDomain: { equals: originalDomain, mode: 'insensitive' },
        customDomainVerified: true,
        customerPortalEnabled: true
      },
      select: {
        id: true,
        businessName: true,
        subdomain: true,
        logo: true,
        primaryColor: true,
        secondaryColor: true,
        fontFamily: true,
        portalTitle: true,
        portalSlogan: true,
        themePreference: true,
        customerPortalEnabled: true
      }
    });
    
    if (!partner) {
      console.log(`No partner found for custom domain: ${originalDomain}`);
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }
    
    console.log(`Found partner for custom domain ${originalDomain}: ${partner.id} (${partner.businessName})`);
    
    // Return the partner information
    return NextResponse.json({
      success: true,
      partner: {
        id: partner.id,
        businessName: partner.businessName,
        subdomain: partner.subdomain,
        logo: partner.logo,
        primaryColor: partner.primaryColor,
        secondaryColor: partner.secondaryColor,
        fontFamily: partner.fontFamily,
        portalTitle: partner.portalTitle,
        portalSlogan: partner.portalSlogan,
        themePreference: partner.themePreference,
        customerPortalEnabled: partner.customerPortalEnabled
      }
    });
  } catch (error) {
    console.error('Error looking up partner by custom domain:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
