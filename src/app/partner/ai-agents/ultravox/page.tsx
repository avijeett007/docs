'use client';

import React, { useState, useEffect } from 'react';
import { FreeForeverUpgradeService } from '@/lib/services/freeForeverUpgradeService';
import FreeForeverUpgradeModal from '@/components/partner/FreeForeverUpgradeModal';
import { useRouter } from 'next/navigation';
import { FiPlus, FiMoreVertical, FiUsers, FiEdit2, FiTrash2, FiSettings, FiInfo, FiDownload, FiRefreshCw, FiPlay, FiKey, FiBarChart, FiGlobe, FiClock } from 'react-icons/fi';
import clsx from 'clsx';
import NeonContainer from '@/components/NeonContainer';
import PartnerSidebar from '@/components/partner/PartnerSidebar';
import UltravoxWebhookManager from '@/components/UltravoxWebhookManager';
import { Menu, Transition } from '@headlessui/react';
import { Dialog } from '@headlessui/react';
import { toast, Toaster } from 'react-hot-toast';
import UltravoxImportModal from '@/components/partner/UltravoxImportModal';
import UltravoxAgentModal from '@/components/partner/UltravoxAgentModal';
import UltravoxTestModal from '@/components/partner/UltravoxTestModal';
import ApiKeyManagementModal from '@/components/partner/ApiKeyManagementModal';
import AgentMetricsConfig from '@/components/partner/AgentMetricsConfig';
import WidgetCreationModal from '@/components/partner/WidgetCreationModal';
import WidgetManagementModal from '@/components/partner/WidgetManagementModal';
import { WebhookSyncButton } from '@/components/analytics/WebhookSyncButton';

interface UltravoxAgent {
  id: string;
  name: string;
  systemPrompt?: string;
  temperature: number;
  model: string;
  voice?: string;
  externalVoice?: any;
  languageHint?: string;
  recordingEnabled: boolean;
  maxDuration?: string;
  timeExceededMessage?: string;
  selectedTools?: any[];
  callTemplate?: any;
  customerId?: string;
  profitMultiplier: number;
  customer?: {
    firstName?: string;
    lastName?: string;
    companyName?: string;
    email?: string;
  };
  importedAt: string;
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  analyticsAgentId?: string;
  webhookEnabled?: boolean;
  webhookUrl?: string;
  webhookMode?: string;
  preExistingWebhookUrl?: string;
  forwardToPreExisting?: boolean;
  apiKeyStatus?: 'not_set' | 'valid' | 'invalid' | 'expired' | 'rate_limited' | 'revoked';
  apiKeyLastVerified?: string;
  apiKeyErrorMessage?: string;
  usingPartnerKey?: boolean;
  hasPartnerKeyFallback?: boolean;
  hasAgentKey?: boolean;
}

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  customerId?: string; // The actual Customer ID from the Customer table
}

