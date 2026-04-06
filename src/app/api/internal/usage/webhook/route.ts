import { NextRequest, NextResponse } from 'next/server';
import { UsageIntegrationService } from '@/lib/billing/usageIntegration';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Validation schema for webhook data
const webhookDataSchema = z.object({
  partnerId: z.string().min(1, 'Partner ID is required'),
  customerId: z.string().min(1, 'Customer ID is required'),
  agentId: z.string().min(1, 'Agent ID is required'),
  provider: z.string().min(1, 'Provider is required'),
  eventType: z.string().min(1, 'Event type is required'),
  eventData: z.object({
    call_id: z.string().optional(),
    id: z.string().optional(),
    duration: z.number().optional(),
    duration_seconds: z.number().optional(),
    cost: z.number().optional(),
    total_cost: z.number().optional(),
    start_time: z.string().optional(),
    created_at: z.string().optional(),
    end_time: z.string().optional(),
  }).passthrough(), // Allow additional fields
});

const leadDataSchema = z.object({
  partnerId: z.string().min(1, 'Partner ID is required'),
  customerId: z.string().min(1, 'Customer ID is required'),
  agentId: z.string().min(1, 'Agent ID is required'),
  leadData: z.object({
    leadId: z.string().min(1, 'Lead ID is required'),
    type: z.enum(['lead', 'appointment', 'qualified_lead']),
    value: z.number().optional(),
    source: z.string().min(1, 'Source is required'),
    createdAt: z.string().datetime(),
    metadata: z.record(z.any()).optional(),
  }),
});

const customMetricSchema = z.object({
  partnerId: z.string().min(1, 'Partner ID is required'),
  customerId: z.string().min(1, 'Customer ID is required'),
  agentId: z.string().min(1, 'Agent ID is required'),
  metricData: z.object({
    metricType: z.string().min(1, 'Metric type is required'),
    metricName: z.string().min(1, 'Metric name is required'),
    quantity: z.number().min(0, 'Quantity must be non-negative'),
    unitPrice: z.number().min(0).optional(),
    sourceReference: z.string().optional(),
    metadata: z.record(z.any()).optional(),
  }),
});

/**
 * POST /api/internal/usage/webhook
 * Internal webhook endpoint for recording usage from analytics system
 */
export async function POST(_request: NextRequest) {
  try {
    // Verify internal API key
    const authHeader = _request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.INTERNAL_API_KEY}`;

    if (!authHeader || authHeader !== expectedAuth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await _request.json();
    const action = body.action;

    switch (action) {
      case 'call_usage':
        // Validate call usage data
        const callValidation = webhookDataSchema.safeParse(body);
        if (!callValidation.success) {
          return NextResponse.json(
            { 
              success: false, 
              error: 'Invalid call usage data',
              details: callValidation.error.errors 
            },
            { status: 400 }
          );
        }

        const { partnerId, customerId, agentId, provider, eventType, eventData } = callValidation.data;

        // Process call usage
        await UsageIntegrationService.integrateWithWebhook(
          partnerId,
          customerId,
          agentId,
          provider,
          eventType,
          eventData
        );

        return NextResponse.json({
          success: true,
          message: 'Call usage processed successfully',
          data: {
            partnerId,
            customerId,
            agentId,
            provider,
            eventType,
          },
        });

      case 'lead_usage':
        // Validate lead usage data
        const leadValidation = leadDataSchema.safeParse(body);
        if (!leadValidation.success) {
          return NextResponse.json(
            { 
              success: false, 
              error: 'Invalid lead usage data',
              details: leadValidation.error.errors 
            },
            { status: 400 }
          );
        }

        const leadData = leadValidation.data;

        // Process lead usage
        await UsageIntegrationService.processLeadUsage(
          leadData.partnerId,
          leadData.customerId,
          leadData.agentId,
          {
            ...leadData.leadData,
            createdAt: new Date(leadData.leadData.createdAt),
          }
        );

        return NextResponse.json({
          success: true,
          message: 'Lead usage processed successfully',
          data: {
            partnerId: leadData.partnerId,
            customerId: leadData.customerId,
            leadId: leadData.leadData.leadId,
            type: leadData.leadData.type,
          },
        });

      case 'custom_metric':
        // Validate custom metric data
        const metricValidation = customMetricSchema.safeParse(body);
        if (!metricValidation.success) {
          return NextResponse.json(
            { 
              success: false, 
              error: 'Invalid custom metric data',
              details: metricValidation.error.errors 
            },
            { status: 400 }
          );
        }

        const metricData = metricValidation.data;

        // Process custom metric usage
        await UsageIntegrationService.processCustomMetricUsage(
          metricData.partnerId,
          metricData.customerId,
          metricData.agentId,
          metricData.metricData
        );

        return NextResponse.json({
          success: true,
          message: 'Custom metric usage processed successfully',
          data: {
            partnerId: metricData.partnerId,
            customerId: metricData.customerId,
            metricType: metricData.metricData.metricType,
            metricName: metricData.metricData.metricName,
            quantity: metricData.metricData.quantity,
          },
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Error processing internal usage webhook:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/internal/usage/webhook
 * Health check endpoint
 */
export async function GET(_request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Internal usage webhook endpoint is healthy',
    timestamp: new Date().toISOString(),
  });
}
