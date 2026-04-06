import { randomBytes, createHash } from 'crypto';
import { encrypt, decrypt } from '@/lib/encryption';
import { prisma } from '@/lib/prisma';
import { PartnerApiKey, CustomerApiKey } from '@prisma/client';
import { logger } from './logger';

// Constants for API key generation
const PARTNER_KEY_PREFIX = 'pkt';
const CUSTOMER_KEY_PREFIX = 'ckt';
const KEY_BYTES = 32; // 256 bits
const VISIBLE_PREFIX_LENGTH = 8; // Length of the visible prefix (including the prefix type)

/**
 * Generate a new API key with the specified prefix
 * @param prefix The prefix to use (pkt or ckt)
 * @returns Object containing the full API key and visible prefix
 */
export async function generateApiKey(prefix: string): Promise<{ apiKey: string; visiblePrefix: string }> {
  // Generate random bytes for the API key
  const randomKey = randomBytes(KEY_BYTES).toString('hex');
  
  // Create the full API key with prefix
  const fullApiKey = `${prefix}_${randomKey}`;
  
  // Create a visible prefix for display purposes (e.g., pkt_abc123...)
  const visiblePrefix = `${prefix}_${randomKey.substring(0, VISIBLE_PREFIX_LENGTH - prefix.length - 1)}`;
  
  return {
    apiKey: fullApiKey,
    visiblePrefix
  };
}

/**
 * Create a new API key for a partner
 * @param partnerId The ID of the partner
 * @param name Name for the API key
 * @param description Optional description
 * @param expiresAt Optional expiry date
 * @param options Additional options like rate limits
 * @returns The created API key object
 */
export async function createPartnerApiKey(
  partnerId: string,
  name: string,
  description?: string,
  expiresAt?: Date,
  options?: {
    rateLimit?: number;
    dailyLimit?: number;
    monthlyLimit?: number;
    allowedIps?: string;
  }
): Promise<PartnerApiKey> {
  // Generate a new API key
  const { apiKey, visiblePrefix } = await generateApiKey(PARTNER_KEY_PREFIX);
  
  // Encrypt the API key for storage
  const encryptedApiKey = await encrypt(apiKey);
  
  // Create the API key record in the database
  const apiKeyRecord = await prisma.partnerApiKey.create({
    data: {
      partnerId,
      name,
      description,
      apiKey: encryptedApiKey,
      prefix: visiblePrefix,
      expiresAt,
      status: 'active',
      rateLimit: options?.rateLimit,
      dailyLimit: options?.dailyLimit,
      monthlyLimit: options?.monthlyLimit,
      allowedIps: options?.allowedIps,
    }
  });
  
  return apiKeyRecord;
}

/**
 * Create a new API key for a customer
 * @param customerId The ID of the customer
 * @param partnerId The ID of the partner who manages this customer
 * @param name Name for the API key
 * @param description Optional description
 * @param expiresAt Optional expiry date
 * @param options Additional options like rate limits
 * @returns The created API key object
 */
export async function createCustomerApiKey(
  customerId: string,
  partnerId: string,
  name: string,
  description?: string,
  expiresAt?: Date,
  options?: {
    rateLimit?: number;
    dailyLimit?: number;
    monthlyLimit?: number;
    allowedIps?: string;
  }
): Promise<CustomerApiKey> {
  // Generate a new API key
  const { apiKey, visiblePrefix } = await generateApiKey(CUSTOMER_KEY_PREFIX);
  
  // Encrypt the API key for storage
  const encryptedApiKey = await encrypt(apiKey);
  
  // Create the API key record in the database
  const apiKeyRecord = await prisma.customerApiKey.create({
    data: {
      customerId,
      partnerId,
      name,
      description,
      apiKey: encryptedApiKey,
      prefix: visiblePrefix,
      expiresAt,
      status: 'active',
      rateLimit: options?.rateLimit,
      dailyLimit: options?.dailyLimit,
      monthlyLimit: options?.monthlyLimit,
      allowedIps: options?.allowedIps,
    }
  });
  
  return apiKeyRecord;
}

/**
 * Verify an API key against the database
 * @param apiKey The API key to verify
 * @returns The API key record if valid, null otherwise
 */
