'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  FiDollarSign,
  FiCalendar,
  FiClock,
  FiCheck,
  FiX,
  FiAlertCircle,
  FiCreditCard,
  FiRefreshCw,
  FiEye,
  FiRepeat
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import WhitelabelLayout from '@/components/whitelabel/WhitelabelLayout';
import CancellationRequestModal from '@/components/ui/CancellationRequestModal';
import { usePartnerBranding } from '@/lib/partnerBranding';
import { PortalTheme, getThemeConfig } from '@/lib/portalThemes';
import { loadLanguageDataWithLocale, getTranslatedText, type LanguageData, type SupportedLanguage } from '@/lib/languages';

import UsageDashboard from '@/components/whitelabel/UsageDashboard';
import PaymentMethodsManager from '@/components/whitelabel/PaymentMethodsManager';
import CustomerCreditPurchaseModal from '@/components/whitelabel/CustomerCreditPurchaseModal';

interface Invoice {
  id: string;
  invoiceNumber: string;
  title: string;
  description?: string;
  amount: number;
  currency: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'processing';
  type: 'one_time' | 'recurring';
  recurringInterval?: 'weekly' | 'monthly' | 'yearly';
  recurringCount?: number;
  nextPaymentDate?: string;
  hostedInvoiceUrl?: string;
  dueDate?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
  partner: {
    businessName: string;
    email: string;
  };
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    businessName: string;
    displayName: string;
  };
  payments: Array<{
    id: string;
    amount: number;
    status: string;
    paidAt?: string;
  }>;
  totalPaid: number;
}

interface BillingSummary {
  totalInvoices: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  overdueCount: number;
}

