import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { getAuth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

interface ConfigField {
  key: string;
  value?: string;
  isSecret?: boolean;
  description?: string;
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tools = await prisma.tool.findMany({
      where: { userId },
      include: {
        config: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ tools });
  } catch (error) {
    console.error('Error fetching tools:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tools' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, version, spec, specType, config = [] } = body;

    // Validate required fields
    if (!name || !version || !spec || !specType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create the tool
    const tool = await prisma.tool.create({
      data: {
        name,
        description: description || '',
        version,
        spec,
        specType,
        userId,
        config: {
          create: config.map((field: ConfigField) => ({
            key: field.key,
            value: field.value || '',
            isSecret: field.isSecret || false,
            description: field.description || ''
          }))
        }
      },
      include: {
        config: true
      }
    });

    return NextResponse.json({ tool });
  } catch (error) {
    console.error('Error creating tool:', error);
    return NextResponse.json(
      { error: 'Failed to create tool' },
      { status: 500 }
    );
  }
}
