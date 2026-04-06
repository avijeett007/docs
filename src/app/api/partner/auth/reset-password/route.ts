import { NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateRandomPassword } from '@/lib/password-generator';
import { hashPassword } from '@/lib/password';
import { sendPartnerResetPasswordEmail } from '@/lib/email';
import { securePublicRoute, ValidationSchemas } from '@/lib/security/publicRoutesSecurity';

export async function POST(request: NextRequest) {
  try {
    // Apply security measures
    const securityCheck = await securePublicRoute(request, {
      rateLimitRequests: 3, // Very restrictive for password reset
      rateLimitWindowMs: 15 * 60 * 1000, // 15 minutes
      requireOriginValidation: true,
      allowedMethods: ['POST']
    });

    if (!securityCheck.success) {
      return securityCheck.response;
    }

    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Validate email format
    try {
      ValidationSchemas.email.parse(email);
    } catch (validationError) {
      // Don't reveal validation details for security
      return NextResponse.json({
        message: 'If your account exists and is active, a password reset email has been sent'
      });
    }

    // Find the partner
    const partner = await prisma.partner.findUnique({
      where: { emailAddress: email },
      select: { 
        id: true, 
        businessName: true, 
        emailAddress: true, 
        subscriptionStatus: true,
        approvalStatus: true
      },
    });

    // Don't reveal if the partner exists or not for security reasons
    if (!partner) {
      // We intentionally don't send an error to prevent email enumeration attacks
      // Instead, we send a generic success message
      return NextResponse.json({ 
        message: 'If your account exists and is active, a password reset email has been sent'
      });
    }

    // Check if the subscription is active and the partner is approved
    if (partner.subscriptionStatus !== 'ACTIVE' || partner.approvalStatus !== 'ACTIVE') {
      // We don't reveal the specific issue for security reasons
      return NextResponse.json({ 
        message: 'If your account exists and is active, a password reset email has been sent'
      });
    }

    // Generate a new random password
    const newPassword = generateRandomPassword();
    
    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);

    // Update the partner's password in the database
    await prisma.partner.update({
      where: { id: partner.id },
      data: { 
        hashedPassword,
        hasChangedPassword: false // Force them to change password on next login
      },
    });

    // Send the password reset email using the new email function
    await sendPartnerResetPasswordEmail({
      to: partner.emailAddress,
      businessName: partner.businessName,
      password: newPassword,
    });

    return NextResponse.json({ 
      message: 'Password reset successful. Check your email for the new temporary password.' 
    });
  } catch (error: any) {
    console.error('Error resetting password:', error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}
