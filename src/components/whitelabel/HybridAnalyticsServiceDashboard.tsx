'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePartnerBranding } from '@/lib/partnerBranding';
import { PortalTheme, getThemeConfig } from '@/lib/portalThemes';
import CallVolumeChart from '@/components/whitelabel/CallVolumeChart';
import NotificationBell from '@/components/notifications/NotificationBell';
import DeploymentStatusBanner from '@/components/whitelabel/DeploymentStatusBanner';
import CallForwardingModal from '@/components/whitelabel/CallForwardingModal';
import { FiPhoneCall, FiClock, FiUsers, FiBarChart2, FiFileText, FiGlobe, FiActivity, FiRefreshCw, FiArrowRight, FiX, FiMessageSquare } from 'react-icons/fi';
import UnifiedAgentTestModal from '@/components/whitelabel/UnifiedAgentTestModal';

interface DashboardData {
  summary: {
    totalCalls: number;
    totalConversations?: number;
    totalDuration: number;
    totalCost: number;
    averageCallDuration: number;
  };
  recentCalls: Array<{
    id: string;
    agent: string;
    caller: string;
    duration: string;
    status: string;
    time: string;
  }>;
  callTrend: Array<{
    day: string;
    calls: number;
  }>;
  agentCount: number;
}

interface CallAnalytics {
  endReasons: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;
  callTypes: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  totalCost?: number;
  showPricing: boolean;
}

interface Agent {
  id: string;
  name: string;
  type?: string;
  description?: string;
  usage?: {
    calls: number;
    minutes: number;
    lastCall: string;
    cost?: number;
  };
  isLoading?: boolean;
}

