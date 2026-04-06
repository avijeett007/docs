/**
 * POST /api/otp/verify
 *
 * Verify OTP code entered by user
 * Used during partner registration to confirm phone ownership
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTwilioVerifyService } from '@/lib/services/twilioVerifyService';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/lib/rateLimit';
import { validatePhoneNumber } from '@/lib/utils/phoneValidation';

// Request body interface
interface VerifyOTPRequest {
  phoneNumber: string;
  code: string;
}

export async function POST(request: NextRequest) {
  try {
    // Check rate limit using centralized utility
    // Note: Uses in-memory store by default. For production with multiple instances,
    // configure REDIS_URL and RATE_LIMIT_USE_REDIS=true for distributed rate limiting
    const rateLimitResult = rateLimit(request, {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 10, // 10 verify attempts per minute per IP
      keyGenerator: (req) => {
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                   req.headers.get('x-real-ip') ||
                   'unknown';
        return `otp-verify:${ip}`;
      }
    });

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    // Check if phone verification feature is enabled
    // Use server-side env var (FEATURE_PHONE_VERIFICATION) for backend routes
    const isPhoneVerificationEnabled = process.env.FEATURE_PHONE_VERIFICATION === 'true';
    if (!isPhoneVerificationEnabled) {
      return NextResponse.json(
        { success: false, error: 'Phone verification feature is currently disabled' },
        { status: 403 }
      );
    }

    // Parse request body
    const body: VerifyOTPRequest = await request.json();
    const { phoneNumber, code } = body;

    // Validate phone number is provided
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Validate phone number format using libphonenumber-js (supports all countries)
    const phoneValidation = validatePhoneNumber(phoneNumber);
    if (!phoneValidation.isValid) {
      return NextResponse.json(
        { success: false, error: phoneValidation.error || 'Invalid phone number format' },
        { status: 400 }
      );
    }

    // Validate code
    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Verification code is required' },
        { status: 400 }
      );
    }

    // Validate code format (should be 6 digits)
    const cleanedCode = code.replace(/\D/g, '');
    if (cleanedCode.length !== 6) {
      return NextResponse.json(
        { success: false, error: 'Invalid verification code format. Please enter 6 digits.' },
        { status: 400 }
      );
    }

    // Get Twilio Verify service
    const verifyService = getTwilioVerifyService();

    // Check if service is configured
    if (!verifyService.isConfigured()) {
      logger.error('Twilio Verify service not configured', new Error('Missing configuration'));
      return NextResponse.json(
        { success: false, error: 'Phone verification service is not available' },
        { status: 503 }
      );
    }

    // Verify the code
    const result = await verifyService.verifyCode({
      phoneNumber,
      code: cleanedCode,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Phone number verified successfully',
      channel: result.channel,
    });

  } catch (error: any) {
    logger.error('Failed to verify OTP', error);
    return NextResponse.json(
      { success: false, error: 'Failed to verify code' },
      { status: 500 }
    );
  }
}

