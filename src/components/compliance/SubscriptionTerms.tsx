'use client';

import React from 'react';
import { FiShield, FiCreditCard, FiRefreshCw, FiX, FiCheck, FiInfo } from 'react-icons/fi';

interface SubscriptionTermsProps {
  planName: string;
  amount: number;
  currency: string;
  billingInterval: 'monthly' | 'yearly' | 'lifetime';
  onAccept: () => void;
  onDecline: () => void;
  isLoading?: boolean;
}

export default function SubscriptionTerms({
  planName,
  amount,
  currency,
  billingInterval,
  onAccept,
  onDecline,
  isLoading = false,
}: SubscriptionTermsProps) {
  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const getBillingDescription = () => {
    switch (billingInterval) {
      case 'monthly':
        return 'monthly recurring payment';
      case 'yearly':
        return 'annual recurring payment';
      case 'lifetime':
        return 'one-time payment';
      default:
        return 'payment';
    }
  };

  const getNextBillingDate = () => {
    const now = new Date();
    if (billingInterval === 'monthly') {
      now.setMonth(now.getMonth() + 1);
    } else if (billingInterval === 'yearly') {
      now.setFullYear(now.getFullYear() + 1);
    }
    return now.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="bg-gray-800 rounded-xl p-6 max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <FiShield className="w-8 h-8 text-blue-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Subscription Terms & Conditions</h2>
        <p className="text-gray-400">
          Please review and accept the terms for your {planName} subscription
        </p>
      </div>

      {/* Merchant Information - PSD2 Requirement */}
      <div className="bg-gray-700/50 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <FiInfo className="w-5 h-5 text-blue-400" />
          Merchant Information
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Merchant Name:</span>
            <span className="text-white">Knotie AI Pro</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Business Address:</span>
            <span className="text-white">United States</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Contact Email:</span>
            <span className="text-white">support@knotie-ai.pro</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Payment Processor:</span>
            <span className="text-white">Stripe, Inc.</span>
          </div>
        </div>
      </div>

      {/* Subscription Details - PSD2 Requirement */}
      <div className="bg-gray-700/50 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <FiCreditCard className="w-5 h-5 text-green-400" />
          Subscription Details
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Plan:</span>
            <span className="text-white font-medium">{planName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Amount:</span>
            <span className="text-white font-medium text-lg">
              {formatAmount(amount, currency)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Billing Frequency:</span>
            <span className="text-white font-medium capitalize">
              {getBillingDescription()}
            </span>
          </div>
          {billingInterval !== 'lifetime' && (
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Next Billing Date:</span>
              <span className="text-white font-medium">{getNextBillingDate()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Recurring Payment Terms - PSD2 Requirement */}
      {billingInterval !== 'lifetime' && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-yellow-400 mb-3 flex items-center gap-2">
            <FiRefreshCw className="w-5 h-5" />
            Recurring Payment Authorization
          </h3>
          <div className="space-y-2 text-sm text-yellow-200">
            <p>
              <strong>By subscribing, you authorize Knotie AI Pro to:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Charge your payment method {formatAmount(amount, currency)} every {billingInterval === 'monthly' ? 'month' : 'year'}</li>
              <li>Continue charging until you cancel your subscription</li>
              <li>Send you email notifications before each billing cycle</li>
              <li>Update your payment method if provided by your bank</li>
            </ul>
            <p className="mt-3">
              <strong>You can cancel anytime</strong> by visiting your account settings or contacting support.
              Cancellation will take effect at the end of your current billing period.
            </p>
          </div>
        </div>
      )}

      {/* Cancellation Rights - PSD2 Requirement */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold text-blue-400 mb-3 flex items-center gap-2">
          <FiX className="w-5 h-5" />
          Your Cancellation Rights
        </h3>
        <div className="space-y-2 text-sm text-blue-200">
          <p>You have the right to:</p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Cancel your subscription at any time without penalty</li>
            <li>Receive email reminders 7 and 3 days before renewal</li>
            <li>Access your account and data until the end of your billing period</li>
            <li>Request a refund within 14 days of initial purchase (EU customers)</li>
            <li>Export your data before cancellation</li>
          </ul>
          <p className="mt-3">
            <strong>To cancel:</strong> Visit Settings → Subscription & Billing → Cancel Subscription
            or email support@knotie-ai.pro
          </p>
        </div>
      </div>

      {/* Data Protection - GDPR Compliance */}
      <div className="bg-gray-700/50 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <FiShield className="w-5 h-5 text-purple-400" />
          Data Protection & Privacy
        </h3>
        <div className="space-y-2 text-sm text-gray-300">
          <p>Your payment information is:</p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Processed securely by Stripe (PCI DSS Level 1 certified)</li>
            <li>Never stored on our servers</li>
            <li>Protected by industry-standard encryption</li>
            <li>Subject to our Privacy Policy and Terms of Service</li>
          </ul>
          <p className="mt-3">
            By subscribing, you acknowledge that you have read and agree to our{' '}
            <a href="/privacy-policy" className="text-blue-400 hover:text-blue-300 underline">
              Privacy Policy
            </a>{' '}
            and{' '}
            <a href="/terms-of-service" className="text-blue-400 hover:text-blue-300 underline">
              Terms of Service
            </a>.
          </p>
        </div>
      </div>

      {/* Strong Customer Authentication Notice */}
      <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold text-green-400 mb-2 flex items-center gap-2">
          <FiCheck className="w-5 h-5" />
          Secure Payment Processing
        </h3>
        <p className="text-sm text-green-200">
          This payment is processed using Strong Customer Authentication (SCA) as required by PSD2.
          You may be asked to verify your identity with your bank during checkout.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={onDecline}
          disabled={isLoading}
          className="flex-1 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors disabled:opacity-50"
        >
          Decline
        </button>
        <button
          onClick={onAccept}
          disabled={isLoading}
          className="flex-1 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <FiCheck className="w-4 h-4" />
              Accept & Subscribe
            </>
          )}
        </button>
      </div>

      {/* Legal Footer */}
      <div className="mt-6 pt-4 border-t border-gray-700">
        <p className="text-xs text-gray-500 text-center">
          This subscription is governed by the laws of the United States. 
          For EU customers, additional consumer protection rights may apply under local law.
        </p>
      </div>
    </div>
  );
}
