import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { logger } from './logger';

export interface GHLContact {
  email: string;
  firstName: string;
  lastName: string;
  companyName?: string;
  phone?: string;
  tags: string[];
}

export interface GHLContactResponse {
  contact: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    companyName?: string;
    phone?: string;
    tags: string[];
    [key: string]: any;
  };
}

// Helper function to handle API key decryption if needed
async function prepareApiKey(apiKey: string): Promise<string> {
  // If it's the environment variable (BEARER token), use it as is
  if (apiKey === process.env.GOHIGHLEVEL_BEARER_TOKEN) {
    return apiKey;
  }
  // Otherwise, it's from the partner database and needs decryption
  return decrypt(apiKey);
}

export async function searchGHLContact(
  email: string,
  ghlApiKey: string,
  ghlUrl: string
): Promise<string | null> {
  try {
    const preparedApiKey = await prepareApiKey(ghlApiKey);
    const response = await fetch(`${ghlUrl}/contacts/lookup?email=${encodeURIComponent(email)}`, {
      headers: {
        'Authorization': `Bearer ${preparedApiKey}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to lookup contact: ${response.statusText}`);
    }

    const data = await response.json();
    return data.contacts?.[0]?.id || null;
  } catch (error) {
    logger.error('Error in searchGHLContact', error as Error, {
      operation: 'ghl',
      email
    });
    return null;
  }
}

export async function createGHLContact(
  contact: GHLContact,
  ghlApiKey: string,
  ghlUrl: string
): Promise<string> {
  try {
    const preparedApiKey = await prepareApiKey(ghlApiKey);
    const response = await fetch(`${ghlUrl}/contacts/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${preparedApiKey}`,
      },
      body: JSON.stringify(contact),
    });

    if (!response.ok) {
      throw new Error(`Failed to create contact: ${response.statusText}`);
    }

    const data = await response.json() as GHLContactResponse;
    return data.contact.id;
  } catch (error) {
    logger.error('Error in createGHLContact', error as Error, {
      operation: 'ghl',
      contact
    });
    throw error;
  }
}

export async function updateGHLContact(
  contactId: string,
  contact: Partial<GHLContact>,
  ghlApiKey: string,
  ghlUrl: string,
  tagsOnly: boolean = false
): Promise<string> {
  try {
    const preparedApiKey = await prepareApiKey(ghlApiKey);
    logger.debug('Updating GHL contact', {
      operation: 'ghl',
      method: 'PUT',
      contactId,
      url: `${ghlUrl}/contacts/${contactId}`
    });
    
    // For main CRM updates, we only update tags
    const updateData = tagsOnly ? {
      tags: contact.tags
    } : {
      email: contact.email,
      firstName: contact.firstName,
      lastName: contact.lastName,
      ...(contact.companyName && { companyName: contact.companyName }),
      ...(contact.phone && { phone: contact.phone }),
      tags: contact.tags
    };

    logger.debug('GHL update request details', {
      operation: 'ghl',
      requestBody: updateData,
      apiKeyPreview: preparedApiKey.substring(0, 10) + '...'
    });

    const response = await fetch(`${ghlUrl}/contacts/${contactId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${preparedApiKey}`,
      },
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      const errorDetails = await response.json();
      throw new Error(`Failed to update contact: ${response.statusText}. Details: ${JSON.stringify(errorDetails)}`);
    }

    const data = await response.json() as GHLContactResponse;
    return data.contact.id;
  } catch (error) {
    logger.error('Error in updateGHLContact', error as Error, {
      operation: 'ghl',
      contactId,
      contact
    });
    throw error;
  }
}

export async function getGHLContact(
  contactId: string,
  ghlApiKey: string,
  ghlUrl: string
): Promise<GHLContactResponse | null> {
  try {
    const preparedApiKey = await prepareApiKey(ghlApiKey);
    logger.debug('Getting GHL contact', {
      operation: 'ghl',
      method: 'GET',
      contactId,
      url: `${ghlUrl}/contacts/${contactId}`
    });

    const response = await fetch(`${ghlUrl}/contacts/${contactId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${preparedApiKey}`,
      },
    });

    logger.debug('GHL response status', {
      operation: 'ghl',
      status: response.status,
      statusText: response.statusText
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      const errorText = await response.text();
      logger.error('GHL API error response', new Error(errorText), {
        operation: 'ghl',
        errorText
      });
      throw new Error(`Failed to get contact: ${response.statusText}. Details: ${errorText}`);
    }

    const data = await response.json() as GHLContactResponse;
    logger.debug('Found Contact', {
      operation: 'ghl',
      contact: {
        id: data.contact.id,
        email: data.contact.email,
        tags: data.contact.tags
      }
    });
    return data;
  } catch (error) {
    logger.error('Error in getGHLContact', error as Error, {
      operation: 'ghl',
      contactId
    });
    throw error;
  }
}

