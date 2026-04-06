'use client';

import React, { useState, useEffect } from 'react';
import { FiPlus, FiMessageCircle, FiSettings, FiExternalLink, FiCopy, FiTrash2, FiEdit3, FiMoreVertical, FiGlobe, FiInfo, FiDatabase, FiUsers } from 'react-icons/fi';
import GuidedPartnerSidebar from '@/components/partner/GuidedPartnerSidebar';
import { UserGuideProvider } from '@/context/UserGuideContext';
import N8nChatAgentModal from '@/components/partner/N8nChatAgentModal';
import AdvancedWidgetModal from '@/components/partner/AdvancedWidgetModal';
import NeonContainer from '@/components/NeonContainer';
import { Menu, Transition } from '@headlessui/react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { FreeForeverUpgradeService } from '@/lib/services/freeForeverUpgradeService';
import FreeForeverUpgradeModal from '@/components/partner/FreeForeverUpgradeModal';
import { ClientTierValidationService } from '@/lib/services/clientTierValidationService';

interface N8nChatAgent {
  id: string;
  name: string;
  description?: string;
  customer_id: string;
  customer_name?: string;
  integration_mode: 'custom_node' | 'proxy';
  n8n_webhook_url?: string;
  webhook_secret: string;
  status: 'active' | 'inactive' | 'testing';
  created_at: string;
  updated_at: string;
  analytics?: {
    total_conversations: number;
    total_messages: number;
    avg_response_time_ms: number;
  };
}

