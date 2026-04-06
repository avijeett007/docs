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

    // Verify tool ownership
    const tool = await prisma.tool.findFirst({
      where: { id, userId }
    });

    if (!tool) {
      return NextResponse.json(
        { error: 'Tool not found or unauthorized' },
        { status: 404 }
      );
    }

    // Delete tool (this will cascade delete config fields)
    await prisma.tool.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting tool:', error);
    return NextResponse.json(
      { error: 'Failed to delete tool' },
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
    const { name, description, version, spec, specType, config } = body;

    // Verify tool ownership
    const existingTool = await prisma.tool.findFirst({
      where: { id, userId }
    });

    if (!existingTool) {
      return NextResponse.json(
        { error: 'Tool not found or unauthorized' },
        { status: 404 }
      );
    }

    // Update tool and config fields
    const tool = await prisma.tool.update({
      where: { id },
      data: {
        name,
        description,
        version,
        spec,
        specType,
        config: {
          deleteMany: {}, // Remove existing config fields
          create: config.map((field: any) => ({
            key: field.key,
            value: field.value,
            isSecret: field.isSecret,
            description: field.description
          }))
        }
      },
      include: {
        config: true
      }
    });

    return NextResponse.json({ tool });
  } catch (error) {
    console.error('Error updating tool:', error);
    return NextResponse.json(
      { error: 'Failed to update tool' },
      { status: 500 }
    );
  }
}
