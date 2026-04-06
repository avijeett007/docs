'use client';

import React, { useState, useEffect } from 'react';
import { FiCalendar, FiMail, FiMessageSquare, FiShoppingBag, FiFileText, FiDatabase, FiUsers, FiTrendingUp, FiCheck, FiExternalLink, FiX, FiRefreshCw, FiLoader, FiAlertCircle, FiInfo, FiGlobe, FiPhone, FiLock } from 'react-icons/fi';
import WhatsAppConfigModal from './WhatsAppConfigModal';
import ApiKeyConnectionModal from './ApiKeyConnectionModal';
import FreeForeverUpgradeModal from '@/components/partner/FreeForeverUpgradeModal';

interface ToolConnection {
  id: string;
  provider: string;
  appName: string;
  displayName: string;
  status: string;
  connectedAt?: string;
  lastVerified?: string;
  metadata?: {
    toolsCount?: number;
    composioConnectionId?: string;
    composioUserId?: string;
    connectedAt?: string;
    [key: string]: any;
  };
}

interface Tool {
  id: string;
  name: string;
  displayName: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  category: string;
  provider: 'ghl' | 'composio';
  authMethod?: 'oauth2' | 'api_key'; // Optional - defaults to OAuth for backward compatibility
  isConnected?: boolean;
  connectionData?: ToolConnection;
}

// TODO: REMOVE THIS INTERFACE BEFORE PRODUCTION - Test mode support
interface ToolIntegrationsGridProps {
  testAllowedApps?: string[] | null;
}

