'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiX, 
  FiSettings, 
  FiBell, 
  FiAlertTriangle,
  FiSave,
  FiLoader,
  FiCheck
} from 'react-icons/fi';
import { CreditBalance, formatCredits } from '@/lib/types/credits';

interface CreditSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  creditBalance: CreditBalance | null;
  onSettingsUpdate?: () => void;
}

export default function CreditSettingsModal({ 
  isOpen, 
  onClose, 
  creditBalance,
  onSettingsUpdate 
}: CreditSettingsModalProps) {
  const [lowCreditThreshold, setLowCreditThreshold] = useState<string>('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Initialize form with current settings
  useEffect(() => {
    if (isOpen && creditBalance) {
      setLowCreditThreshold((creditBalance.lowCreditThreshold || 1000).toString());
      setNotificationsEnabled(creditBalance.lowCreditNotificationsEnabled);
      setError(null);
      setSuccess(false);
    }
  }, [isOpen, creditBalance]);

  const handleThresholdChange = (value: string) => {
    // Only allow numbers
    const numericValue = value.replace(/[^0-9]/g, '');
    setLowCreditThreshold(numericValue);
    setError(null);
    setSuccess(false);
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);

      const threshold = parseInt(lowCreditThreshold);
      if (isNaN(threshold) || threshold < 0) {
        setError('Please enter a valid threshold amount');
        return;
      }

      if (threshold > 1000000) {
        setError('Threshold cannot exceed 1,000,000 credits');
        return;
      }

      const token = localStorage.getItem('partner_token');
      if (!token) {
        setError('Authentication required');
        return;
      }

      const response = await fetch('/api/partner/credits/balance', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          lowCreditThreshold: threshold,
          lowCreditNotificationsEnabled: notificationsEnabled
        })
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Failed to update settings');
        return;
      }

      setSuccess(true);
      
      // Call the update callback to refresh parent component
      if (onSettingsUpdate) {
        onSettingsUpdate();
      }

      // Auto-close after success
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Error updating settings:', error);
      setError('Failed to update settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const currentBalance = creditBalance?.currentBalance || 0;
  const threshold = parseInt(lowCreditThreshold) || 0;
  const isCurrentlyLow = currentBalance <= threshold;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-md"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <FiSettings className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Credit Settings</h2>
                  <p className="text-gray-400 text-sm">Configure low credit notifications</p>
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
              {/* Success Message */}
              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-green-500/10 border border-green-500/20 rounded-lg p-4"
                >
                  <div className="flex items-center gap-3">
                    <FiCheck className="w-5 h-5 text-green-500" />
                    <span className="text-green-400">Settings updated successfully!</span>
                  </div>
                </motion.div>
              )}

              {/* Error Message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-500/10 border border-red-500/20 rounded-lg p-4"
                >
                  <div className="flex items-center gap-3">
                    <FiAlertTriangle className="w-5 h-5 text-red-500" />
                    <span className="text-red-400">{error}</span>
                  </div>
                </motion.div>
              )}

              {/* Current Balance Info */}
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Current Balance:</span>
                  <span className="text-white font-semibold">
                    {formatCredits(currentBalance)}
                  </span>
                </div>
              </div>

              {/* Low Credit Threshold */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Low Credit Threshold
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={lowCreditThreshold}
                    onChange={(e) => handleThresholdChange(e.target.value)}
                    placeholder="1000"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                  />
                  <div className="absolute right-3 top-2 text-gray-400 text-sm">
                    credits
                  </div>
                </div>
                <p className="text-gray-500 text-xs mt-1">
                  You'll be notified when your balance drops to or below this amount
                </p>
                
                {/* Threshold Preview */}
                {threshold > 0 && (
                  <div className={`mt-2 p-2 rounded text-xs ${
                    isCurrentlyLow 
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                      : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  }`}>
                    {isCurrentlyLow ? (
                      <div className="flex items-center gap-2">
                        <FiAlertTriangle className="w-3 h-3" />
                        Your current balance is below this threshold
                      </div>
                    ) : (
                      `You'll be notified when balance drops below ${formatCredits(threshold)}`
                    )}
                  </div>
                )}
              </div>

              {/* Notification Settings */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Notification Preferences
                </label>
                
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notificationsEnabled}
                      onChange={(e) => {
                        setNotificationsEnabled(e.target.checked);
                        setError(null);
                        setSuccess(false);
                      }}
                      className="w-4 h-4 text-blue-500 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    <div className="flex items-center gap-2">
                      <FiBell className="w-4 h-4 text-gray-400" />
                      <span className="text-white">Enable low credit notifications</span>
                    </div>
                  </label>
                  
                  <p className="text-gray-500 text-xs ml-7">
                    Receive alerts when your credit balance is running low
                  </p>
                </div>
              </div>

              {/* Notification Methods Info */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <FiBell className="w-4 h-4 text-blue-400 mt-0.5" />
                  <div className="text-sm text-blue-300">
                    <p className="font-semibold mb-1">How you'll be notified:</p>
                    <ul className="space-y-1 text-blue-200 text-xs">
                      <li>• Dashboard alerts when balance is low</li>
                      <li>• Email notifications (if enabled in account settings)</li>
                      <li>• Visual indicators in the credits section</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-700">
                <button
                  onClick={onClose}
                  disabled={loading}
                  className="px-6 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={loading || success}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? (
                    <>
                      <FiLoader className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : success ? (
                    <>
                      <FiCheck className="w-4 h-4" />
                      Saved!
                    </>
                  ) : (
                    <>
                      <FiSave className="w-4 h-4" />
                      Save Settings
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
