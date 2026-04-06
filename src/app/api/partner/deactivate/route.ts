import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const deactivatePartnerSchema = z.object({
  partnerId: z.string(),
  reason: z.string(),
  preserveData: z.boolean().default(false),
});

/**
 * POST /api/partner/deactivate
 * Deactivate partner and all associated data when subscription is cancelled
 */
export async function POST(request: NextRequest) {
  try {
    // Verify partner authentication
    const decoded = await verifyPartnerJWT(request);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requestingPartnerId = decoded.payload.partnerId;
    const body = await request.json();
    const validatedData = deactivatePartnerSchema.parse(body);

    // Only allow partners to deactivate themselves
    if (requestingPartnerId !== validatedData.partnerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const partnerId = validatedData.partnerId;

    // Get partner details
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      include: {
        customers: true,
        vapiAgents: true,
        retellAgents: true,
        ultravoxAgents: true,
        elevenlabsAgents: true,
        knovaAgents: true,
        ghlAgents: true,
      },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    // Starting deactivation process for partner

    // Start transaction to ensure data consistency
    await prisma.$transaction(async (tx) => {
      // 1. Update partner status
      await tx.partner.update({
        where: { id: partnerId },
        data: {
          approvalStatus: 'INACTIVE',
          subscriptionStatus: 'CANCELLED',
          updatedAt: new Date(),
        },
      });

      // 2. Deactivate all customers
      await tx.customer.updateMany({
        where: { 
          userOnboarding: {
            some: { partnerId }
          }
        },
        data: {
          status: 'inactive',
          suspended: true,
          updatedAt: new Date(),
        },
      });

      // 3. Deactivate all agents
      const agentUpdates = [
        tx.vapiAgent.updateMany({
          where: { partnerId },
          data: { isActive: false, updatedAt: new Date() },
        }),
        tx.retellAgent.updateMany({
          where: { partnerId },
          data: { isActive: false, updatedAt: new Date() },
        }),
        tx.ultravoxAgent.updateMany({
          where: { partnerId },
          data: { isActive: false, updatedAt: new Date() },
        }),
        tx.elevenLabsAgent.updateMany({
          where: { partnerId },
          data: { isActive: false, updatedAt: new Date() },
        }),
        tx.knovaAgent.updateMany({
          where: { partnerId },
          data: { isActive: false, updatedAt: new Date() },
        }),
        tx.ghlAgent.updateMany({
          where: { partnerId },
          data: { isActive: false, updatedAt: new Date() },
        }),
      ];

      await Promise.all(agentUpdates);

      // 4. Log deactivation event
      await tx.auditLog.create({
        data: {
          partnerId: partnerId,
          entityType: 'partner',
          entityId: partnerId,
          action: 'PARTNER_DEACTIVATED',
          details: {
            reason: validatedData.reason,
            preserveData: validatedData.preserveData,
            customerCount: partner.customers.length,
            agentCounts: {
              vapi: partner.vapiAgents.length,
              retell: partner.retellAgents.length,
              ultravox: partner.ultravoxAgents.length,
              elevenlabs: partner.elevenlabsAgents.length,
              knova: partner.knovaAgents.length,
              ghl: partner.ghlAgents.length,
            },
            deactivatedAt: new Date().toISOString(),
          },
          ipAddress: request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      });
    });

    // 5. Update analytics service to mark agents as inactive
    try {
      const allAgents = [
        ...partner.vapiAgents.map(a => ({ id: a.id, analyticsId: a.analyticsAgentId, provider: 'vapi' })),
        ...partner.retellAgents.map(a => ({ id: a.id, analyticsId: a.analyticsAgentId, provider: 'retell' })),
        ...partner.ultravoxAgents.map(a => ({ id: a.id, analyticsId: a.analyticsAgentId, provider: 'ultravox' })),
        ...partner.elevenlabsAgents.map(a => ({ id: a.id, analyticsId: a.analyticsAgentId, provider: 'elevenlabs' })),
        ...partner.knovaAgents.map(a => ({ id: a.id, analyticsId: a.analyticsAgentId, provider: 'knova' })),
        ...partner.ghlAgents.map(a => ({ id: a.id, analyticsId: a.analyticsAgentId, provider: 'ghl' })),
      ].filter(a => a.analyticsId);

      if (allAgents.length > 0) {
        const analyticsApiUrl = process.env.ANALYTICS_API_URL;
        const analyticsApiKey = process.env.ANALYTICS_API_KEY;

        if (analyticsApiUrl && analyticsApiKey) {
          // Update agents in analytics service
          for (const agent of allAgents) {
            try {
              // Call analytics API to mark agent as inactive
              const response = await fetch(`${analyticsApiUrl}/api/agents/${agent.analyticsId}`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'x-api-key': analyticsApiKey,
                },
                body: JSON.stringify({
                  agent_enabled: false,
                  partner_id: 'deactivated',
                  provider: agent.provider,
                  updated_at: new Date().toISOString(),
                }),
              });

              if (!response.ok) {
                // Failed to update analytics for agent - continue with other agents
              } else {
                // Successfully deactivated analytics for agent
              }
            } catch (analyticsError) {
              // Error updating analytics for agent - continue with other agents
              // Continue with other agents even if one fails
            }
          }
        } else {
          console.warn('Analytics API URL or API key not configured');
        }
      }
    } catch (analyticsError) {
      // Error handled silently for production
      // Don't fail the deactivation if analytics update fails
    }

    // Successfully deactivated partner

    return NextResponse.json({
      success: true,
      data: {
        partnerId,
        deactivatedAt: new Date(),
        affectedCounts: {
          customers: partner.customers.length,
          agents: {
            vapi: partner.vapiAgents.length,
            retell: partner.retellAgents.length,
            ultravox: partner.ultravoxAgents.length,
            elevenlabs: partner.elevenlabsAgents.length,
            knova: partner.knovaAgents.length,
            ghl: partner.ghlAgents.length,
          },
        },
        message: 'Partner and all associated data have been deactivated',
      },
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    // Error handled silently for production
    return NextResponse.json(
      { error: 'Failed to deactivate partner' },
      { status: 500 }
    );
  }
}
