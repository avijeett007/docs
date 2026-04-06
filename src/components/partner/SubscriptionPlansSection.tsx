'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  FiPlus,
  FiEdit3,
  FiTrash2,
  FiToggleLeft,
  FiToggleRight,
  FiCreditCard,
  FiX,
  FiLoader,
  FiAlertTriangle,
  FiInfo,
  FiExternalLink,
  FiShield,
} from 'react-icons/fi';
import UpgradePromptModal from '@/components/partner/UpgradePromptModal';
import { ClientTierValidationService, UpgradePrompt } from '@/lib/services/clientTierValidationService';
import PremiumFeature from '@/components/ui/PremiumFeature';
import SubscriptionUpgradeModal from '@/components/settings/SubscriptionUpgradeModal';
import AppSelectionModal from '@/components/partner/AppSelectionModal';
import { PlanFeatures } from '@/types/partner';

interface SubscriptionPlan {
  id: string;
  name: string;
  description?: string;
  amount: number; // in cents
  currency: string;
  interval: string;
  intervalCount: number;
  trialPeriodDays?: number;
  requireCardForTrial?: boolean;
  stripePriceId: string;
  isActive: boolean;
  showOnLandingPage: boolean;
  features: string[];
  planFeatures?: PlanFeatures;
  metadata: Record<string, any>;
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
  needsOnboarding: boolean;
  capabilities: Record<string, string>;
  requirements: {
    currentlyDue: string[];
    eventuallyDue: string[];
    pastDue: string[];
    pendingVerification: string[];
  };
}

interface SubscriptionPlansSectionProps {
  partnerId?: string;
  isFreeForever?: boolean;
  partnerAiAnalyticsEnabled?: boolean;
}

