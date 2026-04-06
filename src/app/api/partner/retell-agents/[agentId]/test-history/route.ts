import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import axios from 'axios';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

export async function GET(
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

    // Get query parameters
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50); // Max 50 results

    // Get the agent from database to verify ownership
    const agent = await prisma.retellAgent.findUnique({
      where: {
        id: agentId,
        partnerId: partnerId, // Ensure partner owns this agent
      },
      select: {
        id: true,
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

    // Determine which API key to use: agent's key first, then partner's key
    let decryptedApiKey: string;

    if (agent.apiKey) {
      // Use agent's individual API key
      decryptedApiKey = await decrypt(agent.apiKey);
      console.log('[test-history/route] Using agent-specific API key for test history fetch');
    } else if (partner?.retellApiKey) {
      // Fallback to partner's API key
      decryptedApiKey = await decrypt(partner.retellApiKey);
      console.log('[test-history/route] Using partner API key for test history fetch (agent has no individual key)');
    } else {
      return NextResponse.json({
        error: 'No API key available',
        message: 'Neither agent-specific nor partner API key found'
      }, { status: 400 });
    }

    console.log('[test-history/route] Fetching call history for agent:', agentId);

    // Get call history from Retell API
    let callHistory = [];
    try {
      const response = await axios.get(
        `https://api.retellai.com/list-calls?agent_id=${agentId}&limit=${limit}`,
        {
          headers: {
            'Authorization': `Bearer ${decryptedApiKey}`,
            'Accept': 'application/json',
          },
        }
      );

      callHistory = response.data || [];
      console.log('[test-history/route] Retrieved', callHistory.length, 'calls from Retell');
    } catch (error: any) {
      console.error('[test-history/route] Error fetching calls from Retell:', error.response?.data || error.message);

      if (error.response?.status === 401) {
        return NextResponse.json({
          error: 'invalid_api_key',
          message: 'Your Retell API key appears to be invalid.',
        }, { status: 401 });
      }

      // If we can't fetch from Retell, return empty array instead of failing
      console.log('[test-history/route] Returning empty test history due to API error');
      callHistory = [];
    }

    // Filter and transform calls to test results format
    const testResults = callHistory
      .filter((call: any) => {
        // Filter for test calls (web calls with test metadata)
        return call.call_type === 'web_call' &&
               call.metadata?.test_call === true;
      })
      .map((call: any) => {
        // Determine call status
        let status = 'completed';
        if (call.call_status === 'in_progress') {
          status = 'in_progress';
        } else if (call.call_status === 'error' || call.call_status === 'failed') {
          status = 'failed';
        }

        // Calculate duration if available
        let duration: number | undefined;
        if (call.start_timestamp && call.end_timestamp) {
          const startTime = new Date(call.start_timestamp).getTime();
          const endTime = new Date(call.end_timestamp).getTime();
          duration = Math.round((endTime - startTime) / 1000); // Duration in seconds
        }

        return {
          id: call.call_id,
          callId: call.call_id,
          status: status,
          duration: duration,
          createdAt: call.start_timestamp || call.created_at || new Date().toISOString(),
          errorMessage: call.call_status === 'error' ? call.error_message : undefined,
        };
      })
      .sort((a: any, b: any) => {
        // Sort by creation date, newest first
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
      .slice(0, limit); // Ensure we don't exceed the limit

    console.log('[test-history/route] Returning', testResults.length, 'test results');

    return NextResponse.json({
      success: true,
      tests: testResults,
    });

  } catch (error: any) {
    console.error('[test-history/route] Error fetching test history:', error);

    // Handle specific error types
    if (error.message.includes('Invalid API key')) {
      return NextResponse.json({
        error: 'invalid_api_key',
        message: 'Your Retell API key appears to be invalid.',
      }, { status: 401 });
    }

    if (error.message.includes('not found')) {
      return NextResponse.json({
        error: 'agent_not_found',
        message: 'Agent not found or may have been deleted from Retell.',
      }, { status: 404 });
    }

    return NextResponse.json({
      error: 'fetch_failed',
      message: error.message || 'Failed to fetch test history.',
    }, { status: 500 });
  }
}
