import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { createDynamicApiHandler } from '@/lib/api-utils';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateStatusSchema = z.object({
  email: z.string().email(),
  status: z.enum(['active', 'unsubscribed']),
});

const handler = async (req: NextRequest) => {
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body = await req.json();
    const { email, status } = updateStatusSchema.parse(body);

    const subscriber = await prisma.newsletterSubscriber.findUnique({
      where: { email },
    });

    if (!subscriber) {
      return NextResponse.json(
        { error: 'Subscriber not found' },
        { status: 404 }
      );
    }

    const updatedSubscriber = await prisma.newsletterSubscriber.update({
      where: { email },
      data: { status },
    });

    return NextResponse.json(updatedSubscriber);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }

    console.error('Error updating subscriber status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
};

export const POST = createDynamicApiHandler(handler);
