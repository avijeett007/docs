import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

export const dynamic = 'force-dynamic';

// Helper function to validate domain against allowed domains (same as widget-config)
function isDomainAllowed(origin: string, allowedDomains: string[], referer?: string): boolean {
  if (!allowedDomains || allowedDomains.length === 0) {
    return true; // No restrictions
  }

  // Always allow the widget hosting domain
  const widgetAppUrl = process.env.WIDGET_APP_URL || process.env.NEXT_PUBLIC_WIDGET_APP_URL || 'https://widgets.knotie-ai.pro';
  const widgetDomain = new URL(widgetAppUrl).hostname;

  try {
    const originUrl = new URL(origin);
    const originDomain = originUrl.hostname;

    // Check if this is the widget hosting domain - always allow
    if (originDomain === widgetDomain) {
      console.log('[Domain Validation] Widget hosting domain allowed:', originDomain);
      return true;
    }

    // If we have a referer, also check that domain (this is the actual embedding domain)
    let domainsToCheck = [originDomain];
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        const refererDomain = refererUrl.hostname;
        if (refererDomain !== originDomain) {
          domainsToCheck.push(refererDomain);
          console.log('[Domain Validation] Also checking referer domain:', refererDomain);
        }
      } catch (e) {
        console.log('[Domain Validation] Invalid referer URL:', referer);
      }
    }

    // Flatten domains and add widget hosting domain
    const flattenedDomains = allowedDomains.flatMap(domain => {
      if (typeof domain === 'string' && domain.includes(',')) {
        return domain.split(',').map(d => d.trim());
      }
      return [domain];
    }).filter(d => d && d.length > 0);

    if (!flattenedDomains.includes(widgetDomain)) {
      flattenedDomains.push(widgetDomain);
    }

    console.log('[Domain Validation] Domains to check:', domainsToCheck);
    console.log('[Domain Validation] Flattened allowed domains:', flattenedDomains);

    // Check each domain against allowed domains
    return domainsToCheck.some(domainToCheck => {
      return flattenedDomains.some(allowed => {
        const cleanAllowed = allowed.replace(/^https?:\/\//, '');

        if (cleanAllowed === domainToCheck) {
          console.log('[Domain Validation] Exact match:', cleanAllowed, 'for domain:', domainToCheck);
          return true;
        }

        if (cleanAllowed.startsWith('*.')) {
          const baseDomain = cleanAllowed.substring(2);
          const matches = domainToCheck.endsWith('.' + baseDomain) || domainToCheck === baseDomain;
          if (matches) {
            console.log('[Domain Validation] Wildcard match:', cleanAllowed, 'for domain:', domainToCheck);
          }
          return matches;
        }

        if (domainToCheck.endsWith('.' + cleanAllowed)) {
          console.log('[Domain Validation] Subdomain match:', cleanAllowed, 'for domain:', domainToCheck);
          return true;
        }

        return false;
      });
    });
  } catch (error) {
    console.error('Error parsing origin URL:', error);
    return false;
  }
}

