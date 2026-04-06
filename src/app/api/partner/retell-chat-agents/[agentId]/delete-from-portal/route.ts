import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { invalidateCacheForDeletedAgent } from '@/lib/cache-invalidation';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/partner/retell-chat-agents/[agentId]/delete-from-portal
 * Delete chat agent from portal only (not from Retell)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const auth = await verifyPartnerJWT(request);
    if (!auth.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = auth.payload?.partnerId;
    if (!partnerId) {
      return NextResponse.json({ error: 'Invalid partner ID' }, { status: 401 });
    }

    const agentId = params.agentId;

    const agent = await prisma.retellChatAgent.findUnique({
      where: { id: agentId, partnerId },
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      }
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found or not owned by partner' },
        { status: 404 }
      );
    }

    const customerImpact = agent.customerId ? {
      customerId: agent.customerId,
      customerName: getCustomerDisplayName(agent.customer)
    } : null;

    console.log(`Starting deletion process for chat agent ${agentId}`);

    // Step 1: Update webhook in Retell to dummy URL
    if (agent.apiKey) {
      try {
        const decryptedApiKey = decrypt(agent.apiKey);
        await fetch(`https://api.retellai.com/update-chat-agent/${agentId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${decryptedApiKey}`,
          },
          body: JSON.stringify({ webhook_url: 'https://knotie-ai.pro/' }),
        });
      } catch (webhookError) {
        console.error(`Error updating Retell webhook for chat agent ${agentId}:`, webhookError);
      }
    }

    // Step 2: Anonymize agent data in analytics database
    await anonymizeAnalyticsAgentData(agentId);

    // Step 3: Delete agent from database
    await prisma.$transaction(async (tx) => {
      await tx.aIUsage.deleteMany({ where: { retellChatAgentId: agentId } });
      await tx.retellChatWidget.deleteMany({ where: { agentId } });
      await tx.retellChatAgent.delete({ where: { id: agentId } });
    });

    // Step 4: Invalidate analytics cache
    try {
      await invalidateCacheForDeletedAgent({
        agentId, partnerId, customerId: agent.customerId
      });
    } catch (cacheError) {
      console.error(`Error invalidating cache for deleted chat agent ${agentId}:`, cacheError);
    }

    return NextResponse.json({
      success: true,
      message: 'Agent deleted from portal successfully',
      warnings: { customerImpact }
    });
  } catch (error) {
    console.error('Error deleting chat agent from portal:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

function getCustomerDisplayName(customer: any): string {
  if (!customer) return 'Unknown Customer';
  if (customer.firstName || customer.lastName) {
    return `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
  }
  return customer.email || 'Unknown Customer';
}

async function anonymizeAnalyticsAgentData(agentId: string): Promise<void> {
  try {
    const supabaseUrl = process.env.ANALYTICS_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.ANALYTICS_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) return;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const anonymousAgentId = `deleted_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    await supabase.from('agents').update({
      agent_id: anonymousAgentId,
      agent_name: `Deleted Chat Agent ${Date.now()}`,
      partner_id: 'deleted',
      customer_id: null,
      agent_enabled: false,
      webhook_enabled: false,
      pre_existing_webhook_url: null,
      config: {},
      updated_at: new Date().toISOString()
    }).eq('agent_id', agentId);
  } catch (error) {
    console.error(`Error anonymizing chat agent ${agentId}:`, error);
  }
}

