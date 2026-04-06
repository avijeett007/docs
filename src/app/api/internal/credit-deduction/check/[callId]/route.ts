import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/internal/credit-deduction/check/[callId]
 * Check if a credit deduction already exists for a call
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { callId: string } }
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

    const { callId } = params;
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const provider = searchParams.get('provider');

    if (!callId) {
      return NextResponse.json({
        success: false,
        error: 'Call ID is required'
      }, { status: 400 });
    }

    // Build where clause
    const whereClause: any = { callId };
    
    if (customerId) {
      whereClause.customerId = customerId;
    }
    
    if (provider) {
      whereClause.provider = provider;
    }

    // Check if deduction exists
    const existingDeduction = await prisma.callCreditDeduction.findFirst({
      where: whereClause,
      select: {
        id: true,
        deductionStatus: true,
        creditsDeducted: true,
        createdAt: true
      }
    });

    if (existingDeduction) {
      return NextResponse.json({
        success: true,
        exists: true,
        status: existingDeduction.deductionStatus,
        deductionId: existingDeduction.id,
        creditsDeducted: existingDeduction.creditsDeducted,
        createdAt: existingDeduction.createdAt
      });
    } else {
      return NextResponse.json({
        success: true,
        exists: false
      });
    }

  } catch (error) {
    console.error('Error checking credit deduction:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
