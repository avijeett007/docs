'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiCheck, FiCreditCard, FiClock, FiStar, FiZap, FiShield, FiRefreshCw } from 'react-icons/fi';
import Link from 'next/link';

interface SubscriptionPlan {
  id: string;
  name: string;
  description?: string;
  amount: number; // in cents
  currency: string;
  interval: string;
  intervalCount: number;
  trialPeriodDays?: number;
  features: string[];
  createdAt: string;
}

interface SubscriptionPlansDisplayProps {
  subdomain?: string;
  customDomain?: string;
  primaryColor?: string;
  secondaryColor?: string;
  themeClasses?: {
    card: string;
    button: {
      primary: string;
      secondary: string;
    };
  };
  pricingModel?: string; // 'subscription' or 'payasyougo'
  payAsYouGoRate?: number;
  freeTrialEnabled?: boolean;
  characterName?: string;
}

export default function SubscriptionPlansDisplay({
  subdomain,
  customDomain,
  primaryColor = '#3B82F6',
  secondaryColor = '#10B981',
  themeClasses = {
    card: 'bg-gray-800/50 border border-gray-700',
    button: {
      primary: 'rounded-lg transition-all duration-200 hover:scale-105',
      secondary: 'border border-gray-600 rounded-lg transition-all duration-200 hover:bg-gray-700',
    },
  },
  pricingModel = 'subscription',
  payAsYouGoRate = 0.10,
  freeTrialEnabled = false,
  characterName = 'AI Assistant',
}: SubscriptionPlansDisplayProps) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only fetch if we have subdomain or customDomain
    if (subdomain || customDomain) {
      fetchPlans();
    } else {
      setIsLoading(false);
    }
  }, [subdomain, customDomain]);

  const fetchPlans = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (subdomain) params.append('subdomain', subdomain);
      if (customDomain) params.append('customDomain', customDomain);

      const response = await fetch(`/api/whitelabel/subscription-plans?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch subscription plans');
      }

      const data = await response.json();

      if (data.success) {
        setPlans(data.data.plans || []);
      } else {
        throw new Error(data.error || 'Failed to fetch plans');
      }
    } catch (error) {
      console.error('Error fetching subscription plans:', error);
      setError(error instanceof Error ? error.message : 'Failed to load plans');
    } finally {
      setIsLoading(false);
    }
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

  const gradientBg = `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`;

  // Generate pay-as-you-go credit packages
  const generateCreditPackages = () => {
    const packages = [
      { credits: 100, popular: false },
      { credits: 500, popular: true },
      { credits: 1000, popular: false },
    ];

    return packages.map(pkg => ({
      id: `credits-${pkg.credits}`,
      name: `${pkg.credits} Credits`,
      description: `Perfect for ${pkg.credits === 100 ? 'getting started' : pkg.credits === 500 ? 'regular usage' : 'heavy usage'}`,
      amount: Math.round(pkg.credits * payAsYouGoRate * 100), // Convert to cents
      currency: 'usd',
      interval: 'one-time',
      intervalCount: 1,
      features: [
        `${pkg.credits} AI conversation credits`,
        `Approximately ${Math.round(pkg.credits / 1)} minutes of ${characterName}`,
        'No expiration date',
        'Use anytime',
        '24/7 customer support'
      ],
      popular: pkg.popular,
      credits: pkg.credits
    }));
  };

  // Determine what to show based on pricing model
  const shouldShowPlans = () => {
    if (pricingModel === 'subscription') {
      return !isLoading && !error && plans && plans.length > 0;
    } else {
      return !isLoading && !error; // Always show pay-as-you-go if no error
    }
  };

  // Don't render anything if loading or error
  if (isLoading || error) {
    return null;
  }

  // For subscription model, don't render if no plans
  if (pricingModel === 'subscription' && (!plans || plans.length === 0)) {
    return null;
  }

  const rawPlans = pricingModel === 'subscription' ? plans : generateCreditPackages();

  // Auto-mark the middle plan as popular if none is explicitly marked (subscription only)
  const displayPlans = rawPlans.map((plan, index) => {
    if ((plan as any).popular !== undefined) return plan; // already set (pay-as-you-go)
    const isPopular = rawPlans.length >= 2 && index === Math.floor((rawPlans.length - 1) / 2);
    return { ...plan, popular: isPopular };
  });

  // Grid layout: 1 → centered small, 2 → 2-col, 3 → 3-col, 4+ → 2-col wrap
  const gridClass =
    displayPlans.length === 1 ? 'grid-cols-1 max-w-sm' :
    displayPlans.length === 2 ? 'grid-cols-1 sm:grid-cols-2 max-w-3xl' :
    displayPlans.length === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl' :
    'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl';

  return (
    <section className="py-20 px-4 relative overflow-hidden">
      {/* Subtle top accent line */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-1 rounded-full opacity-60"
        style={{ background: gradientBg }}
      />

      <div className="container mx-auto">
        {/* Section header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-5 border"
            style={{
              color: primaryColor,
              borderColor: `${primaryColor}40`,
              background: `${primaryColor}15`,
            }}
          >
            <FiZap className="w-3.5 h-3.5" />
            {pricingModel === 'subscription' ? 'Pricing' : 'Credits'}
          </div>

          <h2 className="text-4xl font-extrabold text-white mb-4 tracking-tight">
            {pricingModel === 'subscription' ? 'Choose Your Plan' : `${characterName} Credits`}
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto text-base leading-relaxed">
            {pricingModel === 'subscription'
              ? 'Simple, transparent pricing. Pick the plan that fits your needs — upgrade or cancel anytime.'
              : `Purchase credits to use ${characterName}. Each credit represents approximately 1 minute of conversation.`
            }
          </p>

          {freeTrialEnabled && (
            <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/15 border border-emerald-500/30 rounded-full">
              <FiClock className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-300 text-sm font-medium">Free trial included</span>
            </div>
          )}
        </div>

        {/* Plan cards grid */}
        <div className={`grid gap-6 mx-auto ${gridClass}`}>
          {displayPlans.map((plan, index) => {
            const isPopular = !!(plan as any).popular;

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08, duration: 0.45 }}
                className={`relative flex flex-col rounded-2xl overflow-hidden transition-all duration-300 ${
                  isPopular
                    ? 'shadow-2xl scale-[1.03] z-10'
                    : 'shadow-md hover:shadow-xl hover:-translate-y-1'
                }`}
                style={isPopular ? { outline: `2px solid ${primaryColor}`, outlineOffset: '0px' } : {}}
              >
                {/* Popular plan: coloured top stripe */}
                {isPopular && (
                  <div className="h-1.5 w-full" style={{ background: gradientBg }} />
                )}

                {/* Card inner */}
                <div
                  className={`flex flex-col flex-1 p-7 ${themeClasses.card} ${
                    isPopular ? 'border-t-0 rounded-t-none' : ''
                  }`}
                  style={isPopular ? { borderColor: `${primaryColor}60` } : {}}
                >
                  {/* Plan name + badge row */}
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                    {isPopular && (
                      <span
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide text-white ml-2 shrink-0"
                        style={{ background: gradientBg }}
                      >
                        <FiStar className="w-3 h-3" />
                        Most Popular
                      </span>
                    )}
                  </div>

                  {plan.description && (
                    <p className="text-gray-400 text-sm mb-5 leading-relaxed">{plan.description}</p>
                  )}

                  {/* Price block */}
                  <div className="mb-5">
                    <div className="flex items-end gap-1.5">
                      <span className="text-5xl font-extrabold text-white leading-none tracking-tight">
                        {formatPrice(plan.amount, plan.currency)}
                      </span>
                      <span className="text-gray-400 text-sm mb-1">
                        {plan.interval === 'one-time' ? 'one-time' : formatInterval(plan.interval, plan.intervalCount)}
                      </span>
                    </div>

                    {'trialPeriodDays' in plan && plan.trialPeriodDays ? (
                      <div className="flex items-center gap-1.5 mt-2 text-sm font-medium" style={{ color: secondaryColor }}>
                        <FiClock className="w-3.5 h-3.5" />
                        {plan.trialPeriodDays}-day free trial included
                      </div>
                    ) : null}

                    {pricingModel === 'payasyougo' && (plan as any).credits && (
                      <div className="flex items-center gap-1.5 mt-2 text-sm" style={{ color: secondaryColor }}>
                        <FiStar className="w-3.5 h-3.5" />
                        ${payAsYouGoRate.toFixed(2)} per credit
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="border-t border-gray-700/60 mb-5" />

                  {/* Feature list */}
                  {plan.features && plan.features.length > 0 && (
                    <div className="flex-1 mb-7">
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                        What&apos;s included
                      </p>
                      <ul className="space-y-2.5">
                        {plan.features.map((feature, featureIndex) => (
                          <li key={featureIndex} className="flex items-start gap-2.5 text-sm text-gray-300">
                            <span
                              className="flex items-center justify-center w-4 h-4 rounded-full mt-0.5 shrink-0"
                              style={{ background: `${secondaryColor}25`, color: secondaryColor }}
                            >
                              <FiCheck className="w-2.5 h-2.5" />
                            </span>
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* CTA */}
                  <div className="mt-auto space-y-2">
                    <Link
                      href={pricingModel === 'subscription'
                        ? `/whitelabel/register?plan=${plan.id}`
                        : `/whitelabel/register?credits=${(plan as any).credits}`
                      }
                      className="flex items-center justify-center gap-2 w-full py-3.5 px-5 rounded-xl font-semibold text-white text-sm transition-all duration-200 hover:opacity-90 hover:scale-[1.02] active:scale-100 shadow-md"
                      style={{ background: gradientBg }}
                    >
                      <FiCreditCard className="w-4 h-4" />
                      {pricingModel === 'subscription'
                        ? (freeTrialEnabled && ('trialPeriodDays' in plan) && plan.trialPeriodDays ? 'Start Free Trial' : 'Get Started')
                        : 'Purchase Credits'
                      }
                    </Link>
                    <p className="text-center text-xs text-gray-600">
                      {pricingModel === 'subscription'
                        ? 'No setup fees · Cancel anytime'
                        : 'Secure payment · Instant delivery'
                      }
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Trust indicators */}
        {displayPlans.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-wrap items-center justify-center gap-6 mt-12 text-sm text-gray-500"
          >
            <span className="flex items-center gap-1.5">
              <FiShield className="w-4 h-4 text-gray-400" /> Secure payment
            </span>
            <span className="w-px h-4 bg-gray-700" />
            <span className="flex items-center gap-1.5">
              <FiRefreshCw className="w-4 h-4 text-gray-400" /> Cancel anytime
            </span>
            <span className="w-px h-4 bg-gray-700" />
            <span className="flex items-center gap-1.5">
              <FiCheck className="w-4 h-4 text-gray-400" /> No setup fees
            </span>
          </motion.div>
        )}

        {/* Contact footer */}
        {displayPlans.length > 0 && (
          <div className="text-center mt-10">
            <p className="text-gray-500 text-sm mb-3">
              {pricingModel === 'subscription'
                ? "Need a custom solution? We're here to help."
                : `Questions about ${characterName} credits? We're here to help.`
              }
            </p>
            <Link
              href="/whitelabel/contact"
              className={`inline-flex items-center px-5 py-2 text-gray-300 text-sm font-medium ${themeClasses.button.secondary}`}
            >
              {pricingModel === 'subscription' ? 'Contact Sales' : 'Contact Support'}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
