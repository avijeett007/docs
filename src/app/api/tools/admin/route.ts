import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { getAuth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const reviewSchema = z.object({
  toolId: z.string(),
  status: z.enum(['approved', 'rejected']),
  reviewNotes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (user?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can review tools' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validatedData = reviewSchema.parse(body);

    const plugin = await prisma.knotiePlugin.update({
      where: { id: validatedData.toolId },
      data: {
        status: validatedData.status,
        reviewNotes: validatedData.reviewNotes,
      },
    });

    // If plugin is approved and was in community, move it to verified
    if (validatedData.status === 'approved' && plugin.provider === 'community') {
      await prisma.knotiePlugin.update({
        where: { id: validatedData.toolId },
        data: {
          provider: 'verified',
        },
      });
    }

    return NextResponse.json(plugin);
  } catch (error) {
    console.error('Error reviewing tool:', error);
    return NextResponse.json(
      { error: 'Failed to review tool' },
      { status: 500 }
    );
  }
}

// Get tools pending review
export async function GET(req: NextRequest) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (user?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can view pending tools' },
        { status: 403 }
      );
    }

    const pendingPlugins = await prisma.knotiePlugin.findMany({
      where: {
        status: 'pending',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(pendingPlugins);
  } catch (error) {
    console.error('Error fetching pending tools:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending tools' },
      { status: 500 }
    );
  }
}
