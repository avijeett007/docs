/**
 * RegulatoryBundleService
 * 
 * Orchestrates the full Phone Activation flow:
 * 1. Create Twilio subaccount
 * 2. Upload documents to Supabase Storage
 * 3. Create address, end user, and supporting documents in Twilio
 * 4. Create regulatory bundle and assign items
 * 5. Submit bundle for review
 * 6. Handle status updates from Twilio webhooks
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { TwilioSubaccountService } from './TwilioSubaccountService';
import type { PhoneActivationAddress, PhoneActivationDocument } from '@/types/partner';

export interface SubmitActivationParams {
  partnerId: string;
  customerId?: string;
  country: string;
  businessName: string;
  businessType?: string;
  businessAddress: PhoneActivationAddress;
  businessRegistrationNumber?: string;
  businessRegistrationAuthority?: string;
  businessWebsite?: string;
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string;
  contactPhone: string;
  documents: PhoneActivationDocument[];
  numberType?: string; // 'local', 'mobile'
}

/**
 * Map country ISO code to Twilio business registration authority value.
 * Twilio uses these to validate business registration numbers.
 */
const COUNTRY_REGISTRATION_AUTHORITY: Record<string, string> = {
  GB: 'UK:CRN',   // Companies Registration Number
  US: 'US:EIN',   // Employer Identification Number
  CA: 'CA:CBN',   // Canadian Business Number
  AU: 'AU:ACN',   // Australian Company Number
  NZ: 'NZ:NZBN',  // New Zealand Business Number
  DE: 'DE:HRB',   // Handelsregister
  FR: 'FR:SIREN', // SIREN number
  IN: 'IN:CIN',   // Corporate Identity Number
  SG: 'SG:UEN',   // Unique Entity Number
  // For countries not listed, use 'OTHER'
};

export class RegulatoryBundleService {
  private twilioSubaccountService: TwilioSubaccountService;

  constructor() {
    this.twilioSubaccountService = new TwilioSubaccountService();
  }

  /**
   * Create a draft activation record
   */
  async createDraft(params: SubmitActivationParams): Promise<string> {
    logger.info('Creating phone activation draft', {
      operation: 'phone_activation',
      partnerId: params.partnerId,
      country: params.country
    });

    // Auto-detect registration authority from country if not provided
    const registrationAuthority = params.businessRegistrationAuthority
      || COUNTRY_REGISTRATION_AUTHORITY[params.country]
      || 'OTHER';

    const activation = await prisma.phoneServiceActivation.create({
      data: {
        partnerId: params.partnerId,
        customerId: params.customerId || null,
        initiatedBy: params.customerId ? 'customer' : 'partner',
        country: params.country,
        businessName: params.businessName,
        businessType: params.businessType || null,
        businessAddress: params.businessAddress as any,
        businessRegistrationNumber: params.businessRegistrationNumber || null,
        businessRegistrationAuthority: registrationAuthority,
        businessWebsite: params.businessWebsite || null,
        contactFirstName: params.contactFirstName,
        contactLastName: params.contactLastName,
        contactEmail: params.contactEmail,
        contactPhone: params.contactPhone,
        documents: params.documents as any,
        regulatoryBundleType: params.numberType || 'mobile',
        status: 'draft',
      },
    });

    logger.info('Phone activation draft created', {
      operation: 'phone_activation',
      activationId: activation.id,
      partnerId: params.partnerId
    });

    return activation.id;
  }

