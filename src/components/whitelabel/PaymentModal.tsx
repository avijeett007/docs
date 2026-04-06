'use client';

import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  AddressElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiX,
  FiCreditCard,
  FiLock,
  FiMapPin
} from 'react-icons/fi';
import { toast } from 'sonner';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

// SECURITY: Completely removed Stripe key logging to prevent any potential exposure
// Stripe configuration validation is handled server-side

interface Invoice {
  id: string;
  invoiceNumber: string;
  title: string;
  description?: string;
  amount: number;
  currency: string;
  partner: {
    businessName: string;
    email: string;
  };
  dueDate?: string;
  createdAt: string;
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice;
  onPaymentSuccess: () => void;
  onPaymentError: (error: string) => void;
}

// Component to handle payment intent creation and pass clientSecret to Elements
const PaymentWrapper: React.FC<{
  invoice: Invoice;
  onPaymentSuccess: () => void;
  onPaymentError: (error: string) => void;
  onClose: () => void;
}> = ({ invoice, onPaymentSuccess, onPaymentError, onClose }) => {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Create payment intent when component mounts
    const createPaymentIntent = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/whitelabel/billing/invoices/${invoice.id}/pay`, {
          method: 'POST',
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to create payment intent');
        }

        const data = await response.json();
        if (data.success) {
          setClientSecret(data.data.clientSecret);
        } else {
          throw new Error(data.error || 'Failed to create payment intent');
        }
      } catch (error) {
        console.error('Error creating payment intent:', error);
        onPaymentError('Failed to initialize payment');
      } finally {
        setIsLoading(false);
      }
    };

    createPaymentIntent();
  }, [invoice.id, onPaymentError]);

  // Elements options for modern Stripe integration
  const elementsOptions = {
    clientSecret: clientSecret || undefined,
    appearance: {
      theme: 'night' as const,
      variables: {
        colorPrimary: '#3B82F6',
        colorBackground: '#1F2937',
        colorText: '#F9FAFB',
        colorDanger: '#EF4444',
        fontFamily: 'Inter, system-ui, sans-serif',
        spacingUnit: '4px',
        borderRadius: '8px',
      },
      rules: {
        '.Input': {
          backgroundColor: '#374151',
          border: '1px solid #4B5563',
          color: '#F9FAFB',
        },
        '.Input:focus': {
          border: '1px solid #3B82F6',
          boxShadow: '0 0 0 1px #3B82F6',
        },
        '.Label': {
          color: '#D1D5DB',
          fontWeight: '500',
        },
      },
    },
    loader: 'auto' as const,
  };

  // Show loading state while creating payment intent
  if (isLoading || !clientSecret) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-300">Initializing payment...</span>
      </div>
    );
  }

  // Render Elements wrapper with clientSecret
  return (
    <Elements stripe={stripePromise} options={elementsOptions}>
      <PaymentForm
        invoice={invoice}
        clientSecret={clientSecret}
        onPaymentSuccess={onPaymentSuccess}
        onPaymentError={onPaymentError}
        onClose={onClose}
      />
    </Elements>
  );
};

const PaymentForm: React.FC<{
  invoice: Invoice;
  clientSecret: string;
  onPaymentSuccess: () => void;
  onPaymentError: (error: string) => void;
  onClose: () => void;
}> = ({ invoice, clientSecret, onPaymentSuccess, onPaymentError, onClose }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements || !clientSecret) {
      return;
    }

    setIsProcessing(true);

    try {
      console.log('🔄 Starting payment confirmation process...');
      console.log('Client Secret:', clientSecret ? 'Present' : 'Missing');
      console.log('Stripe:', stripe ? 'Loaded' : 'Missing');
      console.log('Elements:', elements ? 'Loaded' : 'Missing');

      // First, submit the elements to validate the form
      console.log('📝 Submitting payment form for validation...');
      const { error: submitError } = await elements.submit();

      if (submitError) {
        console.error('❌ Form validation failed:', submitError);
        onPaymentError(submitError.message || 'Please check your payment details');
        setIsProcessing(false);
        return;
      }
      console.log('✅ Form validation passed');

      // Then confirm payment using the modern Payment Element
      console.log('💳 Confirming payment with Stripe...');
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/whitelabel/billing?payment=success`,
        },
        redirect: 'if_required', // Only redirect if required by payment method
      });

      console.log('🔍 Payment confirmation result:', { error, paymentIntent });

      if (error) {
        console.error('Payment failed:', error);
        onPaymentError(error.message || 'Payment failed');
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        console.log('Payment succeeded:', paymentIntent);

        // Immediately mark invoice as processing to prevent double payments
        try {
          console.log('🔄 Marking invoice as processing to prevent double payment...');
          console.log('Invoice ID:', invoice.id);
          console.log('Payment Intent ID:', paymentIntent.id);

          const response = await fetch(`/api/whitelabel/billing/invoices/${invoice.id}/mark-processing`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('whitelabelToken')}`,
            },
            body: JSON.stringify({
              paymentIntentId: paymentIntent.id,
            }),
          });

          if (response.ok) {
            console.log('✅ Invoice marked as processing successfully');
            toast.success('Payment successful! Your invoice is being processed.');
          } else {
            console.warn('⚠️ Failed to mark invoice as processing, but payment succeeded');
            toast.success('Payment successful! Your invoice will be updated shortly.');
          }
        } catch (error) {
          console.error('Error marking invoice as processing:', error);
          toast.success('Payment successful! Your invoice will be updated shortly.');
        }

        onPaymentSuccess();
      } else if (paymentIntent && paymentIntent.status === 'processing') {
        console.log('Payment is processing:', paymentIntent);

        // Also mark as processing for payment methods that require time
        try {
          console.log('🔄 Marking processing payment as processing...');
          console.log('Invoice ID:', invoice.id);
          console.log('Payment Intent ID:', paymentIntent.id);

          await fetch(`/api/whitelabel/billing/invoices/${invoice.id}/mark-processing`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('whitelabelToken')}`,
            },
            body: JSON.stringify({
              paymentIntentId: paymentIntent.id,
            }),
          });
        } catch (error) {
          console.error('Error marking processing payment:', error);
        }

        toast.info('Payment is being processed...');
        onPaymentSuccess(); // Close modal, payment will be confirmed via webhook
      } else if (paymentIntent && paymentIntent.status === 'requires_action') {
        console.log('Payment requires additional action:', paymentIntent);
        toast.info('Please complete the additional verification steps');
      } else {
        // Handle unexpected status or missing paymentIntent
        console.error('Unexpected payment result:', { error, paymentIntent });
        if (paymentIntent) {
          console.error('Payment Intent status:', paymentIntent.status);
          toast.error(`Payment status: ${paymentIntent.status}. Please try again or contact support.`);
        } else {
          console.error('No payment intent returned from confirmPayment');
          toast.error('Payment confirmation failed. Please try again.');
        }
        onPaymentError('Payment confirmation failed');
      }
    } catch (error) {
      console.error('Payment error:', error);
      onPaymentError('Payment processing failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatAmount = (amount: number) => {
    return `$${(amount / 100).toFixed(2)}`;
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Invoice Details */}
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-3">Invoice Details</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Invoice #:</span>
            <span className="text-white">{invoice.invoiceNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Title:</span>
            <span className="text-white">{invoice.title}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">From:</span>
            <span className="text-white">{invoice.partner.businessName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Amount:</span>
            <span className="text-white font-semibold">{formatAmount(invoice.amount)}</span>
          </div>
          {invoice.dueDate && (
            <div className="flex justify-between">
              <span className="text-gray-400">Due Date:</span>
              <span className="text-white">{formatDate(invoice.dueDate)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Payment Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Payment Method */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">
            <FiCreditCard className="inline w-4 h-4 mr-2" />
            Payment Method
          </label>
          <div className="bg-gray-800 border border-gray-600 rounded-lg p-4">
            <PaymentElement
              options={{
                layout: 'tabs',
                paymentMethodOrder: ['card', 'apple_pay', 'google_pay'],
                fields: {
                  billingDetails: {
                    name: 'auto',
                    email: 'auto',
                    phone: 'auto',
                    address: {
                      country: 'auto',
                      line1: 'auto',
                      line2: 'auto',
                      city: 'auto',
                      state: 'auto',
                      postalCode: 'auto',
                    },
                  },
                },
                terms: {
                  card: 'auto',
                },
              }}
            />
          </div>
        </div>

        {/* Billing Address */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">
            <FiMapPin className="inline w-4 h-4 mr-2" />
            Billing Address
          </label>
          <div className="bg-gray-800 border border-gray-600 rounded-lg p-4">
            <AddressElement
              options={{
                mode: 'billing',
                allowedCountries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'CH', 'AT', 'SE', 'NO', 'DK', 'FI', 'IE', 'PT', 'LU', 'GR', 'CY', 'MT', 'SI', 'SK', 'EE', 'LV', 'LT', 'PL', 'CZ', 'HU', 'RO', 'BG', 'HR'],
                fields: {
                  phone: 'never',
                },
              }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-400">
          <FiLock className="w-4 h-4" />
          <span>Your payment and personal information is secure and encrypted</span>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!stripe || isProcessing}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-lg hover:from-blue-600 hover:to-teal-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                Processing...
              </>
            ) : (
              <>
                <FiCreditCard className="w-4 h-4" />
                Pay {formatAmount(invoice.amount)}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default function PaymentModal({
  isOpen,
  onClose,
  invoice,
  onPaymentSuccess,
  onPaymentError,
}: PaymentModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">Pay Invoice</h2>
                <button
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              <PaymentWrapper
                invoice={invoice}
                onPaymentSuccess={onPaymentSuccess}
                onPaymentError={onPaymentError}
                onClose={onClose}
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
