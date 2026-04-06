'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiDownload, FiMoreVertical, FiTrash2, FiEdit3, FiRefreshCw, FiSend, FiGlobe, FiInfo, FiUsers, FiBarChart, FiPlay, FiCode, FiCopy, FiCheck, FiX, FiAlertTriangle } from 'react-icons/fi';
import GuidedPartnerSidebar from '@/components/partner/GuidedPartnerSidebar';
import { UserGuideProvider } from '@/context/UserGuideContext';
import NeonContainer from '@/components/NeonContainer';
import { WebhookManager } from '@/components/WebhookManager';
import { Menu, Transition } from '@headlessui/react';
import { Dialog } from '@headlessui/react';
import clsx from 'clsx';
import toast, { Toaster } from 'react-hot-toast';
import RetellChatAgentImportModal from '@/components/partner/RetellChatAgentImportModal';
import RetellChatAgentEditModal from '@/components/partner/RetellChatAgentEditModal';
import AgentMetricsConfig from '@/components/partner/AgentMetricsConfig';
import AgentDeletionModal from '@/components/partner/AgentDeletionModal';
import { FreeForeverUpgradeService } from '@/lib/services/freeForeverUpgradeService';
import FreeForeverUpgradeModal from '@/components/partner/FreeForeverUpgradeModal';
import { ClientTierValidationService } from '@/lib/services/clientTierValidationService';
import { WebhookSyncButton } from '@/components/analytics/WebhookSyncButton';
import ChatAgentTestModal from '@/components/partner/ChatAgentTestModal';

