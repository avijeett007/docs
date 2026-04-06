import { NextResponse } from 'next/server';
import {
  getPrismaConnectionMetrics,
  forcePrismaHealthCheck,
  resetPrismaConnectionMetrics
} from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// SECURITY: Authentication for monitoring endpoints
function isMonitoringAllowed(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  const apiKey = request.headers.get('x-api-key');
  const monitoringKey = process.env.MONITORING_API_KEY;

  // Allow in development without auth
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  // Require API key in production
  if (!monitoringKey) {
    console.warn('⚠️ MONITORING_API_KEY not set - monitoring endpoints disabled');
    return false;
  }

  // Check API key in header
  if (apiKey === monitoringKey) {
    return true;
  }

  // Check Bearer token
  if (authHeader?.startsWith('Bearer ') && authHeader.slice(7) === monitoringKey) {
    return true;
  }

  return false;
}

function getUnauthorizedResponse() {
  return NextResponse.json({
    success: false,
    error: 'Unauthorized - monitoring endpoints require valid API key',
    environment: process.env.NODE_ENV,
  }, { status: 401 });
}

/**
 * GET /api/monitoring/database
 *
 * Returns comprehensive database connection metrics for monitoring dashboard
 */
export async function GET(request: Request) {
  // Security check
  if (!isMonitoringAllowed(request)) {
    return getUnauthorizedResponse();
  }

  try {
    const metrics = getPrismaConnectionMetrics();
    
    return NextResponse.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

/**
 * POST /api/monitoring/database
 * 
 * Performs actions on database monitoring:
 * - action: "health_check" - Force a health check
 * - action: "reset_metrics" - Reset connection metrics
 */
export async function POST(request: Request) {
  // Security check
  if (!isMonitoringAllowed(request)) {
    return getUnauthorizedResponse();
  }

  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'health_check':
        const healthResult = await forcePrismaHealthCheck();
        return NextResponse.json({
          success: true,
          action: 'health_check',
          data: healthResult,
          timestamp: new Date().toISOString(),
        });

      case 'reset_metrics':
        resetPrismaConnectionMetrics();
        const newMetrics = getPrismaConnectionMetrics();
        return NextResponse.json({
          success: true,
          action: 'reset_metrics',
          data: newMetrics,
          message: 'Connection metrics have been reset',
          timestamp: new Date().toISOString(),
        });

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}. Supported actions: health_check, reset_metrics`,
          timestamp: new Date().toISOString(),
        }, { status: 400 });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
