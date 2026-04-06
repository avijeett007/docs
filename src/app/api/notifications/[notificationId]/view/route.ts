import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { verifyCustomerAuth } from '@/lib/auth/customerAuth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Mark a notification as viewed
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { notificationId: string } }
) {
  try {
    const { notificationId } = params;
    const { searchParams } = new URL(request.url);
    const userType = searchParams.get('userType') as 'partner' | 'customer';

    if (!userType || !['partner', 'customer'].includes(userType)) {
      return NextResponse.json(
        { error: 'Invalid user type' },
        { status: 400 }
      );
    }

    let userId: string;

    // Verify authentication based on user type
    if (userType === 'partner') {
      const auth = await verifyPartnerJWT(request);
      if (!auth.isValid) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
      userId = auth.payload?.partnerId!;
    } else {
      const auth = await verifyCustomerAuth(request);
      if (!auth) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
      userId = auth.customerId;
    }

    // Check if notification exists
    const notification = await prisma.platformNotification.findUnique({
      where: { id: notificationId }
    });

    if (!notification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    // Create or update view record
    await prisma.notificationView.upsert({
      where: {
        notificationId_userId_userType: {
          notificationId,
          userId,
          userType
        }
      },
      update: {
        viewedAt: new Date()
      },
      create: {
        notificationId,
        userId,
        userType,
        viewedAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Notification marked as viewed'
    });

  } catch (error) {
    console.error('Error marking notification as viewed:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
