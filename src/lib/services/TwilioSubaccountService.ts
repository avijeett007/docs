/**
 * TwilioSubaccountService
 * 
 * Manages Twilio subaccount creation and regulatory compliance operations
 * for the Phone Activation feature. Uses the platform's master Twilio credentials
 * to create and manage subaccounts for partners (and future: customers).
 */

import { initTwilioClient, TwilioClient } from '@/lib/twilio';
import { encrypt, decrypt } from '@/lib/encryption';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface CreateSubaccountResult {
  subaccountSid: string;
  encryptedAuthToken: string;
}

export interface CreateAddressParams {
  customerName: string;
  street: string;
  city: string;
  region: string;
  postalCode: string;
  isoCountry: string;
  friendlyName?: string;
}

export interface CreateEndUserParams {
  friendlyName: string;
  type: string; // 'individual' or 'business'
  attributes: Record<string, string>;
}

export interface UploadSupportingDocParams {
  friendlyName: string;
  type: string;
  mimeType: string;
  attributes?: Record<string, string>;
}

export interface CreateBundleParams {
  friendlyName: string;
  email: string;
  isoCountry: string;
  numberType?: string; // 'local', 'mobile', 'toll-free'
  endUserType?: string; // 'individual' or 'business'
}

export class TwilioSubaccountService {
  private masterClient: TwilioClient;

  constructor() {
    this.masterClient = initTwilioClient();
  }

  /**
   * Create a Twilio subaccount for a partner's phone activation
   */
  async createSubaccount(activationId: string, businessName: string): Promise<CreateSubaccountResult> {
    const friendlyName = `PhoneActivation - ${businessName}`;

    logger.info('Creating Twilio subaccount for phone activation', {
      operation: 'phone_activation_subaccount',
      activationId,
      friendlyName
    });

    const subaccount = await this.masterClient.createSubaccount(friendlyName);
    const encryptedAuthToken = await encrypt(subaccount.auth_token);

    // Update the activation record
    await prisma.phoneServiceActivation.update({
      where: { id: activationId },
      data: {
        twilioSubaccountSid: subaccount.sid,
        twilioSubaccountAuthToken: encryptedAuthToken,
      },
    });

    logger.info('Twilio subaccount created successfully', {
      operation: 'phone_activation_subaccount',
      activationId,
      subaccountSid: subaccount.sid
    });

    return {
      subaccountSid: subaccount.sid,
      encryptedAuthToken,
    };
  }

  /**
   * Get a TwilioClient for a subaccount using stored encrypted credentials
   */
  async getSubaccountClient(activationId: string): Promise<TwilioClient> {
    const activation = await prisma.phoneServiceActivation.findUnique({
      where: { id: activationId },
      select: {
        twilioSubaccountSid: true,
        twilioSubaccountAuthToken: true,
      },
    });

    if (!activation?.twilioSubaccountSid || !activation?.twilioSubaccountAuthToken) {
      throw new Error('Activation does not have a Twilio subaccount');
    }

    const authToken = await decrypt(activation.twilioSubaccountAuthToken);

    return new TwilioClient({
      accountSid: activation.twilioSubaccountSid,
      authToken,
    });
  }

  /**
   * Create an address in the subaccount for regulatory compliance
   */
  async createAddress(activationId: string, params: CreateAddressParams): Promise<string> {
    logger.info('Creating address for phone activation', {
      operation: 'phone_activation_address',
      activationId,
      country: params.isoCountry
    });

    const subClient = await this.getSubaccountClient(activationId);
    const address = await subClient.createAddress({
      CustomerName: params.customerName,
      Street: params.street,
      City: params.city,
      Region: params.region,
      PostalCode: params.postalCode,
      IsoCountry: params.isoCountry,
      FriendlyName: params.friendlyName || `${params.customerName} - ${params.isoCountry}`,
    });

    // Update activation record
    await prisma.phoneServiceActivation.update({
      where: { id: activationId },
      data: { twilioAddressSid: address.sid },
    });

    logger.info('Address created successfully', {
      operation: 'phone_activation_address',
      activationId,
      addressSid: address.sid
    });

    return address.sid;
  }

