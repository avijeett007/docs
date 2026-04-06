import { NextRequest, NextResponse } from 'next/server';
import { checkPrismaHealth } from '../../../lib/prisma';
import { getServerVersion } from '../../../lib/version';

export const dynamic = 'force-dynamic'; // Required because this route uses request.headers

/**
 * Health check endpoint for Cloudflare load balancer
 *
 * This endpoint returns:
 * - 200 OK if the application is running properly and DB is connected
 * - 503 Service Unavailable if there are any issues
 *
 * It also includes basic system information and Cloudflare-specific headers handling
 */
export async function GET(request: NextRequest) {
  try {
    // Check database connection with proper health monitoring
    const healthCheck = await checkPrismaHealth();
    if (!healthCheck.healthy) {
      throw new Error(`Database health check failed: ${healthCheck.error}`);
    }

    // Get application version
    const version = getServerVersion();

    // Get Cloudflare-specific headers
    const cfRay = request.headers.get('cf-ray') || 'Not available';
    const cfCountry = request.headers.get('cf-ipcountry') || 'Not available';
    const cfConnectingIp = request.headers.get('cf-connecting-ip') || request.ip || 'Not available';

    // Return health status
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version,
      environment: process.env.NODE_ENV || 'development',
      cloudflare: {
        ray: cfRay,
        country: cfCountry,
        ip: cfConnectingIp
      }
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Health check failed:', error);

    // Return unhealthy status
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, {
      status: 503,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Content-Type': 'application/json'
      }
    });
  } finally {
    // Note: We don't need to disconnect from the singleton prisma client
    // as it manages its own connection pool
  }
}
