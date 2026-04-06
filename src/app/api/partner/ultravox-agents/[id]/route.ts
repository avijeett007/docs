import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt, encrypt } from '@/lib/encryption';
import { invalidateCacheForDeletedAgent } from '@/lib/cache-invalidation';

export const dynamic = 'force-dynamic';

// GET - Get specific Ultravox agent details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const decoded = await verifyPartnerJWT(request);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;
    const agentId = params.id;

    // Fetch the agent
    const agent = await prisma.ultravoxAgent.findFirst({
      where: {
        id: agentId,
        partnerId: partnerId,
        isActive: true
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Transform the data to match the expected format
    const transformedAgent = {
      id: agent.id,
      name: agent.name,
      model: agent.model,
      systemPrompt: agent.systemPrompt,
      voice: agent.voice,
      temperature: agent.temperature,
      recordingEnabled: agent.recordingEnabled,
      maxDuration: agent.maxDuration,
      timeExceededMessage: agent.timeExceededMessage,
      languageHint: agent.languageHint,
      isActive: agent.isActive,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
      customer: agent.customer,
      profitMultiplier: agent.profitMultiplier,
      apiKeyStatus: agent.apiKeyStatus,
      apiKeyLastVerified: agent.apiKeyLastVerified,
      usingPartnerKey: !agent.apiKey,
      webhookEnabled: agent.webhookEnabled || false,
      webhookUrl: agent.webhookUrl,
      webhookMode: agent.webhookMode || 'manual',
      analyticsAgentId: agent.analyticsAgentId
    };

    return NextResponse.json(transformedAgent);

  } catch (error) {
    console.error('[ultravox-agents/[id]/route] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update Ultravox agent
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const decoded = await verifyPartnerJWT(request);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;
    const agentId = params.id;
    const body = await request.json();

    const {
      agentName,
      systemPrompt,
      temperature,
      model,
      voice,
      languageHint,
      recordingEnabled,
      maxDuration,
      timeExceededMessage,
      apiKey
    } = body;

    // Check if agent exists and belongs to partner
    const existingAgent = await prisma.ultravoxAgent.findFirst({
      where: {
        id: agentId,
        partnerId: partnerId,
        isActive: true
      }
    });

    if (!existingAgent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date()
    };

    if (agentName !== undefined) updateData.name = agentName;
    if (systemPrompt !== undefined) updateData.systemPrompt = systemPrompt;
    if (temperature !== undefined) updateData.temperature = temperature;
    if (model !== undefined) updateData.model = model;
    if (voice !== undefined) updateData.voice = voice;
    if (languageHint !== undefined) updateData.languageHint = languageHint;
    if (recordingEnabled !== undefined) updateData.recordingEnabled = recordingEnabled;
    if (maxDuration !== undefined) updateData.maxDuration = maxDuration;
    if (timeExceededMessage !== undefined) updateData.timeExceededMessage = timeExceededMessage;

    // Handle API key update
    if (apiKey !== undefined) {
      if (apiKey === null || apiKey === '') {
        updateData.apiKey = null;
        updateData.apiKeyStatus = 'not_set';
        updateData.apiKeyLastVerified = null;
        updateData.apiKeyErrorMessage = null;
      } else {
        updateData.apiKey = await encrypt(apiKey);
        updateData.apiKeyStatus = 'valid'; // Assume valid for now, will be verified later
        updateData.apiKeyLastVerified = new Date();
        updateData.apiKeyErrorMessage = null;
      }
    }

    // Get API key for Ultravox update
    let ultravoxApiKey: string | null = null;

    if (existingAgent.apiKey) {
      ultravoxApiKey = await decrypt(existingAgent.apiKey);
    } else {
      // Fallback to partner API key
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: { ultravoxApiKey: true }
      });

      if (partner?.ultravoxApiKey) {
        ultravoxApiKey = await decrypt(partner.ultravoxApiKey);
      }
    }

    if (!ultravoxApiKey) {
      return NextResponse.json(
        { error: 'No Ultravox API key found. Please set an API key for this agent or in your partner settings.' },
        { status: 400 }
      );
    }

    // Update agent in Ultravox platform first
    const ultravoxUpdateData: any = {};

    if (agentName !== undefined) {
      ultravoxUpdateData.name = agentName;
    }

    // Build callTemplate updates
    const callTemplateUpdates: any = {};
    if (systemPrompt !== undefined) callTemplateUpdates.systemPrompt = systemPrompt;
    if (temperature !== undefined) callTemplateUpdates.temperature = temperature;
    if (model !== undefined) callTemplateUpdates.model = model;
    if (voice !== undefined) callTemplateUpdates.voice = voice;
    if (languageHint !== undefined) callTemplateUpdates.languageHint = languageHint;
    if (recordingEnabled !== undefined) callTemplateUpdates.recordingEnabled = recordingEnabled;
    if (maxDuration !== undefined) callTemplateUpdates.maxDuration = maxDuration;
    if (timeExceededMessage !== undefined) callTemplateUpdates.timeExceededMessage = timeExceededMessage;

    if (Object.keys(callTemplateUpdates).length > 0) {
      ultravoxUpdateData.callTemplate = callTemplateUpdates;
    }

    // Only update Ultravox if there are actual changes to send
    if (Object.keys(ultravoxUpdateData).length > 0) {
      const ultravoxResponse = await fetch(`https://api.ultravox.ai/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: {
          'X-API-Key': ultravoxApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ultravoxUpdateData)
      });

      if (!ultravoxResponse.ok) {
        const errorText = await ultravoxResponse.text();
        throw new Error(`Failed to update agent in Ultravox: ${ultravoxResponse.status} ${errorText}`);
      }
    }

    // Update agent in our database
    const updatedAgent = await prisma.ultravoxAgent.update({
      where: { id: agentId },
      data: updateData,
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    // Transform response
    const transformedAgent = {
      id: updatedAgent.id,
      name: updatedAgent.name,
      model: updatedAgent.model,
      systemPrompt: updatedAgent.systemPrompt,
      voice: updatedAgent.voice,
      temperature: updatedAgent.temperature,
      recordingEnabled: updatedAgent.recordingEnabled,
      maxDuration: updatedAgent.maxDuration,
      timeExceededMessage: updatedAgent.timeExceededMessage,
      languageHint: updatedAgent.languageHint,
      isActive: updatedAgent.isActive,
      createdAt: updatedAgent.createdAt,
      updatedAt: updatedAgent.updatedAt,
      customer: updatedAgent.customer,
      profitMultiplier: updatedAgent.profitMultiplier,
      apiKeyStatus: updatedAgent.apiKeyStatus,
      apiKeyLastVerified: updatedAgent.apiKeyLastVerified,
      usingPartnerKey: !updatedAgent.apiKey,
      webhookEnabled: updatedAgent.webhookEnabled || false,
      webhookUrl: updatedAgent.webhookUrl,
      webhookMode: updatedAgent.webhookMode || 'manual',
      analyticsAgentId: updatedAgent.analyticsAgentId
    };

    return NextResponse.json({ agent: transformedAgent });

  } catch (error) {
    console.error('[ultravox-agents/[id]/route] Error updating agent:', error);
    return NextResponse.json({ error: 'Failed to update agent' }, { status: 500 });
  }
}

// DELETE - Delete Ultravox agent
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const decoded = await verifyPartnerJWT(request);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;
    const agentId = params.id;

    // Check if agent exists and belongs to partner
    const existingAgent = await prisma.ultravoxAgent.findFirst({
      where: {
        id: agentId,
        partnerId: partnerId,
        isActive: true
      }
    });

    if (!existingAgent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Get API key for Ultravox deletion
    let ultravoxApiKey: string | null = null;

    if (existingAgent.apiKey) {
      ultravoxApiKey = await decrypt(existingAgent.apiKey);
    } else {
      // Fallback to partner API key
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: { ultravoxApiKey: true }
      });

      if (partner?.ultravoxApiKey) {
        ultravoxApiKey = await decrypt(partner.ultravoxApiKey);
      }
    }

    if (ultravoxApiKey) {
      // Delete agent from Ultravox platform
      try {
        const ultravoxResponse = await fetch(`https://api.ultravox.ai/api/agents/${agentId}`, {
          method: 'DELETE',
          headers: {
            'X-API-Key': ultravoxApiKey
          }
        });

        if (!ultravoxResponse.ok) {
          console.warn(`Failed to delete agent from Ultravox: ${ultravoxResponse.status}`);
          // Continue with local deletion even if Ultravox deletion fails
        }
      } catch (error) {
        console.warn('Error deleting agent from Ultravox:', error);
        // Continue with local deletion even if Ultravox deletion fails
      }
    }

    // Soft delete the agent in our database
    await prisma.ultravoxAgent.update({
      where: { id: agentId },
      data: {
        isActive: false,
        updatedAt: new Date()
      }
    });

    // Invalidate analytics cache (feature flagged)
    try {
      const cacheResult = await invalidateCacheForDeletedAgent({
        agentId: agentId,
        partnerId: partnerId,
        customerId: existingAgent.customerId
      });

      if (cacheResult.success) {
        console.log(`Successfully invalidated cache for deleted Ultravox agent ${agentId}`);
      } else {
        console.warn(`Failed to invalidate cache for deleted Ultravox agent ${agentId}: ${cacheResult.error}`);
      }
    } catch (cacheError) {
      console.error(`Error invalidating cache for deleted Ultravox agent ${agentId}:`, cacheError);
      // Don't fail the deletion if cache invalidation fails
    }

    return NextResponse.json({ message: 'Agent deleted successfully' });

  } catch (error) {
    console.error('[ultravox-agents/[id]/route] Error deleting agent:', error);
    return NextResponse.json({ error: 'Failed to delete agent' }, { status: 500 });
  }
}
