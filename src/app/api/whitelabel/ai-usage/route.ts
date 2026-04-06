import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { verifyCustomerJWT } from '@/lib/customerJwt';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

// Define interfaces for our conversation types
interface VapiConversation {
  id: string;
  agentId: string;
  startedAt: string;
  endedAt?: string;
  status: string;
  agent: {
    name: string;
  };
}

interface RetellConversation {
  id: string;
  agentId: string;
  startTimestamp: number;
  endTimestamp?: number;
  status: string;
  agent: {
    name: string;
  };
  callerPhoneNumber?: string;
}

export async function GET(_request: NextRequest) {
  try {
    // Get the customer token from cookies
    const cookieStore = cookies();
    const token = cookieStore.get('customer_token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify the token
    const payload = await verifyCustomerJWT(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Get the customer ID from the token
    const { customerId } = payload;

    // Get VAPI agents for this customer
    const vapiAgents = await prisma.vapiAgent.findMany({
      where: {
        customerId,
      },
      select: {
        id: true,
        name: true,
      },
    });

    // Get Retell agents for this customer
    const retellAgents = await prisma.retellAgent.findMany({
      where: {
        customerId,
      },
      select: {
        id: true,
        name: true,
      },
    });

    // Initialize empty arrays for conversations
    let vapiConversations: VapiConversation[] = [];
    let retellConversations: RetellConversation[] = [];

    // Calculate date range for fetching conversations (default to last 30 days)
    const now = new Date();
    const startDate = new Date();
    startDate.setDate(now.getDate() - 30);

    // Fetch VAPI conversations for each VAPI agent
    for (const agent of vapiAgents) {
      try {
        // Get the partner for this agent to access the API key
        const vapiAgent = await prisma.vapiAgent.findFirst({
          where: {
            id: agent.id,
            customerId,
          },
          select: {
            id: true,
            apiKey: true,
            partner: {
              select: {
                vapiApiKey: true
              }
            }
          }
        });

        // Determine which API key to use: agent's key first, then partner's key
        let decryptedApiKey: string | null = null;

        if (vapiAgent?.apiKey) {
          // Use agent's individual API key
          decryptedApiKey = await decrypt(vapiAgent.apiKey);
        } else if (vapiAgent?.partner?.vapiApiKey) {
          // Fallback to partner's API key
          decryptedApiKey = await decrypt(vapiAgent.partner.vapiApiKey);
        }

        if (decryptedApiKey) {

          // Format date for the API query parameter
          const createdAtGt = startDate.toISOString();

          // Fetch conversations from VAPI
          const response = await fetch(`https://api.vapi.ai/call?assistantId=${agent.id}&createdAtGt=${createdAtGt}`, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${decryptedApiKey}`,
            },
          });

          if (response.ok) {
            const data = await response.json();

            // Map the data to match our expected format
            const mappedData: VapiConversation[] = data.map((conv: any) => ({
              id: conv.id,
              agentId: conv.assistantId,
              startedAt: conv.startedAt || conv.createdAt,
              endedAt: conv.endedAt,
              status: conv.status,
              agent: {
                name: agent.name
              }
            }));

            vapiConversations = [...vapiConversations, ...mappedData];
          }
        }
      } catch (error) {
        console.error(`Error fetching VAPI conversations for agent ${agent.id}:`, error);
      }
    }

    // Fetch Retell conversations for each Retell agent
    for (const agent of retellAgents) {
      try {
        // Get the partner for this agent to access the API key
        const retellAgent = await prisma.retellAgent.findFirst({
          where: {
            id: agent.id,
            customerId,
          },
          select: {
            id: true,
            apiKey: true,
            partner: {
              select: {
                retellApiKey: true
              }
            }
          }
        });

        // Determine which API key to use: agent's key first, then partner's key
        let decryptedApiKey: string | null = null;

        if (retellAgent?.apiKey) {
          // Use agent's individual API key
          decryptedApiKey = await decrypt(retellAgent.apiKey);
        } else if (retellAgent?.partner?.retellApiKey) {
          // Fallback to partner's API key
          decryptedApiKey = await decrypt(retellAgent.partner.retellApiKey);
        }

        if (decryptedApiKey) {

          // Convert to Unix timestamps (milliseconds)
          const startTimestamp = startDate.getTime();
          const endTimestamp = now.getTime();

          // Prepare request body for Retell API
          const requestBody = {
            filter_criteria: {
              start_timestamp: {
                lower_threshold: startTimestamp,
                upper_threshold: endTimestamp
              },
              agent_id: [agent.id]
            },
            sort_order: "descending",
            limit: 100 // Get a reasonable number of calls
          };

          // Fetch conversations from Retell
          const response = await fetch('https://api.retellai.com/v2/list-calls', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${decryptedApiKey}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(requestBody),
          });

          if (response.ok) {
            const data = await response.json();

            // Map the data to match our expected format
            const mappedData: RetellConversation[] = data.map((conv: any) => ({
              id: conv.call_id,
              agentId: conv.agent_id,
              startTimestamp: conv.start_timestamp,
              endTimestamp: conv.end_timestamp,
              status: conv.call_status,
              agent: {
                name: agent.name
              },
              callerPhoneNumber: conv.caller_id
            }));

            retellConversations = [...retellConversations, ...mappedData];
          }
        }
      } catch (error) {
        console.error(`Error fetching Retell conversations for agent ${agent.id}:`, error);
      }
    }

    // Calculate total calls
    const totalCalls = vapiConversations.length + retellConversations.length;

    // Calculate total minutes
    let totalMinutes = 0;

    // VAPI conversations
    for (const conv of vapiConversations) {
      if (conv.startedAt && conv.endedAt) {
        const durationMs = new Date(conv.endedAt).getTime() - new Date(conv.startedAt).getTime();
        totalMinutes += durationMs / (1000 * 60);
      }
    }

    // Retell conversations
    for (const conv of retellConversations) {
      if (conv.startTimestamp && conv.endTimestamp) {
        const durationMs = conv.endTimestamp - conv.startTimestamp;
        totalMinutes += durationMs / (1000 * 60);
      }
    }

    // Round to nearest minute
    totalMinutes = Math.round(totalMinutes);

    // Calculate average call duration
    const avgDurationMinutes = totalCalls > 0 ? totalMinutes / totalCalls : 0;
    const avgMinutes = Math.floor(avgDurationMinutes);
    const avgSeconds = Math.round((avgDurationMinutes - avgMinutes) * 60);
    const averageCallDuration = `${avgMinutes}:${avgSeconds.toString().padStart(2, '0')}`;

    // Calculate calls today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    const vapiCallsToday = vapiConversations.filter(conv =>
      conv.startedAt && new Date(conv.startedAt).getTime() >= todayTimestamp
    ).length;

    const retellCallsToday = retellConversations.filter(conv =>
      conv.startTimestamp && conv.startTimestamp >= todayTimestamp
    ).length;

    const callsToday = vapiCallsToday + retellCallsToday;

    // Calculate calls this week
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekStartTimestamp = weekStart.getTime();

    const vapiCallsThisWeek = vapiConversations.filter(conv =>
      conv.startedAt && new Date(conv.startedAt).getTime() >= weekStartTimestamp
    ).length;

    const retellCallsThisWeek = retellConversations.filter(conv =>
      conv.startTimestamp && conv.startTimestamp >= weekStartTimestamp
    ).length;

    const callsThisWeek = vapiCallsThisWeek + retellCallsThisWeek;

    // Calculate calls this month
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStartTimestamp = monthStart.getTime();

    const vapiCallsThisMonth = vapiConversations.filter(conv =>
      conv.startedAt && new Date(conv.startedAt).getTime() >= monthStartTimestamp
    ).length;

    const retellCallsThisMonth = retellConversations.filter(conv =>
      conv.startTimestamp && conv.startTimestamp >= monthStartTimestamp
    ).length;

    const callsThisMonth = vapiCallsThisMonth + retellCallsThisMonth;

    // Calculate calls by agent
    const callsByAgent = [];

    // VAPI agents
    for (const agent of vapiAgents) {
      const agentCalls = vapiConversations.filter(conv => conv.agentId === agent.id);
      let agentMinutes = 0;

      for (const call of agentCalls) {
        if (call.startedAt && call.endedAt) {
          const durationMs = new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime();
          agentMinutes += durationMs / (1000 * 60);
        }
      }

      callsByAgent.push({
        name: agent.name,
        calls: agentCalls.length,
        minutes: Math.round(agentMinutes),
      });
    }

    // Retell agents
    for (const agent of retellAgents) {
      const agentCalls = retellConversations.filter(conv => conv.agentId === agent.id);
      let agentMinutes = 0;

      for (const call of agentCalls) {
        if (call.startTimestamp && call.endTimestamp) {
          const durationMs = call.endTimestamp - call.startTimestamp;
          agentMinutes += durationMs / (1000 * 60);
        }
      }

      callsByAgent.push({
        name: agent.name,
        calls: agentCalls.length,
        minutes: Math.round(agentMinutes),
      });
    }

    // Get recent calls
    const recentCalls = [];

    // Combine and sort all conversations by start time (newest first)
    const allConversations = [
      ...vapiConversations.map(conv => ({
        id: conv.id,
        agent: conv.agent.name,
        caller: 'Unknown',
        startTime: conv.startedAt ? new Date(conv.startedAt).getTime() : 0,
        endTime: conv.endedAt ? new Date(conv.endedAt).getTime() : 0,
        status: conv.status || 'Completed',
        type: 'vapi',
      })),
      ...retellConversations.map(conv => ({
        id: conv.id,
        agent: conv.agent.name,
        caller: conv.callerPhoneNumber || 'Unknown',
        startTime: conv.startTimestamp || 0,
        endTime: conv.endTimestamp || 0,
        status: conv.status || 'Completed',
        type: 'retell',
      })),
    ].sort((a, b) => b.startTime - a.startTime);

    // Take the 5 most recent calls
    for (let i = 0; i < Math.min(5, allConversations.length); i++) {
      const conv = allConversations[i];

      // Calculate duration
      let durationMinutes = 0;
      let durationSeconds = 0;

      if (conv.startTime && conv.endTime) {
        const durationMs = conv.endTime - conv.startTime;
        durationMinutes = Math.floor(durationMs / (1000 * 60));
        durationSeconds = Math.floor((durationMs % (1000 * 60)) / 1000);
      }

      // Calculate time ago
      const now = Date.now();
      const timeDiffMs = now - conv.startTime;
      const timeDiffHours = Math.floor(timeDiffMs / (1000 * 60 * 60));

      let timeAgo;
      if (timeDiffHours < 1) {
        const timeDiffMinutes = Math.floor(timeDiffMs / (1000 * 60));
        timeAgo = `${timeDiffMinutes} minute${timeDiffMinutes !== 1 ? 's' : ''} ago`;
      } else if (timeDiffHours < 24) {
        timeAgo = `${timeDiffHours} hour${timeDiffHours !== 1 ? 's' : ''} ago`;
      } else {
        const timeDiffDays = Math.floor(timeDiffHours / 24);
        timeAgo = `${timeDiffDays} day${timeDiffDays !== 1 ? 's' : ''} ago`;
      }

      recentCalls.push({
        id: conv.id,
        agent: conv.agent,
        caller: conv.caller,
        duration: `${durationMinutes}:${durationSeconds.toString().padStart(2, '0')}`,
        status: conv.status,
        time: timeAgo,
      });
    }

    return NextResponse.json({
      totalCalls,
      totalMinutes,
      averageCallDuration,
      callsToday,
      callsThisWeek,
      callsThisMonth,
      callsByAgent,
      recentCalls,
    });
  } catch (error) {
    console.error('Error fetching AI usage data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
