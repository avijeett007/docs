import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';


import { RetellSipService } from '@/lib/telephony/retell-sip-service';
import { TelnyxSipService } from '@/lib/telephony/telnyx-sip-service';
import { RetellPhoneNumberService } from '@/lib/services/retell/phone-number-service';
import { RetellWebhookManagementService } from '@/lib/services/retell/webhook-management-service';
import { decrypt } from '@/lib/encryption';

// Helper function to resolve customerId for phone number assignments
async function resolveCustomerId(
  phoneNumber: any,
  agent: any,
  partnerId: string,
  tx: any
): Promise<string> {
  // First try to use existing customerId from phone number or agent
  let customerId = phoneNumber.customerId || agent.customerId;

  if (!customerId) {
    // For imported phone numbers without customer assignment, find the first available customer
    // by looking through CustomerCredential table which links customers to partners
    const customerCredential = await tx.customerCredential.findFirst({
      where: {
        partnerId: partnerId,
        status: 'active'
      },
      include: {
        customer: {
          select: { id: true, status: true }
        }
      }
    });

    if (customerCredential && customerCredential.customer && customerCredential.customer.status === 'active') {
      customerId = customerCredential.customer.id;
    } else {
      // If no customer exists, throw an error requiring customer assignment
      throw new Error('No active customer found for this partner. Please assign the phone number to a specific customer first.');
    }
  }

  return customerId;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { phoneNumberId: string } }
) {
  try {
    // Verify partner authentication
    const { payload, isValid } = await verifyPartnerJWT(req);
    if (!isValid || !payload?.partnerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      agentId,
      inboundAgentId,
      outboundAgentId,
      agentProvider,
      assignmentType = 'inbound',
      webhookUrl,
      enableInboundWebhook = true, // Default to true for AI Receptionist functionality
      enableSms = false // SMS support for VAPI agents
    } = await req.json();

    // Validate required fields based on assignment type
    if (assignmentType === 'dual') {
      if (!inboundAgentId || !outboundAgentId || !agentProvider) {
        return NextResponse.json(
          { error: 'Inbound agent ID, outbound agent ID, and provider are required for dual assignment' },
          { status: 400 }
        );
      }
    } else {
      if (!agentId || !agentProvider) {
        return NextResponse.json(
          { error: 'Agent ID and provider are required' },
          { status: 400 }
        );
      }
    }

    const phoneNumberId = params.phoneNumberId;
    const partnerId = payload.partnerId;

    // Get phone number with customer information
    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: {
        id: phoneNumberId,
        partnerId: partnerId
      },
      include: {
        customer: {
          select: {
            id: true,
            twilioSubaccountSid: true,
            twilioSubaccountStatus: true
          }
        }
      }
    }) as (Awaited<ReturnType<typeof prisma.phoneNumber.findFirst>> & { providerLock?: string | null }) | null;

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number not found' },
        { status: 404 }
      );
    }

    // Check if phone number is already assigned to an agent
    const existingMapping = await prisma.agentPhoneMapping.findFirst({
      where: {
        phoneNumberId: phoneNumberId,
        status: 'active'
      }
    });

    if (existingMapping) {
      return NextResponse.json(
        { error: 'Phone number is already assigned to an agent' },
        { status: 400 }
      );
    }

    // Validate agent provider
    if (!['retell', 'vapi', 'knova'].includes(agentProvider)) {
      return NextResponse.json(
        { error: 'Unsupported agent provider. Only Retell, VAPI, and Knova agents are supported' },
        { status: 400 }
      );
    }

    // Validate provider lock: if a phone number is locked to a specific provider,
    // only agents from that provider can be assigned to it
    if (phoneNumber.providerLock) {
      if (phoneNumber.providerLock !== agentProvider) {
        return NextResponse.json(
          {
            error: `This phone number is provider-locked to "${phoneNumber.providerLock}". Only ${phoneNumber.providerLock} agents can be assigned to it.`,
            code: 'PROVIDER_LOCK_MISMATCH',
          },
          { status: 400 }
        );
      }
    }

    // Handle assignment based on provider
    if (agentProvider === 'retell') {
      // Handle dual assignment or single assignment for Retell
      if (assignmentType === 'dual') {
        return await handleRetellDualAssignment(
          phoneNumberId,
          inboundAgentId!,
          outboundAgentId!,
          partnerId,
          phoneNumber,
          webhookUrl,
          enableInboundWebhook
        );
      } else {
        return await handleRetellAssignment(phoneNumberId, agentId!, partnerId, phoneNumber, assignmentType, webhookUrl, enableInboundWebhook);
      }
    } else if (agentProvider === 'vapi') {
      // Handle VAPI assignment
      if (assignmentType === 'dual') {
        return await handleVapiDualAssignment(
          phoneNumberId,
          inboundAgentId!,
          outboundAgentId!,
          partnerId,
          phoneNumber,
          enableSms
        );
      } else {
        return await handleVapiAssignment(phoneNumberId, agentId!, partnerId, phoneNumber, assignmentType, enableSms);
      }
    } else if (agentProvider === 'knova') {
      // Handle Knova assignment - only inbound is supported for now
      return await handleKnovaAssignment(phoneNumberId, agentId!, partnerId, phoneNumber);
    }

  } catch (error: any) {
    logger.error('Error assigning agent to phone number', error, {
      operation: 'assign_agent',
      phoneNumberId: params.phoneNumberId
    });

    // Don't expose detailed server errors to frontend
    let userFriendlyMessage = 'Failed to assign agent to phone number';

    if (error.message?.includes('agent not found')) {
      userFriendlyMessage = 'Selected agent not found or inactive';
    } else if (error.message?.includes('credentials not found')) {
      userFriendlyMessage = 'Phone number configuration is incomplete';
    } else if (error.message?.includes('SIP trunk')) {
      userFriendlyMessage = 'Failed to configure phone routing';
    } else if (error.message?.includes('import phone number') || error.message?.includes('Phone number already exists')) {
      userFriendlyMessage = 'Failed to configure phone number with voice provider';
    }

    return NextResponse.json(
      {
        error: userFriendlyMessage,
        success: false
      },
      { status: 500 }
    );
  }
}