  /**
   * Process and submit the activation - orchestrates the full Twilio flow.
   *
   * IDEMPOTENT: Checks which steps have already been completed (by checking
   * stored SIDs on the activation record) and resumes from where it left off.
   * This allows safe retries after partial failures.
   */
  async processAndSubmit(activationId: string): Promise<void> {
    logger.info('Processing phone activation submission', {
      operation: 'phone_activation',
      activationId
    });

    // Update status to processing
    await prisma.phoneServiceActivation.update({
      where: { id: activationId },
      data: { status: 'processing' },
    });

    const activation = await prisma.phoneServiceActivation.findUnique({
      where: { id: activationId },
      include: { partner: { select: { businessName: true } } },
    });

    if (!activation) {
      throw new Error('Activation not found');
    }

    try {
      // Step 1: Create Twilio subaccount (skip if already exists)
      let subaccountSid = activation.twilioSubaccountSid;
      if (!subaccountSid) {
        const result = await this.twilioSubaccountService.createSubaccount(
          activationId,
          activation.businessName
        );
        subaccountSid = result.subaccountSid;
      } else {
        logger.info('Skipping subaccount creation (already exists)', {
          operation: 'phone_activation',
          activationId,
          subaccountSid
        });
      }

      // Step 2: Create address in subaccount (skip if already exists)
      let addressSid = activation.twilioAddressSid;
      if (!addressSid) {
        const address = activation.businessAddress as unknown as PhoneActivationAddress;
        addressSid = await this.twilioSubaccountService.createAddress(activationId, {
          customerName: activation.businessName,
          street: address.street,
          city: address.city,
          region: address.state,
          postalCode: address.postalCode,
          isoCountry: activation.country,
        });
      } else {
        logger.info('Skipping address creation (already exists)', {
          operation: 'phone_activation',
          activationId,
          addressSid
        });
      }

      // Step 3: Create or update end user
      // Include country-specific attributes for Twilio regulatory compliance
      const endUserType = activation.businessType === 'individual' ? 'individual' : 'business';
      let endUserSid = activation.twilioEndUserSid;

      const endUserAttributes: Record<string, string> = {
        business_name: activation.businessName,
      };
      if (activation.businessType) {
        endUserAttributes.business_type = activation.businessType;
      }
      if (activation.businessRegistrationNumber) {
        endUserAttributes.business_registration_number = activation.businessRegistrationNumber;
      }
      if (activation.businessRegistrationAuthority) {
        endUserAttributes.business_registration_authority = activation.businessRegistrationAuthority;
      }
      if (activation.businessWebsite) {
        endUserAttributes.business_website = activation.businessWebsite;
      }

      if (!endUserSid) {
        endUserSid = await this.twilioSubaccountService.createEndUser(activationId, {
          friendlyName: activation.businessName,
          type: endUserType,
          attributes: endUserAttributes,
        });
      } else {
        // End user already exists — update it with current attributes
        // This ensures new fields (e.g. business_registration_number) are applied on retry
        logger.info('Updating existing end user with current attributes', {
          operation: 'phone_activation',
          activationId,
          endUserSid
        });
        await this.twilioSubaccountService.updateEndUser(activationId, endUserSid, {
          friendlyName: activation.businessName,
          type: endUserType,
          attributes: endUserAttributes,
        });
      }

      // Step 4: Create business_address Supporting Document (skip if already exists)
      // Twilio regulations (e.g. UK Mobile Business) require a Supporting Document of type
      // 'business_address' that wraps the address SID — NOT file-based document uploads.
      const existingDocSids = (activation.twilioSupportingDocSids as string[]) || [];
      const docSids: string[] = [...existingDocSids];

      if (existingDocSids.length === 0) {
        const addressDocSid = await this.twilioSubaccountService.createAddressSupportingDocument(
          activationId,
          addressSid,
          `Business Address - ${activation.businessName}`
        );
        docSids.push(addressDocSid);
      } else {
        logger.info('Skipping supporting document creation (already exists)', {
          operation: 'phone_activation',
          activationId,
          docCount: existingDocSids.length
        });
      }

      // Step 5: Create regulatory bundle (skip if already exists)
      let bundleSid = activation.regulatoryBundleSid;
      if (!bundleSid) {
        bundleSid = await this.twilioSubaccountService.createRegulatoryBundle(activationId, {
          friendlyName: `${activation.businessName} - ${activation.country} Bundle`,
          email: activation.contactEmail || '',
          isoCountry: activation.country,
          numberType: (activation.regulatoryBundleType as string) || 'mobile',
          endUserType,
        });
      } else {
        logger.info('Skipping bundle creation (already exists)', {
          operation: 'phone_activation',
          activationId,
          bundleSid
        });
      }

      // Step 6: Assign items to bundle
      // Note: Addresses (AD SIDs) are NOT valid bundle item assignments.
      // Only End Users and Supporting Documents can be assigned to bundles.
      // The address is stored in twilioAddressSid for use when purchasing phone numbers.
      // We always attempt assignment — Twilio returns 409 if already assigned, which we handle gracefully.

      // Assign end user
      try {
        await this.twilioSubaccountService.assignItemToBundle(activationId, bundleSid, endUserSid);
      } catch (assignError) {
        const errMsg = assignError instanceof Error ? assignError.message : '';
        // 409 Conflict means already assigned — safe to ignore
        if (!errMsg.includes('409')) {
          throw assignError;
        }
        logger.info('End user already assigned to bundle (409), continuing', {
          operation: 'phone_activation',
          activationId,
          bundleSid,
          endUserSid
        });
      }

      // Assign supporting documents
      for (const docSid of docSids) {
        try {
          await this.twilioSubaccountService.assignItemToBundle(activationId, bundleSid, docSid);
        } catch (assignError) {
          const errMsg = assignError instanceof Error ? assignError.message : '';
          if (!errMsg.includes('409')) {
            throw assignError;
          }
          logger.info('Document already assigned to bundle (409), continuing', {
            operation: 'phone_activation',
            activationId,
            bundleSid,
            docSid
          });
        }
      }

      // Step 7: Submit bundle for review (skip if already submitted)
      const alreadySubmitted = activation.regulatoryBundleStatus === 'pending_review'
        || activation.regulatoryBundleStatus === 'in_review'
        || activation.regulatoryBundleStatus === 'twilio_approved';
      if (!alreadySubmitted) {
        await this.twilioSubaccountService.submitBundle(activationId, bundleSid);
      } else {
        logger.info('Skipping bundle submission (already submitted)', {
          operation: 'phone_activation',
          activationId,
          bundleSid,
          currentStatus: activation.regulatoryBundleStatus
        });
      }

      // Update status
      await prisma.phoneServiceActivation.update({
        where: { id: activationId },
        data: {
          status: 'pending_review',
          submittedAt: activation.submittedAt || new Date(),
        },
      });

      logger.info('Phone activation submitted successfully', {
        operation: 'phone_activation',
        activationId,
        subaccountSid,
        bundleSid
      });
    } catch (error) {
      logger.error('Phone activation processing failed', error as Error, {
        operation: 'phone_activation',
        activationId
      });

      await prisma.phoneServiceActivation.update({
        where: { id: activationId },
        data: {
          status: 'rejected',
          rejectionReason: error instanceof Error ? error.message : 'Processing failed',
        },
      });

      throw error;
    }
  }