export async function verifyApiKey(apiKey: string): Promise<{
  type: 'partner' | 'customer';
  id: string;
  partnerId: string;
  customerId?: string;
} | null> {
  try {
    // Determine the type of API key
    const prefix = apiKey.split('_')[0];
    
    if (prefix === PARTNER_KEY_PREFIX) {
      // Look up partner API key
      const partnerKeys = await prisma.partnerApiKey.findMany({
        where: {
          status: 'active',
        },
        include: {
          partner: true
        }
      });
      
      // Check each key by decrypting and comparing
      for (const key of partnerKeys) {
        const decryptedKey = await decrypt(key.apiKey);
        if (decryptedKey === apiKey) {
          // Update last used timestamp
          await prisma.partnerApiKey.update({
            where: { id: key.id },
            data: {
              lastUsedAt: new Date(),
              usageCount: { increment: 1 },
              dailyUsage: { increment: 1 },
              monthlyUsage: { increment: 1 }
            }
          });
          
          return {
            type: 'partner',
            id: key.id,
            partnerId: key.partnerId
          };
        }
      }
    } else if (prefix === CUSTOMER_KEY_PREFIX) {
      // Look up customer API key
      const customerKeys = await prisma.customerApiKey.findMany({
        where: {
          status: 'active',
        },
        include: {
          customer: true
        }
      });
      
      // Check each key by decrypting and comparing
      for (const key of customerKeys) {
        const decryptedKey = await decrypt(key.apiKey);
        if (decryptedKey === apiKey) {
          // Update last used timestamp
          await prisma.customerApiKey.update({
            where: { id: key.id },
            data: {
              lastUsedAt: new Date(),
              usageCount: { increment: 1 },
              dailyUsage: { increment: 1 },
              monthlyUsage: { increment: 1 }
            }
          });
          
          return {
            type: 'customer',
            id: key.id,
            partnerId: key.partnerId,
            customerId: key.customerId
          };
        }
      }
    }
    
    return null;
  } catch (error) {
    logger.error('Error verifying API key', error as Error, {
      operation: 'api_keys'
    });
    return null;
  }
}

/**
 * Revoke an API key
 * @param keyId The ID of the API key to revoke
 * @param type The type of API key (partner or customer)
 * @returns True if successful, false otherwise
 */
export async function revokeApiKey(keyId: string, type: 'partner' | 'customer'): Promise<boolean> {
  try {
    if (type === 'partner') {
      await prisma.partnerApiKey.update({
        where: { id: keyId },
        data: { status: 'revoked' }
      });
    } else {
      await prisma.customerApiKey.update({
        where: { id: keyId },
        data: { status: 'revoked' }
      });
    }
    
    return true;
  } catch (error) {
    logger.error('Error revoking API key', error as Error, {
      operation: 'api_keys'
    });
    return false;
  }
}

/**
 * Renew an API key by generating a new one and revoking the old one
 * @param keyId The ID of the API key to renew
 * @param type The type of API key (partner or customer)
 * @returns The new API key record if successful, null otherwise
 */
export async function renewApiKey(keyId: string, type: 'partner' | 'customer'): Promise<PartnerApiKey | CustomerApiKey | null> {
  try {
    if (type === 'partner') {
      // Get the existing key
      const existingKey = await prisma.partnerApiKey.findUnique({
        where: { id: keyId }
      });
      
      if (!existingKey) {
        return null;
      }
      
      // Create a new key with the same settings
      const newKey = await createPartnerApiKey(
        existingKey.partnerId,
        existingKey.name,
        existingKey.description || undefined,
        existingKey.expiresAt || undefined,
        {
          rateLimit: existingKey.rateLimit || undefined,
          dailyLimit: existingKey.dailyLimit || undefined,
          monthlyLimit: existingKey.monthlyLimit || undefined,
          allowedIps: existingKey.allowedIps || undefined
        }
      );
      
      // Revoke the old key
      await prisma.partnerApiKey.update({
        where: { id: keyId },
        data: { status: 'revoked' }
      });
      
      return newKey;
    } else {
      // Get the existing key
      const existingKey = await prisma.customerApiKey.findUnique({
        where: { id: keyId }
      });
      
      if (!existingKey) {
        return null;
      }
      
      // Create a new key with the same settings
      const newKey = await createCustomerApiKey(
        existingKey.customerId,
        existingKey.partnerId,
        existingKey.name,
        existingKey.description || undefined,
        existingKey.expiresAt || undefined,
        {
          rateLimit: existingKey.rateLimit || undefined,
          dailyLimit: existingKey.dailyLimit || undefined,
          monthlyLimit: existingKey.monthlyLimit || undefined,
          allowedIps: existingKey.allowedIps || undefined
        }
      );
      
      // Revoke the old key
      await prisma.customerApiKey.update({
        where: { id: keyId },
        data: { status: 'revoked' }
      });
      
      return newKey;
    }
  } catch (error) {
    logger.error('Error renewing API key', error as Error, {
      operation: 'api_keys'
    });
    return null;
  }
}
