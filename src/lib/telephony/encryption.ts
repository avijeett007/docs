import crypto from 'crypto';

export class TelephonyEncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly tagLength = 16; // 128 bits

  private getEncryptionKey(): Buffer {
    const key = process.env.TELEPHONY_ENCRYPTION_KEY;
    if (!key) {
      throw new Error('TELEPHONY_ENCRYPTION_KEY environment variable is required');
    }
    
    // If key is hex-encoded, decode it; otherwise use as-is and hash to get 32 bytes
    if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
      return Buffer.from(key, 'hex');
    }
    
    // Hash the key to get exactly 32 bytes
    return crypto.createHash('sha256').update(key).digest();
  }

  encrypt(plaintext: string): string {
    try {
      const key = this.getEncryptionKey();
      const cipher = crypto.createCipher(this.algorithm, key);

      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      return encrypted;
    } catch (error) {
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  decrypt(encryptedData: string): string {
    try {
      const key = this.getEncryptionKey();
      const decipher = crypto.createDecipher(this.algorithm, key);

      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  generateSipUsername(customerId: string, phoneNumberId: string): string {
    const prefix = 'knotie';
    const customerHash = crypto.createHash('md5').update(customerId).digest('hex').substring(0, 8);
    const phoneHash = crypto.createHash('md5').update(phoneNumberId).digest('hex').substring(0, 8);
    return `${prefix}_${customerHash}_${phoneHash}`;
  }

  generateSipPassword(): string {
    return crypto.randomBytes(16).toString('hex');
  }
}

// Helper functions for easy use
const encryptionService = new TelephonyEncryptionService();

export function encryptSipPassword(password: string): string {
  return encryptionService.encrypt(password);
}

export function decryptSipPassword(encryptedPassword: string): string {
  return encryptionService.decrypt(encryptedPassword);
}

export function generateSipCredentials(customerId: string, phoneNumberId: string): {
  username: string;
  password: string;
} {
  return {
    username: encryptionService.generateSipUsername(customerId, phoneNumberId),
    password: encryptionService.generateSipPassword()
  };
}
