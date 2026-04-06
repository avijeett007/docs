import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';

/**
 * API route to check if a customer is eligible for portal access
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { customerId: string } }
) {
  try {
    // Verify partner authentication and get whitelabel settings
    const partnerAuth = await verifyPartnerAuth(request);
    if (!partnerAuth) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get partner with whitelabel settings
    const partner = await prisma.partner.findUnique({
      where: { id: partnerAuth.id },
      select: {
        id: true,
        subdomain: true,
        customDomain: true,
        customDomainVerified: true,
        customerPortalEnabled: true
      }
    });

    if (!partner) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    const { customerId } = params;

    // Check if the user onboarding record exists for this partner
    const userOnboarding = await prisma.userOnboarding.findFirst({
      where: {
        id: customerId,
        partnerId: partner.id
      }
    });

    if (!userOnboarding) {
      return NextResponse.json(
        {
          eligible: false,
          error: 'Customer not found or not associated with this partner',
          hasPortalAccess: false
        }
      );
    }

    // Check if partner has completed whitelabel setup
    const hasSubdomain = partner.subdomain && partner.subdomain.trim() !== '';
    const hasVerifiedCustomDomain = partner.customDomain && partner.customDomainVerified;
    const hasPortalEnabled = partner.customerPortalEnabled;

    // Partner must have either subdomain OR verified custom domain, AND portal must be enabled
    const hasValidWhitelabelSetup = (hasSubdomain || hasVerifiedCustomDomain) && hasPortalEnabled;

    if (!hasValidWhitelabelSetup) {
      let errorMessage = 'Please complete your whitelabel portal setup first. ';

      if (!hasPortalEnabled) {
        errorMessage += 'Customer portal must be enabled in whitelabel settings. ';
      }

      if (!hasSubdomain && !hasVerifiedCustomDomain) {
        errorMessage += 'You need to configure either a subdomain or verify a custom domain. ';
      }

      errorMessage += 'Visit Partner Settings > Whitelabel to complete setup.';

      return NextResponse.json(
        {
          eligible: false,
          error: errorMessage,
          hasPortalAccess: false,
          whitelabelSetupRequired: true,
          whitelabelStatus: {
            hasSubdomain,
            hasVerifiedCustomDomain,
            hasPortalEnabled
          }
        }
      );
    }

    // Check if a Customer record exists for this user
    const customer = await prisma.customer.findFirst({
      where: {
        userId: userOnboarding.userId
      }
    });

    // Check if the customer already has portal credentials
    let credentials = null;
    if (customer) {
      credentials = await prisma.customerCredential.findFirst({
        where: {
          customerId: customer.id,
          partnerId: partner.id
        }
      });
    }

    return NextResponse.json({
      eligible: true,
      hasPortalAccess: !!credentials,
      customerPortalEnabled: customer?.customerPortalEnabled || userOnboarding.customerPortalEnabled || false,
      customerId: customer?.id || null, // Include the Customer ID for billing
      hasCustomerRecord: !!customer,
      hasCredentials: !!credentials
    });
  } catch (error: any) {
    console.error('Error checking portal eligibility:', error);
    return NextResponse.json(
      {
        eligible: false,
        error: error.message || 'Failed to check portal eligibility',
        hasPortalAccess: false
      },
      { status: 500 }
    );
  }
}