const HybridAnalyticsServiceDashboard: React.FC = () => {
  const { branding } = usePartnerBranding();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [customerId, setCustomerId] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month'>('month');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [callAnalytics, setCallAnalytics] = useState<CallAnalytics | null>(null);
  const [currentCredits, setCurrentCredits] = useState<number>(0);
  const [aiCreditsEnabled, setAiCreditsEnabled] = useState<boolean>(false);

  // Onboarding banner state
  const [incompleteOnboarding, setIncompleteOnboarding] = useState<any>(null);
  const [showOnboardingBanner, setShowOnboardingBanner] = useState(false);

  // Deployment banner state
  const [deploymentStatus, setDeploymentStatus] = useState<string>('not_started');
  const [showDeploymentBanner, setShowDeploymentBanner] = useState(false);
  const [assignedPhoneNumber, setAssignedPhoneNumber] = useState<string | null>(null);
  const [hasProspectEntry, setHasProspectEntry] = useState<boolean>(false);

  // Test modal states
  const [testModalState, setTestModalState] = useState<{
    isOpen: boolean;
    agentId?: string;
    agentName?: string;
    agentType?: 'vapi' | 'retell' | 'ultravox' | 'ghl' | 'knova';
    phoneNumber?: string | null;
  }>({ isOpen: false });

  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean;
    agentId?: string;
    agentName?: string;
    agentType?: 'vapi' | 'retell' | 'ultravox' | 'ghl' | 'knova';
    phoneNumber?: string | null;
  }>({ isOpen: false });
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [showCallForwardingModal, setShowCallForwardingModal] = useState(false);
  const [modalPhoneNumber, setModalPhoneNumber] = useState<string | null>(null);

  // Get theme config from branding theme preference
  const theme = (branding.themePreference as PortalTheme) || PortalTheme.MODERN;
  const themeConfig = getThemeConfig(theme);

  // Toast notification function
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm transition-all duration-300 transform translate-x-full`;

    // Set colors based on type
    const colors = {
      success: 'bg-green-600 text-white',
      error: 'bg-red-600 text-white',
      info: 'bg-blue-600 text-white'
    };

    toast.className += ` ${colors[type]}`;
    toast.textContent = message;

    // Add to DOM
    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => {
      toast.style.transform = 'translateX(0)';
    }, 100);

    // Remove after 3 seconds
    setTimeout(() => {
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 300);
    }, 3000);
  };

  // Handle agent tile click - show confirmation
  const handleAgentTileClick = (agentId: string, agentName: string, agentType: 'vapi' | 'retell' | 'ultravox' | 'ghl' | 'knova', phoneNumber?: string | null) => {
    console.log('Agent tile clicked:', { agentId, agentName, agentType, phoneNumber });

    // Check if AI Credits are enabled and if customer has credits
    if (aiCreditsEnabled && currentCredits <= 0) {
      alert('You have no AI Credits remaining. Please contact your provider to add more credits before testing agents.');
      return;
    }

    setConfirmModalState({
      isOpen: true,
      agentId,
      agentName,
      agentType,
      phoneNumber
    });
  };

  // Handle test agent confirmation
  const handleTestAgent = (agentId: string, agentName: string, agentType: 'vapi' | 'retell' | 'ultravox' | 'ghl' | 'knova', phoneNumber?: string | null) => {
    console.log('Test agent confirmed:', { agentId, agentName, agentType, phoneNumber });
    setConfirmModalState({ isOpen: false });
    setTestModalState({
      isOpen: true,
      agentId,
      agentName,
      agentType,
      phoneNumber
    });
  };

  const handleTestModalClose = () => {
    setTestModalState({ isOpen: false });
  };

  const handleConfirmModalClose = () => {
    setConfirmModalState({ isOpen: false });
  };

  // Handle deployment completion (called when user clicks "Happy with it")
  const handleDeploymentCompleted = async () => {
    console.log('🎉 HYBRID - Deployment marked as completed, refreshing status...');

    // Refresh deployment status
    try {
      const response = await fetch('/api/whitelabel/auth/me');
      if (response.ok) {
        const data = await response.json();
        if (data.customer) {
          const deployStatus = data.customer.deploymentStatus || 'not_started';
          console.log('🎉 HYBRID - Updated deployment status:', deployStatus);
          setDeploymentStatus(deployStatus);
        }
      }
    } catch (error) {
      console.error('Error refreshing deployment status:', error);
    }
  };

  // Handle deployment banner actions
  const handleTryAgent = () => {
    console.log('🎯 HYBRID - handleTryAgent called');
    console.log('🎯 HYBRID - Current assignedPhoneNumber state:', assignedPhoneNumber);

    // Find the first available agent for testing (now includes Knova agents)
    const availableAgent = agents.find(agent =>
      (agent as any).type !== 'ghl'
    );

    if (availableAgent) {
      console.log('🎯 HYBRID - Available agent found:', availableAgent.name);
      console.log('🎯 HYBRID - Passing phone number to modal:', assignedPhoneNumber);

      // Use assignedPhoneNumber from state instead of agent.phoneNumber
      handleAgentTileClick(
        availableAgent.id,
        availableAgent.name,
        (availableAgent as any).type,
        assignedPhoneNumber
      );
    } else {
      showToast('No agents available for testing at the moment.', 'info');
    }
  };

  // Function to check if customer has prospect entry (for AI Receptioning usecase)
  const checkProspectEntry = async (customerId: string): Promise<boolean> => {
    try {
      console.log('🔍 HYBRID DASHBOARD - Checking for prospect entry for customer:', customerId);
      const response = await fetch('/api/whitelabel/prospects/check');
      if (response.ok) {
        const data = await response.json();
        console.log('📋 HYBRID DASHBOARD - Prospect check response:', data);
        const hasProspect = data.success && data.hasProspectEntry;
        console.log('✅ HYBRID DASHBOARD - Customer has prospect entry:', hasProspect);
        return hasProspect;
      } else {
        console.log('❌ HYBRID DASHBOARD - Prospect check failed:', response.status);
        return false;
      }
    } catch (error) {
      console.error('❌ HYBRID DASHBOARD - Error checking prospect entry:', error);
      return false;
    }
  };

  const handleDeployForBusiness = async () => {
    try {
      const response = await fetch('/api/whitelabel/deployment/status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deploymentStatus: 'completed'
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setDeploymentStatus('completed');
          // Show success message
          showToast('🎉 Congratulations! Your AI agent is now live and ready for business!', 'success');
        } else {
          throw new Error(data.error || 'Failed to update deployment status');
        }
      } else {
        throw new Error('Failed to update deployment status');
      }
    } catch (error) {
      console.error('Error deploying for business:', error);
      showToast('Failed to deploy for business. Please try again.', 'error');
    }
  };

  const handleSetupCallForwarding = async () => {
    console.log('🔧 HYBRID - Setup call forwarding clicked, current phone number:', assignedPhoneNumber);

    // Ensure we have the latest phone number before opening modal
    let phoneNumberToUse = assignedPhoneNumber;
    if (!assignedPhoneNumber) {
      console.log('📞 HYBRID - No phone number in state, fetching...');
      try {
        const response = await fetch('/api/whitelabel/phone-numbers');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data.phoneNumbers && data.data.phoneNumbers.length > 0) {
            phoneNumberToUse = data.data.phoneNumbers[0].phoneNumber;
            setAssignedPhoneNumber(phoneNumberToUse);
            console.log('📞 HYBRID - Fetched phone number:', phoneNumberToUse);
          }
        }
      } catch (error) {
        console.error('📞 HYBRID - Error fetching phone number:', error);
      }
    }

    console.log('🔧 HYBRID - Opening call forwarding modal with phone number:', phoneNumberToUse);
    setModalPhoneNumber(phoneNumberToUse);
    setShowCallForwardingModal(true);
  };

  // Fetch customer info and features
  useEffect(() => {
    console.log('🚀 HYBRID DASHBOARD - useEffect called, about to define fetchCustomerInfo');
    const fetchCustomerInfo = async () => {
      console.log('🚀 HYBRID DASHBOARD - fetchCustomerInfo called');
      try {
        const response = await fetch('/api/whitelabel/auth/me');
        console.log('🚀 HYBRID DASHBOARD - auth/me response status:', response.status);
        if (response.ok) {
          const data = await response.json();
          console.log('🚀 HYBRID DASHBOARD - auth/me response data:', data);
          setCustomerId(data.customer?.id || '');

          // Debug customer data including deployment status
          console.log('🔍 HYBRID DASHBOARD - CUSTOMER DATA DEBUG:', {
            hasCustomer: !!data.customer,
            customerId: data.customer?.id,
            customerEmail: data.customer?.email,
            deploymentStatus: data.customer?.deploymentStatus,
            deploymentRequestedAt: data.customer?.deploymentRequestedAt,
            allCustomerFields: data.customer ? Object.keys(data.customer) : 'no customer'
          });

          // Check deployment status for all portal modes (same dashboard experience)
          if (data.customer) {
            const deployStatus = data.customer.deploymentStatus || 'not_started';
            console.log('🚀 HYBRID DASHBOARD - DEPLOYMENT STATUS CHECK:', {
              deploymentStatus: deployStatus,
              customerId: data.customer.id,
              rawDeploymentStatus: data.customer.deploymentStatus
            });
            setDeploymentStatus(deployStatus);

            // Check if customer has prospect entry (for AI Receptioning usecase)
            const hasProspect = await checkProspectEntry(data.customer.id);
            setHasProspectEntry(hasProspect);

            // Fetch assigned phone number if phone is provisioned
            if (deployStatus === 'phone_provisioned' || deployStatus === 'agent_deploying' || deployStatus === 'agent_ready') {
              fetchAssignedPhoneNumber();
            }

            // Note: Deployment banner logic moved to separate useEffect that waits for branding to load
          }
        } else {
          console.error('🚨 HYBRID DASHBOARD - Failed to fetch customer info, status:', response.status);
        }
      } catch (error) {
        console.error('🚨 HYBRID DASHBOARD - Error fetching customer info:', error);
      }
    };

    const fetchCustomerFeatures = async () => {
      try {
        const response = await fetch('/api/whitelabel/customer/features');
        if (response.ok) {
          const data = await response.json();
          setShowPricing(data.showPricingInformation || false);
          setAiCreditsEnabled(data.aiCreditsEnabled || false);
        }
      } catch (error) {
        console.error('Error fetching customer features:', error);
        setShowPricing(false);
        setAiCreditsEnabled(false);
      }
    };

    const fetchCreditBalance = async () => {
      try {
        const response = await fetch('/api/whitelabel/credits/balance');
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setCurrentCredits(data.data.creditBalance || 0);
          }
        }
      } catch (error) {
        console.error('Error fetching credit balance:', error);
        setCurrentCredits(0);
      }
    };

    fetchCustomerInfo();
    fetchCustomerFeatures();
    fetchCreditBalance();
  }, []);

  // Fetch assigned phone number
  const fetchAssignedPhoneNumber = async () => {
    try {
      const response = await fetch('/api/whitelabel/phone-numbers');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data && data.data.phoneNumbers && data.data.phoneNumbers.length > 0) {
          // Get the first assigned phone number
          const phoneNumber = data.data.phoneNumbers[0];
          setAssignedPhoneNumber(phoneNumber.phoneNumber);
        } else {
          setAssignedPhoneNumber(null);
        }
      } else {
        setAssignedPhoneNumber(null);
      }
    } catch (error) {
      console.error('Error fetching assigned phone number:', error);
      setAssignedPhoneNumber(null);
    }
  };

  // Fetch dashboard summary data
  const fetchDashboardData = async (period: string = 'month') => {
    try {
      console.log('Fetching dashboard data from analytics service:', { period });

      const response = await fetch(`/api/whitelabel/analytics/dashboard?period=${period}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch dashboard data: ${response.status}`);
      }

      const data = await response.json();
      setDashboardData(data);

      console.log('Successfully loaded dashboard data from analytics service:', {
        totalCalls: data.summary?.totalCalls || 0,
        recentCallsCount: data.recentCalls?.length || 0,
        agentCount: data.agentCount || 0
      });

    } catch (error) {
      console.error('Error fetching dashboard data from analytics service:', error);
      // Set empty dashboard data on error
      setDashboardData({
        summary: {
          totalCalls: 0,
          totalConversations: 0,
          totalDuration: 0,
          totalCost: 0,
          averageCallDuration: 0
        },
        recentCalls: [],
        callTrend: [],
        agentCount: 0
      });
    }
  };

  // Fetch agents list
  const fetchAgents = async () => {
    try {
      const response = await fetch('/api/whitelabel/agents');
      
      if (!response.ok) {
        throw new Error('Failed to fetch agents');
      }

      const data = await response.json();
      const agentsList = data.agents || [];

      // Initialize agents with loading state
      const agentsWithUsage = agentsList.map((agent: any) => ({
        id: agent.id,
        name: agent.name,
        type: agent.type,
        description: agent.description || ((agent.type === 'n8n_chat' || agent.type === 'retell_chat') ? 'Chat AI Assistant' : 'AI Voice Assistant'),
        usage: {
          calls: 0,
          minutes: 0,
          lastCall: 'Loading...',
          cost: 0
        },
        isLoading: true
      }));

      setAgents(agentsWithUsage);

      // Fetch analytics for each agent in the background
      agentsWithUsage.forEach((agent: Agent) => {
        fetchAgentAnalytics(agent.id, selectedPeriod);
      });

    } catch (error) {
      console.error('Error fetching agents:', error);
      setAgents([]);
    }
  };

  // Fetch analytics for a specific agent
  const fetchAgentAnalytics = async (agentId: string, period: string) => {
    try {
      console.log(`Fetching analytics for agent ${agentId}, period: ${period}`);

      const response = await fetch(`/api/whitelabel/analytics/agent/${agentId}?period=${period}`);

      if (!response.ok) {
        console.error(`Analytics service error for agent ${agentId}: ${response.status}`);
        throw new Error('Failed to fetch agent analytics');
      }

      const data = await response.json();
      console.log(`Analytics data received for agent ${agentId}:`, data);
      console.log(`Raw response status: ${response.status}`);

      // Parse the whitelabel analytics format (array of analytics objects)
      let totalCalls = 0;
      let totalDuration = 0;
      let totalCost = 0;

      if (Array.isArray(data)) {
        // Find specific analytics from the array
        const callsData = data.find(item => item.name === "Number of Calls by Assistants");
        const durationData = data.find(item => item.name === "Total Call Duration");
        const costData = data.find(item => item.name === "Total Spent");

        if (callsData && callsData.result && callsData.result.length > 0) {
          totalCalls = parseInt(callsData.result[0].countId) || 0;
        }

        if (durationData && durationData.result && durationData.result.length > 0) {
          totalDuration = durationData.result[0].sumDuration || 0;
        }

        if (costData && costData.result && costData.result.length > 0) {
          totalCost = costData.result[0].sumCost || 0;
        }
      }

      // Update agent with analytics data
      setAgents(prev => prev.map(agent => {
        if (agent.id === agentId) {
          const isChatAgent = (agent as any).type === 'n8n_chat' || (agent as any).type === 'retell_chat';
          return {
            ...agent,
            usage: {
              calls: totalCalls,
              // For chat agents, totalDuration holds message count; for voice agents, convert seconds to minutes
              minutes: isChatAgent ? totalDuration : Math.round(totalDuration / 60),
              lastCall: totalCalls > 0 ? 'Recently' : 'Never',
              cost: totalCost
            },
            isLoading: false
          };
        }
        return agent;
      }));

    } catch (error) {
      console.error(`Error fetching analytics for agent ${agentId}:`, error);
      
      // Update agent with error state
      setAgents(prev => prev.map(agent => {
        if (agent.id === agentId) {
          return {
            ...agent,
            usage: {
              calls: 0,
              minutes: 0,
              lastCall: 'Error',
              cost: 0
            },
            isLoading: false
          };
        }
        return agent;
      }));
    }
  };

  // Fetch call analytics (lazy loaded)
  const fetchCallAnalytics = async () => {
    try {
      setIsLoadingAnalytics(true);

      // Fetch conversations to analyze end reasons and call types
      const response = await fetch(`/api/whitelabel/analytics/conversations?period=${selectedPeriod}&limit=1000`);

      if (!response.ok) {
        console.error('Failed to fetch conversations for analytics');
        return;
      }

      const data = await response.json();
      const conversations = data.conversations || data.data || [];

      // Analyze end reasons
      const endReasonCounts = new Map<string, number>();
      const callTypeCounts = new Map<string, number>();
      let totalCost = 0;

      conversations.forEach((conv: any) => {
        // Count end reasons - improved field mapping for different providers
        let endReason = conv.endedReason || conv.outcome || conv.status || conv.end_reason || conv.endReason;

        // Only use 'unknown' if we truly have no data
        if (!endReason || endReason === '' || endReason === null || endReason === undefined) {
          endReason = 'unknown';
        }

        // Count call types - improved field mapping
        let callType = conv.type || conv.callType || conv.channel || conv.call_type || conv.direction;

        // Only use 'unknown' if we truly have no data
        if (!callType || callType === '' || callType === null || callType === undefined) {
          callType = 'unknown';
        }

        endReasonCounts.set(endReason, (endReasonCounts.get(endReason) || 0) + 1);
        callTypeCounts.set(callType, (callTypeCounts.get(callType) || 0) + 1);

        // Sum costs (with markup if pricing enabled)
        totalCost += conv.cost || 0;
      });

      const totalConversations = conversations.length;

      // Convert to arrays with percentages and format for display
      const endReasons = Array.from(endReasonCounts.entries())
        .filter(([reason, count]) => reason !== 'unknown' || count > 0) // Only show unknown if it has data
        .map(([reason, count]) => {
          // Format end reasons based on actual provider values
          let formattedReason = reason;

          // Common end reasons across providers
          if (reason === 'customer-ended-call' || reason === 'user_hangup' || reason === 'customer_hangup') {
            formattedReason = 'Customer Ended Call';
          } else if (reason === 'assistant-ended-call' || reason === 'assistant_hangup' || reason === 'bot_hangup') {
            formattedReason = 'Assistant Ended Call';
          } else if (reason === 'call_timeout' || reason === 'timeout') {
            formattedReason = 'Call Timeout';
          } else if (reason === 'max_duration_reached' || reason === 'exceeded-max-duration' || reason === 'max-duration-reached') {
            formattedReason = 'Max Duration Reached';
          } else if (reason === 'silence_timeout' || reason === 'inactivity-timeout' || reason === 'silence-timeout') {
            formattedReason = 'Silence Timeout';
          } else if (reason === 'error' || reason === 'failed' || reason === 'call_failed') {
            formattedReason = 'Error';
          } else if (reason === 'completed' || reason === 'success' || reason === 'successful') {
            formattedReason = 'Completed Successfully';
          } else if (reason.includes('pipeline-error') || reason.includes('llm-failed')) {
            formattedReason = 'AI Processing Error';
          } else if (reason.includes('voice-failed') || reason.includes('tts-failed') || reason.includes('stt-failed')) {
            formattedReason = 'Voice Processing Error';
          } else if (reason === 'unknown') {
            formattedReason = 'Unknown';
          } else {
            // Generic formatting for other reasons
            formattedReason = reason.replace(/-/g, ' ').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          }

          return {
            reason: formattedReason,
            count,
            percentage: Math.round((count / totalConversations) * 100)
          };
        }).sort((a, b) => b.count - a.count);

      const callTypes = Array.from(callTypeCounts.entries())
        .filter(([type, count]) => type !== 'unknown' || count > 0) // Only show unknown if it has data
        .map(([type, count]) => {
          // Format call types based on actual values from different providers
          let formattedType = type;

          if (type === 'webCall' || type === 'web' || type === 'web_call') {
            formattedType = 'Web Call';
          } else if (type === 'phoneCall' || type === 'phone' || type === 'phone_call') {
            formattedType = 'Phone Call';
          } else if (type === 'inboundCall' || type === 'inbound' || type === 'inbound_call') {
            formattedType = 'Inbound Call';
          } else if (type === 'outboundCall' || type === 'outbound' || type === 'outbound_call') {
            formattedType = 'Outbound Call';
          } else if (type === 'call' || type === 'voice') {
            formattedType = 'Voice Call';
          } else if (type === 'unknown') {
            formattedType = 'Unknown';
          } else {
            // Generic formatting for other types
            formattedType = type.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
          }

          return {
            type: formattedType,
            count,
            percentage: Math.round((count / totalConversations) * 100)
          };
        }).sort((a, b) => b.count - a.count);

      setCallAnalytics({
        endReasons,
        callTypes,
        totalCost,
        showPricing: showPricing
      });

    } catch (error) {
      console.error('Error fetching call analytics:', error);
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  // Refresh all data
  const refreshData = async () => {
    setIsRefreshing(true);

    // Load dashboard summary and agents list in parallel
    await Promise.all([
      fetchDashboardData(selectedPeriod),
      fetchAgents()
    ]);

    setIsRefreshing(false);
  };

  // Load data when component mounts or period changes
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      // Load dashboard summary and agents list in parallel
      await Promise.all([
        fetchDashboardData(selectedPeriod),
        fetchAgents()
      ]);

      setLoading(false);
    };

    loadData();
  }, [selectedPeriod]);

  // Check for incomplete onboarding (only for SAAS mode)
  useEffect(() => {
    const checkIncompleteOnboarding = async () => {
      console.log('🔍 HYBRID DASHBOARD - ONBOARDING CHECK - Branding state:', {
        branding: branding,
        hasPortalMode: branding?.portalMode !== undefined,
        portalMode: branding?.portalMode,
        brandingKeys: branding ? Object.keys(branding) : 'null'
      });

      // Wait for branding to be loaded
      if (!branding || !branding.portalMode) {
        console.log('⏳ HYBRID DASHBOARD - Branding not loaded yet, waiting...');
        return;
      }

      // Check for incomplete onboarding (only for SAAS mode)
      if (branding.portalMode === 'SAAS') {
        console.log('🔍 HYBRID DASHBOARD - Checking for incomplete onboarding (SAAS mode)...');
        try {
          const onboardingResponse = await fetch('/api/whitelabel/prospects/resume');
          console.log('📡 HYBRID DASHBOARD - Onboarding API response status:', onboardingResponse.status);

          if (onboardingResponse.ok) {
            const onboardingData = await onboardingResponse.json();
            console.log('📋 HYBRID DASHBOARD - Onboarding data received:', onboardingData);

            if (onboardingData.hasIncompleteOnboarding) {
              console.log('✅ HYBRID DASHBOARD - Found incomplete onboarding, showing banner');
              console.log('🔍 HYBRID DASHBOARD - Setting state - prospect data:', onboardingData.prospect);
              setIncompleteOnboarding(onboardingData.prospect);
              setShowOnboardingBanner(true);
              console.log('🔍 HYBRID DASHBOARD - State set - showOnboardingBanner: true');
            } else {
              console.log('❌ HYBRID DASHBOARD - No incomplete onboarding found');
            }
          } else {
            console.log('❌ HYBRID DASHBOARD - Onboarding API call failed:', onboardingResponse.status, onboardingResponse.statusText);
          }
        } catch (error) {
          console.error('HYBRID DASHBOARD - Error checking incomplete onboarding:', error);
        }
      } else {
        console.log('ℹ️ HYBRID DASHBOARD - Not SAAS mode, skipping onboarding check. Portal mode:', branding.portalMode);
      }
    };

    checkIncompleteOnboarding();
  }, [branding?.portalMode]); // Only depend on portalMode to avoid infinite loop

  // Separate useEffect for deployment banner that waits for branding to be fully loaded
  useEffect(() => {
    const checkDeploymentBanner = () => {
      console.log('🔍 HYBRID DASHBOARD - DEPLOYMENT BANNER CHECK - Current state:', {
        deploymentStatus,
        customerId,
        hasProspectEntry,
        brandingPortalMode: branding.portalMode,
        brandingSaasEnabled: branding.saasOnboardingEnabled,
        brandingBusinessName: branding.businessName
      });

      // Wait for branding to be loaded (not in default state)
      if (!branding || !branding.businessName || branding.businessName === 'Knotie AI') {
        console.log('⏳ HYBRID DASHBOARD - Branding not fully loaded yet, waiting for deployment banner check...');
        return;
      }

      // Wait for customer data to be loaded
      if (!customerId || !deploymentStatus) {
        console.log('⏳ HYBRID DASHBOARD - Customer data not loaded yet, waiting for deployment banner check...');
        return;
      }

      console.log('🚀 HYBRID DASHBOARD - DEPLOYMENT BANNER CHECK (After Branding Loaded):', {
        deploymentStatus,
        portalMode: branding.portalMode,
        saasOnboardingEnabled: branding.saasOnboardingEnabled,
        hasProspectEntry,
        customerId
      });

      // Show deployment banner logic:
      // 1. Always show for statuses other than 'not_started'
      // 2. For 'not_started': only show when partner has SaaS mode enabled AND customer has prospect entry
      if (deploymentStatus !== 'not_started') {
        console.log('✅ HYBRID DASHBOARD - Showing deployment banner for status:', deploymentStatus);
        setShowDeploymentBanner(true);
      } else if (deploymentStatus === 'not_started' && branding.portalMode === 'SAAS' && branding.saasOnboardingEnabled && hasProspectEntry) {
        console.log('✅ HYBRID DASHBOARD - Showing deployment banner for not_started status - Partner has SaaS enabled and customer has prospect entry');
        setShowDeploymentBanner(true);
      } else {
        console.log('❌ HYBRID DASHBOARD - Not showing deployment banner. Status:', deploymentStatus, 'Partner portal mode:', branding.portalMode, 'SaaS enabled:', branding.saasOnboardingEnabled, 'Has prospect:', hasProspectEntry);
        setShowDeploymentBanner(false);
      }
    };

    checkDeploymentBanner();
  }, [branding?.portalMode, branding?.saasOnboardingEnabled, branding?.businessName, deploymentStatus, customerId, hasProspectEntry]);

  // Format duration from seconds to readable format
  const formatDuration = (seconds: number) => {
    if (seconds === 0) return '0s';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.round(seconds % 60); // Remove decimal places

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  };



  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-10 h-10 border-4 border-gray-600 border-t-blue-500 rounded-full"></div>
      </div>
    );
  }

  // Debug banner rendering conditions
  console.log('🔍 HYBRID DASHBOARD - BANNER RENDER CHECK:', {
    showOnboardingBanner,
    hasIncompleteOnboarding: !!incompleteOnboarding,
    portalMode: branding.portalMode,
    shouldShowBanner: showOnboardingBanner && incompleteOnboarding && branding.portalMode === 'SAAS'
  });

  // Debug deployment banner rendering conditions
  console.log('🔍 HYBRID DASHBOARD - DEPLOYMENT BANNER RENDER CHECK:', {
    showDeploymentBanner,
    deploymentStatus,
    shouldShowDeploymentBanner: showDeploymentBanner
  });

  return (
    <div>
      {/* Incomplete Onboarding Banner - Only for SAAS mode */}
      {showOnboardingBanner && incompleteOnboarding && branding.portalMode === 'SAAS' && (
        <div className="mb-6">
          <div
            className="relative rounded-lg p-6 border-2"
            style={{
              background: `linear-gradient(135deg, ${branding.primaryColor}10, ${branding.secondaryColor}10)`,
              borderColor: branding.primaryColor + '40'
            }}
          >
            {/* Close button */}
            <button
              onClick={() => setShowOnboardingBanner(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <FiX className="w-5 h-5" />
            </button>

            <div className="flex items-start gap-4">
              <div
                className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center"
                style={{ backgroundColor: branding.primaryColor + '20' }}
              >
                <FiPhoneCall className="w-6 h-6" style={{ color: branding.primaryColor }} />
              </div>

              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">
                  Continue Your AI Assistant Setup
                </h3>
                <p className="text-gray-300 mb-4">
                  You have an incomplete onboarding for "{incompleteOnboarding.businessName || 'your AI assistant'}".
                  {incompleteOnboarding.currentStep === 3 ? (
                    <>Since you're already logged in, we'll continue from step 4 ({incompleteOnboarding.progressPercentage}% complete).</>
                  ) : (
                    <>You're currently at step {incompleteOnboarding.currentStep} of 9 ({incompleteOnboarding.progressPercentage}% complete).</>
                  )}
                </p>

                <div className="flex items-center gap-4">
                  <a
                    href={incompleteOnboarding.resumeUrl}
                    className="inline-flex items-center px-4 py-2 rounded-lg font-medium text-white transition-all hover:shadow-lg"
                    style={{
                      background: `linear-gradient(135deg, ${branding.primaryColor}, ${branding.secondaryColor})`
                    }}
                  >
                    Continue Setup
                    <FiArrowRight className="ml-2 w-4 h-4" />
                  </a>

                  <div className="flex items-center text-sm text-gray-400">
                    <div
                      className="w-32 h-2 bg-gray-700 rounded-full mr-3"
                    >
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${incompleteOnboarding.progressPercentage}%`,
                          background: `linear-gradient(135deg, ${branding.primaryColor}, ${branding.secondaryColor})`
                        }}
                      />
                    </div>
                    {incompleteOnboarding.progressPercentage}% complete
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deployment Status Banner - Shows for all portal modes (same dashboard experience) */}
      {showDeploymentBanner && (
        <div className="mb-6">
          <DeploymentStatusBanner
            deploymentStatus={deploymentStatus}
            branding={branding}
            onDismiss={() => setShowDeploymentBanner(false)}
            assignedPhoneNumber={assignedPhoneNumber || undefined}
            onTryAgent={handleTryAgent}
            onDeployForBusiness={handleDeployForBusiness}
            onSetupCallForwarding={handleSetupCallForwarding}
          />
        </div>
      )}

      {/* Welcome Section */}
      <div className="mb-8">
        <div className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-lg p-6 mb-6`}
             style={{ borderColor: `${branding.primaryColor}40` }}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
            <div>
              <h2 className="text-2xl font-bold mb-2" style={{ color: branding.primaryColor }}>
                Welcome to {branding.businessName} AI Dashboard
              </h2>
              <p className="text-gray-400">
                Monitor your AI agents, track performance, and analyze conversations.
              </p>
            </div>
            <div className="mt-4 md:mt-0 flex items-center gap-4">
              {/* Notification Bell */}
              <NotificationBell userId={customerId} userType="customer" />
              
              {/* Period Selection - COMMENTED OUT: Filter not functional, shows same data regardless of selection */}
              {/* TODO: Uncomment when filter functionality is implemented */}
              {/*
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value as 'day' | 'week' | 'month')}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="day">Last 24 hours</option>
                <option value="week">Last 7 days</option>
                <option value="month">Last 30 days</option>
              </select>
              */}

              {/* Refresh Button */}
              <button
                onClick={refreshData}
                disabled={isRefreshing}
                className="p-2 bg-gray-800 border border-gray-700 rounded-lg text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
                title="Refresh data"
              >
                <FiRefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              

            </div>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-white mb-4" style={{ color: branding.primaryColor }}>Performance Overview</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
          <div className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-lg p-4 md:p-6`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-400 text-sm">Total Conversations</h3>
              <div className="p-1.5 md:p-2 rounded-full" style={{ backgroundColor: `${branding.primaryColor}20` }}>
                <FiActivity className="w-4 h-4 md:w-5 md:h-5" style={{ color: branding.primaryColor }} />
              </div>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-white">
              {dashboardData?.summary.totalConversations ?? dashboardData?.summary.totalCalls ?? 0}
            </p>
            <p className="text-xs md:text-sm text-gray-400 mt-1">Calls + Chats across all agents</p>
          </div>

          <div className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-lg p-4 md:p-6`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-400 text-sm">Total Duration</h3>
              <div className="p-1.5 md:p-2 rounded-full" style={{ backgroundColor: `${branding.primaryColor}20` }}>
                <FiClock className="w-4 h-4 md:w-5 md:h-5" style={{ color: branding.primaryColor }} />
              </div>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-white">
              {dashboardData ? formatDuration(dashboardData.summary.totalDuration) : '0m'}
            </p>
            <p className="text-xs md:text-sm text-gray-400 mt-1">Talk time</p>
          </div>

          <div className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-lg p-4 md:p-6`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-400 text-sm">Active Agents</h3>
              <div className="p-1.5 md:p-2 rounded-full" style={{ backgroundColor: `${branding.primaryColor}20` }}>
                <FiUsers className="w-4 h-4 md:w-5 md:h-5" style={{ color: branding.primaryColor }} />
              </div>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-white">{agents.length || dashboardData?.agentCount || 0}</p>
            <p className="text-xs md:text-sm text-gray-400 mt-1">Deployed and active</p>
          </div>

          <div className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-lg p-4 md:p-6`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-400 text-sm">Avg Duration</h3>
              <div className="p-1.5 md:p-2 rounded-full" style={{ backgroundColor: `${branding.primaryColor}20` }}>
                <FiActivity className="w-4 h-4 md:w-5 md:h-5" style={{ color: branding.primaryColor }} />
              </div>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-white">
              {dashboardData ? formatDuration(dashboardData.summary.averageCallDuration) : '0m'}
            </p>
            <p className="text-xs md:text-sm text-gray-400 mt-1">Per call</p>
          </div>
        </div>

        {/* Call Volume Chart */}
        <div className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-lg p-4 md:p-6`}>
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <h3 className="text-base md:text-lg font-semibold text-white">Call Volume Trend</h3>
            <div className="text-xs md:text-sm text-gray-400">
              {selectedPeriod === 'day' ? 'Last 24 hours' : 
               selectedPeriod === 'week' ? 'Last 7 days' : 'Last 30 days'}
            </div>
          </div>
          <CallVolumeChart data={dashboardData?.callTrend || []} />
        </div>
      </div>

      {/* AI Agents */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <h2 className="text-lg md:text-xl font-bold text-white" style={{ color: branding.primaryColor }}>Your AI Agents</h2>
          <Link href="/whitelabel/conversations" className="text-xs md:text-sm hover:underline" style={{ color: branding.primaryColor }}>
            View conversations
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {agents.length > 0 ? (
            agents.map((agent) => {
              const isChatAgent = (agent as any).type === 'n8n_chat' || (agent as any).type === 'retell_chat';

              return (
              <div
                key={agent.id}
                className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-lg p-4 md:p-6 hover:border-gray-600 transition-colors`}
              >
                <div className="flex items-start justify-between mb-3 md:mb-4">
                  <div>
                    <h3 className="text-base md:text-lg font-semibold text-white">{agent.name}</h3>
                    <p className="text-xs md:text-sm text-gray-400">{isChatAgent ? 'Chat AI Assistant' : 'AI Voice Assistant'}</p>
                  </div>
                  <div
                    className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center"
                    style={{
                      background: `linear-gradient(to right, ${branding.primaryColor}, ${branding.secondaryColor})`,
                      opacity: 0.8
                    }}
                  >
                    {agent.isLoading ? (
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                    ) : isChatAgent ? (
                      <FiMessageSquare className="w-4 h-4 md:w-5 md:h-5 text-white" />
                    ) : (
                      <FiPhoneCall className="w-4 h-4 md:w-5 md:h-5 text-white" />
                    )}
                  </div>
                </div>
                <p className="text-gray-300 text-xs md:text-sm mb-3 md:mb-4">{agent.description}</p>
                <div className="grid grid-cols-3 gap-1 md:gap-2 pt-2 md:pt-3 border-t border-gray-700">
                  <div className="text-center">
                    <p className="text-base md:text-lg font-semibold text-white">
                      {agent.isLoading ? '...' : agent.usage?.calls || 0}
                    </p>
                    <p className="text-[10px] md:text-xs text-gray-400">{isChatAgent ? 'Chats' : 'Calls'}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-base md:text-lg font-semibold text-white">
                      {agent.isLoading ? '...' : agent.usage?.minutes || 0}
                    </p>
                    <p className="text-[10px] md:text-xs text-gray-400">{isChatAgent ? 'Messages' : 'Minutes'}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs md:text-sm font-semibold text-white">
                      {agent.isLoading ? '...' : agent.usage?.lastCall || 'Never'}
                    </p>
                    <p className="text-[10px] md:text-xs text-gray-400">{isChatAgent ? 'Last Chat' : 'Last Call'}</p>
                  </div>
                </div>

                {/* Show cost if pricing is enabled and available */}
                {showPricing && agent.usage?.cost !== undefined && agent.usage.cost > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-700">
                    <div className="text-center">
                      <p className="text-sm font-semibold text-white">
                        ${agent.usage.cost.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-gray-400">Total Cost</p>
                    </div>
                  </div>
                )}

                {/* Try Agent Button - hidden for chat agents */}
                {!isChatAgent && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  {(agent as any).type === 'ghl' || (agent as any).type === 'knova' ? (
                    <div className="text-center py-3">
                      <p className="text-sm text-gray-400 mb-2">
                        Live testing for this agent type is coming soon!
                      </p>
                      <button
                        disabled
                        className="w-full py-2 px-4 rounded-lg font-medium bg-gray-600 text-gray-400 cursor-not-allowed"
                      >
                        <div className="flex items-center justify-center gap-2">
                          <FiPhoneCall className="w-4 h-4" />
                          Try Agent (Coming Soon)
                        </div>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        console.log('Try Agent button clicked for:', agent.name, 'Type:', (agent as any).type);
                        console.log('Full agent object:', agent);
                        const agentType = (agent as any).type || 'vapi';
                        const phoneNumber = (agent as any).phoneNumber || null;
                        console.log('Determined agentType:', agentType, 'phoneNumber:', phoneNumber);
                        handleAgentTileClick(agent.id, agent.name, agentType, phoneNumber);
                      }}
                      disabled={aiCreditsEnabled && currentCredits <= 0}
                      className={`w-full py-2 px-4 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-opacity-50 ${
                        aiCreditsEnabled && currentCredits <= 0
                          ? 'cursor-not-allowed'
                          : 'hover:scale-105'
                      }`}
                      style={aiCreditsEnabled && currentCredits <= 0 ? {
                        backgroundColor: '#4b5563',
                        color: '#9ca3af',
                        border: `1px solid ${branding.primaryColor}40`
                      } : {
                        background: `linear-gradient(to right, ${branding.primaryColor}, ${branding.secondaryColor})`,
                        color: 'white'
                      }}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <FiPhoneCall className="w-4 h-4" />
                        {aiCreditsEnabled && currentCredits <= 0 ? 'No Credits' : 'Try Agent'}
                      </div>
                    </button>
                  )}
                </div>
                )}
              </div>
              );
            })
          ) : (
            <div className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-lg p-4 md:p-6 col-span-2`}>
              <div className="flex flex-col items-center justify-center py-6 md:py-8 text-center">
                <div
                  className="w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center mb-3 md:mb-4"
                  style={{ backgroundColor: `${branding.primaryColor}20` }}
                >
                  <FiPhoneCall className="w-6 h-6 md:w-8 md:h-8" style={{ color: branding.primaryColor }} />
                </div>
                <h3 className="text-lg md:text-xl font-semibold text-white mb-2">No AI Agents Yet</h3>
                <p className="text-xs md:text-sm text-gray-400 max-w-md">
                  Your AI agents will appear here once they are set up.
                  Contact your account manager to get started.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <h2 className="text-lg md:text-xl font-bold text-white" style={{ color: branding.primaryColor }}>Recent Activity</h2>
          <Link href="/whitelabel/conversations" className="text-xs md:text-sm hover:underline" style={{ color: branding.primaryColor }}>
            View all conversations
          </Link>
        </div>

        <div className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-lg overflow-hidden`}>
          {dashboardData && dashboardData.recentCalls.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="px-3 md:px-6 py-2 md:py-3 text-left text-[10px] md:text-xs font-medium text-gray-400 uppercase tracking-wider">Agent</th>
                    <th className="px-3 md:px-6 py-2 md:py-3 text-left text-[10px] md:text-xs font-medium text-gray-400 uppercase tracking-wider">Duration</th>
                    <th className="px-3 md:px-6 py-2 md:py-3 text-left text-[10px] md:text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-3 md:px-6 py-2 md:py-3 text-left text-[10px] md:text-xs font-medium text-gray-400 uppercase tracking-wider">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {dashboardData.recentCalls.map((call) => (
                    <tr key={call.id} className="hover:bg-gray-750">
                      <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm text-white">
                        {call.agent}
                      </td>
                      <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm text-gray-300">
                        {call.duration}
                      </td>
                      <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap">
                        <span className={`px-1.5 md:px-2 py-0.5 inline-flex text-[10px] md:text-xs leading-5 font-semibold rounded-full ${
                          call.status === 'Completed' ? 'bg-green-100 text-green-800' :
                          call.status === 'In Progress' ? 'bg-yellow-100 text-amber-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {call.status}
                        </span>
                      </td>
                      <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm text-gray-300">
                        {call.time}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 md:py-12 text-center">
              <div
                className="w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center mb-3 md:mb-4"
                style={{ backgroundColor: `${branding.primaryColor}20` }}
              >
                <FiActivity className="w-6 h-6 md:w-8 md:h-8" style={{ color: branding.primaryColor }} />
              </div>
              <h3 className="text-lg md:text-xl font-semibold text-white mb-2">No Recent Calls</h3>
              <p className="text-xs md:text-sm text-gray-400 max-w-md px-4">
                Your recent call activity will appear here once your AI voice agents start handling calls.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Call Analytics Section - Lazy Loaded */}
      {/* TODO: IMPROVEMENT NEEDED - This section should be calculated using worker/scheduler for better performance */}
      {/* Currently processes conversation history on-demand which could be slow for large datasets */}
      {/* Future: Pre-calculate analytics and serve from database */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <h2 className="text-lg md:text-xl font-bold text-white" style={{ color: branding.primaryColor }}>Call Analytics</h2>
          {!callAnalytics && !isLoadingAnalytics && (
            <button
              onClick={fetchCallAnalytics}
              className="text-xs md:text-sm px-3 py-1 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 transition-colors"
            >
              Load Analytics
            </button>
          )}
        </div>

        {isLoadingAnalytics ? (
          <div className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-lg p-6`}>
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-gray-600 border-t-blue-500 rounded-full mr-3"></div>
              <span className="text-gray-400">Analyzing conversation data...</span>
            </div>
          </div>
        ) : callAnalytics ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            {/* End Reasons Chart */}
            <div className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-lg p-4 md:p-6`}>
              <h3 className="text-base md:text-lg font-semibold text-white mb-4">Call End Reasons</h3>
              <div className="space-y-3">
                {callAnalytics.endReasons.slice(0, 5).map((reason, index) => (
                  <div key={reason.reason} className="flex items-center justify-between">
                    <div className="flex items-center flex-1">
                      <div
                        className="w-3 h-3 rounded-full mr-3"
                        style={{
                          backgroundColor: `hsl(${(index * 60) % 360}, 70%, 60%)`
                        }}
                      />
                      <span className="text-sm text-gray-300 flex-1">{reason.reason}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-white">{reason.count}</span>
                      <span className="text-xs text-gray-400">({reason.percentage}%)</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Simple bar chart */}
              <div className="mt-4 space-y-2">
                {callAnalytics.endReasons.slice(0, 5).map((reason, index) => (
                  <div key={`bar-${reason.reason}`} className="flex items-center">
                    <div className="w-20 text-xs text-gray-400 truncate">{reason.reason}</div>
                    <div className="flex-1 mx-2 bg-gray-700 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all duration-500"
                        style={{
                          width: `${reason.percentage}%`,
                          backgroundColor: `hsl(${(index * 60) % 360}, 70%, 60%)`
                        }}
                      />
                    </div>
                    <div className="w-8 text-xs text-gray-400 text-right">{reason.percentage}%</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Call Types Chart */}
            <div className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-lg p-4 md:p-6`}>
              <h3 className="text-base md:text-lg font-semibold text-white mb-4">Call Types</h3>
              <div className="space-y-3">
                {callAnalytics.callTypes.map((type, index) => (
                  <div key={type.type} className="flex items-center justify-between">
                    <div className="flex items-center flex-1">
                      <div
                        className="w-3 h-3 rounded-full mr-3"
                        style={{
                          backgroundColor: `hsl(${(index * 120) % 360}, 70%, 60%)`
                        }}
                      />
                      <span className="text-sm text-gray-300 flex-1">{type.type}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-white">{type.count}</span>
                      <span className="text-xs text-gray-400">({type.percentage}%)</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Simple bar chart */}
              <div className="mt-4 space-y-2">
                {callAnalytics.callTypes.map((type, index) => (
                  <div key={`bar-${type.type}`} className="flex items-center">
                    <div className="w-20 text-xs text-gray-400 truncate">{type.type}</div>
                    <div className="flex-1 mx-2 bg-gray-700 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all duration-500"
                        style={{
                          width: `${type.percentage}%`,
                          backgroundColor: `hsl(${(index * 120) % 360}, 70%, 60%)`
                        }}
                      />
                    </div>
                    <div className="w-8 text-xs text-gray-400 text-right">{type.percentage}%</div>
                  </div>
                ))}
              </div>

              {/* Cost information if pricing is enabled */}
              {callAnalytics.showPricing && callAnalytics.totalCost && callAnalytics.totalCost > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Total Cost</span>
                    <span className="text-lg font-semibold text-white">
                      ${callAnalytics.totalCost.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-lg p-6`}>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div
                className="w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center mb-3 md:mb-4"
                style={{ backgroundColor: `${branding.primaryColor}20` }}
              >
                <FiBarChart2 className="w-6 h-6 md:w-8 md:h-8" style={{ color: branding.primaryColor }} />
              </div>
              <h3 className="text-lg md:text-xl font-semibold text-white mb-2">Call Analytics Available</h3>
              <p className="text-xs md:text-sm text-gray-400 max-w-md px-4 mb-4">
                Click "Load Analytics" to see detailed insights about call end reasons and call types.
                This analysis is performed on your conversation history.
              </p>
              <button
                onClick={fetchCallAnalytics}
                className="px-4 py-2 rounded-lg text-white transition-all hover:opacity-90"
                style={{
                  background: `linear-gradient(to right, ${branding.primaryColor}, ${branding.secondaryColor || branding.primaryColor})`,
                  boxShadow: `0 4px 12px ${branding.primaryColor}30`
                }}
              >
                Load Call Analytics
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-lg md:text-xl font-bold text-white mb-3 md:mb-4" style={{ color: branding.primaryColor }}>Quick Links</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          <Link href="/whitelabel/conversations">
            <div className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-lg p-4 md:p-6 hover:border-gray-600 transition-colors h-full`}>
              <div className="flex items-center mb-2 md:mb-3">
                <div className="p-1.5 md:p-2 rounded-full mr-2 md:mr-3" style={{ backgroundColor: `${branding.primaryColor}20` }}>
                  <FiFileText className="w-4 h-4 md:w-5 md:h-5" style={{ color: branding.primaryColor }} />
                </div>
                <h3 className="text-sm md:text-base font-semibold text-white">Conversations</h3>
              </div>
              <p className="text-xs md:text-sm text-gray-400">
                Browse and analyze all conversations handled by your AI agents.
              </p>
            </div>
          </Link>

          <Link href="/whitelabel/settings">
            <div className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-lg p-4 md:p-6 hover:border-gray-600 transition-colors h-full`}>
              <div className="flex items-center mb-2 md:mb-3">
                <div className="p-1.5 md:p-2 rounded-full mr-2 md:mr-3" style={{ backgroundColor: `${branding.primaryColor}20` }}>
                  <FiGlobe className="w-4 h-4 md:w-5 md:h-5" style={{ color: branding.primaryColor }} />
                </div>
                <h3 className="text-sm md:text-base font-semibold text-white">Settings</h3>
              </div>
              <p className="text-xs md:text-sm text-gray-400">
                Manage your account settings and preferences.
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* Test Confirmation Modal */}
      {confirmModalState.isOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg max-w-md w-full border border-gray-800">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-800">
              <h2 className="text-xl font-semibold text-white">Test Voice Agent</h2>
              <p className="text-sm text-gray-400 mt-1">
                {confirmModalState.agentName}
              </p>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="text-center mb-6">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{
                    background: `linear-gradient(to right, ${branding.primaryColor}, ${branding.secondaryColor})`
                  }}
                >
                  <FiPhoneCall className="w-8 h-8 text-white" />
                </div>
                <p className="text-gray-300 mb-2">
                  Would you like to test this voice agent?
                </p>
                <p className="text-sm text-gray-400">
                  This will start a live voice conversation with the AI agent.
                </p>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleConfirmModalClose}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (confirmModalState.agentId && confirmModalState.agentName && confirmModalState.agentType) {
                      handleTestAgent(confirmModalState.agentId, confirmModalState.agentName, confirmModalState.agentType, confirmModalState.phoneNumber);
                    }
                  }}
                  className="flex-1 px-4 py-2 text-white rounded-lg transition-colors font-medium"
                  style={{
                    background: `linear-gradient(to right, ${branding.primaryColor}, ${branding.secondaryColor})`
                  }}
                >
                  Start Test
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Agent Test Modal */}
      <UnifiedAgentTestModal
        isOpen={testModalState.isOpen}
        onClose={handleTestModalClose}
        agentId={testModalState.agentId || ''}
        agentName={testModalState.agentName || 'Agent'}
        agentType={testModalState.agentType || 'vapi'}
        phoneNumber={testModalState.phoneNumber}
        onDeploymentCompleted={handleDeploymentCompleted}
      />

      {/* Call Forwarding Modal */}
      <CallForwardingModal
        isOpen={showCallForwardingModal}
        onClose={() => {
          console.log('🔧 HYBRID - Closing call forwarding modal');
          setShowCallForwardingModal(false);
          setModalPhoneNumber(null);
        }}
        assignedPhoneNumber={(() => {
          const phoneToPass = modalPhoneNumber || assignedPhoneNumber || '';
          console.log('🔧 HYBRID - Passing phone number to modal:', {
            modalPhoneNumber,
            assignedPhoneNumber,
            finalPhoneNumber: phoneToPass,
            showCallForwardingModal
          });
          return phoneToPass;
        })()}
      />
    </div>
  );
};

export default HybridAnalyticsServiceDashboard;
