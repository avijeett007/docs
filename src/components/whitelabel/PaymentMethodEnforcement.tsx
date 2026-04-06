'use client';

import React, { useState, useEffect } from 'react';
import { FiCreditCard, FiAlertCircle, FiLock, FiCheck } from 'react-icons/fi';

interface PaymentMethodEnforcementProps {
  children: React.ReactNode;
  customerId: string;
}

interface BillingRequirement {
  hasActiveSubscriptions: boolean;
  hasUnpaidInvoices: boolean;
  requiresPaymentMethod: boolean;
  hasValidPaymentMethod: boolean;
}

export default function PaymentMethodEnforcement({ children, customerId }: PaymentMethodEnforcementProps) {
  const [loading, setLoading] = useState(true);
  const [billingRequirement, setBillingRequirement] = useState<BillingRequirement | null>(null);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [isRedirectingToStripe, setIsRedirectingToStripe] = useState(false);

  // Check billing requirements
  const checkBillingRequirements = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/whitelabel/billing/requirements', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to check billing requirements');
      }

      const data = await response.json();

      if (data.success) {
        setBillingRequirement(data.data);
      }
    } catch (error) {
      console.error('Error checking billing requirements:', error);
      // If we can't check requirements, allow access (fail open)
      setBillingRequirement({
        hasActiveSubscriptions: false,
        hasUnpaidInvoices: false,
        requiresPaymentMethod: false,
        hasValidPaymentMethod: true,
      });
    } finally {
      setLoading(false);
    }
  };

  // Recheck payment method status
  const recheckPaymentMethod = async () => {
    setIsCheckingPayment(true);
    await checkBillingRequirements();
    setIsCheckingPayment(false);
  };

  // Handle adding payment method via Stripe-hosted flow
  const handleAddPaymentMethod = async () => {
    setIsRedirectingToStripe(true);
    try {
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
      console.log('🔍 Setup intent response:', data);

      if (data.success) {
        // Load Stripe.js dynamically with the connected account
        const { loadStripe } = await import('@stripe/stripe-js');
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
        console.log('🔍 Redirecting to Stripe with session ID:', sessionId);
        console.log('🔍 Using Stripe account:', data.data.stripeAccountId);

        // Redirect to Stripe-hosted payment method collection
        const { error } = await stripe.redirectToCheckout({
          sessionId: sessionId,
        });

        if (error) {
          console.error('🔍 Stripe redirect error:', error);
          throw new Error(error.message);
        }
      } else {
        console.error('🔍 Setup intent creation failed:', data);
        throw new Error(data.error || 'Failed to create setup intent');
      }
    } catch (error: any) {
      console.error('Error adding payment method:', error);
      setIsRedirectingToStripe(false);
    }
  };

  useEffect(() => {
    if (customerId) {
      checkBillingRequirements();
    }
  }, [customerId]);

  // Check for return from Stripe payment method setup
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('payment_method') === 'added') {
      // Remove the query parameter from URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);

      // Re-check billing requirements after payment method was added
      // Use longer delay and multiple retries since we're checking Stripe API directly
      setTimeout(() => {
        checkBillingRequirements();
      }, 2000);

      // Retry after additional delay if still no payment method
      setTimeout(() => {
        checkBillingRequirements();
      }, 5000);
    }
  }, []);

  // Prevent common escape methods
  useEffect(() => {
    const preventEscape = (e: KeyboardEvent) => {
      // Prevent Escape key, F5 refresh, Ctrl+R refresh, etc.
      if (e.key === 'Escape' || e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    const preventBackNavigation = (e: PopStateEvent) => {
      // Push the current state back to prevent back navigation
      window.history.pushState(null, '', window.location.href);
    };

    // Add event listeners
    document.addEventListener('keydown', preventEscape, true);
    document.addEventListener('contextmenu', preventContextMenu, true);
    window.addEventListener('popstate', preventBackNavigation);

    // Push initial state to prevent back navigation
    window.history.pushState(null, '', window.location.href);

    return () => {
      document.removeEventListener('keydown', preventEscape, true);
      document.removeEventListener('contextmenu', preventContextMenu, true);
      window.removeEventListener('popstate', preventBackNavigation);
    };
  }, []);

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Checking billing requirements...</p>
        </div>
      </div>
    );
  }

  // If no billing requirements or payment method is valid, show children
  if (!billingRequirement?.requiresPaymentMethod || billingRequirement?.hasValidPaymentMethod) {
    return <>{children}</>;
  }

  // Show payment method enforcement modal with background content
  return (
    <div className="relative">
      {/* Background content (dashboard) - blurred and non-interactive */}
      <div className="pointer-events-none select-none blur-sm opacity-50">
        {children}
      </div>

      {/* Overlay modal - prevent closing with escape or clicking outside */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
        onKeyDown={(e) => e.preventDefault()}
        onClick={(e) => e.preventDefault()}
      >
        <div
          className="max-w-md w-full bg-gray-800 rounded-lg shadow-xl border border-gray-700"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="p-6">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiLock className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Payment Method Required</h2>
            <p className="text-gray-400">
              You need to add a valid payment method to continue using the platform.
            </p>
          </div>

          {/* Billing Requirements Info */}
          <div className="bg-gray-700/50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
              <FiAlertCircle className="w-5 h-5 text-amber-400" />
              Billing Requirements
            </h3>
            <div className="space-y-2 text-sm">
              {billingRequirement.hasActiveSubscriptions && (
                <div className="flex items-center gap-2 text-blue-400">
                  <FiCheck className="w-4 h-4" />
                  Active billing subscriptions detected
                </div>
              )}
              {billingRequirement.hasUnpaidInvoices && (
                <div className="flex items-center gap-2 text-amber-400">
                  <FiAlertCircle className="w-4 h-4" />
                  Unpaid invoices require payment method
                </div>
              )}
              <div className="flex items-center gap-2 text-red-400">
                <FiCreditCard className="w-4 h-4" />
                Valid payment method required for billing
              </div>
            </div>
          </div>

          {/* Payment Setup Button */}
          <div className="space-y-4">
            <button
              onClick={handleAddPaymentMethod}
              disabled={isRedirectingToStripe}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isRedirectingToStripe ? (
                <>
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                  Redirecting to Stripe...
                </>
              ) : (
                <>
                  <FiCreditCard className="w-5 h-5" />
                  Add Payment Method
                </>
              )}
            </button>

            <button
              onClick={recheckPaymentMethod}
              disabled={isCheckingPayment}
              className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              {isCheckingPayment ? 'Checking...' : 'I\'ve Added Payment Method'}
            </button>
          </div>

          {/* Help Text */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Your payment information is securely processed by Stripe and never stored on our servers.
            </p>
          </div>
          </div>
        </div>
      </div>


    </div>
  );
}
