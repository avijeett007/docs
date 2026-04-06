import { prisma } from '@/lib/prisma';
import { initTwilioClient } from '@/lib/twilio';
import crypto from 'crypto';
import { logger } from '@/lib/logger';

// Encryption key from environment (should be 32 bytes)
const getEncryptionKey = (): Buffer => {
  if (process.env.ENCRYPTION_KEY) {
    // If provided in env, ensure it's 32 bytes
    const key = process.env.ENCRYPTION_KEY;
    if (key.length === 64) {
      // Assume it's a hex string
      return Buffer.from(key, 'hex');
    } else if (key.length === 32) {
      // Assume it's a UTF-8 string
      return Buffer.from(key, 'utf8');
    } else {
      // Pad or truncate to 32 bytes
      return Buffer.from(key.padEnd(32, '0').slice(0, 32), 'utf8');
    }
  } else {
    // Generate a random 32-byte key for development
    logger.warn('ENCRYPTION_KEY not set in environment, using random key (not suitable for production)', {
      operation: 'twilio_subaccount'
    });
    return crypto.randomBytes(32);
  }
};

const ENCRYPTION_KEY = getEncryptionKey();
const IV_LENGTH = 16;

// Encrypt sensitive data
function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

// Decrypt sensitive data
function decrypt(text: string): string {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift()!, 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

// Create a Twilio subaccount for a customer
export async function createTwilioSubaccount(
  customerId: string,
  customerName: string,
  partnerName: string
): Promise<{
  subaccountSid: string;
  subaccountAuthToken: string;
}> {
  try {
    // Check if customer already has a subaccount
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { twilioSubaccountSid: true },
    });

    if (customer?.twilioSubaccountSid) {
      throw new Error('Customer already has a Twilio subaccount');
    }

    // Initialize Twilio client
    const twilioClient = initTwilioClient();

    // Create friendly name for the subaccount
    const friendlyName = `${customerName} - ${partnerName}`;

    // Create the subaccount
    const subaccount = await twilioClient.createSubaccount(friendlyName);

    // Encrypt the auth token before storing
    const encryptedAuthToken = encrypt(subaccount.auth_token);

    // Update customer record with subaccount details
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        twilioSubaccountSid: subaccount.sid,
        twilioSubaccountAuth: encryptedAuthToken,
        twilioSubaccountStatus: 'active',
        twilioSubaccountCreatedAt: new Date(),
      },
    });

    return {
      subaccountSid: subaccount.sid,
      subaccountAuthToken: subaccount.auth_token,
    };
  } catch (error) {
    logger.error('Error creating Twilio subaccount', error as Error, {
      operation: 'twilio_subaccount',
      customerId,
      customerName,
      partnerName
    });
    throw error;
  }
}

// Get Twilio client for a specific customer's subaccount
export async function getCustomerTwilioClient(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      twilioSubaccountSid: true,
      twilioSubaccountAuth: true,
      twilioSubaccountStatus: true,
    },
  });

  if (!customer) {
    throw new Error('Customer not found');
  }

  if (!customer.twilioSubaccountSid || !customer.twilioSubaccountAuth) {
    throw new Error('Customer does not have a Twilio subaccount');
  }

  if (customer.twilioSubaccountStatus !== 'active') {
    throw new Error(`Customer Twilio subaccount is ${customer.twilioSubaccountStatus}`);
  }

  // Decrypt the auth token
  const authToken = decrypt(customer.twilioSubaccountAuth);

  // Create a new Twilio client instance for the subaccount
  const { TwilioClient } = await import('@/lib/twilio');
  return new TwilioClient({
    accountSid: customer.twilioSubaccountSid,
    authToken: authToken,
  });
}

