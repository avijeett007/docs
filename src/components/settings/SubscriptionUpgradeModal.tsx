'use client';

import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { X, Loader2, ArrowUp, Check, Zap, Crown, Building2, Sparkles } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

interface UpgradeOption {
  planId: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  features: string[];
  popular?: boolean;
  icon: string;
  stripePriceIdMonthly: string;
  stripePriceIdYearly: string;
  savingsYearly?: string;
}

interface SubscriptionUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: {
    tier: string;
    type: string;
    planId?: string;
  };
  onUpgradeSuccess: () => void;
}

export default function SubscriptionUpgradeModal({
  isOpen,
  onClose,
  currentPlan,
  onUpgradeSuccess
}: SubscriptionUpgradeModalProps) {
  const [upgradeOptions, setUpgradeOptions] = useState<UpgradeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [selectedOption, setSelectedOption] = useState<UpgradeOption | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [validatedCoupon, setValidatedCoupon] = useState<any>(null);
  const [showBillingToggle, setShowBillingToggle] = useState(true);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    if (isOpen) {
      fetchUpgradeOptions();
    }
  }, [isOpen, currentPlan]);

  const fetchUpgradeOptions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('partner_token');
      
      const response = await fetch('/api/partner/subscription/upgrade-options', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch upgrade options');
      }

      const data = await response.json();
      if (data.success) {
        setUpgradeOptions(data.upgradeOptions);
      }
    } catch (error) {
      toast.error('Failed to load upgrade options');
    } finally {
      setLoading(false);
    }
  };

  const validateCoupon = async () => {
    if (!couponCode.trim()) {
      setValidatedCoupon(null);
      return;
    }

    try {
      setValidatingCoupon(true);
      const token = localStorage.getItem('partner_token');
      
      const response = await fetch('/api/partner/validate-coupon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          couponCode: couponCode.trim(),
          context: 'upgrade'
        }),
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        setValidatedCoupon(data.coupon);
        toast.success(`Coupon applied: ${data.coupon.name}`);
      } else {
        setValidatedCoupon(null);
        toast.error(data.error || 'Invalid coupon code');
      }
    } catch (error) {
      setValidatedCoupon(null);
      toast.error('Failed to validate coupon');
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleUpgrade = async (option: UpgradeOption) => {
    try {
      setUpgrading(true);
      setSelectedOption(option);

      const token = localStorage.getItem('partner_token');
      const stripePriceId = billingInterval === 'yearly'
        ? option.stripePriceIdYearly
        : option.stripePriceIdMonthly;

      const response = await fetch('/api/partner/subscription/upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          planId: option.planId,
          stripePriceId,
          billingInterval,
          couponCode: validatedCoupon?.code || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate upgrade');
      }

      if (data.checkoutUrl) {
        // Redirect to Stripe checkout
        window.location.href = data.checkoutUrl;
      } else if (data.success) {
        // Immediate upgrade (e.g., same billing cycle)
        toast.success('Subscription upgraded successfully!');
        onUpgradeSuccess();
        onClose();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upgrade subscription');
    } finally {
      setUpgrading(false);
      setSelectedOption(null);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price / 100);
  };

  const getIconComponent = (iconName: string) => {
    const icons: Record<string, React.ComponentType<any>> = {
      'Zap': Zap,
      'Crown': Crown,
      'Building2': Building2,
      'Sparkles': Sparkles,
    };
    return icons[iconName] || Zap;
  };

  // Filter options - the API already filters based on eligibility, but we still have all options
  const filteredOptions = upgradeOptions;

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog
          as={motion.div}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          open={isOpen}
          onClose={onClose}
          className="relative z-50"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel
              as={motion.div}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-4xl bg-gray-900 rounded-2xl shadow-2xl border border-gray-700 max-h-[90vh] overflow-hidden"
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <ArrowUp className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <Dialog.Title className="text-xl font-semibold text-white">
                        Upgrade Your Plan
                      </Dialog.Title>
                      <p className="text-gray-400 text-sm">
                        Choose a plan that fits your growing business needs
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Billing Toggle */}
                    {showBillingToggle && (
                      <div className="flex items-center justify-center">
                        <div className="bg-gray-800 p-1 rounded-lg flex">
                          <button
                            onClick={() => setBillingInterval('monthly')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                              billingInterval === 'monthly'
                                ? 'bg-blue-500 text-white'
                                : 'text-gray-400 hover:text-white'
                            }`}
                          >
                            Monthly
                          </button>
                          <button
                            onClick={() => setBillingInterval('yearly')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                              billingInterval === 'yearly'
                                ? 'bg-blue-500 text-white'
                                : 'text-gray-400 hover:text-white'
                            }`}
                          >
                            Yearly
                            <span className="ml-1 text-xs bg-green-500 text-white px-1.5 py-0.5 rounded">
                              Save 20%
                            </span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Coupon Code */}
                    <div className="bg-gray-800/50 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          placeholder="Enter coupon code (optional)"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value)}
                          className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={validateCoupon}
                          disabled={validatingCoupon || !couponCode.trim()}
                          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {validatingCoupon ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            'Apply'
                          )}
                        </button>
                      </div>
                      {validatedCoupon && (
                        <div className="mt-2 text-sm text-green-400">
                          ✓ {validatedCoupon.name} - {validatedCoupon.description}
                        </div>
                      )}
                    </div>

                    {/* Upgrade Options */}
                    {filteredOptions.length === 0 ? (
                      <div className="text-center py-12">
                        <Crown className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-white mb-2">
                          You're on the highest plan!
                        </h3>
                        <p className="text-gray-400">
                          You're already enjoying all our premium features.
                        </p>
                      </div>
                    ) : (
                      <div className={`grid gap-6 ${filteredOptions.length === 1 ? 'grid-cols-1 max-w-md mx-auto' : filteredOptions.length === 2 ? 'grid-cols-1 md:grid-cols-2 max-w-2xl mx-auto' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
                        {filteredOptions.map((option) => {
                          const Icon = getIconComponent(option.icon);
                          const isUpgrading = upgrading && selectedOption?.planId === option.planId;
                          const displayPrice = billingInterval === 'yearly' ? option.priceYearly : option.priceMonthly;
                          const monthlyEquivalent = billingInterval === 'yearly' ? Math.round(option.priceYearly / 12) : option.priceMonthly;

                          return (
                            <motion.div
                              key={option.planId}
                              whileHover={{ scale: 1.02 }}
                              className={`relative bg-gray-800 rounded-xl p-6 border-2 transition-all ${
                                option.popular
                                  ? 'border-blue-500 shadow-lg shadow-blue-500/20'
                                  : 'border-gray-700 hover:border-gray-600'
                              }`}
                            >
                              {option.popular && (
                                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                                  <span className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs font-medium px-3 py-1 rounded-full">
                                    Most Popular
                                  </span>
                                </div>
                              )}

                              <div className="text-center">
                                <div className="p-3 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg w-fit mx-auto mb-4">
                                  <Icon className="w-8 h-8 text-blue-400" />
                                </div>

                                <h3 className="text-xl font-semibold text-white mb-2">
                                  {option.name}
                                </h3>

                                <p className="text-gray-400 text-sm mb-4">
                                  {option.description}
                                </p>

                                <div className="mb-6">
                                  <div className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                                    {formatPrice(displayPrice)}
                                  </div>
                                  <div className="text-gray-400 text-sm">
                                    per {billingInterval === 'yearly' ? 'year' : 'month'}
                                  </div>
                                  {billingInterval === 'yearly' && (
                                    <div className="text-gray-500 text-xs mt-1">
                                      ({formatPrice(monthlyEquivalent)}/month billed yearly)
                                    </div>
                                  )}
                                  {billingInterval === 'yearly' && option.savingsYearly && (
                                    <div className="text-green-400 text-sm font-medium mt-1">
                                      {option.savingsYearly}
                                    </div>
                                  )}
                                </div>

                                <ul className="space-y-2 mb-6 text-left max-h-48 overflow-y-auto">
                                  {option.features.map((feature, index) => (
                                    <li key={index} className="flex items-start gap-2 text-sm text-gray-300">
                                      <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                                      <span>{feature}</span>
                                    </li>
                                  ))}
                                </ul>

                                <button
                                  onClick={() => handleUpgrade(option)}
                                  disabled={upgrading}
                                  className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
                                    option.popular
                                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg shadow-purple-500/20'
                                      : 'bg-gray-700 hover:bg-gray-600 text-white'
                                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                  {isUpgrading ? (
                                    <div className="flex items-center justify-center gap-2">
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                      Upgrading...
                                    </div>
                                  ) : (
                                    `Upgrade to ${option.name}`
                                  )}
                                </button>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>
      )}
    </AnimatePresence>
  );
}
