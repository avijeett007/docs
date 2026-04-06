/**
 * Telemetry Health Check Endpoint
 * 
 * GET /api/telemetry/health
 * 
 * Returns the current status of telemetry systems (Signoz and Sentry)
 */

import { NextResponse } from 'next/server';
import { getSignozConfig } from '../../../../../signoz.config';
import { isOpenTelemetryInitialized } from '@/lib/otel-init';

export async function GET() {
  try {
    // Get Signoz configuration
    const signozConfig = getSignozConfig();
    
    // Check Sentry configuration
    const sentryEnabled = !!(
      process.env.SENTRY_DSN || 
      process.env.NEXT_PUBLIC_SENTRY_DSN
    );

    // Determine overall health
    const isHealthy = signozConfig.enabled || sentryEnabled;

    return NextResponse.json({
      status: isHealthy ? 'healthy' : 'disabled',
      timestamp: new Date().toISOString(),
      telemetry: {
        signoz: {
          enabled: signozConfig.enabled,
          configured: !!(signozConfig.endpoint && signozConfig.ingestionKey !== '***'),
          serviceName: signozConfig.serviceName,
          environment: signozConfig.environment,
          endpoint: signozConfig.endpoint || 'not configured',
          components: {
            traces: {
              initialized: isOpenTelemetryInitialized(),
              status: isOpenTelemetryInitialized() ? 'active' : 'inactive',
            },
            logs: {
              initialized: true, // Integrated into logger.ts
              status: 'active', // Direct HTTP export
            },
            metrics: {
              initialized: process.env.NEXT_RUNTIME !== 'edge', // Only in Node.js runtime
              status: process.env.NEXT_RUNTIME !== 'edge' ? 'active' : 'edge-runtime-skip',
            },
          },
        },
        sentry: {
          enabled: sentryEnabled,
          configured: sentryEnabled,
          dsn: process.env.SENTRY_DSN ? '***' + process.env.SENTRY_DSN.slice(-10) : 'not configured',
        },
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        runtime: process.env.NEXT_RUNTIME || 'nodejs',
      },
      recommendations: getRecommendations(signozConfig.enabled, sentryEnabled),
    });
  } catch (error) {
    console.error('Error checking telemetry health:', error);
    
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Get recommendations based on current configuration
 */
function getRecommendations(signozEnabled: boolean, sentryEnabled: boolean): string[] {
  const recommendations: string[] = [];

  if (!signozEnabled && !sentryEnabled) {
    recommendations.push('⚠️ No telemetry systems are enabled. Consider enabling Signoz or Sentry for monitoring.');
  }

  if (!signozEnabled) {
    recommendations.push('💡 Enable Signoz for distributed tracing and performance monitoring.');
  }

  if (!sentryEnabled) {
    recommendations.push('💡 Enable Sentry for comprehensive error tracking.');
  }

  if (signozEnabled && sentryEnabled) {
    recommendations.push('✅ Both Signoz and Sentry are enabled - you have full observability!');
  }

  return recommendations;
}

