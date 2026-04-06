import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Update a notification (admin only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { notificationId: string } }
) {
  try {
    // TODO: Add proper admin authentication
    
    const { notificationId } = params;
    const body = await request.json();

    // Check if notification exists
    const existingNotification = await prisma.platformNotification.findUnique({
      where: { id: notificationId }
    });

    if (!existingNotification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {};

    // Update fields if provided
    if (body.title !== undefined) updateData.title = body.title;
    if (body.message !== undefined) updateData.message = body.message;
    if (body.type !== undefined) {
      if (!['info', 'warning', 'success', 'error', 'migration'].includes(body.type)) {
        return NextResponse.json(
          { error: 'Invalid notification type' },
          { status: 400 }
        );
      }
      updateData.type = body.type;
    }
    if (body.targetAudience !== undefined) {
      if (!['partners', 'customers', 'all'].includes(body.targetAudience)) {
        return NextResponse.json(
          { error: 'Invalid target audience' },
          { status: 400 }
        );
      }
      updateData.targetAudience = body.targetAudience;
    }
    if (body.priority !== undefined) {
      if (body.priority < 1 || body.priority > 4) {
        return NextResponse.json(
          { error: 'Priority must be between 1 and 4' },
          { status: 400 }
        );
      }
      updateData.priority = body.priority;
    }
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.expiresAt !== undefined) {
      updateData.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    }
    if (body.actionUrl !== undefined) updateData.actionUrl = body.actionUrl;
    if (body.actionText !== undefined) updateData.actionText = body.actionText;

    // Update notification
    const notification = await prisma.platformNotification.update({
      where: { id: notificationId },
      data: updateData
    });

    return NextResponse.json({
      success: true,
      notification
    });

  } catch (error) {
    console.error('Error updating notification:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * Delete a notification (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { notificationId: string } }
) {
  try {
    // TODO: Add proper admin authentication
    
    const { notificationId } = params;

    // Check if notification exists
    const existingNotification = await prisma.platformNotification.findUnique({
      where: { id: notificationId }
    });

    if (!existingNotification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    // Delete notification (this will also delete related views due to cascade)
    await prisma.platformNotification.delete({
      where: { id: notificationId }
    });

    return NextResponse.json({
      success: true,
      message: 'Notification deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting notification:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
