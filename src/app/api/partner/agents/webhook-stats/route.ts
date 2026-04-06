import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Verify the partner JWT token
    const decoded = await verifyPartnerJWT(req);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;

    // Get webhook statistics for all providers
    const [vapiStats, retellStats, ultravoxStats] = await Promise.all([
      // VAPI agents
      prisma.vapiAgent.groupBy({
        by: ['webhookEnabled'],
        where: { partnerId },
        _count: true,
      }),
      // Retell agents
      prisma.retellAgent.groupBy({
        by: ['webhookEnabled'],
        where: { partnerId },
        _count: true,
      }),
      // Ultravox agents
      prisma.ultravoxAgent.groupBy({
        by: ['webhookEnabled'],
        where: { partnerId },
        _count: true,
      }),
    ]);

    // Process VAPI stats
    const vapiTotal = vapiStats.reduce((sum, stat) => sum + stat._count, 0);
    const vapiWebhookEnabled = vapiStats.find(stat => stat.webhookEnabled === true)?._count || 0;
    const vapiWebhookDisabled = vapiTotal - vapiWebhookEnabled;

    // Process Retell stats
    const retellTotal = retellStats.reduce((sum, stat) => sum + stat._count, 0);
    const retellWebhookEnabled = retellStats.find(stat => stat.webhookEnabled === true)?._count || 0;
    const retellWebhookDisabled = retellTotal - retellWebhookEnabled;

    // Process Ultravox stats
    const ultravoxTotal = ultravoxStats.reduce((sum, stat) => sum + stat._count, 0);
    const ultravoxWebhookEnabled = ultravoxStats.find(stat => stat.webhookEnabled === true)?._count || 0;
    const ultravoxWebhookDisabled = ultravoxTotal - ultravoxWebhookEnabled;

    // Calculate totals
    const totalAgents = vapiTotal + retellTotal + ultravoxTotal;
    const totalWebhookEnabled = vapiWebhookEnabled + retellWebhookEnabled + ultravoxWebhookEnabled;
    const totalWebhookDisabled = totalAgents - totalWebhookEnabled;
    const webhookProgress = totalAgents > 0 ? Math.round((totalWebhookEnabled / totalAgents) * 100) : 100;

    return NextResponse.json({
      summary: {
        totalAgents,
        totalWebhookEnabled,
        totalWebhookDisabled,
        webhookProgress,
      },
      vapi: {
        total: vapiTotal,
        webhookEnabled: vapiWebhookEnabled,
        webhookDisabled: vapiWebhookDisabled,
      },
      retell: {
        total: retellTotal,
        webhookEnabled: retellWebhookEnabled,
        webhookDisabled: retellWebhookDisabled,
      },
      ultravox: {
        total: ultravoxTotal,
        webhookEnabled: ultravoxWebhookEnabled,
        webhookDisabled: ultravoxWebhookDisabled,
      },
    });
  } catch (error) {
    console.error('[webhook-stats/route] Error getting webhook stats:', error);
    return NextResponse.json(
      { error: 'Failed to get webhook statistics' },
      { status: 500 }
    );
  }
}
