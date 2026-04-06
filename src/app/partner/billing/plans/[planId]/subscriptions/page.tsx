'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  FiArrowLeft,
  FiUsers,
  FiDollarSign,
  FiCalendar,
  FiActivity,
  FiLoader,
  FiPlus,
  FiSettings,
  FiPause,
  FiPlay,
  FiX
} from 'react-icons/fi';
import { motion } from 'framer-motion';

interface PlanSubscription {
  id: string;
  customerId: string;
  status: 'active' | 'paused' | 'cancelled';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  nextBillingDate: string;
  currentUsage: Record<string, number>;
  projectedCost: number;
  customer: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  createdAt: string;
}

interface PlanDetails {
  id: string;
  name: string;
  description?: string;
  metricName: string;
  billingCycle: string;
  pricingModel: string;
  isActive: boolean;
  stripeProductId?: string;
}

export default function PlanSubscriptionsPage() {
  const params = useParams();
  const router = useRouter();
  const planId = params?.planId as string;

  const [plan, setPlan] = useState<PlanDetails | null>(null);
  const [subscriptions, setSubscriptions] = useState<PlanSubscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [availableCustomers, setAvailableCustomers] = useState<any[]>([]);

  // Fetch plan details and subscriptions
  const fetchData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch plan details
      const planResponse = await fetch(`/api/partner/metered-billing/plans/${planId}`, {
        credentials: 'include',
      });

      if (!planResponse.ok) {
        throw new Error('Failed to fetch plan details');
      }

      const planData = await planResponse.json();
      if (planData.success) {
        setPlan(planData.data);
        setSubscriptions(planData.data.subscriptions || []);
      }

      // Fetch available customers for adding subscriptions
      const customersResponse = await fetch('/api/partner/customers', {
        credentials: 'include',
      });

      if (customersResponse.ok) {
        const customersData = await customersResponse.json();
        if (customersData.success) {
          // Filter out customers who already have subscriptions to this plan
          const subscribedCustomerIds = new Set(subscriptions.map(s => s.customerId));
          const available = customersData.data.filter((c: any) => !subscribedCustomerIds.has(c.id));
          setAvailableCustomers(available);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load plan subscriptions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (planId) {
      fetchData();
    }
  }, [planId]);

  // Subscribe customer to plan
  const handleSubscribeCustomer = async (customerId: string) => {
    try {
      const response = await fetch('/api/partner/metered-billing/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          customerId,
          planId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to subscribe customer to plan');
      }

      toast.success('Customer subscribed successfully');
      setShowAddModal(false);
      await fetchData();
    } catch (error: any) {
      console.error('Error subscribing customer:', error);
      toast.error(error.message || 'Failed to subscribe customer');
    }
  };

  // Update subscription status
  const handleUpdateSubscription = async (subscriptionId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/partner/metered-billing/subscriptions/${subscriptionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          status: newStatus,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update subscription');
      }

      toast.success(`Subscription ${newStatus} successfully`);
      await fetchData();
    } catch (error: any) {
      console.error('Error updating subscription:', error);
      toast.error(error.message || 'Failed to update subscription');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <FiLoader className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-2">Plan Not Found</h2>
          <p className="text-gray-400 mb-4">The requested plan could not be found.</p>
          <button
            onClick={() => router.push('/partner/metered-billing')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Back to Billing
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => router.push('/partner/metered-billing')}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <FiArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">{plan.name} - Subscriptions</h1>
            <p className="text-gray-400">Manage customer subscriptions for this plan</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <FiPlus className="w-4 h-4" />
            Add Subscription
          </button>
        </div>

        {/* Plan Info */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <span className="text-sm text-gray-400">Metric</span>
              <p className="text-white font-medium">{plan.metricName}</p>
            </div>
            <div>
              <span className="text-sm text-gray-400">Billing Cycle</span>
              <p className="text-white font-medium">{plan.billingCycle}</p>
            </div>
            <div>
              <span className="text-sm text-gray-400">Pricing Model</span>
              <p className="text-white font-medium">{plan.pricingModel}</p>
            </div>
            <div>
              <span className="text-sm text-gray-400">Status</span>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 text-xs rounded-full ${
                  plan.isActive 
                    ? 'bg-green-600/20 text-green-400' 
                    : 'bg-gray-600/20 text-gray-400'
                }`}>
                  {plan.isActive ? 'Active' : 'Inactive'}
                </span>
                {plan.stripeProductId && (
                  <span className="px-2 py-1 bg-blue-600/20 text-blue-400 text-xs rounded-full">
                    Stripe Ready
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Subscriptions List */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl">
          <div className="p-6 border-b border-gray-700">
            <h3 className="text-lg font-semibold text-white">Active Subscriptions ({subscriptions.length})</h3>
          </div>
          
          {subscriptions.length === 0 ? (
            <div className="p-12 text-center">
              <FiUsers className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No Subscriptions Yet</h3>
              <p className="text-gray-400 mb-6">Start by adding customers to this plan.</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <FiPlus className="w-4 h-4" />
                Add First Subscription
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {subscriptions.map((subscription) => (
                <div key={subscription.id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                        <FiUsers className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-white">
                          {subscription.customer.firstName} {subscription.customer.lastName}
                        </h4>
                        <p className="text-sm text-gray-400">{subscription.customer.email}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm text-gray-400">Current Usage</p>
                        <p className="font-medium text-white">
                          {subscription.currentUsage[plan.metricName] || 0} {plan.metricName}
                        </p>
                      </div>
                      
                      <div className="text-right">
                        <p className="text-sm text-gray-400">Projected Cost</p>
                        <p className="font-medium text-white">
                          {formatCurrency(subscription.projectedCost || 0)}
                        </p>
                      </div>
                      
                      <div className="text-right">
                        <p className="text-sm text-gray-400">Next Billing</p>
                        <p className="font-medium text-white">
                          {formatDate(subscription.nextBillingDate)}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          subscription.status === 'active' 
                            ? 'bg-green-600/20 text-green-400'
                            : subscription.status === 'paused'
                            ? 'bg-yellow-600/20 text-amber-400'
                            : 'bg-red-600/20 text-red-400'
                        }`}>
                          {subscription.status}
                        </span>
                        
                        {subscription.status === 'active' && (
                          <button
                            onClick={() => handleUpdateSubscription(subscription.id, 'paused')}
                            className="p-1 text-gray-400 hover:text-amber-400 transition-colors"
                            title="Pause subscription"
                          >
                            <FiPause className="w-4 h-4" />
                          </button>
                        )}
                        
                        {subscription.status === 'paused' && (
                          <button
                            onClick={() => handleUpdateSubscription(subscription.id, 'active')}
                            className="p-1 text-gray-400 hover:text-green-400 transition-colors"
                            title="Resume subscription"
                          >
                            <FiPlay className="w-4 h-4" />
                          </button>
                        )}
                        
                        <button
                          onClick={() => handleUpdateSubscription(subscription.id, 'cancelled')}
                          className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                          title="Cancel subscription"
                        >
                          <FiX className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Subscription Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gray-800 rounded-xl max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-gray-700">
                <h3 className="text-xl font-semibold text-white">Add Customer Subscription</h3>
                <p className="text-gray-400 mt-1">Select a customer to subscribe to this plan</p>
              </div>
              
              <div className="p-6">
                {availableCustomers.length === 0 ? (
                  <div className="text-center py-8">
                    <FiUsers className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                    <p className="text-gray-400">No available customers to subscribe</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {availableCustomers.map((customer) => (
                      <button
                        key={customer.id}
                        onClick={() => handleSubscribeCustomer(customer.id)}
                        className="w-full p-4 bg-gray-700/50 hover:bg-gray-700 border border-gray-600 rounded-lg transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                            <FiUsers className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <p className="font-medium text-white">
                              {customer.firstName} {customer.lastName}
                            </p>
                            <p className="text-sm text-gray-400">{customer.email}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="p-6 border-t border-gray-700">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
