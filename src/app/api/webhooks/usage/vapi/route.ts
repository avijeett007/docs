import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { UsageTrackingService } from '@/lib/services/usageTrackingService';
import {
  verifyVAPIWebhook,
  generateIdempotencyKey,
  isWebhookProcessed,
  validateWebhookPayload,
  sanitizeWebhookPayload
} from '@/lib/webhookSecurity';
import { webhookRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/usage/vapi
 * Handle VAPI usage webhooks for credit deduction
 */
export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await webhookRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Get raw body for signature verification
    const rawBody = await request.text();

    // Verify webhook signature
    const verificationResult = await verifyVAPIWebhook(request, rawBody);
    if (!verificationResult.isValid) {
      console.error('VAPI webhook signature verification failed:', verificationResult.error);
      return NextResponse.json(
        { success: false, error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const body = JSON.parse(rawBody);

    // Validate payload structure
    const validationResult = validateWebhookPayload('vapi', body);
    if (!validationResult.isValid) {
      return NextResponse.json(
        { success: false, error: validationResult.error },
        { status: 400 }
      );
    }

    // Generate idempotency key
    const idempotencyKey = generateIdempotencyKey(
      'vapi',
      body.type,
      body.data?.id || 'unknown',
      body.data?.timestamp
    );

    // Check if already processed
    const alreadyProcessed = await isWebhookProcessed(idempotencyKey);
    if (alreadyProcessed) {
      return NextResponse.json({
        success: true,
        received: true,
        message: 'Event already processed'
      });
    }

    // Handle different VAPI webhook events
    switch (body.type) {
      case 'call-ended':
        await handleCallEnded(body.data, idempotencyKey);
        break;

      case 'call-started':
        await handleCallStarted(body.data, idempotencyKey);
        break;

      default:
        // Log sanitized payload for unknown events
        const sanitizedPayload = sanitizeWebhookPayload(body);
        console.log(`Unhandled VAPI webhook type: ${body.type}`, sanitizedPayload);
    }

    return NextResponse.json({ success: true, received: true });

  } catch (error) {
    console.error('Error processing VAPI usage webhook:', error);
    return NextResponse.json(
      { success: false, error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleCallEnded(callData: any, idempotencyKey: string) {
  try {
    const {
      id: callId,
      assistantId,
      duration,
      cost,
      metadata
    } = callData;

    if (!assistantId || !duration) {
      console.log('Missing required call data for usage tracking');
      return;
    }

    // Find the agent and partner
    const agent = await prisma.vapiAgent.findUnique({
      where: { id: assistantId },
      include: {
        partner: true,
        customer: true
      }
    });

    if (!agent) {
      console.log(`VAPI agent not found: ${assistantId}`);
      return;
    }

    // Process usage and deduct credits
    const usageResult = await UsageTrackingService.processCallUsage({
      partnerId: agent.partnerId,
      customerId: agent.customerId || undefined,
      agentId: assistantId,
      provider: 'vapi',
      sessionId: callId,
      durationSeconds: duration,
      callCost: cost ? Math.round(cost * 100) : undefined, // Convert to cents
      metadata: {
        callId,
        agentName: agent.name,
        customerName: agent.customer?.firstName || 'Unknown',
        idempotencyKey,
        provider: 'vapi',
        webhookProcessedAt: new Date().toISOString(),
        ...metadata
      }
    });

    if (usageResult.success) {
      // Check if partner is now low on credits
      if (usageResult.newBalance !== undefined && usageResult.newBalance <= (agent.partner.lowCreditThreshold || 1000)) {
        await sendLowCreditNotification(agent.partner, usageResult.newBalance);
      }
    } else {
      console.error(`Failed to process VAPI usage: ${usageResult.error}`);
    }

    // Integrate with metered billing if customer has active subscriptions
    if (agent.customerId) {
      try {
        const { UsageIntegrationService } = await import('@/lib/billing/usageIntegration');
        await UsageIntegrationService.integrateWithWebhook(
          agent.partnerId,
          agent.customerId,
          assistantId,
          'vapi',
          'call_ended',
          callData
        );
      } catch (meteringError) {
        console.error('Error integrating with metered billing:', meteringError);
        // Don't throw to avoid breaking the main webhook processing
      }
    }

  } catch (error) {
    console.error('Error handling VAPI call ended:', error);
  }
}

async function handleCallStarted(callData: any, _idempotencyKey: string) {
  try {
    const {
      assistantId,
      estimatedDuration
    } = callData;

    if (!assistantId) {
      return;
    }

    // Find the agent and partner
    const agent = await prisma.vapiAgent.findUnique({
      where: { id: assistantId },
      include: {
        partner: true
      }
    });

    if (!agent) {
      console.log(`VAPI agent not found: ${assistantId}`);
      return;
    }

    // Check credit availability
    const creditCheck = await UsageTrackingService.checkCreditAvailability(
      agent.partnerId,
      estimatedDuration || 300, // Default 5 minutes if not provided
      'vapi'
    );

    if (!creditCheck.hasCredits) {
      console.warn(`Partner ${agent.partner.businessName} has insufficient credits for VAPI call. Balance: ${creditCheck.currentBalance}, Estimated cost: ${creditCheck.estimatedCost}`);
      
      // Optionally, you could terminate the call here by calling VAPI API
      // or send a notification to the partner
      await sendInsufficientCreditsNotification(agent.partner, creditCheck);
    }

  } catch (error) {
    console.error('Error handling VAPI call started:', error);
  }
}

async function sendLowCreditNotification(partner: any, currentBalance: number) {
  try {
    if (!partner.lowCreditNotificationsEnabled) {
      return;
    }

    // Create notification record
    await prisma.platformNotification.create({
      data: {
        type: 'low_credits',
        targetAudience: 'partner',
        title: 'Low Credit Balance Alert',
        message: `Your credit balance is running low. Current balance: ${currentBalance} credits. Consider purchasing more credits to avoid service interruption.`,
        priority: 3,
        createdBy: 'system'
      }
    });

    console.log(`Low credit notification sent to partner ${partner.businessName}`);

  } catch (error) {
    console.error('Error sending low credit notification:', error);
  }
}

async function sendInsufficientCreditsNotification(partner: any, creditCheck: any) {
  try {
    // Create notification record
    await prisma.platformNotification.create({
      data: {
        type: 'insufficient_credits',
        targetAudience: 'partner',
        title: 'Insufficient Credits for Call',
        message: `A VAPI call could not be completed due to insufficient credits. Current balance: ${creditCheck.currentBalance} credits. Estimated cost: ${creditCheck.estimatedCost} credits.`,
        priority: 3,
        createdBy: 'system'
      }
    });

    console.log(`Insufficient credits notification sent to partner ${partner.businessName}`);

  } catch (error) {
    console.error('Error sending insufficient credits notification:', error);
  }
}
