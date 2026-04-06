import { NextResponse, NextRequest } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { verifyJWT } from '@/lib/jwt';
import { getAuth } from '@clerk/nextjs/server';

// POST /api/partners/usage - Update AI usage for a customer
export async function POST(req: NextRequest) {
  try {
    const { userId } = await getAuth(req);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const {
      customerId,
      voiceAIUsage,
      telephonyUsage,
      emailsUsage,
      smsUsage,
      chatUsage,
      usageType,
      costPerUnit
    } = await req.json();

    // Validate required fields
    if (!customerId || !usageType || !costPerUnit) {
      return NextResponse.json(
        { error: 'Customer ID, usage type, and cost per unit are required' },
        { status: 400 }
      );
    }

    // Calculate total usage amount based on type
    let usageAmount = 0;
    switch (usageType) {
      case 'voice_ai':
        usageAmount = voiceAIUsage || 0;
        break;
      case 'telephony':
        usageAmount = telephonyUsage || 0;
        break;
      case 'email':
        usageAmount = emailsUsage || 0;
        break;
      case 'sms':
        usageAmount = smsUsage || 0;
        break;
      case 'chat':
        usageAmount = chatUsage || 0;
        break;
      default:
        usageAmount = 0;
    }

    // Calculate total cost
    const totalCost = usageAmount * costPerUnit;

    // Verify the partner exists and is approved
    const partner = await prisma.partner.findFirst({
      where: {
        customers: {
          some: {
            userId: customerId
          }
        },
        approvalStatus: 'ACTIVE'
      }
    });

    if (!partner) {
      return NextResponse.json(
        { error: 'Partner not found or not approved' },
        { status: 404 }
      );
    }

    // Update usage
    const usage = await prisma.aIUsage.create({
      data: {
        customerId,
        partnerId: partner.id,
        voiceAIUsage: voiceAIUsage || 0,
        telephonyUsage: telephonyUsage || 0,
        emailsUsage: emailsUsage || 0,
        smsUsage: smsUsage || 0,
        chatUsage: chatUsage || 0,
        usageDate: new Date(),
        usageType,
        usageAmount,
        costPerUnit,
        totalCost
      },
    });

    return NextResponse.json(usage);
  } catch (error: any) {
    console.error('Error updating usage:', error);
    return NextResponse.json(
      { error: 'Failed to update usage' },
      { status: 500 }
    );
  }
}

// GET /api/partners/usage - Get AI usage for a customer or all customers
export async function GET(req: NextRequest) {
  try {
    const { userId } = await getAuth(req);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('customerId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build the where clause based on parameters
    const where: any = {
      partnerId: userId,
    };

    if (customerId) {
      where.customerId = customerId;
    }

    if (startDate && endDate) {
      where.usageDate = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const usage = await prisma.aIUsage.findMany({
      where,
      orderBy: {
        usageDate: 'desc',
      },
      include: {
        partner: {
          select: {
            businessName: true,
          },
        },
      },
    });

    return NextResponse.json({ data: usage });
  } catch (error) {
    console.error('Error fetching AI usage:', error);
    return NextResponse.json(
      { error: 'Failed to fetch AI usage' },
      { status: 500 }
    );
  }
}
