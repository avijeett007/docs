import twilio from 'twilio';
import crypto from 'crypto';
import { logger } from '@/lib/logger';

export interface RetellSipConfig {
  sipTrunkSid: string;
  originationUri: string;
  phoneNumberSid: string;
  terminationUri?: string;       // The trunk's domainName (e.g., "xxx.pstn.twilio.com") for outbound calls
  authUsername?: string;          // SIP credential username for termination authentication
  authPassword?: string;          // SIP credential password for termination authentication
  credentialListSid?: string;     // Twilio Credential List SID for cleanup/reference
}

export interface TwilioCredentials {
  accountSid: string;
  authToken: string;
}

export class RetellSipService {
  private client: twilio.Twilio;
  private accountSid: string;

  constructor(credentials: TwilioCredentials) {
    this.client = twilio(credentials.accountSid, credentials.authToken);
    this.accountSid = credentials.accountSid;
  }

  // Password format components for SIP credentials (not secrets themselves)
  private static readonly SIP_PW_PREFIX = 'Kn';
  private static readonly SIP_PW_SUFFIX = '1!';

  /**
   * Generate a secure SIP credential username and password
   * Username: alphanumeric, 3-32 chars
   * Password: min 12 chars, must include upper, lower, digit, and special chars
   */
  private generateSipCredentials(): { username: string; password: string } {
    const username = `knotie_${crypto.randomBytes(8).toString('hex')}`;
    // Build password: prefix (upper+lower) + random base64url + suffix (digit+special)
    const randomPart = crypto.randomBytes(12).toString('base64url');
    const parts = [RetellSipService.SIP_PW_PREFIX, randomPart, RetellSipService.SIP_PW_SUFFIX];
    return { username, password: parts.join('') };
  }

  /**
   * Find an existing SIP Credential List by friendly name.
   * Returns the credential list or null if not found.
   */
  private async findCredentialListByName(name: string): Promise<{ sid: string; friendlyName: string } | null> {
    try {
      const allLists = await this.client.sip.credentialLists.list();
      const match = allLists.find(cl => cl.friendlyName === name);
      return match ? { sid: match.sid, friendlyName: match.friendlyName } : null;
    } catch (error: any) {
      logger.warn('Error listing credential lists', {
        operation: 'retell_sip_service',
        error: error.message
      });
      return null;
    }
  }

  /**
   * Find an existing IP Access Control List by friendly name.
   * Returns the ACL or null if not found.
   */
  private async findIpAclByName(name: string): Promise<{ sid: string; friendlyName: string } | null> {
    try {
      const allAcls = await this.client.sip.ipAccessControlLists.list();
      const match = allAcls.find(acl => acl.friendlyName === name);
      return match ? { sid: match.sid, friendlyName: match.friendlyName } : null;
    } catch (error: any) {
      logger.warn('Error listing IP ACLs', {
        operation: 'retell_sip_service',
        error: error.message
      });
      return null;
    }
  }

  /**
   * Ensure a credential list is associated with a SIP trunk (idempotent).
   * If already associated, this is a no-op.
   */
  private async ensureCredentialListAssociation(sipTrunkSid: string, credentialListSid: string): Promise<void> {
    try {
      // Check if already associated
      const existing = await this.client.trunking.v1.trunks(sipTrunkSid).credentialsLists.list();
      const alreadyAssociated = existing.some(cl => cl.sid === credentialListSid);
      if (alreadyAssociated) {
        logger.info('Credential list already associated with trunk', {
          operation: 'retell_sip_service',
          sipTrunkSid,
          credentialListSid
        });
        return;
      }

      // Remove any other credential list associations first (trunk should have only our list)
      for (const cl of existing) {
        await this.client.trunking.v1.trunks(sipTrunkSid).credentialsLists(cl.sid).remove();
        logger.info('Removed old credential list association from trunk', {
          operation: 'retell_sip_service',
          sipTrunkSid,
          removedCredentialListSid: cl.sid
        });
      }

      // Create the association
      await this.client.trunking.v1.trunks(sipTrunkSid).credentialsLists.create({
        credentialListSid
      });
      logger.info('Associated credential list with trunk', {
        operation: 'retell_sip_service',
        sipTrunkSid,
        credentialListSid
      });
    } catch (error: any) {
      // If it fails with "already exists" type error, that's fine
      if (error.message?.includes('already') || error.code === 50300) {
        logger.info('Credential list association already exists (caught error)', {
          operation: 'retell_sip_service',
          sipTrunkSid,
          credentialListSid
        });
        return;
      }
      throw error;
    }
  }

