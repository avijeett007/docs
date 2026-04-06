'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { FiPhone, FiSearch, FiFilter, FiDownload, FiPlus, FiUser, FiDollarSign, FiUpload, FiLayers, FiLock } from 'react-icons/fi';
import { featureFlags } from '@/config/featureFlags';
import PartnerLayout from '@/components/partner/PartnerLayout';
import PhoneActivationWizard from '@/components/partner/PhoneActivationWizard';
import PhoneActivationStatus from '@/components/partner/PhoneActivationStatus';
import PhoneNumberImportModal from '@/components/partner/PhoneNumberImportModal';
import PhoneNumberAssignmentModal from '@/components/partner/PhoneNumberAssignmentModal';
import PhoneNumberAgentAssignmentModal from '@/components/partner/PhoneNumberAgentAssignmentModal';
import PhoneNumberDetailModal from '@/components/partner/PhoneNumberDetailModal';
import UnassignAgentConfirmModal from '@/components/partner/UnassignAgentConfirmModal';
import CustomerUnassignConfirmModal from '@/components/partner/CustomerUnassignConfirmModal';
import PhoneNumberDeleteConfirmModal from '@/components/partner/PhoneNumberDeleteConfirmModal';
import FreeForeverUpgradeModal from '@/components/partner/FreeForeverUpgradeModal';
import { OwnershipBadge } from '@/components/partner/OwnershipBadge';
import { FreeForeverUpgradeService } from '@/lib/services/freeForeverUpgradeService';
import { ClientTierValidationService } from '@/lib/services/clientTierValidationService';
import { logger } from '@/lib/logger';

interface AgentMapping {
  id: string;
  agentProvider: string;
  agentId: string;
  agentName: string | null;
  customerId: string;
  status: string;
  createdAt: string;
  inboundEnabled: boolean;
  outboundEnabled: boolean;
}

interface SipConfig {
  id: string;
  sipTrunkSid: string;
  originationUri: string;
  status: string;
}

interface PhoneNumber {
  id: string;
  phoneNumber: string;
  friendlyName?: string;
  provider: string;
  status: string;
  regulatoryStatus: string;
  verificationStatus: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
    fax: boolean;
  };
  canReceiveInbound: boolean;
  canSendOutbound: boolean;
  hideFromCustomer: boolean;

  // Ownership information
  ownership: 'partner' | 'customer';

  // Customer information (enhanced)
  customer: {
    id: string;
    name: string;
    email: string;
    subaccountStatus: string;
  } | null;

  // Financial information
  monthlyRecurringCost: number;
  purchaseInfo?: {
    purchasePrice: number;
    setupFee: number;
    monthlyRecurringCost: number;
    purchasedAt: string;
    status: string;
  } | null;

  // Agent assignment information
  agentMappings: AgentMapping[];
  hasAgentAssignment: boolean;
  agentInfo?: {
    provider: string;
    agentId: string;
    agentName: string;
  } | null;

  // SIP configuration
  sipConfig: SipConfig | null;
  hasSipConfig: boolean;
  sipConfigured: boolean;

  // Legacy fields (maintaining backward compatibility)
  isAssigned: boolean;
  purchasedAt: string;
  isImported: boolean;
  importedAt?: string;
  originalProvider?: string;
  countryCode: string;
  type: string;
  providerLock?: string | null;
}

interface CustomerSummary {
  id: string;
  name: string;
  email: string;
  phoneNumberCount: number;
}

