import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/password';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    // Get the partner ID from the x-partner-id header (set by our middleware)
    const partnerId = request.headers.get('x-partner-id');

    if (!partnerId) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Find the customer credentials
    const customerCredential = await prisma.customerCredential.findFirst({
      where: {
        partnerId: partnerId,
        email: email,
      },
      select: {
        id: true,
        email: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        customerId: true,
        partnerId: true,
        // Don't include the password hash for security
      },
    });

    if (!customerCredential) {
      return NextResponse.json(
        { 
          found: false,
          message: 'No credentials found for this email and partner',
          details: {
            partnerId,
            email
          }
        }
      );
    }

    // Check if the customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: customerCredential.customerId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        customerPortalEnabled: true,
      }
    });

    // Generate a new password for testing
    const newPassword = 'Test123!';
    const hashedPassword = await hashPassword(newPassword);

    // Update the password
    await prisma.customerCredential.update({
      where: { id: customerCredential.id },
      data: {
        passwordHash: hashedPassword,
        failedLoginAttempts: 0,
        status: 'active'
      }
    });

    return NextResponse.json({
      found: true,
      credential: customerCredential,
      customer,
      testPassword: newPassword,
      message: 'Password has been reset for testing purposes'
    });
  } catch (error) {
    console.error('Error checking credentials:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
