import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { email, subdomain } = await request.json();

    if (!email || !subdomain) {
      return NextResponse.json(
        { error: 'Email and subdomain are required' },
        { status: 400 }
      );
    }

    // Find the partner by subdomain
    const partner = await prisma.partner.findFirst({
      where: {
        subdomain: subdomain
      }
    });

    if (!partner) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Check if email already exists as a UserOnboarding record for this partner
    const existingUser = await prisma.userOnboarding.findFirst({
      where: {
        email: email.toLowerCase(),
        partnerId: partner.id
      }
    });

    if (existingUser) {
      // Check if this is already a newsletter subscriber
      if (existingUser.dealStatus === 'NEWSLETTER_SUBSCRIBER') {
        return NextResponse.json(
          { message: 'You are already subscribed to our newsletter!' },
          { status: 200 }
        );
      } else {
        return NextResponse.json(
          { message: 'You already have an account with us. Please login to continue.' },
          { status: 200 }
        );
      }
    }

    // Generate a unique userId for newsletter subscribers
    const userId = `newsletter_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // Create UserOnboarding record for newsletter subscriber
    await prisma.userOnboarding.create({
      data: {
        userId: userId,
        email: email.toLowerCase(),
        partnerId: partner.id,
        // Set some identifying fields to mark this as a newsletter subscriber
        companyName: 'Newsletter Subscriber',
        primaryUseCase: 'Newsletter Subscription',
        orderStatus: 'newsletter_subscriber',
        dealStatus: 'NEWSLETTER_SUBSCRIBER'
      }
    });

    return NextResponse.json(
      { message: 'Successfully subscribed to newsletter!' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Newsletter subscription error:', error);
    return NextResponse.json(
      { error: 'Failed to subscribe to newsletter' },
      { status: 500 }
    );
  }
}
