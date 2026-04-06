'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  FiUser,
  FiCreditCard,
  FiTrendingUp,
  FiPlus,
  FiSettings,
  FiLoader,
  FiDollarSign,
  FiCalendar,
  FiActivity,
  FiToggleLeft,
  FiToggleRight,
  FiTrash2,
  FiBarChart,
  FiClock,
  FiTarget,
  FiEye,
  FiChevronDown,
  FiChevronUp
} from 'react-icons/fi';
import { motion } from 'framer-motion';

interface Customer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
}

interface MeteredSubscription {
  id: string;
  planId: string;
  planName: string;
  metricType: string;
  metricName: string;
  status: 'active' | 'paused' | 'cancelled';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  nextBillingDate: string;
  currentUsage: Record<string, any>;
  projectedCost?: number;
}

interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account';
  lastFour: string;
  brand?: string;
  isDefault: boolean;
  isActive: boolean;
}

interface UsageMetric {
  id: string;
  metricType: string;
  metricName: string;
  metricCategory?: string;
  quantity: number;
  unitPrice?: number;
  totalCost?: number;
  usageDate: string;
  billingStatus: string;
  sourceReference?: string;
  metadata?: Record<string, any>;
}

interface CustomerBillingData {
  customer: Customer;
  meteredSubscriptions: MeteredSubscription[];
  paymentMethods: PaymentMethod[];
  autoChargeEnabled: boolean;
  totalUnbilledAmount?: number;
  usageMetrics?: UsageMetric[];
}

interface CustomerBillingManagerProps {
  customerId: string;
  className?: string;
}

