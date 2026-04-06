import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { getAuth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { widgetId: string } }
) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const widgetId = params.widgetId;

    // Verify widget belongs to user
    const widget = await prisma.widget.findUnique({
      where: {
        id: widgetId,
      },
    });

    if (!widget || widget.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete the widget
    await prisma.widget.delete({
      where: {
        id: widgetId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[WIDGET_DELETE]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
