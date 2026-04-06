import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { getAuth } from '@clerk/nextjs/server';
import { z } from 'zod';

// Schema for plugin registration
const pluginRegistrationSchema = z.object({
  name: z.string(),
  description: z.string(),
  version: z.string(),
  category: z.string(),
  provider: z.enum(['official', 'verified', 'community']),
  publisherId: z.string(),
  icon: z.string().optional(),
  documentation: z.string().optional(),
  packageName: z.string(),
  authType: z.enum(['oauth2', 'apiKey', 'basic']),
  authConfig: z.string(), // JSON string
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = pluginRegistrationSchema.parse(body);

    const plugin = await prisma.knotiePlugin.create({
      data: {
        ...validatedData,
        status: 'pending',
      },
    });

    return NextResponse.json(plugin);
  } catch (error) {
    console.error('Error registering plugin:', error);
    return NextResponse.json(
      { error: 'Failed to register plugin' },
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
    const provider = searchParams.get('provider');
    const category = searchParams.get('category');
    const status = searchParams.get('status');

    const where: any = {};
    if (provider) where.provider = provider;
    if (category) where.category = category;
    if (status) where.status = status;

    const plugins = await prisma.knotiePlugin.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(plugins);
  } catch (error) {
    console.error('Error fetching plugins:', error);
    return NextResponse.json(
      { error: 'Failed to fetch plugins' },
      { status: 500 }
    );
  }
}
