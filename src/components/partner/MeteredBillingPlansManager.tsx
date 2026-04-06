'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  FiPlus,
  FiEdit3,
  FiTrash2,
  FiUsers,
  FiDollarSign,
  FiTrendingUp,
  FiLoader,
  FiSettings,
  FiInfo
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

interface PricingTier {
  upTo: number | null;
  price: number;
}

interface MeteredBillingPlan {
  id: string;
  name: string;
  description?: string;
  metricType: string;
  metricName: string;
  pricingModel: 'flat' | 'tiered' | 'volume';
  pricingTiers: PricingTier[];
  billingCycle: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  billingDay?: number;
  minimumCharge: number;
  maximumCharge?: number;
  includedUnits: number;
  prorationEnabled: boolean;
  usageAggregation: 'sum' | 'max' | 'avg' | 'count';
  isActive: boolean;
  // Stripe integration fields
  stripeProductId?: string;
  stripePriceIds?: string[];
  subscriptions: Array<{
    id: string;
    customerId: string;
    status: string;
    currentUsage: Record<string, any>;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface MeteredBillingPlansManagerProps {
  className?: string;
  stripeStatus?: {
    hasStripeAccount: boolean;
    onboardingCompleted: boolean;
    chargesEnabled: boolean;
  };
}

export default function MeteredBillingPlansManager({ className = '', stripeStatus }: MeteredBillingPlansManagerProps) {
  const [plans, setPlans] = useState<MeteredBillingPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MeteredBillingPlan | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<string | null>(null);

  // Check if Stripe is ready for billing
  const isStripeReady = stripeStatus?.hasStripeAccount &&
                       stripeStatus?.onboardingCompleted &&
                       stripeStatus?.chargesEnabled;

  // Fetch metered billing plans
  const fetchPlans = async () => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch('/api/partner/metered-billing/plans', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch metered billing plans');
      }

      const data = await response.json();
      if (data.success && data.data && Array.isArray(data.data)) {
        setPlans(data.data);
      } else {
        console.warn('Invalid API response structure:', data);
        setPlans([]); // Ensure plans is always an array
      }
    } catch (error) {
      console.error('Error fetching metered billing plans:', error);
      toast.error('Failed to load metered billing plans');
      setPlans([]); // Ensure plans is always an array even on error
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount / 100); // Convert cents to dollars
  };

  // Format billing cycle
  const formatBillingCycle = (cycle: string) => {
    return cycle.charAt(0).toUpperCase() + cycle.slice(1);
  };

  // Format pricing model
  const formatPricingModel = (model: string) => {
    switch (model) {
      case 'flat':
        return 'Flat Rate';
      case 'tiered':
        return 'Tiered Pricing';
      case 'volume':
        return 'Volume Pricing';
      default:
        return model;
    }
  };

  // Get pricing summary
  const getPricingSummary = (plan: MeteredBillingPlan) => {
    if (plan.pricingModel === 'flat') {
      return `${formatCurrency(plan.pricingTiers[0]?.price || 0)} per unit`;
    } else if (plan.pricingModel === 'tiered') {
      const firstTier = plan.pricingTiers[0];
      const lastTier = plan.pricingTiers[plan.pricingTiers.length - 1];
      return `${formatCurrency(lastTier?.price || 0)} - ${formatCurrency(firstTier?.price || 0)} per unit`;
    } else {
      const minPrice = Math.min(...plan.pricingTiers.map(t => t.price));
      const maxPrice = Math.max(...plan.pricingTiers.map(t => t.price));
      return `${formatCurrency(minPrice)} - ${formatCurrency(maxPrice)} per unit`;
    }
  };

  // Handle plan deletion
  const handleDeletePlan = (planId: string) => {
    setPlanToDelete(planId);
    setShowDeleteModal(true);
  };