export default function SubscriptionPlansSection({ partnerId: _partnerId, isFreeForever = false, partnerAiAnalyticsEnabled = false }: SubscriptionPlansSectionProps) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);
  const [stripeLoading, setStripeLoading] = useState(true);
  const [upgradePrompt, setUpgradePrompt] = useState<UpgradePrompt | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showAppSelectionModal, setShowAppSelectionModal] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    amount: '',
    currency: 'usd',
    interval: 'month',
    intervalCount: 1,
    trialPeriodDays: '',
    requireCardForTrial: false,
    showOnLandingPage: false,
    features: [''],
    planFeatures: {
      enableAdvancedAnalytics: false,
      enableDetailedCallAnalysis: false,
      enableActionPointAnalysis: false,
      showIntegration: false,
      showDocsAndMedia: false,
      showPhoneNumbers: false,
      allowedApps: [] as string[],
      aiCreditsEnabled: false,
      lowCreditNotificationsEnabled: true,
      lowCreditThreshold: 10,
      initialAiCredits: 50,
    },
  });

  useEffect(() => {
    fetchPlans();
    fetchStripeStatus();
  }, []);

  const fetchStripeStatus = async () => {
    try {
      setStripeLoading(true);
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      // Get partner ID from token or use a method to get current partner ID
      const partnerId = await getCurrentPartnerId();
      if (!partnerId) return;

      const response = await fetch(`/api/partner/stripe/status?partnerId=${partnerId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStripeStatus(data.data);
      } else {
        console.error('Failed to fetch Stripe status');
      }
    } catch (error) {
      console.error('Error fetching Stripe status:', error);
    } finally {
      setStripeLoading(false);
    }
  };

  const getCurrentPartnerId = async (): Promise<string | null> => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return null;

      // Decode JWT to get partner ID (simple base64 decode for the payload)
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.partnerId || payload.id || null;
    } catch (error) {
      console.error('Error getting partner ID from token:', error);
      return null;
    }
  };

  // Validate SaaS mode access
  const validateSaaSAccess = async (): Promise<boolean> => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication token not found. Please log in again.');
        return false;
      }

      const validation = await ClientTierValidationService.validateSaaSModeAccess();

      if (!validation.allowed) {
        // Generate upgrade prompt
        const prompt = await ClientTierValidationService.generateUpgradePrompt('saas_mode');
        setUpgradePrompt(prompt);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error validating SaaS mode access:', error);
      toast.error('Error checking SaaS mode access. Please try again.');
      return false;
    }
  };

  const fetchPlans = async () => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication token not found. Please log in again.');
        return;
      }

      const response = await fetch('/api/partner/subscription-plans', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        // If unauthorized, redirect to login
        localStorage.removeItem('partner_token');
        window.location.href = '/partner/login';
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setPlans(data.data || []);
      } else {
        toast.error('Failed to fetch subscription plans');
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast.error('Failed to fetch subscription plans');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePlan = async () => {
    // Check SaaS mode access first
    const hasAccess = await validateSaaSAccess();
    if (!hasAccess) {
      return;
    }

    // Check Stripe Connect status before creating plan
    if (!stripeStatus?.hasStripeAccount) {
      toast.error('Stripe Connect account required. Please set up your Stripe account first.');
      return;
    }

    if (!stripeStatus?.onboardingCompleted) {
      toast.error('Please complete your Stripe onboarding before creating plans.');
      return;
    }

    if (!stripeStatus?.chargesEnabled) {
      toast.error('Your Stripe account is not enabled for charges. Please complete verification.');
      return;
    }

    try {
      setIsCreating(true);
      const token = localStorage.getItem('partner_token');

      if (!token) {
        toast.error('Authentication token not found. Please log in again.');
        return;
      }

      // Determine endpoint and method based on whether we're editing
      const url = editingPlan
        ? `/api/partner/subscription-plans/${editingPlan.id}`
        : '/api/partner/subscription-plans';
      
      const method = editingPlan ? 'PATCH' : 'POST';

      // Build payload based on operation (update only allows certain fields)
      const planData = editingPlan
        ? {
            // Update payload - only allowed fields
            name: formData.name,
            description: formData.description || undefined,
            showOnLandingPage: formData.showOnLandingPage,
            features: formData.features.filter(f => f.trim() !== ''),
            planFeatures: formData.planFeatures,
          }
        : {
            // Create payload - all fields
            name: formData.name,
            description: formData.description || undefined,
            amount: Math.round(parseFloat(formData.amount) * 100), // Convert to cents
            currency: formData.currency,
            interval: formData.interval,
            intervalCount: formData.intervalCount,
            trialPeriodDays: formData.trialPeriodDays ? parseInt(formData.trialPeriodDays) : undefined,
            requireCardForTrial: formData.requireCardForTrial,
            showOnLandingPage: formData.showOnLandingPage,
            features: formData.features.filter(f => f.trim() !== ''),
            planFeatures: formData.planFeatures,
          };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(planData),
      });

      if (response.status === 401) {
        // If unauthorized, redirect to login
        localStorage.removeItem('partner_token');
        window.location.href = '/partner/login';
        return;
      }

      if (response.ok) {
        toast.success(editingPlan 
          ? 'Subscription plan updated successfully' 
          : 'Subscription plan created successfully'
        );
        setShowCreateModal(false);
        resetForm();
        fetchPlans();
      } else {
        const error = await response.json();
        toast.error(error.error || `Failed to ${editingPlan ? 'update' : 'create'} subscription plan`);
      }
    } catch (error) {
      console.error(`Error ${editingPlan ? 'updating' : 'creating'} plan:`, error);
      toast.error(`Failed to ${editingPlan ? 'update' : 'create'} subscription plan`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleTogglePlan = async (planId: string, isActive: boolean) => {
    try {
      const token = localStorage.getItem('partner_token');

      if (!token) {
        toast.error('Authentication token not found. Please log in again.');
        return;
      }

      const response = await fetch(`/api/partner/subscription-plans/${planId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !isActive }),
      });

      if (response.status === 401) {
        // If unauthorized, redirect to login
        localStorage.removeItem('partner_token');
        window.location.href = '/partner/login';
        return;
      }

      if (response.ok) {
        toast.success(`Plan ${!isActive ? 'activated' : 'deactivated'} successfully`);
        fetchPlans();
      } else {
        toast.error('Failed to update plan status');
      }
    } catch (error) {
      console.error('Error toggling plan:', error);
      toast.error('Failed to update plan status');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      amount: '',
      currency: 'usd',
      interval: 'month',
      intervalCount: 1,
      trialPeriodDays: '',
      requireCardForTrial: false,
      showOnLandingPage: false,
      features: [''],
      planFeatures: {
        enableAdvancedAnalytics: false,
        enableDetailedCallAnalysis: false,
        enableActionPointAnalysis: false,
        showIntegration: false,
        showDocsAndMedia: false,
        showPhoneNumbers: false,
        allowedApps: [],
        aiCreditsEnabled: false,
        lowCreditNotificationsEnabled: true,
        lowCreditThreshold: 10,
        initialAiCredits: 50,
      },
    });
    setEditingPlan(null);
  };

  const addFeature = () => {
    setFormData(prev => ({
      ...prev,
      features: [...prev.features, ''],
    }));
  };

  const updateFeature = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.map((f, i) => i === index ? value : f),
    }));
  };

  const removeFeature = (index: number) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index),
    }));
  };

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const formatInterval = (interval: string, intervalCount: number) => {
    const unit = intervalCount === 1 ? interval : `${intervalCount} ${interval}s`;
    return `per ${unit}`;
  };

  if (isLoading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-center py-8">
          <FiLoader className="animate-spin w-6 h-6 text-blue-500 mr-2" />
          <span className="text-gray-400">Loading subscription plans...</span>
        </div>
      </div>
    );
  }

  const canCreatePlans = !isFreeForever &&
                        stripeStatus?.hasStripeAccount &&
                        stripeStatus?.onboardingCompleted &&
                        stripeStatus?.chargesEnabled;

  return (
    <div id="subscription-plans" className="bg-gray-900 border border-gray-800 rounded-lg p-6">
      {/* Free Forever Plan Restriction Banner */}
      {isFreeForever && (
        <div className="bg-amber-900/20 border border-amber-600 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <FiAlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-amber-400 font-medium mb-1">Upgrade Required</h3>
              <p className="text-amber-200 text-sm mb-3">
                Subscription plans are not available on the Free Forever plan. Upgrade your plan to create subscription plans and offer recurring billing to your customers.
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
      )}

      {/* Stripe Connect Warning Banner */}
      {!stripeLoading && !canCreatePlans && !isFreeForever && (
        <div className="bg-red-900/20 border border-red-600 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <FiAlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-red-400 font-medium mb-1">Stripe Connect Required</h3>
              <p className="text-red-200 text-sm mb-3">
                {!stripeStatus?.hasStripeAccount ? (
                  'You need to connect your Stripe account to create subscription plans and receive payments directly.'
                ) : !stripeStatus?.onboardingCompleted ? (
                  'Please complete your Stripe onboarding to enable plan creation.'
                ) : !stripeStatus?.chargesEnabled ? (
                  'Your Stripe account is not enabled for charges. Please complete verification.'
                ) : (
                  'Stripe Connect setup is required to create subscription plans.'
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => window.location.href = '/partner/settings/whitelabel#stripe-connect'}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
                >
                  <FiExternalLink className="w-4 h-4" />
                  Set up Stripe Connect
                </button>
                {stripeStatus?.hasStripeAccount && !stripeStatus?.onboardingCompleted && (
                  <button
                    onClick={() => window.location.href = '/partner/settings/whitelabel#stripe-connect'}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                  >
                    <FiShield className="w-4 h-4" />
                    Complete Verification
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stripe Connect Status Info */}
      {!stripeLoading && canCreatePlans && (
        <div className="bg-green-900/20 border border-green-600 rounded-lg p-3 mb-6">
          <div className="flex items-center gap-2">
            <FiShield className="w-4 h-4 text-green-500" />
            <span className="text-green-400 text-sm font-medium">Stripe Connected</span>
            <span className="text-green-200 text-sm">
              • Account verified • Charges enabled • Ready to create plans
            </span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start">
          <div className="p-2 bg-purple-500/20 rounded-lg mr-3">
            <FiCreditCard className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <PremiumFeature iconSize="sm">
              <h2 className="text-lg font-semibold text-white">
                Subscription Plans <span className="text-xs font-normal bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded-full ml-2">Beta</span>
              </h2>
            </PremiumFeature>
            <p className="text-gray-400 text-sm">Create and manage subscription plans for automatic billing</p>
            <p className="text-gray-400 text-sm">
            (Available to Early Supporters & Ultimate Plan Only)
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (canCreatePlans) {
              const hasAccess = await validateSaaSAccess();
              if (hasAccess) {
                setShowCreateModal(true);
              }
            } else {
              toast.error('Please set up Stripe Connect first to create subscription plans.');
            }
          }}
          disabled={!canCreatePlans}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm ${
            canCreatePlans
              ? 'bg-purple-600 hover:bg-purple-700 text-white'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          <FiPlus className="w-4 h-4" />
          Create Plan
        </button>
      </div>

      {/* Plans List */}
      {(!Array.isArray(plans) || plans.length === 0) ? (
        <div className="text-center py-8">
          <FiCreditCard className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No subscription plans yet</h3>
          <p className="text-gray-400 mb-4 text-sm">
            Create your first subscription plan to offer automatic recurring billing to your customers.
          </p>
          <button
            type="button"
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (canCreatePlans) {
                const hasAccess = await validateSaaSAccess();
                if (hasAccess) {
                  setShowCreateModal(true);
                }
              } else {
                toast.error('Please set up Stripe Connect first to create subscription plans.');
              }
            }}
            disabled={!canCreatePlans}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm ${
              canCreatePlans
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            <FiPlus className="w-4 h-4" />
            Create Your First Plan
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(plans || []).map((plan) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-800/50 rounded-lg p-4 border border-gray-700"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-white">{plan.name}</h3>
                  {plan.description && (
                    <p className="text-gray-400 text-xs mt-1">{plan.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleTogglePlan(plan.id, plan.isActive);
                  }}
                  className="relative"
                >
                  {plan.isActive ? (
                    <FiToggleRight className="w-6 h-4 text-green-500" />
                  ) : (
                    <FiToggleLeft className="w-6 h-4 text-gray-500" />
                  )}
                </button>
              </div>

              <div className="mb-3">
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold text-white">
                    {formatPrice(plan.amount, plan.currency)}
                  </span>
                  <span className="text-gray-400 text-sm">
                    {formatInterval(plan.interval, plan.intervalCount)}
                  </span>
                </div>
                {plan.trialPeriodDays && (
                  <div className="mt-1">
                    <p className="text-xs text-blue-400">
                      {plan.trialPeriodDays} day free trial
                    </p>
                    {plan.requireCardForTrial && (
                      <p className="text-xs text-amber-400 mt-0.5">
                        (Card required)
                      </p>
                    )}
                  </div>
                )}
              </div>

              {plan.features.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-gray-300 mb-1">Features:</h4>
                  <ul className="space-y-1">
                    {plan.features.slice(0, 3).map((feature, index) => (
                      <li key={index} className="text-xs text-gray-400 flex items-center gap-2">
                        <div className="w-1 h-1 bg-purple-500 rounded-full" />
                        {feature}
                      </li>
                    ))}
                    {plan.features.length > 3 && (
                      <li className="text-xs text-gray-500">
                        +{plan.features.length - 3} more features
                      </li>
                    )}
                  </ul>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setEditingPlan(plan);
                    setFormData({
                      name: plan.name,
                      description: plan.description || '',
                      amount: (plan.amount / 100).toString(),
                      currency: plan.currency,
                      interval: plan.interval,
                      intervalCount: plan.intervalCount,
                      trialPeriodDays: plan.trialPeriodDays?.toString() || '',
                      requireCardForTrial: plan.requireCardForTrial || false,
                      showOnLandingPage: plan.showOnLandingPage,
                      features: plan.features.length > 0 ? plan.features : [''],
                      planFeatures: {
                        enableAdvancedAnalytics: false,
                        enableDetailedCallAnalysis: false,
                        enableActionPointAnalysis: false,
                        showIntegration: false,
                        showDocsAndMedia: false,
                        showPhoneNumbers: false,
                        allowedApps: [] as string[],
                        aiCreditsEnabled: false,
                        lowCreditNotificationsEnabled: true,
                        lowCreditThreshold: 10,
                        initialAiCredits: 50,
                        ...(plan.planFeatures || {}),
                      },
                    });
                    setShowCreateModal(true);
                  }}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded text-xs flex items-center justify-center gap-1 transition-colors"
                >
                  <FiEdit3 className="w-3 h-3" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // TODO: Add delete functionality
                    console.log('Delete plan:', plan.id);
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-xs flex items-center justify-center transition-colors"
                >
                  <FiTrash2 className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-gray-800 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">
                  {editingPlan ? 'Edit Plan' : 'Create New Plan'}
                </h2>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              {/* Stripe Connect Status in Modal */}
              {stripeStatus && (
                <div className="mb-6">
                  {canCreatePlans ? (
                    <div className="bg-green-900/20 border border-green-600 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <FiShield className="w-4 h-4 text-green-500" />
                        <span className="text-green-400 text-sm font-medium">Stripe Connected & Verified</span>
                      </div>
                      <p className="text-green-200 text-xs mt-1">
                        This plan will be created in your Stripe account and you'll receive payments directly.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <FiAlertTriangle className="w-4 h-4 text-amber-500" />
                        <span className="text-amber-400 text-sm font-medium">Stripe Verification Required</span>
                      </div>
                      <p className="text-amber-200 text-xs mt-1">
                        {!stripeStatus?.hasStripeAccount ? (
                          'Connect your Stripe account to create plans and receive payments.'
                        ) : !stripeStatus?.onboardingCompleted ? (
                          'Complete Stripe onboarding to enable plan creation.'
                        ) : (
                          'Your Stripe account needs verification to process payments.'
                        )}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Warning message for immutable pricing fields when editing */}
              {editingPlan && (
                <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-3 mb-4">
                  <div className="flex items-start gap-2">
                    <FiInfo className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-yellow-400 text-sm font-medium">Pricing Cannot Be Changed</p>
                      <p className="text-yellow-200 text-xs mt-1">
                        Stripe subscription prices are immutable once created. You can only update the plan name, description, features, and visibility. To change pricing, create a new plan.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {/* Plan Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Plan Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Premium Plan"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of the plan"
                    rows={2}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Pricing */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Price *
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.amount}
                        onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                        placeholder="29.99"
                        disabled={!!editingPlan}
                        className={`w-full pl-8 pr-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${editingPlan ? 'opacity-50 cursor-not-allowed' : ''}`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Currency
                    </label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                      disabled={!!editingPlan}
                      className={`w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${editingPlan ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <option value="usd">USD</option>
                      <option value="eur">EUR</option>
                      <option value="gbp">GBP</option>
                    </select>
                  </div>
                </div>

                {/* Billing Interval */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Billing Interval *
                    </label>
                    <select
                      value={formData.interval}
                      onChange={(e) => setFormData(prev => ({ ...prev, interval: e.target.value }))}
                      disabled={!!editingPlan}
                      className={`w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${editingPlan ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <option value="day">Day</option>
                      <option value="week">Week</option>
                      <option value="month">Month</option>
                      <option value="year">Year</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Interval Count
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.intervalCount}
                      onChange={(e) => setFormData(prev => ({ ...prev, intervalCount: parseInt(e.target.value) || 1 }))}
                      disabled={!!editingPlan}
                      className={`w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${editingPlan ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
                  </div>
                </div>

                {/* Trial Period */}
                <div className="opacity-50">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Trial Period (days) <span className="text-xs text-gray-400">(Coming Soon)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.trialPeriodDays}
                    onChange={(e) => setFormData(prev => ({ ...prev, trialPeriodDays: e.target.value }))}
                    placeholder="7"
                    disabled={true}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm opacity-50 cursor-not-allowed"
                  />
                </div>

                {/* Show on Landing Page */}
                <div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="showOnLandingPage"
                      checked={formData.showOnLandingPage}
                      onChange={(e) => setFormData(prev => ({ ...prev, showOnLandingPage: e.target.checked }))}
                      className="w-4 h-4 bg-gray-700 border-gray-600 rounded focus:ring-purple-500 focus:ring-2"
                    />
                    <label htmlFor="showOnLandingPage" className="ml-2 text-sm font-medium text-gray-300">
                      Display on Customer Landing Page
                    </label>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Show this plan on your whitelabel customer portal landing page for customers to subscribe
                  </p>
                </div>

                {/* Features */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Features (Display Text)
                  </label>
                  <p className="text-xs text-gray-400 mb-2">
                    These are marketing features displayed to customers on the landing page
                  </p>
                  <div className="space-y-2">
                    {formData.features.map((feature, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={feature}
                          onChange={(e) => updateFeature(index, e.target.value)}
                          placeholder="Feature description"
                          className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        {formData.features.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              removeFeature(index);
                            }}
                            className="bg-red-600 hover:bg-red-700 text-white px-2 py-2 rounded-lg transition-colors"
                          >
                            <FiTrash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        addFeature();
                      }}
                      className="text-purple-400 hover:text-purple-300 text-sm flex items-center gap-1"
                    >
                      <FiPlus className="w-3 h-3" />
                      Add Feature
                    </button>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-700 my-6"></div>

                {/* Features & Add-ons Configuration */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Features & Add-ons</h3>
                  <p className="text-xs text-gray-400 mb-4">
                    Configure which features will be automatically enabled for customers who subscribe to this plan
                  </p>

                  {/* Analytics Features */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-300 mb-3">Analytics Features</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                        <div>
                          <div className="font-medium text-white text-sm">Advanced AI Analytics</div>
                          <div className="text-xs text-gray-400">
                            {!partnerAiAnalyticsEnabled
                              ? "Disabled at partner level — enable AI Analytics in Partner Settings first"
                              : "AI-powered call analysis and performance metrics"
                            }
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => partnerAiAnalyticsEnabled && setFormData(prev => ({
                            ...prev,
                            planFeatures: {
                              ...prev.planFeatures,
                              enableAdvancedAnalytics: !prev.planFeatures.enableAdvancedAnalytics
                            }
                          }))}
                          className="relative"
                          disabled={!partnerAiAnalyticsEnabled}
                        >
                          {formData.planFeatures.enableAdvancedAnalytics && partnerAiAnalyticsEnabled ? (
                            <FiToggleRight className="w-10 h-6 text-blue-500" />
                          ) : (
                            <FiToggleLeft className={`w-10 h-6 ${!partnerAiAnalyticsEnabled ? 'text-gray-600' : 'text-gray-500'}`} />
                          )}
                        </button>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                        <div>
                          <div className="font-medium text-white text-sm">Detailed Call Analysis</div>
                          <div className="text-xs text-gray-400">In-depth call breakdowns and transcripts</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            planFeatures: {
                              ...prev.planFeatures,
                              enableDetailedCallAnalysis: !prev.planFeatures.enableDetailedCallAnalysis
                            }
                          }))}
                          className="relative"
                        >
                          {formData.planFeatures.enableDetailedCallAnalysis ? (
                            <FiToggleRight className="w-10 h-6 text-blue-500" />
                          ) : (
                            <FiToggleLeft className="w-10 h-6 text-gray-500" />
                          )}
                        </button>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                        <div>
                          <div className="font-medium text-white text-sm">Action Point Analysis</div>
                          <div className="text-xs text-gray-400">AI-generated action items from calls</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            planFeatures: {
                              ...prev.planFeatures,
                              enableActionPointAnalysis: !prev.planFeatures.enableActionPointAnalysis
                            }
                          }))}
                          className="relative"
                        >
                          {formData.planFeatures.enableActionPointAnalysis ? (
                            <FiToggleRight className="w-10 h-6 text-blue-500" />
                          ) : (
                            <FiToggleLeft className="w-10 h-6 text-gray-500" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Menu Visibility Features */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-300 mb-3">Menu Visibility</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                        <div>
                          <div className="font-medium text-white text-sm flex items-center gap-2">
                            Integration
                            {formData.planFeatures.showIntegration && formData.planFeatures.allowedApps && formData.planFeatures.allowedApps.length > 0 && (
                              <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                                {formData.planFeatures.allowedApps.length} app{formData.planFeatures.allowedApps.length !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400">Show integration menu</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {formData.planFeatures.showIntegration && (
                            <button
                              type="button"
                              onClick={() => setShowAppSelectionModal(true)}
                              className="px-3 py-1 text-xs bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
                            >
                              Edit Apps
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({
                              ...prev,
                              planFeatures: {
                                ...prev.planFeatures,
                                showIntegration: !prev.planFeatures.showIntegration
                              }
                            }))}
                            className="relative"
                          >
                            {formData.planFeatures.showIntegration ? (
                              <FiToggleRight className="w-10 h-6 text-blue-500" />
                            ) : (
                              <FiToggleLeft className="w-10 h-6 text-gray-500" />
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                        <div>
                          <div className="font-medium text-white text-sm">Docs & Media</div>
                          <div className="text-xs text-gray-400">Show documents and media menu</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            planFeatures: {
                              ...prev.planFeatures,
                              showDocsAndMedia: !prev.planFeatures.showDocsAndMedia
                            }
                          }))}
                          className="relative"
                        >
                          {formData.planFeatures.showDocsAndMedia ? (
                            <FiToggleRight className="w-10 h-6 text-blue-500" />
                          ) : (
                            <FiToggleLeft className="w-10 h-6 text-gray-500" />
                          )}
                        </button>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                        <div>
                          <div className="font-medium text-white text-sm">Phone Numbers</div>
                          <div className="text-xs text-gray-400">Show phone numbers menu</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            planFeatures: {
                              ...prev.planFeatures,
                              showPhoneNumbers: !prev.planFeatures.showPhoneNumbers
                            }
                          }))}
                          className="relative"
                        >
                          {formData.planFeatures.showPhoneNumbers ? (
                            <FiToggleRight className="w-10 h-6 text-blue-500" />
                          ) : (
                            <FiToggleLeft className="w-10 h-6 text-gray-500" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* AI Credits */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-300 mb-3">AI Credits</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                        <div>
                          <div className="font-medium text-white text-sm">AI Credits Enabled</div>
                          <div className="text-xs text-gray-400">Enable AI credits billing system</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            planFeatures: {
                              ...prev.planFeatures,
                              aiCreditsEnabled: !prev.planFeatures.aiCreditsEnabled
                            }
                          }))}
                          className="relative"
                        >
                          {formData.planFeatures.aiCreditsEnabled ? (
                            <FiToggleRight className="w-10 h-6 text-blue-500" />
                          ) : (
                            <FiToggleLeft className="w-10 h-6 text-gray-500" />
                          )}
                        </button>
                      </div>

                      {/* AI Credits Settings - Only show when AI Credits are enabled */}
                      {formData.planFeatures.aiCreditsEnabled && (
                        <div className="p-3 bg-blue-900/20 border border-blue-800/30 rounded-lg space-y-4">
                          {/* Initial AI Credits */}
                          <div>
                            <label className="block text-sm font-medium text-white mb-2">
                              Initial AI Credits
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={formData.planFeatures.initialAiCredits ?? ''}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  planFeatures: {
                                    ...prev.planFeatures,
                                    initialAiCredits: e.target.value === '' ? 0 : parseInt(e.target.value) || 0
                                  }
                                }))}
                                className="w-32 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="50"
                              />
                              <span className="text-sm text-gray-400">credits</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              One-time credit grant when customer first onboards with this plan
                            </p>
                          </div>

                          {/* Low Credit Notifications */}
                          <div>
                            <h5 className="text-sm font-medium text-white mb-1">Low Credit Notifications</h5>
                            <p className="text-xs text-gray-400 mb-3">Send whitelabel email alerts when customer's AI credits are running low</p>

                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <div className="font-medium text-white text-sm">Enable Notifications</div>
                                <div className="text-xs text-gray-400">Send email alerts when credits are low</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({
                                  ...prev,
                                  planFeatures: {
                                    ...prev.planFeatures,
                                    lowCreditNotificationsEnabled: !prev.planFeatures.lowCreditNotificationsEnabled
                                  }
                                }))}
                                className="relative"
                              >
                                {formData.planFeatures.lowCreditNotificationsEnabled ? (
                                  <FiToggleRight className="w-10 h-6 text-blue-500" />
                                ) : (
                                  <FiToggleLeft className="w-10 h-6 text-gray-500" />
                                )}
                              </button>
                            </div>

                            {formData.planFeatures.lowCreditNotificationsEnabled && (
                              <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                  Low Credit Threshold
                                </label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min="1"
                                    max="1000"
                                    value={formData.planFeatures.lowCreditThreshold ?? ''}
                                    onChange={(e) => setFormData(prev => ({
                                      ...prev,
                                      planFeatures: {
                                        ...prev.planFeatures,
                                        lowCreditThreshold: e.target.value === '' ? 1 : parseInt(e.target.value) || 1
                                      }
                                    }))}
                                    className="w-24 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="10"
                                  />
                                  <span className="text-sm text-gray-400">credits remaining</span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                  Customer will receive an email when their AI credit balance reaches this threshold or below
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCreatePlan();
                  }}
                  disabled={isCreating || !formData.name || !formData.amount}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                >
                  {isCreating ? (
                    <>
                      <FiLoader className="animate-spin w-4 h-4" />
                      Creating...
                    </>
                  ) : (
                    editingPlan ? 'Update Plan' : 'Create Plan'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Upgrade Prompt Modal */}
      {upgradePrompt && (
        <UpgradePromptModal
          isOpen={upgradePrompt.show}
          onClose={() => setUpgradePrompt(null)}
          currentTier={upgradePrompt.currentTier}
          suggestedTier={upgradePrompt.suggestedTier}
          feature={upgradePrompt.feature}
          title={upgradePrompt.title}
          message={upgradePrompt.message}
        />
      )}

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
          // Reload the page to reflect new subscription status
          window.location.reload();
        }}
      />

      {/* App Selection Modal */}
      <AppSelectionModal
        isOpen={showAppSelectionModal}
        onClose={() => setShowAppSelectionModal(false)}
        onSave={(selectedApps) => {
          setFormData(prev => ({
            ...prev,
            planFeatures: {
              ...prev.planFeatures,
              showIntegration: true,
              allowedApps: selectedApps
            }
          }));
          setShowAppSelectionModal(false);
        }}
        isFreeForever={isFreeForever}
        currentApps={formData.planFeatures.allowedApps || []}
      />
    </div>
  );
}
