import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { createClient } from '@supabase/supabase-js';
import { invalidateCacheForDeletedAgent } from '@/lib/cache-invalidation';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/partner/retell-agents/[agentId]/delete-from-portal
 * Delete agent from portal only (not from Retell)
 */
export async function DELETE(
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

    const partnerId = auth.payload?.partnerId;
    if (!partnerId) {
      return NextResponse.json(
        { error: 'Invalid partner ID' },
        { status: 401 }
      );
    }

    const agentId = params.agentId;

    // Get the agent with all necessary data
    const agent = await prisma.retellAgent.findUnique({
      where: { 
        id: agentId,
        partnerId: partnerId // Ensure partner owns this agent
      },
      include: {
        partner: {
          select: {
            retellApiKey: true
          }
        },
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found or not owned by partner' },
        { status: 404 }
      );
    }

    // Check for billing impact (custom metrics)
    const hasCustomMetrics = await checkForCustomMetrics(agentId);
    
    // Check for customer impact
    const customerImpact = agent.customerId ? {
      customerId: agent.customerId,
      customerName: getCustomerDisplayName(agent.customer)
    } : null;

    console.log(`Starting deletion process for agent ${agentId} (analytics ID: ${agent.analyticsAgentId})`);

    // Step 1: Update webhook in Retell to dummy URL
    console.log(`Step 1: Updating Retell webhook for agent ${agentId}`);
    await updateRetellWebhook(agent);

    // Step 2: Anonymize agent data in analytics database (GDPR compliant)
    console.log(`Step 2: Performing GDPR-compliant anonymization for agent ${agentId} in analytics database`);
    await anonymizeAnalyticsAgentData(agentId);

    // Step 3: Delete agent from database
    console.log(`Step 3: Deleting agent ${agentId} from database`);
    await deleteAgentFromDatabase(agentId);

    // Step 4: Invalidate analytics cache (feature flagged)
    console.log(`Step 4: Invalidating analytics cache for agent ${agentId}`);
    try {
      const cacheResult = await invalidateCacheForDeletedAgent({
        agentId: agentId,
        partnerId: partnerId,
        customerId: agent.customerId
      });

      if (cacheResult.success) {
        console.log(`Successfully invalidated cache for deleted agent ${agentId}`);
      } else {
        console.warn(`Failed to invalidate cache for deleted agent ${agentId}: ${cacheResult.error}`);
      }
    } catch (cacheError) {
      console.error(`Error invalidating cache for deleted agent ${agentId}:`, cacheError);
      // Don't fail the deletion if cache invalidation fails
    }

    console.log(`Successfully completed deletion process for agent ${agentId}`);

    return NextResponse.json({
      success: true,
      message: 'Agent deleted from portal successfully',
      warnings: {
        billingImpact: hasCustomMetrics,
        customerImpact
      }
    });

  } catch (error) {
    console.error('Error deleting agent from portal:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * Check if agent has custom metrics that could impact billing
 */
async function checkForCustomMetrics(agentId: string): Promise<boolean> {
  try {
    // Check if agent has any usage metrics that could impact billing
    const usageMetrics = await prisma.usageMetric.findFirst({
      where: {
        agentId: agentId
      }
    });

    return !!usageMetrics;
  } catch (error) {
    console.error('Error checking custom metrics:', error);
    return false;
  }
}

/**
 * Get customer display name
 */
function getCustomerDisplayName(customer: any): string {
  if (!customer) return 'Unknown Customer';

  if (customer.firstName || customer.lastName) {
    return `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
  }
  return customer.email || 'Unknown Customer';
}

/**
 * Update Retell webhook to dummy URL
 */
async function updateRetellWebhook(agent: any): Promise<void> {
  try {
    // Get API key (agent-level first, then partner-level)
    let apiKey = agent.apiKey;
    if (!apiKey && agent.partner?.retellApiKey) {
      apiKey = agent.partner.retellApiKey;
    }

    if (!apiKey) {
      console.warn(`No Retell API key available for agent ${agent.id}`);
      return;
    }

    // Decrypt the API key
    const decryptedApiKey = decrypt(apiKey);

    // Update webhook URL to dummy URL
    const response = await fetch(`https://api.retellai.com/update-agent/${agent.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${decryptedApiKey}`,
      },
      body: JSON.stringify({
        webhook_url: 'https://knotie-ai.pro/'
      }),
    });

    if (!response.ok) {
      console.error(`Failed to update Retell webhook for agent ${agent.id}:`, response.status);
      // Don't throw error - continue with deletion even if webhook update fails
    } else {
      console.log(`Successfully updated Retell webhook for agent ${agent.id} to dummy URL`);
    }
  } catch (error) {
    console.error(`Error updating Retell webhook for agent ${agent.id}:`, error);
    // Don't throw error - continue with deletion even if webhook update fails
  }
}

