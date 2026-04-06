import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyCustomerJWT } from '@/lib/customerJwt';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// All known app names for computing restricted list
const ALL_APP_NAMES = ['gmail', 'googlecalendar', 'gohighlevel', 'slack', 'shopify', 'notion', 'airtable', 'hubspot', 'salesforce', 'firecrawl', 'whatsapp'];

export async function GET(request: NextRequest) {
  try {
    console.log('[tier-access] Checking tier access...');

    const cookieStore = cookies();
    const token = cookieStore.get('customer_token')?.value;

    if (!token) {
      console.log('[tier-access] No customer token found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyCustomerJWT(token);
    if (!payload) {
      console.log('[tier-access] Invalid customer token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[tier-access] Customer authenticated:', {
      customerId: payload.customerId,
      partnerId: payload.partnerId
    });

    // Fetch customer record to get email
    const customer = await prisma.customer.findUnique({
      where: { id: payload.customerId },
      select: { email: true }
    });

    if (!customer) {
      console.log('[tier-access] Customer not found:', payload.customerId);
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Fetch customer's allowedApps from UserOnboarding
    const userOnboarding = await prisma.userOnboarding.findFirst({
      where: {
        email: customer.email,
        partnerId: payload.partnerId
      },
      select: {
        allowedApps: true,
        showIntegration: true
      }
    });

    // Parse allowedApps from JSON string
    let allowedApps: string[] = [];
    try {
      allowedApps = JSON.parse(userOnboarding?.allowedApps || '[]');
    } catch {
      allowedApps = [];
    }

    // If integration is not enabled or no apps selected, restrict everything
    if (!userOnboarding?.showIntegration || allowedApps.length === 0) {
      console.log('[tier-access] Integration disabled or no apps allowed');
      return NextResponse.json({
        success: true,
        isFreeForever: false,
        partnerTier: 'restricted',
        accessibleApps: [],
        restrictedApps: ALL_APP_NAMES,
        allowedApps: []
      });
    }

    // Compute restricted apps (everything not in allowedApps)
    const restrictedApps = ALL_APP_NAMES.filter(app => !allowedApps.includes(app));

    const response = {
      success: true,
      isFreeForever: false,
      partnerTier: 'custom',
      accessibleApps: allowedApps,
      restrictedApps,
      allowedApps
    };

    console.log('[tier-access] Response:', response);

    return NextResponse.json(response);
  } catch (error) {
    console.error('[tier-access] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
