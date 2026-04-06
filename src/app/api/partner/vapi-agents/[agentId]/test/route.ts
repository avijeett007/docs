export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

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

    console.log('[vapi-test/route] Preparing test for VAPI agent:', agentId);

    // Get the agent from database with API key
    const agent = await prisma.vapiAgent.findUnique({
      where: {
        id: agentId,
        partnerId: partnerId, // Ensure partner owns this agent
      },
      select: {
        id: true,
        name: true,
        apiKey: true,
        publicKey: true, // Agent-specific public key (priority)
        partner: {
          select: {
            vapiApiKey: true,
            vapiPublicKey: true, // Partner-level public key (fallback)
          },
        },
      },
    });

    if (!agent) {
      return NextResponse.json({
        error: 'Agent not found or not owned by partner'
      }, { status: 404 });
    }

    // Determine which public key to use (agent-specific takes priority)
    let publicKey = null;
    let keySource = '';

    // Priority 1: Agent-specific public key
    if (agent.publicKey) {
      publicKey = agent.publicKey;
      keySource = 'agent';
    }
    // Priority 2: Partner-level public key (fallback)
    else if (agent.partner.vapiPublicKey) {
      publicKey = agent.partner.vapiPublicKey;
      keySource = 'partner';
    }
    // No public key available
    else {
      return NextResponse.json({
        error: 'No public key configured',
        message: 'VAPI public key is required for testing. Please add your VAPI public key.',
        instructions: {
          steps: [
            'Edit this agent and add a VAPI Public Key (starts with pk_)',
            'Or configure a partner-level public key in settings',
            'Save the changes',
            'Return here to test your agent'
          ],
          note: 'The public key is different from your private API key and is safe to use in the browser.',
          priority: 'Agent-specific public keys take priority over partner-level keys.'
        }
      }, { status: 400 });
    }

    console.log('[vapi-test/route] Test configuration prepared for agent:', agentId);

    // Return the test configuration
    return NextResponse.json({
      success: true,
      publicKey: publicKey,
      agentId: agentId,
      agentName: agent.name,
      keySource: keySource,
      testInstructions: {
        message: 'Use the VAPI Web SDK to test this agent directly in your browser.',
        steps: [
          'Click the microphone button to start the call',
          'Speak to test the agent\'s responses',
          'Click the stop button to end the call',
          'Review the conversation in the test interface'
        ],
        keyInfo: `Using ${keySource === 'agent' ? 'agent-specific' : 'partner-level'} public key for testing.`
      }
    });

  } catch (error: any) {
    console.error('[vapi-test/route] Error preparing test for VAPI agent:', error);

    return NextResponse.json({
      error: 'Failed to prepare test',
      message: error.message || 'An unexpected error occurred'
    }, { status: 500 });
  }
}