  /**
   * Ensure an IP ACL is associated with a SIP trunk (idempotent).
   * If already associated, this is a no-op.
   */
  private async ensureIpAclAssociation(sipTrunkSid: string, ipAclSid: string): Promise<void> {
    try {
      // Check if already associated
      const existing = await this.client.trunking.v1.trunks(sipTrunkSid).ipAccessControlLists.list();
      const alreadyAssociated = existing.some(acl => acl.sid === ipAclSid);
      if (alreadyAssociated) {
        logger.info('IP ACL already associated with trunk', {
          operation: 'retell_sip_service',
          sipTrunkSid,
          ipAclSid
        });
        return;
      }

      // Remove any other IP ACL associations first (trunk should have only our ACL)
      for (const acl of existing) {
        await this.client.trunking.v1.trunks(sipTrunkSid).ipAccessControlLists(acl.sid).remove();
        logger.info('Removed old IP ACL association from trunk', {
          operation: 'retell_sip_service',
          sipTrunkSid,
          removedIpAclSid: acl.sid
        });
      }

      // Create the association
      await this.client.trunking.v1.trunks(sipTrunkSid).ipAccessControlLists.create({
        ipAccessControlListSid: ipAclSid
      });
      logger.info('Associated IP ACL with trunk', {
        operation: 'retell_sip_service',
        sipTrunkSid,
        ipAclSid
      });
    } catch (error: any) {
      // If it fails with "already exists" type error, that's fine
      if (error.message?.includes('already') || error.code === 50300) {
        logger.info('IP ACL association already exists (caught error)', {
          operation: 'retell_sip_service',
          sipTrunkSid,
          ipAclSid
        });
        return;
      }
      throw error;
    }
  }

