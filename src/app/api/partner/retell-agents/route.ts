import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    // Verify the partner JWT token
    const token = req.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await verifyPartnerJWT(req);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;

    // Simply get partner with their active Retell agents from database
    // No external API calls or auto-sync logic
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        id: true,
        retellApiKey: true, // Keep for fallback logic in API key status
        retellAgents: {
          where: {
            isActive: true, // Only return active agents
          },
          select: {
            id: true,
            partnerId: true,
            customerId: true,
            name: true,
            voiceId: true,
            voiceModel: true,
            responseEngine: true,
            voiceConfig: true,
            callConfig: true,
            webhookUrl: true,
            language: true,
            recordingEnabled: true,
            importedAt: true,
            lastSyncedAt: true,
            createdAt: true,
            updatedAt: true,
            isActive: true,
            profitMultiplier: true,
            analyticsAgentId: true,
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
                firstName: true,
                lastName: true,
                email: true
              },
            },
          },
        },
      },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    console.log(`[retell-agents/route] Found ${partner.retellAgents.length} active Retell agents in database for partner ${partnerId}`);

    // Map the field names to match what the frontend expects
    const mappedAgents = partner.retellAgents.map(agent => {
      const hasAgentApiKey = !!agent.apiKey;
      const hasPartnerApiKey = !!partner.retellApiKey;
      const usingPartnerKey = !hasAgentApiKey && hasPartnerApiKey;

      return {
        id: agent.id,
        name: agent.name,
        voiceId: agent.voiceId,
        voiceModel: agent.voiceModel,
        customerId: agent.customerId,
        customer: agent.customer,
        profitMultiplier: agent.profitMultiplier,
        responseEngine: agent.responseEngine,
        voiceConfig: agent.voiceConfig,
        callConfig: agent.callConfig,
        // Webhook related fields
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
        // Other fields
        language: agent.language,
        recordingEnabled: agent.recordingEnabled,
        importedAt: agent.importedAt,
        lastSyncedAt: agent.lastSyncedAt,
        createdAt: agent.createdAt,
        updatedAt: agent.updatedAt,
        isActive: agent.isActive,
        // Remove the actual API key from the response for security
        apiKey: undefined
      };
    });

    // Return the agents directly as an array to match frontend expectations
    return NextResponse.json(mappedAgents);
  } catch (error: unknown) {
    console.error('[retell-agents/route] Error in Retell agents API route:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      { error: 'Failed to process request', details: errorMessage },
      { status: 500 }
    );
  }
}
