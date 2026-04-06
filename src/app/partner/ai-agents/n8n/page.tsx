'use client';

import React, { useState, useEffect } from 'react';
import { FiLink, FiPlus, FiExternalLink, FiBook, FiDownload, FiKey, FiSettings } from 'react-icons/fi';
import N8nTokenModal from '@/components/partner/N8nTokenModal';
import GuidedPartnerSidebar from '@/components/partner/GuidedPartnerSidebar';
import { UserGuideProvider } from '@/context/UserGuideContext';
import { useRouter } from 'next/navigation';

const N8nAutomationPage = () => {
  const router = useRouter();
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [partnerName, setPartnerName] = useState('Partner');

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

  const handleLogout = () => {
    localStorage.removeItem('partner_token');
    window.location.href = '/partner/login';
  };

  return (
    <UserGuideProvider>
      <div className="min-h-screen bg-gray-900 text-white flex">
        <GuidedPartnerSidebar partnerName={partnerName} onLogout={handleLogout} />
        <div className="flex-1 ml-64">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <FiLink className="w-8 h-8 text-blue-400" />
                <h1 className="text-3xl font-bold text-white">N8N Automation</h1>
              </div>
              <p className="text-gray-400 text-lg">
                Connect your Knotie AI Pro tools with N8N workflows for powerful automation
              </p>
            </div>

            {/* Deploy Workflow Products Section */}
            <div className="bg-gradient-to-r from-blue-900 to-purple-900 rounded-lg p-6 border border-blue-700 mb-8">
              <div className="flex items-center gap-3 mb-4">
                <FiDownload className="w-8 h-8 text-blue-400" />
                <h2 className="text-2xl font-bold text-white">Deploy Knotie Compliant N8N Automation</h2>
              </div>
              <p className="text-gray-300 text-lg mb-6">
                Deploy pre-configured N8N workflow solutions as products for your customers.
                Choose from our curated library of automation templates designed for business success.
              </p>
              <button
                onClick={() => router.push('/partner/ai-agents/n8n/workflows')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors inline-flex items-center gap-2"
              >
                Browse Workflow Products <FiExternalLink className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <div className="flex items-center gap-3 mb-4">
                  <FiPlus className="w-6 h-6 text-green-400" />
                  <h3 className="text-lg font-semibold text-white">Create Authentication Token</h3>
                </div>
                <p className="text-gray-400 mb-4">
                  Generate secure tokens for your customers to use in N8N workflows
                </p>
                <button
                  onClick={() => setShowTokenModal(true)}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Create Token
                </button>
              </div>

              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <div className="flex items-center gap-3 mb-4">
                  <FiKey className="w-6 h-6 text-blue-400" />
                  <h3 className="text-lg font-semibold text-white">Manage Tokens</h3>
                </div>
                <p className="text-gray-400 mb-4">
                  View and manage all your N8N authentication tokens
                </p>
                <button
                  onClick={() => router.push('/partner/ai-agents/n8n/tokens')}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Manage Tokens
                </button>
              </div>

              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <div className="flex items-center gap-3 mb-4">
                  <FiDownload className="w-6 h-6 text-purple-400" />
                  <h3 className="text-lg font-semibold text-white">Install Knotie Node</h3>
                </div>
                <p className="text-gray-400 mb-4">
                  Add the Knotie community node to your N8N instance for seamless integration
                </p>
                <a
                  href="https://www.npmjs.com/package/n8n-nodes-knotie"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors inline-flex items-center justify-center gap-2"
                >
                  View on npm <FiExternalLink className="w-4 h-4" />
                </a>
              </div>

              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <div className="flex items-center gap-3 mb-4">
                  <FiSettings className="w-6 h-6 text-indigo-400" />
                  <h3 className="text-lg font-semibold text-white">N8N Instances</h3>
                </div>
                <p className="text-gray-400 mb-4">
                  Configure your N8N instances for automated workflow deployment
                </p>
                <button
                  onClick={() => router.push('/partner/ai-agents/n8n/instances')}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition-colors inline-flex items-center justify-center gap-2"
                >
                  Manage Instances <FiExternalLink className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <div className="flex items-center gap-3 mb-4">
                  <FiBook className="w-6 h-6 text-orange-400" />
                  <h3 className="text-lg font-semibold text-white">Documentation</h3>
                </div>
                <p className="text-gray-400 mb-4">
                  Learn how to set up and use N8N with Knotie AI Pro tools
                </p>
                <a
                  href="https://docs.knotie-ai.pro/n8n"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 px-4 rounded-lg transition-colors inline-flex items-center justify-center gap-2"
                >
                  View Docs <FiExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Features Overview */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
              <h2 className="text-xl font-semibold text-white mb-4">What You Can Do</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-medium text-blue-400 mb-2">🔗 Connect 100+ Tools</h3>
                  <p className="text-gray-400">
                    Access all your customer's integrated tools through a single N8N node
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-green-400 mb-2">🔒 Secure Authentication</h3>
                  <p className="text-gray-400">
                    Use customer-scoped tokens for secure access to specific tools
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-purple-400 mb-2">⚡ Real-time Execution</h3>
                  <p className="text-gray-400">
                    Execute tools in real-time with proper error handling and responses
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-orange-400 mb-2">📊 Usage Tracking</h3>
                  <p className="text-gray-400">
                    Monitor tool usage and performance through your analytics dashboard
                  </p>
                </div>
              </div>
            </div>

            {/* Getting Started */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h2 className="text-xl font-semibold text-white mb-4">Getting Started</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
                    1
                  </div>
                  <div>
                    <h3 className="text-white font-medium">Install the Knotie N8N Node</h3>
                    <p className="text-gray-400 text-sm">
                      Add the community node to your N8N instance via Settings → Community Nodes
                    </p>
                    <code className="bg-gray-900 text-green-400 px-2 py-1 rounded text-sm mt-1 inline-block">
                      n8n-nodes-knotie
                    </code>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
                    2
                  </div>
                  <div>
                    <h3 className="text-white font-medium">Create an N8N Token</h3>
                    <p className="text-gray-400 text-sm">
                      Generate a secure token for a specific customer with access to their tools
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
                    3
                  </div>
                  <div>
                    <h3 className="text-white font-medium">Configure Credentials</h3>
                    <p className="text-gray-400 text-sm">
                      Set up Knotie API credentials in N8N with your token and ConnectHub URL
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
                    4
                  </div>
                  <div>
                    <h3 className="text-white font-medium">Build Workflows</h3>
                    <p className="text-gray-400 text-sm">
                      Create powerful automation workflows using the Knotie node with 100+ tools
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Example Use Cases */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mt-8">
              <h2 className="text-xl font-semibold text-white mb-4">Example Use Cases</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-gray-900 rounded-lg p-4">
                  <h3 className="text-white font-medium mb-2">📧 Email Automation</h3>
                  <p className="text-gray-400 text-sm">
                    Trigger emails via Gmail when specific events occur in your workflows
                  </p>
                </div>
                <div className="bg-gray-900 rounded-lg p-4">
                  <h3 className="text-white font-medium mb-2">📊 Data Sync</h3>
                  <p className="text-gray-400 text-sm">
                    Sync data between Google Sheets, Notion, and other productivity tools
                  </p>
                </div>
                <div className="bg-gray-900 rounded-lg p-4">
                  <h3 className="text-white font-medium mb-2">💬 Slack Notifications</h3>
                  <p className="text-gray-400 text-sm">
                    Send automated notifications to Slack channels based on triggers
                  </p>
                </div>
                <div className="bg-gray-900 rounded-lg p-4">
                  <h3 className="text-white font-medium mb-2">📅 Calendar Management</h3>
                  <p className="text-gray-400 text-sm">
                    Create and manage calendar events across different platforms
                  </p>
                </div>
                <div className="bg-gray-900 rounded-lg p-4">
                  <h3 className="text-white font-medium mb-2">🔄 CRM Integration</h3>
                  <p className="text-gray-400 text-sm">
                    Sync customer data between CRM systems and other business tools
                  </p>
                </div>
                <div className="bg-gray-900 rounded-lg p-4">
                  <h3 className="text-white font-medium mb-2">📈 Analytics Reporting</h3>
                  <p className="text-gray-400 text-sm">
                    Generate automated reports using data from multiple sources
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* N8N Token Modal */}
      <N8nTokenModal
        isOpen={showTokenModal}
        onClose={() => setShowTokenModal(false)}
      />
    </UserGuideProvider>
  );
};

export default N8nAutomationPage;
