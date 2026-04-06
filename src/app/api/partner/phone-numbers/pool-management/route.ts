import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { obfuscateId } from '@/lib/pii-obfuscation';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Use partner authentication
    const partner = await verifyPartnerAuth(req);

    if (!partner) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const partnerId = partner.id;

    // Get partner's pool statistics
    const poolStats = await prisma.phoneNumberPool.groupBy({
      by: ['status', 'poolType'],
      where: {
        partnerId: partnerId
      },
      _count: {
        id: true
      }
    });

    // Get detailed pool entries
    const poolEntries = await prisma.phoneNumberPool.findMany({
      where: {
        partnerId: partnerId
      },
      include: {
        phoneNumber: {
          include: {
            customer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            },
            agentMappings: {
              where: { status: 'active' },
              select: {
                agentId: true,
                agentName: true,
                agentProvider: true
              }
            },
            billingEntries: {
              where: { status: 'active' },
              select: {
                monthlyAmount: true,
                nextBillingDate: true
              }
            }
          }
        }
      },
      orderBy: [
        { status: 'asc' },
        { assignedAt: 'desc' }
      ]
    });

    // Format response
    const formattedEntries = poolEntries.map(entry => ({
      id: entry.id,
      phoneNumber: entry.phoneNumber.phoneNumber,
      friendlyName: entry.phoneNumber.friendlyName,
      status: entry.status,
      poolType: entry.poolType,
      assignedAt: entry.assignedAt,
      releasedAt: entry.releasedAt,
      customer: entry.phoneNumber.customer ? {
        id: entry.phoneNumber.customer.id,
        name: `${entry.phoneNumber.customer.firstName || ''} ${entry.phoneNumber.customer.lastName || ''}`.trim(),
        email: entry.phoneNumber.customer.email
      } : null,
      activeAgents: entry.phoneNumber.agentMappings.length,
      agentDetails: entry.phoneNumber.agentMappings,
      billing: entry.phoneNumber.billingEntries[0] || null,
      capabilities: entry.phoneNumber.capabilities,
      countryCode: entry.phoneNumber.countryCode,
      region: entry.phoneNumber.region,
      locality: entry.phoneNumber.locality
    }));

    // Calculate statistics
    const stats = {
      total: poolEntries.length,
      available: poolEntries.filter(e => e.status === 'available').length,
      assigned: poolEntries.filter(e => e.status === 'assigned').length,
      reserved: poolEntries.filter(e => e.status === 'reserved').length,
      monthlyRevenue: poolEntries
        .filter(e => e.phoneNumber.billingEntries.length > 0)
        .reduce((sum, e) => sum + (e.phoneNumber.billingEntries[0]?.monthlyAmount || 0), 0)
    };

    return NextResponse.json({
      success: true,
      data: {
        statistics: stats,
        poolEntries: formattedEntries,
        rawStats: poolStats
      }
    });

  } catch (error) {
    logger.error('Error fetching partner pool management data', error as Error, {
      operation: 'fetch_partner_pool_management_data'
    });
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// Release number from partner pool (30-day notice)
export async function POST(req: NextRequest) {
  try {
    const partner = await verifyPartnerAuth(req);

    if (!partner) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const partnerId = partner.id;
    const { action, phoneNumberId, releaseDate } = await req.json();

    if (action === 'schedule_release') {
      // Schedule number for release (30-day notice)
      const releaseDateTime = new Date(releaseDate);
      const now = new Date();
      const daysDifference = Math.ceil((releaseDateTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDifference < 30) {
        return NextResponse.json({
          success: false,
          error: 'invalid_release_date',
          message: 'Release date must be at least 30 days from now'
        }, { status: 400 });
      }

      // TODO: Implement scheduled release logic
      logger.info('Scheduled partner pool number release request accepted', {
        operation: 'schedule_partner_pool_number_release',
        partnerId: obfuscateId(partnerId),
        phoneNumberId: phoneNumberId ? obfuscateId(phoneNumberId) : undefined,
        releaseDate: releaseDateTime.toISOString()
      });

      return NextResponse.json({
        success: true,
        message: 'Number scheduled for release',
        releaseDate: releaseDateTime
      });
    }

    return new NextResponse('Invalid action', { status: 400 });

  } catch (error) {
    logger.error('Error in partner pool management action', error as Error, {
      operation: 'partner_pool_management_action'
    });
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
