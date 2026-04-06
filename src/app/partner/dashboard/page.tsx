'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { debounce } from 'lodash';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  FiPlus,
  FiUsers,
  FiDollarSign,
  FiTrendingUp,
  FiClock,
  FiX,
  FiPhone,
  FiCpu,
  FiPhoneCall,
  FiArrowUp,
  FiArrowDown,
  FiActivity,
  FiTarget,
  FiBarChart
} from 'react-icons/fi';
import clsx from 'clsx';
import QuickOnboardingModal from '@/components/partner/QuickOnboardingModal';
import CustomerHomeView from '@/components/CustomerHomeView';
import { formatCredits } from '@/lib/types/credits';
import GuidedPartnerSidebar from '@/components/partner/GuidedPartnerSidebar';
import { UserGuideProvider } from '@/context/UserGuideContext';

import NeonContainer from '@/components/NeonContainer';
import MigrationWarningPopup from '@/components/notifications/MigrationWarningPopup';
// import WebhookMigrationPopup from '@/components/notifications/WebhookMigrationPopup'; // DISABLED
import NotificationBell from '@/components/notifications/NotificationBell';
import PasskeyPrompt from '@/components/passkey/PasskeyPrompt';
import WelcomeVideoModal from '@/components/partner/WelcomeVideoModal';
import { WalkthroughProvider } from '@/context/WalkthroughContext';
import OnboardingProgressBar from '@/components/onboarding/OnboardingProgressBar';
import { DailyChallengeWidget } from '@/components/challenges/DailyChallengeWidget';
import CreditClaimModal from '@/components/credits/CreditClaimModal';
import { AnimatePresence, motion } from 'framer-motion';
import { Dialog, Tab, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar
} from 'recharts';

interface DashboardMetrics {
  totalOpportunityValue: number;
  totalMRR: number;
  totalUsers: number;
  liveUsers: number;
  customersWithPortalAccess: number;
  totalRegisteredCustomers: number;
  totalPhoneNumbers: number;
  timelineData: Array<{
    date: string;
    totalUsers: number;
    liveUsers: number;
  }>;
}

interface CustomerData {
  id: string;
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  monthlyCallVolume: string;
  estimatedPrice: number;
  priceBreakdown: string;
  orderStatus: string;
}

interface PartnerAnalytics {
  totalCost: number;
  totalDuration: number;
  totalCalls: number;
  failedCalls: number;
  successRate: number;
  avgDuration: number;
  avgCost: number;
  productCosts: Array<{
    product: string;
    cost: number;
  }>;
}