export default function ToolIntegrationsGrid({ testAllowedApps = null }: ToolIntegrationsGridProps = {}) {
  const [connections, setConnections] = useState<ToolConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [disconnectingTool, setDisconnectingTool] = useState<string | null>(null);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [toolToDisconnect, setToolToDisconnect] = useState<Tool | null>(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [toolForApiKey, setToolForApiKey] = useState<Tool | null>(null);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [tierAccess, setTierAccess] = useState<{
    isFreeForever: boolean;
    accessibleApps: string[];
    restrictedApps: string[];
  }>({ isFreeForever: false, accessibleApps: [], restrictedApps: [] });

  // Define all available tools
  const tools: Tool[] = [
    {
      id: 'ghl',
      name: 'gohighlevel',
      displayName: 'GoHighLevel',
      description: 'Calendar booking and CRM management',
      icon: FiCalendar,
      color: '#3B82F6',
      category: 'CRM',
      provider: 'ghl'
    },
    {
      id: 'gmail',
      name: 'gmail',
      displayName: 'Gmail',
      description: 'Send and manage emails',
      icon: FiMail,
      color: '#EA4335',
      category: 'Communication',
      provider: 'composio'
    },
    {
      id: 'googlecalendar',
      name: 'googlecalendar',
      displayName: 'Google Calendar',
      description: 'Manage calendar events',
      icon: FiCalendar,
      color: '#4285F4',
      category: 'Scheduling',
      provider: 'composio'
    },
    {
      id: 'slack',
      name: 'slack',
      displayName: 'Slack',
      description: 'Team communication',
      icon: FiMessageSquare,
      color: '#4A154B',
      category: 'Communication',
      provider: 'composio'
    },
    {
      id: 'shopify',
      name: 'shopify',
      displayName: 'Shopify',
      description: 'E-commerce management',
      icon: FiShoppingBag,
      color: '#96BF48',
      category: 'E-commerce',
      provider: 'composio',
      authMethod: 'api_key'
    },
    {
      id: 'notion',
      name: 'notion',
      displayName: 'Notion',
      description: 'Notes and project management',
      icon: FiFileText,
      color: '#000000',
      category: 'Productivity',
      provider: 'composio'
    },
    {
      id: 'airtable',
      name: 'airtable',
      displayName: 'Airtable',
      description: 'Database and project management',
      icon: FiDatabase,
      color: '#18BFFF',
      category: 'Database',
      provider: 'composio'
    },
    {
      id: 'hubspot',
      name: 'hubspot',
      displayName: 'HubSpot',
      description: 'CRM and marketing',
      icon: FiUsers,
      color: '#FF7A59',
      category: 'CRM',
      provider: 'composio'
    },
    {
      id: 'salesforce',
      name: 'salesforce',
      displayName: 'Salesforce',
      description: 'Customer relationship management',
      icon: FiTrendingUp,
      color: '#00A1E0',
      category: 'CRM',
      provider: 'composio'
    },
    {
      id: 'firecrawl',
      name: 'firecrawl',
      displayName: 'Firecrawl',
      description: 'Web scraping and data extraction',
      icon: FiGlobe,
      color: '#FF6B35',
      category: 'Data',
      provider: 'composio',
      authMethod: 'api_key'
    },
    {
      id: 'whatsapp',
      name: 'whatsapp',
      displayName: 'WhatsApp',
      description: 'Send messages and manage WhatsApp Business',
      icon: FiPhone,
      color: '#25D366',
      category: 'Communication',
      provider: 'composio'
    }
  ];

  // Fetch tier access info
  const fetchTierAccess = async () => {
    try {
      // TODO: REMOVE THIS BLOCK BEFORE PRODUCTION - Test mock data for development
      if (testAllowedApps !== null) {
        console.log('[ToolIntegrationsGrid] Using TEST MODE with allowedApps:', testAllowedApps);
        const allApps = ['gmail', 'googlecalendar', 'gohighlevel', 'slack', 'shopify', 'notion', 'airtable', 'hubspot', 'salesforce', 'firecrawl', 'whatsapp'];
        const restrictedApps = allApps.filter(app => !testAllowedApps.includes(app));
        setTierAccess({
          isFreeForever: false,
          accessibleApps: testAllowedApps,
          restrictedApps
        });
        return;
      }
      // END TODO: REMOVE BLOCK

      console.log('[ToolIntegrationsGrid] Fetching tier access from API...');
      const response = await fetch('/api/whitelabel/integrations/tier-access', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[ToolIntegrationsGrid] Tier access data:', data);
        if (data.success) {
          setTierAccess({
            isFreeForever: data.isFreeForever,
            accessibleApps: data.accessibleApps || [],
            restrictedApps: data.restrictedApps || []
          });
        }
      } else {
        console.warn('[ToolIntegrationsGrid] Tier access API returned non-OK status:', response.status);
      }
    } catch (err) {
      console.error('[ToolIntegrationsGrid] Error fetching tier access:', err);
    }
  };

  // Fetch connections and tier access on mount
  useEffect(() => {
    fetchConnections();
    fetchTierAccess();

    // Check for success status in URL params
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    const app = urlParams.get('app');

    if (status === 'connected' && app) {
      setSuccessMessage(`Successfully connected ${app.charAt(0).toUpperCase() + app.slice(1)}!`);
      // Clear URL params
      window.history.replaceState({}, '', window.location.pathname);
      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    }
  }, []);

  const fetchConnections = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch both GHL and Composio connections
      const response = await fetch('/api/whitelabel/integrations/status', {
        credentials: 'include'
      });

      if (!response.ok) {
        // For new customers, this is expected - gracefully handle it
        console.log('No existing connections found (this is normal for new customers)');
        setConnections([]);
        return;
      }

      const data = await response.json();
      if (data.success) {
        setConnections(data.connections || []);
      } else {
        // API returned success: false, but this is not necessarily an error for new customers
        console.log('No connections returned from API (normal for new customers)');
        setConnections([]);
      }
    } catch (err) {
      console.error('Error fetching connections:', err);
      // Don't show error for new customers - just show available tools
      console.log('Connection status unavailable, showing available tools only');
      setConnections([]);
      // Only show error if it's a network/auth issue, not a "no connections" issue
      if (err instanceof Error && err.message.includes('Failed to fetch')) {
        setError('Unable to check connection status. You can still connect new tools below.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (tool: Tool) => {
    try {
      setConnecting(tool.id);
      setError(null);

      // Check if app is restricted for FREE FOREVER partners
      const isRestricted = tierAccess.isFreeForever && tierAccess.restrictedApps.includes(tool.name);
      if (isRestricted) {
        setShowUpgradeModal(true);
        setConnecting(null);
        return;
      }

      if (tool.provider === 'ghl') {
        // Handle GHL connection - redirect to existing GHL flow
        window.location.href = '/whitelabel/integration/ghl';
        return;
      }

      // Check authentication method for Composio tools
      if (tool.authMethod === 'api_key') {
        // Show API key modal for tools that require API keys
        setToolForApiKey(tool);
        setShowApiKeyModal(true);
        setConnecting(null); // Reset connecting state since we're showing modal
        return;
      }

      // Special handling for WhatsApp - requires WABA ID configuration
      if (tool.name === 'whatsapp') {
        setShowWhatsAppModal(true);
        setConnecting(null); // Reset connecting state since we're showing modal
        return;
      }

      // Handle OAuth2 connections (default for tools without authMethod or with authMethod: 'oauth2')
      const response = await fetch('/api/whitelabel/integrations/apps/oauth-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          appName: tool.name
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate OAuth URL');
      }

      const data = await response.json();
      if (data.success && data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error(data.error || 'Failed to initiate connection');
      }
    } catch (err) {
      console.error('Connection error:', err);
      setError(`Failed to connect ${tool.displayName}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnectClick = (tool: Tool) => {
    setToolToDisconnect(tool);
    setShowDisconnectModal(true);
  };

  const handleDisconnectConfirm = async () => {
    if (!toolToDisconnect) return;

    try {
      setDisconnectingTool(toolToDisconnect.id);
      setError(null);
      setSuccessMessage(null);
      setShowDisconnectModal(false);

      const response = await fetch(`/api/whitelabel/integrations/apps/disconnect?appName=${toolToDisconnect.name}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      const data = await response.json();
      if (data.success) {
        setSuccessMessage(`${toolToDisconnect.displayName} disconnected successfully`);
        setTimeout(() => setSuccessMessage(null), 5000);
        await fetchConnections(); // Refresh connections
      } else {
        throw new Error(data.error || 'Failed to disconnect');
      }
    } catch (err) {
      console.error('Disconnect error:', err);
      setError(`Failed to disconnect ${toolToDisconnect.displayName}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setDisconnectingTool(null);
      setToolToDisconnect(null);
    }
  };

  const handleDisconnectCancel = () => {
    setShowDisconnectModal(false);
    setToolToDisconnect(null);
  };

  const handleApiKeyModalClose = () => {
    setShowApiKeyModal(false);
    setToolForApiKey(null);
  };

  const handleApiKeyConnectionSuccess = () => {
    fetchConnections(); // Refresh connections after successful API key connection
  };

  const handleWhatsAppConnect = async (config: { wabaId: string; phoneNumberId?: string; displayPhoneNumber?: string }) => {
    try {
      setConnecting('whatsapp');
      setError(null);

      // Call the OAuth URL endpoint with WhatsApp configuration
      const response = await fetch('/api/whitelabel/integrations/apps/oauth-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          appName: 'whatsapp',
          customConfig: {
            wabaId: config.wabaId,
            phoneNumberId: config.phoneNumberId,
            displayPhoneNumber: config.displayPhoneNumber
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate WhatsApp OAuth URL');
      }

      const data = await response.json();
      if (data.success && data.authUrl) {
        // Close modal and redirect to OAuth
        setShowWhatsAppModal(false);
        window.location.href = data.authUrl;
      } else {
        throw new Error(data.error || 'Failed to initiate WhatsApp connection');
      }
    } catch (err) {
      console.error('WhatsApp connection error:', err);
      setError(`Failed to connect WhatsApp: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setConnecting(null);
    }
  };

  const handleWhatsAppModalClose = () => {
    setShowWhatsAppModal(false);
    setConnecting(null);
  };

  const getConnectionStatus = (tool: Tool) => {
    return connections.find(conn => 
      (tool.provider === 'ghl' && conn.provider === 'ghl') ||
      (tool.provider === 'composio' && conn.provider === 'composio' && conn.appName === tool.name)
    );
  };

  // Add connection status to tools, filtering by allowed apps
  // Connected tools are always shown so the green overlay remains visible
  const toolsWithStatus = tools
    .filter(tool => {
      // Always show connected tools regardless of tier access
      if (getConnectionStatus(tool)) {
        return true;
      }
      // If tier access has accessible apps defined, only show those
      if (tierAccess.accessibleApps && tierAccess.accessibleApps.length > 0) {
        return tierAccess.accessibleApps.includes(tool.name);
      }
      // If no tier access data yet (loading), show all
      return true;
    })
    .map(tool => ({
    ...tool,
    isConnected: !!getConnectionStatus(tool),
    connectionData: getConnectionStatus(tool)
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mr-4 border border-blue-500/30">
          <FiRefreshCw className="h-6 w-6 text-blue-400 animate-spin" />
        </div>
        <div>
          <div className="text-white font-medium mb-1">Loading integrations...</div>
          <div className="text-gray-400 text-sm">Fetching available tools and connections</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 flex items-center">
          <FiAlertCircle className="h-5 w-5 mr-3 flex-shrink-0" />
          {error}
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-green-300 flex items-center">
          <FiCheck className="h-5 w-5 mr-3 flex-shrink-0" />
          {successMessage}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Tool Integrations</h2>
          <p className="text-gray-400">Connect your favorite tools to enhance your AI agents</p>
        </div>

        <button
          onClick={fetchConnections}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-gray-700/50 hover:bg-gray-600/50 border border-gray-600/50 transition-all duration-200 disabled:opacity-50"
        >
          <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="flex items-center space-x-3 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
          <FiCheck className="h-5 w-5 text-green-400 flex-shrink-0" />
          <span className="text-green-400 font-medium">{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm backdrop-blur-sm">
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center mr-3">
              <FiAlertCircle className="h-4 w-4 text-red-400" />
            </div>
            {error}
          </div>
        </div>
      )}

      {/* Helpful message for new customers */}
      {!loading && connections.length === 0 && !error && (
        <div className="mb-6 p-6 rounded-xl bg-blue-500/10 border border-blue-500/20 backdrop-blur-sm">
          <div className="flex items-start">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center mr-4 flex-shrink-0">
              <FiInfo className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-blue-300 font-semibold mb-2">Welcome to Integrations!</h3>
              <p className="text-blue-200/80 text-sm leading-relaxed mb-3">
                You haven't connected any tools yet. Click on any integration below to connect your favorite apps and services to your AI agents.
              </p>
              <p className="text-blue-200/60 text-xs">
                💡 Start with Gmail or Google Calendar for email and scheduling capabilities.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {toolsWithStatus.map((tool) => (
          <div
            key={tool.id}
            className={`p-6 rounded-xl border backdrop-blur-sm transition-all duration-300 hover:transform hover:scale-105 group cursor-pointer ${
              tool.isConnected
                ? 'bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30 hover:border-green-400/50'
                : 'bg-gradient-to-br from-gray-800/40 to-gray-900/40 border-gray-700/50 hover:border-gray-600/50'
            }`}
            onClick={() => tool.isConnected ? null : handleConnect(tool)}
          >
            <div className="flex items-center justify-between mb-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-110"
                style={{ 
                  backgroundColor: `${tool.color}20`, 
                  border: `1px solid ${tool.color}30`
                }}
              >
                <tool.icon className="h-6 w-6" style={{ color: tool.color }} />
              </div>
              
              {tool.isConnected ? (
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                    <FiCheck className="h-4 w-4 text-green-400" />
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDisconnectClick(tool);
                    }}
                    disabled={disconnectingTool === tool.id}
                    className="opacity-0 group-hover:opacity-100 transition-all duration-200 p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 disabled:opacity-50"
                    title="Disconnect"
                  >
                    {disconnectingTool === tool.id ? (
                      <FiLoader className="h-3 w-3 text-red-400 animate-spin" />
                    ) : (
                      <FiX className="h-3 w-3 text-red-400" />
                    )}
                  </button>
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-gray-700/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                  {connecting === tool.id ? (
                    <FiLoader className="h-4 w-4 text-blue-400 animate-spin" />
                  ) : (
                    <FiExternalLink className="h-3 w-3 text-gray-400" />
                  )}
                </div>
              )}
            </div>

            <div className="mb-3">
              <h3 className="text-lg font-semibold text-white mb-1">{tool.displayName}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{tool.description}</p>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 px-2 py-1 rounded-full bg-gray-700/30">
                {tool.category}
              </span>

              {tool.isConnected && tool.connectionData ? (
                <div className="text-right">
                  <div className="text-xs text-green-400 font-medium">
                    Connected
                  </div>
                  {tool.connectionData.metadata?.toolsCount && (
                    <div className="text-xs text-gray-500">
                      {tool.connectionData.metadata.toolsCount} tools available
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-gray-500">
                  Click to connect
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Disconnect Confirmation Modal */}
      {showDisconnectModal && toolToDisconnect && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 border border-gray-700">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mr-4">
                <FiX className="h-6 w-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Disconnect Integration</h3>
                <p className="text-gray-400 text-sm">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-gray-300 mb-6">
              Are you sure you want to disconnect <span className="font-semibold text-white">{toolToDisconnect.displayName}</span>?
              This will remove access to all {toolToDisconnect.displayName} tools and data.
            </p>

            <div className="flex space-x-3">
              <button
                onClick={handleDisconnectCancel}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDisconnectConfirm}
                disabled={disconnectingTool === toolToDisconnect.id}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center justify-center"
              >
                {disconnectingTool === toolToDisconnect.id ? (
                  <>
                    <FiLoader className="h-4 w-4 animate-spin mr-2" />
                    Disconnecting...
                  </>
                ) : (
                  'Disconnect'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API Key Connection Modal */}
      <ApiKeyConnectionModal
        isOpen={showApiKeyModal}
        onClose={handleApiKeyModalClose}
        tool={toolForApiKey}
        onConnectionSuccess={handleApiKeyConnectionSuccess}
      />

      {/* WhatsApp Configuration Modal */}
      <WhatsAppConfigModal
        isOpen={showWhatsAppModal}
        onClose={handleWhatsAppModalClose}
        onConnect={handleWhatsAppConnect}
        isConnecting={connecting === 'whatsapp'}
      />

      {/* Free Forever Upgrade Modal */}
      <FreeForeverUpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        title="Upgrade Required"
        message="This integration is not available on the Free Forever plan."
        featureDescription="Upgrade to access all 300+ app integrations including Slack, HubSpot, Salesforce, and more."
      />
    </div>
  );
}
