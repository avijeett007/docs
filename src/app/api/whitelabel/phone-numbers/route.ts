import { NextRequest, NextResponse } from 'next/server';
import { verifyWhitelabelAuth } from '@/lib/whitelabelAuth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Use whitelabel authentication
    const authResult = await verifyWhitelabelAuth(req);

    if (!authResult) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { customerId, partnerId } = authResult;

    // Get phone numbers for this customer (excluding hidden ones)
    const phoneNumbers = await prisma.phoneNumber.findMany({
      where: {
        customerId: customerId,
        partnerId: partnerId,
        hideFromCustomer: false, // Only show numbers that are not hidden from customers
      },
      orderBy: {
        createdAt: 'desc',
      },
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
    });

    // Helper function to determine inbound capability
    const getInboundCapability = (number: any) => {
      // Voice capability from provider + not suspended/released = can receive inbound
      const capabilities = number.capabilities as any;
      const hasVoiceCapability = capabilities?.voice || capabilities?.VOICE || false;
      const isOperational = !['released', 'suspended'].includes(number.status?.toLowerCase());
      return hasVoiceCapability && isOperational;
    };

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

      // Enhanced capability indicators (matching partner portal)
      canReceiveInbound: getInboundCapability(number),
      canSendOutbound: number.verificationStatus === 'verified' || number.regulatoryStatus === 'approved',

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
      },
    });
  } catch (error) {
    console.error('Error fetching whitelabel phone numbers:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
