'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  FiCheckCircle,
  FiXCircle,
  FiClock,
  FiPlus,
  FiKey,
  FiRefreshCw,
  FiX,
  FiLock,
  FiSettings,
  FiInfo,
  FiExternalLink,
  FiGlobe,
  FiSearch,
  FiUsers,
  FiFilter
} from 'react-icons/fi';
import CustomerOnboardingModal from '@/components/CustomerOnboardingModal';
import PartnerLayout from '@/components/partner/PartnerLayout';
import NeonContainer from '@/components/NeonContainer';
import CustomerManagementModal from '@/components/partner/CustomerManagementModal';
import QuickOnboardingModal from '@/components/partner/QuickOnboardingModal';
import ConfirmationModal from '@/components/ConfirmationModal';
import NotificationModal from '@/components/NotificationModal';
import UpgradePromptModal from '@/components/partner/UpgradePromptModal';
import { ClientTierValidationService, UpgradePrompt } from '@/lib/services/clientTierValidationService';
import { FreeForeverUpgradeService } from '@/lib/services/freeForeverUpgradeService';
import FreeForeverUpgradeModal from '@/components/partner/FreeForeverUpgradeModal';



interface CustomerData {
  id: string;
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  // Additional editable fields
  businessPhone?: string;
  primaryUseCase?: string;
  callComplexity?: string;
  crmSystem?: string;
  phoneSystem?: string;
  scriptComplexity?: string;
  languages?: string;
  deploymentTimeline?: string;
  customAutomation?: string;
  // Existing fields
  monthlyCallVolume: string;
  estimatedPrice: number;
  priceBreakdown: string;
  orderStatus: string;
  userId: string;
  isOnboardingCompleted: boolean;
  createdAt: string;
  // Deployment status for auto-deploy feature
  deploymentStatus?: string;
  updatedAt: string;
  dealStatus?: string;
  billingType?: string;
  agreedPrice?: number | null;
  enableAdvancedAnalytics?: boolean;
  enableDetailedCallAnalysis?: boolean;
  enableActionPointAnalysis?: boolean;
  customerPortalEnabled?: boolean;
  showPricingInformation?: boolean;
  showKnowledgeBase?: boolean;
  showIntegration?: boolean;
  showDocsAndMedia?: boolean;
  showScheduleMeeting?: boolean;
  maxTeamMembers?: number;
  enableTeamMembers?: boolean;
  // SaaS onboarding and agent status
  hasCompletedProspect?: boolean;
  hasKnovaAgent?: boolean;
  hasRetellAgent?: boolean;
  // Subscription trial status
  isOnTrial?: boolean;
  subscriptionStatus?: string | null;
  trialEnd?: Date | null;
  // Credential status for blocked badge
  credentialStatus?: string | null;
}

