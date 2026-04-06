/**
 * API endpoint for detailed usage breakdown
 * Provides call-level usage details with metrics, confidence scores, and billing transparency
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyCustomerAuth } from '@/lib/auth/customerAuth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const UsageDetailsQuerySchema = z.object({
  customerId: z.string(),
  partnerId: z.string(),
  billingPeriodStart: z.string(),
  billingPeriodEnd: z.string(),
  subscriptionId: z.string().optional(),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 100),
  offset: z.string().optional().transform(val => val ? parseInt(val) : 0)
});

interface CallUsageDetail {
  id: string;
  callId: string;
  agentId: string;
  agentName: string;
  timestamp: string;
  duration: number;
  metrics: MetricDetection[];
  totalCost: number;
  provider: string;
  confidence: number;
}

interface MetricDetection {
  id: string;
  metricName: string;
  metricType: string;
  metricValue: any;
  detectedBy: string;
  confidenceScore?: number;
  quantity: number;
  unitPrice: number;
  totalCost: number;
  billingStatus: string;
  disputeMetadata?: any;
}

export async function GET(request: NextRequest) {
  try {
    // Get customer from authentication
    const customer = await verifyCustomerAuth(request);
    if (!customer) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    const validatedQuery = UsageDetailsQuerySchema.parse(queryParams);

    // Verify customer access
    if (validatedQuery.customerId !== customer.customerId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    const {
      customerId,
      partnerId,
      billingPeriodStart,
      billingPeriodEnd,
      subscriptionId,
      limit,
      offset
    } = validatedQuery;

    // Convert date strings to Date objects
    const periodStart = new Date(billingPeriodStart);
    const periodEnd = new Date(billingPeriodEnd);

    // Build where clause for usage metrics query
    const whereClause: any = {
      customerId,
      partnerId,
      usageDate: {
        gte: periodStart,
        lte: periodEnd
      },
      metricCategory: 'custom_metrics',
      sourceReference: { startsWith: 'analytics_' } // Only include metrics from analytics service
    };

    if (subscriptionId) {
      // If subscription ID is provided, filter by it through metadata
      whereClause.metadata = {
        path: ['subscriptionId'],
        equals: subscriptionId
      };
    }

    // Get usage metrics with related data
    const usageMetrics = await prisma.usageMetric.findMany({
      where: whereClause,
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true }
        },
        partner: {
          select: { id: true, businessName: true }
        }
      },
      orderBy: { usageDate: 'desc' },
      take: limit,
      skip: offset
    });

    // Group metrics by source reference (call ID)
    const callGroups = new Map<string, any[]>();

    for (const metric of usageMetrics) {
      const callId = metric.sourceReference || 'unknown';
      if (!callGroups.has(callId)) {
        callGroups.set(callId, []);
      }
      callGroups.get(callId)!.push(metric);
    }

    // Transform grouped data into call usage details
    const callDetails: CallUsageDetail[] = [];

    for (const [callId, metrics] of callGroups.entries()) {
      if (metrics.length === 0) continue;

      // Use the first metric for call-level information
      const firstMetric = metrics[0];
      const metadata = firstMetric.metadata as any;

      // Calculate call-level aggregates
      const totalCost = metrics.reduce((sum, m) => sum + Number(m.totalCost || 0), 0);
      const avgConfidence = metrics
        .filter(m => m.confidenceScore)
        .reduce((sum, m, _, arr) => sum + Number(m.confidenceScore!) / arr.length, 0);

      // Transform metrics
      const transformedMetrics: MetricDetection[] = metrics.map(metric => ({
        id: metric.id,
        metricName: metric.metricName,
        metricType: metric.metricType,
        metricValue: parseMetricValue(metric.metadata),
        detectedBy: metric.metadata?.detectedBy || 'unknown',
        confidenceScore: metric.metadata?.confidenceScore ? Number(metric.metadata.confidenceScore) : undefined,
        quantity: Number(metric.quantity),
        unitPrice: Number(metric.unitPrice || 0),
        totalCost: Number(metric.totalCost || 0),
        billingStatus: metric.billingStatus,
        disputeMetadata: metric.metadata?.disputeMetadata
      }));

      const callDetail: CallUsageDetail = {
        id: `call_${callId}`,
        callId,
        agentId: firstMetric.agentId || 'unknown',
        agentName: metadata?.agentName || 'Unknown Agent',
        timestamp: firstMetric.usageDate.toISOString(),
        duration: metadata?.duration || 0,
        metrics: transformedMetrics,
        totalCost,
        provider: metadata?.provider || 'unknown',
        confidence: avgConfidence || 0
      };

      callDetails.push(callDetail);
    }

    // Sort by timestamp (most recent first)
    callDetails.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Calculate summary statistics
    const totalCalls = callDetails.length;
    const totalMetricsDetected = callDetails.reduce((sum, call) => sum + call.metrics.length, 0);
    const totalAmount = callDetails.reduce((sum, call) => sum + call.totalCost, 0);
    const avgConfidenceOverall = callDetails.length > 0
      ? callDetails.reduce((sum, call) => sum + call.confidence, 0) / callDetails.length
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        callDetails,
        summary: {
          totalCalls,
          totalMetricsDetected,
          totalAmount,
          avgConfidence: avgConfidenceOverall,
          billingPeriod: {
            start: billingPeriodStart,
            end: billingPeriodEnd
          }
        },
        pagination: {
          limit,
          offset,
          hasMore: callDetails.length === limit
        }
      }
    });

  } catch (error) {
    console.error('Error fetching usage details:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: error.errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch usage details' },
      { status: 500 }
    );
  }
}

/**
 * Helper function to parse metric value from metadata
 */
function parseMetricValue(metadata: any): any {
  try {
    if (metadata?.originalMetric?.metric_value) {
      const value = metadata.originalMetric.metric_value;
      return typeof value === 'string' ? JSON.parse(value) : value;
    }
    return null;
  } catch {
    return metadata?.originalMetric?.metric_value || null;
  }
}