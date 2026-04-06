import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    // Verify the partner JWT
    const decoded = await verifyPartnerJWT(req);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;
    const agentId = params.agentId;

    console.log(`[phone-numbers/route] Getting phone numbers for agent: ${agentId}, partner: ${partnerId}`);

    // First, verify the agent exists and belongs to the partner
    const agent = await prisma.retellAgent.findUnique({
      where: {
        id: agentId,
        partnerId: partnerId,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!agent) {
      return NextResponse.json({
        error: 'Agent not found or not owned by partner'
      }, { status: 404 });
    }

    // Get all phone numbers associated with this agent
    const agentPhoneMappings = await prisma.agentPhoneMapping.findMany({
      where: {
        agentId: agentId,
        agentProvider: 'retell',
        partnerId: partnerId,
        status: 'active',
      },
      include: {
        phoneNumber: {
          select: {
            id: true,
            phoneNumber: true,
            friendlyName: true,
            provider: true,
            status: true,
            capabilities: true,
            type: true,
            customer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              }
            }
          }
        }
      }
    });

    console.log(`[phone-numbers/route] Found ${agentPhoneMappings.length} phone number mappings for agent ${agentId}`);

    // Transform the data for the response
    const phoneNumbers = agentPhoneMappings.map(mapping => {
      const capabilities = mapping.phoneNumber.capabilities as any || {};

      // More robust capability detection for different providers
      const canReceiveInbound =
        capabilities.voice === true ||
        capabilities.VOICE === true ||
        capabilities.inbound === true ||
        capabilities.INBOUND === true ||
        mapping.phoneNumber.type === 'local' || // Most local numbers support inbound
        mapping.phoneNumber.provider === 'telnyx'; // Telnyx imported numbers typically support voice

      const canSendOutbound =
        capabilities.voice === true ||
        capabilities.VOICE === true ||
        capabilities.outbound === true ||
        capabilities.OUTBOUND === true ||
        mapping.phoneNumber.type === 'local' || // Most local numbers support outbound
        mapping.phoneNumber.provider === 'telnyx'; // Telnyx imported numbers typically support voice

      console.log(`[phone-numbers/route] Phone ${mapping.phoneNumber.phoneNumber}: capabilities=${JSON.stringify(capabilities)}, canReceiveInbound=${canReceiveInbound}, canSendOutbound=${canSendOutbound}, inboundEnabled=${mapping.inboundEnabled}, outboundEnabled=${mapping.outboundEnabled}`);

      return {
        id: mapping.phoneNumber.id,
        phoneNumber: mapping.phoneNumber.phoneNumber,
        friendlyName: mapping.phoneNumber.friendlyName,
        provider: mapping.phoneNumber.provider,
        status: mapping.phoneNumber.status,
        type: mapping.phoneNumber.type,
        canReceiveInbound,
        canSendOutbound,
        inboundEnabled: mapping.inboundEnabled,
        outboundEnabled: mapping.outboundEnabled,
        customer: mapping.phoneNumber.customer ? {
          id: mapping.phoneNumber.customer.id,
          name: `${mapping.phoneNumber.customer.firstName || ''} ${mapping.phoneNumber.customer.lastName || ''}`.trim(),
          email: mapping.phoneNumber.customer.email,
        } : null,
        mappingId: mapping.id,
        createdAt: mapping.createdAt,
      };
    });

    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
      },
      phoneNumbers,
      hasPhoneNumbers: phoneNumbers.length > 0,
      inboundNumbers: phoneNumbers.filter(p => p.inboundEnabled && p.canReceiveInbound),
      outboundNumbers: phoneNumbers.filter(p => p.outboundEnabled && p.canSendOutbound),
    });

  } catch (error) {
    console.error('[phone-numbers/route] Error fetching agent phone numbers:', error);
    return NextResponse.json({
      error: 'Failed to fetch agent phone numbers',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
