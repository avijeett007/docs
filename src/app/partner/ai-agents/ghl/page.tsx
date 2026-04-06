'use client';

import React, { useState, useEffect } from 'react';
import { FreeForeverUpgradeService } from '@/lib/services/freeForeverUpgradeService';
import FreeForeverUpgradeModal from '@/components/partner/FreeForeverUpgradeModal';
import { useRouter } from 'next/navigation';
import { FiMoreVertical, FiUsers, FiInfo, FiRefreshCw, FiBookOpen, FiExternalLink, FiBarChart } from 'react-icons/fi';
import clsx from 'clsx';
import NeonContainer from '@/components/NeonContainer';
import PartnerSidebar from '@/components/partner/PartnerSidebar';
import { Menu, Transition } from '@headlessui/react';
import { Dialog } from '@headlessui/react';
import { toast, Toaster } from 'react-hot-toast';
import AgentMetricsConfig from '@/components/partner/AgentMetricsConfig';

interface GHLAgent {
  id: string;
  name: string;
  customerId: string | null;
  profitMultiplier: number;
  basePerMinuteCost: number; // in cents
  customer?: {
    firstName?: string;
    lastName?: string;
    companyName?: string;
    email?: string;
  };
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  analyticsAgentId?: string;
  webhookEnabled?: boolean;
  webhookUrl?: string;
}

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  customerId?: string; // The actual Customer ID from the Customer table
}

