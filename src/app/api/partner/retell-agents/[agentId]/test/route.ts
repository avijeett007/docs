import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import axios from 'axios';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

interface TestAgentRequest {
  dynamicVariables?: Record<string, string>;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    // Verify the partner JWT
    const decoded = await verifyPartnerJWT(req);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;
    const agentId = params.agentId;

    // Get the agent from database with API key
    const agent = await prisma.retellAgent.findUnique({
      where: {
        id: agentId,
        partnerId: partnerId, // Ensure partner owns this agent
      },
      select: {
        id: true,
        name: true,
        apiKey: true,
      },
    });

    if (!agent) {
      return NextResponse.json({
        error: 'Agent not found or not owned by partner'
      }, { status: 404 });
    }

    // Get the partner's Retell API key for fallback
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        retellApiKey: true,
      },
    });

    // Parse request body
    const requestData: TestAgentRequest = await req.json().catch(() => ({}));
    console.log('[test/route] Creating test call for agent:', agentId);

    // Determine which API key to use: agent's key first, then partner's key
    let decryptedApiKey: string;

    if (agent.apiKey) {
      // Use agent's individual API key
      decryptedApiKey = await decrypt(agent.apiKey);
      console.log('[test/route] Using agent-specific API key for testing');
    } else if (partner?.retellApiKey) {
      // Fallback to partner's API key
      decryptedApiKey = await decrypt(partner.retellApiKey);
      console.log('[test/route] Using partner API key for testing (agent has no individual key)');
    } else {
      return NextResponse.json({
        error: 'No API key available',
        message: 'Neither agent-specific nor partner API key found'
      }, { status: 400 });
    }

    // Create web call for testing
    const webCallPayload = {
      agent_id: agentId,
      metadata: {
        test_call: true,
        partner_id: partnerId,
        agent_name: agent.name,
        created_at: new Date().toISOString(),
      },
      retell_llm_dynamic_variables: requestData.dynamicVariables || {},
    };

    console.log('[test/route] Creating web call with payload:', JSON.stringify(webCallPayload, null, 2));

    let webCallResponse;
    try {
      webCallResponse = await axios.post(
        'https://api.retellai.com/v2/create-web-call',
        webCallPayload,
        {
          headers: {
            'Authorization': `Bearer ${decryptedApiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
      console.log('[test/route] Web call created successfully:', webCallResponse.data.call_id);
    } catch (error: any) {
      console.error('[test/route] Error creating web call:', error.response?.data || error.message);

      // Handle specific Retell API errors
      if (error.response?.status === 403) {
        return NextResponse.json({
          error: 'quota_exceeded',
          message: 'Your Retell account has reached its usage limit. Please upgrade your plan to continue testing.',
        }, { status: 403 });
      }

      if (error.response?.status === 401) {
        return NextResponse.json({
          error: 'invalid_api_key',
          message: 'Your Retell API key appears to be invalid.',
        }, { status: 401 });
      }

      throw new Error(`Failed to create web call: ${error.response?.data?.message || error.message}`);
    }

    const { access_token, call_id } = webCallResponse.data;

    if (!access_token || !call_id) {
      throw new Error('Invalid response from Retell API - missing access token or call ID');
    }

    // Calculate expiration time (Retell tokens typically expire in 1 hour)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    console.log('[test/route] Test call created successfully:', {
      callId: call_id,
      agentId: agentId,
      partnerId: partnerId
    });

    return NextResponse.json({
      success: true,
      testCall: {
        accessToken: access_token,
        callId: call_id,
        agentName: agent.name,
        expiresAt: expiresAt,
      }
    });

  } catch (error: any) {
    console.error('[test/route] Error creating test call:', error);

    // Handle specific error types
    if (error.message.includes('quota') || error.message.includes('Trial over') || error.message.includes('add payment')) {
      return NextResponse.json({
        error: 'quota_exceeded',
        message: 'Your Retell account has reached its usage limit. Please upgrade your plan to continue testing.',
      }, { status: 403 });
    }

    if (error.message.includes('Invalid API key')) {
      return NextResponse.json({
        error: 'invalid_api_key',
        message: 'Your Retell API key appears to be invalid.',
      }, { status: 401 });
    }

    if (error.message.includes('not found') || error.message.includes('Not Found')) {
      return NextResponse.json({
        error: 'agent_not_found',
        message: 'Agent not found in Retell. This may happen if the agent was imported with a different API key or has been deleted from Retell.',
      }, { status: 404 });
    }

    return NextResponse.json({
      error: 'test_creation_failed',
      message: error.message || 'Failed to create test call. Please try again.',
    }, { status: 500 });
  }
}
