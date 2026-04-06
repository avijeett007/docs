'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiPlus, FiMoreVertical, FiUsers, FiTrash2, FiSettings, FiInfo, FiEdit3, FiPlay, FiKey, FiDownload, FiBarChart, FiGlobe, FiClock } from 'react-icons/fi';
import clsx from 'clsx';
import NeonContainer from '@/components/NeonContainer';
import GuidedPartnerSidebar from '@/components/partner/GuidedPartnerSidebar';
import { UserGuideProvider } from '@/context/UserGuideContext';
import { WebhookManager } from '@/components/WebhookManager';
import { Menu, Transition } from '@headlessui/react';
import { Dialog } from '@headlessui/react';
import toast, { Toaster } from 'react-hot-toast';
import RetellAgentModal from '@/components/partner/RetellAgentModal';
import AgentTestModal from '@/components/partner/AgentTestModal';
import ApiKeyManagementModal from '@/components/partner/ApiKeyManagementModal';
import RetellImportModal from '@/components/partner/RetellImportModal';
import AgentMetricsConfig from '@/components/partner/AgentMetricsConfig';
import AgentDeletionModal from '@/components/partner/AgentDeletionModal';
import KnowledgeBaseViewerModal from '@/components/partner/KnowledgeBaseViewerModal';
import { FreeForeverUpgradeService } from '@/lib/services/freeForeverUpgradeService';
import FreeForeverUpgradeModal from '@/components/partner/FreeForeverUpgradeModal';
import { ClientTierValidationService } from '@/lib/services/clientTierValidationService';
import WidgetCreationModal from '@/components/partner/WidgetCreationModal';
import WidgetManagementModal from '@/components/partner/WidgetManagementModal';
import { WebhookSyncButton } from '@/components/analytics/WebhookSyncButton';

interface RetellAgent {
  id: string;
  name: string;
  voiceId: string;
  voiceModel?: string;
  customerId: string | null;
  profitMultiplier: number;
  customer: {
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
    companyName?: string;
  } | null;
  responseEngine: any;
  voiceConfig: any;
  callConfig: any;
  webhookUrl?: string;
  language: string;
  recordingEnabled: boolean;
  importedAt: string;
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  analyticsAgentId?: string;
  webhookEnabled?: boolean;
  webhookMode?: string;
  preExistingWebhookUrl?: string;
  forwardToPreExisting?: boolean;
  // New API key fields
  apiKeyStatus?: 'not_set' | 'valid' | 'invalid' | 'expired' | 'rate_limited' | 'revoked';
  apiKeyLastVerified?: string;
  apiKeyErrorMessage?: string;
  usingPartnerKey?: boolean;
  hasPartnerKeyFallback?: boolean;
}

interface Customer {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  companyName?: string;
  customerId?: string; // The actual Customer ID from the Customer table
}

