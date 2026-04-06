'use client';

import React, { useState, useEffect } from 'react';
import { 
  FiDollarSign, 
  FiPlus, 
  FiMinus, 
  FiSettings, 
  FiClock,
  FiRefreshCw,
  FiAlertCircle,
  FiCheck
} from 'react-icons/fi';
import { useToast } from '@/hooks/use-toast';

interface CustomerCreditInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  creditBalance: number;
  monthlyCreditAllocation: number;
  lastCreditAllocationDate: string | null;
  lowCreditThreshold: number | null;
  lowCreditNotificationsEnabled: boolean;
  totalCreditsAllocated: number;
  totalCreditsUsed: number;
  creditRolloverEnabled: boolean;
}

interface CreditTransaction {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string;
  createdBy: string;
  createdAt: string;
  metadata: any;
}

interface CustomerCreditManagementProps {
  customerId: string;
  customerName: string;
  onClose?: () => void;
}

export default function CustomerCreditManagement({ 
  customerId, 
  customerName,
  onClose 
}: CustomerCreditManagementProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [customerInfo, setCustomerInfo] = useState<CustomerCreditInfo | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [showCreditModal, setShowCreditModal] = useState(false);
  
  // Credit operation form state
  const [creditOperation, setCreditOperation] = useState<'add' | 'deduct' | 'set_monthly'>('add');
  const [creditAmount, setCreditAmount] = useState<number>(0);
  const [monthlyAllocation, setMonthlyAllocation] = useState<number>(0);
  const [creditReason, setCreditReason] = useState('');
  const [grantType, setGrantType] = useState<'one_time' | 'monthly_recurring'>('one_time');
  const [recurringMonths, setRecurringMonths] = useState<number>(12);
  const [rolloverEnabled, setRolloverEnabled] = useState(false);
  const [operationLoading, setOperationLoading] = useState(false);

  useEffect(() => {
    fetchCustomerCreditInfo();
  }, [customerId]);

  const fetchCustomerCreditInfo = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/partner/customers/${customerId}/credits/operations`);
      const data = await response.json();

      if (data.success) {
        setCustomerInfo(data.data.customer);
        setTransactions(data.data.recentTransactions);
        setMonthlyAllocation(data.data.customer.monthlyCreditAllocation);
        setRolloverEnabled(data.data.customer.creditRolloverEnabled);
      } else {
        // Handle specific error codes with appropriate messages
        let title = "Error";
        let description = data.error || 'Failed to fetch customer credit info';

        if (data.code === 'PORTAL_NOT_ENABLED') {
          title = "Customer Portal Not Enabled";
          description = "This customer hasn't been granted portal access yet. Please enable portal access first before managing credits.";
        } else if (data.code === 'CUSTOMER_NOT_PROVISIONED') {
          title = "Customer Not Provisioned";
          description = "This customer is still in onboarding status. Please enable portal access to activate their account before assigning credits.";
        } else if (data.code === 'CUSTOMER_NOT_FOUND') {
          title = "Customer Not Found";
          description = "This customer doesn't exist or doesn't belong to your account.";
        }

        toast({
          title,
          description,
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Network Error",
        description: 'Failed to fetch customer credit info',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreditOperation = async () => {
    if (!creditReason.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide a reason for this operation",
        variant: "destructive"
      });
      return;
    }

    if ((creditOperation === 'add' || creditOperation === 'deduct') && creditAmount <= 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid amount",
        variant: "destructive"
      });
      return;
    }

    if (creditOperation === 'set_monthly' && monthlyAllocation < 0) {
      toast({
        title: "Validation Error",
        description: "Monthly allocation cannot be negative",
        variant: "destructive"
      });
      return;
    }

    try {
      setOperationLoading(true);

      const requestBody: any = {
        operation: creditOperation,
        reason: creditReason
      };

      if (creditOperation === 'add') {
        requestBody.amount = creditAmount;
        requestBody.grantType = grantType;
        if (grantType === 'monthly_recurring') {
          requestBody.recurringMonths = recurringMonths;
        }
      } else if (creditOperation === 'deduct') {
        requestBody.amount = creditAmount;
      } else if (creditOperation === 'set_monthly') {
        requestBody.monthlyAllocation = monthlyAllocation;
        requestBody.rolloverEnabled = rolloverEnabled;
      }

      const response = await fetch(`/api/partner/customers/${customerId}/credits/operations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Success",
          description: data.message || 'Operation completed successfully'
        });
        
        setShowCreditModal(false);
        resetModalState();
        fetchCustomerCreditInfo();
      } else {
        // Handle specific error codes with appropriate messages
        let title = "Operation Failed";
        let description = data.error || 'An error occurred';

        if (data.code === 'PORTAL_NOT_ENABLED') {
          title = "Customer Portal Not Enabled";
          description = "This customer hasn't been granted portal access yet. Please enable portal access first before managing credits.";
        } else if (data.code === 'CUSTOMER_NOT_PROVISIONED') {
          title = "Customer Not Provisioned";
          description = "This customer is still in onboarding status. Please enable portal access to activate their account before assigning credits.";
        } else if (data.code === 'CUSTOMER_NOT_FOUND') {
          title = "Customer Not Found";
          description = "This customer doesn't exist or doesn't belong to your account.";
        } else if (data.code === 'INSUFFICIENT_CREDITS') {
          title = "Insufficient Credits";
          description = "The customer doesn't have enough credits for this deduction.";
        }

        toast({
          title,
          description,
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Network Error",
        description: 'Failed to perform operation. Please try again.',
        variant: "destructive"
      });
    } finally {
      setOperationLoading(false);
    }
  };

  const resetModalState = () => {
    setCreditOperation('add');
    setCreditAmount(0);
    setCreditReason('');
    setGrantType('one_time');
    setRecurringMonths(12);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US').format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading credit information...</span>
        </div>
      </div>
    );
  }

  if (!customerInfo) {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <FiAlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <p className="text-gray-600">Failed to load customer credit information</p>
          <button
            onClick={fetchCustomerCreditInfo}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-2xl font-bold text-gray-900 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Credit Management
          </h3>
          <p className="text-gray-600 mt-1">
            Manage AI credits for <span className="font-semibold">{customerName}</span>
          </p>
        </div>
        <button
          onClick={() => setShowCreditModal(true)}
          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 flex items-center gap-2 font-medium shadow-lg hover:shadow-xl transition-all duration-200"
        >
          <FiSettings className="w-5 h-5" />
          Manage Credits
        </button>
      </div>

      {/* Credit Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl border border-blue-200 shadow-sm hover:shadow-lg transition-all duration-200 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-blue-200/30 rounded-full -mr-10 -mt-10"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-600 rounded-xl">
                <FiDollarSign className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm font-semibold text-blue-900">Current Balance</span>
            </div>
            <p className="text-3xl font-bold text-blue-900">
              {formatCurrency(customerInfo.creditBalance)}
            </p>
            <p className="text-xs text-blue-700 mt-1">AI Credits Available</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-2xl border border-green-200 shadow-sm hover:shadow-lg transition-all duration-200 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-green-200/30 rounded-full -mr-10 -mt-10"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-green-600 rounded-xl">
                <FiRefreshCw className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm font-semibold text-green-900">Monthly Allocation</span>
            </div>
            <p className="text-3xl font-bold text-green-900">
              {formatCurrency(customerInfo.monthlyCreditAllocation)}
            </p>
            <p className="text-xs text-green-700 mt-1">
              Rollover: {customerInfo.creditRolloverEnabled ? '✅ Enabled' : '❌ Disabled'}
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-2xl border border-purple-200 shadow-sm hover:shadow-lg transition-all duration-200 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-red-200/30 rounded-full -mr-10 -mt-10"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-red-600 rounded-xl">
                <FiClock className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm font-semibold text-blue-900">Total Used</span>
            </div>
            <p className="text-3xl font-bold text-purple-900">
              {formatCurrency(customerInfo.totalCreditsUsed)}
            </p>
            <p className="text-xs text-purple-700 mt-1">All Time Usage</p>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h4 className="text-lg font-semibold text-gray-900">Recent Transactions</h4>
        </div>
        <div className="divide-y divide-gray-200">
          {transactions.length > 0 ? (
            transactions.slice(0, 5).map((transaction) => (
              <div key={transaction.id} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    transaction.amount > 0 ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {transaction.description}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(transaction.createdAt)} • by {transaction.createdBy}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-medium ${
                    transaction.amount > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {transaction.amount > 0 ? '+' : ''}{formatCurrency(transaction.amount)}
                  </p>
                  <p className="text-xs text-gray-500">
                    Balance: {formatCurrency(transaction.balanceAfter)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-8 text-center text-gray-500">
              No transactions found
            </div>
          )}
        </div>
      </div>

      {/* Credit Operation Modal */}
      {showCreditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl p-8 w-full max-w-lg mx-4 shadow-2xl border border-gray-700 relative overflow-hidden">
            {/* Glowing background effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-transparent to-purple-900/20 pointer-events-none"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Manage Customer Credits
                </h3>
                <button
                  onClick={() => setShowCreditModal(false)}
                  className="p-2 hover:bg-gray-800 rounded-full transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-400 hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            
              {/* Operation Type */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-200 mb-3">
                  Operation Type
                </label>
                <select
                  value={creditOperation}
                  onChange={(e) => setCreditOperation(e.target.value as any)}
                  className="w-full px-4 py-3 border-2 border-gray-600 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-gray-800 text-white shadow-sm hover:shadow-md"
                >
                  <option value="add">💰 Add Credits</option>
                  <option value="deduct">➖ Deduct Credits</option>
                  <option value="set_monthly">🔄 Set Monthly Allocation</option>
                </select>
              </div>

              {/* Amount Input */}
              {(creditOperation === 'add' || creditOperation === 'deduct') && (
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-200 mb-3">
                    Amount
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <FiDollarSign className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="number"
                      value={creditAmount}
                      onChange={(e) => setCreditAmount(Number(e.target.value))}
                      className="w-full pl-12 pr-4 py-3 border-2 border-gray-600 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-gray-800 text-white placeholder-gray-400 shadow-sm hover:shadow-md"
                      placeholder="Enter amount"
                      min="1"
                    />
                  </div>
                </div>
              )}

              {/* Monthly Allocation */}
              {creditOperation === 'set_monthly' && (
                <>
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-200 mb-3">
                      Monthly Allocation
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <FiDollarSign className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="number"
                        value={monthlyAllocation}
                        onChange={(e) => setMonthlyAllocation(Number(e.target.value))}
                        className="w-full pl-12 pr-4 py-3 border-2 border-gray-600 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-gray-800 text-white placeholder-gray-400 shadow-sm hover:shadow-md"
                        placeholder="Enter monthly allocation"
                        min="0"
                      />
                    </div>
                  </div>
                  <div className="mb-6">
                    <label className="flex items-start gap-3 p-4 bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-xl border border-blue-700/50 cursor-pointer hover:shadow-md transition-all duration-200">
                      <input
                        type="checkbox"
                        checked={rolloverEnabled}
                        onChange={(e) => setRolloverEnabled(e.target.checked)}
                        className="mt-1 rounded border-gray-600 text-blue-500 focus:ring-blue-500 focus:ring-2 bg-gray-800"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-200 block">
                          Enable Credit Rollover
                        </span>
                        <span className="text-xs text-gray-400">
                          Unused credits will carry over to the next month
                        </span>
                      </div>
                    </label>
                  </div>
                </>
              )}

              {/* Grant Type for Add Credits */}
              {creditOperation === 'add' && (
                <>
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-200 mb-3">
                      Grant Type
                    </label>
                    <select
                      value={grantType}
                      onChange={(e) => setGrantType(e.target.value as any)}
                      className="w-full px-4 py-3 border-2 border-gray-600 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-gray-800 text-white shadow-sm hover:shadow-md"
                    >
                      <option value="one_time">🎯 One Time Grant</option>
                      <option value="monthly_recurring">🔄 Monthly Recurring</option>
                    </select>
                  </div>

                  {grantType === 'monthly_recurring' && (
                    <div className="mb-6">
                      <label className="block text-sm font-semibold text-gray-200 mb-3">
                        Duration (Months)
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <FiClock className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="number"
                          value={recurringMonths}
                          onChange={(e) => setRecurringMonths(Number(e.target.value))}
                          className="w-full pl-12 pr-4 py-3 border-2 border-gray-600 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-gray-800 text-white placeholder-gray-400 shadow-sm hover:shadow-md"
                          placeholder="Enter duration in months"
                          min="1"
                          max="60"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Reason */}
              <div className="mb-8">
                <label className="block text-sm font-semibold text-gray-200 mb-3">
                  Reason <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-600 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-gray-800 text-white placeholder-gray-400 shadow-sm hover:shadow-md resize-none"
                  placeholder="Enter reason for this operation..."
                  rows={3}
                  required
                />
              </div>

              {/* Actions */}
              <div className="flex gap-4">
                <button
                  onClick={() => setShowCreditModal(false)}
                  className="flex-1 px-6 py-3 border-2 border-gray-600 text-gray-300 rounded-xl hover:bg-gray-800 hover:border-gray-500 hover:text-white transition-all duration-200 font-medium"
                  disabled={operationLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreditOperation}
                  disabled={operationLoading}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  {operationLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <FiCheck className="w-5 h-5" />
                      Confirm Operation
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
