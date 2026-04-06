'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { usePartnerBranding } from '@/lib/partnerBranding';
import { PortalTheme, getThemeConfig } from '@/lib/portalThemes';
import { loadLanguageDataWithLocale, getTranslatedText, type LanguageData, type SupportedLanguage } from '@/lib/languages';
import WhitelabelLayout from '@/components/whitelabel/WhitelabelLayout';
import CallVolumeChart from '@/components/whitelabel/CallVolumeChart';
import NotificationBell from '@/components/notifications/NotificationBell';
import HybridAnalyticsServiceDashboard from '@/components/whitelabel/HybridAnalyticsServiceDashboard';
import PaymentMethodsManager from '@/components/whitelabel/PaymentMethodsManager';
import UnifiedAgentTestModal from '@/components/whitelabel/UnifiedAgentTestModal';
import PaymentSetupModal from '@/components/whitelabel/PaymentSetupModal';
import DeploymentStatusBanner from '@/components/whitelabel/DeploymentStatusBanner';
import CallForwardingModal from '@/components/whitelabel/CallForwardingModal';
import { FiPhoneCall, FiClock, FiUsers, FiBarChart2, FiActivity, FiMessageSquare, FiArrowRight, FiX, FiPlay, FiCreditCard, FiKey } from 'react-icons/fi';

// Check if we should use analytics service
const USE_ANALYTICS_SERVICE = process.env.NEXT_PUBLIC_USE_ANALYTICS_SERVICE_WHITELABEL_DASHBOARD === 'true';
const USE_ANALYTICS_SERVICE_CONVERSATIONS = process.env.NEXT_PUBLIC_USE_ANALYTICS_SERVICE_WHITELABEL_CONVERSATIONS === 'true';

