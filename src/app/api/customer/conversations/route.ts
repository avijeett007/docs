import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

// Default limit for Retell API calls
const DEFAULT_LIMIT = 100;
// Maximum number of pages to fetch (to prevent infinite loops)
const MAX_PAGES = 50; // This would allow fetching up to 5000 calls

// Define the type for Retell API request body
interface RetellRequestBody {
  filter_criteria: {
    start_timestamp: {
      lower_threshold: number;
      upper_threshold: number;
    };
    agent_id: string[];
  };
  sort_order: string;
  limit: number;
  pagination_key?: string;
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = getAuth(req);
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get('agentId');
    const period = searchParams.get('period') || 'month';
    const paginationKey = searchParams.get('pagination_key') || '';

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!agentId) {
      return NextResponse.json({ error: 'Agent ID is required' }, { status: 400 });
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

    // First, try to find the agent in VAPI agents
    const vapiAgent = await prisma.vapiAgent.findFirst({
      where: {
        id: agentId,
        customer: {
          userId
        }
      },
      include: {
        partner: {
          select: {
            vapiApiKey: true
          }
        }
      }
    });

    // If found in VAPI agents, fetch VAPI conversations
    if (vapiAgent) {
      if (!vapiAgent.partner?.vapiApiKey) {
        return NextResponse.json({ error: 'VAPI API key not configured' }, { status: 400 });
      }

      // Decrypt the VAPI API key
      const decryptedApiKey = await decrypt(vapiAgent.partner.vapiApiKey);

      // Format date for the API query parameter
      const createdAtGt = startDate.toISOString();

      // Fetch conversations from VAPI
      const response = await fetch(`https://api.vapi.ai/call?assistantId=${agentId}&createdAtGt=${createdAtGt}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${decryptedApiKey}`,
        },
      });

      if (!response.ok) {
        console.error(`Failed to fetch VAPI conversations: ${response.status}`);
        return NextResponse.json({ error: 'Failed to fetch VAPI conversations' }, { status: response.status });
      }

      const data = await response.json();

      // Return the conversations with metadata for time series
      return NextResponse.json({
        data,
        metadata: {
          agentType: 'vapi',
          timeField: 'createdAt',
          timeFormat: 'iso'
        }
      });
    }

    // If not found in VAPI, try Retell agents
    const retellAgent = await prisma.retellAgent.findFirst({
      where: {
        id: agentId,
        customer: {
          userId
        }
      },
      include: {
        partner: {
          select: {
            retellApiKey: true
          }
        }
      }
    });

    // If found in Retell agents, fetch Retell conversations
    if (retellAgent) {
      if (!retellAgent.partner?.retellApiKey) {
        return NextResponse.json({ error: 'Retell API key not configured' }, { status: 400 });
      }

      // Decrypt the Retell API key
      const decryptedApiKey = await decrypt(retellAgent.partner.retellApiKey);

      // Convert to Unix timestamps (milliseconds)
      const startTimestamp = startDate.getTime();
      const endTimestamp = now.getTime();

      // Prepare request body for Retell API
      const requestBody: RetellRequestBody = {
        filter_criteria: {
          start_timestamp: {
            lower_threshold: startTimestamp,
            upper_threshold: endTimestamp
          },
          agent_id: [agentId]
        },
        sort_order: "descending",
        limit: DEFAULT_LIMIT
      };

      // Add pagination key if provided
      if (paginationKey) {
        requestBody.pagination_key = paginationKey;
      }

      // Fetch all pages of conversations from Retell
      let allCalls: any[] = [];
      let currentPaginationKey = paginationKey || undefined;
      let hasMoreResults = true;
      let pageCount = 0;

      // If a specific pagination key was provided, just fetch that page
      const fetchSinglePage = !!paginationKey;

      while (hasMoreResults && pageCount < MAX_PAGES) {
        // Update request body with current pagination key
        const currentRequestBody = {
          ...requestBody,
          ...(currentPaginationKey && { pagination_key: currentPaginationKey })
        };

        const response = await fetch('https://api.retellai.com/v2/list-calls', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${decryptedApiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(currentRequestBody),
        });

        if (!response.ok) {
          console.error(`Failed to fetch Retell conversations: ${response.status}`);
          return NextResponse.json({ error: 'Failed to fetch Retell conversations' }, { status: response.status });
        }

        const pageData = await response.json();

        // Add this page of calls to our collection
        if (Array.isArray(pageData) && pageData.length > 0) {
          allCalls = [...allCalls, ...pageData];

          // Check if we need to fetch more pages
          if (pageData.length < DEFAULT_LIMIT || fetchSinglePage) {
            hasMoreResults = false;
          } else {
            // Get the last call ID to use as the next pagination key
            currentPaginationKey = pageData[pageData.length - 1].call_id;
          }
        } else {
          hasMoreResults = false;
        }

        pageCount++;
        console.log(`Fetched ${allCalls.length} calls so far (page ${pageCount})`);

        // If we're only fetching a single page, break after the first iteration
        if (fetchSinglePage) {
          break;
        }
      }

      // Determine if there might be more results available
      const hasMore = pageCount >= MAX_PAGES && hasMoreResults;

      // Get the last call ID to use as the next pagination key
      const nextPaginationKey = hasMore && allCalls.length > 0 ?
        allCalls[allCalls.length - 1].call_id : null;

      // Return the conversations with metadata for time series and pagination info
      return NextResponse.json({
        data: allCalls,
        metadata: {
          agentType: 'retell',
          timeField: 'start_timestamp',
          timeFormat: 'unix'
        },
        pagination: {
          hasMore,
          nextPaginationKey,
          totalFetched: allCalls.length,
          pagesProcessed: pageCount
        }
      });
    }

    // If agent not found in either VAPI or Retell
    return NextResponse.json({ error: 'Agent not found or not assigned to customer' }, { status: 404 });

  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}