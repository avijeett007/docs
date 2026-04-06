'use client';

import { Dialog } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiPlus } from 'react-icons/fi';
import { useState } from 'react';
import NeonContainer from '@/components/NeonContainer';

interface UsageDetailsModalProps {
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
  onAddUsage: () => void;
}

export default function UsageDetailsModal({
  isOpen,
  onClose,
  customer,
  onAddUsage
}: UsageDetailsModalProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );

  // Initialize monthly data from customer's usage data
  const monthlyData = customer?.monthlyUsage ? {
    [new Date().toISOString().slice(0, 7)]: {
      voiceMinutes: customer.monthlyUsage.voiceMinutes || 0,
      aiTokens: customer.monthlyUsage.aiTokens || 0,
      emailCount: customer.monthlyUsage.emailCount || 0,
      smsCount: customer.monthlyUsage.smsCount || 0
    }
  } : {};

  const months = Object.keys(monthlyData).sort((a, b) => b.localeCompare(a));

  if (!customer) return null;

  const currentMonthData = monthlyData[selectedMonth] || {
    voiceMinutes: 0,
    aiTokens: 0,
    emailCount: 0,
    smsCount: 0
  };

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
              <div className="relative w-full max-w-4xl">
                <NeonContainer className="p-8">
                  <div className="relative">
                    <button
                      onClick={onClose}
                      className="absolute right-6 top-6 p-2 rounded-lg text-gray-400 hover:text-gray-300 hover:bg-gray-800/50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                      <FiX className="w-5 h-5" />
                    </button>

                    <div className="mb-8">
                      <h2 className="text-2xl font-bold text-white">
                        {customer.companyName || `${customer.firstName} ${customer.lastName}`}
                      </h2>
                      <p className="text-gray-400 mt-1">{customer.email}</p>
                    </div>

                    <div className="flex justify-between items-center mb-8">
                      <div className="flex gap-3">
                        {months.map((month) => (
                          <button
                            key={month}
                            onClick={() => setSelectedMonth(month)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                              selectedMonth === month
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
                            }`}
                          >
                            {new Date(month).toLocaleDateString('en-GB', {
                              month: 'short',
                              year: 'numeric'
                            })}
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={onAddUsage}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                      >
                        <FiPlus className="w-4 h-4" />
                        Add Usage
                      </button>
                    </div>

                    <div className="bg-gray-800/50 rounded-xl p-8">
                      <div className="grid grid-cols-2 gap-8">
                        <div>
                          <h3 className="text-lg font-semibold text-white mb-6">Voice & AI Usage</h3>
                          <div className="space-y-6">
                            <div className="bg-gray-900/50 rounded-lg p-4">
                              <label className="block text-sm text-gray-400 mb-2">Voice Minutes</label>
                              <div className="text-2xl font-bold text-white">
                                {currentMonthData.voiceMinutes.toLocaleString()}
                              </div>
                            </div>
                            <div className="bg-gray-900/50 rounded-lg p-4">
                              <label className="block text-sm text-gray-400 mb-2">AI Tokens</label>
                              <div className="text-2xl font-bold text-white">
                                {currentMonthData.aiTokens.toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-lg font-semibold text-white mb-6">Notifications</h3>
                          <div className="space-y-6">
                            <div className="bg-gray-900/50 rounded-lg p-4">
                              <label className="block text-sm text-gray-400 mb-2">Emails Sent</label>
                              <div className="text-2xl font-bold text-white">
                                {currentMonthData.emailCount.toLocaleString()}
                              </div>
                            </div>
                            <div className="bg-gray-900/50 rounded-lg p-4">
                              <label className="block text-sm text-gray-400 mb-2">SMS Sent</label>
                              <div className="text-2xl font-bold text-white">
                                {currentMonthData.smsCount.toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </NeonContainer>
              </div>
            </div>
          </Dialog.Panel>
        </Dialog>
      )}
    </AnimatePresence>
  );
}