  /**
   * Set up termination (outbound) configuration on a SIP trunk (IDEMPOTENT).
   *
   * This method is safe to call multiple times for the same phone number.
   * It will find-or-create credential lists and IP ACLs, and ensure they
   * are properly associated with the trunk.
   *
   * Steps:
   * 1. Find or create a SIP Credential List for this phone number
   * 2. Clear old credentials and add fresh ones (we always need the password)
   * 3. Find or create an IP Access Control List for this phone number
   * 4. Ensure IP ranges are configured in the ACL
   * 5. Ensure credential list is associated with the trunk
   * 6. Ensure IP ACL is associated with the trunk
   *
   * Returns the credentials and credential list SID
   */
  async setupTermination(sipTrunkSid: string, phoneNumber: string): Promise<{
    credentialListSid: string;
    authUsername: string;
    authPassword: string;
  }> {
    const { username, password } = this.generateSipCredentials();
    const credListName = `Retell-Creds-${phoneNumber}`;
    const aclName = `Retell-ACL-${phoneNumber}`;

    logger.info('Setting up termination for SIP trunk (idempotent)', {
      operation: 'retell_sip_service',
      sipTrunkSid,
      phoneNumber
    });

    // Step 1: Find or create Credential List
    let credentialListSid: string;
    const existingCredList = await this.findCredentialListByName(credListName);

    if (existingCredList) {
      credentialListSid = existingCredList.sid;
      logger.info('Found existing credential list, reusing', {
        operation: 'retell_sip_service',
        credentialListSid,
        credListName
      });

      // Clear existing credentials so we can add fresh ones
      try {
        const existingCreds = await this.client.sip.credentialLists(credentialListSid).credentials.list();
        for (const cred of existingCreds) {
          await this.client.sip.credentialLists(credentialListSid).credentials(cred.sid).remove();
        }
        logger.info('Cleared old credentials from existing list', {
          operation: 'retell_sip_service',
          credentialListSid,
          clearedCount: existingCreds.length
        });
      } catch (error: any) {
        logger.warn('Error clearing old credentials, continuing', {
          operation: 'retell_sip_service',
          credentialListSid,
          error: error.message
        });
      }
    } else {
      // Create new credential list
      const newCredList = await this.client.sip.credentialLists.create({
        friendlyName: credListName
      });
      credentialListSid = newCredList.sid;
      logger.info('Created new SIP credential list', {
        operation: 'retell_sip_service',
        credentialListSid,
        credListName
      });
    }

    // Step 2: Add fresh credentials to the credential list
    await this.client.sip.credentialLists(credentialListSid)
      .credentials.create({
        username,
        password
      });

    logger.info('Added fresh credentials to credential list', {
      operation: 'retell_sip_service',
      credentialListSid,
      username
    });

    // Step 3: Find or create IP Access Control List
    let ipAclSid: string;
    const existingAcl = await this.findIpAclByName(aclName);

    if (existingAcl) {
      ipAclSid = existingAcl.sid;
      logger.info('Found existing IP ACL, reusing', {
        operation: 'retell_sip_service',
        ipAclSid,
        aclName
      });
    } else {
      // Create new IP ACL
      const newAcl = await this.client.sip.ipAccessControlLists.create({
        friendlyName: aclName
      });
      ipAclSid = newAcl.sid;
      logger.info('Created new IP Access Control List', {
        operation: 'retell_sip_service',
        ipAclSid,
        aclName
      });

      // Add IP address ranges to the ACL (only for newly created ACLs)
      // 0.0.0.0/1 covers 0.0.0.0 - 127.255.255.255
      await this.client.sip.ipAccessControlLists(ipAclSid)
        .ipAddresses.create({
          friendlyName: 'Retell-AllIPs-Lower',
          ipAddress: '0.0.0.0',
          cidrPrefixLength: 1
        });

      // 128.0.0.0/1 covers 128.0.0.0 - 255.255.255.255
      await this.client.sip.ipAccessControlLists(ipAclSid)
        .ipAddresses.create({
          friendlyName: 'Retell-AllIPs-Upper',
          ipAddress: '128.0.0.0',
          cidrPrefixLength: 1
        });

      logger.info('Added IP address ranges to new ACL', {
        operation: 'retell_sip_service',
        ipAclSid
      });
    }

    // Step 4: Ensure credential list is associated with the trunk (idempotent)
    await this.ensureCredentialListAssociation(sipTrunkSid, credentialListSid);

    // Step 5: Ensure IP ACL is associated with the trunk (idempotent)
    await this.ensureIpAclAssociation(sipTrunkSid, ipAclSid);

    logger.info('Termination setup complete', {
      operation: 'retell_sip_service',
      sipTrunkSid,
      credentialListSid,
      ipAclSid,
      username
    });

    return {
      credentialListSid,
      authUsername: username,
      authPassword: password
    };
  }

  /**
   * Check if a phone number has an existing SIP trunk configuration
   */
  async checkExistingSipTrunk(phoneNumberSid: string): Promise<RetellSipConfig | null> {
    try {
      logger.info('Checking existing SIP trunk for phone number', {
        operation: 'retell_sip_service',
        phoneNumberSid
      });

      // Get the phone number resource to check its configuration
      const phoneNumber = await this.client.incomingPhoneNumbers(phoneNumberSid).fetch();
      
      if (phoneNumber.trunkSid) {
        logger.info('Found existing trunk', {
          operation: 'retell_sip_service',
          trunkSid: phoneNumber.trunkSid,
          phoneNumberSid
        });

        // Get the trunk details
        const trunk = await this.client.trunking.v1.trunks(phoneNumber.trunkSid).fetch();

        // Get origination URLs to check current configuration
        const originationUrls = await this.client.trunking.v1.trunks(phoneNumber.trunkSid)
          .originationUrls.list();

        const currentOriginationUri = originationUrls.length > 0 ? originationUrls[0].sipUrl : '';

        // Check for existing credential lists (termination config)
        let credentialListSid: string | undefined;
        try {
          const credentialLists = await this.client.trunking.v1.trunks(phoneNumber.trunkSid)
            .credentialsLists.list();
          if (credentialLists.length > 0) {
            credentialListSid = credentialLists[0].sid;
          }
        } catch (err) {
          logger.warn('Could not fetch credential lists for trunk', {
            operation: 'retell_sip_service',
            trunkSid: phoneNumber.trunkSid
          });
        }

        return {
          sipTrunkSid: trunk.sid,
          originationUri: currentOriginationUri,
          phoneNumberSid: phoneNumberSid,
          terminationUri: trunk.domainName || undefined,
          credentialListSid,
        };
      }

      logger.info('No existing SIP trunk found for phone number', {
        operation: 'retell_sip_service',
        phoneNumberSid
      });
      return null;

    } catch (error: any) {
      // Handle 404 errors gracefully - phone number doesn't exist in this Twilio account
      if (error.status === 404 || error.code === 20404) {
        logger.warn('Phone number not found in Twilio account - no existing SIP trunk', {
          operation: 'retell_sip_service',
          phoneNumberSid,
          error: error.message
        });
        return null; // No existing SIP trunk if phone number doesn't exist
      }

      logger.error('Error checking existing SIP trunk', error as Error, {
        operation: 'retell_sip_service',
        phoneNumberSid
      });
      throw new Error(`Failed to check existing SIP trunk: ${error.message}`);
    }
  }

