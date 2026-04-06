import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { registerAgentInAnalytics } from '@/lib/analytics';

/**
 * GET /api/partner/elevenlabs-agents
 * List all ElevenLabs agents for the authenticated partner
 */
export async function GET(request: NextRequest) {
  try {
    // Verify the partner JWT token
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await verifyPartnerJWT(request);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;

    // Get all ElevenLabs agents for this partner
    const agents = await prisma.elevenLabsAgent.findMany({
      where: { partnerId },
      include: {
        customer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ agents });
  } catch (error) {
    console.error('Error fetching ElevenLabs agents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agents' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/partner/elevenlabs-agents
 * Create a new ElevenLabs agent
 */
export async function POST(request: NextRequest) {
  try {
    // Verify the partner JWT token
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await verifyPartnerJWT(request);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;
    const body = await request.json();

    const {
      name,
      agentId,
      conversationConfig,
      systemPrompt,
      llmModel,
      temperature,
      voiceId,
      externalVoiceConfig,
      language,
      maxDurationSeconds,
      customerId,
      profitMultiplier,
      webhookSecret,
      forwardToPreExisting,
      preExistingWebhookKey,
      preExistingWebhookUrl,
      webhookEnabled,
      webhookMode,
      apiKey
    } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'Agent name is required' },
        { status: 400 }
      );
    }

    // Create the agent using ElevenLabs agent ID as primary key
    const agent = await prisma.elevenLabsAgent.create({
      data: {
        id: agentId, // Use ElevenLabs agent ID directly as primary key
        partnerId,
        customerId: customerId || null,
        name,
        conversationConfig: conversationConfig || null,
        systemPrompt: systemPrompt || null,
        llmModel: llmModel || null,
        temperature: temperature || 0.0,
        voiceId: voiceId || null,
        externalVoiceConfig: externalVoiceConfig || null,
        language: language || 'en',
        maxDurationSeconds: maxDurationSeconds || null,
        profitMultiplier: profitMultiplier || 1.2,
        webhookSecret: webhookSecret || null,
        webhookSecretConfirmed: !!webhookSecret,
        forwardToPreExisting: forwardToPreExisting || true,
        preExistingWebhookKey: preExistingWebhookKey || null,
        preExistingWebhookUrl: preExistingWebhookUrl || null,
        webhookEnabled: webhookEnabled || false,
        webhookMode: webhookMode || null,
        apiKey: apiKey || null,
        apiKeyStatus: apiKey ? 'active' : 'not_set',
        apiKeyLastVerified: apiKey ? new Date() : null
      },
      include: {
        customer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    // Register agent in analytics service
    try {
      const analyticsResult = await registerAgentInAnalytics({
        agentId: agent.id, // Now using the ElevenLabs agent ID directly
        provider: 'elevenlabs',
        partnerId,
        agentName: name,
        customerId: customerId || undefined,
        profitMultiplier: profitMultiplier || 1.2
      });

      if (analyticsResult.success && analyticsResult.analyticsAgentId) {
        // Update agent with analytics ID
        await prisma.elevenLabsAgent.update({
          where: { id: agent.id },
          data: { analyticsAgentId: analyticsResult.analyticsAgentId }
        });
      }
    } catch (analyticsError) {
      console.error('Failed to register agent in analytics:', analyticsError);
      // Continue - don't fail the agent creation
    }

    return NextResponse.json({ agent }, { status: 201 });
  } catch (error) {
    console.error('Error creating ElevenLabs agent:', error);
    return NextResponse.json(
      { error: 'Failed to create agent' },
      { status: 500 }
    );
  }
}
