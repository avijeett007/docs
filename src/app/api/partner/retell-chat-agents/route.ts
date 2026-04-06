import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/encryption';
import { registerAgentInAnalytics, generateWebhookUrl } from '@/lib/analytics';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/retell-chat-agents
 * List all imported Retell Chat Agents for the authenticated partner.
 */
export async function GET(req: NextRequest) {
  try {
    const decoded = await verifyPartnerJWT(req);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;

    const agents = await prisma.retellChatAgent.findMany({
      where: { partnerId, isActive: true },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
          select: { widgets: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const mappedAgents = agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      customerId: agent.customerId,
      customer: agent.customer,
      responseEngineType: agent.responseEngineType,
      language: agent.language,
      webhookUrl: agent.webhookUrl,
      webhookEnabled: agent.webhookEnabled,
      webhookMode: agent.webhookMode,
      preExistingWebhookUrl: agent.preExistingWebhookUrl,
      forwardToPreExisting: agent.forwardToPreExisting,
      partnerWebhookUrl: agent.partnerWebhookUrl,
      smsEnabled: agent.smsEnabled,
      smsPhoneNumber: agent.smsPhoneNumber,
      autoCloseMessage: agent.autoCloseMessage,
      isPublic: agent.isPublic,
      status: agent.status,
      isActive: agent.isActive,
      isPublished: agent.isPublished,
      analyticsAgentId: agent.analyticsAgentId,
      creditConfig: agent.creditConfig,
      widgetCount: agent._count.widgets,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
    }));

    return NextResponse.json(mappedAgents);
  } catch (error: unknown) {
    console.error('[retell-chat-agents] Error listing agents:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to list agents', details: errorMessage },
      { status: 500 }
    );
  }
}



/**
 * POST /api/partner/retell-chat-agents
 * Import a Retell Chat Agent into Knotie.
 * Fetches full config from Retell, registers with analytics, sets webhook URL.
 */
