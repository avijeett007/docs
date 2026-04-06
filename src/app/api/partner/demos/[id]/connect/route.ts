import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { verifyPartnerJWT } from '@/lib/auth';
import { decrypt } from '@/lib/encryption';
import axios from 'axios';



export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Verify the partner JWT
    const decoded = await verifyPartnerJWT(req);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;

    // Get the partner
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId }
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    // Check if partner has Retell API key
    if (!partner.retellApiKey) {
      return NextResponse.json({ error: 'Retell API key is required' }, { status: 400 });
    }

    const demoId = params.id;

    // Get partner demo
    const partnerDemo = await prisma.partnerDemo.findUnique({
      where: {
        partnerId_demoSystemId: {
          partnerId: partnerId,
          demoSystemId: demoId,
        },
      },
      include: {
        demoSystem: true,
      },
    });

    if (!partnerDemo) {
      return NextResponse.json({ error: 'Demo not deployed' }, { status: 404 });
    }

    if (partnerDemo.status !== 'DEPLOYED' || !partnerDemo.deployedAgentId) {
      return NextResponse.json({ error: 'Demo not deployed' }, { status: 400 });
    }

    // Create dynamic variables based on customizations
    const dynamicVariables: Record<string, string> = {};

    if (partnerDemo.customBusinessName) {
      dynamicVariables.business_name = partnerDemo.customBusinessName;
    }

    if (partnerDemo.demoSystem.isOutbound && partnerDemo.customCharacterName) {
      dynamicVariables.customer_name = partnerDemo.customCharacterName;
    }

    // Decrypt the Retell API key
    const decryptedApiKey = await decrypt(partner.retellApiKey);
    console.log('[connect/route] Successfully decrypted Retell API key - length:', decryptedApiKey.length);

    // Create web call
    console.log('[connect/route] Creating web call for agent ID:', partnerDemo.deployedAgentId);
    console.log('[connect/route] Dynamic variables:', dynamicVariables);

    let response;
    try {
      response = await axios.post(
        'https://api.retellai.com/v2/create-web-call',
        {
          agent_id: partnerDemo.deployedAgentId,
          retell_llm_dynamic_variables: dynamicVariables,
        },
        {
          headers: {
            'Authorization': `Bearer ${decryptedApiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
      console.log('[connect/route] Web call created successfully:', response.data);
    } catch (error: any) {
      console.error('[connect/route] Error creating web call:', error.response?.data || error.message);
      
      // Extract detailed error information from Retell API
      const errorMessage = error.response?.data?.message || error.message;
      const errorCode = error.response?.status || 'unknown';
      
      // Handle specific Retell error messages and return proper JSON responses instead of throwing errors
      if (errorMessage.includes('Trial over quota') || errorMessage.includes('add payment')) {
        return NextResponse.json({
          error: 'quota_exceeded',
          message: 'Your Retell account has reached its usage limit. Please upgrade your plan to continue using the demo.',
          title: 'Usage Limit Reached'
        }, { status: 403 });
      } else if (errorMessage.includes('Invalid API key')) {
        return NextResponse.json({
          error: 'invalid_api_key',
          message: 'Your Retell API key appears to be invalid. Please check your settings and update your API key.',
          title: 'Invalid API Key'
        }, { status: 401 });
      } else if (errorMessage.includes('not found') && errorMessage.includes('agent')) {
        return NextResponse.json({
          error: 'agent_not_found',
          message: 'The AI agent for this demo could not be found. It may have been deleted from your Retell account.',
          title: 'Agent Not Found'
        }, { status: 404 });
      } else {
        return NextResponse.json({
          error: 'retell_error',
          message: `There was an error with the Retell service: ${errorMessage}`,
          title: 'Retell Service Error',
          details: { code: errorCode, originalMessage: errorMessage }
        }, { status: 500 });
      }
    }

    // Update partner demo with test count
    await prisma.partnerDemo.update({
      where: { id: partnerDemo.id },
      data: {
        lastTestedAt: new Date(),
        testCount: { increment: 1 },
      },
    });

    return NextResponse.json({
      success: true,
      connection: {
        access_token: response.data.access_token,
        call_id: response.data.call_id,
        demo: {
          name: partnerDemo.demoSystem.name,
          businessName: partnerDemo.customBusinessName,
          characterName: partnerDemo.customCharacterName,
          isOutbound: partnerDemo.demoSystem.isOutbound,
        }
      }
    });
  } catch (error: any) {
    console.error('Error connecting to demo:', error);

    // Generic error handling for any other errors
    const errorMessage = error.message || 'An unexpected error occurred';
    
    // Check for common error patterns in the message
    if (errorMessage.includes('quota') || errorMessage.includes('payment') || errorMessage.includes('Trial over')) {
      return NextResponse.json({
        error: 'quota_exceeded',
        message: 'Your Retell account has reached its usage limit. Please upgrade your plan to continue using the demo.',
        title: 'Usage Limit Reached'
      }, { status: 403 });
    } 
    
    if (errorMessage.includes('API key') || errorMessage.includes('Invalid API') || errorMessage.includes('authentication')) {
      return NextResponse.json({
        error: 'invalid_api_key',
        message: 'Your Retell API key appears to be invalid. Please check your settings and update your API key.',
        title: 'Invalid API Key'
      }, { status: 401 });
    }
    
    if (errorMessage.includes('not found') && errorMessage.includes('agent')) {
      return NextResponse.json({
        error: 'agent_not_found',
        message: 'The AI agent for this demo could not be found. It may have been deleted from your Retell account.',
        title: 'Agent Not Found'
      }, { status: 404 });
    }

    // Catch Forbidden errors which are often related to quota
    if (error.response && error.response.status === 403) {
      return NextResponse.json({
        error: 'quota_exceeded',
        message: 'Your Retell account has reached its usage limit. Please upgrade your plan to continue using the demo.',
        title: 'Usage Limit Reached'
      }, { status: 403 });
    }
    
    // Handle other API errors
    if (error.response && error.response.data) {
      return NextResponse.json({
        error: 'connection_failed',
        message: 'Failed to connect to the demo. Please try again later.',
        title: 'Connection Failed',
        details: error.response.data
      }, { status: error.response.status || 500 });
    }

    // Generic error fallback
    return NextResponse.json({
      error: 'unknown_error',
      message: 'An unexpected error occurred. Please try again later.',
      title: 'Connection Error'
    }, { status: 500 });
  }
}
