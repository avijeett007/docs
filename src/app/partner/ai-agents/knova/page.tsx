'use client';

import React, { useState, useEffect } from 'react';
import { FreeForeverUpgradeService } from '@/lib/services/freeForeverUpgradeService';
import FreeForeverUpgradeModal from '@/components/partner/FreeForeverUpgradeModal';
import { useRouter } from 'next/navigation';
import { FiPlus, FiMoreVertical, FiUsers, FiTrash2, FiSettings, FiEdit3, FiBarChart } from 'react-icons/fi';
import clsx from 'clsx';
import NeonContainer from '@/components/NeonContainer';
import GuidedPartnerSidebar from '@/components/partner/GuidedPartnerSidebar';
import { Menu, Transition } from '@headlessui/react';
import { Dialog } from '@headlessui/react';
import toast, { Toaster } from 'react-hot-toast';
import KnovaAgentModal from '@/components/partner/KnovaAgentModal';
import AgentMetricsConfig from '@/components/partner/AgentMetricsConfig';

interface Customer {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
}

interface KnovaAgent {
  id: string;
  name: string;
  agentType: string;
  communicationChannel: string;
  customerId: string | null;
  customer: {
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
  } | null;
  systemPrompt?: string;
  greetingMessage?: string;
  voiceConfig?: any;
  businessHours?: any;
  productServices?: any;
  knowledgeBaseIds: string[];
  integrationIds: string[];
  advancedConfig?: any;
  widgetConfig?: any;
  recordingEnabled: boolean;
  isActive: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
  profitMultiplier: number;
  analyticsAgentId?: string;
  webhookUrl?: string;
  webhookEnabled?: boolean;
}

