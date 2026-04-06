import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { getAuth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Schema for tool registration
const toolRegistrationSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  version: z.string(),
  spec: z.string(),
  specType: z.enum(['json', 'yaml', 'url']),
  config: z.array(z.object({
    key: z.string(),
    value: z.string(),
    isSecret: z.boolean().optional(),
    description: z.string().optional(),
  })),
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = toolRegistrationSchema.parse(body);

    const tool = await prisma.tool.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        version: validatedData.version,
        spec: validatedData.spec,
        specType: validatedData.specType,
        userId,
        config: {
          create: validatedData.config.map(field => ({
            key: field.key,
            value: field.value,
            isSecret: field.isSecret || false,
            description: field.description,
          })),
        },
      },
      include: {
        config: true,
      },
    });

    return NextResponse.json(tool);
  } catch (error) {
    console.error('Error registering tool:', error);
    return NextResponse.json(
      { error: 'Failed to register tool' },
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

    const tools = await prisma.tool.findMany({
      where: { userId },
      include: {
        config: true,
      },
      orderBy: { createdAt: 'desc' },
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
