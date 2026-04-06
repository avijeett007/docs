import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const sessionUpdateSchema = z.object({
  session_id: z.string().min(1, 'Session ID is required'),
  action: z.enum(['message_sent', 'session_end']),
  message_count: z.number().optional(),
  duration: z.number().optional(), // in seconds
  metadata: z.record(z.any()).optional()
});

export const dynamic = 'force-dynamic';

// PUT - Update widget session (message count, end session, etc.)
export async function PUT(
  request: NextRequest,
  { params }: { params: { widgetToken: string } }
) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validationResult = sessionUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const { session_id, action, message_count, duration, metadata } = validationResult.data;

    console.log('[WIDGET-SESSION] Updating session:', {
      widgetToken: params.widgetToken,
      sessionId: session_id,
      action,
      messageCount: message_count,
      duration
    });

    // Find widget by token
    const widget = await prisma.n8nChatWidget.findFirst({
      where: {
        widgetToken: params.widgetToken,
        isActive: true
      }
    });

    if (!widget) {
      return NextResponse.json(
        { error: 'Widget not found or inactive' },
        { status: 404 }
      );
    }

    // Find session
    const session = await prisma.n8nChatWidgetSession.findFirst({
      where: {
        sessionId: session_id,
        widgetId: widget.id
      }
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Update session based on action
    const updateData: any = {
      lastActivityAt: new Date()
    };

    if (metadata) {
      updateData.metadata = {
        ...session.metadata as any,
        ...metadata
      };
    }

    if (action === 'message_sent') {
      if (message_count !== undefined) {
        updateData.messageCount = message_count;
      } else {
        updateData.messageCount = {
          increment: 1
        };
      }

      // Update widget message count
      await prisma.n8nChatWidget.update({
        where: {
          id: widget.id
        },
        data: {
          totalMessages: {
            increment: 1
          },
          lastUsedAt: new Date()
        }
      });

    } else if (action === 'session_end') {
      updateData.endedAt = new Date();
      
      if (duration !== undefined) {
        updateData.duration = duration;
      } else {
        // Calculate duration from start time
        const startTime = session.startedAt.getTime();
        const endTime = new Date().getTime();
        updateData.duration = Math.floor((endTime - startTime) / 1000);
      }
    }

    // Update session
    const updatedSession = await prisma.n8nChatWidgetSession.update({
      where: {
        id: session.id
      },
      data: updateData
    });

    return NextResponse.json({
      success: true,
      message: `Session ${action} updated successfully`,
      data: {
        session_id: updatedSession.sessionId,
        widget_id: widget.id,
        message_count: updatedSession.messageCount,
        duration: updatedSession.duration,
        ended_at: updatedSession.endedAt,
        last_activity_at: updatedSession.lastActivityAt
      }
    });

  } catch (error) {
    console.error('Error updating widget session:', error);
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    );
  }
}

// GET - Get session information
export async function GET(
  request: NextRequest,
  { params }: { params: { widgetToken: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Find widget by token
    const widget = await prisma.n8nChatWidget.findFirst({
      where: {
        widgetToken: params.widgetToken,
        isActive: true
      }
    });

    if (!widget) {
      return NextResponse.json(
        { error: 'Widget not found or inactive' },
        { status: 404 }
      );
    }

    // Find session
    const session = await prisma.n8nChatWidgetSession.findFirst({
      where: {
        sessionId: sessionId,
        widgetId: widget.id
      }
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        session_id: session.sessionId,
        widget_id: widget.id,
        domain: session.domain,
        message_count: session.messageCount,
        started_at: session.startedAt,
        last_activity_at: session.lastActivityAt,
        ended_at: session.endedAt,
        duration: session.duration,
        metadata: session.metadata
      }
    });

  } catch (error) {
    console.error('Error fetching widget session:', error);
    return NextResponse.json(
      { error: 'Failed to fetch session' },
      { status: 500 }
    );
  }
}
