/**
 * Customer Tool Call Quota Management Component
 * Allows partners to manage and upgrade customer tool call quotas
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  FiZap,
  FiTrendingUp,
  FiClock,
  FiCheck,
  FiX,
  FiAlertTriangle,
  FiDollarSign,
  FiRefreshCw,
  FiBarChart,
  FiSettings
} from 'react-icons/fi';
import { TOOL_CALL_QUOTA_TIERS, formatQuotaPrice, getUpgradeRecommendation } from '@/lib/toolCallQuotas';

interface CustomerToolCallQuotaManagementProps {
  customerId: string;
  customerName: string;
}

interface QuotaUsage {
  current: number;
  limit: number;
  tier: string;
  resetTime: number;
  windowMs: number;
}

interface QuotaStats {
  usage: QuotaUsage;
  recommendation?: {
    shouldUpgrade: boolean;
    recommendedTier?: any;
    reason?: string;
  };
}

export default function CustomerToolCallQuotaManagement({
  customerId,
  customerName
}: CustomerToolCallQuotaManagementProps) {
  const [quotaStats, setQuotaStats] = useState<QuotaStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);

  // Fetch current quota usage and stats
  const fetchQuotaStats = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/partner/customers/${customerId}/tool-call-quota`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setQuotaStats(data);
      } else {
        throw new Error('Failed to fetch quota stats');
      }
    } catch (error) {
      console.error('Error fetching quota stats:', error);
      toast.error('Failed to load quota information');
    } finally {
      setIsLoading(false);
    }
  };

  // Update customer quota tier
  const updateQuotaTier = async (newTier: string) => {
    try {
      setIsUpdating(true);
      const response = await fetch(`/api/partner/customers/${customerId}/tool-call-quota`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          tier: newTier,
        }),
      });

      if (response.ok) {
        toast.success(`Quota tier updated to ${newTier}`);
        await fetchQuotaStats();
        setShowUpgradeModal(false);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update quota tier');
      }
    } catch (error) {
      console.error('Error updating quota tier:', error);
      toast.error('Failed to update quota tier');
    } finally {
      setIsUpdating(false);
    }
  };

  // Create Stripe checkout for quota upgrade
  const handleStripeUpgrade = async (tier: string) => {
    try {
      setIsUpdating(true);
      const response = await fetch(`/api/partner/customers/${customerId}/tool-call-quota/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          tier,
          customerId,
        }),
      });

      if (response.ok) {
        const { checkoutUrl } = await response.json();
        window.open(checkoutUrl, '_blank');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast.error('Failed to create checkout session');
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    fetchQuotaStats();
    
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchQuotaStats, 30000);
    return () => clearInterval(interval);
  }, [customerId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <FiRefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
        <span className="ml-2 text-gray-400">Loading quota information...</span>
      </div>
    );
  }

  if (!quotaStats) {
    return (
      <div className="text-center p-8">
        <FiAlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">Unable to load quota information</h3>
        <p className="text-gray-400 mb-4">There was an error loading the tool call quota data.</p>
        <button
          onClick={fetchQuotaStats}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  const { usage, recommendation } = quotaStats;
  const currentTier = TOOL_CALL_QUOTA_TIERS[usage.tier];
  const usagePercentage = (usage.current / usage.limit) * 100;
  const resetDate = new Date(usage.resetTime);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <FiZap className="text-blue-500" />
            Tool Call Quota Management
          </h3>
          <p className="text-gray-400 text-sm">
            Manage N8N integration tool call limits for {customerName}
          </p>
        </div>
        <button
          onClick={fetchQuotaStats}
          className="p-2 text-gray-400 hover:text-white transition-colors"
          title="Refresh quota data"
        >
          <FiRefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Current Usage Card */}
      <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="font-medium text-white">Current Usage</h4>
            <p className="text-sm text-gray-400">
              {currentTier?.name || usage.tier} Plan
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-white">
              {usage.current.toLocaleString()}
            </div>
            <div className="text-sm text-gray-400">
              of {usage.limit.toLocaleString()} calls
            </div>
          </div>
        </div>

        {/* Usage Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>Usage</span>
            <span>{usagePercentage.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                usagePercentage >= 90 ? 'bg-red-500' :
                usagePercentage >= 70 ? 'bg-yellow-500' :
                'bg-blue-500'
              }`}
              style={{ width: `${Math.min(usagePercentage, 100)}%` }}
            />
          </div>
        </div>

        {/* Reset Time */}
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <FiClock className="w-4 h-4" />
          <span>
            Resets {resetDate.toLocaleDateString()} at {resetDate.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Upgrade Recommendation */}
      {recommendation?.shouldUpgrade && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-400/30 rounded-lg p-4"
        >
          <div className="flex items-start gap-3">
            <FiTrendingUp className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-medium text-yellow-200 mb-1">Upgrade Recommended</h4>
              <p className="text-yellow-100 text-sm mb-3">
                {recommendation.reason}
              </p>
              {recommendation.recommendedTier && (
                <button
                  onClick={() => {
                    setSelectedTier(recommendation.recommendedTier.id);
                    setShowUpgradeModal(true);
                  }}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm transition-colors"
                >
                  Upgrade to {recommendation.recommendedTier.name} - {formatQuotaPrice(recommendation.recommendedTier.priceMonthly)}/month
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Current Plan Details */}
      <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
        <h4 className="font-medium text-white mb-4">Current Plan Details</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-400">Plan</div>
            <div className="font-medium text-white">{currentTier?.name || usage.tier}</div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Monthly Cost</div>
            <div className="font-medium text-white">
              {currentTier ? formatQuotaPrice(currentTier.priceMonthly) : 'N/A'}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Quota Limit</div>
            <div className="font-medium text-white">{usage.limit.toLocaleString()} calls</div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Reset Window</div>
            <div className="font-medium text-white">
              {Math.round(usage.windowMs / (60 * 1000))} minutes
            </div>
          </div>
        </div>

        {currentTier?.features && (
          <div className="mt-4">
            <div className="text-sm text-gray-400 mb-2">Features</div>
            <div className="space-y-1">
              {currentTier.features.map((feature, index) => (
                <div key={index} className="flex items-center gap-2 text-sm text-gray-300">
                  <FiCheck className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Upgrade Button */}
      <div className="flex justify-center">
        <button
          onClick={() => setShowUpgradeModal(true)}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <FiTrendingUp className="w-5 h-5" />
          Upgrade Quota Plan
        </button>
      </div>

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-800 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">
                Upgrade Tool Call Quota for {customerName}
              </h3>
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.values(TOOL_CALL_QUOTA_TIERS).map((tier) => (
                <div
                  key={tier.id}
                  className={`relative p-4 rounded-lg border transition-all cursor-pointer ${
                    tier.id === usage.tier
                      ? 'border-blue-500 bg-blue-500/10'
                      : selectedTier === tier.id
                      ? 'border-green-500 bg-green-500/10'
                      : 'border-gray-600 bg-gray-700/30 hover:border-gray-500'
                  }`}
                  onClick={() => setSelectedTier(tier.id)}
                >
                  {tier.popular && (
                    <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                      <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                        Popular
                      </span>
                    </div>
                  )}
                  
                  <div className="text-center mb-4">
                    <h4 className="font-semibold text-white">{tier.name}</h4>
                    <div className="text-2xl font-bold text-white mt-2">
                      {formatQuotaPrice(tier.priceMonthly)}
                      <span className="text-sm text-gray-400">/month</span>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="text-sm text-gray-300">
                      <strong>{tier.limit.toLocaleString()}</strong> tool calls per {Math.round(tier.windowMs / (60 * 1000))} minutes
                    </div>
                  </div>

                  <div className="space-y-1">
                    {tier.features.slice(0, 3).map((feature, index) => (
                      <div key={index} className="flex items-center gap-2 text-xs text-gray-400">
                        <FiCheck className="w-3 h-3 text-green-500 flex-shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>

                  {tier.id === usage.tier && (
                    <div className="mt-3 text-center">
                      <span className="text-blue-400 text-sm font-medium">Current Plan</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              {selectedTier && selectedTier !== usage.tier && (
                <button
                  onClick={() => handleStripeUpgrade(selectedTier)}
                  disabled={isUpdating}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  {isUpdating ? (
                    <FiRefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <FiDollarSign className="w-4 h-4" />
                  )}
                  {isUpdating ? 'Processing...' : 'Upgrade with Stripe'}
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
