import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { verifyPartnerJWT } from '@/lib/auth';



// Helper function to check if a column exists in a table
async function hasColumn(table: string, column: string): Promise<boolean> {
  try {
    // Query the information_schema to check if the column exists
    const result = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = ${table}
        AND column_name = ${column}
      ) as exists
    `;

    // @ts-ignore - result is an array with one object that has an 'exists' property
    return result[0].exists;
  } catch (error) {
    console.error(`Error checking if column ${column} exists in table ${table}:`, error);
    return false;
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
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
    const { businessName, businessAddress, characterName, agentName, voiceId } = await req.json();

    // Validate input
    if (!businessName || businessName.trim() === '') {
      return NextResponse.json({ error: 'Business name is required' }, { status: 400 });
    }

    if (!businessAddress || businessAddress.trim() === '') {
      return NextResponse.json({ error: 'Business address is required' }, { status: 400 });
    }

    if (!agentName || agentName.trim() === '') {
      return NextResponse.json({ error: 'Agent name is required' }, { status: 400 });
    }

    if (!voiceId || voiceId.trim() === '') {
      return NextResponse.json({ error: 'Voice selection is required' }, { status: 400 });
    }

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

    // If demo is outbound, character name is required
    if (demoSystem.isOutbound && (!characterName || characterName.trim() === '')) {
      return NextResponse.json({ error: 'Character name is required for outbound demos' }, { status: 400 });
    }

    // Create or update partner demo
    const partnerDemo = await prisma.partnerDemo.upsert({
      where: {
        partnerId_demoSystemId: {
          partnerId: partnerId,
          demoSystemId: demoId,
        },
      },
      update: {
        customBusinessName: businessName,
        // Use try-catch to handle potential schema issues
        ...(await hasColumn('partner_demos', 'custom_business_address') ? { customBusinessAddress: businessAddress } : {}),
        customCharacterName: demoSystem.isOutbound ? characterName : null,
        ...(await hasColumn('partner_demos', 'custom_agent_name') ? { customAgentName: agentName } : {}),
        ...(await hasColumn('partner_demos', 'custom_voice_id') ? { customVoiceId: voiceId } : {}),
        // Reset status if previously deployed
        status: 'PENDING',
      },
      create: {
        partnerId: partnerId,
        demoSystemId: demoId,
        customBusinessName: businessName,
        ...(await hasColumn('partner_demos', 'custom_business_address') ? { customBusinessAddress: businessAddress } : {}),
        customCharacterName: demoSystem.isOutbound ? characterName : null,
        ...(await hasColumn('partner_demos', 'custom_agent_name') ? { customAgentName: agentName } : {}),
        ...(await hasColumn('partner_demos', 'custom_voice_id') ? { customVoiceId: voiceId } : {}),
        status: 'PENDING',
      },
    });

    // Create response object with only the fields that exist
    const customization: any = {
      id: partnerDemo.id,
      businessName: partnerDemo.customBusinessName,
      characterName: partnerDemo.customCharacterName,
    };

    // Add new fields if they exist
    if ('customBusinessAddress' in partnerDemo) {
      customization.businessAddress = partnerDemo.customBusinessAddress;
    }

    if ('customAgentName' in partnerDemo) {
      customization.agentName = partnerDemo.customAgentName;
    }

    if ('customVoiceId' in partnerDemo) {
      customization.voiceId = partnerDemo.customVoiceId;
    }

    return NextResponse.json({
      success: true,
      demo: {
        id: demoSystem.id,
        name: demoSystem.name,
        customization
      }
    });
  } catch (error) {
    console.error('Error customizing demo:', error);
    return NextResponse.json({ error: 'Failed to customize demo' }, { status: 500 });
  }
}
