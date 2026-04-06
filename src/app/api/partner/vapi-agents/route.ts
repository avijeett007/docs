export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPartnerFromToken } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('[vapi-agents/route] Starting VAPI agents fetch');
    const partner = await getPartnerFromToken(request);
    if (!partner) {
      console.log('[vapi-agents/route] Authentication failed - no partner found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[vapi-agents/route] Partner authenticated:', partner.id);

    // Simply get partner with their active VAPI agents from database
    // No external API calls or auto-sync logic
    const vapiAgents = await prisma.vapiAgent.findMany({
      where: {
        partnerId: partner.id,
        isActive: true, // Only return active agents
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
        // Include API key fields
        apiKey: true,
        apiKeyStatus: true,
        apiKeyLastVerified: true,
        apiKeyErrorMessage: true,
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

    console.log(`[vapi-agents/route] Found ${vapiAgents.length} active VAPI agents in database for partner ${partner.id}`);

    // Map the agents to include all necessary webhook and API key fields
    const mappedAgents = vapiAgents.map(agent => {
      const hasAgentApiKey = !!agent.apiKey;
      const hasPartnerApiKey = !!partner.vapiApiKey;
      const usingPartnerKey = !hasAgentApiKey && hasPartnerApiKey;

      return {
        ...agent,
        // Ensure webhook fields are properly included
        analyticsAgentId: agent.analyticsAgentId,
        webhookUrl: agent.webhookUrl,
        webhookEnabled: agent.webhookEnabled || false,
        webhookMode: agent.webhookMode || 'manual',
        preExistingWebhookUrl: agent.preExistingWebhookUrl || null,
        forwardToPreExisting: agent.forwardToPreExisting || true,
        // Include API key status information (without exposing the actual key)
        apiKeyStatus: agent.apiKeyStatus || 'not_set',
        apiKeyLastVerified: agent.apiKeyLastVerified?.toISOString() || null,
        apiKeyErrorMessage: agent.apiKeyErrorMessage,
        usingPartnerKey,
        hasPartnerKeyFallback: hasPartnerApiKey,
        // Remove the actual API key from the response for security
        apiKey: undefined
      };
    });

    return NextResponse.json(mappedAgents);
  } catch (error) {
    console.error('Error fetching VAPI agents:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