export default function CustomerBillingPage() {
  const { branding } = usePartnerBranding();
  const theme = (branding.themePreference as PortalTheme) || PortalTheme.MODERN;
  const themeConfig = getThemeConfig(theme);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<BillingSummary>({
    totalInvoices: 0,
    totalAmount: 0,
    paidAmount: 0,
    pendingAmount: 0,
    overdueCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [activeTab, setActiveTab] = useState<'invoices' | 'usage' | 'subscriptions' | 'payment-methods' | 'credits'>('invoices');
  const [customerId, setCustomerId] = useState<string>('');
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [showCreditPurchaseModal, setShowCreditPurchaseModal] = useState(false);
  const [creditBalance, setCreditBalance] = useState<any>(null);
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [selectedInvoiceForCancellation, setSelectedInvoiceForCancellation] = useState<any>(null);
  const [processingInvoiceId, setProcessingInvoiceId] = useState<string | null>(null);
  const [cancelledInvoiceIds, setCancelledInvoiceIds] = useState<Set<string>>(new Set());
  const [showSubscriptionCancelModal, setShowSubscriptionCancelModal] = useState(false);
  const [selectedSubscriptionForCancel, setSelectedSubscriptionForCancel] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancellingSubscription, setIsCancellingSubscription] = useState(false);

  // Language state
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>('en');
  const [languageData, setLanguageData] = useState<LanguageData | null>(null);
  const [languageLoaded, setLanguageLoaded] = useState(false);

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

  // Fetch customer info
  const fetchCustomerInfo = async () => {
    try {
      const response = await fetch('/api/whitelabel/auth/me', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch customer info');
      }

      const data = await response.json();
      if (data.customer?.id) {
        setCustomerId(data.customer.id);
      }
    } catch (error) {
      console.error('Error fetching customer info:', error);
    }
  };

  // Fetch subscriptions
  const fetchSubscriptions = async () => {
    try {
      const response = await fetch('/api/whitelabel/billing/subscriptions', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSubscriptions(data.data.subscriptions || []);
        }
      }
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
    }
  };

  // Fetch credit balance
  const fetchCreditBalance = async () => {
    try {
      const response = await fetch('/api/whitelabel/credits/balance', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCreditBalance(data.data);
        }
      }
    } catch (error) {
      console.error('Error fetching credit balance:', error);
    }
  };

  // Fetch invoices
  const fetchInvoices = async () => {
    try {
      const response = await fetch('/api/whitelabel/billing/invoices', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch invoices');
      }

      const data = await response.json();
      if (data.success) {
        setInvoices(data.data.invoices);
        setSummary(data.data.summary);
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast.error('Failed to load invoices');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
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

  useEffect(() => {
    const initializeData = async () => {
      await fetchCustomerInfo();
      await fetchInvoices();
      await fetchSubscriptions();
      await fetchCreditBalance();
    };

    initializeData();

    // Check for payment success in URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      const sessionId = urlParams.get('session_id');

      if (sessionId) {
        // Process credit purchase success
        handleCreditPurchaseSuccess(sessionId);
      } else {
        toast.success('Payment completed successfully!');
      }

      // Clean up URL
      window.history.replaceState({}, '', '/whitelabel/billing');
    } else if (urlParams.get('payment') === 'success') {
      toast.success('Payment completed successfully!');
      // Clean up URL
      window.history.replaceState({}, '', '/whitelabel/billing');
    } else if (urlParams.get('cancelled') === 'true') {
      toast.error('Payment was cancelled');
      // Clean up URL
      window.history.replaceState({}, '', '/whitelabel/billing');
    }

    // Cleanup function to clear processing state on unmount
    return () => {
      setProcessingInvoiceId(null);
    };
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setProcessingInvoiceId(null); // Clear any processing state
    fetchInvoices();
  };

  const handleCreditPurchaseSuccess = async (sessionId: string) => {
    try {
      toast.success('Payment successful! Processing your credits...');

      const response = await fetch(`/api/whitelabel/credits/success?session_id=${sessionId}`, {
        credentials: 'include',
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`${data.data.credits} credits added to your account!`);
        // Refresh credit balance
        await fetchCreditBalance();
        // Dispatch custom event to refresh sidebar credits
        window.dispatchEvent(new CustomEvent('refreshCredits'));
      } else {
        console.error('Credit processing error:', data.error);
        toast.error(data.error || 'Failed to process credits');
      }
    } catch (error) {
      console.error('Error processing credit purchase:', error);
      toast.error('Failed to process credit purchase');
    }
  };

  // Poll for invoice status updates
  const pollInvoiceStatus = async (invoiceId: string) => {
    const maxAttempts = 60; // Poll for up to 5 minutes (60 * 5 seconds)
    let attempts = 0;

    const poll = async () => {
      try {
        attempts++;
        console.log(`Polling invoice status (attempt ${attempts}/${maxAttempts}) for invoice:`, invoiceId);

        const response = await fetch('/api/whitelabel/billing/invoices', {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            const updatedInvoice = data.data.invoices.find((inv: Invoice) => inv.id === invoiceId);

            if (updatedInvoice) {
              console.log(`Invoice ${invoiceId} status:`, updatedInvoice.status);

              // Update the local state with the new invoice data
              setInvoices(prevInvoices =>
                prevInvoices.map(inv =>
                  inv.id === invoiceId ? updatedInvoice : inv
                )
              );

              // If payment is completed, stop polling
              if (updatedInvoice.status === 'paid') {
                console.log(`Payment completed for invoice ${invoiceId}`);
                setProcessingInvoiceId(null);
                toast.success('Payment completed successfully!');
                return;
              }
            }
          }
        }

        // Continue polling if not paid and haven't exceeded max attempts
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000); // Poll every 5 seconds
        } else {
          console.log(`Polling timeout for invoice ${invoiceId}`);
          setProcessingInvoiceId(null);
          toast.info('Payment processing is taking longer than expected. Please refresh the page to check status.');
        }
      } catch (error) {
        console.error('Error polling invoice status:', error);
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000); // Continue polling even on error
        } else {
          setProcessingInvoiceId(null);
        }
      }
    };

    // Start polling after a short delay to allow the user to complete payment
    setTimeout(poll, 10000); // Wait 10 seconds before first poll
  };

  const handleCancellationRequest = (invoice: Invoice) => {
    setSelectedInvoiceForCancellation(invoice);
    setShowCancellationModal(true);
  };

  const handleCancellationRequestSubmitted = () => {
    // Add the invoice to the cancelled requests set
    if (selectedInvoiceForCancellation) {
      setCancelledInvoiceIds(prev => new Set(prev).add(selectedInvoiceForCancellation.id));
    }

    // Refresh invoices to show updated status
    fetchInvoices();
    toast.success('Your cancellation request has been submitted and will be reviewed by your service provider.');
  };

  const handlePayInvoice = (invoice: Invoice) => {
    console.log('Pay Now clicked for invoice:', {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      hostedInvoiceUrl: invoice.hostedInvoiceUrl,
    });

    // Open Stripe's hosted invoice page in a new tab
    if (invoice.hostedInvoiceUrl) {
      console.log('Opening hosted invoice URL in new tab:', invoice.hostedInvoiceUrl);

      // Set processing state
      setProcessingInvoiceId(invoice.id);
      toast.info('Payment window opened. Complete your payment and we\'ll update the status automatically.');

      // Open the payment page
      window.open(invoice.hostedInvoiceUrl, '_blank');

      // Start polling for status updates
      pollInvoiceStatus(invoice.id);
    } else {
      console.error('No hosted invoice URL available for invoice:', invoice.id);
      toast.error('Payment URL not available. Please contact support.');
    }
  };



  // Removed polling system - now webhook-first approach
  // Invoice stays in "processing" until webhook confirms payment



  const getStatusBadge = (status: string) => {
    // For customer view, show "sent" invoices as "pending"
    const displayStatus = status === 'sent' ? 'pending' : status;

    const statusConfig = {
      draft: { color: 'bg-gray-500/20 text-gray-400', icon: FiClock },
      pending: { color: 'bg-yellow-500/20 text-yellow-400', icon: FiClock },
      sent: { color: 'bg-blue-500/20 text-blue-400', icon: FiClock },
      processing: { color: 'bg-yellow-500/20 text-yellow-400', icon: FiCreditCard },
      paid: { color: 'bg-green-500/20 text-green-400', icon: FiCheck },
      overdue: { color: 'bg-red-500/20 text-red-400', icon: FiAlertCircle },
      cancelled: { color: 'bg-gray-500/20 text-gray-400', icon: FiX },
    };

    const config = statusConfig[displayStatus as keyof typeof statusConfig] || statusConfig.draft;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3" />
        {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
      </span>
    );
  };

  const getRecurringBadge = (invoice: any) => {
    if (invoice.type !== 'recurring') return null;

    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400">
        <FiRepeat className="w-3 h-3" />
        Recurring
      </span>
    );
  };

  const getNextPaymentInfo = (invoice: any) => {
    if (invoice.type !== 'recurring' || !invoice.nextPaymentDate) return null;

    const nextDate = new Date(invoice.nextPaymentDate);
    const isValidDate = !isNaN(nextDate.getTime()) && nextDate.getFullYear() > 2000;

    if (!isValidDate) return null;

    return (
      <span className="flex items-center gap-1 text-xs text-purple-400">
        <FiRepeat className="w-3 h-3" />
        Next: {formatDate(invoice.nextPaymentDate)}
      </span>
    );
  };

  const formatAmount = (amount: number) => {
    return `$${(amount / 100).toFixed(2)}`;
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString();
  };

  const handleCancelSubscription = async () => {
    if (!selectedSubscriptionForCancel) return;

    setIsCancellingSubscription(true);
    try {
      const response = await fetch('/api/whitelabel/billing/subscriptions/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          subscriptionId: selectedSubscriptionForCancel.id,
          reason: cancelReason,
          immediate: true,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success(data.data.message || 'Subscription cancelled successfully');
        setShowSubscriptionCancelModal(false);
        setCancelReason('');
        
        // Redirect to login after a short delay
        setTimeout(() => {
          window.location.href = '/whitelabel/login';
        }, 2000);
      } else {
        throw new Error(data.error || 'Failed to cancel subscription');
      }
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to cancel subscription');
    } finally {
      setIsCancellingSubscription(false);
    }
  };

  if (isLoading) {
    return (
      <WhitelabelLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </WhitelabelLayout>
    );
  }

  return (
    <WhitelabelLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">{getTranslation('portal.billing.title', 'Billing & Payments')}</h1>
            <p className="text-gray-400 mt-1">{getTranslation('portal.billing.subtitle', 'View and pay your invoices')}</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <FiRefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {getTranslation('portal.billing.refresh', 'Refresh')}
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-xl p-6`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Invoices</p>
                <p className="text-2xl font-bold text-white">{summary.totalInvoices}</p>
              </div>
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <FiDollarSign className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </div>

          <div className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-xl p-6`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Amount</p>
                <p className="text-2xl font-bold text-white">{formatAmount(summary.totalAmount)}</p>
              </div>
              <div className="p-3 bg-purple-500/20 rounded-lg">
                <FiCreditCard className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </div>

          <div className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-xl p-6`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Paid Amount</p>
                <p className="text-2xl font-bold text-green-400">{formatAmount(summary.paidAmount)}</p>
              </div>
              <div className="p-3 bg-green-500/20 rounded-lg">
                <FiCheck className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </div>

          <div className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-xl p-6`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Pending Amount</p>
                <p className="text-2xl font-bold text-amber-400">{formatAmount(summary.pendingAmount)}</p>
              </div>
              <div className="p-3 bg-yellow-500/20 rounded-lg">
                <FiClock className="w-6 h-6 text-amber-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Overdue Alert */}
        {summary.overdueCount > 0 && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <FiAlertCircle className="w-5 h-5 text-red-400" />
              <div>
                <p className="text-red-400 font-medium">
                  You have {summary.overdueCount} overdue invoice{summary.overdueCount > 1 ? 's' : ''}
                </p>
                <p className="text-red-300 text-sm">
                  Please pay your overdue invoices to avoid service interruption.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-800/50 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('invoices')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'invoices'
                ? 'bg-white text-gray-900'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            {getTranslation('portal.billing.tabs.invoices', 'Invoices')}
          </button>
          <button
            onClick={() => setActiveTab('subscriptions')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'subscriptions'
                ? 'bg-white text-gray-900'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            {getTranslation('portal.billing.tabs.subscriptions', 'Subscriptions')}
          </button>
          <button
            onClick={() => setActiveTab('usage')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'usage'
                ? 'bg-white text-gray-900'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            {getTranslation('portal.billing.tabs.usage', 'Usage')}
          </button>
          <button
            onClick={() => setActiveTab('credits')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'credits'
                ? 'bg-white text-gray-900'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            {getTranslation('portal.billing.tabs.credits', 'AI Credits')}
          </button>
          <button
            onClick={() => setActiveTab('payment-methods')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'payment-methods'
                ? 'bg-white text-gray-900'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            {getTranslation('portal.billing.tabs.paymentMethods', 'Payment Methods')}
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'invoices' && (
          <>
            {/* Invoices List */}
        <div className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-xl overflow-hidden`}>
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-xl font-semibold text-white">
              Invoices ({invoices.length})
            </h2>
          </div>

          {invoices.length === 0 ? (
            <div className="text-center py-12">
              <FiDollarSign className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400">No invoices found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              <AnimatePresence>
                {invoices.map((invoice) => (
                  <motion.div
                    key={invoice.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="p-6 hover:bg-gray-800/30 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-medium text-white">{invoice.title}</h3>
                          {getStatusBadge(invoice.status)}
                          {getRecurringBadge(invoice)}
                        </div>
                        <div className="flex items-center gap-6 text-sm text-gray-400">
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
                          {getNextPaymentInfo(invoice)}
                        </div>
                        {invoice.description && (
                          <p className="text-sm text-gray-400 mt-1">{invoice.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                          title="View Invoice"
                        >
                          <FiEye className="w-4 h-4" />
                        </button>
                        {(invoice.status === 'sent' || invoice.status === 'overdue') && processingInvoiceId !== invoice.id && (
                          <button
                            onClick={() => handlePayInvoice(invoice)}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-lg hover:from-blue-600 hover:to-teal-600 transition-all"
                          >
                            <FiCreditCard className="w-4 h-4" />
                            Pay Now
                          </button>
                        )}
                        {(invoice.status === 'processing' || processingInvoiceId === invoice.id) && (
                          <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 text-yellow-400 rounded-lg">
                            <FiClock className="w-4 h-4 animate-spin" />
                            Payment Processing...
                          </div>
                        )}
                        {invoice.type === 'recurring' && invoice.status !== 'cancelled' && invoice.status !== 'paid' && (
                          cancelledInvoiceIds.has(invoice.id) ? (
                            <div className="flex items-center gap-2 px-3 py-2 bg-orange-500/20 text-orange-400 rounded-lg">
                              <FiClock className="w-4 h-4" />
                              Cancellation Requested
                            </div>
                          ) : (
                            <button
                              onClick={() => handleCancellationRequest(invoice)}
                              className="flex items-center gap-2 px-3 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                              title="Request Cancellation"
                            >
                              <FiX className="w-4 h-4" />
                              Cancel
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
          </>
        )}

        {/* Subscriptions Tab */}
        {activeTab === 'subscriptions' && (
          <div className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-xl overflow-hidden`}>
            <div className="p-6 border-b border-gray-700">
              <h2 className="text-xl font-semibold text-white">
                Active Subscriptions ({subscriptions.length})
              </h2>
            </div>

            {subscriptions.length === 0 ? (
              <div className="text-center py-12">
                <FiCreditCard className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400">No active subscriptions</p>
                <p className="text-sm text-gray-500 mt-2">
                  Contact your service provider to set up billing plans
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-700">
                {subscriptions.map((subscription: any) => (
                  <div key={subscription.id} className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-medium text-white">{subscription.planName}</h3>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            subscription.status === 'active'
                              ? 'bg-green-600/20 text-green-400'
                              : subscription.status === 'trialing'
                              ? 'bg-blue-600/20 text-blue-400'
                              : subscription.status === 'past_due'
                              ? 'bg-red-600/20 text-red-400'
                              : subscription.status === 'canceled'
                              ? 'bg-gray-600/20 text-gray-400'
                              : subscription.status === 'paused'
                              ? 'bg-yellow-600/20 text-amber-400'
                              : 'bg-red-600/20 text-red-400'
                          }`}>
                            {subscription.status}
                          </span>
                        </div>
                        
                        {subscription.type === 'regular' ? (
                          <>
                            <div className="flex items-center gap-6 text-sm text-gray-400 mb-2">
                              <span>Started: {formatDate(subscription.createdAt)}</span>
                              {subscription.currentPeriodStart && subscription.currentPeriodEnd && (
                                <span>
                                  Current Period: {formatDate(subscription.currentPeriodStart)} → {formatDate(subscription.currentPeriodEnd)}
                                </span>
                              )}
                            </div>
                            {subscription.trialEnd && subscription.status === 'trialing' && (
                              <div className="text-sm text-blue-400 mb-1">
                                Trial ends: {formatDate(subscription.trialEnd)}
                              </div>
                            )}
                            {subscription.cancelAtPeriodEnd && (
                              <div className="flex items-center gap-2 text-sm text-red-400 mt-2">
                                <FiAlertCircle className="w-4 h-4" />
                                <span>Canceling at period end ({formatDate(subscription.currentPeriodEnd)})</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center gap-6 text-sm text-gray-400">
                            <span>Started: {formatDate(subscription.createdAt)}</span>
                            {subscription.nextBillingDate && (
                              <span>Next Billing: {formatDate(subscription.nextBillingDate)}</span>
                            )}
                          </div>
                        )}
                        
                        {subscription.description && (
                          <p className="text-sm text-gray-400 mt-1">{subscription.description}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-3">
                      <div className="text-right">
                        {subscription.type === 'regular' && subscription.plan ? (
                          <>
                            <div className="text-lg font-semibold text-white">
                              ${(subscription.plan.amount / 100).toFixed(2)}
                            </div>
                            <div className="text-sm text-gray-400">
                              per {subscription.plan.interval}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-lg font-semibold text-white">
                              Usage-based billing
                            </div>
                            <div className="text-sm text-gray-400">
                              Billed monthly
                            </div>
                          </>
                        )}
                      </div>
                      {subscription.type === 'regular' && subscription.status !== 'canceled' && (
                        <button
                          onClick={() => {
                            setSelectedSubscriptionForCancel(subscription);
                            setShowSubscriptionCancelModal(true);
                          }}
                          className="px-4 py-2 text-sm bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors border border-red-500/30"
                        >
                          Cancel Subscription
                        </button>
                      )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Usage Tab */}
        {activeTab === 'usage' && (
          <UsageDashboard />
        )}

        {/* Credits Tab */}
        {activeTab === 'credits' && (
          <div className="space-y-6">
            {/* Credit Balance Card */}
            <div className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-xl p-6`}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-white mb-2">AI Credits</h2>
                  <p className="text-gray-400">
                    Purchase and manage your AI credits for voice agents and features
                  </p>
                </div>
                <button
                  onClick={() => setShowCreditPurchaseModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors"
                  style={{
                    backgroundColor: branding.primaryColor,
                    color: '#ffffff',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.9';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                  }}
                >
                  <FiDollarSign className="w-4 h-4" />
                  Purchase Credits
                </button>
              </div>

              {/* Credit Balance Display */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="p-2 rounded-lg"
                      style={{ backgroundColor: `${branding.primaryColor}20` }}
                    >
                      <FiDollarSign
                        className="w-5 h-5"
                        style={{ color: branding.primaryColor }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-300">Current Balance</span>
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {creditBalance ? creditBalance.creditBalance.toLocaleString() : '---'}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">AI Credits</div>
                </div>

                <div className="bg-gray-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-green-500/20 rounded-lg">
                      <FiCalendar className="w-5 h-5 text-green-400" />
                    </div>
                    <span className="text-sm font-medium text-gray-300">Monthly Allocation</span>
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {creditBalance ? creditBalance.monthlyCreditAllocation.toLocaleString() : '---'}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">Per Month</div>
                </div>

                <div className="bg-gray-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                      <FiClock className="w-5 h-5 text-purple-400" />
                    </div>
                    <span className="text-sm font-medium text-gray-300">Total Used</span>
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {creditBalance ? creditBalance.totalCreditsUsed.toLocaleString() : '---'}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">All Time</div>
                </div>
              </div>

              {/* Low Credit Warning */}
              {creditBalance?.lowCreditAlert && (
                <div className="mt-6 bg-red-500/20 border border-red-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <FiAlertCircle className="w-5 h-5 text-red-400" />
                    <div>
                      <p className="text-red-400 font-medium">Low Credit Alert</p>
                      <p className="text-red-300 text-sm">
                        Your credit balance is below the threshold of {creditBalance.lowCreditThreshold} credits.
                        Consider purchasing more credits to avoid service interruption.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Recent Transactions */}
            {creditBalance?.recentTransactions && creditBalance.recentTransactions.length > 0 && (
              <div className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-xl overflow-hidden`}>
                <div className="p-6 border-b border-gray-700">
                  <h3 className="text-lg font-semibold text-white">Recent Credit Transactions</h3>
                </div>
                <div className="divide-y divide-gray-700">
                  {creditBalance.recentTransactions.map((transaction: any) => (
                    <div key={transaction.id} className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">{transaction.description}</p>
                        <p className="text-gray-400 text-sm">
                          {new Date(transaction.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`font-medium ${
                          transaction.amount >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {transaction.amount >= 0 ? '+' : ''}{transaction.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-gray-400 text-sm">
                          Balance: {transaction.balanceAfter.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Payment Methods Tab */}
        {activeTab === 'payment-methods' && (
          <div className="space-y-6">
            <div className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-xl p-6`}>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white mb-2">Payment Methods</h2>
                <p className="text-gray-400">
                  Manage your payment methods for automatic billing
                </p>
              </div>

              <PaymentMethodsManager
                onPaymentMethodAdded={() => {
                  toast.success('Payment method added successfully!');
                }}
                showAddButton={true}
              />
            </div>
          </div>
        )}

        {/* Payment now redirects to Stripe hosted invoice page */}

        {/* Credit Purchase Modal */}
        <CustomerCreditPurchaseModal
          isOpen={showCreditPurchaseModal}
          onClose={() => setShowCreditPurchaseModal(false)}
          onPurchaseSuccess={() => {
            setShowCreditPurchaseModal(false);
            fetchCreditBalance();
            toast.success('Credit purchase initiated! You will be redirected to complete payment.');
          }}
        />

        {/* Cancellation Request Modal */}
        {selectedInvoiceForCancellation && (
          <CancellationRequestModal
            isOpen={showCancellationModal}
            onClose={() => {
              setShowCancellationModal(false);
              setSelectedInvoiceForCancellation(null);
            }}
            invoice={selectedInvoiceForCancellation}
            onRequestSubmitted={handleCancellationRequestSubmitted}
          />
        )}

        {/* Cancel Subscription Modal */}
        {showSubscriptionCancelModal && selectedSubscriptionForCancel && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-gray-800 rounded-xl shadow-2xl max-w-md w-full border border-gray-700"
            >
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-red-500/20">
                    <FiAlertCircle className="w-5 h-5 text-red-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">Cancel Subscription</h3>
                </div>

                <p className="text-gray-300 mb-4">
                  Are you sure you want to cancel your subscription to <strong>{selectedSubscriptionForCancel.planName}</strong>?
                </p>

                <div className="bg-red-900/20 border border-red-700 rounded-lg p-3 mb-4">
                  <p className="text-sm text-red-200">
                    <strong>Warning:</strong> Cancelling your subscription will immediately log you out and you will lose access to the dashboard.
                  </p>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Reason for cancellation (optional)
                  </label>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Let us know why you're cancelling..."
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                    rows={3}
                    disabled={isCancellingSubscription}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowSubscriptionCancelModal(false);
                      setSelectedSubscriptionForCancel(null);
                      setCancelReason('');
                    }}
                    disabled={isCancellingSubscription}
                    className="flex-1 px-4 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                  >
                    Keep Subscription
                  </button>
                  <button
                    onClick={handleCancelSubscription}
                    disabled={isCancellingSubscription}
                    className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isCancellingSubscription ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                        <span>Cancelling...</span>
                      </>
                    ) : (
                      'Cancel Subscription'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </WhitelabelLayout>
  );
}
