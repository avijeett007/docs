import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { verifyCustomerAuth } from '@/lib/auth/customerAuth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Get notifications for a user (partner or customer)
 */
export async function GET(request: NextRequest) {
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
      const partner = await verifyPartnerAuth(request);
      if (!partner) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
      userId = partner.id;
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

    // Get active notifications for the user
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
      include: {
        views: {
          where: {
            userId,
            userType
          }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    // Format notifications with view status
    const formattedNotifications = notifications.map(notification => ({
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      priority: notification.priority,
      actionUrl: notification.actionUrl,
      actionText: notification.actionText,
      createdAt: notification.createdAt.toISOString(),
      isViewed: notification.views.length > 0
    }));

    // Count unread notifications
    const unreadCount = formattedNotifications.filter(n => !n.isViewed).length;

    return NextResponse.json({
      success: true,
      notifications: formattedNotifications,
      unreadCount
    });

  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * Create a new notification (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    // For now, we'll implement admin authentication later
    // This will be used by the mission control panel
    
    const body = await request.json();
    const {
      title,
      message,
      type,
      targetAudience,
      priority,
      expiresAt,
      actionUrl,
      actionText,
      createdBy
    } = body;

    // Validate required fields
    if (!title || !message || !type || !targetAudience) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create notification
    const notification = await prisma.platformNotification.create({
      data: {
        title,
        message,
        type,
        targetAudience,
        priority: priority || 1,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        actionUrl,
        actionText,
        createdBy: createdBy || 'admin'
      }
    });

    return NextResponse.json({
      success: true,
      notification: {
        id: notification.id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        targetAudience: notification.targetAudience,
        priority: notification.priority,
        createdAt: notification.createdAt.toISOString()
      }
    });

  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
