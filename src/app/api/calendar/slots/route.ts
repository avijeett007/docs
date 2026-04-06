import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const timezone = searchParams.get('timezone');
    const userId = searchParams.get('userId');

    if (!startDate || !endDate || !timezone || !userId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Get user's onboarding data to check for partner
    const userOnboarding = await prisma.userOnboarding.findUnique({
      where: { userId },
      include: { partner: true }
    });

    if (!userOnboarding) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Determine which calendar and API key to use
    let calendarId: string;
    let apiKey: string;
    
    if (userOnboarding.partnerId && userOnboarding.partner?.ghlCalendarId && userOnboarding.partner?.ghlApiKey) {
      // Use partner's calendar and API key
      calendarId = userOnboarding.partner.ghlCalendarId;
      apiKey = await decrypt(userOnboarding.partner.ghlApiKey);
    } else {
      // Use default calendar and API key
      calendarId = process.env.NEXT_PUBLIC_CALENDAR_ID!;
      apiKey = process.env.GOHIGHLEVEL_BEARER_TOKEN!;
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_GOHIGHLEVEL_API_URL}/appointments/slots?` +
      `calendarId=${calendarId}&` +
      `startDate=${startDate}&` +
      `endDate=${endDate}&` +
      `timezone=${encodeURIComponent(timezone)}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch slots from GoHighLevel');
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching slots:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available slots' },
      { status: 500 }
    );
  }
}
