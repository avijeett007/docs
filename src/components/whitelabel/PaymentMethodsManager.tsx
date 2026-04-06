'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  FiCreditCard,
  FiPlus,
  FiTrash2,
  FiCheck,
  FiStar,
  FiLoader,
  FiAlertCircle
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { usePartnerBranding } from '@/lib/partnerBranding';
import { PortalTheme, getThemeConfig } from '@/lib/portalThemes';

interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account';
  lastFour?: string;
  brand?: string;
  expMonth?: number;
  expYear?: number;
  bankName?: string;
  accountType?: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
}

interface PaymentMethodsManagerProps {
  onPaymentMethodAdded?: (paymentMethod: PaymentMethod) => void;
  showAddButton?: boolean;
  className?: string;
}

export default function PaymentMethodsManager({
  onPaymentMethodAdded,
  showAddButton = true,
  className = '',
}: PaymentMethodsManagerProps) {
  const { branding } = usePartnerBranding();
  const theme = (branding.themePreference as PortalTheme) || PortalTheme.MODERN;
  const themeConfig = getThemeConfig(theme);

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingPaymentMethod, setIsAddingPaymentMethod] = useState(false);
  const [processingPaymentMethodId, setProcessingPaymentMethodId] = useState<string | null>(null);

  // Fetch payment methods
  const fetchPaymentMethods = async () => {
    try {
      const response = await fetch('/api/whitelabel/payment-methods', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch payment methods');
      }

      const data = await response.json();
      if (data.success) {
        setPaymentMethods(data.data.paymentMethods);
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      toast.error('Failed to load payment methods');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentMethods();
  }, []);

  // Handle return from Stripe payment method setup
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('payment_method') === 'added') {
      // Remove the query parameter from URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);

      // Re-fetch payment methods with retries since we're checking Stripe API directly
      const refetchWithRetry = async (attempt = 1) => {
        await fetchPaymentMethods();

        // If no payment methods found and we haven't exceeded max attempts, retry
        if (paymentMethods.length === 0 && attempt < 3) {
          setTimeout(() => refetchWithRetry(attempt + 1), 2000);
        } else if (paymentMethods.length > 0) {
          toast.success('Payment method added successfully!');
        }
      };

      setTimeout(() => refetchWithRetry(), 1000);
    }
  }, []);

  // Add new payment method
  const handleAddPaymentMethod = async () => {
    setIsAddingPaymentMethod(true);
    try {
      // Create setup intent
      const response = await fetch('/api/whitelabel/payment-methods', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'create_setup_intent',
          returnUrl: `${window.location.origin}${window.location.pathname}?payment_method=added`,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create setup intent');
      }

      const data = await response.json();

      if (data.success) {
        // Load Stripe.js with connected account
        const stripe = await loadStripe(
          process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
          {
            stripeAccount: data.data.stripeAccountId,
          }
        );

        if (!stripe) {
          throw new Error('Failed to load Stripe');
        }

        const sessionId = data.data.sessionId || data.data.setupIntentId;

        // Redirect to Stripe-hosted payment method collection
        const { error } = await stripe.redirectToCheckout({
          sessionId: sessionId,
        });

        if (error) {
          throw new Error(error.message);
        }
      } else {
        throw new Error(data.error || 'Failed to create setup intent');
      }
    } catch (error: any) {
      console.error('Error adding payment method:', error);
      toast.error(error.message || 'Failed to add payment method');
    } finally {
      setIsAddingPaymentMethod(false);
    }
  };

  // Set payment method as default
  const handleSetDefault = async (paymentMethodId: string) => {
    setProcessingPaymentMethodId(paymentMethodId);
    try {
      const response = await fetch(`/api/whitelabel/payment-methods/${paymentMethodId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'set_default',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to set default payment method');
      }

      const data = await response.json();
      if (data.success) {
        toast.success('Default payment method updated');
        await fetchPaymentMethods(); // Refresh list
      }
    } catch (error: any) {
      console.error('Error setting default payment method:', error);
      toast.error(error.message || 'Failed to update default payment method');
    } finally {
      setProcessingPaymentMethodId(null);
    }
  };

  // Delete payment method
  const handleDelete = async (paymentMethodId: string) => {
    if (!confirm('Are you sure you want to delete this payment method?')) {
      return;
    }

    setProcessingPaymentMethodId(paymentMethodId);
    try {
      const response = await fetch(`/api/whitelabel/payment-methods/${paymentMethodId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete payment method');
      }

      const data = await response.json();
      if (data.success) {
        toast.success('Payment method deleted');
        await fetchPaymentMethods(); // Refresh list
      }
    } catch (error: any) {
      console.error('Error deleting payment method:', error);
      toast.error(error.message || 'Failed to delete payment method');
    } finally {
      setProcessingPaymentMethodId(null);
    }
  };

  // Format card brand
  const formatCardBrand = (brand?: string) => {
    if (!brand) return 'Card';
    return brand.charAt(0).toUpperCase() + brand.slice(1);
  };

  // Get card icon
  const getCardIcon = (brand?: string) => {
    // You can add specific card brand icons here
    return <FiCreditCard className="w-5 h-5" />;
  };

  if (isLoading) {
    return (
      <div className={`${className}`}>
        <div className="flex items-center justify-center py-8">
          <FiLoader className="w-6 h-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-400">Loading payment methods...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        {showAddButton && (
          <button
            onClick={handleAddPaymentMethod}
            disabled={isAddingPaymentMethod}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white transition-all hover:opacity-90 disabled:opacity-50"
            style={{
              background: `linear-gradient(to right, ${branding.primaryColor}, ${branding.secondaryColor || branding.primaryColor})`,
            }}
          >
            {isAddingPaymentMethod ? (
              <FiLoader className="w-4 h-4 animate-spin" />
            ) : (
              <FiPlus className="w-4 h-4" />
            )}
            Add Payment Method
          </button>
        )}
      </div>

      {/* Payment Methods List */}
      {paymentMethods.length === 0 ? (
        <div className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-xl p-8 text-center`}>
          <FiCreditCard className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-white mb-2">No Payment Methods</h4>
          <p className="text-gray-400 mb-4">
            Add a payment method to enable automatic billing for your invoices.
          </p>
          {showAddButton && (
            <button
              onClick={handleAddPaymentMethod}
              disabled={isAddingPaymentMethod}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white transition-all hover:opacity-90 disabled:opacity-50"
              style={{
                background: `linear-gradient(to right, ${branding.primaryColor}, ${branding.secondaryColor || branding.primaryColor})`,
              }}
            >
              {isAddingPaymentMethod ? (
                <FiLoader className="w-4 h-4 animate-spin" />
              ) : (
                <FiPlus className="w-4 h-4" />
              )}
              Add Your First Payment Method
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {paymentMethods.map((paymentMethod) => (
              <motion.div
                key={paymentMethod.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-xl p-4 hover:border-gray-600 transition-colors`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-800 rounded-lg">
                      {getCardIcon(paymentMethod.brand)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">
                          {paymentMethod.type === 'card' 
                            ? `${formatCardBrand(paymentMethod.brand)} •••• ${paymentMethod.lastFour}`
                            : `${paymentMethod.bankName} •••• ${paymentMethod.lastFour}`
                          }
                        </span>
                        {paymentMethod.isDefault && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">
                            <FiStar className="w-3 h-3" />
                            Default
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-400">
                        {paymentMethod.type === 'card' && paymentMethod.expMonth && paymentMethod.expYear
                          ? `Expires ${paymentMethod.expMonth.toString().padStart(2, '0')}/${paymentMethod.expYear}`
                          : paymentMethod.type === 'bank_account' && paymentMethod.accountType
                          ? `${paymentMethod.accountType} account`
                          : 'Payment method'
                        }
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {!paymentMethod.isDefault && (
                      <button
                        onClick={() => handleSetDefault(paymentMethod.id)}
                        disabled={processingPaymentMethodId === paymentMethod.id}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                        title="Set as default"
                      >
                        {processingPaymentMethodId === paymentMethod.id ? (
                          <FiLoader className="w-4 h-4 animate-spin" />
                        ) : (
                          <FiStar className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(paymentMethod.id)}
                      disabled={processingPaymentMethodId === paymentMethod.id}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                      title="Delete payment method"
                    >
                      {processingPaymentMethodId === paymentMethod.id ? (
                        <FiLoader className="w-4 h-4 animate-spin" />
                      ) : (
                        <FiTrash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Info Message */}
      {paymentMethods.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <FiAlertCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="text-blue-400 font-medium mb-1">Auto-Charge Enabled</p>
            <p className="text-blue-300">
              Your default payment method will be automatically charged when new invoices are created. 
              You can still pay manually if auto-charge fails.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to load Stripe.js
async function loadStripe(publishableKey: string, options?: any) {
  const { loadStripe: stripeLoadStripe } = await import('@stripe/stripe-js');
  return stripeLoadStripe(publishableKey, options);
}
