import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { verifyPartnerJWT } from '@/lib/auth';

export async function GET(req: NextRequest) {
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

    // Get all active demo systems
    const demoSystems = await prisma.demoSystem.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        sequence: 'asc',
      },
    });

    // Get partner's deployed demos
    // Use select to explicitly specify which fields to fetch
    // This avoids issues with schema changes
    const partnerDemos = await prisma.partnerDemo.findMany({
      where: {
        partnerId: partnerId,
      },
      select: {
        id: true,
        partnerId: true,
        demoSystemId: true,
        deployedAgentId: true,
        status: true,
        customBusinessName: true,
        customCharacterName: true,
        lastDeployedAt: true,
        lastTestedAt: true,
        deployCount: true,
        testCount: true,
        createdAt: true,
        updatedAt: true,
        // New fields will be added by Prisma if they exist in the database
      },
    });

    // Map demo systems with deployment status
    const demos = demoSystems.map(demoSystem => {
      const partnerDemo = partnerDemos.find(pd => pd.demoSystemId === demoSystem.id);

      return {
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
        isActive: demoSystem.isActive,
        deployment: partnerDemo ? {
          id: partnerDemo.id,
          status: partnerDemo.status,
          deployedAgentId: partnerDemo.deployedAgentId,
          lastDeployedAt: partnerDemo.lastDeployedAt,
          lastTestedAt: partnerDemo.lastTestedAt,
          customBusinessName: partnerDemo.customBusinessName,
          customCharacterName: partnerDemo.customCharacterName,
        } : null,
      };
    });

    return NextResponse.json({ demos });
  } catch (error) {
    console.error('Error fetching demos:', error);
    return NextResponse.json({ error: 'Failed to fetch demos' }, { status: 500 });
  }
}
