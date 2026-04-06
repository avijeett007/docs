import crypto from 'crypto';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { encryptData, decryptData } from './encryption';
import { logger } from './logger';

// Configure TOTP settings
authenticator.options = {
  window: 1, // Allow 1 step before/after current time
  step: 30,  // 30-second time step
};

/**
 * Generate a random 6-digit OTP for email verification
 */
export function generateEmailOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Generate a secret key for TOTP authenticator apps
 */
export function generateTOTPSecret(): string {
  return authenticator.generateSecret();
}

/**
 * Generate QR code URL for authenticator app setup
 */
export async function generateQRCode(secret: string, email: string, issuer: string = 'Knotie AI Pro'): Promise<string> {
  const otpauth = authenticator.keyuri(email, issuer, secret);
  return await QRCode.toDataURL(otpauth);
}

/**
 * Verify TOTP token from authenticator app
 */
export function verifyTOTP(token: string, secret: string): boolean {
  try {
    return authenticator.verify({ token, secret });
  } catch (error) {
    logger.error('TOTP verification error', error as Error, {
      operation: 'mfa_service'
    });
    return false;
  }
}

/**
 * Generate backup codes for MFA recovery
 */
export function generateBackupCodes(count: number = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric codes
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code);
  }
  return codes;
}

/**
 * Encrypt backup codes for storage
 */
export async function encryptBackupCodes(codes: string[]): Promise<string[]> {
  const encryptedCodes: string[] = [];
  for (const code of codes) {
    const encrypted = await encryptData(code);
    encryptedCodes.push(encrypted);
  }
  return encryptedCodes;
}

/**
 * Decrypt backup codes for verification
 */
export async function decryptBackupCodes(encryptedCodes: string[]): Promise<string[]> {
  const decryptedCodes: string[] = [];
  for (const encryptedCode of encryptedCodes) {
    try {
      const decrypted = await decryptData(encryptedCode);
      decryptedCodes.push(decrypted);
    } catch (error) {
      logger.error('Error decrypting backup code', error as Error, {
        operation: 'mfa_service'
      });
      // Skip invalid codes
    }
  }
  return decryptedCodes;
}

/**
 * Verify backup code and remove it from the list
 */
export async function verifyAndConsumeBackupCode(
  inputCode: string, 
  encryptedCodes: string[]
): Promise<{ isValid: boolean; remainingCodes: string[] }> {
  const decryptedCodes = await decryptBackupCodes(encryptedCodes);
  const normalizedInput = inputCode.toUpperCase().replace(/\s/g, '');
  
  const codeIndex = decryptedCodes.findIndex(code => 
    code.toUpperCase().replace(/\s/g, '') === normalizedInput
  );
  
  if (codeIndex === -1) {
    return { isValid: false, remainingCodes: encryptedCodes };
  }
  
  // Remove the used code
  const remainingDecrypted = decryptedCodes.filter((_, index) => index !== codeIndex);
  const remainingEncrypted = await encryptBackupCodes(remainingDecrypted);
  
  return { isValid: true, remainingCodes: remainingEncrypted };
}

export interface MFAWarningState {
  shouldShow: boolean;
  isMandatory: boolean;
  message: string | null;
}

/**
 * Check if MFA warning should be shown based on Stripe Connect status and last dismissal
 */
export function shouldShowMFAWarning(
  stripeConnectEnabled: boolean,
  mfaEnabled: boolean,
  lastDismissedAt?: Date | null
): { shouldShow: boolean; isMandatory: boolean } {
  // If MFA is already enabled, don't show warning
  if (mfaEnabled) {
    return { shouldShow: false, isMandatory: false };
  }
  
  // If Stripe Connect is enabled, MFA is mandatory
  if (stripeConnectEnabled) {
    return { shouldShow: true, isMandatory: true };
  }
  
  // If Stripe Connect is not enabled, show warning less frequently
  if (!lastDismissedAt) {
    return { shouldShow: true, isMandatory: false };
  }
  
  // Show warning again after 7 days for non-Stripe Connect partners
  const daysSinceLastDismissal = Math.floor(
    (Date.now() - lastDismissedAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  return { 
    shouldShow: daysSinceLastDismissal >= 7, 
    isMandatory: false 
  };
}

export function getMFAWarningState(
  stripeConnectEnabled: boolean,
  mfaEnabled: boolean,
  lastDismissedAt?: Date | null
): MFAWarningState {
  const { shouldShow, isMandatory } = shouldShowMFAWarning(
    stripeConnectEnabled,
    mfaEnabled,
    lastDismissedAt
  );

  if (!shouldShow) {
    return {
      shouldShow: false,
      isMandatory: false,
      message: null,
    };
  }

  return {
    shouldShow: true,
    isMandatory,
    message: isMandatory
      ? 'Multi-factor authentication is required for Stripe Connect partners'
      : 'Enable multi-factor authentication to secure your account',
  };
}

/**
 * Validate OTP format (6 digits)
 */
export function isValidOTPFormat(otp: string): boolean {
  return /^\d{6}$/.test(otp);
}

/**
 * Validate backup code format (8 alphanumeric characters)
 */
export function isValidBackupCodeFormat(code: string): boolean {
  const normalized = code.toUpperCase().replace(/\s/g, '');
  return /^[A-Z0-9]{8}$/.test(normalized);
}
