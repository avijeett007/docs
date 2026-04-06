import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createDynamicApiHandler } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

const handler = async (req: NextRequest) => {
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const data = await req.json();
  const { email } = data;

  if (!email) {
    return NextResponse.json(
      { error: 'Email is required' },
      { status: 400 }
    );
  }

  try {
    const existingSubscriber = await prisma.newsletterSubscriber.findUnique({
      where: { email },
    });

    if (existingSubscriber) {
      if (existingSubscriber.status === 'unsubscribed') {
        // Reactivate the subscription
        await prisma.newsletterSubscriber.update({
          where: { email },
          data: { status: 'active' },
        });

        return NextResponse.json({
          message: 'Subscription reactivated successfully',
        });
      }
      return NextResponse.json({
        message: 'Already subscribed',
      });
    }

    await prisma.newsletterSubscriber.create({
      data: {
        email,
        status: 'active',
      },
    });

    return NextResponse.json({
      message: 'Subscribed successfully',
    });
  } catch (error) {
    console.error('Error in newsletter subscription:', error);
    return NextResponse.json(
      { error: 'Failed to process subscription' },
      { status: 500 }
    );
  }
};

export const POST = createDynamicApiHandler(handler);
