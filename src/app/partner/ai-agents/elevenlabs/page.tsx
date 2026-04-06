'use client';

import React, { useState, useEffect } from 'react';
import { FreeForeverUpgradeService } from '@/lib/services/freeForeverUpgradeService';
import FreeForeverUpgradeModal from '@/components/partner/FreeForeverUpgradeModal';
import { useRouter } from 'next/navigation';
import { FiPlus, FiMoreVertical, FiUsers, FiTrash2, FiSettings, FiInfo, FiEdit3, FiKey, FiDownload, FiPlay, FiGlobe, FiClock } from 'react-icons/fi';
import clsx from 'clsx';
import NeonContainer from '@/components/NeonContainer';
import GuidedPartnerSidebar from '@/components/partner/GuidedPartnerSidebar';
import { UserGuideProvider } from '@/context/UserGuideContext';
import { ElevenlabsWebhookManager } from '@/components/ElevenlabsWebhookManager';
import ElevenlabsImportModal from '@/components/partner/ElevenlabsImportModal';
import ElevenlabsCreateModal from '@/components/partner/ElevenlabsCreateModal';
import ElevenlabsTestModal from '@/components/partner/ElevenlabsTestModal';
import ApiKeyManagementModal from '@/components/partner/ApiKeyManagementModal';
import WidgetCreationModal from '@/components/partner/WidgetCreationModal';
import WidgetManagementModal from '@/components/partner/WidgetManagementModal';
import { WebhookSyncButton } from '@/components/analytics/WebhookSyncButton';
import { Menu, Transition } from '@headlessui/react';
import { Dialog } from '@headlessui/react';
import toast, { Toaster } from 'react-hot-toast';

interface ElevenLabsAgent {
  id: string;
  name: string;
  // Note: agentId is now the same as id (ElevenLabs agent ID is the primary key)
  voiceId?: string;
  customerId: string | null;
  profitMultiplier: number;
  customer: {
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
    companyName?: string;
  } | null;
  conversationConfig?: any;
  systemPrompt?: string;
  llmModel?: string;
  temperature?: number;
  language: string;
  maxDurationSeconds?: number;
  importedAt: string;
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  analyticsAgentId?: string;
  webhookEnabled?: boolean;
  webhookSecretConfirmed?: boolean;
  forwardToPreExisting?: boolean;
  preExistingWebhookUrl?: string;
  apiKeyStatus?: 'not_set' | 'active' | 'invalid' | 'error';
  apiKeyLastVerified?: string;
  apiKeyErrorMessage?: string;
}

interface Customer {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  companyName?: string;
  customerId?: string; // The actual Customer ID from the Customer table
}

