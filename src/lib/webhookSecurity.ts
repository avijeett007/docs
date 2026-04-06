import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { logger } from './logger';

/**
 * Webhook signature verification utilities
 */

export interface WebhookVerificationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Verify VAPI webhook signature
 */
export async function verifyVAPIWebhook(
  request: NextRequest,
  body: string
): Promise<WebhookVerificationResult> {
  try {
    const signature = request.headers.get('vapi-signature');
    const secret = process.env.VAPI_WEBHOOK_SECRET;

    if (!secret) {
      logger.error('VAPI_WEBHOOK_SECRET not configured', new Error('Missing webhook secret'), {
        operation: 'webhook_security',
        provider: 'vapi'
      });
      return { isValid: false, error: 'Webhook secret not configured' };
    }

    if (!signature) {
      return { isValid: false, error: 'Missing webhook signature' };
    }

    // VAPI uses HMAC-SHA256 with format: sha256=<hash>
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body, 'utf8')
      .digest('hex');

    const providedSignature = signature.replace('sha256=', '');

    // Use timing-safe comparison
    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    );

    return { isValid };
  } catch (error) {
    logger.error('VAPI webhook verification error', error as Error, {
      operation: 'webhook_security',
      provider: 'vapi'
    });
    return { isValid: false, error: 'Verification failed' };
  }
}

/**
 * Verify Retell webhook signature
 */
export async function verifyRetellWebhook(
  request: NextRequest,
  body: string
): Promise<WebhookVerificationResult> {
  try {
    const signature = request.headers.get('retell-signature');
    const secret = process.env.RETELL_WEBHOOK_SECRET;

    if (!secret) {
      logger.error('RETELL_WEBHOOK_SECRET not configured', new Error('Missing webhook secret'), {
        operation: 'webhook_security',
        provider: 'retell'
      });
      return { isValid: false, error: 'Webhook secret not configured' };
    }

    if (!signature) {
      return { isValid: false, error: 'Missing webhook signature' };
    }

    // Retell uses HMAC-SHA256
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body, 'utf8')
      .digest('hex');

    const providedSignature = signature.replace('sha256=', '');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    );

    return { isValid };
  } catch (error) {
    logger.error('Retell webhook verification error', error as Error, {
      operation: 'webhook_security',
      provider: 'retell'
    });
    return { isValid: false, error: 'Verification failed' };
  }
}

/**
 * Verify Ultravox webhook signature
 */
export async function verifyUltravoxWebhook(
  request: NextRequest,
  body: string
): Promise<WebhookVerificationResult> {
  try {
    const signature = request.headers.get('ultravox-signature');
    const secret = process.env.ULTRAVOX_WEBHOOK_SECRET;

    if (!secret) {
      logger.error('ULTRAVOX_WEBHOOK_SECRET not configured', new Error('Missing webhook secret'), {
        operation: 'webhook_security',
        provider: 'ultravox'
      });
      return { isValid: false, error: 'Webhook secret not configured' };
    }

    if (!signature) {
      return { isValid: false, error: 'Missing webhook signature' };
    }

    // Ultravox uses HMAC-SHA256
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body, 'utf8')
      .digest('hex');

    const providedSignature = signature.replace('sha256=', '');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    );

    return { isValid };
  } catch (error) {
    logger.error('Ultravox webhook verification error', error as Error, {
      operation: 'webhook_security',
      provider: 'ultravox'
    });
    return { isValid: false, error: 'Verification failed' };
  }
}

/**
 * Verify Rewardful webhook signature
 */
