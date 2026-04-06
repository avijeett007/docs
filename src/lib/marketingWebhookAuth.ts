import { prisma } from '@/lib/prisma';
import { logger } from './logger';

export interface ApiKeyValidationResult {
  isValid: boolean;
  keyId?: string;
  error?: string;
  rateLimit?: {
    perMinute?: number;
    perDay?: number;
    currentUsage: number;
    dailyUsage: number;
  };
}

/**
 * Validate a marketing webhook API key and update usage statistics
 */
export async function validateMarketingWebhookApiKey(apiKey: string): Promise<ApiKeyValidationResult> {
  try {
    if (!apiKey || typeof apiKey !== 'string') {
      return { isValid: false, error: 'API key is required' };
    }

    // Find the API key in the database
    const webhookKey = await prisma.marketingWebhookApiKey.findUnique({
      where: { apiKey },
      select: {
        id: true,
        name: true,
        status: true,
        expiresAt: true,
        rateLimit: true,
        dailyLimit: true,
        usageCount: true,
        dailyUsage: true,
        lastResetAt: true,
        lastUsedAt: true,
      },
    });

    if (!webhookKey) {
      return { isValid: false, error: 'Invalid API key' };
    }

    // Check if key is active
    if (webhookKey.status !== 'active') {
      return { isValid: false, error: `API key is ${webhookKey.status}` };
    }

    // Check if key has expired
    const now = new Date();
    if (webhookKey.expiresAt && webhookKey.expiresAt < now) {
      // Update status to expired
      await prisma.marketingWebhookApiKey.update({
        where: { id: webhookKey.id },
        data: { status: 'expired' },
      });
      return { isValid: false, error: 'API key has expired' };
    }

    // Check if we need to reset daily usage (new day)
    const lastReset = new Date(webhookKey.lastResetAt);
    const isNewDay = now.getDate() !== lastReset.getDate() || 
                     now.getMonth() !== lastReset.getMonth() || 
                     now.getFullYear() !== lastReset.getFullYear();

    let currentDailyUsage = webhookKey.dailyUsage;
    if (isNewDay) {
      currentDailyUsage = 0;
    }

    // Check daily limit
    if (webhookKey.dailyLimit && currentDailyUsage >= webhookKey.dailyLimit) {
      return { 
        isValid: false, 
        error: 'Daily API key limit exceeded',
        rateLimit: {
          perDay: webhookKey.dailyLimit,
          currentUsage: webhookKey.usageCount,
          dailyUsage: currentDailyUsage,
        }
      };
    }

    // Update usage statistics
    const updateData: any = {
      usageCount: { increment: 1 },
      lastUsedAt: now,
    };

    if (isNewDay) {
      updateData.dailyUsage = 1;
      updateData.lastResetAt = now;
    } else {
      updateData.dailyUsage = { increment: 1 };
    }

    await prisma.marketingWebhookApiKey.update({
      where: { id: webhookKey.id },
      data: updateData,
    });

    return {
      isValid: true,
      keyId: webhookKey.id,
      rateLimit: {
        perMinute: webhookKey.rateLimit || undefined,
        perDay: webhookKey.dailyLimit || undefined,
        currentUsage: webhookKey.usageCount + 1,
        dailyUsage: currentDailyUsage + 1,
      },
    };

  } catch (error) {
    logger.error('Error validating marketing webhook API key', error as Error, {
      operation: 'marketing_webhook_auth'
    });
    return { isValid: false, error: 'Internal server error during API key validation' };
  }
}

/**
 * Simple rate limiting for API keys (per-minute check)
 * This is a basic in-memory rate limiter for per-minute limits
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function checkApiKeyRateLimit(keyId: string, perMinuteLimit?: number): { allowed: boolean; resetTime?: number } {
  if (!perMinuteLimit) {
    return { allowed: true };
  }

  const now = Date.now();
  const windowStart = Math.floor(now / 60000) * 60000; // Start of current minute
  const resetTime = windowStart + 60000; // End of current minute

  const key = `${keyId}:${windowStart}`;
  const current = rateLimitStore.get(key) || { count: 0, resetTime };

  if (current.count >= perMinuteLimit) {
    return { allowed: false, resetTime };
  }

  // Increment count
  rateLimitStore.set(key, { count: current.count + 1, resetTime });

  // Clean up old entries (older than 2 minutes)
  const cutoff = now - 120000;
  for (const [storeKey, data] of rateLimitStore.entries()) {
    if (data.resetTime < cutoff) {
      rateLimitStore.delete(storeKey);
    }
  }

  return { allowed: true, resetTime };
}

/**
 * Get rate limit headers for API key
 */
export function getApiKeyRateLimitHeaders(
  keyId: string, 
  rateLimit?: { perMinute?: number; perDay?: number; currentUsage: number; dailyUsage: number }
): Record<string, string> {
  const headers: Record<string, string> = {};

  if (rateLimit?.perMinute) {
    const rateLimitCheck = checkApiKeyRateLimit(keyId, rateLimit.perMinute);
    headers['X-RateLimit-Limit'] = rateLimit.perMinute.toString();
    headers['X-RateLimit-Remaining'] = Math.max(0, rateLimit.perMinute - (rateLimitStore.get(`${keyId}:${Math.floor(Date.now() / 60000) * 60000}`)?.count || 0)).toString();
    if (rateLimitCheck.resetTime) {
      headers['X-RateLimit-Reset'] = Math.ceil(rateLimitCheck.resetTime / 1000).toString();
    }
  }

  if (rateLimit?.perDay) {
    headers['X-RateLimit-Daily-Limit'] = rateLimit.perDay.toString();
    headers['X-RateLimit-Daily-Remaining'] = Math.max(0, rateLimit.perDay - rateLimit.dailyUsage).toString();
    
    // Reset time for daily limit (next midnight UTC)
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    headers['X-RateLimit-Daily-Reset'] = Math.ceil(tomorrow.getTime() / 1000).toString();
  }

  headers['X-RateLimit-Usage'] = rateLimit?.currentUsage.toString() || '0';

  return headers;
}
