import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

export const dynamic = 'force-dynamic';

// POST - Create a test call for Ultravox agent
export async function POST(
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
    const { testType = 'web' } = body; // 'web' or 'phone'

    // Fetch the agent
    const agent = await prisma.ultravoxAgent.findFirst({
      where: {
        id: agentId,
        partnerId: partnerId,
        isActive: true
      }
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Get API key (agent-specific or partner fallback)
    let ultravoxApiKey: string | null = null;
    
    if (agent.apiKey) {
      ultravoxApiKey = await decrypt(agent.apiKey);
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

    // Create test call using Ultravox API
    // Use the agent's configuration for the call
    const callData = {
      systemPrompt: agent.systemPrompt,
      temperature: agent.temperature,
      model: agent.model,
      voice: agent.voice || undefined,
      languageHint: agent.languageHint,
      recordingEnabled: agent.recordingEnabled,
      maxDuration: agent.maxDuration,
      timeExceededMessage: agent.timeExceededMessage || undefined,
      medium: testType === 'web' ? { webRtc: {} } : { telephony: { number: '+1234567890' } } // Mock test number for phone
    };

    console.log('[ultravox-test] Creating call with data:', JSON.stringify(callData, null, 2));

    const ultravoxResponse = await fetch('https://api.ultravox.ai/api/calls', {
      method: 'POST',
      headers: {
        'X-API-Key': ultravoxApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(callData)
    });

    if (!ultravoxResponse.ok) {
      const errorText = await ultravoxResponse.text();
      console.error('[ultravox-test] API error:', ultravoxResponse.status, errorText);
      throw new Error(`Failed to create test call: ${ultravoxResponse.status} ${errorText}`);
    }

    const ultravoxCall = await ultravoxResponse.json();
    console.log('[ultravox-test] Call created:', JSON.stringify(ultravoxCall, null, 2));

    if (testType === 'web') {
      // For web calls, return the join URL
      const testCall = {
        id: ultravoxCall.callId,
        type: 'web',
        status: 'created', // Ultravox calls start as created
        callUrl: ultravoxCall.joinUrl,
        agentId: agentId,
        agentName: agent.name,
        createdAt: ultravoxCall.created,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes from now
      };

      return NextResponse.json({
        success: true,
        testCall
      });
    } else if (testType === 'phone') {
      // For phone calls, return call details
      const testCall = {
        id: ultravoxCall.callId,
        type: 'phone',
        status: 'created',
        phoneNumber: '+1234567890', // Mock test number
        agentId: agentId,
        agentName: agent.name,
        createdAt: ultravoxCall.created,
        estimatedCallTime: '2-3 minutes'
      };

      return NextResponse.json({
        success: true,
        testCall,
        message: 'Test call initiated. You should receive a call shortly.'
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid test type. Must be "web" or "phone".' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('[ultravox-agents/[id]/test/route] Error:', error);
    return NextResponse.json({ error: 'Failed to create test call' }, { status: 500 });
  }
}

// GET - Get test call status
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
    const { searchParams } = new URL(request.url);
    const testCallId = searchParams.get('testCallId');

    if (!testCallId) {
      return NextResponse.json(
        { error: 'Test call ID is required' },
        { status: 400 }
      );
    }

    // Verify agent belongs to partner
    const agent = await prisma.ultravoxAgent.findFirst({
      where: {
        id: agentId,
        partnerId: partnerId,
        isActive: true
      }
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Get API key for Ultravox call status
    let ultravoxApiKey: string | null = null;

    if (agent.apiKey) {
      ultravoxApiKey = await decrypt(agent.apiKey);
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
        { error: 'No Ultravox API key found' },
        { status: 400 }
      );
    }

    // Get call status from Ultravox API
    const ultravoxResponse = await fetch(`https://api.ultravox.ai/api/calls/${testCallId}`, {
      headers: {
        'X-API-Key': ultravoxApiKey,
        'Accept': 'application/json'
      }
    });

    if (!ultravoxResponse.ok) {
      const errorText = await ultravoxResponse.text();
      throw new Error(`Failed to get call status: ${ultravoxResponse.status} ${errorText}`);
    }

    const ultravoxCall = await ultravoxResponse.json();

    // Transform Ultravox call data to our format
    const callStatus = {
      id: ultravoxCall.callId,
      status: ultravoxCall.endReason ? 'ended' : (ultravoxCall.joined ? 'connected' : 'created'),
      duration: ultravoxCall.joined && ultravoxCall.ended ?
        Math.floor((new Date(ultravoxCall.ended).getTime() - new Date(ultravoxCall.joined).getTime()) / 1000) : null,
      startTime: ultravoxCall.joined || null,
      endTime: ultravoxCall.ended || null,
      endReason: ultravoxCall.endReason || null,
      recordingUrl: null, // Will be available after call ends
      transcript: [], // Transcripts are available via separate API
      medium: ultravoxCall.medium,
      agentId: agentId,
      joinUrl: ultravoxCall.joinUrl
    };

    return NextResponse.json({
      success: true,
      testCall: callStatus
    });

  } catch (error) {
    console.error('[ultravox-agents/[id]/test/route] Error getting test status:', error);
    return NextResponse.json({ error: 'Failed to get test call status' }, { status: 500 });
  }
}
