import React, { useState, useEffect } from 'react';
import { Check, ArrowRight, Loader2, Timer } from 'lucide-react';
import toast from 'react-hot-toast';
import pricingConfig from '../config/dashboard/pricing.json';
import NumberAnimation from './NumberAnimation';
import { plans } from '@/lib/stripe';
import { useRouter } from 'next/navigation';
import SimplifiedSignupModal from './SimplifiedSignupModal';
import TierSelectionModal from './TierSelectionModal';
import { motion } from 'framer-motion';

interface PricingSectionProps {
  onSubscribe?: (planId: string, billingInterval: 'monthly' | 'yearly') => Promise<void>;
  isPartnerFlow?: boolean;
  partnerId?: string;
}

type PlanTier = "starter" | "pro" | "enterprise" | "all";

interface PricingFeature {
  name: string;
  included: PlanTier;
  upcoming?: boolean;
  value?: string;
  description?: string;
}

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

interface LifetimeDealFeature {
  name: string;
  value?: string;
  description: string;
}

interface PricingConfig {
  features: PricingFeature[];
  lifetimeDealFeatures: LifetimeDealFeature[];
  title: {
    main: string;
    highlight: string;
  };
  description: string;
  tiers: PricingTier[];
}

const typedPricingConfig = pricingConfig as PricingConfig;
const features = typedPricingConfig.features;

function getTierLevel(tier: string): number {
  switch (tier.toLowerCase()) {
    case 'free forever':
      return -1; // Free tier - available to all
    case 'solo agency owner':
    case 'starter':
      return 0;
    case 'professional agency owner':
    case 'pro':
      return 1;
    case 'ultimate scaleup agency':
    case 'enterprise':
      return 2;
    default:
      return -2; // Unknown tier
  }
}

function getTierColor(level: number): string {
  switch (level) {
    case 0:
      return 'blue';
    case 1:
      return 'purple';
    case 2:
      return 'teal';
    default:
      return 'gray';
  }
}

function shouldShowCheck(included: string, level: string): boolean {
  const includedLevel = getTierLevel(included);
  const targetLevel = getTierLevel(level);

  // Special handling for Free Forever features - show check for all tiers
  if (included.toLowerCase() === 'free forever') {
    return true;
  }

  return targetLevel >= includedLevel && includedLevel >= 0;
}

function isFeatureNativeToTier(feature: PricingFeature, tierName: string): boolean {
  return getTierLevel(feature.included) === getTierLevel(tierName);
}

function getFeatureDisplay(feature: PricingFeature): { name: string; value?: string; description?: string; upcoming: boolean } {
  return {
    name: feature.name,
    value: feature.value,
    description: feature.description,
    upcoming: !!feature.upcoming
  };
}