  /**
   * Create a new SIP trunk configured for Retell with both origination (inbound) and termination (outbound)
   *
   * For outbound calls, Retell needs:
   * 1. A termination URI (the trunk's domainName ending with .pstn.twilio.com)
   * 2. SIP authentication credentials (username/password)
   *
   * This method:
   * - Creates a SIP trunk with a unique domainName
   * - Sets up origination URL pointing to sip.retellai.com (for inbound)
   * - Creates a SIP Credential List with username/password (for outbound authentication)
   * - Associates the credential list with the trunk
   * - Assigns the phone number to the trunk
   */
  async createSipTrunkForRetell(phoneNumberSid: string, phoneNumber: string): Promise<RetellSipConfig> {
    try {
      logger.info('Creating SIP trunk for Retell', {
        operation: 'retell_sip_service',
        phoneNumber
      });

      // Generate a unique domain name for the trunk ending with .pstn.twilio.com
      // This is required for termination (outbound calls)
      const sanitizedNumber = phoneNumber.replace(/[^a-zA-Z0-9]/g, '');
      const uniqueSuffix = crypto.randomBytes(4).toString('hex');
      const domainName = `knotie-${sanitizedNumber}-${uniqueSuffix}.pstn.twilio.com`;

      // Create SIP trunk with a specific domainName for termination
      const trunk = await this.client.trunking.v1.trunks.create({
        friendlyName: `Retell-${phoneNumber}`,
        domainName: domainName,
      });

      logger.info('Created SIP trunk', {
        operation: 'retell_sip_service',
        trunkSid: trunk.sid,
        domainName: trunk.domainName
      });

      // Create origination URL for the trunk (INBOUND: Twilio → Retell)
      await this.client.trunking.v1.trunks(trunk.sid)
        .originationUrls.create({
          friendlyName: `Retell-Origination-${phoneNumber}`,
          sipUrl: 'sip:sip.retellai.com',
          enabled: true,
          priority: 10,
          weight: 10
        });

      logger.info('Created origination URL for trunk', {
        operation: 'retell_sip_service',
        trunkSid: trunk.sid
      });

      // Set up termination (OUTBOUND: Retell → Twilio) with credential list
      const terminationConfig = await this.setupTermination(trunk.sid, phoneNumber);

      logger.info('Set up termination for trunk', {
        operation: 'retell_sip_service',
        trunkSid: trunk.sid,
        credentialListSid: terminationConfig.credentialListSid
      });

      // Assign the phone number to the trunk
      await this.client.incomingPhoneNumbers(phoneNumberSid).update({
        trunkSid: trunk.sid
      });

      logger.info('Assigned phone number to trunk', {
        operation: 'retell_sip_service',
        phoneNumberSid,
        trunkSid: trunk.sid
      });

      return {
        sipTrunkSid: trunk.sid,
        originationUri: 'sip:sip.retellai.com',
        phoneNumberSid: phoneNumberSid,
        terminationUri: trunk.domainName,
        authUsername: terminationConfig.authUsername,
        authPassword: terminationConfig.authPassword,
        credentialListSid: terminationConfig.credentialListSid,
      };

    } catch (error: any) {
      // Handle 404 errors gracefully - phone number doesn't exist in this Twilio account
      if (error.status === 404 || error.code === 20404) {
        logger.error('Phone number not found in Twilio account - cannot create SIP trunk', error as Error, {
          operation: 'retell_sip_service',
          phoneNumberSid,
          phoneNumber
        });
        throw new Error(`Phone number ${phoneNumber} (${phoneNumberSid}) not found in Twilio account. Please verify the phone number exists and you have the correct credentials.`);
      }

      logger.error('Error creating SIP trunk', error as Error, {
        operation: 'retell_sip_service',
        phoneNumber
      });
      throw new Error(`Failed to create SIP trunk: ${error.message}`);
    }
  }