const N8nChatAgentsPage = () => {
  const [agents, setAgents] = useState<N8nChatAgent[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<N8nChatAgent | null>(null);
  const [showWidgetModal, setShowWidgetModal] = useState(false);
  const [selectedAgentForWidget, setSelectedAgentForWidget] = useState<N8nChatAgent | null>(null);
  const [reassignAgent, setReassignAgent] = useState<N8nChatAgent | null>(null);
  const [partnerName, setPartnerName] = useState('Partner');

  // Free Forever Upgrade Modal state
  const [showFreeForeverUpgrade, setShowFreeForeverUpgrade] = useState(false);
  const [freeForeverUpgradeData, setFreeForeverUpgradeData] = useState({
    title: '',
    message: '',
    featureDescription: '',
  });

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

  // Fetch agents and customers
  useEffect(() => {
    fetchAgents();
    fetchCustomers();
  }, []);

  const fetchAgents = async () => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch('/api/partner/n8n-chat-agents', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAgents(data.agents || []);
      } else {
        toast.error('Failed to fetch N8N Chat agents');
      }
    } catch (error) {
      console.error('Error fetching agents:', error);
      toast.error('Failed to fetch N8N Chat agents');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch('/api/partner/customers', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCustomers(data.data || []); // Fix: use data.data instead of data.customers
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const handleCreateAgentClick = async () => {
    try {
      // Check if user is on free forever plan first
      const shouldShowFreeForeverUpgrade = await FreeForeverUpgradeService.shouldShowUpgradeEncouragement();

      if (shouldShowFreeForeverUpgrade) {
        // Check if they're at the agent limit for free forever users
        const validation = await ClientTierValidationService.validateAgentCreation('ghl'); // N8N agents use 'ghl' provider type

        if (!validation.allowed) {
          // Show free forever upgrade modal
          const upgradeMessage = FreeForeverUpgradeService.getUpgradeMessage('n8n_agents');
          setFreeForeverUpgradeData(upgradeMessage);
          setShowFreeForeverUpgrade(true);
          return;
        }
      }

      // Proceed with agent creation
      setShowCreateModal(true);
    } catch (error) {
      console.error('Error checking agent creation limits:', error);
      // Fallback: allow agent creation if check fails
      setShowCreateModal(true);
    }
  };

  const handleCreateAgent = async (agentData: any) => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch('/api/partner/n8n-chat-agents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(agentData)
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('N8N Chat agent created successfully!');
        setShowCreateModal(false);
        fetchAgents(); // Refresh the list
        return data;
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to create N8N Chat agent');
        throw new Error(error.message);
      }
    } catch (error) {
      console.error('Error creating agent:', error);
      throw error;
    }
  };

  const handleUpdateAgent = async (agentId: string, agentData: any) => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch(`/api/partner/n8n-chat-agents/${agentId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(agentData)
      });

      if (response.ok) {
        toast.success('N8N Chat agent updated successfully!');
        setEditingAgent(null);
        fetchAgents(); // Refresh the list
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to update N8N Chat agent');
      }
    } catch (error) {
      console.error('Error updating agent:', error);
      toast.error('Failed to update N8N Chat agent');
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    if (!confirm('Are you sure you want to delete this N8N Chat agent? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch(`/api/partner/n8n-chat-agents/${agentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        toast.success('N8N Chat agent deleted successfully!');
        fetchAgents(); // Refresh the list
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to delete N8N Chat agent');
      }
    } catch (error) {
      console.error('Error deleting agent:', error);
      toast.error('Failed to delete N8N Chat agent');
    }
  };

  const copyWebhookUrl = (agent: N8nChatAgent) => {
    const webhookUrl = `${process.env.ANALYTICS_API_URL || 'https://analytics.knotie-ai.pro'}/webhooks/n8n-chat/${agent.customer_id}/${agent.id}`;
    navigator.clipboard.writeText(webhookUrl);
    toast.success('Webhook URL copied to clipboard!');
  };

  const copyProxyUrl = (agent: N8nChatAgent) => {
    // Get partner ID from localStorage (JWT token)
    const getPartnerId = () => {
      try {
        const token = localStorage.getItem('partner_token');
        if (!token) return null;

        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.partnerId;
      } catch (error) {
        console.error('Error getting partner ID:', error);
        return null;
      }
    };

    const partnerId = getPartnerId();
    if (!partnerId) {
      toast.error('Unable to get partner ID');
      return;
    }

    const proxyUrl = `${process.env.ANALYTICS_API_URL || 'https://analytics.knotie-ai.pro'}/proxy/n8n-chat/${partnerId}/${agent.customer_id}/${agent.id}`;
    navigator.clipboard.writeText(proxyUrl);
    toast.success('Proxy URL copied to clipboard!');
  };

  const copyEmbedCode = async (agent: N8nChatAgent) => {
    try {
      // First, check if there are existing widgets for this agent
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch(`/api/partner/n8n-chat-widgets?agentId=${agent.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.widgets && data.widgets.length > 0) {
          // Use the first widget's embed code
          const widget = data.widgets[0];
          const embedCode = generateEmbedCode(widget);
          navigator.clipboard.writeText(embedCode);
          toast.success('Embed code copied to clipboard!');
        } else {
          // No widgets exist, suggest creating one
          toast('No widgets found. Create a widget first to get embed code.', { icon: 'ℹ️' });
          handleCreateWidget(agent);
        }
      } else {
        toast.error('Failed to fetch widget information');
      }
    } catch (error) {
      console.error('Error copying embed code:', error);
      toast.error('Failed to copy embed code');
    }
  };

  const generateEmbedCode = (widget: any) => {
    const baseUrl = window.location.origin;
    return `<!-- Knotie N8N Chat Widget -->
<script>
  (function() {
    var script = document.createElement('script');
    script.src = '${baseUrl}/widgets/n8n-chat.js';
    script.setAttribute('data-widget-token', '${widget.widgetToken}');
    script.setAttribute('data-widget-config', '${JSON.stringify(widget.widgetConfig)}');
    script.setAttribute('data-appearance', '${JSON.stringify(widget.appearance)}');
    script.setAttribute('data-behavior', '${JSON.stringify(widget.behavior)}');
    document.head.appendChild(script);
  })();
</script>
<!-- End Knotie N8N Chat Widget -->`;
  };

  const handleCreateWidget = (agent: N8nChatAgent) => {
    setSelectedAgentForWidget(agent);
    setShowWidgetModal(true);
  };

  const handleReassignAgent = async (agentId: string, newCustomerId: string) => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch(`/api/partner/n8n-chat-agents/${agentId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customer_id: newCustomerId
        })
      });

      if (response.ok) {
        toast.success('Agent reassigned successfully');
        setReassignAgent(null);
        fetchAgents(); // Refresh the agents list
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to reassign agent');
      }
    } catch (error) {
      console.error('Error reassigning agent:', error);
      toast.error('Failed to reassign agent');
    }
  };

  const registerWithAnalytics = async (agent: N8nChatAgent) => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      toast.loading('Registering agent with analytics service...');

      const response = await fetch(`/api/partner/n8n-chat-agents/${agent.id}/register-analytics`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        toast.dismiss();
        toast.success('Agent registered with analytics service successfully!');
        console.log('Analytics registration result:', data);
      } else {
        const error = await response.json();
        toast.dismiss();
        toast.error(error.error || 'Failed to register agent with analytics service');
      }
    } catch (error) {
      console.error('Error registering agent with analytics:', error);
      toast.dismiss();
      toast.error('Failed to register agent with analytics service');
    }
  };

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
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <FiMessageCircle className="w-8 h-8 text-blue-400" />
                    <h1 className="text-3xl font-bold text-white">N8N Chat Agents</h1>
                  </div>
                  <p className="text-gray-400 text-lg">
                    Manage your N8N-powered chat agents with integrated analytics
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleCreateAgentClick}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors"
                  >
                    <FiPlus className="w-5 h-5" />
                    Create Chat Agent
                  </button>
                </div>
              </div>
            </div>

            {/* Integration Mode Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                    <FiSettings className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">Custom Node Mode</h3>
                </div>
                <p className="text-gray-400 text-sm mb-3">
                  Install the n8n-nodes-knotie-chat package for direct integration with per-message analytics.
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-blue-600/20 text-blue-400 px-2 py-1 rounded">Technical</span>
                  <span className="text-xs bg-green-600/20 text-green-400 px-2 py-1 rounded">Full Control</span>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                    <FiExternalLink className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">Proxy Mode</h3>
                </div>
                <p className="text-gray-400 text-sm mb-3">
                  Use standard N8N Chat Trigger with Knotie proxy for easier setup and same analytics.
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-purple-600/20 text-purple-400 px-2 py-1 rounded">Easy Setup</span>
                  <span className="text-xs bg-green-600/20 text-green-400 px-2 py-1 rounded">Full Analytics</span>
                </div>
              </div>
            </div>

            {/* Agents Grid */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
              </div>
            ) : agents.length === 0 ? (
              <div className="text-center py-12">
                <FiMessageCircle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-400 mb-2">No N8N Chat Agents Yet</h3>
                <p className="text-gray-500 mb-6">Create your first N8N Chat agent to get started with automated conversations.</p>
                <button
                  onClick={handleCreateAgentClick}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 mx-auto transition-colors"
                >
                  <FiPlus className="w-5 h-5" />
                  Create Your First Chat Agent
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {agents.map((agent) => (
                  <NeonContainer key={agent.id} className="p-6 h-[380px] flex flex-col">
                    <div className="flex flex-col flex-1">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1 mr-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-white">{agent.name}</h3>
                            <div className="relative group">
                              <FiInfo className="w-5 h-5 cursor-help text-blue-400 hover:text-blue-300 transition-colors" />
                              <div className="absolute right-0 mt-2 w-72 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-20">
                                <div className="text-sm space-y-3">
                                  {/* Customer Information */}
                                  <div>
                                    <div className="font-medium text-white mb-1">Customer</div>
                                    <div className="text-gray-300 text-xs">
                                      {agent.customer_name || 'Not assigned'}
                                    </div>
                                    <div className="text-gray-400 text-xs">
                                      ID: {agent.customer_id}
                                    </div>
                                  </div>

                                  {/* Integration Mode */}
                                  <div className="border-t border-gray-600 pt-2">
                                    <div className="font-medium text-white mb-1">Integration Mode</div>
                                    <div className="text-gray-300 text-xs">
                                      {agent.integration_mode === 'custom_node' ? 'Custom Node Mode' : 'Proxy Mode'}
                                    </div>
                                    <div className="text-gray-400 text-xs mt-1">
                                      {agent.integration_mode === 'custom_node'
                                        ? 'Direct N8N integration with custom node'
                                        : 'Standard N8N Chat Trigger with Knotie proxy'
                                      }
                                    </div>
                                  </div>

                                  {/* Analytics */}
                                  {agent.analytics && (
                                    <div className="border-t border-gray-600 pt-2">
                                      <div className="font-medium text-white mb-1">Analytics</div>
                                      <div className="text-gray-300 text-xs">
                                        {agent.analytics.total_conversations} conversations
                                      </div>
                                      <div className="text-gray-300 text-xs">
                                        {agent.analytics.total_messages} messages
                                      </div>
                                      {agent.analytics.avg_response_time_ms && (
                                        <div className="text-gray-300 text-xs">
                                          Avg response: {agent.analytics.avg_response_time_ms}ms
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          <p className="text-sm text-gray-400">{agent.customer_name || agent.customer_id}</p>
                          {agent.description && (
                            <p className="text-sm text-gray-500 mt-2">{agent.description}</p>
                          )}
                        </div>
                        <div className="flex items-start gap-2">
                          <div className={clsx(
                            'px-2 py-1 rounded-full text-xs',
                            agent.status === 'active' ? 'bg-green-500/20 text-green-400' :
                            agent.status === 'testing' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-red-500/20 text-red-400'
                          )}>
                            {agent.status}
                          </div>
                          <Menu as="div" className="relative">
                            <Menu.Button className="p-1 rounded-lg hover:bg-gray-800 transition-colors">
                              <FiMoreVertical className="w-5 h-5 text-gray-400" />
                            </Menu.Button>
                            <Transition
                              enter="transition duration-100 ease-out"
                              enterFrom="transform scale-95 opacity-0"
                              enterTo="transform scale-100 opacity-100"
                              leave="transition duration-75 ease-out"
                              leaveFrom="transform scale-100 opacity-100"
                              leaveTo="transform scale-95 opacity-0"
                            >
                              <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right bg-gray-800 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-30">
                                <div className="p-1">
                                  <Menu.Item>
                                    {({ active }) => (
                                      <button
                                        onClick={() => setEditingAgent(agent)}
                                        className={clsx(
                                          'flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md',
                                          active ? 'bg-gray-700' : ''
                                        )}
                                      >
                                        <FiEdit3 className="w-4 h-4" />
                                        <span>Edit Agent</span>
                                      </button>
                                    )}
                                  </Menu.Item>
                                  <Menu.Item>
                                    {({ active }) => (
                                      <button
                                        onClick={() => agent.integration_mode === 'custom_node' ? copyWebhookUrl(agent) : copyProxyUrl(agent)}
                                        className={clsx(
                                          'flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md',
                                          active ? 'bg-gray-700' : ''
                                        )}
                                      >
                                        <FiCopy className="w-4 h-4" />
                                        <span>Copy {agent.integration_mode === 'custom_node' ? 'Webhook' : 'Proxy'} URL</span>
                                      </button>
                                    )}
                                  </Menu.Item>
                                  <Menu.Item>
                                    {({ active }) => (
                                      <button
                                        onClick={() => copyEmbedCode(agent)}
                                        className={clsx(
                                          'flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md',
                                          active ? 'bg-gray-700' : ''
                                        )}
                                      >
                                        <FiExternalLink className="w-4 h-4" />
                                        <span>Copy Embed Code</span>
                                      </button>
                                    )}
                                  </Menu.Item>
                                  <Menu.Item>
                                    {({ active }) => (
                                      <button
                                        onClick={() => handleCreateWidget(agent)}
                                        className={clsx(
                                          'flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md',
                                          active ? 'bg-gray-700' : ''
                                        )}
                                      >
                                        <FiGlobe className="w-4 h-4" />
                                        <span>Create Widget</span>
                                      </button>
                                    )}
                                  </Menu.Item>
                                  <Menu.Item>
                                    {({ active }) => (
                                      <button
                                        onClick={() => setReassignAgent(agent)}
                                        className={clsx(
                                          'flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md',
                                          active ? 'bg-gray-700 text-white' : 'text-gray-300 hover:text-white'
                                        )}
                                      >
                                        <FiUsers className="w-4 h-4" />
                                        <span>Reassign Customer</span>
                                      </button>
                                    )}
                                  </Menu.Item>
                                  <Menu.Item>
                                    {({ active }) => (
                                      <button
                                        onClick={() => registerWithAnalytics(agent)}
                                        className={clsx(
                                          'flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md',
                                          active ? 'bg-gray-700 text-white' : 'text-gray-300 hover:text-white'
                                        )}
                                      >
                                        <FiDatabase className="w-4 h-4" />
                                        <span>Register with Analytics</span>
                                      </button>
                                    )}
                                  </Menu.Item>
                                  <Menu.Item>
                                    {({ active }) => (
                                      <button
                                        onClick={() => handleDeleteAgent(agent.id)}
                                        className={clsx(
                                          'flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md text-red-500 hover:text-red-400',
                                          active ? 'bg-gray-700' : ''
                                        )}
                                      >
                                        <FiTrash2 className="w-4 h-4" />
                                        <span>Delete Agent</span>
                                      </button>
                                    )}
                                  </Menu.Item>
                                </div>
                              </Menu.Items>
                            </Transition>
                          </Menu>
                        </div>
                      </div>

                      <div className="flex-1">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-400">Integration Mode:</span>
                            <span className={clsx(
                              'px-2 py-1 rounded-full text-xs font-medium',
                              agent.integration_mode === 'custom_node'
                                ? 'bg-blue-600/20 text-blue-400'
                                : 'bg-purple-600/20 text-purple-400'
                            )}>
                              {agent.integration_mode === 'custom_node' ? 'Custom Node' : 'Proxy Mode'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-400">
                            Created: {new Date(agent.created_at).toLocaleDateString()}
                          </p>
                          <p className="text-sm text-gray-400">
                            Last Modified: {new Date(agent.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        <button
                          onClick={() => handleCreateWidget(agent)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm bg-purple-600 hover:bg-purple-500"
                        >
                          <FiGlobe className="w-4 h-4" />
                          <span>Create Embeddable Widget</span>
                        </button>
                      </div>
                    </div>
                  </NeonContainer>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create/Edit Agent Modal */}
      {(showCreateModal || editingAgent) && (
        <N8nChatAgentModal
          isOpen={showCreateModal || !!editingAgent}
          onClose={() => {
            setShowCreateModal(false);
            setEditingAgent(null);
          }}
          onSubmit={editingAgent ? 
            (data) => handleUpdateAgent(editingAgent.id, data) : 
            handleCreateAgent
          }
          customers={customers}
          editingAgent={editingAgent}
        />
      )}

      {/* Widget Creation Modal */}
      {showWidgetModal && selectedAgentForWidget && (
        <AdvancedWidgetModal
          isOpen={showWidgetModal}
          onClose={() => {
            setShowWidgetModal(false);
            setSelectedAgentForWidget(null);
          }}
          agent={selectedAgentForWidget}
        />
      )}

      {/* Reassign Agent Modal */}
      {reassignAgent && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg max-w-md w-full border border-gray-800">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-800">
              <h2 className="text-xl font-semibold text-white">Reassign Agent</h2>
              <p className="text-sm text-gray-400 mt-1">
                Reassign "{reassignAgent.name}" to a different customer
              </p>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Current Customer
                </label>
                <div className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-gray-400">
                  {reassignAgent.customer_name || reassignAgent.customer_id}
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  New Customer
                </label>
                <select
                  id="newCustomer"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  defaultValue=""
                >
                  <option value="" disabled>Select a customer...</option>
                  {customers
                    .filter(customer => customer.id !== reassignAgent.customer_id)
                    .map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.firstName && customer.lastName
                          ? `${customer.firstName} ${customer.lastName}`
                          : customer.email
                        }
                      </option>
                    ))
                  }
                </select>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setReassignAgent(null)}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const select = document.getElementById('newCustomer') as HTMLSelectElement;
                    const newCustomerId = select.value;
                    if (newCustomerId) {
                      handleReassignAgent(reassignAgent.id, newCustomerId);
                    } else {
                      toast.error('Please select a customer');
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                >
                  Reassign Agent
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Free Forever Upgrade Modal */}
      <FreeForeverUpgradeModal
        isOpen={showFreeForeverUpgrade}
        onClose={() => setShowFreeForeverUpgrade(false)}
        title={freeForeverUpgradeData.title}
        message={freeForeverUpgradeData.message}
        featureDescription={freeForeverUpgradeData.featureDescription}
      />
    </UserGuideProvider>
  );
};

export default N8nChatAgentsPage;
