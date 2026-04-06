'use client';

import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  FiX,
  FiDollarSign,
  FiCreditCard,
  FiCheck,
  FiLoader,
  FiAlertCircle,
  FiStar
} from 'react-icons/fi';
import { usePartnerBranding } from '@/lib/partnerBranding';

interface CreditPlan {
  id: string;
  name: string;
  credits: number;
  priceCents: number;
  discountPercentage: number;
  isPopular: boolean;
  description?: string;
}

interface CustomerCreditPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPurchaseSuccess?: () => void;
}

const CustomerCreditPurchaseModal: React.FC<CustomerCreditPurchaseModalProps> = ({
  isOpen,
  onClose,
  onPurchaseSuccess
}) => {
  const [creditPlans, setCreditPlans] = useState<CreditPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const { branding } = usePartnerBranding();
  const primaryColor = branding.primaryColor || '#3B82F6';

  useEffect(() => {
    if (isOpen) {
      fetchCreditPlans();
    }
  }, [isOpen]);

  const fetchCreditPlans = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/whitelabel/credits/plans', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCreditPlans(data.data);
        } else {
          toast.error('Failed to load credit plans');
        }
      } else {
        toast.error('Failed to load credit plans');
      }
    } catch (error) {
      console.error('Error fetching credit plans:', error);
      toast.error('Failed to load credit plans');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (planId: string) => {
    try {
      setPurchasing(planId);
      
      const response = await fetch('/api/whitelabel/credits/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          planId,
          successUrl: `${window.location.origin}/whitelabel/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${window.location.origin}/whitelabel/billing?cancelled=true`,
        }),
      });

      const data = await response.json();

      if (data.success && data.data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.data.url;
      } else {
        toast.error(data.error || 'Failed to initiate purchase');
      }
    } catch (error) {
      console.error('Error initiating purchase:', error);
      toast.error('Failed to initiate purchase');
    } finally {
      setPurchasing(null);
    }
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const formatCredits = (credits: number) => {
    return credits.toLocaleString();
  };

  const calculateSavings = (credits: number, priceCents: number, discountPercentage: number) => {
    if (discountPercentage <= 0) return null;
    const originalPrice = (priceCents / (1 - discountPercentage / 100));
    const savings = originalPrice - priceCents;
    return formatPrice(savings);
  };

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
              className="bg-gray-900 rounded-2xl shadow-2xl border border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-700">
                <div>
                  <Dialog.Title className="text-2xl font-bold text-white">
                    Purchase AI Credits
                  </Dialog.Title>
                  <p className="text-gray-400 mt-1">
                    Choose a credit plan to power your AI features
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <FiX className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <FiLoader className="w-8 h-8 animate-spin text-gray-400" />
                  </div>
                ) : creditPlans.length === 0 ? (
                  <div className="text-center py-12">
                    <FiAlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">
                      No Credit Plans Available
                    </h3>
                    <p className="text-gray-400">
                      Your partner hasn't set up any credit plans yet.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {creditPlans.map((plan) => (
                      <motion.div
                        key={plan.id}
                        whileHover={{ scale: 1.02 }}
                        className={`relative bg-gray-800/50 rounded-xl p-6 border transition-all duration-200 ${
                          plan.isPopular 
                            ? 'border-2' 
                            : 'border border-gray-700 hover:border-gray-600'
                        }`}
                        style={plan.isPopular ? {
                          borderColor: primaryColor,
                          boxShadow: `0 0 20px ${primaryColor}20`
                        } : {}}
                      >
                        {/* Popular Badge */}
                        {plan.isPopular && (
                          <div 
                            className="absolute -top-3 left-1/2 transform -translate-x-1/2 px-3 py-1 rounded-full text-xs font-medium text-white flex items-center gap-1"
                            style={{ backgroundColor: primaryColor }}
                          >
                            <FiStar className="w-3 h-3" />
                            Most Popular
                          </div>
                        )}

                        {/* Plan Details */}
                        <div className="text-center mb-6">
                          <h3 className="text-xl font-bold text-white mb-2">
                            {plan.name}
                          </h3>
                          
                          <div className="mb-3">
                            <div 
                              className="text-3xl font-bold"
                              style={{ color: primaryColor }}
                            >
                              {formatCredits(plan.credits)}
                            </div>
                            <div className="text-sm text-gray-400">AI Credits</div>
                          </div>

                          <div className="text-2xl font-bold text-white mb-1">
                            {formatPrice(plan.priceCents)}
                          </div>

                          {plan.discountPercentage > 0 && (
                            <div className="text-sm text-green-400">
                              Save {plan.discountPercentage}% • {calculateSavings(plan.credits, plan.priceCents, plan.discountPercentage)} off
                            </div>
                          )}

                          {plan.description && (
                            <p className="text-sm text-gray-400 mt-3">
                              {plan.description}
                            </p>
                          )}
                        </div>

                        {/* Purchase Button */}
                        <button
                          onClick={() => handlePurchase(plan.id)}
                          disabled={purchasing === plan.id}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{
                            backgroundColor: plan.isPopular ? primaryColor : 'transparent',
                            color: plan.isPopular ? '#ffffff' : primaryColor,
                            border: plan.isPopular ? 'none' : `2px solid ${primaryColor}`,
                          }}
                          onMouseEnter={(e) => {
                            if (!plan.isPopular && purchasing !== plan.id) {
                              e.currentTarget.style.backgroundColor = primaryColor;
                              e.currentTarget.style.color = '#ffffff';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!plan.isPopular && purchasing !== plan.id) {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = primaryColor;
                            }
                          }}
                        >
                          {purchasing === plan.id ? (
                            <>
                              <FiLoader className="w-4 h-4 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <FiCreditCard className="w-4 h-4" />
                              Purchase Now
                            </>
                          )}
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>
      )}
    </AnimatePresence>
  );
};

export default CustomerCreditPurchaseModal;
