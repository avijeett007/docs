/**
 * Metered Usage API Route - Phase 2 Implementation
 *
 * This endpoint will be used to record usage metrics for metered billing.
 * Currently contains placeholder implementation while Phase 2 database
 * schema and Stripe integration are being developed.
 *
 * Phase 1: ✅ Custom metrics configuration UI complete
 * Phase 2: 🔄 Webhook integration and usage recording (this file)
 * Phase 3: 📋 Billing integration with Stripe
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
// import { prisma } from '@/lib/prisma'; // Commented out for Phase 2 implementation

// Validation schema for metered usage requests
const MeteredUsageRequestSchema = z.object({
  agentId: z.string().min(1, 'Agent ID is required'),
  partnerId: z.string().min(1, 'Partner ID is required'),
  customerId: z.string().min(1, 'Customer ID is required'),
  metricName: z.string().min(1, 'Metric name is required'),
  metricValue: z.boolean(),
  callId: z.string().min(1, 'Call ID is required'),
  timestamp: z.string().datetime(),
  sourceReference: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

// Note: This type is used in the POST handler below
// type MeteredUsageRequest = z.infer<typeof MeteredUsageRequestSchema>;

// Authentication middleware for analytics service
function verifyAnalyticsApiKey(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const expectedKey = process.env.ANALYTICS_API_KEY;
  
  if (!expectedKey) {
    console.error('ANALYTICS_API_KEY not configured');
    return false;
  }
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  
  const providedKey = authHeader.substring(7);
  return providedKey === expectedKey;
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    if (!verifyAnalyticsApiKey(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = MeteredUsageRequestSchema.parse(body);

    // Only process billable events (true values)
    if (!validatedData.metricValue) {
      return NextResponse.json({
        success: true,
        message: 'Non-billable event ignored',
        processed: false
      });
    }

    // TODO: Phase 2 Implementation - Database schema not yet available
    // This will be implemented when we add the metered billing tables

    console.log('Metered usage request received (Phase 2 placeholder):', {
      agentId: validatedData.agentId,
      partnerId: validatedData.partnerId,
      customerId: validatedData.customerId,
      metricName: validatedData.metricName,
      metricValue: validatedData.metricValue,
      callId: validatedData.callId,
      timestamp: validatedData.timestamp
    });

    // Placeholder response for Phase 2 implementation
    return NextResponse.json({
      success: true,
      message: 'Metered usage recorded (Phase 2 placeholder)',
      data: {
        agentId: validatedData.agentId,
        metricName: validatedData.metricName,
        metricValue: validatedData.metricValue,
        timestamp: validatedData.timestamp,
        status: 'pending_phase_2_implementation'
      }
    });

    /*
    // Phase 2 Implementation - Uncomment when database schema is ready

    // Find active metered billing subscriptions for this customer and metric
    const subscriptions = await prisma.meteredBillingPlan.findMany({
      where: {
        customerId: validatedData.customerId,
        metricName: validatedData.metricName,
        isActive: true
      },
      include: {
        customer: true,
        partner: true
      }
    });

    if (subscriptions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active subscriptions found for this metric',
        processed: false
      });
    }

    let totalUsageRecorded = 0;
    const processedSubscriptions = [];

    for (const subscription of subscriptions) {
      try {
        // Check for duplicate usage records
        const existingUsage = await prisma.usageMetric.findFirst({
          where: {
            meteredBillingPlanId: subscription.id,
            sourceReference: validatedData.sourceReference || validatedData.callId,
            timestamp: new Date(validatedData.timestamp)
          }
        });

        if (existingUsage) {
          console.log(`Duplicate usage record found for subscription ${subscription.id}, skipping`);
          continue;
        }

        // Create usage record
        const usageRecord = await prisma.usageMetric.create({
          data: {
            meteredBillingPlanId: subscription.id,
            customerId: validatedData.customerId,
            partnerId: validatedData.partnerId,
            agentId: validatedData.agentId,
            metricName: validatedData.metricName,
            metricValue: validatedData.metricValue ? 1 : 0, // Convert boolean to count
            timestamp: new Date(validatedData.timestamp),
            sourceReference: validatedData.sourceReference || validatedData.callId,
            metadata: validatedData.metadata || {}
          }
        });

        // Report usage to Stripe if Stripe integration is enabled
        if (subscription.stripeSubscriptionId && subscription.stripePriceId) {
          try {
            // Import Stripe dynamically to avoid issues if not configured
            const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

            await stripe.subscriptionItems.createUsageRecord(
              subscription.stripeSubscriptionItemId,
              {
                quantity: 1,
                timestamp: Math.floor(new Date(validatedData.timestamp).getTime() / 1000),
                action: 'increment'
              }
            );

            console.log(`Reported usage to Stripe for subscription ${subscription.id}`);
          } catch (stripeError) {
            console.error(`Failed to report usage to Stripe: ${stripeError}`);
            // Don't fail the entire request if Stripe reporting fails
          }
        }

        totalUsageRecorded++;
        processedSubscriptions.push({
          subscriptionId: subscription.id,
          usageRecordId: usageRecord.id
        });

      } catch (subscriptionError) {
        console.error(`Error processing subscription ${subscription.id}: ${subscriptionError}`);
        // Continue processing other subscriptions
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Usage recorded successfully',
      processed: true,
      usageCount: totalUsageRecorded,
      subscriptions: processedSubscriptions,
      metadata: {
        agentId: validatedData.agentId,
        metricName: validatedData.metricName,
        callId: validatedData.callId,
        timestamp: validatedData.timestamp
      }
    });

    */ // End of Phase 2 implementation comment block

  } catch (error) {
    console.error('Error processing metered usage:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: error.errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
