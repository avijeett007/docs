// Customer JWT authentication utility
import { NextResponse } from 'next/server';
import { logger } from './logger';

// Require customer JWT secret - no fallbacks for security
if (!process.env.CUSTOMER_JWT_SECRET) {
  throw new Error('CUSTOMER_JWT_SECRET environment variable is required');
}
const secret = process.env.CUSTOMER_JWT_SECRET;

export interface CustomerJWTPayload {
  customerId: string;
  credentialId?: string;
  partnerId: string;
  email: string;
  teamMemberId?: string;
  role?: string;
  isTeamMember?: boolean;
  magicLinkType?: string; // 'login' or 'password_reset'
  embedContext?: {
    isEmbedded: boolean;
    accessMode: string;
    embedTokenId: string;
  };
  // Impersonation fields
  isImpersonating?: boolean;
  impersonatedBy?: string; // partnerId of the impersonating partner
  impersonationSessionId?: string; // unique session ID for audit trail
  iat?: number;
  exp?: number;
}

// Base64 encode/decode functions
async function base64UrlEncode(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  return btoa(String.fromCharCode(...new Uint8Array(data)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function base64UrlDecode(str: string): Promise<string> {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const decoded = atob(str);
  const decoder = new TextDecoder();
  const data = new Uint8Array(decoded.split('').map(c => c.charCodeAt(0)));
  return decoder.decode(data);
}

// HMAC signing functions
async function hmacSign(data: string, key: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
}

async function hmacVerify(signature: string, data: string, key: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signatureData = new Uint8Array(
    atob(signature.replace(/-/g, '+').replace(/_/g, '/'))
      .split('')
      .map(c => c.charCodeAt(0))
  );

  return crypto.subtle.verify(
    'HMAC',
    cryptoKey,
    signatureData,
    encoder.encode(data)
  );
}

export async function signCustomerJWT(payload: Omit<CustomerJWTPayload, 'iat' | 'exp'>): Promise<string> {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + (24 * 60 * 60) // 24 hours
  };

  const headerStr = await base64UrlEncode(JSON.stringify(header));
  const payloadStr = await base64UrlEncode(JSON.stringify(fullPayload));
  const dataToSign = `${headerStr}.${payloadStr}`;

  const signature = await hmacSign(dataToSign, secret);
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${dataToSign}.${signatureBase64}`;
}

// Alias for signCustomerJWT to match API implementations
export const createCustomerToken = signCustomerJWT;

// Create impersonation token with shorter expiration
export async function createImpersonationToken(
  customerId: string,
  credentialId: string,
  partnerId: string,
  email: string,
  impersonatedBy: string,
  expirationMinutes: number = 30
): Promise<{ token: string; sessionId: string }> {
  // Generate unique session ID for audit trail
  const sessionId = `imp_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

  const payload: Omit<CustomerJWTPayload, 'iat' | 'exp'> = {
    customerId,
    credentialId,
    partnerId,
    email,
    isImpersonating: true,
    impersonatedBy,
    impersonationSessionId: sessionId
  };

  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + (expirationMinutes * 60) // Custom expiration time
  };

  const headerStr = await base64UrlEncode(JSON.stringify(header));
  const payloadStr = await base64UrlEncode(JSON.stringify(fullPayload));
  const dataToSign = `${headerStr}.${payloadStr}`;

  const signature = await hmacSign(dataToSign, secret);
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const token = `${dataToSign}.${signatureBase64}`;

  return { token, sessionId };
}

export async function verifyCustomerJWT(token: string): Promise<CustomerJWTPayload | null> {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split('.');
    if (!headerB64 || !payloadB64 || !signatureB64) {
      throw new Error('Invalid token format');
    }

    // Verify signature
    const dataToVerify = `${headerB64}.${payloadB64}`;
    const isValid = await hmacVerify(signatureB64, dataToVerify, secret);
    if (!isValid) {
      throw new Error('Invalid signature');
    }

    // Decode payload
    const payloadStr = await base64UrlDecode(payloadB64);
    const payload = JSON.parse(payloadStr);

    // Verify expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      logger.warn('Customer JWT token expired', {
        operation: 'customer_jwt_verification',
        exp: payload.exp,
        now: now,
        customerId: payload.customerId,
        expiredBy: now - payload.exp
      });
      return null; // Return null instead of throwing error for graceful handling
    }

    // Type check the payload
    if (
      typeof payload === 'object' &&
      payload !== null &&
      'customerId' in payload &&
      'partnerId' in payload &&
      'email' in payload
    ) {
      // Create the base payload
      const jwtPayload: CustomerJWTPayload = {
        customerId: payload.customerId,
        partnerId: payload.partnerId,
        email: payload.email,
        iat: payload.iat,
        exp: payload.exp
      };

      // Add optional fields if they exist
      if ('credentialId' in payload) {
        jwtPayload.credentialId = String(payload.credentialId);
      }

      if ('teamMemberId' in payload) {
        jwtPayload.teamMemberId = String(payload.teamMemberId);
      }

      if ('role' in payload) {
        jwtPayload.role = String(payload.role);
      }

      if ('isTeamMember' in payload) {
        jwtPayload.isTeamMember = Boolean(payload.isTeamMember);
      }

      if ('magicLinkType' in payload) {
        jwtPayload.magicLinkType = String(payload.magicLinkType);
      }

      // Add impersonation fields if they exist
      if ('isImpersonating' in payload) {
        jwtPayload.isImpersonating = Boolean(payload.isImpersonating);
      }

      if ('impersonatedBy' in payload) {
        jwtPayload.impersonatedBy = String(payload.impersonatedBy);
      }

      if ('impersonationSessionId' in payload) {
        jwtPayload.impersonationSessionId = String(payload.impersonationSessionId);
      }

      return jwtPayload;
    }
    logger.error('Invalid payload structure', new Error('Invalid JWT payload'), {
      operation: 'customer_jwt_verification'
    });
    return null;
  } catch (error) {
    logger.error('Customer JWT verification error', error as Error, {
      operation: 'customer_jwt_verification'
    });
    return null;
  }
}

// Helper function to set the customer JWT token in cookies
export function setCustomerAuthCookie(response: NextResponse, token: string): void {
  response.cookies.set({
    name: 'customer_token',
    value: token,
    httpOnly: true,
    path: '/',
    sameSite: 'lax', // Changed from 'strict' to 'lax' for better compatibility
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 // 24 hours
  });
}

// Helper to clear the auth cookie
export function clearCustomerAuthCookie(response: NextResponse): void {
  response.cookies.set({
    name: 'customer_token',
    value: '',
    httpOnly: true,
    path: '/',
    maxAge: 0
  });
}