  // Confirm plan deletion
  const confirmDeletePlan = async () => {
    if (!planToDelete) return;

    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`/api/partner/metered-billing/plans/${planToDelete}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete billing plan');
      }

      toast.success('Billing plan deleted successfully');
      await fetchPlans();
    } catch (error: any) {
      console.error('Error deleting billing plan:', error);
      toast.error(error.message || 'Failed to delete billing plan');
    } finally {
      setShowDeleteModal(false);
      setPlanToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className={`${className}`}>
        <div className="flex items-center justify-center py-12">
          <FiLoader className="w-8 h-8 animate-spin text-gray-400" />
          <span className="ml-3 text-gray-400">Loading metered billing plans...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Metered Billing Plans</h2>
          <p className="text-gray-400">
            Create and manage usage-based billing plans for your customers
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          disabled={!isStripeReady}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            isStripeReady
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
          title={!isStripeReady ? 'Complete Stripe Connect setup to create billing plans' : ''}
        >
          <FiPlus className="w-4 h-4" />
          Create Plan
        </button>
      </div>

      {/* Stripe Setup Notice */}
      {!isStripeReady && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <FiInfo className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="text-orange-400 font-medium mb-1">Stripe Connect Setup Required</h4>
              <p className="text-orange-300/80 text-sm mb-3">
                To enable automated payment processing for metered billing plans, you need to complete your Stripe Connect setup.
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href="/partner/settings/billing"
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-sm rounded-lg transition-colors"
                >
                  <FiSettings className="w-4 h-4" />
                  Complete Setup
                </a>
                <span className="text-orange-300/60 text-sm px-3 py-1.5">
                  Plans can be created but will require manual billing
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Plans List */}
      {!Array.isArray(plans) ? (
        <div className="bg-red-800/50 border border-red-700 rounded-xl p-6 text-center">
          <p className="text-red-300">Error: Plans data is not properly loaded. Please refresh the page.</p>
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-12 text-center">
          <FiTrendingUp className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Metered Billing Plans</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Create your first metered billing plan to start charging customers based on their actual usage.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={!isStripeReady}
            className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg transition-colors ${
              isStripeReady
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
            title={!isStripeReady ? 'Complete Stripe Connect setup to create billing plans' : ''}
          >
            <FiPlus className="w-4 h-4" />
            Create Your First Plan
          </button>
          {!isStripeReady && (
            <p className="text-sm text-gray-400 mt-3">
              <FiSettings className="w-4 h-4 inline mr-1" />
              Complete Stripe Connect setup to enable billing features
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AnimatePresence>
            {(plans || []).map((plan, index) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.1 }}
                className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 hover:border-gray-600 transition-colors"
              >
                {/* Plan Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                      {!plan.isActive && (
                        <span className="px-2 py-1 bg-gray-600 text-gray-300 text-xs rounded-full">
                          Inactive
                        </span>
                      )}
                      {plan.stripeProductId && isStripeReady && (
                        <span className="px-2 py-1 bg-green-600/20 text-green-400 text-xs rounded-full flex items-center gap-1">
                          <FiDollarSign className="w-3 h-3" />
                          Stripe Ready
                        </span>
                      )}
                      {!plan.stripeProductId && isStripeReady && (
                        <span className="px-2 py-1 bg-yellow-600/20 text-amber-400 text-xs rounded-full">
                          Manual Billing
                        </span>
                      )}
                      {!isStripeReady && (
                        <span className="px-2 py-1 bg-orange-600/20 text-orange-400 text-xs rounded-full">
                          Stripe Setup Required
                        </span>
                      )}
                    </div>
                    {plan.description && (
                      <p className="text-sm text-gray-400 mb-2">{plan.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span>{plan.metricName}</span>
                      <span>•</span>
                      <span>{formatBillingCycle(plan.billingCycle)}</span>
                      <span>•</span>
                      <span>{formatPricingModel(plan.pricingModel)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingPlan(plan)}
                      disabled={!!plan.stripeProductId}
                      className={`p-2 rounded-lg transition-colors ${
                        plan.stripeProductId
                          ? 'text-gray-600 cursor-not-allowed'
                          : 'text-gray-400 hover:text-white hover:bg-gray-700'
                      }`}
                      title={
                        plan.stripeProductId
                          ? 'Cannot edit plans with Stripe integration'
                          : 'Edit plan'
                      }
                    >
                      <FiEdit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeletePlan(plan.id)}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                      title="Delete plan"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Plan Details */}
                <div className="space-y-3">
                  {/* Pricing */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Pricing</span>
                    <span className="text-sm font-medium text-white">
                      {getPricingSummary(plan)}
                    </span>
                  </div>

                  {/* Included Units */}
                  {plan.includedUnits > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Included Units</span>
                      <span className="text-sm font-medium text-white">
                        {plan.includedUnits.toLocaleString()} free
                      </span>
                    </div>
                  )}

                  {/* Minimum Charge */}
                  {plan.minimumCharge > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Minimum Charge</span>
                      <span className="text-sm font-medium text-white">
                        {formatCurrency(plan.minimumCharge)}
                      </span>
                    </div>
                  )}

                  {/* Active Subscriptions */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                    <div className="flex items-center gap-2">
                      <FiUsers className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-400">Active Subscriptions</span>
                    </div>
                    <span className="text-sm font-medium text-white">
                      {plan.subscriptions.filter(s => s.status === 'active').length}
                    </span>
                  </div>
                </div>

                {/* Stripe Integration Notice */}
                {plan.stripeProductId && (
                  <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <div className="flex items-start gap-2">
                      <FiInfo className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="text-blue-400 font-medium">Stripe Integration Active</p>
                        <p className="text-blue-300/80 mt-1">
                          This plan is connected to Stripe and cannot be modified. Create a new plan for different settings.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-700">
                  <button
                    onClick={() => {
                      // Navigate to customer subscription management
                      window.location.href = `/partner/billing/plans/${plan.id}/subscriptions`;
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
                  >
                    <FiUsers className="w-4 h-4" />
                    Manage Subscriptions
                  </button>
                  <button
                    onClick={() => setEditingPlan(plan)}
                    disabled={!!plan.stripeProductId}
                    className={`flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                      plan.stripeProductId
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                    title={
                      plan.stripeProductId
                        ? 'Cannot edit plans with Stripe integration'
                        : 'Configure plan settings'
                    }
                  >
                    <FiSettings className="w-4 h-4" />
                    Configure
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Info Message */}
      <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <FiInfo className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="text-sm">
          <p className="text-blue-400 font-medium mb-1">Metered Billing</p>
          <p className="text-blue-300">
            Metered billing plans automatically track customer usage and generate invoices based on actual consumption. 
            Usage is tracked in real-time through your analytics system and billed according to the pricing tiers you define.
          </p>
        </div>
      </div>

