import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { UsageTrackingService } from '@/lib/services/usageTrackingService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/usage/retell
 * Handle Retell usage webhooks for credit deduction
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('Received Retell usage webhook:', body.event);

    // Handle different Retell webhook events
    switch (body.event) {
      case 'call_ended':
        await handleCallEnded(body.data);
        break;
      
      case 'call_started':
        await handleCallStarted(body.data);
        break;
        
      default:
        console.log(`Unhandled Retell webhook event: ${body.event}`);
    }

    return NextResponse.json({ success: true, received: true });

  } catch (error) {
    console.error('Error processing Retell usage webhook:', error);
    return NextResponse.json(
      { success: false, error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleCallEnded(callData: any) {
  try {
    const {
      call_id: callId,
      agent_id: agentId,
      call_duration_ms: durationMs,
      call_analysis,
      metadata
    } = callData;

    if (!agentId || !durationMs) {
      console.log('Missing required call data for Retell usage tracking');
      return;
    }

    const durationSeconds = Math.ceil(durationMs / 1000);

    // Find the agent and partner
    const agent = await prisma.retellAgent.findUnique({
      where: { id: agentId },
      include: {
        partner: true,
        customer: true
      }
    });

    if (!agent) {
      console.log(`Retell agent not found: ${agentId}`);
      return;
    }

    // Calculate cost based on Retell's pricing (if available in call_analysis)
    let callCost: number | undefined;
    if (call_analysis?.total_cost) {
      callCost = Math.round(call_analysis.total_cost * 100); // Convert to cents
    }

    // Process usage and deduct credits
    const usageResult = await UsageTrackingService.processCallUsage({
      partnerId: agent.partnerId,
      customerId: agent.customerId || undefined,
      agentId: agentId,
      provider: 'retell',
      sessionId: callId,
      durationSeconds: durationSeconds,
      callCost: callCost,
      metadata: {
        callId,
        agentName: agent.name,
        customerName: agent.customer?.firstName || 'Unknown',
        callAnalysis: call_analysis,
        ...metadata
      }
    });

    if (usageResult.success) {
      console.log(`Retell call usage processed: ${usageResult.creditsDeducted} credits deducted for partner ${agent.partner.businessName}`);

      // Check if partner is now low on credits
      if (usageResult.newBalance !== undefined && usageResult.newBalance <= (agent.partner.lowCreditThreshold || 1000)) {
        await sendLowCreditNotification(agent.partner, usageResult.newBalance);
      }
    } else {
      console.error(`Failed to process Retell usage: ${usageResult.error}`);
    }

    // Integrate with metered billing if customer has active subscriptions
    if (agent.customerId) {
      try {
        const { UsageIntegrationService } = await import('@/lib/billing/usageIntegration');
        await UsageIntegrationService.integrateWithWebhook(
          agent.partnerId,
          agent.customerId,
          agentId,
          'retell',
          'call_ended',
          callData
        );
      } catch (meteringError) {
        console.error('Error integrating with metered billing:', meteringError);
        // Don't throw to avoid breaking the main webhook processing
      }
    }

  } catch (error) {
    console.error('Error handling Retell call ended:', error);
  }
}

async function handleCallStarted(callData: any) {
  try {
    const {
      agent_id: agentId
    } = callData;

    if (!agentId) {
      return;
    }

    // Find the agent and partner
    const agent = await prisma.retellAgent.findUnique({
      where: { id: agentId },
      include: {
        partner: true
      }
    });

    if (!agent) {
      console.log(`Retell agent not found: ${agentId}`);
      return;
    }

    // Check credit availability (estimate 5 minutes)
    const creditCheck = await UsageTrackingService.checkCreditAvailability(
      agent.partnerId,
      300, // 5 minutes default
      'retell'
    );

    if (!creditCheck.hasCredits) {
      console.warn(`Partner ${agent.partner.businessName} has insufficient credits for Retell call. Balance: ${creditCheck.currentBalance}, Estimated cost: ${creditCheck.estimatedCost}`);
      
      await sendInsufficientCreditsNotification(agent.partner, creditCheck);
    }

  } catch (error) {
    console.error('Error handling Retell call started:', error);
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
        message: `A Retell call could not be completed due to insufficient credits. Current balance: ${creditCheck.currentBalance} credits. Estimated cost: ${creditCheck.estimatedCost} credits.`,
        priority: 3,
        createdBy: 'system'
      }
    });

    console.log(`Insufficient credits notification sent to partner ${partner.businessName}`);

  } catch (error) {
    console.error('Error sending insufficient credits notification:', error);
  }
}
