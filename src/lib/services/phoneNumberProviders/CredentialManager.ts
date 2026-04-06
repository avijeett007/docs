import crypto from 'crypto';
import { encrypt, decrypt, isLikelyEncrypted } from '@/lib/encryption';
import { logger } from '@/lib/logger';

/**
 * Credential encryption and management service
 * Uses the existing encryption utility for consistency
 */
export class CredentialManager {
  
  /**
   * Encrypt provider credentials using the existing encryption utility
   */
  static async encryptCredentials(credentials: Record<string, any>): Promise<string> {
    try {
      const plaintext = JSON.stringify(credentials);
      return await encrypt(plaintext);
    } catch (error) {
      logger.error('Failed to encrypt credentials', error as Error, {
        operation: 'credential_manager'
      });
      throw new Error('Failed to encrypt provider credentials');
    }
  }
  
  /**
   * Decrypt provider credentials using the existing encryption utility
   */
  static async decryptCredentials(encryptedData: string): Promise<Record<string, any>> {
    try {
      const decrypted = await decrypt(encryptedData);
      return JSON.parse(decrypted);
    } catch (error) {
      logger.error('Failed to decrypt credentials', error as Error, {
        operation: 'credential_manager'
      });
      throw new Error('Failed to decrypt provider credentials');
    }
  }
  
  /**
   * Generate a new encryption key (for setup)
   */
  static generateEncryptionKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Validate encrypted credentials format using existing encryption utility
   */
  static isValidEncryptedFormat(encryptedData: string): boolean {
    return isLikelyEncrypted(encryptedData);
  }
  
  /**
   * Hash credentials for comparison (without decryption)
   */
  static hashCredentials(credentials: Record<string, any>): string {
    const normalized = JSON.stringify(credentials, Object.keys(credentials).sort());
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }
  
  /**
   * Securely compare two credential hashes
   */
  static compareCredentialHashes(hash1: string, hash2: string): boolean {
    if (hash1.length !== hash2.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < hash1.length; i++) {
      result |= hash1.charCodeAt(i) ^ hash2.charCodeAt(i);
    }
    
    return result === 0;
  }
  
  /**
   * Sanitize credentials for logging (remove sensitive data)
   */
  static sanitizeCredentialsForLogging(credentials: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(credentials)) {
      if (typeof value === 'string') {
        // Show first 4 and last 4 characters for identification
        if (value.length > 8) {
          sanitized[key] = `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
        } else {
          sanitized[key] = '***';
        }
      } else {
        sanitized[key] = '***';
      }
    }
    
    return sanitized;
  }
  
  /**
   * Validate credential strength/format
   */
  static validateCredentialStrength(provider: string, credentials: Record<string, any>): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    switch (provider.toLowerCase()) {
      case 'twilio':
        if (!credentials.accountSid) {
          errors.push('Account SID is required');
        } else if (!credentials.accountSid.startsWith('AC') || credentials.accountSid.length !== 34) {
          errors.push('Invalid Account SID format (should start with AC and be 34 characters)');
        }
        
        if (!credentials.authToken) {
          errors.push('Auth Token is required');
        } else if (credentials.authToken.length < 32) {
          warnings.push('Auth Token seems unusually short');
        }
        break;
      
      case 'telnyx':
        if (!credentials.apiKey) {
          errors.push('API Key is required');
        } else if (!credentials.apiKey.startsWith('KEY')) {
          errors.push('Invalid API Key format (should start with KEY)');
        } else if (credentials.apiKey.length < 40) {
          warnings.push('API Key seems unusually short');
        }
        break;
      
      default:
        errors.push(`Unknown provider: ${provider}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Create a secure credential storage record
   */
  static async createCredentialRecord(
    partnerId: string,
    customerId: string | null,
    provider: string,
    accountIdentifier: string,
    credentials: Record<string, any>
  ): Promise<{
    partnerId: string;
    customerId: string | null;
    provider: string;
    accountIdentifier: string;
    credentials: string; // encrypted
  }> {
    const encryptedCredentials = await this.encryptCredentials(credentials);

    return {
      partnerId,
      customerId,
      provider: provider.toLowerCase(),
      accountIdentifier,
      credentials: encryptedCredentials
    };
  }
  
  /**
   * Update credentials while preserving metadata
   */
  static async updateCredentials(
    existingRecord: any,
    newCredentials: Record<string, any>
  ): Promise<{
    credentials: string;
    lastValidated: null; // Reset validation status
  }> {
    const encryptedCredentials = await this.encryptCredentials(newCredentials);

    return {
      credentials: encryptedCredentials,
      lastValidated: null // Reset validation when credentials change
    };
  }
}
