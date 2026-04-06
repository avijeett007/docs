/**
 * Twilio Verify Service
 * 
 * Handles phone number verification using Twilio Verify API
 * Supports WhatsApp as primary channel with SMS as fallback
 * 
 * @see https://www.twilio.com/docs/verify/api
 */

import { logger } from '../logger';
import { prisma } from '../prisma';

// Twilio Verify configuration
export interface TwilioVerifyConfig {
  accountSid: string;
  authToken: string;
  verifyServiceSid: string;
}

// Verification channels supported
export type VerificationChannel = 'whatsapp' | 'sms';

// Send verification request
export interface SendVerificationRequest {
  phoneNumber: string;
  channel?: VerificationChannel;
  partnerId?: string;
  ipAddress?: string;
  userAgent?: string;
}

// Send verification response
export interface SendVerificationResponse {
  success: boolean;
  verificationId?: string;
  channel?: VerificationChannel;
  status?: string;
  error?: string;
  fallbackUsed?: boolean;
}

// Verify code request
export interface VerifyCodeRequest {
  phoneNumber: string;
  code: string;
  verificationId?: string;
}

// Verify code response
export interface VerifyCodeResponse {
  success: boolean;
  status?: string;
  channel?: VerificationChannel;
  error?: string;
}

// Twilio API response types
interface TwilioVerificationResponse {
  sid: string;
  service_sid: string;
  account_sid: string;
  to: string;
  channel: string;
  status: string;
  valid: boolean;
  date_created: string;
  date_updated: string;
  lookup?: {
    carrier?: {
      type: string;
      name: string;
    };
  };
}

interface TwilioVerificationCheckResponse {
  sid: string;
  service_sid: string;
  account_sid: string;
  to: string;
  channel: string;
  status: string;
  valid: boolean;
  date_created: string;
  date_updated: string;
}

/**
 * Twilio Verify Service Class
 */
export class TwilioVerifyService {
  private accountSid: string;
  private authToken: string;
  private verifyServiceSid: string;
  private baseUrl: string;

  constructor(config?: TwilioVerifyConfig) {
    this.accountSid = config?.accountSid || process.env.TWILIO_ACCOUNT_SID || '';
    this.authToken = config?.authToken || process.env.TWILIO_AUTH_TOKEN || '';
    this.verifyServiceSid = config?.verifyServiceSid || process.env.TWILIO_VERIFY_SERVICE_SID || '';
    this.baseUrl = `https://verify.twilio.com/v2/Services/${this.verifyServiceSid}`;

    if (!this.accountSid || !this.authToken) {
      logger.warn('Twilio credentials not configured', { operation: 'twilio_verify_init' });
    }
    if (!this.verifyServiceSid) {
      logger.warn('Twilio Verify Service SID not configured', { operation: 'twilio_verify_init' });
    }
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return !!(this.accountSid && this.authToken && this.verifyServiceSid);
  }

  /**
   * Make authenticated request to Twilio API
   */
  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'POST',
    data?: Record<string, string>
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');

    const headers: Record<string, string> = {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (data && method === 'POST') {
      options.body = new URLSearchParams(data).toString();
    }

    const response = await fetch(url, options);
    const responseData = await response.json();

    if (!response.ok) {
      throw new Error(responseData.message || `Twilio API error: ${response.status}`);
    }

    return responseData as T;
  }

