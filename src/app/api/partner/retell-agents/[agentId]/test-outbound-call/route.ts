import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { logger } from '@/lib/logger';
import axios from 'axios';

export async function POST(
  req: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    // Verify the partner JWT
    const decoded = await verifyPartnerJWT(req);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;
    const agentId = params.agentId;

    const { toNumber, fromNumberId } = await req.json();

    logger.info('Starting outbound test call creation', {
      operation: 'test_outbound_call',
      agentId,
      partnerId
    });

    // Validate input
    if (!toNumber) {
      return NextResponse.json({
        error: 'Phone number to call is required'
      }, { status: 400 });
    }

    if (!fromNumberId) {
      return NextResponse.json({
        error: 'From phone number is required'
      }, { status: 400 });
    }

    // Validate phone number format (basic E.164 format check)
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(toNumber)) {
      return NextResponse.json({
        error: 'Invalid phone number format. Please use E.164 format (e.g., +1234567890)'
      }, { status: 400 });
    }

    // Get the agent from database with API key
    const agent = await prisma.retellAgent.findUnique({
      where: {
        id: agentId,
        partnerId: partnerId,
      },
      select: {
        id: true,
        name: true,
        apiKey: true,
      },
    });

    if (!agent) {
      return NextResponse.json({
        error: 'Agent not found or not owned by partner'
      }, { status: 404 });
    }

    // Get the from phone number and verify it's associated with this agent
    const phoneMapping = await prisma.agentPhoneMapping.findFirst({
      where: {
        phoneNumberId: fromNumberId,
        agentId: agentId,
        agentProvider: 'retell',
        partnerId: partnerId,
        status: 'active',
        outboundEnabled: true,
      },
      include: {
        phoneNumber: {
          select: {
            phoneNumber: true,
            capabilities: true,
            type: true,
          }
        }
      }
    });

    if (!phoneMapping) {
      return NextResponse.json({
        error: 'Phone number not found or not configured for outbound calls with this agent'
      }, { status: 404 });
    }

    // Check if phone number supports voice calls (outbound capability)
    const capabilities = phoneMapping.phoneNumber.capabilities as any || {};
    const canSendOutbound = capabilities.voice === true || capabilities.VOICE === true;

    if (!canSendOutbound) {
      return NextResponse.json({
        error: 'This phone number is not capable of making outbound calls'
      }, { status: 400 });
    }

    // Get API key (try agent-specific first, then partner fallback)
    let apiKey = agent.apiKey;
    if (!apiKey) {
      // Fallback to partner's API key
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: { retellApiKey: true }
      });

      if (!partner?.retellApiKey) {
        return NextResponse.json({
          error: 'No Retell API key configured for this agent or partner'
        }, { status: 400 });
      }

      apiKey = partner.retellApiKey;
    }

    // Decrypt the API key
    const decryptedApiKey = await decrypt(apiKey);

    // Prepare the outbound call payload
    const outboundCallPayload = {
      from_number: phoneMapping.phoneNumber.phoneNumber,
      to_number: toNumber,
      override_agent_id: agentId,
      metadata: {
        test_call: true,
        partner_id: partnerId,
        agent_name: agent.name,
        initiated_by: 'knotie_test_system'
      }
    };

    logger.info('Creating outbound call for testing', {
      operation: 'test_outbound_call',
      agentId: params.agentId,
      toNumber: toNumber,
      fromNumber: outboundCallPayload.from_number
    });
    logger.debug('API key validation completed', {
      operation: 'test_outbound_call',
      apiKeyType: typeof decryptedApiKey,
      hasApiKey: !!decryptedApiKey
    });

    // Make the API call to Retell
    let outboundCallResponse;
    try {
      logger.debug('Making API call to Retell', {
        operation: 'test_outbound_call',
        endpoint: 'create-phone-call'
      });
      outboundCallResponse = await axios.post(
        'https://api.retellai.com/v2/create-phone-call',
        outboundCallPayload,
        {
          headers: {
            'Authorization': `Bearer ${String(decryptedApiKey)}`,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info('Outbound call created successfully', {
        operation: 'test_outbound_call',
        callId: outboundCallResponse.data.call_id
      });
    } catch (error: any) {
      logger.error('Error creating outbound call', error, {
        operation: 'test_outbound_call',
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        url: error.config?.url,
        method: error.config?.method
      });

      // Handle specific Retell API errors
      if (error.response?.status === 403) {
        return NextResponse.json({
          error: 'quota_exceeded',
          message: 'Your Retell account has reached its usage limit. Please upgrade your plan to continue testing.',
        }, { status: 403 });
      }

      if (error.response?.status === 401) {
        return NextResponse.json({
          error: 'invalid_api_key',
          message: 'Your Retell API key appears to be invalid.',
        }, { status: 401 });
      }

      if (error.response?.status === 400) {
        return NextResponse.json({
          error: 'invalid_request',
          message: error.response.data?.message || 'Invalid request to Retell API',
        }, { status: 400 });
      }

      return NextResponse.json({
        error: 'retell_api_error',
        message: 'Failed to create outbound call with Retell API',
        details: error.response?.data || error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      call: outboundCallResponse.data,
      message: 'Outbound test call initiated successfully'
    });

  } catch (error) {
    logger.error('Error creating outbound test call', error as Error, {
      operation: 'test_outbound_call'
    });
    return NextResponse.json({
      error: 'Failed to create outbound test call',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
