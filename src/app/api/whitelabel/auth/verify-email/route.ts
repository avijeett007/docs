import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { obfuscateEmail } from '@/lib/pii-obfuscation';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();
    
    if (!token) {
      return NextResponse.json(
        { error: 'Verification token is required' },
        { status: 400 }
      );
    }
    
    // Find the customer credential with this verification token
    const customerCredential = await prisma.customerCredential.findFirst({
      where: {
        magicLinkToken: token,
        magicLinkExpiry: {
          gt: new Date() // Token must not be expired
        },
        magicLinkUsed: false, // Token must not have been used
        magicLinkType: 'email_verification',
        status: 'active'
      },
      include: {
        customer: true,
      }
    });
    
    if (!customerCredential) {
      return NextResponse.json(
        { error: 'Invalid, expired, or already used verification link' },
        { status: 400 }
      );
    }
    
    // Mark the email as verified and clear the verification token
    await prisma.customerCredential.update({
      where: { id: customerCredential.id },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        magicLinkUsed: true,
        magicLinkToken: null, // Clear the token for security
        magicLinkExpiry: null,
        magicLinkType: null,
      },
    });

    logger.info('Email verified successfully for customer', {
      customerEmail: obfuscateEmail(customerCredential.email),
      customerId: customerCredential.customerId,
      operation: 'email_verification'
    });

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully! You can now sign in to your account.',
      customer: {
        id: customerCredential.customer.id,
        name: `${customerCredential.customer.firstName || ''} ${customerCredential.customer.lastName || ''}`.trim() || 'Customer',
        email: customerCredential.email,
      }
    });

  } catch (error) {
    console.error('Error during email verification:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