interface RetellChatAgent {
  id: string;
  name: string;
  description?: string;
  customerId: string | null;
  customer: {
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
  } | null;
  responseEngineType: string;
  language: string;
  webhookUrl?: string;
  webhookEnabled?: boolean;
  webhookMode?: string;
  preExistingWebhookUrl?: string;
  forwardToPreExisting?: boolean;
  partnerWebhookUrl?: string;
  smsEnabled: boolean;
  smsPhoneNumber?: string;
  autoCloseMessage?: string;
  isPublic: boolean;
  status: string;
  isActive: boolean;
  isPublished: boolean;
  analyticsAgentId?: string;
  creditConfig: any;
  widgetCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function RetellChatAgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<RetellChatAgent[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<RetellChatAgent | null>(null);
  const [partnerName, setPartnerName] = useState('Partner');
  const [showSmsDialog, setShowSmsDialog] = useState(false);
  const [selectedAgentForSms, setSelectedAgentForSms] = useState<RetellChatAgent | null>(null);
  const [smsPhone, setSmsPhone] = useState('');
  const [smsSending, setSmsSending] = useState(false);
  const [webhookLoading, setWebhookLoading] = useState<Record<string, boolean>>({});

  // Customer mapping state
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [profitMultiplier, setProfitMultiplier] = useState(1.2);
  const [customersLoading, setCustomersLoading] = useState(false);

  // Agent deletion state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<RetellChatAgent | null>(null);

  // Metrics Configuration modal state
  const [metricsModalState, setMetricsModalState] = useState<{
    isOpen: boolean;
    agentId?: string;
    agentName?: string;
  }>({
    isOpen: false
  });

  // Free Forever Upgrade Modal state
  const [showFreeForeverUpgrade, setShowFreeForeverUpgrade] = useState(false);
  const [freeForeverUpgradeData, setFreeForeverUpgradeData] = useState({
    title: '',
    message: '',
    featureDescription: '',
  });
  const [pendingAction, setPendingAction] = useState<'import' | null>(null);

  // Test modal state
  const [testModalState, setTestModalState] = useState<{
    isOpen: boolean;
    agentId?: string;
    agentName?: string;
  }>({ isOpen: false });

  // Widget instructions modal state
  const [widgetInstructionsAgent, setWidgetInstructionsAgent] = useState<RetellChatAgent | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('partner_token');
    const name = localStorage.getItem('partner_name') || 'Partner';
    setPartnerName(name);

    if (!token) {
      router.push('/partner/login');
      return;
    }

    fetchAgents();
    fetchCustomers();
  }, [router]);

  // Function to proceed with pending action (used by "Maybe Later" callback)
  const proceedWithPendingAction = () => {
    if (pendingAction === 'import') {
      setShowImportModal(true);
    }
    setPendingAction(null);
  };

  const fetchAgents = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('partner_token');
      if (!token) return;
      const response = await fetch('/api/partner/retell-chat-agents', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setAgents(Array.isArray(data) ? data : []);
        setError(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch Retell Chat agents');
        setAgents([]);
      }
    } catch (err) {
      console.error('Error fetching agents:', err);
      setError('Failed to fetch Retell Chat agents. Please try again later.');
      setAgents([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;
      const response = await fetch('/api/partner/customers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        let customersArray = [];
        if (Array.isArray(data)) {
          customersArray = data;
        } else if (data && typeof data === 'object') {
          customersArray = data.customers || data.data || [];
        }
        setCustomers(customersArray);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const handleImportClick = async () => {
    try {
      const shouldShowUpgrade = await FreeForeverUpgradeService.shouldShowUpgradeEncouragement();
      if (shouldShowUpgrade) {
        const validation = await ClientTierValidationService.validateAgentCreation('retell');
        if (!validation.allowed) {
          const upgradeMessage = FreeForeverUpgradeService.getUpgradeMessage('retell_chat_agents');
          setFreeForeverUpgradeData({
            ...upgradeMessage,
            message: `You've reached the Free Forever limit of Retell Chat agents. Upgrade to create unlimited agents and unlock premium features.`
          });
          setShowFreeForeverUpgrade(true);
          setPendingAction('import');
          return;
        }
      }
      setShowImportModal(true);
    } catch (error) {
      console.error('Error checking import limits:', error);
      setShowImportModal(true);
    }
  };



  const handleSyncAgent = async (agentId: string) => {
    try {
      const token = localStorage.getItem('partner_token');
      const response = await fetch(`/api/partner/retell-chat-agents/${agentId}?sync=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        toast.success('Agent synced from Retell');
        fetchAgents();
      } else {
        toast.error('Failed to sync agent');
      }
    } catch (error) {
      toast.error('Failed to sync agent');
    }
  };

  const handleUpdateWebhook = async (agentId: string, data: {
    webhookEnabled: boolean;
    webhookMode: 'manual' | 'automatic';
    preExistingWebhookUrl?: string;
    forwardToPreExisting: boolean;
  }) => {
    try {
      setWebhookLoading(prev => ({ ...prev, [agentId]: true }));

      const token = localStorage.getItem('partner_token');
      if (!token) {
        router.push('/partner/login');
        return false;
      }

      const response = await fetch(`/api/partner/retell-chat-agents/${agentId}/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update webhook configuration');
      }

      const result = await response.json();

      setAgents(agents.map(agent =>
        agent.id === agentId ? {
          ...agent,
          webhookEnabled: result.webhookEnabled,
          webhookUrl: result.webhookUrl,
          webhookMode: result.webhookMode,
          preExistingWebhookUrl: result.preExistingWebhookUrl,
          forwardToPreExisting: result.forwardToPreExisting
        } : agent
      ));

      toast.success('Webhook configuration updated successfully');
      return true;
    } catch (error) {
      console.error('Error updating webhook configuration:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update webhook configuration');
      return false;
    } finally {
      setWebhookLoading(prev => ({ ...prev, [agentId]: false }));
    }
  };

  const handleSendSms = async () => {
    if (!selectedAgentForSms || !smsPhone) return;
    try {
      setSmsSending(true);
      const token = localStorage.getItem('partner_token');
      const response = await fetch(`/api/partner/retell-chat-agents/${selectedAgentForSms.id}/sms`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneNumber: smsPhone }),
      });
      if (response.ok) {
        const data = await response.json();
        toast.success(`SMS chat initiated! Chat ID: ${data.chatId}`);
        setShowSmsDialog(false);
        setSmsPhone('');
        setSelectedAgentForSms(null);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to send SMS');
      }
    } catch (error) {
      toast.error('Failed to send SMS');
    } finally {
      setSmsSending(false);
    }
  };

  const handleImportComplete = () => {
    setShowImportModal(false);
    fetchAgents();
  };

  // Customer mapping handlers
  const handleAssignCustomer = (agentId: string) => {
    setSelectedAgent(agentId);
    setShowCustomerModal(true);
    fetchCustomersForMapping();
  };

  const fetchCustomersForMapping = async () => {
    try {
      setCustomersLoading(true);
      const token = localStorage.getItem('partner_token');
      if (!token) {
        router.push('/partner/login');
        return;
      }
      const response = await fetch('/api/partner/customers', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cookie': `partner_token=${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        let customersArray = [];
        if (Array.isArray(data)) {
          customersArray = data;
        } else if (data && typeof data === 'object') {
          customersArray = data.customers || data.data || [];
        }
        setCustomers(customersArray);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setCustomersLoading(false);
    }
  };

  const handleSaveCustomerMapping = async () => {
    if (!selectedAgent || !selectedCustomer) return;

    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        router.push('/partner/login');
        return;
      }

      const response = await fetch(`/api/partner/retell-chat-agents/${selectedAgent}/map-customer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          customerId: selectedCustomer,
          profitMultiplier
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to map customer to agent');
      }

      const data = await response.json();

      setAgents(agents.map(agent =>
        agent.id === selectedAgent ? {
          ...agent,
          customer: data.agent.customer,
          customerId: data.agent.customerId,
        } : agent
      ));

      setShowCustomerModal(false);
      setSelectedAgent(null);
      setSelectedCustomer(null);

      toast.success('Successfully mapped customer to agent');
    } catch (error) {
      console.error('Error mapping customer:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to map customer to agent');
    }
  };

  const handleRemoveFromCustomer = async (agentId: string) => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        router.push('/partner/login');
        return;
      }

      const response = await fetch(`/api/partner/retell-chat-agents/${agentId}/unmap-customer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to remove customer from agent');
      }

      setAgents(agents.map(agent => {
        if (agent.id === agentId) {
          return { ...agent, customerId: null, customer: null } as RetellChatAgent;
        }
        return agent;
      }));

      toast.success('Customer removed from agent successfully');
    } catch (error) {
      console.error('Error removing customer from agent:', error);
      toast.error('Failed to remove customer from agent');
    }
  };

  // Metrics configuration handlers
  const handleConfigureMetrics = (agentId: string, agentName: string) => {
    setMetricsModalState({ isOpen: true, agentId, agentName });
  };

  const handleMetricsModalClose = () => {
    setMetricsModalState(prev => ({ ...prev, isOpen: false }));
  };

  const handleMetricsSaved = () => {
    toast.success('Metrics configuration saved successfully');
    handleMetricsModalClose();
  };

  // Test agent handler
  const handleTestAgent = (agentId: string, agentName: string) => {
    setTestModalState({ isOpen: true, agentId, agentName });
  };

  // Widget instructions handler
  const handleWidgetInstructions = (agent: RetellChatAgent) => {
    setWidgetInstructionsAgent(agent);
    setCopiedSnippet(false);
  };

  const copyWidgetSnippet = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  // Agent deletion handlers
  const handleDeleteAgent = (agent: RetellChatAgent) => {
    setAgentToDelete(agent);
    setShowDeleteModal(true);
  };

  const handleDeleteFromPortal = async (agentId: string) => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        router.push('/partner/login');
        return;
      }

      const response = await fetch(`/api/partner/retell-chat-agents/${agentId}/delete-from-portal`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete agent from portal');
      }

      setAgents(agents.filter(agent => agent.id !== agentId));
      toast.success('Agent deleted from portal successfully');
    } catch (error) {
      console.error('Error deleting agent from portal:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete agent from portal');
    }
  };

  const handleDeleteEverywhere = async (_agentId: string) => {
    toast.error('Delete Everywhere feature is coming soon');
  };

  // Analytics registration handler
  const handleRegisterAgentWithAnalytics = async (agentId: string) => {
    try {
      setWebhookLoading(prev => ({ ...prev, [agentId]: true }));

      const token = localStorage.getItem('partner_token');
      if (!token) {
        router.push('/partner/login');
        return;
      }

      const response = await fetch(`/api/partner/retell-chat-agents/${agentId}/register-analytics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to register agent with analytics service');
      }

      const result = await response.json();

      setAgents(agents.map(agent =>
        agent.id === agentId ? {
          ...agent,
          analyticsAgentId: result.analyticsAgentId,
          webhookUrl: result.webhookUrl,
          webhookEnabled: result.webhookEnabled || false,
          webhookMode: result.webhookMode || 'manual',
        } : agent
      ));

      if (result.webhookEnabled) {
        toast.success('Webhook enabled successfully in Retell!');
      } else {
        toast.success('Webhook registered. Please complete configuration manually.');
      }
    } catch (error) {
      console.error('Error registering agent with analytics service:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to enable webhook for agent');
    } finally {
      setWebhookLoading(prev => ({ ...prev, [agentId]: false }));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('partner_token');
    localStorage.removeItem('partner_name');
    router.push('/partner/login');
  };



  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <UserGuideProvider>
      <div className="min-h-screen bg-gray-900 text-white flex">
        <GuidedPartnerSidebar partnerName={partnerName} onLogout={handleLogout} />

      <main className="flex-1 pl-64 min-h-screen relative">
        <div className="p-8">
          <div className="max-w-7xl mx-auto">
            {/* Experimental Feature Banner */}
            <div className="mb-6 flex items-center gap-3 px-4 py-3 bg-amber-900/20 border border-amber-500/30 rounded-lg">
              <FiAlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <p className="text-sm text-amber-300">
                <span className="font-semibold">Experimental Feature:</span> Retell Chat Agents integration is currently under active development. Some features may change or be incomplete.
              </p>
            </div>

            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold">Retell Chat Agents</h1>
                <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 uppercase tracking-wider">
                  Experimental
                </span>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={handleImportClick}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
                >
                  <FiDownload className="w-5 h-5" />
                  <span>Import Chat Agents</span>
                </button>
              </div>
            </div>

            {error ? (
              <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6 text-center">
                <p className="text-lg text-red-400">{error}</p>
              </div>
            ) : agents.length === 0 ? (
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-8 text-center">
                <p className="text-lg text-gray-400 mb-4">No Retell Chat Agents found. Import your first chat agent from Retell to get started!</p>

                {/* Affiliate Link Section */}
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-6 mt-6 max-w-md mx-auto">
                  <div className="flex items-center justify-center mb-3">
                    <span className="text-2xl mr-2">💬</span>
                    <h3 className="text-lg font-semibold text-emerald-400">Get Started with Retell Chat</h3>
                  </div>
                  <p className="text-sm text-gray-300 mb-4">
                    Don&apos;t have a Retell account yet? Sign up and create your first chat agent to import here.
                  </p>
                  <a
                    href="https://dashboard.retellai.com/?ref=avijit"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-medium"
                  >
                    <span>Sign Up for Retell AI</span>
                    <FiGlobe className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {agents.map((agent) => (
                  <NeonContainer key={agent.id} className="p-6 h-[320px] flex flex-col">
                    <div className="flex flex-col flex-1">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1 mr-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">{agent.name}</h3>
                            <div className="relative group">
                              <FiInfo
                                className="w-5 h-5 cursor-help text-emerald-400 hover:text-emerald-300 transition-colors"
                              />
                              <div className="absolute right-0 mt-2 w-72 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-20">
                                <div className="text-sm space-y-3">
                                  {/* Customer Information */}
                                  {agent.customer ? (
                                    <div>
                                      <div className="font-medium text-white mb-1">Customer</div>
                                      <div className="text-gray-300 text-xs">
                                        {agent.customer.firstName} {agent.customer.lastName}
                                      </div>
                                      <div className="text-gray-400 text-xs">
                                        {agent.customer.email}
                                      </div>
                                    </div>
                                  ) : (
                                    <div>
                                      <div className="font-medium text-white mb-1">Customer</div>
                                      <div className="text-gray-400 text-xs">Not mapped to any customer</div>
                                    </div>
                                  )}

                                  {/* Engine Info */}
                                  <div className="border-t border-gray-600 pt-2">
                                    <div className="font-medium text-white mb-1">Response Engine</div>
                                    <div className="text-gray-300 text-xs">{agent.responseEngineType}</div>
                                  </div>

                                  {/* SMS Status */}
                                  {agent.smsEnabled && (
                                    <div className="border-t border-gray-600 pt-2">
                                      <div className="font-medium text-white mb-1">SMS</div>
                                      <div className="text-green-400 text-xs">
                                        Enabled {agent.smsPhoneNumber ? `(${agent.smsPhoneNumber})` : ''}
                                      </div>
                                    </div>
                                  )}

                                  {/* Analytics Status */}
                                  {agent.analyticsAgentId && (
                                    <div className="border-t border-gray-600 pt-2">
                                      <div className="font-medium text-white mb-1">Analytics</div>
                                      <div className="text-green-400 text-xs">✓ Registered</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          <p className="text-sm text-gray-400 gap-2">Engine: {agent.responseEngineType}</p>
                          <p className="text-sm text-gray-500 mt-2">
                            Language: {agent.language}
                          </p>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className={clsx(
                            'px-2 py-1 rounded-full text-xs',
                            agent.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                          )}>
                            {agent.isActive ? 'Active' : 'Inactive'}
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
                              <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right bg-gray-800 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
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
                                        <span>Edit Settings</span>
                                      </button>
                                    )}
                                  </Menu.Item>
                                  <Menu.Item>
                                    {({ active }) => (
                                      <button
                                        onClick={() => handleTestAgent(agent.id, agent.name)}
                                        className={clsx(
                                          'flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md',
                                          active ? 'bg-gray-700' : ''
                                        )}
                                      >
                                        <FiPlay className="w-4 h-4" />
                                        <span>Test Agent</span>
                                      </button>
                                    )}
                                  </Menu.Item>
                                  <Menu.Item>
                                    {({ active }) => (
                                      <button
                                        onClick={() => handleWidgetInstructions(agent)}
                                        className={clsx(
                                          'flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md',
                                          active ? 'bg-gray-700' : ''
                                        )}
                                      >
                                        <FiCode className="w-4 h-4" />
                                        <span>Widget Instructions</span>
                                      </button>
                                    )}
                                  </Menu.Item>
                                  <Menu.Item>
                                    {({ active }) => (
                                      <button
                                        onClick={() => handleSyncAgent(agent.id)}
                                        className={clsx(
                                          'flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md',
                                          active ? 'bg-gray-700' : ''
                                        )}
                                      >
                                        <FiRefreshCw className="w-4 h-4" />
                                        <span>Sync from Retell</span>
                                      </button>
                                    )}
                                  </Menu.Item>
                                  {agent.smsEnabled && (
                                    <Menu.Item>
                                      {({ active }) => (
                                        <button
                                          onClick={() => { setSelectedAgentForSms(agent); setShowSmsDialog(true); }}
                                          className={clsx(
                                            'flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md',
                                            active ? 'bg-gray-700' : ''
                                          )}
                                        >
                                          <FiSend className="w-4 h-4" />
                                          <span>Send SMS</span>
                                        </button>
                                      )}
                                    </Menu.Item>
                                  )}

                                  <Menu.Item>
                                    {({ active }) => (
                                      <button
                                        onClick={() => handleAssignCustomer(agent.id)}
                                        className={clsx(
                                          'flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md',
                                          active ? 'bg-gray-700' : ''
                                        )}
                                      >
                                        <FiUsers className="w-4 h-4" />
                                        <span>Map to Customer</span>
                                      </button>
                                    )}
                                  </Menu.Item>
                                  <Menu.Item>
                                    {({ active }) => (
                                      <button
                                        onClick={() => handleConfigureMetrics(agent.id, agent.name)}
                                        disabled={!agent.customerId}
                                        className={clsx(
                                          'flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md',
                                          active && agent.customerId ? 'bg-gray-700' : '',
                                          !agent.customerId ? 'opacity-50 cursor-not-allowed text-gray-500' : 'text-white hover:bg-gray-700'
                                        )}
                                        title={!agent.customerId ? 'Please map this agent to a customer first to configure metrics' : ''}
                                      >
                                        <FiBarChart className="w-4 h-4" />
                                        <span>Configure Metrics</span>
                                      </button>
                                    )}
                                  </Menu.Item>
                                  {agent.customerId && (
                                    <Menu.Item>
                                      {({ active }) => (
                                        <button
                                          onClick={() => handleRemoveFromCustomer(agent.id)}
                                          className={clsx(
                                            'flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md text-red-400',
                                            active ? 'bg-gray-700' : ''
                                          )}
                                        >
                                          <FiTrash2 className="w-4 h-4" />
                                          <span>Remove Customer</span>
                                        </button>
                                      )}
                                    </Menu.Item>
                                  )}

                                  {/* Webhook Sync Option */}
                                  {agent.analyticsAgentId && (
                                    <Menu.Item>
                                      {({ active }) => (
                                        <div className={clsx(active ? 'bg-gray-700' : '')}>
                                          <WebhookSyncButton
                                            agentId={agent.analyticsAgentId!}
                                            agentName={agent.name}
                                            provider="retell_chat"
                                            className="text-white"
                                          />
                                        </div>
                                      )}
                                    </Menu.Item>
                                  )}

                                  {/* Delete Agent Option */}
                                  <Menu.Item>
                                    {({ active }) => (
                                      <button
                                        onClick={() => handleDeleteAgent(agent)}
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
                          <p className="text-sm text-gray-400">
                            Created: {new Date(agent.createdAt).toLocaleDateString()}
                          </p>
                          <p className="text-sm text-gray-400">
                            Last Modified: {new Date(agent.updatedAt).toLocaleDateString()}
                          </p>
                          {agent.widgetCount > 0 && (
                            <p className="text-sm text-gray-400">
                              {agent.widgetCount} widget{agent.widgetCount !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        <button
                          onClick={() => handleAssignCustomer(agent.id)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm bg-emerald-600 hover:bg-emerald-500"
                        >
                          <FiUsers className="w-4 h-4" />
                          <span>
                            {agent.customer ? 'Reassign Customer' : 'Map to Customer'}
                          </span>
                        </button>

                        {agent.analyticsAgentId ? (
                          <WebhookManager
                            agentId={agent.id}
                            provider="retell_chat"
                            analyticsAgentId={agent.analyticsAgentId!}
                            webhookEnabled={agent.webhookEnabled || false}
                            webhookUrl={agent.webhookUrl || null}
                            webhookMode={(agent.webhookMode as 'manual' | 'automatic') || 'manual'}
                            preExistingWebhookUrl={agent.preExistingWebhookUrl || null}
                            forwardToPreExisting={agent.forwardToPreExisting ?? true}
                            onUpdate={(data) => handleUpdateWebhook(agent.id, data)}
                          />
                        ) : (
                          <button
                            onClick={() => handleRegisterAgentWithAnalytics(agent.id)}
                            disabled={webhookLoading[agent.id]}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {webhookLoading[agent.id] ? (
                              <>
                                <div className="animate-spin h-3 w-3 border-2 border-white rounded-full border-t-transparent"></div>
                                <span>Enabling...</span>
                              </>
                            ) : (
                              <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                                </svg>
                                <span>Enable Webhook</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </NeonContainer>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* SMS Dialog */}
      <Dialog
        open={showSmsDialog && !!selectedAgentForSms}
        onClose={() => { setShowSmsDialog(false); setSmsPhone(''); setSelectedAgentForSms(null); }}
        className="fixed inset-0 z-50"
      >
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Overlay
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => { setShowSmsDialog(false); setSmsPhone(''); setSelectedAgentForSms(null); }}
          />

          <Dialog.Panel className="relative bg-gray-900 rounded-xl p-6 w-[500px] shadow-xl border border-gray-800">
            <Dialog.Title className="text-xl font-semibold mb-4 text-white">
              Send SMS Chat
            </Dialog.Title>
            <p className="text-gray-400 text-sm mb-4">
              Initiate an outbound SMS chat via <strong>{selectedAgentForSms?.name}</strong>
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">Phone Number</label>
              <input
                type="tel"
                value={smsPhone}
                onChange={(e) => setSmsPhone(e.target.value)}
                placeholder="+1 555-1234"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => { setShowSmsDialog(false); setSmsPhone(''); setSelectedAgentForSms(null); }}
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSendSms}
                disabled={!smsPhone || smsSending}
                className={clsx(
                  "px-4 py-2 rounded-lg",
                  smsPhone && !smsSending
                    ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                    : "bg-gray-700 text-gray-400 cursor-not-allowed"
                )}
              >
                {smsSending ? 'Sending...' : 'Send SMS'}
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Import Modal */}
      <RetellChatAgentImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        customers={customers}
        onImportComplete={handleImportComplete}
      />

      {/* Edit Modal */}
      {editingAgent && (
        <RetellChatAgentEditModal
          isOpen={!!editingAgent}
          onClose={() => setEditingAgent(null)}
          agent={editingAgent}
          customers={customers}
          onSaved={() => { setEditingAgent(null); fetchAgents(); }}
        />
      )}

      {/* Customer Mapping Modal */}
      <Dialog
        open={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        className="fixed inset-0 z-50"
      >
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Overlay
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowCustomerModal(false)}
          />

          <Dialog.Panel className="relative bg-gray-900 rounded-xl p-6 w-[500px] shadow-xl border border-gray-800">
            <Dialog.Title className="text-xl font-semibold mb-4 text-white">
              Map Agent to Customer
            </Dialog.Title>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Select Customer
                </label>
                <select
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white"
                  value={selectedCustomer || ''}
                  onChange={(e) => setSelectedCustomer(e.target.value)}
                >
                  <option value="">Select a customer...</option>
                  {!customersLoading && customers
                    .filter(customer => customer.customerId)
                    .map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.companyName || `${customer.firstName} ${customer.lastName}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Profit Multiplier
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white"
                  value={profitMultiplier}
                  onChange={(e) => setProfitMultiplier(parseFloat(e.target.value))}
                />
                <p className="text-sm text-gray-400 mt-1">
                  Default is 1.2x. This will be used to calculate the final price for the customer.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowCustomerModal(false)}
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCustomerMapping}
                disabled={!selectedCustomer}
                className={clsx(
                  "px-4 py-2 rounded-lg",
                  selectedCustomer
                    ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                    : "bg-gray-700 text-gray-400 cursor-not-allowed"
                )}
              >
                Save
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Metrics Configuration Modal */}
      <AgentMetricsConfig
        isOpen={metricsModalState.isOpen}
        onClose={handleMetricsModalClose}
        agentId={metricsModalState.agentId || ''}
        agentName={metricsModalState.agentName || ''}
        provider="retell_chat"
        onSaved={handleMetricsSaved}
      />

      {/* Agent Deletion Modal */}
      <AgentDeletionModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        agent={agentToDelete}
        onDeleteFromPortal={handleDeleteFromPortal}
        onDeleteEverywhere={handleDeleteEverywhere}
        isLoading={false}
      />

      {/* Free Forever Upgrade Modal */}
      <FreeForeverUpgradeModal
        isOpen={showFreeForeverUpgrade}
        onClose={() => setShowFreeForeverUpgrade(false)}
        onProceed={pendingAction ? proceedWithPendingAction : undefined}
        title={freeForeverUpgradeData.title}
        message={freeForeverUpgradeData.message}
        featureDescription={freeForeverUpgradeData.featureDescription}
      />

      {/* Chat Agent Test Modal */}
      <ChatAgentTestModal
        isOpen={testModalState.isOpen}
        onClose={() => setTestModalState({ isOpen: false })}
        agentId={testModalState.agentId || ''}
        agentName={testModalState.agentName || 'Chat Agent'}
      />

      {/* Widget Instructions Modal */}
      <Dialog
        open={!!widgetInstructionsAgent}
        onClose={() => setWidgetInstructionsAgent(null)}
        className="fixed inset-0 z-50"
      >
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Overlay
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setWidgetInstructionsAgent(null)}
          />

          <Dialog.Panel className="relative bg-gray-900 rounded-xl p-6 w-[700px] max-h-[85vh] overflow-y-auto shadow-xl border border-gray-800">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <FiCode className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <Dialog.Title className="text-xl font-semibold text-white">
                    Widget Instructions
                  </Dialog.Title>
                  <p className="text-sm text-gray-400">{widgetInstructionsAgent?.name}</p>
                </div>
              </div>
              <button onClick={() => setWidgetInstructionsAgent(null)} className="text-gray-400 hover:text-white">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Step 1: Agent ID */}
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <h3 className="text-sm font-semibold text-emerald-400 mb-2">Your Agent ID</h3>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-gray-900 px-3 py-2 rounded text-sm text-gray-300 font-mono">
                    {widgetInstructionsAgent?.id}
                  </code>
                  <button
                    onClick={() => copyWidgetSnippet(widgetInstructionsAgent?.id || '')}
                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    {copiedSnippet ? <FiCheck className="w-4 h-4 text-emerald-400" /> : <FiCopy className="w-4 h-4 text-gray-400" />}
                  </button>
                </div>
              </div>

              {/* Step 2: Embed Script */}
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <h3 className="text-sm font-semibold text-emerald-400 mb-2">1. Add the Retell Chat Widget Script</h3>
                <p className="text-xs text-gray-400 mb-3">
                  Add this script tag to your website&apos;s HTML, just before the closing <code className="text-emerald-300">&lt;/body&gt;</code> tag:
                </p>
                <div className="relative">
                  <pre className="bg-gray-900 rounded-lg p-3 text-xs text-gray-300 overflow-x-auto font-mono">
{`<script src="https://cdn.retellai.com/chat-widget.js"></script>
<script>
  RetellChatWidget.init({
    agentId: "${widgetInstructionsAgent?.id}",
    // Optional: customize the widget
    position: "bottom-right",
    theme: "dark",
  });
</script>`}
                  </pre>
                  <button
                    onClick={() => copyWidgetSnippet(`<script src="https://cdn.retellai.com/chat-widget.js"></script>\n<script>\n  RetellChatWidget.init({\n    agentId: "${widgetInstructionsAgent?.id}",\n    position: "bottom-right",\n    theme: "dark",\n  });\n</script>`)}
                    className="absolute top-2 right-2 p-1.5 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                  >
                    <FiCopy className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Step 3: Customization */}
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <h3 className="text-sm font-semibold text-emerald-400 mb-2">2. Customization Options</h3>
                <div className="text-xs text-gray-400 space-y-2">
                  <p>You can customize the widget with these options:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li><code className="text-emerald-300">position</code> — <code>&quot;bottom-right&quot;</code> or <code>&quot;bottom-left&quot;</code></li>
                    <li><code className="text-emerald-300">theme</code> — <code>&quot;dark&quot;</code> or <code>&quot;light&quot;</code></li>
                    <li><code className="text-emerald-300">retell_llm_dynamic_variables</code> — Pass dynamic variables to personalize responses</li>
                    <li><code className="text-emerald-300">metadata</code> — Attach custom metadata to each chat session</li>
                  </ul>
                </div>
              </div>

              {/* Step 4: Testing tip */}
              <div className="bg-emerald-500/10 rounded-lg p-4 border border-emerald-500/30">
                <div className="flex items-start gap-2">
                  <FiInfo className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-gray-300">
                    <p className="font-medium text-emerald-400 mb-1">Testing Tip</p>
                    <p>Use the &quot;Test Agent&quot; option from the menu to test your chat agent directly in this dashboard before deploying the widget to your website. This lets you verify the agent&apos;s responses and confirm analytics are being captured.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setWidgetInstructionsAgent(null)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Got it
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      <Toaster position="top-right" />
      </div>
    </UserGuideProvider>
  );
}

