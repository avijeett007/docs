import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyCustomerJWT } from '@/lib/customerJwt';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { logger } from '@/lib/logger';
import { traceAsync, addSpanAttributes } from '@/lib/telemetry';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

// Environment variables for analytics service (used for AI metadata enrichment)
const ANALYTICS_API_URL = process.env.ANALYTICS_API_URL;
const ANALYTICS_API_KEY = process.env.ANALYTICS_STANDARD_API_KEY;

// AI filter parameter names that trigger analytics service proxy
const AI_FILTER_PARAMS = [
  'sentiment_min', 'sentiment_max', 'outcome', 'intent',
  'follow_up_needed', 'customer_status', 'conversion_signal',
  'topic', 'customer_name', 'booking_made', 'call_type',
  'include_ai_metadata', 'include_filters_available'
] as const;

// Pagination constants for VAPI
const VAPI_DEFAULT_LIMIT = 50;
const VAPI_MAX_LIMIT = 100;

// Default limit for Retell API calls
const RETELL_DEFAULT_LIMIT = 50;
const RETELL_MAX_LIMIT = 100;
// Maximum number of pages to fetch (to prevent infinite loops) - now single page per request
const MAX_PAGES = 1;

// TypeScript interfaces
interface PaginationResponse {
  data: any[];
  metadata: {
    agentType: string;
    timeField: string;
    timeFormat: string;
  };
  pagination: {
    hasMore: boolean;
    nextPaginationKey: string | null;
    totalFetched?: number;
    pagesProcessed?: number;
  };
}

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
    // Get the customer token from cookies
    const cookieStore = cookies();
    const token = cookieStore.get('customer_token')?.value;

    if (!token) {
      logger.warn('No customer token found', {
        operation: 'whitelabel.conversations.fetch',
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the token
    const payload = await verifyCustomerJWT(token);
    if (!payload) {
      logger.warn('Invalid customer token', {
        operation: 'whitelabel.conversations.fetch',
      });
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get('agentId');
    const period = searchParams.get('period') || '7d';
    const paginationKey = searchParams.get('pagination_key') || '';
    const agentType = searchParams.get('agentType') || '';
    const rawLimit = searchParams.get('limit');

    // Parse and validate limit parameter
    const limit = rawLimit ? Math.min(parseInt(rawLimit, 10) || VAPI_DEFAULT_LIMIT, VAPI_MAX_LIMIT) : VAPI_DEFAULT_LIMIT;

    if (!agentId) {
      logger.warn('No agent ID provided', {
        customerId: payload.customerId,
        operation: 'whitelabel.conversations.fetch',
      });
      return NextResponse.json({
        error: 'Agent ID is required',
        message: 'Please select an agent to view conversations.',
        userFriendlyMessage: 'No agent selected. Please select an agent to view its conversation history.'
      }, { status: 400 });
    }

    // Calculate date range based on period
    const now = new Date();
    const startDate = new Date();
    switch (period) {
      case '1d':
      case '24h':
        startDate.setDate(now.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      default:
        // Default to 7 days if period is not recognized
        startDate.setDate(now.getDate() - 7);
    }

    // Log request with Signoz
    logger.info('Fetching conversations from provider API', {
      customerId: payload.customerId,
      agentId: agentId || 'none',
      period,
      agentType: agentType || 'auto-detect',
      limit,
      hasPaginationKey: !!paginationKey,
      operation: 'whitelabel.conversations.fetch',
    });

    addSpanAttributes({
      'customer.id': payload.customerId,
      'agent.id': agentId || 'none',
      'query.period': period,
      'query.agentType': agentType || 'auto-detect',
      'query.limit': limit,
    });

    // Check if any AI filter/metadata params are present — if so, proxy to Python analytics service
    const hasAiFilters = AI_FILTER_PARAMS.some(param => searchParams.has(param));

    if (hasAiFilters && ANALYTICS_API_URL && ANALYTICS_API_KEY) {
      logger.info('AI filters detected, proxying to analytics service', {
        customerId: payload.customerId,
        agentId,
        operation: 'whitelabel.conversations.ai_proxy',
      });

      // Build query string with all params for the Python analytics service
      const analyticsParams = new URLSearchParams();
      analyticsParams.set('period', period);
      analyticsParams.set('limit', String(limit));
      if (paginationKey) analyticsParams.set('cursor', paginationKey);

      // Forward all AI filter params
      for (const param of AI_FILTER_PARAMS) {
        const value = searchParams.get(param);
        if (value !== null) {
          analyticsParams.set(param, value);
        }
      }

      const analyticsEndpoint = `${ANALYTICS_API_URL}/api/v1/app/agent/${agentId}/conversations?${analyticsParams.toString()}`;

      try {
        const analyticsResponse = await traceAsync(
          'analytics.api.ai_filtered_conversations',
          async () => {
            return fetch(analyticsEndpoint, {
              headers: {
                'x-api-key': ANALYTICS_API_KEY!,
                'Content-Type': 'application/json',
              },
            });
          },
          { 'analytics.endpoint': analyticsEndpoint }
        );

        if (!analyticsResponse.ok) {
          logger.error('Analytics service AI filter proxy failed', undefined, {
            agentId,
            statusCode: analyticsResponse.status,
            operation: 'whitelabel.conversations.ai_proxy',
          });
          // Fall through to direct provider API if analytics service fails
        } else {
          const analyticsData = await analyticsResponse.json();

          logger.info('Successfully fetched AI-filtered conversations from analytics service', {
            agentId,
            count: analyticsData.conversations?.length || 0,
            hasFiltersAvailable: !!analyticsData.filters_available,
            operation: 'whitelabel.conversations.ai_proxy',
          });

          // Transform analytics service response to match PaginationResponse format
          const conversations = analyticsData.conversations || [];
          const result: PaginationResponse & { ai_metadata?: boolean; filters_available?: any } = {
            data: conversations,
            metadata: {
              agentType: agentType || 'analytics',
              timeField: 'timestamp',
              timeFormat: 'iso',
            },
            pagination: {
              hasMore: analyticsData.has_more || false,
              nextPaginationKey: analyticsData.next_cursor || null,
              totalFetched: conversations.length,
            },
          };

          // Include AI metadata flag and available filters if requested
          if (searchParams.get('include_ai_metadata') === 'true') {
            result.ai_metadata = true;
          }
          if (analyticsData.filters_available) {
            result.filters_available = analyticsData.filters_available;
          }

          return NextResponse.json(result);
        }
      } catch (error) {
        logger.error('Error proxying to analytics service for AI filters', error as Error, {
          agentId,
          operation: 'whitelabel.conversations.ai_proxy',
        });
        // Fall through to direct provider API
      }
    }

    // If agent type is specified as 'vapi' or not specified, try VAPI conversations first
    if (agentType === 'vapi' || !agentType) {
      const vapiAgent = await traceAsync(
        'db.lookup_vapi_agent',
        async () => {
          return prisma.vapiAgent.findFirst({
            where: {
              id: agentId,
              customer: {
                id: payload.customerId
              }
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
        },
        { 'db.table': 'vapiAgent', 'agent.id': agentId }
      );

      logger.debug('VAPI agent lookup', {
        agentId,
        found: !!vapiAgent,
        operation: 'whitelabel.conversations.fetch',
      });

      if (!vapiAgent) {
        logger.info('VAPI agent not found, trying Retell', {
          agentId,
          customerId: payload.customerId,
          explicitType: agentType === 'vapi',
          operation: 'whitelabel.conversations.fetch',
        });

        // If agent type was explicitly specified as VAPI, return error
        if (agentType === 'vapi') {
          return NextResponse.json({
            error: 'VAPI agent not found or not assigned to customer',
            message: 'The requested VAPI agent was not found or is not assigned to this customer.',
            userFriendlyMessage: 'The selected voice agent could not be found. Please try another agent or contact support.'
          }, { status: 404 });
        }
      } else {
        // VAPI agent found, determine which API key to use
        let decryptedApiKey: string | null = null;

        if (vapiAgent.apiKey) {
          // Use agent's individual API key
          decryptedApiKey = await decrypt(vapiAgent.apiKey);
        } else if (vapiAgent.partner?.vapiApiKey) {
          // Fallback to partner's API key
          decryptedApiKey = await decrypt(vapiAgent.partner.vapiApiKey);
        }

        if (!decryptedApiKey) {
          logger.error('VAPI API key not configured', undefined, {
            agentId,
            customerId: payload.customerId,
            operation: 'whitelabel.conversations.fetch',
          });
          return NextResponse.json({
            error: 'VAPI API key not configured',
            message: 'Neither agent-specific nor partner API key found for VAPI.',
            userFriendlyMessage: 'We\'re having trouble connecting to the voice service. Please contact support for assistance.'
          }, { status: 400 });
        }

        // Format date for the API query parameter
        const createdAtGt = startDate.toISOString();

        // Build VAPI API URL with pagination support
        let vapiUrl = `https://api.vapi.ai/call?assistantId=${agentId}&createdAtGt=${createdAtGt}&limit=${limit}`;
        
        // Add pagination cursor if provided (VAPI uses createdAtLt for cursor-based pagination)
        if (paginationKey) {
          vapiUrl += `&createdAtLt=${paginationKey}`;
        }

        // Fetch conversations from VAPI with tracing
        const response = await traceAsync(
          'vapi.api.fetch_calls',
          async () => {
            return fetch(vapiUrl, {
              method: 'GET',
              headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${decryptedApiKey}`,
              },
            });
          },
          {
            'vapi.agent_id': agentId,
            'vapi.limit': limit,
            'vapi.has_cursor': !!paginationKey,
          }
        );

        if (!response.ok) {
          logger.error('Failed to fetch VAPI conversations', undefined, {
            agentId,
            customerId: payload.customerId,
            statusCode: response.status,
            operation: 'whitelabel.conversations.fetch',
          });

          addSpanAttributes({
            'error': true,
            'error.status': response.status,
            'error.provider': 'vapi',
          });

          // If agent type was explicitly specified as VAPI, return error
          if (agentType === 'vapi') {
            return NextResponse.json({
              error: 'Failed to fetch VAPI conversations',
              message: `Failed to fetch VAPI conversations: ${response.status}`,
              userFriendlyMessage: 'We encountered an issue while retrieving your conversation history. Please try again later or contact support if the problem persists.'
            }, { status: response.status });
          }
        } else {
          const data = await response.json();
          
          // Determine pagination info
          // VAPI returns calls in descending order by createdAt
          // If we got a full page, there might be more
          const hasMore = data.length >= limit;
          const nextPaginationKey = hasMore && data.length > 0 
            ? data[data.length - 1].createdAt // Use last item's createdAt as cursor
            : null;

          logger.info('Successfully fetched VAPI conversations', {
            agentId,
            customerId: payload.customerId,
            count: data.length,
            hasMore,
            limit,
            operation: 'whitelabel.conversations.fetch',
          });

          addSpanAttributes({
            'response.count': data.length,
            'response.hasMore': hasMore,
            'response.provider': 'vapi',
          });

          // Return the conversations with metadata and pagination info
          const result: PaginationResponse = {
            data,
            metadata: {
              agentType: 'vapi',
              timeField: 'createdAt',
              timeFormat: 'iso'
            },
            pagination: {
              hasMore,
              nextPaginationKey,
              totalFetched: data.length,
            }
          };

          return NextResponse.json(result);
        }
      }
    }

    // If agent type is specified as 'retell' or not specified, try Retell agents
    const retellAgent = await traceAsync(
      'db.lookup_retell_agent',
      async () => {
        return prisma.retellAgent.findFirst({
          where: {
            id: agentId,
            customer: {
              id: payload.customerId
            }
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
      },
      { 'db.table': 'retellAgent', 'agent.id': agentId }
    );

    logger.debug('Retell agent lookup', {
      agentId,
      found: !!retellAgent,
      operation: 'whitelabel.conversations.fetch',
    });

    // If found in Retell agents, fetch Retell conversations
    if (retellAgent) {
      // Determine which API key to use: agent's key first, then partner's key
      let decryptedApiKey: string | null = null;

      if (retellAgent.apiKey) {
        // Use agent's individual API key
        decryptedApiKey = await decrypt(retellAgent.apiKey);
      } else if (retellAgent.partner?.retellApiKey) {
        // Fallback to partner's API key
        decryptedApiKey = await decrypt(retellAgent.partner.retellApiKey);
      }

      if (!decryptedApiKey) {
        logger.error('Retell API key not configured', undefined, {
          agentId,
          customerId: payload.customerId,
          operation: 'whitelabel.conversations.fetch',
        });
        return NextResponse.json({
          error: 'Retell API key not configured',
          message: 'Neither agent-specific nor partner API key found for Retell.',
          userFriendlyMessage: 'We\'re having trouble connecting to the voice service. Please contact support for assistance.'
        }, { status: 400 });
      }

      // Convert to Unix timestamps (milliseconds)
      const startTimestamp = startDate.getTime();
      const endTimestamp = now.getTime();

      // Use validated limit for Retell
      const retellLimit = Math.min(limit, RETELL_MAX_LIMIT);

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
        limit: retellLimit
      };

      // Add pagination key if provided
      if (paginationKey) {
        requestBody.pagination_key = paginationKey;
      }

      // Fetch single page of conversations from Retell with tracing
      const response = await traceAsync(
        'retell.api.list_calls',
        async () => {
          return fetch('https://api.retellai.com/v2/list-calls', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${decryptedApiKey}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(requestBody),
          });
        },
        {
          'retell.agent_id': agentId,
          'retell.limit': retellLimit,
          'retell.has_cursor': !!paginationKey,
        }
      );

      if (!response.ok) {
        logger.error('Failed to fetch Retell conversations', undefined, {
          agentId,
          customerId: payload.customerId,
          statusCode: response.status,
          operation: 'whitelabel.conversations.fetch',
        });

        addSpanAttributes({
          'error': true,
          'error.status': response.status,
          'error.provider': 'retell',
        });

        return NextResponse.json({ error: 'Failed to fetch Retell conversations' }, { status: response.status });
      }

      const pageData = await response.json();

      // Determine pagination info
      // Retell returns calls array, check if we got a full page
      const calls = Array.isArray(pageData) ? pageData : [];
      const hasMore = calls.length >= retellLimit;
      const nextPaginationKey = hasMore && calls.length > 0 
        ? calls[calls.length - 1].call_id 
        : null;

      logger.info('Successfully fetched Retell conversations', {
        agentId,
        customerId: payload.customerId,
        count: calls.length,
        hasMore,
        limit: retellLimit,
        operation: 'whitelabel.conversations.fetch',
      });

      addSpanAttributes({
        'response.count': calls.length,
        'response.hasMore': hasMore,
        'response.provider': 'retell',
      });

      // Return the conversations with metadata for time series and pagination info
      const result: PaginationResponse = {
        data: calls,
        metadata: {
          agentType: 'retell',
          timeField: 'start_timestamp',
          timeFormat: 'unix'
        },
        pagination: {
          hasMore,
          nextPaginationKey,
          totalFetched: calls.length,
          pagesProcessed: 1
        }
      };

      return NextResponse.json(result);
    }

    // If agent not found in either VAPI or Retell
    logger.error('Agent not found in any provider', undefined, {
      agentId,
      customerId: payload.customerId,
      agentType: agentType || 'auto-detect',
      operation: 'whitelabel.conversations.fetch',
    });

    addSpanAttributes({
      'error': true,
      'error.type': 'agent_not_found',
    });

    // If agent type was explicitly specified, provide a more specific error
    if (agentType === 'retell') {
      return NextResponse.json({
        error: 'Retell agent not found or not assigned to customer',
        message: 'The requested Retell agent was not found or is not assigned to this customer.',
        userFriendlyMessage: 'The selected voice agent could not be found. Please try another agent or contact support.'
      }, { status: 404 });
    } else {
      return NextResponse.json({
        error: 'Agent not found or not assigned to customer',
        message: 'The requested agent was not found or is not assigned to this customer.',
        userFriendlyMessage: 'The selected voice agent could not be found. Please try another agent or contact support.'
      }, { status: 404 });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error('Error fetching conversations', error as Error, {
      operation: 'whitelabel.conversations.fetch',
      errorMessage,
    });

    addSpanAttributes({
      'error': true,
      'error.message': errorMessage,
    });

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'An unexpected error occurred while fetching conversations.',
        userFriendlyMessage: 'We encountered an issue while retrieving your conversation history. Please try again later or contact support if the problem persists.'
      },
      { status: 500 }
    );
  }
}
