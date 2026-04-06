import { NextRequest, NextResponse } from 'next/server';
import { verifyWhitelabelAuth } from '@/lib/whitelabelAuth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Authenticate the request
    const authResult = await verifyWhitelabelAuth(req);
    if (!authResult || !authResult.customerId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { customerId } = authResult;

    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get('status') || undefined;
    const type = searchParams.get('type') || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      customerId,
    };

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    // Get phone numbers with pagination
    const [phoneNumbers, total] = await Promise.all([
      prisma.phoneNumber.findMany({
        where,
        include: {
          documents: {
            where: {
              status: 'approved',
            },
            select: {
              id: true,
              documentType: true,
              status: true,
            },
          },
          agentMappings: {
            where: {
              status: 'active',
            },
            select: {
              id: true,
              agentProvider: true,
              agentId: true,
              agentName: true,
              status: true,
            },
          },
          _count: {
            select: {
              knovaAgents: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.phoneNumber.count({ where }),
    ]);

    // Format response
    const formattedNumbers = phoneNumbers.map(number => ({
      id: number.id,
      phoneNumber: number.phoneNumber,
      friendlyName: number.friendlyName,
      countryCode: number.countryCode,
      region: number.region,
      locality: number.locality,
      type: number.type,
      status: number.status,
      capabilities: number.capabilities,
      monthlyRecurringCost: number.monthlyRecurringCost,
      regulatoryStatus: number.regulatoryStatus,
      verificationStatus: number.verificationStatus,
      isImported: number.isImported,
      activeAgents: number._count.knovaAgents,
      approvedDocuments: number.documents.length,
      purchasedAt: number.purchasedAt,
      createdAt: number.createdAt,
      // Add agent mapping information
      connectedAgent: number.agentMappings.length > 0 ? {
        agentName: number.agentMappings[0].agentName,
        agentProvider: number.agentMappings[0].agentProvider,
        agentId: number.agentMappings[0].agentId,
      } : null,
    }));

    return NextResponse.json({
      success: true,
      data: {
        phoneNumbers: formattedNumbers,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });

  } catch (error) {
    console.error('Get phone numbers error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch phone numbers', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}