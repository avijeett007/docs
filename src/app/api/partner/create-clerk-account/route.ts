import { NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { verifyJWT } from '@/lib/jwt';
import { createClerkClient } from '@clerk/nextjs/server';

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

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
    const { customerId, email } = await request.json();

    if (!customerId || !email) {
      return NextResponse.json(
        { error: 'Customer ID and email are required' },
        { status: 400 }
      );
    }

    // Generate a random password
    const generatePassword = () => {
      const length = 12;
      const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
      let password = '';
      for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        password += charset[randomIndex];
      }
      return password;
    };

    const password = generatePassword();

    // Create Clerk user
    const clerkUser = await clerk.users.createUser({
      emailAddress: [email],
      password,
    });

    // Update user with Clerk ID
    await prisma.userOnboarding.update({
      where: {
        id: customerId,
      },
      data: {
        userId: clerkUser.id,
      },
    });

    return NextResponse.json({
      message: 'Clerk account created successfully',
      userId: clerkUser.id,
      temporaryPassword: password,
    });
  } catch (error: any) {
    console.error('Error creating Clerk account:', error);
    return NextResponse.json(
      { 
        error: 'An error occurred while creating Clerk account',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
