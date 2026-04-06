import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { getAuth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

export async function GET(request: NextRequest, { params }: { params: { agentId: string } }) {
  try {
    const { userId } = getAuth(request);
    const { agentId } = params;
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month';
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the customer and their assigned agent
    const customer = await prisma.customer.findUnique({
      where: { userId },
      include: {
        vapiAgents: {
          where: { id: agentId },
          include: {
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

    if (!agent.partner.vapiApiKey) {
      return NextResponse.json({ error: 'VAPI API key not configured' }, { status: 400 });
    }

    // Decrypt the VAPI API key
    const decryptedApiKey = await decrypt(agent.partner.vapiApiKey);

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
