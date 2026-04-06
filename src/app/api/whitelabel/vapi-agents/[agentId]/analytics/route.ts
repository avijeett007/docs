import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { verifyCustomerJWT } from '@/lib/customerJwt';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

export async function GET(request: NextRequest, { params }: { params: { agentId: string } }) {
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

    const { agentId } = params;
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month';
    
    // Get the customer and their assigned agent
    const customer = await prisma.customer.findUnique({
      where: { id: payload.customerId },
      include: {
        vapiAgents: {
          where: { id: agentId },
          select: {
            id: true,
            profitMultiplier: true,
            apiKey: true,
            partner: {
              select: {
                vapiApiKey: true,
                defaultProfitMargin: true
              }
            }
          }
        }
      }
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const agent = customer.vapiAgents[0];
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found or not assigned to customer' }, { status: 404 });
    }

    // Determine which API key to use: agent's key first, then partner's key
    let decryptedApiKey: string;

    if (agent.apiKey) {
      // Use agent's individual API key
      decryptedApiKey = await decrypt(agent.apiKey);
      console.log('[whitelabel/vapi-analytics] Using agent-specific API key for analytics fetch');
    } else if (agent.partner.vapiApiKey) {
      // Fallback to partner's API key
      decryptedApiKey = await decrypt(agent.partner.vapiApiKey);
      console.log('[whitelabel/vapi-analytics] Using partner API key for analytics fetch (agent has no individual key)');
    } else {
      return NextResponse.json({
        error: 'No API key available',
        message: 'Neither agent-specific nor partner API key found'
      }, { status: 400 });
    }

    // Calculate date range based on period
    const now = new Date();
    const startDate = new Date();
    switch (period) {
      case 'day':
        startDate.setDate(now.getDate() - 1);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      default:
        startDate.setMonth(now.getMonth() - 1);
    }

    // Fetch analytics from VAPI
    const response = await fetch('https://api.vapi.ai/analytics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${decryptedApiKey}`,
      },
      body: JSON.stringify({
        queries: [
          {
            groupBy: ['assistantId'],
            name: 'LLM, STT, TTS, VAPI Costs',
            operations: [
              { column: 'costBreakdown.llm', operation: 'sum' },
              { column: 'costBreakdown.stt', operation: 'sum' },
              { column: 'costBreakdown.tts', operation: 'sum' },
              { column: 'costBreakdown.vapi', operation: 'sum' }
            ],
            table: 'call',
            timeRange: {
              start: startDate.toISOString(),
              end: now.toISOString(),
              step: 'day',
              timezone: 'Asia/Calcutta'
            }
          },
          {
            groupBy: ['assistantId'],
            name: 'Total Call Duration',
            operations: [{ column: 'duration', operation: 'sum' }],
            table: 'call',
            timeRange: {
              start: startDate.toISOString(),
              end: now.toISOString(),
              step: 'day',
              timezone: 'Asia/Calcutta'
            }
          },
          {
            groupBy: ['assistantId'],
            name: 'Average Call Cost',
            operations: [{ column: 'cost', operation: 'avg' }],
            table: 'call',
            timeRange: {
              start: startDate.toISOString(),
              end: now.toISOString(),
              step: 'day',
              timezone: 'Asia/Calcutta'
            }
          },
          {
            groupBy: ['assistantId'],
            name: 'Number of Calls by Assistants',
            operations: [{ column: 'id', operation: 'count' }],
            table: 'call',
            timeRange: {
              start: startDate.toISOString(),
              end: now.toISOString(),
              step: 'day',
              timezone: 'Asia/Calcutta'
            }
          },
          {
            groupBy: ['endedReason', 'assistantId'],
            name: 'Number of Failed Calls',
            operations: [{ column: 'id', operation: 'count' }],
            table: 'call',
            timeRange: {
              start: startDate.toISOString(),
              end: now.toISOString(),
              step: 'day',
              timezone: 'Asia/Calcutta'
            }
          },
          {
            groupBy: ['assistantId'],
            name: 'Average Call Duration by Assistant',
            operations: [{ column: 'duration', operation: 'avg' }],
            table: 'call',
            timeRange: {
              start: startDate.toISOString(),
              end: now.toISOString(),
              step: 'day',
              timezone: 'Asia/Calcutta'
            }
          },
          {
            name: 'Total Minutes',
            operations: [{ column: 'duration', operation: 'sum' }],
            table: 'call',
            timeRange: {
              start: startDate.toISOString(),
              end: now.toISOString(),
              step: 'day',
              timezone: 'Asia/Calcutta'
            }
          },
          {
            groupBy: ['assistantId'],
            name: 'Total Spent',
            operations: [{ column: 'cost', operation: 'sum' }],
            table: 'call',
            timeRange: {
              start: startDate.toISOString(),
              end: now.toISOString(),
              step: 'day',
              timezone: 'Asia/Calcutta'
            }
          },
          {
            groupBy: ['analysis.successEvaluation', 'assistantId'],
            name: 'Success Evaluation',
            operations: [{ column: 'id', operation: 'count' }],
            table: 'call',
            timeRange: {
              start: startDate.toISOString(),
              end: now.toISOString(),
              step: 'day',
              timezone: 'Asia/Calcutta'
            }
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error('Failed to fetch VAPI analytics');
    }

    const data = await response.json();

    // Update cost calculation logic to use agent's multiplier first, then partner's margin, then default
    const costMultiplier = agent.profitMultiplier || agent.partner.defaultProfitMargin || 1.2;

    // Apply profit margin to all cost-related data
    data.forEach((query: any) => {
      if (query.result) {
        query.result.forEach((result: any) => {
          // Adjust cost breakdown
          if (result.sumCostBreakdownLlm) result.sumCostBreakdownLlm *= costMultiplier;
          if (result.sumCostBreakdownStt) result.sumCostBreakdownStt *= costMultiplier;
          if (result.sumCostBreakdownTts) result.sumCostBreakdownTts *= costMultiplier;
          if (result.sumCostBreakdownVapi) result.sumCostBreakdownVapi *= costMultiplier;
          
          // Adjust average and total costs
          if (result.avgCost) result.avgCost *= costMultiplier;
          if (result.sumCost) result.sumCost *= costMultiplier;
        });
      }
    });

    return NextResponse.json(data);

  } catch (error) {
    console.error('Error fetching agent analytics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
