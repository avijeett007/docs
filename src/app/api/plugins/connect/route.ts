import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { getAuth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { encrypt } from '@/lib/encryption';

const connectionSchema = z.object({
  pluginId: z.string(),
  authData: z.record(z.any()), // Will be encrypted
  refreshToken: z.string().optional(),
  expiresAt: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = connectionSchema.parse(body);

    // Encrypt sensitive data
    const encryptedAuthData = await encrypt(JSON.stringify(validatedData.authData));

    const connection = await prisma.pluginConnection.create({
      data: {
        pluginId: validatedData.pluginId,
        userId,
        authData: encryptedAuthData,
        refreshToken: validatedData.refreshToken,
        expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : null,
      },
    });

    return NextResponse.json({
      id: connection.id,
      status: connection.status,
    });
  } catch (error) {
    console.error('Error connecting plugin:', error);
    return NextResponse.json(
      { error: 'Failed to connect plugin' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const pluginId = searchParams.get('pluginId');

    if (!pluginId) {
      return NextResponse.json(
        { error: 'Plugin ID is required' },
        { status: 400 }
      );
    }

    const connection = await prisma.pluginConnection.findUnique({
      where: {
        pluginId_userId: {
          pluginId,
          userId,
        },
      },
      include: {
        plugin: true,
      },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: connection.id,
      status: connection.status,
      plugin: {
        id: connection.plugin.id,
        name: connection.plugin.name,
        category: connection.plugin.category,
      },
    });
  } catch (error) {
    console.error('Error fetching connection:', error);
    return NextResponse.json(
      { error: 'Failed to fetch connection' },
      { status: 500 }
    );
  }
}
