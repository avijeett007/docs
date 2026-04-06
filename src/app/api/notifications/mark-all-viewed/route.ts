import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { verifyCustomerAuth } from '@/lib/auth/customerAuth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Mark all notifications as viewed for a user
 */
export async function POST(request: NextRequest) {
  try {
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

    // Get all active notifications for the user's audience
    const notifications = await prisma.platformNotification.findMany({
      where: {
        isActive: true,
        AND: [
          {
            OR: [
              { targetAudience: 'all' },
              { targetAudience: userType === 'partner' ? 'partners' : 'customers' }
            ]
          },
          {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } }
            ]
          }
        ]
      },
      select: { id: true }
    });

    // Create view records for all notifications that don't have one
    const viewPromises = notifications.map(notification =>
      prisma.notificationView.upsert({
        where: {
          notificationId_userId_userType: {
            notificationId: notification.id,
            userId,
            userType
          }
        },
        update: {
          viewedAt: new Date()
        },
        create: {
          notificationId: notification.id,
          userId,
          userType,
          viewedAt: new Date()
        }
      })
    );

    await Promise.all(viewPromises);

    return NextResponse.json({
      success: true,
      message: 'All notifications marked as viewed',
      count: notifications.length
    });

  } catch (error) {
    console.error('Error marking all notifications as viewed:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
