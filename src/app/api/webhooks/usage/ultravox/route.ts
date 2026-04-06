import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { UsageTrackingService } from '@/lib/services/usageTrackingService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/usage/ultravox
 * Handle Ultravox usage webhooks for credit deduction
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('Received Ultravox usage webhook:', body.eventType);

    // Handle different Ultravox webhook events
    switch (body.eventType) {
      case 'call.ended':
        await handleCallEnded(body.data);
        break;
      
      case 'call.started':
        await handleCallStarted(body.data);
        break;
        
      default:
        console.log(`Unhandled Ultravox webhook event: ${body.eventType}`);
    }

    return NextResponse.json({ success: true, received: true });

  } catch (error) {
    console.error('Error processing Ultravox usage webhook:', error);
    return NextResponse.json(
      { success: false, error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleCallEnded(callData: any) {
  try {
    const {
      callId,
      voiceId,
      duration,
      cost,
      metadata
    } = callData;

    if (!voiceId || !duration) {
      console.log('Missing required call data for Ultravox usage tracking');
      return;
    }

    // Find the agent and partner using voice
    const agent = await prisma.ultravoxAgent.findFirst({
      where: { voice: voiceId },
      include: {
        partner: true,
        customer: true
      }
    });

    if (!agent) {
      console.log(`Ultravox agent not found: ${voiceId}`);
      return;
    }

    // Process usage and deduct credits
    const usageResult = await UsageTrackingService.processCallUsage({
      partnerId: agent.partnerId,
      customerId: agent.customerId || undefined,
      agentId: voiceId,
      provider: 'ultravox',
      sessionId: callId,
      durationSeconds: duration,
      callCost: cost ? Math.round(cost * 100) : undefined, // Convert to cents
      metadata: {
        callId,
        voiceId,
        agentName: agent.name,
        customerName: agent.customer?.firstName || 'Unknown',
        ...metadata
      }
    });

    if (usageResult.success) {
      console.log(`Ultravox call usage processed: ${usageResult.creditsDeducted} credits deducted for partner ${agent.partner.businessName}`);
      
      // Check if partner is now low on credits
      if (usageResult.newBalance !== undefined && usageResult.newBalance <= (agent.partner.lowCreditThreshold || 1000)) {
        await sendLowCreditNotification(agent.partner, usageResult.newBalance);
      }
    } else {
      console.error(`Failed to process Ultravox usage: ${usageResult.error}`);
    }

  } catch (error) {
    console.error('Error handling Ultravox call ended:', error);
  }
}

async function handleCallStarted(callData: any) {
  try {
    const {
      voiceId
    } = callData;

    if (!voiceId) {
      return;
    }

    // Find the agent and partner
    const agent = await prisma.ultravoxAgent.findFirst({
      where: { voice: voiceId },
      include: {
        partner: true
      }
    });

    if (!agent) {
      console.log(`Ultravox agent not found: ${voiceId}`);
      return;
    }

    // Check credit availability (estimate 5 minutes)
    const creditCheck = await UsageTrackingService.checkCreditAvailability(
      agent.partnerId,
      300, // 5 minutes default
      'ultravox'
    );

    if (!creditCheck.hasCredits) {
      console.warn(`Partner ${agent.partner.businessName} has insufficient credits for Ultravox call. Balance: ${creditCheck.currentBalance}, Estimated cost: ${creditCheck.estimatedCost}`);
      
      await sendInsufficientCreditsNotification(agent.partner, creditCheck);
    }

  } catch (error) {
    console.error('Error handling Ultravox call started:', error);
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
        message: `An Ultravox call could not be completed due to insufficient credits. Current balance: ${creditCheck.currentBalance} credits. Estimated cost: ${creditCheck.estimatedCost} credits.`,
        priority: 3,
        createdBy: 'system'
      }
    });

    console.log(`Insufficient credits notification sent to partner ${partner.businessName}`);

  } catch (error) {
    console.error('Error sending insufficient credits notification:', error);
  }
}