// Handle Retell assignment for partner-owned numbers (backward compatibility)
async function handleRetellAssignment(
  phoneNumberId: string,
  agentId: string,
  partnerId: string,
  phoneNumber: any,
  assignmentType: string = 'inbound',
  webhookUrl?: string,
  enableInboundWebhook: boolean = true
) {

  // This is the original Retell-specific logic for partner numbers
  // We keep this for backward compatibility with existing Retell integrations

  // Start database transaction
  const result = await prisma.$transaction(async (tx) => {
    // Get and validate Retell agent
    const retellAgent = await tx.retellAgent.findFirst({
      where: {
        id: agentId,
        partnerId: partnerId,
        isActive: true
      },
      include: {
        customer: true
      }
    });

    if (!retellAgent) {
      throw new Error('Retell agent not found');
    }

    if (!['imported_twilio', 'imported_telnyx', 'twilio', 'telnyx', 'retell_provider'].includes(phoneNumber.provider)) {
      throw new Error('Only Twilio, Telnyx, and Retell provider numbers can be assigned to Retell agents');
    }

    // If this is a Retell provider number (provider-locked), skip SIP trunk setup
    // as these numbers are managed directly by Retell
    const isRetellProviderNumber = phoneNumber.provider === 'retell_provider';

    if (isRetellProviderNumber) {
      // For Retell provider numbers, SIP trunk setup is not needed.
      // These numbers are already registered in Retell. Just create/update the agent mapping.
      const customerId = await resolveCustomerId(phoneNumber, retellAgent, partnerId, tx);

      // Deactivate existing agent mappings
      await tx.agentPhoneMapping.updateMany({
        where: { phoneNumberId, status: 'active' },
        data: { status: 'inactive', updatedAt: new Date() },
      });

      // Create agent phone mapping for provider-locked number
      await tx.agentPhoneMapping.upsert({
        where: {
          phoneNumberId_agentProvider: { phoneNumberId, agentProvider: 'retell' },
        },
        create: {
          phoneNumberId,
          agentProvider: 'retell',
          agentId,
          agentName: retellAgent.name,
          customerId,
          partnerId,
          inboundEnabled: assignmentType === 'inbound',
          outboundEnabled: assignmentType === 'outbound',
          providerConfig: {
            providerLocked: true,
            provider: 'retell_provider',
            configuredAt: new Date().toISOString(),
          },
          status: 'active',
        },
        update: {
          agentId,
          agentName: retellAgent.name,
          customerId,
          inboundEnabled: assignmentType === 'inbound',
          outboundEnabled: assignmentType === 'outbound',
          providerConfig: {
            providerLocked: true,
            provider: 'retell_provider',
            configuredAt: new Date().toISOString(),
          },
          status: 'active',
          updatedAt: new Date(),
        },
      });

      return {
        phoneNumber,
        retellAgent,
        providerCredentials: null,
        providerType: 'retell_provider' as const,
        isRetellProviderNumber: true,
      };
    }

    // Get provider credentials for this phone number (Twilio/Telnyx only)
    const providerType = phoneNumber.provider.includes('twilio') ? 'twilio' : 'telnyx';

    let providerCredentials;

    if (providerType === 'twilio') {
      if (phoneNumber.provider === 'imported_twilio') {
        // For imported numbers, use database credentials with specific provider account ID
        if (!phoneNumber.providerAccountId) {
          throw new Error('Imported Twilio number missing provider account ID');
        }

        // Look for Twilio credentials at both customer and partner level
        providerCredentials = await tx.phoneNumberProvider.findFirst({
          where: {
            partnerId: partnerId,
            customerId: phoneNumber.customerId, // Customer-level credentials (whitelabel import)
            provider: 'twilio',
            accountIdentifier: phoneNumber.providerAccountId
          }
        });

        // If not found at customer level, check partner level (partner import assigned to customer)
        if (!providerCredentials) {
          providerCredentials = await tx.phoneNumberProvider.findFirst({
            where: {
              partnerId: partnerId,
              customerId: null, // Partner-level credentials
              provider: 'twilio',
              accountIdentifier: phoneNumber.providerAccountId
            }
          });
        }

        if (!providerCredentials) {
          throw new Error(`No Twilio credentials found for account ${phoneNumber.providerAccountId}`);
        }
      } else {
        // For purchased numbers (provider = 'twilio'), use app-level environment credentials
        const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
        const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;

        if (!twilioAccountSid || !twilioAuthToken) {
          throw new Error('Twilio app credentials not configured');
        }

        // Create a mock credentials object for consistency with database format
        providerCredentials = {
          credentials: JSON.stringify({
            accountSid: twilioAccountSid,
            authToken: twilioAuthToken
          }),
          provider: 'twilio'
        };
      }
    } else {
      // Telnyx provider
      if (phoneNumber.provider === 'imported_telnyx') {
        // For imported numbers, use database credentials with specific provider account ID
        if (!phoneNumber.providerAccountId) {
          throw new Error('Imported Telnyx number missing provider account ID');
        }

        // Look for Telnyx credentials at both customer and partner level
        providerCredentials = await tx.phoneNumberProvider.findFirst({
          where: {
            partnerId: partnerId,
            customerId: phoneNumber.customerId, // Customer-level credentials (whitelabel import)
            provider: 'telnyx',
            accountIdentifier: phoneNumber.providerAccountId
          }
        });

        // If not found at customer level, check partner level (partner import assigned to customer)
        if (!providerCredentials) {
          providerCredentials = await tx.phoneNumberProvider.findFirst({
            where: {
              partnerId: partnerId,
              customerId: null, // Partner-level credentials
              provider: 'telnyx',
              accountIdentifier: phoneNumber.providerAccountId
            }
          });
        }

        if (!providerCredentials) {
          throw new Error(`No Telnyx credentials found for account ${phoneNumber.providerAccountId}`);
        }
      } else {
        // For purchased numbers (provider = 'telnyx'), use app-level environment credentials
        const telnyxApiKey = process.env.TELNYX_API_KEY;
        if (!telnyxApiKey) {
          throw new Error('Telnyx API key not configured');
        }

        // Create a mock credentials object for consistency with database format
        providerCredentials = {
          credentials: JSON.stringify({ apiKey: telnyxApiKey }),
          provider: 'telnyx'
        };
      }
    }

    // Deactivate existing agent mappings
    await tx.agentPhoneMapping.updateMany({
      where: {
        phoneNumberId: phoneNumberId,
        status: 'active'
      },
      data: {
        status: 'inactive',
        updatedAt: new Date()
      }
    });

    return {
      phoneNumber,
      retellAgent,
      providerCredentials,
      providerType
    };
  });

  const { retellAgent, providerCredentials, providerType } = result;

  // For Retell provider numbers, mapping is already done in the transaction — return early
  if ((result as any).isRetellProviderNumber) {
    return NextResponse.json({
      success: true,
      message: `Agent assigned successfully for ${assignmentType} calls (Retell provider number)`,
      data: {
        phoneNumber: phoneNumber.phoneNumber,
        agentId: agentId,
        agentName: retellAgent.name,
        providerLocked: true,
      },
      billingType: 'partner_free',
    });
  }

  // Configure SIP trunk based on provider
  // Note: providerCredentials is guaranteed non-null at this point (retell_provider returned early above)
  let sipConfig;
  let sipDomain;

  try {
    if (providerType === 'twilio') {
      // Configure Twilio SIP trunk
      let parsedCredentials;

      if (phoneNumber.provider === 'imported_twilio') {
        // For imported numbers, decrypt the stored credentials
        const decryptedCredentials = await decrypt(providerCredentials!.credentials);
        parsedCredentials = JSON.parse(decryptedCredentials);
      } else {
        // For purchased numbers, credentials are already in plain JSON format
        parsedCredentials = JSON.parse(providerCredentials!.credentials);
      }

      const actualAuthToken = parsedCredentials.authToken || parsedCredentials.token || parsedCredentials.auth_token;
      const actualAccountSid = parsedCredentials.accountSid || parsedCredentials.account_sid || (providerCredentials as any).accountIdentifier;

      if (!actualAuthToken) {
        throw new Error('Auth token not found in credentials');
      }

      const retellSipService = new RetellSipService({
        accountSid: actualAccountSid,
        authToken: actualAuthToken
      });

      const existingSipConfig = await retellSipService.checkExistingSipTrunk(phoneNumber.phoneNumberSid!);

      if (existingSipConfig) {
        // Update existing trunk: sets up origination + termination with fresh credentials
        const updatedConfig = await retellSipService.updateSipTrunkForRetell(
          existingSipConfig.sipTrunkSid,
          phoneNumber.phoneNumber
        );
        // Merge: keep phoneNumberSid from existing, use termination info from updated
        sipConfig = {
          ...existingSipConfig,
          terminationUri: updatedConfig.terminationUri,
          authUsername: updatedConfig.authUsername,
          authPassword: updatedConfig.authPassword,
          credentialListSid: updatedConfig.credentialListSid,
        };
      } else {
        sipConfig = await retellSipService.createSipTrunkForRetell(
          phoneNumber.phoneNumberSid!,
          phoneNumber.phoneNumber
        );
      }

      // Use the trunk's domainName (termination URI) for Retell, NOT the old wrong format
      sipDomain = (sipConfig as any).terminationUri || `${sipConfig.sipTrunkSid}.pstn.twilio.com`;
    } else {
      // Configure Telnyx SIP connection
      let parsedCredentials;

      if (phoneNumber.provider === 'imported_telnyx') {
        // For imported numbers, decrypt the stored credentials
        const decryptedCredentials = await decrypt(providerCredentials!.credentials);
        parsedCredentials = JSON.parse(decryptedCredentials);
      } else {
        // For purchased numbers, credentials are already in plain JSON format
        parsedCredentials = JSON.parse(providerCredentials!.credentials);
      }

      const telnyxSipService = new TelnyxSipService({
        apiKey: parsedCredentials.apiKey
      });

      const retellSipEndpoint = 'sip.retellai.com';
      const existingSipConfig = await telnyxSipService.checkExistingSipConnection(phoneNumber.phoneNumber);

      if (existingSipConfig) {
        // Update both FQDN and inbound settings for existing connections
        await telnyxSipService.updateFqdnForRetell(existingSipConfig.connectionId, retellSipEndpoint);
        await telnyxSipService.updateConnectionInboundSettings(existingSipConfig.connectionId, phoneNumber.phoneNumber);
        sipConfig = existingSipConfig;
      } else {
        sipConfig = await telnyxSipService.createSipConnectionForRetell(
          phoneNumber.phoneNumber,
          retellSipEndpoint,
          assignmentType as 'inbound' | 'outbound' | 'dual'
        );
      }

      sipDomain = retellSipEndpoint;
    }
  } catch (error: any) {
    throw new Error(`Failed to configure SIP trunk: ${error.message}`);
  }
  let retellPhoneNumberData;

  try {
    const decryptedApiKey = await decrypt(retellAgent.apiKey!);
    const retellService = new RetellPhoneNumberService({
      apiKey: decryptedApiKey
    });

    // Resolve customerId for webhook URL generation
    const customerId = await resolveCustomerId(phoneNumber, retellAgent, partnerId, prisma);

    // Generate webhook URL for credit validation
    const generatedWebhookUrl = RetellWebhookManagementService.generateWebhookUrl(
      partnerId,
      customerId,
      retellAgent.id
    );

    // Use provided webhook URL or generated one
    const finalWebhookUrl = webhookUrl || generatedWebhookUrl;

    // Prepare the import request based on assignment type
    // Retell expects termination_uri to be just the domain (e.g., "someuri.pstn.twilio.com")
    // not a full SIP URI with credentials
    let terminationUri;
    if (providerType === 'twilio') {
      // For Twilio: use the trunk's domainName (e.g., "knotie-xxx.pstn.twilio.com")
      terminationUri = sipDomain;
    } else {
      // For Telnyx: use region-specific FQDN (create temporary service instance)
      const tempTelnyxService = new TelnyxSipService({ apiKey: 'temp' });
      terminationUri = tempTelnyxService.getTelnyxFqdnForPhoneNumber(phoneNumber.phoneNumber);
    }

    const importRequest: any = {
      phone_number: phoneNumber.phoneNumber,
      termination_uri: terminationUri,
      nickname: `Knotie - ${phoneNumber.friendlyName || phoneNumber.phoneNumber}`,
    };

    // Add SIP authentication credentials (required for both Twilio and Telnyx outbound calls)
    if (providerType === 'twilio') {
      // For Twilio: use the credentials created during SIP trunk termination setup
      importRequest.sip_trunk_auth_username = (sipConfig as any).authUsername;
      importRequest.sip_trunk_auth_password = (sipConfig as any).authPassword;
    } else if (providerType === 'telnyx') {
      importRequest.sip_trunk_auth_username = (sipConfig as any).username;
      importRequest.sip_trunk_auth_password = (sipConfig as any).password;
    }

    // Add agent assignment based on type
    if (assignmentType === 'inbound') {
      importRequest.inbound_agent_id = retellAgent.id;
      // Only set inbound webhook if enabled (for AI Receptionist functionality)
      if (enableInboundWebhook) {
        importRequest.inbound_webhook_url = finalWebhookUrl;
      }
    } else if (assignmentType === 'outbound') {
      importRequest.outbound_agent_id = retellAgent.id;
      // Note: Outbound calls don't typically use webhooks for incoming call validation
    }

    retellPhoneNumberData = await retellService.importOrUpdatePhoneNumber(importRequest);

    // Validate and fix response data
    logger.debug('Retell phone number import response received', {
      operation: 'retell_phone_import',
      hasResponse: !!retellPhoneNumberData,
      responseKeys: retellPhoneNumberData ? Object.keys(retellPhoneNumberData) : []
    });

    if (!retellPhoneNumberData) {
      throw new Error('Failed to import phone number to Retell: No response data returned');
    }

    // Check for phone_number_id or any ID field
    const phoneNumberId = retellPhoneNumberData.phone_number_id ||
                         (retellPhoneNumberData as any).phoneNumberId ||
                         (retellPhoneNumberData as any).id ||
                         `retell_${Date.now()}`; // Fallback ID

    // Add the ID to the response if it's missing
    if (!retellPhoneNumberData.phone_number_id) {
      retellPhoneNumberData.phone_number_id = phoneNumberId;
      logger.debug('Added phone_number_id to single assignment response', {
        operation: 'retell_phone_import',
        phoneNumberId
      });
    }

    logger.info('Phone number imported to Retell successfully', {
      operation: 'retell_phone_import',
      phoneNumber: phoneNumber.phoneNumber,
      webhookUrl: finalWebhookUrl
    });
  } catch (error: any) {
    throw new Error(`Failed to import phone number to Retell: ${error.message}`);
  }

  // Save configuration to database
  await prisma.$transaction(async (tx) => {
    // Resolve customerId inside the transaction
    const transactionCustomerId = await resolveCustomerId(phoneNumber, retellAgent, partnerId, tx);

    // Save/update SIP configuration
    const sipConfigData = providerType === 'twilio' ? {
      sipTrunkSid: (sipConfig as any).sipTrunkSid,
      sipDomain: sipDomain,
      terminationUri: (sipConfig as any).terminationUri || sipDomain,  // Trunk's domainName (e.g., "knotie-xxx.pstn.twilio.com")
      originationUri: (sipConfig as any).originationUri,
      authUsername: (sipConfig as any).authUsername,   // SIP credential username from termination setup
      authPassword: (sipConfig as any).authPassword,   // SIP credential password from termination setup
    } : {
      sipTrunkSid: (sipConfig as any).connectionId, // Use connectionId for Telnyx
      sipDomain: sipDomain,
      terminationUri: `${(sipConfig as any).connectionId}.telnyx.com`,  // Store Telnyx domain format
      originationUri: `sip:${sipDomain}`,
      authUsername: (sipConfig as any).username,
      authPassword: (sipConfig as any).password,
    };

    await tx.phoneNumberSipConfig.upsert({
      where: {
        phoneNumberId: phoneNumberId
      },
      create: {
        phoneNumberId: phoneNumberId,
        ...sipConfigData,
        status: 'active'
      },
      update: {
        ...sipConfigData,
        status: 'active',
        updatedAt: new Date()
      }
    });

    // Create agent phone mapping
    await tx.agentPhoneMapping.upsert({
      where: {
        phoneNumberId_agentProvider: {
          phoneNumberId: phoneNumberId,
          agentProvider: 'retell'
        }
      },
      create: {
        phoneNumberId: phoneNumberId,
        agentProvider: 'retell',
        agentId: agentId,
        agentName: retellAgent.name,
        customerId: transactionCustomerId,
        partnerId: partnerId,
        inboundEnabled: assignmentType === 'inbound',
        outboundEnabled: assignmentType === 'outbound',
        providerConfig: retellPhoneNumberData as any,
        status: 'active'
      },
      update: {
        agentId: agentId,
        agentName: retellAgent.name,
        customerId: transactionCustomerId,
        inboundEnabled: assignmentType === 'inbound',
        outboundEnabled: assignmentType === 'outbound',
        providerConfig: retellPhoneNumberData as any,
        status: 'active',
        updatedAt: new Date()
      }
    });
  });

  return NextResponse.json({
    success: true,
    message: `Agent assigned successfully for ${assignmentType} calls`,
    data: {
      phoneNumber: phoneNumber.phoneNumber,
      agentId: agentId,
      agentName: retellAgent.name,
      sipTrunkSid: providerType === 'twilio' ? (sipConfig as any).sipTrunkSid : (sipConfig as any).connectionId,
      retellPhoneNumberId: retellPhoneNumberData.phone_number_id
    },
    billingType: 'partner_free'
  });
}

