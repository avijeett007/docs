import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { getAuth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import type { WidgetConfig } from '@/types/widget';

export async function POST(req: NextRequest) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const widgetConfig: WidgetConfig = await req.json();
    
    // Validate the widget belongs to the user
    if (widgetConfig.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Save to database
    const widget = await prisma.widget.create({
      data: {
        id: widgetConfig.id,
        agentId: widgetConfig.agentId,
        userId: widgetConfig.userId,
        type: widgetConfig.type,
        position: widgetConfig.position,
        primaryColor: widgetConfig.primaryColor,
        connectingColor: widgetConfig.connectingColor,
        activeColor: widgetConfig.activeColor,
        endedColor: widgetConfig.endedColor,
        welcomeMessage: widgetConfig.welcomeMessage,
        buttonText: widgetConfig.buttonText,
        size: widgetConfig.size,
        showParticles: widgetConfig.showParticles,
        showPulse: widgetConfig.showPulse,
        embedCode: widgetConfig.embedCode,
        secondaryColor: '#000000',
        backgroundColor: '#ffffff',
        showBranding: true,
        showTranscript: true,
        showAvatar: true,
        showName: true,
      },
    });

    return NextResponse.json(widget);
  } catch (error) {
    console.error('[WIDGETS_POST]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all widgets for the user
    const widgets = await prisma.widget.findMany({
      where: {
        userId,
      },
    });

    // Convert to Record<string, WidgetConfig> format
    const widgetsMap = widgets.reduce((acc, widget) => {
      acc[widget.id] = {
        id: widget.id,
        agentId: widget.agentId,
        userId: widget.userId,
        type: widget.type as WidgetConfig['type'],
        position: widget.position as WidgetConfig['position'],
        primaryColor: widget.primaryColor,
        connectingColor: widget.connectingColor,
        activeColor: widget.activeColor,
        endedColor: widget.endedColor,
        welcomeMessage: widget.welcomeMessage,
        buttonText: widget.buttonText,
        size: widget.size as WidgetConfig['size'],
        showParticles: widget.showParticles ?? false,
        showPulse: widget.showPulse ?? false,
        embedCode: widget.embedCode ?? undefined,
        secondaryColor: '#000000',
        backgroundColor: '#ffffff',
        showBranding: true,
        showTranscript: true,
        showAvatar: true,
        showName: true,
      };
      return acc;
    }, {} as Record<string, WidgetConfig>);

    return NextResponse.json(widgetsMap);
  } catch (error) {
    console.error('[WIDGETS_GET]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
