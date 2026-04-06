/**
 * POST /api/otp/send
 *
 * Send OTP verification code via WhatsApp (primary) or SMS (fallback)
 * Used during partner registration to verify phone numbers
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTwilioVerifyService, VerificationChannel } from '@/lib/services/twilioVerifyService';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/lib/rateLimit';
import { validatePhoneNumber } from '@/lib/utils/phoneValidation';

// Request body interface
interface SendOTPRequest {
  phoneNumber: string;
  channel?: VerificationChannel;
  partnerId?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Check rate limit using centralized utility
    // Note: Uses in-memory store by default. For production with multiple instances,
    // configure REDIS_URL and RATE_LIMIT_USE_REDIS=true for distributed rate limiting
    const rateLimitResult = rateLimit(request, {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 5, // 5 OTP requests per minute per IP
      keyGenerator: (req) => {
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                   req.headers.get('x-real-ip') ||
                   'unknown';
        return `otp-send:${ip}`;
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
    const body: SendOTPRequest = await request.json();
    const { phoneNumber, channel, partnerId } = body;

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

    // Get client IP for logging
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     request.headers.get('x-real-ip') ||
                     'unknown';

    // Send verification
    const result = await verifyService.sendVerification({
      phoneNumber,
      channel: channel || 'whatsapp',
      partnerId,
      ipAddress: clientIp,
      userAgent: request.headers.get('user-agent') || undefined,
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
      message: `Verification code sent via ${result.channel}`,
      channel: result.channel,
      fallbackUsed: result.fallbackUsed,
    });

  } catch (error: any) {
    logger.error('Failed to send OTP', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send verification code' },
      { status: 500 }
    );
  }
}

