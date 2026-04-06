import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyElevenlabsWebhook } from '@/lib/webhookSecurity';
import { UsageTrackingService } from '@/lib/services/usageTrackingService';

/**
 * POST /api/webhooks/usage/elevenlabs
 * Handle ElevenLabs webhook events for usage tracking
 */
export async function POST(request: NextRequest) {
  try {
    // Get the raw body for signature verification
    const body = await request.text();
    
    if (!body) {
      console.error('[ElevenLabs Webhook] Empty request body');
      return NextResponse.json({ error: 'Empty request body' }, { status: 400 });
    }

    let webhookData;
    try {
      webhookData = JSON.parse(body);
    } catch (error) {
      console.error('[ElevenLabs Webhook] Invalid JSON:', error);
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { type: eventType, data } = webhookData;

    if (!eventType || !data) {
      console.error('[ElevenLabs Webhook] Missing required fields:', { eventType, hasData: !!data });
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Extract agent ID and conversation ID
    const { agent_id: agentId, conversation_id: conversationId } = data;

    if (!agentId || !conversationId) {
      console.error('[ElevenLabs Webhook] Missing agent_id or conversation_id:', { agentId, conversationId });
      return NextResponse.json({ error: 'Missing agent_id or conversation_id' }, { status: 400 });
    }

    // Find the ElevenLabs agent in our database
    const agent = await prisma.elevenLabsAgent.findFirst({
      where: { id: agentId },
      include: {
        partner: true,
        customer: true
      }
    });

    if (!agent) {
      console.error('[ElevenLabs Webhook] Agent not found:', agentId);
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Verify webhook signature using the agent's webhook secret
    if (agent.webhookSecret) {
      const verification = await verifyElevenlabsWebhook(request, body, agent.webhookSecret);
      if (!verification.isValid) {
        console.error('[ElevenLabs Webhook] Signature verification failed:', verification.error);
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } else {
      console.warn('[ElevenLabs Webhook] No webhook secret configured for agent:', agentId);
    }

    console.log(`[ElevenLabs Webhook] Processing ${eventType} event for agent ${agentId}, conversation ${conversationId}`);

    // Process different event types
    switch (eventType) {
      case 'post_call_transcription':
        await processTranscriptionEvent(agent, data);
        break;
      
      case 'post_call_audio':
        await processAudioEvent(agent, data);
        break;
      
      default:
        console.warn('[ElevenLabs Webhook] Unknown event type:', eventType);
        return NextResponse.json({ error: 'Unknown event type' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ElevenLabs Webhook] Processing error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Process post_call_transcription event
 */
async function processTranscriptionEvent(agent: any, data: any) {
  try {
    const {
      conversation_id: conversationId,
      metadata,
      transcript,
      analysis
    } = data;

    // Extract call duration and cost information
    const callDurationSecs = metadata?.call_duration_secs || 0;
    const cost = metadata?.cost || 0; // Cost in cents
    const startTime = metadata?.start_time_unix_secs;
    const endTime = metadata?.accepted_time_unix_secs;

    // Process usage tracking
    if (callDurationSecs > 0) {
      const usageData = {
        partnerId: agent.partnerId,
        customerId: agent.customerId || undefined,
        agentId: agent.id,
        provider: 'elevenlabs' as const,
        sessionId: conversationId,
        durationSeconds: callDurationSecs,
        callCost: cost,
        metadata: {
          eventType: 'post_call_transcription',
          agentId: data.agent_id,
          conversationId,
          startTime,
          endTime,
          transcript: transcript ? transcript.length : 0,
          analysis: analysis ? Object.keys(analysis).length : 0,
          llmUsage: metadata?.charging?.llm_usage,
          features: metadata?.features_usage
        }
      };

      const result = await UsageTrackingService.processCallUsage(usageData);
      
      if (!result.success) {
        console.error('[ElevenLabs Webhook] Usage tracking failed:', result.error);
      } else {
        console.log(`[ElevenLabs Webhook] Usage tracked: ${result.creditsDeducted} credits deducted`);
      }
    }

    // Store additional analytics data if needed
    await storeAnalyticsData(agent, conversationId, {
      eventType: 'post_call_transcription',
      callDuration: callDurationSecs,
      cost,
      transcript,
      analysis,
      metadata
    });

  } catch (error) {
    console.error('[ElevenLabs Webhook] Error processing transcription event:', error);
    throw error;
  }
}

/**
 * Process post_call_audio event
 */
async function processAudioEvent(agent: any, data: any) {
  try {
    const {
      conversation_id: conversationId,
      full_audio: audioUrl
    } = data;

    console.log(`[ElevenLabs Webhook] Audio event for conversation ${conversationId}, audio URL: ${audioUrl ? 'provided' : 'not provided'}`);

    // Store audio reference if needed
    await storeAnalyticsData(agent, conversationId, {
      eventType: 'post_call_audio',
      audioUrl,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[ElevenLabs Webhook] Error processing audio event:', error);
    throw error;
  }
}

/**
 * Store analytics data for further processing
 */
async function storeAnalyticsData(agent: any, conversationId: string, eventData: any) {
  try {
    // Create or update AI usage record with additional analytics data
    await prisma.aIUsage.upsert({
      where: {
        // Use a composite key approach
        id: `elevenlabs_${agent.id}_${conversationId}_${eventData.eventType}`
      },
      create: {
        id: `elevenlabs_${agent.id}_${conversationId}_${eventData.eventType}`,
        partnerId: agent.partnerId,
        customerId: agent.customerId,
        elevenlabsAgentId: agent.id,
        usageDate: new Date(),
        usageType: 'voice_ai',
        usageAmount: eventData.callDuration || 0,
        costPerUnit: 0, // Will be calculated by usage tracking service
        totalCost: (eventData.cost || 0) / 100, // Convert cents to dollars
        vendorType: 'elevenlabs',
        vendorCost: (eventData.cost || 0) / 100,
        billedCost: 0 // Will be calculated by usage tracking service
      },
      update: {
        // Update with latest event data
        updatedAt: new Date(),
        // Store additional analytics in a JSON field if available
        // This would require adding a metadata field to the AIUsage model
      }
    });

    console.log(`[ElevenLabs Webhook] Analytics data stored for conversation ${conversationId}`);
  } catch (error) {
    console.error('[ElevenLabs Webhook] Error storing analytics data:', error);
    // Don't throw - analytics storage shouldn't break the webhook processing
  }
}