  /**
   * Update an existing SIP trunk to point to Retell (IDEMPOTENT):
   * - Updates origination URI (inbound)
   * - Sets up termination with credentials (outbound) - idempotent via setupTermination()
   *
   * Safe to call multiple times. Handles reassignment scenarios where the same
   * phone number is unassigned and reassigned to different agents.
   *
   * Returns updated RetellSipConfig with termination info
   */
  async updateSipTrunkForRetell(sipTrunkSid: string, phoneNumber: string): Promise<RetellSipConfig> {
    try {
      logger.info('Updating SIP trunk for Retell (idempotent)', {
        operation: 'retell_sip_service',
        sipTrunkSid,
        phoneNumber
      });

      // Get existing origination URLs
      const originationUrls = await this.client.trunking.v1.trunks(sipTrunkSid)
        .originationUrls.list();

      // Delete existing origination URLs
      for (const url of originationUrls) {
        await this.client.trunking.v1.trunks(sipTrunkSid)
          .originationUrls(url.sid).remove();
        logger.info('Deleted existing origination URL', {
          operation: 'retell_sip_service',
          urlSid: url.sid
        });
      }

      // Create new origination URL for Retell
      await this.client.trunking.v1.trunks(sipTrunkSid)
        .originationUrls.create({
          friendlyName: `Retell-Origination-Updated`,
          sipUrl: 'sip:sip.retellai.com',
          enabled: true,
          priority: 10,
          weight: 10
        });

      logger.info('Updated origination URI for trunk to Retell', {
        operation: 'retell_sip_service',
        sipTrunkSid
      });

      // Fetch the trunk to get its domainName
      const trunk = await this.client.trunking.v1.trunks(sipTrunkSid).fetch();

      // If trunk doesn't have a domainName, set one (needed for termination/outbound)
      let terminationUri = trunk.domainName;
      if (!terminationUri) {
        const sanitizedNumber = phoneNumber.replace(/[^a-zA-Z0-9]/g, '');
        const uniqueSuffix = crypto.randomBytes(4).toString('hex');
        const newDomainName = `knotie-${sanitizedNumber}-${uniqueSuffix}.pstn.twilio.com`;

        await this.client.trunking.v1.trunks(sipTrunkSid).update({
          domainName: newDomainName
        });
        terminationUri = newDomainName;

        logger.info('Set domainName on existing trunk', {
          operation: 'retell_sip_service',
          sipTrunkSid,
          domainName: newDomainName
        });
      }

      // Set up termination (idempotent - handles existing credential lists and IP ACLs)
      const terminationConfig = await this.setupTermination(sipTrunkSid, phoneNumber);

      return {
        sipTrunkSid: sipTrunkSid,
        originationUri: 'sip:sip.retellai.com',
        phoneNumberSid: '', // Not available in this context, will be set by caller
        terminationUri,
        authUsername: terminationConfig.authUsername,
        authPassword: terminationConfig.authPassword,
        credentialListSid: terminationConfig.credentialListSid,
      };

    } catch (error: any) {
      logger.error('Error updating SIP trunk', error as Error, {
        operation: 'retell_sip_service',
        sipTrunkSid
      });
      throw new Error(`Failed to update SIP trunk: ${error.message}`);
    }
  }

  /**
   * Remove SIP trunk configuration from a phone number
   */
  async removeSipTrunk(phoneNumberSid: string, sipTrunkSid: string): Promise<void> {
    try {
      logger.info('Removing SIP trunk configuration', {
        operation: 'retell_sip_service',
        phoneNumberSid,
        sipTrunkSid
      });

      // Remove trunk assignment from phone number
      await this.client.incomingPhoneNumbers(phoneNumberSid).update({
        trunkSid: undefined
      });

      // Delete the trunk
      await this.client.trunking.v1.trunks(sipTrunkSid).remove();

      logger.info('Successfully removed SIP trunk', {
        operation: 'retell_sip_service',
        sipTrunkSid
      });

    } catch (error: any) {
      logger.error('Error removing SIP trunk', error as Error, {
        operation: 'retell_sip_service',
        sipTrunkSid
      });
      throw new Error(`Failed to remove SIP trunk: ${error.message}`);
    }
  }
}