export default function UltravoxAgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<UltravoxAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [profitMultiplier, setProfitMultiplier] = useState(1.2);
  const [webhookLoading, setWebhookLoading] = useState<Record<string, boolean>>({});
  const [showImportModal, setShowImportModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Agent modal state
  const [agentModalState, setAgentModalState] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit';
    agentId?: string;
  }>({
    isOpen: false,
    mode: 'create'
  });

  // Test modal state
  const [testModalState, setTestModalState] = useState<{
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

  // Metrics Configuration modal state
  const [metricsModalState, setMetricsModalState] = useState<{
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

  // Free Forever Upgrade Modal state
  const [showFreeForeverUpgrade, setShowFreeForeverUpgrade] = useState(false);
  const [freeForeverUpgradeData, setFreeForeverUpgradeData] = useState({
    title: '',
    message: '',
    featureDescription: '',
  });
  const [pendingAction, setPendingAction] = useState<'create' | 'import' | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('partner_token');
        if (!token) {
          router.push('/partner/login');
          return;
        }

        const storedName = localStorage.getItem('partner_name');
        if (storedName) {
          setPartnerName(storedName);
        }

        // Fetch real agents from API
        const response = await fetch('/api/partner/ultravox-agents', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          if (response.status === 401) {
            router.push('/partner/login');
            return;
          }
          throw new Error(`Failed to fetch agents: ${response.status}`);
        }

        const data = await response.json();
        const agentsArray = Array.isArray(data) ? data : (data.agents || []);

        setAgents(agentsArray);
        setError(null);
      } catch (error) {
        console.error('Error fetching agents:', error);
        setError('An unexpected error occurred. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);



  useEffect(() => {
    const fetchCustomers = async () => {
      setCustomersLoading(true);
      try {
        const token = localStorage.getItem('partner_token');
        if (!token) {
          setCustomers([]);
          return;
        }

        const response = await fetch('/api/partner/customers', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          console.error('Failed to fetch customers:', response.status);
          setCustomers([]);
          return;
        }

        const data = await response.json();
        
        let customersArray;
        if (Array.isArray(data)) {
          customersArray = data;
        } else if (data && typeof data === 'object') {
          customersArray = data.customers || data.data || [];
        } else {
          customersArray = [];
        }

        const validCustomers = customersArray
          .filter((customer: any) => customer && typeof customer === 'object')
          .map((customer: any) => ({
            id: customer.id || '',
            firstName: customer.firstName || '',
            lastName: customer.lastName || '',
            companyName: customer.companyName || '',
            email: customer.email || ''
          }));

        setCustomers(validCustomers);
      } catch (error) {
        console.error('Error fetching customers:', error);
        setCustomers([]);
      } finally {
        setCustomersLoading(false);
      }
    };

    fetchCustomers();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('partner_token');
    localStorage.removeItem('partner_name');
    localStorage.removeItem('partner_email');
    router.push('/partner/login');
  };

  const handleConfigureMetrics = (agentId: string, agentName: string) => {
    setMetricsModalState({
      isOpen: true,
      agentId,
      agentName
    });
  };

  const handleMetricsModalClose = () => {
    setMetricsModalState(prev => ({ ...prev, isOpen: false }));
  };

  const handleMetricsSaved = () => {
    // Optionally refresh the agents list or show success message
    toast.success('Metrics configuration saved successfully');
    handleMetricsModalClose();
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

      const response = await fetch(`/api/partner/ultravox-agents/${agentId}/min-call-duration`, {
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
        `/api/partner/ultravox-agents/${minCallDurationState.agentId}/min-call-duration`,
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

  const handleMapToCustomers = (agentId: string) => {
    setSelectedAgent(agentId);
    setShowCustomerModal(true);
    setProfitMultiplier(1.2);
  };

  const handleSaveCustomerMapping = async () => {
    if (!selectedAgent || !selectedCustomer) return;

    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch(`/api/partner/ultravox-agents/${selectedAgent}/map-customer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customerId: selectedCustomer,
          profitMultiplier: profitMultiplier
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to map customer to agent');
      }

      const data = await response.json();
      toast.success('Customer mapped to agent successfully!');

      // Update the agent in the local state
      setAgents(prevAgents =>
        prevAgents.map(agent =>
          agent.id === selectedAgent
            ? { ...agent, customer: data.agent.customer, profitMultiplier: data.agent.profitMultiplier }
            : agent
        )
      );

      setShowCustomerModal(false);
      setSelectedAgent(null);
      setSelectedCustomer(null);
    } catch (error: any) {
      console.error('Error mapping customer:', error);
      toast.error(error.message || 'Failed to map customer to agent');
    }
  };

  // Proceed with pending action when "Maybe Later" is clicked
  const proceedWithPendingAction = () => {
    if (pendingAction === 'create') {
      setAgentModalState({
        isOpen: true,
        mode: 'create',
        agentId: undefined,
      });
    } else if (pendingAction === 'import') {
      setShowImportModal(true);
    }
    setPendingAction(null);
  };

  const handleCreateAgent = async () => {
    try {
      // Check if user is on free forever plan first
      const shouldShowFreeForeverUpgrade = await FreeForeverUpgradeService.shouldShowUpgradeEncouragement();

      if (shouldShowFreeForeverUpgrade) {
        // Show free forever upgrade modal for premium Ultravox agents
        const upgradeMessage = FreeForeverUpgradeService.getUpgradeMessage('ultravox_agents');
        setFreeForeverUpgradeData(upgradeMessage);
        setPendingAction('create');
        setShowFreeForeverUpgrade(true);
        return;
      }

      // Proceed with agent creation
      setAgentModalState({
        isOpen: true,
        mode: 'create'
      });
    } catch (error) {
      console.error('Error checking Ultravox agent access:', error);
      // Fallback: allow agent creation if check fails
      setAgentModalState({
        isOpen: true,
        mode: 'create'
      });
    }
  };

  // Handle import agent button click
  const handleImportAgentClick = async () => {
    try {
      // Check if user is on free forever plan first
      const shouldShowFreeForeverUpgrade = await FreeForeverUpgradeService.shouldShowUpgradeEncouragement();

      if (shouldShowFreeForeverUpgrade) {
        // Show free forever upgrade modal for premium Ultravox agents
        const upgradeMessage = FreeForeverUpgradeService.getUpgradeMessage('ultravox_agents');
        setFreeForeverUpgradeData(upgradeMessage);
        setPendingAction('import');
        setShowFreeForeverUpgrade(true);
        return;
      }

      // Proceed with agent import
      setShowImportModal(true);
    } catch (error) {
      console.error('Error checking Ultravox agent import access:', error);
      // Fallback: allow agent import if check fails
      setShowImportModal(true);
    }
  };

  const handleEditAgent = (agentId: string) => {
    setAgentModalState({
      isOpen: true,
      mode: 'edit',
      agentId
    });
  };

  const handleAgentModalClose = () => {
    setAgentModalState(prev => ({ ...prev, isOpen: false }));
  };

  const handleAgentSaved = (savedAgent: any) => {
    if (agentModalState.mode === 'create') {
      if (savedAgent) {
        setAgents(prevAgents => [...prevAgents, savedAgent]);
        toast.success('Agent created successfully!');
      }
    } else {
      handleRefresh();
      toast.success('Agent updated successfully!');
    }
    handleAgentModalClose();
  };

  const handleTestAgent = async (agentId: string, agentName: string) => {
    setTestModalState({
      isOpen: true,
      agentId,
      agentName
    });
  };

  const handleManageApiKey = (agentId: string, agentName: string, currentStatus?: string) => {
    setApiKeyModalState({
      isOpen: true,
      agentId,
      agentName,
      currentStatus: currentStatus || 'not_set'
    });
  };

  const handleApiKeyModalClose = () => {
    setApiKeyModalState(prev => ({ ...prev, isOpen: false }));
  };

  const handleApiKeyUpdated = () => {
    handleRefresh();
  };

  const handleDelete = async (agentId: string) => {
    if (!confirm('Are you sure you want to delete this agent? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch(`/api/partner/ultravox-agents/${agentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete agent');
      }

      toast.success('Agent deleted successfully!');

      // Remove the agent from local state
      setAgents(prevAgents => prevAgents.filter(agent => agent.id !== agentId));
    } catch (error: any) {
      console.error('Error deleting agent:', error);
      toast.error(error.message || 'Failed to delete agent');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch('/api/partner/ultravox-agents', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/partner/login');
          return;
        }
        throw new Error(`Failed to refresh agents: ${response.status}`);
      }

      const data = await response.json();
      const agentsArray = Array.isArray(data) ? data : (data.agents || []);

      setAgents(agentsArray);
      toast.success('Agents refreshed successfully!');
    } catch (error: any) {
      console.error('Error refreshing agents:', error);
      toast.error(error.message || 'Failed to refresh agents');
    } finally {
      setRefreshing(false);
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
        toast.error('Authentication required');
        return false;
      }

      const response = await fetch(`/api/partner/ultravox-agents/${agentId}/webhook`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update webhook configuration');
      }

      const result = await response.json();
      toast.success('Webhook configuration updated successfully!');

      // Update the agent in local state
      setAgents(prevAgents =>
        prevAgents.map(agent =>
          agent.id === agentId
            ? {
                ...agent,
                webhookEnabled: result.webhookEnabled,
                webhookMode: result.webhookMode,
                webhookUrl: result.webhookUrl,
                preExistingWebhookUrl: result.preExistingWebhookUrl,
                forwardToPreExisting: result.forwardToPreExisting
              }
            : agent
        )
      );

      return true;
    } catch (error: any) {
      console.error('Error updating webhook configuration:', error);
      toast.error(error.message || 'Failed to update webhook configuration');
      return false;
    } finally {
      setWebhookLoading(prev => ({ ...prev, [agentId]: false }));
    }
  };

  const handleRegisterAgentWithAnalytics = async (agentId: string) => {
    try {
      setWebhookLoading(prev => ({ ...prev, [agentId]: true }));

      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch(`/api/partner/ultravox-agents/${agentId}/register-analytics`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to register agent with analytics');
      }

      const result = await response.json();
      toast.success('Agent registered with analytics service successfully!');

      // Update the agent in local state
      setAgents(prevAgents =>
        prevAgents.map(agent =>
          agent.id === agentId
            ? {
                ...agent,
                analyticsAgentId: result.analyticsAgentId,
                webhookUrl: result.webhookUrl
              }
            : agent
        )
      );
    } catch (error: any) {
      console.error('Error registering agent with analytics:', error);
      toast.error(error.message || 'Failed to register agent with analytics service');
    } finally {
      setWebhookLoading(prev => ({ ...prev, [agentId]: false }));
    }
  };





  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <PartnerSidebar
          partnerName={partnerName}
          onLogout={handleLogout}
        />
        <div className="ml-64 p-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white">
        <PartnerSidebar
          partnerName={partnerName}
          onLogout={handleLogout}
        />
        <div className="ml-64 p-8">
          <div className="text-center">
            <div className="text-red-400 text-xl mb-4">{error}</div>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Toaster position="top-right" />
      <PartnerSidebar
        partnerName={partnerName}
        onLogout={handleLogout}
      />

      <div className="ml-64 p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Ultravox AI Agents</h1>
            <p className="text-gray-400">
              Manage your Ultravox voice AI agents with advanced conversation flows and sentiment analysis
            </p>
          </div>

          <div className="flex space-x-4">
            <button
              onClick={handleImportAgentClick}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
            >
              <FiDownload className="w-4 h-4" />
              <span>Import Agents</span>
            </button>

            <button
              onClick={handleCreateAgent}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
            >
              <FiPlus className="w-4 h-4" />
              <span>Create Agent</span>
            </button>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 disabled:opacity-50"
            >
              <FiRefreshCw className={clsx("w-4 h-4", refreshing && "animate-spin")} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {agents.length === 0 ? (
          <NeonContainer className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <FiSettings className="w-16 h-16 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Ultravox Agents Found</h3>
              <p>Get started by creating your first Ultravox agent or importing existing ones.</p>
            </div>
            <div className="flex justify-center space-x-4 mt-6">
              <button
                onClick={handleCreateAgent}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center space-x-2"
              >
                <FiPlus className="w-5 h-5" />
                <span>Create Your First Agent</span>
              </button>
              <button
                onClick={handleImportAgentClick}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg flex items-center space-x-2"
              >
                <FiDownload className="w-5 h-5" />
                <span>Import Existing Agents</span>
              </button>
            </div>
          </NeonContainer>
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
                            className={clsx(
                              "w-5 h-5 cursor-help transition-colors",
                              agent.apiKeyStatus === 'valid' ? 'text-green-400 hover:text-green-300' :
                              agent.apiKeyStatus === 'invalid' ? 'text-red-400 hover:text-red-300' :
                              agent.usingPartnerKey ? 'text-amber-400 hover:text-amber-300' :
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
                                  agent.apiKeyStatus === 'valid' ? 'text-green-400' :
                                  agent.apiKeyStatus === 'invalid' ? 'text-red-400' :
                                  agent.usingPartnerKey ? 'text-amber-400' :
                                  'text-gray-400'
                                )}>
                                  {agent.usingPartnerKey ? 'Using Partner API Key' :
                                   agent.apiKeyStatus === 'valid' ? 'Agent API Key Valid' :
                                   agent.apiKeyStatus === 'invalid' ? 'Agent API Key Invalid' :
                                   agent.apiKeyStatus === 'expired' ? 'Agent API Key Expired' :
                                   agent.apiKeyStatus === 'rate_limited' ? 'Agent API Key Rate Limited' :
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
                      <p className="text-sm text-gray-400 gap-2 overflow-hidden" style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical'
                      }}>{agent.systemPrompt}</p>
                      <p className="text-sm text-gray-500 mt-2">
                        Model: {agent.model}
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
                                    onClick={() => handleEditAgent(agent.id)}
                                    className={clsx(
                                      'flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md',
                                      active ? 'bg-gray-700' : ''
                                    )}
                                  >
                                    <FiEdit2 className="w-4 h-4" />
                                    <span>Edit Agent</span>
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
                                    onClick={() => handleManageApiKey(agent.id, agent.name, agent.apiKeyStatus)}
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
                                onClick={() => handleMapToCustomers(agent.id)}
                                disabled={agent.customer && agent.customer.email !== localStorage.getItem('partner_email')}
                                className={clsx(
                                  'flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md',
                                  active ? 'bg-gray-700' : '',
                                  agent.customer && agent.customer.email !== localStorage.getItem('partner_email')
                                    ? 'opacity-50 cursor-not-allowed'
                                    : 'hover:bg-gray-700'
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
                                    className={clsx(
                                      'flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md text-white hover:bg-gray-700',
                                      active ? 'bg-gray-700' : ''
                                    )}
                                  >
                                    <FiBarChart className="w-4 h-4" />
                                    <span>Configure Metrics</span>
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

                              {/* Webhook Sync Option */}
                              {agent.analyticsAgentId && (
                                <Menu.Item>
                                  {({ active }) => (
                                    <div className={clsx(active ? 'bg-gray-700' : '')}>
                                      <WebhookSyncButton
                                        agentId={agent.analyticsAgentId!}
                                        agentName={agent.name}
                                        provider="ultravox"
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
                                onClick={() => handleDelete(agent.id)}
                                className={clsx(
                                  'flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md text-red-400',
                                  active ? 'bg-gray-700' : ''
                                )}
                              >
                                <FiTrash2 className="w-4 h-4" />
                                <span>Delete</span>
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
                      onClick={() => handleMapToCustomers(agent.id)}
                      className={clsx(
                        "w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm",
                        agent.customer && agent.customer.email !== localStorage.getItem('partner_email')
                          ? "bg-gray-600 cursor-not-allowed opacity-50"
                          : "bg-blue-600 hover:bg-blue-500"
                      )}
                      disabled={agent.customer && agent.customer.email !== localStorage.getItem('partner_email')}
                    >
                      <FiUsers className="w-4 h-4" />
                      <span>
                        {agent.customer && agent.customer.email !== localStorage.getItem('partner_email') ? 'Customer Mapped' : 'Map to Customers'}
                      </span>
                    </button>

                    {agent.analyticsAgentId ? (
                      <UltravoxWebhookManager
                        agentId={agent.id}
                        analyticsAgentId={agent.analyticsAgentId!}
                        webhookEnabled={agent.webhookEnabled || false}
                        webhookUrl={agent.webhookUrl || null}
                        webhookMode={(agent.webhookMode as 'manual' | 'automatic') || 'manual'}
                        preExistingWebhookUrl={agent.preExistingWebhookUrl || null}
                        forwardToPreExisting={agent.forwardToPreExisting || true}
                        onUpdate={(data: any) => handleUpdateWebhook(agent.id, data)}
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

      {/* Customer Mapping Modal */}
      <Dialog open={showCustomerModal} onClose={() => setShowCustomerModal(false)}>
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
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
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  disabled={customersLoading}
                >
                  <option value="">
                    {customersLoading ? 'Loading customers...' : 'Select a customer'}
                  </option>
                  {customers
                    .filter(customer => customer.customerId) // Only show customers with valid Customer records
                    .map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.firstName} {customer.lastName} - {customer.companyName}
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
                  min="1.0"
                  value={profitMultiplier}
                  onChange={(e) => setProfitMultiplier(parseFloat(e.target.value))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Multiplier applied to usage costs for this customer
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCustomerModal(false)}
                className="px-4 py-2 text-gray-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCustomerMapping}
                disabled={!selectedCustomer}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg"
              >
                Save Mapping
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Import Modal */}
      {showImportModal && (
        <UltravoxImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImportComplete={handleRefresh}
        />
      )}

      {/* Agent Modal */}
      {agentModalState.isOpen && (
        <UltravoxAgentModal
          isOpen={agentModalState.isOpen}
          onClose={handleAgentModalClose}
          onSave={handleAgentSaved}
          mode={agentModalState.mode}
          agentId={agentModalState.agentId}
        />
      )}

      {/* Test Modal */}
      {testModalState.isOpen && (
        <UltravoxTestModal
          isOpen={testModalState.isOpen}
          onClose={() => setTestModalState(prev => ({ ...prev, isOpen: false }))}
          agentId={testModalState.agentId!}
          agentName={testModalState.agentName!}
        />
      )}

      {/* API Key Management Modal */}
      {apiKeyModalState.isOpen && (
        <ApiKeyManagementModal
          isOpen={apiKeyModalState.isOpen}
          onClose={handleApiKeyModalClose}
          onApiKeyUpdated={handleApiKeyUpdated}
          agentId={apiKeyModalState.agentId!}
          agentName={apiKeyModalState.agentName!}
          currentStatus={apiKeyModalState.currentStatus!}
          provider="ultravox"
        />
      )}

      {/* Metrics Configuration Modal */}
      <AgentMetricsConfig
        isOpen={metricsModalState.isOpen}
        onClose={handleMetricsModalClose}
        agentId={metricsModalState.agentId || ''}
        agentName={metricsModalState.agentName || ''}
        provider="ultravox"
        onSaved={handleMetricsSaved}
      />

      {/* Widget Management Modal */}
      <WidgetManagementModal
        isOpen={widgetManagementState.isOpen}
        onClose={handleWidgetManagementClose}
        agentId={widgetManagementState.agentId || ''}
        agentName={widgetManagementState.agentName || ''}
        agentType="ultravox"
        onCreateWidget={handleCreateWidget}
      />

      {/* Widget Creation Modal */}
      <WidgetCreationModal
        isOpen={widgetCreationState.isOpen}
        onClose={handleWidgetCreationClose}
        agentId={widgetCreationState.agentId || ''}
        agentType="ultravox"
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
    </div>
  );
}
