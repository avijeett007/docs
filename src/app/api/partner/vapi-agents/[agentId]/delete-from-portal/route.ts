export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { createClient } from '@supabase/supabase-js';
import { invalidateCacheForDeletedAgent } from '@/lib/cache-invalidation';

/**
 * DELETE /api/partner/vapi-agents/[agentId]/delete-from-portal
 * Delete agent from portal only (not from VAPI)
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
    const agent = await prisma.vapiAgent.findUnique({
      where: { 
        id: agentId,
        partnerId: partnerId // Ensure partner owns this agent
      },
      include: {
        partner: {
          select: {
            vapiApiKey: true
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

    console.log(`Starting deletion process for VAPI agent ${agentId} (analytics ID: ${agent.analyticsAgentId})`);

    // Step 1: Update webhook in VAPI to dummy URL
    console.log(`Step 1: Updating VAPI webhook for agent ${agentId}`);
    await updateVapiWebhook(agent);

    // Step 2: Anonymize agent data in analytics database (GDPR compliant)
    console.log(`Step 2: Performing GDPR-compliant anonymization for agent ${agentId} in analytics database`);
    await anonymizeAnalyticsAgentData(agentId); // Use VAPI agent ID directly

    // Step 3: Delete agent from database
    console.log(`Step 3: Deleting agent ${agentId} from database`);
    await deleteAgentFromDatabase(agentId);

    // Step 4: Invalidate analytics cache (feature flagged)
    console.log(`Step 4: Invalidating analytics cache for VAPI agent ${agentId}`);
    try {
      const cacheResult = await invalidateCacheForDeletedAgent({
        agentId: agentId,
        partnerId: partnerId,
        customerId: agent.customerId
      });

      if (cacheResult.success) {
        console.log(`Successfully invalidated cache for deleted VAPI agent ${agentId}`);
      } else {
        console.warn(`Failed to invalidate cache for deleted VAPI agent ${agentId}: ${cacheResult.error}`);
      }
    } catch (cacheError) {
      console.error(`Error invalidating cache for deleted VAPI agent ${agentId}:`, cacheError);
      // Don't fail the deletion if cache invalidation fails
    }

    console.log(`Successfully completed deletion process for VAPI agent ${agentId}`);

    return NextResponse.json({
      success: true,
      message: 'Agent deleted from portal successfully',
      warnings: {
        billingImpact: hasCustomMetrics,
        customerImpact
      }
    });

  } catch (error) {
    console.error('Error deleting VAPI agent from portal:', error);
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
  
  const firstName = customer.firstName || '';
  const lastName = customer.lastName || '';
  const email = customer.email || '';
  
  if (firstName || lastName) {
    return `${firstName} ${lastName}`.trim();
  }
  
  return email || 'Unknown Customer';
}

/**
 * Update VAPI webhook to dummy URL
 */
