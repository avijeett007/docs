'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiRepeat, 
  FiCalendar, 
  FiDollarSign, 
  FiUser, 
  FiPause, 
  FiPlay, 
  FiEdit3,
  FiTrash2,
  FiClock,
  FiTrendingUp,
  FiAlertCircle
} from 'react-icons/fi';
import { toast } from 'sonner';

interface RecurringInvoice {
  id: string;
  invoiceNumber: string;
  title: string;
  description?: string;
  amount: number;
  currency: string;
  recurringInterval: string;
  recurringCount?: number;
  nextPaymentDate?: string;
  status: string;
  createdAt: string;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    companyName?: string;
  };
  _count?: {
    recurringPayments?: number;
  };
}

interface RecurringStats {
  totalRecurring: number;
  activeRecurring: number;
  pausedRecurring: number;
  monthlyRecurringRevenue: number;
  nextPaymentsDue: number;
}

interface RecurringInvoicesManagerProps {
  className?: string;
}

export default function RecurringInvoicesManager({ className = '' }: RecurringInvoicesManagerProps) {
  const [recurringInvoices, setRecurringInvoices] = useState<RecurringInvoice[]>([]);
  const [stats, setStats] = useState<RecurringStats>({
    totalRecurring: 0,
    activeRecurring: 0,
    pausedRecurring: 0,
    monthlyRecurringRevenue: 0,
    nextPaymentsDue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'paused' | 'cancelled'>('active');

  const fetchRecurringInvoices = async () => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch('/api/partner/invoices?type=recurring', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch recurring invoices');
      }

      const data = await response.json();
      if (data.success) {
        const invoices = data.data.invoices.filter((inv: any) => inv.type === 'recurring');
        setRecurringInvoices(invoices);
        calculateStats(invoices);
      }
    } catch (error) {
      console.error('Error fetching recurring invoices:', error);
      toast.error('Failed to load recurring invoices');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (invoices: RecurringInvoice[]) => {
    const totalRecurring = invoices.length;
    const activeRecurring = invoices.filter(inv => inv.status === 'active' || inv.status === 'sent').length;
    const pausedRecurring = invoices.filter(inv => inv.status === 'paused').length;
    
    // Calculate monthly recurring revenue (convert all intervals to monthly equivalent)
    const monthlyRecurringRevenue = invoices
      .filter(inv => inv.status === 'active' || inv.status === 'sent')
      .reduce((sum, inv) => {
        let monthlyAmount = inv.amount;
        switch (inv.recurringInterval) {
          case 'weekly':
            monthlyAmount = inv.amount * 4.33; // Average weeks per month
            break;
          case 'yearly':
            monthlyAmount = inv.amount / 12;
            break;
          case 'quarterly':
            monthlyAmount = inv.amount / 3;
            break;
          // 'monthly' stays as is
        }
        return sum + monthlyAmount;
      }, 0);

    // Count invoices due in next 7 days
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextPaymentsDue = invoices.filter(inv => {
      if (!inv.nextPaymentDate) return false;
      const paymentDate = new Date(inv.nextPaymentDate);
      return paymentDate <= nextWeek && (inv.status === 'active' || inv.status === 'sent');
    }).length;

    setStats({
      totalRecurring,
      activeRecurring,
      pausedRecurring,
      monthlyRecurringRevenue,
      nextPaymentsDue,
    });
  };

  useEffect(() => {
    fetchRecurringInvoices();
  }, []);

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'sent':
        return 'bg-green-500/20 text-green-400 border-green-500/20';
      case 'paused':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20';
      case 'cancelled':
        return 'bg-red-500/20 text-red-400 border-red-500/20';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
      case 'sent':
        return <FiPlay className="w-3 h-3" />;
      case 'paused':
        return <FiPause className="w-3 h-3" />;
      case 'cancelled':
        return <FiTrash2 className="w-3 h-3" />;
      default:
        return <FiClock className="w-3 h-3" />;
    }
  };

  const filteredInvoices = recurringInvoices.filter(invoice => {
    if (filter === 'all') return true;
    if (filter === 'active') return invoice.status === 'active' || invoice.status === 'sent';
    return invoice.status === filter;
  });

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <FiRepeat className="w-5 h-5 text-purple-400" />
            Recurring Invoices
          </h2>
          <p className="text-gray-400 text-sm">Manage your recurring billing and subscriptions</p>
        </div>
        
        {/* Filter Tabs */}
        <div className="flex bg-gray-800 rounded-lg p-1">
          {(['active', 'paused', 'cancelled', 'all'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors capitalize ${
                filter === status
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Active Recurring</p>
              <p className="text-xl font-bold text-green-400">{stats.activeRecurring}</p>
            </div>
            <div className="p-2 bg-green-500/20 rounded-lg">
              <FiPlay className="w-4 h-4 text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Monthly Revenue</p>
              <p className="text-xl font-bold text-purple-400">
                {formatAmount(stats.monthlyRecurringRevenue, 'USD')}
              </p>
            </div>
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <FiTrendingUp className="w-4 h-4 text-purple-400" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Due Next Week</p>
              <p className="text-xl font-bold text-blue-400">{stats.nextPaymentsDue}</p>
            </div>
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <FiCalendar className="w-4 h-4 text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Recurring</p>
              <p className="text-xl font-bold text-white">{stats.totalRecurring}</p>
            </div>
            <div className="p-2 bg-gray-500/20 rounded-lg">
              <FiRepeat className="w-4 h-4 text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Recurring Invoices List */}
      {filteredInvoices.length === 0 ? (
        <div className="text-center py-12">
          <FiRepeat className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No Recurring Invoices</h3>
          <p className="text-gray-400">
            {filter === 'active' 
              ? 'No active recurring invoices found.'
              : `No ${filter} recurring invoices found.`
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {filteredInvoices.map((invoice) => (
              <motion.div
                key={invoice.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-purple-500/30 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-medium text-white">{invoice.title}</h3>
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${getStatusColor(invoice.status)}`}>
                        {getStatusIcon(invoice.status)}
                        <span className="capitalize">{invoice.status}</span>
                      </div>
                    </div>
                    <p className="text-gray-400 text-sm mb-2">{invoice.invoiceNumber}</p>
                    {invoice.description && (
                      <p className="text-gray-300 text-sm">{invoice.description}</p>
                    )}
                  </div>
                  
                  <div className="text-right">
                    <p className="text-xl font-bold text-white">
                      {formatAmount(invoice.amount, invoice.currency)}
                    </p>
                    <p className="text-purple-400 text-sm capitalize">
                      {invoice.recurringInterval}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  {/* Customer Info */}
                  <div>
                    <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Customer</p>
                    <div className="flex items-center gap-2">
                      <FiUser className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-white text-sm">
                          {invoice.customer.companyName || 
                           `${invoice.customer.firstName} ${invoice.customer.lastName}`}
                        </p>
                        <p className="text-gray-400 text-xs">{invoice.customer.email}</p>
                      </div>
                    </div>
                  </div>

                  {/* Next Payment */}
                  <div>
                    <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Next Payment</p>
                    <div className="flex items-center gap-2">
                      <FiCalendar className="w-4 h-4 text-gray-400" />
                      <p className="text-white text-sm">
                        {invoice.nextPaymentDate ? formatDate(invoice.nextPaymentDate) : 'Not scheduled'}
                      </p>
                    </div>
                  </div>

                  {/* Payments Count */}
                  <div>
                    <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Payments Made</p>
                    <div className="flex items-center gap-2">
                      <FiDollarSign className="w-4 h-4 text-gray-400" />
                      <p className="text-white text-sm">
                        {invoice._count?.recurringPayments || 0} payments
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-700">
                  <div className="text-gray-400 text-xs">
                    Created {formatDate(invoice.createdAt)}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
                      title="Edit Recurring Invoice"
                    >
                      <FiEdit3 className="w-4 h-4" />
                      Edit
                    </button>
                    
                    {invoice.status === 'active' || invoice.status === 'sent' ? (
                      <button
                        className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-colors"
                        title="Pause Recurring Invoice"
                      >
                        <FiPause className="w-4 h-4" />
                        Pause
                      </button>
                    ) : invoice.status === 'paused' ? (
                      <button
                        className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
                        title="Resume Recurring Invoice"
                      >
                        <FiPlay className="w-4 h-4" />
                        Resume
                      </button>
                    ) : null}
                    
                    <button
                      className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                      title="Cancel Recurring Invoice"
                    >
                      <FiTrash2 className="w-4 h-4" />
                      Cancel
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
