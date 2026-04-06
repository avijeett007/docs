import { Partner } from '@prisma/client';
import { backgroundQueue } from './backgroundJobs';
import { logger } from './logger';
import { obfuscateEmail } from './pii-obfuscation';

const GHL_API_URL = 'https://rest.gohighlevel.com/v1';

interface GHLContact {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  phone?: string;
  tags?: string[];
}

export class GHLError extends Error {
  retryAfter?: number;

  constructor(message: string, retryAfter?: number) {
    super(message);
    this.name = 'GHLError';
    this.retryAfter = retryAfter;
  }
}

export async function makeGHLRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  try {
    const baseUrl = process.env.GHL_API_URL;
    const apiKey = process.env.GHL_API_KEY;

    if (!baseUrl || !apiKey) {
      throw new Error('GHL configuration missing');
    }

    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    // Handle rate limiting with exponential backoff
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('retry-after') || '60');
      logger.warn('Rate limited by GHL', {
        operation: 'crm',
        retryAfter
      });
      throw new GHLError('RATE_LIMIT', retryAfter);
    }

    if (!response.ok) {
      throw new GHLError(response.statusText);
    }

    return await response.json() as Promise<T>;
  } catch (error) {
    if (error instanceof GHLError) {
      throw error;
    }
    throw new GHLError('REQUEST_FAILED');
  }
}

export async function lookupContactByEmail(email: string): Promise<GHLContact | null> {
  try {
    const encodedEmail = encodeURIComponent(email.trim());
    const url = `/contacts/lookup?email=${encodedEmail}`;
    logger.info('Making GHL request', {
      operation: 'crm',
      url
    });
    const data = await makeGHLRequest<{ contacts: GHLContact[] }>(url);

    return data.contacts?.[0] || null;
  } catch (error) {
    logger.error('Contact lookup failed', error as Error, {
      operation: 'crm',
      email: obfuscateEmail(email)
    });
    return null;
  }
}

export async function updateContact(contactId: string, partnershipType: string, existingTags: string[] = []): Promise<boolean> {
  try {
    // Add new tag while preserving existing ones
    const newTag = `knotie-ai-pro-${partnershipType}-request`;
    const tags = Array.from(new Set([...existingTags, newTag]));

    await makeGHLRequest(
      `/contacts/${contactId}`,
      {
        method: 'PUT',
        body: JSON.stringify({ tags }),
      }
    );

    return true;
  } catch (error) {
    if (error instanceof GHLError && error.message === 'RATE_LIMIT') {
      // Schedule retry in background
      backgroundQueue.addJob(
        `update-${contactId}-${Date.now()}`,
        () => updateContact(contactId, partnershipType, existingTags)
      );
      logger.info('Contact update scheduled for retry due to rate limiting', {
        operation: 'crm',
        contactId
      });
      return true; // Return true since we've queued the update
    }
    logger.error('Error updating contact', error as Error, {
      operation: 'crm'
    });
    return false;
  }
}

export async function createContact(partner: Partner): Promise<string | null> {
  try {
    // Split contact name into first and last name
    const [firstName = '', lastName = ''] = partner.contactName.split(' ');

    const data = await makeGHLRequest<{ id: string }>(
      '/contacts',
      {
        method: 'POST',
        body: JSON.stringify({
          email: partner.emailAddress.trim(),
          firstName,
          lastName,
          companyName: partner.businessName,
          phone: partner.phoneNumber,
          tags: [`knotie-ai-pro-${partner.partnershipType}-request`],
        }),
      }
    );

    return data.id || null;
  } catch (error) {
    if (error instanceof GHLError && error.message === 'RATE_LIMIT') {
      // Schedule retry in background
      backgroundQueue.addJob(
        `create-${partner.emailAddress}-${Date.now()}`,
        () => createContact(partner)
      );
      logger.info('Contact creation scheduled for retry due to rate limiting', {
        operation: 'crm',
        email: obfuscateEmail(partner.emailAddress)
      });
      return null; // Return null since we don't have an ID yet
    }
    logger.error('Error creating contact', error as Error, {
      operation: 'crm'
    });
    return null;
  }
}
