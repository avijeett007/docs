'use client';

import { Dialog } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiAlertCircle } from 'react-icons/fi';
import { useState } from 'react';
import NeonContainer from '@/components/NeonContainer';

interface AddUsageModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    companyName: string;
    email: string;
    monthlyUsage: {
      voiceMinutes: number;
      aiTokens: number;
      emailCount: number;
      smsCount: number;
    };
  } | null;
  onSuccess: (updatedCustomer: any) => void;
}

interface UsageData {
  voiceMinutes: string;
  aiTokens: string;
  emailCount: string;
  smsCount: string;
}

export default function AddUsageModal({
  isOpen,
  onClose,
  customer,
  onSuccess
}: AddUsageModalProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );
  const [usageData, setUsageData] = useState<UsageData>({
    voiceMinutes: '',
    aiTokens: '',
    emailCount: '',
    smsCount: ''
  });
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate last 6 months options
  const monthOptions = Array.from({ length: 6 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    return {
      value: date.toISOString().slice(0, 7),
      label: date.toLocaleDateString('en-GB', {
        month: 'long',
        year: 'numeric'
      })
    };
  });

  const handleInputChange = (field: keyof UsageData, value: string) => {
    // Only allow numbers
    if (!/^\d*$/.test(value)) return;
    
    setUsageData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async () => {
    try {
      // Check if data exists for this month
      const response = await fetch(`/api/partner/customers/${customer?.id}/usage?month=${selectedMonth}`);
      const existingData = await response.json();

      if (existingData && Object.keys(existingData).length > 0) {
        setShowConfirmation(true);
        return;
      }

      await submitUsageData();
    } catch (error) {
      console.error('Error checking existing data:', error);
      setError('Failed to check existing data. Please try again.');
    }
  };

  const submitUsageData = async () => {
    try {
      const response = await fetch(`/api/partner/customers/${customer?.id}/usage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('partner_token')}`
        },
        body: JSON.stringify({
          month: selectedMonth,
          usage: {
            voiceMinutes: parseInt(usageData.voiceMinutes) || 0,
            aiTokens: parseInt(usageData.aiTokens) || 0,
            emailCount: parseInt(usageData.emailCount) || 0,
            smsCount: parseInt(usageData.smsCount) || 0
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit usage data');
      }

      const updatedCustomer = await response.json();
      onSuccess(updatedCustomer);
    } catch (error) {
      console.error('Error submitting usage data:', error);
      setError('Failed to submit usage data. Please try again.');
    }
  };

  if (!customer) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog
          static
          open={isOpen}
          onClose={onClose}
          className="relative z-50"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />

          <Dialog.Panel
            as={motion.div}
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed inset-0 overflow-y-auto"
          >
            <div className="flex min-h-full items-center justify-center p-4">
              <div className="relative w-full max-w-2xl">
                <NeonContainer>
                  <div className="relative bg-gray-900/90 backdrop-blur-xl p-8">
                    <button
                      onClick={onClose}
                      className="absolute right-6 top-6 p-2 rounded-lg text-gray-400 hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                      <FiX className="w-5 h-5" />
                    </button>

                    <div className="mb-8">
                      <h2 className="text-2xl font-bold text-white">
                        Add Usage Data
                      </h2>
                      <p className="text-gray-400 mt-1">
                        {customer.companyName || `${customer.firstName} ${customer.lastName}`}
                      </p>
                    </div>

                    {error && (
                      <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
                        <div className="flex items-center gap-2">
                          <FiAlertCircle className="w-5 h-5 flex-shrink-0" />
                          <p>{error}</p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Month
                        </label>
                        <select
                          value={selectedMonth}
                          onChange={(e) => setSelectedMonth(e.target.value)}
                          className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                        >
                          {monthOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Voice Minutes
                          </label>
                          <input
                            type="text"
                            value={usageData.voiceMinutes}
                            onChange={(e) => handleInputChange('voiceMinutes', e.target.value)}
                            className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                            placeholder="Enter number of minutes"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            AI Tokens
                          </label>
                          <input
                            type="text"
                            value={usageData.aiTokens}
                            onChange={(e) => handleInputChange('aiTokens', e.target.value)}
                            className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                            placeholder="Enter number of tokens"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Emails Sent
                          </label>
                          <input
                            type="text"
                            value={usageData.emailCount}
                            onChange={(e) => handleInputChange('emailCount', e.target.value)}
                            className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                            placeholder="Enter number of emails"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            SMS Sent
                          </label>
                          <input
                            type="text"
                            value={usageData.smsCount}
                            onChange={(e) => handleInputChange('smsCount', e.target.value)}
                            className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                            placeholder="Enter number of SMS"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 mt-8">
                        <button
                          onClick={onClose}
                          className="px-6 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSubmit}
                          className="px-6 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                        >
                          Add Usage
                        </button>
                      </div>
                    </div>
                  </div>
                </NeonContainer>
              </div>
            </div>
          </Dialog.Panel>
        </Dialog>
      )}

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmation && (
          <Dialog
            static
            open={showConfirmation}
            onClose={() => setShowConfirmation(false)}
            className="relative z-50"
          >
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />

            <div className="fixed inset-0 overflow-y-auto">
              <div className="flex min-h-full items-center justify-center p-4">
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-gray-900 p-6 shadow-xl transition-all">
                  <div className="mb-6">
                    <Dialog.Title className="text-lg font-medium text-white">
                      Overwrite Existing Data?
                    </Dialog.Title>
                    <Dialog.Description className="mt-2 text-sm text-gray-400">
                      Usage data already exists for {new Date(selectedMonth).toLocaleDateString('en-GB', {
                        month: 'long',
                        year: 'numeric'
                      })}. Do you want to overwrite it?
                    </Dialog.Description>
                  </div>

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setShowConfirmation(false)}
                      className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        setShowConfirmation(false);
                        submitUsageData();
                      }}
                      className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
                    >
                      Overwrite
                    </button>
                  </div>
                </Dialog.Panel>
              </div>
            </div>
          </Dialog>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
}
