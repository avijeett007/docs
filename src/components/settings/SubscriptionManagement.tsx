'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  FiCreditCard,
  FiCalendar,
  FiDollarSign,
  FiExternalLink,
  FiAlertTriangle,
  FiCheck,
  FiX,
  FiPause,
  FiRefreshCw,
  FiArrowUp,
} from 'react-icons/fi';
import { motion } from 'framer-motion';
import SubscriptionCancellationModal from './SubscriptionCancellationModal';
import SubscriptionUpgradeModal from './SubscriptionUpgradeModal';
import FreeForeverUpgradeModal from '@/components/partner/FreeForeverUpgradeModal';

interface SubscriptionData {
  partner: {
    id: string;
    businessName: string;
    emailAddress: string;
    subscriptionStatus: string;
    approvalStatus: string;
    marketingTier: string;
    createdAt: string;
  };
  subscription: {
    type: string; // 'none', 'one_time', 'monthly', 'yearly'
    tier: string;
    planId: string | null;
    billingInterval: string | null;
    details: {
      id: string;
      status: string;
      currentPeriodStart: string;
      currentPeriodEnd: string;
      cancelAtPeriodEnd: boolean;
      cancelAt: string | null;
      trialStart: string | null;
      trialEnd: string | null;
      items: Array<{
        id: string;
        priceId: string;
        productId: string;
        amount: number;
        currency: string;
        interval: string;
        intervalCount: number;
      }>;
    } | null;
    paymentMethod: {
      type: string;
      brand: string;
      lastFour: string;
      expMonth: number;
      expYear: number;
    } | null;
    upcomingInvoice: {
      amountDue: number;
      currency: string;
      periodStart: string;
      periodEnd: string;
      nextPaymentAttempt: string | null;
    } | null;
    customerPortalUrl: string | null;
  };
}

interface SubscriptionManagementProps {
  className?: string;
}

