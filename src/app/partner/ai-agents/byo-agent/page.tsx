'use client';

import React, { useState, useEffect } from 'react';
import { FiPlus, FiSettings, FiCopy, FiTrash2, FiEdit3, FiMoreVertical, FiInfo, FiRefreshCw, FiCode, FiKey } from 'react-icons/fi';
import GuidedPartnerSidebar from '@/components/partner/GuidedPartnerSidebar';
import { UserGuideProvider } from '@/context/UserGuideContext';
import NeonContainer from '@/components/NeonContainer';
import { Menu, Transition } from '@headlessui/react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { FreeForeverUpgradeService } from '@/lib/services/freeForeverUpgradeService';
import FreeForeverUpgradeModal from '@/components/partner/FreeForeverUpgradeModal';
import { ClientTierValidationService } from '@/lib/services/clientTierValidationService';
import ByoAgentModal from '@/components/partner/ByoAgentModal';

interface ByoAgent {
  id: string;
  name: string;
  description?: string;
  framework: 'livekit' | 'pipecat';
  customer_id: string;
  customer_name?: string;
  tool_definitions: Array<{ appName: string; toolName: string }>;
  status: 'active' | 'inactive' | 'revoked';
  is_active: boolean;
  webhook_url?: string;
  analytics_agent_id?: string;
  last_active_at?: string;
  created_at: string;
  updated_at: string;
}

interface CreatedAgentResponse {
  agent: ByoAgent & {
    api_token: string;
    webhook_secret: string;
  };
  integration: {
    pip_install: string;
    quick_start_code: string;
    docs_url: string;
  };
}