  /**
   * Handle Twilio webhook for bundle status updates
   */
  async handleBundleStatusUpdate(bundleSid: string, status: string): Promise<void> {
    logger.info('Handling bundle status update', {
      operation: 'phone_activation_webhook',
      bundleSid,
      status
    });

    const activation = await prisma.phoneServiceActivation.findFirst({
      where: { regulatoryBundleSid: bundleSid },
    });

    if (!activation) {
      logger.warn('No activation found for bundle SID', {
        operation: 'phone_activation_webhook',
        bundleSid
      });
      return;
    }

    // Map Twilio status to our status
    const statusMap: Record<string, { bundleStatus: string; activationStatus: string }> = {
      'draft': { bundleStatus: 'draft', activationStatus: 'processing' },
      'pending-review': { bundleStatus: 'pending_review', activationStatus: 'pending_review' },
      'in-review': { bundleStatus: 'in_review', activationStatus: 'pending_review' },
      'twilio-approved': { bundleStatus: 'twilio_approved', activationStatus: 'active' },
      'twilio-rejected': { bundleStatus: 'twilio_rejected', activationStatus: 'rejected' },
    };

    const mapped = statusMap[status];
    if (!mapped) {
      logger.warn('Unknown bundle status from Twilio', {
        operation: 'phone_activation_webhook',
        bundleSid,
        status
      });
      return;
    }

    const updateData: any = {
      regulatoryBundleStatus: mapped.bundleStatus,
      status: mapped.activationStatus,
    };

    if (status === 'twilio-approved') {
      updateData.approvedAt = new Date();
    }

    if (status === 'twilio-rejected') {
      // Try to get rejection reason from Twilio
      try {
        const bundleStatus = await this.twilioSubaccountService.getBundleStatus(
          activation.id,
          bundleSid
        );
        // The full bundle response may contain failure_reason
        updateData.rejectionReason = 'Bundle was rejected by Twilio. Please review your documents and resubmit.';
      } catch {
        updateData.rejectionReason = 'Bundle was rejected by Twilio.';
      }
    }

    await prisma.phoneServiceActivation.update({
      where: { id: activation.id },
      data: updateData,
    });

    logger.info('Bundle status updated', {
      operation: 'phone_activation_webhook',
      activationId: activation.id,
      bundleSid,
      newStatus: mapped.activationStatus
    });
  }

  /**
   * Get activation status for a partner
   */
  async getActivationStatus(partnerId: string, country?: string): Promise<any[]> {
    const where: any = { partnerId };
    if (country) where.country = country;

    return prisma.phoneServiceActivation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        country: true,
        businessName: true,
        status: true,
        regulatoryBundleStatus: true,
        regulatoryBundleType: true,
        rejectionReason: true,
        submittedAt: true,
        approvedAt: true,
        createdAt: true,
        updatedAt: true,
        twilioSubaccountSid: true,
      },
    });
  }

  /**
   * Get a single activation by ID
   */
  async getActivation(activationId: string, partnerId: string): Promise<any> {
    return prisma.phoneServiceActivation.findFirst({
      where: { id: activationId, partnerId },
    });
  }

}

