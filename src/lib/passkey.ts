import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import type {
  CredentialDeviceType,
} from '@simplewebauthn/types';
import { logger } from './logger';

// Environment configuration
const RP_NAME = 'Knotie AI Pro';

// Dynamic configuration for different environments
export const getWebAuthnConfig = (requestOrigin?: string) => {
  if (process.env.NODE_ENV === 'production') {
    // Production - handle custom domains for whitelabel
    const baseOrigins = ['https://knotie-ai.pro', 'https://app.knotie-ai.pro'];

    // If we have a request origin, check if it's a custom domain
    if (requestOrigin) {
      try {
        const url = new URL(requestOrigin);
        const hostname = url.hostname;

        // If it's not our main domain, treat it as a custom domain
        if (!hostname.includes('knotie-ai.pro')) {
          return {
            RP_ID: hostname,
            ORIGIN: [requestOrigin, ...baseOrigins]
          };
        }
      } catch (e) {
        logger.warn('Invalid request origin', {
          operation: 'passkey',
          requestOrigin
        });
      }
    }

    return {
      RP_ID: 'knotie-ai.pro',
      ORIGIN: baseOrigins
    };
  }

  // Development - support localhost, HTTPS localhost, and ngrok
  const origins = [
    'http://localhost:3000',
    'https://localhost:3001'
  ];

  // Add ngrok URL if provided via environment variable
  if (process.env.NGROK_URL) {
    origins.push(process.env.NGROK_URL);
    // If ngrok URL is provided, use its hostname as RP_ID
    try {
      const ngrokUrl = new URL(process.env.NGROK_URL);
      return {
        RP_ID: ngrokUrl.hostname,
        ORIGIN: [process.env.NGROK_URL, ...origins]
      };
    } catch (e) {
      logger.warn('Invalid NGROK_URL format', {
        operation: 'passkey',
        ngrokUrl: process.env.NGROK_URL
      });
    }
  }

  // If we have a request origin and it's ngrok, use it
  if (requestOrigin && requestOrigin.includes('ngrok')) {
    const url = new URL(requestOrigin);
    return {
      RP_ID: url.hostname,
      ORIGIN: [requestOrigin, ...origins]
    };
  }

  return {
    RP_ID: 'localhost',
    ORIGIN: origins
  };
};

// Default config (will be overridden in API routes with actual request origin)
const { RP_ID, ORIGIN } = getWebAuthnConfig();

export interface PasskeyCredential {
  id: string;                    // Credential ID (base64url)
  publicKey: Uint8Array;         // Public key bytes
  counter: number;               // Signature counter
  deviceType: CredentialDeviceType; // 'singleDevice' | 'multiDevice'
  backedUp: boolean;             // Whether credential is backed up
  transports?: AuthenticatorTransport[]; // Available transports
  deviceName?: string;           // User-friendly device name
  createdAt: Date;              // Registration timestamp
  lastUsedAt?: Date;            // Last authentication timestamp
  userAgent?: string;           // Browser/device info
}

export interface PasskeyRegistrationOptions {
  challenge: string;
  rp: {
    name: string;
    id: string;
  };
  user: {
    id: string;
    name: string;
    displayName: string;
  };
  pubKeyCredParams: Array<{
    alg: number;
    type: 'public-key';
  }>;
  timeout: number;
  attestation: 'none' | 'indirect' | 'direct';
  excludeCredentials?: Array<{
    id: string;
    type: 'public-key';
    transports?: AuthenticatorTransport[];
  }>;
  authenticatorSelection: {
    authenticatorAttachment?: 'platform' | 'cross-platform';
    userVerification: 'required' | 'preferred' | 'discouraged';
    residentKey?: 'discouraged' | 'preferred' | 'required';
  };
}

export interface PasskeyAuthenticationOptions {
  challenge: string;
  timeout: number;
  rpId: string;
  allowCredentials?: Array<{
    id: string;
    type: 'public-key';
    transports?: AuthenticatorTransport[];
  }>;
  userVerification: 'required' | 'preferred' | 'discouraged';
}

/**
 * Generate registration options for passkey setup
 */
export async function generatePasskeyRegistrationOptions(
  userId: string,
  userName: string,
  userDisplayName: string,
  existingCredentials: PasskeyCredential[] = []
): Promise<PasskeyRegistrationOptions> {
  const excludeCredentials = existingCredentials.map(cred => ({
    id: cred.id,
    type: 'public-key' as const,
    transports: cred.transports,
  }));

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: Buffer.from(userId),
    userName: userName,
    userDisplayName: userDisplayName,
    timeout: 60000, // 1 minute
    attestationType: 'none',
    excludeCredentials,
    authenticatorSelection: {
      userVerification: 'preferred',
      residentKey: 'preferred',
    },
    supportedAlgorithmIDs: [-7, -257], // ES256 and RS256
  });

  return options as PasskeyRegistrationOptions;
}