export async function verifyRewardfulWebhook(
  request: NextRequest,
  body: string
): Promise<WebhookVerificationResult> {
  try {
    const signature = request.headers.get('x-rewardful-signature');
    const secret = process.env.REWARDFUL_API_SECRET;

    if (!secret) {
      logger.error('REWARDFUL_API_SECRET not configured', new Error('Missing webhook secret'), {
        operation: 'webhook_security',
        provider: 'rewardful'
      });
      return { isValid: false, error: 'Webhook secret not configured' };
    }

    if (!signature) {
      return { isValid: false, error: 'Missing webhook signature' };
    }

    // Rewardful uses HMAC-SHA256
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body, 'utf8')
      .digest('hex');

    // Use timing-safe comparison
    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(signature, 'hex')
    );

    if (!isValid) {
      logger.warn('Invalid Rewardful webhook signature', {
        operation: 'webhook_security',
        provider: 'rewardful'
      });
      return { isValid: false, error: 'Invalid webhook signature' };
    }

    return { isValid: true };
  } catch (error) {
    logger.error('Error verifying Rewardful webhook', error as Error, {
      operation: 'webhook_security',
      provider: 'rewardful'
    });
    return { isValid: false, error: 'Webhook verification failed' };
  }
}

/**
 * Verify ElevenLabs webhook signature
 */
export async function verifyElevenlabsWebhook(
  request: NextRequest,
  body: string,
  webhookSecret?: string
): Promise<WebhookVerificationResult> {
  try {
    const signature = request.headers.get('elevenlabs-signature');

    if (!signature) {
      return { isValid: false, error: 'Missing webhook signature' };
    }

    // Parse ElevenLabs signature format: "t=timestamp,v0=signature"
    const sigParts = signature.split(',');
    let timestamp: string | undefined;
    let providedSignature: string | undefined;

    for (const part of sigParts) {
      const [key, value] = part.split('=');
      if (key === 't') {
        timestamp = value;
      } else if (key === 'v0') {
        providedSignature = value;
      }
    }

    if (!timestamp || !providedSignature) {
      return { isValid: false, error: 'Invalid signature format' };
    }

    // Check timestamp to prevent replay attacks (5 minute tolerance)
    const currentTime = Math.floor(Date.now() / 1000);
    const webhookTime = parseInt(timestamp);
    const timeDiff = Math.abs(currentTime - webhookTime);

    if (timeDiff > 300) { // 5 minutes
      return { isValid: false, error: 'Webhook timestamp too old' };
    }

    // Use provided webhook secret or fall back to environment variable
    const secret = webhookSecret || process.env.ELEVENLABS_WEBHOOK_SECRET;

    if (!secret) {
      logger.error('ElevenLabs webhook secret not provided', new Error('Missing webhook secret'), {
        operation: 'webhook_security',
        provider: 'elevenlabs'
      });
      return { isValid: false, error: 'Webhook secret not configured' };
    }

    // Create the signed payload: timestamp + body
    const signedPayload = timestamp + body;

    // Generate expected signature using HMAC-SHA256
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload, 'utf8')
      .digest('hex');

    // Use timing-safe comparison
    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    );

    return { isValid };
  } catch (error) {
    logger.error('ElevenLabs webhook verification error', error as Error, {
      operation: 'webhook_security',
      provider: 'elevenlabs'
    });
    return { isValid: false, error: 'Verification failed' };
  }
}

/**
 * Generate idempotency key from webhook data
 */
