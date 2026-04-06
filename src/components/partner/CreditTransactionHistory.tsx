'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FiClock,
  FiTrendingUp,
  FiTrendingDown,
  FiRefreshCw,
  FiFilter,
  FiChevronLeft,
  FiChevronRight,
  FiDollarSign,
  FiSettings,
  FiActivity,
  FiPhone,
  FiCpu,
  FiUser
} from 'react-icons/fi';
import { CreditTransaction, CreditTransactionType, formatCredits, getTransactionAmount, getTransactionBalance } from '@/lib/types/credits';

interface TelephonyCreditTransaction {
  id: string;
  partnerId: string;
  customerId: string | null;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string | null;
  referenceId: string | null;
  metadata: Record<string, any>;
  createdAt: string | Date;
}

interface UnifiedTransaction {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string | null;
  referenceId: string | null;
  metadata: Record<string, any>;
  createdAt: string | Date;
  creditType: 'knotie' | 'telephony';
  customerId?: string | null;
}

interface CreditTransactionHistoryProps {
  className?: string;
}

export default function CreditTransactionHistory({ className = '' }: CreditTransactionHistoryProps) {
  const [transactions, setTransactions] = useState<UnifiedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedCreditType, setSelectedCreditType] = useState<'all' | 'knotie' | 'telephony'>('all');

  useEffect(() => {
    fetchTransactions();
  }, [currentPage, selectedType, selectedCreditType]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('partner_token');
      if (!token) {
        setError('Authentication required');
        return;
      }

      // When filtering by specific credit type, use that API's pagination directly
      if (selectedCreditType === 'knotie') {
        const knotieParams = new URLSearchParams({
          page: currentPage.toString(),
          limit: '20'
        });
        if (selectedType !== 'all') {
          knotieParams.append('type', selectedType);
        }
        
        const response = await fetch(`/api/partner/credits/transactions?${knotieParams}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const knotieData = await response.json();
        
        const knotieTransactions: UnifiedTransaction[] = (knotieData.success && knotieData.data?.transactions || []).map((tx: CreditTransaction) => ({
          ...tx,
          creditType: 'knotie' as const,
          amount: getTransactionAmount(tx),
          balanceAfter: getTransactionBalance(tx)
        }));
        
        setTransactions(knotieTransactions);
        setTotalPages(knotieData.data?.pagination?.totalPages || 1);
      } else if (selectedCreditType === 'telephony') {
        const telephonyParams = new URLSearchParams({
          page: currentPage.toString(),
          limit: '20'
        });
        
        const response = await fetch(`/api/partner/telephony-credits/transactions?${telephonyParams}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const telephonyData = await response.json();
        
        const telephonyTransactions: UnifiedTransaction[] = (telephonyData.success && telephonyData.transactions || []).map((tx: TelephonyCreditTransaction) => ({
          ...tx,
          creditType: 'telephony' as const
        }));
        
        setTransactions(telephonyTransactions);
        setTotalPages(telephonyData.pagination?.totalPages || 1);
      } else {
        // For 'all' credit types, fetch both and merge (limited to current page only)
        const promises = [
          fetch(`/api/partner/credits/transactions?page=${currentPage}&limit=10`, {
            headers: { Authorization: `Bearer ${token}` }
          }).then(res => res.json()),
          fetch(`/api/partner/telephony-credits/transactions?page=${currentPage}&limit=10`, {
            headers: { Authorization: `Bearer ${token}` }
          }).then(res => res.json())
        ];
        
        const [knotieData, telephonyData] = await Promise.all(promises);
        
        const knotieTransactions: UnifiedTransaction[] = (knotieData.success && knotieData.data?.transactions || []).map((tx: CreditTransaction) => ({
          ...tx,
          creditType: 'knotie' as const,
          amount: getTransactionAmount(tx),
          balanceAfter: getTransactionBalance(tx)
        }));
        
        const telephonyTransactions: UnifiedTransaction[] = (telephonyData.success && telephonyData.transactions || []).map((tx: TelephonyCreditTransaction) => ({
          ...tx,
          creditType: 'telephony' as const
        }));
        
        // Merge and sort by date, keep top 20
        const allTransactions = [...knotieTransactions, ...telephonyTransactions]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 20);
        
        setTransactions(allTransactions);
        
        // For combined view, calculate approximate total pages
        const maxPages = Math.max(
          knotieData.data?.pagination?.totalPages || 0,
          telephonyData.pagination?.totalPages || 0
        );
        setTotalPages(maxPages);
      }

      setError(null);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setError('Failed to load transaction history');
    } finally {
      setLoading(false);
    }
  };

  const getTransactionIcon = (type: string, creditType: 'knotie' | 'telephony') => {
    // Telephony-specific types
    if (creditType === 'telephony') {
      if (type.includes('call')) {
        return <FiPhone className="w-4 h-4 text-green-500" />;
      }
      if (type === 'phone_number_purchase' || type === 'phone_number_monthly') {
        return <FiPhone className="w-4 h-4 text-blue-500" />;
      }
    }

    // Common types
    switch (type) {
      case 'purchase':
        return <FiDollarSign className="w-4 h-4 text-green-500" />;
      case 'allocation':
        return <FiTrendingUp className="w-4 h-4 text-blue-500" />;
      case 'usage':
        return <FiActivity className="w-4 h-4 text-orange-500" />;
      case 'refund':
        return <FiRefreshCw className="w-4 h-4 text-amber-500" />;
      case 'adjustment':
        return <FiSettings className="w-4 h-4 text-purple-500" />;
      default:
        return <FiClock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTransactionColor = (type: string) => {
    if (type.includes('call')) {
      return 'text-green-400';
    }

    switch (type) {
      case 'purchase':
        return 'text-green-400';
      case 'allocation':
        return 'text-blue-400';
      case 'usage':
        return 'text-orange-400';
      case 'refund':
        return 'text-amber-400';
      case 'adjustment':
        return 'text-purple-400';
      case 'phone_number_purchase':
      case 'phone_number_monthly':
        return 'text-blue-400';
      default:
        return 'text-gray-400';
    }
  };

  const formatTransactionType = (type: string) => {
    // Handle telephony-specific types
    const typeMap: Record<string, string> = {
      'inbound_call': 'Inbound Call',
      'outbound_call': 'Outbound Call',
      'inbound_sms': 'Inbound SMS',
      'outbound_sms': 'Outbound SMS',
      'phone_number_purchase': 'Phone Number Purchase',
      'phone_number_monthly': 'Phone Number Monthly',
      'auto_topup': 'Auto Top-up'
    };

    return typeMap[type] || type.charAt(0).toUpperCase() + type.slice(1);
  };

  const formatAmount = (amount: number, creditType: 'knotie' | 'telephony') => {
    if (creditType === 'telephony') {
      // Telephony credits are in cents
      return `$${Math.abs(amount / 100).toFixed(2)}`;
    } else {
      // Knotie credits
      return formatCredits(amount);
    }
  };

  const formatBalance = (balance: number, creditType: 'knotie' | 'telephony') => {
    if (creditType === 'telephony') {
      return `$${(balance / 100).toFixed(2)}`;
    } else {
      return formatCredits(balance);
    }
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && transactions.length === 0) {
    return (
      <div className={`bg-gray-800/50 border border-gray-700 rounded-lg p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-3 text-gray-400">
            <FiRefreshCw className="w-5 h-5 animate-spin" />
            <span>Loading transaction history...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-800/50 border border-gray-700 rounded-lg ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FiClock className="w-6 h-6 text-blue-500" />
            <h2 className="text-xl font-semibold text-white">Transaction History</h2>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <FiFilter className="w-4 h-4 text-gray-400" />

              {/* Credit Type Filter */}
              <select
                value={selectedCreditType}
                onChange={(e) => {
                  setSelectedCreditType(e.target.value as 'all' | 'knotie' | 'telephony');
                  setCurrentPage(1);
                }}
                className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-1 text-white text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="all">All Credits</option>
                <option value="knotie">Knotie Credits</option>
                <option value="telephony">Telephony Credits</option>
              </select>

              {/* Transaction Type Filter */}
              <select
                value={selectedType}
                onChange={(e) => {
                  setSelectedType(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-1 text-white text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="all">All Types</option>
                <option value="purchase">Purchases</option>
                <option value="allocation">Allocations</option>
                <option value="usage">Usage</option>
                <option value="refund">Refunds</option>
                <option value="adjustment">Adjustments</option>
              </select>
            </div>

            <button
              onClick={fetchTransactions}
              disabled={loading}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <FiRefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {error ? (
          <div className="text-center py-8">
            <div className="text-red-400 mb-4">{error}</div>
            <button
              onClick={fetchTransactions}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-8">
            <FiClock className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-400 mb-2">No Transactions Found</h3>
            <p className="text-gray-500">
              {selectedType === 'all' 
                ? 'No credit transactions have been recorded yet.'
                : `No ${selectedType} transactions found.`
              }
            </p>
          </div>
        ) : (
          <>
            {/* Transaction List */}
            <div className="space-y-3">
              {transactions.map((transaction, index) => {
                const isCustomerRelated = !!transaction.customerId;
                const borderColor = isCustomerRelated
                  ? 'border-purple-500/30 bg-purple-500/5'
                  : 'border-gray-600';

                return (
                  <motion.div
                    key={transaction.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`bg-gray-700/50 border rounded-lg p-4 hover:border-gray-500 transition-colors ${borderColor}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="p-2 bg-gray-800 rounded-lg">
                          {getTransactionIcon(transaction.type, transaction.creditType)}
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-white">
                              {formatTransactionType(transaction.type)}
                            </span>

                            {/* Credit Type Badge */}
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              transaction.creditType === 'knotie'
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                : 'bg-green-500/20 text-green-400 border border-green-500/30'
                            }`}>
                              {transaction.creditType === 'knotie' ? (
                                <span className="flex items-center gap-1">
                                  <FiCpu className="w-3 h-3" />
                                  Knotie
                                </span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <FiPhone className="w-3 h-3" />
                                  Telephony
                                </span>
                              )}
                            </span>

                            {/* Customer Badge */}
                            {isCustomerRelated && (
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30">
                                <span className="flex items-center gap-1">
                                  <FiUser className="w-3 h-3" />
                                  Customer Transaction
                                </span>
                              </span>
                            )}

                            {transaction.description && (
                              <span className="text-gray-400 text-sm">
                                • {transaction.description}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            {formatDate(transaction.createdAt)}
                          </div>
                        </div>
                      </div>

                      <div className="text-right ml-4">
                        <div className={`font-semibold ${getTransactionColor(transaction.type)}`}>
                          {transaction.amount > 0 ? '+' : ''}{formatAmount(transaction.amount, transaction.creditType)}
                        </div>
                        <div className="text-sm text-gray-500">
                          Balance: {formatBalance(transaction.balanceAfter, transaction.creditType)}
                        </div>
                      </div>
                    </div>

                    {/* Additional Info */}
                    {(transaction.referenceId || (transaction.metadata && Object.keys(transaction.metadata).length > 0)) && (
                      <div className="mt-3 pt-3 border-t border-gray-600">
                        <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                          {transaction.referenceId && (
                            <span>Ref: {transaction.referenceId.substring(0, 20)}...</span>
                          )}
                          {transaction.metadata && Object.keys(transaction.metadata).length > 0 && (
                            <span>
                              {Object.entries(transaction.metadata).slice(0, 2).map(([key, value]) => (
                                <span key={key} className="mr-2">
                                  {key}: {String(value).substring(0, 20)}
                                </span>
                              ))}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-700">
                <div className="text-sm text-gray-400">
                  Page {currentPage} of {totalPages}
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-2 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FiChevronLeft className="w-4 h-4 text-gray-400" />
                  </button>
                  
                  <span className="px-3 py-1 bg-gray-700 rounded-lg text-sm text-white">
                    {currentPage}
                  </span>
                  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FiChevronRight className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