export default function SubscriptionManagement({ className = '' }: SubscriptionManagementProps) {
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showLifetimeUpgradeModal, setShowLifetimeUpgradeModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSubscriptionData = async () => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch('/api/partner/subscription', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch subscription data');
      }

      const data = await response.json();
      if (data.success) {
        setSubscriptionData(data.data);
      } else {
        throw new Error(data.error || 'Failed to fetch subscription data');
      }
    } catch (error) {
      // Error handled silently for production
      toast.error('Failed to load subscription information');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchSubscriptionData();
  };

  const handleManagePayment = () => {
    if (subscriptionData?.subscription.customerPortalUrl) {
      window.open(subscriptionData.subscription.customerPortalUrl, '_blank');
    } else {
      toast.error('Payment management not available');
    }
  };

  const formatAmount = (amount: number, currency: string = 'usd') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getSubscriptionStatusBadge = (status: string) => {
    const statusConfig = {
      ACTIVE: { color: 'bg-green-500/20 text-green-400', icon: FiCheck },
      INACTIVE: { color: 'bg-gray-500/20 text-gray-400', icon: FiPause },
      CANCELLED: { color: 'bg-red-500/20 text-red-400', icon: FiX },
      CANCELLING: { color: 'bg-yellow-500/20 text-yellow-400', icon: FiAlertTriangle },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.INACTIVE;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3" />
        {status}
      </span>
    );
  };

  const getSubscriptionTypeDisplay = (type: string, tier: string) => {
    // Handle specific tiers based on actual subscription data
    if (tier === 'free_forever') {
      return 'Free Forever';
    }
    if (tier === 'lifetime_pro') {
      return 'Lifetime Pro';
    }
    if (tier === 'starter') {
      return type === 'monthly' ? 'Solo Agency Owner (Monthly)' : type === 'yearly' ? 'Solo Agency Owner (Annual)' : 'Solo Agency Owner';
    }
    if (tier === 'pro') {
      return type === 'monthly' ? 'Pro (Monthly)' : type === 'yearly' ? 'Pro (Annual)' : 'Pro Plan';
    }
    if (tier === 'enterprise') {
      return type === 'monthly' ? 'Ultimate Scaleup Agency (Monthly)' : type === 'yearly' ? 'Ultimate Scaleup Agency (Annual)' : 'Ultimate Scaleup Agency';
    }

    // Fallback for subscription types
    if (type === 'none') {
      return 'No Active Subscription';
    }
    if (type === 'one_time') return 'Lifetime Access';
    if (type === 'monthly') return 'Monthly Subscription';
    if (type === 'yearly') return 'Annual Subscription';

    // Final fallback
    return tier === 'unknown' ? 'Unknown Plan' : `${tier} Plan`;
  };

  const canUpgrade = (tier: string) => {
    // Determine if user can upgrade from current tier
    const upgradePaths: Record<string, boolean> = {
      'free_forever': true,
      'starter': true,
      'pro': true,
      'enterprise': false, // Can't upgrade from enterprise
      'lifetime_pro': true, // Show upgrade button for lifetime (will show booking modal)
    };

    return upgradePaths[tier] || false;
  };

  const handleUpgradeClick = () => {
    if (subscriptionData?.subscription.tier === 'lifetime_pro') {
      // Show booking modal for lifetime pro members
      setShowLifetimeUpgradeModal(true);
    } else {
      // Show regular upgrade modal for other tiers
      setShowUpgradeModal(true);
    }
  };

  if (loading) {
    return (
      <div className={`bg-gray-800/50 rounded-xl p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-700 rounded w-full"></div>
            <div className="h-4 bg-gray-700 rounded w-2/3"></div>
            <div className="h-4 bg-gray-700 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!subscriptionData) {
    return (
      <div className={`bg-gray-800/50 rounded-xl p-6 ${className}`}>
        <div className="text-center">
          <FiAlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400">Failed to load subscription information</p>
          <button
            onClick={handleRefresh}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const { partner, subscription } = subscriptionData;

  return (
    <div className={`bg-gray-800/50 rounded-xl overflow-hidden ${className}`}>
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Subscription & Billing</h2>
            <p className="text-gray-400 mt-1">Manage your subscription and payment information</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh subscription data"
            >
              <FiRefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Subscription Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Subscription Details</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Plan Type</span>
                <span className="text-white font-medium">
                  {getSubscriptionTypeDisplay(subscription.type, subscription.tier)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Status</span>
                {getSubscriptionStatusBadge(partner.subscriptionStatus)}
              </div>
              {subscription.tier && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Plan</span>
                  <span className="text-white font-medium">
                    {subscription.tier === 'free_forever' ? 'Free Forever' :
                     subscription.tier === 'lifetime_pro' ? 'Lifetime Pro' :
                     subscription.tier === 'starter' ? 'Solo Agency Owner' :
                     subscription.tier === 'pro' ? 'Pro' :
                     subscription.tier === 'enterprise' ? 'Ultimate Scaleup Agency' :
                     subscription.tier === 'unknown' ? 'Unknown' :
                     subscription.tier}
                  </span>
                </div>
              )}
              {subscription.details && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Billing Cycle</span>
                  <span className="text-white font-medium">
                    {subscription.details.items[0]?.interval === 'month' ? 'Monthly' :
                     subscription.details.items[0]?.interval === 'year' ? 'Yearly' :
                     subscription.details.items[0]?.interval ? subscription.details.items[0].interval.charAt(0).toUpperCase() + subscription.details.items[0].interval.slice(1) :
                     'N/A'}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Account Information</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Business Name</span>
                <span className="text-white font-medium">{partner.businessName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Email</span>
                <span className="text-white font-medium">{partner.emailAddress}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Member Since</span>
                <span className="text-white font-medium">{formatDate(partner.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Method */}
        {subscription.paymentMethod && (
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Payment Method</h3>
            <div className="bg-gray-700/50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <FiCreditCard className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium capitalize">
                      {subscription.paymentMethod.brand}
                    </span>
                    <span className="text-gray-400">•••• {subscription.paymentMethod.lastFour}</span>
                  </div>
                  <div className="text-sm text-gray-400">
                    Expires {subscription.paymentMethod.expMonth}/{subscription.paymentMethod.expYear}
                  </div>
                </div>
                <button
                  onClick={handleManagePayment}
                  className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-600 text-gray-300 rounded hover:bg-gray-500 transition-colors"
                >
                  <FiExternalLink className="w-3 h-3" />
                  Manage
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Billing Information */}
        {subscription.details && (
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Billing Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <FiCalendar className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-medium text-gray-300">Current Period</span>
                </div>
                <div className="text-white">
                  {formatDate(subscription.details.currentPeriodStart)} - {formatDate(subscription.details.currentPeriodEnd)}
                </div>
              </div>

              {subscription.upcomingInvoice && (
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <FiDollarSign className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-medium text-gray-300">Next Payment</span>
                  </div>
                  <div className="text-white">
                    {formatAmount(subscription.upcomingInvoice.amountDue, subscription.upcomingInvoice.currency)}
                  </div>
                  {subscription.upcomingInvoice.nextPaymentAttempt && (
                    <div className="text-sm text-gray-400 mt-1">
                      Due: {formatDate(subscription.upcomingInvoice.nextPaymentAttempt)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Cancellation Warning */}
        {subscription.details?.cancelAtPeriodEnd && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-4"
          >
            <div className="flex items-center gap-3">
              <FiAlertTriangle className="w-5 h-5 text-yellow-400" />
              <div>
                <p className="text-yellow-400 font-medium">Subscription Scheduled for Cancellation</p>
                <p className="text-yellow-300 text-sm">
                  Your subscription will end on {formatDate(subscription.details.currentPeriodEnd)}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-700">
          {/* Upgrade Button */}
          {canUpgrade(subscription.tier) && (
            <button
              onClick={handleUpgradeClick}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all shadow-lg"
            >
              <FiArrowUp className="w-4 h-4" />
              {subscription.tier === 'lifetime_pro' ? 'Upgrade to Enterprise' : 'Upgrade Plan'}
            </button>
          )}

          {subscription.customerPortalUrl && (
            <button
              onClick={handleManagePayment}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <FiCreditCard className="w-4 h-4" />
              Manage Payment & Billing
            </button>
          )}

          {partner.subscriptionStatus === 'ACTIVE' && subscription.type !== 'one_time' && (
            <button
              onClick={() => setShowCancellationModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors"
            >
              <FiX className="w-4 h-4" />
              Cancel Subscription
            </button>
          )}
        </div>
      </div>

      {/* Upgrade Modal */}
      <SubscriptionUpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        currentPlan={{
          tier: subscription.tier,
          type: subscription.type,
          planId: subscription.planId || undefined,
        }}
        onUpgradeSuccess={() => {
          setShowUpgradeModal(false);
          handleRefresh();
        }}
      />

      {/* Cancellation Modal */}
      <SubscriptionCancellationModal
        isOpen={showCancellationModal}
        onClose={() => setShowCancellationModal(false)}
        onSuccess={() => {
          setShowCancellationModal(false);
          handleRefresh();
        }}
      />

      {/* Lifetime Pro Upgrade Modal - Book a Meeting */}
      <FreeForeverUpgradeModal
        isOpen={showLifetimeUpgradeModal}
        onClose={() => setShowLifetimeUpgradeModal(false)}
        title="Upgrade to Ultimate Scale Agency"
        message="As a Lifetime Pro member, you have exclusive access to our Ultimate Scale Agency tier. Book a meeting with our team to discuss your upgrade options and special offers."
        featureDescription="Unlock enterprise features, dedicated support, and advanced capabilities tailored for your business."
      />
    </div>
  );
}