// Generate call token for widget users
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token: widgetToken, origin, referer } = body;

    if (!widgetToken) {
      return NextResponse.json(
        { success: false, error: 'Widget token is required' },
        { status: 400 }
      );
    }

    console.log('[Widget Call Token] Request for token:', widgetToken);

    // Find widget by token
    const widget = await prisma.agentWidget.findUnique({
      where: {
        widgetToken: widgetToken
      },
      include: {
        partner: {
          select: {
            id: true,
            businessName: true,
            vapiApiKey: true,
            vapiPublicKey: true,
            retellApiKey: true,
            ultravoxApiKey: true,
          }
        }
      }
    });

    if (!widget) {
      return NextResponse.json(
        { success: false, error: 'Widget not found' },
        { status: 404 }
      );
    }

    if (!widget.isActive) {
      return NextResponse.json(
        { success: false, error: 'Widget is not active' },
        { status: 403 }
      );
    }

    // SECURITY: Require origin for all requests and validate against allowed domains
    if (!origin) {
      return NextResponse.json(
        { success: false, error: 'Origin header is required for security' },
        { status: 400 }
      );
    }

    // Use improved domain validation
    if (!isDomainAllowed(origin, widget.allowedDomains || [], referer)) {
      console.warn('[Widget Call Token] Unauthorized domain access attempt:', {
        origin,
        referer,
        allowedDomains: widget.allowedDomains,
        widgetToken: widgetToken.substring(0, 10) + '...'
      });
      return NextResponse.json(
        { success: false, error: 'Domain not authorized for this widget' },
        { status: 403 }
      );
    }

    // Generate call credentials based on agent type - get API keys from agent itself
    let callCredentials: any = {};

    try {
      switch (widget.agentType) {
        case 'vapi':
          // Get VAPI agent and its API key
          const vapiAgent = await prisma.vapiAgent.findUnique({
            where: { id: widget.agentId }
          });

          if (vapiAgent?.apiKey) {
            const publicKey = await decrypt(vapiAgent.apiKey);
            callCredentials = {
              publicKey,
              agentId: widget.agentId
            };
            console.log('[Widget Call Token] VAPI credentials generated from agent');
          } else {
            throw new Error('VAPI API key not configured for this agent');
          }
          break;

        case 'retell':
          // Get Retell agent and its API key
          const retellAgent = await prisma.retellAgent.findUnique({
            where: { id: widget.agentId }
          });

          if (retellAgent?.apiKey) {
            const apiKey = await decrypt(retellAgent.apiKey);

            // Create a Retell web call to get the access token
            const webCallPayload = {
              agent_id: widget.agentId,
              metadata: {
                widget_token: widgetToken,
                origin: origin,
                call_type: 'widget'
              }
            };

            try {
              const axios = (await import('axios')).default;
              const webCallResponse = await axios.post(
                'https://api.retellai.com/v2/create-web-call',
                webCallPayload,
                {
                  headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                  },
                }
              );

              const { access_token, call_id } = webCallResponse.data;

              if (!access_token || !call_id) {
                throw new Error('Invalid response from Retell API - missing access token or call ID');
              }

              callCredentials = {
                accessToken: access_token,
                agentId: widget.agentId,
                callId: call_id
              };
              console.log('[Widget Call Token] Retell web call created successfully:', call_id);
            } catch (error: any) {
              console.error('[Widget Call Token] Error creating Retell web call:', error.response?.data || error.message);

              if (error.response?.status === 403) {
                throw new Error('Retell account has reached its usage limit. Please upgrade your plan.');
              }
              if (error.response?.status === 401) {
                throw new Error('Invalid Retell API key for this agent.');
              }

              throw new Error(`Failed to create Retell web call: ${error.response?.data?.message || error.message}`);
            }
          } else {
            throw new Error('Retell API key not configured for this agent');
          }
          break;

        case 'ultravox':
          // Get Ultravox agent and its API key
          const ultravoxAgent = await prisma.ultravoxAgent.findUnique({
            where: { id: widget.agentId }
          });

          if (ultravoxAgent?.apiKey) {
            const apiKey = await decrypt(ultravoxAgent.apiKey);
            callCredentials = {
              accessToken: apiKey,
              agentId: widget.agentId
            };
            console.log('[Widget Call Token] Ultravox credentials generated from agent');
          } else {
            throw new Error('Ultravox API key not configured for this agent');
          }
          break;

        default:
          throw new Error(`Unsupported agent type: ${widget.agentType}`);
      }
    } catch (error) {
      console.error('[Widget Call Token] Error generating credentials:', error);
      return NextResponse.json(
        { success: false, error: 'Provider credentials not available' },
        { status: 400 }
      );
    }

    // Track call initiation
    try {
      await prisma.widgetAnalytics.create({
        data: {
          widgetId: widget.id,
          partnerId: widget.partnerId,
          customerId: widget.customerId,
          eventType: 'call_initiated',
          domain: origin || 'unknown',
          timestamp: new Date()
        }
      });
    } catch (error) {
      console.error('Error tracking call initiation:', error);
      // Don't fail the request for analytics errors
    }

    return NextResponse.json({
      success: true,
      credentials: callCredentials
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });

  } catch (error) {
    console.error('Error generating call token:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle preflight requests
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
