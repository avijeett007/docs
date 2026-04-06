import { NextResponse, NextRequest } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { verifyPartnerJWT } from '@/lib/auth';
import { decrypt } from '@/lib/encryption';

interface TimeRange {
  start: string;
  end: string;
  step: 'day' | 'week' | 'month';
  timezone: string;
}

interface AnalyticsQuery {
  table: string;
  name: string;
  operations: {
    column: string;
    operation: string;
  }[];
  groupBy?: string[];
  timeRange: TimeRange;
}

interface AnalyticsRequest {
  queries: AnalyticsQuery[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: { agentId: string } }
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

    // Get partner ID
    const partnerId = auth.payload?.partnerId;
    if (!partnerId) {
      return NextResponse.json(
        { error: 'Invalid partner ID' },
        { status: 401 }
      );
    }

    // Get agent and verify ownership
    const agent = await prisma.vapiAgent.findUnique({
      where: { id: params.agentId },
      select: {
        id: true,
        partnerId: true,
        profitMultiplier: true,
        customerId: true,
        apiKey: true,
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

    // Get partner's API key for fallback
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: { vapiApiKey: true }
    });

    // Determine which API key to use: agent's key first, then partner's key
    let decryptedApiKey: string;

    if (agent.apiKey) {
      // Use agent's individual API key
      decryptedApiKey = await decrypt(agent.apiKey);
      console.log('[vapi-analytics/route] Using agent-specific API key for analytics fetch');
    } else if (partner?.vapiApiKey) {
      // Fallback to partner's API key
      decryptedApiKey = await decrypt(partner.vapiApiKey);
      console.log('[vapi-analytics/route] Using partner API key for analytics fetch (agent has no individual key)');
    } else {
      return NextResponse.json({
        error: 'No API key available',
        message: 'Neither agent-specific nor partner API key found'
      }, { status: 400 });
    }

    // Parse period from query params and validate
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || 'month';

    // Validate period is one of the allowed values
    if (!['day', 'week', 'month'].includes(period)) {
      return NextResponse.json(
        { error: 'Invalid period. Must be one of: day, week, month' },
        { status: 400 }
      );
    }

    // Type assertion since we've validated the value
    const validatedPeriod = period as 'day' | 'week' | 'month';

    // Calculate date range based on period
    const end = new Date();
    const start = new Date();

    switch (validatedPeriod) {
      case 'day':
        start.setDate(start.getDate() - 1);
        break;
      case 'week':
        start.setDate(start.getDate() - 7);
        break;
      case 'month':
        start.setMonth(start.getMonth() - 1);
        break;
    }

    // Prepare analytics request
    const analyticsRequest: AnalyticsRequest = {
      queries: [
        {
          groupBy: ["assistantId"],
          name: "LLM, STT, TTS, VAPI Costs",
          operations: [
            { column: "costBreakdown.llm", operation: "sum" },
            { column: "costBreakdown.stt", operation: "sum" },
            { column: "costBreakdown.tts", operation: "sum" },
            { column: "costBreakdown.vapi", operation: "sum" }
          ],
          table: "call",
          timeRange: {
            end: end.toISOString(),
            start: start.toISOString(),
            step: validatedPeriod,
            timezone: "Asia/Calcutta"
          }
        },
        {
          groupBy: ["assistantId"],
          name: "Total Call Duration",
          operations: [{ column: "duration", operation: "sum" }],
          table: "call",
          timeRange: {
            end: end.toISOString(),
            start: start.toISOString(),
            step: validatedPeriod,
            timezone: "Asia/Calcutta"
          }
        },
        {
          groupBy: ["assistantId"],
          name: "Average Call Cost",
          operations: [{ column: "cost", operation: "avg" }],
          table: "call",
          timeRange: {
            end: end.toISOString(),
            start: start.toISOString(),
            step: validatedPeriod,
            timezone: "Asia/Calcutta"
          }
        },
        {
          groupBy: ["assistantId"],
          name: "Number of Calls by Assistants",
          operations: [{ column: "id", operation: "count" }],
          table: "call",
          timeRange: {
            end: end.toISOString(),
            start: start.toISOString(),
            step: validatedPeriod,
            timezone: "Asia/Calcutta"
          }
        },
        {
          groupBy: ["endedReason", "assistantId"],
          name: "Number of Failed Calls",
          operations: [{ column: "id", operation: "count" }],
          table: "call",
          timeRange: {
            end: end.toISOString(),
            start: start.toISOString(),
            step: validatedPeriod,
            timezone: "Asia/Calcutta"
          }
        },
        {
          groupBy: ["assistantId"],
          name: "Average Call Duration by Assistant",
          operations: [{ column: "duration", operation: "avg" }],
          table: "call",
          timeRange: {
            end: end.toISOString(),
            start: start.toISOString(),
            step: validatedPeriod,
            timezone: "Asia/Calcutta"
          }
        },
        {
          groupBy: ["assistantId"],
          name: "Total Spent",
          operations: [{ column: "cost", operation: "sum" }],
          table: "call",
          timeRange: {
            end: end.toISOString(),
            start: start.toISOString(),
            step: validatedPeriod,
            timezone: "Asia/Calcutta"
          }
        },
        {
          groupBy: ["analysis.successEvaluation", "assistantId"],
          name: "Success Evaluation",
          operations: [{ column: "id", operation: "count" }],
          table: "call",
          timeRange: {
            end: end.toISOString(),
            start: start.toISOString(),
            step: validatedPeriod,
            timezone: "Asia/Calcutta"
          }
        }
      ]
    };

    // Call VAPI analytics API
    console.log('Making VAPI analytics request:', {
      url: 'https://api.vapi.ai/analytics',
      agentId: params.agentId,
      request: analyticsRequest
    });

    const response = await fetch('https://api.vapi.ai/analytics', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${decryptedApiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(analyticsRequest),
    });

    if (!response.ok) {
      console.error('VAPI analytics error:', {
        status: response.status,
        statusText: response.statusText,
        error: await response.text()
      });
      throw new Error(`Failed to fetch analytics from VAPI: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
