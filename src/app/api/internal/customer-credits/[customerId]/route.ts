import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/internal/customer-credits/[customerId]
 * Get customer AI Credits settings and balance
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { customerId: string } }
) {
  try {
    // Verify internal API key
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.INTERNAL_API_KEY}`;

    if (!authHeader || authHeader !== expectedAuth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { customerId } = params;

    if (!customerId) {
      return NextResponse.json({
        success: false,
        error: 'Customer ID is required'
      }, { status: 400 });
    }

    // Get customer AI Credits settings
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        aiCreditsEnabled: true,
        aiCreditPricePerMinute: true,
        aiCreditGracePeriodSeconds: true,
        creditBalance: true,
        totalCreditsAllocated: true,
        totalCreditsUsed: true,
        lowCreditThreshold: true,
        lowCreditNotificationsEnabled: true
      }
    });

    if (!customer) {
      return NextResponse.json({
        success: false,
        error: 'Customer not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: customer
    });

  } catch (error) {
    console.error('Error fetching customer credits:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * PUT /api/internal/customer-credits/[customerId]
 * Update customer AI Credits settings
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { customerId: string } }
) {
  try {
    // Verify internal API key
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.INTERNAL_API_KEY}`;

    if (!authHeader || authHeader !== expectedAuth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { customerId } = params;
    const body = await request.json();

    if (!customerId) {
      return NextResponse.json({
        success: false,
        error: 'Customer ID is required'
      }, { status: 400 });
    }

    // Validate the customer exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true }
    });

    if (!existingCustomer) {
      return NextResponse.json({
        success: false,
        error: 'Customer not found'
      }, { status: 404 });
    }

    // Build update data
    const updateData: any = {};
    
    if (body.aiCreditsEnabled !== undefined) {
      updateData.aiCreditsEnabled = body.aiCreditsEnabled;
    }
    
    if (body.aiCreditPricePerMinute !== undefined) {
      updateData.aiCreditPricePerMinute = body.aiCreditPricePerMinute;
    }
    
    if (body.aiCreditGracePeriodSeconds !== undefined) {
      updateData.aiCreditGracePeriodSeconds = body.aiCreditGracePeriodSeconds;
    }

    if (body.lowCreditThreshold !== undefined) {
      updateData.lowCreditThreshold = body.lowCreditThreshold;
    }

    if (body.lowCreditNotificationsEnabled !== undefined) {
      updateData.lowCreditNotificationsEnabled = body.lowCreditNotificationsEnabled;
    }

    // Update customer settings
    const updatedCustomer = await prisma.customer.update({
      where: { id: customerId },
      data: updateData,
      select: {
        id: true,
        aiCreditsEnabled: true,
        aiCreditPricePerMinute: true,
        aiCreditGracePeriodSeconds: true,
        creditBalance: true,
        totalCreditsAllocated: true,
        totalCreditsUsed: true,
        lowCreditThreshold: true,
        lowCreditNotificationsEnabled: true
      }
    });

    return NextResponse.json({
      success: true,
      data: updatedCustomer
    });

  } catch (error) {
    console.error('Error updating customer credits:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