  /**
   * Format phone number to E.164 format
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters except leading +
    let cleaned = phoneNumber.replace(/[^\d+]/g, '');

    // Ensure it starts with +
    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }

    return cleaned;
  }

  /**
   * Send verification code via WhatsApp (primary) or SMS (fallback)
   */
  async sendVerification(request: SendVerificationRequest): Promise<SendVerificationResponse> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Twilio Verify service not configured' };
    }

    const formattedPhone = this.formatPhoneNumber(request.phoneNumber);
    const primaryChannel = request.channel || 'whatsapp';
    let fallbackUsed = false;
    let currentChannel: VerificationChannel = primaryChannel;

    try {
      // Check rate limiting - max 3 attempts per phone in 10 minutes
      const recentAttempts = await prisma.phoneVerification.count({
        where: {
          phoneNumber: formattedPhone,
          createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
        },
      });

      if (recentAttempts >= 3) {
        return { success: false, error: 'Too many verification attempts. Please try again later.' };
      }

      // Try primary channel (WhatsApp)
      let response: TwilioVerificationResponse;
      try {
        response = await this.makeRequest<TwilioVerificationResponse>('/Verifications', 'POST', {
          To: formattedPhone,
          Channel: currentChannel,
        });
      } catch (primaryError: any) {
        // If WhatsApp fails, fallback to SMS
        if (primaryChannel === 'whatsapp') {
          logger.info('WhatsApp verification failed, falling back to SMS', {
            phone: formattedPhone.slice(-4),
            error: primaryError.message,
          });
          currentChannel = 'sms';
          fallbackUsed = true;
          response = await this.makeRequest<TwilioVerificationResponse>('/Verifications', 'POST', {
            To: formattedPhone,
            Channel: 'sms',
          });
        } else {
          throw primaryError;
        }
      }

      // Store verification record
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      await prisma.phoneVerification.create({
        data: {
          phoneNumber: formattedPhone,
          partnerId: request.partnerId,
          channel: currentChannel,
          status: 'pending',
          twilioSid: response.sid,
          expiresAt,
          ipAddress: request.ipAddress,
          userAgent: request.userAgent,
        },
      });

      logger.info('Verification sent successfully', {
        phone: formattedPhone.slice(-4),
        channel: currentChannel,
        fallbackUsed,
      });

      return {
        success: true,
        verificationId: response.sid,
        channel: currentChannel as VerificationChannel,
        status: response.status,
        fallbackUsed,
      };
    } catch (error: any) {
      logger.error('Failed to send verification', error, {
        phone: formattedPhone.slice(-4),
        channel: currentChannel,
      });

      // Store failed attempt
      await prisma.phoneVerification.create({
        data: {
          phoneNumber: formattedPhone,
          partnerId: request.partnerId,
          channel: currentChannel,
          status: 'failed',
          failureReason: error.message,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          ipAddress: request.ipAddress,
          userAgent: request.userAgent,
        },
      });

      return { success: false, error: error.message || 'Failed to send verification code' };
    }
  }

  /**
   * Verify the code entered by user
   */
  async verifyCode(request: VerifyCodeRequest): Promise<VerifyCodeResponse> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Twilio Verify service not configured' };
    }

    const formattedPhone = this.formatPhoneNumber(request.phoneNumber);

    try {
      // Find pending verification
      const verification = await prisma.phoneVerification.findFirst({
        where: {
          phoneNumber: formattedPhone,
          status: 'pending',
          expiresAt: { gte: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!verification) {
        return { success: false, error: 'No pending verification found. Please request a new code.' };
      }

      // Check max attempts
      if (verification.attempts >= verification.maxAttempts) {
        await prisma.phoneVerification.update({
          where: { id: verification.id },
          data: { status: 'failed', failureReason: 'Max attempts exceeded' },
        });
        return { success: false, error: 'Maximum verification attempts exceeded. Please request a new code.' };
      }

      // Increment attempts
      await prisma.phoneVerification.update({
        where: { id: verification.id },
        data: { attempts: { increment: 1 } },
      });

      // Verify with Twilio
      const response = await this.makeRequest<TwilioVerificationCheckResponse>(
        '/VerificationCheck',
        'POST',
        { To: formattedPhone, Code: request.code }
      );

      if (response.status === 'approved' && response.valid) {
        // Update verification record
        await prisma.phoneVerification.update({
          where: { id: verification.id },
          data: { status: 'approved', verifiedAt: new Date() },
        });

        logger.info('Phone verification successful', {
          phone: formattedPhone.slice(-4),
          channel: verification.channel,
        });

        return {
          success: true,
          status: 'approved',
          channel: verification.channel as VerificationChannel,
        };
      } else {
        return { success: false, error: 'Invalid verification code', status: response.status };
      }
    } catch (error: any) {
      logger.error('Failed to verify code', error, { phone: formattedPhone.slice(-4) });
      return { success: false, error: error.message || 'Failed to verify code' };
    }
  }

  /**
   * Check if a phone number is already verified for a partner
   */
  async isPhoneVerified(phoneNumber: string, partnerId?: string): Promise<boolean> {
    const formattedPhone = this.formatPhoneNumber(phoneNumber);

    const verification = await prisma.phoneVerification.findFirst({
      where: {
        phoneNumber: formattedPhone,
        status: 'approved',
        ...(partnerId && { partnerId }),
      },
      orderBy: { verifiedAt: 'desc' },
    });

    return !!verification;
  }

  /**
   * Cancel any pending verifications for a phone number
   */
  async cancelPendingVerifications(phoneNumber: string): Promise<void> {
    const formattedPhone = this.formatPhoneNumber(phoneNumber);

    await prisma.phoneVerification.updateMany({
      where: {
        phoneNumber: formattedPhone,
        status: 'pending',
      },
      data: { status: 'canceled' },
    });
  }
}

// Singleton instance
let twilioVerifyServiceInstance: TwilioVerifyService | null = null;

/**
 * Get the Twilio Verify service instance
 */
export function getTwilioVerifyService(): TwilioVerifyService {
  if (!twilioVerifyServiceInstance) {
    twilioVerifyServiceInstance = new TwilioVerifyService();
  }
  return twilioVerifyServiceInstance;
}
