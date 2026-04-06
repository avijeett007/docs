'use client';

import React, { useState, useEffect } from 'react';
import { FiCheck, FiX, FiRefreshCw, FiMail, FiExternalLink } from 'react-icons/fi';

interface Connection {
  provider: string;
  appName: string;
  status: string;
  connectedAt: string;
  lastVerified: string;
  metadata?: {
    toolsCount?: number;
    composioConnectionId?: string;
    connectedAt?: string;
  };
}

export default function TestIntegrationPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConnections = async () => {
    try {
      setLoading(true);
      setError(null);

      // Test direct Connect Hub API
      const hubResponse = await fetch('http://localhost:3001/tools/549ce6c6-426c-4d7e-a51e-2e585039c9d5/status');
      const hubData = await hubResponse.json();

      console.log('Connect Hub Response:', hubData);

      if (hubData.success) {
        setConnections(hubData.data.connections || []);
      } else {
        setError('Failed to fetch from Connect Hub');
      }
    } catch (err) {
      console.error('Error:', err);
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const testOAuthFlow = async () => {
    try {
      const response = await fetch('http://localhost:3001/oauth/composio/url?' + new URLSearchParams({
        tenantId: '549ce6c6-426c-4d7e-a51e-2e585039c9d5',
        partnerId: '288f6b30-fc9d-4187-89bd-dc602ed3c9d1',
        userId: '549ce6c6-426c-4d7e-a51e-2e585039c9d5',
        returnTo: window.location.href,
        appName: 'gmail'
      }));

      const data = await response.json();
      if (data.success && data.data.authUrl) {
        window.open(data.data.authUrl, '_blank');
      } else {
        alert('Failed to generate OAuth URL: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">Integration Test Page</h1>
              <p className="text-gray-400">Test Composio integration status and OAuth flow</p>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={fetchConnections}
                disabled={loading}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 disabled:opacity-50"
              >
                <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              
              <button
                onClick={testOAuthFlow}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-all duration-200"
              >
                <FiMail className="h-4 w-4" />
                <span>Test Gmail OAuth</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300">
              <div className="flex items-center">
                <FiX className="h-5 w-5 mr-3 flex-shrink-0" />
                {error}
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <FiRefreshCw className="h-8 w-8 text-blue-400 animate-spin mr-3" />
              <span className="text-white">Loading connections...</span>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white mb-4">
                Active Connections ({connections.length})
              </h2>
              
              {connections.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <FiExternalLink className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No connections found</p>
                  <p className="text-sm">Try connecting Gmail using the button above</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {connections.map((connection, index) => (
                    <div
                      key={index}
                      className="p-4 rounded-lg bg-gray-700/50 border border-gray-600/50"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                            <FiCheck className="h-5 w-5 text-green-400" />
                          </div>
                          <div>
                            <h3 className="text-white font-medium">
                              {connection.provider.charAt(0).toUpperCase() + connection.provider.slice(1)} - {connection.appName}
                            </h3>
                            <p className="text-sm text-gray-400">Status: {connection.status}</p>
                          </div>
                        </div>
                        
                        {connection.metadata?.toolsCount && (
                          <div className="text-right">
                            <div className="text-sm text-green-400 font-medium">
                              {connection.metadata.toolsCount} tools
                            </div>
                            <div className="text-xs text-gray-500">available</div>
                          </div>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">Connected:</span>
                          <div className="text-white">
                            {new Date(connection.connectedAt).toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-400">Last Verified:</span>
                          <div className="text-white">
                            {new Date(connection.lastVerified).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      
                      {connection.metadata?.composioConnectionId && (
                        <div className="mt-3 pt-3 border-t border-gray-600/50">
                          <span className="text-xs text-gray-500">
                            Composio ID: {connection.metadata.composioConnectionId}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
