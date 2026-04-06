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
  FiInfo
} from 'react-icons/fi';
import { CreditPackage, formatCredits, formatPrice, calculateDiscountedPrice } from '@/lib/types/credits';

interface CreditPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  packages: CreditPackage[];
  onPurchaseSuccess?: () => void;
}

export default function CreditPurchaseModal({ 
  isOpen, 
  onClose, 
  packages, 
  onPurchaseSuccess 
}: CreditPurchaseModalProps) {
  const [selectedPackage, setSelectedPackage] = useState<CreditPackage | null>(null);
  const [customCredits, setCustomCredits] = useState<string>('');
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedPackage(null);
      setCustomCredits('');
      setIsCustom(false);
      setError(null);
    }
  }, [isOpen]);

  const handlePackageSelect = (pkg: CreditPackage) => {
    setSelectedPackage(pkg);
    setIsCustom(false);
    setCustomCredits('');
    setError(null);
  };

  const handleCustomSelect = () => {
    setIsCustom(true);
    setSelectedPackage(null);
    setError(null);
  };

  const handleCustomCreditsChange = (value: string) => {
    // Only allow numbers
    const numericValue = value.replace(/[^0-9]/g, '');
    setCustomCredits(numericValue);
    setError(null);
  };

  const getCustomPricing = () => {
    const credits = parseInt(customCredits);
    if (isNaN(credits) || credits <= 0) return null;
    return calculateDiscountedPrice(credits);
  };

  const handlePurchase = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('partner_token');
      if (!token) {
        setError('Authentication required');
        return;
      }

      const requestBody: any = {};

      if (isCustom) {
        const credits = parseInt(customCredits);
        if (isNaN(credits) || credits <= 0) {
          setError('Please enter a valid number of credits');
          return;
        }
        if (credits > 10000000) {
          setError('Maximum 10,000,000 credits per purchase');
          return;
        }
        requestBody.customCredits = credits;
      } else if (selectedPackage) {
        requestBody.packageId = selectedPackage.id;
      } else {
        setError('Please select a package or enter custom credits');
        return;
      }

      const response = await fetch('/api/partner/credits/purchase', {
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
      if (data.data.checkoutUrl) {
        window.location.href = data.data.checkoutUrl;
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

  const selectedCredits = isCustom 
    ? parseInt(customCredits) || 0 
    : selectedPackage?.credits || 0;

  const selectedPrice = isCustom 
    ? getCustomPricing()?.priceCents || 0 
    : selectedPackage?.priceCents || 0;

  const selectedDiscount = isCustom
    ? getCustomPricing()?.discountPercentage || 0
    : Number(selectedPackage?.discountPercentage) || 0;

  const canPurchase = (isCustom && parseInt(customCredits) > 0) || (!isCustom && selectedPackage);

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
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <FiCreditCard className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Purchase Knotie Credits</h2>
                  <p className="text-gray-400 text-sm">Choose a package or enter custom amount</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <FiX className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Error Message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-500/10 border border-red-500/20 rounded-lg p-4"
                >
                  <div className="flex items-center gap-3">
                    <FiAlertCircle className="w-5 h-5 text-red-500" />
                    <span className="text-red-400">{error}</span>
                  </div>
                </motion.div>
              )}

              {/* Package Selection */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Select Credit Package</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {packages.map((pkg) => (
                    <motion.div
                      key={pkg.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handlePackageSelect(pkg)}
                      className={`
                        relative p-4 rounded-lg border-2 cursor-pointer transition-all
                        ${selectedPackage?.id === pkg.id 
                          ? 'border-blue-500 bg-blue-500/10' 
                          : 'border-gray-600 bg-gray-700/50 hover:border-gray-500'
                        }
                      `}
                    >
                      {selectedPackage?.id === pkg.id && (
                        <div className="absolute top-2 right-2">
                          <FiCheck className="w-5 h-5 text-blue-500" />
                        </div>
                      )}
                      
                      <div className="text-center">
                        <h4 className="font-semibold text-white mb-2">{pkg.name}</h4>
                        <div className="text-2xl font-bold text-blue-400 mb-1">
                          {formatPrice(pkg.priceCents)}
                        </div>
                        {Number(pkg.discountPercentage) > 0 && (
                          <div className="text-sm text-green-400 mb-2">
                            Save {Number(pkg.discountPercentage)}%
                          </div>
                        )}
                        <div className="text-gray-400 text-sm">
                          {formatCredits(pkg.credits)} credits
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {(pkg.priceCents / pkg.credits).toFixed(3)}¢ per credit
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Custom Amount */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Or Enter Custom Amount</h3>
                <div 
                  onClick={handleCustomSelect}
                  className={`
                    p-4 rounded-lg border-2 cursor-pointer transition-all
                    ${isCustom 
                      ? 'border-blue-500 bg-blue-500/10' 
                      : 'border-gray-600 bg-gray-700/50 hover:border-gray-500'
                    }
                  `}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Number of Credits
                      </label>
                      <input
                        type="text"
                        value={customCredits}
                        onChange={(e) => handleCustomCreditsChange(e.target.value)}
                        placeholder="Enter amount (e.g., 25000)"
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    {isCustom && parseInt(customCredits) > 0 && (
                      <div className="text-right">
                        <div className="text-xl font-bold text-blue-400">
                          {formatPrice(getCustomPricing()?.priceCents || 0)}
                        </div>
                        {(getCustomPricing()?.discountPercentage || 0) > 0 && (
                          <div className="text-sm text-green-400">
                            Save {getCustomPricing()?.discountPercentage}%
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Purchase Summary */}
              {canPurchase && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gray-700/50 rounded-lg p-4"
                >
                  <h4 className="font-semibold text-white mb-3">Purchase Summary</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Credits:</span>
                      <span className="text-white font-medium">{formatCredits(selectedCredits)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Price:</span>
                      <span className="text-white font-medium">{formatPrice(selectedPrice)}</span>
                    </div>
                    {selectedDiscount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Discount:</span>
                        <span className="text-green-400 font-medium">{selectedDiscount}%</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-400">Rate:</span>
                      <span className="text-white font-medium">
                        {(selectedPrice / selectedCredits).toFixed(3)}¢ per credit
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Info Box */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <FiInfo className="w-5 h-5 text-blue-400 mt-0.5" />
                  <div className="text-sm text-blue-300">
                    <p className="font-semibold mb-2">Important Information:</p>
                    <ul className="space-y-1 text-blue-200">
                      <li>• Credits never expire and can be used across all AI features</li>
                      <li>• Secure payment processing through Stripe</li>
                      <li>• You'll be redirected to complete your purchase</li>
                      <li>• Credits will be added to your account immediately after payment</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-700">
                <button
                  onClick={onClose}
                  className="px-6 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePurchase}
                  disabled={!canPurchase || loading}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? (
                    <>
                      <FiLoader className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <FiDollarSign className="w-4 h-4" />
                      Purchase Credits
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
