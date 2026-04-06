'use client';

import React, { useState, useEffect } from 'react';
import { Check, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import pricingConfig from '../../config/dashboard/pricing.json';
import { isOfferExpired } from '../../utils/offerUtils';
import PricingSection from '../PricingSection';
import SimplifiedSignupModal from '../SimplifiedSignupModal';
import TierSelectionModal from '../TierSelectionModal';
import { getReferralId } from '@/lib/referral-tracking';

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

// Brief features for each tier (6-8 key converting features from actual pricing config)
const briefFeatures = {
  'Free Forever': [
    'Up to 2 Customers',
    'Unlimited Knova Agents',
    'Up to 2 Retell Agents',
    'Up to 2 N8N Chat Agents',
    'Subdomain Whitelabel Portal',
    'Passkey + MFA Authentication',
    'Discord & Community Support',
    'Concurrency Limit: 5'
  ],
  'Solo Agency Owner': [
    'Up to 20 Customers',
    'All AI Providers (VAPI, Ultravox, ElevenLabs)',
    '3000 Knotie Credits',
    'Team Management (2 members)',
    'Custom Domain Whitelabel',
    'Phone Numbers Included',
    'Email + Discord Support',
    'Tool Call Quota (100/15min)'
  ],
  'Ultimate Scaleup Agency': [
    'Unlimited Customers',
    'All AI Providers + GHL Integration',
    '5000 Knotie Credits',
    'Team Management (5 members)',
    'Priority Support + Business Manager',
    'Saasify Mode (Turn Agency Into SaaS)',
    'Monthly Founder Sessions',
    'Tool Call Quota (1000/15min)'
  ]
};

interface SimplifiedPricingSectionProps {
  onSubscribe?: (planId: string, billingInterval: 'monthly' | 'yearly') => Promise<void>;
  isPartnerFlow?: boolean;
  partnerId?: string;
}

export default function SimplifiedPricingSection({
  onSubscribe,
  isPartnerFlow = false,
  partnerId
}: SimplifiedPricingSectionProps) {
  const [isYearly, setIsYearly] = useState(false);
  const [showDetailedView, setShowDetailedView] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [preSelectedPlan, setPreSelectedPlan] = useState<{
    planId: string;
    billingInterval: 'monthly' | 'yearly';
    planName: string;
    price: number;
  } | undefined>(undefined);
  const [showTierModal, setShowTierModal] = useState(false);
  const [tierModalType, setTierModalType] = useState<'free_forever' | 'starter_special' | null>(null);
  const [pendingPlanSelection, setPendingPlanSelection] = useState<{
    planId: string;
    billingInterval: string;
    planName: string;
    price: number;
  } | null>(null);
  const router = useRouter();

  // Theme detection
  useEffect(() => {
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };

    // Initial check
    checkTheme();

    // Listen for theme changes
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

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

  const handleSubscribe = async (planId: string, billingInterval: string) => {
    try {
      setIsLoading(true);

      const selectedTier = typedPricingConfig.tiers.find(t => t.name === planId);
      if (!selectedTier) {
        throw new Error('Invalid plan selected');
      }

      const price = isYearly ? selectedTier.price.yearly || (selectedTier.price.amount * 12) : selectedTier.price.amount;

      // Map display names to plan IDs
      const actualPlanId = planId === 'Free Forever' ? 'free_forever'
                        : planId === 'Solo Agency Owner' ? 'starter'
                        : planId === 'Ultimate Scaleup Agency' ? 'enterprise'
                        : planId;

      // For new users, show tier selection modals for specific plans
      if (!onSubscribe && !isPartnerFlow && !partnerId) {
        if (planId === 'Free Forever') {
          setPendingPlanSelection({
            planId: actualPlanId,
            billingInterval,
            planName: planId,
            price
          });
          setTierModalType('free_forever');
          setShowTierModal(true);
          setIsLoading(false);
          return;
        } else if (planId === 'Solo Agency Owner') {
          // Check if starter special offer is enabled
          const isStarterSpecialEnabled = process.env.NEXT_PUBLIC_STARTER_SPECIAL_OFFER_ENABLED === 'true';

          if (isStarterSpecialEnabled) {
            setPendingPlanSelection({
              planId: actualPlanId,
              billingInterval,
              planName: planId,
              price
            });
            setTierModalType('starter_special');
            setShowTierModal(true);
            setIsLoading(false);
            return;
          }
          // If feature flag is disabled, proceed with normal flow (no modal)
        }
      }

      if (onSubscribe) {
        // Use external onSubscribe if provided
        await onSubscribe(planId, billingInterval as 'monthly' | 'yearly');
      } else if (isPartnerFlow && partnerId) {
        // Existing partner flow - proceed with payment
        const referralId = getReferralId();
        const response = await fetch('/api/partners/complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            partnerId,
            isLifetimeOffer: false,
            billingInterval,
            planId: actualPlanId,
            ...(referralId && { referralId }),
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to create checkout session');
        }

        if (data.url) {
          window.location.href = data.url;
        } else {
          throw new Error('No checkout URL received');
        }
      } else {
        // New user flow - open signup modal with pre-selected plan
        setPreSelectedPlan({
          planId: actualPlanId,
          billingInterval: billingInterval as 'monthly' | 'yearly',
          planName: planId,
          price: price
        });
        setShowSignupModal(true);
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTierModalConfirm = async (choice: 'free_trial' | 'special_offer' | 'continue_free') => {
    if (!pendingPlanSelection) return;

    try {
      setIsLoading(true);

      let finalPlanId = pendingPlanSelection.planId;
      let finalPrice = pendingPlanSelection.price;

      // Adjust plan based on choice
      if (choice === 'special_offer') {
        // Use special $49 pricing for starter plan
        finalPrice = 49;
        finalPlanId = 'starter_special'; // We'll need to create this plan
      } else if (choice === 'free_trial') {
        // Use trial versions
        finalPlanId = pendingPlanSelection.planId === 'free_forever' ? 'free_forever_trial' : 'starter_tier_trial';
      }

      // Open signup modal with the selected plan
      setPreSelectedPlan({
        planId: finalPlanId,
        billingInterval: pendingPlanSelection.billingInterval as 'monthly' | 'yearly',
        planName: pendingPlanSelection.planName,
        price: finalPrice
      });
      setShowSignupModal(true);

    } catch (error) {
      console.error('Error handling tier selection:', error);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
      setPendingPlanSelection(null);
    }
  };

  // If detailed view is requested, show the original PricingSection
  if (showDetailedView) {
    return (
      <div>
        <PricingSection
          onSubscribe={onSubscribe}
          isPartnerFlow={isPartnerFlow}
          partnerId={partnerId}
        />
        {/* Collapse Button */}
        <div className="text-center py-8">
          <button
            onClick={() => setShowDetailedView(false)}
            className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors duration-300 group"
          >
            <span className="text-lg font-medium">See simplified pricing</span>
            <ChevronUp className="w-5 h-5 group-hover:-translate-y-1 transition-transform duration-300" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <section id="pricing" className={`py-20 px-4 ${
      isDark
        ? 'bg-gradient-to-b from-gray-900 to-black'
        : 'bg-gradient-to-b from-gray-50 to-white'
    }`}>
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            <span className="text-transparent bg-gradient-to-r from-cyan-400 to-cyan-500 bg-clip-text">Simple</span>
            <span className="text-transparent bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text">, Transparent </span>
            <span className={isDark ? 'text-white' : 'text-gray-900'}>Pricing</span>
          </h2>
          <p className={`text-xl max-w-3xl mx-auto mb-8 ${
            isDark ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Choose the perfect plan for your team. Upgrade or downgrade anytime.
          </p>

          {/* Billing Toggle */}
          <div className="flex flex-col items-center gap-2 mb-8">
            <div className={`inline-flex items-center gap-2 text-sm p-1 rounded-lg backdrop-blur-sm border ${
              isDark
                ? 'bg-gray-900/50 border-gray-800'
                : 'bg-white/50 border-gray-300'
            }`}>
              <button
                type="button"
                onClick={() => setIsYearly(false)}
                className={`
                  px-4 py-2 rounded-md transition-all duration-300 ease-in-out
                  ${!isYearly
                    ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg shadow-purple-500/20 scale-[1.02]'
                    : isDark
                      ? 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
                  }
                `}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setIsYearly(true)}
                className={`
                  px-4 py-2 rounded-md transition-all duration-300 ease-in-out
                  ${isYearly
                    ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg shadow-purple-500/20 scale-[1.02]'
                    : isDark
                      ? 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
                  }
                `}
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
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {typedPricingConfig.tiers.map((tier, index) => {
            const isPopular = tier.isPopular; // Use the isPopular flag from the tier configuration
            const features = briefFeatures[tier.name as keyof typeof briefFeatures] || [];

            return (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className={`
                  relative rounded-xl p-8 border backdrop-blur-sm
                  ${isPopular
                    ? 'bg-gradient-to-b from-purple-900/20 to-purple-800/10 border-purple-500/50 ring-2 ring-purple-500/20'
                    : isDark
                      ? 'bg-gray-800/50 border-gray-700/50'
                      : 'bg-white/80 border-gray-200/50 shadow-lg'
                  }
                `}
              >
                {/* Popular Badge */}
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                      Popular
                    </span>
                  </div>
                )}

                {/* Tier Header */}
                <div className="text-center mb-8">
                  <h3 className={`text-2xl font-bold mb-2 ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}>{tier.name}</h3>
                  <p className={`text-sm mb-6 ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}>{tier.description}</p>
                  
                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-baseline justify-center gap-2">
                      <span className={`text-4xl font-bold ${
                        isDark ? 'text-white' : 'text-gray-900'
                      }`}>${getPrice(tier)}</span>
                      <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>/month</span>
                    </div>
                    {isYearly && getOriginalPrice(tier) && (
                      <div className={`text-sm line-through ${
                        isDark ? 'text-gray-500' : 'text-gray-400'
                      }`}>
                        ${getOriginalPrice(tier)}/month
                      </div>
                    )}
                  </div>

                  {/* CTA Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSubscribe(tier.name, isYearly ? 'yearly' : 'monthly');
                    }}
                    disabled={isLoading}
                    className={`
                      w-full py-3 px-6 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2
                      ${isPopular
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 shadow-lg shadow-purple-500/20'
                        : index === 2
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600 shadow-lg shadow-cyan-500/20'
                        : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600 shadow-lg shadow-cyan-500/20'
                      }
                      ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : null}
                    {tier.buttonText}
                  </button>
                </div>

                {/* Features List */}
                <ul className="space-y-3">
                  {features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                      <span className={`text-sm ${
                        isDark ? 'text-gray-300' : 'text-gray-700'
                      }`}>{feature}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>

        {/* Expand Button */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <button
            onClick={() => setShowDetailedView(true)}
            className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors duration-300 group"
          >
            <span className="text-lg font-medium">See complete pricing breakdown</span>
            <ChevronDown className="w-5 h-5 group-hover:translate-y-1 transition-transform duration-300" />
          </button>
        </motion.div>
      </div>

      {/* Signup Modal */}
      <SimplifiedSignupModal
        isOpen={showSignupModal}
        onClose={() => {
          setShowSignupModal(false);
          setPreSelectedPlan(undefined);
        }}
        preSelectedPlan={preSelectedPlan}
      />

      {/* Tier Selection Modal */}
      <TierSelectionModal
        isOpen={showTierModal}
        onClose={() => {
          setShowTierModal(false);
          setTierModalType(null);
          setPendingPlanSelection(null);
        }}
        tierType={tierModalType}
        onConfirm={handleTierModalConfirm}
      />
    </section>
  );
}
