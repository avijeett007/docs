'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiX,
  FiCreditCard,
  FiDollarSign,
  FiCheck,
  FiLoader,
  FiAlertCircle,
  FiInfo,
  FiPhone
} from 'react-icons/fi';
import { TelephonyCreditPackage, formatTelephonyAmount, formatPrice } from '@/lib/types/credits';

interface TelephonyCreditPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  packages?: TelephonyCreditPackage[];
  onPurchaseSuccess?: () => void;
  minAmount?: number; // Minimum purchase amount in dollars (default: 10)
}

export default function TelephonyCreditPurchaseModal({
  isOpen,
  onClose,
  packages = [],
  onPurchaseSuccess,
  minAmount = 10
}: TelephonyCreditPurchaseModalProps) {
  const [selectedPackage, setSelectedPackage] = useState<TelephonyCreditPackage | null>(null);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [selectedQuickAmount, setSelectedQuickAmount] = useState<number | null>(null);
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Predefined quick-select amounts - filtered based on minAmount
  const allQuickAmounts = [
    { amount: 10, label: '$10' },
    { amount: 20, label: '$20' },
    { amount: 25, label: '$25' },
    { amount: 50, label: '$50' },
    { amount: 100, label: '$100' },
    { amount: 250, label: '$250' },
    { amount: 500, label: '$500' },
  ];

  // Filter quick amounts based on minimum purchase requirement
  const quickAmounts = allQuickAmounts.filter(qa => qa.amount >= minAmount);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedPackage(null);
      setCustomAmount('');
      setSelectedQuickAmount(null);
      setIsCustom(false);
      setError(null);
    }
  }, [isOpen]);

  const handleQuickAmountSelect = (amount: number) => {
    setSelectedQuickAmount(amount);
    setSelectedPackage(null);
    setCustomAmount('');
    setIsCustom(false);
    setError(null);
  };

  const handlePackageSelect = (pkg: TelephonyCreditPackage) => {
    setSelectedPackage(pkg);
    setSelectedQuickAmount(null);
    setIsCustom(false);
    setCustomAmount('');
    setError(null);
  };

  const handleCustomToggle = () => {
    setIsCustom(!isCustom);
    setSelectedPackage(null);
    setSelectedQuickAmount(null);
    setCustomAmount('');
    setError(null);
  };

  const handlePurchase = async () => {
    if (!isCustom && !selectedPackage && !selectedQuickAmount) {
      setError('Please select an amount or enter a custom amount');
      return;
    }

    if (isCustom) {
      const amount = parseFloat(customAmount);
      if (isNaN(amount) || amount < minAmount || amount > 10000) {
        setError(`Custom amount must be between $${minAmount} and $10,000`);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        setError('Authentication required');
        return;
      }

      // Determine the request body based on selection type
      let requestBody;
      if (isCustom) {
        requestBody = { customDollarAmount: parseFloat(customAmount) };
      } else if (selectedQuickAmount) {
        requestBody = { customDollarAmount: selectedQuickAmount };
      } else {
        requestBody = { packageId: selectedPackage!.id };
      }

      const response = await fetch('/api/partner/telephony-credits/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Failed to create purchase');
        return;
      }

      // Redirect to Stripe checkout
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        setError('No checkout URL received');
      }
    } catch (error) {
      console.error('Error creating purchase:', error);
      setError('Failed to create purchase. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Calculate selected amount from quick select, custom, or package
  const selectedAmount = selectedQuickAmount
    ? selectedQuickAmount
    : isCustom
      ? parseFloat(customAmount) || 0
      : selectedPackage?.dollarAmount || 0;

  const finalPrice = selectedAmount; // No discounts for telephony credits

  // Don't render anything if not open or not in browser
  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <FiPhone className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Purchase Telephony Credits</h2>
                  <p className="text-gray-400 text-sm">Add credits for phone calls and telephony services</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <FiX className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Info Banner */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <FiInfo className="w-5 h-5 text-blue-400 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-blue-300 mb-1">About Telephony Credits</h4>
                    <p className="text-blue-200 text-sm">
                      Telephony credits are used for phone calls, SMS, and phone number purchases. 
                      Unlike AI Credits, telephony credits are priced at cost with no markup and never expire.
                      Credits are charged based on actual provider costs (Twilio, etc.).
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
                  <div className="flex items-center gap-3">
                    <FiAlertCircle className="w-5 h-5 text-red-400" />
                    <p className="text-red-300 text-sm">{error}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Package Selection */}
                <div className="lg:col-span-2">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">Select Amount</h3>
                    <button
                      onClick={handleCustomToggle}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        isCustom
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Custom Amount
                    </button>
                  </div>

                  {isCustom ? (
                    <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-4">
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Custom Dollar Amount
                      </label>
                      <div className="relative">
                        <FiDollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="number"
                          min={minAmount}
                          max="10000"
                          step="1"
                          value={customAmount}
                          onChange={(e) => setCustomAmount(e.target.value)}
                          placeholder={`Enter amount (min $${minAmount}, max $10,000)`}
                          className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-green-500 focus:ring-1 focus:ring-green-500"
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        Minimum: ${minAmount} • Maximum: $10,000
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Quick Amount Buttons */}
                      <div>
                        <p className="text-sm text-gray-400 mb-3">Quick Select:</p>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                          {quickAmounts.map((qa) => (
                            <button
                              key={qa.amount}
                              onClick={() => handleQuickAmountSelect(qa.amount)}
                              className={`py-3 px-4 rounded-lg border-2 transition-all text-center font-semibold ${
                                selectedQuickAmount === qa.amount
                                  ? 'border-green-500 bg-green-500/20 text-green-400'
                                  : 'border-gray-600 bg-gray-700/50 hover:border-gray-500 text-white'
                              }`}
                            >
                              {qa.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Package Options (if any) */}
                      {packages.length > 0 && (
                        <div>
                          <p className="text-sm text-gray-400 mb-3">Or select a package:</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {packages.map((pkg) => (
                              <button
                                key={pkg.id}
                                onClick={() => handlePackageSelect(pkg)}
                                className={`p-4 rounded-lg border-2 transition-all text-left ${
                                  selectedPackage?.id === pkg.id
                                    ? 'border-green-500 bg-green-500/10'
                                    : 'border-gray-600 bg-gray-700/50 hover:border-gray-500'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="font-semibold text-white">
                                    {formatTelephonyAmount(pkg.dollarAmount)}
                                  </h4>
                                </div>
                                <p className="text-gray-400 text-sm">{pkg.name}</p>
                                <p className="text-green-400 font-medium mt-1">
                                  {formatPrice(pkg.priceCents)}
                                </p>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Purchase Summary */}
                <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-4 h-fit">
                  <h3 className="text-lg font-semibold text-white mb-4">Purchase Summary</h3>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Credits:</span>
                      <span className="text-white font-medium">
                        {selectedAmount > 0 ? formatTelephonyAmount(selectedAmount) : '-'}
                      </span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-400">Price:</span>
                      <span className="text-white font-medium">
                        {selectedAmount > 0 ? formatTelephonyAmount(finalPrice) : '-'}
                      </span>
                    </div>

                    <div className="border-t border-gray-600 pt-3">
                      <div className="flex justify-between">
                        <span className="text-white font-semibold">Total:</span>
                        <span className="text-green-400 font-bold text-lg">
                          {selectedAmount > 0 ? formatTelephonyAmount(finalPrice) : '$0.00'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handlePurchase}
                    disabled={loading || selectedAmount === 0}
                    className="w-full mt-6 px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <FiLoader className="w-4 h-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <FiCreditCard className="w-4 h-4" />
                        Purchase Credits
                      </>
                    )}
                  </button>

                  <p className="text-xs text-gray-400 mt-3 text-center">
                    Secure payment powered by Stripe
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
