'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  FiPlus,
  FiDollarSign,
  FiCalendar,
  FiClock,
  FiCheck,
  FiX,
  FiAlertCircle,
  FiEye,
  FiSend,
  FiTrash2,
  FiRefreshCw,
  FiCreditCard,
  FiInfo,
  FiActivity,
  FiTrendingUp,
  FiPause,
  FiPlay,
  FiTool
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import InvoiceCreationModal from '@/components/partner/InvoiceCreationModal';
import { FormattedInvoice } from '@/types/invoice';

interface CustomerBillingTabProps {
  customer: {
    id: string; // This is the UserOnboarding ID
    firstName: string;
    lastName: string;
    companyName: string;
    email: string;
    customerId?: string; // This is the actual Customer ID we need for invoices
  };
  onInvoiceCreated?: (invoice: FormattedInvoice) => void;
}

export default function CustomerBillingTab({ customer, onInvoiceCreated }: CustomerBillingTabProps) {
  const [invoices, setInvoices] = useState<FormattedInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actualCustomerId, setActualCustomerId] = useState<string | null>(null);
  const [hasPortalAccess, setHasPortalAccess] = useState<boolean>(false);
  const [portalAccessChecked, setPortalAccessChecked] = useState<boolean>(false);
  const [billingMode, setBillingMode] = useState<'invoices' | 'subscriptions'>('invoices');

  // Metered billing state
  const [meteredBillingData, setMeteredBillingData] = useState<any>(null);
  const [availablePlans, setAvailablePlans] = useState<any[]>([]);
  const [showAddSubscriptionModal, setShowAddSubscriptionModal] = useState(false);
  const [isLoadingMetered, setIsLoadingMetered] = useState(false);

  // Check if customer has portal access (CustomerCredential + Customer records exist)
  const checkPortalAccess = async () => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch(`/api/partner/customers/${customer.id}/check-portal-eligibility`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Portal eligibility check for billing:', data);

        // Customer has portal access if they have portal credentials (hasPortalAccess = true)
        const hasAccess = data.eligible && data.hasPortalAccess;
        setHasPortalAccess(hasAccess);

        // Get the Customer ID directly from the response
        if (hasAccess && data.customerId) {
          setActualCustomerId(data.customerId);
        }
      } else {
        setHasPortalAccess(false);
      }
    } catch (error) {
      console.error('Error checking portal access:', error);
      setHasPortalAccess(false);
    } finally {
      setPortalAccessChecked(true);
    }
  };

  // Fetch customer invoices
  const fetchInvoices = async () => {
    // Only fetch invoices if customer has portal access
    if (!hasPortalAccess) {
      setInvoices([]);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      // Use the customer ID from portal access check
      const customerIdToUse = actualCustomerId;

      if (!customerIdToUse) {
        // No customer record exists, show empty state
        setInvoices([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      // Now fetch invoices using the actual customer ID
      const response = await fetch(`/api/partner/invoices?customerId=${customerIdToUse}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch invoices');
      }

      const data = await response.json();
      if (data.success) {
        setInvoices(data.data.invoices);
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast.error('Failed to load invoices');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // First check portal access, then fetch invoices
    const initializeBilling = async () => {
      await checkPortalAccess();
    };

    initializeBilling();
  }, [customer.id]);

  // Fetch invoices and metered billing data when portal access is confirmed
  useEffect(() => {
    if (portalAccessChecked) {
      fetchInvoices();
      fetchMeteredBillingData();
      fetchAvailablePlans();
    }
  }, [portalAccessChecked, hasPortalAccess, actualCustomerId]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchInvoices();
  };

  // Fetch metered billing data
  const fetchMeteredBillingData = async () => {
    if (!customer.customerId) {
      console.log('No customerId available for billing data');
      return;
    }

    try {
      setIsLoadingMetered(true);
      const response = await fetch(`/api/partner/customers/${customer.customerId}/billing`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setMeteredBillingData(data.data);
        }
      }
    } catch (error) {
      console.error('Error fetching metered billing data:', error);
      toast.error('Failed to load metered billing data');
    } finally {
      setIsLoadingMetered(false);
    }
  };

  // Fetch available metered billing plans
  const fetchAvailablePlans = async () => {
    try {
      console.log('Fetching available metered billing plans...');
      const token = localStorage.getItem('partner_token');
      if (!token) {
        console.error('No partner token found');
        return;
      }

      const response = await fetch('/api/partner/metered-billing/plans', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });

      console.log('Plans API response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Plans API response data:', data);

        if (data.success) {
          const activePlans = data.data.filter((plan: any) => plan.isActive);
          console.log('Active plans found:', activePlans.length, activePlans);
          setAvailablePlans(activePlans);
        } else {
          console.error('Plans API returned success: false', data);
        }
      } else {
        const errorData = await response.text();
        console.error('Plans API error response:', response.status, errorData);
      }
    } catch (error) {
      console.error('Error fetching available plans:', error);
    }
  };

  // Subscribe customer to a metered billing plan
  const handleSubscribeToMeteredPlan = async (planId: string) => {
    try {
      const response = await fetch('/api/partner/metered-billing/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          customerId: customer.customerId || actualCustomerId, // Use the customer ID
          planId,
        }),
      });

      if (response.ok) {
        toast.success('Customer subscribed to metered billing plan successfully');
        setShowAddSubscriptionModal(false);
        await fetchMeteredBillingData();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to subscribe customer');
      }
    } catch (error: any) {
      console.error('Error subscribing customer:', error);
      toast.error(error.message || 'Failed to subscribe customer to plan');
    }
  };

  const handleInvoiceCreated = (newInvoice: FormattedInvoice) => {
    setInvoices(prev => [newInvoice, ...prev]);
    setIsCreatingInvoice(false);
    onInvoiceCreated?.(newInvoice);
    toast.success('Invoice created successfully');
  };

  const handleSendInvoice = async (invoiceId: string) => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch(`/api/partner/invoices/${invoiceId}/send`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Failed to send invoice');
      }

      const data = await response.json();
      if (data.success) {
        setInvoices(prev => prev.map(inv =>
          inv.id === invoiceId
            ? { ...inv, status: 'sent' as const }
            : inv
        ));
        toast.success('Invoice sent successfully');
      }
    } catch (error) {
      console.error('Error sending invoice:', error);
      toast.error('Failed to send invoice');
    }
  };

  const handleCancelInvoice = async (invoiceId: string) => {
    if (!confirm('Are you sure you want to cancel this invoice?')) {
      return;
    }

    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch(`/api/partner/invoices/${invoiceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to cancel invoice');
      }

      const data = await response.json();
      if (data.success) {
        setInvoices(prev => prev.map(inv =>
          inv.id === invoiceId
            ? { ...inv, status: 'cancelled' as const }
            : inv
        ));
        toast.success('Invoice cancelled successfully');
      }
    } catch (error) {
      console.error('Error cancelling invoice:', error);
      toast.error('Failed to cancel invoice');
    }
  };

  // Toggle subscription status (pause/resume)
  const handleToggleSubscription = async (subscriptionId: string, newStatus: string) => {
    try {
      const action = newStatus === 'active' ? 'resume' : 'pause';

      let requestBody: any = { action };

      // If pausing, ask for pause options
      if (action === 'pause') {
        const pauseOptions = await showPauseOptionsDialog();
        if (pauseOptions === null) return; // User cancelled

        requestBody = {
          action,
          reason: pauseOptions.reason || 'Paused by partner',
          pauseUntil: pauseOptions.pauseUntil,
        };
      }

      const response = await fetch(`/api/partner/metered-billing/subscriptions/${subscriptionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update subscription status');
      }

      toast.success(`Subscription ${newStatus === 'active' ? 'resumed' : 'paused'} successfully`);
      await fetchMeteredBillingData();
    } catch (error: any) {
      console.error('Error updating subscription:', error);
      toast.error(error.message || 'Failed to update subscription');
    }
  };

  // Show pause options dialog
  const showPauseOptionsDialog = (): Promise<{ reason?: string; pauseUntil?: string } | null> => {
    return new Promise((resolve) => {
      const reason = prompt('Reason for pausing (optional):');
      if (reason === null) {
        resolve(null); // User cancelled
        return;
      }

      const pauseUntilInput = prompt('Pause until date (YYYY-MM-DD, leave empty for indefinite):');
      if (pauseUntilInput === null) {
        resolve(null); // User cancelled
        return;
      }

      let pauseUntil: string | undefined;
      if (pauseUntilInput && pauseUntilInput.trim()) {
        try {
          const date = new Date(pauseUntilInput.trim());
          if (date < new Date()) {
            alert('Pause until date must be in the future');
            resolve(null);
            return;
          }
          pauseUntil = date.toISOString();
        } catch (error) {
          alert('Invalid date format. Please use YYYY-MM-DD');
          resolve(null);
          return;
        }
      }

      resolve({ reason, pauseUntil });
    });
  };

  const handleCancelSubscription = async (subscriptionId: string, planName: string) => {
    try {
      const confirmed = window.confirm(
        `Are you sure you want to cancel the subscription for "${planName}"? This action cannot be undone.`
      );

      if (!confirmed) return;

      const response = await fetch('/api/partner/metered-billing/subscriptions', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subscriptionId }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel subscription');
      }

      toast.success('Subscription cancelled successfully');
      await fetchMeteredBillingData();
    } catch (error: any) {
      console.error('Error cancelling subscription:', error);
      toast.error(error.message || 'Failed to cancel subscription');
    }
  };

  // Helper functions
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { color: 'bg-gray-500/20 text-gray-400', icon: FiClock },
      sent: { color: 'bg-blue-500/20 text-blue-400', icon: FiSend },
      paid: { color: 'bg-green-500/20 text-green-400', icon: FiCheck },
      overdue: { color: 'bg-red-500/20 text-red-400', icon: FiAlertCircle },
      cancelled: { color: 'bg-gray-500/20 text-gray-400', icon: FiX },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const formatAmount = (amount: number) => {
    return `$${(amount / 100).toFixed(2)}`;
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Calculate summary statistics
  const summary = {
    totalInvoices: invoices.length,
    totalAmount: invoices.reduce((sum, inv) => sum + inv.amount, 0),
    paidAmount: invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0),
    pendingAmount: invoices.filter(inv => inv.status === 'sent' || inv.status === 'overdue').reduce((sum, inv) => sum + inv.amount, 0),
    overdueCount: invoices.filter(inv => inv.status === 'overdue').length,
  };

  // Early returns for loading and no access states
  if (isLoading || !portalAccessChecked) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Show message if customer doesn't have portal access
  if (!hasPortalAccess) {
    return (
      <div className="space-y-6">
        <div className="bg-gray-800/50 rounded-xl p-6">
          <div className="text-center py-12">
            <FiCreditCard className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Billing Not Available</h3>
            <p className="text-gray-400 mb-6 max-w-md mx-auto">
              Billing features are only available for customers who have been granted access to the customer portal.
              Enable customer portal access in the "Features & Add-ons" tab to unlock billing functionality.
            </p>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 max-w-md mx-auto">
              <div className="flex items-start gap-3">
                <FiInfo className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-left">
                  <div className="text-sm font-medium text-blue-400 mb-1">How to enable billing:</div>
                  <ol className="text-xs text-blue-300 space-y-1">
                    <li>1. Go to "Features & Add-ons" tab</li>
                    <li>2. Enable "Customer Portal Access"</li>
                    <li>3. Customer will receive portal credentials</li>
                    <li>4. Billing features will become available</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Billing Summary */}
      <div className="bg-gray-800/50 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Billing Overview</h3>
            <div className="flex items-center gap-4 mt-2">
              <button
                onClick={() => setBillingMode('invoices')}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  billingMode === 'invoices'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Invoice Billing
              </button>
              <button
                onClick={() => setBillingMode('subscriptions')}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  billingMode === 'subscriptions'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Subscription Billing
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              <FiRefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {billingMode === 'invoices' ? (
              <button
                onClick={() => setIsCreatingInvoice(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-lg hover:from-blue-600 hover:to-teal-600 transition-all"
              >
                <FiPlus className="w-4 h-4" />
                Create Invoice
              </button>
            ) : (
              <button
                onClick={() => setShowAddSubscriptionModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all"
              >
                <FiPlus className="w-4 h-4" />
                Add Subscription
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-700/30 rounded-lg p-4">
            <div className="text-sm text-gray-400">Total Invoices</div>
            <div className="text-2xl font-bold text-white">{summary.totalInvoices}</div>
          </div>
          <div className="bg-gray-700/30 rounded-lg p-4">
            <div className="text-sm text-gray-400">Total Amount</div>
            <div className="text-2xl font-bold text-white">{formatAmount(summary.totalAmount)}</div>
          </div>
          <div className="bg-gray-700/30 rounded-lg p-4">
            <div className="text-sm text-gray-400">Paid Amount</div>
            <div className="text-2xl font-bold text-green-400">{formatAmount(summary.paidAmount)}</div>
          </div>
          <div className="bg-gray-700/30 rounded-lg p-4">
            <div className="text-sm text-gray-400">Pending Amount</div>
            <div className="text-2xl font-bold text-blue-400">{formatAmount(summary.pendingAmount)}</div>
          </div>
        </div>

        {summary.overdueCount > 0 && (
          <div className="mt-4 p-3 bg-red-500/20 text-red-400 rounded-lg flex items-center gap-2">
            <FiAlertCircle className="w-4 h-4" />
            <span className="text-sm">
              {summary.overdueCount} invoice{summary.overdueCount > 1 ? 's' : ''} overdue
            </span>
          </div>
        )}
      </div>

      {/* Billing Content */}
      <div className="bg-gray-800/50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          {billingMode === 'invoices' ? 'Invoices' : 'Subscriptions'}
        </h3>

        {billingMode === 'invoices' ? (
          <>
            {invoices.length === 0 ? (
              <div className="text-center py-12">
                <FiDollarSign className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400 mb-4">No invoices created yet</p>
                <button
                  onClick={() => setIsCreatingInvoice(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-lg hover:from-blue-600 hover:to-teal-600 transition-all mx-auto"
                >
                  <FiPlus className="w-4 h-4" />
                  Create First Invoice
                </button>
              </div>
            ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {invoices.map((invoice) => (
                <motion.div
                  key={invoice.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-gray-700/30 rounded-lg p-4 hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-medium text-white">{invoice.title}</h4>
                        {getStatusBadge(invoice.status)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span>#{invoice.invoiceNumber}</span>
                        <span className="flex items-center gap-1">
                          <FiDollarSign className="w-3 h-3" />
                          {formatAmount(invoice.amount)}
                        </span>
                        <span className="flex items-center gap-1">
                          <FiCalendar className="w-3 h-3" />
                          {formatDate(invoice.createdAt)}
                        </span>
                        {invoice.dueDate && (
                          <span className="flex items-center gap-1">
                            <FiClock className="w-3 h-3" />
                            Due: {formatDate(invoice.dueDate)}
                          </span>
                        )}
                      </div>
                      {invoice.description && (
                        <p className="text-sm text-gray-400 mt-1">{invoice.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-600 rounded-lg transition-colors"
                        title="View Invoice"
                      >
                        <FiEye className="w-4 h-4" />
                      </button>
                      {invoice.status === 'draft' && (
                        <button
                          onClick={() => handleSendInvoice(invoice.id)}
                          className="flex items-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                          title="Send Invoice to Customer"
                        >
                          <FiSend className="w-4 h-4" />
                          Send
                        </button>
                      )}
                      {(invoice.status === 'draft' || invoice.status === 'sent') && (
                        <button
                          onClick={() => handleCancelInvoice(invoice.id)}
                          className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                          title="Cancel Invoice"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
            )}
          </>
        ) : (
          // Subscription Billing Content
          <div className="space-y-6">
            {/* Subscription Details Card */}
            {meteredBillingData?.subscription && (
              <div className="bg-gray-700/30 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-white">Subscription Details</h4>
                  <span className={`px-3 py-1 text-sm rounded-full font-medium ${
                    meteredBillingData.subscription.status === 'active'
                      ? 'bg-green-600/20 text-green-400 border border-green-500/30'
                      : meteredBillingData.subscription.status === 'trialing'
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                      : meteredBillingData.subscription.status === 'past_due'
                      ? 'bg-red-600/20 text-red-400 border border-red-500/30'
                      : meteredBillingData.subscription.status === 'canceled'
                      ? 'bg-gray-600/20 text-gray-400 border border-gray-500/30'
                      : 'bg-yellow-600/20 text-yellow-400 border border-yellow-500/30'
                  }`}>
                    {meteredBillingData.subscription.status}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-4">
                    <div>
                      <div className="text-sm text-gray-400 mb-1">Plan</div>
                      <div className="text-lg font-semibold text-white">
                        {meteredBillingData.subscription.planName}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400 mb-1">Price</div>
                      <div className="text-2xl font-bold text-blue-400">
                        ${(meteredBillingData.subscription.amount / 100).toFixed(2)}
                        <span className="text-sm text-gray-400 ml-2">
                          / {meteredBillingData.subscription.interval}
                        </span>
                      </div>
                    </div>
                    {meteredBillingData.subscription.trialEnd && (
                      <div>
                        <div className="text-sm text-gray-400 mb-1">Trial Period</div>
                        <div className="text-white">
                          {meteredBillingData.subscription.trialStart && (
                            <span className="text-sm">
                              {new Date(meteredBillingData.subscription.trialStart).toLocaleDateString()}
                            </span>
                          )}
                          {' → '}
                          <span className="text-sm font-medium">
                            {new Date(meteredBillingData.subscription.trialEnd).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                    <div>
                      <div className="text-sm text-gray-400 mb-1">Current Period</div>
                      <div className="text-white text-sm">
                        {new Date(meteredBillingData.subscription.currentPeriodStart).toLocaleDateString()}
                        {' → '}
                        {new Date(meteredBillingData.subscription.currentPeriodEnd).toLocaleDateString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400 mb-1">Next Payment</div>
                      <div className="text-white font-medium">
                        {new Date(meteredBillingData.subscription.currentPeriodEnd).toLocaleDateString()}
                      </div>
                    </div>
                    {meteredBillingData.subscription.cancelAtPeriodEnd && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <FiAlertCircle className="w-4 h-4 text-red-400 mt-0.5" />
                          <div>
                            <div className="text-sm font-medium text-red-400">Canceling at period end</div>
                            <div className="text-xs text-red-300 mt-1">
                              Access until {new Date(meteredBillingData.subscription.currentPeriodEnd).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Development Notice */}
            <div className="p-4 bg-yellow-500/20 border border-yellow-400/30 rounded-lg">
              <div className="flex items-start gap-3">
                <FiTool className="w-5 h-5 text-amber-300 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-red-200 font-semibold mb-1">🚧 Subscription Billing in Development</h3>
                  <p className="text-gray-200 text-sm mb-3">
                    Metered subscription billing is currently under active development and not fully released for production use.
                    Customer subscription assignment and automated billing may experience issues.
                  </p>
                  <div className="bg-yellow-500/10 border border-yellow-400/20 rounded-lg p-3">
                    <p className="text-gray-100 text-sm">
                      <strong className="text-amber-200">For reliable billing</strong>, please use the <strong className="text-blue-300">Invoice Billing</strong> tab above to create
                      and manage customer invoices manually.
                    </p>
                  </div>
                  <p className="text-gray-300 text-xs mt-3">
                    💡 This feature will be fully functional in an upcoming release. Thank you for your patience!
                  </p>
                </div>
              </div>
            </div>

            {isLoadingMetered ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : meteredBillingData ? (
              <>
                {/* Customer Billing Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-700/30 rounded-lg p-4">
                    <div className="text-sm text-gray-400">Active Subscriptions</div>
                    <div className="text-2xl font-bold text-white">
                      {meteredBillingData.meteredSubscriptions?.length || 0}
                    </div>
                  </div>
                  <div className="bg-gray-700/30 rounded-lg p-4">
                    <div className="text-sm text-gray-400">Unbilled Amount</div>
                    <div className="text-2xl font-bold text-blue-400">
                      ${((meteredBillingData.totalUnbilledAmount || 0) / 100).toFixed(2)}
                    </div>
                  </div>
                  <div className="bg-gray-700/30 rounded-lg p-4">
                    <div className="text-sm text-gray-400">Auto-Charge</div>
                    <div className="text-2xl font-bold text-green-400">
                      {meteredBillingData.autoChargeEnabled ? 'Enabled' : 'Disabled'}
                    </div>
                  </div>
                </div>

                {/* Metered Subscriptions */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-white">Metered Subscriptions</h4>
                    <button
                      onClick={() => setShowAddSubscriptionModal(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      <FiPlus className="w-4 h-4" />
                      Add Subscription
                    </button>
                  </div>

                  {meteredBillingData.meteredSubscriptions?.length === 0 ? (
                    <div className="text-center py-8 bg-gray-700/20 rounded-lg">
                      <FiActivity className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                      <p className="text-gray-400 mb-4">No metered subscriptions yet</p>
                      <button
                        onClick={() => setShowAddSubscriptionModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors mx-auto"
                      >
                        <FiPlus className="w-4 h-4" />
                        Add First Subscription
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {meteredBillingData.meteredSubscriptions.map((subscription: any) => (
                        <div key={subscription.id} className="bg-gray-700/30 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h5 className="font-medium text-white">{subscription.planName}</h5>
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  subscription.status === 'active'
                                    ? 'bg-green-600/20 text-green-400'
                                    : subscription.status === 'paused'
                                    ? 'bg-yellow-600/20 text-amber-400'
                                    : 'bg-red-600/20 text-red-400'
                                }`}>
                                  {subscription.status}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-gray-400">
                                <span className="flex items-center gap-1">
                                  <FiActivity className="w-3 h-3" />
                                  Current Usage: {subscription.currentUsage[subscription.plan?.metricName] || 0}
                                </span>
                                <span className="flex items-center gap-1">
                                  <FiDollarSign className="w-3 h-3" />
                                  Projected: ${((subscription.projectedCost || 0) / 100).toFixed(2)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <FiCalendar className="w-3 h-3" />
                                  Next Billing: {new Date(subscription.nextBillingDate).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {subscription.status === 'active' && (
                                <button
                                  onClick={() => handleToggleSubscription(subscription.id, 'paused')}
                                  className="p-2 text-gray-400 hover:text-amber-400 hover:bg-yellow-500/20 rounded-lg transition-colors"
                                  title="Pause subscription"
                                >
                                  <FiPause className="w-4 h-4" />
                                </button>
                              )}
                              {subscription.status === 'paused' && (
                                <button
                                  onClick={() => handleToggleSubscription(subscription.id, 'active')}
                                  className="p-2 text-gray-400 hover:text-green-400 hover:bg-green-500/20 rounded-lg transition-colors"
                                  title="Resume subscription"
                                >
                                  <FiPlay className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleCancelSubscription(subscription.id, subscription.planName)}
                                className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                                title="Cancel subscription"
                              >
                                <FiTrash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Payment Methods */}
                {meteredBillingData.paymentMethods?.length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-4">Payment Methods</h4>
                    <div className="space-y-2">
                      {meteredBillingData.paymentMethods.map((pm: any) => (
                        <div key={pm.id} className="bg-gray-700/30 rounded-lg p-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <FiCreditCard className="w-5 h-5 text-gray-400" />
                            <div>
                              <div className="text-white font-medium">
                                {pm.brand?.toUpperCase()} •••• {pm.lastFour}
                              </div>
                              <div className="text-sm text-gray-400">
                                {pm.type} {pm.isDefault && '• Default'}
                              </div>
                            </div>
                          </div>
                          <div className={`px-2 py-1 text-xs rounded-full ${
                            pm.isActive
                              ? 'bg-green-600/20 text-green-400'
                              : 'bg-gray-600/20 text-gray-400'
                          }`}>
                            {pm.isActive ? 'Active' : 'Inactive'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <FiTrendingUp className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400 mb-4">No billing data available</p>
                <p className="text-sm text-gray-500">
                  Customer billing data will appear here once they have subscriptions or usage
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Invoice Creation Modal */}
      <InvoiceCreationModal
        isOpen={isCreatingInvoice}
        onClose={() => setIsCreatingInvoice(false)}
        customer={{
          ...customer,
          id: actualCustomerId || customer.id // Use the resolved Customer ID
        }}
        onInvoiceCreated={handleInvoiceCreated}
      />

      {/* Add Subscription Modal */}
      {showAddSubscriptionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-800 rounded-xl max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto"
          >
            <div className="p-6 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-white">Add Metered Subscription</h3>
                <button
                  onClick={() => setShowAddSubscriptionModal(false)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>
              <p className="text-gray-400 mt-1">Choose a metered billing plan to assign to this customer</p>
            </div>

            <div className="p-6">
              {(() => {
                // Filter out plans that customer is already actively subscribed to (exclude cancelled)
                const activeSubscribedPlanIds = meteredBillingData?.meteredSubscriptions
                  ?.filter((sub: any) => sub.status === 'active' || sub.status === 'paused')
                  ?.map((sub: any) => sub.planId) || [];
                const unsubscribedPlans = availablePlans.filter(plan => !activeSubscribedPlanIds.includes(plan.id));

                if (unsubscribedPlans.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <FiActivity className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                      {availablePlans.length === 0 ? (
                        <>
                          <p className="text-gray-400 mb-4">No active metered billing plans available</p>
                          <a
                            href="/partner/metered-billing"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                          >
                            <FiPlus className="w-4 h-4" />
                            Create Metered Plan
                          </a>
                        </>
                      ) : (
                        <>
                          <p className="text-gray-400 mb-4">Customer is already subscribed to all available plans</p>
                          <p className="text-sm text-gray-500">
                            Create new plans or manage existing subscriptions above
                          </p>
                        </>
                      )}
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {unsubscribedPlans.map((plan) => (
                      <button
                        key={plan.id}
                        onClick={() => handleSubscribeToMeteredPlan(plan.id)}
                        className="w-full p-4 bg-gray-700/50 hover:bg-gray-700 border border-gray-600 rounded-lg transition-colors text-left"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-white">{plan.name}</h4>
                            <p className="text-sm text-gray-400 mt-1">
                              {plan.metricName} • {plan.billingCycle} billing
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                plan.stripeProductId
                                  ? 'bg-green-600/20 text-green-400'
                                  : 'bg-yellow-600/20 text-amber-400'
                              }`}>
                                {plan.stripeProductId ? 'Stripe Ready' : 'Manual Billing'}
                              </span>
                              <span className="px-2 py-1 bg-blue-600/20 text-blue-400 text-xs rounded-full">
                                {plan.pricingModel}
                              </span>
                            </div>
                          </div>
                          <FiPlus className="w-5 h-5 text-gray-400" />
                        </div>
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