export default function ElevenLabsAgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<ElevenLabsAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState('Partner');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [profitMultiplier, setProfitMultiplier] = useState(1.2);

  // Agent deletion state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<ElevenLabsAgent | null>(null);


  // Webhook modal state
  const [webhookModalState, setWebhookModalState] = useState<{
    isOpen: boolean;
    agentId?: string;
    agentName?: string;
  }>({
    isOpen: false
  });

  // API Key modal state
  const [apiKeyModalState, setApiKeyModalState] = useState<{
    isOpen: boolean;
    agentId?: string;
    agentName?: string;
    currentStatus?: string;
  }>({
    isOpen: false
  });

  // Import and Create modal states
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Free Forever Upgrade Modal state
  const [showFreeForeverUpgrade, setShowFreeForeverUpgrade] = useState(false);
  const [freeForeverUpgradeData, setFreeForeverUpgradeData] = useState({
    title: '',
    message: '',
    featureDescription: '',
  });
  const [pendingAction, setPendingAction] = useState<'create' | 'import' | null>(null);

  // Test modal state
  const [testModalState, setTestModalState] = useState<{
    isOpen: boolean;
    agentId?: string;
    agentName?: string;
  }>({
    isOpen: false
  });

  // Widget management state
  const [widgetManagementState, setWidgetManagementState] = useState<{
    isOpen: boolean;
    agentId?: string;
    agentName?: string;
  }>({
    isOpen: false
  });

  // Widget creation state
  const [widgetCreationState, setWidgetCreationState] = useState<{
    isOpen: boolean;
    agentId?: string;
    agentName?: string;
    customerId?: string;
  }>({
    isOpen: false
  });

  // Min call duration modal state
  const [minCallDurationState, setMinCallDurationState] = useState<{
    isOpen: boolean;
    agentId?: string;
    agentName?: string;
    currentValue: number;
    loading: boolean;
    saving: boolean;
  }>({
    isOpen: false,
    currentValue: 1,
    loading: false,
    saving: false,
  });

  useEffect(() => {
    const token = localStorage.getItem('partner_token');
    const partnerName = localStorage.getItem('partner_name') || 'Partner';
    setPartnerName(partnerName);

    if (!token) {
      router.push('/partner/login');
      return;
    }

    const fetchAgents = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/partner/elevenlabs-agents', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        console.log('ElevenLabs agents response status:', response.status);

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Error fetching ElevenLabs agents:', errorData);
          setError(`An unexpected error occurred. ${errorData.error || 'Please try again later.'}`);
          setAgents([]);
          return;
        }

        const data = await response.json();
        console.log('ElevenLabs agents data:', data);

        setAgents(data.agents || []);
        setError(null);
      } catch (err) {
        console.error('Error fetching ElevenLabs agents:', err);
        setError('Failed to load agents. Please try again.');
        setAgents([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAgents();
  }, [router]);

  const fetchCustomers = async () => {
    try {
      setCustomersLoading(true);
      const token = localStorage.getItem('partner_token');
      if (!token) {
        router.push('/partner/login');
        return;
      }

      const response = await fetch('/api/partner/customers', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch customers');
      }

      const data = await response.json();
      console.log('Customers data:', data);

      // Ensure customers is always an array
      let customersArray = [];
      if (Array.isArray(data)) {
        customersArray = data;
      } else if (data && typeof data === 'object') {
        customersArray = data.customers || data.data || [];
      }

      // Map userOnboarding data to Customer format for the dropdown
      const mappedCustomers = customersArray.map((customer: any) => ({
        id: customer.customerId || customer.id, // Use customerId if available, fallback to id
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        companyName: customer.companyName,
        customerId: customer.customerId // Preserve the customerId field for filtering
      })).filter((customer: any) => customer.id); // Only include customers with valid IDs

      console.log('Mapped customers for dropdown:', mappedCustomers);
      setCustomers(mappedCustomers);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast.error('Failed to fetch customers');
      setCustomers([]);
    } finally {
      setCustomersLoading(false);
    }
  };

  const handleMapToCustomer = async (agentId: string) => {
    if (!selectedCustomer) {
      toast.error('Please select a customer');
      return;
    }

    const token = localStorage.getItem('partner_token');
    if (!token) return;

    try {
      const response = await fetch(`/api/partner/elevenlabs-agents/${agentId}/map-customer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customerId: selectedCustomer,
          profitMultiplier
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || 'Agent mapped to customer successfully');

        // Update the agent in the list
        setAgents(prev => prev.map(agent =>
          agent.id === agentId ? data.agent : agent
        ));

        setShowCustomerModal(false);
        setSelectedAgent(null);
        setSelectedCustomer(null);
        setProfitMultiplier(1.2);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to map agent to customer');
      }
    } catch (error) {
      console.error('Error mapping agent to customer:', error);
      toast.error('Failed to map agent to customer');
    }
  };

  const handleRemoveFromCustomer = async (agentId: string) => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        router.push('/partner/login');
        return;
      }

      const response = await fetch(`/api/partner/elevenlabs-agents/${agentId}/unmap-customer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to remove customer from agent');
      }

      // Update the local state
      setAgents(agents.map(agent => {
        if (agent.id === agentId) {
          return { ...agent, customerId: null, customer: null };
        }
        return agent;
      }));

      toast.success('Customer removed from agent successfully');
    } catch (error) {
      console.error('Error removing customer from agent:', error);
      toast.error('Failed to remove customer from agent');
    }
  };

  const handleDeleteAgent = async () => {
    if (!agentToDelete) return;

    const token = localStorage.getItem('partner_token');
    if (!token) return;

    try {
      const response = await fetch(`/api/partner/elevenlabs-agents/${agentToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        toast.success('Agent deleted successfully');
        setAgents(prev => prev.filter(agent => agent.id !== agentToDelete.id));
        setShowDeleteModal(false);
        setAgentToDelete(null);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to delete agent');
      }
    } catch (error) {
      console.error('Error deleting agent:', error);
      toast.error('Failed to delete agent');
    }
  };

  const openCustomerModal = (agentId: string) => {
    setSelectedAgent(agentId);
    setShowCustomerModal(true);
    fetchCustomers();
  };

  const openWebhookModal = (agentId: string, agentName: string) => {
    setWebhookModalState({
      isOpen: true,
      agentId,
      agentName
    });
  };

  const openApiKeyModal = (agentId: string, agentName: string, currentStatus?: string) => {
    setApiKeyModalState({
      isOpen: true,
      agentId,
      agentName,
      currentStatus
    });
  };

  const openDeleteModal = (agent: ElevenLabsAgent) => {
    setAgentToDelete(agent);
    setShowDeleteModal(true);
  };

  const handleTestAgent = async (agentId: string, agentName: string) => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        router.push('/partner/login');
        return;
      }

      // Open test modal directly - the modal will handle getting the signed URL
      setTestModalState({
        isOpen: true,
        agentId,
        agentName
      });

      toast.success('Test modal opened! Configure your test call.');
    } catch (error) {
      console.error('Error opening test modal:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to open test modal');
    }
  };



  const handleLogout = () => {
    localStorage.removeItem('partner_token');
    localStorage.removeItem('partner_name');
    router.push('/partner/login');
  };

  // Proceed with pending action when "Maybe Later" is clicked
  const proceedWithPendingAction = () => {
    if (pendingAction === 'create') {
      setShowCreateModal(true);
    } else if (pendingAction === 'import') {
      setShowImportModal(true);
    }
    setPendingAction(null);
  };

  // Handle create agent button click
  const handleCreateAgentClick = async () => {
    try {
      // Check if user is on free forever plan first
      const shouldShowFreeForeverUpgrade = await FreeForeverUpgradeService.shouldShowUpgradeEncouragement();

      if (shouldShowFreeForeverUpgrade) {
        // Show free forever upgrade modal for premium ElevenLabs agents
        const upgradeMessage = FreeForeverUpgradeService.getUpgradeMessage('elevenlabs_agents');
        setFreeForeverUpgradeData(upgradeMessage);
        setPendingAction('create');
        setShowFreeForeverUpgrade(true);
        return;
      }

      // Proceed with agent creation
      setShowCreateModal(true);
    } catch (error) {
      console.error('Error checking ElevenLabs agent access:', error);
      // Fallback: allow agent creation if check fails
      setShowCreateModal(true);
    }
  };

  // Handle import agent button click
  const handleImportAgentClick = async () => {
    try {
      // Check if user is on free forever plan first
      const shouldShowFreeForeverUpgrade = await FreeForeverUpgradeService.shouldShowUpgradeEncouragement();

      if (shouldShowFreeForeverUpgrade) {
        // Show free forever upgrade modal for premium ElevenLabs agents
        const upgradeMessage = FreeForeverUpgradeService.getUpgradeMessage('elevenlabs_agents');
        setFreeForeverUpgradeData(upgradeMessage);
        setPendingAction('import');
        setShowFreeForeverUpgrade(true);
        return;
      }

      // Proceed with agent import
      setShowImportModal(true);
    } catch (error) {
      console.error('Error checking ElevenLabs agent import access:', error);
      // Fallback: allow agent import if check fails
      setShowImportModal(true);
    }
  };

  // Widget management handlers
  const handleManageWidgets = (agentId: string, agentName: string) => {
    setWidgetManagementState({
      isOpen: true,
      agentId,
      agentName
    });
  };

  const handleWidgetManagementClose = () => {
    setWidgetManagementState(prev => ({ ...prev, isOpen: false }));
  };

  const handleCreateWidget = () => {
    const agent = agents.find(a => a.id === widgetManagementState.agentId);
    setWidgetCreationState({
      isOpen: true,
      agentId: widgetManagementState.agentId,
      agentName: widgetManagementState.agentName,
      customerId: agent?.customerId || undefined
    });
    // Keep widget management modal open
  };

  const handleWidgetCreationClose = () => {
    setWidgetCreationState(prev => ({ ...prev, isOpen: false }));
  };

  // Min call duration handlers
  const handleOpenMinCallDuration = async (agentId: string, agentName: string) => {
    setMinCallDurationState({
      isOpen: true,
      agentId,
      agentName,
      currentValue: 1,
      loading: true,
      saving: false,
    });

    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch(`/api/partner/elevenlabs-agents/${agentId}/min-call-duration`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setMinCallDurationState(prev => ({
          ...prev,
          currentValue: data.min_call_duration ?? 1,
          loading: false,
        }));
      } else {
        setMinCallDurationState(prev => ({ ...prev, loading: false }));
      }
    } catch {
      setMinCallDurationState(prev => ({ ...prev, loading: false }));
    }
  };

  const handleSaveMinCallDuration = async () => {
    if (!minCallDurationState.agentId) return;

    setMinCallDurationState(prev => ({ ...prev, saving: true }));
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        router.push('/partner/login');
        return;
      }

      const response = await fetch(
        `/api/partner/elevenlabs-agents/${minCallDurationState.agentId}/min-call-duration`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ min_call_duration: minCallDurationState.currentValue }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update');
      }

      toast.success(`Min call duration set to ${minCallDurationState.currentValue}s`);
      setMinCallDurationState(prev => ({ ...prev, isOpen: false, saving: false }));
    } catch (error) {
      console.error('Error saving min call duration:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save min call duration');
      setMinCallDurationState(prev => ({ ...prev, saving: false }));
    }
  };

  if (loading) {
    return (
      <UserGuideProvider>
        <div className="min-h-screen bg-gray-900 text-white flex">
          <GuidedPartnerSidebar partnerName={partnerName} onLogout={handleLogout} />
          <main className="flex-1 pl-64 min-h-screen relative">
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          </main>
        </div>
      </UserGuideProvider>
    );
  }

  return (
    <UserGuideProvider>
      <div className="min-h-screen bg-gray-900 text-white flex">
        <GuidedPartnerSidebar partnerName={partnerName} onLogout={handleLogout} />

        <main className="flex-1 pl-64 min-h-screen relative">
          <div className="p-8">
            <div className="max-w-7xl mx-auto">
              <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">ElevenLabs Agents</h1>
                <div className="flex gap-4">
                  <button
                    onClick={handleImportAgentClick}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg transition-colors"
                  >
                    <FiDownload className="w-5 h-5" />
                    <span>Import Agents</span>
                  </button>
                  <button
                    onClick={handleCreateAgentClick}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
                  >
                    <FiPlus className="w-5 h-5" />
                    <span>Create New Agent</span>
                  </button>
                </div>
              </div>

              {error ? (
                <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6 text-center">
                  <p className="text-lg text-red-400">{error}</p>
                </div>
              ) : agents.length === 0 ? (
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-8 text-center">
                  <p className="text-lg text-gray-400">No ElevenLabs Agents found. Create your first agent to get started!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {agents.map((agent) => (
                    <div key={agent.id} className="relative">
                      <NeonContainer className="p-6 h-[320px] flex flex-col">
                        <div className="flex flex-col flex-1">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1 mr-4">
                            <div className="flex items-center justify-between">
                              <h3 className="text-lg font-semibold">{agent.name}</h3>
                              <div className="relative group">
                                <FiInfo
                                  className={clsx(
                                    "w-5 h-5 cursor-help transition-colors",
                                    agent.apiKeyStatus === 'active' ? 'text-green-400 hover:text-green-300' :
                                    agent.apiKeyStatus === 'invalid' ? 'text-red-400 hover:text-red-300' :
                                    agent.apiKeyStatus === 'error' ? 'text-red-400 hover:text-red-300' :
                                    'text-gray-500 hover:text-blue-500'
                                  )}
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
                                        <div className="text-gray-300 text-xs mt-1">
                                          Profit Multiplier: {agent.profitMultiplier}x
                                        </div>
                                      </div>
                                    ) : (
                                      <div>
                                        <div className="font-medium text-white mb-1">Customer</div>
                                        <div className="text-gray-400 text-xs">Not mapped to any customer</div>
                                        <div className="text-gray-300 text-xs mt-1">
                                          Profit Multiplier: {agent.profitMultiplier}x
                                        </div>
                                      </div>
                                    )}

                                    {/* API Key Status */}
                                    <div className="border-t border-gray-600 pt-2">
                                      <div className="font-medium text-white mb-1">API Key Status</div>
                                      <div className={clsx(
                                        'text-xs',
                                        agent.apiKeyStatus === 'active' ? 'text-green-400' :
                                        agent.apiKeyStatus === 'invalid' ? 'text-red-400' :
                                        agent.apiKeyStatus === 'error' ? 'text-red-400' :
                                        'text-gray-400'
                                      )}>
                                        {agent.apiKeyStatus === 'active' ? 'API Key Active' :
                                         agent.apiKeyStatus === 'invalid' ? 'API Key Invalid' :
                                         agent.apiKeyStatus === 'error' ? 'API Key Error' :
                                         'No API Key Set'}
                                      </div>
                                      {agent.apiKeyLastVerified && (
                                        <div className="text-xs text-gray-400 mt-1">
                                          Last verified: {new Date(agent.apiKeyLastVerified).toLocaleDateString()}
                                        </div>
                                      )}
                                      {agent.apiKeyErrorMessage && (
                                        <div className="text-xs text-red-400 mt-1">
                                          Error: {agent.apiKeyErrorMessage}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <p className="text-sm text-gray-400 gap-2">Voice ID: {agent.voiceId || 'Default'}</p>
                            <p className="text-sm text-gray-500 mt-2">
                              Language: {agent.language || 'en'}
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
                                <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right bg-gray-800 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                                  <div className="p-1">
                                    <Menu.Item>
                                      {({ active }) => (
                                        <button
                                          onClick={() => openWebhookModal(agent.id, agent.name)}
                                          className={clsx(
                                            'flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md',
                                            active ? 'bg-gray-700' : ''
                                          )}
                                        >
                                          <FiSettings className="w-4 h-4" />
                                          <span>Webhook Settings</span>
                                        </button>
                                      )}
                                    </Menu.Item>
                                    <Menu.Item>
                                      {({ active }) => (
                                        <button
                                          onClick={() => openApiKeyModal(agent.id, agent.name, agent.apiKeyStatus)}
                                          className={clsx(
                                            'flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md',
                                            active ? 'bg-gray-700' : ''
                                          )}
                                        >
                                          <FiKey className="w-4 h-4" />
                                          <span>API Key</span>
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
                                          onClick={() => openCustomerModal(agent.id)}
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

                                    {/* Manage Widgets Option */}
                                    <Menu.Item>
                                      {({ active }) => (
                                        <button
                                          onClick={() => handleManageWidgets(agent.id, agent.name)}
                                          className={clsx(
                                            'flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md',
                                            active ? 'bg-gray-700' : ''
                                          )}
                                        >
                                          <FiGlobe className="w-4 h-4" />
                                          <span>Manage Widgets</span>
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
                                    <Menu.Item>
                                      {({ active }) => (
                                        <button
                                          onClick={() => {/* TODO: Implement edit modal */}}
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

                                    {/* Webhook Sync Option */}
                                    {agent.analyticsAgentId && (
                                      <Menu.Item>
                                        {({ active }) => (
                                          <div className={clsx(active ? 'bg-gray-700' : '')}>
                                            <WebhookSyncButton
                                              agentId={agent.analyticsAgentId!}
                                              agentName={agent.name}
                                              provider="elevenlabs"
                                              className="text-white"
                                            />
                                          </div>
                                        )}
                                      </Menu.Item>
                                    )}

                                    {/* Min Call Duration Option */}
                                    {agent.analyticsAgentId && (
                                      <Menu.Item>
                                        {({ active }) => (
                                          <button
                                            onClick={() => handleOpenMinCallDuration(agent.id, agent.name)}
                                            className={clsx(
                                              'flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md',
                                              active ? 'bg-gray-700' : ''
                                            )}
                                          >
                                            <FiClock className="w-4 h-4" />
                                            <span>Min Call Duration</span>
                                          </button>
                                        )}
                                      </Menu.Item>
                                    )}

                                    <Menu.Item>
                                      {({ active }) => (
                                        <button
                                          onClick={() => openDeleteModal(agent)}
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
                          </div>
                        </div>

                        <div className="mt-4 space-y-2">
                          <button
                            onClick={() => openCustomerModal(agent.id)}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm bg-blue-600 hover:bg-blue-500"
                          >
                            <FiUsers className="w-4 h-4" />
                            <span>
                              {agent.customer ? 'Reassign Customer' : 'Map to Customers'}
                            </span>
                          </button>

                          <button
                            onClick={() => openWebhookModal(agent.id, agent.name)}
                            className={clsx(
                              "w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm",
                              agent.webhookEnabled && agent.webhookSecretConfirmed
                                ? "bg-green-600 hover:bg-green-500"
                                : "bg-green-600 hover:bg-green-500"
                            )}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                            </svg>
                            <span>
                              {agent.webhookEnabled && agent.webhookSecretConfirmed ? 'Manage Webhook' : 'Enable Webhook'}
                            </span>
                          </button>
                        </div>
                      </div>
                    </NeonContainer>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Customer Mapping Modal */}
        <Dialog open={showCustomerModal} onClose={() => setShowCustomerModal(false)}>
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Dialog.Panel className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
              <Dialog.Title className="text-lg font-semibold text-white mb-4">
                Map Agent to Customer
              </Dialog.Title>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Select Customer
                  </label>
                  <select
                    value={selectedCustomer || ''}
                    onChange={(e) => setSelectedCustomer(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    disabled={customersLoading}
                  >
                    <option value="">
                      {customersLoading ? 'Loading customers...' : 'Select a customer...'}
                    </option>
                    {!customersLoading && customers
                      .filter(customer => customer.customerId) // Only show customers with valid Customer records
                      .map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.firstName && customer.lastName
                          ? `${customer.firstName} ${customer.lastName}`
                          : customer.companyName || customer.email}
                      </option>
                    ))}
                  </select>
                  {!customersLoading && customers.length === 0 && (
                    <p className="text-xs text-red-400 mt-1">
                      No customers found. Please create customers first.
                    </p>
                  )}
                  {!customersLoading && customers.length > 0 && (
                    <p className="text-xs text-gray-400 mt-1">
                      Found {customers.length} customer{customers.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Profit Multiplier
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    step="0.1"
                    value={profitMultiplier}
                    onChange={(e) => setProfitMultiplier(parseFloat(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Customer will be charged {(profitMultiplier * 100).toFixed(0)}% of the base cost
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowCustomerModal(false)}
                  className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => selectedAgent && handleMapToCustomer(selectedAgent)}
                  disabled={!selectedCustomer || customersLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  {customersLoading ? 'Loading...' : 'Map Agent'}
                </button>
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>

        {/* Delete Confirmation Modal */}
        <Dialog open={showDeleteModal} onClose={() => setShowDeleteModal(false)}>
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Dialog.Panel className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
              <Dialog.Title className="text-lg font-semibold text-white mb-4">
                Delete Agent
              </Dialog.Title>

              <p className="text-gray-300 mb-6">
                Are you sure you want to delete "{agentToDelete?.name}"? This action cannot be undone.
              </p>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAgent}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  Delete Agent
                </button>
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>

        {/* Webhook Configuration Modal */}
        <Dialog open={webhookModalState.isOpen} onClose={() => setWebhookModalState({ isOpen: false })}>
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Dialog.Panel className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <Dialog.Title className="text-lg font-semibold text-white mb-4">
                Webhook Configuration - {webhookModalState.agentName}
              </Dialog.Title>

              {webhookModalState.agentId && (
                <ElevenlabsWebhookManager
                  agentId={webhookModalState.agentId}
                  onWebhookConfigured={() => {
                    setWebhookModalState({ isOpen: false });
                    // Refresh agents list
                    window.location.reload();
                  }}
                />
              )}

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setWebhookModalState({ isOpen: false })}
                  className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                >
                  Close
                </button>
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>

        {/* Import Modal */}
        <ElevenlabsImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImportComplete={() => {
            setShowImportModal(false);
            // Refresh agents list
            window.location.reload();
          }}
        />

        {/* Create Modal */}
        <ElevenlabsCreateModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreateComplete={() => {
            setShowCreateModal(false);
            // Refresh agents list
            window.location.reload();
          }}
        />

        {/* Test Modal */}
        <ElevenlabsTestModal
          isOpen={testModalState.isOpen}
          onClose={() => setTestModalState({ isOpen: false })}
          agentId={testModalState.agentId || ''}
          agentName={testModalState.agentName || ''}
        />

        {/* API Key Management Modal */}
        <ApiKeyManagementModal
          isOpen={apiKeyModalState.isOpen}
          onClose={() => setApiKeyModalState({ isOpen: false })}
          agentId={apiKeyModalState.agentId || ''}
          agentName={apiKeyModalState.agentName || ''}
          provider="elevenlabs"
          currentStatus={apiKeyModalState.currentStatus}
          onApiKeyUpdated={() => {
            // Refresh agents list
            window.location.reload();
          }}
        />

        {/* Widget Management Modal */}
        <WidgetManagementModal
          isOpen={widgetManagementState.isOpen}
          onClose={handleWidgetManagementClose}
          agentId={widgetManagementState.agentId || ''}
          agentName={widgetManagementState.agentName || ''}
          agentType="elevenlabs"
          onCreateWidget={handleCreateWidget}
        />

        {/* Widget Creation Modal */}
        <WidgetCreationModal
          isOpen={widgetCreationState.isOpen}
          onClose={handleWidgetCreationClose}
          agentId={widgetCreationState.agentId || ''}
          agentType="elevenlabs"
          agentName={widgetCreationState.agentName || ''}
          customerId={widgetCreationState.customerId}
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

        {/* Min Call Duration Modal */}
        <Dialog
          open={minCallDurationState.isOpen}
          onClose={() => setMinCallDurationState(prev => ({ ...prev, isOpen: false }))}
          className="relative z-50"
        >
          <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-gray-700">
              <Dialog.Title className="text-xl font-semibold mb-2 text-white">
                Min Call Duration for Credit Deduction
              </Dialog.Title>
              <p className="text-sm text-gray-400 mb-4">
                Set the minimum call duration (in seconds) before AI credits are deducted for <span className="text-white font-medium">{minCallDurationState.agentName}</span>.
              </p>

              {minCallDurationState.loading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Minimum Duration (seconds)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="3600"
                      step="1"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white"
                      value={minCallDurationState.currentValue}
                      onChange={(e) => setMinCallDurationState(prev => ({
                        ...prev,
                        currentValue: Math.max(0, Math.min(3600, parseInt(e.target.value) || 0)),
                      }))}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Calls shorter than this duration will not deduct AI credits. Default is 1 second. Set to 0 to deduct for all calls.
                    </p>
                  </div>

                  <div className="flex justify-end space-x-3 pt-2">
                    <button
                      onClick={() => setMinCallDurationState(prev => ({ ...prev, isOpen: false }))}
                      className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveMinCallDuration}
                      disabled={minCallDurationState.saving}
                      className={clsx(
                        'px-4 py-2 rounded-lg',
                        minCallDurationState.saving
                          ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                          : 'bg-blue-500 hover:bg-blue-600 text-white'
                      )}
                    >
                      {minCallDurationState.saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              )}
            </Dialog.Panel>
          </div>
        </Dialog>

        <Toaster position="top-right" />
      </div>
    </UserGuideProvider>
  );
}
