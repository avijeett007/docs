'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  FiDollarSign,
  FiTrendingUp,
  FiClock,
  FiUsers,
  FiPlus,
  FiSearch,
  FiRefreshCw,
  FiEye,
  FiSend,
  FiTrash2,
  FiCalendar,
  FiCheck,
  FiX,
  FiAlertCircle,
  FiRepeat
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { FormattedInvoice, InvoiceStatus } from '@/types/invoice';
import InvoiceCreationModal from '@/components/partner/InvoiceCreationModal';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import CancellationRequestsManager from '@/components/partner/CancellationRequestsManager';
import RecurringInvoicesManager from '@/components/partner/RecurringInvoicesManager';
import PartnerSidebar from '@/components/partner/PartnerSidebar';

interface BillingStats {
  totalRevenue: number;
  monthlyRevenue: number;
  totalInvoices: number;
  paidInvoices: number;
  pendingInvoices: number;
  overdueInvoices: number;
  averageInvoiceValue: number;
  paymentRate: number;
}

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
}

export default function PartnerBillingPage() {
  const router = useRouter();
  const [partnerName, setPartnerName] = useState('');
  const [invoices, setInvoices] = useState<FormattedInvoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<BillingStats>({
    totalRevenue: 0,
    monthlyRevenue: 0,
    totalInvoices: 0,
    paidInvoices: 0,
    pendingInvoices: 0,
    overdueInvoices: 0,
    averageInvoiceValue: 0,
    paymentRate: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [customerFilter, setCustomerFilter] = useState<string>('all');

  // Confirmation modal states
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [invoiceToCancel, setInvoiceToCancel] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Fetch all data
  const fetchData = async () => {
    try {
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

      // Fetch invoices and customers in parallel
      const [invoicesResponse, customersResponse] = await Promise.all([
        fetch('/api/partner/invoices', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch('/api/partner/customers', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);

      if (invoicesResponse.ok) {
        const invoicesData = await invoicesResponse.json();
        if (invoicesData.success) {
          setInvoices(invoicesData.data.invoices);
          calculateStats(invoicesData.data.invoices);
        }
      }

      if (customersResponse.ok) {
        const customersData = await customersResponse.json();
        if (customersData.success) {
          setCustomers(customersData.data || []);
        }
      }
    } catch (error) {
      console.error('Error fetching billing data:', error);
      toast.error('Failed to load billing data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Calculate statistics from invoices
  const calculateStats = (invoiceList: FormattedInvoice[]) => {
    const totalRevenue = invoiceList
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + inv.amount, 0);

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthlyRevenue = invoiceList
      .filter(inv => {
        const invoiceDate = new Date(inv.createdAt);
        return inv.status === 'paid' &&
               invoiceDate.getMonth() === currentMonth &&
               invoiceDate.getFullYear() === currentYear;
      })
      .reduce((sum, inv) => sum + inv.amount, 0);

    const paidInvoices = invoiceList.filter(inv => inv.status === 'paid').length;
    const pendingInvoices = invoiceList.filter(inv => inv.status === 'sent').length;
    const overdueInvoices = invoiceList.filter(inv => inv.status === 'overdue').length;

    const averageInvoiceValue = invoiceList.length > 0
      ? invoiceList.reduce((sum, inv) => sum + inv.amount, 0) / invoiceList.length
      : 0;

    const paymentRate = invoiceList.length > 0
      ? (paidInvoices / invoiceList.length) * 100
      : 0;

    setStats({
      totalRevenue,
      monthlyRevenue,
      totalInvoices: invoiceList.length,
      paidInvoices,
      pendingInvoices,
      overdueInvoices,
      averageInvoiceValue,
      paymentRate,
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLogout = () => {
    // Clear partner data from localStorage
    localStorage.removeItem('partner_token');
    localStorage.removeItem('partner_name');
    // Redirect to login page
    router.push('/partner/login');
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchData();
  };

  const handleInvoiceCreated = (newInvoice: FormattedInvoice) => {
    setInvoices(prev => [newInvoice, ...prev]);
    calculateStats([newInvoice, ...invoices]);
    setIsCreatingInvoice(false);
    setSelectedCustomer(null);
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
        calculateStats(invoices.map(inv =>
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

  const handleCancelInvoice = (invoiceId: string) => {
    setInvoiceToCancel(invoiceId);
    setShowCancelConfirmation(true);
  };

  const confirmCancelInvoice = async () => {
    if (!invoiceToCancel) return;

    setIsCancelling(true);
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch(`/api/partner/invoices/${invoiceToCancel}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Failed to cancel invoice');
      }

      const data = await response.json();
      if (data.success) {
        setInvoices(prev => prev.map(inv =>
          inv.id === invoiceToCancel
            ? { ...inv, status: 'cancelled' as const }
            : inv
        ));
        calculateStats(invoices.map(inv =>
          inv.id === invoiceToCancel
            ? { ...inv, status: 'cancelled' as const }
            : inv
        ));
        toast.success('Invoice cancelled successfully');
      }
      setShowCancelConfirmation(false);
      setInvoiceToCancel(null);
    } catch (error) {
      console.error('Error cancelling invoice:', error);
      toast.error('Failed to cancel invoice');
    } finally {
      setIsCancelling(false);
    }
  };

  // Filter invoices based on search and filters
  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = searchTerm === '' ||
      invoice.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customer?.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    const matchesCustomer = customerFilter === 'all' || invoice.customer?.id === customerFilter;

    return matchesSearch && matchesStatus && matchesCustomer;
  });

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex">
        <PartnerSidebar partnerName={partnerName} onLogout={handleLogout} />
        <main className="flex-1 pl-64 transition-all duration-300">
          <div className="flex items-center justify-center h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex">
      <PartnerSidebar partnerName={partnerName} onLogout={handleLogout} />

      <main className="flex-1 pl-64 transition-all duration-300">
        <div className="p-8">
          <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Billing & Invoices</h1>
            <p className="text-gray-400 mt-1">Manage your customer invoices and track payments</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              <FiRefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => setIsCreatingInvoice(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-lg hover:from-blue-600 hover:to-teal-600 transition-all"
            >
              <FiPlus className="w-4 h-4" />
              Create Invoice
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Revenue</p>
                <p className="text-2xl font-bold text-white">{formatAmount(stats.totalRevenue)}</p>
              </div>
              <div className="p-3 bg-green-500/20 rounded-lg">
                <FiDollarSign className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </div>

          <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">This Month</p>
                <p className="text-2xl font-bold text-white">{formatAmount(stats.monthlyRevenue)}</p>
              </div>
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <FiTrendingUp className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Invoices</p>
                <p className="text-2xl font-bold text-white">{stats.totalInvoices}</p>
              </div>
              <div className="p-3 bg-purple-500/20 rounded-lg">
                <FiUsers className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </div>

          <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Payment Rate</p>
                <p className="text-2xl font-bold text-white">{stats.paymentRate.toFixed(1)}%</p>
              </div>
              <div className="p-3 bg-teal-500/20 rounded-lg">
                <FiCheck className="w-6 h-6 text-teal-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Paid Invoices</span>
              <span className="text-green-400 font-semibold">{stats.paidInvoices}</span>
            </div>
          </div>
          <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Pending Invoices</span>
              <span className="text-blue-400 font-semibold">{stats.pendingInvoices}</span>
            </div>
          </div>
          <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Overdue Invoices</span>
              <span className="text-red-400 font-semibold">{stats.overdueInvoices}</span>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search invoices..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | 'all')}
                className="px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <select
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                className="px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Customers</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.companyName || `${customer.firstName} ${customer.lastName}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Invoices List */}
        <div className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
          <div className="p-6 border-b border-gray-800">
            <h2 className="text-xl font-semibold text-white">
              Invoices ({filteredInvoices.length})
            </h2>
          </div>

          {filteredInvoices.length === 0 ? (
            <div className="text-center py-12">
              <FiDollarSign className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400 mb-4">
                {searchTerm || statusFilter !== 'all' || customerFilter !== 'all'
                  ? 'No invoices match your filters'
                  : 'No invoices created yet'
                }
              </p>
              {!searchTerm && statusFilter === 'all' && customerFilter === 'all' && (
                <button
                  onClick={() => setIsCreatingInvoice(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-lg hover:from-blue-600 hover:to-teal-600 transition-all mx-auto"
                >
                  <FiPlus className="w-4 h-4" />
                  Create First Invoice
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              <AnimatePresence>
                {filteredInvoices.map((invoice) => (
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
                            <FiUsers className="w-3 h-3" />
                            {invoice.customer?.name || invoice.customer?.email}
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
        </div>

        {/* Recurring Invoices Management Section */}
        <RecurringInvoicesManager className="bg-gray-900/50 rounded-xl border border-gray-800 p-6" />

        {/* Cancellation Requests Section */}
        <CancellationRequestsManager className="bg-gray-900/50 rounded-xl border border-gray-800 p-6" />

        {/* Customer Selection Modal */}
        {isCreatingInvoice && !selectedCustomer && customers.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-gray-800"
            >
              <h3 className="text-xl font-bold text-white mb-4">Select Customer</h3>
              <p className="text-gray-400 mb-6">Choose a customer to create an invoice for:</p>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {customers.map((customer) => (
                  <button
                    key={customer.id}
                    onClick={() => setSelectedCustomer(customer)}
                    className="w-full text-left p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <div className="font-medium text-white">
                      {customer.companyName || `${customer.firstName} ${customer.lastName}`}
                    </div>
                    <div className="text-sm text-gray-400">{customer.email}</div>
                  </button>
                ))}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setIsCreatingInvoice(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Invoice Creation Modal */}
        {selectedCustomer && (
          <InvoiceCreationModal
            isOpen={isCreatingInvoice && !!selectedCustomer}
            onClose={() => {
              setIsCreatingInvoice(false);
              setSelectedCustomer(null);
            }}
            customer={selectedCustomer}
            onInvoiceCreated={handleInvoiceCreated}
          />
        )}

        {/* Cancellation Confirmation Modal */}
        <ConfirmationModal
          isOpen={showCancelConfirmation}
          onClose={() => {
            setShowCancelConfirmation(false);
            setInvoiceToCancel(null);
          }}
          onConfirm={confirmCancelInvoice}
          title="Cancel Invoice"
          message="Are you sure you want to cancel this invoice? This action cannot be undone."
          confirmText="Cancel Invoice"
          cancelText="Keep Invoice"
          type="danger"
          isLoading={isCancelling}
        />
          </div>
        </div>
      </main>
    </div>
  );
}