// Create subaccount during customer onboarding
export async function onboardCustomerTwilioSubaccount(
  customerId: string,
  partnerId: string
): Promise<void> {
  try {
    // Get customer and partner details
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        credentials: {
          include: {
            partner: {
              select: { businessName: true },
            },
          },
          take: 1,
        },
      },
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    // Skip if customer already has a subaccount
    if (customer.twilioSubaccountSid) {
      return;
    }

    // Create customer name
    const customerName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email;

    // Create the subaccount
    const partnerName = customer.credentials[0]?.partner.businessName || 'Unknown Partner';
    await createTwilioSubaccount(
      customerId,
      customerName,
      partnerName
    );
  } catch (error) {
    logger.error('Failed to create Twilio subaccount for customer', error as Error, {
      operation: 'twilio_subaccount',
      customerId
    });
    // Don't throw error to prevent blocking customer creation
    // The subaccount can be created later or manually
  }
}

// Validate Twilio credentials
async function validateTwilioCredentials(): Promise<boolean> {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      logger.error('Twilio credentials not configured in environment variables', new Error('Twilio credentials not configured'), {
        operation: 'twilio_subaccount'
      });
      return false;
    }

    // Try to initialize client and make a simple API call
    const twilioClient = initTwilioClient();
    // This will throw if credentials are invalid
    await twilioClient.validateCredentials();
    return true;
  } catch (error) {
    logger.error('Twilio credentials validation failed', error as Error, {
      operation: 'twilio_subaccount'
    });
    return false;
  }
}

// Create subaccount for existing customer (on-the-fly)
export async function createSubaccountForExistingCustomer(customerId: string): Promise<void> {
  try {
    // First validate Twilio credentials
    const credentialsValid = await validateTwilioCredentials();
    if (!credentialsValid) {
      throw new Error('Twilio credentials are not properly configured');
    }

    // Get customer details with partner information
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        credentials: {
          include: {
            partner: {
              select: { businessName: true },
            },
          },
          take: 1,
        },
      },
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    // Skip if customer already has a subaccount
    if (customer.twilioSubaccountSid) {
      return;
    }

    // Create customer name
    const customerName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email;

    // Get partner name
    const partnerName = customer.credentials[0]?.partner.businessName || 'Unknown Partner';

    // Create the subaccount
    try {
      await createTwilioSubaccount(
        customerId,
        customerName,
        partnerName
      );
    } catch (subaccountError: any) {
      // Check if the error is related to subaccount permissions
      if (subaccountError.message?.includes('not found') ||
          subaccountError.message?.includes('403') ||
          subaccountError.message?.includes('Forbidden')) {
        // Don't throw error - let the system fall back to main account
        return;
      }
      // Re-throw other errors
      throw subaccountError;
    }
  } catch (error) {
    logger.error('Failed to create Twilio subaccount for existing customer', error as Error, {
      operation: 'twilio_subaccount',
      customerId
    });
    throw error; // Re-throw to allow fallback handling
  }
}

// Suspend a customer's Twilio subaccount
export async function suspendCustomerTwilioSubaccount(customerId: string): Promise<void> {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { twilioSubaccountSid: true },
    });

    if (!customer?.twilioSubaccountSid) {
      return; // No subaccount to suspend
    }

    // Update status in database
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        twilioSubaccountStatus: 'suspended',
      },
    });

    // In production, you might also want to:
    // 1. Release all phone numbers
    // 2. Disable the subaccount via Twilio API
    // 3. Cancel any pending charges
  } catch (error) {
    logger.error('Error suspending Twilio subaccount for customer', error as Error, {
      operation: 'twilio_subaccount',
      customerId
    });
    throw error;
  }
}

// Reactivate a customer's Twilio subaccount
export async function reactivateCustomerTwilioSubaccount(customerId: string): Promise<void> {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { 
        twilioSubaccountSid: true,
        twilioSubaccountStatus: true,
      },
    });

    if (!customer?.twilioSubaccountSid) {
      throw new Error('Customer does not have a Twilio subaccount');
    }

    if (customer.twilioSubaccountStatus === 'active') {
      return; // Already active
    }

    // Update status in database
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        twilioSubaccountStatus: 'active',
      },
    });
  } catch (error) {
    logger.error('Error reactivating Twilio subaccount for customer', error as Error, {
      operation: 'twilio_subaccount',
      customerId
    });
    throw error;
  }
}