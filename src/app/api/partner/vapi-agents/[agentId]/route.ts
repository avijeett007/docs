export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

    console.log('[vapi-agent/route] Getting VAPI agent:', agentId);

    // Get the agent from database
    const agent = await prisma.vapiAgent.findUnique({
      where: {
        id: agentId,
        partnerId: partnerId, // Ensure partner owns this agent
      },
      select: {
        id: true,
        partnerId: true,
        customerId: true,
        name: true,
        voice: true,
        model: true,
        firstMessage: true,
        voicemailMessage: true,
        endCallMessage: true,
        recordingEnabled: true,
        clientMessages: true,
        serverMessages: true,
        endCallPhrases: true,
        isServerUrlSecretSet: true,
        importedAt: true,
        lastSyncedAt: true,
        createdAt: true,
        updatedAt: true,
        isActive: true,
        profitMultiplier: true,
        analyticsAgentId: true,
        webhookUrl: true,
        webhookEnabled: true,
        webhookMode: true,
        preExistingWebhookUrl: true,
        forwardToPreExisting: true,
        apiKey: true,
        apiKeyStatus: true,
        apiKeyLastVerified: true,
        apiKeyErrorMessage: true,
        publicKey: true,
        customer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        },
        partner: {
          select: {
            vapiApiKey: true
          }
        }
      }
    });

    if (!agent) {
      return NextResponse.json({
        error: 'Agent not found or not owned by partner'
      }, { status: 404 });
    }

    // Determine API key status
    const hasAgentApiKey = !!agent.apiKey;
    const hasPartnerApiKey = !!agent.partner.vapiApiKey;
    const usingPartnerKey = !hasAgentApiKey && hasPartnerApiKey;

    // Return the agent data
    return NextResponse.json({
      id: agent.id,
      partnerId: agent.partnerId,
      customerId: agent.customerId,
      name: agent.name,
      voice: agent.voice,
      model: agent.model,
      firstMessage: agent.firstMessage,
      voicemailMessage: agent.voicemailMessage,
      endCallMessage: agent.endCallMessage,
      recordingEnabled: agent.recordingEnabled,
      clientMessages: agent.clientMessages,
      serverMessages: agent.serverMessages,
      endCallPhrases: agent.endCallPhrases,
      isServerUrlSecretSet: agent.isServerUrlSecretSet,
      importedAt: agent.importedAt,
      lastSyncedAt: agent.lastSyncedAt,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
      isActive: agent.isActive,
      profitMultiplier: agent.profitMultiplier,
      analyticsAgentId: agent.analyticsAgentId,
      webhookUrl: agent.webhookUrl,
      webhookEnabled: agent.webhookEnabled,
      webhookMode: agent.webhookMode,
      preExistingWebhookUrl: agent.preExistingWebhookUrl,
      forwardToPreExisting: agent.forwardToPreExisting,
      apiKeyStatus: agent.apiKeyStatus,
      apiKeyLastVerified: agent.apiKeyLastVerified,
      apiKeyErrorMessage: agent.apiKeyErrorMessage,
      publicKey: agent.publicKey,
      usingPartnerKey: usingPartnerKey,
      hasPartnerKeyFallback: hasPartnerApiKey,
      customer: agent.customer
    });

  } catch (error: any) {
    console.error('[vapi-agent/route] Error getting VAPI agent:', error);

    return NextResponse.json({
      error: 'Failed to get agent',
      message: error.message || 'An unexpected error occurred'
    }, { status: 500 });
  }
}
