import { NextRequest, NextResponse } from 'next/server';
import { UsageTrackingService } from '@/lib/billing/usageTracking';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Validation schemas
const usageEventSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  agentId: z.string().optional(),
  metricType: z.string().min(1, 'Metric type is required'),
  metricName: z.string().min(1, 'Metric name is required'),
  metricCategory: z.string().optional(),
  quantity: z.number().min(0, 'Quantity must be non-negative'),
  unitPrice: z.number().min(0).optional(),
  sourceReference: z.string().optional(),
  usageDate: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
});

const batchUsageSchema = z.object({
  events: z.array(usageEventSchema).min(1, 'At least one usage event is required'),
});

const singleUsageSchema = usageEventSchema;

/**
 * POST /api/partner/usage/record
 * Record usage events for metered billing
 */
export async function POST(request: NextRequest) {
  try {
    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    const body = await request.json();

    // Determine if this is a batch or single event
    const isBatch = Array.isArray(body.events);
    
    if (isBatch) {
      // Validate batch request
      const validationResult = batchUsageSchema.safeParse(body);
      if (!validationResult.success) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Invalid request data',
            details: validationResult.error.errors 
          },
          { status: 400 }
        );
      }

      const { events } = validationResult.data;

      // Add partnerId to each event and convert dates
      const usageEvents = events.map(event => ({
        ...event,
        partnerId: partner.id,
        usageDate: event.usageDate ? new Date(event.usageDate) : undefined,
      }));

      // Record batch usage
      await UsageTrackingService.recordUsageBatch(usageEvents);

      return NextResponse.json({
        success: true,
        message: `Recorded ${events.length} usage events`,
        data: { eventsRecorded: events.length },
      });
    } else {
      // Validate single event request
      const validationResult = singleUsageSchema.safeParse(body);
      if (!validationResult.success) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Invalid request data',
            details: validationResult.error.errors 
          },
          { status: 400 }
        );
      }

      const event = validationResult.data;

      // Add partnerId and convert date
      const usageEvent = {
        ...event,
        partnerId: partner.id,
        usageDate: event.usageDate ? new Date(event.usageDate) : undefined,
      };

      // Record single usage
      await UsageTrackingService.recordUsage(usageEvent);

      return NextResponse.json({
        success: true,
        message: 'Usage event recorded successfully',
        data: { 
          customerId: event.customerId,
          metricType: event.metricType,
          quantity: event.quantity,
        },
      });
    }
  } catch (error: any) {
    console.error('Error recording usage:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
