import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { verifyPartnerToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Validation schema
const paramsSchema = z.object({
  customerId: z.string().min(1)
});

const querySchema = z.object({
  appName: z.string().optional()
});

/**
 * GET /api/partner/customers/:customerId/tool-schemas
 * Get all tool schemas for customer's connected apps
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { customerId: string } }
) {
  try {
    // Verify partner authentication
    const authResult = await verifyPartnerToken(request);
    if (!authResult.success || !authResult.partner) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partner = authResult.partner;

    // Validate parameters
    const { customerId } = paramsSchema.parse(params);

    // Verify customer belongs to this partner
    const customer = await prisma.userOnboarding.findFirst({
      where: {
        customerId: customerId,
        partnerId: partner.id
      }
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found or not accessible' },
        { status: 404 }
      );
    }
    const { searchParams } = new URL(request.url);
    const { appName } = querySchema.parse({
      appName: searchParams.get('appName') || undefined
    });

    logger.info('Fetching tool schemas for customer', { customerId, appName });

    // Get Connect Hub URL from environment
    const connectHubUrl = process.env.CONNECT_HUB_URL;
    if (!connectHubUrl) {
      throw new Error('CONNECT_HUB_URL not configured');
    }

    // First, get the customer's connected apps from the existing tools status endpoint
    const statusUrl = `${connectHubUrl}/tools/${customerId}/status`;

    const response = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CONNECT_HUB_API_KEY}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      // If no connections found, return empty data (this is normal for new customers)
      return NextResponse.json({
        success: true,
        data: {},
        metadata: {
          source: 'connect-hub',
          timestamp: new Date().toISOString()
        }
      });
    }

    const statusData = await response.json();
    const connections = statusData.data?.connections || [];



    // Filter for connections that have tools/schemas (Composio, GHL, and internal)
    const connectionsWithTools = connections.filter((conn: any) =>
      conn.provider === 'composio' || conn.provider === 'ghl' || conn.provider === 'internal'
    );

    if (connectionsWithTools.length === 0) {
      return NextResponse.json({
        success: true,
        data: {},
        metadata: {
          source: 'connect-hub',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Fetch real tools from Connect Hub available endpoint
    const availableUrl = `${connectHubUrl}/tools/${customerId}/available`;

    const availableResponse = await fetch(availableUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CONNECT_HUB_API_KEY}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      cache: 'no-store'
    });

    if (!availableResponse.ok) {
      logger.warn('Failed to fetch available tools from Connect Hub', {
        customerId,
        status: availableResponse.status,
        statusText: availableResponse.statusText
      });
      return NextResponse.json({
        success: true,
        data: {},
        metadata: {
          source: 'connect-hub',
          timestamp: new Date().toISOString()
        }
      });
    }

    const availableData = await availableResponse.json();
    const toolsData = availableData.data?.tools || [];

    // Build the response with real tools from Composio
    const appsData: Record<string, any[]> = {};

    for (const appData of toolsData) {
      const appKey = appData.appName;

      // If specific app requested, only include that app
      if (appName && appKey !== appName) {
        continue;
      }

      // Transform tools (Composio, GHL, Internal) to our expected format
      const transformedTools = appData.tools.map((tool: any) => ({
        appName: appKey,
        toolName: tool.name,
        displayName: tool.displayName,
        description: tool.description,
        category: tool.category || 'general',
        inputSchema: tool.parameters || {
          type: 'object',
          properties: {},
          required: []
        }
      }));

      appsData[appKey] = transformedTools;
    }

    logger.info('Tool schemas processed successfully', {
      customerId,
      appName,
      totalApps: Object.keys(appsData).length,
      totalTools: Object.values(appsData).flat().length
    });

    return NextResponse.json({
      success: true,
      data: appsData,
      metadata: {
        source: 'connect-hub',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    logger.error('Failed to fetch tool schemas', error, {
      customerId: params.customerId
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid parameters',
        code: 'VALIDATION_ERROR',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}
