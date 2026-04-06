/**
 * AI Gateway Middleware Utilities
 *
 * Provides domain whitelisting validation and rate-limit checking
 * for AI Gateway proxy requests.
 *
 * Rate limiting (rpm_limit) is primarily enforced by LiteLLM natively.
 * Daily/monthly limits and domain whitelisting are enforced here.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface GatewayValidationResult {
  allowed: boolean;
  reason?: string;
  keyId?: string;
  partnerId?: string;
}

/**
 * Validate the origin/referer domain against the key's allowed domains.
 * Returns { allowed: true } if no domain restriction or domain matches.
 */
export function validateDomain(
  origin: string | null,
  referer: string | null,
  allowedDomains: string | null,
): { allowed: boolean; reason?: string } {
  // No domain restriction configured — allow all
  if (!allowedDomains || allowedDomains.trim() === '') {
    return { allowed: true };
  }

  const domains = allowedDomains
    .split(',')
    .map(d => d.trim().toLowerCase())
    .filter(Boolean);

  if (domains.length === 0) {
    return { allowed: true };
  }

  // Extract hostname from origin or referer
  const requestDomain = extractDomain(origin) || extractDomain(referer);

  if (!requestDomain) {
    return {
      allowed: false,
      reason: 'Request must include Origin or Referer header for domain-restricted keys',
    };
  }

  const matched = domains.some(
    d => requestDomain === d || requestDomain.endsWith(`.${d}`),
  );

  if (!matched) {
    return {
      allowed: false,
      reason: `Domain "${requestDomain}" is not in the allowed list`,
    };
  }

  return { allowed: true };
}

/**
 * Check daily and monthly request limits for a key.
 * RPM (requests per minute) is enforced by LiteLLM natively.
 */
export async function checkRequestLimits(
  keyId: string,
  dailyLimit: number | null,
  monthlyLimit: number | null,
): Promise<{ allowed: boolean; reason?: string }> {
  if (!dailyLimit && !monthlyLimit) {
    return { allowed: true };
  }

  const now = new Date();

  if (dailyLimit) {
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const dailyCount = await prisma.aiGatewaySpendSync.count({
      where: {
        aiGatewayKeyId: keyId,
        syncedAt: { gte: startOfDay },
        autoTopUpTriggered: false, // Don't count auto-top-up records
      },
    });

    if (dailyCount >= dailyLimit) {
      logger.warn('[AiGatewayMiddleware] Daily limit exceeded', { keyId, dailyLimit, dailyCount });
      return {
        allowed: false,
        reason: `Daily request limit (${dailyLimit}) exceeded`,
      };
    }
  }

  if (monthlyLimit) {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthlyCount = await prisma.aiGatewaySpendSync.count({
      where: {
        aiGatewayKeyId: keyId,
        syncedAt: { gte: startOfMonth },
        autoTopUpTriggered: false,
      },
    });

    if (monthlyCount >= monthlyLimit) {
      logger.warn('[AiGatewayMiddleware] Monthly limit exceeded', { keyId, monthlyLimit, monthlyCount });
      return {
        allowed: false,
        reason: `Monthly request limit (${monthlyLimit}) exceeded`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Extract hostname from a URL string.
 */
function extractDomain(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase();
  } catch {
    // Might be just a hostname without protocol
    return url.toLowerCase().replace(/\/.*$/, '');
  }
}

