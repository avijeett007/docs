import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPartnerJWT } from '@/lib/auth';
import { encrypt } from '@/lib/encryption';



export const dynamic = 'force-dynamic';

// Set agent API key
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify JWT and get partner
    const auth = await verifyPartnerJWT(request);
    if (!auth.isValid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partnerId = auth.payload?.partnerId;
    if (!partnerId) {
      return NextResponse.json(
        { error: 'Invalid partner ID' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { apiKey, verifyKey = true } = body;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    // Verify agent ownership
    const agent = await prisma.ultravoxAgent.findUnique({
      where: { id: params.id },
      select: { id: true, partnerId: true }
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    if (agent.partnerId !== partnerId) {
      return NextResponse.json(
        { error: 'Unauthorized - Agent does not belong to this partner' },
        { status: 403 }
      );
    }

    const status = 'valid';
    const errorMessage: string | null = null;

    // Verify API key if requested
    if (verifyKey) {
      // TODO: Implement Ultravox API key verification
      // For now, we'll skip verification for Ultravox agents
      // const isValid = await verifyUltravoxApiKey(apiKey, params.id);
      // if (!isValid) {
      //   status = 'invalid';
      //   errorMessage = 'API key verification failed';
      // }
      console.log('Ultravox API key verification not yet implemented');
    }

    // Encrypt the API key
    const encryptedApiKey = await encrypt(apiKey);

    // Update agent with new API key
    const updatedAgent = await prisma.ultravoxAgent.update({
      where: { id: params.id },
      data: {
        apiKey: encryptedApiKey,
        apiKeyStatus: status,
        apiKeyLastVerified: new Date(),
        apiKeyErrorMessage: errorMessage
      }
    });

    return NextResponse.json({
      success: true,
      status,
      message: status === 'valid' ? 'API key set successfully' : 'API key set but verification failed',
      lastVerified: updatedAgent.apiKeyLastVerified?.toISOString()
    });

  } catch (error) {
    console.error('Error setting agent API key:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// Get agent API key status
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify JWT and get partner
    const auth = await verifyPartnerJWT(request);
    if (!auth.isValid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partnerId = auth.payload?.partnerId;
    if (!partnerId) {
      return NextResponse.json(
        { error: 'Invalid partner ID' },
        { status: 401 }
      );
    }

    // Get agent with API key status
    const agent = await prisma.ultravoxAgent.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        partnerId: true,
        apiKey: true,
        apiKeyStatus: true,
        apiKeyLastVerified: true,
        apiKeyErrorMessage: true,
        partner: {
          select: {
            ultravoxApiKey: true
          }
        }
      }
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    if (agent.partnerId !== partnerId) {
      return NextResponse.json(
        { error: 'Unauthorized - Agent does not belong to this partner' },
        { status: 403 }
      );
    }

    const hasAgentApiKey = !!agent.apiKey;
    const hasPartnerApiKey = !!agent.partner.ultravoxApiKey;
    const usingPartnerKey = !hasAgentApiKey && hasPartnerApiKey;

    return NextResponse.json({
      hasApiKey: hasAgentApiKey,
      status: agent.apiKeyStatus || 'not_set',
      lastVerified: agent.apiKeyLastVerified?.toISOString(),
      errorMessage: agent.apiKeyErrorMessage,
      usingPartnerKey,
      hasPartnerKeyFallback: hasPartnerApiKey
    });

  } catch (error) {
    console.error('Error getting agent API key status:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// Remove agent API key (fallback to partner key)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify JWT and get partner
    const auth = await verifyPartnerJWT(request);
    if (!auth.isValid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partnerId = auth.payload?.partnerId;
    if (!partnerId) {
      return NextResponse.json(
        { error: 'Invalid partner ID' },
        { status: 401 }
      );
    }

    // Verify agent ownership
    const agent = await prisma.ultravoxAgent.findUnique({
      where: { id: params.id },
      select: { id: true, partnerId: true }
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    if (agent.partnerId !== partnerId) {
      return NextResponse.json(
        { error: 'Unauthorized - Agent does not belong to this partner' },
        { status: 403 }
      );
    }

    // Remove agent API key
    await prisma.ultravoxAgent.update({
      where: { id: params.id },
      data: {
        apiKey: null,
        apiKeyStatus: 'not_set',
        apiKeyLastVerified: null,
        apiKeyErrorMessage: null
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Agent API key removed successfully'
    });

  } catch (error) {
    console.error('Error removing agent API key:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
