'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Dialog } from '@headlessui/react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  FiX,
  FiUser,
  FiPhone,
  FiMail,
  FiInfo,
  FiHelpCircle,
  FiToggleLeft,
  FiToggleRight,
  FiKey,
  FiLock,
  FiTrash2,
  FiDollarSign,
  FiSettings,
  FiFileText,
  FiLink,
  FiGlobe,
  FiRefreshCw,
  FiZap,
  FiAlertCircle,
  FiCreditCard,
  FiDatabase,
  FiBarChart,
  FiChevronLeft,
  FiChevronRight
} from 'react-icons/fi';
import { Tab } from '@headlessui/react';
import clsx from 'clsx';
import TeamMembersList from './TeamMembersList';
import CustomerBillingTab from './CustomerBillingTab';
import CustomerCreditManagement from './CustomerCreditManagement';
import CustomerCreditCheckEndpoint from './CustomerCreditCheckEndpoint';
import CustomerPhoneNumberManagement from './CustomerPhoneNumberManagement';
import CustomerEmbedTokenManagement from './CustomerEmbedTokenManagement';
import CustomerToolCallQuotaManagement from './CustomerToolCallQuotaManagement';
import CustomerReportTab from './CustomerReportTab';
import ConfirmationModal from '../ConfirmationModal';
import PartnerStorageService, { StorageQuota } from '@/lib/services/partnerStorageService';
import PhoneNumberSelectionModal from './PhoneNumberSelectionModal';
import AgentSelectionModal from './AgentSelectionModal';
import AppSelectionModal from './AppSelectionModal';

interface StripeConnectStatus {
  hasStripeAccount: boolean;
  onboardingCompleted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  needsOnboarding: boolean;
}

interface CustomerManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: CustomerData | null;
  onUpdateCustomer: (updatedCustomer: CustomerData) => void;
  partnerAiAnalyticsEnabled?: boolean;
}

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
  updatedAt: string;
  dealStatus?: string;
  billingType?: string;
  agreedPrice?: number | null;
  enableAdvancedAnalytics?: boolean;
  enableDetailedCallAnalysis?: boolean;
  enableActionPointAnalysis?: boolean;
  customerPortalEnabled?: boolean;
  // API access
  enableApiAccess?: boolean;
  // Menu visibility options
  showKnowledgeBase?: boolean;
  showIntegration?: boolean;
  showDocsAndMedia?: boolean;
  showScheduleMeeting?: boolean;
  showApiKeys?: boolean;
  // Deployment tracking
  deploymentStatus?: string;
  deploymentNotes?: string;
  deploymentRequestedAt?: string;
  phoneProvisionedAt?: string;
  agentDeployingAt?: string;
  agentReadyAt?: string;
  deploymentCompletedAt?: string;
  // Pricing information visibility
  showPricingInformation?: boolean;
  // Phone numbers
  showPhoneNumbers?: boolean;
  // Team management
  maxTeamMembers?: number;
  enableTeamMembers?: boolean;
  // Knowledge Base processing
  kbProcessingEnabled?: boolean;
  autoEmbeddingEnabled?: boolean;
  // Per-customer app selection
  allowedApps?: string[];
  // AI Credit Management
  aiCreditsEnabled?: boolean;
  aiCreditPricePerMinute?: number;
  aiCreditGracePeriodSeconds?: number;
  lowCreditThreshold?: number;
  lowCreditNotificationsEnabled?: boolean;
  // AI Gateway
  showAiGateway?: boolean;
  // Customer ID for invoicing
  customerId?: string;
  // Credential status for blocked badge
  credentialStatus?: string | null;
}