export default function WhiteLabelDashboardPage() {
  // All hooks must be called at the top level
  const { branding } = usePartnerBranding();

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
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<any[]>([]);
  const [recentCalls, setRecentCalls] = useState<any[]>([]);
  const [callTrend, setCallTrend] = useState<{ day: string; calls: number }[]>([]);
  const [customerId, setCustomerId] = useState<string>('');
  const [incompleteOnboarding, setIncompleteOnboarding] = useState<any>(null);
  const [showOnboardingBanner, setShowOnboardingBanner] = useState(false);
  const [needsPayment, setNeedsPayment] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [deploymentStatus, setDeploymentStatus] = useState<string>('not_started');
  const [showDeploymentBanner, setShowDeploymentBanner] = useState(false);
  const [phoneNumbers, setPhoneNumbers] = useState<any[]>([]);
  const [assignedPhoneNumber, setAssignedPhoneNumber] = useState<string | null>(null);
  const [hasProspectEntry, setHasProspectEntry] = useState<boolean>(false);
  const [showCallForwardingModal, setShowCallForwardingModal] = useState(false);
  const [modalPhoneNumber, setModalPhoneNumber] = useState<string | null>(null);
  const [testModalState, setTestModalState] = useState<{
    isOpen: boolean;
    agentId?: string;
    agentName?: string;
    agentType?: 'vapi' | 'retell' | 'ultravox' | 'ghl' | 'knova' | 'elevenlabs' | 'n8n_chat';
    phoneNumber?: string | null;
  }>({ isOpen: false });

  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean;
    agentId?: string;
    agentName?: string;
    agentType?: 'vapi' | 'retell' | 'ultravox' | 'ghl' | 'knova' | 'elevenlabs';
    phoneNumber?: string | null;
  }>({ isOpen: false });

  // AI Gateway feature flag
  const [aiGatewayEnabled, setAiGatewayEnabled] = useState(false);

  // Language state
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>('en');
  const [languageData, setLanguageData] = useState<LanguageData | null>(null);
  const [languageLoaded, setLanguageLoaded] = useState(false);

  // Get theme config from branding theme preference
  const theme = (branding.themePreference as PortalTheme) || PortalTheme.MODERN;
  const themeConfig = getThemeConfig(theme);

  // Helper function for translations
  const getTranslation = (path: string, fallback?: string) => {
    if (!languageData) return fallback || path;
    return getTranslatedText(
      languageData,
      path,
      fallback,
      branding?.businessName,
      branding?.translatedTexts,
      selectedLanguage
    );
  };

  // Handle agent tile click - show confirmation (only for voice agents)
  const handleAgentTileClick = (agentId: string, agentName: string, agentType: 'vapi' | 'retell' | 'ultravox' | 'ghl' | 'knova' | 'elevenlabs', phoneNumber?: string | null) => {
    console.log('Agent tile clicked:', { agentId, agentName, agentType, phoneNumber });
    setConfirmModalState({
      isOpen: true,
      agentId,
      agentName,
      agentType,
      phoneNumber
    });
  };

  // Handle test agent confirmation
  const handleTestAgent = (agentId: string, agentName: string, agentType: 'vapi' | 'retell' | 'ultravox' | 'ghl' | 'knova' | 'elevenlabs' | 'n8n_chat', phoneNumber?: string | null) => {
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
    console.log('🎉 Deployment marked as completed, refreshing status...');

    // Refresh deployment status
    try {
      const response = await fetch('/api/whitelabel/auth/me');
      if (response.ok) {
        const data = await response.json();
        if (data.customer) {
          const deployStatus = data.customer.deploymentStatus || 'not_started';
          console.log('🎉 Updated deployment status:', deployStatus);
          setDeploymentStatus(deployStatus);
        }
      }
    } catch (error) {
      console.error('Error refreshing deployment status:', error);
    }
  };

  // Handle deployment banner actions
  const handleTryAgent = () => {
    console.log('🎯 handleTryAgent called');
    console.log('🎯 Current assignedPhoneNumber state:', assignedPhoneNumber);
    console.log('🎯 hasProspectEntry:', hasProspectEntry);

    // Find the first available agent for testing (now includes Knova agents)
    const availableAgent = agents.find(agent =>
      agent.type !== 'ghl'
    );

    if (availableAgent) {
      console.log('🎯 Available agent found:', availableAgent.name);
      console.log('🎯 Passing phone number to modal:', assignedPhoneNumber);

      // Use assignedPhoneNumber from state (from prospect entry) instead of agent.phoneNumber
      handleAgentTileClick(
        availableAgent.id,
        availableAgent.name,
        availableAgent.type,
        assignedPhoneNumber
      );
    } else {
      showToast('No agents available for testing at the moment.', 'info');
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
    console.log('🔧 Setup call forwarding clicked, current phone number:', assignedPhoneNumber);
    console.log('🔧 Current modalPhoneNumber:', modalPhoneNumber);
    console.log('🔧 Current deploymentStatus:', deploymentStatus);

    // Ensure we have the latest phone number before opening modal
    let phoneNumberToUse = assignedPhoneNumber;
    if (!assignedPhoneNumber) {
      console.log('📞 No phone number in state, fetching...');
      phoneNumberToUse = await fetchAssignedPhoneNumber();
    }

    console.log('🔧 Opening call forwarding modal with phone number:', phoneNumberToUse);
    console.log('🔧 Phone number type:', typeof phoneNumberToUse);
    console.log('🔧 Phone number truthy:', !!phoneNumberToUse);

    setModalPhoneNumber(phoneNumberToUse);
    setShowCallForwardingModal(true);

    // Additional debugging after state updates
    setTimeout(() => {
      console.log('🔧 After state update - modalPhoneNumber:', modalPhoneNumber);
      console.log('🔧 After state update - assignedPhoneNumber:', assignedPhoneNumber);
    }, 100);
  };

  const fetchAssignedPhoneNumber = async (): Promise<string | null> => {
    try {
      console.log('🔍 Fetching assigned phone number from PhoneNumber table...');

      // Fetch from phone numbers table
      const response = await fetch('/api/whitelabel/phone-numbers');
      console.log('📞 Phone numbers API response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('📞 Phone numbers API data:', data);

        if (data.success && data.data && data.data.phoneNumbers && data.data.phoneNumbers.length > 0) {
          // Get the first assigned phone number
          const phoneNumber = data.data.phoneNumbers[0];
          console.log('✅ Setting assigned phone number:', phoneNumber.phoneNumber);
          setAssignedPhoneNumber(phoneNumber.phoneNumber);
          console.log('✅ State updated, current assignedPhoneNumber:', phoneNumber.phoneNumber);
          return phoneNumber.phoneNumber;
        } else {
          console.log('❌ No phone numbers found in response');
          setAssignedPhoneNumber(null);
          console.log('✅ State updated, assignedPhoneNumber set to null');
          return null;
        }
      } else {
        console.error('❌ Phone numbers API failed with status:', response.status);
        const errorText = await response.text();
        console.error('❌ Error response:', errorText);
        setAssignedPhoneNumber(null);
        return null;
      }
    } catch (error) {
      console.error('❌ Error fetching phone number:', error);
      setAssignedPhoneNumber(null);
      return null;
    }
  };

  const checkProspectEntry = async (customerId: string): Promise<boolean> => {
    try {
      console.log('🔍 Checking for prospect entry for customer:', customerId);
      const response = await fetch('/api/whitelabel/prospects/check');

      if (response.ok) {
        const data = await response.json();
        console.log('📋 Prospect check response:', data);

        const hasProspect = data.success && data.hasProspectEntry;
        console.log('✅ Customer has prospect entry:', hasProspect);
        return hasProspect;
      } else {
        console.log('❌ Prospect check failed:', response.status);
        return false;
      }
    } catch (error) {
      console.error('❌ Error checking prospect entry:', error);
      return false;
    }
  };

  // Load language data
  useEffect(() => {
    const loadLanguageData = async () => {
      if (!branding || languageLoaded) return;
      try {
        const { languageData: data, selectedLanguage: lang } = await loadLanguageDataWithLocale(
          branding.basicPortalLanguage
        );
        setLanguageData(data);
        setSelectedLanguage(lang);
        setLanguageLoaded(true);
      } catch (error) {
        console.error('Failed to load language:', error);
      }
    };
    loadLanguageData();
  }, [branding, languageLoaded]);

  // Fetch agents and recent calls on page load
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch agents
        const agentsResponse = await fetch('/api/whitelabel/agents');

        if (!agentsResponse.ok) {
          throw new Error('Failed to fetch agents');
        }

        const agentsData = await agentsResponse.json();

        // Fetch customer info to get customer ID
        const customerResponse = await fetch('/api/whitelabel/auth/me');

        if (!customerResponse.ok) {
          throw new Error('Failed to fetch customer info');
        }

        const customerData = await customerResponse.json();
        console.log('🔍 CUSTOMER DATA DEBUG:', {
          hasCustomer: !!customerData.customer,
          customerId: customerData.customer?.id,
          customerEmail: customerData.customer?.email,
          deploymentStatus: customerData.customer?.deploymentStatus,
          deploymentRequestedAt: customerData.customer?.deploymentRequestedAt,
          subscription: customerData.subscription,
          isTrialExpired: customerData.subscription?.isTrialExpired,
          allCustomerFields: customerData.customer ? Object.keys(customerData.customer) : 'no customer'
        });

        const customerIdValue = customerData.customer?.id;
        setCustomerId(customerIdValue || '');

        // Fetch customer features (AI Gateway flag, etc.)
        try {
          const featuresResponse = await fetch('/api/whitelabel/customer/features');
          if (featuresResponse.ok) {
            const featuresData = await featuresResponse.json();
            setAiGatewayEnabled(featuresData.aiGatewayEnabled || false);
          }
        } catch (error) {
          console.error('Error fetching customer features:', error);
        }

        // Check deployment status for all portal modes (same dashboard experience)
        if (customerData.customer) {
          const deployStatus = customerData.customer.deploymentStatus || 'not_started';
          console.log('🚀 DEPLOYMENT STATUS CHECK (Initial Load):', {
            deploymentStatus: deployStatus,
            portalMode: branding.portalMode,
            customerId: customerData.customer.id,
            rawDeploymentStatus: customerData.customer.deploymentStatus
          });
          setDeploymentStatus(deployStatus);

          // Check if customer has prospect entry (for AI Receptioning usecase)
          const hasProspect = await checkProspectEntry(customerData.customer.id);
          setHasProspectEntry(hasProspect);

          // Fetch assigned phone number if phone is provisioned
          if (deployStatus === 'phone_provisioned' || deployStatus === 'agent_deploying' || deployStatus === 'agent_ready' || deployStatus === 'completed') {
            fetchAssignedPhoneNumber();
          }

          // Note: Deployment banner logic moved to separate useEffect that waits for branding to load
        } else {
          console.log('❌ No customer data found, cannot check deployment status');
        }

        // Check if customer needs to complete payment (when free trial is disabled)
        if (customerData.customer && !branding.freeTrialEnabled) {
          // Check if customer has active subscription or sufficient credits
          const hasActiveSubscription = customerData.customer.subscriptionStatus === 'active';
          const hasCredits = (customerData.customer.aiCredits || 0) > 0;

          if (!hasActiveSubscription && !hasCredits) {
            setNeedsPayment(true);
            // Get the selected plan from onboarding if available
            try {
              const onboardingResponse = await fetch('/api/whitelabel/prospects/resume');
              if (onboardingResponse.ok) {
                const onboardingData = await onboardingResponse.json();
                if (onboardingData.prospect?.selectedPlan) {
                  setSelectedPlan(onboardingData.prospect.selectedPlan);
                }
              }
            } catch (error) {
              console.error('Error checking selected plan:', error);
            }
          } else {
            // Customer has paid, fetch their phone numbers
            try {
              const phoneResponse = await fetch('/api/whitelabel/phone-numbers');
              if (phoneResponse.ok) {
                const phoneData = await phoneResponse.json();
                setPhoneNumbers(phoneData.data?.phoneNumbers || []);
              }
            } catch (error) {
              console.error('Error fetching phone numbers:', error);
            }
          }
        } else if (branding.freeTrialEnabled) {
          // Free trial enabled, always fetch phone numbers
          try {
            const phoneResponse = await fetch('/api/whitelabel/phone-numbers');
            if (phoneResponse.ok) {
              const phoneData = await phoneResponse.json();
              setPhoneNumbers(phoneData.data?.phoneNumbers || []);
            }
          } catch (error) {
            console.error('Error fetching phone numbers:', error);
          }
        }

        // Note: Onboarding check moved to separate useEffect that waits for branding to load

        // Fetch conversations for each agent to get call stats
        let allCalls: any[] = [];
        let agentsWithUsage = [];

        if (agentsData.agents && agentsData.agents.length > 0) {
          // Process each agent to get its conversations
          for (const agent of agentsData.agents) {
            try {
              // Use analytics service endpoint if available, otherwise fall back to legacy endpoint
              const conversationsEndpoint = USE_ANALYTICS_SERVICE_CONVERSATIONS
                ? `/api/whitelabel/analytics/conversations?agentId=${agent.id}&period=30d`
                : `/api/whitelabel/conversations?agentId=${agent.id}&period=30d`;

              const conversationsResponse = await fetch(conversationsEndpoint);

              try {
                if (conversationsResponse.ok) {
                  const conversationsData = await conversationsResponse.json();
                  const conversations = conversationsData.data || [];

                  // Calculate usage stats
                  const calls = conversations.length;
                  const minutes = conversations.reduce((sum: number, call: any) => {
                    // Calculate duration in minutes based on timestamps if available
                    if (call.startedAt && call.endedAt) {
                      const start = new Date(call.startedAt).getTime();
                      const end = new Date(call.endedAt).getTime();
                      return sum + ((end - start) / 1000 / 60);
                    } else if (call.duration) {
                      return sum + (call.duration / 60);
                    }
                    return sum;
                  }, 0);

                  // Get the most recent call
                  const lastCall = conversations.length > 0 ?
                    conversations.sort((a: any, b: any) => {
                      const dateA = new Date(a.createdAt || a.startedAt || a.timestamp).getTime();
                      const dateB = new Date(b.createdAt || b.startedAt || b.timestamp).getTime();
                      return dateB - dateA;
                    })[0] : null;

                  // Format the last call time
                  let lastCallTime = 'Never';
                  if (lastCall) {
                    try {
                      const callDate = new Date(lastCall.createdAt || lastCall.startedAt || lastCall.timestamp);
                      if (!isNaN(callDate.getTime())) {
                        lastCallTime = formatDistanceToNow(callDate, { addSuffix: true });
                      }
                    } catch (error) {
                      console.warn(`Error formatting last call time for agent ${agent.id}:`, error);
                      lastCallTime = 'Recently';
                    }
                  }

                  // Add usage data to the agent
                  agentsWithUsage.push({
                    ...agent,
                    usage: {
                      calls,
                      minutes: Math.round(minutes),
                      lastCall: lastCallTime
                    }
                  });

                  // Add calls to the all calls array
                  allCalls = [...allCalls, ...conversations];
                } else {
                  // Handle non-OK response
                  try {
                    const errorData = await conversationsResponse.json();
                    if (errorData.userFriendlyMessage || errorData.message) {
                      console.warn(`API error for agent ${agent.id} (${agent.type}): ${errorData.message || errorData.error}`);
                    }
                  } catch (parseError) {
                    console.error('Error parsing error response:', parseError);
                  }

                  // Add agent with empty usage stats
                  agentsWithUsage.push({
                    ...agent,
                    usage: {
                      calls: 0,
                      minutes: 0,
                      lastCall: 'No data'
                    }
                  });
                }
              } catch (convError) {
                console.error(`Error processing conversations for agent ${agent.id} (${agent.type}):`, convError);
                // Add agent with empty usage stats
                agentsWithUsage.push({
                  ...agent,
                  usage: {
                    calls: 0,
                    minutes: 0,
                    lastCall: 'No data'
                  }
                });
              }
            } catch (error) {
              console.error(`Error fetching conversations for agent ${agent.id} (${agent.type}):`, error);
              // Add agent with empty usage stats
              agentsWithUsage.push({
                ...agent,
                usage: {
                  calls: 0,
                  minutes: 0,
                  lastCall: 'No data'
                }
              });
            }
          }
        } else {
          agentsWithUsage = [];
        }

        setAgents(agentsWithUsage);

        // Process recent calls
        const recentCallsData = allCalls
          .sort((a: any, b: any) => {
            const dateA = new Date(a.createdAt || a.startedAt || a.timestamp).getTime();
            const dateB = new Date(b.createdAt || b.startedAt || b.timestamp).getTime();
            return dateB - dateA;
          })
          .slice(0, 5)
          .map((call: any) => {
            // Find the agent name
            const agent = agentsData.agents.find((a: any) => a.id === call.assistantId || a.id === call.agentId);

            // Calculate duration
            let duration = '0:00';
            if (call.duration) {
              const minutes = Math.floor(call.duration / 60);
              const seconds = call.duration % 60;
              duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            } else if (call.startedAt && call.endedAt) {
              const start = new Date(call.startedAt).getTime();
              const end = new Date(call.endedAt).getTime();
              const durationSeconds = Math.round((end - start) / 1000);
              const minutes = Math.floor(durationSeconds / 60);
              const seconds = durationSeconds % 60;
              duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            }

            return {
              id: call.id,
              agent: agent?.name || 'Unknown Agent',
              caller: call.caller || call.phoneNumber || '+1 (xxx) xxx-xxxx',
              duration,
              status: call.status || 'Completed',
              time: formatDistanceToNow(new Date(call.createdAt || call.startedAt || call.timestamp), { addSuffix: true })
            };
          });

        setRecentCalls(recentCallsData);

        // Generate call trend data for the last 7 days
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.

        // Reorder days to start with 7 days ago
        const orderedDays = [
          ...days.slice(today === 0 ? 1 : (today + 1) % 7),
          ...days.slice(0, today === 0 ? 1 : (today + 1) % 7)
        ];

        // Count calls per day
        const callsPerDay = orderedDays.map(day => {
          const dayIndex = days.indexOf(day);
          const callsOnDay = allCalls.filter(call => {
            const callDate = new Date(call.createdAt || call.startedAt || call.timestamp);
            return callDate.getDay() === (dayIndex === 6 ? 0 : dayIndex + 1); // Adjust for Sunday
          });
          return {
            day,
            calls: callsOnDay.length
          };
        });

        setCallTrend(callsPerDay);
      } catch (error) {
        console.error('Error fetching data:', error);
        // Set empty data
        setAgents([]);
        setRecentCalls([]);

        // Set empty call trend data
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const today = new Date().getDay();
        const orderedDays = [
          ...days.slice(today === 0 ? 1 : (today + 1) % 7),
          ...days.slice(0, today === 0 ? 1 : (today + 1) % 7)
        ];

        setCallTrend(
          orderedDays.map((day) => ({
            day,
            calls: 0
          }))
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Separate useEffect to ensure phone numbers are always fetched
  useEffect(() => {
    const fetchPhoneNumbers = async () => {
      console.log('🔄 Independent phone number fetch on page load');
      await fetchAssignedPhoneNumber();
    };
    fetchPhoneNumbers();
  }, []);

  // Separate useEffect for onboarding check that waits for branding to load
  useEffect(() => {
    const checkIncompleteOnboarding = async () => {
      console.log('🔍 ONBOARDING CHECK - Branding state:', {
        branding: branding,
        hasPortalMode: branding?.portalMode !== undefined,
        portalMode: branding?.portalMode,
        brandingKeys: branding ? Object.keys(branding) : 'null'
      });

      // Wait for branding to be loaded
      if (!branding || !branding.portalMode) {
        console.log('⏳ Branding not loaded yet, waiting... Current branding:', branding);
        return;
      }

      // Check for incomplete onboarding (only for SAAS mode)
      if (branding.portalMode === 'SAAS') {
        console.log('🔍 Checking for incomplete onboarding (SAAS mode)...');
        try {
          const onboardingResponse = await fetch('/api/whitelabel/prospects/resume');
          console.log('📡 Onboarding API response status:', onboardingResponse.status);

          if (onboardingResponse.ok) {
            const onboardingData = await onboardingResponse.json();
            console.log('📋 Onboarding data received:', onboardingData);

            if (onboardingData.hasIncompleteOnboarding) {
              console.log('✅ Found incomplete onboarding, showing banner');
              console.log('🔍 Setting state - prospect data:', onboardingData.prospect);
              setIncompleteOnboarding(onboardingData.prospect);
              setShowOnboardingBanner(true);
              console.log('🔍 State set - showOnboardingBanner: true');
            } else {
              console.log('❌ No incomplete onboarding found');
            }
          } else {
            console.log('❌ Onboarding API call failed:', onboardingResponse.status, onboardingResponse.statusText);
          }
        } catch (error) {
          console.error('Error checking incomplete onboarding:', error);
        }
      } else {
        console.log('ℹ️ Not SAAS mode, skipping onboarding check. Portal mode:', branding.portalMode);
      }
    };

    checkIncompleteOnboarding();
  }, [branding?.portalMode]); // Only depend on portalMode to avoid infinite loop

  // Separate useEffect for deployment banner that waits for branding to be fully loaded
  useEffect(() => {
    const checkDeploymentBanner = () => {
      console.log('🔍 DEPLOYMENT BANNER CHECK - Current state:', {
        deploymentStatus,
        customerId,
        hasProspectEntry,
        brandingPortalMode: branding.portalMode,
        brandingSaasEnabled: branding.saasOnboardingEnabled,
        brandingBusinessName: branding.businessName
      });

      // Wait for branding to be loaded (not in default state)
      if (!branding || !branding.businessName || branding.businessName === 'Knotie AI') {
        console.log('⏳ Branding not fully loaded yet, waiting for deployment banner check...');
        return;
      }

      // Wait for customer data to be loaded
      if (!customerId || !deploymentStatus) {
        console.log('⏳ Customer data not loaded yet, waiting for deployment banner check...');
        return;
      }

      console.log('🚀 DEPLOYMENT BANNER CHECK (After Branding Loaded):', {
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
        console.log('✅ Showing deployment banner for status:', deploymentStatus);
        setShowDeploymentBanner(true);
      } else if (deploymentStatus === 'not_started' && branding.portalMode === 'SAAS' && branding.saasOnboardingEnabled && hasProspectEntry) {
        console.log('✅ Showing deployment banner for not_started status - Partner has SaaS enabled and customer has prospect entry');
        setShowDeploymentBanner(true);
      } else {
        console.log('❌ Not showing deployment banner. Status:', deploymentStatus, 'Partner portal mode:', branding.portalMode, 'SaaS enabled:', branding.saasOnboardingEnabled, 'Has prospect:', hasProspectEntry);
        setShowDeploymentBanner(false);
      }
    };

    checkDeploymentBanner();
  }, [branding?.portalMode, branding?.saasOnboardingEnabled, branding?.businessName, deploymentStatus, customerId, hasProspectEntry]);

  // Check if we should use analytics service
  if (USE_ANALYTICS_SERVICE) {
    return (
      <WhitelabelLayout>
        <HybridAnalyticsServiceDashboard />
      </WhitelabelLayout>
    );
  }

  if (loading) {
    return (
      <WhitelabelLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-10 h-10 border-4 border-gray-600 border-t-blue-500 rounded-full"></div>
        </div>
      </WhitelabelLayout>
    );
  }

  // Debug banner rendering conditions
  console.log('🔍 BANNER RENDER CHECK:', {
    showOnboardingBanner,
    hasIncompleteOnboarding: !!incompleteOnboarding,
    portalMode: branding.portalMode,
    shouldShowBanner: showOnboardingBanner && incompleteOnboarding && branding.portalMode === 'SAAS'
  });

  // Debug deployment banner rendering conditions
  console.log('🔍 DEPLOYMENT BANNER RENDER CHECK:', {
    showDeploymentBanner,
    deploymentStatus,
    portalMode: branding.portalMode,
    saasOnboardingEnabled: branding.saasOnboardingEnabled,
    hasProspectEntry,
    shouldShowDeploymentBanner: showDeploymentBanner
  });

  return (
    <WhitelabelLayout>
      {/* Deployment Status Banner - Shows for all portal modes (same dashboard experience) */}
      {showDeploymentBanner && (
        <DeploymentStatusBanner
          deploymentStatus={deploymentStatus}
          branding={branding}
          onDismiss={() => setShowDeploymentBanner(false)}
          assignedPhoneNumber={assignedPhoneNumber || undefined}
          onTryAgent={handleTryAgent}
          onDeployForBusiness={handleDeployForBusiness}
          onSetupCallForwarding={handleSetupCallForwarding}
        />
      )}

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
                <FiPlay className="w-6 h-6" style={{ color: branding.primaryColor }} />
              </div>

              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">
                  {getTranslation('portal.dashboard.onboardingBanner.title', 'Continue Your AI Assistant Setup')}
                </h3>
                <p className="text-gray-300 mb-4">
                  {getTranslation('portal.dashboard.onboardingBanner.description', `You have an incomplete onboarding for "${incompleteOnboarding.businessName || 'your AI assistant'}".`)}
                  {' '}
                  {getTranslation('portal.dashboard.onboardingBanner.stepProgress', `You're currently at step ${incompleteOnboarding.currentStep} of 9`).replace('{step}', String(incompleteOnboarding.currentStep))}
                  {' '}
                  ({getTranslation('portal.dashboard.onboardingBanner.percentComplete', `${incompleteOnboarding.progressPercentage}% complete`).replace('{percentage}', String(incompleteOnboarding.progressPercentage))}).
                </p>

                <div className="flex items-center gap-4">
                  <a
                    href={incompleteOnboarding.resumeUrl}
                    className="inline-flex items-center px-4 py-2 rounded-lg font-medium text-white transition-all hover:shadow-lg"
                    style={{
                      background: `linear-gradient(135deg, ${branding.primaryColor}, ${branding.secondaryColor})`
                    }}
                  >
                    {getTranslation('portal.dashboard.onboardingBanner.continueSetup', 'Continue Setup')}
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

      {/* Payment Required Banner */}
      {needsPayment && (
        <div className="mb-6">
          <div
            className="relative rounded-lg p-6 border-2"
            style={{
              background: `linear-gradient(135deg, #F59E0B10, #EF444410)`,
              borderColor: '#F59E0B40'
            }}
          >
            {/* Close button */}
            <button
              onClick={() => setNeedsPayment(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <FiX className="w-5 h-5" />
            </button>

            <div className="flex items-start gap-4">
              <div
                className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#F59E0B20' }}
              >
                <FiCreditCard className="w-6 h-6" style={{ color: '#F59E0B' }} />
              </div>

              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">
                  {getTranslation('portal.dashboard.paymentBanner.title', 'Complete Your Payment Setup')}
                </h3>
                <p className="text-gray-300 mb-4">
                  {getTranslation('portal.dashboard.paymentBanner.description', 'Your AI assistant is ready! Complete your payment setup to start receiving calls and access your phone number.')}
                  {selectedPlan && (
                    <span className="block mt-1 text-amber-200">
                      {getTranslation('portal.dashboard.paymentBanner.selectedPlan', `Selected plan: ${selectedPlan.name} ($${(selectedPlan.amount / 100).toFixed(2)}/${selectedPlan.interval})`).replace('{planName}', selectedPlan.name).replace('{amount}', (selectedPlan.amount / 100).toFixed(2)).replace('{interval}', selectedPlan.interval)}
                    </span>
                  )}
                </p>

                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setShowPaymentModal(true)}
                    className="inline-flex items-center px-4 py-2 rounded-lg font-medium text-white transition-all hover:shadow-lg"
                    style={{
                      background: `linear-gradient(135deg, #F59E0B, #EF4444)`
                    }}
                  >
                    {getTranslation('portal.dashboard.paymentBanner.setupPayment', 'Setup Payment')}
                    <FiArrowRight className="ml-2 w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Welcome Section */}
      <div className="mb-8">
        <div className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-lg p-6 mb-6`}
             style={{ borderColor: `${branding.primaryColor}40` }}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
            <div>
              <h2 className="text-2xl font-bold mb-2" style={{ color: branding.primaryColor }}>
                {getTranslation('portal.dashboard.welcome.title', `Welcome to ${branding.businessName} AI Dashboard`)}
              </h2>
              <p className="text-gray-400">
                {getTranslation('portal.dashboard.welcome.subtitle', 'Monitor your AI agents, track performance, and analyze conversations.')}
              </p>
            </div>
            <div className="mt-4 md:mt-0 flex items-center gap-4">
              {/* Notification Bell */}
              <NotificationBell userId={customerId} userType="customer" />
            </div>
          </div>
        </div>
      </div>

      {/* Phone Numbers Section - Only for SAAS mode */}
      {phoneNumbers.length > 0 && branding.portalMode === 'SAAS' && (
        <div className="mb-8">
          <div className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-lg p-6`}
               style={{ borderColor: `${branding.primaryColor}40` }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold" style={{ color: branding.primaryColor }}>
                Your AI Assistant Phone Numbers
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {phoneNumbers.map((phone, index) => (
                <div key={index} className="bg-gray-700/30 rounded-lg p-4 border border-gray-600">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className="p-2 rounded-full" style={{ backgroundColor: `${branding.primaryColor}20` }}>
                        <FiPhoneCall className="w-4 h-4" style={{ color: branding.primaryColor }} />
                      </div>
                      <span className="font-semibold text-white text-lg">
                        {phone.phoneNumber || phone.number}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-xs text-green-400">Active</span>
                    </div>
                  </div>

                  {phone.agentName && (
                    <p className="text-sm text-gray-400">
                      Connected to: <span className="text-white">{phone.agentName}</span>
                    </p>
                  )}

                  <p className="text-xs text-gray-500 mt-1">
                    Ready to receive calls 24/7
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 p-4 bg-blue-900/20 border border-blue-800/30 rounded-lg">
              <p className="text-sm text-blue-200">
                <strong>📞 Ready to go!</strong> Your AI assistant is live and ready to handle calls.
                Share these numbers with your customers or use them in your marketing materials.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-white mb-4" style={{ color: branding.primaryColor }}>
          {getTranslation('portal.dashboard.performanceOverview.title', 'Performance Overview')}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-6">
          <div className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-lg p-4 md:p-6`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-400 text-sm">{getTranslation('portal.dashboard.stats.totalCalls', 'Total Conversations')}</h3>
              <div className="p-1.5 md:p-2 rounded-full" style={{ backgroundColor: `${branding.primaryColor}20` }}>
                <FiPhoneCall className="w-4 h-4 md:w-5 md:h-5" style={{ color: branding.primaryColor }} />
              </div>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-white">
              {agents.reduce((sum, agent) => sum + agent.usage.calls, 0)}
            </p>
            <p className="text-xs md:text-sm text-gray-400 mt-1">{getTranslation('portal.dashboard.stats.acrossAllAgents', 'Across all agents')}</p>
          </div>

          <div className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-lg p-4 md:p-6`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-400 text-sm">{getTranslation('portal.dashboard.stats.totalMinutes', 'Total Duration (min)')}</h3>
              <div className="p-1.5 md:p-2 rounded-full" style={{ backgroundColor: `${branding.primaryColor}20` }}>
                <FiClock className="w-4 h-4 md:w-5 md:h-5" style={{ color: branding.primaryColor }} />
              </div>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-white">
              {agents.reduce((sum, agent) => sum + agent.usage.minutes, 0)}
            </p>
            <p className="text-xs md:text-sm text-gray-400 mt-1">{getTranslation('portal.dashboard.stats.talkTime', 'Talk time')}</p>
          </div>

          <div className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-lg p-4 md:p-6`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-400 text-sm">{getTranslation('portal.dashboard.stats.activeAgents', 'Active Agents')}</h3>
              <div className="p-1.5 md:p-2 rounded-full" style={{ backgroundColor: `${branding.primaryColor}20` }}>
                <FiUsers className="w-4 h-4 md:w-5 md:h-5" style={{ color: branding.primaryColor }} />
              </div>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-white">
              {agents.filter(agent => agent.status === 'active').length}
            </p>
            <p className="text-xs md:text-sm text-gray-400 mt-1">{getTranslation('portal.dashboard.stats.deployedAndActive', 'Deployed and active')}</p>
          </div>
        </div>

        {/* Call Volume Chart */}
        <div className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-lg p-4 md:p-6`}>
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <h3 className="text-base md:text-lg font-semibold text-white">{getTranslation('portal.dashboard.callVolumeTrend.title', 'Activity Trend')}</h3>
            <div className="text-xs md:text-sm text-gray-400">{getTranslation('portal.dashboard.callVolumeTrend.last7Days', 'Last 7 days')}</div>
          </div>
          <CallVolumeChart data={callTrend} />
        </div>
      </div>

      {/* AI Agents */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <h2 className="text-lg md:text-xl font-bold text-white" style={{ color: branding.primaryColor }}>
            {getTranslation('portal.dashboard.aiAgents.title', 'Your AI Agents')}
          </h2>
          <Link href="/whitelabel/conversations" className="text-xs md:text-sm hover:underline" style={{ color: branding.primaryColor }}>
            {getTranslation('portal.dashboard.aiAgents.viewConversations', 'View all conversations')}
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {agents.length > 0 ? (
            agents.map((agent) => {
              const isChatAgent = agent.type === 'n8n_chat' || agent.type === 'retell_chat';
              const isVoiceAgent = !isChatAgent;

              return (
                <div
                  key={agent.id}
                  onClick={() => {
                    if (isVoiceAgent) {
                      handleAgentTileClick(agent.id, agent.name, agent.type, agent.phoneNumber);
                    }
                  }}
                  className={`bg-gray-800/50 backdrop-blur-md rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border border-gray-700/30 hover:border-gray-600 p-4 md:p-6 relative group ${
                    isVoiceAgent ? 'cursor-pointer transform hover:scale-105' : 'cursor-default'
                  }`}
                  style={{
                    borderColor: agent.status === 'active' ? `${branding.primaryColor}40` : undefined
                  }}
                >
                  {/* Icon indicator - different for chat vs voice */}
                  <div
                    className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center opacity-60 group-hover:opacity-100 transition-opacity"
                    style={{
                      background: `linear-gradient(to right, ${branding.primaryColor}, ${branding.secondaryColor})`
                    }}
                  >
                    {isChatAgent ? (
                      <FiMessageSquare className="w-4 h-4 text-white" />
                    ) : (
                      <FiPhoneCall className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <div className="flex items-start justify-between mb-3 md:mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base md:text-lg font-semibold text-white">{agent.name}</h3>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          agent.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {agent.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-xs md:text-sm text-gray-400">
                        {agent.description || (isChatAgent ? 'Chat AI Assistant' : 'AI Voice Assistant')}
                      </p>
                    </div>
                  </div>
                  <p className="text-gray-300 text-xs md:text-sm mb-3 md:mb-4">{agent.description}</p>

                  {/* Phone Number Display for SAAS mode */}
                  {branding.portalMode === 'SAAS' && isVoiceAgent && (
                    <div className="mb-3 md:mb-4">
                      {(() => {
                        const connectedPhone = phoneNumbers.find(phone =>
                          phone.connectedAgent?.agentName === agent.name ||
                          phone.agentName === agent.name
                        );

                        if (connectedPhone) {
                          return (
                            <div className="flex items-center gap-2 p-2 bg-gray-700/30 rounded-lg border border-gray-600">
                              <div className="p-1.5 rounded-full" style={{ backgroundColor: `${branding.primaryColor}20` }}>
                                <FiPhoneCall className="w-3 h-3" style={{ color: branding.primaryColor }} />
                              </div>
                              <div className="flex-1">
                                <p className="text-white text-sm font-medium">
                                  {connectedPhone.phoneNumber || connectedPhone.number}
                                </p>
                                <p className="text-gray-400 text-xs">Ready for calls</p>
                              </div>
                              <div className="flex items-center gap-1">
                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                                <span className="text-xs text-green-400">Live</span>
                              </div>
                            </div>
                          );
                        } else {
                          return (
                            <div className="flex items-center gap-2 p-2 bg-amber-900/20 rounded-lg border border-amber-800/30">
                              <div className="p-1.5 rounded-full bg-amber-500/20">
                                <FiPhoneCall className="w-3 h-3 text-amber-400" />
                              </div>
                              <div className="flex-1">
                                <p className="text-amber-200 text-sm">No phone number assigned</p>
                                <p className="text-amber-400 text-xs">Contact support to get started</p>
                              </div>
                            </div>
                          );
                        }
                      })()}
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-1 md:gap-2 pt-2 md:pt-3 border-t border-gray-700">
                    <div className="text-center">
                      <p className="text-base md:text-lg font-semibold text-white">{agent.usage.calls}</p>
                      <p className="text-[10px] md:text-xs text-gray-400">
                        {isChatAgent ? 'Chats' : 'Calls'}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-base md:text-lg font-semibold text-white">{agent.usage.minutes}</p>
                      <p className="text-[10px] md:text-xs text-gray-400">
                        {isChatAgent ? 'Messages' : 'Minutes'}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs md:text-sm font-semibold text-white">{agent.usage.lastCall}</p>
                      <p className="text-[10px] md:text-xs text-gray-400">
                        {isChatAgent ? 'Last Chat' : 'Last Call'}
                      </p>
                    </div>
                  </div>
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
                <h3 className="text-lg md:text-xl font-semibold text-white mb-2">
                  {getTranslation('portal.dashboard.aiAgents.noAgentsYet', 'No AI Agents Yet')}
                </h3>
                <p className="text-xs md:text-sm text-gray-400 max-w-md">
                  {getTranslation('portal.dashboard.aiAgents.noAgentsDescription', 'Your AI agents will appear here once they are set up. Contact your account manager to get started.')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <h2 className="text-lg md:text-xl font-bold text-white" style={{ color: branding.primaryColor }}>
            {getTranslation('portal.dashboard.recentActivity.title', 'Recent Activity')}
          </h2>
          <Link href="/whitelabel/conversations" className="text-xs md:text-sm hover:underline" style={{ color: branding.primaryColor }}>
            {getTranslation('portal.dashboard.recentActivity.viewAll', 'View all conversations')}
          </Link>
        </div>

        <div className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-lg overflow-hidden`}>
          {recentCalls.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="px-3 md:px-6 py-2 md:py-3 text-left text-[10px] md:text-xs font-medium text-gray-400 uppercase tracking-wider">
                      {getTranslation('portal.dashboard.recentActivity.table.agent', 'Agent')}
                    </th>
                    <th className="px-3 md:px-6 py-2 md:py-3 text-left text-[10px] md:text-xs font-medium text-gray-400 uppercase tracking-wider">
                      {getTranslation('portal.dashboard.recentActivity.table.caller', 'Caller')}
                    </th>
                    <th className="px-3 md:px-6 py-2 md:py-3 text-left text-[10px] md:text-xs font-medium text-gray-400 uppercase tracking-wider">
                      {getTranslation('portal.dashboard.recentActivity.table.duration', 'Duration')}
                    </th>
                    <th className="px-3 md:px-6 py-2 md:py-3 text-left text-[10px] md:text-xs font-medium text-gray-400 uppercase tracking-wider">
                      {getTranslation('portal.dashboard.recentActivity.table.status', 'Status')}
                    </th>
                    <th className="px-3 md:px-6 py-2 md:py-3 text-left text-[10px] md:text-xs font-medium text-gray-400 uppercase tracking-wider">
                      {getTranslation('portal.dashboard.recentActivity.table.time', 'Time')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {recentCalls.map((call) => (
                    <tr key={call.id} className="hover:bg-gray-750">
                      <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm text-white">
                        {call.agent}
                      </td>
                      <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm text-gray-300">
                        {call.caller}
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
              <h3 className="text-lg md:text-xl font-semibold text-white mb-2">
                {getTranslation('portal.dashboard.recentActivity.noActivity', 'No Recent Activity')}
              </h3>
              <p className="text-xs md:text-sm text-gray-400 max-w-md px-4">
                {getTranslation('portal.dashboard.recentActivity.noActivityDescription', 'Your recent conversation activity will appear here once your AI agents start handling interactions.')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-lg md:text-xl font-bold text-white mb-3 md:mb-4" style={{ color: branding.primaryColor }}>
          {getTranslation('portal.dashboard.quickLinks.title', 'Quick Links')}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          <Link href="/whitelabel/conversations">
            <div className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-lg p-4 md:p-6 hover:border-gray-600 transition-colors h-full`}>
              <div className="flex items-center mb-2 md:mb-3">
                <div className="p-1.5 md:p-2 rounded-full mr-2 md:mr-3" style={{ backgroundColor: `${branding.primaryColor}20` }}>
                  <FiActivity className="w-4 h-4 md:w-5 md:h-5" style={{ color: branding.primaryColor }} />
                </div>
                <h3 className="text-base md:text-lg font-semibold text-white">
                  {getTranslation('portal.dashboard.quickLinks.callHistory', 'Call History')}
                </h3>
              </div>
              <p className="text-gray-400 text-xs md:text-sm">
                {getTranslation('portal.dashboard.quickLinks.callHistoryDescription', 'View detailed history of all conversations handled by your AI agents.')}
              </p>
            </div>
          </Link>

          <Link href="/whitelabel/usage">
            <div className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-lg p-4 md:p-6 hover:border-gray-600 transition-colors h-full`}>
              <div className="flex items-center mb-2 md:mb-3">
                <div className="p-1.5 md:p-2 rounded-full mr-2 md:mr-3" style={{ backgroundColor: `${branding.primaryColor}20` }}>
                  <FiBarChart2 className="w-4 h-4 md:w-5 md:h-5" style={{ color: branding.primaryColor }} />
                </div>
                <h3 className="text-base md:text-lg font-semibold text-white">
                  {getTranslation('portal.dashboard.quickLinks.usageDetails', 'Usage Details')}
                </h3>
              </div>
              <p className="text-gray-400 text-xs md:text-sm">
                {getTranslation('portal.dashboard.quickLinks.usageDetailsDescription', 'Track detailed usage metrics for your AI agents.')}
              </p>
            </div>
          </Link>

          {/* AI Gateway quick link — only shown when enabled for this customer */}
          {aiGatewayEnabled && (
            <Link href="/whitelabel/ai-gateway">
              <div className={`${themeConfig.styleClasses.card} border border-purple-800/40 rounded-lg p-4 md:p-6 hover:border-purple-600/60 transition-colors h-full`}>
                <div className="flex items-center mb-2 md:mb-3">
                  <div className="p-1.5 md:p-2 rounded-full mr-2 md:mr-3 bg-purple-500/20">
                    <FiKey className="w-4 h-4 md:w-5 md:h-5 text-purple-400" />
                  </div>
                  <h3 className="text-base md:text-lg font-semibold text-white flex items-center gap-2">
                    AI Gateway
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 bg-purple-500/10 border border-purple-500/30 px-1.5 py-0.5 rounded-full">Beta</span>
                  </h3>
                </div>
                <p className="text-gray-400 text-xs md:text-sm">
                  Create and manage your AI Gateway API keys to access AI models billed via your credit balance.
                </p>
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* Payment Methods Section */}
      <div className="mt-8">
        <PaymentMethodsManager
          className="max-w-4xl"
          showAddButton={true}
        />
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

      {/* Payment Setup Modal */}
      <PaymentSetupModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        selectedPlan={selectedPlan}
        onPaymentSuccess={() => {
          setShowPaymentModal(false);
          setNeedsPayment(false);
          // Refresh the page to update payment status
          window.location.reload();
        }}
      />

      {/* Call Forwarding Modal */}
      <CallForwardingModal
        isOpen={showCallForwardingModal}
        onClose={() => {
          console.log('🔧 Closing call forwarding modal');
          setShowCallForwardingModal(false);
          setModalPhoneNumber(null);
        }}
        assignedPhoneNumber={(() => {
          const phoneToPass = modalPhoneNumber || assignedPhoneNumber || '';
          console.log('🔧 Passing phone number to modal:', {
            modalPhoneNumber,
            assignedPhoneNumber,
            finalPhoneNumber: phoneToPass,
            showCallForwardingModal
          });
          return phoneToPass;
        })()}
      />
    </WhitelabelLayout>
  );
}