export default function KnovaAgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<KnovaAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState('Partner');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [profitMultiplier, setProfitMultiplier] = useState(1.2);

  const [agentModalState, setAgentModalState] = useState({
    isOpen: false,
    mode: 'create' as 'create' | 'edit',
    agentId: undefined as string | undefined
  });

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
  const [pendingAction, setPendingAction] = useState<'create' | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('partner_token');
    if (!token) {
      router.push('/partner/login');
      return;
    }

    const storedName = localStorage.getItem('partner_name');
    if (storedName) {
      setPartnerName(storedName);
    }

    const fetchAgents = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/partner/knova-agents', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Cookie': `partner_token=${token}`
          }
        });

        if (!response.ok) {
          if (response.status === 401) {
            localStorage.removeItem('partner_token');
            localStorage.removeItem('partner_name');
            router.push('/partner/login');
            return;
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Knova agents data:', data);

        setAgents(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching Knova agents:', err);
        setError('Failed to fetch Knova agents. Please try again later.');
        setAgents([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAgents();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('partner_token');
    localStorage.removeItem('partner_name');
    router.push('/partner/login');
  };

  // Proceed with pending action when "Maybe Later" is clicked
  const proceedWithPendingAction = () => {
    if (pendingAction === 'create') {
      setAgentModalState({
        isOpen: true,
        mode: 'create',
        agentId: undefined
      });
    }
    setPendingAction(null);
  };

  const handleCreateAgent = async () => {
    try {
      // Check if user is on free forever plan first
      const shouldShowFreeForeverUpgrade = await FreeForeverUpgradeService.shouldShowUpgradeEncouragement();

      if (shouldShowFreeForeverUpgrade) {
        // Show free forever upgrade modal for premium Knova agents
        const upgradeMessage = FreeForeverUpgradeService.getUpgradeMessage('knova_agents');
        setFreeForeverUpgradeData(upgradeMessage);
        setPendingAction('create');
        setShowFreeForeverUpgrade(true);
        return;
      }

      // Proceed with agent creation
      setAgentModalState({
        isOpen: true,
        mode: 'create',
        agentId: undefined
      });
    } catch (error) {
      console.error('Error checking Knova agent access:', error);
      // Fallback: allow agent creation if check fails
      setAgentModalState({
        isOpen: true,
        mode: 'create',
        agentId: undefined
      });
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

  const handleAgentSaved = () => {
    // Refresh the agents list
    const token = localStorage.getItem('partner_token');
    fetch('/api/partner/knova-agents', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cookie': `partner_token=${token}`
      }
    })
    .then(response => response.json())
    .then(data => setAgents(data))
    .catch(error => console.error('Error refreshing agents:', error));
  };

  const handleDeleteAgent = async (agentId: string) => {
    if (!confirm('Are you sure you want to delete this agent?')) {
      return;
    }

    try {
      const token = localStorage.getItem('partner_token');
      const response = await fetch(`/api/partner/knova-agents/${agentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cookie': `partner_token=${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete agent');
      }

      setAgents(prev => prev.filter(agent => agent.id !== agentId));
      toast.success('Agent deleted successfully');
    } catch (error) {
      console.error('Error deleting agent:', error);
      toast.error('Failed to delete agent');
    }
  };

  const handleAssignCustomer = (agentId: string) => {
    setSelectedAgent(agentId);
    setShowCustomerModal(true);
    loadCustomers();
  };

  const loadCustomers = async () => {
    try {
      setCustomersLoading(true);
      const token = localStorage.getItem('partner_token');
      const response = await fetch('/api/partner/customers', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cookie': `partner_token=${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCustomers(data.data || data.customers || []);
      }
    } catch (err) {
      console.error('Error loading customers:', err);
      toast.error('Failed to load customers');
    } finally {
      setCustomersLoading(false);
    }
  };

  const handleSaveCustomerMapping = async () => {
    if (!selectedAgent || !selectedCustomer) return;

    try {
      const token = localStorage.getItem('partner_token');
      const response = await fetch(`/api/partner/knova-agents/${selectedAgent}/assign-customer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Cookie': `partner_token=${token}`
        },
        body: JSON.stringify({
          customerId: selectedCustomer,
          profitMultiplier
        })
      });

      if (!response.ok) {
        throw new Error('Failed to assign customer');
      }

      // Refresh agents list
      const agentsResponse = await fetch('/api/partner/knova-agents', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cookie': `partner_token=${token}`
        }
      });

      if (agentsResponse.ok) {
        const data = await agentsResponse.json();
        setAgents(data);
      }

      setShowCustomerModal(false);
      setSelectedAgent(null);
      setSelectedCustomer(null);
      toast.success('Customer assigned successfully');
    } catch (error) {
      console.error('Error assigning customer:', error);
      toast.error('Failed to assign customer');
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

  return (
    <div className="min-h-screen bg-gray-900 text-white flex">
      <GuidedPartnerSidebar partnerName={partnerName} onLogout={handleLogout} />
      
      <main className="flex-1 pl-64 min-h-screen relative">
        <div className="p-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-3xl font-bold">Knova AI (Hosted) Agents</h1>
                <p className="mt-2 text-gray-400">Create and manage sophisticated AI agents with advanced capabilities.</p>
              </div>
              <button
                onClick={handleCreateAgent}
                className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <FiPlus className="w-5 h-5" />
                Create Agent
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
              </div>
            ) : error ? (
              <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6 text-center">
                <p className="text-lg text-red-400">{error}</p>
              </div>
            ) : agents.length === 0 ? (
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-8 text-center">
                <p className="text-lg text-gray-400">No Knova AI Agents found. Create your first agent to get started!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {agents.map((agent) => (
                  <NeonContainer key={agent.id} className="p-6 h-[320px] flex flex-col overflow-hidden">
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-4 gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-lg font-semibold text-white truncate flex-1 min-w-0">{agent.name}</h3>
                            <Menu as="div" className="relative flex-shrink-0">
                              <Menu.Button className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
                                <FiMoreVertical className="w-5 h-5 text-gray-400" />
                              </Menu.Button>
                              <Transition
                                as={React.Fragment}
                                enter="transition ease-out duration-100"
                                enterFrom="transform opacity-0 scale-95"
                                enterTo="transform opacity-100 scale-100"
                                leave="transition ease-in duration-75"
                                leaveFrom="transform opacity-100 scale-100"
                                leaveTo="transform opacity-0 scale-95"
                              >
                                <Menu.Items className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-lg border border-gray-700 z-10">
                                  <div className="py-1">
                                    <Menu.Item>
                                      {({ active }) => (
                                        <button
                                          onClick={() => handleEditAgent(agent.id)}
                                          className={clsx(
                                            'flex items-center gap-2 w-full px-4 py-2 text-sm text-left',
                                            active ? 'bg-gray-700 text-white' : 'text-gray-300'
                                          )}
                                        >
                                          <FiEdit3 className="w-4 h-4" />
                                          Edit Agent
                                        </button>
                                      )}
                                    </Menu.Item>
                                    <Menu.Item>
                                      {({ active }) => (
                                        <button
                                          onClick={() => handleAssignCustomer(agent.id)}
                                          className={clsx(
                                            'flex items-center gap-2 w-full px-4 py-2 text-sm text-left',
                                            active ? 'bg-gray-700 text-white' : 'text-gray-300'
                                          )}
                                        >
                                          <FiUsers className="w-4 h-4" />
                                          Assign Customer
                                        </button>
                                      )}
                                    </Menu.Item>
                                    <Menu.Item>
                                      {({ active }) => (
                                        <button
                                          onClick={() => handleConfigureMetrics(agent.id, agent.name)}
                                          disabled={!agent.customerId}
                                          className={clsx(
                                            'flex items-center gap-2 w-full px-4 py-2 text-sm text-left',
                                            active && agent.customerId ? 'bg-gray-700 text-white' : '',
                                            !agent.customerId ? 'opacity-50 cursor-not-allowed text-gray-500' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                                          )}
                                          title={!agent.customerId ? 'Please map this agent to a customer first to configure metrics' : ''}
                                        >
                                          <FiBarChart className="w-4 h-4" />
                                          Configure Metrics
                                        </button>
                                      )}
                                    </Menu.Item>
                                    <Menu.Item>
                                      {({ active }) => (
                                        <button
                                          onClick={() => handleDeleteAgent(agent.id)}
                                          className={clsx(
                                            'flex items-center gap-2 w-full px-4 py-2 text-sm text-left',
                                            active ? 'bg-red-600 text-white' : 'text-red-400'
                                          )}
                                        >
                                          <FiTrash2 className="w-4 h-4" />
                                          Delete Agent
                                        </button>
                                      )}
                                    </Menu.Item>
                                  </div>
                                </Menu.Items>
                              </Transition>
                            </Menu>
                          </div>
                          <div className="mt-2 space-y-1">
                            <p className="text-sm text-gray-400 truncate">Type: {agent.agentType}</p>
                            <p className="text-sm text-gray-400 truncate">Channel: {agent.communicationChannel}</p>
                            {agent.customer && (
                              <p className="text-sm text-blue-400 truncate">
                                Customer: {agent.customer.firstName} {agent.customer.lastName}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-auto flex items-center justify-between">
                        <div className={clsx(
                          'px-3 py-1.5 rounded-full text-xs font-medium',
                          agent.status === 'active'
                            ? 'bg-green-500/20 text-green-400'
                            : agent.status === 'draft'
                            ? 'bg-yellow-500/20 text-amber-400'
                            : 'bg-gray-500/20 text-gray-400'
                        )}>
                          {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
                        </div>
                        <button
                          onClick={() => handleEditAgent(agent.id)}
                          className="flex items-center gap-1 text-blue-400 text-sm hover:text-blue-300 transition-colors"
                        >
                          <span>Configure</span>
                          <FiSettings className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </NeonContainer>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Customer Assignment Modal */}
      <Transition appear show={showCustomerModal} as={React.Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowCustomerModal(false)}>
          <Transition.Child
            as={React.Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={React.Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-gray-900 border border-blue-400/20 p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-white mb-4">
                    Assign Customer to Agent
                  </Dialog.Title>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Select Customer
                      </label>
                      {customersLoading ? (
                        <div className="flex justify-center py-4">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                        </div>
                      ) : (
                        <select
                          value={selectedCustomer || ''}
                          onChange={(e) => setSelectedCustomer(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select a customer...</option>
                          {customers.map((customer) => (
                            <option key={customer.id} value={customer.id}>
                              {customer.firstName} {customer.lastName} ({customer.email})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Profit Multiplier
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        value={profitMultiplier}
                        onChange={(e) => setProfitMultiplier(parseFloat(e.target.value))}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
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
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Agent Management Modal */}
      <KnovaAgentModal
        isOpen={agentModalState.isOpen}
        onClose={handleAgentModalClose}
        mode={agentModalState.mode}
        agentId={agentModalState.agentId}
        onAgentSaved={handleAgentSaved}
      />

      {/* Metrics Configuration Modal */}
      <AgentMetricsConfig
        isOpen={metricsModalState.isOpen}
        onClose={handleMetricsModalClose}
        agentId={metricsModalState.agentId || ''}
        agentName={metricsModalState.agentName || ''}
        provider="knova"
        onSaved={handleMetricsSaved}
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

      <Toaster position="top-right" />
    </div>
  );
}
