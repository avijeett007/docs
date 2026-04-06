import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomerAuth } from '@/lib/auth/customerAuth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import axios from 'axios';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    // Verify customer authentication
    const customerAuth = await verifyCustomerAuth(request);

    if (!customerAuth) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { customerId, partnerId } = customerAuth;
    const { agentId } = params;
    const requestBody = await request.json();
    const { agentType } = requestBody;

    console.log('[whitelabel-test] Creating test call for agent:', {
      agentId,
      agentType,
      customerId,
      partnerId,
      requestBody
    });

    // Check if customer has AI Credits enabled and sufficient balance
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        aiCreditsEnabled: true,
        creditBalance: true
      }
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // If AI Credits are enabled, check if customer has sufficient balance
    if (customer.aiCreditsEnabled && (customer.creditBalance || 0) <= 0) {
      return NextResponse.json(
        {
          error: 'Insufficient AI Credits',
          message: 'You have no AI Credits remaining. Please contact your provider to add more credits before testing agents.'
        },
        { status: 402 } // Payment Required
      );
    }

    // First, let's find which table this agent actually belongs to
    // by checking all agent tables for this customer
    let agent: any = null;
    let actualAgentType: string = agentType;

    // Try to find the agent in each table
    // Note: Using findFirst like partner portal and filtering by partnerId + customerId
    const vapiAgent = await prisma.vapiAgent.findFirst({
      where: {
        id: agentId,
        partnerId: partnerId,
        customerId: customerId
      },
      select: {
        id: true,
        name: true,
        apiKey: true,
        publicKey: true, // This is the key field for VAPI testing
        partner: {
          select: {
            vapiApiKey: true,
            vapiPublicKey: true // Partner-level fallback
          }
        }
      }
    });

    const retellAgent = await prisma.retellAgent.findFirst({
      where: {
        id: agentId,
        partnerId: partnerId,
        customerId: customerId
      },
      select: {
        id: true,
        name: true,
        apiKey: true,
        partner: {
          select: {
            retellApiKey: true
          }
        }
      }
    });

    const ultravoxAgent = await prisma.ultravoxAgent.findFirst({
      where: {
        id: agentId,
        partnerId: partnerId,
        customerId: customerId
      },
      select: {
        id: true,
        name: true,
        apiKey: true,
        systemPrompt: true,
        temperature: true,
        model: true,
        voice: true,
        languageHint: true,
        recordingEnabled: true,
        maxDuration: true,
        timeExceededMessage: true,
        partner: {
          select: {
            ultravoxApiKey: true
          }
        }
      }
    });

    const ghlAgent = await prisma.ghlAgent.findFirst({
      where: {
        id: agentId,
        partnerId: partnerId,
        customerId: customerId
      },
      select: {
        id: true,
        name: true
      }
    });

    // Check for ElevenLabs agent
    const elevenLabsAgent = await prisma.elevenLabsAgent.findFirst({
      where: {
        id: agentId,
        partnerId: partnerId,
        customerId: customerId
      },
      select: {
        id: true,
        name: true,
        apiKey: true
      }
    });

    console.log('[whitelabel-test] Agent query results:', {
      agentId,
      customerId,
      partnerId,
      vapiAgent: vapiAgent ? { id: vapiAgent.id, name: vapiAgent.name, hasPublicKey: !!vapiAgent.publicKey, hasPartnerPublicKey: !!vapiAgent.partner?.vapiPublicKey } : null,
      retellAgent: retellAgent ? { id: retellAgent.id, name: retellAgent.name } : null,
      ultravoxAgent: ultravoxAgent ? { id: ultravoxAgent.id, name: ultravoxAgent.name } : null,
      ghlAgent: ghlAgent ? { id: ghlAgent.id, name: ghlAgent.name } : null,
      elevenLabsAgent: elevenLabsAgent ? { id: elevenLabsAgent.id, name: elevenLabsAgent.name } : null
    });

    // Determine which agent was found and set the actual type
    if (vapiAgent) {
      agent = vapiAgent;
      actualAgentType = 'vapi';
    } else if (retellAgent) {
      agent = retellAgent;
      actualAgentType = 'retell';
    } else if (ultravoxAgent) {
      agent = ultravoxAgent;
      actualAgentType = 'ultravox';
    } else if (elevenLabsAgent) {
      agent = elevenLabsAgent;
      actualAgentType = 'elevenlabs';
    } else if (ghlAgent) {
      agent = ghlAgent;
      actualAgentType = 'ghl';
    } else {
      return NextResponse.json(
        { error: 'Agent not found or unauthorized' },
        { status: 404 }
      );
    }

    console.log('[whitelabel-test] Found agent:', {
      agentId: agent.id,
      agentName: agent.name,
      actualType: actualAgentType,
      providedType: agentType,
      hasPublicKey: actualAgentType === 'vapi' ? !!agent.publicKey : 'N/A',
      hasPartnerPublicKey: actualAgentType === 'vapi' ? !!agent.partner?.vapiPublicKey : 'N/A'
    });

    // Now handle the test call creation based on the actual agent type
    switch (actualAgentType) {
      case 'vapi':
        // For VAPI, we need the public key for testing
        // Check agent-specific public key first, then partner-level
        const publicKey = agent.publicKey || agent.partner.vapiPublicKey;
        if (!publicKey) {
          return NextResponse.json(
            { error: 'Agent configuration incomplete. Please contact support.' },
            { status: 400 }
          );
        }

        // Return test configuration like partner API
        return NextResponse.json({
          success: true,
          provider: 'vapi', // Add provider field for frontend
          publicKey: publicKey,
          agentId: agent.id,
          agentName: agent.name
        });
        break;

      case 'retell':

        // For Retell, create a web call
        // Determine which API key to use: agent's key first, then partner's key
        let decryptedRetellApiKey: string;

        if (agent.apiKey) {
          // Use agent's individual API key
          decryptedRetellApiKey = await decrypt(agent.apiKey);
          console.log('[whitelabel-test] Using agent-specific API key for Retell testing');
        } else if (agent.partner?.retellApiKey) {
          // Fallback to partner's API key
          decryptedRetellApiKey = await decrypt(agent.partner.retellApiKey);
          console.log('[whitelabel-test] Using partner API key for Retell testing (agent has no individual key)');
        } else {
          return NextResponse.json({
            error: 'No API key available',
            message: 'Neither agent-specific nor partner API key found for Retell testing'
          }, { status: 400 });
        }

        // Create web call payload matching partner portal structure
        const webCallPayload = {
          agent_id: agentId,
          metadata: {
            test_call: true,
            customer_id: customerId,
            partner_id: partnerId,
            agent_name: agent.name,
            created_at: new Date().toISOString(),
          },
          retell_llm_dynamic_variables: {},
        };

        console.log('[whitelabel-test] Creating Retell web call with payload:', JSON.stringify(webCallPayload, null, 2));

        try {
          const webCallResponse = await axios.post(
            'https://api.retellai.com/v2/create-web-call',
            webCallPayload,
            {
              headers: {
                'Authorization': `Bearer ${decryptedRetellApiKey}`,
                'Content-Type': 'application/json',
              },
            }
          );

          console.log('[whitelabel-test] Retell web call created successfully:', webCallResponse.data.call_id);

          const { access_token, call_id } = webCallResponse.data;

          if (!access_token || !call_id) {
            throw new Error('Invalid response from Retell API - missing access token or call ID');
          }

          // Calculate expiration time (Retell tokens typically expire in 1 hour)
          const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

          console.log('[whitelabel-test] Test call created successfully:', {
            callId: call_id,
            agentId: agent.id,
            customerId,
            partnerId
          });

          // Return test call data like partner API (secure - no API keys exposed)
          return NextResponse.json({
            success: true,
            provider: 'retell', // Add provider field for frontend
            testCall: {
              accessToken: access_token,
              callId: call_id,
              agentName: agent.name,
              expiresAt: expiresAt,
            }
          });
        } catch (error: any) {
          console.error('[whitelabel-test] Error creating Retell web call:', error.response?.data || error.message);

          // Handle specific Retell API errors with user-friendly messages
          if (error.response?.status === 403) {
            return NextResponse.json({
              error: 'Service temporarily unavailable. Please try again later.',
            }, { status: 403 });
          }

          if (error.response?.status === 401) {
            return NextResponse.json({
              error: 'Agent configuration error. Please contact support.',
            }, { status: 401 });
          }

          if (error.message?.includes('quota') || error.message?.includes('Trial over') || error.message?.includes('add payment')) {
            return NextResponse.json({
              error: 'Service temporarily unavailable. Please try again later.',
            }, { status: 403 });
          }

          if (error.message?.includes('Invalid API key')) {
            return NextResponse.json({
              error: 'Agent configuration error. Please contact support.',
            }, { status: 401 });
          }

          // Generic error for any other issues
          return NextResponse.json({
            error: 'Unable to start test call. Please try again later.',
          }, { status: 500 });
        }
        break;

      case 'ultravox':
        // For Ultravox, create a test call
        // Determine which API key to use: agent's key first, then partner's key
        let decryptedUltravoxApiKey: string;

        if (agent.apiKey) {
          // Use agent's individual API key
          decryptedUltravoxApiKey = await decrypt(agent.apiKey);
          console.log('[whitelabel-test] Using agent-specific API key for Ultravox testing');
        } else if (agent.partner?.ultravoxApiKey) {
          // Fallback to partner's API key
          decryptedUltravoxApiKey = await decrypt(agent.partner.ultravoxApiKey);
          console.log('[whitelabel-test] Using partner API key for Ultravox testing (agent has no individual key)');
        } else {
          return NextResponse.json({
            error: 'No API key available',
            message: 'Neither agent-specific nor partner API key found for Ultravox testing'
          }, { status: 400 });
        }
        
        try {
          // Use the agent's configuration for the call (same as partner portal)
          const callData = {
            systemPrompt: agent.systemPrompt || `You are testing agent ${agent.name}. This is a test call from the customer portal.`,
            temperature: agent.temperature || 0.7,
            model: agent.model || 'fixie-ai/ultravox',
            voice: agent.voice || 'terrence',
            languageHint: agent.languageHint || 'en',
            recordingEnabled: agent.recordingEnabled ?? false,
            maxDuration: agent.maxDuration || '600s',
            timeExceededMessage: agent.timeExceededMessage || undefined,
            medium: { webRtc: {} } // For web calls
          };

          console.log('[whitelabel-test] Creating Ultravox call with agent config:', JSON.stringify(callData, null, 2));

          const callResponse = await axios.post(
            'https://api.ultravox.ai/api/calls',
            callData,
            {
              headers: {
                'X-API-Key': decryptedUltravoxApiKey,
                'Content-Type': 'application/json',
              },
            }
          );

          const call = callResponse.data;

          // Return test call data directly like partner API
          return NextResponse.json({
            success: true,
            provider: 'ultravox', // Add provider field for frontend
            testCall: {
              id: call.callId,
              type: 'web',
              status: 'created',
              callUrl: call.joinUrl,
              agentId: agent.id,
              agentName: agent.name,
              createdAt: call.created,
              expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
            }
          });
        } catch (error: any) {
          console.error('[whitelabel-test] Error creating Ultravox call:', error.response?.data || error.message);

          // Handle specific Ultravox API errors with user-friendly messages
          if (error.response?.status === 403) {
            return NextResponse.json({
              error: 'Service temporarily unavailable. Please try again later.',
            }, { status: 403 });
          }

          if (error.response?.status === 401) {
            return NextResponse.json({
              error: 'Agent configuration error. Please contact support.',
            }, { status: 401 });
          }

          // Generic error for any other issues
          return NextResponse.json({
            error: 'Unable to start test call. Please try again later.',
          }, { status: 500 });
        }
        break;

      case 'elevenlabs':
        // For ElevenLabs, we need the API key for testing
        let decryptedElevenLabsApiKey: string;

        if (agent.apiKey) {
          // Use agent's individual API key
          decryptedElevenLabsApiKey = await decrypt(agent.apiKey);
          console.log('[whitelabel-test] Using agent-specific API key for ElevenLabs testing');
        } else {
          return NextResponse.json({
            error: 'No API key available',
            message: 'Neither agent-specific nor partner API key found for ElevenLabs testing'
          }, { status: 400 });
        }

        try {
          // Get signed URL from ElevenLabs API using the ElevenLabs agent ID
          const elevenLabsResponse = await axios.get(
            `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agent.id}`,
            {
              headers: {
                'xi-api-key': decryptedElevenLabsApiKey,
                'Content-Type': 'application/json'
              }
            }
          );

          const elevenLabsData = elevenLabsResponse.data;

          // Return test configuration
          return NextResponse.json({
            success: true,
            provider: 'elevenlabs',
            testCall: {
              signedUrl: elevenLabsData.signed_url,
              agentId: agent.id,
              agentName: agent.name,
              provider: 'elevenlabs'
            },
            agentId: agent.id,
            agentName: agent.name
          });
        } catch (error: any) {
          console.error('[whitelabel-test] Error getting ElevenLabs signed URL:', error.response?.data || error.message);

          if (error.response?.status === 401) {
            return NextResponse.json({
              error: 'Invalid API key',
              message: 'The API key for this agent is invalid or expired. Please contact your provider.'
            }, { status: 400 });
          }

          if (error.response?.status === 404) {
            return NextResponse.json({
              error: 'Agent not found',
              message: 'This agent was not found in ElevenLabs. It may have been deleted.'
            }, { status: 400 });
          }

          return NextResponse.json({
            error: 'Unable to start ElevenLabs test call. Please try again later.',
          }, { status: 500 });
        }
        break;

      case 'ghl':
      case 'knova':
        return NextResponse.json(
          { error: 'Testing not supported for this agent type yet. This feature is coming soon!' },
          { status: 400 }
        );

      default:
        return NextResponse.json(
          { error: 'Unknown agent type' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('[whitelabel-test] Error creating test call:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
