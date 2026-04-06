'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiCreditCard, FiCheck, FiDollarSign } from 'react-icons/fi';
import { usePartnerBranding } from '@/lib/partnerBranding';

interface PaymentSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPlan?: any;
  onPaymentSuccess?: () => void;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  amount: number;
  interval: string;
  description: string;
  features: string;
}

const PaymentSetupModal: React.FC<PaymentSetupModalProps> = ({
  isOpen,
  onClose,
  selectedPlan,
  onPaymentSuccess
}) => {
  const { branding } = usePartnerBranding();
  const [loading, setLoading] = useState(false);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  const [currentSelectedPlan, setCurrentSelectedPlan] = useState<string | null>(selectedPlan?.id || null);
  const [pricingModel, setPricingModel] = useState<'subscription' | 'payasyougo'>('subscription');

  // Fetch subscription plans and pricing model
  useEffect(() => {
    if (isOpen) {
      fetchPricingInfo();
    }
  }, [isOpen]);

  const fetchPricingInfo = async () => {
    try {
      // Get branding info to determine pricing model
      const brandingResponse = await fetch('/api/whitelabel/branding');
      if (brandingResponse.ok) {
        const brandingData = await brandingResponse.json();
        setPricingModel(brandingData.pricingModel || 'subscription');
        
        // If subscription model, fetch plans
        if (brandingData.pricingModel === 'subscription') {
          const subdomain = window.location.hostname.split('.')[0];
          const plansResponse = await fetch(`/api/whitelabel/subscription-plans/${subdomain}`);
          if (plansResponse.ok) {
            const plans = await plansResponse.json();
            setSubscriptionPlans(plans);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching pricing info:', error);
    }
  };

  const handleSubscriptionPayment = async (planId: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/whitelabel/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId,
          successUrl: `${window.location.origin}/whitelabel/dashboard?payment=success`,
          cancelUrl: `${window.location.origin}/whitelabel/dashboard?payment=cancelled`,
        }),
      });

      if (response.ok) {
        const { url } = await response.json();
        window.location.href = url;
      } else {
        throw new Error('Failed to create checkout session');
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      alert('Failed to process payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreditPurchase = async (creditAmount: number) => {
    setLoading(true);
    try {
      const response = await fetch('/api/whitelabel/purchase-credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          creditAmount,
          successUrl: `${window.location.origin}/whitelabel/dashboard?payment=success`,
          cancelUrl: `${window.location.origin}/whitelabel/dashboard?payment=cancelled`,
        }),
      });

      if (response.ok) {
        const { url } = await response.json();
        window.location.href = url;
      } else {
        throw new Error('Failed to create credit purchase session');
      }
    } catch (error) {
      console.error('Error purchasing credits:', error);
      alert('Failed to process payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-700">
            <h2 className="text-2xl font-bold text-white">Complete Payment Setup</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <FiX className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            <p className="text-gray-300 mb-6">
              Choose your payment option to activate your AI assistant and access your phone number.
            </p>

            {/* Subscription Plans */}
            {pricingModel === 'subscription' && subscriptionPlans.length > 0 && (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-6">
                {subscriptionPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className={`border-2 rounded-xl p-6 cursor-pointer transition-all duration-300 ${
                      currentSelectedPlan === plan.id
                        ? 'border-blue-500 bg-blue-900/20'
                        : 'border-gray-600 hover:border-gray-500'
                    }`}
                    onClick={() => setCurrentSelectedPlan(plan.id)}
                  >
                    <div className="text-center">
                      <h4 className="text-lg font-semibold text-white mb-2">{plan.name}</h4>
                      <div className="mb-4">
                        <span className="text-3xl font-bold text-white">
                          ${(plan.amount / 100).toFixed(2)}
                        </span>
                        <span className="text-gray-400">/{plan.interval}</span>
                      </div>
                      <p className="text-sm text-gray-400 mb-4">{plan.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pay-as-you-go Option */}
            {pricingModel === 'payasyougo' && (
              <div className="max-w-md mx-auto mb-6">
                <div className="border-2 border-gray-600 rounded-xl p-6 text-center">
                  <FiDollarSign className="text-4xl text-blue-500 mx-auto mb-4" />
                  <h4 className="text-lg font-semibold text-white mb-2">Pay-as-you-go</h4>
                  <div className="mb-4">
                    <span className="text-2xl font-bold text-white">
                      ${branding.payAsYouGoRate?.toFixed(2) || '0.10'}
                    </span>
                    <span className="text-gray-400"> per AI credit</span>
                  </div>
                  <p className="text-sm text-gray-400 mb-4">
                    1 AI Credit = 1 Minute of conversation. Only pay for what you use.
                  </p>

                  <div className="space-y-3">
                    {[100, 500, 1000].map((credits) => {
                      const cost = (credits * (branding.payAsYouGoRate || 0.10)).toFixed(2);
                      return (
                        <button
                          key={credits}
                          onClick={() => handleCreditPurchase(credits)}
                          disabled={loading}
                          className="w-full py-2 px-4 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                          {loading ? 'Processing...' : `Buy ${credits} AI Credits ($${cost})`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-4 pt-6 border-t border-gray-700">
              <button
                onClick={onClose}
                className="px-6 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>

              {pricingModel === 'subscription' && currentSelectedPlan && (
                <button
                  onClick={() => handleSubscriptionPayment(currentSelectedPlan)}
                  disabled={loading}
                  className="inline-flex items-center px-6 py-2 rounded-lg font-semibold text-white transition-all duration-300 hover:shadow-lg disabled:opacity-50"
                  style={{
                    background: `linear-gradient(135deg, ${branding?.primaryColor || '#3B82F6'}, ${branding?.secondaryColor || '#8B5CF6'})`
                  }}
                >
                  <FiCreditCard className="mr-2" />
                  {loading ? 'Processing...' : 'Continue to Payment'}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default PaymentSetupModal;