export default function CustomerBillingManager({
  customerId,
  className = ''
}: CustomerBillingManagerProps) {
  const [billingData, setBillingData] = useState<CustomerBillingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [availablePlans, setAvailablePlans] = useState<any[]>([]);
  const [showAddSubscriptionModal, setShowAddSubscriptionModal] = useState(false);
  const [showUsageDetails, setShowUsageDetails] = useState(false);
  const [usageMetrics, setUsageMetrics] = useState<UsageMetric[]>([]);
  const [loadingUsage, setLoadingUsage] = useState(false);

  // Fetch customer billing data
  const fetchBillingData = async () => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        console.error('CustomerBillingManager: No partner token found');
        setIsLoading(false);
        return;
      }

      const response = await fetch(`/api/partner/customers/${customerId}/billing`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch customer billing data');
      }

      const data = await response.json();
      if (data.success) {
        setBillingData(data.data);
      }
    } catch (error) {
      console.error('Error fetching customer billing data:', error);
      toast.error('Failed to load customer billing data');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch usage metrics
  const fetchUsageMetrics = async () => {
    try {
      setLoadingUsage(true);
      const token = localStorage.getItem('partner_token');
      if (!token) {
        console.error('CustomerBillingManager: No partner token found');
        return;
      }

      const response = await fetch(`/api/partner/customers/${customerId}/usage-metrics`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch usage metrics');
      }

      const data = await response.json();
      if (data.success) {
        setUsageMetrics(data.data.metrics || []);
      }
    } catch (error) {
      console.error('Error fetching usage metrics:', error);
      toast.error('Failed to load usage metrics');
    } finally {
      setLoadingUsage(false);
    }
  };

  // Fetch available plans
  const fetchAvailablePlans = async () => {
    try {
      console.log('CustomerBillingManager: Fetching available plans...');
      const token = localStorage.getItem('partner_token');
      if (!token) {
        console.error('CustomerBillingManager: No partner token found');
        return;
      }

      const response = await fetch('/api/partner/metered-billing/plans', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });

      console.log('CustomerBillingManager: Plans API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('CustomerBillingManager: Plans API error:', response.status, errorText);
        throw new Error('Failed to fetch available plans');
      }

      const data = await response.json();
      console.log('CustomerBillingManager: Plans API response data:', data);

      if (data.success) {
        // Fix: data.data is the array, not data.data.plans
        const activePlans = data.data.filter((plan: any) => plan.isActive);
        console.log('CustomerBillingManager: Active plans found:', activePlans.length, activePlans);
        setAvailablePlans(activePlans);
      } else {
        console.error('CustomerBillingManager: Plans API returned success: false', data);
      }
    } catch (error) {
      console.error('CustomerBillingManager: Error fetching available plans:', error);
    }
  };

  useEffect(() => {
    fetchBillingData();
    fetchAvailablePlans();
  }, [customerId]);

  // Subscribe customer to plan
  const handleSubscribeCustomer = async (planId: string) => {
    try {
      console.log('CustomerBillingManager: Subscribing customer to plan:', { customerId, planId });
      const token = localStorage.getItem('partner_token');
      if (!token) {
        console.error('CustomerBillingManager: No partner token found');
        toast.error('Authentication required');
        return;
      }

      const response = await fetch('/api/partner/metered-billing/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          customerId,
          planId,
        }),
      });

      console.log('CustomerBillingManager: Subscription API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('CustomerBillingManager: Subscription API error:', response.status, errorText);
        throw new Error('Failed to subscribe customer to plan');
      }

      toast.success('Customer subscribed to plan successfully');
      setShowAddSubscriptionModal(false);
      await fetchBillingData();
    } catch (error: any) {
      console.error('Error subscribing customer:', error);
      toast.error(error.message || 'Failed to subscribe customer to plan');
    }
  };

  // Toggle subscription status
  const handleToggleSubscription = async (subscriptionId: string, newStatus: string) => {
    try {
      const action = newStatus === 'active' ? 'resume' : 'pause';

      const response = await fetch(`/api/partner/metered-billing/subscriptions/${subscriptionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          action: action,
          reason: action === 'pause' ? 'Paused by partner' : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update subscription status');
      }

      toast.success(`Subscription ${newStatus === 'active' ? 'resumed' : 'paused'} successfully`);
      await fetchBillingData();
    } catch (error: any) {
      console.error('Error updating subscription:', error);
      toast.error(error.message || 'Failed to update subscription');
    }
  };

  // Cancel subscription
  const handleCancelSubscription = async (subscriptionId: string, subscriptionName: string) => {
    if (!confirm(`Are you sure you want to cancel the subscription "${subscriptionName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/partner/metered-billing/subscriptions/${subscriptionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'cancel',
          immediate: true,
          reason: 'Cancelled by partner',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel subscription');
      }

      toast.success('Subscription cancelled successfully');
      await fetchBillingData();
    } catch (error: any) {
      console.error('Error cancelling subscription:', error);
      toast.error(error.message || 'Failed to cancel subscription');
    }
  };

  // Format currency
  const formatCurrency = (amount: number | undefined | null) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount || 0);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className={`${className}`}>
        <div className="flex items-center justify-center py-12">
          <FiLoader className="w-8 h-8 animate-spin text-gray-400" />
          <span className="ml-3 text-gray-400">Loading customer billing data...</span>
        </div>
      </div>
    );
  }

  if (!billingData) {
    return (
      <div className={`${className}`}>
        <div className="text-center py-12">
          <FiUser className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Customer Not Found</h3>
          <p className="text-gray-400">Unable to load billing data for this customer.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Customer Header */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
              <FiUser className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">
                {billingData.customer.firstName} {billingData.customer.lastName}
              </h2>
              <p className="text-gray-400">{billingData.customer.email}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">Customer since</p>
            <p className="text-white">{formatDate(billingData.customer.createdAt)}</p>
          </div>
        </div>
      </div>

      {/* Billing Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Active Subscriptions</p>
              <p className="text-2xl font-bold text-white">
                {billingData.meteredSubscriptions.filter(s => s.status === 'active').length}
              </p>
            </div>
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <FiTrendingUp className="w-6 h-6 text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Payment Methods</p>
              <p className="text-2xl font-bold text-white">
                {billingData.paymentMethods.filter(pm => pm.isActive).length}
              </p>
            </div>
            <div className="p-3 bg-green-500/20 rounded-lg">
              <FiCreditCard className="w-6 h-6 text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Unbilled Amount</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(billingData.totalUnbilledAmount)}
              </p>
            </div>
            <div className="p-3 bg-orange-500/20 rounded-lg">
              <FiDollarSign className="w-6 h-6 text-orange-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Metered Subscriptions */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Metered Billing Subscriptions</h3>
          <button
            onClick={() => setShowAddSubscriptionModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <FiPlus className="w-4 h-4" />
            Add Subscription
          </button>
        </div>

        {billingData.meteredSubscriptions.length === 0 ? (
          <div className="text-center py-8">
            <FiTrendingUp className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-white mb-2">No Metered Subscriptions</h4>
            <p className="text-gray-400 mb-4">
              This customer is not subscribed to any metered billing plans.
            </p>
            <button
              onClick={() => setShowAddSubscriptionModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <FiPlus className="w-4 h-4" />
              Add First Subscription
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {billingData.meteredSubscriptions.map((subscription) => (
              <motion.div
                key={subscription.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-700/50 border border-gray-600 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-white">{subscription.planName}</h4>
                    <p className="text-sm text-gray-400">
                      {subscription.metricName} • {subscription.metricType}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      subscription.status === 'active' 
                        ? 'bg-green-500/20 text-green-400'
                        : subscription.status === 'paused'
                        ? 'bg-yellow-500/20 text-amber-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {subscription.status}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleSubscription(
                          subscription.id,
                          subscription.status === 'active' ? 'paused' : 'active'
                        )}
                        className="p-1 text-gray-400 hover:text-white transition-colors"
                        title={subscription.status === 'active' ? 'Pause subscription' : 'Resume subscription'}
                      >
                        {subscription.status === 'active' ? (
                          <FiToggleRight className="w-5 h-5 text-green-400" />
                        ) : (
                          <FiToggleLeft className="w-5 h-5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleCancelSubscription(subscription.id, subscription.planName)}
                        className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                        title="Cancel subscription"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">Current Period</p>
                    <p className="text-white">
                      {formatDate(subscription.currentPeriodStart)} - {formatDate(subscription.currentPeriodEnd)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Next Billing</p>
                    <p className="text-white">{formatDate(subscription.nextBillingDate)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Projected Cost</p>
                    <p className="text-white font-medium">
                      ${(subscription.projectedCost || 0).toFixed(2)}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Usage Details */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Usage Details</h3>
          <button
            onClick={() => {
              setShowUsageDetails(!showUsageDetails);
              if (!showUsageDetails && usageMetrics.length === 0) {
                fetchUsageMetrics();
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <FiBarChart className="w-4 h-4" />
            {showUsageDetails ? 'Hide Details' : 'View Usage Metrics'}
            {showUsageDetails ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {showUsageDetails && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4"
          >
            {loadingUsage ? (
              <div className="flex items-center justify-center py-8">
                <FiLoader className="w-6 h-6 animate-spin text-blue-400" />
                <span className="ml-2 text-gray-400">Loading usage metrics...</span>
              </div>
            ) : usageMetrics.length === 0 ? (
              <div className="text-center py-8">
                <FiBarChart className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-white mb-2">No Usage Metrics</h4>
                <p className="text-gray-400">
                  No usage data has been recorded for this customer yet.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Usage Summary */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gray-700/30 rounded-lg p-4">
                    <div className="text-sm text-gray-400">Total Events</div>
                    <div className="text-2xl font-bold text-white">{usageMetrics.length}</div>
                  </div>
                  <div className="bg-gray-700/30 rounded-lg p-4">
                    <div className="text-sm text-gray-400">Unique Metrics</div>
                    <div className="text-2xl font-bold text-white">
                      {new Set(usageMetrics.map(m => m.metricName)).size}
                    </div>
                  </div>
                  <div className="bg-gray-700/30 rounded-lg p-4">
                    <div className="text-sm text-gray-400">Total Quantity</div>
                    <div className="text-2xl font-bold text-white">
                      {usageMetrics.reduce((sum, m) => sum + m.quantity, 0)}
                    </div>
                  </div>
                  <div className="bg-gray-700/30 rounded-lg p-4">
                    <div className="text-sm text-gray-400">Total Cost</div>
                    <div className="text-2xl font-bold text-green-400">
                      ${usageMetrics.reduce((sum, m) => sum + (m.totalCost || 0), 0).toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Usage Events Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-3 px-4 text-gray-400">Date</th>
                        <th className="text-left py-3 px-4 text-gray-400">Metric</th>
                        <th className="text-left py-3 px-4 text-gray-400">Type</th>
                        <th className="text-right py-3 px-4 text-gray-400">Quantity</th>
                        <th className="text-right py-3 px-4 text-gray-400">Unit Price</th>
                        <th className="text-right py-3 px-4 text-gray-400">Total Cost</th>
                        <th className="text-center py-3 px-4 text-gray-400">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usageMetrics.map((metric) => (
                        <tr key={metric.id} className="border-b border-gray-800 hover:bg-gray-700/20">
                          <td className="py-3 px-4 text-white">
                            {formatDate(metric.usageDate)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-white font-medium">{metric.metricName}</div>
                            {metric.metricCategory && (
                              <div className="text-xs text-gray-400">{metric.metricCategory}</div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-300">{metric.metricType}</td>
                          <td className="py-3 px-4 text-right text-white font-medium">
                            {metric.quantity}
                          </td>
                          <td className="py-3 px-4 text-right text-gray-300">
                            {metric.unitPrice ? `$${metric.unitPrice.toFixed(4)}` : '-'}
                          </td>
                          <td className="py-3 px-4 text-right text-white font-medium">
                            {metric.totalCost ? `$${metric.totalCost.toFixed(2)}` : '$0.00'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              metric.billingStatus === 'billed'
                                ? 'bg-green-500/20 text-green-400'
                                : metric.billingStatus === 'reported'
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-yellow-500/20 text-amber-400'
                            }`}>
                              {metric.billingStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Metrics by Type */}
                <div className="mt-6">
                  <h4 className="text-white font-medium mb-4">Usage by Metric Type</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(
                      usageMetrics.reduce((acc, metric) => {
                        if (!acc[metric.metricName]) {
                          acc[metric.metricName] = {
                            count: 0,
                            totalQuantity: 0,
                            totalCost: 0,
                            type: metric.metricType
                          };
                        }
                        acc[metric.metricName].count++;
                        acc[metric.metricName].totalQuantity += metric.quantity;
                        acc[metric.metricName].totalCost += metric.totalCost || 0;
                        return acc;
                      }, {} as Record<string, any>)
                    ).map(([metricName, data]) => (
                      <div key={metricName} className="bg-gray-700/30 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <FiTarget className="w-4 h-4 text-blue-400" />
                          <div className="font-medium text-white">{metricName}</div>
                        </div>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Events:</span>
                            <span className="text-white">{data.count}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Total:</span>
                            <span className="text-white">{data.totalQuantity}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Cost:</span>
                            <span className="text-green-400">${data.totalCost.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Payment Methods */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Payment Methods</h3>
        
        {billingData.paymentMethods.length === 0 ? (
          <div className="text-center py-6">
            <FiCreditCard className="w-10 h-10 text-gray-500 mx-auto mb-3" />
            <p className="text-gray-400">No payment methods on file</p>
            <p className="text-sm text-gray-500 mt-1">
              Customer needs to add a payment method for auto-charge
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {billingData.paymentMethods.map((paymentMethod) => (
              <div
                key={paymentMethod.id}
                className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-600 rounded-lg">
                    <FiCreditCard className="w-4 h-4 text-gray-300" />
                  </div>
                  <div>
                    <p className="text-white">
                      {paymentMethod.brand ? 
                        `${paymentMethod.brand.charAt(0).toUpperCase() + paymentMethod.brand.slice(1)} •••• ${paymentMethod.lastFour}` :
                        `•••• ${paymentMethod.lastFour}`
                      }
                    </p>
                    <p className="text-xs text-gray-400">
                      {paymentMethod.type === 'card' ? 'Credit Card' : 'Bank Account'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {paymentMethod.isDefault && (
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                      Default
                    </span>
                  )}
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    paymentMethod.isActive 
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {paymentMethod.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Subscription Modal */}
      {showAddSubscriptionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-white mb-4">Add Metered Subscription</h3>
            <p className="text-gray-400 mb-4">
              Select a metered billing plan to subscribe this customer to:
            </p>
            
            <div className="space-y-2 mb-6 max-h-60 overflow-y-auto">
              {(() => {
                // Filter out plans that customer is already actively subscribed to (exclude cancelled)
                const activeSubscribedPlanIds = billingData?.meteredSubscriptions
                  ?.filter(sub => sub.status === 'active' || sub.status === 'paused')
                  ?.map(sub => sub.planId) || [];
                const unsubscribedPlans = availablePlans.filter(plan => !activeSubscribedPlanIds.includes(plan.id));

                if (unsubscribedPlans.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <FiActivity className="w-8 h-8 text-gray-500 mx-auto mb-3" />
                      <p className="text-gray-400 text-sm">
                        {availablePlans.length === 0
                          ? 'No billing plans available'
                          : 'Customer is already subscribed to all available plans'
                        }
                      </p>
                    </div>
                  );
                }

                return unsubscribedPlans.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => handleSubscribeCustomer(plan.id)}
                    className="w-full text-left p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    <div className="font-medium text-white">{plan.name}</div>
                    <div className="text-sm text-gray-400">
                      {plan.metricName} • {plan.pricingModel} pricing
                    </div>
                  </button>
                ));
              })()}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowAddSubscriptionModal(false)}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
