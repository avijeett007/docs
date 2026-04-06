import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPartnerJWT } from '@/lib/auth';
import { logger } from '@/lib/logger';

import { TelnyxSipService } from '@/lib/telephony/telnyx-sip-service';
import { decrypt } from '@/lib/encryption';

/**
 * POST /api/partner/phone-numbers/[phoneNumberId]/unassign-agent
 * Unassign a phone number from its current agent
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { phoneNumberId: string } }
) {
  try {
    const phoneNumberId = params.phoneNumberId;

    // Verify partner authentication
    const { payload, isValid } = await verifyPartnerJWT(request);
    if (!isValid || !payload?.partnerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = payload.partnerId;

    // Get phone number with customer information and current mapping
    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: {
        id: phoneNumberId,
        partnerId: partnerId
      },
      include: {
        customer: {
          select: {
            id: true,
            twilioSubaccountSid: true
          }
        },
        agentMappings: {
          where: { status: 'active' },
          take: 1
        }
      }
    });

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number not found' },
        { status: 404 }
      );
    }

    const activeMapping = phoneNumber.agentMappings[0];
    if (!activeMapping) {
      return NextResponse.json(
        { error: 'Phone number is not assigned to any agent' },
        { status: 400 }
      );
    }

    // Handle unassignment based on provider
    logger.info('Starting phone number unassignment', {
      operation: 'unassign_agent',
      agentProvider: activeMapping.agentProvider,
      phoneNumber: phoneNumber.phoneNumber,
      phoneNumberProvider: phoneNumber.provider,
      phoneNumberSid: phoneNumber.phoneNumberSid,
      providerPhoneNumberId: (phoneNumber as any).providerPhoneNumberId
    });

    if (activeMapping.agentProvider === 'retell') {
      logger.debug('Calling Retell unassignment handler', { operation: 'retell_unassignment' });
      await handleRetellUnassignment(phoneNumber, activeMapping, partnerId);
    } else if (activeMapping.agentProvider === 'vapi') {
      logger.debug('Calling VAPI unassignment handler', { operation: 'vapi_unassignment' });
      await handleVapiUnassignment(phoneNumber, activeMapping, partnerId);
    } else if (activeMapping.agentProvider === 'knova') {
      logger.debug('Calling Knova unassignment handler', { operation: 'knova_unassignment' });
      await handleKnovaUnassignment(phoneNumber, activeMapping, partnerId);
    } else {
      return NextResponse.json(
        { error: `Agent provider ${activeMapping.agentProvider} unassignment is not currently supported` },
        { status: 400 }
      );
    }

    // Update agent mapping status (for providers not handled by deletion in their handlers)
    // Note: Retell, VAPI, and Knova agents are handled by deletion in their respective handlers
    if (activeMapping.agentProvider !== 'retell' && activeMapping.agentProvider !== 'vapi' && activeMapping.agentProvider !== 'knova') {
      await prisma.agentPhoneMapping.update({
        where: { id: activeMapping.id },
        data: {
          status: 'inactive',
          updatedAt: new Date()
        }
      });
    }

    // Force cleanup Twilio phone number if it's stuck in SIP trunk routing
    if (phoneNumber.provider === 'imported_twilio') {
      logger.info('Attempting force cleanup for imported Twilio number', {
        operation: 'force_cleanup_twilio',
        phoneNumber: phoneNumber.phoneNumber
      });
      await forceCleanupTwilioPhoneNumber(phoneNumber);
    }

    // Revoke outbound webhook token if it exists
    try {
      const connectHubUrl = process.env.CONNECT_HUB_URL;
      if (connectHubUrl) {
        const revokeRes = await fetch(`${connectHubUrl}/api/tokens/outbound-webhook`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.CONNECT_HUB_API_KEY || ''}`
          },
          body: JSON.stringify({ partnerId, phoneNumberId: phoneNumber.id })
        });
        if (revokeRes.ok) {
          logger.info('Revoked outbound webhook token during unassignment', {
            operation: 'revoke_webhook_token',
            phoneNumberId: phoneNumber.id
          });
        }
      }
    } catch (webhookTokenError) {
      logger.warn('Failed to revoke outbound webhook token during unassignment', {
        operation: 'revoke_webhook_token',
        phoneNumberId: phoneNumber.id
      });
      // Don't fail the unassignment if token deletion fails
    }

    // Invalidate outbound call mapping cache in Redis
    try {
      const connectHubUrl = process.env.CONNECT_HUB_URL;
      if (connectHubUrl) {
        await fetch(`${connectHubUrl}/api/outbound-call/invalidate-cache`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.CONNECT_HUB_API_KEY || ''}`
          },
          body: JSON.stringify({ phoneNumber: phoneNumber.phoneNumber })
        });
        logger.info('Invalidated outbound mapping cache during unassignment', {
          operation: 'invalidate_outbound_cache',
          phoneNumberId: phoneNumber.id
        });
      }
    } catch (cacheError) {
      logger.warn('Failed to invalidate outbound mapping cache during unassignment', {
        operation: 'invalidate_outbound_cache',
        phoneNumberId: phoneNumber.id
      });
      // Don't fail the unassignment if cache invalidation fails
    }

    return NextResponse.json({
      success: true,
      message: 'Agent unassigned successfully',
      billingType: phoneNumber.customerId ? 'customer_credits' : 'partner_free'
    });

  } catch (error: any) {
    logger.error('Agent unassignment error', error, {
      operation: 'unassign_agent',
      phoneNumberId: params.phoneNumberId
    });

    // Provide more specific error messages based on the error type
    let errorMessage = 'Failed to unassign agent from phone number';
    let statusCode = 500;

    if (error.message?.includes('not found')) {
      errorMessage = 'Agent or phone number configuration not found. The assignment may have been manually removed.';
      statusCode = 404;
    } else if (error.message?.includes('API key')) {
      errorMessage = 'Agent configuration is invalid. Please check your agent settings.';
      statusCode = 400;
    } else if (error.message?.includes('Retell')) {
      errorMessage = 'Failed to communicate with voice provider. The assignment has been removed from our system.';
      statusCode = 200; // Still return success since database cleanup succeeded
    }

    return NextResponse.json(
      {
        error: errorMessage,
        success: statusCode === 200,
        message: statusCode === 200 ? 'Agent unassigned successfully (with warnings)' : undefined
      },
      { status: statusCode }
    );
  }
}

// Handle Retell unassignment for partner-owned numbers
async function handleRetellUnassignment(phoneNumber: any, _activeMapping: any, _partnerId: string) {
  // We never call the Retell API to delete the phone number during unassignment.
  // The number belongs to the partner and may be used outside Knotie — deleting
  // it from the provider would be destructive and irreversible.
  // Provider deletion is an explicit opt-in (future "also delete from provider"
  // checkbox in the delete confirmation modal).
  logger.info('Unassigning Retell agent — DB cleanup only, Retell API not called', {
    operation: 'retell_unassignment',
    phoneNumber: phoneNumber.phoneNumber
  });

  // Clean up SIP configuration if it exists
  await cleanupSipConfiguration(phoneNumber);

  // Clean up database records
  await prisma.$transaction(async (tx) => {
    // Delete agent phone mapping
    await tx.agentPhoneMapping.deleteMany({
      where: {
        phoneNumberId: phoneNumber.id,
        status: 'active'
      }
    });

    // Delete SIP configuration
    await tx.phoneNumberSipConfig.deleteMany({
      where: {
        phoneNumberId: phoneNumber.id
      }
    });

    logger.info('Cleaned up database records for phone number', {
      operation: 'database_cleanup',
      phoneNumberId: phoneNumber.id
    });
  });
}

// Handle VAPI unassignment
async function handleVapiUnassignment(phoneNumber: any, activeMapping: any, partnerId: string) {
  logger.info('Starting VAPI cleanup for phone number', {
    operation: 'vapi_unassignment',
    phoneNumber: phoneNumber.phoneNumber
  });

  // Get VAPI agent details for API key
  const vapiAgent = await prisma.vapiAgent.findFirst({
    where: {
      id: activeMapping.agentId,
      partnerId: partnerId
    },
    include: {
      partner: {
        select: {
          vapiApiKey: true
        }
      }
    }
  });

  // Get API key (agent-specific or partner fallback)
  let apiKey = vapiAgent?.apiKey;
  if (!apiKey && vapiAgent?.partner.vapiApiKey) {
    apiKey = vapiAgent.partner.vapiApiKey;
  }

  // If agent or API key not found, log warning but continue with database cleanup
  if (!vapiAgent || !apiKey) {
    logger.warn('VAPI agent or API key not found - proceeding with database cleanup only', {
      operation: 'vapi_unassignment',
      agentId: activeMapping.agentId
    });
  } else {
    // Try to delete phone number and credentials from VAPI if agent exists
    try {
      const decryptedApiKey = await decrypt(apiKey);

      // Extract VAPI phone number ID and credential ID from provider config
      const providerConfig = activeMapping.providerConfig;
      const vapiPhoneNumberId = providerConfig?.id;
      const credentialId = providerConfig?.credentialId;

      logger.debug('VAPI provider config details', {
        operation: 'vapi_unassignment',
        vapiPhoneNumberId,
        credentialId,
        hasProviderConfig: !!providerConfig
      });

      // Use VapiSipService for proper cleanup
      const { VapiSipService } = await import('@/lib/telephony/vapi-sip-service');
      const vapiSipService = new VapiSipService({ apiKey: decryptedApiKey });

      // STEP 1: Delete phone number from VAPI (if we have the ID)
      if (vapiPhoneNumberId) {
        try {
          await vapiSipService.deleteByoPhoneNumber(vapiPhoneNumberId);
          logger.info('Successfully removed phone number from VAPI', {
            operation: 'vapi_phone_removal',
            vapiPhoneNumberId
          });
        } catch (error: any) {
          if (error.message?.includes('404') || error.message?.includes('not found')) {
            logger.warn('Phone number not found in VAPI - may have been manually deleted', {
              operation: 'vapi_phone_removal',
              vapiPhoneNumberId
            });
          } else {
            logger.error('Failed to delete phone number from VAPI', error, {
              operation: 'vapi_phone_removal',
              vapiPhoneNumberId
            });
          }
        }
      } else {
        logger.warn('No VAPI phone number ID found in provider config, skipping phone number deletion', {
          operation: 'vapi_phone_removal'
        });
      }

      // STEP 2: Delete SIP credential from VAPI (if we have the ID)
      if (credentialId) {
        try {
          await vapiSipService.deleteSipCredential(credentialId);
          logger.info('Successfully removed SIP credential from VAPI', {
            operation: 'vapi_credential_removal',
            credentialId
          });
        } catch (error: any) {
          if (error.message?.includes('404') || error.message?.includes('not found')) {
            logger.warn('SIP credential not found in VAPI - may have been manually deleted', {
              operation: 'vapi_credential_removal',
              credentialId
            });
          } else {
            logger.error('Failed to delete SIP credential from VAPI', error, {
              operation: 'vapi_credential_removal',
              credentialId
            });
          }
        }
      } else {
        logger.warn('No credential ID found in provider config, skipping credential deletion', {
          operation: 'vapi_credential_removal'
        });
      }

    } catch (error: any) {
      logger.error('Error during VAPI cleanup', error, {
        operation: 'vapi_unassignment'
      });
      // Continue with database cleanup even if VAPI deletion fails
    }
  }

  // Clean up SIP configuration if it exists
  await cleanupSipConfiguration(phoneNumber);

  // Clean up database records
  await prisma.$transaction(async (tx) => {
    // Delete agent phone mapping
    await tx.agentPhoneMapping.deleteMany({
      where: {
        phoneNumberId: phoneNumber.id,
        status: 'active'
      }
    });

    // Delete SIP configuration
    await tx.phoneNumberSipConfig.deleteMany({
      where: {
        phoneNumberId: phoneNumber.id
      }
    });

    logger.info('Cleaned up database records for phone number', {
      operation: 'database_cleanup',
      phoneNumberId: phoneNumber.id
    });
  });
}

// Handle Knova unassignment
async function handleKnovaUnassignment(phoneNumber: any, activeMapping: any, _partnerId: string) {
  logger.info('Starting Knova cleanup for phone number', {
    operation: 'knova_unassignment',
    phoneNumber: phoneNumber.phoneNumber,
    agentId: activeMapping.agentId
  });

  // Knova agents are database-only, no external provider API call needed
  // Just need to clean up SIP configuration and database records

  // Clean up SIP configuration if it exists
  await cleanupSipConfiguration(phoneNumber);

  // Clean up database records
  await prisma.$transaction(async (tx) => {
    // Delete agent phone mapping
    await tx.agentPhoneMapping.deleteMany({
      where: {
        phoneNumberId: phoneNumber.id,
        status: 'active'
      }
    });

    // Delete SIP configuration
    await tx.phoneNumberSipConfig.deleteMany({
      where: {
        phoneNumberId: phoneNumber.id
      }
    });

    logger.info('Cleaned up database records for Knova phone number', {
      operation: 'knova_database_cleanup',
      phoneNumberId: phoneNumber.id,
      agentId: activeMapping.agentId
    });
  });

  logger.info('Knova unassignment completed successfully', {
    operation: 'knova_unassignment',
    phoneNumber: phoneNumber.phoneNumber
  });
}

// Clean up SIP configuration from telephony providers
async function cleanupSipConfiguration(phoneNumber: any) {
  try {
    // Get SIP configuration from database
    const sipConfig = await prisma.phoneNumberSipConfig.findFirst({
      where: {
        phoneNumberId: phoneNumber.id
      }
    });

    if (!sipConfig) {
      logger.info('No SIP configuration found for phone number', {
        operation: 'sip_cleanup',
        phoneNumber: phoneNumber.phoneNumber
      });
      return;
    }

    const providerType = phoneNumber.provider.includes('twilio') ? 'twilio' : 'telnyx';

    if (providerType === 'telnyx') {
      // Clean up Telnyx SIP connection
      await cleanupTelnyxSipConnection(phoneNumber, sipConfig);
    } else if (providerType === 'twilio') {
      // Clean up Twilio SIP trunk
      await cleanupTwilioSipTrunk(phoneNumber, sipConfig);
    }

  } catch (error: any) {
    logger.error('Error cleaning up SIP configuration', error, {
      operation: 'sip_cleanup'
    });
    // Don't throw error - continue with database cleanup even if SIP cleanup fails
  }
}

// Clean up Telnyx SIP connection
async function cleanupTelnyxSipConnection(phoneNumber: any, sipConfig: any) {
  try {
    // Get Telnyx credentials
    let providerCredentials;

    if (phoneNumber.provider === 'imported_telnyx') {
      // For imported numbers, use database credentials with specific provider account ID
      if (!phoneNumber.providerAccountId) {
        logger.warn('Imported Telnyx number missing provider account ID, skipping SIP cleanup', {
          operation: 'telnyx_sip_cleanup',
          phoneNumber: phoneNumber.phoneNumber
        });
        return;
      }

      providerCredentials = await prisma.phoneNumberProvider.findFirst({
        where: {
          partnerId: phoneNumber.partnerId,
          provider: 'telnyx',
          accountIdentifier: phoneNumber.providerAccountId
        }
      });
    } else {
      // For purchased numbers, use environment credentials
      providerCredentials = {
        credentials: JSON.stringify({
          apiKey: process.env.TELNYX_API_KEY
        }),
        provider: 'telnyx'
      };
    }

    if (!providerCredentials) {
      logger.warn('Telnyx credentials not found, skipping SIP cleanup', {
        operation: 'telnyx_sip_cleanup',
        phoneNumber: phoneNumber.phoneNumber
      });
      return;
    }

    let parsedCredentials;
    if (phoneNumber.provider === 'imported_telnyx') {
      const decryptedCredentials = await decrypt(providerCredentials.credentials);
      parsedCredentials = JSON.parse(decryptedCredentials);
    } else {
      parsedCredentials = JSON.parse(providerCredentials.credentials);
    }

    const telnyxSipService = new TelnyxSipService({
      apiKey: parsedCredentials.apiKey
    });

    // Remove SIP connection using the connection ID stored in sipTrunkSid
    // Pass the phone number to enable outbound voice profile cleanup
    if (sipConfig.sipTrunkSid) {
      await telnyxSipService.removeSipConnection(
        phoneNumber.phoneNumber.replace('+', ''),
        sipConfig.sipTrunkSid,
        phoneNumber.phoneNumber  // Pass phone number for outbound voice profile cleanup
      );
      logger.info('Successfully removed Telnyx SIP connection and associated resources', {
        operation: 'telnyx_sip_cleanup',
        sipTrunkSid: sipConfig.sipTrunkSid
      });
    }

  } catch (error: any) {
    logger.error('Error cleaning up Telnyx SIP connection', error, {
      operation: 'telnyx_sip_cleanup'
    });
    // Don't throw - continue with cleanup
  }
}

// Clean up Twilio SIP trunk
async function cleanupTwilioSipTrunk(phoneNumber: any, sipConfig: any) {
  try {
    logger.info('Starting Twilio SIP trunk cleanup', {
      operation: 'twilio_sip_cleanup',
      phoneNumber: phoneNumber.phoneNumber
    });

    // Get Twilio credentials
    let providerCredentials;

    if (phoneNumber.provider === 'imported_twilio') {
      // For imported numbers, use database credentials with specific provider account ID
      if (!phoneNumber.providerAccountId) {
        logger.warn('Imported Twilio number missing provider account ID, skipping SIP cleanup', {
          operation: 'twilio_sip_cleanup',
          phoneNumber: phoneNumber.phoneNumber
        });
        return;
      }

      providerCredentials = await prisma.phoneNumberProvider.findFirst({
        where: {
          customerId: phoneNumber.customerId,
          provider: 'twilio',
          accountIdentifier: phoneNumber.providerAccountId
        }
      });

      if (!providerCredentials) {
        // Fallback to partner-level credentials
        providerCredentials = await prisma.phoneNumberProvider.findFirst({
          where: {
            partnerId: phoneNumber.partnerId,
            provider: 'twilio'
          }
        });
      }

      if (!providerCredentials) {
        logger.warn('Twilio credentials not found for imported number, skipping SIP cleanup', {
          operation: 'twilio_sip_cleanup',
          phoneNumber: phoneNumber.phoneNumber
        });
        return;
      }

      // Parse and decrypt credentials for validation
      const { decrypt } = await import('@/lib/encryption');
      const decryptedCredentials = await decrypt(providerCredentials.credentials);
      const parsedCredentials = JSON.parse(decryptedCredentials);

      logger.debug('Using imported Twilio credentials', {
        operation: 'twilio_sip_cleanup',
        accountSid: parsedCredentials.accountSid
      });
    } else {
      logger.debug('Using environment Twilio credentials', {
        operation: 'twilio_sip_cleanup'
      });
    }

    const { TwilioSipService } = await import('@/lib/telephony/twilio-sip-service');
    const twilioSipService = new TwilioSipService();

    // STEP 1: Remove webhook URL from phone number first (if we have the phone number SID)
    // For imported numbers, use phoneNumberSid; for purchased numbers, use providerPhoneNumberId
    const phoneNumberSid = phoneNumber.phoneNumberSid || (phoneNumber as any).providerPhoneNumberId;

    logger.debug('Starting Twilio phone number cleanup', {
      operation: 'twilio_sip_cleanup',
      phoneNumber: phoneNumber.phoneNumber,
      phoneNumberSid: phoneNumber.phoneNumberSid,
      providerPhoneNumberId: (phoneNumber as any).providerPhoneNumberId,
      finalSid: phoneNumberSid,
      sipTrunkSid: sipConfig.sipTrunkSid,
      providerAccountId: phoneNumber.providerAccountId
    });

    if (phoneNumberSid) {
      try {
        logger.debug('Calling unassignPhoneNumberFromTrunk', {
          operation: 'twilio_sip_cleanup',
          phoneNumberSid
        });
        await twilioSipService.unassignPhoneNumberFromTrunk(
          phoneNumberSid,
          sipConfig.sipTrunkSid,
          phoneNumber.providerAccountId
        );
        logger.info('Successfully removed trunk assignment and switched to webhook routing', {
          operation: 'twilio_sip_cleanup',
          phoneNumberSid
        });
      } catch (error: any) {
        logger.error('Failed to remove trunk assignment from phone number', error, {
          operation: 'twilio_sip_cleanup',
          phoneNumberSid
        });
        // Continue with cleanup
      }
    } else {
      logger.warn('No phoneNumberSid or providerPhoneNumberId found, skipping phone number cleanup', {
        operation: 'twilio_sip_cleanup',
        phoneNumber: phoneNumber.phoneNumber,
        phoneNumberObject: JSON.stringify(phoneNumber, null, 2)
      });
    }

    // STEP 2: Delete SIP trunk (this may fail if trunk doesn't exist, but that's OK)
    if (sipConfig.sipTrunkSid) {
      try {
        await twilioSipService.deleteSipTrunk(sipConfig.sipTrunkSid, phoneNumber.providerAccountId);
        logger.info('Successfully deleted Twilio SIP trunk', {
          operation: 'twilio_sip_cleanup',
          sipTrunkSid: sipConfig.sipTrunkSid
        });
      } catch (error: any) {
        if (error.message?.includes('not found') || error.message?.includes('404')) {
          logger.warn('SIP trunk not found - may have been manually deleted', {
            operation: 'twilio_sip_cleanup',
            sipTrunkSid: sipConfig.sipTrunkSid
          });
        } else {
          logger.error('Failed to delete SIP trunk', error, {
            operation: 'twilio_sip_cleanup',
            sipTrunkSid: sipConfig.sipTrunkSid
          });
        }
        // Continue - trunk deletion failure doesn't prevent phone number cleanup
      }
    }

    logger.info('Completed Twilio SIP trunk cleanup', {
      operation: 'twilio_sip_cleanup',
      phoneNumber: phoneNumber.phoneNumber
    });

  } catch (error: any) {
    logger.error('Error cleaning up Twilio SIP trunk', error, {
      operation: 'twilio_sip_cleanup'
    });
    // Don't throw - continue with cleanup
  }
}

// Manual cleanup function for Twilio phone numbers stuck in SIP trunk routing
async function forceCleanupTwilioPhoneNumber(phoneNumber: any) {
  if (phoneNumber.provider !== 'imported_twilio' || !phoneNumber.phoneNumberSid) {
    logger.debug('Skipping force cleanup - not an imported Twilio number or missing SID', {
      operation: 'force_cleanup_twilio',
      provider: phoneNumber.provider,
      hasPhoneNumberSid: !!phoneNumber.phoneNumberSid
    });
    return;
  }

  try {
    logger.info('Starting manual cleanup for Twilio phone number', {
      operation: 'force_cleanup_twilio',
      phoneNumber: phoneNumber.phoneNumber,
      phoneNumberSid: phoneNumber.phoneNumberSid,
      providerAccountId: phoneNumber.providerAccountId
    });

    // Get Twilio credentials
    let providerCredentials;
    if (phoneNumber.providerAccountId) {
      providerCredentials = await prisma.phoneNumberProvider.findFirst({
        where: {
          customerId: phoneNumber.customerId,
          provider: 'twilio',
          accountIdentifier: phoneNumber.providerAccountId
        }
      });

      if (!providerCredentials) {
        // Fallback to partner-level credentials
        providerCredentials = await prisma.phoneNumberProvider.findFirst({
          where: {
            partnerId: phoneNumber.partnerId,
            provider: 'twilio'
          }
        });
      }
    }

    if (!providerCredentials) {
      logger.warn('No Twilio credentials found, cannot clean up phone number', {
        operation: 'force_cleanup_twilio',
        phoneNumber: phoneNumber.phoneNumber
      });
      return;
    }

    // Decrypt credentials
    const { decrypt } = await import('@/lib/encryption');
    const decryptedCredentials = JSON.parse(await decrypt(providerCredentials.credentials));
    logger.debug('Using imported credentials for force cleanup', {
      operation: 'force_cleanup_twilio',
      providerAccountId: phoneNumber.providerAccountId
    });

    // Create Twilio client and force update phone number to webhook routing
    const { TwilioClient } = await import('@/lib/twilio');
    const twilioClient = new TwilioClient(decryptedCredentials);

    const defaultWebhookUrl = `${process.env.CONNECT_HUB_URL || 'https://connecthub.knotie-ai.pro'}/webhook/twilio/default`;

    logger.info('Forcing phone number to webhook routing', {
      operation: 'force_cleanup_twilio',
      phoneNumberSid: phoneNumber.phoneNumberSid,
      defaultWebhookUrl
    });
    await twilioClient.updatePhoneNumber(phoneNumber.phoneNumberSid, {
      trunkSid: '', // Remove any SIP trunk assignment
      voiceUrl: defaultWebhookUrl,
      voiceMethod: 'POST',
      smsUrl: defaultWebhookUrl,
      smsMethod: 'POST'
    });

    logger.info('Successfully forced phone number back to webhook routing', {
      operation: 'force_cleanup_twilio',
      phoneNumber: phoneNumber.phoneNumber,
      phoneNumberSid: phoneNumber.phoneNumberSid
    });

  } catch (error: any) {
    logger.error('Failed to force cleanup phone number', error, {
      operation: 'force_cleanup_twilio',
      phoneNumber: phoneNumber.phoneNumber
    });
  }
}
