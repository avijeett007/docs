import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  console.log('Received booking request');
  try {
    const body = await request.json();
    console.log('Request body:', body);
    const { selectedSlot, userId } = body;

    if (!selectedSlot || !userId) {
      console.log('Missing required fields:', { selectedSlot, userId });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get user's onboarding data to check for partner
    const userOnboarding = await prisma.userOnboarding.findUnique({
      where: { userId },
      select: { 
        email: true, 
        firstName: true, 
        companyName: true,
        partnerId: true,
        partner: {
          select: {
            ghlCalendarId: true,
            ghlApiKey: true
          }
        }
      }
    });

    if (!userOnboarding?.email) {
      return NextResponse.json(
        { error: 'User email not found' },
        { status: 400 }
      );
    }

    // Determine which calendar and API key to use
    let calendarId: string;
    let apiKey: string;
    
    if (userOnboarding.partnerId && userOnboarding.partner?.ghlCalendarId && userOnboarding.partner?.ghlApiKey) {
      // Use partner's calendar and API key
      calendarId = userOnboarding.partner.ghlCalendarId;
      apiKey = await decrypt(userOnboarding.partner.ghlApiKey);
      console.log('Using partner calendar:', calendarId);
    } else {
      // Use default calendar and API key
      calendarId = process.env.NEXT_PUBLIC_CALENDAR_ID!;
      apiKey = process.env.GOHIGHLEVEL_BEARER_TOKEN!;
      console.log('Using default calendar:', calendarId);
    }

    console.log('Making request to GoHighLevel API');
    // Book appointment with GoHighLevel API
    const response = await fetch(`${process.env.NEXT_PUBLIC_GOHIGHLEVEL_API_URL}/appointments/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        calendarId: calendarId,
        selectedTimezone: process.env.DEFAULT_TIMEZONE || 'America/New_York',
        selectedSlot,
        email: userOnboarding.email,
        firstName: userOnboarding.companyName || userOnboarding.firstName || 'Business Name'
      }),
    });

    const data = await response.json();
    console.log('GoHighLevel API response:', data);

    if (!response.ok) {
      // Check for specific error types from GoHighLevel API
      if (data.message?.includes('slot is no longer available')) {
        return NextResponse.json(
          { error: 'Time slot is no longer available' },
          { status: 409 }
        );
      }
      
      return NextResponse.json(
        { error: data.message || 'Failed to book appointment' },
        { status: response.status }
      );
    }

    // Store appointment in our database
    console.log('Storing appointment in database');
    const appointmentDate = new Date(selectedSlot);
    const appointment = await prisma.appointment.create({
      data: {
        userId: userId,
        appointmentTime: appointmentDate,
        bookingId: data.id || 'temp-id', // Fallback in case GoHighLevel doesn't return an ID
        status: 'SCHEDULED',
      },
    });

    console.log('Successfully created appointment:', appointment);
    return NextResponse.json({
      message: 'Appointment booked successfully',
      appointment: appointment,
      bookingDetails: data,
    });
  } catch (error) {
    console.error('Error booking appointment:', error);
    // Always return a NextResponse, even in error cases
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
