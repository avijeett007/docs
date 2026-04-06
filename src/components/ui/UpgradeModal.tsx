'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, X } from 'lucide-react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import pricingConfig from '../../config/dashboard/pricing.json';

interface PricingTier {
  name: string;
  description: string;
  price: {
    amount: number;
    currency: string;
    period: string;
    yearly?: number;
  };
  features: string[];
  buttonText: string;
  isPopular: boolean;
}

interface PricingConfig {
  features: any[];
  tiers: PricingTier[];
}

const typedPricingConfig = pricingConfig as PricingConfig;

// Brief features for each tier
const briefFeatures = {
  'Solo Agency Owner': [
    'VAPI & Retell Integration',
    '500 Knotie Credits',
    'Up to 3 Customers',
    'Cross-Platform Agent Management',
    'Analytics Dashboard',
    'Custom Markup & Profit Controls',
    'Standard Support (48h)',
    'Beta Feature Access'
  ],
  'Professional Agency Owner': [
    'All Solo Agency Features +',
    '3000 Knotie Credits',
    'Unlimited Customer Management',
    'Standard API Access',
    'Priority AI Processing',
    'Premium Support (4h)',
    'Full Training Resources',
    'Complete Marketing Kit'
  ],
  'Ultimate Scaleup Agency': [
    'All Professional Features +',
    '5000 Knotie Credits',
    'Full API Integration',
    'Dedicated Platform Instance',
    '24/7 Priority Support',
    'Full Business Partnership',
    'Strategic Product Input',
    'White-Label Training System'
  ]
};

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function UpgradeModal({ isOpen, onClose, onSuccess }: UpgradeModalProps) {
  const [isYearly, setIsYearly] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [partnerData, setPartnerData] = useState<{
    id: string;
    businessName: string;
    contactName: string;
    emailAddress: string;
  } | null>(null);

  // Fetch partner data when modal opens
  useEffect(() => {
    if (isOpen && !partnerData) {
      fetchPartnerData();
    }
  }, [isOpen]);

  const fetchPartnerData = async () => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch('/api/partner/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPartnerData({
          id: data.id,
          businessName: data.businessName,
          contactName: data.contactName,
          emailAddress: data.emailAddress,
        });
      }
    } catch (error) {
      console.error('Failed to fetch partner data:', error);
    }
  };

  const getPrice = (tier: PricingTier) => {
    if (isYearly && tier.price.yearly) {
      return Math.floor(tier.price.yearly / 12);
    }
    return tier.price.amount;
  };

  const getOriginalPrice = (tier: PricingTier) => {
    if (isYearly && tier.price.yearly) {
      return tier.price.amount;
    }
    return null;
  };

  const handleUpgrade = async (planName: string) => {
    if (!partnerData) {
      toast.error('Partner data not loaded. Please try again.');
      return;
    }

    try {
      setIsLoading(true);

      const selectedTier = typedPricingConfig.tiers.find(t => t.name === planName);
      if (!selectedTier) {
        throw new Error('Invalid plan selected');
      }

      // Map display names to plan IDs
      const actualPlanId = planName === 'Free Forever' ? 'free_forever'
                        : planName === 'Solo Agency Owner' ? 'starter'
                        : planName === 'Ultimate Scaleup Agency' ? 'enterprise'
                        : planName;

      const billingInterval = isYearly ? 'yearly' : 'monthly';

      // Call the partner upgrade API (for existing partners)
      const token = localStorage.getItem('partner_token');
      const response = await fetch('/api/partner/upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          billingInterval,
          planId: actualPlanId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      if (data.url) {
        // Redirect to Stripe checkout
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-6xl max-h-[90vh] overflow-y-auto bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="p-8 pb-4 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Image
                src="/portals/diamond.svg"
                alt="Premium"
                width={24}
                height={24}
                className="opacity-90"
              />
              <h2 className="text-3xl font-bold text-white">Upgrade to Premium</h2>
            </div>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Unlock advanced capabilities and enhanced functionality with our premium plans. 
              Choose the perfect plan for your agency's growth.
            </p>

            {/* Billing Toggle */}
            <div className="flex justify-center mt-6">
              <div className="inline-flex items-center gap-2 text-sm p-1 rounded-lg bg-gray-800 border border-gray-700">
                <button
                  type="button"
                  onClick={() => setIsYearly(false)}
                  className={`px-4 py-2 rounded-md transition-all duration-300 ${
                    !isYearly
                      ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setIsYearly(true)}
                  className={`px-4 py-2 rounded-md transition-all duration-300 ${
                    isYearly
                      ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>Yearly</span>
                    <span className="text-xs bg-gradient-to-r from-cyan-400 to-cyan-500 text-white px-2 py-0.5 rounded-full">
                      Save 20%
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="px-8 pb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {typedPricingConfig.tiers.map((tier, index) => {
                const isPopular = tier.name === 'Professional Agency Owner';
                const features = briefFeatures[tier.name as keyof typeof briefFeatures] || [];

                return (
                  <div
                    key={tier.name}
                    className={`relative rounded-xl p-6 border backdrop-blur-sm ${
                      isPopular
                        ? 'bg-gradient-to-b from-purple-900/20 to-purple-800/10 border-purple-500/50 ring-2 ring-purple-500/20'
                        : 'bg-gray-800/50 border-gray-700/50'
                    }`}
                  >
                    {/* Popular Badge */}
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <span className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                          Popular
                        </span>
                      </div>
                    )}

                    {/* Tier Header */}
                    <div className="text-center mb-6">
                      <h3 className="text-xl font-bold text-white mb-2">{tier.name}</h3>
                      <p className="text-sm text-gray-400 mb-4">{tier.description}</p>
                      
                      {/* Price */}
                      <div className="mb-4">
                        <div className="flex items-baseline justify-center gap-2">
                          <span className="text-3xl font-bold text-white">${getPrice(tier)}</span>
                          <span className="text-gray-400">/month</span>
                        </div>
                        {isYearly && getOriginalPrice(tier) && (
                          <div className="text-sm line-through text-gray-500">
                            ${getOriginalPrice(tier)}/month
                          </div>
                        )}
                      </div>

                      {/* CTA Button */}
                      <button
                        onClick={() => handleUpgrade(tier.name)}
                        disabled={isLoading}
                        className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
                          isPopular
                            ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 shadow-lg shadow-purple-500/20'
                            : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600 shadow-lg shadow-cyan-500/20'
                        } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : null}
                        {isPopular ? 'Upgrade to Pro' : index === 2 ? 'Contact Sales' : 'Get Started'}
                      </button>
                    </div>

                    {/* Features List */}
                    <ul className="space-y-2">
                      {features.slice(0, 6).map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-gray-300">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
