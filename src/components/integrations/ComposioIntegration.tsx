'use client';

import React, { useState, useEffect } from 'react';
import { FiTool, FiCheck, FiExternalLink, FiX, FiRefreshCw } from 'react-icons/fi';
import { usePartnerBranding } from '@/lib/partnerBranding';

interface AppConnection {
  id: string;
  provider: string;
  appName: string;
  displayName: string;
  status: string;
  connectedAt?: string;
  lastVerified?: string;
  category: string;
  icon: string;
}

interface AvailableApp {
  id: string;
  name: string;
  displayName: string;
  description: string;
  icon: string;
  category: string;
  color: string;
}

export default function AppIntegrations() {
  const { branding } = usePartnerBranding();
  const { primaryColor } = branding;

  const [connections, setConnections] = useState<AppConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Available third-party apps
  const availableApps: AvailableApp[] = [
    {
      id: 'gmail',
      name: 'gmail',
      displayName: 'Gmail',
      description: 'Send and manage emails',
      icon: '/icons/gmail.svg',
      category: 'Communication',
      color: '#EA4335'
    },
    {
      id: 'googlecalendar',
      name: 'googlecalendar',
      displayName: 'Google Calendar',
      description: 'Manage calendar events',
      icon: '/icons/google-calendar.svg',
      category: 'Scheduling',
      color: '#4285F4'
    },
    {
      id: 'slack',
      name: 'slack',
      displayName: 'Slack',
      description: 'Team communication',
      icon: '/icons/slack.svg',
      category: 'Communication',
      color: '#4A154B'
    },
    {
      id: 'shopify',
      name: 'shopify',
      displayName: 'Shopify',
      description: 'E-commerce management',
      icon: '/icons/shopify.svg',
      category: 'E-commerce',
      color: '#96BF48'
    },
    {
      id: 'notion',
      name: 'notion',
      displayName: 'Notion',
      description: 'Notes and project management',
      icon: '/icons/notion.svg',
      category: 'Productivity',
      color: '#000000'
    },
    {
      id: 'airtable',
      name: 'airtable',
      displayName: 'Airtable',
      description: 'Database management',
      icon: '/icons/airtable.svg',
      category: 'Database',
      color: '#18BFFF'
    },
    {
      id: 'hubspot',
      name: 'hubspot',
      displayName: 'HubSpot',
      description: 'CRM and marketing',
      icon: '/icons/hubspot.svg',
      category: 'CRM',
      color: '#FF7A59'
    },
    {
      id: 'salesforce',
      name: 'salesforce',
      displayName: 'Salesforce',
      description: 'Customer relationship management',
      icon: '/icons/salesforce.svg',
      category: 'CRM',
      color: '#00A1E0'
    },
    {
      id: 'whatsapp',
      name: 'whatsapp',
      displayName: 'WhatsApp',
      description: 'Send messages and manage WhatsApp Business',
      icon: '/icons/whatsapp.svg',
      category: 'Communication',
      color: '#25D366'
    }
  ];

  useEffect(() => {
    fetchConnections();
    checkUrlParams();
  }, []);

  const fetchConnections = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/whitelabel/integrations/status');
      const data = await response.json();

      if (data.success) {
        // Filter to only show third-party app connections (not GHL)
        const appConnections = data.connections.filter((conn: AppConnection) =>
          conn.provider === 'composio'
        );
        setConnections(appConnections);
      }
    } catch (error) {
      console.error('Failed to fetch connections:', error);
      setError('Failed to load integrations');
    } finally {
      setLoading(false);
    }
  };

  const checkUrlParams = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    const app = urlParams.get('app');

    if (status === 'connected' && app) {
      // Refresh connections to show the new one
      setTimeout(() => {
        fetchConnections();
      }, 1000);

      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

  const handleConnect = async (app: AvailableApp) => {
    setConnecting(app.id);
    setError(null);

    try {
      const response = await fetch('/api/whitelabel/integrations/apps/oauth-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appName: app.name })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Connection failed');
      }

      const { authUrl } = await response.json();
      window.location.href = authUrl;
    } catch (error: any) {
      console.error('Failed to initiate connection:', error);
      setError(`Failed to connect ${app.displayName}: ${error.message}`);
      setConnecting(null);
    }
  };

  const handleDisconnect = async (connection: AppConnection) => {
    if (!confirm(`Are you sure you want to disconnect ${connection.displayName}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/whitelabel/integrations/apps/disconnect?appName=${connection.appName}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Disconnection failed');
      }

      await fetchConnections();
    } catch (error) {
      console.error('Failed to disconnect:', error);
      setError(`Failed to disconnect ${connection.displayName}`);
    }
  };

  const getConnectionStatus = (appId: string) => {
    return connections.find(conn => conn.appName === appId);
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 rounded-xl border border-gray-700/50 p-8 backdrop-blur-sm">
        <div className="flex items-center justify-center py-12">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mr-4 border border-purple-500/30">
            <FiRefreshCw className="h-6 w-6 text-purple-400 animate-spin" />
          </div>
          <div>
            <div className="text-white font-medium mb-1">Loading integrations...</div>
            <div className="text-gray-400 text-sm">Fetching available apps and connections</div>
          </div>
        </div>
      </div>
    );
  }

  const connectedApps = availableApps.filter(app => getConnectionStatus(app.id));
  const availableToConnect = availableApps.filter(app => !getConnectionStatus(app.id));

  return (
    <div className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 rounded-xl border border-gray-700/50 p-8 backdrop-blur-sm hover:border-gray-600/50 transition-all duration-300">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center border border-purple-500/30">
            <FiTool className="h-6 w-6 text-purple-400" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white">App Integrations</h3>
            <p className="text-gray-400">Connect to popular productivity tools</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <div className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20">
            <span className="text-sm text-purple-300 font-medium">{connections.length} connected</span>
          </div>
          <button
            onClick={fetchConnections}
            className="p-2 rounded-lg hover:bg-gray-700/50 transition-all duration-200 hover:scale-105"
          >
            <FiRefreshCw className="h-4 w-4 text-gray-400" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm backdrop-blur-sm">
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full bg-red-400 mr-3"></div>
            {error}
          </div>
        </div>
      )}

      {/* Connected Apps */}
      {connectedApps.length > 0 && (
        <div className="mb-8">
          <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
            <div className="w-2 h-2 rounded-full bg-green-400 mr-3"></div>
            Connected Apps
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {connectedApps.map((app) => {
              const connection = getConnectionStatus(app.id);
              return (
                <div
                  key={app.id}
                  className="p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30 relative group hover:border-green-400/50 transition-all duration-300 backdrop-blur-sm"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-lg"
                      style={{ backgroundColor: app.color }}
                    >
                      {app.displayName.charAt(0)}
                    </div>
                    <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                      <FiCheck className="h-4 w-4 text-green-400" />
                    </div>
                  </div>
                  <div className="text-sm text-white font-semibold mb-1">{app.displayName}</div>
                  <div className="text-xs text-gray-400">
                    {connection?.connectedAt ?
                      `Connected ${new Date(connection.connectedAt).toLocaleDateString()}` :
                      'Connected'
                    }
                  </div>
                  <button
                    onClick={() => handleDisconnect(connection!)}
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-200 p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30"
                  >
                    <FiX className="h-3 w-3 text-red-400" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Available Apps */}
      {availableToConnect.length > 0 && (
        <div>
          <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
            <div className="w-2 h-2 rounded-full bg-blue-400 mr-3"></div>
            Available Apps
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {availableToConnect.map((app) => (
              <div
                key={app.id}
                className="p-4 rounded-xl bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300 group cursor-pointer hover:transform hover:scale-105 backdrop-blur-sm"
                onClick={() => handleConnect(app)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-lg transition-transform duration-300 group-hover:scale-110"
                    style={{ backgroundColor: app.color }}
                  >
                    {app.displayName.charAt(0)}
                  </div>
                  {connecting === app.id ? (
                    <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <FiRefreshCw className="h-4 w-4 text-blue-400 animate-spin" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gray-700/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                      <FiExternalLink className="h-3 w-3 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="text-sm text-white font-semibold mb-1">{app.displayName}</div>
                <div className="text-xs text-gray-400 leading-relaxed">{app.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {availableToConnect.length === 0 && connectedApps.length === 0 && (
        <div className="text-center py-12">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-gray-700/50 to-gray-800/50 flex items-center justify-center border border-gray-600/30">
            <FiTool className="h-10 w-10 text-gray-400" />
          </div>
          <h4 className="text-xl font-semibold text-white mb-3">No Apps Available</h4>
          <p className="text-gray-400 max-w-sm mx-auto leading-relaxed">
            App integrations are not available for your account yet. Contact support to enable additional integrations.
          </p>
        </div>
      )}
    </div>
  );
}