  /**
   * Create an end-user resource in the subaccount for regulatory bundle
   * Uses the Numbers API v2 endpoint
   */
  async createEndUser(activationId: string, params: CreateEndUserParams): Promise<string> {
    logger.info('Creating end user for phone activation', {
      operation: 'phone_activation_end_user',
      activationId,
      type: params.type
    });

    const activation = await prisma.phoneServiceActivation.findUnique({
      where: { id: activationId },
      select: { twilioSubaccountSid: true, twilioSubaccountAuthToken: true },
    });

    if (!activation?.twilioSubaccountSid || !activation?.twilioSubaccountAuthToken) {
      throw new Error('Activation does not have a Twilio subaccount');
    }

    const authToken = await decrypt(activation.twilioSubaccountAuthToken);
    const auth = Buffer.from(`${activation.twilioSubaccountSid}:${authToken}`).toString('base64');

    // End Users are created via the Numbers API v2
    const url = 'https://numbers.twilio.com/v2/RegulatoryCompliance/EndUsers';
    const body = new URLSearchParams({
      FriendlyName: params.friendlyName,
      Type: params.type,
      ...Object.fromEntries(
        Object.entries(params.attributes).map(([k, v]) => [`Attributes.${k}`, v])
      ),
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Twilio End User creation failed: ${response.status} - ${errorText}`);
    }

    const endUser = await response.json();

    await prisma.phoneServiceActivation.update({
      where: { id: activationId },
      data: { twilioEndUserSid: endUser.sid },
    });

    logger.info('End user created successfully', {
      operation: 'phone_activation_end_user',
      activationId,
      endUserSid: endUser.sid
    });

    return endUser.sid;
  }

  /**
   * Update an existing end-user resource in the subaccount
   * Used when retrying/resubmitting with updated attributes (e.g. business registration details)
   */
  async updateEndUser(activationId: string, endUserSid: string, params: CreateEndUserParams): Promise<void> {
    logger.info('Updating end user for phone activation', {
      operation: 'phone_activation_end_user_update',
      activationId,
      endUserSid,
      type: params.type
    });

    const activation = await prisma.phoneServiceActivation.findUnique({
      where: { id: activationId },
      select: { twilioSubaccountSid: true, twilioSubaccountAuthToken: true },
    });

    if (!activation?.twilioSubaccountSid || !activation?.twilioSubaccountAuthToken) {
      throw new Error('Activation does not have a Twilio subaccount');
    }

    const authToken = await decrypt(activation.twilioSubaccountAuthToken);
    const auth = Buffer.from(`${activation.twilioSubaccountSid}:${authToken}`).toString('base64');

    const url = `https://numbers.twilio.com/v2/RegulatoryCompliance/EndUsers/${endUserSid}`;
    const body = new URLSearchParams({
      FriendlyName: params.friendlyName,
      Type: params.type,
      ...Object.fromEntries(
        Object.entries(params.attributes).map(([k, v]) => [`Attributes.${k}`, v])
      ),
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Twilio End User update failed: ${response.status} - ${errorText}`);
    }

    logger.info('End user updated successfully', {
      operation: 'phone_activation_end_user_update',
      activationId,
      endUserSid
    });
  }

  /**
   * Create a Supporting Document of type 'business_address' that wraps an address SID.
   * This is required by regulations (e.g. UK Mobile Business) that need a business_address
   * supporting document referencing the address, rather than a file-based document.
   */
  async createAddressSupportingDocument(
    activationId: string,
    addressSid: string,
    friendlyName: string
  ): Promise<string> {
    logger.info('Creating business_address supporting document', {
      operation: 'phone_activation_address_doc',
      activationId,
      addressSid
    });

    const activation = await prisma.phoneServiceActivation.findUnique({
      where: { id: activationId },
      select: { twilioSubaccountSid: true, twilioSubaccountAuthToken: true },
    });

    if (!activation?.twilioSubaccountSid || !activation?.twilioSubaccountAuthToken) {
      throw new Error('Activation does not have a Twilio subaccount');
    }

    const authToken = await decrypt(activation.twilioSubaccountAuthToken);
    const auth = Buffer.from(`${activation.twilioSubaccountSid}:${authToken}`).toString('base64');

    const url = 'https://numbers.twilio.com/v2/RegulatoryCompliance/SupportingDocuments';
    const body = new URLSearchParams({
      FriendlyName: friendlyName,
      Type: 'business_address',
      'Attributes.address_sids': addressSid,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Twilio business_address Supporting Document creation failed: ${response.status} - ${errorText}`);
    }

    const doc = await response.json();

    // Store the SID in the supporting doc SIDs array
    const existingSids = await prisma.phoneServiceActivation.findUnique({
      where: { id: activationId },
      select: { twilioSupportingDocSids: true },
    });
    const sids = (existingSids?.twilioSupportingDocSids as string[]) || [];
    sids.push(doc.sid);

    await prisma.phoneServiceActivation.update({
      where: { id: activationId },
      data: { twilioSupportingDocSids: sids },
    });

    logger.info('Business address supporting document created successfully', {
      operation: 'phone_activation_address_doc',
      activationId,
      docSid: doc.sid
    });

    return doc.sid;
  }

  /**
   * Upload a supporting document to Twilio for regulatory compliance
   * Uses the Numbers API v2 endpoint
   */
  async uploadSupportingDocument(
    activationId: string,
    params: UploadSupportingDocParams,
    fileBuffer: Buffer,
    fileName: string
  ): Promise<string> {
    logger.info('Uploading supporting document for phone activation', {
      operation: 'phone_activation_document',
      activationId,
      docType: params.type,
      fileName
    });

    const activation = await prisma.phoneServiceActivation.findUnique({
      where: { id: activationId },
      select: { twilioSubaccountSid: true, twilioSubaccountAuthToken: true },
    });

    if (!activation?.twilioSubaccountSid || !activation?.twilioSubaccountAuthToken) {
      throw new Error('Activation does not have a Twilio subaccount');
    }

    const authToken = await decrypt(activation.twilioSubaccountAuthToken);
    const auth = Buffer.from(`${activation.twilioSubaccountSid}:${authToken}`).toString('base64');

    // Supporting Documents are created via the Numbers API v2
    const url = 'https://numbers.twilio.com/v2/RegulatoryCompliance/SupportingDocuments';

    // Use FormData for file upload
    const formData = new FormData();
    formData.append('FriendlyName', params.friendlyName);
    formData.append('Type', params.type);
    formData.append('File', new Blob([new Uint8Array(fileBuffer)]), fileName);
    if (params.attributes) {
      for (const [key, value] of Object.entries(params.attributes)) {
        formData.append(`Attributes.${key}`, value);
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Twilio Supporting Document upload failed: ${response.status} - ${errorText}`);
    }

    const doc = await response.json();

    // Append to the supporting doc SIDs array
    const currentDocs = activation as any;
    const existingSids = await prisma.phoneServiceActivation.findUnique({
      where: { id: activationId },
      select: { twilioSupportingDocSids: true },
    });
    const sids = (existingSids?.twilioSupportingDocSids as string[]) || [];
    sids.push(doc.sid);

    await prisma.phoneServiceActivation.update({
      where: { id: activationId },
      data: { twilioSupportingDocSids: sids },
    });

    logger.info('Supporting document uploaded successfully', {
      operation: 'phone_activation_document',
      activationId,
      docSid: doc.sid
    });

    return doc.sid;
  }

  /**
   * Create a regulatory bundle in the subaccount
   */
  async createRegulatoryBundle(activationId: string, params: CreateBundleParams): Promise<string> {
    logger.info('Creating regulatory bundle for phone activation', {
      operation: 'phone_activation_bundle',
      activationId,
      country: params.isoCountry,
      numberType: params.numberType
    });

    const activation = await prisma.phoneServiceActivation.findUnique({
      where: { id: activationId },
      select: { twilioSubaccountSid: true, twilioSubaccountAuthToken: true },
    });

    if (!activation?.twilioSubaccountSid || !activation?.twilioSubaccountAuthToken) {
      throw new Error('Activation does not have a Twilio subaccount');
    }

    const authToken = await decrypt(activation.twilioSubaccountAuthToken);
    const auth = Buffer.from(`${activation.twilioSubaccountSid}:${authToken}`).toString('base64');

    const url = 'https://numbers.twilio.com/v2/RegulatoryCompliance/Bundles';
    const bodyParams: Record<string, string> = {
      FriendlyName: params.friendlyName,
      Email: params.email,
      IsoCountry: params.isoCountry,
      StatusCallback: `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || ''}/api/webhooks/twilio/regulatory-bundle`,
    };
    if (params.numberType) bodyParams.NumberType = params.numberType;
    if (params.endUserType) bodyParams.EndUserType = params.endUserType;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(bodyParams).toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Twilio Regulatory Bundle creation failed: ${response.status} - ${errorText}`);
    }

    const bundle = await response.json();

    await prisma.phoneServiceActivation.update({
      where: { id: activationId },
      data: {
        regulatoryBundleSid: bundle.sid,
        regulatoryBundleStatus: 'draft',
        regulatoryBundleType: params.numberType || null,
      },
    });

    logger.info('Regulatory bundle created successfully', {
      operation: 'phone_activation_bundle',
      activationId,
      bundleSid: bundle.sid
    });

    return bundle.sid;
  }

  /**
   * Assign an item (end user, address, or supporting doc) to a regulatory bundle
   */
  async assignItemToBundle(activationId: string, bundleSid: string, objectSid: string): Promise<void> {
    logger.info('Assigning item to regulatory bundle', {
      operation: 'phone_activation_bundle_assign',
      activationId,
      bundleSid,
      objectSid
    });

    const activation = await prisma.phoneServiceActivation.findUnique({
      where: { id: activationId },
      select: { twilioSubaccountSid: true, twilioSubaccountAuthToken: true },
    });

    if (!activation?.twilioSubaccountSid || !activation?.twilioSubaccountAuthToken) {
      throw new Error('Activation does not have a Twilio subaccount');
    }

    const authToken = await decrypt(activation.twilioSubaccountAuthToken);
    const auth = Buffer.from(`${activation.twilioSubaccountSid}:${authToken}`).toString('base64');

    const url = `https://numbers.twilio.com/v2/RegulatoryCompliance/Bundles/${bundleSid}/ItemAssignments`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ ObjectSid: objectSid }).toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Twilio Bundle Item Assignment failed: ${response.status} - ${errorText}`);
    }

    logger.info('Item assigned to bundle successfully', {
      operation: 'phone_activation_bundle_assign',
      activationId,
      bundleSid,
      objectSid
    });
  }

  /**
   * Submit a regulatory bundle for review
   */
  async submitBundle(activationId: string, bundleSid: string): Promise<void> {
    logger.info('Submitting regulatory bundle for review', {
      operation: 'phone_activation_bundle_submit',
      activationId,
      bundleSid
    });

    const activation = await prisma.phoneServiceActivation.findUnique({
      where: { id: activationId },
      select: { twilioSubaccountSid: true, twilioSubaccountAuthToken: true },
    });

    if (!activation?.twilioSubaccountSid || !activation?.twilioSubaccountAuthToken) {
      throw new Error('Activation does not have a Twilio subaccount');
    }

    const authToken = await decrypt(activation.twilioSubaccountAuthToken);
    const auth = Buffer.from(`${activation.twilioSubaccountSid}:${authToken}`).toString('base64');

    const url = `https://numbers.twilio.com/v2/RegulatoryCompliance/Bundles/${bundleSid}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ Status: 'pending-review' }).toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Twilio Bundle submission failed: ${response.status} - ${errorText}`);
    }

    await prisma.phoneServiceActivation.update({
      where: { id: activationId },
      data: {
        regulatoryBundleStatus: 'pending_review',
        status: 'pending_review',
        submittedAt: new Date(),
      },
    });

    logger.info('Regulatory bundle submitted for review', {
      operation: 'phone_activation_bundle_submit',
      activationId,
      bundleSid
    });
  }

  /**
   * Get the current status of a regulatory bundle
   */
  async getBundleStatus(activationId: string, bundleSid: string): Promise<string> {
    const activation = await prisma.phoneServiceActivation.findUnique({
      where: { id: activationId },
      select: { twilioSubaccountSid: true, twilioSubaccountAuthToken: true },
    });

    if (!activation?.twilioSubaccountSid || !activation?.twilioSubaccountAuthToken) {
      throw new Error('Activation does not have a Twilio subaccount');
    }

    const authToken = await decrypt(activation.twilioSubaccountAuthToken);
    const auth = Buffer.from(`${activation.twilioSubaccountSid}:${authToken}`).toString('base64');

    const url = `https://numbers.twilio.com/v2/RegulatoryCompliance/Bundles/${bundleSid}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Twilio Bundle status check failed: ${response.status} - ${errorText}`);
    }

    const bundle = await response.json();
    return bundle.status;
  }
}

