import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { logger } from './logger';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const EMBED_TOKEN_EXPIRY = '7d'; // 7 days

export interface EmbedTokenPayload {
  embedTokenId: string;
  customerId: string;
  partnerId: string;
  customerCredentialId: string;
  accessMode: string;
  allowedDomains: string[];
  iat: number;
  exp: number;
  jti: string; // JWT ID for revocation
}

/**
 * Create a secure JWT-based embed token
 */
export function createEmbedJWT(payload: {
  embedTokenId: string;
  customerId: string;
  partnerId: string;
  customerCredentialId: string;
  accessMode: string;
  allowedDomains: string[];
}): string {
  const jwtId = randomBytes(16).toString('hex'); // Unique JWT ID for revocation
  
  const tokenPayload: Omit<EmbedTokenPayload, 'iat' | 'exp'> = {
    ...payload,
    jti: jwtId,
  };

  return jwt.sign(tokenPayload, JWT_SECRET, {
    expiresIn: EMBED_TOKEN_EXPIRY,
    issuer: 'knotie-ai-pro',
    audience: 'whitelabel-embed',
  });
}

/**
 * Verify and decode an embed JWT token
 */
export function verifyEmbedJWT(token: string): EmbedTokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'knotie-ai-pro',
      audience: 'whitelabel-embed',
    }) as EmbedTokenPayload;

    return decoded;
  } catch (error) {
    logger.error('Error verifying embed JWT', error as Error, {
      operation: 'embed_jwt'
    });
    return null;
  }
}

/**
 * Create a customer JWT token for whitelabel API access
 */
export function createCustomerJWTFromEmbed(embedPayload: EmbedTokenPayload): string {
  const customerPayload = {
    customerId: embedPayload.customerId,
    credentialId: embedPayload.customerCredentialId,
    partnerId: embedPayload.partnerId,
    email: '', // Will be filled from database
    embedContext: {
      isEmbedded: true,
      accessMode: embedPayload.accessMode,
      embedTokenId: embedPayload.embedTokenId,
    },
  };

  return jwt.sign(customerPayload, JWT_SECRET, {
    expiresIn: '7d',
    issuer: 'knotie-ai-pro',
    audience: 'whitelabel-customer',
  });
}

/**
 * Generate a secure random token (fallback for non-JWT systems)
 */
export function generateSecureEmbedToken(): string {
  // Create a 32-byte (256-bit) random token
  const randomToken = randomBytes(32).toString('base64url');
  return randomToken;
}

/**
 * Validate token format (JWT or secure random)
 */
export function isValidEmbedTokenFormat(token: string): boolean {
  // Check if it's a JWT
  if (token.includes('.')) {
    const parts = token.split('.');
    return parts.length === 3;
  }
  
  // Check if it's a base64url encoded token (at least 32 characters)
  return /^[A-Za-z0-9_-]{32,}$/.test(token);
}

/**
 * Extract embed token info without full verification (for logging/debugging)
 */
export function decodeEmbedTokenInfo(token: string): any {
  try {
    if (token.includes('.')) {
      // JWT token
      return jwt.decode(token);
    } else {
      // Random token - no info to extract
      return { type: 'random', length: token.length };
    }
  } catch (error) {
    return null;
  }
}
