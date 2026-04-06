import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Get all notifications (admin only)
 */
export async function GET(_request: NextRequest) {
  try {
    // TODO: Add proper admin authentication
    // For now, we'll allow access for development
    
    const notifications = await prisma.platformNotification.findMany({
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    return NextResponse.json({
      success: true,
      notifications
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
export async function POST(_request: NextRequest) {
  try {
    // TODO: Add proper admin authentication

    const body = await _request.json();
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

    // Validate type
    if (!['info', 'warning', 'success', 'error', 'migration'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid notification type' },
        { status: 400 }
      );
    }

    // Validate target audience
    if (!['partners', 'customers', 'all'].includes(targetAudience)) {
      return NextResponse.json(
        { error: 'Invalid target audience' },
        { status: 400 }
      );
    }

    // Validate priority
    if (priority && (priority < 1 || priority > 4)) {
      return NextResponse.json(
        { error: 'Priority must be between 1 and 4' },
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
      notification
    });

  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
