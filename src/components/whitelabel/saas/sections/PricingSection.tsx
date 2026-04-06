'use client';

import { motion } from 'framer-motion';
import { FiCheck, FiStar, FiZap, FiShield } from 'react-icons/fi';
import { PartnerBranding } from '@/types/partner';

interface PricingSectionProps {
  branding: PartnerBranding;
  getTranslation: (key: string, fallback?: string) => string;
}

export default function PricingSection({ branding, getTranslation }: PricingSectionProps) {
  // Only show pricing section if fixed price is configured
  if (branding.pricingModel !== 'fixedprice' || !branding.fixedPrice || branding.fixedPrice <= 0) {
    return null;
  }

  // Parse features from the features string (one per line)
  const features = branding.fixedPriceFeatures
    ? branding.fixedPriceFeatures.split('\n').filter(f => f.trim())
    : [];

  // Currency symbols mapping
  const currencySymbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    CAD: '$',
    AUD: '$',
    INR: '₹',
    JPY: '¥',
  };

  const currencySymbol = currencySymbols[branding.fixedPriceCurrency || 'USD'] || '$';

  // Period display mapping
  const periodDisplay: Record<string, string> = {
    month: 'per month',
    year: 'per year',
    'one-time': 'one-time payment',
  };

  const period = periodDisplay[branding.fixedPricePeriod || 'month'] || 'per month';

  const handleGetStarted = () => {
    window.location.href = '/platform/onboarding/1';
  };

  // Get theme colors with fallbacks
  const primaryColor = branding.primaryColor || '#3B82F6';
  const secondaryColor = branding.secondaryColor || '#8B5CF6';

  // Helper to convert hex to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 59, g: 130, b: 246 };
  };

  const primaryRgb = hexToRgb(primaryColor);
  const secondaryRgb = hexToRgb(secondaryColor);

  return (
    <section id="pricing" className="py-16 px-4 relative overflow-hidden bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Subtle Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
        <div
          className="absolute top-10 left-1/4 w-64 h-64 rounded-full blur-3xl"
          style={{ background: `radial-gradient(circle, rgba(${primaryRgb.r},${primaryRgb.g},${primaryRgb.b},0.15) 0%, transparent 70%)` }}
        />
        <div
          className="absolute bottom-10 right-1/4 w-64 h-64 rounded-full blur-3xl"
          style={{
            background: `radial-gradient(circle, rgba(${secondaryRgb.r},${secondaryRgb.g},${secondaryRgb.b},0.15) 0%, transparent 70%)`
          }}
        />
      </div>

      <div className="container mx-auto max-w-5xl relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-gray-200 mb-4 shadow-sm">
            <FiStar style={{ color: primaryColor }} className="text-sm" />
            <span className="text-xs font-semibold text-gray-700">
              {getTranslation('pricing.badge', 'Premium AI Solution')}
            </span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            {getTranslation('pricing.title', 'Simple, Transparent Pricing')}
          </h2>
          <p className="text-base text-gray-600 max-w-2xl mx-auto">
            {getTranslation('pricing.subtitle', 'Get started with our AI receptionist today. No hidden fees, no surprises.')}
          </p>
        </motion.div>

        {/* Pricing Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="max-w-lg mx-auto"
        >
          <div className="relative group">
            {/* Subtle glow effect */}
            <div
              className="absolute -inset-0.5 rounded-2xl opacity-20 group-hover:opacity-30 blur-lg transition-opacity duration-300"
              style={{
                background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
              }}
            />

            <div className="relative bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
              {/* Premium Badge */}
              <div
                className="py-2.5 text-center text-white font-semibold text-xs tracking-wide"
                style={{
                  background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
                }}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <FiZap className="text-yellow-300 text-sm" />
                  {getTranslation('pricing.popular', 'MOST POPULAR PLAN')}
                </div>
              </div>

              <div className="p-8">
                {/* Price Display */}
                <div className="text-center mb-8">
                  <div className="mb-4">
                    <div className="flex items-baseline justify-center gap-1 mb-2">
                      <span className="text-5xl md:text-6xl font-bold text-gray-900">
                        {currencySymbol}{branding.fixedPrice}
                      </span>
                      {branding.fixedPricePeriod !== 'one-time' && (
                        <span className="text-xl text-gray-500 font-medium">
                          /{branding.fixedPricePeriod}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 text-sm font-medium">
                      {period}
                    </p>
                  </div>
                </div>

                {/* Features List */}
                {features.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-gray-900 text-center mb-6">
                      {getTranslation('pricing.featuresTitle', 'Everything You Need')}
                    </h3>
                    <div className="grid md:grid-cols-2 gap-3">
                      {features.map((feature, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -10 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.3, delay: 0.03 * index }}
                          className="flex items-start gap-2.5 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors duration-200"
                        >
                          <div
                            className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center mt-0.5"
                            style={{
                              background: `${primaryColor}15`,
                              borderColor: primaryColor,
                              borderWidth: '1px'
                            }}
                          >
                            <FiCheck
                              className="text-xs"
                              style={{ color: primaryColor }}
                            />
                          </div>
                          <span className="text-gray-700 text-sm leading-relaxed">
                            {feature.trim()}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Free Trial Badge */}
                {branding.freeTrialEnabled && branding.freeAiCredits && (
                  <div className="mb-6">
                    <div
                      className="relative overflow-hidden rounded-xl p-[1px]"
                      style={{
                        background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
                      }}
                    >
                      <div className="relative bg-white rounded-xl p-3.5">
                        <div className="flex items-center justify-center gap-2.5">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center"
                            style={{ background: `${primaryColor}10` }}
                          >
                            <span className="text-xl">🎉</span>
                          </div>
                          <p className="text-gray-900 font-semibold text-sm">
                            Start with <span style={{ color: primaryColor }}>{branding.freeAiCredits} free AI credits</span> to test!
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* CTA Button */}
                <button
                  onClick={handleGetStarted}
                  className="group/btn relative w-full py-3.5 px-6 text-white font-semibold text-base rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
                  }}
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {branding.freeTrialEnabled
                      ? getTranslation('pricing.cta.free', 'Start Free Trial')
                      : getTranslation('pricing.cta.start', 'Get Started Now')
                    }
                    <FiZap className="text-sm group-hover/btn:rotate-12 transition-transform" />
                  </span>
                </button>

                <p className="text-center text-xs text-gray-500 mt-3">
                  {getTranslation('pricing.noCard', '✓ No credit card required to start')}
                </p>

                {/* Trust Indicators */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-600">
                    <div className="flex items-center gap-1.5">
                      <FiCheck style={{ color: primaryColor }} className="text-sm" />
                      <span>Cancel anytime</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <FiShield style={{ color: primaryColor }} className="text-sm" />
                      <span>Secure & Private</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <FiStar style={{ color: primaryColor }} className="text-sm" />
                      <span>24/7 Support</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Additional Info */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-center mt-8"
        >
          <p className="text-gray-600 text-sm">
            {getTranslation('pricing.questions', 'Have questions? Contact our sales team for custom solutions.')}
          </p>
        </motion.div>
      </div>
    </section>
  );
}