export default function RetellAgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<RetellAgent[]>([]);
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
  const [agentToDelete, setAgentToDelete] = useState<RetellAgent | null>(null);
  const [webhookLoading, setWebhookLoading] = useState<Record<string, boolean>>({});

  // Free Forever Upgrade Modal state
  const [showFreeForeverUpgrade, setShowFreeForeverUpgrade] = useState(false);
  const [freeForeverUpgradeData, setFreeForeverUpgradeData] = useState({
    title: '',
    message: '',
    featureDescription: '',
  });
  const [pendingAction, setPendingAction] = useState<'create' | 'import' | null>(null);

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
    accessToken?: string;
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

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);

  // Metrics Configuration modal state
  const [metricsModalState, setMetricsModalState] = useState<{
    isOpen: boolean;
    agentId?: string;
    agentName?: string;
  }>({
    isOpen: false
  });

  // Knowledge Base Viewer modal state
  const [knowledgeBaseViewerState, setKnowledgeBaseViewerState] = useState<{
    isOpen: boolean;
    knowledgeBase?: any;
    customerId?: string;
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
        const response = await fetch('/api/partner/retell-agents', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        console.log('Retell agents response status:', response.status);

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Error fetching Retell agents:', errorData);

          if (response.status === 400 && errorData.error === 'RETELL_API_KEY_MISSING') {
            setError('Retell API key is missing. Please add your API key in the settings.');
          } else if (response.status === 401 && errorData.error === 'Invalid Retell API key') {
            setError('Invalid Retell API key. Please update your API key in the settings.');
          } else {
            setError(`An unexpected error occurred. ${errorData.error || 'Please try again later.'}`);
          }
          setAgents([]);
          return;
        }

        const data = await response.json();
        console.log('Retell agents data:', data);

        setAgents(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching Retell agents:', err);
        setError('Failed to fetch Retell agents. Please try again later.');
        setAgents([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAgents();
  }, [router]);

  // Function to proceed with pending action (used by "Maybe Later" callback)
  const proceedWithPendingAction = () => {
    if (pendingAction === 'create') {
      setAgentModalState({
        isOpen: true,
        mode: 'create'
      });
    } else if (pendingAction === 'import') {
      setShowImportModal(true);
    }
    setPendingAction(null);
  };

  // Agent modal handlers
  const handleCreateAgent = async () => {
    try {
      // Check if user is on free forever plan first
      const shouldShowFreeForeverUpgrade = await FreeForeverUpgradeService.shouldShowUpgradeEncouragement();

      if (shouldShowFreeForeverUpgrade) {
        // Check if they're at the agent limit for free forever users
        const validation = await ClientTierValidationService.validateAgentCreation('retell');

        if (!validation.allowed) {
          // User has exceeded limit - show blocking message
          const upgradeMessage = FreeForeverUpgradeService.getUpgradeMessage('retell_agents');
          setFreeForeverUpgradeData({
            ...upgradeMessage,
            message: `You've reached the Free Forever limit of 2 Retell agents. Upgrade to create unlimited agents and unlock premium features.`
          });
          setShowFreeForeverUpgrade(true);
          setPendingAction('create');
          return;
        }
        // If within limit, proceed with creation (no modal shown)
      }

      // Proceed with agent creation
      setAgentModalState({
        isOpen: true,
        mode: 'create'
      });
    } catch (error) {
      console.error('Error checking agent creation limits:', error);
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
        // Check if they're at the agent limit for free forever users
        const validation = await ClientTierValidationService.validateAgentCreation('retell');
        console.log('🔍 Retell import validation result:', validation);

        if (!validation.allowed) {
          // User has exceeded limit - show blocking message
          const upgradeMessage = FreeForeverUpgradeService.getUpgradeMessage('retell_agents');
          setFreeForeverUpgradeData({
            ...upgradeMessage,
            message: `You've reached the Free Forever limit of 2 Retell agents. Upgrade to create unlimited agents and unlock premium features.`
          });
          setShowFreeForeverUpgrade(true);
          setPendingAction('import');
          return;
        }
        console.log('✅ Retell import allowed, proceeding...');
        // If within limit, proceed with import (no modal shown)
      }

      // Proceed with agent import
      setShowImportModal(true);
    } catch (error) {
      console.error('Error checking agent import access:', error);
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
      // For new agents, add to the list directly to avoid timing issues
      if (savedAgent) {
        setAgents(prevAgents => [...prevAgents, savedAgent]);
        toast.success('Agent created successfully!');
      }
    } else {
      // For edited agents, refresh the list to get updated data
      const token = localStorage.getItem('partner_token');
      if (token) {
        const fetchAgents = async () => {
          try {
            const response = await fetch('/api/partner/retell-agents', {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            if (response.ok) {
              const data = await response.json();
              setAgents(data);
              toast.success('Agent updated successfully!');
            }
          } catch (error) {
            console.error('Error refreshing agents:', error);
          }
        };
        fetchAgents();
      }
    }
    handleAgentModalClose();
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
    // Refresh the agents list to show updated API key status
    const token = localStorage.getItem('partner_token');
    if (token) {
      const fetchAgents = async () => {
        try {
          const response = await fetch('/api/partner/retell-agents', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (response.ok) {
            const data = await response.json();
            setAgents(data);
          }
        } catch (error) {
          console.error('Error refreshing agents:', error);
        }
      };
      fetchAgents();
    }
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

  const handleImportComplete = () => {
    // Refresh the agents list after import
    const token = localStorage.getItem('partner_token');
    if (token) {
      const fetchAgents = async () => {
        try {
          const response = await fetch('/api/partner/retell-agents', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (response.ok) {
            const data = await response.json();
            setAgents(data);
          }
        } catch (error) {
          console.error('Error refreshing agents:', error);
        }
      };
      fetchAgents();
    }
  };

  const handleTestAgent = async (agentId: string, agentName: string) => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        router.push('/partner/login');
        return;
      }

      // Create test call
      const response = await fetch(`/api/partner/retell-agents/${agentId}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({})
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create test call');
      }

      const testCall = await response.json();

      // Extract access token from the correct structure
      const accessToken = testCall.testCall?.accessToken || testCall.accessToken;

      if (!accessToken) {
        throw new Error('No access token received from test call API');
      }

      // Open test modal
      setTestModalState({
        isOpen: true,
        agentId,
        agentName,
        accessToken: accessToken
      });

      toast.success('Test call created! You can now start testing.');
    } catch (error) {
      console.error('Error creating test call:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create test call');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('partner_token');
    localStorage.removeItem('partner_name');
    router.push('/partner/login');
  };

  const handleSettingsClick = () => {
    router.push('/partner/settings');
  };

  const handleAssignCustomer = (agentId: string) => {
    setSelectedAgent(agentId);
    setShowCustomerModal(true);
    fetchCustomers();
  };

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

      setCustomers(customersArray);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast.error('Failed to fetch customers');
      setCustomers([]);
    } finally {
      setCustomersLoading(false);
    }
  };

  const handleRemoveFromCustomer = async (agentId: string) => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        router.push('/partner/login');
        return;
      }

      const response = await fetch(`/api/partner/retell-agents/${agentId}/unmap-customer`, {
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
          return { ...agent, customerId: null, customer: null } as RetellAgent;
        }
        return agent;
      }));

      toast.success('Customer removed from agent successfully');
    } catch (error) {
      console.error('Error removing customer from agent:', error);
      toast.error('Failed to remove customer from agent');
    }
  };

  const handleDeleteAgent = (agent: RetellAgent) => {
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

      const response = await fetch(`/api/partner/retell-agents/${agentId}/delete-from-portal`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete agent from portal');
      }

      // Remove agent from local state
      setAgents(agents.filter(agent => agent.id !== agentId));
      toast.success('Agent deleted from portal successfully');
    } catch (error) {
      console.error('Error deleting agent from portal:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete agent from portal');
    }
  };

  const handleDeleteEverywhere = async (agentId: string) => {
    // Placeholder for future implementation
    toast.error('Delete Everywhere feature is coming soon');
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

    // Fetch current value
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch(`/api/partner/retell-agents/${agentId}/min-call-duration`, {
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
        `/api/partner/retell-agents/${minCallDurationState.agentId}/min-call-duration`,
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

  const handleSaveCustomerMapping = async () => {
    if (!selectedAgent || !selectedCustomer) return;

    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        router.push('/partner/login');
        return;
      }

      const response = await fetch(`/api/partner/retell-agents/${selectedAgent}/map-customer`, {
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

      // Update the agents list with the updated agent
      setAgents(agents.map(agent =>
        agent.id === selectedAgent ? {
          ...agent,
          customer: data.agent.customer,
          customerId: data.agent.customerId,
          profitMultiplier: data.agent.profitMultiplier
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

      const response = await fetch(`/api/partner/retell-agents/${agentId}/webhook`, {
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

      // Update the agents list with the updated webhook configuration
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

  const handleRegisterAgentWithAnalytics = async (agentId: string) => {
    try {
      setWebhookLoading(prev => ({ ...prev, [agentId]: true }));

      const token = localStorage.getItem('partner_token');
      if (!token) {
        router.push('/partner/login');
        return;
      }

      const response = await fetch(`/api/partner/retell-agents/${agentId}/register-analytics`, {
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

      // Update the agent in the agents list with all webhook fields
      setAgents(agents.map(agent =>
        agent.id === agentId ? {
          ...agent,
          analyticsAgentId: result.analyticsAgentId,
          webhookUrl: result.webhookUrl,
          webhookEnabled: result.webhookEnabled || false,
          webhookMode: result.webhookMode || 'manual',
        } : agent
      ));

      // Show appropriate toast based on whether Retell API was updated
      if (result.webhookEnabled) {
        toast.success('Webhook enabled successfully in Retell!');
      } else {
        // If Retell API update failed, open the webhook manager for manual configuration
        const updatedAgent = agents.find(agent => agent.id === agentId);
        if (updatedAgent) {
          setTimeout(() => {
            const webhookButton = document.querySelector(`[data-agent-id="${agentId}"] button`) as HTMLButtonElement;
            if (webhookButton) {
              webhookButton.click();
            }
          }, 100);
        }
        toast.success('Webhook registered. Please complete configuration manually.');
      }
    } catch (error) {
      console.error('Error registering agent with analytics service:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to enable webhook for agent');
    } finally {
      setWebhookLoading(prev => ({ ...prev, [agentId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
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
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-3xl font-bold">Retell Agents</h1>
              <div className="flex gap-4">
                {error && error.includes('Retell API key') && (
                  <button
                    onClick={handleSettingsClick}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <FiSettings className="w-5 h-5" />
                    <span>Update API Key</span>
                  </button>
                )}
                <button
                  onClick={handleImportAgentClick}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg transition-colors"
                >
                  <FiDownload className="w-5 h-5" />
                  <span>Import Agents</span>
                </button>
                <button
                  onClick={handleCreateAgent}
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
                <p className="text-lg text-gray-400 mb-4">No Retell AI Agents found. Create your first agent on Retell to get started!</p>

                {/* Affiliate Link Section */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6 mt-6 max-w-md mx-auto">
                  <div className="flex items-center justify-center mb-3">
                    <span className="text-2xl mr-2">🎁</span>
                    <h3 className="text-lg font-semibold text-blue-400">Get $10 Free Credits!</h3>
                  </div>
                  <p className="text-sm text-gray-300 mb-4">
                    Don't have a Retell account yet? Use our affiliate link to register and get $10 in free credits to try on our app partner Retell AI.
                  </p>
                  <a
                    href="https://dashboard.retellai.com/?ref=avijit"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
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
                          <p className="text-sm text-gray-400 gap-2">Voice ID: {agent.voiceId}</p>
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
                                        onClick={() => handleEditAgent(agent.id)}
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
                                            provider="retell"
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
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        <button
                          onClick={() => handleAssignCustomer(agent.id)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm bg-blue-600 hover:bg-blue-500"
                        >
                          <FiUsers className="w-4 h-4" />
                          <span>
                            {agent.customer ? 'Reassign Customer' : 'Map to Customer'}
                          </span>
                        </button>

                        {agent.analyticsAgentId ? (
                          <WebhookManager
                            agentId={agent.id}
                            provider="retell"
                            analyticsAgentId={agent.analyticsAgentId!}
                            webhookEnabled={agent.webhookEnabled || false}
                            webhookUrl={agent.webhookUrl || null}
                            webhookMode={(agent.webhookMode as 'manual' | 'automatic') || 'manual'}
                            preExistingWebhookUrl={agent.preExistingWebhookUrl || null}
                            forwardToPreExisting={agent.forwardToPreExisting || true}
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
                    .filter(customer => customer.customerId) // Only show customers with valid Customer records
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
                    ? "bg-blue-500 hover:bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-400 cursor-not-allowed"
                )}
              >
                Save
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Agent Management Modal */}
      <RetellAgentModal
        isOpen={agentModalState.isOpen}
        onClose={handleAgentModalClose}
        mode={agentModalState.mode}
        agentId={agentModalState.agentId}
        onAgentSaved={handleAgentSaved}
        onOpenKnowledgeBaseViewer={(knowledgeBase, customerId) => {
          console.log('[RetellPage] Opening knowledge base viewer:', {
            knowledgeBaseName: knowledgeBase.name,
            customerId
          });

          // Close the agent modal temporarily to prevent interference
          setAgentModalState(prev => ({ ...prev, isOpen: false }));
          setKnowledgeBaseViewerState({
            isOpen: true,
            knowledgeBase,
            customerId
          });
        }}
      />

      {/* Agent Test Modal */}
      <AgentTestModal
        isOpen={testModalState.isOpen && !!testModalState.accessToken}
        onClose={() => setTestModalState({ isOpen: false })}
        accessToken={testModalState.accessToken || ''}
        agentName={testModalState.agentName || 'Agent'}
        agentId={testModalState.agentId || ''}
      />

      {/* API Key Management Modal */}
      <ApiKeyManagementModal
        isOpen={apiKeyModalState.isOpen}
        onClose={handleApiKeyModalClose}
        agentId={apiKeyModalState.agentId || ''}
        agentName={apiKeyModalState.agentName || ''}
        provider="retell"
        currentStatus={apiKeyModalState.currentStatus}
        onApiKeyUpdated={handleApiKeyUpdated}
      />

      {/* Retell Import Modal */}
      <RetellImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={handleImportComplete}
      />

      {/* Metrics Configuration Modal */}
      <AgentMetricsConfig
        isOpen={metricsModalState.isOpen}
        onClose={handleMetricsModalClose}
        agentId={metricsModalState.agentId || ''}
        agentName={metricsModalState.agentName || ''}
        provider="retell"
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

      {/* Knowledge Base Viewer Modal */}
      {knowledgeBaseViewerState.knowledgeBase && (
        <KnowledgeBaseViewerModal
          isOpen={knowledgeBaseViewerState.isOpen}
          onClose={() => {
            setKnowledgeBaseViewerState({ isOpen: false });
            // Reopen the agent modal
            setAgentModalState(prev => ({ ...prev, isOpen: true }));
          }}
          knowledgeBase={knowledgeBaseViewerState.knowledgeBase}
          customerId={knowledgeBaseViewerState.customerId || ''}
        />
      )}

      {/* Widget Management Modal */}
      <WidgetManagementModal
        isOpen={widgetManagementState.isOpen}
        onClose={handleWidgetManagementClose}
        agentId={widgetManagementState.agentId || ''}
        agentName={widgetManagementState.agentName || ''}
        agentType="retell"
        onCreateWidget={handleCreateWidget}
      />

      {/* Widget Creation Modal */}
      <WidgetCreationModal
        isOpen={widgetCreationState.isOpen}
        onClose={handleWidgetCreationClose}
        agentId={widgetCreationState.agentId || ''}
        agentType="retell"
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