export async function POST(req: NextRequest) {
  try {
    const decoded = await verifyPartnerJWT(req);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;
    const body = await req.json();

    const {
      retellAgentId,
      apiKey,
      customerId,
      partnerWebhookUrl,
      creditConfig,
      defaultDynamicVariables,
    } = body;

    if (!retellAgentId) {
      return NextResponse.json(
        { error: 'retellAgentId is required' },
        { status: 400 }
      );
    }

    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      return NextResponse.json(
        { error: 'Retell API key is required' },
        { status: 400 }
      );
    }

    const trimmedApiKey = apiKey.trim();

    // Check if already imported
    const existing = await prisma.retellChatAgent.findUnique({
      where: { id: retellAgentId },
    });
    if (existing && existing.isActive) {
      return NextResponse.json(
        { error: 'Agent already imported', agentId: retellAgentId },
        { status: 409 }
      );
    }

    // Fetch full agent config from Retell
    const retellResponse = await fetch(
      `https://api.retellai.com/get-chat-agent/${retellAgentId}`,
      {
        headers: {
          Authorization: `Bearer ${trimmedApiKey}`,
          Accept: 'application/json',
        },
      }
    );

    if (!retellResponse.ok) {
      const errorData = await retellResponse.json().catch(() => ({}));
      console.error('[retell-chat-agents/import] Retell API error:', retellResponse.status, errorData);
      return NextResponse.json(
        { error: 'Failed to fetch agent from Retell', details: errorData },
        { status: retellResponse.status }
      );
    }

    const retellAgent = await retellResponse.json();

    // Capture the pre-existing webhook URL from Retell BEFORE any modifications.
    // This ensures we can forward events to the partner's original webhook later.
    const preExistingWebhookUrl = retellAgent.webhook_url || null;

    // Register with analytics service (webhook is NOT auto-set on Retell;
    // partners use the "Enable Webhook" button to configure it explicitly)
    let analyticsAgentId: string | null = null;
    let knotieWebhookUrl: string | null = null;

    try {
      const analyticsResult = await registerAgentInAnalytics({
        agentId: retellAgentId,
        provider: 'retell_chat',
        partnerId,
        agentName: retellAgent.agent_name || 'Retell Chat Agent',
        customerId: customerId || undefined,
      });

      if (analyticsResult.success && analyticsResult.analyticsAgentId) {
        analyticsAgentId = analyticsResult.analyticsAgentId;
        // Generate Knotie's analytics webhook URL for this agent
        knotieWebhookUrl = generateWebhookUrl({
          provider: 'retell_chat',
          analyticsAgentId,
        });
      }
    } catch (analyticsError) {
      console.error('[retell-chat-agents/import] Analytics registration failed:', analyticsError);
      // Non-blocking — continue import even if analytics fails
    }

    // Validate customerId belongs to partner if provided
    // The frontend sends a UserOnboarding.id (from /api/partner/customers),
    // so we need to resolve it to the actual Customer.id for the relation.
    let resolvedCustomerId: string | null = null;
    if (customerId) {
      // First, try looking up as a UserOnboarding.id (most common case from the UI)
      const userOnboarding = await prisma.userOnboarding.findFirst({
        where: {
          id: customerId,
          partnerId,
        },
        select: { customerId: true },
      });
      if (userOnboarding?.customerId) {
        resolvedCustomerId = userOnboarding.customerId;
      } else {
        // Fallback: try as a direct Customer.id
        const customer = await prisma.customer.findUnique({
          where: { id: customerId },
        });
        if (customer) {
          resolvedCustomerId = customer.id;
        } else {
          return NextResponse.json(
            { error: 'Customer not found or does not belong to this partner' },
            { status: 400 }
          );
        }
      }
    }

    // Encrypt the API key for storage
    const encryptedApiKey = await encrypt(trimmedApiKey);

    // Store or reactivate in local DB
    const agentData = {
      partnerId,
      customerId: resolvedCustomerId || null,
      name: retellAgent.agent_name || 'Retell Chat Agent',
      description: retellAgent.description || null,
      responseEngineType: retellAgent.response_engine?.type || 'retell-llm',
      responseEngine: retellAgent.response_engine || {},
      language: retellAgent.language || 'en-US',
      webhookUrl: knotieWebhookUrl,
      preExistingWebhookUrl,
      forwardToPreExisting: !!preExistingWebhookUrl,
      webhookEvents: ['chat_started', 'chat_ended', 'chat_analyzed'],
      partnerWebhookUrl: partnerWebhookUrl || null,
      smsEnabled: false,
      autoCloseMessage: retellAgent.auto_close_message || null,
      endChatAfterSilenceMs: retellAgent.end_chat_after_silence_ms || null,
      dataStorageSetting: retellAgent.data_storage_setting || null,
      dataStorageRetentionDays: retellAgent.data_storage_retention_days || null,
      isPublic: retellAgent.is_public || false,
      postChatAnalysisData: retellAgent.post_chat_analysis_data || null,
      postChatAnalysisModel: retellAgent.post_chat_analysis_model || null,
      analysisSummaryPrompt: retellAgent.analysis_summary_prompt || null,
      analysisSuccessfulPrompt: retellAgent.analysis_successful_prompt || null,
      analysisUserSentimentPrompt: retellAgent.analysis_user_sentiment_prompt || null,
      piiConfig: retellAgent.pii_config || null,
      guardrailConfig: retellAgent.guardrail_config || null,
      defaultDynamicVariables: defaultDynamicVariables || null,
      apiKey: encryptedApiKey,
      analyticsAgentId,
      status: 'active',
      isActive: true,
      creditConfig: creditConfig || null,
      lastModificationTimestamp: retellAgent.last_modification_timestamp
        ? BigInt(retellAgent.last_modification_timestamp)
        : null,
    };

    let importedAgent;
    if (existing && !existing.isActive) {
      // Reactivate previously soft-deleted agent
      importedAgent = await prisma.retellChatAgent.update({
        where: { id: retellAgentId },
        data: agentData,
        include: {
          customer: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });
    } else {
      importedAgent = await prisma.retellChatAgent.create({
        data: {
          id: retellAgentId,
          ...agentData,
        },
        include: {
          customer: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });
    }

    logger.info('Retell Chat Agent imported successfully', {
      operation: 'retell_chat_agent_import',
      agentId: retellAgentId,
      partnerId,
      analyticsAgentId,
    });

    return NextResponse.json({
      success: true,
      agent: {
        ...importedAgent,
        // Serialize BigInt for JSON
        lastModificationTimestamp: importedAgent.lastModificationTimestamp?.toString() || null,
      },
    });
  } catch (error: unknown) {
    console.error('[retell-chat-agents/import] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to import agent', details: errorMessage },
      { status: 500 }
    );
  }
}