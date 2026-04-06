'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FiPlus, FiArrowLeft, FiKey, FiUsers, FiClock, FiActivity, FiBook, FiServer, FiZap, FiCode, FiShield, FiExternalLink } from 'react-icons/fi';
import GuidedPartnerSidebar from '@/components/partner/GuidedPartnerSidebar';
import { UserGuideProvider } from '@/context/UserGuideContext';
import McpTokenModal from '@/components/partner/McpTokenModal';
import toast from 'react-hot-toast';

interface Customer {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  companyName?: string;
}

interface McpToken {
  id: string;
  name: string;
  description?: string;
  scope: 'all' | Array<{ appName: string; toolName: string }>;
  tokenHash: string;
  expiresAt: string;
  usageLimit: number;
  isActive: boolean;
  createdAt: string;
  customer: Customer;
}

const McpTokensPage = () => {
  const router = useRouter();
  const [partnerName, setPartnerName] = useState('Partner');
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokens, setTokens] = useState<McpToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch partner info
  useEffect(() => {
    const fetchPartnerInfo = async () => {
      try {
        const token = localStorage.getItem('partner_token');
        if (!token) return;

        const response = await fetch('/api/partner/profile', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setPartnerName(data.partner?.businessName || data.partner?.contactName || 'Partner');
        }
      } catch (error) {
        console.error('Failed to fetch partner info:', error);
      }
    };

    fetchPartnerInfo();
  }, []);

  const fetchTokens = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch('/api/partner/mcp-tokens', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTokens(data.data || []);
      } else {
        toast.error('Failed to fetch MCP tokens');
      }
    } catch (error) {
      console.error('Failed to fetch tokens:', error);
      toast.error('Failed to fetch MCP tokens');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch tokens
  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  const handleLogout = () => {
    localStorage.removeItem('partner_token');
    window.location.href = '/partner/login';
  };

  const handleTokenCreated = useCallback(() => {
    setShowTokenModal(false);
    fetchTokens();
  }, [fetchTokens]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCustomerName = (customer: Customer) => {
    if (customer.companyName) return customer.companyName;
    if (customer.firstName && customer.lastName) {
      return `${customer.firstName} ${customer.lastName}`;
    }
    return customer.email;
  };

  const getScopeDisplay = (scope: McpToken['scope']) => {
    if (scope === 'all') return 'All Tools';
    if (Array.isArray(scope)) {
      return `${scope.length} specific tools`;
    }
    return 'Unknown scope';
  };

  return (
    <UserGuideProvider>
      <div className="min-h-screen bg-gray-900 text-white flex">
        <GuidedPartnerSidebar partnerName={partnerName} onLogout={handleLogout} />
        <div className="flex-1 ml-64">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-4 mb-4">
                <button
                  onClick={() => router.back()}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <FiArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3">
                  <FiKey className="w-8 h-8 text-purple-400" />
                  <h1 className="text-3xl font-bold text-white">MCP Token Management</h1>
                </div>
              </div>
              <p className="text-gray-400 text-lg">
                Create and manage authentication tokens for MCP (Model Context Protocol) clients
              </p>
            </div>

            {/* What is MCP - Hero Section */}
            <div className="bg-gradient-to-r from-purple-900/50 to-indigo-900/50 rounded-xl border border-purple-500/30 p-6 mb-8">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-purple-600/20 rounded-lg">
                  <FiBook className="w-8 h-8 text-purple-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-white mb-2">What is MCP?</h2>
                  <p className="text-gray-300 mb-4">
                    <strong className="text-purple-300">Model Context Protocol (MCP)</strong> is an open standard that allows AI applications
                    to securely connect with external tools and data sources. With MCP tokens, your customers&apos; connected tools
                    become accessible to any MCP-compatible AI client like Claude Desktop, N8N, Cursor, and more.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-600/20 text-purple-300 rounded-full text-sm">
                      <FiZap className="w-3.5 h-3.5" /> 100+ Integrated Tools
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-600/20 text-green-300 rounded-full text-sm">
                      <FiShield className="w-3.5 h-3.5" /> Secure Bearer Auth
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600/20 text-blue-300 rounded-full text-sm">
                      <FiCode className="w-3.5 h-3.5" /> JSON-RPC 2.0
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Start Guide */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Server Configuration */}
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-purple-600/20 rounded-lg">
                    <FiServer className="w-5 h-5 text-purple-400" />
                  </div>
                  <h3 className="text-lg font-medium text-white">Server Configuration</h3>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                    <p className="text-gray-400 text-xs mb-1">Server URL</p>
                    <code className="text-green-400 text-sm">https://mcp.knotie-ai.pro/api/mcp</code>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                    <p className="text-gray-400 text-xs mb-1">Transport</p>
                    <code className="text-blue-400 text-sm">HTTP (Streamable)</code>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                    <p className="text-gray-400 text-xs mb-1">Authentication</p>
                    <code className="text-yellow-400 text-sm">Bearer Token</code>
                  </div>
                </div>
              </div>

              {/* MCP Lifecycle */}
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-600/20 rounded-lg">
                    <FiActivity className="w-5 h-5 text-blue-400" />
                  </div>
                  <h3 className="text-lg font-medium text-white">Protocol Lifecycle</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 p-2 bg-gray-900 rounded border border-gray-700">
                    <span className="w-5 h-5 flex items-center justify-center bg-blue-600 text-white text-xs rounded">1</span>
                    <code className="text-yellow-400">initialize</code>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-gray-900 rounded border border-gray-700">
                    <span className="w-5 h-5 flex items-center justify-center bg-blue-600 text-white text-xs rounded">2</span>
                    <code className="text-yellow-400">notifications/initialized</code>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-gray-900 rounded border border-gray-700">
                    <span className="w-5 h-5 flex items-center justify-center bg-blue-600 text-white text-xs rounded">3</span>
                    <code className="text-yellow-400">tools/list</code>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-gray-900 rounded border border-gray-700">
                    <span className="w-5 h-5 flex items-center justify-center bg-blue-600 text-white text-xs rounded">4</span>
                    <code className="text-yellow-400">tools/call</code>
                  </div>
                </div>
              </div>

              {/* Credit Usage */}
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-yellow-600/20 rounded-lg">
                    <FiZap className="w-5 h-5 text-yellow-400" />
                  </div>
                  <h3 className="text-lg font-medium text-white">Usage & Credits</h3>
                </div>
                <div className="space-y-4 text-sm">
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                    <p className="text-yellow-400 font-medium mb-1">Credit Cost</p>
                    <p className="text-gray-300">Each tool call consumes <strong className="text-white">0.1 Knotie credits</strong></p>
                    <p className="text-gray-500 text-xs mt-1">~1,000 tool calls = 100 credits ≈ $1</p>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                    <p className="text-gray-400 text-xs mb-1">Tool Naming Format</p>
                    <code className="text-green-400">appname_toolname</code>
                    <p className="text-gray-500 text-xs mt-1">e.g., gmail_send_email, slack_post_message</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => setShowTokenModal(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2.5 px-5 rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <FiPlus className="w-4 h-4" />
                Create New Token
              </button>
              <a
                href="/docs/api-reference#mcp"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 transition-colors inline-flex items-center gap-2 text-sm"
              >
                <FiExternalLink className="w-4 h-4" />
                View Full API Documentation
              </a>
            </div>

            {/* Tokens List */}
            <div className="bg-gray-800 rounded-lg border border-gray-700">
              <div className="p-6 border-b border-gray-700">
                <h2 className="text-xl font-semibold text-white">Active Tokens</h2>
                <p className="text-gray-400 text-sm mt-1">
                  Manage authentication tokens for your MCP clients
                </p>
              </div>

              {isLoading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
                  <p className="text-gray-400 mt-2">Loading tokens...</p>
                </div>
              ) : tokens.length === 0 ? (
                <div className="p-8 text-center">
                  <FiKey className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">No tokens created yet</h3>
                  <p className="text-gray-400 mb-4">
                    Create your first MCP token to start integrating with AI tools
                  </p>
                  <button
                    onClick={() => setShowTokenModal(true)}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors inline-flex items-center gap-2"
                  >
                    <FiPlus className="w-4 h-4" />
                    Create Token
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-700">
                  {tokens.map((token) => (
                    <div key={token.id} className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-medium text-white">{token.name}</h3>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              token.isActive
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}>
                              {token.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>

                          {token.description && (
                            <p className="text-gray-400 text-sm mb-3">{token.description}</p>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div className="flex items-center gap-2 text-gray-400">
                              <FiUsers className="w-4 h-4" />
                              <span>{getCustomerName(token.customer)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-400">
                              <FiActivity className="w-4 h-4" />
                              <span>{getScopeDisplay(token.scope)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-400">
                              <FiClock className="w-4 h-4" />
                              <span>Expires {formatDate(token.expiresAt)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Example Code Section */}
            <div className="mt-8 bg-gray-800 rounded-lg border border-gray-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                <FiCode className="w-6 h-6 text-purple-400" />
                <h2 className="text-xl font-semibold text-white">Quick Start Examples</h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* N8N Example */}
                <div>
                  <h3 className="text-sm font-medium text-purple-400 mb-2">N8N MCP Client Configuration</h3>
                  <pre className="bg-gray-900 rounded-lg p-4 text-sm overflow-x-auto border border-gray-700">
                    <code className="text-gray-300">{`{
  "serverUrl": "https://mcp.knotie-ai.pro/api/mcp",
  "transport": "http",
  "authentication": {
    "type": "bearer",
    "token": "YOUR_MCP_TOKEN"
  }
}`}</code>
                  </pre>
                </div>

                {/* Claude Desktop Example */}
                <div>
                  <h3 className="text-sm font-medium text-purple-400 mb-2">Claude Desktop Configuration</h3>
                  <pre className="bg-gray-900 rounded-lg p-4 text-sm overflow-x-auto border border-gray-700">
                    <code className="text-gray-300">{`{
  "mcpServers": {
    "knotie": {
      "url": "https://mcp.knotie-ai.pro/api/mcp",
      "transport": "http",
      "headers": {
        "Authorization": "Bearer YOUR_MCP_TOKEN"
      }
    }
  }
}`}</code>
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MCP Token Modal */}
      <McpTokenModal
        isOpen={showTokenModal}
        onClose={() => setShowTokenModal(false)}
        onTokenCreated={handleTokenCreated}
      />
    </UserGuideProvider>
  );
};

export default McpTokensPage;

