import { NextResponse, NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { verifyCustomerJWT } from '@/lib/customerJwt';
import { logger } from '@/lib/logger';
import { traceAsync, addSpanAttributes } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

const ANALYTICS_API_URL = process.env.ANALYTICS_API_URL;
const ANALYTICS_API_KEY = process.env.ANALYTICS_STANDARD_API_KEY;

// Pagination constants
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const MIN_LIMIT = 10;

// TypeScript interfaces
interface PaginationParams {
  limit: number;
  offset: number;
  cursor?: string;
}

interface AnalyticsResponse {
  conversations?: any[];
  data?: any[];
  has_more?: boolean;
  pagination?: {
    hasMore?: boolean;
    nextCursor?: string;
    total?: number;
    totalCount?: number;
  };
  total?: number;
  count?: number;
}

interface ConversationResponse {
  data: any[];
  metadata: {
    agentType: string;
    timeField: string;
    timeFormat: string;
  };
  pagination: {
    hasMore: boolean;
    nextPaginationKey: string | null;
    totalCount?: number;
  };
}

// Note: This endpoint only uses V1 analytics as V2 doesn't support conversations endpoints

export async function GET(request: NextRequest) {
  try {
    // Check if analytics service is configured
    if (!ANALYTICS_API_URL || !ANALYTICS_API_KEY) {
      return NextResponse.json({ error: 'Analytics service not configured' }, { status: 503 });
    }

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

    // Parse query params with validation
    const searchParams = request.nextUrl.searchParams;
    const agentId = searchParams.get('agentId');
    const rawPeriod = searchParams.get('period') || '7d';
    const rawLimit = searchParams.get('limit');
    const cursor = searchParams.get('pagination_key');

    // Validate and sanitize limit parameter
    let limit = DEFAULT_LIMIT;
    if (rawLimit) {
      const parsedLimit = parseInt(rawLimit, 10);
      if (!isNaN(parsedLimit)) {
        limit = Math.max(MIN_LIMIT, Math.min(parsedLimit, MAX_LIMIT));
      }
    }

    const paginationParams: PaginationParams = {
      limit,
      offset: cursor && !isNaN(parseInt(cursor, 10)) ? parseInt(cursor, 10) : 0,
      cursor: cursor || undefined,
    };

    // Convert period format for analytics service compatibility
    // Frontend sends: 'day', 'week', 'month'
    // Analytics service expects: '1d', '7d', '30d', '90d'
    let period = rawPeriod;
    if (rawPeriod === 'day') {
      period = '1d';
    } else if (rawPeriod === 'week') {
      period = '7d';
    } else if (rawPeriod === 'month') {
      period = '30d';
    } else if (rawPeriod === 'quarter') {
      period = '90d';
    }
    // If already in correct format (1d, 7d, 30d, 90d), keep as is

    // Log request with Signoz
    logger.info('Fetching conversations from analytics service', {
      customerId,
      agentId: agentId || 'all',
      period,
      limit: paginationParams.limit,
      offset: paginationParams.offset,
      hasCursor: !!cursor,
      operation: 'whitelabel.analytics.conversations.fetch',
    });

    addSpanAttributes({
      'customer.id': customerId,
      'agent.id': agentId || 'all',
      'query.period': period,
      'query.limit': paginationParams.limit,
      'query.offset': paginationParams.offset,
    });

    let endpoint: string;
    let queryString = `period=${period}&limit=${paginationParams.limit}`;
    if (paginationParams.cursor) queryString += `&cursor=${paginationParams.cursor}`;

    // Check if this is for a chat agent by looking up the agent type
    let isN8nChatAgent = false;
    let isRetellChatAgent = false;
    let isChatAgent = false;
    if (agentId) {
      try {
        const { prisma } = await import('@/lib/prisma');
        const [n8nAgent, retellChatAgent] = await Promise.all([
          prisma.n8nChatAgent.findFirst({ where: { id: agentId } }),
          prisma.retellChatAgent.findFirst({ where: { id: agentId } })
        ]);
        isN8nChatAgent = !!n8nAgent;
        isRetellChatAgent = !!retellChatAgent;
        isChatAgent = isN8nChatAgent || isRetellChatAgent;
      } catch (error) {
        console.warn('Could not determine agent type, defaulting to voice agent:', error);
      }
    }

    if (agentId) {
      if (isChatAgent) {
        // Use new conversations API for chat agents (N8N Chat and Retell Chat)
        const startDate = new Date();
        const endDate = new Date();

        // Convert period to date range
        const periodDays = period === '1d' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 7;
        startDate.setDate(startDate.getDate() - periodDays);

        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        endpoint = `${ANALYTICS_API_URL}/api/conversations/agent/${agentId}?start_date=${startDateStr}&end_date=${endDateStr}&limit=${paginationParams.limit}&offset=${paginationParams.offset}`;
      } else {
        // Get conversations for voice agents (V1 API)
        endpoint = `${ANALYTICS_API_URL}/api/v1/app/agent/${agentId}/conversations?${queryString}`;
      }
    } else {
      // Get aggregated conversations for customer (V1 API for now)
      endpoint = `${ANALYTICS_API_URL}/api/v1/app/customer/${customerId}/conversations?${queryString}`;
    }

    // Make request to analytics service with tracing
    const response = await traceAsync(
      'analytics.api.fetch_conversations',
      async () => {
        return fetch(endpoint, {
          headers: {
            'x-api-key': ANALYTICS_API_KEY!,
            'Content-Type': 'application/json',
          },
        });
      },
      {
        'analytics.endpoint': endpoint,
        'analytics.agent_type': isChatAgent ? 'chat' : 'voice',
      }
    );

    if (!response.ok) {
      const errorMsg = `Analytics service error: ${response.status}`;
      logger.error(errorMsg, undefined, {
        customerId,
        agentId: agentId || 'all',
        statusCode: response.status,
        endpoint,
        operation: 'whitelabel.analytics.conversations.fetch',
      });

      addSpanAttributes({
        'error': true,
        'error.status': response.status,
      });

      // Return empty conversations instead of error
      return NextResponse.json({
        data: [],
        metadata: {
          agentType: 'analytics',
          timeField: 'timestamp',
          timeFormat: 'iso',
        },
        pagination: {
          hasMore: false,
          nextPaginationKey: null,
          totalCount: 0,
        },
      });
    }

    const conversationsData: AnalyticsResponse = await response.json();

    if (!conversationsData) {
      logger.warn('No conversations data received from service', {
        customerId,
        agentId: agentId || 'all',
        operation: 'whitelabel.analytics.conversations.fetch',
      });

      return NextResponse.json({
        data: [],
        metadata: {
          agentType: 'analytics',
          timeField: 'timestamp',
          timeFormat: 'iso',
        },
        pagination: {
          hasMore: false,
          nextPaginationKey: null,
          totalCount: 0,
        },
      });
    }

    // Handle different API response formats
    let conversations: any[] = [];
    let hasMore = false;
    let nextPaginationKey: string | null = null;
    let totalCount: number | undefined = undefined;

    if (isChatAgent && conversationsData.conversations) {
      // New conversations API format (N8N Chat and Retell Chat)
      conversations = conversationsData.conversations;
      hasMore = conversationsData.has_more || false;
      totalCount = conversationsData.total || conversationsData.count;
      
      // Fallback: if we got a full page, assume there might be more
      if (!hasMore && conversations.length >= paginationParams.limit) {
        hasMore = true;
        logger.debug('Applied hasMore fallback (chat agent)', {
          conversationCount: conversations.length,
          limit: paginationParams.limit,
          operation: 'whitelabel.analytics.conversations.fetch',
        });
      }
      
      nextPaginationKey = hasMore ? String(paginationParams.offset + paginationParams.limit) : null;
    } else {
      // Legacy V1 API format
      conversations = conversationsData.conversations || conversationsData.data || [];
      hasMore = conversationsData.pagination?.hasMore || false;
      nextPaginationKey = conversationsData.pagination?.nextCursor || null;
      totalCount = conversationsData.pagination?.totalCount || conversationsData.pagination?.total || conversationsData.total || conversationsData.count;
      
      // Fallback: if we got a full page, assume there might be more
      if (!hasMore && conversations.length >= paginationParams.limit) {
        hasMore = true;
        // For cursor-based pagination, use the last conversation's timestamp or ID
        if (conversations.length > 0) {
          const lastConv = conversations[conversations.length - 1];
          nextPaginationKey = lastConv.createdAt || lastConv.startedAt || lastConv.id;
        }
        logger.debug('Applied hasMore fallback (voice agent)', {
          conversationCount: conversations.length,
          limit: paginationParams.limit,
          nextCursor: nextPaginationKey,
          operation: 'whitelabel.analytics.conversations.fetch',
        });
      }
    }

    // Transform conversations to match expected format
    const transformedConversations = conversations.map((conv: any) => {
      let startedAt, endedAt, duration = 0;

      if (isChatAgent && conversationsData.conversations) {
        // New conversations API format for chat agents (N8N Chat and Retell Chat)
        startedAt = conv.started_at || new Date().toISOString();
        endedAt = conv.ended_at || startedAt;
        duration = conv.duration_seconds || 0;

        return {
          id: conv.id,
          assistantId: conv.agent_id || agentId || '',
          type: conv.type || 'chat_conversation',
          startedAt,
          endedAt,
          transcript: conv.transcript || '',
          recordingUrl: conv.recordingUrl || '',
          stereoRecordingUrl: conv.stereoRecordingUrl || '',
          summary: conv.summary || `Chat conversation with ${conv.message_count || 0} messages`,
          createdAt: startedAt,
          updatedAt: endedAt,
          cost: conv.cost || 0,
          status: conv.status || 'completed',
          endedReason: conv.status || 'completed',
          messages: [],
          duration,
          // Additional data from analytics
          sentiment: conv.sentiment || null,
          topics: [],
          // Chat-specific fields
          messageCount: conv.message_count || 0,
          provider: conv.provider || (isRetellChatAgent ? 'retell_chat' : 'n8n_chat')
        };
      } else {
        // Legacy V1 API format for voice agents
        // Safely handle date parsing - analytics service returns startedAt and endedAt
        startedAt = conv.startedAt || conv.timestamp || conv.createdAt;
        endedAt = conv.endedAt;

        try {
          // Ensure startedAt is a valid ISO string
          if (startedAt) {
            const startTime = typeof startedAt === 'number' ? new Date(startedAt) : new Date(startedAt);
            if (!isNaN(startTime.getTime())) {
              startedAt = startTime.toISOString();
            } else {
              // Use webhook creation time as fallback - this is closer to actual call time
              console.warn('Invalid timestamp for conversation:', conv.id, 'startedAt:', startedAt, 'using webhook creation time as fallback');
              startedAt = conv.webhook_created_at || conv.created_at || new Date().toISOString();
            }
          } else {
            // Use webhook creation time as fallback - this is closer to actual call time
            console.warn('Missing timestamp for conversation:', conv.id, 'using webhook creation time as fallback');
            startedAt = conv.webhook_created_at || conv.created_at || new Date().toISOString();
          }

          // Ensure endedAt is a valid ISO string
          if (endedAt) {
            const endTime = typeof endedAt === 'number' ? new Date(endedAt) : new Date(endedAt);
            if (!isNaN(endTime.getTime())) {
              endedAt = endTime.toISOString();
            } else {
              // Calculate endedAt from startedAt + duration if available
              if (conv.duration) {
                endedAt = new Date(new Date(startedAt).getTime() + (conv.duration * 1000)).toISOString();
              } else {
                endedAt = startedAt;
              }
            }
          } else {
            // Calculate endedAt from startedAt + duration if available
            if (conv.duration) {
              endedAt = new Date(new Date(startedAt).getTime() + (conv.duration * 1000)).toISOString();
            } else {
              endedAt = startedAt;
            }
          }
        } catch (error) {
          console.warn('Error parsing conversation dates:', error, {
            startedAt: conv.startedAt,
            endedAt: conv.endedAt,
            duration: conv.duration
          });
          // Use webhook creation time as fallback - this is closer to actual call time
          const fallbackTime = conv.webhook_created_at || conv.created_at || new Date().toISOString();
          startedAt = fallbackTime;
          endedAt = fallbackTime;
        }

        // Extract call direction and phone number information
        // Analytics service returns these fields at the root level
        const callDirection = conv.direction || null;
        const fromNumber = conv.fromNumber || null;
        const toNumber = conv.toNumber || null;
        const callMedium = conv.callType || conv.type || 'call';

        // Calculate duration: prefer explicit duration field, fall back to timestamp diff
        if (conv.duration && conv.duration > 0) {
          duration = conv.duration;
        } else if (conv.duration_seconds && conv.duration_seconds > 0) {
          duration = conv.duration_seconds;
        } else if (conv.duration_ms && conv.duration_ms > 0) {
          duration = Math.round(conv.duration_ms / 1000);
        } else if (startedAt && endedAt && startedAt !== endedAt) {
          // Calculate from parsed timestamps as fallback
          const diffMs = new Date(endedAt).getTime() - new Date(startedAt).getTime();
          if (diffMs > 0) {
            duration = Math.round(diffMs / 1000);
          }
        }

        return {
          id: conv.id,
          assistantId: conv.assistantId || agentId || '', // Use assistantId from analytics service
          type: conv.type || 'call',
          startedAt,
          endedAt,
          transcript: conv.transcript || '', // Analytics service provides full transcript
          recordingUrl: conv.recordingUrl || '', // Analytics service provides recording URL
          stereoRecordingUrl: conv.stereoRecordingUrl || '',
          summary: conv.summary || '',
          createdAt: startedAt,
          updatedAt: startedAt,
          cost: conv.cost || 0,
          status: conv.status || 'completed',
          endedReason: conv.endedReason || conv.outcome || 'completed',
          messages: conv.messages || [], // Analytics service provides full message array
          duration,
          // Additional analytics service data
          sentiment: conv.sentiment,
          topics: conv.topics || [],
          // New call direction and phone number fields
          direction: callDirection,
          fromNumber: fromNumber,
          toNumber: toNumber,
          callType: callMedium,
          // Audio processing status for async audio processing
          audioProcessingStatus: conv.audioProcessingStatus || null
        };
      }
    });

    const result: ConversationResponse = {
      data: transformedConversations,
      metadata: {
        agentType: isRetellChatAgent ? 'retell_chat' : isN8nChatAgent ? 'n8n_chat' : 'analytics',
        timeField: 'timestamp',
        timeFormat: 'iso',
      },
      pagination: {
        hasMore,
        nextPaginationKey,
        totalCount,
      },
    };

    // Log success with Signoz
    logger.info('Successfully loaded conversations from analytics service', {
      customerId,
      agentId: agentId || 'all',
      count: transformedConversations.length,
      hasMore: result.pagination.hasMore,
      totalCount: totalCount || 0,
      limit: paginationParams.limit,
      offset: paginationParams.offset,
      operation: 'whitelabel.analytics.conversations.fetch',
    });

    addSpanAttributes({
      'response.count': transformedConversations.length,
      'response.hasMore': hasMore,
      'response.totalCount': totalCount || 0,
    });

    // Add cache-busting headers to ensure fresh conversation data
    const nextResponse = NextResponse.json(result);
    nextResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    nextResponse.headers.set('Pragma', 'no-cache');
    nextResponse.headers.set('Expires', '0');
    return nextResponse;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error('Error fetching conversations from analytics service', error as Error, {
      operation: 'whitelabel.analytics.conversations.fetch',
      errorMessage,
    });

    addSpanAttributes({
      'error': true,
      'error.message': errorMessage,
    });
    
    // Return empty conversations instead of error
    return NextResponse.json({
      data: [],
      metadata: {
        agentType: 'analytics',
        timeField: 'timestamp',
        timeFormat: 'iso',
      },
      pagination: {
        hasMore: false,
        nextPaginationKey: null,
        totalCount: 0,
      },
    });
  }
}
