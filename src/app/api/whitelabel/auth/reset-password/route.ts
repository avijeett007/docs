import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/password';

export async function POST(request: NextRequest) {
  try {
    const { token, newPassword } = await request.json();
    
    if (!token) {
      return NextResponse.json(
        { error: 'Reset token is required' },
        { status: 400 }
      );
    }
    
    // Validate new password
    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json(
        { error: 'New password must be at least 8 characters long' },
        { status: 400 }
      );
    }
    
    // Find the customer credential with this reset token
    const customerCredential = await prisma.customerCredential.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          gt: new Date() // Token must not be expired
        }
      }
    });
    
    if (!customerCredential) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }
    
    // Hash the new password
    const newPasswordHash = await hashPassword(newPassword);
    
    // Update the customer credential with the new password and clear the reset token
    await prisma.customerCredential.update({
      where: { id: customerCredential.id },
      data: {
        passwordHash: newPasswordHash,
        resetToken: null,
        resetTokenExpiry: null,
        lastReset: new Date(),
        failedLoginAttempts: 0
      }
    });
    
    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully'
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