// Handle Retell dual assignment (both inbound and outbound agents)
async function handleRetellDualAssignment(
  phoneNumberId: string,
  inboundAgentId: string,
  outboundAgentId: string,
  partnerId: string,
  phoneNumber: any,
  webhookUrl?: string,
  enableInboundWebhook: boolean = true
) {
  // Get both agents
  const [inboundAgent, outboundAgent] = await Promise.all([
    prisma.retellAgent.findFirst({
      where: {
        id: inboundAgentId,
        partnerId: partnerId
      }
    }),
    prisma.retellAgent.findFirst({
      where: {
        id: outboundAgentId,
        partnerId: partnerId
      }
    })
  ]);

  if (!inboundAgent) {
    throw new Error('Inbound agent not found');
  }

  if (!outboundAgent) {
    throw new Error('Outbound agent not found');
  }

  // For Retell provider numbers, dual assignment is handled without SIP trunk setup
  if (phoneNumber.provider === 'retell_provider') {
    const customerId = inboundAgent.customerId || outboundAgent.customerId || phoneNumber.customerId;

    // Deactivate existing agent mappings
    await prisma.agentPhoneMapping.updateMany({
      where: { phoneNumberId, status: 'active' },
      data: { status: 'inactive', updatedAt: new Date() },
    });

    // Create agent phone mapping for provider-locked number (dual mode)
    await prisma.agentPhoneMapping.upsert({
      where: {
        phoneNumberId_agentProvider: { phoneNumberId, agentProvider: 'retell' },
      },
      create: {
        phoneNumberId,
        agentProvider: 'retell',
        agentId: inboundAgent.id,
        agentName: inboundAgent.name,
        customerId,
        partnerId,
        inboundEnabled: true,
        outboundEnabled: true,
        providerConfig: {
          providerLocked: true,
          provider: 'retell_provider',
          outboundAgentId: outboundAgent.id,
          outboundAgentName: outboundAgent.name,
          configuredAt: new Date().toISOString(),
        },
        status: 'active',
      },
      update: {
        agentId: inboundAgent.id,
        agentName: inboundAgent.name,
        customerId,
        inboundEnabled: true,
        outboundEnabled: true,
        providerConfig: {
          providerLocked: true,
          provider: 'retell_provider',
          outboundAgentId: outboundAgent.id,
          outboundAgentName: outboundAgent.name,
          configuredAt: new Date().toISOString(),
        },
        status: 'active',
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Dual agents assigned successfully (Retell provider number)',
      data: {
        phoneNumber: phoneNumber.phoneNumber,
        inboundAgent: { id: inboundAgent.id, name: inboundAgent.name },
        outboundAgent: { id: outboundAgent.id, name: outboundAgent.name },
        providerLocked: true,
      },
      billingType: 'partner_free',
    });
  }

  // Get provider credentials for SIP configuration
  const providerType = phoneNumber.provider.includes('twilio') ? 'twilio' : 'telnyx';
  let providerCredentials;

  if (providerType === 'twilio') {
    if (phoneNumber.provider === 'imported_twilio') {
      // For imported numbers, use database credentials with specific provider account ID
      if (!phoneNumber.providerAccountId) {
        throw new Error('Imported Twilio number missing provider account ID');
      }

      providerCredentials = await prisma.phoneNumberProvider.findFirst({
        where: {
          partnerId: partnerId,
          customerId: phoneNumber.customerId, // Customer-level credentials (whitelabel import)
          provider: 'twilio',
          accountIdentifier: phoneNumber.providerAccountId
        }
      });

      // If not found at customer level, check partner level (partner import assigned to customer)
      if (!providerCredentials) {
        providerCredentials = await prisma.phoneNumberProvider.findFirst({
          where: {
            partnerId: partnerId,
            customerId: null, // Partner-level credentials
            provider: 'twilio',
            accountIdentifier: phoneNumber.providerAccountId
          }
        });
      }

      if (!providerCredentials) {
        throw new Error(`No Twilio credentials found for account ${phoneNumber.providerAccountId}`);
      }
    } else {
      // For purchased numbers (provider = 'twilio'), use app-level environment credentials
      const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
      const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;

      if (!twilioAccountSid || !twilioAuthToken) {
        throw new Error('Twilio app credentials not configured');
      }

      // Create a mock credentials object for consistency with database format
      providerCredentials = {
        credentials: JSON.stringify({
          accountSid: twilioAccountSid,
          authToken: twilioAuthToken
        }),
        provider: 'twilio'
      };
    }
  } else {
    // Telnyx provider
    if (phoneNumber.provider === 'imported_telnyx') {
      // For imported numbers, use database credentials with specific provider account ID
      if (!phoneNumber.providerAccountId) {
        throw new Error('Imported Telnyx number missing provider account ID');
      }

      // Look for Telnyx credentials at both customer and partner level
      providerCredentials = await prisma.phoneNumberProvider.findFirst({
        where: {
          partnerId: partnerId,
          customerId: phoneNumber.customerId, // Customer-level credentials (whitelabel import)
          provider: 'telnyx',
          accountIdentifier: phoneNumber.providerAccountId
        }
      });

      // If not found at customer level, check partner level (partner import assigned to customer)
      if (!providerCredentials) {
        providerCredentials = await prisma.phoneNumberProvider.findFirst({
          where: {
            partnerId: partnerId,
            customerId: null, // Partner-level credentials
            provider: 'telnyx',
            accountIdentifier: phoneNumber.providerAccountId
          }
        });
      }

      if (!providerCredentials) {
        throw new Error(`No Telnyx credentials found for account ${phoneNumber.providerAccountId}`);
      }
    } else {
      // For purchased numbers (provider = 'telnyx'), use app-level environment credentials
      const telnyxApiKey = process.env.TELNYX_API_KEY;
      if (!telnyxApiKey) {
        throw new Error('Telnyx API key not configured');
      }

      // Create a mock credentials object for consistency with database format
      providerCredentials = {
        credentials: JSON.stringify({ apiKey: telnyxApiKey }),
        provider: 'telnyx'
      };
    }
  }

  // Configure SIP trunk for Retell based on provider
  let sipConfig;
  let sipDomain;

  try {
    if (providerType === 'twilio') {
      // Configure Twilio SIP trunk
      let parsedCredentials;

      if (phoneNumber.provider === 'imported_twilio') {
        // For imported numbers, decrypt the stored credentials
        const decryptedCredentials = await decrypt(providerCredentials.credentials);
        parsedCredentials = JSON.parse(decryptedCredentials);
      } else {
        // For purchased numbers, credentials are already in plain JSON format
        parsedCredentials = JSON.parse(providerCredentials.credentials);
      }

      const actualAuthToken = parsedCredentials.authToken || parsedCredentials.token || parsedCredentials.auth_token;
      const actualAccountSid = parsedCredentials.accountSid || parsedCredentials.account_sid || (providerCredentials as any).accountIdentifier;

      if (!actualAuthToken) {
        throw new Error('Auth token not found in credentials');
      }

      const retellSipService = new RetellSipService({
        accountSid: actualAccountSid,
        authToken: actualAuthToken
      });

      const existingSipConfig = await retellSipService.checkExistingSipTrunk(phoneNumber.phoneNumberSid!);

      if (existingSipConfig) {
        // Update existing trunk: sets up origination + termination with fresh credentials
        const updatedConfig = await retellSipService.updateSipTrunkForRetell(
          existingSipConfig.sipTrunkSid,
          phoneNumber.phoneNumber
        );
        // Merge: keep phoneNumberSid from existing, use termination info from updated
        sipConfig = {
          ...existingSipConfig,
          terminationUri: updatedConfig.terminationUri,
          authUsername: updatedConfig.authUsername,
          authPassword: updatedConfig.authPassword,
          credentialListSid: updatedConfig.credentialListSid,
        };
      } else {
        sipConfig = await retellSipService.createSipTrunkForRetell(
          phoneNumber.phoneNumberSid!,
          phoneNumber.phoneNumber
        );
      }

      // Use the trunk's domainName (termination URI) for Retell, NOT the old wrong format
      sipDomain = (sipConfig as any).terminationUri || `${sipConfig.sipTrunkSid}.pstn.twilio.com`;
    } else {
      // Configure Telnyx SIP connection
      let parsedCredentials;

      if (phoneNumber.provider === 'imported_telnyx') {
        // For imported numbers, decrypt the stored credentials
        const decryptedCredentials = await decrypt(providerCredentials.credentials);
        parsedCredentials = JSON.parse(decryptedCredentials);
      } else {
        // For purchased numbers, credentials are already in plain JSON format
        parsedCredentials = JSON.parse(providerCredentials.credentials);
      }

      const telnyxSipService = new TelnyxSipService({
        apiKey: parsedCredentials.apiKey
      });

      const retellSipEndpoint = 'sip.retellai.com';
      const existingSipConfig = await telnyxSipService.checkExistingSipConnection(phoneNumber.phoneNumber);

      if (existingSipConfig) {
        // Update both FQDN and inbound settings for existing connections
        await telnyxSipService.updateFqdnForRetell(existingSipConfig.connectionId, retellSipEndpoint);
        await telnyxSipService.updateConnectionInboundSettings(existingSipConfig.connectionId, phoneNumber.phoneNumber);
        sipConfig = existingSipConfig;
      } else {
        sipConfig = await telnyxSipService.createSipConnectionForRetell(
          phoneNumber.phoneNumber,
          retellSipEndpoint,
          'dual'  // Dual assignment always creates outbound voice profile
        );
      }

      sipDomain = retellSipEndpoint;
    }
  } catch (error: any) {
    throw new Error(`Failed to configure SIP trunk: ${error.message}`);
  }

  // Import phone number to Retell with both agents
  let retellPhoneNumberData;

  try {
    // Use the inbound agent's API key for the import (both agents should be from same partner)
    const decryptedApiKey = await decrypt(inboundAgent.apiKey!);
    const retellService = new RetellPhoneNumberService({
      apiKey: decryptedApiKey
    });

    // Resolve customerId for webhook URL generation (using inbound agent)
    const customerId = await resolveCustomerId(phoneNumber, inboundAgent, partnerId, prisma);

    // Generate webhook URL for credit validation (using inbound agent)
    const generatedWebhookUrl = RetellWebhookManagementService.generateWebhookUrl(
      partnerId,
      customerId,
      inboundAgent.id
    );

    // Use provided webhook URL or generated one
    const finalWebhookUrl = webhookUrl || generatedWebhookUrl;

    // Prepare the import request with both agents
    // Retell expects termination_uri to be just the domain (e.g., "someuri.pstn.twilio.com")
    // not a full SIP URI with credentials
    let terminationUri;
    if (providerType === 'twilio') {
      // For Twilio: use the trunk's domainName (e.g., "knotie-xxx.pstn.twilio.com")
      terminationUri = sipDomain;
    } else {
      // For Telnyx: use region-specific FQDN (create temporary service instance)
      const tempTelnyxService = new TelnyxSipService({ apiKey: 'temp' });
      terminationUri = tempTelnyxService.getTelnyxFqdnForPhoneNumber(phoneNumber.phoneNumber);
    }

    const importRequest: any = {
      phone_number: phoneNumber.phoneNumber,
      termination_uri: terminationUri,
      nickname: `Knotie - ${phoneNumber.friendlyName || phoneNumber.phoneNumber}`,
      inbound_agent_id: inboundAgent.id,
      outbound_agent_id: outboundAgent.id
    };

    // Add SIP authentication credentials (required for both Twilio and Telnyx outbound calls)
    if (providerType === 'twilio') {
      // For Twilio: use the credentials created during SIP trunk termination setup
      importRequest.sip_trunk_auth_username = (sipConfig as any).authUsername;
      importRequest.sip_trunk_auth_password = (sipConfig as any).authPassword;
    } else if (providerType === 'telnyx') {
      importRequest.sip_trunk_auth_username = (sipConfig as any).username;
      importRequest.sip_trunk_auth_password = (sipConfig as any).password;
    }

    // Only set inbound webhook if enabled (for AI Receptionist functionality)
    if (enableInboundWebhook) {
      importRequest.inbound_webhook_url = finalWebhookUrl;
    }

    retellPhoneNumberData = await retellService.importOrUpdatePhoneNumber(importRequest);

    // Validate that the import was successful
    logger.debug('Retell dual assignment response received', {
      operation: 'retell_dual_assignment',
      hasResponse: !!retellPhoneNumberData,
      responseKeys: retellPhoneNumberData ? Object.keys(retellPhoneNumberData) : []
    });

    if (!retellPhoneNumberData) {
      throw new Error('Failed to import phone number to Retell: No response data returned');
    }

    // Check for phone_number_id or phoneNumberId or any ID field
    const phoneNumberId = retellPhoneNumberData.phone_number_id ||
                         (retellPhoneNumberData as any).phoneNumberId ||
                         (retellPhoneNumberData as any).id ||
                         `retell_${Date.now()}`; // Fallback ID

    // Add the ID to the response if it's missing
    if (!retellPhoneNumberData.phone_number_id) {
      retellPhoneNumberData.phone_number_id = phoneNumberId;
      logger.debug('Added phone_number_id to dual assignment response', {
        operation: 'retell_dual_assignment',
        phoneNumberId
      });
    }

    logger.info('Phone number imported to Retell with dual assignment', {
      operation: 'retell_dual_assignment',
      phoneNumber: phoneNumber.phoneNumber,
      inboundAgentId: inboundAgent.id,
      outboundAgentId: outboundAgent.id
    });
  } catch (error: any) {
    throw new Error(`Failed to import phone number to Retell: ${error.message}`);
  }

  // Save configuration to database
  await prisma.$transaction(async (tx) => {
    // Save/update SIP configuration
    const sipConfigData = providerType === 'twilio' ? {
      sipTrunkSid: (sipConfig as any).sipTrunkSid,
      sipDomain: sipDomain,
      terminationUri: (sipConfig as any).terminationUri || sipDomain,  // Trunk's domainName (e.g., "knotie-xxx.pstn.twilio.com")
      originationUri: (sipConfig as any).originationUri,
      authUsername: (sipConfig as any).authUsername,   // SIP credential username from termination setup
      authPassword: (sipConfig as any).authPassword,   // SIP credential password from termination setup
    } : {
      sipTrunkSid: (sipConfig as any).connectionId, // Use connectionId for Telnyx
      sipDomain: sipDomain,
      terminationUri: `${(sipConfig as any).connectionId}.telnyx.com`,  // Store Telnyx domain format
      originationUri: `sip:${sipDomain}`,
      authUsername: (sipConfig as any).username,
      authPassword: (sipConfig as any).password,
    };

    await tx.phoneNumberSipConfig.upsert({
      where: {
        phoneNumberId: phoneNumberId
      },
      create: {
        phoneNumberId: phoneNumberId,
        ...sipConfigData,
        status: 'active'
      },
      update: {
        ...sipConfigData,
        status: 'active',
        updatedAt: new Date()
      }
    });

    // Resolve customerId for dual assignment
    const customerId = await resolveCustomerId(phoneNumber, inboundAgent, partnerId, tx);

    // Create agent phone mapping with dual assignment
    await tx.agentPhoneMapping.upsert({
      where: {
        phoneNumberId_agentProvider: {
          phoneNumberId: phoneNumberId,
          agentProvider: 'retell'
        }
      },
      create: {
        phoneNumberId: phoneNumberId,
        agentProvider: 'retell',
        agentId: inboundAgent.id, // Primary agent for mapping
        agentName: inboundAgent.name,
        customerId: customerId,
        partnerId: partnerId,
        status: 'active',
        inboundEnabled: true,
        outboundEnabled: true,
        providerConfig: retellPhoneNumberData as any
      },
      update: {
        agentId: inboundAgent.id,
        agentName: inboundAgent.name,
        customerId: customerId,
        inboundEnabled: true,
        outboundEnabled: true,
        providerConfig: retellPhoneNumberData as any,
        status: 'active',
        updatedAt: new Date()
      }
    });
  });

  return NextResponse.json({
    success: true,
    message: 'Dual agent assignment completed successfully',
    data: {
      phoneNumber: phoneNumber.phoneNumber,
      inboundAgent: {
        id: inboundAgent.id,
        name: inboundAgent.name
      },
      outboundAgent: {
        id: outboundAgent.id,
        name: outboundAgent.name
      },
      sipTrunkSid: providerType === 'twilio' ? (sipConfig as any).sipTrunkSid : (sipConfig as any).connectionId,
      retellPhoneNumberId: retellPhoneNumberData.phone_number_id
    }
  });
}

// Handle VAPI single assignment
async function handleVapiAssignment(
  phoneNumberId: string,
  agentId: string,
  partnerId: string,
  phoneNumber: any,
  assignmentType: string = 'inbound',
  enableSms: boolean = false
) {
  logger.info('Starting VAPI phone number assignment', {
    operation: 'vapi_assignment',
    phoneNumber: phoneNumber.phoneNumber,
    agentId
  });

  // Get VAPI agent
  const vapiAgent = await prisma.vapiAgent.findFirst({
    where: {
      id: agentId,
      partnerId: partnerId,
      isActive: true
    },
    include: {
      partner: {
        select: {
          vapiApiKey: true
        }
      }
    }
  });

  if (!vapiAgent) {
    throw new Error('VAPI agent not found or inactive');
  }

  // Get API key (agent-specific or partner fallback)
  let apiKey = vapiAgent.apiKey;
  if (!apiKey && vapiAgent.partner.vapiApiKey) {
    apiKey = vapiAgent.partner.vapiApiKey;
  }

  if (!apiKey) {
    throw new Error('VAPI API key not found');
  }

  // Decrypt API key
  const decryptedApiKey = await decrypt(apiKey);

  // Create VAPI phone number configuration
  const vapiPhoneNumberData = await createVapiPhoneNumber(
    phoneNumber,
    vapiAgent.id,
    decryptedApiKey,
    enableSms,
    partnerId
  );

  // Create or update agent mapping in database
  // Using upsert to handle re-assignment of the same agent to the same phone number
  await prisma.$transaction(async (tx) => {
    // Resolve customerId for VAPI assignment
    const customerId = await resolveCustomerId(phoneNumber, vapiAgent, partnerId, tx);

    await tx.agentPhoneMapping.upsert({
      where: {
        id: `vapi-${phoneNumberId}-${agentId}`
      },
      update: {
        agentName: vapiAgent.name,
        customerId: customerId,
        inboundEnabled: assignmentType === 'inbound' || assignmentType === 'dual',
        outboundEnabled: assignmentType === 'outbound' || assignmentType === 'dual',
        providerConfig: vapiPhoneNumberData as any,
        status: 'active',
        updatedAt: new Date()
      },
      create: {
        id: `vapi-${phoneNumberId}-${agentId}`,
        phoneNumberId: phoneNumberId,
        agentProvider: 'vapi',
        agentId: agentId,
        agentName: vapiAgent.name,
        partnerId: partnerId,
        customerId: customerId,
        inboundEnabled: assignmentType === 'inbound' || assignmentType === 'dual',
        outboundEnabled: assignmentType === 'outbound' || assignmentType === 'dual',
        providerConfig: vapiPhoneNumberData as any,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
  });

  return NextResponse.json({
    success: true,
    message: 'VAPI agent assigned successfully',
    assignment: {
      phoneNumber: phoneNumber.phoneNumber,
      agent: {
        id: vapiAgent.id,
        name: vapiAgent.name,
        provider: 'vapi'
      },
      assignmentType,
      smsEnabled: enableSms,
      vapiPhoneNumberId: vapiPhoneNumberData.id
    }
  });
}

// Handle VAPI dual assignment
async function handleVapiDualAssignment(
  phoneNumberId: string,
  inboundAgentId: string,
  outboundAgentId: string,
  partnerId: string,
  phoneNumber: any,
  enableSms: boolean = false
) {
  logger.info('Starting VAPI dual phone number assignment', {
    operation: 'vapi_dual_assignment',
    phoneNumber: phoneNumber.phoneNumber
  });

  // Get both VAPI agents
  const [inboundAgent, outboundAgent] = await Promise.all([
    prisma.vapiAgent.findFirst({
      where: {
        id: inboundAgentId,
        partnerId: partnerId,
        isActive: true
      },
      include: {
        partner: {
          select: {
            vapiApiKey: true
          }
        }
      }
    }),
    prisma.vapiAgent.findFirst({
      where: {
        id: outboundAgentId,
        partnerId: partnerId,
        isActive: true
      },
      include: {
        partner: {
          select: {
            vapiApiKey: true
          }
        }
      }
    })
  ]);

  if (!inboundAgent || !outboundAgent) {
    throw new Error('One or both VAPI agents not found or inactive');
  }

  // Get API key (use inbound agent's key or partner fallback)
  let apiKey = inboundAgent.apiKey;
  if (!apiKey && inboundAgent.partner.vapiApiKey) {
    apiKey = inboundAgent.partner.vapiApiKey;
  }

  if (!apiKey) {
    throw new Error('VAPI API key not found');
  }

  // Decrypt API key
  const decryptedApiKey = await decrypt(apiKey);

  // Create VAPI phone number configuration (using inbound agent as primary)
  const vapiPhoneNumberData = await createVapiPhoneNumber(
    phoneNumber,
    inboundAgent.id,
    decryptedApiKey,
    enableSms,
    partnerId
  );

  // Create or update agent mappings in database
  // Using upsert to handle re-assignment of the same agents to the same phone number
  await prisma.$transaction(async (tx) => {
    // Resolve customerId for both agents (use inbound agent as primary)
    const customerId = await resolveCustomerId(phoneNumber, inboundAgent, partnerId, tx);

    // Create or update inbound mapping
    await tx.agentPhoneMapping.upsert({
      where: {
        id: `vapi-${phoneNumberId}-${inboundAgentId}-inbound`
      },
      update: {
        agentName: inboundAgent.name,
        customerId: customerId,
        inboundEnabled: true,
        outboundEnabled: false,
        providerConfig: vapiPhoneNumberData as any,
        status: 'active',
        updatedAt: new Date()
      },
      create: {
        id: `vapi-${phoneNumberId}-${inboundAgentId}-inbound`,
        phoneNumberId: phoneNumberId,
        agentProvider: 'vapi',
        agentId: inboundAgentId,
        agentName: inboundAgent.name,
        partnerId: partnerId,
        customerId: customerId,
        inboundEnabled: true,
        outboundEnabled: false,
        providerConfig: vapiPhoneNumberData as any,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Create or update outbound mapping
    await tx.agentPhoneMapping.upsert({
      where: {
        id: `vapi-${phoneNumberId}-${outboundAgentId}-outbound`
      },
      update: {
        agentName: outboundAgent.name,
        customerId: customerId,
        inboundEnabled: false,
        outboundEnabled: true,
        providerConfig: vapiPhoneNumberData as any,
        status: 'active',
        updatedAt: new Date()
      },
      create: {
        id: `vapi-${phoneNumberId}-${outboundAgentId}-outbound`,
        phoneNumberId: phoneNumberId,
        agentProvider: 'vapi',
        agentId: outboundAgentId,
        agentName: outboundAgent.name,
        partnerId: partnerId,
        customerId: customerId,
        inboundEnabled: false,
        outboundEnabled: true,
        providerConfig: vapiPhoneNumberData as any,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
  });

  return NextResponse.json({
    success: true,
    message: 'VAPI agents assigned successfully',
    assignment: {
      phoneNumber: phoneNumber.phoneNumber,
      inboundAgent: {
        id: inboundAgent.id,
        name: inboundAgent.name,
        provider: 'vapi'
      },
      outboundAgent: {
        id: outboundAgent.id,
        name: outboundAgent.name,
        provider: 'vapi'
      },
      smsEnabled: enableSms,
      vapiPhoneNumberId: vapiPhoneNumberData.id
    }
  });
}

// Helper function to create VAPI phone number
async function createVapiPhoneNumber(
  phoneNumber: any,
  assistantId: string,
  apiKey: string,
  enableSms: boolean = false,
  partnerId?: string
) {
  logger.info('Creating VAPI phone number', {
    operation: 'vapi_phone_creation',
    phoneNumber: phoneNumber.phoneNumber,
    assistantId
  });

  // Handle different provider types
  if (phoneNumber.provider === 'imported_telnyx' || phoneNumber.provider === 'telnyx') {
    // For Telnyx numbers, use BYO phone number approach with SIP credentials
    return await createVapiByoPhoneNumber(phoneNumber, assistantId, apiKey, enableSms);
  } else {
    // For Twilio numbers, use direct provider approach
    return await createVapiTwilioPhoneNumber(phoneNumber, assistantId, apiKey, enableSms, partnerId);
  }
}

// Helper function to create VAPI BYO phone number for Telnyx
async function createVapiByoPhoneNumber(
  phoneNumber: any,
  assistantId: string,
  apiKey: string,
  _enableSms: boolean = false
) {
  const { VapiSipService } = await import('@/lib/telephony/vapi-sip-service');
  const { TelnyxSipService } = await import('@/lib/telephony/telnyx-sip-service');

  logger.info('Creating VAPI BYO phone number for Telnyx', {
    operation: 'vapi_byo_creation',
    phoneNumber: phoneNumber.phoneNumber
  });

  // Get Telnyx SIP configuration from phone number
  let sipConfig = phoneNumber.sipConfig;

  if (!sipConfig) {
    // If no SIP config exists, create one using Telnyx SIP service
    logger.debug('No SIP config found, creating new Telnyx SIP configuration', {
      operation: 'vapi_byo_creation'
    });

    // Get Telnyx credentials (same logic as Retell assignment)
    let providerCredentials;

    if (phoneNumber.provider === 'imported_telnyx') {
      // For imported numbers, get credentials from database
      providerCredentials = await prisma.phoneNumberProvider.findFirst({
        where: {
          customerId: phoneNumber.customerId,
          provider: 'telnyx',
          accountIdentifier: phoneNumber.providerAccountId
        }
      });

      // If not found at customer level, check partner level
      if (!providerCredentials) {
        providerCredentials = await prisma.phoneNumberProvider.findFirst({
          where: {
            partnerId: phoneNumber.partnerId,
            customerId: null,
            provider: 'telnyx',
            accountIdentifier: phoneNumber.providerAccountId
          }
        });
      }

      if (!providerCredentials) {
        throw new Error(`No Telnyx credentials found for account ${phoneNumber.providerAccountId}`);
      }
    } else {
      // For purchased numbers, use environment credentials
      const telnyxApiKey = process.env.TELNYX_API_KEY;
      if (!telnyxApiKey) {
        throw new Error('Telnyx API key not configured');
      }

      providerCredentials = {
        credentials: JSON.stringify({ apiKey: telnyxApiKey }),
        provider: 'telnyx'
      };
    }

    // Parse credentials
    let parsedCredentials;
    if (phoneNumber.provider === 'imported_telnyx') {
      const decryptedCredentials = await decrypt(providerCredentials.credentials);
      parsedCredentials = JSON.parse(decryptedCredentials);
    } else {
      parsedCredentials = JSON.parse(providerCredentials.credentials);
    }

    const telnyxSipService = new TelnyxSipService({ apiKey: parsedCredentials.apiKey });

    // Create SIP connection for VAPI (different from Retell)
    const vapiSipEndpoint = 'sip.vapi.ai'; // VAPI's SIP endpoint
    sipConfig = await telnyxSipService.createSipConnectionForVapi(phoneNumber.phoneNumber, vapiSipEndpoint);

    // Save SIP config using the same pattern as Retell assignment
    const sipConfigData = {
      sipTrunkSid: (sipConfig as any).connectionId, // Use connectionId for Telnyx
      sipDomain: 'sip.vapi.ai',
      terminationUri: `${(sipConfig as any).connectionId}.telnyx.com`,  // Store Telnyx domain format
      originationUri: `sip:sip.vapi.ai`,
      authUsername: (sipConfig as any).username,
      authPassword: (sipConfig as any).password,
    };

    await prisma.phoneNumberSipConfig.upsert({
      where: {
        phoneNumberId: phoneNumber.id
      },
      create: {
        phoneNumberId: phoneNumber.id,
        ...sipConfigData,
        status: 'active'
      },
      update: {
        ...sipConfigData,
        status: 'active',
        updatedAt: new Date()
      }
    });
  }

  // Create VAPI SIP service
  const vapiSipService = new VapiSipService({ apiKey });

  // Create SIP credential in VAPI
  const sipCredential = await vapiSipService.createSipCredential({
    realm: sipConfig.sipDomain,
    username: sipConfig.username,
    password: sipConfig.password
  });

  // Create BYO phone number in VAPI
  const vapiPhoneNumber = await vapiSipService.createByoPhoneNumber({
    phoneNumber: phoneNumber.phoneNumber,
    credentialId: sipCredential.id,
    assistantId: assistantId
    // Let the service generate a short name automatically (under 40 chars)
  });

  logger.info('Created VAPI BYO phone number successfully', {
    operation: 'vapi_byo_creation',
    vapiPhoneNumberId: vapiPhoneNumber.id
  });

  return {
    ...vapiPhoneNumber,
    credentialId: sipCredential.id,
    sipConfig: sipConfig
  };
}

// Helper function to create VAPI Twilio phone number (existing logic)
async function createVapiTwilioPhoneNumber(
  phoneNumber: any,
  assistantId: string,
  apiKey: string,
  enableSms: boolean = false,
  partnerId?: string
) {
  logger.info('Creating VAPI Twilio phone number', {
    operation: 'vapi_twilio_creation',
    phoneNumber: phoneNumber.phoneNumber
  });

  // Get Twilio credentials (same logic as Telnyx assignment)
  let providerCredentials;

  if (phoneNumber.provider === 'imported_twilio') {
    // For imported numbers, get credentials from database
    providerCredentials = await prisma.phoneNumberProvider.findFirst({
      where: {
        customerId: phoneNumber.customerId,
        provider: 'twilio',
        accountIdentifier: phoneNumber.providerAccountId
      }
    });

    if (!providerCredentials && partnerId) {
      // Fallback to partner-level credentials if not found
      providerCredentials = await prisma.phoneNumberProvider.findFirst({
        where: {
          partnerId: partnerId, // Use actual partner ID
          provider: 'twilio'
        }
      });
    }

    if (!providerCredentials) {
      throw new Error(`No Twilio credentials found for account ${phoneNumber.providerAccountId}`);
    }

    // Parse and decrypt credentials
    const decryptedCredentials = await decrypt(providerCredentials.credentials);
    const parsedCredentials = JSON.parse(decryptedCredentials);

    providerCredentials = {
      twilioAccountSid: parsedCredentials.accountSid,
      twilioAuthToken: parsedCredentials.authToken
    };
  } else {
    // For purchased numbers, use environment credentials
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;

    if (!twilioAccountSid || !twilioAuthToken) {
      throw new Error('Twilio credentials not configured');
    }

    providerCredentials = {
      twilioAccountSid: twilioAccountSid,
      twilioAuthToken: twilioAuthToken
    };
  }

  // Prepare VAPI phone number payload
  // Generate a short name (under 40 characters)
  const shortName = `${phoneNumber.phoneNumber.replace('+', '').slice(-10)}-${assistantId.split('-')[0]}`;

  const phoneNumberPayload: any = {
    provider: 'twilio',
    number: phoneNumber.phoneNumber,
    assistantId: assistantId,
    name: shortName,
    ...providerCredentials
  };

  // Add SMS configuration if enabled
  if (enableSms) {
    phoneNumberPayload.smsEnabled = true;
  }

  try {
    // Create phone number via VAPI API
    const response = await fetch('https://api.vapi.ai/phone-number', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(phoneNumberPayload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error('VAPI Twilio phone number creation failed', new Error(response.statusText), {
        operation: 'vapi_twilio_creation',
        status: response.status,
        errorData
      });
      throw new Error(`VAPI phone number creation failed: ${errorData.message || response.statusText}`);
    }

    const vapiPhoneNumberData = await response.json();
    logger.info('VAPI Twilio phone number created successfully', {
      operation: 'vapi_twilio_creation',
      vapiPhoneNumberId: vapiPhoneNumberData.id
    });

    return vapiPhoneNumberData;
  } catch (error) {
    logger.error('Error creating VAPI Twilio phone number', error as Error, {
      operation: 'vapi_twilio_creation'
    });
    throw error;
  }
}

// Handle Knova (LiveKit) agent assignment
// For Knova agents, we configure Twilio/Telnyx to point to Connect Hub endpoints
async function handleKnovaAssignment(
  phoneNumberId: string,
  agentId: string,
  partnerId: string,
  phoneNumber: any
) {
  logger.info('Starting Knova phone number assignment', {
    operation: 'knova_assignment',
    phoneNumber: phoneNumber.phoneNumber,
    agentId
  });

  // Get Knova agent
  const knovaAgent = await prisma.knovaAgent.findFirst({
    where: {
      id: agentId,
      partnerId: partnerId,
      isActive: true
    },
    include: {
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true
        }
      }
    }
  });

  if (!knovaAgent) {
    throw new Error('Knova agent not found or inactive');
  }

  // Determine provider type and get credentials
  const providerType = phoneNumber.provider.includes('twilio') ? 'twilio' : 'telnyx';
  let providerCredentials;

  if (providerType === 'twilio') {
    if (phoneNumber.provider === 'imported_twilio') {
      if (!phoneNumber.providerAccountId) {
        throw new Error('Imported Twilio number missing provider account ID');
      }

      // Look for Twilio credentials at customer or partner level
      providerCredentials = await prisma.phoneNumberProvider.findFirst({
        where: {
          partnerId: partnerId,
          customerId: phoneNumber.customerId,
          provider: 'twilio',
          accountIdentifier: phoneNumber.providerAccountId
        }
      });

      if (!providerCredentials) {
        providerCredentials = await prisma.phoneNumberProvider.findFirst({
          where: {
            partnerId: partnerId,
            customerId: null,
            provider: 'twilio',
            accountIdentifier: phoneNumber.providerAccountId
          }
        });
      }

      if (!providerCredentials) {
        throw new Error(`No Twilio credentials found for account ${phoneNumber.providerAccountId}`);
      }
    } else {
      // For purchased numbers, use environment credentials
      const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
      const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;

      if (!twilioAccountSid || !twilioAuthToken) {
        throw new Error('Twilio app credentials not configured');
      }

      providerCredentials = {
        credentials: JSON.stringify({
          accountSid: twilioAccountSid,
          authToken: twilioAuthToken
        }),
        provider: 'twilio',
        isEnvCredentials: true
      };
    }
  } else {
    // Telnyx provider
    if (phoneNumber.provider === 'imported_telnyx') {
      if (!phoneNumber.providerAccountId) {
        throw new Error('Imported Telnyx number missing provider account ID');
      }

      providerCredentials = await prisma.phoneNumberProvider.findFirst({
        where: {
          partnerId: partnerId,
          customerId: phoneNumber.customerId,
          provider: 'telnyx',
          accountIdentifier: phoneNumber.providerAccountId
        }
      });

      if (!providerCredentials) {
        providerCredentials = await prisma.phoneNumberProvider.findFirst({
          where: {
            partnerId: partnerId,
            customerId: null,
            provider: 'telnyx',
            accountIdentifier: phoneNumber.providerAccountId
          }
        });
      }

      if (!providerCredentials) {
        throw new Error(`No Telnyx credentials found for account ${phoneNumber.providerAccountId}`);
      }
    } else {
      const telnyxApiKey = process.env.TELNYX_API_KEY;
      if (!telnyxApiKey) {
        throw new Error('Telnyx API key not configured');
      }

      providerCredentials = {
        credentials: JSON.stringify({ apiKey: telnyxApiKey }),
        provider: 'telnyx',
        isEnvCredentials: true
      };
    }
  }

  // Configure the phone number to point to Connect Hub endpoints
  const connectHubBaseUrl = process.env.CONNECT_HUB_URL || 'https://connection.knotie-ai.pro';
  const webhookUrl = providerType === 'twilio'
    ? `${connectHubBaseUrl}/twilio/inbound-call`
    : `${connectHubBaseUrl}/telnyx/inbound-call`;

  try {
    if (providerType === 'twilio') {
      // Configure Twilio phone number webhook
      let parsedCredentials;
      if ((providerCredentials as any).isEnvCredentials) {
        parsedCredentials = JSON.parse(providerCredentials.credentials);
      } else {
        const decryptedCredentials = await decrypt(providerCredentials.credentials);
        parsedCredentials = JSON.parse(decryptedCredentials);
      }

      const accountSid = parsedCredentials.accountSid || parsedCredentials.account_sid;
      const authToken = parsedCredentials.authToken || parsedCredentials.auth_token || parsedCredentials.token;

      // Update Twilio phone number voice URL
      const twilioClient = (await import('twilio')).default;
      const client = twilioClient(accountSid, authToken);

      await client.incomingPhoneNumbers(phoneNumber.phoneNumberSid).update({
        voiceUrl: webhookUrl,
        voiceMethod: 'POST'
      });

      logger.info('Twilio phone number configured for Knova', {
        operation: 'knova_assignment',
        phoneNumber: phoneNumber.phoneNumber,
        webhookUrl
      });
    } else {
      // Configure Telnyx phone number webhook
      let parsedCredentials;
      if ((providerCredentials as any).isEnvCredentials) {
        parsedCredentials = JSON.parse(providerCredentials.credentials);
      } else {
        const decryptedCredentials = await decrypt(providerCredentials.credentials);
        parsedCredentials = JSON.parse(decryptedCredentials);
      }

      // Use Telnyx API to update the phone number's voice settings
      const telnyxApiKey = parsedCredentials.apiKey;

      // First, get the phone number details to find the connection ID
      const phoneNumberResponse = await fetch(
        `https://api.telnyx.com/v2/phone_numbers/${phoneNumber.phoneNumberSid}`,
        {
          headers: {
            'Authorization': `Bearer ${telnyxApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!phoneNumberResponse.ok) {
        throw new Error('Failed to get Telnyx phone number details');
      }

      const phoneNumberData = await phoneNumberResponse.json();
      const connectionId = phoneNumberData.data?.connection_id;

      if (connectionId) {
        // Update the connection's webhook URL
        await fetch(`https://api.telnyx.com/v2/connections/${connectionId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${telnyxApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            webhook_url: webhookUrl,
            webhook_api_version: '2'
          })
        });
      }

      logger.info('Telnyx phone number configured for Knova', {
        operation: 'knova_assignment',
        phoneNumber: phoneNumber.phoneNumber,
        webhookUrl
      });
    }
  } catch (error: any) {
    throw new Error(`Failed to configure phone number for Knova: ${error.message}`);
  }

  // Save configuration to database
  await prisma.$transaction(async (tx) => {
    // Resolve customerId
    const customerId = await resolveCustomerId(phoneNumber, knovaAgent, partnerId, tx);

    // Deactivate existing agent mappings for this phone number
    await tx.agentPhoneMapping.updateMany({
      where: {
        phoneNumberId: phoneNumberId,
        status: 'active'
      },
      data: {
        status: 'inactive',
        updatedAt: new Date()
      }
    });

    // Create or update agent phone mapping for Knova
    // Using upsert to handle re-assignment of the same agent to the same phone number
    await tx.agentPhoneMapping.upsert({
      where: {
        id: `knova-${phoneNumberId}-${agentId}`
      },
      update: {
        agentName: knovaAgent.name,
        customerId: customerId,
        inboundEnabled: true,
        outboundEnabled: false,
        providerConfig: {
          webhookUrl: webhookUrl,
          provider: providerType,
          configuredAt: new Date().toISOString()
        },
        status: 'active',
        updatedAt: new Date()
      },
      create: {
        id: `knova-${phoneNumberId}-${agentId}`,
        phoneNumberId: phoneNumberId,
        agentProvider: 'knova',
        agentId: agentId,
        agentName: knovaAgent.name,
        partnerId: partnerId,
        customerId: customerId,
        inboundEnabled: true,
        outboundEnabled: false, // Knova currently only supports inbound
        providerConfig: {
          webhookUrl: webhookUrl,
          provider: providerType,
          configuredAt: new Date().toISOString()
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
  });

  return NextResponse.json({
    success: true,
    message: 'Knova agent assigned successfully for inbound calls',
    assignment: {
      phoneNumber: phoneNumber.phoneNumber,
      agent: {
        id: knovaAgent.id,
        name: knovaAgent.name,
        provider: 'knova'
      },
      webhookUrl: webhookUrl,
      assignmentType: 'inbound'
    }
  });
}