      {/* Create/Edit Plan Modal */}
      {(showCreateModal || editingPlan) && (
        <CreateEditPlanModal
          plan={editingPlan}
          isOpen={showCreateModal || !!editingPlan}
          onClose={() => {
            setShowCreateModal(false);
            setEditingPlan(null);
          }}
          onSuccess={() => {
            setShowCreateModal(false);
            setEditingPlan(null);
            fetchPlans();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 border border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                <FiTrash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Delete Billing Plan</h3>
                <p className="text-gray-400 text-sm">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-gray-300 mb-6">
              Are you sure you want to delete this billing plan? All associated data will be permanently removed.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setPlanToDelete(null);
                }}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeletePlan}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Delete Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Create/Edit Plan Modal component
function CreateEditPlanModal({
  plan,
  isOpen,
  onClose,
  onSuccess
}: {
  plan: MeteredBillingPlan | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: plan?.name || '',
    description: plan?.description || '',
    metricType: plan?.metricType || 'calls',
    metricName: plan?.metricName || 'total_calls',
    pricingModel: plan?.pricingModel || 'flat',
    billingCycle: plan?.billingCycle || 'monthly',
    minimumCharge: plan?.minimumCharge || 0,
    maximumCharge: plan?.maximumCharge || '',
    includedUnits: plan?.includedUnits || 0,
    prorationEnabled: plan?.prorationEnabled ?? true,
    usageAggregation: plan?.usageAggregation || 'sum',
  });

  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>(
    plan?.pricingTiers || [{ upTo: null, price: 0 }]
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('partner_token');
      if (!token) throw new Error('No authentication token');

      const payload = {
        ...formData,
        pricingTiers: pricingTiers.map(tier => ({
          upTo: tier.upTo,
          price: tier.price * 100, // Convert to cents
        })),
        minimumCharge: formData.minimumCharge * 100, // Convert to cents
        maximumCharge: formData.maximumCharge ? Number(formData.maximumCharge) * 100 : null,
      };

      const url = plan
        ? `/api/partner/metered-billing/plans/${plan.id}`
        : '/api/partner/metered-billing/plans';

      const method = plan ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to save plan');
      }

      toast.success(plan ? 'Plan updated successfully' : 'Plan created successfully');
      onSuccess();
    } catch (error: any) {
      console.error('Error saving plan:', error);
      toast.error(error.message || 'Failed to save plan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addPricingTier = () => {
    setPricingTiers([...pricingTiers, { upTo: null, price: 0 }]);
  };

  const removePricingTier = (index: number) => {
    if (pricingTiers.length > 1) {
      setPricingTiers(pricingTiers.filter((_, i) => i !== index));
    }
  };

  const updatePricingTier = (index: number, field: keyof PricingTier, value: any) => {
    const updated = [...pricingTiers];
    updated[index] = { ...updated[index], [field]: value };
    setPricingTiers(updated);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-700">
          <h3 className="text-xl font-semibold text-white">
            {plan ? 'Edit Plan' : 'Create New Plan'}
          </h3>
          <p className="text-gray-400 mt-1">
            Configure your metered billing plan settings
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Plan Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Call Minutes Plan"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Billing Cycle *
              </label>
              <select
                required
                value={formData.billingCycle}
                onChange={(e) => setFormData({ ...formData, billingCycle: e.target.value as any })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Describe what this plan covers..."
            />
          </div>

          {/* Metric Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Metric Type *
              </label>
              <select
                required
                value={formData.metricType}
                onChange={(e) => setFormData({ ...formData, metricType: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="calls">Calls</option>
                <option value="minutes">Minutes</option>
                <option value="seconds">Seconds</option>
                <option value="leads">Leads</option>
                <option value="tokens">Tokens</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Metric Name *
              </label>
              <input
                type="text"
                required
                value={formData.metricName}
                onChange={(e) => setFormData({ ...formData, metricName: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., total_calls, call_minutes"
              />
            </div>
          </div>

          {/* Pricing Model */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Pricing Model *
            </label>
            <select
              required
              value={formData.pricingModel}
              onChange={(e) => setFormData({ ...formData, pricingModel: e.target.value as any })}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="flat">Flat Rate - Same price per unit</option>
              <option value="tiered">Tiered Pricing - Different rates for usage tiers</option>
              <option value="volume">Volume Pricing - Rate based on total usage</option>
            </select>
          </div>

          {/* Pricing Tiers */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-gray-300">
                Pricing Tiers *
              </label>
              {formData.pricingModel !== 'flat' && (
                <button
                  type="button"
                  onClick={addPricingTier}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                >
                  Add Tier
                </button>
              )}
            </div>

            <div className="space-y-3">
              {pricingTiers.map((tier, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-400 mb-1">
                      {formData.pricingModel === 'flat' ? 'Price per unit' : `Tier ${index + 1} - Up to`}
                    </label>
                    {formData.pricingModel !== 'flat' && (
                      <input
                        type="number"
                        min="0"
                        value={tier.upTo || ''}
                        onChange={(e) => updatePricingTier(index, 'upTo', e.target.value ? Number(e.target.value) : null)}
                        className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white text-sm"
                        placeholder="Units (leave empty for unlimited)"
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-400 mb-1">Price ($)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={tier.price}
                      onChange={(e) => updatePricingTier(index, 'price', Number(e.target.value))}
                      className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white text-sm"
                      placeholder="0.00"
                    />
                  </div>
                  {pricingTiers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePricingTier(index)}
                      className="p-1 text-red-400 hover:text-red-300 transition-colors"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Additional Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Included Units
              </label>
              <input
                type="number"
                min="0"
                value={formData.includedUnits}
                onChange={(e) => setFormData({ ...formData, includedUnits: Number(e.target.value) })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
              />
              <p className="text-xs text-gray-400 mt-1">Free units included in the plan</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Minimum Charge ($)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.minimumCharge}
                onChange={(e) => setFormData({ ...formData, minimumCharge: Number(e.target.value) })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
              <p className="text-xs text-gray-400 mt-1">Minimum monthly charge</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Maximum Charge ($)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.maximumCharge}
                onChange={(e) => setFormData({ ...formData, maximumCharge: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="No limit"
              />
              <p className="text-xs text-gray-400 mt-1">Optional maximum charge cap</p>
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-300">Enable Proration</label>
                <p className="text-xs text-gray-400">Prorate charges for partial billing periods</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, prorationEnabled: !formData.prorationEnabled })}
                className={`w-12 h-6 rounded-full relative transition-colors ${
                  formData.prorationEnabled ? 'bg-blue-600' : 'bg-gray-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                  formData.prorationEnabled ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Usage Aggregation
              </label>
              <select
                value={formData.usageAggregation}
                onChange={(e) => setFormData({ ...formData, usageAggregation: e.target.value as any })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="sum">Sum - Add all usage values</option>
                <option value="max">Maximum - Use highest usage value</option>
                <option value="avg">Average - Use average usage value</option>
                <option value="count">Count - Count number of usage events</option>
              </select>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : (plan ? 'Update Plan' : 'Create Plan')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