const PricingSection: React.FC<PricingSectionProps> = ({ onSubscribe, isPartnerFlow, partnerId }) => {
  const [isYearly, setIsYearly] = useState(false);
  const getPrice = (tier: PricingTier) => isYearly ? tier.price.amount * 12 : tier.price.amount;
  const [selectedPlan, setSelectedPlan] = useState<string>("Professional Agency Owner");
  const [isLoading, setIsLoading] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [preSelectedPlan, setPreSelectedPlan] = useState<{
    planId: string;
    billingInterval: 'monthly' | 'yearly';
    planName: string;
    price: number;
  } | undefined>(undefined);
  const [isDark, setIsDark] = useState(false);
  const [showTierModal, setShowTierModal] = useState(false);
  const [tierModalType, setTierModalType] = useState<'free_forever' | 'starter_special' | null>(null);
  const [pendingPlanSelection, setPendingPlanSelection] = useState<{
    planId: string;
    billingInterval: string;
    planName: string;
    price: number;
  } | null>(null);

  // Theme detection
  useEffect(() => {
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };

    checkTheme();

    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);
  const router = useRouter();

  const handleLifetimeSubscribe = async () => {
    try {
      setIsLoading(true);

      if (isPartnerFlow && partnerId) {
        const response = await fetch('/api/partners/complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            partnerId,
            isLifetimeOffer: true,
            billingInterval: 'one-time',
            planId: 'pro', // Pro tier for lifetime offer
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
        router.push(`/partners?offer=lifetime&price=${specialOfferPrice}`);
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
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

      // Show tier selection modals for specific plans (both new users and partner flow)
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

      if (isPartnerFlow && partnerId) {
        // Existing partner flow - proceed with payment
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
        finalPlanId = 'starter_special';
      } else if (choice === 'free_trial') {
        // Use trial versions
        finalPlanId = pendingPlanSelection.planId === 'free_forever' ? 'free_forever_trial' : 'starter_tier_trial';
      }

      if (isPartnerFlow && partnerId) {
        // Partner flow - proceed directly to payment
        const response = await fetch('/api/partners/complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            partnerId,
            isLifetimeOffer: false,
            billingInterval: pendingPlanSelection.billingInterval,
            planId: finalPlanId,
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
        // New user flow - open signup modal with the selected plan
        setPreSelectedPlan({
          planId: finalPlanId,
          billingInterval: pendingPlanSelection.billingInterval as 'monthly' | 'yearly',
          planName: pendingPlanSelection.planName,
          price: finalPrice
        });
        setShowSignupModal(true);
      }

    } catch (error) {
      console.error('Error handling tier selection:', error);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
      setPendingPlanSelection(null);
    }
  };

  // Convert plans object to array for mapping
  const plansArray = Object.values(plans);

  const isSpecialOfferEnabled = process.env.NEXT_PUBLIC_SPECIAL_OFFER_ENABLED === 'true';
  const specialOfferPrice = process.env.NEXT_PUBLIC_SPECIAL_OFFER_PRICE || '499';

  // Debug logging
  console.log('Special Offer Config:', {
    isSpecialOfferEnabled,
    specialOfferPrice,
    rawEnabled: process.env.NEXT_PUBLIC_SPECIAL_OFFER_ENABLED,
    rawPrice: process.env.NEXT_PUBLIC_SPECIAL_OFFER_PRICE
  });

  return (
    <section className={`py-20 px-4 ${
      isDark
        ? 'bg-gradient-to-b from-gray-900 to-black'
        : 'bg-gradient-to-b from-gray-50 to-white'
    }`} id="pricing">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className={`text-4xl md:text-5xl font-bold mb-4 ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            {pricingConfig.title.main}
            <span className="text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-teal-400 bg-clip-text block mt-2">
              {pricingConfig.title.highlight}
            </span>
          </h2>
          <p className={`text-xl max-w-3xl mx-auto mb-8 ${
            isDark ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Partner with us and offer these powerful plans to your customers. Earn competitive margins on every subscription.
          </p>

          {/* Billing Toggle */}
          <div className="flex flex-col items-center gap-2 mb-8">
            <div className={`inline-flex items-center gap-2 text-sm p-1 rounded-lg backdrop-blur-sm border ${
              isDark
                ? 'bg-gray-900/50 border-gray-800'
                : 'bg-white/80 border-gray-200'
            }`}>
              <button
                type="button"
                onClick={() => setIsYearly(false)}
                className={`
                  px-4 py-2 rounded-md transition-all duration-300 ease-in-out
                  ${!isYearly
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-purple-500/20 scale-[1.02]'
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
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-purple-500/20 scale-[1.02]'
                    : isDark
                      ? 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
                  }
                `}
              >
                <div className="flex items-center gap-2">
                  <span>Yearly</span>
                  <span className="text-xs bg-gradient-to-r from-teal-400 to-teal-500 text-white px-2 py-0.5 rounded-full">
                    Save 20%
                  </span>
                </div>
              </button>
            </div>
            {isYearly && (
              <p className="text-sm text-teal-400 animate-pulse">
                Get 12 months of service for the price of 10
              </p>
            )}
          </div>
        </motion.div>

        {/* Special Offer Section - Disabled for new landing page */}
        {false && isSpecialOfferEnabled && (
          <div className="max-w-4xl mx-auto mb-16">
            <div className="p-8 rounded-xl text-left transition-all backdrop-blur-sm bg-gradient-to-b from-blue-600/20 to-purple-600/20 border-2 border-blue-400/30">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <span className="px-3 py-1 text-sm bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-full flex items-center gap-2">
                    <Timer className="w-4 h-4" />
                    Limited Time Offer
                  </span>
                  <span className="text-sm bg-gradient-to-r from-blue-500 to-teal-500 text-white px-3 py-1 rounded-full">
                    Save over 80%
                  </span>
                </div>
              </div>
              <h3 className={`text-2xl font-bold mb-2 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>Lifetime Pro Access</h3>
              <p className={`mb-4 ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}>Get unlimited access to all Pro features forever with a one-time payment</p>
              <div className="flex items-baseline gap-2 mb-6">
                <span className={`text-4xl font-bold ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}>${specialOfferPrice}</span>
                <span className={`text-lg line-through ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}>$2997/year</span>
              </div>
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-medium text-teal-400 mb-3">LIFETIME DEAL FEATURES</h4>
                  <ul className="space-y-2">
                    {typedPricingConfig.lifetimeDealFeatures.map((feature, index) => (
                      <li key={index} className="flex items-center text-gray-300 text-sm">
                        <Check className="w-5 h-5 text-teal-500 mr-2 flex-shrink-0" />
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span>{feature.name}</span>
                            {feature.value && (
                              <span className="text-teal-400 font-medium">{feature.value}</span>
                            )}
                          </div>
                          {feature.description && (
                            <span className="text-xs text-gray-500 mt-1">{feature.description}</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-teal-400 mb-3">PRO FEATURES</h4>
                  <ul className="space-y-2">
                    <li className="flex items-center text-gray-300 text-sm">
                      <Check className="w-5 h-5 text-teal-500 mr-2 flex-shrink-0" />
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span>Lifetime Updates & Support</span>
                          <span className="text-teal-400 font-medium">Forever</span>
                        </div>
                        <span className="text-xs text-gray-500 mt-1">Access to all future updates and support</span>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
              <button
                onClick={handleLifetimeSubscribe}
                disabled={isLoading}
                className="mt-8 w-full py-3 px-6 rounded-lg bg-gradient-to-r from-blue-500 to-teal-500 text-white font-semibold hover:from-blue-600 hover:to-teal-600 transition-all duration-300 flex items-center justify-center"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Get Lifetime Access
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Plan Selection */}
        <div className="flex flex-col md:flex-row gap-4 mb-8 max-w-6xl mx-auto">
          {typedPricingConfig.tiers.map((tier, index) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              onClick={() => setSelectedPlan(tier.name)}
              className={`
                flex-1 p-6 rounded-xl text-left transition-all duration-300 ease-in-out backdrop-blur-sm cursor-pointer
                ${selectedPlan === tier.name
                  ? 'bg-gradient-to-b from-blue-600/20 to-purple-600/20 border-2 border-blue-400/30 shadow-lg shadow-blue-500/10 scale-[1.02]'
                  : isDark
                    ? 'bg-gray-900/50 border border-gray-800 hover:border-gray-700 hover:bg-gray-800/20 hover:scale-[1.01] hover:shadow-md hover:shadow-purple-500/5'
                    : 'bg-white/80 border border-gray-200 hover:border-gray-300 hover:bg-white/90 hover:scale-[1.01] hover:shadow-md hover:shadow-blue-500/5'
                }
              `}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg font-semibold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">{tier.name}</span>
                <div className="flex items-center gap-2">
                  {tier.isPopular && (
                    <span className="text-xs bg-gradient-to-r from-blue-500 to-purple-500 text-white px-2 py-1 rounded-full shadow-lg shadow-purple-500/20 animate-pulse">
                      Popular
                    </span>
                  )}
                  {selectedPlan === tier.name && (
                    <span className="text-xs font-medium bg-gradient-to-r from-teal-400 to-teal-500 text-white px-2 py-1 rounded-full shadow-lg shadow-teal-500/20">
                      Selected
                    </span>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-400 mb-4">{tier.description}</p>
              {getTierLevel(tier.name) > 0 && (
                <div className="mb-4 px-3 py-2 rounded-lg bg-gray-800/50 border border-gray-700">
                  <p className="text-sm text-gray-400">
                    Includes all features from{' '}
                    <span className={`text-${getTierColor(getTierLevel(tier.name) - 1)}-400 font-medium`}>
                      {getTierLevel(tier.name) === 1 ? typedPricingConfig.tiers[0].name : typedPricingConfig.tiers[1].name}
                    </span>
                  </p>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-500">
                    ${getPrice(tier).toLocaleString()}
                  </span>
                  <span className="text-gray-400">/{isYearly ? 'year' : 'month'}</span>
                </div>
                {isYearly && (
                  <div className="flex flex-col gap-1">
                    <p className="text-sm text-gray-400">
                      ${Math.round(tier.price.yearly! / 12).toLocaleString()}/month when billed yearly
                    </p>
                    <p className="text-sm bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-teal-500 font-medium">
                      Save ${(tier.price.amount * 12 - tier.price.yearly!).toLocaleString()} per year
                    </p>
                  </div>
                )}
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSubscribe(tier.name, isYearly ? 'yearly' : 'monthly');
                }}
                disabled={isLoading}
                className={`
                  mt-6 w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium
                  rounded-lg transition-all duration-300 ease-in-out
                  ${selectedPlan === tier.name
                    ? 'text-white bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 shadow-xl shadow-purple-500/20 scale-[1.02]'
                    : isDark
                      ? 'text-gray-300 bg-gray-800/50 hover:bg-gradient-to-r hover:from-blue-500/90 hover:to-purple-500/90 hover:text-white hover:shadow-lg hover:shadow-purple-500/10'
                      : 'text-gray-700 bg-gray-100/50 hover:bg-gradient-to-r hover:from-blue-500/90 hover:to-purple-500/90 hover:text-white hover:shadow-lg hover:shadow-purple-500/10'
                  }
                  focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:ring-offset-2 ${
                    isDark ? 'focus:ring-offset-gray-900' : 'focus:ring-offset-white'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-current"></div>
                    <span>Processing...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group">
                    <span>{isYearly ? 'Subscribe Yearly' : 'Subscribe Monthly'}</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </div>
                )}
              </button>
            </motion.div>
          ))}
        </div>

        {/* Features Table */}
        <div className={`max-w-6xl mx-auto border rounded-xl overflow-hidden backdrop-blur-sm ${
          isDark
            ? 'border-gray-800 bg-gray-900/30'
            : 'border-gray-200 bg-white/80'
        }`}>
          <div className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-200'}`}>
            <div className={`flex items-center p-4 ${
              isDark ? 'bg-gray-900/50' : 'bg-gray-50/80'
            }`}>
              <div className={`flex-1 text-sm font-medium ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>Features</div>
              <div className="flex items-center gap-8">
                {typedPricingConfig.tiers.map((tier) => (
                  <div key={tier.name} className={`w-32 text-center font-medium ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}>
                    {tier.name}
                  </div>
                ))}
              </div>
            </div>
            {/* Show regular features for monthly plans, lifetime features for LTD */}
            {(isPartnerFlow && partnerId && process.env.NEXT_PUBLIC_SPECIAL_OFFER_ENABLED === 'true'
              ? typedPricingConfig.lifetimeDealFeatures
              : features
            ).map((feature) => (
              <div
                key={feature.name}
                className={`
                  flex items-center p-4 transition-colors
                  ${'included' in feature && shouldShowCheck(feature.included, selectedPlan) ? 'bg-gradient-to-r from-blue-600/10 to-purple-600/10' : ''}
                  ${isDark ? 'hover:bg-gray-800/30' : 'hover:bg-gray-100/30'}
                  ${'upcoming' in feature && feature.upcoming ? (isDark ? 'bg-purple-900/5' : 'bg-purple-100/5') : ''}
                `}
              >
                <div className="flex items-center flex-1 text-sm">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{feature.name}</span>
                      {'upcoming' in feature && feature.upcoming && (
                        <span className="text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white px-2 py-0.5 rounded-full">
                          Upcoming
                        </span>
                      )}
                    </div>
                    {feature.description && (
                      <span className="text-xs text-gray-500 mt-1">{feature.description}</span>
                    )}
                    {feature.value && (
                      <span className="text-xs text-blue-400/70 mt-1">{feature.value}</span>
                    )}
                  </div>
                </div>
                {/* Show checkmarks for regular features (not lifetime deal features) */}
                {'included' in feature && (
                  <div className="flex items-center gap-8">
                    {typedPricingConfig.tiers.map((tier) => (
                      <div key={tier.name} className="w-32 flex justify-center items-center gap-2">
                        {shouldShowCheck(feature.included, tier.name) && (
                          <Check className={`w-5 h-5 ${isFeatureNativeToTier(feature as PricingFeature, tier.name) ? 'text-teal-500' : 'text-blue-400/70'}`} />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CTA Button */}
        <div className="text-center mt-12">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSubscribe(selectedPlan, isYearly ? 'yearly' : 'monthly');
            }}
            disabled={isLoading}
            className="
              group relative inline-flex items-center gap-3 px-8 py-4 rounded-xl
              bg-gradient-to-r from-blue-500 via-purple-500 to-teal-500
              text-white font-semibold text-lg
              transition-all duration-300 ease-in-out
              hover:shadow-2xl hover:shadow-purple-500/20 hover:scale-[1.02]
              disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
              before:absolute before:inset-0 before:rounded-xl
              before:bg-gradient-to-r before:from-blue-600 before:via-purple-600 before:to-teal-600
              before:transition-opacity before:duration-300
              before:opacity-0 hover:before:opacity-100 before:-z-10
            "
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-current"></div>
                <span>Processing...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <span>Get Started with {selectedPlan}</span>
                <ArrowRight className="w-6 h-6 transition-transform group-hover:translate-x-1" />
              </div>
            )}
          </button>
          <p className="text-sm text-gray-400 mt-6 max-w-xl mx-auto">
            Scale your agency with our powerful AI solutions. Get access to cutting-edge Voice AI and Vision AI features.
            <span className="block mt-1 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
              Start your subscription today and grow your business.
            </span>
          </p>
        </div>

        {/* Simplified Signup Modal */}
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
      </div>
    </section>
  );
};

export default PricingSection;