export default function PhoneNumbersPage() {
  const router = useRouter();
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProvider, setFilterProvider] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterAssignment, setFilterAssignment] = useState('all');
  const [filterBillingType, setFilterBillingType] = useState<'all' | 'chargeable' | 'imported'>('all');

  // New ownership and customer filters
  const [ownershipFilter, setOwnershipFilter] = useState<'all' | 'partner' | 'customer'>('all');
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const currentPageRef = useRef(1);

  // Detail modal state
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<PhoneNumber | null>(null);

  const [showImportModal, setShowImportModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showAgentAssignModal, setShowAgentAssignModal] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState<PhoneNumber | null>(null);
  const [partnerName, setPartnerName] = useState('');
  const [isUnassigning, setIsUnassigning] = useState(false);
  const [showUnassignModal, setShowUnassignModal] = useState(false);
  const [phoneNumberToUnassign, setPhoneNumberToUnassign] = useState<PhoneNumber | null>(null);
  const [showCustomerUnassignModal, setShowCustomerUnassignModal] = useState(false);
  const [phoneNumberToUnassignCustomer, setPhoneNumberToUnassignCustomer] = useState<PhoneNumber | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [phoneNumberToDelete, setPhoneNumberToDelete] = useState<PhoneNumber | null>(null);
  const [isRefreshingCache, setIsRefreshingCache] = useState(false);

  // Free Forever upgrade modal state
  const [showFreeForeverUpgrade, setShowFreeForeverUpgrade] = useState(false);
  const [freeForeverUpgradeData, setFreeForeverUpgradeData] = useState({
    title: '',
    message: '',
    featureDescription: '',
  });
  const [pendingAction, setPendingAction] = useState<'import' | null>(null);

  // Phone Activation state
  const [showActivationWizard, setShowActivationWizard] = useState(false);

  const toError = (error: unknown) => {
    if (error instanceof Error) {
      return error;
    }
    return new Error(String(error));
  };

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  const loadCustomers = useCallback(async () => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch('/api/partner/customers/phone-summary', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        setCustomers(data.customers);
      }
    } catch (error) {
      logger.error('Failed to load customers for partner phone numbers page', toError(error), {
        operation: 'load_partner_phone_number_customers'
      });
    }
  }, []);

  // Handle import button click with tier validation
  const handleImportClick = async () => {
    try {
      const shouldShowFreeForeverUpgrade = await FreeForeverUpgradeService.shouldShowUpgradeEncouragement();

      if (shouldShowFreeForeverUpgrade) {
        const validation = await ClientTierValidationService.validatePhoneNumberImport();

        if (!validation.allowed) {
          const upgradeMessage = FreeForeverUpgradeService.getUpgradeMessage('phone_numbers');
          setFreeForeverUpgradeData({
            ...upgradeMessage,
            message: `You've reached the Free Forever limit of 1 free imported phone number. Additional imports will cost $10 per number from your telephony credits.`
          });
          setShowFreeForeverUpgrade(true);
          setPendingAction('import');
          return;
        }
      }

      setShowImportModal(true);
    } catch (error) {
      logger.error('Error checking phone number import limits', toError(error), {
        operation: 'validate_phone_number_import_limit'
      });
      // On error, allow import to proceed
      setShowImportModal(true);
    }
  };

  // Proceed with pending action when "Maybe Later" is clicked
  const proceedWithPendingAction = () => {
    if (pendingAction === 'import') {
      setShowImportModal(true);
    }
    setPendingAction(null);
  };

  const loadPhoneNumbers = useCallback(async (page?: number, size?: number) => {
    const targetPage = page ?? currentPageRef.current;
    const targetSize = size ?? pageSize;

    try {
      setLoading(true);

      // Get the partner token from localStorage
      const token = localStorage.getItem('partner_token');
      if (!token) {
        logger.warn('No partner token found while loading phone numbers', {
          operation: 'load_partner_phone_numbers'
        });
        return;
      }

      // Build query parameters
      const params = new URLSearchParams({
        page: targetPage.toString(),
        limit: targetSize.toString(),
        search: searchTerm,
        provider: filterProvider,
        status: filterStatus,
        assignment: filterAssignment,
        ownership: ownershipFilter,
        customerId: customerFilter,
        billingType: filterBillingType
      });

      const response = await fetch(`/api/partner/phone-numbers?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        logger.debug('Partner phone numbers loaded', {
          operation: 'load_partner_phone_numbers',
          requestedPage: targetPage,
          phoneNumberCount: data.phoneNumbers?.length || 0,
          totalCount: data.pagination?.totalCount || 0
        });
        setPhoneNumbers(data.phoneNumbers || []);
        setStats(data.stats || {});

        // Update pagination state
        if (data.pagination) {
          setCurrentPage(data.pagination.currentPage);
          setTotalPages(data.pagination.totalPages);
          setTotalCount(data.pagination.totalCount);
        }
      } else {
        logger.warn('Failed to load phone numbers', {
          operation: 'load_partner_phone_numbers',
          statusCode: response.status,
          statusText: response.statusText
        });
      }
    } catch (error) {
      logger.error('Error loading partner phone numbers', toError(error), {
        operation: 'load_partner_phone_numbers'
      });
    } finally {
      setLoading(false);
    }
  }, [customerFilter, filterAssignment, filterBillingType, filterProvider, filterStatus, ownershipFilter, pageSize, searchTerm]);

  useEffect(() => {
    // Check authentication and load partner name
    const token = localStorage.getItem('partner_token');
    if (!token) {
      router.push('/partner/login');
      return;
    }

    const name = localStorage.getItem('partner_name');
    if (name) setPartnerName(name);
  }, [router]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  // Trigger search when filters change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCurrentPage(1); // Reset to first page when filters change
      loadPhoneNumbers(1);
    }, 300); // Debounce search

    return () => clearTimeout(timeoutId);
  }, [searchTerm, filterProvider, filterStatus, filterAssignment, ownershipFilter, customerFilter, filterBillingType, loadPhoneNumbers]);

  // Handle row click to show detail modal
  const handleRowClick = (phoneNumber: PhoneNumber) => {
    setSelectedPhoneNumber(phoneNumber);
    setShowDetailModal(true);
  };

  // Handle pagination
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    loadPhoneNumbers(page);
  };

  // billingType is now filtered server-side, no client-side filter needed
  const filteredNumbers = phoneNumbers;

  const getCapabilityBadges = (capabilities: PhoneNumber['capabilities']) => {
    const badges = [];
    if (capabilities.voice) badges.push('Voice');
    if (capabilities.sms) badges.push('SMS');
    if (capabilities.mms) badges.push('MMS');
    if (capabilities.fax) badges.push('Fax');
    return badges;
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'in-use':
        return 'text-green-400 bg-green-400/10';
      case 'inactive':
        return 'text-yellow-400 bg-yellow-400/10';
      case 'suspended':
        return 'text-red-400 bg-red-400/10';
      default:
        return 'text-gray-400 bg-gray-400/10';
    }
  };

  const getProviderColor = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'twilio':
      case 'imported_twilio':
        return 'text-red-400 bg-red-400/10';
      case 'telnyx':
      case 'imported_telnyx':
        return 'text-purple-400 bg-purple-400/10';
      case 'retell':
      case 'retell_provider':
        return 'text-orange-400 bg-orange-400/10';
      default:
        return 'text-blue-400 bg-blue-400/10';
    }
  };

  const handleUnassignAgent = (phoneNumber: PhoneNumber) => {
    setPhoneNumberToUnassign(phoneNumber);
    setShowUnassignModal(true);
  };

  const confirmUnassignAgent = async () => {
    if (!phoneNumberToUnassign) return;

    setIsUnassigning(true);
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch(`/api/partner/phone-numbers/${phoneNumberToUnassign.id}/unassign-agent`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        toast.success('Agent unassigned successfully');
        loadPhoneNumbers(); // Reload the list
        setShowUnassignModal(false);
        setPhoneNumberToUnassign(null);
      } else {
        const error = await response.json();
        toast.error(`Failed to unassign agent: ${error.error}`);
      }
    } catch (error) {
      logger.error('Error unassigning agent from phone number', toError(error), {
        operation: 'unassign_phone_number_agent'
      });
      toast.error('Failed to unassign agent');
    } finally {
      setIsUnassigning(false);
    }
  };

  const handleUnassignCustomer = (phoneNumber: PhoneNumber) => {
    setPhoneNumberToUnassignCustomer(phoneNumber);
    setShowCustomerUnassignModal(true);
  };

  const handleDeletePhoneNumber = (phoneNumber: PhoneNumber) => {
    setPhoneNumberToDelete(phoneNumber);
    setShowDeleteModal(true);
  };

  const handleRefreshCache = async (phoneNumber: PhoneNumber) => {
    try {
      setIsRefreshingCache(true);
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch(`/api/partner/phone-numbers/${phoneNumber.id}/invalidate-cache`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        toast.success('Agent cache refreshed successfully. Changes will take effect on the next call.');
      } else {
        const error = await response.json();
        toast.error(`Failed to refresh cache: ${error.error}`);
      }
    } catch (error) {
      logger.error('Error refreshing phone number agent cache', toError(error), {
        operation: 'refresh_phone_number_agent_cache'
      });
      toast.error('Failed to refresh cache');
    } finally {
      setIsRefreshingCache(false);
    }
  };

  const toggleVisibility = async (phoneNumberId: string, hideFromCustomer: boolean) => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch(`/api/partner/phone-numbers/${phoneNumberId}/visibility`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ hideFromCustomer })
      });

      if (response.ok) {
        toast.success(hideFromCustomer ? 'Number hidden from customer portal' : 'Number visible in customer portal');
        loadPhoneNumbers(); // Reload the list
      } else {
        const error = await response.json();
        toast.error(`Failed to update visibility: ${error.error}`);
      }
    } catch (error) {
      logger.error('Error updating phone number visibility', toError(error), {
        operation: 'update_phone_number_visibility'
      });
      toast.error('Failed to update visibility');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('partner_token');
    localStorage.removeItem('partner_name');
    router.push('/partner/login');
  };

  return (
    <PartnerLayout partnerName={partnerName} onLogout={handleLogout}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Phone Numbers</h1>
            <p className="text-gray-400">Manage all phone numbers across your customers</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/partner/phone-numbers/number-pools')}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              <FiLayers className="w-4 h-4" />
              Number Pool
            </button>
            <button
              onClick={handleImportClick}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FiPlus className="w-4 h-4" />
              Import Numbers
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors">
              <FiDownload className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Phone Activation Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 border border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white mb-1">Activate Phone Service</h3>
              <p className="text-blue-100 text-sm">
                Get phone numbers in your country with lower costs and better control. We handle everything — just verify your business and you&apos;re ready to go.
              </p>
            </div>
            <button
              onClick={() => setShowActivationWizard(true)}
              className="px-6 py-3 bg-white text-blue-600 font-medium rounded-lg hover:bg-blue-50 transition-colors whitespace-nowrap ml-4"
            >
              Get Started →
            </button>
          </div>
        </div>

        {/* Phone Activation Status */}
        <PhoneActivationStatus
          onResubmit={() => {
            setShowActivationWizard(true);
          }}
        />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="bg-gray-800/50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-xs">Total Numbers</p>
                <p className="text-xl font-bold text-white">{stats.total || 0}</p>
              </div>
              <FiPhone className="w-6 h-6 text-blue-400" />
            </div>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-xs">Partner Owned</p>
                <p className="text-xl font-bold text-white">{stats.partnerOwned || 0}</p>
              </div>
              <div className="w-6 h-6 rounded-full bg-blue-400/10 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-blue-400"></div>
              </div>
            </div>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-xs">Customer Owned</p>
                <p className="text-xl font-bold text-white">{stats.customerOwned || 0}</p>
              </div>
              <div className="w-6 h-6 rounded-full bg-green-400/10 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-green-400"></div>
              </div>
            </div>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-xs">Assigned</p>
                <p className="text-xl font-bold text-white">{stats.assigned || 0}</p>
              </div>
              <FiUser className="w-6 h-6 text-green-400" />
            </div>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-xs">Unassigned</p>
                <p className="text-xl font-bold text-white">{stats.unassigned || 0}</p>
              </div>
              <div className="w-6 h-6 rounded-full bg-yellow-400/10 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
              </div>
            </div>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-xs">Inbound Ready</p>
                <p className="text-xl font-bold text-white">{stats.inboundReady || 0}</p>
              </div>
              <div className="w-6 h-6 rounded-full bg-green-400/10 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-green-400"></div>
              </div>
            </div>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-xs">Imported</p>
                <p className="text-xl font-bold text-white">{stats.imported || 0}</p>
              </div>
              <FiDownload className="w-6 h-6 text-purple-400" />
            </div>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-xs">Providers</p>
                <p className="text-xl font-bold text-white">{stats.providers || 0}</p>
              </div>
              <FiFilter className="w-6 h-6 text-teal-400" />
            </div>
          </div>
        </div>

        {/* Pagination Controls - Top */}
        {totalCount > 0 && (
          <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl">
            <div className="text-sm text-gray-400">
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} phone numbers
            </div>
            
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
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
                        onClick={() => handlePageChange(pageNum)}
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
                  onClick={() => handlePageChange(currentPage + 1)}
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
                loadPhoneNumbers(1, newSize);
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

        {/* Search & Filters */}
        <div className="bg-gray-800/50 rounded-xl p-6 space-y-4">
          {/* Search Bar - Full Width */}
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by phone number or owner name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Filter Dropdowns - All 6 on one line */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Ownership Filter */}
            <select
              value={ownershipFilter}
              onChange={(e) => setOwnershipFilter(e.target.value as 'all' | 'partner' | 'customer')}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Ownership</option>
              <option value="partner">Partner Owned</option>
              <option value="customer">Customer Owned</option>
            </select>

            {/* Customer Filter */}
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Customers</option>
              <option value="__with_name__">With Name</option>
              <option value="__no_name__">No Name</option>
              {customers.map(customer => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} ({customer.phoneNumberCount})
                </option>
              ))}
            </select>

            {/* Billing Type Filter */}
            <select
              value={filterBillingType}
              onChange={(e) => setFilterBillingType(e.target.value as 'all' | 'chargeable' | 'imported')}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Billing</option>
              <option value="chargeable">Chargeable</option>
              <option value="imported">Imported</option>
            </select>

            {/* Assignment Filter */}
            <select
              value={filterAssignment}
              onChange={(e) => setFilterAssignment(e.target.value)}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Assignment</option>
              <option value="assigned">Assigned</option>
              <option value="unassigned">Unassigned</option>
            </select>

            {/* Provider Filter */}
            <select
              value={filterProvider}
              onChange={(e) => setFilterProvider(e.target.value)}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Providers</option>
              <option value="twilio">Twilio</option>
              {process.env.NEXT_PUBLIC_ENABLE_TELNYX_PROVIDER ? (
                <option value="telnyx">Telnyx</option>
              ) : (
                <option value="telnyx" disabled className="text-gray-500">Telnyx (Soon)</option>
              )}
              <option value="imported_twilio">Imported Twilio</option>
              {process.env.NEXT_PUBLIC_ENABLE_TELNYX_PROVIDER ? (
                <option value="imported_telnyx">Imported Telnyx</option>
              ) : (
                <option value="imported_telnyx" disabled className="text-gray-500">Imported Telnyx (Soon)</option>
              )}
              {featureFlags.providerPhoneImport.enabled && (
                <option value="retell_provider">Retell (Provider)</option>
              )}
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="in-use">In Use</option>
              <option value="pending">Pending</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>

        {/* Phone Numbers Table */}
        <div className="bg-gray-800/50 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="ml-3 text-gray-300">Loading phone numbers...</span>
            </div>
          ) : filteredNumbers.length === 0 ? (
            <div className="text-center py-12">
              <FiPhone className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No Phone Numbers Found</h3>
              <p className="text-gray-400 mb-6">
                {searchTerm || filterProvider !== 'all' || filterStatus !== 'all' || ownershipFilter !== 'all' || customerFilter !== 'all' || filterBillingType !== 'all' || filterAssignment !== 'all'
                  ? 'No phone numbers match your current filters.'
                  : 'Your customers haven\'t purchased or imported any phone numbers yet.'}
              </p>
            </div>
          ) : (
            <div className={`overflow-x-auto transition-opacity duration-200 ${loading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
              <table className="w-full">
                <thead className="bg-gray-900/50">
                  <tr>
                    <th className="text-left py-4 px-6 text-gray-300 font-medium">Phone Number</th>
                    <th className="text-left py-4 px-6 text-gray-300 font-medium">Customer</th>
                    <th className="text-left py-4 px-6 text-gray-300 font-medium">Agent Assignment</th>
                    <th className="text-left py-4 px-6 text-gray-300 font-medium">Provider</th>
                    <th className="text-left py-4 px-6 text-gray-300 font-medium">Status</th>
                    <th className="text-left py-4 px-6 text-gray-300 font-medium">Capabilities</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {filteredNumbers.map((number) => (
                    <tr
                      key={number.id}
                      className="hover:bg-gray-700/30 transition-colors cursor-pointer"
                      onClick={() => handleRowClick(number)}
                    >
                      <td className="py-4 px-6">
                        <div>
                          <div className="text-white font-medium">{number.phoneNumber}</div>
                          {number.friendlyName && (
                            <div className="text-gray-400 text-sm">{number.friendlyName}</div>
                          )}
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <OwnershipBadge
                              ownership={number.ownership}
                              customerName={number.customer?.name}
                              size="sm"
                            />

                            {/* Billing Type Badge */}
                            {number.isImported ? (
                              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30">
                                <FiUpload className="w-3 h-3 text-purple-400" />
                                <span className="text-purple-400 text-xs font-medium">Imported - No Charges</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 border border-green-500/30">
                                <FiDollarSign className="w-3 h-3 text-green-400" />
                                <span className="text-green-400 text-xs font-medium">Chargeable</span>
                              </div>
                            )}

                            {number.canReceiveInbound && (
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-green-400"></div>
                                <span className="text-green-400 text-xs">Inbound Ready</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        {number.isAssigned && number.customer ? (
                          <div>
                            <div className="text-white font-medium">
                              {number.customer.name}
                            </div>
                            <div className="text-gray-400 text-sm">{number.customer.email}</div>

                            {/* Show billing info for chargeable numbers */}
                            {!number.isImported && number.monthlyRecurringCost > 0 && (
                              <div className="mt-1 space-y-0.5">
                                <div className="flex items-center gap-1 text-green-400 text-xs">
                                  <FiDollarSign className="w-3 h-3" />
                                  <span className="font-medium">${(number.monthlyRecurringCost / 100).toFixed(2)}/month</span>
                                  <span className="text-gray-500">(from telephony credits)</span>
                                </div>
                                {number.purchaseInfo && (
                                  <div className="text-gray-500 text-xs">
                                    Initial: ${(number.purchaseInfo.purchasePrice / 100).toFixed(2)}
                                    {number.purchaseInfo.setupFee > 0 && ` + $${(number.purchaseInfo.setupFee / 100).toFixed(2)} setup`}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Show no-charge indicator for imported numbers */}
                            {number.isImported && (
                              <div className="text-purple-400 text-xs mt-1">
                                ✓ No Knotie charges
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-yellow-400 text-sm">Unassigned</span>
                            <button
                              onClick={() => {
                                setSelectedNumber(number);
                                setShowAssignModal(true);
                              }}
                              className="text-blue-400 hover:text-blue-300 text-xs underline"
                            >
                              Assign
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        {number.hasAgentAssignment ? (
                          <div>
                            {number.agentMappings.map((mapping) => (
                              <div key={mapping.id} className="mb-2 last:mb-0">
                                <div className="flex items-center gap-2">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    mapping.agentProvider === 'retell'
                                      ? 'bg-blue-400/10 text-blue-400'
                                      : mapping.agentProvider === 'vapi'
                                      ? 'bg-purple-400/10 text-purple-400'
                                      : 'bg-green-400/10 text-green-400'
                                  }`}>
                                    {mapping.agentProvider.charAt(0).toUpperCase() + mapping.agentProvider.slice(1)}
                                  </span>
                                  <span className="text-white text-sm">{mapping.agentName || mapping.agentId}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  {number.hasSipConfig && (
                                    <div className="text-green-400 text-xs">✓ SIP Configured</div>
                                  )}
                                  {/* Show inbound/outbound indicators for imported numbers */}
                                  {number.provider.includes('imported') && (
                                    <div className="flex gap-1">
                                      {mapping.inboundEnabled && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-400/10 text-blue-400">
                                          ↓ Inbound
                                        </span>
                                      )}
                                      {mapping.outboundEnabled && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-400/10 text-purple-400">
                                          ↑ Outbound
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400 text-sm">No Agent</span>
                            {(['imported_twilio', 'imported_telnyx', 'twilio', 'telnyx', 'retell_provider'].includes(number.provider)) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedNumber(number);
                                  setShowAgentAssignModal(true);
                                }}
                                className="text-blue-400 hover:text-blue-300 text-xs underline"
                              >
                                Assign Agent
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getProviderColor(number.provider)}`}>
                          {number.provider.replace('imported_', '').replace('_provider', '').charAt(0).toUpperCase() + number.provider.replace('imported_', '').replace('_provider', '').slice(1)}
                        </span>
                        {number.providerLock && (
                          <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30" title={`Provider-locked to ${number.providerLock}`}>
                            <FiLock className="w-2.5 h-2.5 mr-0.5" />Locked
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <div className="space-y-1">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(number.status)}`}>
                            {number.status.charAt(0).toUpperCase() + number.status.slice(1)}
                          </span>
                          {number.regulatoryStatus === 'pending' && (
                            <div className="text-yellow-400 text-xs">Regulatory: Pending</div>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-wrap gap-1">
                          {getCapabilityBadges(number.capabilities).map((capability) => (
                            <span
                              key={capability}
                              className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-400/10 text-blue-400"
                            >
                              {capability}
                            </span>
                          ))}
                          {number.canSendOutbound && (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-400/10 text-green-400">
                              Outbound
                            </span>
                          )}
                          {number.hideFromCustomer ? (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-400/10 text-red-400">
                              Hidden
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-400/10 text-green-400">
                              Visible
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination Controls - Bottom */}
        {totalCount > 0 && (
          <div className="bg-gray-800/50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="text-gray-400 text-sm">
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} phone numbers
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1 || loading}
                    className="px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                          onClick={() => handlePageChange(pageNum)}
                          className={`px-3 py-2 rounded-lg transition-colors ${
                            currentPage === pageNum
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages || loading}
                    className="px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                  loadPhoneNumbers(1, newSize);
                }}
                className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="10">10 per page</option>
                <option value="20">20 per page</option>
                <option value="50">50 per page</option>
                <option value="100">100 per page</option>
              </select>
            </div>
          </div>
        )}

        {/* Phone Number Detail Modal */}
        <PhoneNumberDetailModal
          isOpen={showDetailModal}
          phoneNumber={selectedPhoneNumber}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedPhoneNumber(null);
          }}
          onAssignCustomer={() => {
            setShowDetailModal(false);
            setSelectedNumber(selectedPhoneNumber);
            setShowAssignModal(true);
          }}
          onReassignCustomer={() => {
            setShowDetailModal(false);
            setSelectedNumber(selectedPhoneNumber);
            setShowAssignModal(true);
          }}
          onUnassignCustomer={() => {
            setShowDetailModal(false);
            handleUnassignCustomer(selectedPhoneNumber!);
          }}
          onAssignAgent={() => {
            setShowDetailModal(false);
            setSelectedNumber(selectedPhoneNumber);
            setShowAgentAssignModal(true);
          }}
          onReassignAgent={() => {
            setShowDetailModal(false);
            setSelectedNumber(selectedPhoneNumber);
            setShowAgentAssignModal(true);
          }}
          onUnassignAgent={() => {
            setShowDetailModal(false);
            handleUnassignAgent(selectedPhoneNumber!);
          }}
          onToggleVisibility={() => {
            if (selectedPhoneNumber) {
              toggleVisibility(selectedPhoneNumber.id, !selectedPhoneNumber.hideFromCustomer);
              setShowDetailModal(false);
            }
          }}
          onDeletePhoneNumber={() => {
            setShowDetailModal(false);
            handleDeletePhoneNumber(selectedPhoneNumber!);
          }}
          onRefreshCache={() => {
            if (selectedPhoneNumber) {
              handleRefreshCache(selectedPhoneNumber);
            }
          }}
          isRefreshingCache={isRefreshingCache}
        />

        {/* Import Modal */}
        <PhoneNumberImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImportComplete={loadPhoneNumbers}
        />

        {/* Customer Assignment Modal */}
        <PhoneNumberAssignmentModal
          isOpen={showAssignModal}
          phoneNumber={selectedNumber ? {
            id: selectedNumber.id,
            phoneNumber: selectedNumber.phoneNumber,
            customer: selectedNumber.customer,
            isAssigned: selectedNumber.isAssigned
          } : null}
          onClose={() => {
            setShowAssignModal(false);
            setSelectedNumber(null);
          }}
          onAssignmentComplete={loadPhoneNumbers}
        />

        {/* Agent Assignment Modal */}
        <PhoneNumberAgentAssignmentModal
          isOpen={showAgentAssignModal}
          phoneNumber={selectedNumber ? {
            ...selectedNumber,
            agentMappings: selectedNumber.agentMappings.map(mapping => ({
              ...mapping,
              isActive: mapping.status === 'active'
            }))
          } : null}
          onClose={() => {
            setShowAgentAssignModal(false);
            setSelectedNumber(null);
          }}
          onAssignmentComplete={loadPhoneNumbers}
        />

        {/* Unassign Agent Confirmation Modal */}
        <UnassignAgentConfirmModal
          isOpen={showUnassignModal}
          onClose={() => {
            setShowUnassignModal(false);
            setPhoneNumberToUnassign(null);
          }}
          onConfirm={confirmUnassignAgent}
          phoneNumber={phoneNumberToUnassign}
          isLoading={isUnassigning}
        />

        {/* Customer Unassign Confirmation Modal */}
        <CustomerUnassignConfirmModal
          isOpen={showCustomerUnassignModal}
          onClose={() => {
            setShowCustomerUnassignModal(false);
            setPhoneNumberToUnassignCustomer(null);
          }}
          phoneNumber={phoneNumberToUnassignCustomer}
          onUnassignComplete={loadPhoneNumbers}
        />

        {/* Delete Phone Number Confirmation Modal */}
        <PhoneNumberDeleteConfirmModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setPhoneNumberToDelete(null);
          }}
          phoneNumber={phoneNumberToDelete}
          onDeleteComplete={loadPhoneNumbers}
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

        {/* Phone Activation Wizard */}
        <PhoneActivationWizard
          isOpen={showActivationWizard}
          onClose={() => setShowActivationWizard(false)}
          onSubmitComplete={() => {
            loadPhoneNumbers();
          }}
        />
      </div>
    </PartnerLayout>
  );
}
