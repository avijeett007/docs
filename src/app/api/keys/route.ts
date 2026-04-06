import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all unique keys from existing tools' config fields
    const tools = await prisma.tool.findMany({
      where: { userId },
      include: {
        config: {
          select: {
            key: true,
            description: true
          }
        }
      }
    });

    // Extract unique keys
    const uniqueKeys = new Map();
    tools.forEach(tool => {
      tool.config.forEach(config => {
        if (!uniqueKeys.has(config.key)) {
          uniqueKeys.set(config.key, {
            id: config.key,
            name: config.key,
            description: config.description || ''
          });
        }
      });
    });

    return NextResponse.json({ 
      keys: Array.from(uniqueKeys.values())
    });
  } catch (error) {
    console.error('Error fetching keys:', error);
    return NextResponse.json(
      { error: 'Failed to fetch keys' },
      { status: 500 }
    );
  }
}