/**
 * Anonymize agent data in analytics database (Supabase) - GDPR compliant anonymization
 */
async function anonymizeAnalyticsAgentData(agentId: string): Promise<void> {
  try {
    console.log(`Starting GDPR-compliant anonymization for agent ${agentId} in analytics database`);

    // Get Supabase credentials for analytics database
    const supabaseUrl = process.env.ANALYTICS_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.ANALYTICS_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase credentials for analytics database');
      console.log('Available env vars:', {
        hasAnalyticsUrl: !!process.env.ANALYTICS_SUPABASE_URL,
        hasUrl: !!process.env.SUPABASE_URL,
        hasAnalyticsKey: !!process.env.ANALYTICS_SUPABASE_SERVICE_KEY,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
      });
      return;
    }

    // Create Supabase client with service role key for admin operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    });

    console.log(`Connected to analytics database, performing anonymization for agent_id: ${agentId}`);

    // Generate anonymous agent ID and name
    const anonymousAgentId = `deleted_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const anonymousAgentName = `Deleted Agent ${Date.now()}`;

    // Anonymize the agent record - remove all PII and change agent_id
    const { error: anonymizeError, count: anonymizedCount } = await supabase
      .from('agents')
      .update({
        agent_id: anonymousAgentId,
        agent_name: anonymousAgentName,
        partner_id: 'deleted',
        customer_id: null,
        agent_enabled: false,
        webhook_enabled: false,
        pre_existing_webhook_url: null,
        config: {},
        job_status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('agent_id', agentId);

    if (anonymizeError) {
      console.error(`Error anonymizing agent ${agentId}:`, anonymizeError);
    } else {
      console.log(`Successfully anonymized agent ${agentId} -> ${anonymousAgentId}`);
      console.log(`Anonymized ${anonymizedCount || 0} agent record(s)`);
    }

    console.log(`Successfully completed GDPR-compliant anonymization for agent ${agentId}`);
    console.log(`Agent data preserved for analytics while removing all PII`);

  } catch (error) {
    console.error(`Error performing anonymization for agent ${agentId}:`, error);
    // Don't throw error - continue with deletion even if anonymization fails
  }
}

/**
 * Delete agent from database with transaction
 */
async function deleteAgentFromDatabase(agentId: string): Promise<void> {
  try {
    // First check if the agent still exists
    const existingAgent = await prisma.retellAgent.findUnique({
      where: { id: agentId }
    });

    if (!existingAgent) {
      console.log(`Agent ${agentId} already deleted from database`);
      return;
    }

    await prisma.$transaction(async (prisma) => {
      // Delete related records first

      // Delete usage metrics
      await prisma.usageMetric.deleteMany({
        where: {
          agentId: agentId
        }
      });

      // Delete AI usage records
      await prisma.aIUsage.deleteMany({
        where: {
          retellAgentId: agentId
        }
      });

      // Delete the agent (this will cascade to other relationships)
      await prisma.retellAgent.delete({
        where: { id: agentId }
      });
    });

    console.log(`Successfully deleted agent ${agentId} from database`);
  } catch (error) {
    console.error(`Error deleting agent ${agentId} from database:`, error);
    throw error;
  }
}
