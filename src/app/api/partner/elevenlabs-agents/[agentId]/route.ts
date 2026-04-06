import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPartnerJWT } from '@/lib/auth';
import { deleteAgentFromAnalytics } from '@/lib/analytics';
import { invalidateCacheForDeletedAgent } from '@/lib/cache-invalidation';

/**
 * GET /api/partner/elevenlabs-agents/[agentId]
 * Get a specific ElevenLabs agent
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const authResult = await verifyPartnerJWT(request);
    if (!authResult.isValid || !authResult.payload) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = authResult.payload.partnerId;
    const { agentId } = params;

    const agent = await prisma.elevenLabsAgent.findFirst({
      where: {
        id: agentId,
        partnerId
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

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    return NextResponse.json({ agent });
  } catch (error) {
    console.error('Error fetching ElevenLabs agent:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/partner/elevenlabs-agents/[agentId]
 * Update a specific ElevenLabs agent
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const authResult = await verifyPartnerJWT(request);
    if (!authResult.isValid || !authResult.payload) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = authResult.payload.partnerId;
    const { agentId } = params;
    const body = await request.json();

    // Check if agent exists and belongs to partner
    const existingAgent = await prisma.elevenLabsAgent.findFirst({
      where: {
        id: agentId,
        partnerId
      }
    });

    if (!existingAgent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Prepare update data
    const updateData: any = {};
    
    // Only update provided fields
    if (body.name !== undefined) updateData.name = body.name;
    // Note: agentId is now the primary key (id) and cannot be updated
    if (body.conversationConfig !== undefined) updateData.conversationConfig = body.conversationConfig;
    if (body.systemPrompt !== undefined) updateData.systemPrompt = body.systemPrompt;
    if (body.llmModel !== undefined) updateData.llmModel = body.llmModel;
    if (body.temperature !== undefined) updateData.temperature = body.temperature;
    if (body.voiceId !== undefined) updateData.voiceId = body.voiceId;
    if (body.externalVoiceConfig !== undefined) updateData.externalVoiceConfig = body.externalVoiceConfig;
    if (body.language !== undefined) updateData.language = body.language;
    if (body.maxDurationSeconds !== undefined) updateData.maxDurationSeconds = body.maxDurationSeconds;
    if (body.customerId !== undefined) updateData.customerId = body.customerId;
    if (body.profitMultiplier !== undefined) updateData.profitMultiplier = body.profitMultiplier;
    if (body.webhookSecret !== undefined) {
      updateData.webhookSecret = body.webhookSecret;
      updateData.webhookSecretConfirmed = !!body.webhookSecret;
    }
    if (body.forwardToPreExisting !== undefined) updateData.forwardToPreExisting = body.forwardToPreExisting;
    if (body.preExistingWebhookKey !== undefined) updateData.preExistingWebhookKey = body.preExistingWebhookKey;
    if (body.preExistingWebhookUrl !== undefined) updateData.preExistingWebhookUrl = body.preExistingWebhookUrl;
    if (body.webhookEnabled !== undefined) updateData.webhookEnabled = body.webhookEnabled;
    if (body.webhookMode !== undefined) updateData.webhookMode = body.webhookMode;
    if (body.apiKey !== undefined) {
      updateData.apiKey = body.apiKey;
      updateData.apiKeyStatus = body.apiKey ? 'active' : 'not_set';
      updateData.apiKeyLastVerified = body.apiKey ? new Date() : null;
    }
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    // Always update the updatedAt timestamp
    updateData.updatedAt = new Date();

    // Update the agent
    const updatedAgent = await prisma.elevenLabsAgent.update({
      where: { id: agentId },
      data: updateData,
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

    return NextResponse.json({ agent: updatedAgent });
  } catch (error) {
    console.error('Error updating ElevenLabs agent:', error);
    return NextResponse.json(
      { error: 'Failed to update agent' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/partner/elevenlabs-agents/[agentId]
 * Delete a specific ElevenLabs agent
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const authResult = await verifyPartnerJWT(request);
    if (!authResult.isValid || !authResult.payload) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = authResult.payload.partnerId;
    const { agentId } = params;

    // Check if agent exists and belongs to partner
    const existingAgent = await prisma.elevenLabsAgent.findFirst({
      where: {
        id: agentId,
        partnerId
      }
    });

    if (!existingAgent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Delete from analytics service if it has an analytics ID
    if (existingAgent.analyticsAgentId) {
      try {
        await deleteAgentFromAnalytics(existingAgent.analyticsAgentId);
      } catch (analyticsError) {
        console.error('Failed to delete agent from analytics:', analyticsError);
        // Continue with deletion even if analytics fails
      }
    }

    // Delete the agent
    await prisma.elevenLabsAgent.delete({
      where: { id: agentId }
    });

    // Invalidate analytics cache (feature flagged)
    try {
      const cacheResult = await invalidateCacheForDeletedAgent({
        agentId: agentId,
        partnerId: partnerId,
        customerId: existingAgent.customerId
      });

      if (cacheResult.success) {
        console.log(`Successfully invalidated cache for deleted ElevenLabs agent ${agentId}`);
      } else {
        console.warn(`Failed to invalidate cache for deleted ElevenLabs agent ${agentId}: ${cacheResult.error}`);
      }
    } catch (cacheError) {
      console.error(`Error invalidating cache for deleted ElevenLabs agent ${agentId}:`, cacheError);
      // Don't fail the deletion if cache invalidation fails
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting ElevenLabs agent:', error);
    return NextResponse.json(
      { error: 'Failed to delete agent' },
      { status: 500 }
    );
  }
}