const ByoAgentsPage = () => {
  const [agents, setAgents] = useState<ByoAgent[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<ByoAgent | null>(null);
  const [createdAgentData, setCreatedAgentData] = useState<CreatedAgentResponse | null>(null);
  const [showTokenPanel, setShowTokenPanel] = useState(false);
  const [regeneratedToken, setRegeneratedToken] = useState<string | null>(null);
  const [regeneratedCode, setRegeneratedCode] = useState<string | null>(null);
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
          headers: { 'Authorization': `Bearer ${token}` }
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

  useEffect(() => {
    fetchAgents();
    fetchCustomers();
  }, []);

  const fetchAgents = async () => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;
      const response = await fetch('/api/partner/byo-agents', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAgents(data.agents || []);
      } else {
        toast.error('Failed to fetch BYO agents');
      }
    } catch (error) {
      console.error('Error fetching agents:', error);
      toast.error('Failed to fetch BYO agents');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;
      const response = await fetch('/api/partner/customers', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCustomers(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('partner_token');
    localStorage.removeItem('partner_name');
    window.location.href = '/partner/login';
  };

  const handleCreateAgentClick = async () => {
    try {
      const shouldShowFreeForeverUpgrade = await FreeForeverUpgradeService.shouldShowUpgradeEncouragement();
      if (shouldShowFreeForeverUpgrade) {
        const validation = await ClientTierValidationService.validateAgentCreation('byo');
        if (!validation.allowed) {
          const upgradeMessage = FreeForeverUpgradeService.getUpgradeMessage('byo_agents');
          setFreeForeverUpgradeData(upgradeMessage);
          setShowFreeForeverUpgrade(true);
          return;
        }
      }
      setShowCreateModal(true);
    } catch (error) {
      console.error('Error checking agent creation limits:', error);
      setShowCreateModal(true);
    }
  };

  const handleCreateAgent = async (agentData: any) => {
    const token = localStorage.getItem('partner_token');
    if (!token) return;
    const response = await fetch('/api/partner/byo-agents', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(agentData)
    });
    if (response.ok) {
      const data = await response.json();
      toast.success('BYO agent created successfully!');
      setShowCreateModal(false);
      setCreatedAgentData(data);
      setShowTokenPanel(true);
      fetchAgents();
      return data;
    } else {
      const error = await response.json();
      toast.error(error.error || 'Failed to create BYO agent');
      throw new Error(error.error);
    }
  };

  const handleUpdateAgent = async (agentId: string, agentData: any) => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;
      const response = await fetch(`/api/partner/byo-agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(agentData)
      });
      if (response.ok) {
        toast.success('BYO agent updated successfully!');
        setEditingAgent(null);
        fetchAgents();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update BYO agent');
      }
    } catch (error) {
      console.error('Error updating agent:', error);
      toast.error('Failed to update BYO agent');
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    if (!confirm('Are you sure you want to delete this BYO agent? This will revoke the API token and remove all analytics data. This action cannot be undone.')) {
      return;
    }
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;
      const response = await fetch(`/api/partner/byo-agents/${agentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        toast.success('BYO agent deleted successfully!');
        fetchAgents();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to delete BYO agent');
      }
    } catch (error) {
      console.error('Error deleting agent:', error);
      toast.error('Failed to delete BYO agent');
    }
  };

  const handleRegenerateToken = async (agentId: string) => {
    if (!confirm('Are you sure you want to regenerate the API token? The old token will be immediately invalidated.')) {
      return;
    }
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;
      const response = await fetch(`/api/partner/byo-agents/${agentId}/regenerate-token`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setRegeneratedToken(data.api_token);
        setRegeneratedCode(data.integration?.quick_start_code || null);
        toast.success('API token regenerated! Copy it now — it won\'t be shown again.');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to regenerate token');
      }
    } catch (error) {
      console.error('Error regenerating token:', error);
      toast.error('Failed to regenerate token');
    }
  };

  const handleToggleStatus = async (agent: ByoAgent) => {
    const newStatus = agent.status === 'active' ? 'inactive' : 'active';
    await handleUpdateAgent(agent.id, { status: newStatus });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const getFrameworkBadge = (framework: string) => {
    return framework === 'livekit'
      ? { label: 'LiveKit', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' }
      : { label: 'Pipecat', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' };
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return { label: 'Active', color: 'bg-green-500/20 text-green-300 border-green-500/30' };
      case 'inactive': return { label: 'Inactive', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' };
      case 'revoked': return { label: 'Revoked', color: 'bg-red-500/20 text-red-300 border-red-500/30' };
      default: return { label: status, color: 'bg-gray-500/20 text-gray-300 border-gray-500/30' };
    }
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
                    <FiCode className="w-8 h-8 text-blue-400" />
                    <h1 className="text-3xl font-bold text-white">BYO Agent (LiveKit / Pipecat)</h1>
                  </div>
                  <p className="text-gray-400 text-lg">
                    Connect your self-hosted voice AI agents built with LiveKit Agents or Pipecat. Full control over your infrastructure with Knotie tools and analytics.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleCreateAgentClick}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
                  >
                    <FiPlus className="w-5 h-5" />
                    New BYO Agent
                  </button>
                </div>
              </div>
            </div>

            {/* Token Display Panel (shown after creation or regeneration) */}
            {(showTokenPanel && createdAgentData) && (
              <div className="mb-8 bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                  <FiKey className="w-5 h-5 text-yellow-400" />
                  <h3 className="text-lg font-semibold text-yellow-300">⚠️ Save Your Credentials — Shown Only Once!</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">API Token</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-gray-800 px-3 py-2 rounded text-sm text-green-300 font-mono break-all">
                        {createdAgentData.agent.api_token}
                      </code>
                      <button onClick={() => copyToClipboard(createdAgentData.agent.api_token, 'API Token')} className="p-2 hover:bg-gray-700 rounded transition-colors">
                        <FiCopy className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Webhook Secret (for HMAC signing)</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-gray-800 px-3 py-2 rounded text-sm text-green-300 font-mono break-all">
                        {createdAgentData.agent.webhook_secret}
                      </code>
                      <button onClick={() => copyToClipboard(createdAgentData.agent.webhook_secret, 'Webhook Secret')} className="p-2 hover:bg-gray-700 rounded transition-colors">
                        <FiCopy className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Webhook URL</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-gray-800 px-3 py-2 rounded text-sm text-blue-300 font-mono break-all">
                        {createdAgentData.agent.webhook_url}
                      </code>
                      <button onClick={() => copyToClipboard(createdAgentData.agent.webhook_url || '', 'Webhook URL')} className="p-2 hover:bg-gray-700 rounded transition-colors">
                        <FiCopy className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Quick Start Code</label>
                    <div className="relative">
                      <pre className="bg-gray-800 px-4 py-3 rounded text-sm text-gray-300 font-mono overflow-x-auto max-h-64">
                        {createdAgentData.integration.quick_start_code}
                      </pre>
                      <button
                        onClick={() => copyToClipboard(createdAgentData.integration.quick_start_code, 'Quick Start Code')}
                        className="absolute top-2 right-2 p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                      >
                        <FiCopy className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <span>Install: </span>
                    <code className="bg-gray-800 px-2 py-1 rounded text-blue-300">{createdAgentData.integration.pip_install}</code>
                    <button onClick={() => copyToClipboard(createdAgentData.integration.pip_install, 'Install command')} className="p-1 hover:bg-gray-700 rounded">
                      <FiCopy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => { setShowTokenPanel(false); setCreatedAgentData(null); }}
                  className="mt-4 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  I&apos;ve saved my credentials — dismiss
                </button>
              </div>
            )}


            {/* Regenerated Token Panel */}
            {regeneratedToken && (
              <div className="mb-8 bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                  <FiRefreshCw className="w-5 h-5 text-yellow-400" />
                  <h3 className="text-lg font-semibold text-yellow-300">⚠️ New API Token — Copy Now!</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">New API Token</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-gray-800 px-3 py-2 rounded text-sm text-green-300 font-mono break-all">
                        {regeneratedToken}
                      </code>
                      <button onClick={() => copyToClipboard(regeneratedToken, 'API Token')} className="p-2 hover:bg-gray-700 rounded transition-colors">
                        <FiCopy className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </div>
                  {regeneratedCode && (
                    <div>
                      <label className="text-sm text-gray-400 block mb-1">Updated Quick Start Code</label>
                      <div className="relative">
                        <pre className="bg-gray-800 px-4 py-3 rounded text-sm text-gray-300 font-mono overflow-x-auto max-h-64">
                          {regeneratedCode}
                        </pre>
                        <button
                          onClick={() => copyToClipboard(regeneratedCode, 'Quick Start Code')}
                          className="absolute top-2 right-2 p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                        >
                          <FiCopy className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => { setRegeneratedToken(null); setRegeneratedCode(null); }}
                  className="mt-4 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  I&apos;ve saved my new token — dismiss
                </button>
              </div>
            )}

            {/* Agents Grid */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
              </div>
            ) : agents.length === 0 ? (
              <div className="text-center py-12">
                <FiCode className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-400 mb-2">No BYO Agents Yet</h3>
                <p className="text-gray-500 mb-6">Connect your self-hosted LiveKit or Pipecat agent to get started.</p>
                <button
                  onClick={handleCreateAgentClick}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 mx-auto transition-colors"
                >
                  <FiPlus className="w-5 h-5" />
                  Create Your First BYO Agent
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {agents.map((agent) => {
                  const frameworkBadge = getFrameworkBadge(agent.framework);
                  const statusBadge = getStatusBadge(agent.status);
                  return (
                    <NeonContainer key={agent.id} className="p-6 h-[380px] flex flex-col">
                      <div className="flex flex-col flex-1">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1 mr-4">
                            <div className="flex items-center justify-between">
                              <h3 className="text-lg font-semibold text-white truncate">{agent.name}</h3>
                              <div className="relative group">
                                <FiInfo className="w-5 h-5 cursor-help text-blue-400 hover:text-blue-300 transition-colors" />
                                <div className="absolute right-0 mt-2 w-72 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-20">
                                  <div className="text-sm space-y-3">
                                    <div>
                                      <div className="font-medium text-white mb-1">Customer</div>
                                      <div className="text-gray-300 text-xs">{agent.customer_name || 'Not assigned'}</div>
                                      <div className="text-gray-400 text-xs">ID: {agent.customer_id}</div>
                                    </div>
                                    <div className="border-t border-gray-600 pt-2">
                                      <div className="font-medium text-white mb-1">Framework</div>
                                      <div className="text-gray-300 text-xs">{agent.framework === 'livekit' ? 'LiveKit Agents' : 'Pipecat'}</div>
                                    </div>
                                    {agent.tool_definitions && agent.tool_definitions.length > 0 && (
                                      <div className="border-t border-gray-600 pt-2">
                                        <div className="font-medium text-white mb-1">Connected Tools</div>
                                        {agent.tool_definitions.map((tool, i) => (
                                          <div key={i} className="text-gray-300 text-xs">{tool.appName} → {tool.toolName}</div>
                                        ))}
                                      </div>
                                    )}
                                    {agent.last_active_at && (
                                      <div className="border-t border-gray-600 pt-2">
                                        <div className="font-medium text-white mb-1">Last Active</div>
                                        <div className="text-gray-300 text-xs">{new Date(agent.last_active_at).toLocaleString()}</div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <p className="text-sm text-gray-400">{agent.customer_name || agent.customer_id}</p>
                            {agent.description && (
                              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{agent.description}</p>
                            )}
                          </div>
                        </div>

                        {/* Badges row */}
                        <div className="flex items-center gap-2 mb-3">
                          <span className={clsx('px-2 py-0.5 rounded-full text-xs border', frameworkBadge.color)}>
                            {frameworkBadge.label}
                          </span>
                          <span className={clsx('px-2 py-0.5 rounded-full text-xs border', statusBadge.color)}>
                            {statusBadge.label}
                          </span>
                        </div>

                        {/* Info section */}
                        <div className="flex-1">
                          <div className="space-y-2">
                            {agent.tool_definitions && agent.tool_definitions.length > 0 && (
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-400">Tools:</span>
                                <span className="text-sm text-gray-300">{agent.tool_definitions.length} connected</span>
                              </div>
                            )}
                            <p className="text-sm text-gray-400">
                              Created: {new Date(agent.created_at).toLocaleDateString()}
                            </p>
                            {agent.last_active_at && (
                              <p className="text-sm text-gray-400">
                                Last Active: {new Date(agent.last_active_at).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="mt-4 flex items-center justify-between">
                          <button
                            onClick={() => handleToggleStatus(agent)}
                            className={clsx(
                              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                              agent.status === 'active'
                                ? 'bg-yellow-600/20 text-yellow-300 hover:bg-yellow-600/30'
                                : 'bg-green-600/20 text-green-300 hover:bg-green-600/30'
                            )}
                          >
                            {agent.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>

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
                              <Menu.Items className="absolute right-0 mt-2 w-52 origin-top-right bg-gray-800 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-30">
                                <div className="p-1">
                                  <Menu.Item>
                                    {({ active }) => (
                                      <button
                                        onClick={() => setEditingAgent(agent)}
                                        className={clsx('flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md', active ? 'bg-gray-700' : '')}
                                      >
                                        <FiEdit3 className="w-4 h-4" />
                                        <span>Edit Agent</span>
                                      </button>
                                    )}
                                  </Menu.Item>
                                  <Menu.Item>
                                    {({ active }) => (
                                      <button
                                        onClick={() => handleRegenerateToken(agent.id)}
                                        className={clsx('flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md', active ? 'bg-gray-700' : '')}
                                      >
                                        <FiRefreshCw className="w-4 h-4" />
                                        <span>Regenerate Token</span>
                                      </button>
                                    )}
                                  </Menu.Item>
                                  {agent.webhook_url && (
                                    <Menu.Item>
                                      {({ active }) => (
                                        <button
                                          onClick={() => copyToClipboard(agent.webhook_url!, 'Webhook URL')}
                                          className={clsx('flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md', active ? 'bg-gray-700' : '')}
                                        >
                                          <FiCopy className="w-4 h-4" />
                                          <span>Copy Webhook URL</span>
                                        </button>
                                      )}
                                    </Menu.Item>
                                  )}
                                  <Menu.Item>
                                    {({ active }) => (
                                      <button
                                        onClick={() => handleDeleteAgent(agent.id)}
                                        className={clsx('flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md text-red-500 hover:text-red-400', active ? 'bg-gray-700' : '')}
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
                    </NeonContainer>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create/Edit Agent Modal */}
      {(showCreateModal || editingAgent) && (
        <ByoAgentModal
          isOpen={showCreateModal || !!editingAgent}
          onClose={() => {
            setShowCreateModal(false);
            setEditingAgent(null);
          }}
          onSubmit={editingAgent
            ? (data) => handleUpdateAgent(editingAgent.id, data)
            : handleCreateAgent
          }
          customers={customers}
          editingAgent={editingAgent}
        />
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

export default ByoAgentsPage;