export default function GHLAgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<GHLAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [profitMultiplier, setProfitMultiplier] = useState(1.2);
  const [refreshing, setRefreshing] = useState(false);
  const [showTutorialModal, setShowTutorialModal] = useState(false);

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
  const [pendingAction, setPendingAction] = useState<'tutorial' | null>(null);

  useEffect(() => {
    // Set partner name from localStorage like VAPI and Retell pages
    const storedPartnerName = localStorage.getItem('partner_name');
    if (storedPartnerName) {
      setPartnerName(storedPartnerName);
    }

    fetchAgents();
    fetchCustomers();
  }, []);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      setError(''); // Clear previous errors

      console.log('🚀 Starting GHL agents fetch...');

      // Get token from localStorage like VAPI and Retell pages do
      const token = localStorage.getItem('partner_token');
      if (!token) {
        router.push('/partner/login');
        return;
      }

      const response = await fetch('/api/partner/ghl-agents', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('📡 Response received:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ GHL agents API error:', {
          status: response.status,
          statusText: response.statusText,
          errorData: errorData
        });

        // Handle specific error cases like VAPI and Retell
        if (response.status === 401) {
          router.push('/partner/login');
          return;
        } else {
          throw new Error(errorData.error || errorData.message || 'Failed to fetch GHL agents');
        }
      }

      const data = await response.json();
      console.log('✅ GHL agents API response:', data);

      // Set agents and partner name like VAPI and Retell pages
      setAgents(data.agents || []);
      if (data.partnerName) {
        setPartnerName(data.partnerName);
      }

      console.log('📊 Data processed:', {
        agentsCount: data.agents?.length || 0,
        partnerName: data.partnerName || 'From localStorage'
      });

    } catch (error) {
      console.error('💥 Error fetching GHL agents:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load GHL agents';
      setError(errorMessage);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  };

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
      console.log('Raw customers data:', data);

      // Handle different possible response formats (same as VAPI)
      let customersArray;
      if (Array.isArray(data)) {
        customersArray = data;
      } else if (data && typeof data === 'object') {
        customersArray = data.customers || data.data || [];
      } else {
        customersArray = [];
      }

      // Validate and transform each customer object (same as VAPI)
      const validCustomers = customersArray
        .filter((customer: any) => customer && typeof customer === 'object')
        .map((customer: any) => ({
          id: customer.id || '',
          firstName: customer.firstName || '',
          lastName: customer.lastName || '',
          companyName: customer.companyName || '',
          email: customer.email || ''
        }));

      console.log('Processed customers:', validCustomers);
      setCustomers(validCustomers);
    } catch (error) {
      console.error('Error fetching customers:', error);
      setCustomers([]);
    } finally {
      setCustomersLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAgents();
    setRefreshing(false);
    toast.success('GHL agents refreshed');
  };

  const handleMapToCustomers = (agentId: string) => {
    setSelectedAgent(agentId);
    setShowCustomerModal(true);
    setProfitMultiplier(1.2);
  };

  const handleAssignToCustomer = async () => {
    if (!selectedAgent || !selectedCustomer) return;

    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        router.push('/partner/login');
        return;
      }

      const response = await fetch(`/api/partner/ghl-agents/${selectedAgent}/map-customer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          customerId: selectedCustomer,
          profitMultiplier,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to map customer to agent');
      }

      await response.json();
      toast.success('Customer mapped to GHL agent successfully');

      // Refresh agents list
      await fetchAgents();

      // Close modal
      setShowCustomerModal(false);
      setSelectedAgent(null);
      setSelectedCustomer(null);
      setProfitMultiplier(1.2);
    } catch (error) {
      console.error('Error mapping customer to GHL agent:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to map customer to agent');
    }
  };

  const handleUnassignFromCustomer = async (agentId: string) => {
    try {
      const response = await fetch(`/api/partner/ghl-agents/${agentId}/unassign`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to unassign agent from customer');
      }

      toast.success('Agent unassigned from customer successfully');
      fetchAgents();
    } catch (error) {
      console.error('Error unassigning agent:', error);
      toast.error('Failed to unassign agent from customer');
    }
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const calculateCustomerPrice = (basePerMinuteCost: number, multiplier: number) => {
    return Math.round(basePerMinuteCost * multiplier);
  };

  // Proceed with pending action when "Maybe Later" is clicked
  const proceedWithPendingAction = () => {
    if (pendingAction === 'tutorial') {
      setShowTutorialModal(true);
    }
    setPendingAction(null);
  };

  const openTutorialModal = async () => {
    try {
      // Check if user is on free forever plan first
      const shouldShowFreeForeverUpgrade = await FreeForeverUpgradeService.shouldShowUpgradeEncouragement();

      if (shouldShowFreeForeverUpgrade) {
        // Show free forever upgrade modal for premium GHL agents
        const upgradeMessage = FreeForeverUpgradeService.getUpgradeMessage('ghl_agents');
        setFreeForeverUpgradeData(upgradeMessage);
        setPendingAction('tutorial');
        setShowFreeForeverUpgrade(true);
        return;
      }

      // Proceed with tutorial modal
      setShowTutorialModal(true);
    } catch (error) {
      console.error('Error checking GHL agent access:', error);
      // Fallback: allow tutorial access if check fails
      setShowTutorialModal(true);
    }
  };

  const goToTutorial = () => {
    setShowTutorialModal(false);
    // Open YouTube tutorial video in new tab
    window.open('https://www.youtube.com/watch?v=g9QLjDoFWrA&t=197s', '_blank');
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

  const handleLogout = () => {
    localStorage.removeItem('partner_token');
    localStorage.removeItem('partner_name');
    router.push('/partner/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <PartnerSidebar partnerName={partnerName || 'Loading...'} onLogout={handleLogout} />
        <div className="ml-64 p-8">
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <p className="text-gray-400">Loading GHL agents...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Toaster position="top-right" />
      <PartnerSidebar partnerName={partnerName} onLogout={handleLogout} />
      
      <div className="ml-64 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                GHL Voice AI Agents
              </h1>
              <p className="text-gray-400 mt-2">
                Manage your Go High Level Voice AI agents and customer assignments
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiRefreshCw className={clsx('w-4 h-4', refreshing && 'animate-spin')} />
                Refresh
              </button>
              
              <button
                onClick={openTutorialModal}
                className="flex items-center gap-2 px-6 py-2 rounded-lg transition-colors bg-blue-600 hover:bg-blue-500"
              >
                <FiBookOpen className="w-4 h-4" />
                Watch Tutorial Video
              </button>
            </div>
          </div>

          {/* Tutorial Modal */}
          <Transition appear show={showTutorialModal} as={React.Fragment}>
            <Dialog as="div" className="relative z-50" onClose={() => setShowTutorialModal(false)}>
              <Transition.Child
                as={React.Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <div className="fixed inset-0 bg-black bg-opacity-75" />
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
                    <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-gray-900 p-6 text-left align-middle shadow-xl transition-all border border-gray-700">
                      <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-white mb-4">
                        Setup GHL Voice AI Agents
                      </Dialog.Title>
                      
                      <div className="text-gray-300 mb-6">
                        <p className="mb-3">
                          Watch our comprehensive video tutorial to learn how to:
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          <li>Configure webhook URLs in Go High Level</li>
                          <li>Set up API keys for authentication</li>
                          <li>Configure agent tracking and analytics</li>
                          <li>Test your integration</li>
                        </ul>
                        <p className="mt-3 text-sm text-blue-400">
                          📺 This will open the tutorial video on YouTube in a new tab.
                        </p>
                      </div>

                      <div className="flex gap-3">
                        <button
                          type="button"
                          className="flex-1 px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 border border-gray-600 rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          onClick={() => setShowTutorialModal(false)}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center gap-2"
                          onClick={goToTutorial}
                        >
                          Watch Video Tutorial
                          <FiExternalLink className="w-4 h-4" />
                        </button>
                      </div>
                    </Dialog.Panel>
                  </Transition.Child>
                </div>
              </div>
            </Dialog>
          </Transition>

          {/* Error State */}
          {error && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-6">
              <p className="text-red-400">{error}</p>
              <details className="mt-2">
                <summary className="text-sm text-gray-400 cursor-pointer">Debug Info</summary>
                <div className="mt-2 text-xs text-gray-500">
                  <p>Partner Name: {partnerName || 'Not set'}</p>
                  <p>Agents Count: {agents.length}</p>
                  <p>Check browser console for more details</p>
                </div>
              </details>
            </div>
          )}

          {/* Info Banner */}
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <FiInfo className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-blue-100">
                <h3 className="font-medium mb-1">How GHL Voice AI Agents Work</h3>
                <p className="text-sm text-blue-200">
                  GHL agents are automatically created when webhooks are received from Go High Level.
                  Configure your GHL automation to send webhook data to our endpoint with your API key and agent details.
                  Once created, you can assign agents to customers and set markup pricing.
                </p>
              </div>
            </div>
          </div>

          {/* Agents Grid */}
          {agents.length === 0 ? (
            <NeonContainer className="text-center py-12">
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FiBookOpen className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">No GHL Agents Yet</h3>
                <p className="text-gray-400 mb-6">
                  GHL agents will appear here automatically when webhooks are received from your Go High Level automations.
                </p>
                <button
                  onClick={openTutorialModal}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                >
                  <FiBookOpen className="w-4 h-4" />
                  Watch Setup Tutorial
                </button>
              </div>
            </NeonContainer>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {agents.map((agent) => (
                <NeonContainer key={agent.id} className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-1">{agent.name}</h3>
                      <p className="text-sm text-gray-400">ID: {agent.id}</p>
                    </div>

                    <Menu as="div" className="relative">
                      <Menu.Button className="p-2 rounded-lg hover:bg-gray-800 transition-colors">
                        <FiMoreVertical className="w-4 h-4 text-gray-400" />
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
                            {agent.customerId ? (
                              <Menu.Item>
                                {({ active }) => (
                                  <button
                                    onClick={() => handleUnassignFromCustomer(agent.id)}
                                    className={clsx(
                                      'w-full text-left px-4 py-2 text-sm transition-colors',
                                      active ? 'bg-gray-700 text-white' : 'text-gray-300'
                                    )}
                                  >
                                    Unassign from Customer
                                  </button>
                                )}
                              </Menu.Item>
                            ) : (
                              <Menu.Item>
                                {({ active }) => (
                                  <button
                                    onClick={() => handleMapToCustomers(agent.id)}
                                    className={clsx(
                                      'w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2',
                                      active ? 'bg-gray-700 text-white' : 'text-gray-300'
                                    )}
                                  >
                                    <FiUsers className="w-4 h-4" />
                                    Map to Customers
                                  </button>
                                )}
                              </Menu.Item>
                            )}
                            <Menu.Item>
                              {({ active }) => (
                                <button
                                  onClick={() => handleConfigureMetrics(agent.id, agent.name)}
                                  disabled={!agent.customerId}
                                  className={clsx(
                                    'w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2',
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
                          </div>
                        </Menu.Items>
                      </Transition>
                    </Menu>
                  </div>

                  {/* Agent Details */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">Base Cost/Min:</span>
                      <span className="text-sm font-medium text-white">
                        {formatCurrency(agent.basePerMinuteCost)}
                      </span>
                    </div>

                    {agent.customerId && agent.customer && (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-400">Customer:</span>
                          <span className="text-sm font-medium text-white">
                            {agent.customer.firstName} {agent.customer.lastName}
                          </span>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-400">Markup:</span>
                          <span className="text-sm font-medium text-green-400">
                            {((agent.profitMultiplier - 1) * 100).toFixed(0)}%
                          </span>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-400">Customer Price/Min:</span>
                          <span className="text-sm font-medium text-green-400">
                            {formatCurrency(calculateCustomerPrice(agent.basePerMinuteCost, agent.profitMultiplier))}
                          </span>
                        </div>
                      </>
                    )}

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">Status:</span>
                      <span className={clsx(
                        'text-sm font-medium',
                        agent.isActive ? 'text-green-400' : 'text-red-400'
                      )}>
                        {agent.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">Analytics:</span>
                      <span className={clsx(
                        'text-sm font-medium',
                        agent.analyticsAgentId ? 'text-green-400' : 'text-amber-400'
                      )}>
                        {agent.analyticsAgentId ? 'Enabled' : 'Pending'}
                      </span>
                    </div>
                  </div>

                  {!agent.customerId && (
                    <div className="mt-4 pt-4 border-t border-gray-700">
                      <button
                        onClick={() => handleMapToCustomers(agent.id)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm"
                      >
                        <FiUsers className="w-4 h-4" />
                        Map to Customers
                      </button>
                    </div>
                  )}
                </NeonContainer>
              ))}
            </div>
          )}

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
                <div className="fixed inset-0 bg-black bg-opacity-75" />
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
                    <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-gray-900 p-6 text-left align-middle shadow-xl transition-all border border-gray-700">
                      <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-white mb-4">
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
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={customersLoading}
                          >
                            <option value="">
                              {customersLoading ? 'Loading customers...' : 'Choose a customer...'}
                            </option>
                            {!customersLoading && customers
                              .filter(customer => customer.customerId) // Only show customers with valid Customer records
                              .map((customer) => (
                              <option key={customer.id} value={customer.id}>
                                {customer.companyName || `${customer.firstName} ${customer.lastName}`} ({customer.email})
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
                            value={profitMultiplier}
                            onChange={(e) => setProfitMultiplier(parseFloat(e.target.value) || 1.2)}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <p className="text-xs text-gray-400 mt-1">
                            Markup percentage: {((profitMultiplier - 1) * 100).toFixed(0)}%
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3 mt-6">
                        <button
                          type="button"
                          className="flex-1 px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 border border-gray-600 rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          onClick={() => {
                            setShowCustomerModal(false);
                            setSelectedAgent(null);
                            setSelectedCustomer(null);
                            setProfitMultiplier(1.2);
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={handleAssignToCustomer}
                          disabled={!selectedCustomer}
                        >
                          Map Agent
                        </button>
                      </div>
                    </Dialog.Panel>
                  </Transition.Child>
                </div>
              </div>
            </Dialog>
          </Transition>
        </div>
      </div>

      {/* Metrics Configuration Modal */}
      <AgentMetricsConfig
        isOpen={metricsModalState.isOpen}
        onClose={handleMetricsModalClose}
        agentId={metricsModalState.agentId || ''}
        agentName={metricsModalState.agentName || ''}
        provider="ghl"
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
    </div>
  );
}
