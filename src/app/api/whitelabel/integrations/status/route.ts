import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyCustomerJWT } from '@/lib/customerJwt';

const CONNECT_HUB_URL = process.env.CONNECT_HUB_URL || 'http://localhost:3001';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    console.log('[whitelabel/integrations/status] Starting integration status check');

    // Get the customer token from cookies
    const cookieStore = cookies();
    const token = cookieStore.get('customer_token')?.value;

    if (!token) {
      console.log('[whitelabel/integrations/status] No customer token found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the JWT token
    const payload = await verifyCustomerJWT(token);
    if (!payload) {
      console.log('[whitelabel/integrations/status] Invalid customer token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[whitelabel/integrations/status] Customer authenticated:', {
      customerId: payload.customerId,
      partnerId: payload.partnerId
    });

    // Get all connection statuses from Connect Hub
    // Check both GHL and Composio connections
    const connections = [];

    // Check GHL status
    try {
      const ghlStatusUrl = new URL(`${CONNECT_HUB_URL}/oauth/ghl/status`);
      ghlStatusUrl.searchParams.set('tenantId', payload.customerId);
      ghlStatusUrl.searchParams.set('partnerId', payload.partnerId);

      const ghlResponse = await fetch(ghlStatusUrl.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (ghlResponse.ok) {
        const ghlData = await ghlResponse.json();
        if (ghlData.success && ghlData.data.isConnected) {
          connections.push({
            id: 'ghl',
            provider: 'ghl',
            appName: 'ghl',
            status: 'active',
            connectedAt: ghlData.data.connectedAt || new Date().toISOString(),
            lastVerified: new Date().toISOString(),
            metadata: {
              toolsCount: 9, // Updated to reflect actual number of GHL tools available
              locations: ghlData.data.metadata?.locations || []
            }
          });
        }
      }
    } catch (error) {
      console.log('[whitelabel/integrations/status] GHL status check failed:', error);
    }

    // Check Composio OAuth2 connections (Google Calendar, Gmail, etc.)
    try {
      const composioStatusUrl = new URL(`${CONNECT_HUB_URL}/oauth/composio/status`);
      composioStatusUrl.searchParams.set('tenantId', payload.customerId);
      composioStatusUrl.searchParams.set('partnerId', payload.partnerId);

      const composioResponse = await fetch(composioStatusUrl.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (composioResponse.ok) {
        const composioData = await composioResponse.json();
        if (composioData.success && composioData.data.isConnected) {
          // Handle new response format that returns all OAuth connections
          const oauthConnections = composioData.data.connections || [];

          oauthConnections.forEach((connection: any) => {
            const resourceId = connection.resourceId;
            let appName = resourceId;

            // Map Composio resource IDs to user-friendly app names
            if (resourceId === 'googlecalendar') {
              appName = 'googlecalendar';
            } else if (resourceId === 'gmail') {
              appName = 'gmail';
            } else if (resourceId === 'notion') {
              appName = 'notion';
            } else if (resourceId === 'slack') {
              appName = 'slack';
            } else if (resourceId === 'airtable') {
              appName = 'airtable';
            } else if (resourceId === 'hubspot') {
              appName = 'hubspot';
            } else if (resourceId === 'salesforce') {
              appName = 'salesforce';
            } else if (resourceId === 'whatsapp') {
              appName = 'whatsapp';
            }

            connections.push({
              id: appName,
              provider: 'composio',
              appName: appName,
              status: 'active',
              connectedAt: connection.connectedAt || new Date().toISOString(),
              lastVerified: new Date().toISOString(),
              metadata: {
                toolsCount: getToolsCount('composio', appName),
                composioResourceId: resourceId,
                composioConnectionId: connection.connectionId
              }
            });
          });
        }
      }
    } catch (error) {
      console.log('[whitelabel/integrations/status] Composio OAuth2 status check failed:', error);
    }

    // Check Composio API Key connections (Firecrawl, Shopify, etc.)
    try {
      const apiKeyStatusUrl = new URL(`${CONNECT_HUB_URL}/oauth/composio/api-key-status`);
      apiKeyStatusUrl.searchParams.set('tenantId', payload.customerId);
      apiKeyStatusUrl.searchParams.set('partnerId', payload.partnerId);

      const apiKeyResponse = await fetch(apiKeyStatusUrl.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (apiKeyResponse.ok) {
        const apiKeyData = await apiKeyResponse.json();
        if (apiKeyData.success && apiKeyData.data && Array.isArray(apiKeyData.data.connections)) {
          // API key connections return an array of connections
          apiKeyData.data.connections.forEach((connection: any) => {
            connections.push({
              id: connection.appName,
              provider: 'composio',
              appName: connection.appName,
              status: 'active',
              connectedAt: connection.connectedAt || new Date().toISOString(),
              lastVerified: new Date().toISOString(),
              metadata: {
                toolsCount: getToolsCount('composio', connection.appName),
                connectionId: connection.connectionId,
                authType: 'api_key'
              }
            });
          });
        }
      }
    } catch (error) {
      console.log('[whitelabel/integrations/status] Composio API key status check failed:', error);
    }

    // Transform the connections to be more user-friendly
    const transformedConnections = connections.map((connection: any) => ({
      id: connection.provider === 'composio' ? connection.appName : connection.provider,
      provider: connection.provider,
      appName: connection.appName,
      displayName: getAppDisplayName(connection.provider, connection.appName),
      status: connection.status,
      connectedAt: connection.connectedAt,
      lastVerified: connection.lastVerified,
      metadata: connection.metadata,
      category: getAppCategory(connection.provider, connection.appName),
      icon: getAppIcon(connection.provider, connection.appName)
    }));

    console.log('[whitelabel/integrations/status] Status check completed successfully');
    
    return NextResponse.json({
      success: true,
      connections: transformedConnections,
      metadata: {
        timestamp: new Date().toISOString(),
        totalConnections: transformedConnections.length,
        activeConnections: transformedConnections.filter((c: any) => c.status === 'active').length
      }
    });

  } catch (error) {
    console.error('[whitelabel/integrations/status] Status check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper functions to map technical names to user-friendly names
// Helper functions to map technical names to user-friendly names
function getToolsCount(provider: string, appName?: string): number {
  const toolCounts: Record<string, number> = {
    'ghl': 2, // GHL_CREATE_CONTACT, GHL_BOOK_APPOINTMENT
    'googlecalendar': 7, // Based on verified tools
    'gmail': 5,
    'slack': 8,
    'hubspot': 12,
    'shopify': 15,
    'notion': 6,
    'airtable': 8,
    'salesforce': 20,
    'trello': 10,
    'asana': 12,
    'firecrawl': 8, // Web scraping and data extraction tools
    'whatsapp': 6 // WhatsApp Business messaging tools
  };

  if (provider === 'ghl') {
    return toolCounts['ghl'];
  }

  return toolCounts[appName || provider] || 5;
}

function getAppDisplayName(provider: string, appName: string): string {
  if (provider === 'ghl' || provider === 'crm-hl') {
    return 'CRM & Marketing Platform';
  }

  const displayNames: Record<string, string> = {
    gmail: 'Gmail',
    googlecalendar: 'Google Calendar',
    slack: 'Slack',
    shopify: 'Shopify',
    notion: 'Notion',
    airtable: 'Airtable',
    hubspot: 'HubSpot',
    salesforce: 'Salesforce',
    trello: 'Trello',
    asana: 'Asana',
    firecrawl: 'Firecrawl',
    whatsapp: 'WhatsApp'
  };

  return displayNames[appName] || appName.charAt(0).toUpperCase() + appName.slice(1);
}

function getAppCategory(provider: string, appName: string): string {
  if (provider === 'ghl' || provider === 'crm-hl') {
    return 'CRM & Marketing';
  }

  const categories: Record<string, string> = {
    gmail: 'Communication',
    googlecalendar: 'Scheduling',
    slack: 'Communication',
    shopify: 'E-commerce',
    notion: 'Productivity',
    airtable: 'Database',
    hubspot: 'CRM',
    salesforce: 'CRM',
    trello: 'Project Management',
    asana: 'Project Management',
    firecrawl: 'Data',
    whatsapp: 'Communication'
  };

  return categories[appName] || 'Productivity';
}

function getAppIcon(provider: string, appName: string): string {
  if (provider === 'ghl' || provider === 'crm-hl') {
    return '/icons/crm.svg';
  }

  return `/icons/${appName}.svg`;
}
