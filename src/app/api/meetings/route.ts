import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const email = searchParams.get('email');
  console.log('GET /api/meetings - Received request for email:', email);

  if (!email) {
    console.log('GET /api/meetings - Missing email parameter');
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  try {
    console.log('GET /api/meetings - Fetching meeting for email:', email);
    const meeting = await prisma.meeting.findFirst({
      where: {
        email,
        meetingTime: {
          gt: new Date(),
        },
      },
      orderBy: {
        meetingTime: 'asc',
      },
    });
    console.log('GET /api/meetings - Found meeting:', meeting);

    return NextResponse.json({ meeting });
  } catch (error) {
    console.error('GET /api/meetings - Error fetching meeting:', error);
    return NextResponse.json({ error: 'Failed to fetch meeting' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  console.log('POST /api/meetings - Received request');
  try {
    const body = await req.json();
    console.log('POST /api/meetings - Request body:', JSON.stringify(body, null, 2));
    
    const { email, meetingTime, meetingLink, additionalInfo } = body;
    console.log('POST /api/meetings - Extracted fields:', {
      email,
      meetingTime,
      meetingLink,
      hasAdditionalInfo: !!additionalInfo
    });

    if (!email || !meetingTime || !meetingLink) {
      console.log('POST /api/meetings - Validation failed:', {
        hasEmail: !!email,
        hasMeetingTime: !!meetingTime,
        hasMeetingLink: !!meetingLink
      });
      return NextResponse.json(
        { 
          error: 'Email, meeting time, and meeting link are required',
          receivedFields: {
            email: email || 'missing',
            meetingTime: meetingTime || 'missing',
            meetingLink: meetingLink || 'missing'
          }
        },
        { status: 400 }
      );
    }

    // Delete any existing meetings for this email
    console.log('POST /api/meetings - Deleting existing meetings for email:', email);
    const deletedMeetings = await prisma.meeting.deleteMany({
      where: {
        email,
      },
    });
    console.log('POST /api/meetings - Deleted meetings:', deletedMeetings);

    // Create new meeting
    console.log('POST /api/meetings - Creating new meeting');
    const meeting = await prisma.meeting.create({
      data: {
        email,
        meetingTime: new Date(meetingTime),
        meetingLink,
        additionalInfo,
      },
    });
    console.log('POST /api/meetings - Created meeting:', meeting);

    return NextResponse.json({ meeting });
  } catch (error) {
    console.error('POST /api/meetings - Error:', error);
    console.error('POST /api/meetings - Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json({ 
      error: 'Failed to create meeting',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const email = searchParams.get('email');
  console.log('DELETE /api/meetings - Received request for email:', email);

  if (!email) {
    console.log('DELETE /api/meetings - Missing email parameter');
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  try {
    console.log('DELETE /api/meetings - Deleting meetings for email:', email);
    const result = await prisma.meeting.deleteMany({
      where: {
        email,
      },
    });
    console.log('DELETE /api/meetings - Delete result:', result);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/meetings - Error:', error);
    return NextResponse.json({ error: 'Failed to delete meeting' }, { status: 500 });
  }
}
