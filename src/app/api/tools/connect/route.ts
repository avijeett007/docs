import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { getAuth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/encryption';
import { z } from 'zod';

const connectionSchema = z.object({
  toolId: z.string(),
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

    const connection = await prisma.connectedTool.create({
      data: {
        toolId: validatedData.toolId,
        workspaceId: userId, // Using userId as workspaceId
        authData: encryptedAuthData,
        refreshToken: validatedData.refreshToken,
        expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : null,
        status: 'connected',
      },
    });

    return NextResponse.json({
      id: connection.id,
      status: connection.status,
    });
  } catch (error) {
    console.error('Error connecting tool:', error);
    return NextResponse.json(
      { error: 'Failed to connect tool' },
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
    const toolId = searchParams.get('toolId');

    if (!toolId) {
      return NextResponse.json(
        { error: 'Tool ID is required' },
        { status: 400 }
      );
    }

    const connection = await prisma.connectedTool.findFirst({
      where: {
        toolId: toolId,
        workspaceId: userId, // Using userId as workspaceId
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
    });
  } catch (error) {
    console.error('Error fetching connection:', error);
    return NextResponse.json(
      { error: 'Failed to fetch connection' },
      { status: 500 }
    );
  }
}
