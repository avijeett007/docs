import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { getAuth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    // Only allow deletion of plugins published by the user
    const plugin = await prisma.knotiePlugin.findFirst({
      where: { id, publisherId: userId }
    });

    if (!plugin) {
      return NextResponse.json(
        { error: 'Plugin not found or unauthorized' },
        { status: 404 }
      );
    }

    // Delete plugin (this will cascade delete connections)
    await prisma.knotiePlugin.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting plugin:', error);
    return NextResponse.json(
      { error: 'Failed to delete plugin' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const body = await req.json();
    const { name, description, version, category, documentation } = body;

    // Only allow updates to plugins published by the user
    const existingPlugin = await prisma.knotiePlugin.findFirst({
      where: { id, publisherId: userId }
    });

    if (!existingPlugin) {
      return NextResponse.json(
        { error: 'Plugin not found or unauthorized' },
        { status: 404 }
      );
    }

    // Update plugin
    const plugin = await prisma.knotiePlugin.update({
      where: { id },
      data: {
        name,
        description,
        version,
        category,
        documentation
      }
    });

    return NextResponse.json({ plugin });
  } catch (error) {
    console.error('Error updating plugin:', error);
    return NextResponse.json(
      { error: 'Failed to update plugin' },
      { status: 500 }
    );
  }
}