export default function CustomerList() {
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null);

  // Search & filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonthlyCallVolume, setFilterMonthlyCallVolume] = useState('');
  const [filterCallComplexity, setFilterCallComplexity] = useState('');
  const [filterDeploymentTimeline, setFilterDeploymentTimeline] = useState('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);
  const [isQuickOnboardingModalOpen, setIsQuickOnboardingModalOpen] = useState(false);
  const [partnerName, setPartnerName] = useState('');
  const [upgradePrompt, setUpgradePrompt] = useState<UpgradePrompt | null>(null);
  const [showFreeForeverUpgrade, setShowFreeForeverUpgrade] = useState(false);
  const [freeForeverUpgradeData, setFreeForeverUpgradeData] = useState({
    title: '',
    message: '',
    featureDescription: '',
  });
  const [selectedBreakdown, setSelectedBreakdown] = useState<{
    platformFee: number;
    voiceAICost: number;
    telephonyCost: number;
    emailCost: number;
    smsCost: number;
    totalCost: number;
  } | null>(null);

  // Modal states
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'warning' | 'danger' | 'info';
    isLoading?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'warning',
    isLoading: false
  });

  const [notificationModal, setNotificationModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'success' | 'error' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'success'
  });

  // Whitelabel setup status
  const [whitelabelSetupStatus, setWhitelabelSetupStatus] = useState<{
    isComplete: boolean;
    hasSubdomain: boolean;
    hasVerifiedCustomDomain: boolean;
    hasPortalEnabled: boolean;
    isLoading: boolean;
  }>({
    isComplete: true, // Default to true to avoid showing warning before check
    hasSubdomain: false,
    hasVerifiedCustomDomain: false,
    hasPortalEnabled: false,
    isLoading: true
  });

  const [showWhitelabelWarning, setShowWhitelabelWarning] = useState(true);
  const [previewingCustomerId, setPreviewingCustomerId] = useState<string | null>(null);
  const [partnerAiAnalyticsEnabled, setPartnerAiAnalyticsEnabled] = useState(false);
  const [pendingOnboardingType, setPendingOnboardingType] = useState<'full' | 'quick' | null>(null);
  const [deployingCustomerId, setDeployingCustomerId] = useState<string | null>(null);

  // Handle continue deployment for customers with pending_credits status
  const handleContinueDeployment = async (customerId: string) => {
    try {
      setDeployingCustomerId(customerId);
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Please log in again');
        return;
      }

      const response = await fetch('/api/partner/customers/continue-deployment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ customerId }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'Insufficient credits') {
          const details = data.details;
          const telephonyDollars = (details.telephonyCreditBalanceCents / 100).toFixed(2);
          const minTelephonyDollars = (details.minTelephonyCreditsCents / 100).toFixed(2);
          toast.error(
            `Insufficient credits. Telephony: $${telephonyDollars}/$${minTelephonyDollars}, Knotie: ${details.creditBalance}/${details.minKnotieCredits}`,
            { duration: 5000 }
          );
        } else {
          toast.error(data.error || 'Failed to continue deployment');
        }
        return;
      }

      toast.success('Deployment queued successfully!');
      // Refresh customer list to update status
      fetchCustomers();
    } catch (error) {
      console.error('Error continuing deployment:', error);
      toast.error('Failed to continue deployment. Please try again.');
    } finally {
      setDeployingCustomerId(null);
    }
  };

  // Helper functions for modals
  const showConfirmation = (title: string, message: string, onConfirm: () => void, type: 'warning' | 'danger' | 'info' = 'warning') => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm,
      type,
      isLoading: false
    });
  };

  const showNotification = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    setNotificationModal({
      isOpen: true,
      title,
      message,
      type
    });
  };

  const closeConfirmModal = () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
  };

  const closeNotificationModal = () => {
    setNotificationModal(prev => ({ ...prev, isOpen: false }));
  };

  useEffect(() => {
    const token = localStorage.getItem('partner_token');
    if (!token) {
      router.push('/partner/login');
      return;
    }

    // Get partner name from localStorage
    const storedName = localStorage.getItem('partner_name');
    if (storedName) {
      setPartnerName(storedName);
    }

    fetchCustomers(1, pageSize);
    checkWhitelabelSetup();
    fetchPartnerAiAnalyticsSetting(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Trigger search when filters change (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
      fetchCustomers(1, pageSize);
    }, 300);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, filterMonthlyCallVolume, filterCallComplexity, filterDeploymentTimeline]);

  const fetchPartnerAiAnalyticsSetting = async (token: string) => {
    try {
      const response = await fetch('/api/partner/profile', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setPartnerAiAnalyticsEnabled(Boolean(data.enableAiAnalytics));
      }
    } catch (error) {
      console.error('Error fetching partner AI analytics setting:', error);
    }
  };

  const checkWhitelabelSetup = async () => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch('/api/partner/whitelabel/settings', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.error('Failed to check whitelabel setup');
        return;
      }

      const data = await response.json();
      if (data.success && data.partner) {
        const partner = data.partner;
        const hasSubdomain = partner.subdomain && partner.subdomain.trim() !== '';
        const hasVerifiedCustomDomain = partner.customDomain && partner.customDomainVerified;
        const hasPortalEnabled = partner.customerPortalEnabled;
        const isComplete = (hasSubdomain || hasVerifiedCustomDomain) && hasPortalEnabled;

        setWhitelabelSetupStatus({
          isComplete,
          hasSubdomain,
          hasVerifiedCustomDomain,
          hasPortalEnabled,
          isLoading: false
        });
      }
    } catch (error) {
      console.error('Error checking whitelabel setup:', error);
      setWhitelabelSetupStatus(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('partner_token');
    localStorage.removeItem('partner_name');
    router.push('/partner/login');
  };

  const getStatusIcon = (status: string | undefined) => {
    if (!status) {
      return <FiClock className="w-5 h-5 text-amber-500" />; // Default icon for undefined status
    }

    switch (status.toUpperCase()) {
      case 'APPROVED':
        return <FiCheckCircle className="w-5 h-5 text-green-500" />;
      case 'REJECTED':
        return <FiXCircle className="w-5 h-5 text-red-500" />;
      case 'SUBMITTED':
        return <FiClock className="w-5 h-5 text-amber-500" />;
      default:
        return <FiClock className="w-5 h-5 text-amber-500" />;
    }
  };

  const handleCustomerClick = (customer: CustomerData) => {
    setSelectedCustomer(customer);
    setIsModalOpen(true);
  };

  // Tier validation for customer creation
  const handleCustomerOnboarding = async (type: 'full' | 'quick') => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication token not found. Please log in again.');
        return;
      }

      // Check if user is on free forever plan first
      const shouldShowFreeForeverUpgrade = await FreeForeverUpgradeService.shouldShowUpgradeEncouragement();
      console.log('🔍 Should show free forever upgrade:', shouldShowFreeForeverUpgrade);

      if (shouldShowFreeForeverUpgrade) {
        // Check if they're at the customer limit for free forever users
        const validation = await ClientTierValidationService.validateCustomerCreation();
        console.log('🔍 Customer validation result:', validation);

        if (!validation.allowed) {
          // User has exceeded limit - show blocking message
          console.log('❌ Customer limit exceeded, showing upgrade modal');
          const upgradeMessage = FreeForeverUpgradeService.getUpgradeMessage('customers');
          setFreeForeverUpgradeData({
            ...upgradeMessage,
            message: `You've reached the Free Forever limit of 2 customers. Upgrade to create unlimited customers and unlock premium features.`
          });
          setShowFreeForeverUpgrade(true);
          setPendingOnboardingType(type);
          return;
        }
        console.log('✅ Customer creation allowed, proceeding...');
        // If within limit, proceed with customer creation (no modal shown)
      } else {
        // Regular tier validation for paid users
        const validation = await ClientTierValidationService.validateCustomerCreation();

        if (!validation.allowed) {
          // Generate upgrade prompt
          const prompt = await ClientTierValidationService.generateUpgradePrompt('customers');
          setUpgradePrompt(prompt);
          return;
        }
      }

      // Proceed with onboarding
      proceedWithOnboarding(type);
    } catch (error) {
      console.error('Error validating customer creation:', error);
      toast.error('Error checking customer limits. Please try again.');
    }
  };

  // Function to proceed with onboarding (used by both normal flow and "Maybe Later" callback)
  const proceedWithOnboarding = (type: 'full' | 'quick') => {
    if (type === 'full') {
      setIsOnboardingModalOpen(true);
    } else {
      setIsQuickOnboardingModalOpen(true);
    }
  };



  const handleOnboardingSuccess = (customerData: any) => {
    // Ensure we have all required fields for CustomerData
    const formattedCustomerData: CustomerData = {
      id: customerData.id,
      firstName: customerData.firstName?.trim() || '',
      lastName: customerData.lastName?.trim() || '',
      companyName: customerData.companyName?.trim() || '',
      email: customerData.email || '',
      monthlyCallVolume: customerData.monthlyCallVolume || '',
      estimatedPrice: customerData.estimatedPrice || 0,
      priceBreakdown: customerData.priceBreakdown || '{}',
      orderStatus: customerData.orderStatus || 'PENDING',
      userId: customerData.userId || '',
      isOnboardingCompleted: customerData.isOnboardingCompleted || false,
      createdAt: customerData.createdAt || new Date().toISOString(),
      updatedAt: customerData.updatedAt || new Date().toISOString(),
      dealStatus: customerData.dealStatus || 'PENDING',
      billingType: customerData.billingType || 'MONTHLY',
      agreedPrice: customerData.agreedPrice || null,
      enableAdvancedAnalytics: customerData.enableAdvancedAnalytics || false,
      enableDetailedCallAnalysis: customerData.enableDetailedCallAnalysis || false,
      enableActionPointAnalysis: customerData.enableActionPointAnalysis || false,
      customerPortalEnabled: customerData.customerPortalEnabled || false,
      showPricingInformation: customerData.showPricingInformation !== undefined ? customerData.showPricingInformation : true,
      showKnowledgeBase: customerData.showKnowledgeBase || false,
      showIntegration: customerData.showIntegration || false,
      showDocsAndMedia: customerData.showDocsAndMedia || false,
      showScheduleMeeting: customerData.showScheduleMeeting || false,
      maxTeamMembers: customerData.maxTeamMembers || 0,
      enableTeamMembers: customerData.enableTeamMembers || false
    };

    // If we're editing an existing customer, update it in the list
    if (selectedCustomer) {
      setCustomers(prev => prev.map(c =>
        c.id === selectedCustomer.id ? { ...c, ...formattedCustomerData } : c
      ));
      toast.success('Customer updated successfully!');
    } else {
      // Otherwise add the new customer to the list
      setCustomers(prev => [...prev, formattedCustomerData]);
      const customerName = formattedCustomerData.companyName ||
                          (formattedCustomerData.firstName && formattedCustomerData.lastName ?
                           `${formattedCustomerData.firstName} ${formattedCustomerData.lastName}` :
                           formattedCustomerData.email);
      toast.success(`🎉 Customer "${customerName}" has been successfully onboarded!`);
    }
    setIsOnboardingModalOpen(false);
    setIsQuickOnboardingModalOpen(false);
    setSelectedCustomer(null);

    // Refresh the customer list to ensure data consistency
    setTimeout(() => {
      fetchCustomers();
    }, 1000);
  };

  const fetchCustomers = async (page = currentPage, size = pageSize) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('partner_token');
      if (!token) {
        router.push('/partner/login');
        return;
      }

      const params = new URLSearchParams({
        page: page.toString(),
        limit: size.toString()
      });
      // Add search and filter params if set
      if (searchTerm) params.set('search', searchTerm);
      if (filterMonthlyCallVolume) params.set('monthlyCallVolume', filterMonthlyCallVolume);
      if (filterCallComplexity) params.set('callComplexity', filterCallComplexity);
      if (filterDeploymentTimeline) params.set('deploymentTimeline', filterDeploymentTimeline);

      const response = await fetch(`/api/partner/customers?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cookie': `partner_token=${token}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch customers');
      }
      const data = await response.json();
      setCustomers(data.data || data.customers || []);
      
      // Update pagination state
      if (data.pagination) {
        setCurrentPage(data.pagination.currentPage);
        setTotalPages(data.pagination.totalPages);
        setTotalCount(data.pagination.totalCount);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  };

  const handleStatusChange = async (customerId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/partner/customers/${customerId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('partner_token')}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      // Update local state
      setCustomers(prevCustomers =>
        prevCustomers.map(c =>
          c.id === customerId
            ? { ...c, orderStatus: newStatus }
            : c
        )
      );
    } catch (error) {
      console.error('Error updating status:', error);
      showNotification('Error', 'Failed to update status. Please try again.', 'error');
    }
  };

  const handlePreviewCustomerPortal = async (customer: CustomerData) => {
    setPreviewingCustomerId(customer.id);

    try {
      // Get the token from localStorage
      const token = localStorage.getItem('partner_token');

      // Ensure token is valid format
      if (!token || token.split('.').length !== 3) {
        console.error('Invalid token format in localStorage');
        throw new Error('Invalid authentication token. Please log out and log in again.');
      }

      const response = await fetch(`/api/partner/customers/${customer.id}/impersonate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        let errorMessage = 'Failed to create preview session';

        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          try {
            const errorText = await response.text();
            errorMessage = errorText || errorMessage;
          } catch (textError) {
            console.error('Could not parse error response:', textError);
          }
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (data.success && data.baseUrl && data.token) {
        // Determine window features based on environment
        const isDevelopment = process.env.NODE_ENV === 'development';
        const isPreviewMode = typeof window !== 'undefined' &&
          (window.location.hostname.includes('lvh.me') ||
           window.location.hostname === 'localhost' ||
           window.location.hostname === '127.0.0.1' ||
           window.location.port === '3000');

        // In development, allow more browser features for debugging
        const windowFeatures = (isDevelopment || isPreviewMode)
          ? 'width=1200,height=800,scrollbars=yes,resizable=yes,location=yes,menubar=no,toolbar=yes,status=yes'
          : 'width=1200,height=800,scrollbars=yes,resizable=yes,location=no,menubar=no,toolbar=no,status=no,directories=no';

        // Use URL with token for reliability
        const windowUrl = data.impersonationUrl;

        console.log('Opening impersonation window:', {
          isDevelopment,
          isPreviewMode,
          hostname: window.location.hostname,
          port: window.location.port,
          windowUrl,
          baseUrl: data.baseUrl,
          impersonationUrl: data.impersonationUrl
        });

        // Open a secure popup window
        const previewWindow = window.open(
          windowUrl,
          'customer_preview',
          windowFeatures
        );

        if (!previewWindow) {
          throw new Error('Failed to open preview window. Please check your popup blocker settings.');
        }

        showNotification('Success', `Preview portal opened. Session expires in ${Math.floor(data.expiresIn / 60)} minutes.`, 'success');
      } else {
        throw new Error(data.error || 'Failed to create preview session');
      }

    } catch (error: any) {
      console.error('Error creating preview session:', error);
      showNotification('Error', error.message || 'Failed to create preview session', 'error');
    } finally {
      setPreviewingCustomerId(null);
    }
  };



  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <PartnerLayout partnerName={partnerName} onLogout={handleLogout}>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Customer List</h1>
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <p className="text-gray-400 mt-2">View and manage all your onboarded customers</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleCustomerOnboarding('quick')}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-teal-500 rounded-lg font-semibold hover:from-blue-600 hover:to-teal-600 transition-all duration-300 transform hover:scale-105"
              >
                <FiPlus className="w-5 h-5" />
                Quick Onboard
              </button>
              {/* Hidden: Full Onboarding Button - Keeping Quick Onboarding only for easier user experience */}
              {/* <button
                onClick={() => handleCustomerOnboarding('full')}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-teal-500 rounded-lg font-semibold hover:from-blue-600 hover:to-teal-600 transition-all duration-300 transform hover:scale-105"
              >
                <FiPlus className="w-5 h-5" />
                Full Onboarding
              </button> */}
            </div>
          </div>

          {/* Top bar: only show page-size selector when list spans multiple pages */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mb-4 px-4 py-3 bg-gray-800/40 rounded-xl">
              <div className="text-sm text-gray-400">
                {totalCount.toLocaleString()} customers · Page {currentPage} of {totalPages}
              </div>
              <select
                value={pageSize}
                disabled={loading}
                onChange={(e) => {
                  const newSize = parseInt(e.target.value);
                  setPageSize(newSize);
                  setCurrentPage(1);
                  fetchCustomers(1, newSize);
                }}
                className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="10">10 per page</option>
                <option value="20">20 per page</option>
                <option value="50">50 per page</option>
                <option value="100">100 per page</option>
              </select>
            </div>
          )}

          {/* Search & Filters — single responsive row */}
          <div className="bg-gray-800/50 rounded-xl p-4">
            <div className="flex flex-col lg:flex-row gap-3">
              {/* Search Bar — takes remaining space on desktop */}
              <div className="relative flex-1 min-w-0">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by name, company, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              {/* Filter Dropdowns — inline on desktop, stacked on mobile */}
              <div className="flex flex-col sm:flex-row gap-2 lg:flex-shrink-0">
                <select
                  value={filterMonthlyCallVolume}
                  onChange={(e) => setFilterMonthlyCallVolume(e.target.value)}
                  className={`px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    filterMonthlyCallVolume
                      ? 'bg-blue-900/30 border-blue-500/50 text-blue-200'
                      : 'bg-gray-700 border-gray-600 text-white'
                  }`}
                >
                  <option value="">All Call Volumes</option>
                  <option value="__none__">Not Set</option>
                  <option value="Up to 100">Up to 100 calls</option>
                  <option value="100-500">100-500 calls</option>
                  <option value="101-500">101-500 calls</option>
                  <option value="501-1000">501-1000 calls</option>
                  <option value="1001-5000">1001-5000 calls</option>
                  <option value="Over 5000">Over 5000 calls</option>
                </select>

                <select
                  value={filterCallComplexity}
                  onChange={(e) => setFilterCallComplexity(e.target.value)}
                  className={`px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    filterCallComplexity
                      ? 'bg-blue-900/30 border-blue-500/50 text-blue-200'
                      : 'bg-gray-700 border-gray-600 text-white'
                  }`}
                >
                  <option value="">All Complexity</option>
                  <option value="__none__">Not Set</option>
                  <option value="Basic">Basic</option>
                  <option value="Standard">Standard</option>
                  <option value="Medium">Medium</option>
                  <option value="Advanced">Advanced</option>
                  <option value="Complex">Complex</option>
                  <option value="Enterprise">Enterprise</option>
                </select>

                <select
                  value={filterDeploymentTimeline}
                  onChange={(e) => setFilterDeploymentTimeline(e.target.value)}
                  className={`px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    filterDeploymentTimeline
                      ? 'bg-blue-900/30 border-blue-500/50 text-blue-200'
                      : 'bg-gray-700 border-gray-600 text-white'
                  }`}
                >
                  <option value="">All Timelines</option>
                  <option value="__none__">Not Set</option>
                  <option value="immediate">Immediate</option>
                  <option value="1-2 weeks">1-2 weeks</option>
                  <option value="2-4 weeks">2-4 weeks</option>
                  <option value="next month">Next month</option>
                  <option value="research">Research phase</option>
                </select>
              </div>
            </div>

            {/* Active filters indicator + clear button */}
            {(searchTerm || filterMonthlyCallVolume || filterCallComplexity || filterDeploymentTimeline) && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-700/50">
                <FiFilter className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                <span className="text-xs text-gray-400">
                  {[
                    searchTerm && `"${searchTerm}"`,
                    filterMonthlyCallVolume && `Volume: ${filterMonthlyCallVolume === '__none__' ? 'Not Set' : filterMonthlyCallVolume}`,
                    filterCallComplexity && `Complexity: ${filterCallComplexity === '__none__' ? 'Not Set' : filterCallComplexity}`,
                    filterDeploymentTimeline && `Timeline: ${filterDeploymentTimeline === '__none__' ? 'Not Set' : filterDeploymentTimeline}`,
                  ].filter(Boolean).join(' · ')}
                </span>
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setFilterMonthlyCallVolume('');
                    setFilterCallComplexity('');
                    setFilterDeploymentTimeline('');
                  }}
                  className="ml-auto text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1"
                >
                  <FiX className="w-3 h-3" />
                  Clear all
                </button>
              </div>
            )}
          </div>

          {/* Whitelabel Setup Warning */}
          {!whitelabelSetupStatus.isLoading && !whitelabelSetupStatus.isComplete && showWhitelabelWarning && (
            <div className="mb-6 bg-amber-900/20 border border-amber-700 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <FiInfo className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="text-amber-400 font-medium mb-1">Complete Your Whitelabel Portal Setup</h3>
                    <p className="text-amber-200 text-sm mb-3">
                      Before enabling customer portals, you need to complete your whitelabel configuration.
                      This ensures your customers can properly access their portal.
                    </p>
                    <div className="text-sm text-amber-200 mb-3">
                      <p className="font-medium mb-1">Required setup:</p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        {!whitelabelSetupStatus.hasPortalEnabled && (
                          <li>Enable customer portal in whitelabel settings</li>
                        )}
                        {!whitelabelSetupStatus.hasSubdomain && !whitelabelSetupStatus.hasVerifiedCustomDomain && (
                          <li>Configure either a subdomain or verify a custom domain</li>
                        )}
                      </ul>
                    </div>
                    <button
                      onClick={() => router.push('/partner/settings/whitelabel')}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded-lg transition-colors"
                    >
                      <FiSettings className="w-4 h-4" />
                      Complete Whitelabel Setup
                      <FiExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setShowWhitelabelWarning(false)}
                  className="text-amber-400 hover:text-amber-300 transition-colors"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && customers.length === 0 && (
            <div className="bg-gray-800/50 rounded-xl p-12 text-center">
              <FiUsers className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No Customers Found</h3>
              <p className="text-gray-400">
                {searchTerm || filterMonthlyCallVolume || filterCallComplexity || filterDeploymentTimeline
                  ? 'No customers match your current filters. Try adjusting or clearing your filters.'
                  : 'You don\'t have any customers yet. Onboard your first customer to get started.'}
              </p>
            </div>
          )}

          {/* Customer Grid */}
          <div className={`grid grid-cols-1 gap-4 transition-opacity duration-200 ${loading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
            {customers.map((customer) => (
              <NeonContainer key={customer.id}>
                <div className="p-6 hover:bg-gray-800/30 transition-colors rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 cursor-pointer" onClick={() => handleCustomerClick(customer)}>
                      <div className="flex items-center gap-3">
                        <h2 className="text-xl font-semibold text-white">
                          {customer.companyName ||
                           (customer.firstName?.trim() && customer.lastName?.trim() ?
                            `${customer.firstName.trim()} ${customer.lastName.trim()}` :
                            customer.email)}
                        </h2>
                        {/* Deployment Status Badge */}
                        {customer.deploymentStatus === 'pending_credits' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full animate-pulse">
                            <FiClock className="w-3 h-3" />
                            Awaiting Credits
                          </span>
                        )}
                        {customer.deploymentStatus === 'queued' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full">
                            <FiRefreshCw className="w-3 h-3 animate-spin" />
                            Deploying
                          </span>
                        )}
                        {customer.deploymentStatus === 'agent_ready' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30 rounded-full">
                            <FiCheckCircle className="w-3 h-3" />
                            Agent Ready
                          </span>
                        )}
                        {customer.deploymentStatus === 'completed' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30 rounded-full">
                            <FiCheckCircle className="w-3 h-3" />
                            Deployed
                          </span>
                        )}
                        {customer.deploymentStatus === 'failed' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30 rounded-full">
                            <FiXCircle className="w-3 h-3" />
                            Failed
                          </span>
                        )}
                        {/* Trial Badge */}
                        {customer.isOnTrial && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-full">
                            <FiClock className="w-3 h-3" />
                            Trial
                            {customer.trialEnd && (
                              <span className="text-purple-300">
                                ({Math.ceil((new Date(customer.trialEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24))}d)
                              </span>
                            )}
                          </span>
                        )}
                        {/* Blocked Badge */}
                        {customer.credentialStatus === 'suspended' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30 rounded-full">
                            <FiLock className="w-3 h-3" />
                            Blocked
                          </span>
                        )}
                      </div>
                      <p className="text-gray-400 mt-1">{customer.email}</p>
                      {/* Hidden: Monthly Call Volume */}
                      {/* <div className="flex items-center gap-2 mt-2">
                        <FiPhone className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-400">Monthly Call Volume: {customer.monthlyCallVolume}</span>
                      </div> */}
                    </div>
                    <div className="flex items-center gap-8" onClick={(e) => e.stopPropagation()}>
                      {/* Hidden: Estimated Price Section */}
                      {/* <div className="flex flex-col items-end">
                        <div className="text-sm text-gray-400">Estimated Price</div>
                        <div className="text-lg font-semibold text-white">
                          ${(customer.estimatedPrice || 0).toLocaleString()}/month
                        </div>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const breakdown = JSON.parse(customer.priceBreakdown);
                            setSelectedBreakdown(breakdown);
                          }}
                          className="mt-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          View Price Breakdown
                        </button>
                      </div> */}
                      {/* Hidden: Status Section */}
                      {/* <div className="flex flex-col items-end">
                        <div className="text-sm text-gray-400">Status</div>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(customer.orderStatus)}
                          <span className="capitalize text-white">
                            {customer.orderStatus || 'Pending'}
                          </span>
                        </div>
                        <div className="mt-4">
                          <select
                            value={customer.orderStatus}
                            onChange={(e) => handleStatusChange(customer.id, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-48 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="Submitted">Submitted</option>
                            <option value="Processing">Processing</option>
                            <option value="Additional Info Requested">Additional Info Requested</option>
                            <option value="Under Review">Under Review</option>
                            <option value="Regulatory approval submitted">Regulatory approval submitted</option>
                            <option value="Regulatory approval completed">Regulatory approval completed</option>
                            <option value="Business Agreement Established">Business Agreement Established</option>
                            <option value="Under Development">Under Development</option>
                            <option value="System under review">System under review</option>
                            <option value="Voice AI Agent Live">Voice AI Agent Live</option>
                          </select>
                        </div>
                      </div> */}
                      <div className="flex flex-col items-end">
                        <div className="text-sm text-gray-400">Portal Management</div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCustomer(customer);
                              setIsModalOpen(true);
                            }}
                            className="flex items-center gap-1 text-sm bg-blue-500 hover:bg-blue-600 px-3 py-1.5 rounded transition-colors"
                          >
                            <FiSettings className="w-4 h-4" />
                            Manage
                          </button>

                          {/* Continue Deployment button for pending_credits status */}
                          {customer.deploymentStatus === 'pending_credits' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleContinueDeployment(customer.id);
                              }}
                              disabled={deployingCustomerId === customer.id}
                              className="flex items-center gap-1 text-sm bg-amber-500 hover:bg-amber-600 px-3 py-1.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed animate-pulse"
                              title="Continue auto-deployment (credits required)"
                            >
                              <FiRefreshCw className={`w-4 h-4 ${deployingCustomerId === customer.id ? 'animate-spin' : ''}`} />
                              {deployingCustomerId === customer.id ? 'Deploying...' : 'Continue Deployment'}
                            </button>
                          )}

                          {/* Deploy Agent button for customers with completed prospect but no agent (Knova or Retell) */}
                          {customer.hasCompletedProspect && !customer.hasKnovaAgent && !customer.hasRetellAgent && customer.deploymentStatus !== 'pending_credits' && customer.deploymentStatus !== 'agent_ready' && customer.deploymentStatus !== 'queued' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleContinueDeployment(customer.id);
                              }}
                              disabled={deployingCustomerId === customer.id}
                              className="flex items-center gap-1 text-sm bg-purple-500 hover:bg-purple-600 px-3 py-1.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Deploy AI Receptionist agent for this customer"
                            >
                              <FiRefreshCw className={`w-4 h-4 ${deployingCustomerId === customer.id ? 'animate-spin' : ''}`} />
                              {deployingCustomerId === customer.id ? 'Deploying...' : 'Deploy Agent'}
                            </button>
                          )}

                          {customer.customerPortalEnabled ? (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePreviewCustomerPortal(customer);
                                }}
                                disabled={previewingCustomerId === customer.id}
                                className="flex items-center gap-1 text-sm bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Preview customer portal as this customer"
                              >
                                <FiGlobe className="w-4 h-4" />
                                {previewingCustomerId === customer.id ? 'Opening...' : 'Preview'}
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  showConfirmation(
                                    'Reset Password',
                                    'Are you sure you want to reset this customer\'s password? A new password will be sent to their email.',
                                    async () => {
                                      setConfirmModal(prev => ({ ...prev, isLoading: true }));
                                      try {
                                        const token = localStorage.getItem('partner_token');
                                        const response = await fetch(`/api/partner/customers/${customer.id}/portal-access`, {
                                          method: 'POST',
                                          headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': `Bearer ${token}`,
                                          },
                                        });

                                        if (!response.ok) {
                                          throw new Error('Failed to reset password');
                                        }

                                        closeConfirmModal();
                                        showNotification('Success', 'Password reset and sent to customer email', 'success');
                                      } catch (error) {
                                        console.error('Error resetting password:', error);
                                        closeConfirmModal();
                                        showNotification('Error', 'Failed to reset password. Please try again.', 'error');
                                      }
                                    },
                                    'warning'
                                  );
                                }}
                                className="flex items-center gap-1 text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded transition-colors"
                              >
                                <FiKey className="w-4 h-4" />
                                Reset
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const isBlocked = customer.credentialStatus === 'suspended';
                                  showConfirmation(
                                    isBlocked ? 'Grant Portal Access' : 'Block Portal Access',
                                    isBlocked 
                                      ? 'Are you sure you want to grant this customer portal access? They will be able to log in again.'
                                      : 'Are you sure you want to block this customer\'s portal access? They will no longer be able to log in.',
                                    async () => {
                                      setConfirmModal(prev => ({ ...prev, isLoading: true }));
                                      try {
                                        const token = localStorage.getItem('partner_token');
                                        const response = await fetch(`/api/partner/customers/${customer.id}/portal-access/block`, {
                                          method: 'POST',
                                          headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': `Bearer ${token}`,
                                          },
                                        });

                                        if (!response.ok) {
                                          throw new Error(isBlocked ? 'Failed to grant portal access' : 'Failed to block portal access');
                                        }

                                        closeConfirmModal();
                                        showNotification('Success', isBlocked ? 'Portal access granted successfully' : 'Portal access blocked successfully', 'success');
                                        fetchCustomers(); // Refresh the list
                                      } catch (error) {
                                        console.error('Error toggling portal access:', error);
                                        closeConfirmModal();
                                        showNotification('Error', isBlocked ? 'Failed to grant portal access. Please try again.' : 'Failed to block portal access. Please try again.', 'error');
                                      }
                                    },
                                    isBlocked ? 'info' : 'danger'
                                  );
                                }}
                                className={`flex items-center gap-1 text-sm px-3 py-1.5 rounded transition-colors ${
                                  customer.credentialStatus === 'suspended'
                                    ? 'bg-green-600 hover:bg-green-700'
                                    : 'bg-yellow-600 hover:bg-yellow-700'
                                }`}
                              >
                                <FiLock className="w-4 h-4" />
                                {customer.credentialStatus === 'suspended' ? 'Grant Access' : 'Block'}
                              </button>

                              <div className="flex items-center gap-1 text-sm bg-gray-600 px-3 py-1.5 rounded text-gray-300 cursor-not-allowed">
                                <FiCheckCircle className="w-4 h-4" />
                                Portal Enabled
                              </div>
                            </>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCustomer(customer);
                                setIsModalOpen(true);
                              }}
                              className="flex items-center gap-1 text-sm bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded transition-colors"
                            >
                              <FiKey className="w-4 h-4" />
                              Enable Portal
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </NeonContainer>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalCount > 0 && (
            <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-700">
              <div className="text-sm text-gray-400">
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} customers
              </div>
              
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const newPage = currentPage - 1;
                      setCurrentPage(newPage);
                      fetchCustomers(newPage);
                    }}
                    disabled={currentPage === 1 || loading}
                    className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          disabled={loading}
                          onClick={() => {
                            setCurrentPage(pageNum);
                            fetchCustomers(pageNum);
                          }}
                          className={`px-3 py-1 rounded-lg transition-colors ${
                            currentPage === pageNum
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  
                  <button
                    onClick={() => {
                      const newPage = currentPage + 1;
                      setCurrentPage(newPage);
                      fetchCustomers(newPage);
                    }}
                    disabled={currentPage === totalPages || loading}
                    className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}

              <select
                value={pageSize}
                disabled={loading}
                onChange={(e) => {
                  const newSize = parseInt(e.target.value);
                  setPageSize(newSize);
                  setCurrentPage(1);
                  fetchCustomers(1, newSize);
                }}
                className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="10">10 per page</option>
                <option value="20">20 per page</option>
                <option value="50">50 per page</option>
                <option value="100">100 per page</option>
              </select>
            </div>
          )}

          {/* Price Breakdown Modal */}
          <AnimatePresence>
            {selectedBreakdown && (
              <Dialog
                static
                open={!!selectedBreakdown}
                onClose={() => setSelectedBreakdown(null)}
                className="fixed inset-0 z-50"
              >
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/80 backdrop-blur-sm"
                  onClick={() => setSelectedBreakdown(null)}
                />

                <div className="fixed inset-0 flex items-center justify-center p-4">
                  <Dialog.Panel
                    as={motion.div}
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      transition: {
                        type: "spring",
                        damping: 25,
                        stiffness: 300
                      }
                    }}
                    exit={{
                      opacity: 0,
                      y: 20,
                      scale: 0.95,
                      transition: {
                        duration: 0.2
                      }
                    }}
                    className="relative bg-gray-900 rounded-xl p-6 w-[400px] shadow-xl border border-gray-800"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Dialog.Title className="text-xl font-semibold mb-4 text-white">
                      Price Breakdown
                    </Dialog.Title>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">Platform Fee</span>
                        <span className="font-medium text-white">${selectedBreakdown.platformFee.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">Voice AI Cost</span>
                        <span className="font-medium text-white">${selectedBreakdown.voiceAICost.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">Telephony Cost</span>
                        <span className="font-medium text-white">${selectedBreakdown.telephonyCost.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">Email Cost</span>
                        <span className="font-medium text-white">${selectedBreakdown.emailCost.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">SMS Cost</span>
                        <span className="font-medium text-white">${selectedBreakdown.smsCost.toLocaleString()}</span>
                      </div>
                      <div className="pt-4 border-t border-gray-700">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-white">Total Cost</span>
                          <span className="font-semibold text-lg text-blue-400">${selectedBreakdown.totalCost.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedBreakdown(null)}
                      className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                    >
                      <FiX className="w-5 h-5" />
                    </button>
                  </Dialog.Panel>
                </div>
              </Dialog>
            )}
          </AnimatePresence>

          {/* Customer Onboarding Modal */}
          <CustomerOnboardingModal
            isOpen={isOnboardingModalOpen}
            onClose={() => setIsOnboardingModalOpen(false)}
            onSuccess={handleOnboardingSuccess}
            existingCustomer={selectedCustomer}
          />

          {/* Quick Onboarding Modal */}
          <QuickOnboardingModal
            isOpen={isQuickOnboardingModalOpen}
            onClose={() => setIsQuickOnboardingModalOpen(false)}
            onSuccess={handleOnboardingSuccess}
          />

          {/* Customer Management Modal */}
          <CustomerManagementModal
            isOpen={isModalOpen}
            onClose={() => {
              setSelectedCustomer(null);
              setIsModalOpen(false);
              fetchCustomers();
            }}
            customer={selectedCustomer}
            onUpdateCustomer={(updatedCustomer) => {
              setCustomers(prev => prev.map(c =>
                c.id === updatedCustomer.id ? updatedCustomer : c
              ));
            }}
            partnerAiAnalyticsEnabled={partnerAiAnalyticsEnabled}
          />

          {/* Upgrade Prompt Modal */}
          {upgradePrompt && (
            <UpgradePromptModal
              isOpen={upgradePrompt.show}
              onClose={() => setUpgradePrompt(null)}
              currentTier={upgradePrompt.currentTier}
              suggestedTier={upgradePrompt.suggestedTier}
              feature={upgradePrompt.feature}
              title={upgradePrompt.title}
              message={upgradePrompt.message}
            />
          )}

          {/* Free Forever Upgrade Modal */}
          <FreeForeverUpgradeModal
            isOpen={showFreeForeverUpgrade}
            onClose={() => setShowFreeForeverUpgrade(false)}
            onProceed={pendingOnboardingType ? () => proceedWithOnboarding(pendingOnboardingType) : undefined}
            title={freeForeverUpgradeData.title}
            message={freeForeverUpgradeData.message}
            featureDescription={freeForeverUpgradeData.featureDescription}
          />

          {/* Confirmation Modal */}
          <ConfirmationModal
            isOpen={confirmModal.isOpen}
            onClose={closeConfirmModal}
            onConfirm={confirmModal.onConfirm}
            title={confirmModal.title}
            message={confirmModal.message}
            type={confirmModal.type}
            isLoading={confirmModal.isLoading}
          />

          {/* Notification Modal */}
          <NotificationModal
            isOpen={notificationModal.isOpen}
            onClose={closeNotificationModal}
            title={notificationModal.title}
            message={notificationModal.message}
            type={notificationModal.type}
          />
        </div>
      </div>
    </PartnerLayout>
  );
}