/**
 * Verify passkey registration response
 */
export async function verifyPasskeyRegistration(
  response: RegistrationResponseJSON,
  expectedChallenge: string,
  expectedOrigin: string[] = ORIGIN
): Promise<{
  verified: boolean;
  registrationInfo?: any;
}> {
  try {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: RP_ID,
      requireUserVerification: false,
    });

    return {
      verified: verification.verified,
      registrationInfo: verification.verified ? verification.registrationInfo : undefined,
    };
  } catch (error) {
    logger.error('Passkey registration verification error', error as Error, {
      operation: 'passkey'
    });
    return { verified: false };
  }
}

/**
 * Generate authentication options for passkey login
 */
export async function generatePasskeyAuthenticationOptions(
  userCredentials: PasskeyCredential[] = []
): Promise<PasskeyAuthenticationOptions> {
  const allowCredentials = userCredentials.map(cred => ({
    id: cred.id,
    type: 'public-key' as const,
    transports: cred.transports,
  }));

  const options = await generateAuthenticationOptions({
    timeout: 60000, // 1 minute
    allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
    userVerification: 'preferred',
    rpID: RP_ID,
  });

  return options as PasskeyAuthenticationOptions;
}

/**
 * Verify passkey authentication response
 */
export async function verifyPasskeyAuthentication(
  response: AuthenticationResponseJSON,
  expectedChallenge: string,
  credential: PasskeyCredential,
  expectedOrigin: string[] = ORIGIN
): Promise<{
  verified: boolean;
  authenticationInfo?: {
    newCounter: number;
    userAgent?: string;
  };
}> {
  try {
    const credentialForVerification = {
      id: credential.id,
      publicKey: new Uint8Array(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports,
    };

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: RP_ID,
      credential: credentialForVerification as any,
      requireUserVerification: false,
    });

    return {
      verified: verification.verified,
      authenticationInfo: verification.verified ? {
        newCounter: verification.authenticationInfo.newCounter,
      } : undefined,
    };
  } catch (error) {
    logger.error('Passkey authentication verification error', error as Error, {
      operation: 'passkey'
    });
    return { verified: false };
  }
}

/**
 * Convert stored credential to PasskeyCredential format
 */
export function parseStoredCredential(stored: any): PasskeyCredential {
  return {
    id: stored.id,
    publicKey: new Uint8Array(Buffer.from(stored.publicKey, 'base64')),
    counter: stored.counter,
    deviceType: stored.deviceType,
    backedUp: stored.backedUp,
    transports: stored.transports,
    deviceName: stored.deviceName,
    createdAt: new Date(stored.createdAt),
    lastUsedAt: stored.lastUsedAt ? new Date(stored.lastUsedAt) : undefined,
    userAgent: stored.userAgent,
  };
}

/**
 * Convert PasskeyCredential to storage format
 */
export function serializeCredential(credential: PasskeyCredential): any {
  return {
    id: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString('base64'),
    counter: credential.counter,
    deviceType: credential.deviceType,
    backedUp: credential.backedUp,
    transports: credential.transports,
    deviceName: credential.deviceName,
    createdAt: credential.createdAt.toISOString(),
    lastUsedAt: credential.lastUsedAt?.toISOString(),
    userAgent: credential.userAgent,
  };
}

/**
 * Generate a user-friendly device name based on user agent
 */
export function generateDeviceName(userAgent?: string): string {
  if (!userAgent) return 'Unknown Device';

  // Simple device detection
  if (userAgent.includes('iPhone')) return 'iPhone';
  if (userAgent.includes('iPad')) return 'iPad';
  if (userAgent.includes('Android')) return 'Android Device';
  if (userAgent.includes('Mac')) return 'Mac';
  if (userAgent.includes('Windows')) return 'Windows PC';
  if (userAgent.includes('Linux')) return 'Linux Device';
  
  // Browser detection
  if (userAgent.includes('Chrome')) return 'Chrome Browser';
  if (userAgent.includes('Firefox')) return 'Firefox Browser';
  if (userAgent.includes('Safari')) return 'Safari Browser';
  if (userAgent.includes('Edge')) return 'Edge Browser';

  return 'Unknown Device';
}

/**
 * Check if passkeys are supported in the current environment
 */
export function isPasskeySupported(): boolean {
  if (typeof window === 'undefined') return false;

  return !!(
    window.PublicKeyCredential &&
    window.navigator.credentials &&
    typeof window.navigator.credentials.create === 'function' &&
    typeof window.navigator.credentials.get === 'function'
  );
}

/**
 * Rate limiting for passkey operations
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(identifier: string, maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const key = `passkey:${identifier}`;
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= maxAttempts) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * Clear rate limit for successful operations
 */
export function clearRateLimit(identifier: string): void {
  const key = `passkey:${identifier}`;
  rateLimitMap.delete(key);
}
