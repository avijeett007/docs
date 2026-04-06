import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateEmailOTP } from '@/lib/mfa';
import { sendEmail } from '@/lib/email';
import { encryptData } from '@/lib/encryption';

export const dynamic = 'force-dynamic';

// Store OTPs temporarily in memory (in production, use Redis or database)
const otpStore = new Map<string, { otp: string; expiresAt: number; attempts: number }>();

// Clean up expired OTPs every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of otpStore.entries()) {
    if (value.expiresAt < now) {
      otpStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export async function POST(request: Request) {
  try {
    const { partnerId } = await request.json();

    if (!partnerId) {
      return NextResponse.json({ error: 'Partner ID is required' }, { status: 400 });
    }

    // Get partner details
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        id: true,
        emailAddress: true,
        businessName: true,
        contactName: true,
        approvalStatus: true,
      },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    if (partner.approvalStatus !== 'ACTIVE') {
      return NextResponse.json({ error: 'Partner account is not active' }, { status: 403 });
    }

    // Check rate limiting (max 3 attempts per 15 minutes)
    const rateLimitKey = `rate_limit_${partnerId}`;
    const existingData = otpStore.get(rateLimitKey);
    
    if (existingData && existingData.attempts >= 3) {
      const timeRemaining = Math.ceil((existingData.expiresAt - Date.now()) / 1000 / 60);
      return NextResponse.json(
        { error: `Too many attempts. Please try again in ${timeRemaining} minutes.` },
        { status: 429 }
      );
    }

    // Generate OTP
    const otp = generateEmailOTP();
    const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minutes

    // Store OTP
    const otpKey = `otp_${partnerId}`;
    otpStore.set(otpKey, {
      otp: await encryptData(otp),
      expiresAt,
      attempts: 0,
    });

    // Update rate limiting
    otpStore.set(rateLimitKey, {
      otp: '',
      expiresAt: Date.now() + (15 * 60 * 1000), // 15 minutes
      attempts: (existingData?.attempts || 0) + 1,
    });

    // Send OTP email
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #3B82F6; margin: 0;">Knotie AI Pro</h1>
          <p style="color: #666; margin: 5px 0;">Partner Portal</p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px; text-align: center;">
          <h2 style="color: #333; margin-bottom: 20px;">Your Login Verification Code</h2>
          
          <div style="background-color: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px dashed #3B82F6;">
            <span style="font-size: 32px; font-weight: bold; color: #3B82F6; letter-spacing: 4px;">${otp}</span>
          </div>
          
          <p style="color: #666; margin: 20px 0;">
            Enter this code in your login screen to complete the authentication process.
          </p>
          
          <p style="color: #999; font-size: 14px;">
            This code will expire in 10 minutes. If you didn't request this code, please ignore this email.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #666; font-size: 12px;">
          <p>&copy; ${new Date().getFullYear()} ${partner.businessName}. All rights reserved.</p>
          <p>This is an automated message, please do not reply.</p>
        </div>
      </div>
    `;

    await sendEmail({
      to: partner.emailAddress,
      subject: `Your ${partner.businessName} Login Code: ${otp}`,
      html: htmlContent,
      from: process.env.SENDGRID_FROM_EMAIL || 'security@knotie-ai.pro',
      fromName: `${partner.businessName} - Knotie AI Pro`,
    });

    return NextResponse.json({
      message: 'OTP sent successfully',
      expiresIn: 600, // 10 minutes in seconds
    });

  } catch (error) {
    console.error('Send OTP error:', error);
    return NextResponse.json(
      { error: 'Failed to send OTP' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const { partnerId, otp } = await request.json();

    if (!partnerId || !otp) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get stored OTP
    const otpKey = `otp_${partnerId}`;
    const storedData = otpStore.get(otpKey);

    if (!storedData) {
      return NextResponse.json({ error: 'OTP not found or expired' }, { status: 400 });
    }

    if (storedData.expiresAt < Date.now()) {
      otpStore.delete(otpKey);
      return NextResponse.json({ error: 'OTP has expired' }, { status: 400 });
    }

    // Check attempts
    if (storedData.attempts >= 3) {
      return NextResponse.json({ error: 'Too many verification attempts' }, { status: 429 });
    }

    // Decrypt and verify OTP
    const { decryptData } = await import('@/lib/encryption');
    const storedOtp = await decryptData(storedData.otp);

    if (otp !== storedOtp) {
      // Increment attempts
      storedData.attempts += 1;
      otpStore.set(otpKey, storedData);
      
      return NextResponse.json({ 
        error: 'Invalid OTP',
        attemptsRemaining: 3 - storedData.attempts,
      }, { status: 400 });
    }

    // OTP is valid, clean up
    otpStore.delete(otpKey);
    otpStore.delete(`rate_limit_${partnerId}`);

    return NextResponse.json({
      message: 'OTP verified successfully',
      valid: true,
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json(
      { error: 'Failed to verify OTP' },
      { status: 500 }
    );
  }
}
