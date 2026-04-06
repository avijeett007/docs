export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyCustomerJWT } from '@/lib/customerJwt';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest) {
  try {
    // Get the customer token from cookies
    const cookieStore = cookies();
    const token = cookieStore.get('customer_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the token
    const payload = await verifyCustomerJWT(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const customerId = payload.customerId;

    // Fetch Ultravox agents assigned to this customer
    const ultravoxAgents = await prisma.ultravoxAgent.findMany({
      where: {
        customerId: customerId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        systemPrompt: true,
        temperature: true,
        model: true,
        voice: true,
        externalVoice: true,
        languageHint: true,
        recordingEnabled: true,
        maxDuration: true,
        timeExceededMessage: true,
        selectedTools: true,
        callTemplate: true,
        firstSpeakerSettings: true,
        vadSettings: true,
        inactivityMessages: true,
        medium: true,
        initialOutputMedium: true,
        joinTimeout: true,
        importedAt: true,
        lastSyncedAt: true,
        createdAt: true,
        updatedAt: true,
        isActive: true,
        profitMultiplier: true,
        analyticsAgentId: true,
        webhookEnabled: true,
        webhookMode: true,
        webhookUrl: true,
        preExistingWebhookUrl: true,
        forwardToPreExisting: true,
        apiKeyStatus: true,
        apiKeyLastVerified: true,
        apiKeyErrorMessage: true,
      },
    });

    // Transform the data to match the expected format for whitelabel
    const transformedAgents = ultravoxAgents.map(agent => ({
      id: agent.id,
      name: agent.name,
      assistantId: agent.id, // Use the same ID as assistantId for consistency
      customerId: customerId,
      systemPrompt: agent.systemPrompt,
      temperature: agent.temperature,
      model: agent.model,
      voice: agent.voice,
      externalVoice: agent.externalVoice,
      languageHint: agent.languageHint,
      recordingEnabled: agent.recordingEnabled,
      maxDuration: agent.maxDuration,
      timeExceededMessage: agent.timeExceededMessage,
      selectedTools: agent.selectedTools,
      callTemplate: agent.callTemplate,
      firstSpeakerSettings: agent.firstSpeakerSettings,
      vadSettings: agent.vadSettings,
      inactivityMessages: agent.inactivityMessages,
      medium: agent.medium,
      initialOutputMedium: agent.initialOutputMedium,
      joinTimeout: agent.joinTimeout,
      importedAt: agent.importedAt,
      lastSyncedAt: agent.lastSyncedAt,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
      isActive: agent.isActive,
      profitMultiplier: agent.profitMultiplier,
      analyticsAgentId: agent.analyticsAgentId,
      webhookEnabled: agent.webhookEnabled || false,
      webhookMode: agent.webhookMode || 'manual',
      webhookUrl: agent.webhookUrl,
      preExistingWebhookUrl: agent.preExistingWebhookUrl || null,
      forwardToPreExisting: agent.forwardToPreExisting || true,
      apiKeyStatus: agent.apiKeyStatus || 'not_set',
      apiKeyLastVerified: agent.apiKeyLastVerified,
      apiKeyErrorMessage: agent.apiKeyErrorMessage,
    }));

    return NextResponse.json(transformedAgents);
  } catch (error) {
    console.error('[whitelabel/ultravox-agents/route] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