export function generateIdempotencyKey(
  provider: string,
  eventType: string,
  eventId: string,
  timestamp?: string
): string {
  const data = `${provider}:${eventType}:${eventId}:${timestamp || Date.now()}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Check if webhook event has already been processed (idempotency)
 */
export async function isWebhookProcessed(
  idempotencyKey: string
): Promise<boolean> {
  try {
    // Check if we've already processed this webhook
    const existing = await prisma.creditTransaction.findFirst({
      where: {
        metadata: {
          path: ['idempotencyKey'],
          equals: idempotencyKey
        }
      }
    });

    return !!existing;
  } catch (error) {
    logger.error('Error checking webhook idempotency', error as Error, {
      operation: 'webhook_security',
      idempotencyKey
    });
    return false;
  }
}

/**
 * Verify Marketing Webhook signature
 */
export async function verifyMarketingWebhook(
  request: NextRequest,
  body: string
): Promise<WebhookVerificationResult> {
  try {
    const signature = request.headers.get('x-webhook-signature');
    const timestamp = request.headers.get('x-webhook-timestamp');
    const secret = process.env.MARKETING_WEBHOOK_SECRET;

    if (!secret) {
      logger.error('MARKETING_WEBHOOK_SECRET not configured', new Error('Missing webhook secret'), {
        operation: 'webhook_security',
        provider: 'marketing'
      });
      return { isValid: false, error: 'Webhook secret not configured' };
    }

    if (!signature) {
      return { isValid: false, error: 'Missing webhook signature' };
    }

    if (!timestamp) {
      return { isValid: false, error: 'Missing webhook timestamp' };
    }

    // Check timestamp to prevent replay attacks (5 minute tolerance)
    const currentTime = Math.floor(Date.now() / 1000);
    const webhookTime = parseInt(timestamp);
    const timeDiff = Math.abs(currentTime - webhookTime);

    if (timeDiff > 300) { // 5 minutes
      return { isValid: false, error: 'Webhook timestamp too old' };
    }

    // Create the signed payload: timestamp + body
    const signedPayload = timestamp + body;

    // Generate expected signature using HMAC-SHA256
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload, 'utf8')
      .digest('hex');

    // Use timing-safe comparison
    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(signature, 'hex')
    );

    return { isValid };
  } catch (error) {
    logger.error('Marketing webhook verification error', error as Error, {
      operation: 'webhook_security',
      provider: 'marketing'
    });
    return { isValid: false, error: 'Verification failed' };
  }
}

/**
 * Rate limiting for webhooks
 */
export function webhookRateLimit(_request: NextRequest) {
  // This would integrate with the existing rate limiting system
  // For now, return a simple implementation
  return {
    success: true,
    remaining: 1000,
    resetTime: Date.now() + 60000,
    total: 1000
  };
}

/**
 * Validate webhook payload structure
 */
export function validateWebhookPayload(
  provider: string,
  payload: any
): { isValid: boolean; error?: string } {
  try {
    switch (provider) {
      case 'vapi':
        if (!payload.type || !payload.data) {
          return { isValid: false, error: 'Missing required fields: type, data' };
        }
        if (payload.type === 'call-ended' && !payload.data.id) {
          return { isValid: false, error: 'Missing call ID in call-ended event' };
        }
        break;

      case 'retell':
        if (!payload.event || !payload.data) {
          return { isValid: false, error: 'Missing required fields: event, data' };
        }
        break;

      case 'ultravox':
        if (!payload.eventType || !payload.data) {
          return { isValid: false, error: 'Missing required fields: eventType, data' };
        }
        break;

      case 'elevenlabs':
        if (!payload.event_type) {
          return { isValid: false, error: 'Missing required field: event_type' };
        }
        if (payload.event_type === 'post_call_transcription' && !payload.conversation_id) {
          return { isValid: false, error: 'Missing conversation_id in post_call_transcription event' };
        }
        if (payload.event_type === 'post_call_audio' && !payload.conversation_id) {
          return { isValid: false, error: 'Missing conversation_id in post_call_audio event' };
        }
        break;

      default:
        return { isValid: false, error: 'Unknown provider' };
    }

    return { isValid: true };
  } catch (error) {
    return { isValid: false, error: 'Invalid JSON payload' };
  }
}

/**
 * Sanitize webhook payload for logging
 */
export function sanitizeWebhookPayload(payload: any): any {
  const sanitized = { ...payload };
  
  // Remove sensitive fields
  const sensitiveFields = [
    'apiKey', 'secret', 'token', 'password', 'auth',
    'creditCard', 'ssn', 'phoneNumber', 'email'
  ];

  function removeSensitiveData(obj: any): any {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    const cleaned = Array.isArray(obj) ? [] : {};
    
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveFields.some(field => lowerKey.includes(field))) {
        (cleaned as any)[key] = '[REDACTED]';
      } else if (typeof value === 'object') {
        (cleaned as any)[key] = removeSensitiveData(value);
      } else {
        (cleaned as any)[key] = value;
      }
    }
    
    return cleaned;
  }

  return removeSensitiveData(sanitized);
}
