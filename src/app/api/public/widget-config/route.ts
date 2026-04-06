import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';



// Helper function to validate domain against allowed domains
function isDomainAllowed(origin: string, allowedDomains: string[], referer?: string, embedDomain?: string): boolean {
  if (!allowedDomains || allowedDomains.length === 0) {
    return true; // No restrictions
  }

  // Always allow the widget hosting domain (widgets.knotie-ai.pro or configured WIDGET_APP_URL)
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

    // Flatten domains in case they're stored as comma-separated strings (legacy format)
    const flattenedDomains = allowedDomains.flatMap(domain => {
      if (typeof domain === 'string' && domain.includes(',')) {
        return domain.split(',').map(d => d.trim());
      }
      return [domain];
    }).filter(d => d && d.length > 0);

    // Always add the widget hosting domain to allowed domains
    if (!flattenedDomains.includes(widgetDomain)) {
      flattenedDomains.push(widgetDomain);
    }

    console.log('[Domain Validation] Domains to check:', domainsToCheck);
    console.log('[Domain Validation] Flattened allowed domains:', flattenedDomains);

    // Check each domain (origin and referer) against allowed domains
    return domainsToCheck.some(domainToCheck => {
      return flattenedDomains.some(allowed => {
        // Remove protocol if present in allowed domain
        const cleanAllowed = allowed.replace(/^https?:\/\//, '');

        // Exact match
        if (cleanAllowed === domainToCheck) {
          console.log('[Domain Validation] Exact match:', cleanAllowed, 'for domain:', domainToCheck);
          return true;
        }

        // Wildcard match (*.example.com)
        if (cleanAllowed.startsWith('*.')) {
          const baseDomain = cleanAllowed.substring(2);
          const matches = domainToCheck.endsWith('.' + baseDomain) || domainToCheck === baseDomain;
          if (matches) {
            console.log('[Domain Validation] Wildcard match:', cleanAllowed, 'for domain:', domainToCheck);
          }
          return matches;
        }

        // Subdomain match
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

// POST /api/public/widget-config - Get widget configuration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, origin, referer, embedDomain } = body;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Widget token is required' },
        { status: 400 }
      );
    }

    // Find widget by token
    const widget = await prisma.agentWidget.findUnique({
      where: {
        widgetToken: token
      },
      include: {
        partner: {
          select: {
            id: true,
            businessName: true
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

    // Check if widget is active
    if (!widget.isActive) {
      return NextResponse.json(
        { success: false, error: 'Widget is not active' },
        { status: 403 }
      );
    }

    // Validate domain if origin is provided
    if (origin) {
      console.log('[Widget Config] Domain validation:', {
        origin,
        referer,
        embedDomain,
        allowedDomains: widget.allowedDomains,
        widgetToken: token
      });

      if (!isDomainAllowed(origin, widget.allowedDomains || [], referer, embedDomain)) {
        console.log('[Widget Config] Domain not allowed:', {
          origin,
          referer,
          embedDomain,
          allowedDomains: widget.allowedDomains
        });
        return NextResponse.json(
          {
            success: false,
            error: 'Domain not allowed',
            debug: {
              origin,
              referer,
              embedDomain,
              allowedDomains: widget.allowedDomains
            }
          },
          { status: 403 }
        );
      }
    } else {
      console.log('[Widget Config] No origin provided:', {
        referer,
        embedDomain,
        allowedDomainsLength: widget.allowedDomains?.length || 0
      });
    }

    // Get agent configuration based on agent type
    let agentConfig = {};
    try {
      // Query the appropriate agent model based on type
      let agent: any = null;

      switch (widget.agentType) {
        case 'vapi':
          agent = await prisma.vapiAgent.findFirst({
            where: {
              id: widget.agentId,
              partnerId: widget.partnerId
            },
            select: {
              id: true,
              name: true,
              publicKey: true,
              partner: {
                select: {
                  vapiPublicKey: true
                }
              }
            }
          });

          if (agent) {
            agentConfig = {
              agentId: widget.agentId,
              publicKey: agent.publicKey || agent.partner?.vapiPublicKey || undefined
            };
          }
          break;

        case 'retell':
          agent = await prisma.retellAgent.findFirst({
            where: {
              id: widget.agentId,
              partnerId: widget.partnerId
            },
            select: {
              id: true,
              name: true,
              partner: {
                select: {
                  retellApiKey: true
                }
              }
            }
          });

          if (agent) {
            agentConfig = {
              agentId: widget.agentId,
              accessToken: agent.partner?.retellApiKey || undefined
            };
          }
          break;

        case 'ultravox':
          agent = await prisma.ultravoxAgent.findFirst({
            where: {
              id: widget.agentId,
              partnerId: widget.partnerId
            },
            select: {
              id: true,
              name: true,
              partner: {
                select: {
                  ultravoxApiKey: true
                }
              }
            }
          });

          if (agent) {
            agentConfig = {
              agentId: widget.agentId,
              apiKey: agent.partner?.ultravoxApiKey || undefined
            };
          }
          break;

        case 'knova':
          // Knova agents might be stored in a different table or have different structure
          agentConfig = {
            agentId: widget.agentId
          };
          break;

        case 'elevenlabs':
          // ElevenLabs agents might be stored in a different table or have different structure
          agentConfig = {
            agentId: widget.agentId
          };
          break;

        default:
          agentConfig = {
            agentId: widget.agentId
          };
      }
    } catch (error) {
      console.error('Error fetching agent config:', error);
      // Continue with basic config
    }

    // Prepare widget configuration
    const config = {
      widgetType: widget.widgetType,
      agentType: widget.agentType,
      agentId: widget.agentId,
      providerConfig: {
        agentId: widget.agentId,
        customConfig: agentConfig
      },
      customization: {
        appearance: {
          primaryColor: widget.primaryColor || '#6366F1',
          secondaryColor: widget.secondaryColor || '#8B5CF6',
          backgroundColor: widget.backgroundColor || 'transparent',
          textColor: widget.textColor || '#1F2937',
          borderRadius: widget.borderRadius || 12
        },
        behavior: {
          position: widget.position || 'bottom-right',
          size: widget.size || 'medium',
          autoStart: widget.autoStart || false,
          showBranding: widget.showBranding !== undefined ? widget.showBranding : true,
          showTranscript: widget.showTranscript || false,
          showInteractionHints: widget.showInteractionHints !== undefined ? widget.showInteractionHints : true
        },
        messages: {
          welcomeMessage: widget.welcomeMessage || '',
          buttonText: widget.buttonText || '',
          endCallText: widget.endCallText || 'End Call',
          interactionHint: widget.interactionHint || ''
        },
        branding: {
          enabled: widget.showBranding !== undefined ? widget.showBranding : false,
          text: widget.brandingText || '',
          url: widget.brandingUrl || 'https://knotie-ai.pro',
          position: widget.brandingPosition || 'bottom-center',
          fontSize: widget.brandingFontSize || 12,
          opacity: widget.brandingOpacity || 0.5
        }
      },
      security: {
        widgetToken: token,
        allowedDomains: widget.allowedDomains
      },
      branding: {
        partnerName: widget.partner?.businessName || 'Knotie AI'
      }
    };

    // Track widget view
    try {
      await prisma.widgetAnalytics.create({
        data: {
          widgetId: widget.id,
          partnerId: widget.partnerId,
          customerId: widget.customerId,
          eventType: 'view',
          domain: origin || 'unknown',
          timestamp: new Date()
        }
      });
    } catch (error) {
      console.error('Error tracking widget view:', error);
      // Don't fail the request for analytics errors
    }

    // Get production credentials for real functionality
    let publicKey: string | undefined;
    let accessToken: string | undefined;

    try {
      switch (widget.agentType) {
        case 'vapi':
          publicKey = (agentConfig as any).publicKey;
          console.log('[Widget Config] VAPI publicKey:', publicKey ? 'present' : 'missing');
          break;
        case 'retell':
          accessToken = (agentConfig as any).accessToken;
          console.log('[Widget Config] Retell accessToken:', accessToken ? 'present' : 'missing');
          break;
        case 'ultravox':
          accessToken = (agentConfig as any).apiKey;
          console.log('[Widget Config] Ultravox apiKey:', accessToken ? 'present' : 'missing');
          break;
      }
    } catch (error) {
      console.error('Error getting production credentials:', error);
    }

    console.log('[Widget Config] Final credentials:', {
      agentType: widget.agentType,
      publicKey: publicKey ? 'present' : 'missing',
      accessToken: accessToken ? 'present' : 'missing',
      agentConfig
    });

    return NextResponse.json({
      success: true,
      config,
      publicKey,
      accessToken
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });

  } catch (error) {
    console.error('Error fetching widget config:', error);
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

// GET /api/public/widget-config - Get widget configuration with test credentials
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const testMode = searchParams.get('test') === 'true';

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // Find widget by token
    const widget = await prisma.agentWidget.findUnique({
      where: { widgetToken: token },
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
      return NextResponse.json({ error: 'Widget not found' }, { status: 404 });
    }

    if (!widget.isActive) {
      return NextResponse.json({ error: 'Widget is not active' }, { status: 403 });
    }

    // Get agent details and credentials for test mode
    let agentConfig: any = {};
    let publicKey: string | null = null;
    let accessToken: string | null = null;

    if (testMode) {
      switch (widget.agentType) {
        case 'vapi':
          const vapiAgent = await prisma.vapiAgent.findFirst({
            where: {
              id: widget.agentId,
              partnerId: widget.partnerId
            },
            select: {
              id: true,
              name: true,
              publicKey: true,
              partner: {
                select: {
                  vapiPublicKey: true
                }
              }
            }
          });

          if (vapiAgent) {
            agentConfig = { id: vapiAgent.id, name: vapiAgent.name };
            publicKey = vapiAgent.publicKey || vapiAgent.partner?.vapiPublicKey || null;
          }
          break;

        case 'retell':
          const retellAgent = await prisma.retellAgent.findFirst({
            where: {
              id: widget.agentId,
              partnerId: widget.partnerId
            },
            select: { id: true, name: true }
          });

          if (retellAgent && widget.partner.retellApiKey) {
            agentConfig = { id: retellAgent.id, name: retellAgent.name };

            // Generate access token for Retell
            try {
              const response = await fetch('https://api.retellai.com/create-web-call', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${widget.partner.retellApiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  agent_id: widget.agentId,
                }),
              });

              if (response.ok) {
                const data = await response.json();
                accessToken = data.access_token;
              }
            } catch (error) {
              console.error('Error creating Retell access token:', error);
            }
          }
          break;

        case 'ultravox':
          const ultravoxAgent = await prisma.ultravoxAgent.findFirst({
            where: {
              id: widget.agentId,
              partnerId: widget.partnerId
            },
            select: { id: true, name: true }
          });

          if (ultravoxAgent) {
            agentConfig = { id: ultravoxAgent.id, name: ultravoxAgent.name };
          }
          break;
      }
    }

    return NextResponse.json({
      success: true,
      config: {
        widgetType: widget.widgetType,
        agentType: widget.agentType,
        agentId: widget.agentId,
        customization: {
          appearance: {
            primaryColor: widget.primaryColor,
            secondaryColor: widget.secondaryColor,
            backgroundColor: widget.backgroundColor,
            textColor: widget.textColor,
            borderRadius: widget.borderRadius
          },
          behavior: {
            position: widget.position,
            size: widget.size,
            autoStart: widget.autoStart,
            showBranding: widget.showBranding,
            showTranscript: widget.showTranscript
          },
          messages: {
            welcomeMessage: widget.welcomeMessage || '',
            buttonText: widget.buttonText || '',
            endCallText: widget.endCallText || 'End Call'
          }
        },
        security: {
          widgetToken: widget.widgetToken,
          allowedDomains: widget.allowedDomains
        }
      },
      agentConfig,
      publicKey: testMode ? publicKey : null,
      accessToken: testMode ? accessToken : null,
      testMode,
      partner: {
        businessName: widget.partner.businessName
      }
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    console.error('Error fetching widget config:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  }
}
