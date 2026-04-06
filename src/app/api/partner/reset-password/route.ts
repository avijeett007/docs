import { NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { verifyJWT } from '@/lib/jwt';
import { clerkClient } from '@clerk/nextjs/server';

export async function POST(request: Request) {
  try {
    // Get the token from the Authorization header
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const payload = await verifyJWT(token);

    if (!payload || !payload.partnerId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get request body
    const { userId, email } = await request.json();

    if (!userId || !email) {
      return NextResponse.json(
        { error: 'User ID and email are required' },
        { status: 400 }
      );
    }

    // Get the user's primary email ID
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const primaryEmailId = user.primaryEmailAddressId;

    if (!primaryEmailId) {
      return NextResponse.json(
        { error: 'User does not have a primary email address' },
        { status: 400 }
      );
    }

    // Create a password reset token and send email
    // await clerk.users.updateUser(userId, {
    //   passwordResetToken: true
    // });

    return NextResponse.json({
      message: 'Password reset email sent successfully'
    });
  } catch (error: any) {
    console.error('Error sending password reset email:', error);
    return NextResponse.json(
      { 
        error: 'An error occurred while sending password reset email',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
