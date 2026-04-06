import { encrypt, decrypt, isLikelyEncrypted } from '@/lib/encryption';
import { logger } from '../logger';

/**
 * N8N API Key Encryption Utility
 * Provides secure encryption/decryption for N8N API keys using the common encryption utility
 */
export class N8nApiKeyEncryption {
  /**
   * Encrypt an N8N API key
   * @param apiKey - The plain text API key
   * @param masterKey - The master encryption key (not used with common encryption)
   * @returns Base64 encoded encrypted data
   */
  static async encrypt(apiKey: string, masterKey?: string): Promise<string> {
    try {
      // Validate API key format
      if (!this.validateApiKeyFormat(apiKey)) {
        throw new Error('Invalid N8N API key format');
      }

      // Use the common encryption utility
      return await encrypt(apiKey);
    } catch (error) {
      throw new Error(`Failed to encrypt N8N API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt an N8N API key
   * @param encryptedApiKey - Base64 encoded encrypted data
   * @param masterKey - The master encryption key (not used with common encryption)
   * @returns Plain text API key
   */
  static async decrypt(encryptedApiKey: string, masterKey?: string): Promise<string> {
    try {
      // Use the common decryption utility
      const apiKey = await decrypt(encryptedApiKey);

      // Validate decrypted API key format
      if (!this.validateApiKeyFormat(apiKey)) {
        throw new Error('Decrypted data is not a valid N8N API key');
      }

      return apiKey;
    } catch (error) {
      throw new Error(`Failed to decrypt N8N API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate N8N API key format
   * @param apiKey - The API key to validate
   * @returns True if valid format
   */
  static validateApiKeyFormat(apiKey: string): boolean {
    // N8N API keys can be JWT tokens or other formats - allow reasonable length and characters
    return apiKey.length >= 10 && apiKey.length <= 500 && /^[a-zA-Z0-9_\-\.]+$/.test(apiKey);
  }

  /**
   * Generate a secure hash of the API key for identification purposes
   * @param apiKey - The API key to hash
   * @returns Partial hash for identification
   */
  static generateApiKeyHash(apiKey: string): string {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(apiKey).digest('hex');
    // Return first 8 characters for identification
    return hash.substring(0, 8);
  }

  /**
   * Mask an API key for display purposes
   * @param apiKey - The API key to mask
   * @returns Masked API key
   */
  static maskApiKey(apiKey: string): string {
    if (!apiKey || apiKey.length < 8) {
      return '***';
    }
    const prefix = apiKey.substring(0, 4);
    const suffix = apiKey.substring(apiKey.length - 4);
    return `${prefix}${'*'.repeat(Math.max(8, apiKey.length - 8))}${suffix}`;
  }
}

/**
 * Secure API Key Manager
 * Handles storage and retrieval of encrypted N8N API keys
 */
export class SecureApiKeyManager {
  private static readonly MASTER_KEY = process.env.N8N_ENCRYPTION_KEY;

  /**
   * Store an encrypted API key
   * @param partnerId - Partner ID
   * @param instanceName - Instance name for identification
   * @param apiKey - Plain text API key
   * @returns Encrypted API key for database storage
   */
  static async storeApiKey(
    partnerId: string,
    instanceName: string,
    apiKey: string
  ): Promise<string> {
    if (!this.MASTER_KEY) {
      throw new Error('N8N_ENCRYPTION_KEY environment variable not set');
    }

    // Validate API key format
    if (!N8nApiKeyEncryption.validateApiKeyFormat(apiKey)) {
      throw new Error('Invalid N8N API key format');
    }

    // Encrypt the API key
    const encryptedApiKey = await N8nApiKeyEncryption.encrypt(apiKey);

    // Log the storage event (without the actual key)
    logger.info('Storing encrypted N8N API key', {
      operation: 'n8n_api_key_storage',
      partnerId,
      instanceName
    });

    return encryptedApiKey;
  }

  /**
   * Retrieve and decrypt an API key
   * @param encryptedApiKey - Encrypted API key from database
   * @returns Plain text API key
   */
  static async retrieveApiKey(encryptedApiKey: string): Promise<string> {
    if (!this.MASTER_KEY) {
      throw new Error('N8N_ENCRYPTION_KEY environment variable not set');
    }

    // Decrypt the API key
    const apiKey = await N8nApiKeyEncryption.decrypt(encryptedApiKey);

    return apiKey;
  }

  /**
   * Test if an API key can be decrypted successfully
   * @param encryptedApiKey - Encrypted API key from database
   * @returns True if decryption succeeds
   */
  static async testDecryption(encryptedApiKey: string): Promise<boolean> {
    try {
      await this.retrieveApiKey(encryptedApiKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Rotate encryption for an API key (re-encrypt with current encryption key)
   * @param encryptedApiKey - Currently encrypted API key
   * @returns Re-encrypted API key
   */
  static async rotateEncryption(encryptedApiKey: string): Promise<string> {
    // Decrypt with current key
    const apiKey = await N8nApiKeyEncryption.decrypt(encryptedApiKey);

    // Re-encrypt with current key (generates new salt/IV)
    const reEncryptedApiKey = await N8nApiKeyEncryption.encrypt(apiKey);

    return reEncryptedApiKey;
  }
}

/**
 * Security Error for API key operations
 */
export class SecurityError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

/**
 * API Key validation utilities
 */
export class ApiKeyValidator {
  /**
   * Validate API key strength and format
   * @param apiKey - API key to validate
   * @returns Validation result with details
   */
  static validateApiKey(apiKey: string): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check basic format
    if (!N8nApiKeyEncryption.validateApiKeyFormat(apiKey)) {
      errors.push('API key must be 10-500 characters and contain only alphanumeric characters, underscores, hyphens, and dots');
    }

    // Check length (already handled in validateApiKeyFormat, but keep for explicit feedback)
    if (apiKey.length < 10) {
      errors.push('API key is too short (minimum 10 characters)');
    }
    if (apiKey.length > 500) {
      errors.push('API key is too long (maximum 500 characters)');
    }

    // Check for common weak patterns
    if (apiKey.includes('test') || apiKey.includes('demo')) {
      warnings.push('API key appears to be for testing purposes');
    }

    // Check character diversity (for non-JWT tokens)
    if (!apiKey.includes('.')) { // Not a JWT token
      const uniqueChars = new Set(apiKey).size;
      if (uniqueChars < 10) {
        warnings.push('API key has low character diversity');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Check if API key is likely expired or invalid
   * @param apiKey - API key to check
   * @returns True if key appears to be invalid
   */
  static isLikelyInvalid(apiKey: string): boolean {
    // Check for obvious invalid patterns
    const invalidPatterns = [
      /^n8n_0+$/,
      /^n8n_1+$/,
      /^n8n_test/i,
      /^n8n_demo/i,
      /^n8n_example/i,
    ];

    return invalidPatterns.some(pattern => pattern.test(apiKey));
  }
}