async function updateVapiWebhook(agent: any): Promise<void> {
  try {
    // Get API key (agent-level first, then partner-level)
    let apiKey = agent.apiKey;
    if (!apiKey && agent.partner?.vapiApiKey) {
      apiKey = agent.partner.vapiApiKey;
    }

    if (!apiKey) {
      console.warn(`No VAPI API key available for agent ${agent.id}`);
      return;
    }

    // Decrypt the API key if it's encrypted (agent-level keys are encrypted)
    let decryptedApiKey = apiKey;
    if (agent.apiKey) {
      try {
        decryptedApiKey = decrypt(apiKey);
      } catch (error) {
        console.error('Failed to decrypt VAPI API key:', error);
        // If decryption fails, try using the key as-is (might be partner-level key)
        decryptedApiKey = apiKey;
      }
    }

    // Ensure decryptedApiKey is a string
    const apiKeyString = String(decryptedApiKey);

    // Update webhook URL to dummy URL using VAPI API
    const requestPayload = {
      server: {
        url: 'https://knotie-ai.pro',  // Remove trailing slash
        timeoutSeconds: 20
      }
    };

    console.log(`[vapi-delete] Updating VAPI webhook for agent ${agent.id} with payload:`, JSON.stringify(requestPayload));
    console.log(`[vapi-delete] Using API key (first 10 chars): ${apiKeyString.substring(0, 10)}...`);

    const response = await fetch(`https://api.vapi.ai/assistant/${agent.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${apiKeyString}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[vapi-delete] Failed to update VAPI webhook: ${response.status} - ${errorText}`);

      // Try to get more detailed error information
      try {
        const errorJson = JSON.parse(errorText);
        console.warn(`[vapi-delete] VAPI error details:`, errorJson);
      } catch (e) {
        console.warn(`[vapi-delete] Raw VAPI error:`, errorText);
      }

      // Continue with deletion even if webhook update fails
    } else {
      console.log(`[vapi-delete] Successfully updated VAPI webhook for agent ${agent.id} to dummy URL`);

      // Verify the update was successful
      try {
        const updateResult = await response.json();
        console.log(`[vapi-delete] VAPI update response:`, JSON.stringify(updateResult));
      } catch (e) {
        console.log(`[vapi-delete] Could not parse VAPI response as JSON`);
      }
    }

  } catch (error) {
    console.error(`Error updating VAPI webhook for agent ${agent.id}:`, error);
    // Continue with deletion even if webhook update fails
  }
}

/**
 * Anonymize agent data in analytics database (GDPR compliant)
 */
async function anonymizeAnalyticsAgentData(vapiAgentId: string): Promise<void> {
  try {
    console.log(`Starting GDPR-compliant anonymization for VAPI agent ${vapiAgentId} in analytics database`);

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

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    });

    console.log(`Connected to analytics database, performing anonymization for agent_id: ${vapiAgentId}`);

    // Check if the agent exists in the analytics database using VAPI agent ID
    const { data: existingAgent, error: checkError } = await supabase
      .from('agents')
      .select('agent_id, agent_name, partner_id, customer_id')
      .eq('agent_id', vapiAgentId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error(`Error checking for agent ${vapiAgentId}:`, checkError);
    }

    if (!existingAgent) {
      console.warn(`Agent ${vapiAgentId} not found in analytics database`);
      console.warn(`Skipping analytics anonymization - agent may not be registered in analytics yet`);
      return;
    } else {
      console.log(`Found agent in analytics database:`, existingAgent);
    }

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
      .eq('agent_id', vapiAgentId);

    if (anonymizeError) {
      console.error(`Error anonymizing VAPI agent ${vapiAgentId}:`, anonymizeError);
    } else {
      console.log(`Successfully anonymized VAPI agent ${vapiAgentId} -> ${anonymousAgentId}`);
      console.log(`Anonymized ${anonymizedCount || 0} agent record(s)`);
    }

    console.log(`Successfully completed GDPR-compliant anonymization for VAPI agent ${vapiAgentId}`);
    console.log(`Agent data preserved for analytics while removing all PII`);

  } catch (error) {
    console.error(`Error performing anonymization for VAPI agent ${vapiAgentId}:`, error);
    // Don't throw error - continue with deletion even if anonymization fails
  }
}

/**
 * Delete agent from database with transaction
 */
async function deleteAgentFromDatabase(agentId: string): Promise<void> {
  try {
    // First check if the agent still exists
    const existingAgent = await prisma.vapiAgent.findUnique({
      where: { id: agentId }
    });

    if (!existingAgent) {
      console.log(`VAPI agent ${agentId} already deleted from database`);
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
          vapiAgent: {
            id: agentId
          }
        }
      });

      // Delete the agent (this will cascade to other relationships)
      await prisma.vapiAgent.delete({
        where: { id: agentId }
      });
    });

    console.log(`Successfully deleted VAPI agent ${agentId} from database`);

  } catch (error) {
    console.error(`Error deleting VAPI agent ${agentId} from database:`, error);
    throw error;
  }
}
