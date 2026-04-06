import crypto from 'crypto';
import { logger } from './logger';

// Require encryption key in production - no fallbacks for security
if (!process.env.ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY environment variable is required');
}
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const ITERATIONS = 100000;
const KEY_LENGTH = 32;
const DIGEST = 'sha512';

export const encryptData = encrypt; // Alias for backward compatibility

export async function encrypt(text: string): Promise<string> {
  try {
    logger.debug('Starting encryption process', {
      operation: 'encryption',
      textLength: text.length,
      textPreview: text.substring(0, 5)
    });

    // Generate a random salt
    const salt = crypto.randomBytes(SALT_LENGTH);

    // Generate key using PBKDF2
    const key = crypto.pbkdf2Sync(
      ENCRYPTION_KEY,
      salt,
      ITERATIONS,
      KEY_LENGTH,
      DIGEST
    );
    logger.debug('Generated key using PBKDF2', {
      operation: 'encryption'
    });

    // Create initialization vector
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt the text
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get the auth tag
    const tag = cipher.getAuthTag();

    // Combine the salt, iv, tag and encrypted text
    const result = Buffer.concat([
      salt,
      iv,
      tag,
      Buffer.from(encrypted, 'hex')
    ]);

    // Return as base64
    const base64Result = result.toString('base64');
    logger.debug('Encryption successful', {
      operation: 'encryption',
      resultLength: base64Result.length
    });
    return base64Result;
  } catch (error) {
    logger.error('Encryption error', error as Error, {
      operation: 'encryption'
    });
    throw new Error('Failed to encrypt data');
  }
}

export const decryptData = decrypt; // Alias for backward compatibility

export async function decrypt(encryptedData: string): Promise<string> {
  try {
    logger.debug('Starting decryption process', {
      operation: 'decryption',
      dataLength: encryptedData.length
    });

    // Convert from base64 to buffer
    const buffer = Buffer.from(encryptedData, 'base64');
    logger.debug('Converted base64 to buffer', {
      operation: 'decryption',
      bufferLength: buffer.length
    });

    // Extract the salt, iv, tag and encrypted text
    const salt = buffer.subarray(0, SALT_LENGTH);
    const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = buffer.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

    logger.debug('Extracted components', {
      operation: 'decryption',
      saltLength: salt.length,
      ivLength: iv.length,
      tagLength: tag.length,
      encryptedLength: encrypted.length
    });

    // Generate key using PBKDF2
    const key = crypto.pbkdf2Sync(
      ENCRYPTION_KEY,
      salt,
      ITERATIONS,
      KEY_LENGTH,
      DIGEST
    );
    logger.debug('Generated key using PBKDF2', {
      operation: 'decryption'
    });

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    // Decrypt the text
    let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    logger.debug('Decryption successful', {
      operation: 'decryption',
      resultLength: decrypted.length,
      textPreview: decrypted.substring(0, 5)
    });

    return decrypted;
  } catch (error) {
    logger.error('Decryption error', error as Error, {
      operation: 'decryption'
    });
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Check if a string is likely already encrypted by our encryption method
 * This checks if the string is a valid base64 and has the expected length
 * for an encrypted string
 */
export function isLikelyEncrypted(text: string): boolean {
  try {
    // Check if it's a valid base64 string
    const isValidBase64 = /^[A-Za-z0-9+/=]+$/.test(text);
    if (!isValidBase64) return false;

    // Check if the length is reasonable for an encrypted string
    // Our encrypted strings are typically longer than 100 characters
    if (text.length < 100) return false;

    // Try to decode and check if it has the expected structure
    const buffer = Buffer.from(text, 'base64');

    // An encrypted buffer should be at least SALT_LENGTH + IV_LENGTH + TAG_LENGTH in size
    const minLength = SALT_LENGTH + IV_LENGTH + TAG_LENGTH;
    if (buffer.length < minLength) return false;

    // If we got this far, it's likely an encrypted string
    return true;
  } catch (error) {
    // If there's any error in the process, it's not an encrypted string
    return false;
  }
}
