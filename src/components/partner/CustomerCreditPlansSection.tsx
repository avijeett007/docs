'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  FiDollarSign,
  FiPlus,
  FiEdit3,
  FiTrash2,
  FiStar,
  FiEye,
  FiEyeOff,
  FiLoader,
  FiAlertCircle,
  FiCreditCard,
  FiInfo,
  FiShield,
  FiAlertTriangle,
  FiExternalLink
} from 'react-icons/fi';
import CreateCreditPlanModal from './CreateCreditPlanModal';
import PremiumFeature from '@/components/ui/PremiumFeature';
import SubscriptionUpgradeModal from '@/components/settings/SubscriptionUpgradeModal';

interface CreditPlan {
  id: string;
  name: string;
  credits: number;
  priceCents: number;
  discountPercentage: number;
  isActive: boolean;
  isPopular: boolean;
  description?: string;
  sortOrder: number;
  purchaseCount: number;
  createdAt: string;
  updatedAt: string;
}

interface StripeStatus {
  hasStripeAccount: boolean;
  accountId?: string;
  accountType?: 'express' | 'standard';
  onboardingCompleted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}

interface CustomerCreditPlansSectionProps {
  partnerId?: string;
  isFreeForever?: boolean;
}

const CustomerCreditPlansSection: React.FC<CustomerCreditPlansSectionProps> = ({ partnerId: _partnerId, isFreeForever = false }) => {
  const [creditPlans, setCreditPlans] = useState<CreditPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<CreditPlan | null>(null);
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);
  const [stripeLoading, setStripeLoading] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    fetchCreditPlans();
    fetchStripeStatus();
  }, []);

  const fetchCreditPlans = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication token not found. Please log in again.');
        return;
      }

      const response = await fetch('/api/partner/customer-credit-plans', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();

      if (data.success) {
        setCreditPlans(data.data);
      } else {
        toast.error('Failed to load credit plans');
      }
    } catch (error) {
      console.error('Error fetching credit plans:', error);
      toast.error('Failed to load credit plans');
    } finally {
      setLoading(false);
    }
  };

  const fetchStripeStatus = async () => {
    try {
      setStripeLoading(true);
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch('/api/partner/stripe/status', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStripeStatus(data.data);
      } else {
        console.error('Failed to fetch Stripe status:', response.status, response.statusText);
        const errorData = await response.json().catch(() => ({}));
        console.error('Error details:', errorData);
      }
    } catch (error) {
      console.error('Error fetching Stripe status:', error);
    } finally {
      setStripeLoading(false);
    }
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const formatCredits = (credits: number) => {
    return credits.toLocaleString();
  };

  const togglePlanStatus = async (planId: string, currentStatus: boolean) => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication token not found. Please log in again.');
        return;
      }

      const response = await fetch(`/api/partner/customer-credit-plans/${planId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          isActive: !currentStatus,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setCreditPlans(plans =>
          plans.map(plan =>
            plan.id === planId ? { ...plan, isActive: !currentStatus } : plan
          )
        );
        toast.success(`Plan ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
      } else {
        toast.error(data.error || 'Failed to update plan status');
      }
    } catch (error) {
      console.error('Error updating plan status:', error);
      toast.error('Failed to update plan status');
    }
  };

  const deletePlan = async (planId: string) => {
    if (!confirm('Are you sure you want to delete this credit plan? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication token not found. Please log in again.');
        return;
      }

      const response = await fetch(`/api/partner/customer-credit-plans/${planId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        setCreditPlans(plans => plans.filter(plan => plan.id !== planId));
        toast.success('Credit plan deleted successfully');
      } else {
        toast.error(data.error || 'Failed to delete credit plan');
      }
    } catch (error) {
      console.error('Error deleting credit plan:', error);
      toast.error('Failed to delete credit plan');
    }
  };

  const canCreatePlans = !isFreeForever &&
                        stripeStatus?.hasStripeAccount &&
                        stripeStatus?.onboardingCompleted &&
                        stripeStatus?.chargesEnabled;

  if (stripeLoading) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <FiCreditCard className="w-6 h-6 text-blue-400" />
          <PremiumFeature iconSize="sm">
            <h3 className="text-lg font-semibold text-white">Customer Credit Plans</h3>
          </PremiumFeature>
        </div>
        <div className="flex items-center justify-center py-12">
          <FiLoader className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  // Show upgrade message for free forever users
  if (isFreeForever) {
    return (
      <>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <FiCreditCard className="w-6 h-6 text-blue-400" />
              <div>
                <PremiumFeature iconSize="sm">
                  <h3 className="text-lg font-semibold text-white">Customer Credit Plans</h3>
                </PremiumFeature>
                <p className="text-sm text-gray-400">
                  Create credit packages that your customers can purchase
                </p>
              </div>
            </div>
          </div>

          <div className="bg-amber-900/20 border border-amber-600 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <FiAlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-amber-400 font-medium mb-1">Upgrade Required</h3>
                <p className="text-amber-200 text-sm mb-3">
                  Customer credit plans are not available on the Free Forever plan. Upgrade your plan to create credit plans and let your customers purchase AI credits.
                </p>
                <button
                  onClick={() => setShowUpgradeModal(true)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded-lg transition-colors"
                >
                  <FiExternalLink className="w-4 h-4" />
                  Upgrade Plan
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Subscription Upgrade Modal for Free Forever users */}
        <SubscriptionUpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          currentPlan={{
            tier: 'free_forever',
            type: 'none',
            planId: undefined,
          }}
          onUpgradeSuccess={() => {
            setShowUpgradeModal(false);
            window.location.reload();
          }}
        />
      </>
    );
  }

  if (!canCreatePlans) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FiCreditCard className="w-6 h-6 text-blue-400" />
            <div>
              <PremiumFeature iconSize="sm">
                <h3 className="text-lg font-semibold text-white">Customer Credit Plans</h3>
              </PremiumFeature>
              <p className="text-sm text-gray-400">
                Create credit packages that your customers can purchase
              </p>
            </div>
          </div>
        </div>

        <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <FiAlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-amber-300 mb-1">
                Stripe Connect Required
              </h4>
              <p className="text-sm text-amber-200/80 mb-3">
                {!stripeStatus?.hasStripeAccount ? (
                  'You need to connect your Stripe account to create customer credit plans and receive payments directly.'
                ) : !stripeStatus?.onboardingCompleted ? (
                  'Please complete your Stripe onboarding to enable credit plan creation.'
                ) : !stripeStatus?.chargesEnabled ? (
                  'Your Stripe account is not enabled for charges. Please complete verification.'
                ) : (
                  'Stripe Connect setup is required to create customer credit plans.'
                )}
              </p>
              <p className="text-xs text-amber-300/60">
                Configure Stripe Connect in the Whitelabel Settings section above.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FiCreditCard className="w-6 h-6 text-blue-400" />
          <div>
            <PremiumFeature iconSize="sm">
              <h3 className="text-lg font-semibold text-white">Customer Credit Plans</h3>
            </PremiumFeature>
            <p className="text-sm text-gray-400">
              Create credit packages that your customers can purchase
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FiPlus className="w-4 h-4" />
          Create Plan
        </button>
      </div>

      {/* Stripe Connect Status Info */}
      {canCreatePlans && (
        <div className="bg-green-900/20 border border-green-600 rounded-lg p-3 mb-6">
          <div className="flex items-center gap-2">
            <FiShield className="w-4 h-4 text-green-500" />
            <span className="text-green-400 text-sm font-medium">Stripe Connected</span>
            <span className="text-green-300 text-xs">• Account verified • Charges enabled • Ready to create plans</span>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <FiInfo className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-200/80">
            <p className="font-medium mb-1 text-blue-300">How Credit Plans Work</p>
            <ul className="space-y-1 text-xs">
              <li>• Customers can purchase these credit plans from their whitelabel portal</li>
              <li>• Credits are automatically added to their account after successful payment</li>
              <li>• You can mark one plan as "Popular" to highlight it to customers</li>
              <li>• Deactivated plans won't be visible to customers but existing purchases remain</li>
            </ul>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <FiLoader className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : creditPlans.length === 0 ? (
        <div className="text-center py-12">
          <FiDollarSign className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-white mb-2">No Credit Plans Yet</h4>
          <p className="text-gray-400 mb-4">
            Create your first credit plan to let customers purchase AI credits.
          </p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FiPlus className="w-4 h-4" />
            Create Your First Plan
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {creditPlans.map((plan) => (
            <motion.div
              key={plan.id}
              layout
              className={`relative bg-gray-900 rounded-lg p-4 border transition-all duration-200 ${
                plan.isActive
                  ? 'border-gray-600 hover:border-gray-500'
                  : 'border-gray-700 opacity-60'
              } ${plan.isPopular ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}`}
            >
              {/* Popular Badge */}
              {plan.isPopular && (
                <div className="absolute -top-2 left-4 bg-blue-600 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                  <FiStar className="w-3 h-3" />
                  Popular
                </div>
              )}

              {/* Plan Details */}
              <div className="mb-4">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-white">{plan.name}</h4>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => togglePlanStatus(plan.id, plan.isActive)}
                      className={`p-1 rounded ${
                        plan.isActive
                          ? 'text-green-400 hover:bg-green-900/20'
                          : 'text-gray-500 hover:bg-gray-800'
                      }`}
                      title={plan.isActive ? 'Active' : 'Inactive'}
                    >
                      {plan.isActive ? <FiEye className="w-4 h-4" /> : <FiEyeOff className="w-4 h-4" />}
                    </button>
                    {/* Edit functionality temporarily disabled */}
                    <button
                      type="button"
                      disabled={true}
                      className="p-1 text-gray-600 cursor-not-allowed rounded"
                      title="Edit functionality temporarily disabled"
                    >
                      <FiEdit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deletePlan(plan.id)}
                      className="p-1 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded"
                      disabled={plan.purchaseCount > 0}
                      title={plan.purchaseCount > 0 ? 'Cannot delete plan with purchases' : 'Delete plan'}
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Credits:</span>
                    <span className="font-medium text-blue-400">{formatCredits(plan.credits)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Price:</span>
                    <span className="font-medium text-white">{formatPrice(plan.priceCents)}</span>
                  </div>
                  {plan.discountPercentage > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Discount:</span>
                      <span className="font-medium text-green-400">{plan.discountPercentage}% off</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Purchases:</span>
                    <span className="font-medium text-white">{plan.purchaseCount}</span>
                  </div>
                </div>

                {plan.description && (
                  <p className="text-sm text-gray-400 mt-2">{plan.description}</p>
                )}
              </div>

              {/* Status Indicator */}
              <div className={`text-xs px-2 py-1 rounded-full inline-flex items-center gap-1 ${
                plan.isActive
                  ? 'bg-green-900/20 text-green-400'
                  : 'bg-gray-700 text-gray-400'
              }`}>
                {plan.isActive ? 'Active' : 'Inactive'}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <CreateCreditPlanModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setEditingPlan(null);
        }}
        onSuccess={fetchCreditPlans}
        editingPlan={editingPlan}
      />
    </div>
  );
};

export default CustomerCreditPlansSection;
