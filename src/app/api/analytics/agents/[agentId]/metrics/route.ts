export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Validation schemas
const MetricConfigSchema = z.object({
  metricName: z.string().min(1, 'Metric name is required'),
  metricType: z.enum(['boolean', 'string', 'number']).default('boolean'),
  description: z.string().min(1, 'Description is required'),
  enabledForBilling: z.boolean().default(false),
  exampleValues: z.array(z.string()).default([]),
  selectedPlanId: z.string().optional(),
  priority: z.number().int().min(1).default(1),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});

const MeteredMetricsConfigSchema = z.object({
  metrics: z.array(MetricConfigSchema).default([])
});

const AgentMetricsUpdateSchema = z.object({
  metered_metrics: MeteredMetricsConfigSchema
});

type AgentMetricsUpdate = z.infer<typeof AgentMetricsUpdateSchema>;

// Helper function to call analytics service
async function callAnalyticsService(
  method: 'GET' | 'PUT',
  agentId: string,
  provider?: string,
  data?: any
) {
  const analyticsApiUrl = process.env.ANALYTICS_API_URL || 'http://localhost:8001';
  const analyticsApiKey = process.env.ANALYTICS_API_KEY;

  console.log('🔗 Analytics service config:', {
    url: analyticsApiUrl,
    hasApiKey: !!analyticsApiKey,
    method,
    agentId,
    provider
  });

  if (!analyticsApiKey) {
    throw new Error('Analytics API key not configured');
  }

  const url = new URL(`/agents/${agentId}/metrics`, analyticsApiUrl);
  if (provider) {
    url.searchParams.set('provider', provider);
  }
  // Add timestamp for cache busting
  url.searchParams.set('_t', Date.now().toString());

  console.log('📡 Calling analytics service:', url.toString());



  const requestBody = data ? JSON.stringify(data) : undefined;

  if (requestBody) {
    console.log('📤 Request body to analytics service:', requestBody);
  }

  const response = await fetch(url.toString(), {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': analyticsApiKey,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    },
    body: requestBody,
    cache: 'no-store'
  });

  console.log('📥 Analytics service response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { detail: errorText };
    }

    console.error('Analytics service error response:', {
      status: response.status,
      statusText: response.statusText,
      errorData,
      errorText
    });

    throw new Error(errorData.detail || `Analytics service error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

export async function GET(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    // Verify partner authentication
    const partner = await verifyPartnerJWT(request);
    if (!partner) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { agentId } = params;
    const provider = request.nextUrl.searchParams.get('provider');

    // Call analytics service to get agent metrics
    try {
      const analyticsResponse = await callAnalyticsService('GET', agentId, provider || undefined);
      const extractedMetrics = analyticsResponse.metered_metrics?.metrics || [];

      return NextResponse.json({
        success: true,
        agentId,
        provider: analyticsResponse.provider,
        metrics: extractedMetrics
      });
    } catch (error) {
      // Fallback: Query Supabase directly when analytics service is not available
      console.error('❌ Analytics service error details:', {
        error: error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        analyticsUrl: process.env.ANALYTICS_API_URL,
        analyticsKey: process.env.ANALYTICS_API_KEY ? 'SET' : 'NOT SET'
      });
      console.warn('⚠️ Analytics service not available, using direct Supabase fallback');

      try {
        // Direct Supabase query as fallback
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        console.log('🔄 Querying Supabase directly for agent metrics...');

        // Query the agent directly from Supabase
        const { data: agents, error: agentError } = await supabase
          .from('agents')
          .select('*')
          .eq('agent_id', agentId);

        if (agentError) {
          console.error('❌ Supabase agent query error:', agentError);
          throw agentError;
        }

        if (!agents || agents.length === 0) {
          console.log('❌ Agent not found in Supabase');
          return NextResponse.json({
            success: false,
            error: 'Agent not found'
          }, { status: 404 });
        }

        // Filter by provider if specified
        let agent = agents[0];
        if (provider) {
          const matchingAgent = agents.find(a =>
            a.provider?.toLowerCase() === provider.toLowerCase()
          );
          if (matchingAgent) {
            agent = matchingAgent;
          } else {
            console.log(`❌ No agent found with provider ${provider}`);
            return NextResponse.json({
              success: false,
              error: `Agent not found for provider ${provider}`
            }, { status: 404 });
          }
        }

        console.log('✅ Found agent in Supabase:', {
          id: agent.id,
          agent_id: agent.agent_id,
          provider: agent.provider,
          name: agent.agent_name
        });

        // Extract metrics configuration
        const metered_metrics = agent.metered_metrics || { metrics: [] };
        const metrics = metered_metrics.metrics || [];

        console.log('📊 Direct Supabase metrics:', {
          metered_metrics_type: typeof metered_metrics,
          metrics_count: metrics.length,
          metrics: metrics
        });

        return NextResponse.json({
          success: true,
          agentId,
          provider: agent.provider,
          metrics: metrics
        });

      } catch (fallbackError) {
        console.error('❌ Supabase fallback also failed:', fallbackError);
        return NextResponse.json({
          success: false,
          error: 'Both analytics service and fallback failed',
          details: {
            analyticsError: error instanceof Error ? error.message : 'Unknown error',
            fallbackError: fallbackError instanceof Error ? fallbackError.message : 'Unknown error'
          }
        }, { status: 500 });
      }
    }

  } catch (error) {
    console.error('Error fetching agent metrics:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch agent metrics',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    // Verify partner authentication
    const partner = await verifyPartnerJWT(request);
    if (!partner) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { agentId } = params;
    const provider = request.nextUrl.searchParams.get('provider');

    // Parse and validate request body
    const body = await request.json();
    const validatedData = AgentMetricsUpdateSchema.parse(body);

    // Get agent details to find customer and partner info
    let agentData: any = null;
    try {
      // Try to get agent from main database first
      if (provider === 'vapi') {
        agentData = await prisma.vapiAgent.findUnique({
          where: { id: agentId },
          select: {
            id: true,
            customerId: true,
            partnerId: true,
            name: true,
          },
        });
      } else if (provider === 'retell') {
        agentData = await prisma.retellAgent.findUnique({
          where: { id: agentId },
          select: {
            id: true,
            customerId: true,
            partnerId: true,
            name: true,
          },
        });
      } else if (provider === 'ultravox') {
        agentData = await prisma.ultravoxAgent.findUnique({
          where: { id: agentId },
          select: {
            id: true,
            customerId: true,
            partnerId: true,
            name: true,
          },
        });
      } else if (provider === 'knova') {
        agentData = await prisma.knovaAgent.findUnique({
          where: { id: agentId },
          select: {
            id: true,
            customerId: true,
            partnerId: true,
            name: true,
          },
        });
      } else if (provider === 'ghl') {
        agentData = await prisma.ghlAgent.findUnique({
          where: { id: agentId },
          select: {
            id: true,
            customerId: true,
            partnerId: true,
            name: true,
          },
        });
      }
    } catch (error) {
      console.warn('Could not fetch agent from main database:', error);
    }

    // Enrich metrics with subscription data for billing-enabled metrics
    if (agentData && agentData.customerId) {
      const enrichedMetrics = await Promise.all(
        validatedData.metered_metrics.metrics.map(async (metric: any) => {
          // Always preserve selectedPlanId, even if billing is disabled
          const enrichedMetric = { ...metric };

          if (metric.selectedPlanId) {
            try {
              // Find the subscription for this plan and customer
              const subscription = await prisma.customerMeteredSubscription.findFirst({
                where: {
                  customerId: agentData.customerId,
                  planId: metric.selectedPlanId,
                  status: {
                    in: ['active', 'paused'],
                  },
                },
              });

              if (subscription) {
                // Add subscription info to metric for analytics storage
                enrichedMetric.subscriptionId = subscription.id;

                // Only create/update mapping if billing is enabled
                if (metric.enabledForBilling) {
                  const existingMapping = await prisma.agentMeteredSubscriptionMapping.findFirst({
                    where: {
                      agentId,
                      agentType: provider || 'unknown',
                      subscriptionId: subscription.id,
                    },
                  });

                  if (existingMapping) {
                    console.log('📝 Updating existing mapping:', existingMapping.id);
                    await prisma.agentMeteredSubscriptionMapping.update({
                      where: { id: existingMapping.id },
                      data: { metricConfigs: validatedData.metered_metrics.metrics },
                    });
                  } else {
                    console.log('🆕 Creating new mapping for agent:', agentId, 'subscription:', subscription.id);
                    await prisma.agentMeteredSubscriptionMapping.create({
                      data: {
                        agentId,
                        agentType: provider || 'unknown',
                        subscriptionId: subscription.id,
                        planId: metric.selectedPlanId,
                        customerId: agentData.customerId,
                        partnerId: agentData.partnerId,
                        metricConfigs: validatedData.metered_metrics.metrics,
                        createdBy: partner.payload?.partnerId || 'unknown',
                      },
                    });
                  }
                }
              }
            } catch (error) {
              console.error('Error processing subscription mapping:', error);
            }
          }

          return enrichedMetric;
        })
      );

      // Update the validated data with enriched metrics
      validatedData.metered_metrics.metrics = enrichedMetrics;
    }

    // Call analytics service to update agent metrics with enriched data
    console.log('📤 Sending enriched metrics to analytics service:', JSON.stringify(validatedData.metered_metrics, null, 2));

    try {
      const analyticsResponse = await callAnalyticsService(
        'PUT',
        agentId,
        provider || undefined,
        validatedData // This now contains enriched metrics with subscriptionId
      );

      return NextResponse.json({
        success: true,
        message: 'Agent metrics updated successfully',
        agentId,
        provider: analyticsResponse.provider,
        metrics: analyticsResponse.metered_metrics?.metrics || []
      });
    } catch (error) {
      // Fallback: Update Supabase directly when analytics service is not available
      console.error('❌ Analytics service save error details:', {
        error: error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        analyticsUrl: process.env.ANALYTICS_API_URL,
        analyticsKey: process.env.ANALYTICS_API_KEY ? 'SET' : 'NOT SET'
      });
      console.warn('⚠️ Analytics service not available for save, using direct Supabase fallback');

      try {
        // Direct Supabase update as fallback
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        console.log('🔄 Updating Supabase directly with enriched metrics data...');
        console.log('📊 Enriched metrics data:', JSON.stringify(validatedData.metered_metrics, null, 2));

        // Update the agent's metered_metrics directly with enriched data (including subscriptionId)
        const { data: updateResult, error: updateError } = await supabase
          .from('agents')
          .update({
            metered_metrics: validatedData.metered_metrics,
            updated_at: new Date().toISOString()
          })
          .eq('agent_id', agentId)
          .eq('provider', provider) // Also filter by provider to ensure we update the right agent
          .select();

        if (updateError) {
          console.error('❌ Supabase update error:', updateError);
          throw updateError;
        }

        if (!updateResult || updateResult.length === 0) {
          console.error('❌ No agent updated in Supabase');
          throw new Error('Agent not found or not updated');
        }

        console.log('✅ Successfully updated agent metrics in Supabase');

        return NextResponse.json({
          success: true,
          message: 'Metrics configuration saved successfully (direct database)',
          agentId,
          provider: updateResult[0].provider,
          metrics: validatedData.metered_metrics?.metrics || []
        });

      } catch (fallbackError) {
        console.error('❌ Supabase fallback also failed:', fallbackError);
        return NextResponse.json({
          success: false,
          error: 'Both analytics service and fallback failed',
          details: {
            analyticsError: error instanceof Error ? error.message : 'Unknown error',
            fallbackError: fallbackError instanceof Error ? fallbackError.message : 'Unknown error'
          }
        }, { status: 500 });
      }
    }

  } catch (error) {
    console.error('Error updating agent metrics:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: error.errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update agent metrics',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