export async function syncUserWithGHL(userId: string): Promise<void> {
  try {
    const onboarding = await prisma.userOnboarding.findUnique({
      where: { userId },
      include: { partner: true }
    });

    if (!onboarding) {
      throw new Error('User onboarding data not found');
    }

    // Get customer record
    const customer = await prisma.customer.findUnique({
      where: { userId }
    });

    if (!customer || !customer.ghlContactId) {
      throw new Error('Customer GHL contact ID not found. Contact should be created during registration.');
    }

    // Get main GHL credentials
    const mainGhlApiKey = process.env.GOHIGHLEVEL_BEARER_TOKEN;
    const mainGhlUrl = process.env.NEXT_PUBLIC_GOHIGHLEVEL_API_URL;

    if (!mainGhlApiKey || !mainGhlUrl) {
      throw new Error('Main GHL credentials not configured');
    }

    // First update main CRM tags
    logger.info('Updating main CRM tags', {
      operation: 'ghl'
    });
    const mainGhlContactId = customer.ghlContactId;
    const existingContact = await getGHLContact(mainGhlContactId, mainGhlApiKey, mainGhlUrl);
    
    if (!existingContact) {
      throw new Error(`Contact ${mainGhlContactId} not found in main CRM. This should not happen.`);
    }

    // Keep existing tags and add our new ones
    const existingTags = existingContact.contact.tags || [];
    const newTags = [
      ...existingTags,
      'knotie_ai_pro_onboarded_customer',
      onboarding.partnerId 
        ? `knotie_ai_pro_onboarded_with_${onboarding.partnerId}`
        : 'knotie_ai_pro_onboarded_no_partner_associated'
    ];

    // Remove duplicates using Array.from
    const uniqueTags = Array.from(new Set(newTags));

    // Update only tags in main CRM
    await updateGHLContact(
      mainGhlContactId,
      { tags: uniqueTags } as GHLContact,
      mainGhlApiKey,
      mainGhlUrl,
      true // tagsOnly=true for main CRM update
    );

    // Then handle partner CRM if partnerId exists
    if (onboarding.partnerId && onboarding.partner?.ghlApiKey) {
      logger.info('Creating contact in partner CRM', {
        operation: 'ghl',
        partnerId: onboarding.partnerId
      });
      
      // Decrypt partner's GHL API key
      const decryptedGhlApiKey = await prepareApiKey(onboarding.partner.ghlApiKey);

      // Create contact data for partner CRM
      const partnerContactData: GHLContact = {
        email: onboarding.email,
        firstName: onboarding.firstName || '',
        lastName: onboarding.lastName || '',
        ...(onboarding.companyName && { companyName: onboarding.companyName }),
        ...(onboarding.businessPhone && { phone: onboarding.businessPhone }),
        tags: ['knotie_ai_pro_onboarded_customer']
      };

      try {
        // Check if partner contact already exists for this user
        const existingCustomer = await prisma.customer.findUnique({
          where: { userId },
          select: { partnerGhlContactId: true }
        });

        if (!existingCustomer?.partnerGhlContactId) {
          // Only create new contact in partner's CRM if one doesn't exist
          const newPartnerGhlContactId = await createGHLContact(
            partnerContactData,
            decryptedGhlApiKey,
            mainGhlUrl
          );

          // Update customer record with partner's GHL contact ID
          await prisma.customer.update({
            where: { userId },
            data: { 
              partnerGhlContactId: newPartnerGhlContactId,
              isGhlSynced: true,
              ghlSyncedAt: new Date()
            }
          });
        }
      } catch (error) {
        logger.error('Error creating contact in partner CRM', error as Error, {
          operation: 'ghl',
          partnerId: onboarding.partnerId
        });
        throw error; // Throw the error since partner CRM creation is important
      }
    } else {
      // Update sync status for non-partner case
      await prisma.customer.update({
        where: { userId },
        data: {
          isGhlSynced: true,
          ghlSyncedAt: new Date()
        }
      });
    }
  } catch (error) {
    logger.error('Error in syncUserWithGHL', error as Error, {
      operation: 'ghl',
      userId
    });
    throw error;
  }
}
