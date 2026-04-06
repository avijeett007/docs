// Prospect JWT authentication utility for onboarding flow
import { NextResponse } from 'next/server';
import { logger } from './logger';
import { obfuscateEmail } from './pii-obfuscation';

// Get JWT secret - reuse customer JWT secret for simplicity
function getJWTSecret(): string {
  const secret = process.env.CUSTOMER_JWT_SECRET;
  if (!secret) {
    throw new Error('CUSTOMER_JWT_SECRET environment variable is required');
  }
  return secret;
}

export interface ProspectJWTPayload {
  prospectId: string;
  customerId: string; // Customer ID created after step 3 conversion
  partnerId: string;
  email: string;
  type: 'prospect'; // Distinguish from customer tokens
  iat?: number;
  exp?: number;
}

// Base64 encode/decode functions (reused from customerJwt.ts)
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

// HMAC signing functions (reused from customerJwt.ts)
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

export async function signProspectJWT(payload: Omit<ProspectJWTPayload, 'iat' | 'exp'>): Promise<string> {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + (2 * 60 * 60) // 2 hours (shorter than customer tokens since it's for onboarding only)
  };

  const headerStr = await base64UrlEncode(JSON.stringify(header));
  const payloadStr = await base64UrlEncode(JSON.stringify(fullPayload));
  const dataToSign = `${headerStr}.${payloadStr}`;

  const signature = await hmacSign(dataToSign, getJWTSecret());
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${dataToSign}.${signatureBase64}`;
}

export async function verifyProspectJWT(token: string): Promise<ProspectJWTPayload | null> {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split('.');
    if (!headerB64 || !payloadB64 || !signatureB64) {
      throw new Error('Invalid token format');
    }

    // Verify signature
    const dataToVerify = `${headerB64}.${payloadB64}`;
    const isValid = await hmacVerify(signatureB64, dataToVerify, getJWTSecret());
    if (!isValid) {
      throw new Error('Invalid signature');
    }

    // Decode payload
    const payloadStr = await base64UrlDecode(payloadB64);
    const payload = JSON.parse(payloadStr);

    // Verify expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      logger.warn('Prospect JWT token expired', {
        operation: 'prospect_jwt',
        exp: payload.exp,
        now: now,
        prospectId: payload.prospectId,
        expiredBy: now - payload.exp
      });
      return null;
    }

    // Type check the payload
    if (
      typeof payload === 'object' &&
      payload !== null &&
      'prospectId' in payload &&
      'customerId' in payload &&
      'partnerId' in payload &&
      'email' in payload &&
      'type' in payload &&
      payload.type === 'prospect'
    ) {
      return {
        prospectId: payload.prospectId,
        customerId: payload.customerId,
        partnerId: payload.partnerId,
        email: payload.email,
        type: 'prospect',
        iat: payload.iat,
        exp: payload.exp
      };
    }
    logger.error('Invalid prospect JWT payload structure', new Error('Invalid payload structure'), {
      operation: 'prospect_jwt'
    });
    return null;
  } catch (error) {
    logger.error('Prospect JWT verification error', error as Error, {
      operation: 'prospect_jwt'
    });
    return null;
  }
}