export default function PartnerDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [partnerName, setPartnerName] = useState('');

  const [isQuickOnboardingModalOpen, setIsQuickOnboardingModalOpen] = useState(false);
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null);
  const [knotieCreditBalance, setKnotieCreditBalance] = useState<number>(0);
  const [telephonyCreditBalance, setTelephonyCreditBalance] = useState<number>(0);
  const [selectedBreakdown, setSelectedBreakdown] = useState<{
    platformFee: number;
    voiceAICost: number;
    telephonyCost: number;
    emailCost: number;
    smsCost: number;
    totalCost: number;
  } | null>(null);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [partnerAnalytics, setPartnerAnalytics] = useState<PartnerAnalytics | null>(null);
  // Define types for selected options



  // Define provider-specific types
  type TelephonyKeys = 'twilio-inbound' | 'twilio-outbound' | 'vonage-outbound';
  type LLMKeys = 'gpt-4.5-turbo' | 'gpt-4o-mini' | 'gpt-4-turbo' | 'custom' | 'gpt-4o-realtime' | 'gpt-4o-mini-realtime' | 'gemini-1.5-flash' | 'gemini-2.0-flash' | 'gpt-4o' | 'gpt-4.1' | 'gpt-4.1-mini' | 'gpt-4.1-nano' | 'claude-3.7-sonnet' | 'claude-3.5-haiku' | 'gemini-2.0-flash-lite';
  type TTSKeys = 'elevenlabs' | 'playht' | 'cartesia' | 'rime-ai' | 'lmnt' | 'deepgram' | 'neuphonic' | 'smallest-ai' | 'azure';
  type STTKeys = 'deepgram' | 'talkscriber' | 'assembly-ai' | 'azure' | 'elevenlabs' | 'speechmatics';

  // Define mode type to include browser
  type ModeType = TelephonyKeys | 'browser';



  type LLMType = LLMKeys;
  type TTSType = TTSKeys;
  type STTType = STTKeys;


  // Define cost breakdown structure
  interface CostBreakdown {
    platform?: string; // Changed from vapi to platform for all providers
    llm?: string;
    tts?: string;
    stt?: string;
    telephony: string;
    email: string;
    sms: string;
    vapi?: string; // For Retell provider compatibility
  }

  interface SelectedServices {
    email: boolean;
    sms: boolean;
  }



  // Initialize state with cost-optimized defaults
  const [selectedProvider, setSelectedProvider] = useState<'vapi' | 'retell' | 'ultravox' | 'knova' | 'ghl'>('vapi');
  const [selectedMinutes, setSelectedMinutes] = useState(1000);
  const [debouncedMinutes, setDebouncedMinutes] = useState(1000);
  const [selectedLLM, setSelectedLLM] = useState<LLMType>('gpt-4o-mini');
  const [selectedTTS, setSelectedTTS] = useState<TTSType>('neuphonic');
  const [selectedSTT, setSelectedSTT] = useState<STTType>('assembly-ai');
  const [selectedMode, setSelectedMode] = useState<ModeType>('vonage-outbound');
  const [selectedServices, setSelectedServices] = useState<SelectedServices>({
    email: false,
    sms: false
  });

  const [migrationStatus, setMigrationStatus] = useState<{
    shouldShowWarning: boolean;
    hasAgents: boolean;
    isFirstTimeUser: boolean;
    partnerId: string;
  } | null>(null);
  const [showMigrationWarning, setShowMigrationWarning] = useState(false);
  // const [webhookMigrationStatus, setWebhookMigrationStatus] = useState<{
  //   agentsWithoutWebhooks: number;
  //   totalAgents: number;
  //   partnerId: string;
  // } | null>(null); // DISABLED
  // const [showWebhookMigrationWarning, setShowWebhookMigrationWarning] = useState(false); // DISABLED
  const [showWelcomeVideo, setShowWelcomeVideo] = useState(false);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);
  const [showCreditClaimModal, setShowCreditClaimModal] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<any>(null);
  const router = useRouter();


  // Function to fetch credit balances
  const fetchCreditBalances = async (token: string) => {
    try {
      const [aiCreditsResponse, telephonyCreditsResponse] = await Promise.all([
        fetch('/api/partner/credits/balance', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/partner/telephony-credits/balance', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      // Handle Knotie Credits
      if (aiCreditsResponse.ok) {
        const aiCreditsData = await aiCreditsResponse.json();
        if (aiCreditsData.success && aiCreditsData.data) {
          setKnotieCreditBalance(aiCreditsData.data.currentBalance || 0);
        }
      }

      // Handle Telephony Credits
      if (telephonyCreditsResponse.ok) {
        const telephonyCreditsData = await telephonyCreditsResponse.json();
        if (telephonyCreditsData.success && telephonyCreditsData.data) {
          setTelephonyCreditBalance(telephonyCreditsData.data.currentBalanceCents || 0);
        }
      }
    } catch (error) {
      console.error('Error fetching credit balances:', error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Check for upgrade success in URL
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('upgrade') === 'success') {
          toast.success('🎉 Welcome to Premium! Your account has been upgraded successfully. All premium features are now unlocked!');
          // Clean up URL
          window.history.replaceState({}, '', '/partner/dashboard');
        } else if (urlParams.get('upgrade') === 'cancelled') {
          toast.error('Upgrade was cancelled. You can try again anytime.');
          // Clean up URL
          window.history.replaceState({}, '', '/partner/dashboard');
        }

        // Handle Google OAuth token from URL
        const googleAuthToken = urlParams.get('google_auth_token');
        if (googleAuthToken) {
          try {
            const decodedToken = decodeURIComponent(googleAuthToken);
            localStorage.setItem('partner_token', decodedToken);
            // Clean up URL to remove token
            urlParams.delete('google_auth_token');
            const newUrl = urlParams.toString() ?
              `/partner/dashboard?${urlParams.toString()}` :
              '/partner/dashboard';
            window.history.replaceState({}, '', newUrl);
            toast.success('🎉 Successfully signed in with Google!');
          } catch (error) {
            console.error('Error processing Google auth token:', error);
          }
        }

        // Handle first_login parameter from URL
        const firstLoginParam = urlParams.get('first_login');
        if (firstLoginParam === 'true') {
          // Set localStorage flag to trigger welcome video
          localStorage.setItem('is_first_time_login', 'true');
          // Clean up URL
          urlParams.delete('first_login');
          const newUrl = urlParams.toString() ?
            `/partner/dashboard?${urlParams.toString()}` :
            '/partner/dashboard';
          window.history.replaceState({}, '', newUrl);
        }

        // Get partner name from localStorage
        const storedName = localStorage.getItem('partner_name');
        if (storedName) {
          setPartnerName(storedName);
        }

        // Get token from localStorage
        const token = localStorage.getItem('partner_token');
        if (!token) {
          router.push('/partner/login');
          return;
        }

        // Fetch metrics with authorization header
        const metricsResponse = await fetch('/api/partner/metrics', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!metricsResponse.ok) {
          if (metricsResponse.status === 401) {
            localStorage.removeItem('partner_token');
            router.push('/partner/login');
            return;
          }
          throw new Error('Failed to fetch metrics');
        }
        const metricsData = await metricsResponse.json();
        console.log('Metrics data received:', metricsData);
        setMetrics(metricsData);

        // Fetch partner details with authorization header
        const partnerResponse = await fetch('/api/partner/profile', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!partnerResponse.ok) {
          if (partnerResponse.status === 401) {
            localStorage.removeItem('partner_token');
            router.push('/partner/login');
            return;
          }
          throw new Error('Failed to fetch partner profile');
        }
        const partnerData = await partnerResponse.json();
        if (partnerData.businessName) {
          setPartnerName(partnerData.businessName);
          localStorage.setItem('partner_name', partnerData.businessName);
        }

        // Check if onboarding is completed
        setIsOnboardingComplete(!!partnerData.walkthroughCompletedAt);

        // Fetch credit balances immediately after partner authentication
        await fetchCreditBalances(token);

        // Email metrics removed - no longer needed

        // Fetch customers with authorization header
        const customersResponse = await fetch('/api/partner/customers', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Cookie': `partner_token=${token}`
          }
        });

        if (!customersResponse.ok) {
          throw new Error('Failed to fetch customers');
        }

        const customersData = await customersResponse.json();
        setCustomers(customersData.data || customersData.customers || []); // Ensure we have an array even if empty

        // Fetch partner analytics data
        try {
          const analyticsResponse = await fetch('/api/partner/analytics/summary?period=month', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (analyticsResponse.ok) {
            const analyticsData = await analyticsResponse.json();
            setPartnerAnalytics(analyticsData);
            console.log('Partner analytics data received:', analyticsData);
          } else if (analyticsResponse.status === 401) {
            localStorage.removeItem('partner_token');
            router.push('/partner/login');
            return;
          } else {
            console.log('Partner analytics endpoint not available - skipping');
          }
        } catch (error) {
          console.log('Partner analytics data fetch failed - continuing without it:', error);
        }

        // Fetch migration status
        const migrationResponse = await fetch('/api/migration-status', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (migrationResponse.ok) {
          const migrationData = await migrationResponse.json();
          if (migrationData.success) {
            const status = migrationData.migrationStatus;
            setMigrationStatus({
              shouldShowWarning: status.shouldShowWarning,
              hasAgents: status.hasAgents,
              isFirstTimeUser: !status.hasAgents,
              partnerId: status.partnerId
            });

            // Show migration warning if needed
            if (status.shouldShowWarning) {
              setShowMigrationWarning(true);
            }
          }
        }

        // Check webhook migration status - DISABLED
        // const webhookResponse = await fetch('/api/partner/agents/webhook-stats', {
        //   headers: {
        //     'Authorization': `Bearer ${token}`
        //   }
        // });

        // if (webhookResponse.ok) {
        //   const webhookData = await webhookResponse.json();
        //   const agentsWithoutWebhooks = webhookData.summary.totalWebhookDisabled;
        //   const totalAgents = webhookData.summary.totalAgents;

        //   if (agentsWithoutWebhooks > 0) {
        //     setWebhookMigrationStatus({
        //       agentsWithoutWebhooks,
        //       totalAgents,
        //       partnerId: partnerData.partnerId || partnerData.id
        //     });

        //     // Show webhook migration warning if there are agents without webhooks
        //     // and we're not already showing the API key migration warning
        //     if (!migrationStatusData?.shouldShowWarning) {
        //       setShowWebhookMigrationWarning(true);
        //     }
        //   }
        // }

        // Check for first-time login and show welcome video
        const isFirstTimeLogin = localStorage.getItem('is_first_time_login');
        const partnerNameFromStorage = localStorage.getItem('partner_name');

        console.log('Dashboard - Checking welcome video:', {
          isFirstTimeLogin,
          partnerNameFromStorage,
          showWelcomeVideo,
          partnerData: partnerData,
          hasSeenWelcomeVideo: partnerData?.hasSeenWelcomeVideo
        });

        // Check if partner hasn't seen welcome video (either from localStorage or database)
        const shouldShowWelcomeVideo = isFirstTimeLogin === 'true' ||
          (partnerData && partnerData.hasSeenWelcomeVideo === false);

        console.log('Dashboard - Should show welcome video:', shouldShowWelcomeVideo);

        if (shouldShowWelcomeVideo) {
          console.log('Dashboard - Setting welcome video to true');
          setShowWelcomeVideo(true);
          if (partnerNameFromStorage) {
            setPartnerName(partnerNameFromStorage);
          } else if (partnerData) {
            setPartnerName(partnerData.contactName || partnerData.businessName || 'Partner');
          }
          // Clear the localStorage flag so it doesn't show again
          localStorage.removeItem('is_first_time_login');
          localStorage.removeItem('partner_name');
        }

        // Check if partner should start walkthrough
        const shouldStartWalkthrough = localStorage.getItem('should_start_walkthrough');
        if (shouldStartWalkthrough === 'true') {
          console.log('Dashboard - Should start walkthrough');
          // The walkthrough will be automatically initialized by the WalkthroughProvider
          localStorage.removeItem('should_start_walkthrough');
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        if (error instanceof Error && error.message === 'Unauthorized') {
          router.push('/partner/login');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const handleLogout = () => {
    // Clear partner data from localStorage
    localStorage.removeItem('partner_token');
    localStorage.removeItem('partner_name');
    // Redirect to login page
    router.push('/partner/login');
  };

  const handleOnboardingSuccess = (customerData: CustomerData) => {
    // Ensure the customer data has all required fields with proper defaults
    const formattedCustomerData: CustomerData = {
      ...customerData,
      firstName: customerData.firstName?.trim() || '',
      lastName: customerData.lastName?.trim() || '',
      companyName: customerData.companyName?.trim() || '',
      estimatedPrice: customerData.estimatedPrice || 0,
      priceBreakdown: customerData.priceBreakdown || '{}',
      monthlyCallVolume: customerData.monthlyCallVolume || '',
      orderStatus: customerData.orderStatus || 'PENDING'
    };

    // Add the new customer to the list without navigating away
    setCustomers(prev => [...prev, formattedCustomerData]);

    // Show success toast instead of navigating to CustomerHomeView
    const customerName = formattedCustomerData.companyName ||
                        (formattedCustomerData.firstName && formattedCustomerData.lastName ?
                         `${formattedCustomerData.firstName} ${formattedCustomerData.lastName}` :
                         formattedCustomerData.email);
    toast.success(`🎉 Customer "${customerName}" has been successfully onboarded!`);

    // Don't set selectedCustomer to avoid showing CustomerHomeView
    // setSelectedCustomer(customerData);
  };

  const handleMigrationWarningDismiss = async () => {
    setShowMigrationWarning(false);

    // Mark warning as shown for today
    try {
      const token = localStorage.getItem('partner_token');
      if (token) {
        await fetch('/api/migration-status', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ action: 'mark_warning_shown' })
        });
      }
    } catch (error) {
      console.error('Error marking migration warning as shown:', error);
    }
  };

  // const handleWebhookMigrationWarningDismiss = () => {
  //   setShowWebhookMigrationWarning(false);
  //   // For webhook migration, we don't need to mark it as shown since it's based on actual webhook status
  // }; // DISABLED

  const handleWelcomeVideoContinue = async () => {
    try {
      const token = localStorage.getItem('partner_token');
      if (token) {
        // Mark welcome video as seen in the database
        await fetch('/api/partner/welcome-video/mark-seen', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      }
    } catch (error) {
      console.error('Error marking welcome video as seen:', error);
    }
    setShowWelcomeVideo(false);
  };

  const handleWelcomeVideoClose = () => {
    // Allow closing but still mark as seen to prevent showing again
    handleWelcomeVideoContinue();
  };

  // Handle credit claim modal
  const handleCreditClaimClick = (claim: any) => {
    setSelectedClaim(claim);
    setShowCreditClaimModal(true);
  };

  const handleCreditClaimModalClose = () => {
    setShowCreditClaimModal(false);
    setSelectedClaim(null);
    // Trigger a custom event to refresh the credit claim button
    window.dispatchEvent(new CustomEvent('creditClaimSuccess'));
  };

  const handleCreditClaimSuccess = () => {
    // Refresh dashboard data if needed
    // The credit balances will be refreshed via the custom event
    // Close modal
    handleCreditClaimModalClose();
  };

  // Validate and update minutes with proper error handling
  const updateMinutes = useCallback(
    (value: number) => {
      try {
        // Validate input range
        if (value < 100 || value > 10000) {
          throw new Error(`Minutes must be between 100 and 10000, got ${value}`);
        }
        setDebouncedMinutes(value);
      } catch (error) {
        console.error('Error updating minutes:', error);
        // Reset to last valid value
        setDebouncedMinutes(1000);
      }
    },
    [setDebouncedMinutes]
  );

  // Debounce minutes update to prevent excessive recalculations with smoother response
  const debouncedUpdateMinutes = useMemo(
    () => debounce(updateMinutes, 50), // Reduced from 100ms to 50ms for smoother experience
    [updateMinutes]
  );

  // Define cost rates with proper typing for all providers
  const COST_RATES = {
    // Provider-specific platform fees and models
    providers: {
      vapi: {
        platformFee: 0.05, // VAPI platform fee (5¢ per minute)
        // LLM costs (per minute) - these are separate for VAPI
        llm: {
          'gpt-4.5-turbo': 0.104,
          'gpt-4o-mini': 0.01,
          'gpt-4-turbo': 0.20,
          'custom': 0.04,
          'gpt-4o-realtime': 0.49,
          'gpt-4o-mini-realtime': 0.17,
          'gemini-1.5-flash': 0.00315,
          'gemini-2.0-flash': 0.0315,
          // Add missing LLM options for compatibility
          'gpt-4o': 0.05,
          'gpt-4.1': 0.045,
          'gpt-4.1-mini': 0.016,
          'gpt-4.1-nano': 0.004,
          'claude-3.7-sonnet': 0.06,
          'claude-3.5-haiku': 0.02,
          'gemini-2.0-flash-lite': 0.003,
        },
        // TTS costs (per minute) - separate for VAPI
        tts: {
          'elevenlabs': 0.04,
          'playht': 0.07,
          'cartesia': 0.022,
          'rime-ai': 0.011,
          'lmnt': 0.058,
          'deepgram': 0.011,
          'neuphonic': 0.01,
          'smallest-ai': 0.02,
          'azure': 0.011,
        },
        // STT costs (per minute) - separate for VAPI
        stt: {
          'deepgram': 0.01,
          'talkscriber': 0.011,
          'assembly-ai': 0.008,
          'azure': 0.017,
          'elevenlabs': 0.007,
          'speechmatics': 0.017,
        },
      },
      retell: {
        platformFee: 0, // No platform fee for Retell
        // Voice engine costs (includes TTS) - per minute
        voiceEngine: {
          'elevenlabs': 0.07,
          'openai-cartesia': 0.08,
        },
        // LLM costs (per minute)
        llm: {
          'gpt-4.1': 0.045,
          'gpt-4.1-mini': 0.016,
          'gpt-4.1-nano': 0.004,
          'gpt-4o': 0.05,
          'gpt-4o-mini': 0.006,
          'claude-3.7-sonnet': 0.06,
          'claude-3.5-haiku': 0.02,
          'gemini-2.0-flash': 0.006,
          'gemini-2.0-flash-lite': 0.003,
          // Speech-to-speech alternatives
          'gpt-4o-realtime': 0.50,
          'gpt-4o-mini-realtime': 0.125,
        },
        // Telephony costs
        telephony: 0.015, // Retell Twilio rate
        // Add-ons
        knowledgeBase: 0.005, // per minute
        batchCall: 0.005, // per dial
        brandedCall: 0.010, // per outbound call
      },
      ultravox: {
        platformFee: 0, // No separate platform fee
        // All-inclusive rate (includes platform, LLM, TTS, STT)
        allInclusive: 0.05, // $0.05/min for pay-as-you-go
        allInclusiveScale: 0.045, // $0.045/min for scale plan
        freeMinutes: 30, // 30 free minutes one-time
      },
      knova: {
        platformFee: 0, // No separate platform fee
        // All-inclusive rate (includes platform, LLM, TTS, STT)
        allInclusive: 0.05, // $0.05/min same as Ultravox
        freeMinutes: 300, // 100 min per month for 3 months = 300 total
      }
    },
    // Shared telephony costs (for VAPI)
    telephony: {
      'twilio-inbound': 0.01,
      'twilio-outbound': 0.02,
      'vonage-outbound': 0.01
    },
    // Additional services
    email: 0.0001,
    sms: 0.01
  } as const;





  interface CalculatedCosts {
    total: string;
    breakdown: CostBreakdown;
  }

  // Calculate costs with comprehensive error handling and validation for all providers
  const calculatedCosts = useMemo<CalculatedCosts>(() => {
    try {
      // Validate minutes input with specific error messages
      if (typeof debouncedMinutes !== 'number') {
        throw new Error('Minutes must be a valid number');
      }
      if (debouncedMinutes < 100) {
        throw new Error(`Minutes must be at least 100, got ${debouncedMinutes}`);
      }
      if (debouncedMinutes > 10000) {
        throw new Error(`Minutes cannot exceed 10,000, got ${debouncedMinutes}`);
      }

      // Provider-specific cost calculations
      let platformCost = 0;
      let llmCost = 0;
      let ttsCost = 0;
      let sttCost = 0;
      let telephonyCost = 0;
      let totalCost = 0;

      if (selectedProvider === 'vapi') {
        // VAPI: Platform fee + separate component costs
        platformCost = COST_RATES.providers.vapi.platformFee * debouncedMinutes;

        if (!selectedLLM || !COST_RATES.providers.vapi.llm[selectedLLM]) {
          throw new Error(`Please select a valid Language Model for VAPI (got: ${selectedLLM || 'none'})`);
        }
        if (!selectedTTS || !COST_RATES.providers.vapi.tts[selectedTTS]) {
          throw new Error(`Please select a valid Text-to-Speech service for VAPI (got: ${selectedTTS || 'none'})`);
        }
        if (!selectedSTT || !COST_RATES.providers.vapi.stt[selectedSTT]) {
          throw new Error(`Please select a valid Speech-to-Text service for VAPI (got: ${selectedSTT || 'none'})`);
        }

        llmCost = COST_RATES.providers.vapi.llm[selectedLLM] * debouncedMinutes;
        ttsCost = COST_RATES.providers.vapi.tts[selectedTTS] * debouncedMinutes;
        sttCost = COST_RATES.providers.vapi.stt[selectedSTT] * debouncedMinutes;

        // Telephony cost for VAPI
        if (selectedMode !== 'browser') {
          if (!COST_RATES.telephony[selectedMode]) {
            throw new Error(`Invalid telephony mode: ${selectedMode}`);
          }
          telephonyCost = COST_RATES.telephony[selectedMode as Exclude<ModeType, 'browser'>] * debouncedMinutes;
        }
      }

      else if (selectedProvider === 'retell') {
        // Retell: Voice engine + LLM + telephony (no platform fee)
        // For simplicity, we'll use ElevenLabs voice engine as default
        const voiceEngineCost = COST_RATES.providers.retell.voiceEngine['elevenlabs'] * debouncedMinutes;

        // Map common LLM names to Retell-specific names or use defaults
        let retellLLMKey = 'gpt-4o-mini'; // Default
        if (selectedLLM === 'gpt-4o-mini') {
          retellLLMKey = 'gpt-4o-mini';
        } else if (selectedLLM === 'gpt-4o') {
          retellLLMKey = 'gpt-4o';
        } else if (selectedLLM === 'gpt-4o-realtime') {
          retellLLMKey = 'gpt-4o-realtime';
        } else if (selectedLLM === 'gpt-4o-mini-realtime') {
          retellLLMKey = 'gpt-4o-mini-realtime';
        } else if (selectedLLM === 'gemini-2.0-flash') {
          retellLLMKey = 'gemini-2.0-flash';
        }

        llmCost = COST_RATES.providers.retell.llm[retellLLMKey as keyof typeof COST_RATES.providers.retell.llm] * debouncedMinutes;

        // Voice engine cost includes TTS, so we set TTS to voice engine cost and STT to 0
        ttsCost = voiceEngineCost;
        sttCost = 0; // Included in voice engine

        // Telephony cost for Retell
        if (selectedMode !== 'browser') {
          telephonyCost = COST_RATES.providers.retell.telephony * debouncedMinutes;
        }
      }
      else if (selectedProvider === 'ultravox') {
        // Ultravox: All-inclusive pricing (platform + LLM + TTS + STT)
        const baseRate = COST_RATES.providers.ultravox.allInclusive;
        const freeMinutes = COST_RATES.providers.ultravox.freeMinutes;

        // Calculate billable minutes (subtract one-time free tier)
        const billableMinutes = Math.max(0, debouncedMinutes - freeMinutes);

        // All costs are included in the single rate
        platformCost = baseRate * billableMinutes;
        llmCost = 0; // Included in platform cost
        ttsCost = 0; // Included in platform cost
        sttCost = 0; // Included in platform cost

        // Add telephony cost for Ultravox (not included in all-inclusive rate)
        if (selectedMode !== 'browser') {
          telephonyCost = COST_RATES.telephony[selectedMode as keyof typeof COST_RATES.telephony] * debouncedMinutes;
        }
      }
      else if (selectedProvider === 'knova') {
        // Knova AI: All-inclusive pricing (same as Ultravox)
        const baseRate = COST_RATES.providers.knova.allInclusive;
        const freeMinutes = COST_RATES.providers.knova.freeMinutes;

        // Calculate billable minutes (subtract free tier)
        const billableMinutes = Math.max(0, debouncedMinutes - freeMinutes);

        // All costs are included in the single rate
        platformCost = baseRate * billableMinutes;
        llmCost = 0; // Included in platform cost
        ttsCost = 0; // Included in platform cost
        sttCost = 0; // Included in platform cost

        // Add telephony cost for Knova (not included in all-inclusive rate)
        if (selectedMode !== 'browser') {
          telephonyCost = COST_RATES.telephony[selectedMode as keyof typeof COST_RATES.telephony] * debouncedMinutes;
        }
      }

      // Calculate and validate additional service costs (available for all providers)
      const emailCost = selectedServices.email ? COST_RATES.email * debouncedMinutes : 0;
      if (selectedServices.email && (isNaN(emailCost) || !isFinite(emailCost))) {
        throw new Error('Error calculating email notification cost');
      }

      const smsCost = selectedServices.sms ? COST_RATES.sms * debouncedMinutes : 0;
      if (selectedServices.sms && (isNaN(smsCost) || !isFinite(smsCost))) {
        throw new Error('Error calculating SMS notification cost');
      }

      // Calculate total cost
      totalCost = platformCost + llmCost + ttsCost + sttCost + telephonyCost + emailCost + smsCost;

      // Validate all costs
      if (isNaN(platformCost) || !isFinite(platformCost)) {
        throw new Error('Error calculating platform cost');
      }
      if (isNaN(llmCost) || !isFinite(llmCost)) {
        throw new Error('Error calculating LLM cost');
      }
      if (isNaN(ttsCost) || !isFinite(ttsCost)) {
        throw new Error('Error calculating TTS cost');
      }
      if (isNaN(sttCost) || !isFinite(sttCost)) {
        throw new Error('Error calculating STT cost');
      }
      if (isNaN(telephonyCost) || !isFinite(telephonyCost)) {
        throw new Error('Error calculating telephony cost');
      }
      if (isNaN(totalCost) || !isFinite(totalCost)) {
        throw new Error('Invalid total cost calculation');
      }

      // Format costs with validation
      const formatCost = (cost: number, precision: number = 2) => {
        const formatted = cost.toFixed(precision);
        if (formatted === 'NaN') {
          throw new Error('Error formatting cost value');
        }
        return formatted;
      };

      return {
        total: formatCost(totalCost),
        breakdown: {
          platform: formatCost(platformCost), // Use platform instead of vapi for consistency
          llm: formatCost(llmCost),
          tts: formatCost(ttsCost),
          stt: formatCost(sttCost),
          telephony: formatCost(telephonyCost),
          email: formatCost(emailCost, 4),
          sms: formatCost(smsCost)
        }
      };
    } catch (error) {
      // Log error with detailed information
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error calculating costs:', {
        message: errorMessage,
        minutes: debouncedMinutes,
        llm: selectedLLM,
        tts: selectedTTS,
        stt: selectedSTT,
        mode: selectedMode,
        services: selectedServices,
        error
      });

      // Log error for debugging
      console.error('Calculator error:', errorMessage);

      return {
        total: '0.00',
        breakdown: {
          vapi: '0.00',
          llm: '0.00',
          tts: '0.00',
          stt: '0.00',
          telephony: '0.00',
          email: '0.0000',
          sms: '0.00'
        }
      };
    }
  }, [debouncedMinutes, selectedProvider, selectedLLM, selectedTTS, selectedSTT, selectedMode, selectedServices])

  const PricingCalculatorModal = () => {
    // Define voice providers with proper typing
    interface VoiceProvider {
      id: string;
      name: string;
      status: 'active' | 'coming_soon';
    }

    const voiceProviders: VoiceProvider[] = [
      { id: 'vapi', name: 'VAPI AI', status: 'active' },
      { id: 'retell', name: 'Retell AI', status: 'active' },
      { id: 'ultravox', name: 'Ultravox AI', status: 'active' },
      { id: 'knova', name: 'Knova AI', status: 'active' },
      { id: 'ghl', name: 'Go High Level', status: 'active' },
      { id: 'elevenlabs', name: 'ElevenLabs Voice AI', status: 'coming_soon' }
    ];



    // Common minutes selector component
    const MinutesSelector = () => (
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Estimated Minutes per Month
        </label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="100"
            max="10000"
            step="100"
            value={selectedMinutes}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const value = Number(e.target.value);
              if (value >= 100 && value <= 10000) {
                setSelectedMinutes(value);
                debouncedUpdateMinutes(value);
              }
            }}
            className="flex-1 h-2 bg-gradient-to-r from-gray-800 to-gray-800/80 border border-blue-500/20 rounded-lg appearance-none cursor-pointer focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-blue-500 [&::-webkit-slider-thumb]:to-blue-400 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:hover:from-blue-400 [&::-webkit-slider-thumb]:hover:to-blue-300 [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-blue-500/20"
          />
          <input
            type="number"
            value={selectedMinutes}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const value = Number(e.target.value);
              if (value >= 100 && value <= 10000) {
                setSelectedMinutes(value);
                debouncedUpdateMinutes(value);
              }
            }}
            className="w-28 px-4 py-2.5 bg-gradient-to-r from-gray-800 to-gray-800/80 border border-blue-500/20 rounded-lg text-center text-white font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors"
          />
        </div>
      </div>
    );

    return (
      <Transition appear show={isPricingModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsPricingModalOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/80" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-gradient-to-b from-gray-900 to-black p-8 shadow-xl transition-all border border-blue-500/30">
                  <div className="flex justify-between items-center mb-8">
                    <Dialog.Title className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">
                      Voice AI Pricing Calculator
                    </Dialog.Title>
                    <button
                      onClick={() => setIsPricingModalOpen(false)}
                      className="p-2 rounded-lg hover:bg-gray-800/50 transition-colors group"
                    >
                      <FiX className="w-6 h-6 text-gray-400 group-hover:text-white transition-colors" />
                    </button>
                  </div>

                  <Tab.Group selectedIndex={selectedProvider === 'vapi' ? 0 : selectedProvider === 'retell' ? 1 : selectedProvider === 'ultravox' ? 2 : selectedProvider === 'knova' ? 3 : 4} onChange={(index) => {
                    const activeProviders = voiceProviders.filter(p => p.status === 'active');
                    if (activeProviders[index]) {
                      setSelectedProvider(activeProviders[index].id as 'vapi' | 'retell' | 'ultravox' | 'knova' | 'ghl');
                    }
                  }}>
                    <Tab.List className="flex space-x-2 rounded-xl bg-gradient-to-r from-blue-500/10 to-teal-500/10 p-1.5 mb-8 border border-blue-500/20">
                      {voiceProviders.map((provider) => (
                        <Tab
                          key={provider.id}
                          disabled={provider.status === 'coming_soon'}
                          className={({ selected }) =>
                            clsx(
                              'w-full rounded-lg py-3 text-sm font-medium leading-5 transition-all duration-200',
                              'focus:outline-none',
                              selected
                                ? 'bg-gradient-to-r from-blue-500 to-teal-500 text-white shadow-lg shadow-blue-500/20'
                                : provider.status === 'coming_soon'
                                ? 'text-gray-500 cursor-not-allowed'
                                : 'text-gray-300 hover:text-white hover:bg-white/5'
                            )
                          }
                        >
                          {provider.name}
                          {provider.status === 'coming_soon' && (
                            <span className="ml-2 text-xs">(Coming Soon)</span>
                          )}
                        </Tab>
                      ))}
                    </Tab.List>

                    <Tab.Panels>
                      {/* VAPI Tab Panel */}
                      <Tab.Panel>
                        <div className="space-y-6">
                          <MinutesSelector />

                          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
                            <h4 className="text-sm font-medium text-blue-300 mb-2">VAPI Pricing Model</h4>
                            <p className="text-xs text-gray-400">
                              VAPI charges a platform fee of $0.05/minute plus separate costs for LLM, TTS, STT, and telephony services.
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-6">
                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-3">
                                Language Model
                              </label>
                              <select
                                value={selectedLLM}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedLLM(e.target.value as LLMType)}
                                className="w-full px-4 py-2.5 bg-gradient-to-r from-gray-800 to-gray-800/80 border border-blue-500/20 rounded-lg text-white font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors hover:border-blue-400/50 appearance-none [&>option]:bg-gray-800"
                              >
                                <option value="gpt-4.5-turbo" className="bg-slate-800">GPT-4.5 Turbo ($0.104/min)</option>
                                <option value="gpt-4o-mini" className="bg-slate-800">GPT-4O Mini ($0.01/min)</option>
                                <option value="gpt-4-turbo" className="bg-slate-800">GPT-4 Turbo ($0.20/min)</option>
                                <option value="custom" className="bg-slate-800">Custom Model ($0.04/min)</option>
                                <option value="gpt-4o-realtime" className="bg-slate-800">GPT-4O Realtime ($0.49/min)</option>
                                <option value="gpt-4o-mini-realtime" className="bg-slate-800">GPT-4O Mini Realtime ($0.17/min)</option>
                                <option value="gemini-1.5-flash" className="bg-slate-800">Gemini 1.5 Flash ($0.00315/min)</option>
                                <option value="gemini-2.0-flash" className="bg-slate-800">Gemini 2.0 Flash ($0.0315/min)</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-3">
                                Text-to-Speech
                              </label>
                              <select
                                value={selectedTTS}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedTTS(e.target.value as TTSType)}
                                className="w-full px-4 py-2.5 bg-gradient-to-r from-gray-800 to-gray-800/80 border border-blue-500/20 rounded-lg text-white font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors hover:border-blue-400/50 appearance-none [&>option]:bg-gray-800"
                              >
                                <option value="elevenlabs" className="bg-slate-800">ElevenLabs ($0.04/min)</option>
                                <option value="playht" className="bg-slate-800">PlayHT ($0.07/min)</option>
                                <option value="cartesia" className="bg-slate-800">Cartesia ($0.022/min)</option>
                                <option value="rime-ai" className="bg-slate-800">Rime AI ($0.011/min)</option>
                                <option value="lmnt" className="bg-slate-800">LMNT ($0.058/min)</option>
                                <option value="deepgram" className="bg-slate-800">Deepgram ($0.011/min)</option>
                                <option value="neuphonic" className="bg-slate-800">Neuphonic ($0.01/min)</option>
                                <option value="smallest-ai" className="bg-slate-800">Smallest AI ($0.02/min)</option>
                                <option value="azure" className="bg-slate-800">Azure ($0.011/min)</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-3">
                                Speech-to-Text
                              </label>
                              <select
                                value={selectedSTT}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedSTT(e.target.value as STTType)}
                                className="w-full px-4 py-2.5 bg-gradient-to-r from-gray-800 to-gray-800/80 border border-blue-500/20 rounded-lg text-white font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors hover:border-blue-400/50 appearance-none [&>option]:bg-gray-800"
                              >
                                <option value="deepgram" className="bg-slate-800">Deepgram ($0.01/min)</option>
                                <option value="talkscriber" className="bg-slate-800">Talkscriber ($0.011/min)</option>
                                <option value="assembly-ai" className="bg-slate-800">Assembly AI ($0.008/min)</option>
                                <option value="azure" className="bg-slate-800">Azure ($0.017/min)</option>
                                <option value="elevenlabs" className="bg-slate-800">ElevenLabs ($0.007/min)</option>
                                <option value="speechmatics" className="bg-slate-800">Speechmatics ($0.017/min)</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-3">
                                Mode
                              </label>
                              <select
                                value={selectedMode}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedMode(e.target.value as ModeType)}
                                className="w-full px-4 py-2.5 bg-gradient-to-r from-gray-800 to-gray-800/80 border border-blue-500/20 rounded-lg text-white font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors hover:border-blue-400/50 appearance-none [&>option]:bg-gray-800"
                              >
                                <option value="browser" className="bg-slate-800">Browser (Free)</option>
                                <option value="twilio-inbound" className="bg-slate-800">Twilio - Inbound ($0.01/min)</option>
                                <option value="twilio-outbound" className="bg-slate-800">Twilio - Outbound ($0.02/min)</option>
                                <option value="vonage-outbound" className="bg-slate-800">Vonage - Outbound ($0.01/min)</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-3">
                              Additional Services
                            </label>
                            <div className="flex gap-6">
                              <label className="flex items-center gap-3 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={selectedServices.email}
                                  onChange={(e) => setSelectedServices(prev => ({
                                    ...prev,
                                    email: e.target.checked
                                  }))}
                                  className="w-5 h-5 rounded border-2 border-blue-500/30 bg-gray-800 text-blue-500 focus:ring-0 focus:ring-offset-0 transition-colors hover:border-blue-400/50 checked:bg-gradient-to-r checked:from-blue-500 checked:to-blue-400 checked:border-0"
                                />
                                <span className="text-gray-300 group-hover:text-white transition-colors">Email Notifications</span>
                              </label>
                              <label className="flex items-center gap-3 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={selectedServices.sms}
                                  onChange={(e) => setSelectedServices(prev => ({
                                    ...prev,
                                    sms: e.target.checked
                                  }))}
                                  className="w-5 h-5 rounded border-2 border-blue-500/30 bg-gray-800 text-blue-500 focus:ring-0 focus:ring-offset-0 transition-colors hover:border-blue-400/50 checked:bg-gradient-to-r checked:from-blue-500 checked:to-blue-400 checked:border-0"
                                />
                                <span className="text-gray-300 group-hover:text-white transition-colors">SMS Notifications</span>
                              </label>
                            </div>
                          </div>

                          <div className="mt-10 space-y-6">
                            <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">Estimated Monthly Costs</h3>
                            <div className="bg-gradient-to-r from-gray-800 to-gray-800/80 rounded-xl p-6 border border-blue-500/20 shadow-lg shadow-black/10 transition-all duration-300 ease-in-out">
                              <style jsx>{`
                                .cost-value {
                                  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                                }
                              `}</style>
                              <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-4">
                                  <div className="flex justify-between items-center text-sm group hover:bg-blue-500/5 p-2 rounded-lg transition-colors">
                                    <div>
                                      <span className="text-gray-300 font-medium">VAPI Platform</span>
                                      <div className="text-xs text-gray-500">Base platform fee</div>
                                    </div>
                                    <span className="font-semibold text-transparent bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text cost-value group-hover:scale-105 transition-transform">
                                      ${calculatedCosts.breakdown.platform}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center text-sm group hover:bg-blue-500/5 p-2 rounded-lg transition-colors">
                                    <div>
                                      <span className="text-gray-300 font-medium">Language Model</span>
                                      <div className="text-xs text-gray-500">{selectedLLM}</div>
                                    </div>
                                    <span className="font-semibold text-transparent bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text cost-value group-hover:scale-105 transition-transform">
                                      ${calculatedCosts.breakdown.llm}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center text-sm group hover:bg-blue-500/5 p-2 rounded-lg transition-colors">
                                    <div>
                                      <span className="text-gray-300 font-medium">Text-to-Speech</span>
                                      <div className="text-xs text-gray-500">{selectedTTS}</div>
                                    </div>
                                    <span className="font-semibold text-transparent bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text cost-value group-hover:scale-105 transition-transform">
                                      ${calculatedCosts.breakdown.tts}
                                    </span>
                                  </div>
                                </div>
                                <div className="space-y-4">
                                  <div className="flex justify-between items-center text-sm group hover:bg-blue-500/5 p-2 rounded-lg transition-colors">
                                    <div>
                                      <span className="text-gray-300 font-medium">Speech-to-Text</span>
                                      <div className="text-xs text-gray-500">{selectedSTT}</div>
                                    </div>
                                    <span className="font-semibold text-transparent bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text cost-value group-hover:scale-105 transition-transform">
                                      ${calculatedCosts.breakdown.stt}
                                    </span>
                                  </div>
                                  {selectedMode !== 'browser' && (
                                    <div className="flex justify-between items-center text-sm group hover:bg-blue-500/5 p-2 rounded-lg transition-colors">
                                      <div>
                                        <span className="text-gray-300 font-medium">Telephony</span>
                                        <div className="text-xs text-gray-500">{selectedMode}</div>
                                      </div>
                                      <span className="font-semibold text-transparent bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text cost-value group-hover:scale-105 transition-transform">
                                        ${calculatedCosts.breakdown.telephony}
                                      </span>
                                    </div>
                                  )}
                                  {selectedServices.email && (
                                    <div className="flex justify-between items-center text-sm group hover:bg-blue-500/5 p-2 rounded-lg transition-colors">
                                      <div>
                                        <span className="text-gray-300 font-medium">Email Notifications</span>
                                        <div className="text-xs text-gray-500">Total monthly cost</div>
                                      </div>
                                      <span className="font-semibold text-transparent bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text cost-value group-hover:scale-105 transition-transform">
                                        ${calculatedCosts.breakdown.email}
                                      </span>
                                    </div>
                                  )}
                                  {selectedServices.sms && (
                                    <div className="flex justify-between items-center text-sm group hover:bg-blue-500/5 p-2 rounded-lg transition-colors">
                                      <div>
                                        <span className="text-gray-300 font-medium">SMS Notifications</span>
                                        <div className="text-xs text-gray-500">Total monthly cost</div>
                                      </div>
                                      <span className="font-semibold text-transparent bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text cost-value group-hover:scale-105 transition-transform">
                                        ${calculatedCosts.breakdown.sms}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="pt-6 mt-6 border-t border-blue-500/20">
                              <div className="flex justify-between items-center">
                                <div>
                                  <span className="text-xl font-semibold text-transparent bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text">Total Estimated Cost</span>
                                  <div className="text-sm text-gray-500 mt-1">Based on {selectedMinutes.toLocaleString()} minutes per month</div>
                                </div>
                                <span className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent cost-value hover:scale-105 transition-transform">
                                  ${calculatedCosts.total}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Tab.Panel>

                      {/* Retell Tab Panel */}
                      <Tab.Panel>
                        <div className="space-y-6">
                          <MinutesSelector />

                          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mb-6">
                            <h4 className="text-sm font-medium text-green-300 mb-2">Retell Pricing Model</h4>
                            <p className="text-xs text-gray-400">
                              Retell uses component-based pricing with no platform fees. Starting at $0.07/min for voice engine + LLM costs.
                            </p>
                          </div>

                          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                            <h4 className="text-sm font-medium text-amber-300 mb-2">Simplified Configuration</h4>
                            <p className="text-xs text-gray-400 mb-3">
                              For this calculator, we're using ElevenLabs voice engine ($0.07/min) with your selected LLM.
                            </p>
                            <div className="grid grid-cols-2 gap-4 text-xs">
                              <div>
                                <span className="text-gray-300 font-medium">Voice Engine:</span>
                                <div className="text-gray-400">ElevenLabs ($0.07/min)</div>
                              </div>
                              <div>
                                <span className="text-gray-300 font-medium">Telephony:</span>
                                <div className="text-gray-400">Retell Twilio ($0.015/min)</div>
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-3">
                              Additional Services
                            </label>
                            <div className="flex gap-6">
                              <label className="flex items-center gap-3 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={selectedServices.email}
                                  onChange={(e) => setSelectedServices(prev => ({
                                    ...prev,
                                    email: e.target.checked
                                  }))}
                                  className="w-5 h-5 rounded border-2 border-green-500/30 bg-gray-800 text-green-500 focus:ring-0 focus:ring-offset-0 transition-colors hover:border-green-400/50 checked:bg-gradient-to-r checked:from-green-500 checked:to-green-400 checked:border-0"
                                />
                                <span className="text-gray-300 group-hover:text-white transition-colors">Email Notifications</span>
                              </label>
                              <label className="flex items-center gap-3 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={selectedServices.sms}
                                  onChange={(e) => setSelectedServices(prev => ({
                                    ...prev,
                                    sms: e.target.checked
                                  }))}
                                  className="w-5 h-5 rounded border-2 border-green-500/30 bg-gray-800 text-green-500 focus:ring-0 focus:ring-offset-0 transition-colors hover:border-green-400/50 checked:bg-gradient-to-r checked:from-green-500 checked:to-green-400 checked:border-0"
                                />
                                <span className="text-gray-300 group-hover:text-white transition-colors">SMS Notifications</span>
                              </label>
                            </div>
                          </div>

                          <div className="mt-10 space-y-6">
                            <h3 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent">Estimated Monthly Costs</h3>
                            <div className="bg-gradient-to-r from-gray-800 to-gray-800/80 rounded-xl p-6 border border-green-500/20 shadow-lg shadow-black/10">
                              <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-4">
                                  <div className="flex justify-between items-center text-sm group hover:bg-green-500/5 p-2 rounded-lg transition-colors">
                                    <div>
                                      <span className="text-gray-300 font-medium">Voice Engine</span>
                                      <div className="text-xs text-gray-500">ElevenLabs TTS included</div>
                                    </div>
                                    <span className="font-semibold text-transparent bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text">
                                      ${calculatedCosts.breakdown.tts}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center text-sm group hover:bg-green-500/5 p-2 rounded-lg transition-colors">
                                    <div>
                                      <span className="text-gray-300 font-medium">Language Model</span>
                                      <div className="text-xs text-gray-500">GPT-4O Mini (default)</div>
                                    </div>
                                    <span className="font-semibold text-transparent bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text">
                                      ${calculatedCosts.breakdown.llm}
                                    </span>
                                  </div>
                                </div>
                                <div className="space-y-4">
                                  <div className="flex justify-between items-center text-sm group hover:bg-green-500/5 p-2 rounded-lg transition-colors">
                                    <div>
                                      <span className="text-gray-300 font-medium">Telephony</span>
                                      <div className="text-xs text-gray-500">Retell Twilio</div>
                                    </div>
                                    <span className="font-semibold text-transparent bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text">
                                      ${calculatedCosts.breakdown.telephony}
                                    </span>
                                  </div>
                                  {selectedServices.email && (
                                    <div className="flex justify-between items-center text-sm group hover:bg-green-500/5 p-2 rounded-lg transition-colors">
                                      <div>
                                        <span className="text-gray-300 font-medium">Email Notifications</span>
                                        <div className="text-xs text-gray-500">Total monthly cost</div>
                                      </div>
                                      <span className="font-semibold text-transparent bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text">
                                        ${calculatedCosts.breakdown.email}
                                      </span>
                                    </div>
                                  )}
                                  {selectedServices.sms && (
                                    <div className="flex justify-between items-center text-sm group hover:bg-green-500/5 p-2 rounded-lg transition-colors">
                                      <div>
                                        <span className="text-gray-300 font-medium">SMS Notifications</span>
                                        <div className="text-xs text-gray-500">Total monthly cost</div>
                                      </div>
                                      <span className="font-semibold text-transparent bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text">
                                        ${calculatedCosts.breakdown.sms}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="pt-6 mt-6 border-t border-green-500/20">
                              <div className="flex justify-between items-center">
                                <div>
                                  <span className="text-xl font-semibold text-transparent bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text">Total Estimated Cost</span>
                                  <div className="text-sm text-gray-500 mt-1">Based on {selectedMinutes.toLocaleString()} minutes per month</div>
                                </div>
                                <span className="text-3xl font-bold bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent">
                                  ${calculatedCosts.total}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Tab.Panel>

                      {/* Ultravox Tab Panel */}
                      <Tab.Panel>
                        <div className="space-y-6">
                          <MinutesSelector />

                          <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4 mb-6">
                            <h4 className="text-sm font-medium text-purple-300 mb-2">Ultravox Pricing Model</h4>
                            <p className="text-xs text-gray-400">
                              Ultravox offers simple all-inclusive pricing at $0.05/min with 30 free minutes one-time. No separate component costs.
                            </p>
                          </div>

                          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                            <h4 className="text-sm font-medium text-blue-300 mb-2">What's Included</h4>
                            <div className="grid grid-cols-2 gap-4 text-xs">
                              <div>
                                <span className="text-gray-300 font-medium">✓ Platform Access</span>
                                <div className="text-gray-400">Infrastructure & routing</div>
                              </div>
                              <div>
                                <span className="text-gray-300 font-medium">✓ AI Models</span>
                                <div className="text-gray-400">LLM processing included</div>
                              </div>
                              <div>
                                <span className="text-gray-300 font-medium">✓ Voice Services</span>
                                <div className="text-gray-400">TTS & STT included</div>
                              </div>
                              <div>
                                <span className="text-gray-300 font-medium">✓ Free Tier</span>
                                <div className="text-gray-400">30 minutes one-time free</div>
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-3">
                              Additional Services
                            </label>
                            <div className="flex gap-6">
                              <label className="flex items-center gap-3 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={selectedServices.email}
                                  onChange={(e) => setSelectedServices(prev => ({
                                    ...prev,
                                    email: e.target.checked
                                  }))}
                                  className="w-5 h-5 rounded border-2 border-purple-500/30 bg-gray-800 text-purple-500 focus:ring-0 focus:ring-offset-0 transition-colors hover:border-purple-400/50 checked:bg-gradient-to-r checked:from-purple-500 checked:to-purple-400 checked:border-0"
                                />
                                <span className="text-gray-300 group-hover:text-white transition-colors">Email Notifications</span>
                              </label>
                              <label className="flex items-center gap-3 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={selectedServices.sms}
                                  onChange={(e) => setSelectedServices(prev => ({
                                    ...prev,
                                    sms: e.target.checked
                                  }))}
                                  className="w-5 h-5 rounded border-2 border-purple-500/30 bg-gray-800 text-purple-500 focus:ring-0 focus:ring-offset-0 transition-colors hover:border-purple-400/50 checked:bg-gradient-to-r checked:from-purple-500 checked:to-purple-400 checked:border-0"
                                />
                                <span className="text-gray-300 group-hover:text-white transition-colors">SMS Notifications</span>
                              </label>
                            </div>
                          </div>

                          <div className="mt-10 space-y-6">
                            <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Estimated Monthly Costs</h3>
                            <div className="bg-gradient-to-r from-gray-800 to-gray-800/80 rounded-xl p-6 border border-purple-500/20 shadow-lg shadow-black/10 transition-all duration-300 ease-in-out">
                              <style jsx>{`
                                .cost-value {
                                  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                                }
                              `}</style>
                              <div className="space-y-4">
                                <div className="flex justify-between items-center text-sm group hover:bg-purple-500/5 p-2 rounded-lg transition-colors">
                                  <div>
                                    <span className="text-gray-300 font-medium">All-Inclusive Rate</span>
                                    <div className="text-xs text-gray-500">Platform + LLM + TTS + STT</div>
                                  </div>
                                  <span className="font-semibold cost-value group-hover:scale-105 transition-transform" style={{ color: '#c084fc !important' }}>
                                    ${calculatedCosts.breakdown.platform}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center text-sm group hover:bg-purple-500/5 p-2 rounded-lg transition-colors">
                                  <div>
                                    <span className="text-gray-300 font-medium">Free Minutes</span>
                                    <div className="text-xs text-gray-500">30 minutes one-time free</div>
                                  </div>
                                  <span className="font-semibold text-green-400">
                                    FREE
                                  </span>
                                </div>
                                {selectedMode !== 'browser' && (
                                  <div className="flex justify-between items-center text-sm group hover:bg-purple-500/5 p-2 rounded-lg transition-colors">
                                    <div>
                                      <span className="text-gray-300 font-medium">Telephony</span>
                                      <div className="text-xs text-gray-500">{selectedMode}</div>
                                    </div>
                                    <span className="font-semibold" style={{ color: '#c084fc !important' }}>
                                      ${calculatedCosts.breakdown.telephony}
                                    </span>
                                  </div>
                                )}
                                {selectedServices.email && (
                                  <div className="flex justify-between items-center text-sm group hover:bg-purple-500/5 p-2 rounded-lg transition-colors">
                                    <div>
                                      <span className="text-gray-300 font-medium">Email Notifications</span>
                                      <div className="text-xs text-gray-500">Total monthly cost</div>
                                    </div>
                                    <span className="font-semibold" style={{ color: '#c084fc !important' }}>
                                      ${calculatedCosts.breakdown.email}
                                    </span>
                                  </div>
                                )}
                                {selectedServices.sms && (
                                  <div className="flex justify-between items-center text-sm group hover:bg-purple-500/5 p-2 rounded-lg transition-colors">
                                    <div>
                                      <span className="text-gray-300 font-medium">SMS Notifications</span>
                                      <div className="text-xs text-gray-500">Total monthly cost</div>
                                    </div>
                                    <span className="font-semibold" style={{ color: '#c084fc !important' }}>
                                      ${calculatedCosts.breakdown.sms}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="pt-6 mt-6 border-t border-purple-500/20">
                              <div className="flex justify-between items-center">
                                <div>
                                  <span className="text-xl font-semibold" style={{ color: '#c084fc !important' }}>Total Estimated Cost</span>
                                  <div className="text-sm text-gray-500 mt-1">Based on {selectedMinutes.toLocaleString()} minutes per month</div>
                                </div>
                                <span className="text-3xl font-bold" style={{ color: '#c084fc !important' }}>
                                  ${calculatedCosts.total}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Tab.Panel>

                      {/* Knova AI Tab Panel */}
                      <Tab.Panel className="space-y-6">
                        <div className="space-y-6">
                          <MinutesSelector />

                          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mb-6">
                            <h4 className="text-sm font-medium text-green-300 mb-2">Knova AI Pricing Model</h4>
                            <p className="text-xs text-gray-400">
                              Knova AI offers simple all-inclusive pricing at $0.05/min with 100 free minutes per month for 3 months (or check your Credit page for exclusive offers). No separate component costs.
                            </p>
                          </div>

                          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                            <h4 className="text-sm font-medium text-blue-300 mb-2">What's Included</h4>
                            <div className="grid grid-cols-2 gap-4 text-xs">
                              <div>
                                <span className="text-gray-300 font-medium">✓ Platform Access</span>
                                <div className="text-gray-400">Infrastructure & routing</div>
                              </div>
                              <div>
                                <span className="text-gray-300 font-medium">✓ AI Models</span>
                                <div className="text-gray-400">LLM processing included</div>
                              </div>
                              <div>
                                <span className="text-gray-300 font-medium">✓ Voice Services</span>
                                <div className="text-gray-400">TTS & STT included</div>
                              </div>
                              <div>
                                <span className="text-gray-300 font-medium">✓ Free Tier</span>
                                <div className="text-gray-400">100 min/month for 3 months</div>
                              </div>
                            </div>
                          </div>

                          <div>
                            <h4 className="text-sm font-medium text-gray-300 mb-4">Mode Selection</h4>
                            <div className="grid grid-cols-2 gap-3 mb-6">
                              {(['browser', 'vonage-outbound', 'twilio-outbound', 'twilio-inbound'] as const).map((mode) => (
                                <label key={mode} className="flex items-center gap-3 cursor-pointer group">
                                  <input
                                    type="radio"
                                    name="ultravox-mode"
                                    value={mode}
                                    checked={selectedMode === mode}
                                    onChange={(e) => setSelectedMode(e.target.value as ModeType)}
                                    className="w-4 h-4 text-purple-500 bg-gray-800 border-purple-500/30 focus:ring-purple-500 focus:ring-2"
                                  />
                                  <span className="text-gray-300 group-hover:text-white transition-colors text-sm">
                                    {mode === 'browser' ? 'Browser Only' :
                                     mode === 'vonage-outbound' ? 'Vonage Outbound' :
                                     mode === 'twilio-outbound' ? 'Twilio Outbound' : 'Twilio Inbound'}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>

                          <div>
                            <h4 className="text-sm font-medium text-gray-300 mb-4">Mode Selection</h4>
                            <div className="grid grid-cols-2 gap-3 mb-6">
                              {(['browser', 'vonage-outbound', 'twilio-outbound', 'twilio-inbound'] as const).map((mode) => (
                                <label key={mode} className="flex items-center gap-3 cursor-pointer group">
                                  <input
                                    type="radio"
                                    name="knova-mode"
                                    value={mode}
                                    checked={selectedMode === mode}
                                    onChange={(e) => setSelectedMode(e.target.value as ModeType)}
                                    className="w-4 h-4 text-green-500 bg-gray-800 border-green-500/30 focus:ring-green-500 focus:ring-2"
                                  />
                                  <span className="text-gray-300 group-hover:text-white transition-colors text-sm">
                                    {mode === 'browser' ? 'Browser Only' :
                                     mode === 'vonage-outbound' ? 'Vonage Outbound' :
                                     mode === 'twilio-outbound' ? 'Twilio Outbound' : 'Twilio Inbound'}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>

                          <div>
                            <h4 className="text-sm font-medium text-gray-300 mb-4">Additional Services</h4>
                            <div className="space-y-3">
                              <label className="flex items-center gap-3 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={selectedServices.email}
                                  onChange={(e) => setSelectedServices(prev => ({
                                    ...prev,
                                    email: e.target.checked
                                  }))}
                                  className="w-5 h-5 rounded border-2 border-green-500/30 bg-gray-800 text-green-500 focus:ring-0 focus:ring-offset-0 transition-colors hover:border-green-400/50 checked:bg-gradient-to-r checked:from-green-500 checked:to-green-400 checked:border-0"
                                />
                                <span className="text-gray-300 group-hover:text-white transition-colors">Email Notifications</span>
                              </label>
                              <label className="flex items-center gap-3 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={selectedServices.sms}
                                  onChange={(e) => setSelectedServices(prev => ({
                                    ...prev,
                                    sms: e.target.checked
                                  }))}
                                  className="w-5 h-5 rounded border-2 border-green-500/30 bg-gray-800 text-green-500 focus:ring-0 focus:ring-offset-0 transition-colors hover:border-green-400/50 checked:bg-gradient-to-r checked:from-green-500 checked:to-green-400 checked:border-0"
                                />
                                <span className="text-gray-300 group-hover:text-white transition-colors">SMS Notifications</span>
                              </label>
                            </div>
                          </div>

                          <div className="mt-10 space-y-6">
                            <h3 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">Estimated Monthly Costs</h3>
                            <div className="bg-gradient-to-r from-gray-800 to-gray-800/80 rounded-xl p-6 border border-green-500/20 shadow-lg shadow-black/10 transition-all duration-300 ease-in-out">
                              <style jsx>{`
                                .cost-value {
                                  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                                }
                              `}</style>
                              <div className="space-y-4">
                                <div className="flex justify-between items-center text-sm group hover:bg-green-500/5 p-2 rounded-lg transition-colors">
                                  <div>
                                    <span className="text-gray-300 font-medium">All-Inclusive Rate</span>
                                    <div className="text-xs text-gray-500">Platform + LLM + TTS + STT</div>
                                  </div>
                                  <span className="font-semibold text-green-400 cost-value group-hover:scale-105 transition-transform">
                                    ${calculatedCosts.breakdown.platform}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center text-sm group hover:bg-green-500/5 p-2 rounded-lg transition-colors">
                                  <div>
                                    <span className="text-gray-300 font-medium">Free Minutes</span>
                                    <div className="text-xs text-gray-500">100 min/month for 3 months</div>
                                  </div>
                                  <span className="font-semibold text-green-400">
                                    FREE
                                  </span>
                                </div>
                                {selectedMode !== 'browser' && (
                                  <div className="flex justify-between items-center text-sm group hover:bg-green-500/5 p-2 rounded-lg transition-colors">
                                    <div>
                                      <span className="text-gray-300 font-medium">Telephony</span>
                                      <div className="text-xs text-gray-500">{selectedMode}</div>
                                    </div>
                                    <span className="font-semibold text-green-400">
                                      ${calculatedCosts.breakdown.telephony}
                                    </span>
                                  </div>
                                )}
                                {selectedServices.email && (
                                  <div className="flex justify-between items-center text-sm group hover:bg-green-500/5 p-2 rounded-lg transition-colors">
                                    <div>
                                      <span className="text-gray-300 font-medium">Email Notifications</span>
                                      <div className="text-xs text-gray-500">Total monthly cost</div>
                                    </div>
                                    <span className="font-semibold text-green-400">
                                      ${calculatedCosts.breakdown.email}
                                    </span>
                                  </div>
                                )}
                                {selectedServices.sms && (
                                  <div className="flex justify-between items-center text-sm group hover:bg-green-500/5 p-2 rounded-lg transition-colors">
                                    <div>
                                      <span className="text-gray-300 font-medium">SMS Notifications</span>
                                      <div className="text-xs text-gray-500">Total monthly cost</div>
                                    </div>
                                    <span className="font-semibold text-green-400">
                                      ${calculatedCosts.breakdown.sms}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="pt-6 mt-6 border-t border-green-500/20">
                              <div className="flex justify-between items-center">
                                <div>
                                  <span className="text-xl font-semibold text-transparent bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text">Total Estimated Cost</span>
                                  <div className="text-sm text-gray-500 mt-1">Based on {selectedMinutes.toLocaleString()} minutes per month</div>
                                </div>
                                <span className="text-3xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                                  ${calculatedCosts.total}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Tab.Panel>
                    </Tab.Panels>
                  </Tab.Group>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Customer view
  if (selectedCustomer) {
    return (
      <CustomerHomeView
        customerData={selectedCustomer}
        onBack={() => {
          setSelectedCustomer(null);
          fetch('/api/partner/customers').then(response => response.json()).then(data => setCustomers(data));
        }}
      />
    );
  }

  // Enhanced MetricCard with visual improvements
  const MetricCard = ({
    icon: Icon,
    title,
    value,
    subtitle,
    trend,
    trendValue,
    type = 'default'
  }: {
    icon: any,
    title: string,
    value: string | number,
    subtitle?: string,
    trend?: 'up' | 'down' | 'neutral',
    trendValue?: string,
    type?: 'default' | 'percentage' | 'currency' | 'calls'
  }) => {
    const getTrendIcon = () => {
      if (trend === 'up') return <FiArrowUp className="w-4 h-4 text-green-400" />;
      if (trend === 'down') return <FiArrowDown className="w-4 h-4 text-red-400" />;
      return null;
    };

    const getIconColor = () => {
      switch (type) {
        case 'currency': return 'text-green-400 bg-green-400/10';
        case 'calls': return 'text-blue-400 bg-blue-400/10';
        case 'percentage': return 'text-purple-400 bg-purple-400/10';
        default: return 'text-blue-400 bg-blue-400/10';
      }
    };

    return (
      <NeonContainer className="p-6 relative overflow-hidden group hover:scale-[1.02] transition-all duration-200 h-full">
        {/* Background gradient effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <div className="relative z-10 h-full flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className={`p-3 rounded-xl ${getIconColor()}`}>
              <Icon className="w-6 h-6" />
            </div>
            {trend && (
              <div className="flex items-center gap-1">
                {getTrendIcon()}
                {trendValue && (
                  <span className={`text-sm font-medium ${
                    trend === 'up' ? 'text-green-400' :
                    trend === 'down' ? 'text-red-400' : 'text-gray-400'
                  }`}>
                    {trendValue}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col justify-center space-y-1">
            <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
            <p className="text-sm font-medium text-gray-300">{title}</p>
            {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
          </div>
        </div>
      </NeonContainer>
    );
  };

  // Special MetricCard for Success Rate with circular progress
  const SuccessRateCard = ({
    value,
    title,
    subtitle
  }: {
    value: number,
    title: string,
    subtitle?: string
  }) => {
    const percentage = Math.round(value);
    const circumference = 2 * Math.PI * 45;
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    const getColor = () => {
      if (percentage >= 80) return 'text-green-400 stroke-green-400';
      if (percentage >= 60) return 'text-yellow-400 stroke-yellow-400';
      return 'text-red-400 stroke-red-400';
    };

    return (
      <NeonContainer className="p-6 relative overflow-hidden group hover:scale-[1.02] transition-all duration-200 h-full">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <div className="relative z-10 h-full flex flex-col">
          {/* Header with icon and trend */}
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-xl text-purple-400 bg-purple-400/10">
              <FiTarget className="w-6 h-6" />
            </div>
          </div>

          {/* Content area */}
          <div className="flex-1 flex items-center gap-6">
            <div className="relative">
              <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  className="text-gray-700"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  className={`${getColor()} transition-all duration-1000 ease-out`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-lg font-bold ${getColor()}`}>{percentage}%</span>
              </div>
            </div>

            <div className="flex-1">
              <p className="text-3xl font-bold text-white tracking-tight">{percentage}%</p>
              <p className="text-sm font-medium text-gray-300">{title}</p>
              {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
            </div>
          </div>
        </div>
      </NeonContainer>
    );
  };

  // // Marketing Video Section Component
  // const MarketingVideoSection = () => (
  //   <NeonContainer className="mb-8">
  //     <div className="px-6 py-4 border-b border-gray-700">
  //       <h2 className="text-xl font-semibold text-white">Marketing Videos</h2>
  //       <p className="text-sm text-gray-400 mt-1">Showcase your voice AI capabilities with these ready-to-use marketing videos</p>
  //     </div>
  //     <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  //       {/* Video Card 1 */}
  //       <div className="bg-gray-800/50 rounded-lg overflow-hidden hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 border border-gray-700">
  //         <div className="relative aspect-video">
  //           <div className="absolute inset-0 bg-gradient-to-b from-blue-500/20 to-black/50 flex items-center justify-center">
  //             <div className="w-16 h-16 rounded-full bg-blue-500/30 backdrop-blur-sm flex items-center justify-center">
  //               <FiPlay className="w-6 h-6 text-white ml-1" />
  //             </div>
  //           </div>
  //           <img
  //             src="https://images.unsplash.com/photo-1557804506-669a67965ba0?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2574&q=80"
  //             alt="Voice AI Demo"
  //             className="w-full h-full object-cover"
  //           />
  //         </div>
  //         <div className="p-4">
  //           <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-blue-400 transition-colors">Voice AI for Customer Service</h3>
  //           <p className="text-sm text-gray-400">Show how voice AI can transform customer service operations with 24/7 support.</p>
  //           <div className="mt-4 flex justify-end">
  //             <span className="text-xs text-gray-500">2:45</span>
  //             <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors">Download</button>
  //           </div>
  //         </div>
  //       </div>

  //       {/* Video Card 2 */}
  //       <div className="bg-gray-800/50 rounded-lg overflow-hidden hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 border border-gray-700">
  //         <div className="relative aspect-video">
  //           <div className="absolute inset-0 bg-gradient-to-b from-blue-500/20 to-black/50 flex items-center justify-center">
  //             <div className="w-16 h-16 rounded-full bg-blue-500/30 backdrop-blur-sm flex items-center justify-center">
  //               <FiPlay className="w-6 h-6 text-white ml-1" />
  //             </div>
  //           </div>
  //           <img
  //             src="https://images.unsplash.com/photo-1551434678-e076c223a692?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2670&q=80"
  //             alt="Voice AI Demo"
  //             className="w-full h-full object-cover"
  //           />
  //         </div>
  //         <div className="p-4">
  //           <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-blue-400 transition-colors">Sales Automation with Voice AI</h3>
  //           <p className="text-sm text-gray-400">Demonstrate how voice AI can qualify leads and book meetings automatically.</p>
  //           <div className="mt-4 flex justify-end">
  //             <span className="text-xs text-gray-500">3:12</span>
  //             <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors">Download</button>
  //           </div>
  //         </div>
  //       </div>

  //       {/* Video Card 3 */}
  //       <div className="bg-gray-800/50 rounded-lg overflow-hidden hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 border border-gray-700">
  //         <div className="relative aspect-video">
  //           <div className="absolute inset-0 bg-gradient-to-b from-blue-500/20 to-black/50 flex items-center justify-center">
  //             <div className="w-16 h-16 rounded-full bg-blue-500/30 backdrop-blur-sm flex items-center justify-center">
  //               <FiPlay className="w-6 h-6 text-white ml-1" />
  //             </div>
  //           </div>
  //           <img
  //             src="https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2670&q=80"
  //             alt="Voice AI Demo"
  //             className="w-full h-full object-cover"
  //           />
  //         </div>
  //         <div className="p-4">
  //           <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-blue-400 transition-colors">Voice AI ROI Case Study</h3>
  //           <p className="text-sm text-gray-400">Real-world examples of businesses saving costs and increasing revenue with voice AI.</p>
  //           <div className="mt-4 flex justify-end">
  //             <span className="text-xs text-gray-500">4:30</span>
  //             <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors">Download</button>
  //           </div>
  //         </div>
  //       </div>
  //     </div>
  //     <div className="px-6 py-4 flex justify-center">
  //       <a
  //         href="https://ghlstorystudio.com/"
  //         target="_blank"
  //         rel="noopener noreferrer"
  //         className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
  //       >
  //         <FiExternalLink className="w-4 h-4" />
  //         <span>View More Marketing Videos</span>
  //       </a>
  //     </div>
  //   </NeonContainer>
  // );

  // // Marketing Posts Section Component
  // const MarketingPostsSection = () => (
  //   <NeonContainer className="mb-8">
  //     <div className="px-6 py-4 border-b border-gray-700">
  //       <h2 className="text-xl font-semibold text-white">Marketing Posts</h2>
  //       <p className="text-sm text-gray-400 mt-1">Ready-to-use social media and blog content to promote voice AI solutions</p>
  //     </div>
  //     <div className="p-6 space-y-6">
  //       {/* Post Category 1 */}
  //       <div>
  //         <h3 className="text-lg font-semibold text-white mb-4">Social Media Templates</h3>
  //         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  //           {/* Post Card 1 */}
  //           <div className="bg-gray-800/50 rounded-lg overflow-hidden p-4 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300">
  //             <div className="text-sm text-gray-400 mb-3">LinkedIn</div>
  //             <p className="text-white text-sm">"Tired of missing customer calls after hours? Our Voice AI solution handles customer inquiries 24/7, ensuring you never miss an opportunity. #VoiceAI #CustomerService #BusinessGrowth"</p>
  //             <div className="mt-4 flex justify-end">
  //               <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors">Copy</button>
  //             </div>
  //           </div>

  //           {/* Post Card 2 */}
  //           <div className="bg-gray-800/50 rounded-lg overflow-hidden p-4 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300">
  //             <div className="text-sm text-gray-400 mb-3">Twitter/X</div>
  //             <p className="text-white text-sm">"Our clients are seeing 40% more qualified leads with Voice AI handling initial prospect calls. Real conversations, real results. #VoiceAI #SalesAutomation"</p>
  //             <div className="mt-4 flex justify-end">
  //               <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors">Copy</button>
  //             </div>
  //           </div>

  //           {/* Post Card 3 */}
  //           <div className="bg-gray-800/50 rounded-lg overflow-hidden p-4 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300">
  //             <div className="text-sm text-gray-400 mb-3">Facebook</div>
  //             <p className="text-white text-sm">"📞 Voice AI is revolutionizing how businesses handle customer calls. Our solution can reduce call handling costs by up to 60% while improving customer satisfaction. Learn how: [Your Website Link] #BusinessInnovation"</p>
  //             <div className="mt-4 flex justify-end">
  //               <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors">Copy</button>
  //             </div>
  //           </div>
  //         </div>
  //       </div>

  //       {/* Post Category 2 */}
  //       <div>
  //         <h3 className="text-lg font-semibold text-white mb-4">Blog Post Templates</h3>
  //         <div className="space-y-4">
  //           {/* Blog Post 1 */}
  //           <div className="bg-gray-800/50 rounded-lg overflow-hidden p-4 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300">
  //             <h4 className="text-md font-semibold text-white mb-2">5 Ways Voice AI Is Transforming Customer Service</h4>
  //             <p className="text-sm text-gray-400 mb-3">A comprehensive guide to implementing voice AI in customer service operations.</p>
  //             <div className="flex justify-end">
  //               <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors">Download Template</button>
  //             </div>
  //           </div>

  //           {/* Blog Post 2 */}
  //           <div className="bg-gray-800/50 rounded-lg overflow-hidden p-4 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300">
  //             <h4 className="text-md font-semibold text-white mb-2">Voice AI ROI: Calculating the Business Impact</h4>
  //             <p className="text-sm text-gray-400 mb-3">How to measure and maximize the return on investment from voice AI implementation.</p>
  //             <div className="flex justify-end">
  //               <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors">Download Template</button>
  //             </div>
  //           </div>
  //         </div>
  //       </div>
  //     </div>
  //   </NeonContainer>
  // );

  // // Voice-Enabled Website Section Component
  // const VoiceEnabledWebsiteSection = () => (
  //   <NeonContainer className="mb-8">
  //     <div className="px-6 py-4 border-b border-gray-700">
  //       <h2 className="text-xl font-semibold text-white">Voice-Enabled Website</h2>
  //       <p className="text-sm text-gray-400 mt-1">Showcase the power of voice AI with a demo website for your customers</p>
  //     </div>
  //     <div className="p-6">
  //       <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg p-6 border border-blue-500/20">
  //         <div className="flex flex-col md:flex-row gap-8 items-center">
  //           <div className="flex-1">
  //             <h3 className="text-2xl font-bold text-white mb-4">Get Your Voice AI Demo Website</h3>
  //             <p className="text-gray-300 mb-6">Impress potential clients with a fully functional voice-enabled website that showcases your AI capabilities. Our customizable templates make it easy to create a professional demo in minutes.</p>
  //             <ul className="space-y-3 mb-6">
  //               <li className="flex items-start gap-2">
  //                 <div className="p-1 bg-green-500/20 rounded-full mt-0.5">
  //                   <FiCheck className="w-3 h-3 text-green-500" />
  //                 </div>
  //                 <span className="text-gray-300">Customizable with your branding</span>
  //               </li>
  //               <li className="flex items-start gap-2">
  //                 <div className="p-1 bg-green-500/20 rounded-full mt-0.5">
  //                   <FiCheck className="w-3 h-3 text-green-500" />
  //                 </div>
  //                 <span className="text-gray-300">Interactive voice AI demonstration</span>
  //               </li>
  //               <li className="flex items-start gap-2">
  //                 <div className="p-1 bg-green-500/20 rounded-full mt-0.5">
  //                   <FiCheck className="w-3 h-3 text-green-500" />
  //                 </div>
  //                 <span className="text-gray-300">Lead capture functionality</span>
  //               </li>
  //               <li className="flex items-start gap-2">
  //                 <div className="p-1 bg-green-500/20 rounded-full mt-0.5">
  //                   <FiCheck className="w-3 h-3 text-green-500" />
  //                 </div>
  //                 <span className="text-gray-300">Mobile-responsive design</span>
  //               </li>
  //             </ul>
  //             <button className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg font-semibold text-white hover:from-blue-600 hover:to-purple-600 transition-all duration-300 transform hover:scale-105">
  //               Request Your Demo Website
  //             </button>
  //           </div>
  //           <div className="flex-1">
  //             <div className="relative">
  //               <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg blur opacity-30"></div>
  //               <div className="relative bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
  //                 <div className="h-8 bg-gray-800 flex items-center px-4 gap-2">
  //                   <div className="w-3 h-3 rounded-full bg-red-500"></div>
  //                   <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
  //                   <div className="w-3 h-3 rounded-full bg-green-500"></div>
  //                 </div>
  //                 <div className="p-4">
  //                   <img
  //                     src="https://images.unsplash.com/photo-1551434678-e076c223a692?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2670&q=80"
  //                     alt="Voice AI Website Demo"
  //                     className="w-full rounded-md"
  //                   />
  //                 </div>
  //               </div>
  //             </div>
  //           </div>
  //         </div>
  //       </div>
  //     </div>
  //   </NeonContainer>
  // );

  // // Demo Section Component
  // const DemoSection = () => (
  //   <NeonContainer className="mb-8">
  //     <div className="px-6 py-4 border-b border-gray-700">
  //       <h2 className="text-xl font-semibold text-white">Demo for Customers</h2>
  //       <p className="text-sm text-gray-400 mt-1">Interactive demos to showcase voice AI capabilities to potential clients</p>
  //     </div>
  //     <div className="p-6 space-y-6">
  //       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  //         {/* Demo Card 1 */}
  //         <div className="bg-gray-800/50 rounded-lg overflow-hidden hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 border border-gray-700">
  //           <div className="p-6">
  //             <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4">
  //               <FiHeadphones className="w-6 h-6 text-blue-400" />
  //             </div>
  //             <h3 className="text-xl font-semibold text-white mb-2">Interactive Voice Demo</h3>
  //             <p className="text-gray-400 mb-4">Let your clients experience voice AI in action with our interactive demo. They can speak directly to the AI and see how it responds in real-time.</p>
  //             <button className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors flex items-center gap-2">
  //               <FiPlay className="w-4 h-4" />
  //               Launch Demo
  //             </button>
  //           </div>
  //         </div>

  //         {/* Demo Card 2 */}
  //         <div className="bg-gray-800/50 rounded-lg overflow-hidden hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 border border-gray-700">
  //           <div className="p-6">
  //             <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4">
  //               <FiScreen className="w-6 h-6 text-purple-400" />
  //             </div>
  //             <h3 className="text-xl font-semibold text-white mb-2">Guided Product Tour</h3>
  //             <p className="text-gray-400 mb-4">Walk your clients through the features and benefits of voice AI with our guided product tour. Includes use cases and ROI calculations.</p>
  //             <button className="px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors flex items-center gap-2">
  //               <FiPlay className="w-4 h-4" />
  //               Start Tour
  //             </button>
  //           </div>
  //         </div>
  //       </div>

  //       <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg p-6 border border-gray-700">
  //         <h3 className="text-lg font-semibold text-white mb-4">Schedule a Live Demo</h3>
  //         <p className="text-gray-400 mb-4">Need help presenting to a high-value prospect? Our team can join you for a live demo and help answer technical questions.</p>
  //         <button className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-colors">
  //           Request Live Demo Support
  //         </button>
  //       </div>
  //     </div>
  //   </NeonContainer>
  // );

  return (
    <WalkthroughProvider>
      <UserGuideProvider>
        <div className="min-h-screen bg-gray-900 text-white flex">
        <GuidedPartnerSidebar
          partnerName={partnerName}
          onLogout={handleLogout}
          onCreditClaimClick={handleCreditClaimClick}
        />


      {/* Passkey Setup Prompt */}
      <PasskeyPrompt
        isCustomer={false}
        userDisplayName={partnerName}
        onSetupComplete={() => {
          // Optionally refresh partner data or show success message
          console.log('Passkey setup completed');
        }}
      />

      <main className="flex-1 pl-64 transition-all duration-300">
        <div className="p-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold">Welcome, {partnerName}</h1>
              <p className="text-gray-400 mt-2">Track your performance and manage your customers</p>
            </div>
            <div className="flex items-center gap-4">
              {/* Notification Bell */}
              <NotificationBell userId={migrationStatus?.partnerId || ''} userType="partner" />
              <button
                onClick={() => setIsPricingModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
              >
                <FiDollarSign className="w-5 h-5" />
                <span>Pricing Calculator</span>
              </button>
              <button
                onClick={() => setIsQuickOnboardingModalOpen(true)}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-teal-500 rounded-lg font-semibold hover:from-blue-600 hover:to-teal-600 transition-all duration-300 transform hover:scale-105"
              >
                <FiPlus className="w-5 h-5" />
                Onboard New Customer
              </button>
            </div>
          </div>

          {/* Onboarding Progress Bar or Daily Challenge Widget */}
          {!isOnboardingComplete ? (
            <OnboardingProgressBar partnerId={migrationStatus?.partnerId || ''} className="mb-8" />
          ) : (
            <DailyChallengeWidget partnerId={migrationStatus?.partnerId || ''} className="mb-8" />
          )}

          {/* Credit Balances */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="relative">
              <NeonContainer className="p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-500/10 rounded-lg">
                      <FiCpu className="w-6 h-6 text-blue-500" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-200">Knotie Credits</h3>
                  </div>
                  <a
                    href="/partner/ai-credits"
                    className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
                  >
                    Manage →
                  </a>
                </div>
                <div>
                  <p className="text-3xl font-bold text-white">{formatCredits(knotieCreditBalance)}</p>
                  <p className="text-sm text-gray-400 mt-1">For AI agents and features</p>
                </div>
              </NeonContainer>
            </div>

            <div className="relative">
              <NeonContainer className="p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-green-500/10 rounded-lg">
                      <FiPhone className="w-6 h-6 text-green-500" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-200">Telephony Credits</h3>
                  </div>
                  <a
                    href="/partner/telephony-credits"
                    className="text-green-400 hover:text-green-300 text-sm transition-colors"
                  >
                    Manage →
                  </a>
                </div>
                <div>
                  <p className="text-3xl font-bold text-white">
                    ${(telephonyCreditBalance / 100).toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-400 mt-1">For calls and phone services</p>
                </div>
              </NeonContainer>
            </div>

            <div className="relative">
              <NeonContainer className="p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-500/10 rounded-lg">
                      <FiPhone className="w-6 h-6 text-blue-500" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-200">Phone Numbers</h3>
                  </div>
                  <a
                    href="/partner/phone-numbers"
                    className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
                  >
                    Manage →
                  </a>
                </div>
                <div>
                  <p className="text-3xl font-bold text-white">
                    {metrics?.totalPhoneNumbers || 0}
                  </p>
                  <p className="text-sm text-gray-400 mt-1">Across all customers</p>
                </div>
              </NeonContainer>
            </div>
          </div>

          {/* Business Metrics */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1 h-6 bg-gradient-to-b from-green-400 to-blue-400 rounded-full"></div>
              <div className="flex items-center gap-2">
                <FiTrendingUp className="w-5 h-5 text-green-400" />
                <span className="text-lg font-medium text-gray-300">Business Overview</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <MetricCard
                icon={FiDollarSign}
                title="Opportunity Value"
                value={metrics?.totalOpportunityValue ?
                  new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                  }).format(metrics.totalOpportunityValue)
                  : '$0'
                }
                subtitle="Pipeline potential"
                type="currency"
              />
              <MetricCard
                icon={FiTrendingUp}
                title="Monthly Revenue"
                value={metrics?.totalMRR ?
                  new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                  }).format(metrics.totalMRR)
                  : '$0'
                }
                subtitle="Recurring income"
                type="currency"
              />
              <MetricCard
                icon={FiUsers}
                title="Portal Access"
                value={`${metrics?.customersWithPortalAccess || 0}/${metrics?.totalUsers || 0}`}
                subtitle="Customers with portal access"
              />
              <MetricCard
                icon={FiActivity}
                title="Registered"
                value={(metrics?.totalRegisteredCustomers || 0).toLocaleString()}
                subtitle="Total registered customers"
              />
            </div>
          </div>

          {/* Voice AI Performance Metrics */}
          {partnerAnalytics && (
            <div className="mb-8">
              {/* Subtle section indicator */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-6 bg-gradient-to-b from-blue-400 to-purple-400 rounded-full"></div>
                <div className="flex items-center gap-2">
                  <FiActivity className="w-5 h-5 text-blue-400" />
                  <span className="text-lg font-medium text-gray-300">Performance Overview</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <MetricCard
                  icon={FiPhoneCall}
                  title="Total Calls"
                  value={partnerAnalytics.totalCalls.toLocaleString()}
                  subtitle="Voice AI interactions"
                  type="calls"
                />
                <MetricCard
                  icon={FiDollarSign}
                  title="Total Cost"
                  value={new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  }).format(partnerAnalytics.totalCost)}
                  subtitle="AI service expenses"
                  type="currency"
                />
                <MetricCard
                  icon={FiClock}
                  title="Avg Duration"
                  value={`${Math.round(partnerAnalytics.avgDuration)}s`}
                  subtitle="Per conversation"
                />
                <SuccessRateCard
                  value={partnerAnalytics.successRate}
                  title="Success Rate"
                  subtitle="Call completion rate"
                />
              </div>

              {/* Cost Analysis Chart */}
              {partnerAnalytics.productCosts && partnerAnalytics.productCosts.length > 0 && (
                <NeonContainer className="p-6 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5" />
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                          <FiBarChart className="w-5 h-5 text-blue-400" />
                        </div>
                        <h3 className="text-xl font-semibold text-white">Cost Distribution</h3>
                      </div>
                      <div className="text-sm text-gray-400">
                        Last 30 days
                      </div>
                    </div>

                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={partnerAnalytics.productCosts} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <XAxis
                            dataKey="product"
                            stroke="#6B7280"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            stroke="#6B7280"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `$${value}`}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#1F2937',
                              border: '1px solid #374151',
                              borderRadius: '0.75rem',
                              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
                            }}
                            formatter={(value) => [
                              new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: 'USD',
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              }).format(Number(value)),
                              'Cost'
                            ]}
                            labelStyle={{ color: '#F3F4F6' }}
                          />
                          <Bar
                            dataKey="cost"
                            fill="url(#costGradient)"
                            radius={[4, 4, 0, 0]}
                          />
                          <defs>
                            <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#3B82F6" />
                              <stop offset="100%" stopColor="#1E40AF" />
                            </linearGradient>
                          </defs>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </NeonContainer>
              )}
            </div>
          )}

          {/* Marketing Video Section
          <MarketingVideoSection /> */}

          {/* Marketing Posts Section */}
          {/* <MarketingPostsSection /> */}

          {/* Voice-Enabled Website Section */}
          {/* <VoiceEnabledWebsiteSection /> */}

          {/* Demo Section */}
          {/* <DemoSection /> */}

          {/* Customer List */}
          <NeonContainer className="overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-gray-700">
              <h2 className="text-xl font-semibold text-white">Customers</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-900/50">
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-400">Customer</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-400">Company</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-400">Call Volume</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-400">Est. Price</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {customers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium">{customer.firstName} {customer.lastName}</div>
                          <div className="text-sm text-gray-400">{customer.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">{customer.companyName}</td>
                      <td className="px-6 py-4">{customer.monthlyCallVolume}</td>
                      <td className="px-6 py-4">
                        <div className="font-medium">${(customer.estimatedPrice || 0).toLocaleString()}</div>
                        <button
                          onClick={() => {
                            const breakdown = JSON.parse(customer.priceBreakdown || '{}');
                            setSelectedBreakdown(breakdown);
                          }}
                          className="text-sm text-blue-400 hover:text-blue-300"
                        >
                          View Breakdown
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                          ${customer.orderStatus === 'PENDING' ? 'bg-yellow-400/20 text-amber-400' :
                            customer.orderStatus === 'APPROVED' ? 'bg-green-400/20 text-green-400' :
                            'bg-gray-400/20 text-gray-400'}`}>
                          {customer.orderStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </NeonContainer>

          {/* Customer Growth Timeline */}
          <NeonContainer className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <FiTrendingUp className="w-5 h-5 text-green-400" />
                </div>
                <h2 className="text-xl font-semibold text-white">Customer Growth Timeline</h2>
              </div>
              <div className="text-sm text-gray-400">
                Customer acquisition over time
              </div>
            </div>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics?.timelineData || []}>
                  <defs>
                    <linearGradient id="totalUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="liveUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="#6B7280" />
                  <YAxis stroke="#6B7280" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: '1px solid #374151',
                      borderRadius: '0.5rem',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="totalUsers"
                    stroke="#3B82F6"
                    fillOpacity={1}
                    fill="url(#totalUsers)"
                    name="Total Users"
                  />
                  <Area
                    type="monotone"
                    dataKey="liveUsers"
                    stroke="#10B981"
                    fillOpacity={1}
                    fill="url(#liveUsers)"
                    name="Live Users"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </NeonContainer>
        </div>
      </main>

      {/* Price Breakdown Modal */}
      <AnimatePresence>
        {selectedBreakdown && (
          <Dialog
            static
            open={!!selectedBreakdown}
            onClose={() => setSelectedBreakdown(null)}
            className="relative z-50"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            />

            <Dialog.Panel
              as={motion.div}
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="fixed inset-0 overflow-y-auto"
            >
              <div className="flex min-h-full items-center justify-center p-4">
                <div className="relative w-full max-w-2xl">
                  <NeonContainer>
                    <div className="relative bg-gray-900/90 backdrop-blur-xl rounded-lg p-8">
                      <button
                        onClick={() => setSelectedBreakdown(null)}
                        className="absolute top-6 right-6 p-2 rounded-full bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
                      >
                        <FiX className="w-5 h-5" />
                      </button>

                      <h2 className="text-2xl font-bold mb-6 text-white">Price Breakdown</h2>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-gray-800/50 rounded-lg backdrop-blur-xl">
                            <div className="text-sm text-gray-300">Platform Fee</div>
                            <div className="text-lg font-semibold text-white">${selectedBreakdown.platformFee.toLocaleString()}</div>
                          </div>
                          <div className="p-4 bg-gray-800/50 rounded-lg backdrop-blur-xl">
                            <div className="text-sm text-gray-300">Voice AI</div>
                            <div className="text-lg font-semibold text-white">${selectedBreakdown.voiceAICost.toLocaleString()}</div>
                          </div>
                          <div className="p-4 bg-gray-800/50 rounded-lg backdrop-blur-xl">
                            <div className="text-sm text-gray-300">Telephony</div>
                            <div className="text-lg font-semibold text-white">${selectedBreakdown.telephonyCost.toLocaleString()}</div>
                          </div>
                          <div className="p-4 bg-gray-800/50 rounded-lg backdrop-blur-xl">
                            <div className="text-sm text-gray-300">Email</div>
                            <div className="text-lg font-semibold text-white">${selectedBreakdown.emailCost.toLocaleString()}</div>
                          </div>
                          <div className="p-4 bg-gray-800/50 rounded-lg backdrop-blur-xl">
                            <div className="text-sm text-gray-300">SMS</div>
                            <div className="text-lg font-semibold text-white">${selectedBreakdown.smsCost.toLocaleString()}</div>
                          </div>
                          <div className="p-4 bg-gradient-to-r from-blue-500/20 to-teal-500/20 rounded-lg backdrop-blur-xl">
                            <div className="text-sm text-blue-300">Total</div>
                            <div className="text-lg font-semibold text-white">${selectedBreakdown.totalCost.toLocaleString()}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </NeonContainer>
                </div>
              </div>
            </Dialog.Panel>
          </Dialog>
        )}
      </AnimatePresence>

      {/* Customer Onboarding Modal - Hidden: Using Quick Onboarding instead */}
      {/* <CustomerOnboardingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleOnboardingSuccess}
      /> */}

      {/* Quick Onboarding Modal - Now used for "Onboard New Customer" button */}
      <QuickOnboardingModal
        isOpen={isQuickOnboardingModalOpen}
        onClose={() => setIsQuickOnboardingModalOpen(false)}
        onSuccess={handleOnboardingSuccess}
      />
      <PricingCalculatorModal />

      {/* Migration Warning Popup */}
      {showMigrationWarning && migrationStatus && (
        <MigrationWarningPopup
          partnerId={migrationStatus.partnerId}
          hasAgents={migrationStatus.hasAgents}
          isFirstTimeUser={migrationStatus.isFirstTimeUser}
          onDismiss={handleMigrationWarningDismiss}
        />
      )}

      {/* Webhook Migration Warning Popup - DISABLED */}
      {/* {showWebhookMigrationWarning && webhookMigrationStatus && (
        <WebhookMigrationPopup
          partnerId={webhookMigrationStatus.partnerId}
          agentsWithoutWebhooks={webhookMigrationStatus.agentsWithoutWebhooks}
          totalAgents={webhookMigrationStatus.totalAgents}
          onDismiss={handleWebhookMigrationWarningDismiss}
        />
      )} */}

      {/* Welcome Video Modal */}
      <WelcomeVideoModal
        isOpen={showWelcomeVideo}
        onClose={handleWelcomeVideoClose}
        onContinue={handleWelcomeVideoContinue}
        videoUrl={`https://www.youtube.com/embed/${process.env.NEXT_PUBLIC_WELCOME_VIDEO_ID || '1wgE_3YCCGY'}`}
        partnerName={partnerName}
      />

      {/* Credit Claim Modal */}
      {showCreditClaimModal && selectedClaim && (
        <CreditClaimModal
          isOpen={showCreditClaimModal}
          onClose={handleCreditClaimModalClose}
          partnerId={migrationStatus?.partnerId || ''}
          claim={selectedClaim}
          onClaimSuccess={handleCreditClaimSuccess}
        />
      )}

        </div>
      </UserGuideProvider>
    </WalkthroughProvider>
  );
}
