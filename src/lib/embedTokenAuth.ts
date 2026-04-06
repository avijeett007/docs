import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateEmbedSecurity, logSecurityEvent } from '@/lib/embedTokenSecurity';
import { logger } from './logger';

export interface EmbedTokenValidationResult {
  isValid: boolean;
  embedToken?: {
    id: string;
    token: string;
    name: string;
    customerId: string;
    partnerId: string;
    customerCredentialId: string;
    allowedDomains: string[];
    accessMode: string;
    status: string;
    expiresAt: Date | null;
    customer: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
    };
    customerCredential: {
      id: string;
      email: string;
    };
    partner: {
      id: string;
      businessName: string;
      subdomain: string | null;
      customDomain: string | null;
    };
  };
  error?: string;
}

/**
 * Validate an embed token and check domain restrictions
 */
export async function validateEmbedToken(
  token: string,
  request: NextRequest
): Promise<EmbedTokenValidationResult> {
  try {
    // First, perform security validations
    const securityValidation = validateEmbedSecurity(request, token, []);

    if (!securityValidation.isValid) {
      logSecurityEvent('embed_token_security_failed', {
        token: token.substring(0, 8) + '...',
        errors: securityValidation.errors,
        clientIP: securityValidation.clientIP,
      }, 'warning');

      return {
        isValid: false,
        error: securityValidation.errors[0] || 'Security validation failed',
      };
    }

    // Fetch the embed token with related data
    const embedToken = await prisma.embedToken.findUnique({
      where: { token },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        customerCredential: {
          select: {
            id: true,
            email: true,
          },
        },
        partner: {
          select: {
            id: true,
            businessName: true,
            subdomain: true,
            customDomain: true,
          },
        },
      },
    });

    if (!embedToken) {
      logSecurityEvent('embed_token_not_found', {
        token: token.substring(0, 8) + '...',
        clientIP: securityValidation.clientIP,
      }, 'warning');

      return {
        isValid: false,
        error: 'Invalid embed token',
      };
    }

    // Check if token is active
    if (embedToken.status !== 'active') {
      return {
        isValid: false,
        error: 'Embed token is not active',
      };
    }

    // Check if token has expired
    if (embedToken.expiresAt && embedToken.expiresAt <= new Date()) {
      // Mark token as expired
      await prisma.embedToken.update({
        where: { id: embedToken.id },
        data: { status: 'expired' },
      });

      return {
        isValid: false,
        error: 'Embed token has expired',
      };
    }

    // Check domain restrictions if any are set
    if (embedToken.allowedDomains && embedToken.allowedDomains.length > 0) {
      const domainValidation = validateEmbedSecurity(request, token, embedToken.allowedDomains);

      if (!domainValidation.isValid) {
        logSecurityEvent('embed_domain_restriction_failed', {
          token: token.substring(0, 8) + '...',
          requestDomain: domainValidation.domain,
          allowedDomains: embedToken.allowedDomains,
          clientIP: domainValidation.clientIP,
        }, 'warning');

        return {
          isValid: false,
          error: 'Access denied: Domain not in allowed list',
        };
      }
    }

    // Update access tracking
    await prisma.embedToken.update({
      where: { id: embedToken.id },
      data: {
        lastAccessedAt: new Date(),
        accessCount: {
          increment: 1,
        },
      },
    });

    return {
      isValid: true,
      embedToken,
    };
  } catch (error) {
    logger.error('Error validating embed token', error as Error, {
      operation: 'embed_token_validation'
    });
    return {
      isValid: false,
      error: 'Internal server error during token validation',
    };
  }
}

/**
 * Check if a domain is allowed for an embed token
 */
export function isDomainAllowed(allowedDomains: string[], requestDomain: string): boolean {
  if (!allowedDomains || allowedDomains.length === 0) {
    return true; // No restrictions
  }

  return allowedDomains.some(allowedDomain => {
    // Support wildcard subdomains (e.g., *.gohighlevel.com)
    if (allowedDomain.startsWith('*.')) {
      const baseDomain = allowedDomain.substring(2);
      return requestDomain === baseDomain || requestDomain.endsWith('.' + baseDomain);
    }
    return requestDomain === allowedDomain;
  });
}

/**
 * Get embed context information for UI customization
 */
export function getEmbedContext(embedToken: any) {
  return {
    isEmbedded: true,
    accessMode: embedToken.accessMode,
    allowedDomains: embedToken.allowedDomains,
    embedTokenId: embedToken.id,
    embedTokenName: embedToken.name,
  };
}

/**
 * Check if a feature should be hidden in embed mode
 */
export function shouldHideFeatureInEmbed(feature: string, accessMode: string): boolean {
  const restrictedFeatures: Record<string, string[]> = {
    lite: [
      'billing',
      'team-members',
      'api-keys',
      'account-settings',
      'integrations',
      'phone-numbers',
    ],
    readonly: [
      'billing',
      'team-members',
      'api-keys',
      'account-settings',
    ],
    full: [], // No restrictions for full access
  };

  const restricted = restrictedFeatures[accessMode] || [];
  return restricted.includes(feature);
}

/**
 * Get embed context from cookies (client-side)
 */
export function getEmbedContextFromCookies(): {
  isEmbedded: boolean;
  accessMode?: string;
  embedTokenId?: string;
  embedTokenName?: string;
} | null {
  if (typeof window === 'undefined') {
    return null; // Server-side
  }

  try {
    const embedContextCookie = document.cookie
      .split('; ')
      .find(row => row.startsWith('embed_context='));

    if (!embedContextCookie) {
      return { isEmbedded: false };
    }

    const embedContextValue = embedContextCookie.split('=')[1];
    const embedContext = JSON.parse(decodeURIComponent(embedContextValue));

    return {
      isEmbedded: true,
      ...embedContext,
    };
  } catch (error) {
    logger.error('Error parsing embed context cookie', error as Error, {
      operation: 'embed_context_parsing'
    });
    return { isEmbedded: false };
  }
}

/**
 * Clear embed context cookies
 */
export function clearEmbedContext(): void {
  if (typeof window === 'undefined') {
    return; // Server-side
  }

  document.cookie = 'embed_context=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
}
