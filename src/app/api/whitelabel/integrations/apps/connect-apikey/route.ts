import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyCustomerJWT } from '@/lib/customerJwt';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

const CONNECT_HUB_URL = process.env.CONNECT_HUB_URL || 'http://localhost:3001';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    logger.info('Starting API key connection', { operation: 'connect_apikey' });

    // Get the customer token from cookies
    const cookieStore = cookies();
    const token = cookieStore.get('customer_token')?.value;

    if (!token) {
      logger.warn('No customer token found', { operation: 'connect_apikey' });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the JWT token
    const payload = await verifyCustomerJWT(token);
    if (!payload) {
      logger.warn('Invalid customer token', { operation: 'connect_apikey' });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('Customer authenticated', { operation: 'connect_apikey', customerId: payload.customerId, partnerId: payload.partnerId });

    const body = await request.json();
    const { appName, apiKey } = body;

    if (!appName || !apiKey) {
      return NextResponse.json({
        error: 'Missing required fields: appName and apiKey'
      }, { status: 400 });
    }

    // Server-side validation: check customer's allowedApps
    try {
      const customer = await prisma.customer.findUnique({
        where: { id: payload.customerId },
        select: { email: true }
      });

      if (customer) {
        const userOnboarding = await prisma.userOnboarding.findFirst({
          where: { email: customer.email, partnerId: payload.partnerId },
          select: { allowedApps: true, showIntegration: true }
        });

        let allowedApps: string[] = [];
        try { allowedApps = JSON.parse(userOnboarding?.allowedApps || '[]'); } catch { allowedApps = []; }

        if (!userOnboarding?.showIntegration || (allowedApps.length > 0 && !allowedApps.includes(appName))) {
          logger.warn('App not in customer allowedApps', { operation: 'connect_apikey', appName, allowedApps, customerId: payload.customerId });
          return NextResponse.json(
            { error: 'This integration is not available for your account. Please contact your administrator.' },
            { status: 403 }
          );
        }
      }
    } catch (tierErr) {
      logger.error('App access check error (allowing through)', tierErr instanceof Error ? tierErr : new Error(String(tierErr)), { operation: 'connect_apikey' });
    }

    logger.info('Creating API key connection', { operation: 'connect_apikey', appName, customerId: payload.customerId, partnerId: payload.partnerId });

    const connectHubUrl = `${CONNECT_HUB_URL}/oauth/composio/connect-apikey`;
    logger.debug('Connect Hub URL', { operation: 'connect_apikey', url: connectHubUrl });

    // Forward to Connect Hub for API key connection
    const connectHubResponse = await fetch(connectHubUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CONNECT_HUB_API_KEY}`,
      },
      body: JSON.stringify({
        appName,
        apiKey,
        tenantId: payload.customerId,
        partnerId: payload.partnerId,
        userId: payload.customerId, // Use customer ID as user ID
      }),
    });

    if (!connectHubResponse.ok) {
      const errorText = await connectHubResponse.text();
      logger.error('Connect Hub error', new Error(errorText), { operation: 'connect_apikey', status: connectHubResponse.status, appName });
      
      return NextResponse.json({ 
        error: 'Failed to create connection' 
      }, { status: connectHubResponse.status });
    }

    const result = await connectHubResponse.json();
    
    logger.info('Connection successful', { operation: 'connect_apikey', appName, customerId: payload.customerId, connectionId: result.data?.connectionId });

    return NextResponse.json({
      success: true,
      data: result.data,
    });

  } catch (error) {
    logger.error('API key connection failed', error instanceof Error ? error : new Error(String(error)), { operation: 'connect_apikey' });
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
