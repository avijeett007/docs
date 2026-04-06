import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyCustomerJWT } from '@/lib/customerJwt';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const CONNECT_HUB_URL = process.env.CONNECT_HUB_URL || 'http://localhost:3001';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

const calendarConfigSchema = z.object({
  locationId: z.string().min(1),
  calendarId: z.string().min(1),
  calendarName: z.string().min(1),
  isDefault: z.boolean().optional(),
  settings: z.record(z.any()).optional(),
});

/**
 * Get GHL calendars for a location
 * GET /api/whitelabel/integrations/ghl/calendars?locationId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[whitelabel/integrations/ghl/calendars] Starting calendars fetch');

    // Get the customer token from cookies
    const cookieStore = cookies();
    const token = cookieStore.get('customer_token')?.value;

    if (!token) {
      console.log('[whitelabel/integrations/ghl/calendars] No customer token found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the JWT token
    const payload = await verifyCustomerJWT(token);
    if (!payload) {
      console.log('[whitelabel/integrations/ghl/calendars] Invalid customer token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[whitelabel/integrations/ghl/calendars] Customer authenticated:', {
      customerId: payload.customerId,
      partnerId: payload.partnerId
    });

    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get('locationId');

    if (!locationId) {
      return NextResponse.json(
        { error: 'locationId is required' },
        { status: 400 }
      );
    }

    // Get customer from database to verify they exist
    const customer = await prisma.customer.findUnique({
      where: { id: payload.customerId },
    });

    if (!customer) {
      console.log('[whitelabel/integrations/ghl/calendars] Customer not found');
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Call Connect Hub to get calendars (use correct endpoint)
    const calendarsUrl = new URL(`${CONNECT_HUB_URL}/calendars/provider`);
    calendarsUrl.searchParams.set('tenantId', customer.id);
    calendarsUrl.searchParams.set('partnerId', payload.partnerId);
    calendarsUrl.searchParams.set('provider', 'ghl');
    calendarsUrl.searchParams.set('resourceId', locationId);

    console.log('[whitelabel/integrations/ghl/calendars] Calling Connect Hub:', calendarsUrl.toString());

    const response = await fetch(calendarsUrl.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[whitelabel/integrations/ghl/calendars] Connect Hub calendars error:', errorText);
      return NextResponse.json(
        { error: 'Failed to fetch calendars' },
        { status: 500 }
      );
    }

    const calendarsData = await response.json();
    console.log('[whitelabel/integrations/ghl/calendars] Calendars response:', JSON.stringify(calendarsData, null, 2));

    // Also get configured calendars to show which ones are already set up
    const configuredResponse = await fetch(
      `${CONNECT_HUB_URL}/calendars/configured?tenantId=${customer.id}&partnerId=${payload.partnerId}&provider=ghl`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    let configuredCalendars = [];
    if (configuredResponse.ok) {
      const configuredData = await configuredResponse.json();
      configuredCalendars = configuredData.data?.configurations || [];
      console.log('[whitelabel/integrations/ghl/calendars] Configured calendars:', JSON.stringify(configuredData, null, 2));
    } else {
      console.log('[whitelabel/integrations/ghl/calendars] Failed to fetch configured calendars:', configuredResponse.status);
    }

    console.log('[whitelabel/integrations/ghl/calendars] Calendars fetched successfully');
    console.log('[whitelabel/integrations/ghl/calendars] Final response:', {
      calendarsCount: (calendarsData.data?.calendars || []).length,
      configuredCount: configuredCalendars.length,
    });

    return NextResponse.json({
      success: true,
      calendars: calendarsData.data?.calendars || [],
      configured: configuredCalendars,
    });

  } catch (error) {
    console.error('[whitelabel/integrations/ghl/calendars] Calendars fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Configure a GHL calendar
 * POST /api/whitelabel/integrations/ghl/calendars
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[whitelabel/integrations/ghl/calendars] Starting calendar configuration');

    // Get the customer token from cookies
    const cookieStore = cookies();
    const token = cookieStore.get('customer_token')?.value;

    if (!token) {
      console.log('[whitelabel/integrations/ghl/calendars] No customer token found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the JWT token
    const payload = await verifyCustomerJWT(token);
    if (!payload) {
      console.log('[whitelabel/integrations/ghl/calendars] Invalid customer token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = calendarConfigSchema.parse(body);

    console.log('[whitelabel/integrations/ghl/calendars] Calendar configuration data:', validatedData);

    // Get customer from database
    const customer = await prisma.customer.findUnique({
      where: { id: payload.customerId },
    });

    if (!customer) {
      console.log('[whitelabel/integrations/ghl/calendars] Customer not found');
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Prepare Connect Hub request payload
    const connectHubPayload = {
      tenantId: customer.id,
      partnerId: payload.partnerId,
      provider: 'ghl',
      resourceId: validatedData.locationId,
      calendarId: validatedData.calendarId,
      calendarName: validatedData.calendarName,
      calendarType: validatedData.settings?.calendarType,
      timezone: validatedData.settings?.timezone,
      isDefault: validatedData.isDefault,
      isActive: true,
      settings: validatedData.settings,
    };

    console.log('[whitelabel/integrations/ghl/calendars] Connect Hub payload:', connectHubPayload);

    // Call Connect Hub to configure calendar
    const configResponse = await fetch(`${CONNECT_HUB_URL}/calendars/configure`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(connectHubPayload),
    });

    if (!configResponse.ok) {
      const errorText = await configResponse.text();
      console.error('[whitelabel/integrations/ghl/calendars] Connect Hub configuration error:', errorText);
      return NextResponse.json(
        { error: 'Failed to configure calendar' },
        { status: 500 }
      );
    }

    const configData = await configResponse.json();

    console.log('[whitelabel/integrations/ghl/calendars] Calendar configured successfully');

    return NextResponse.json({
      success: true,
      data: configData.data,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[whitelabel/integrations/ghl/calendars] Calendar configuration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
