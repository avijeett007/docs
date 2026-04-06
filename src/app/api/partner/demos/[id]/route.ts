import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { verifyPartnerJWT } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Verify the partner JWT
    const decoded = await verifyPartnerJWT(req);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;

    // Get the partner
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId }
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    const demoId = params.id;

    // Get the demo system
    const demoSystem = await prisma.demoSystem.findUnique({
      where: {
        id: demoId,
        isActive: true,
      },
    });

    if (!demoSystem) {
      return NextResponse.json({ error: 'Demo not found' }, { status: 404 });
    }

    // Get partner's deployed demo if exists
    const partnerDemo = await prisma.partnerDemo.findUnique({
      where: {
        partnerId_demoSystemId: {
          partnerId: partnerId,
          demoSystemId: demoId,
        },
      },
    });

    // Return demo with deployment status
    return NextResponse.json({
      demo: {
        id: demoSystem.id,
        name: demoSystem.name,
        description: demoSystem.description,
        industry: demoSystem.industry,
        useCases: demoSystem.useCases,
        benefits: demoSystem.benefits,
        iconName: demoSystem.iconName,
        color: demoSystem.color,
        demoType: demoSystem.demoType,
        isOutbound: demoSystem.isOutbound,
        businessNamePlaceholder: demoSystem.businessNamePlaceholder,
        characterNamePlaceholder: demoSystem.characterNamePlaceholder,
        deployment: partnerDemo ? {
          id: partnerDemo.id,
          status: partnerDemo.status,
          deployedAgentId: partnerDemo.deployedAgentId,
          lastDeployedAt: partnerDemo.lastDeployedAt,
          lastTestedAt: partnerDemo.lastTestedAt,
          customBusinessName: partnerDemo.customBusinessName,
          customCharacterName: partnerDemo.customCharacterName,
          deployCount: partnerDemo.deployCount,
          testCount: partnerDemo.testCount,
        } : null,
      }
    });
  } catch (error) {
    console.error('Error fetching demo:', error);
    return NextResponse.json({ error: 'Failed to fetch demo' }, { status: 500 });
  }
}
