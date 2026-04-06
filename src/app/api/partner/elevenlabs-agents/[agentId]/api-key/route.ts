import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPartnerJWT } from '@/lib/auth';
import { encrypt } from '@/lib/encryption';

/**
 * POST /api/partner/elevenlabs-agents/[agentId]/api-key
 * Update API key for a specific ElevenLabs agent
 */
export async function POST(
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
    const { apiKey } = body;

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

    // Validate API key format (ElevenLabs API keys start with 'sk_')
    if (apiKey && !apiKey.startsWith('sk_')) {
      return NextResponse.json(
        { error: 'Invalid API key format. ElevenLabs API keys should start with "sk_"' },
        { status: 400 }
      );
    }

    let apiKeyStatus = 'not_set';
    let apiKeyErrorMessage = null;
    let apiKeyLastVerified = null;

    if (apiKey) {
      // Test the API key by trying to access the specific agent
      try {
        // Validate API key against the specific agent (using agent ID as primary key)
        const testResponse = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${existingAgent.id}`, {
            method: 'GET',
            headers: {
              'xi-api-key': apiKey,
              'Content-Type': 'application/json'
            }
          });

          if (testResponse.ok) {
            apiKeyStatus = 'active';
            apiKeyLastVerified = new Date();
          } else {
            const errorData = await testResponse.json().catch(() => ({}));
            apiKeyStatus = 'invalid';
            apiKeyErrorMessage = errorData.detail || `Cannot access agent ${existingAgent.id} with this API key`;
          }
      } catch (error) {
        apiKeyStatus = 'error';
        apiKeyErrorMessage = 'Failed to verify API key';
        console.error('Error verifying ElevenLabs API key:', error);
      }
    }

    // Encrypt the API key if provided
    let encryptedApiKey = null;
    if (apiKey) {
      encryptedApiKey = await encrypt(apiKey);
    }

    // Update the agent with new API key information
    const updatedAgent = await prisma.elevenLabsAgent.update({
      where: { id: agentId },
      data: {
        apiKey: encryptedApiKey,
        apiKeyStatus,
        apiKeyErrorMessage,
        apiKeyLastVerified,
        updatedAt: new Date()
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

    // Notify analytics service about API key update (optional - don't fail if it doesn't work)
    try {
      if (apiKeyStatus === 'active' && updatedAgent.analyticsAgentId) {
        const analyticsResponse = await fetch(`${process.env.ANALYTICS_API_URL || 'http://localhost:8000'}/agents/${updatedAgent.analyticsAgentId}/refresh-api-key`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            agent_id: updatedAgent.id,
            provider: 'elevenlabs',
            api_key_status: apiKeyStatus
          })
        });

        if (analyticsResponse.ok) {
          console.log(`[elevenlabs-api-key] Notified analytics service about API key update for agent ${agentId}`);
        } else {
          console.warn(`[elevenlabs-api-key] Failed to notify analytics service: ${analyticsResponse.status}`);
        }
      }
    } catch (analyticsError) {
      console.warn(`[elevenlabs-api-key] Analytics notification failed (non-critical):`, analyticsError);
    }

    return NextResponse.json({
      agent: updatedAgent,
      apiKeyStatus,
      message: apiKeyStatus === 'active' ? 'API key verified successfully' :
               apiKeyStatus === 'invalid' ? 'API key is invalid' :
               apiKeyStatus === 'error' ? 'Failed to verify API key' :
               'API key removed'
    });
  } catch (error) {
    console.error('Error updating ElevenLabs agent API key:', error);
    return NextResponse.json(
      { error: 'Failed to update API key' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/partner/elevenlabs-agents/[agentId]/api-key
 * Remove API key from a specific ElevenLabs agent
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

    // Remove the API key
    const updatedAgent = await prisma.elevenLabsAgent.update({
      where: { id: agentId },
      data: {
        apiKey: null,
        apiKeyStatus: 'not_set',
        apiKeyErrorMessage: null,
        apiKeyLastVerified: null,
        updatedAt: new Date()
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

    // Notify analytics service about API key removal (optional - don't fail if it doesn't work)
    try {
      if (updatedAgent.analyticsAgentId) {
        const analyticsResponse = await fetch(`${process.env.ANALYTICS_API_URL || 'http://localhost:8000'}/agents/${updatedAgent.analyticsAgentId}/refresh-api-key`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            agent_id: updatedAgent.id,
            provider: 'elevenlabs',
            api_key_status: 'not_set'
          })
        });

        if (analyticsResponse.ok) {
          console.log(`[elevenlabs-api-key] Notified analytics service about API key removal for agent ${agentId}`);
        } else {
          console.warn(`[elevenlabs-api-key] Failed to notify analytics service: ${analyticsResponse.status}`);
        }
      }
    } catch (analyticsError) {
      console.warn(`[elevenlabs-api-key] Analytics notification failed (non-critical):`, analyticsError);
    }

    return NextResponse.json({
      agent: updatedAgent,
      message: 'API key removed successfully'
    });
  } catch (error) {
    console.error('Error removing ElevenLabs agent API key:', error);
    return NextResponse.json(
      { error: 'Failed to remove API key' },
      { status: 500 }
    );
  }
}
