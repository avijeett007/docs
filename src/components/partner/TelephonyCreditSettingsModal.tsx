'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiX, 
  FiSettings, 
  FiDollarSign, 
  FiCheck, 
  FiLoader,
  FiAlertCircle,
  FiInfo,
  FiZap,
  FiBell
} from 'react-icons/fi';
import { TelephonyCreditBalance, centsToDollars } from '@/lib/types/credits';

interface TelephonyCreditSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  creditBalance: TelephonyCreditBalance | null;
  onSettingsUpdate?: () => void;
}

export default function TelephonyCreditSettingsModal({ 
  isOpen, 
  onClose, 
  creditBalance,
  onSettingsUpdate 
}: TelephonyCreditSettingsModalProps) {
  const [lowCreditThreshold, setLowCreditThreshold] = useState<string>('');
  const [lowCreditNotifications, setLowCreditNotifications] = useState(false);
  const [autoTopUpEnabled, setAutoTopUpEnabled] = useState(false);
  const [autoTopUpThreshold, setAutoTopUpThreshold] = useState<string>('');
  const [autoTopUpAmount, setAutoTopUpAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Initialize form with current settings
  useEffect(() => {
    if (isOpen && creditBalance) {
      setLowCreditThreshold(
        creditBalance.lowCreditThresholdCents 
          ? centsToDollars(creditBalance.lowCreditThresholdCents).toString()
          : '10'
      );
      setLowCreditNotifications(creditBalance.lowCreditNotificationsEnabled);
      setAutoTopUpEnabled(creditBalance.autoTopUpEnabled);
      setAutoTopUpThreshold(
        creditBalance.autoTopUpThresholdCents 
          ? centsToDollars(creditBalance.autoTopUpThresholdCents).toString()
          : '25'
      );
      setAutoTopUpAmount(
        creditBalance.autoTopUpAmountCents 
          ? centsToDollars(creditBalance.autoTopUpAmountCents).toString()
          : '50'
      );
      setError(null);
      setSuccess(false);
    }
  }, [isOpen, creditBalance]);

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        setError('Authentication required');
        return;
      }

      // Validate inputs
      const thresholdAmount = parseFloat(lowCreditThreshold);
      const topUpThresholdAmount = parseFloat(autoTopUpThreshold);
      const topUpAmountValue = parseFloat(autoTopUpAmount);

      if (isNaN(thresholdAmount) || thresholdAmount < 0 || thresholdAmount > 1000) {
        setError('Low credit threshold must be between $0 and $1,000');
        return;
      }

      if (autoTopUpEnabled) {
        if (isNaN(topUpThresholdAmount) || topUpThresholdAmount < 0 || topUpThresholdAmount > 1000) {
          setError('Auto top-up threshold must be between $0 and $1,000');
          return;
        }

        if (isNaN(topUpAmountValue) || topUpAmountValue < 10 || topUpAmountValue > 1000) {
          setError('Auto top-up amount must be between $10 and $1,000');
          return;
        }

        if (topUpThresholdAmount >= topUpAmountValue) {
          setError('Auto top-up threshold should be less than the top-up amount');
          return;
        }
      }

      const requestBody = {
        lowCreditThresholdDollars: thresholdAmount,
        lowCreditNotificationsEnabled: lowCreditNotifications,
        autoTopUpEnabled: autoTopUpEnabled,
        ...(autoTopUpEnabled && {
          autoTopUpThresholdDollars: topUpThresholdAmount,
          autoTopUpAmountDollars: topUpAmountValue,
        }),
      };

      const response = await fetch('/api/partner/telephony-credits/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Failed to update settings');
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
        onSettingsUpdate?.();
      }, 1500);

    } catch (error) {
      console.error('Error updating settings:', error);
      setError('Failed to update settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <FiSettings className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Telephony Credit Settings</h2>
                  <p className="text-gray-400 text-sm">Configure notifications and auto top-up</p>
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
            <div className="p-6 space-y-6">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <FiAlertCircle className="w-5 h-5 text-red-400" />
                    <p className="text-red-300 text-sm">{error}</p>
                  </div>
                </div>
              )}

              {success && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <FiCheck className="w-5 h-5 text-green-400" />
                    <p className="text-green-300 text-sm">Settings updated successfully!</p>
                  </div>
                </div>
              )}

              {/* Low Credit Notifications */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <FiBell className="w-5 h-5 text-blue-400" />
                  <h3 className="text-lg font-semibold text-white">Low Credit Notifications</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Low Credit Threshold
                    </label>
                    <div className="relative">
                      <FiDollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="number"
                        min="0"
                        max="1000"
                        step="1"
                        value={lowCreditThreshold}
                        onChange={(e) => setLowCreditThreshold(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-green-500 focus:ring-1 focus:ring-green-500"
                        placeholder="10"
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Get notified when your balance falls below this amount
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-white font-medium">Enable Notifications</h4>
                      <p className="text-gray-400 text-sm">Receive alerts when credits are low</p>
                    </div>
                    <button
                      onClick={() => setLowCreditNotifications(!lowCreditNotifications)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        lowCreditNotifications ? 'bg-green-500' : 'bg-gray-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          lowCreditNotifications ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Auto Top-up */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <FiZap className="w-5 h-5 text-amber-400" />
                  <h3 className="text-lg font-semibold text-white">Auto Top-up</h3>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <FiInfo className="w-5 h-5 text-blue-400 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-blue-300 mb-1">About Auto Top-up</h4>
                      <p className="text-blue-200 text-sm">
                        Automatically purchase more telephony credits when your balance falls below a threshold. 
                        This ensures uninterrupted service for your customers.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-white font-medium">Enable Auto Top-up</h4>
                    <p className="text-gray-400 text-sm">Automatically purchase credits when low</p>
                  </div>
                  <button
                    onClick={() => setAutoTopUpEnabled(!autoTopUpEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      autoTopUpEnabled ? 'bg-green-500' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        autoTopUpEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {autoTopUpEnabled && (
                  <div className="space-y-4 pl-4 border-l-2 border-green-500/30">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Auto Top-up Threshold
                      </label>
                      <div className="relative">
                        <FiDollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="number"
                          min="0"
                          max="1000"
                          step="1"
                          value={autoTopUpThreshold}
                          onChange={(e) => setAutoTopUpThreshold(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-green-500 focus:ring-1 focus:ring-green-500"
                          placeholder="25"
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Trigger auto top-up when balance falls below this amount
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Auto Top-up Amount
                      </label>
                      <div className="relative">
                        <FiDollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="number"
                          min="10"
                          max="1000"
                          step="1"
                          value={autoTopUpAmount}
                          onChange={(e) => setAutoTopUpAmount(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-green-500 focus:ring-1 focus:ring-green-500"
                          placeholder="50"
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Amount to purchase when auto top-up is triggered
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-700">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <FiLoader className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <FiCheck className="w-4 h-4" />
                    Save Settings
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