export default function CustomerManagementModal({
  isOpen,
  onClose,
  customer,
  onUpdateCustomer,
  partnerAiAnalyticsEnabled = false
}: CustomerManagementModalProps) {
  const [localCustomer, setLocalCustomer] = useState<CustomerData | null>(null);
  const [priceBreakdown, setPriceBreakdown] = useState<any>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEnablingPortal, setIsEnablingPortal] = useState(false);
  const [isBlockingPortal, setIsBlockingPortal] = useState(false);
  const [isDeletingPortal, setIsDeletingPortal] = useState(false);
  const [isPreviewingPortal, setIsPreviewingPortal] = useState(false);
  const [showTooltip, setShowTooltip] = useState<string | null>(null);
  const [portalSuccess, setPortalSuccess] = useState<string | null>(null);
  const [stripeConnectStatus, setStripeConnectStatus] = useState<StripeConnectStatus | null>(null);
  const [isLoadingStripeStatus, setIsLoadingStripeStatus] = useState(true);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [showPhoneNumberModal, setShowPhoneNumberModal] = useState(false);
  const [showAgentSelectionModal, setShowAgentSelectionModal] = useState(false);
  const [assignedPhoneNumber, setAssignedPhoneNumber] = useState<string | null>(null);
  
  // Tab scroll state
  const tabListRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  // Toast notification state
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error';
  }>({ show: false, message: '', type: 'success' });

  // Function to show toast notifications
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 3000);
  };
  const [storageQuota, setStorageQuota] = useState<StorageQuota | null>(null);
  const [isLoadingStorage, setIsLoadingStorage] = useState(false);
  const [customerStorageAllocation, setCustomerStorageAllocation] = useState<number>(0);
  const [showAutoEmbeddingCharges, setShowAutoEmbeddingCharges] = useState(false);

  // Check if billing should be enabled (Stripe Connect is properly configured)
  const isBillingEnabled = stripeConnectStatus?.hasStripeAccount &&
                          stripeConnectStatus?.onboardingCompleted &&
                          stripeConnectStatus?.chargesEnabled;

  // Integration notification state
  const [showIntegrationNotification, setShowIntegrationNotification] = useState(false);
  // App selection modal state
  const [showAppSelectionModal, setShowAppSelectionModal] = useState(false);
  const [partnerIsFreeForever, setPartnerIsFreeForever] = useState(false);

  // Confirmation modal state
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

  // Helper functions for confirmation modal
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

  const closeConfirmModal = () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
  };

  // Function to fetch Stripe Connect status
  const fetchStripeConnectStatus = async () => {
    try {
      setIsLoadingStripeStatus(true);
      const response = await fetch('/api/partner/stripe/status');

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setStripeConnectStatus(data.data);
        }
      } else {
        console.error('Failed to fetch Stripe Connect status:', response.status);
        // Set default status if API fails
        setStripeConnectStatus({
          hasStripeAccount: false,
          onboardingCompleted: false,
          chargesEnabled: false,
          payoutsEnabled: false,
          needsOnboarding: true
        });
      }
    } catch (error) {
      console.error('Error fetching Stripe Connect status:', error);
      // Set default status if API fails
      setStripeConnectStatus({
        hasStripeAccount: false,
        onboardingCompleted: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        needsOnboarding: true
      });
    } finally {
      setIsLoadingStripeStatus(false);
    }
  };

  // Fetch partner tier to determine if FREE FOREVER
  const fetchPartnerTier = async () => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch('/api/partner/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        const isFree = data.isFreeForever ?? true; // Default to true (locked) for safety
        setPartnerIsFreeForever(isFree);
     }
    } catch (error) {
      console.error('Error fetching partner tier:', error);
    }
  };

  useEffect(() => {
    // Fetch Stripe Connect status and partner tier when modal opens
    if (isOpen) {
      fetchStripeConnectStatus();
      fetchPartnerTier();
    }
  }, [isOpen]);

  useEffect(() => {
    if (customer) {
      // Always start with a loading state to prevent showing stale data
      setLocalCustomer(null);

      // Fetch the latest customer data from the API
      const fetchCustomerData = async () => {
        try {
          const token = localStorage.getItem('partner_token');
          if (!token) {
            console.warn('No partner token found, using provided customer data');
            setLocalCustomer(customer);
            return;
          }

          // Use the actual customer ID if available, otherwise fall back to the main ID
          const customerIdToUse = customer.customerId || customer.id;
          console.log('Fetching fresh customer data for ID:', customerIdToUse, {
            'customer.id': customer.id,
            'customer.customerId': customer.customerId,
            'using': customerIdToUse
          });
          const response = await fetch(`/api/partner/customers/${customerIdToUse}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (!response.ok) {
            console.error('Failed to fetch customer data:', response.status, response.statusText);
            // Fall back to the provided customer data
            setLocalCustomer(customer);
            return;
          }

          const data = await response.json();
          console.log('Fresh customer data from API:', data);
          console.log('🔍 DEPLOYMENT STATUS DEBUG:', {
            deploymentStatus: data.data?.deploymentStatus,
            deploymentNotes: data.data?.deploymentNotes,
            phoneProvisionedAt: data.data?.phoneProvisionedAt,
            agentDeployingAt: data.data?.agentDeployingAt,
            agentReadyAt: data.data?.agentReadyAt,
            deploymentCompletedAt: data.data?.deploymentCompletedAt
          });

          // Debug the raw API response for team members specifically
          console.log('🔍 RAW API RESPONSE DEBUG:', {
            'Full data object': data,
            'data.data exists': !!data.data,
            'Raw enableTeamMembers': data.data?.enableTeamMembers,
            'Raw enableTeamMembers type': typeof data.data?.enableTeamMembers,
            'Raw maxTeamMembers': data.data?.maxTeamMembers,
            'All boolean fields': {
              enableTeamMembers: data.data?.enableTeamMembers,
              enableAdvancedAnalytics: data.data?.enableAdvancedAnalytics,
              enableApiAccess: data.data?.enableApiAccess,
              customerPortalEnabled: data.data?.customerPortalEnabled,
            }
          });

          if (data.success && data.data) {
            // Map the API response to ensure we have the correct customer ID
            const mappedData = {
              ...data.data,
              // Ensure we use the actual customer ID for operations that need it
              id: data.data.id, // This is the userOnboarding.id for API calls
              customerId: data.data.customerId || data.data.id, // This is the actual customer.id
              // Ensure boolean fields are properly converted
              enableTeamMembers: Boolean(data.data.enableTeamMembers),
              enableAdvancedAnalytics: Boolean(data.data.enableAdvancedAnalytics),
              enableApiAccess: Boolean(data.data.enableApiAccess),
              customerPortalEnabled: Boolean(data.data.customerPortalEnabled),
              showKnowledgeBase: Boolean(data.data.showKnowledgeBase),
              showIntegration: Boolean(data.data.showIntegration),
              showApiKeys: Boolean(data.data.showApiKeys),
              showPricingInformation: Boolean(data.data.showPricingInformation),
              showPhoneNumbers: Boolean(data.data.showPhoneNumbers),
              showScheduleMeeting: Boolean(data.data.showScheduleMeeting),
              showDocsAndMedia: Boolean(data.data.showDocsAndMedia),
              aiCreditsEnabled: Boolean(data.data.aiCreditsEnabled),
              lowCreditThreshold: data.data.lowCreditThreshold,
              lowCreditNotificationsEnabled: Boolean(data.data.lowCreditNotificationsEnabled),
              kbProcessingEnabled: Boolean(data.data.kbProcessingEnabled),
              showAiGateway: Boolean(data.data.showAiGateway),
              // Include deployment status fields from API response
              deploymentStatus: data.data.deploymentStatus,
              deploymentNotes: data.data.deploymentNotes,
              deploymentRequestedAt: data.data.deploymentRequestedAt,
              phoneProvisionedAt: data.data.phoneProvisionedAt,
              agentDeployingAt: data.data.agentDeployingAt,
              agentReadyAt: data.data.agentReadyAt,
              deploymentCompletedAt: data.data.deploymentCompletedAt,
            };
            console.log('Setting fresh customer data with feature states:', {
              userOnboardingId: mappedData.id,
              actualCustomerId: mappedData.customerId,
              enableTeamMembers: mappedData.enableTeamMembers,
              enableAdvancedAnalytics: mappedData.enableAdvancedAnalytics,
              enableApiAccess: mappedData.enableApiAccess,
              customerPortalEnabled: mappedData.customerPortalEnabled,
              showKnowledgeBase: mappedData.showKnowledgeBase,
              showIntegration: mappedData.showIntegration,
              showApiKeys: mappedData.showApiKeys,
              deploymentStatus: mappedData.deploymentStatus,
              phoneProvisionedAt: mappedData.phoneProvisionedAt
            });

            // Specific debugging for team members issue
            console.log('🔍 TEAM MEMBERS DEBUG:', {
              'enableTeamMembers value': mappedData.enableTeamMembers,
              'enableTeamMembers type': typeof mappedData.enableTeamMembers,
              'maxTeamMembers': mappedData.maxTeamMembers,
              'maxTeamMembers type': typeof mappedData.maxTeamMembers,
              'Raw API response enableTeamMembers': data.data.enableTeamMembers,
              'Boolean conversion': !!mappedData.enableTeamMembers,
              'Strict equality to true': mappedData.enableTeamMembers === true,
              'Truthy check': !!mappedData.enableTeamMembers
            });
            setLocalCustomer(mappedData);
          } else {
            console.warn('API response missing data, using provided customer data');
            setLocalCustomer(customer);
          }
        } catch (error) {
          console.error('Error fetching customer data:', error);
          // Fall back to the provided customer data
          setLocalCustomer(customer);
        }
      };

      fetchCustomerData();

      // Fetch storage quota information
      const fetchStorageQuota = async () => {
        try {
          setIsLoadingStorage(true);
          const token = localStorage.getItem('partner_token');
          if (!token) return;

          const response = await fetch('/api/partner/storage/quota', {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            console.log('Storage API Response:', data);
            if (data.success) {
              setStorageQuota(data.data.quota);
              console.log('Storage quota set:', data.data.quota);
            }
          } else {
            console.error('Storage API failed:', response.status, response.statusText);
          }
        } catch (error) {
          console.error('Error fetching storage quota:', error);
        } finally {
          setIsLoadingStorage(false);
        }
      };

      fetchStorageQuota();

      try {
        const breakdown = customer.priceBreakdown ? JSON.parse(customer.priceBreakdown) : {
          platformFee: 0,
          voiceAICost: 0,
          telephonyCost: 0,
          emailCost: 0,
          smsCost: 0,
          totalCost: 0
        };
        setPriceBreakdown(breakdown);
      } catch (error) {
        console.error('Error parsing price breakdown:', error);
        setPriceBreakdown({
          platformFee: 0,
          voiceAICost: 0,
          telephonyCost: 0,
          emailCost: 0,
          smsCost: 0,
          totalCost: 0
        });
      }

      // Check portal eligibility when customer is loaded
      checkPortalEligibility();
    }
  }, [customer]);

  // Clear portal errors when modal opens
  useEffect(() => {
    if (isOpen) {
      setPortalError(null);
      setPortalSuccess(null);
    }
  }, [isOpen]);

  // Check if customer is eligible for portal access
  const checkPortalEligibility = async () => {
    if (!customer) return;

    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch(`/api/partner/customers/${customer.id}/check-portal-eligibility`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.error('Failed to check portal eligibility:', response.status);
        return;
      }

      const data = await response.json();
      console.log('Portal eligibility check:', data);

      if (!data.eligible) {
        // If not eligible, disable the toggle
        setLocalCustomer(prev => prev ? {
          ...prev,
          customerPortalEnabled: false
        } : null);

        // Set error message
        setPortalError(data.error || 'Customer is not eligible for portal access');
      } else {
        // If eligible, update the local state to reflect the actual portal status
        setLocalCustomer(prev => prev ? {
          ...prev,
          customerPortalEnabled: data.customerPortalEnabled || prev.customerPortalEnabled
        } : null);
      }
    } catch (error) {
      console.error('Error checking portal eligibility:', error);
    }
  };

  const handleInputChange = (field: keyof CustomerData, value: any) => {
    if (!localCustomer) return;

    setLocalCustomer({
      ...localCustomer,
      [field]: value
    });
  };

  // Handle storage allocation for customer
  const handleStorageAllocation = (allocationMB: number) => {
    setCustomerStorageAllocation(allocationMB);
    // TODO: Save allocation to backend
    console.log(`Allocating ${allocationMB} MB to customer ${localCustomer?.id}`);
  };



  const handleToggle = async (field: keyof CustomerData) => {
    if (!localCustomer) return;

    // If toggling customer portal access, check eligibility first
    if (field === 'customerPortalEnabled') {
      // If enabling the portal
      if (!localCustomer[field]) {
        try {
          const token = localStorage.getItem('partner_token');
          if (!token) {
            setPortalError('Authentication token not found. Please log in again.');
            return;
          }

          const response = await fetch(`/api/partner/customers/${localCustomer.id}/check-portal-eligibility`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (!response.ok) {
            setPortalError('Failed to check portal eligibility. Please try again.');
            return;
          }

          const data = await response.json();

          if (!data.eligible) {
            setPortalError(data.error || 'Customer is not eligible for portal access');
            return;
          }

          // If eligible, update local state and call the API
          setLocalCustomer({
            ...localCustomer,
            [field]: true
          });

          // Call API to create credentials
          handleEnableCustomerPortal();
          return;
        } catch (error: any) {
          console.error('Error checking eligibility:', error);
          setPortalError(error.message || 'Failed to check portal eligibility');
          return;
        }
      }
    }

    // Special handling for API Keys menu visibility
    if (field === 'showApiKeys') {
      // Only allow enabling if API access is enabled
      if (!localCustomer.enableApiAccess) {
        return;
      }
    }

    // Special handling for API Access
    if (field === 'enableApiAccess') {
      const newValue = !localCustomer[field];

      // If disabling API access, also disable the API Keys menu
      if (!newValue) {
        setLocalCustomer({
          ...localCustomer,
          [field]: newValue,
          showApiKeys: false
        });
        return;
      }
    }

    // Special handling for AI Credits
    if (field === 'aiCreditsEnabled') {
      const newValue = !localCustomer[field];

      // If enabling AI Credits, disable Show Pricing Information
      if (newValue) {
        setLocalCustomer({
          ...localCustomer,
          [field]: newValue,
          showPricingInformation: false
        });
        return;
      }

      // If disabling AI Credits, also disable AI Gateway (requires credits)
      if (!newValue) {
        setLocalCustomer({
          ...localCustomer,
          [field]: newValue,
          showAiGateway: false
        });
        return;
      }
    }

    // Special handling for AI Gateway
    if (field === 'showAiGateway') {
      // Only allow enabling if AI Credits are enabled
      if (!localCustomer.aiCreditsEnabled) {
        return;
      }
    }

    // Special handling for Integration
    if (field === 'showIntegration') {
      const newValue = !localCustomer[field];

      // If enabling Integration, open App Selection Modal instead of just toggling
      if (newValue) {
        setShowAppSelectionModal(true);
        return;
      }

      // If disabling Integration, clear allowed apps too
      setLocalCustomer({
        ...localCustomer,
        [field]: false,
        allowedApps: []
      });
      return;
    }

    // For all other toggles or disabling the portal
    setLocalCustomer({
      ...localCustomer,
      [field]: !localCustomer[field]
    });
  };

  const validateCustomerData = () => {
    if (!localCustomer) return { isValid: false, errors: ['Customer data is missing'] };

    const errors: string[] = [];

    // Required field validation
    if (!localCustomer.firstName?.trim()) {
      errors.push('First name is required');
    }
    if (!localCustomer.lastName?.trim()) {
      errors.push('Last name is required');
    }
    if (!localCustomer.email?.trim()) {
      errors.push('Email is required');
    } else {
      // Email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(localCustomer.email)) {
        errors.push('Please enter a valid email address');
      }
    }
    if (!localCustomer.companyName?.trim()) {
      errors.push('Company name is required');
    }

    return { isValid: errors.length === 0, errors };
  };

  const handleSave = async () => {
    if (!localCustomer) return;

    // Validate customer data
    const validation = validateCustomerData();
    if (!validation.isValid) {
      showToast(`Please fix the following errors:\n${validation.errors.join('\n')}`, 'error');
      return;
    }

    // Log the customer data being sent to the API
    console.log('Saving customer data:', localCustomer);

    setIsUpdating(true);
    try {
      // PUT endpoint expects userOnboarding ID, not customer ID
      console.log('Saving customer data with userOnboarding ID:', localCustomer.id);
      const response = await fetch(`/api/partner/customers/${localCustomer.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('partner_token')}`,
        },
        body: JSON.stringify(localCustomer),
      });

      if (!response.ok) {
        // Try to get more detailed error information
        let errorMessage = 'Failed to update customer';
        try {
          const errorData = await response.json();
          console.error('API error response:', errorData);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (e) {
          console.error('Could not parse error response');
        }
        throw new Error(errorMessage);
      }

      const updatedCustomer = await response.json();
      console.log('API response:', updatedCustomer);

      // Show success message
      showToast('Customer information updated successfully', 'success');

      onUpdateCustomer(updatedCustomer.data || localCustomer);
    } catch (error: any) {
      console.error('Error updating customer:', error);
      showToast(error.message || 'Failed to update customer. Please try again.', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!localCustomer) return;

    handleInputChange('orderStatus', newStatus);
  };

  const handleDealStatusChange = async (newStatus: string) => {
    if (!localCustomer) return;

    handleInputChange('dealStatus', newStatus);
  };

  const handleDeploymentStatusChange = async (newStatus: string, notes?: string) => {
    if (!localCustomer || !localCustomer.customerId) return;

    try {
      // Use customerId (actual Customer.id) instead of id (UserOnboarding.id)
      const response = await fetch(`/api/partner/customers/${localCustomer.customerId}/deployment-status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('partner_token')}`,
        },
        body: JSON.stringify({
          deploymentStatus: newStatus,
          deploymentNotes: notes
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update deployment status');
      }

      const data = await response.json();

      // Update local customer state
      const updatedCustomer = {
        ...localCustomer,
        deploymentStatus: data.customer.deploymentStatus,
        deploymentNotes: data.customer.deploymentNotes,
        deploymentRequestedAt: data.customer.deploymentRequestedAt,
        phoneProvisionedAt: data.customer.phoneProvisionedAt,
        agentDeployingAt: data.customer.agentDeployingAt,
        agentReadyAt: data.customer.agentReadyAt,
        deploymentCompletedAt: data.customer.deploymentCompletedAt
      };

      setLocalCustomer(updatedCustomer);

      // Notify parent component to update the customer list
      onUpdateCustomer(updatedCustomer);

      // Show success message based on status
      if (newStatus === 'phone_provisioned') {
        // Show phone number selection modal
        setShowPhoneNumberModal(true);
      } else if (newStatus === 'agent_deploying') {
        // Show agent selection modal
        setShowAgentSelectionModal(true);
      } else {
        showToast('Deployment status updated successfully!', 'success');
      }

    } catch (error) {
      console.error('Error updating deployment status:', error);
      showToast('Failed to update deployment status. Please try again.', 'error');
    }
  };

  const handleEnableCustomerPortal = async () => {
    if (!localCustomer) return;

    setIsEnablingPortal(true);
    setPortalSuccess(null);
    setPortalError(null);

    try {
      // Get the token from localStorage
      const token = localStorage.getItem('partner_token');
      console.log('Using token for portal access:', token ? 'Token exists' : 'No token found');

      // Ensure token is valid format
      if (!token || token.split('.').length !== 3) {
        console.error('Invalid token format in localStorage');
        throw new Error('Invalid authentication token. Please log out and log in again.');
      }

      const response = await fetch(`/api/partner/customers/${localCustomer.id}/portal-access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log('Portal access API response status:', response.status);

      if (!response.ok) {
        let errorMessage = 'Failed to enable customer portal';

        try {
          // Try to parse as JSON first
          const errorData = await response.json();
          console.error('Portal access API error:', errorData);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // If not JSON, try to get as text
          try {
            const errorText = await response.text();
            console.error('Portal access API error (text):', errorText);
            errorMessage = errorText || errorMessage;
          } catch (textError) {
            console.error('Could not parse error response:', textError);
          }
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('Portal access API success:', data);
      setPortalSuccess(data.message || 'Portal access enabled and credentials sent to customer email');

      // Always update the customer portal status to true
      const updatedCustomer = {
        ...localCustomer,
        customerPortalEnabled: true
      };
      setLocalCustomer(updatedCustomer);
      onUpdateCustomer(updatedCustomer);
    } catch (error: any) {
      console.error('Error enabling customer portal:', error);
      setPortalError(error.message || 'Failed to enable customer portal');
    } finally {
      setIsEnablingPortal(false);
    }
  };

  const handleBlockCustomerPortal = () => {
    if (!localCustomer) return;

    const isBlocked = localCustomer.credentialStatus === 'suspended';

    showConfirmation(
      isBlocked ? 'Grant Portal Access' : 'Block Portal Access',
      isBlocked
        ? 'Are you sure you want to grant this customer portal access? They will be able to log in again.'
        : 'Are you sure you want to block this customer\'s portal access? They will no longer be able to log in.',
      async () => {
        setConfirmModal(prev => ({ ...prev, isLoading: true }));
        setIsBlockingPortal(true);
        setPortalSuccess(null);
        setPortalError(null);

        try {
          // Get the token from localStorage
          const token = localStorage.getItem('partner_token');

          // Ensure token is valid format
          if (!token || token.split('.').length !== 3) {
            console.error('Invalid token format in localStorage');
            throw new Error('Invalid authentication token. Please log out and log in again.');
          }

          const response = await fetch(`/api/partner/customers/${localCustomer.id}/portal-access/block`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
          });

          if (!response.ok) {
            let errorMessage = isBlocked ? 'Failed to grant portal access' : 'Failed to block customer portal';

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
          setPortalSuccess(data.message || (isBlocked ? 'Customer portal access has been granted' : 'Customer portal access has been blocked'));
          
          // Update local customer state with new credential status
          const updatedCustomer = {
            ...localCustomer,
            credentialStatus: data.newStatus
          };
          setLocalCustomer(updatedCustomer);
          onUpdateCustomer(updatedCustomer);
          
          closeConfirmModal();
        } catch (error: any) {
          console.error('Error toggling customer portal:', error);
          setPortalError(error.message || (isBlocked ? 'Failed to grant portal access' : 'Failed to block customer portal'));
          closeConfirmModal();
        } finally {
          setIsBlockingPortal(false);
        }
      },
      isBlocked ? 'info' : 'danger'
    );
  };

  const handleDeleteCustomerPortal = () => {
    if (!localCustomer) return;

    showConfirmation(
      'Delete Portal Access',
      'Are you sure you want to delete this customer\'s portal access? This will permanently remove their credentials and cannot be undone.',
      async () => {
        setConfirmModal(prev => ({ ...prev, isLoading: true }));
        setIsDeletingPortal(true);
        setPortalSuccess(null);
        setPortalError(null);

        try {
          // Get the token from localStorage
          const token = localStorage.getItem('partner_token');

          // Ensure token is valid format
          if (!token || token.split('.').length !== 3) {
            console.error('Invalid token format in localStorage');
            throw new Error('Invalid authentication token. Please log out and log in again.');
          }

          const response = await fetch(`/api/partner/customers/${localCustomer.id}/portal-access/delete`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
          });

          if (!response.ok) {
            let errorMessage = 'Failed to delete customer portal';

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
          setPortalSuccess(data.message || 'Customer portal access has been deleted');

          // Update local state
          const updatedCustomer = {
            ...localCustomer,
            customerPortalEnabled: false
          };
          setLocalCustomer(updatedCustomer);
          onUpdateCustomer(updatedCustomer);
          closeConfirmModal();
        } catch (error: any) {
          console.error('Error deleting customer portal:', error);
          setPortalError(error.message || 'Failed to delete customer portal');
          closeConfirmModal();
        } finally {
          setIsDeletingPortal(false);
        }
      },
      'danger'
    );
  };

  const handlePreviewCustomerPortal = async () => {
    if (!localCustomer) return;

    setIsPreviewingPortal(true);
    setPortalSuccess(null);
    setPortalError(null);

    try {
      // Get the token from localStorage
      const token = localStorage.getItem('partner_token');

      // Ensure token is valid format
      if (!token || token.split('.').length !== 3) {
        console.error('Invalid token format in localStorage');
        throw new Error('Invalid authentication token. Please log out and log in again.');
      }

      const response = await fetch(`/api/partner/customers/${localCustomer.id}/impersonate`, {
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
        // No need to extract base portal URL since we're using direct URL approach

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

        // For now, always use URL with token for reliability
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

        // Since we're using URL with token, no need for postMessage
        // The secure-preview page will process the token from URL parameters

        setPortalSuccess(`Secure preview session opened. Session expires in ${Math.floor(data.expiresIn / 60)} minutes.`);
      } else {
        throw new Error(data.error || 'Failed to create preview session');
      }

    } catch (error: any) {
      console.error('Error creating preview session:', error);
      setPortalError(error.message || 'Failed to create preview session');
    } finally {
      setIsPreviewingPortal(false);
    }
  };

  const handleBillingTypeChange = async (newType: string) => {
    if (!localCustomer) return;

    handleInputChange('billingType', newType);
  };

  const handlePhoneNumberAssigned = (phoneNumber: any) => {
    setAssignedPhoneNumber(phoneNumber.phoneNumber);
    showToast(`Phone number ${phoneNumber.phoneNumber} has been assigned successfully!`, 'success');
  };

  const handleAgentAssigned = (agent: any, phoneNumber: any) => {
    showToast(`Agent "${agent.name}" has been assigned and connected to ${phoneNumber.phoneNumber}!`, 'success');
  };

  // Check scroll position and update arrow visibility
  const checkScrollPosition = () => {
    if (tabListRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabListRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 5);
    }
  };

  // Scroll tabs left or right
  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabListRef.current) {
      const scrollAmount = 200;
      const newScrollLeft = direction === 'left' 
        ? tabListRef.current.scrollLeft - scrollAmount
        : tabListRef.current.scrollLeft + scrollAmount;
      
      tabListRef.current.scrollTo({
        left: newScrollLeft,
        behavior: 'smooth'
      });
    }
  };

  // Check scroll position on mount and when tabs change
  useEffect(() => {
    checkScrollPosition();
    const tabList = tabListRef.current;
    if (tabList) {
      tabList.addEventListener('scroll', checkScrollPosition);
      window.addEventListener('resize', checkScrollPosition);
      return () => {
        tabList.removeEventListener('scroll', checkScrollPosition);
        window.removeEventListener('resize', checkScrollPosition);
      };
    }
  }, [localCustomer]);

  if (!localCustomer) {
    return (
      <Dialog
        open={isOpen}
        onClose={onClose}
        className="relative z-50"
      >
        <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <Dialog.Panel className="relative bg-gray-900 rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-xl border border-gray-800">
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <FiRefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
                <p className="text-gray-400">Loading customer data...</p>
              </div>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      className="relative z-50"
    >
      <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
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
          className="relative bg-gray-900 rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-xl border border-gray-800"
        >
          <div className="flex justify-between items-start mb-6">
            <Dialog.Title className="text-2xl font-bold text-white">
              {localCustomer.companyName || `${localCustomer.firstName} ${localCustomer.lastName}`}
            </Dialog.Title>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <FiX className="w-6 h-6" />
            </button>
          </div>

          <Tab.Group>
            {/* Tab navigation with scroll arrows */}
            <div className="relative mb-6">
              {/* Left scroll arrow */}
              {showLeftArrow && (
                <button
                  onClick={() => scrollTabs('left')}
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-gradient-to-r from-gray-900 to-transparent pl-2 pr-6 py-2 hover:from-gray-800 transition-colors"
                  aria-label="Scroll tabs left"
                >
                  <FiChevronLeft className="w-5 h-5 text-white" />
                </button>
              )}
              
              {/* Right scroll arrow */}
              {showRightArrow && (
                <button
                  onClick={() => scrollTabs('right')}
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-gradient-to-l from-gray-900 to-transparent pr-2 pl-6 py-2 hover:from-gray-800 transition-colors"
                  aria-label="Scroll tabs right"
                >
                  <FiChevronRight className="w-5 h-5 text-white" />
                </button>
              )}

              <Tab.List 
                ref={tabListRef}
                className="flex overflow-x-auto scrollbar-hide gap-1 rounded-xl bg-gray-800/50 p-1 scroll-smooth"
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                }}
              >
              <Tab
                className={({ selected }) =>
                  clsx(
                    'flex-shrink-0 rounded-lg py-2 px-3 text-xs font-medium leading-5 transition-all duration-200 whitespace-nowrap',
                    'ring-white/60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2',
                    selected
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                      : 'text-gray-400 hover:bg-gray-800/30 hover:text-white'
                  )
                }
              >
                <div className="flex items-center gap-1.5">
                  <FiUser className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Customer Info</span>
                </div>
              </Tab>
              <Tab
                className={({ selected }) =>
                  clsx(
                    'flex-shrink-0 rounded-lg py-2 px-3 text-xs font-medium leading-5 transition-all duration-200 whitespace-nowrap',
                    'ring-white/60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2',
                    selected
                      ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg'
                      : 'text-gray-400 hover:bg-gray-800/30 hover:text-white'
                  )
                }
              >
                <div className="flex items-center gap-1.5">
                  <FiDollarSign className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Deal Management</span>
                </div>
              </Tab>
              <Tab
                className={({ selected }) =>
                  clsx(
                    'flex-shrink-0 rounded-lg py-2 px-3 text-xs font-medium leading-5 transition-all duration-200 whitespace-nowrap',
                    'ring-white/60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2',
                    selected
                      ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg'
                      : 'text-gray-400 hover:bg-gray-800/30 hover:text-white'
                  )
                }
              >
                <div className="flex items-center gap-1.5">
                  <FiSettings className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Features & Add-ons</span>
                </div>
              </Tab>
              {/* Billing Tab */}
              <Tab
                className={({ selected }) =>
                  clsx(
                    'flex-shrink-0 rounded-lg py-2 px-3 text-xs font-medium leading-5 transition-all duration-200 whitespace-nowrap',
                    'ring-white/60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2',
                    selected
                      ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg'
                      : 'text-gray-400 hover:bg-gray-800/30 hover:text-white'
                  )
                }
              >
                <div className="flex items-center gap-1.5">
                  <FiFileText className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Billing</span>
                  {!isBillingEnabled && !isLoadingStripeStatus && (
                    <FiAlertCircle className="w-3 h-3 text-orange-400 ml-1" />
                  )}
                </div>
              </Tab>
              <Tab
                className={({ selected }) =>
                  clsx(
                    'flex-shrink-0 rounded-lg py-2 px-3 text-xs font-medium leading-5 transition-all duration-200 whitespace-nowrap',
                    'ring-white/60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2',
                    selected
                      ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-lg'
                      : 'text-gray-400 hover:bg-gray-800/30 hover:text-white'
                  )
                }
              >
                <div className="flex items-center gap-1.5">
                  <FiPhone className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Phone Numbers</span>
                </div>
              </Tab>
              <Tab
                className={({ selected }) =>
                  clsx(
                    'flex-shrink-0 rounded-lg py-2 px-3 text-xs font-medium leading-5 transition-all duration-200 whitespace-nowrap',
                    'ring-white/60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2',
                    selected
                      ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white shadow-lg'
                      : 'text-gray-400 hover:bg-gray-800/30 hover:text-white'
                  )
                }
              >
                <div className="flex items-center gap-1.5">
                  <FiDollarSign className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Credits</span>
                </div>
              </Tab>
              <Tab
                className={({ selected }) =>
                  clsx(
                    'flex-shrink-0 rounded-lg py-2 px-3 text-xs font-medium leading-5 transition-all duration-200 whitespace-nowrap',
                    'ring-white/60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2',
                    selected
                      ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg'
                      : 'text-gray-400 hover:bg-gray-800/30 hover:text-white'
                  )
                }
              >
                <div className="flex items-center gap-1.5">
                  <FiLink className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Embed URLs</span>
                </div>
              </Tab>
              <Tab
                className={({ selected }) =>
                  clsx(
                    'flex-shrink-0 rounded-lg py-2 px-3 text-xs font-medium leading-5 transition-all duration-200 whitespace-nowrap',
                    'ring-white/60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2',
                    selected
                      ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg'
                      : 'text-gray-400 hover:bg-gray-800/30 hover:text-white'
                  )
                }
              >
                <div className="flex items-center gap-1.5">
                  <FiZap className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Deployment</span>
                </div>
              </Tab>

              {/* Reports Tab */}
              <Tab
                className={({ selected }) =>
                  clsx(
                    'flex-shrink-0 rounded-lg py-2 px-3 text-xs font-medium leading-5 transition-all duration-200 whitespace-nowrap',
                    'ring-white/60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2',
                    selected
                      ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg'
                      : 'text-gray-400 hover:bg-gray-800/30 hover:text-white'
                  )
                }
              >
                <div className="flex items-center gap-1.5">
                  <FiBarChart className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Reports</span>
                </div>
              </Tab>

              {/* Tool Call Quota Tab - Only show when integration is enabled */}
              {localCustomer.showIntegration ? (
                <Tab
                  className={({ selected }) =>
                    clsx(
                      'flex-shrink-0 rounded-lg py-2 px-3 text-xs font-medium leading-5 transition-all duration-200 whitespace-nowrap',
                      'ring-white/60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2',
                      selected
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                        : 'text-gray-400 hover:bg-gray-800/30 hover:text-white'
                    )
                  }
                >
                  <div className="flex items-center gap-1.5">
                    <FiZap className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Tool Call Quota</span>
                  </div>
                </Tab>
              ) : null}
            </Tab.List>
            </div>
            <Tab.Panels>
              {/* Customer Info Panel */}
              <Tab.Panel className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-800/50 rounded-xl p-6 space-y-4">
                    <h3 className="text-lg font-semibold text-white">Basic Information</h3>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            <FiUser className="w-4 h-4 inline mr-2 text-blue-400" />
                            First Name <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="text"
                            value={localCustomer.firstName || ''}
                            onChange={(e) => handleInputChange('firstName', e.target.value)}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter first name"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Last Name <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="text"
                            value={localCustomer.lastName || ''}
                            onChange={(e) => handleInputChange('lastName', e.target.value)}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter last name"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          <FiMail className="w-4 h-4 inline mr-2 text-blue-400" />
                          Email Address <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="email"
                          value={localCustomer.email || ''}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter email address"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          <FiInfo className="w-4 h-4 inline mr-2 text-blue-400" />
                          Company Name <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={localCustomer.companyName || ''}
                          onChange={(e) => handleInputChange('companyName', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter company name"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          <FiPhone className="w-4 h-4 inline mr-2 text-blue-400" />
                          Business Phone
                        </label>
                        <input
                          type="tel"
                          value={localCustomer.businessPhone || ''}
                          onChange={(e) => handleInputChange('businessPhone', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter business phone"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-800/50 rounded-xl p-6 space-y-4">
                    <h3 className="text-lg font-semibold text-white">Business Details</h3>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Monthly Call Volume
                        </label>
                        <input
                          type="text"
                          value={localCustomer.monthlyCallVolume || ''}
                          onChange={(e) => handleInputChange('monthlyCallVolume', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., 1000-5000 calls/month"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Primary Use Case
                        </label>
                        <input
                          type="text"
                          value={localCustomer.primaryUseCase || ''}
                          onChange={(e) => handleInputChange('primaryUseCase', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., Customer Support, Sales, etc."
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Call Complexity
                        </label>
                        <select
                          value={localCustomer.callComplexity || ''}
                          onChange={(e) => handleInputChange('callComplexity', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select complexity</option>
                          <option value="Simple">Simple</option>
                          <option value="Medium">Medium</option>
                          <option value="Complex">Complex</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          CRM System
                        </label>
                        <input
                          type="text"
                          value={localCustomer.crmSystem || ''}
                          onChange={(e) => handleInputChange('crmSystem', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., Salesforce, HubSpot, etc."
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Phone System
                        </label>
                        <input
                          type="text"
                          value={localCustomer.phoneSystem || ''}
                          onChange={(e) => handleInputChange('phoneSystem', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., Twilio, RingCentral, etc."
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Deployment Timeline
                        </label>
                        <input
                          type="text"
                          value={localCustomer.deploymentTimeline || ''}
                          onChange={(e) => handleInputChange('deploymentTimeline', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., 2-4 weeks, ASAP, etc."
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800/50 rounded-xl p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-white">Account Management</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Processing Status
                      </label>
                      <select
                        value={localCustomer.orderStatus}
                        onChange={(e) => handleStatusChange(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Custom Automation
                      </label>
                      <textarea
                        value={localCustomer.customAutomation || ''}
                        onChange={(e) => handleInputChange('customAutomation', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Describe any custom automation requirements"
                        rows={3}
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800/50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Pricing Breakdown</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 p-4 bg-gray-700/50 rounded-lg">
                      <div className="text-lg font-semibold text-gray-300">Total Estimated Cost</div>
                      <div className="text-3xl font-bold text-white">
                        ${(localCustomer.estimatedPrice ?? 0).toLocaleString()}/month
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="p-4 bg-gray-700/30 rounded-lg">
                        <div className="text-sm text-white">Platform Fee</div>
                        <div className="text-lg text-blue-400 font-semibold">${priceBreakdown?.platformFee || 0}</div>
                      </div>
                      <div className="p-4 bg-gray-700/30 rounded-lg">
                        <div className="text-sm text-white">Voice AI Cost</div>
                        <div className="text-lg text-blue-400 font-semibold">${priceBreakdown?.voiceAICost || 0}</div>
                      </div>
                      <div className="p-4 bg-gray-700/30 rounded-lg">
                        <div className="text-sm text-white">Telephony Cost</div>
                        <div className="text-lg text-blue-400 font-semibold">${priceBreakdown?.telephonyCost || 0}</div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="p-4 bg-gray-700/30 rounded-lg">
                        <div className="text-sm text-white">Email Cost</div>
                        <div className="text-lg text-blue-400 font-semibold">${priceBreakdown?.emailCost || 0}</div>
                      </div>
                      <div className="p-4 bg-gray-700/30 rounded-lg">
                        <div className="text-sm text-white">SMS Cost</div>
                        <div className="text-lg text-blue-400 font-semibold">${priceBreakdown?.smsCost || 0}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </Tab.Panel>

              {/* Deal Management Panel */}
              <Tab.Panel className="space-y-6">
                <div className="bg-gray-800/50 rounded-xl p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-white">Deal Status</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-gray-300 font-medium">Deal Status</label>
                        <select
                          value={localCustomer.dealStatus || 'PENDING'}
                          onChange={(e) => handleDealStatusChange(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="PENDING">Pending</option>
                          <option value="AGREED">Agreed</option>
                          <option value="FAILED">Failed</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-2">
                        <label className="text-gray-300 font-medium">Billing Type</label>
                        <select
                          value={localCustomer.billingType || 'MONTHLY'}
                          onChange={(e) => handleBillingTypeChange(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="MONTHLY">Monthly Recurring</option>
                          <option value="ONE_TIME">One-time Payment</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-gray-300 font-medium">Estimated Price</label>
                        <div className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white">
                          ${(localCustomer.estimatedPrice ?? 0).toLocaleString()}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <label className="text-gray-300 font-medium">Agreed Price</label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">$</span>
                          <input
                            type="number"
                            value={localCustomer.agreedPrice || ''}
                            onChange={(e) => handleInputChange('agreedPrice', parseFloat(e.target.value) || null)}
                            placeholder="Enter agreed price"
                            className="w-full pl-8 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800/50 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">Deal Notes</h3>
                    <span className="text-xs text-gray-400">Coming soon</span>
                  </div>

                  <textarea
                    disabled
                    placeholder="Add notes about this deal (coming soon)"
                    className="w-full h-32 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  ></textarea>
                </div>
              </Tab.Panel>

              {/* Features & Add-ons Panel */}
              <Tab.Panel className="space-y-6">
                <div className="bg-gray-800/50 rounded-xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">Customer Portal</h3>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                    <div>
                      <div className="font-medium text-white">Enable Customer Portal</div>
                      <div className="text-sm text-gray-400">Allow customer to access their own dashboard</div>
                    </div>
                    <button
                      onClick={() => handleToggle('customerPortalEnabled')}
                      className="relative"
                    >
                      {localCustomer.customerPortalEnabled ? (
                        <FiToggleRight className="w-10 h-6 text-blue-500" />
                      ) : (
                        <FiToggleLeft className="w-10 h-6 text-gray-500" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="bg-gray-800/50 rounded-xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">Add-on Features</h3>
                    <div className="relative">
                      <FiHelpCircle
                        className="w-5 h-5 text-gray-400 cursor-help"
                        onMouseEnter={() => setShowTooltip('addons')}
                        onMouseLeave={() => setShowTooltip(null)}
                      />
                      {showTooltip === 'addons' && (
                        <div className="absolute right-0 w-64 p-2 mt-2 text-xs text-white bg-gray-800 rounded-md shadow-lg z-10">
                          These features may be paid add-ons in the future. Please check the support guide for more information.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                      <div>
                        <div className="font-medium text-white">Advanced AI Analytics</div>
                        <div className="text-sm text-gray-400">
                          {!partnerAiAnalyticsEnabled
                            ? "Disabled at partner level — enable in Partner Settings first"
                            : "AI-powered call analysis (1 credit per analysis)"
                          }
                        </div>
                      </div>
                      <button
                        onClick={() => partnerAiAnalyticsEnabled && handleToggle('enableAdvancedAnalytics')}
                        className="relative"
                        disabled={!partnerAiAnalyticsEnabled}
                      >
                        {localCustomer.enableAdvancedAnalytics && partnerAiAnalyticsEnabled ? (
                          <FiToggleRight className="w-10 h-6 text-blue-500" />
                        ) : (
                          <FiToggleLeft className={`w-10 h-6 ${!partnerAiAnalyticsEnabled ? 'text-gray-600' : 'text-gray-500'}`} />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                      <div>
                        <div className="font-medium text-white">Detailed Call Analysis</div>
                        <div className="text-sm text-gray-400">In-depth analysis of each customer call</div>
                      </div>
                      <button
                        onClick={() => handleToggle('enableDetailedCallAnalysis')}
                        className="relative"
                      >
                        {localCustomer.enableDetailedCallAnalysis ? (
                          <FiToggleRight className="w-10 h-6 text-blue-500" />
                        ) : (
                          <FiToggleLeft className="w-10 h-6 text-gray-500" />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                      <div>
                        <div className="font-medium text-white">Action Point Analysis</div>
                        <div className="text-sm text-gray-400">Identify and track action items from calls</div>
                      </div>
                      <button
                        onClick={() => handleToggle('enableActionPointAnalysis')}
                        className="relative"
                      >
                        {localCustomer.enableActionPointAnalysis ? (
                          <FiToggleRight className="w-10 h-6 text-blue-500" />
                        ) : (
                          <FiToggleLeft className="w-10 h-6 text-gray-500" />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                      <div>
                        <div className="font-medium text-white">API Access</div>
                        <div className="text-sm text-gray-400">Allow programmatic access via API keys</div>
                      </div>
                      <button
                        onClick={() => handleToggle('enableApiAccess')}
                        className="relative"
                      >
                        {localCustomer.enableApiAccess ? (
                          <FiToggleRight className="w-10 h-6 text-blue-500" />
                        ) : (
                          <FiToggleLeft className="w-10 h-6 text-gray-500" />
                        )}
                      </button>
                    </div>

                    <div className="space-y-4">
                      {/* Gray out Knowledge Base Processing - Coming Soon */}
                      <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg opacity-50">
                        <div>
                          <div className="font-medium text-gray-400">Knowledge Base Processing</div>
                          <div className="text-sm text-gray-500">Allow customer to process knowledge bases (coming soon)</div>
                        </div>
                        <div className="relative">
                          <FiToggleLeft className="w-10 h-6 text-gray-600" />
                        </div>
                      </div>


                    </div>

                    <div className="mt-6 mb-3">
                      <h4 className="text-lg font-semibold text-white">AI Credit Management</h4>
                      <p className="text-sm text-gray-400 mt-1">Enable AI Credit-based pricing for this customer</p>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                      <div>
                        <div className="font-medium text-white">AI Credits Enabled</div>
                        <div className="text-sm text-gray-400">Charge customer using AI Credits instead of dollar pricing</div>
                      </div>
                      <button
                        onClick={() => handleToggle('aiCreditsEnabled')}
                        className="relative"
                      >
                        {localCustomer.aiCreditsEnabled ? (
                          <FiToggleRight className="w-10 h-6 text-blue-500" />
                        ) : (
                          <FiToggleLeft className="w-10 h-6 text-gray-500" />
                        )}
                      </button>
                    </div>

                    {/* Low Credit Notification Settings - Only show when AI Credits are enabled */}
                    {localCustomer.aiCreditsEnabled && (
                      <div className="mt-4 p-4 bg-blue-900/20 border border-blue-800/30 rounded-lg">
                        <div className="mb-4">
                          <h5 className="text-md font-medium text-white mb-2">Low Credit Notifications</h5>
                          <p className="text-sm text-gray-400">Send whitelabel email alerts when customer's AI credits are running low</p>
                        </div>

                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <div className="font-medium text-white">Enable Notifications</div>
                            <div className="text-sm text-gray-400">Send email alerts to customer when credits are low</div>
                          </div>
                          <button
                            onClick={() => handleToggle('lowCreditNotificationsEnabled')}
                            className="relative"
                          >
                            {localCustomer.lowCreditNotificationsEnabled ? (
                              <FiToggleRight className="w-10 h-6 text-blue-500" />
                            ) : (
                              <FiToggleLeft className="w-10 h-6 text-gray-500" />
                            )}
                          </button>
                        </div>

                        {localCustomer.lowCreditNotificationsEnabled && (
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              Low Credit Threshold
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="1"
                                max="1000"
                                value={localCustomer.lowCreditThreshold || 10}
                                onChange={(e) => handleInputChange('lowCreditThreshold', parseInt(e.target.value) || 10)}
                                className="w-24 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="10"
                              />
                              <span className="text-sm text-gray-400">credits remaining</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              Customer will receive an email when their AI credit balance reaches this threshold or below
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mt-6 mb-3">
                      <h4 className="text-lg font-semibold text-white">Pricing Information</h4>
                      <p className="text-sm text-gray-400 mt-1">Control whether pricing information is visible to the customer</p>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                      <div>
                        <div className="font-medium text-white">Show Pricing Information</div>
                        <div className="text-sm text-gray-400">
                          {localCustomer.aiCreditsEnabled
                            ? "Disabled when AI Credits are enabled"
                            : "Display cost information in customer dashboard"
                          }
                        </div>
                      </div>
                      <button
                        onClick={() => !localCustomer.aiCreditsEnabled && handleToggle('showPricingInformation')}
                        className="relative"
                        disabled={localCustomer.aiCreditsEnabled}
                      >
                        {localCustomer.showPricingInformation && !localCustomer.aiCreditsEnabled ? (
                          <FiToggleRight className="w-10 h-6 text-blue-500" />
                        ) : (
                          <FiToggleLeft className={`w-10 h-6 ${localCustomer.aiCreditsEnabled ? 'text-gray-600' : 'text-gray-500'}`} />
                        )}
                      </button>
                    </div>

                    <div className="mt-6 mb-3">
                      <h4 className="text-lg font-semibold text-white">Menu Visibility Options</h4>
                      <p className="text-sm text-gray-400 mt-1">Control which menu items are visible to the customer in the portal</p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                        <div>
                          <div className="font-medium text-white">Knowledge Base</div>
                          <div className="text-sm text-gray-400">Allow access to knowledge base management</div>
                        </div>
                        <button
                          onClick={() => handleToggle('showKnowledgeBase')}
                          className="relative"
                        >
                          {localCustomer.showKnowledgeBase ? (
                            <FiToggleRight className="w-10 h-6 text-blue-500" />
                          ) : (
                            <FiToggleLeft className="w-10 h-6 text-gray-500" />
                          )}
                        </button>
                      </div>

                      {/* Knowledge Base Storage Allocation */}
                      {localCustomer.showKnowledgeBase && (
                        <div className="p-4 bg-blue-900/20 border border-blue-800/30 rounded-lg ml-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <FiFileText className="w-5 h-5 text-blue-400" />
                              <div className="font-medium text-white">Storage Allocation</div>
                            </div>
                            {isLoadingStorage && (
                              <FiRefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
                            )}
                          </div>

                          {storageQuota ? (
                            <div className="space-y-3">
                              {/* Storage Usage Bar */}
                              <div>
                                <div className="flex justify-between text-sm mb-1">
                                  <span className="text-gray-300">
                                    {(storageQuota.usedMB || 0).toFixed(1)} MB used of {storageQuota.totalQuotaMB || 0} MB
                                  </span>
                                  <span className="text-gray-400">
                                    {(storageQuota.utilizationPercentage || 0).toFixed(1)}%
                                  </span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full transition-all duration-300 ${
                                      (storageQuota.utilizationPercentage || 0) > 90
                                        ? 'bg-red-500'
                                        : (storageQuota.utilizationPercentage || 0) > 75
                                          ? 'bg-yellow-500'
                                          : 'bg-blue-500'
                                    }`}
                                    style={{ width: `${Math.min(storageQuota.utilizationPercentage || 0, 100)}%` }}
                                  />
                                </div>
                              </div>

                              {/* Storage Allocation Input */}
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <div className="text-gray-400 mb-1">Allocated Storage (MB)</div>
                                  <input
                                    type="number"
                                    min="0"
                                    max={storageQuota.availableMB || 0}
                                    value={customerStorageAllocation}
                                    onChange={(e) => handleStorageAllocation(parseInt(e.target.value) || 0)}
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                                    placeholder="Enter allocation in MB"
                                  />
                                </div>
                                <div>
                                  <div className="text-gray-400 mb-1">Partner Available</div>
                                  <div className="text-green-400 font-medium py-2">{(storageQuota.availableMB || 0).toFixed(1)} MB</div>
                                </div>
                              </div>

                              {/* Warning for over-allocation */}
                              {customerStorageAllocation > (storageQuota.availableMB || 0) && (
                                <div className="flex items-center gap-2 p-2 bg-red-900/30 border border-red-800/30 rounded text-red-400 text-sm">
                                  <FiInfo className="w-4 h-4" />
                                  <span>Allocation exceeds available storage. Consider purchasing additional space.</span>
                                </div>
                              )}

                              {/* Purchase Additional Storage Info */}
                              <div className="text-xs text-gray-400 pt-2 border-t border-gray-700">
                                💡 Need more space? Additional storage available at $8/GB
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-gray-400">
                              {isLoadingStorage ? 'Loading storage information...' : 'Storage information unavailable'}
                            </div>
                          )}

                          {/* Auto Embedding Toggle */}
                          <div className="mt-4 p-4 bg-green-900/20 border border-green-800/30 rounded-lg">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <FiDatabase className="w-5 h-5 text-green-400" />
                                <div className="font-medium text-white">Auto Embedding</div>
                                <button
                                  type="button"
                                  onClick={() => setShowAutoEmbeddingCharges(!showAutoEmbeddingCharges)}
                                  className="ml-2 p-1 hover:bg-gray-700 rounded-full transition-colors"
                                  title="View charges"
                                >
                                  <FiInfo className="w-4 h-4 text-gray-400 hover:text-white" />
                                </button>
                              </div>
                              <button
                                onClick={() => handleToggle('autoEmbeddingEnabled')}
                                className={`
                                  relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                                  ${localCustomer.autoEmbeddingEnabled ? 'bg-green-500' : 'bg-gray-600'}
                                `}
                              >
                                <span
                                  className={`
                                    inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                                    ${localCustomer.autoEmbeddingEnabled ? 'translate-x-6' : 'translate-x-1'}
                                  `}
                                />
                              </button>
                            </div>

                            <p className="text-sm text-gray-300 mb-3">
                              Auto embedding will automatically prepare the knowledge base for agent retrieval.
                              The knowledge base can be re-used across various agents. Charges apply.
                            </p>

                            {/* Charges Information */}
                            {showAutoEmbeddingCharges && (
                              <div className="mt-3 p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
                                <h4 className="text-sm font-medium text-white mb-2">Charges</h4>
                                <div className="space-y-1 text-xs text-gray-300">
                                  <div className="flex justify-between">
                                    <span>Upload document:</span>
                                    <span className="text-green-400">20 credits per document + embedding processing</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Ingest website:</span>
                                    <span className="text-green-400">50 credits per website link, embedding included</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>KB Query:</span>
                                    <span className="text-green-400">2 credits per KnowledgeBaseQuery tool call</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                      <div>
                        <div className="font-medium text-white flex items-center gap-2">
                          Integration
                          {localCustomer.showIntegration && localCustomer.allowedApps && localCustomer.allowedApps.length > 0 && (
                            <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                              {localCustomer.allowedApps.length} app{localCustomer.allowedApps.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-400">Allow access to integration settings</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {localCustomer.showIntegration && (
                          <button
                            onClick={() => setShowAppSelectionModal(true)}
                            className="px-3 py-1 text-xs bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
                          >
                            Edit Apps
                          </button>
                        )}
                        <button
                          onClick={() => handleToggle('showIntegration')}
                          className="relative"
                        >
                          {localCustomer.showIntegration ? (
                            <FiToggleRight className="w-10 h-6 text-blue-500" />
                          ) : (
                            <FiToggleLeft className="w-10 h-6 text-gray-500" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                      <div>
                        <div className="font-medium text-white">Docs & Media</div>
                        <div className="text-sm text-gray-400">Allow access to document and media management</div>
                      </div>
                      <button
                        onClick={() => handleToggle('showDocsAndMedia')}
                        className="relative"
                      >
                        {localCustomer.showDocsAndMedia ? (
                          <FiToggleRight className="w-10 h-6 text-blue-500" />
                        ) : (
                          <FiToggleLeft className="w-10 h-6 text-gray-500" />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                      <div>
                        <div className="font-medium text-white">Schedule Meeting</div>
                        <div className="text-sm text-gray-400">Allow access to meeting scheduling</div>
                      </div>
                      <button
                        onClick={() => handleToggle('showScheduleMeeting')}
                        className="relative"
                      >
                        {localCustomer.showScheduleMeeting ? (
                          <FiToggleRight className="w-10 h-6 text-blue-500" />
                        ) : (
                          <FiToggleLeft className="w-10 h-6 text-gray-500" />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                      <div>
                        <div className="font-medium text-white">Phone Numbers</div>
                        <div className="text-sm text-gray-400">Allow access to phone number management</div>
                      </div>
                      <button
                        onClick={() => handleToggle('showPhoneNumbers')}
                        className="relative"
                      >
                        {localCustomer.showPhoneNumbers ? (
                          <FiToggleRight className="w-10 h-6 text-blue-500" />
                        ) : (
                          <FiToggleLeft className="w-10 h-6 text-gray-500" />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                      <div>
                        <div className="font-medium text-white">API Keys</div>
                        <div className="text-sm text-gray-400">Allow access to API key management</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!localCustomer.enableApiAccess && (
                          <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded">
                            Requires API Access
                          </span>
                        )}
                        <button
                          onClick={() => handleToggle('showApiKeys')}
                          disabled={!localCustomer.enableApiAccess}
                          className="relative"
                        >
                          {localCustomer.showApiKeys && localCustomer.enableApiAccess ? (
                            <FiToggleRight className="w-10 h-6 text-blue-500" />
                          ) : (
                            <FiToggleLeft className="w-10 h-6 text-gray-500" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* AI Gateway toggle - only visible when AI Credits are enabled */}
                    <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                      <div>
                        <div className="font-medium text-white flex items-center gap-2">
                          AI Gateway
                          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 bg-purple-500/10 border border-purple-500/30 px-1.5 py-0.5 rounded-full">Beta</span>
                        </div>
                        <div className="text-sm text-gray-400">Allow customer to generate their own AI Gateway API keys (billed via AI Credits)</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!localCustomer.aiCreditsEnabled && (
                          <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded">
                            Requires AI Credits
                          </span>
                        )}
                        <button
                          onClick={() => handleToggle('showAiGateway')}
                          disabled={!localCustomer.aiCreditsEnabled}
                          className="relative"
                        >
                          {localCustomer.showAiGateway && localCustomer.aiCreditsEnabled ? (
                            <FiToggleRight className="w-10 h-6 text-purple-500" />
                          ) : (
                            <FiToggleLeft className="w-10 h-6 text-gray-500" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="mt-6 mb-3">
                      <h4 className="text-lg font-semibold text-white">Team Management</h4>
                      <p className="text-sm text-gray-400 mt-1">Control team member access for this customer</p>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                      <div>
                        <div className="font-medium text-white">Enable Team Members</div>
                        <div className="text-sm text-gray-400">Allow customer to invite team members</div>
                      </div>
                      <button
                        onClick={() => handleToggle('enableTeamMembers')}
                        className="relative"
                      >
                        {localCustomer.enableTeamMembers ? (
                          <FiToggleRight className="w-10 h-6 text-blue-500" />
                        ) : (
                          <FiToggleLeft className="w-10 h-6 text-gray-500" />
                        )}
                      </button>
                    </div>

                    <div className="p-4 bg-gray-700/30 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="font-medium text-white">Maximum Team Members</div>
                          <div className="text-sm text-gray-400">Set the maximum number of team members this customer can invite</div>
                        </div>
                      </div>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={localCustomer.maxTeamMembers || 0}
                        onChange={(e) => handleInputChange('maxTeamMembers', parseInt(e.target.value, 10))}
                        disabled={!localCustomer.enableTeamMembers}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {!localCustomer.enableTeamMembers ? 'Enable team members to set this value' : 'Set to 0 to disable team members'}
                      </p>
                    </div>

                    {/* Team Members List */}
                    {localCustomer.enableTeamMembers && (
                      localCustomer.customerId ? (
                        <TeamMembersList customerId={localCustomer.customerId} />
                      ) : (
                        <div className="p-4 bg-gray-700/30 rounded-lg mt-4 text-center">
                          <div className="text-amber-400 mb-2">
                            <FiInfo className="w-6 h-6 mx-auto" />
                          </div>
                          <p className="text-amber-400 text-sm">
                            Team members feature requires customer portal to be enabled first.
                          </p>
                        </div>
                      )
                    )}

                    {/* Customer Portal Access */}
                    <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                      <div>
                        <div className="font-medium text-white">Customer Portal Access</div>
                        <div className="text-sm text-gray-400">Allow customer to access white-label portal</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {localCustomer.customerPortalEnabled ? (
                          <>
                            <button
                              onClick={handlePreviewCustomerPortal}
                              disabled={isPreviewingPortal}
                              className="flex items-center gap-1 px-3 py-1 text-xs bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Preview customer portal as this customer"
                            >
                              <FiGlobe className="w-3 h-3" />
                              {isPreviewingPortal ? 'Opening...' : 'Preview Portal'}
                            </button>
                            <button
                              onClick={handleEnableCustomerPortal}
                              disabled={isEnablingPortal}
                              className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Reset password and send new credentials"
                            >
                              <FiKey className="w-3 h-3" />
                              {isEnablingPortal ? 'Resetting...' : 'Reset Password'}
                            </button>
                            <button
                              onClick={handleBlockCustomerPortal}
                              disabled={isBlockingPortal}
                              className={`flex items-center gap-1 px-3 py-1 text-xs rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                localCustomer.credentialStatus === 'suspended'
                                  ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                                  : 'bg-yellow-500/20 text-amber-400 hover:bg-yellow-500/30'
                              }`}
                              title={localCustomer.credentialStatus === 'suspended' ? 'Grant customer portal access' : 'Block customer from accessing portal'}
                            >
                              <FiLock className="w-3 h-3" />
                              {isBlockingPortal 
                                ? (localCustomer.credentialStatus === 'suspended' ? 'Granting...' : 'Blocking...') 
                                : (localCustomer.credentialStatus === 'suspended' ? 'Grant Access' : 'Block Access')}
                            </button>
                            <button
                              onClick={handleDeleteCustomerPortal}
                              disabled={isDeletingPortal}
                              className="flex items-center gap-1 px-3 py-1 text-xs bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Delete portal access permanently"
                            >
                              <FiTrash2 className="w-3 h-3" />
                              {isDeletingPortal ? 'Deleting...' : 'Delete'}
                            </button>
                          </>
                        ) : null}
                        <button
                          onClick={() => handleToggle('customerPortalEnabled')}
                          className="relative"
                        >
                          {localCustomer.customerPortalEnabled ? (
                            <FiToggleRight className="w-10 h-6 text-blue-500" />
                          ) : (
                            <FiToggleLeft className="w-10 h-6 text-gray-500" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Success/Error Messages */}
                    {portalSuccess && (
                      <div className="p-3 bg-green-500/20 text-green-400 rounded-lg text-sm">
                        {portalSuccess}
                      </div>
                    )}
                    {portalError && (
                      <div className="p-3 bg-red-500/20 text-red-400 rounded-lg text-sm">
                        <div className="flex items-start gap-2">
                          <div className="flex-1">
                            {portalError}
                          </div>
                          {portalError.includes('whitelabel') && (
                            <button
                              onClick={() => window.open('/partner/settings/whitelabel', '_blank')}
                              className="flex items-center gap-1 px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
                            >
                              <FiSettings className="w-3 h-3" />
                              Fix Setup
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Tab.Panel>

              {/* Billing Panel */}
              <Tab.Panel className="space-y-6">
                {isBillingEnabled ? (
                  <CustomerBillingTab
                    customer={{
                      id: localCustomer.id,
                      firstName: localCustomer.firstName,
                      lastName: localCustomer.lastName,
                      companyName: localCustomer.companyName,
                      email: localCustomer.email,
                      customerId: localCustomer.customerId,
                    }}
                    onInvoiceCreated={(invoice) => {
                      console.log('Invoice created:', invoice);
                    }}
                  />
                ) : (
                  <div className="text-center py-12">
                    <div className="text-gray-400 mb-4">
                      <FiCreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium">Stripe Connect Required</p>
                      <p className="text-sm">
                        To enable billing features, you need to set up Stripe Connect in your partner settings.
                      </p>
                    </div>
                    <button
                      onClick={() => window.open('/partner/settings', '_blank')}
                      className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors"
                    >
                      Setup Stripe Connect
                    </button>
                  </div>
                )}
              </Tab.Panel>

              {/* Phone Numbers Panel */}
              <Tab.Panel className="space-y-6">
                {localCustomer.customerId ? (
                  <CustomerPhoneNumberManagement
                    customerId={localCustomer.customerId}
                    customerName={`${localCustomer.firstName} ${localCustomer.lastName}`}
                  />
                ) : (
                  <div className="text-center py-12">
                    <div className="text-gray-400 mb-4">
                      <FiPhone className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium">Customer Portal Required</p>
                      <p className="text-sm">
                        Enable customer portal access to manage phone numbers for this customer.
                      </p>
                    </div>
                    <button
                      onClick={() => handleToggle('customerPortalEnabled')}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                    >
                      Enable Customer Portal
                    </button>
                  </div>
                )}
              </Tab.Panel>

              {/* Credits Panel */}
              <Tab.Panel className="space-y-6">
                <CustomerCreditManagement
                  customerId={localCustomer.id}
                  customerName={`${localCustomer.firstName} ${localCustomer.lastName}`}
                />
                <CustomerCreditCheckEndpoint
                  customerId={localCustomer.id}
                  customerName={`${localCustomer.firstName} ${localCustomer.lastName}`}
                />
              </Tab.Panel>

              {/* Embed URLs Panel */}
              <Tab.Panel className="space-y-6">
                <CustomerEmbedTokenManagement
                  customerId={localCustomer.id}
                  customerName={`${localCustomer.firstName} ${localCustomer.lastName}`}
                />
              </Tab.Panel>

              {/* Deployment Management Panel */}
              <Tab.Panel className="space-y-6">
                <div className="bg-gray-800/50 rounded-xl p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-white">Deployment Status</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Current Status
                      </label>
                      <select
                        value={localCustomer.deploymentStatus || 'not_started'}
                        onChange={(e) => handleDeploymentStatusChange(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="not_started">Not Started</option>
                        <option value="phone_provisioned">Phone Number Provisioned</option>
                        <option value="agent_deploying">AI Agent Deploying</option>
                        <option value="agent_ready">Agent Ready for Testing</option>
                        <option value="completed">Deployment Complete</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Deployment Notes
                      </label>
                      <textarea
                        value={localCustomer.deploymentNotes || ''}
                        onChange={(e) => {
                          setLocalCustomer(prev => prev ? {
                            ...prev,
                            deploymentNotes: e.target.value
                          } : null);
                        }}
                        onBlur={() => {
                          if (localCustomer.deploymentNotes !== undefined) {
                            handleDeploymentStatusChange(
                              localCustomer.deploymentStatus || 'not_started',
                              localCustomer.deploymentNotes
                            );
                          }
                        }}
                        placeholder="Add notes about deployment progress..."
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                        rows={3}
                      />
                    </div>
                  </div>

                  {/* Deployment Timeline */}
                  <div className="mt-6">
                    <h4 className="text-md font-medium text-white mb-4">Deployment Timeline</h4>
                    <div className="space-y-3">
                      {[
                        { key: 'deploymentRequestedAt', label: 'Deployment Requested', status: 'not_started' },
                        { key: 'phoneProvisionedAt', label: 'Phone Number Provisioned', status: 'phone_provisioned' },
                        { key: 'agentDeployingAt', label: 'Agent Deployment Started', status: 'agent_deploying' },
                        { key: 'agentReadyAt', label: 'Agent Ready for Testing', status: 'agent_ready' },
                        { key: 'deploymentCompletedAt', label: 'Deployment Completed', status: 'completed' }
                      ].map((item) => {
                        const timestamp = localCustomer[item.key as keyof typeof localCustomer] as string;
                        const currentStatus = localCustomer.deploymentStatus || 'not_started';

                        // Define the status hierarchy
                        const statusHierarchy = ['not_started', 'phone_provisioned', 'agent_deploying', 'agent_ready', 'completed'];
                        const currentStatusIndex = statusHierarchy.indexOf(currentStatus);
                        const itemStatusIndex = statusHierarchy.indexOf(item.status);

                        // A step is completed if it's at or before the current status in the hierarchy
                        const isCompleted = itemStatusIndex <= currentStatusIndex;

                        return (
                          <div key={item.key} className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${isCompleted ? 'bg-green-500' : 'bg-gray-600'}`} />
                            <span className={`text-sm ${isCompleted ? 'text-green-400' : 'text-gray-400'}`}>
                              {item.label}
                            </span>
                            {isCompleted && (
                              <span className="text-xs text-gray-500 ml-auto">
                                {new Date(timestamp).toLocaleDateString()} {new Date(timestamp).toLocaleTimeString()}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </Tab.Panel>

              {/* Reports Panel */}
              <Tab.Panel className="space-y-6">
                <CustomerReportTab
                  customerId={localCustomer.id}
                  customerName={`${localCustomer.firstName} ${localCustomer.lastName}`}
                />
              </Tab.Panel>

              {/* Tool Call Quota Panel - Only show when integration is enabled */}
              {localCustomer.showIntegration ? (
                <Tab.Panel className="space-y-6">
                  <CustomerToolCallQuotaManagement
                    customerId={localCustomer.id}
                    customerName={`${localCustomer.firstName} ${localCustomer.lastName}`}
                  />
                </Tab.Panel>
              ) : null}
            </Tab.Panels>
          </Tab.Group>

          <div className="flex justify-end mt-6">
            <button
              onClick={handleSave}
              disabled={isUpdating}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-teal-500 rounded-lg font-semibold hover:from-blue-600 hover:to-teal-600 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
            >
              {isUpdating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </Dialog.Panel>
      </div>



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

      {/* Phone Number Selection Modal */}
      {localCustomer && (
        <PhoneNumberSelectionModal
          isOpen={showPhoneNumberModal}
          onClose={() => setShowPhoneNumberModal(false)}
          customerId={localCustomer.customerId || ''}
          customerName={`${localCustomer.firstName} ${localCustomer.lastName}`}
          onPhoneNumberAssigned={handlePhoneNumberAssigned}
        />
      )}

      {/* Agent Selection Modal */}
      {localCustomer && (
        <AgentSelectionModal
          isOpen={showAgentSelectionModal}
          onClose={() => setShowAgentSelectionModal(false)}
          customerId={localCustomer.customerId || ''}
          userOnboardingId={localCustomer.id}
          customerName={`${localCustomer.firstName} ${localCustomer.lastName}`}
          onAgentAssigned={handleAgentAssigned}
        />
      )}

      {/* App Selection Modal */}
      <AppSelectionModal
        isOpen={showAppSelectionModal}
        onClose={() => setShowAppSelectionModal(false)}
        onSave={(selectedApps) => {
          if (localCustomer) {
            setLocalCustomer({
              ...localCustomer,
              showIntegration: true,
              allowedApps: selectedApps
            });
            setShowIntegrationNotification(true);
          }
          setShowAppSelectionModal(false);
        }}
        isFreeForever={partnerIsFreeForever}
        currentApps={localCustomer?.allowedApps || []}
      />

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 duration-300">
          <div className={`px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 ${
            toast.type === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}>
            {toast.type === 'success' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        </div>
      )}
    </Dialog>
  );
}
