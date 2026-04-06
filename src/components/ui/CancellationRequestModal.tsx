'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiAlertTriangle, FiRepeat, FiSend } from 'react-icons/fi';
import { toast } from 'sonner';

interface CancellationRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: {
    id: string;
    invoiceNumber: string;
    title: string;
    amount: number;
    currency: string;
    recurringInterval?: string;
    nextPaymentDate?: Date;
  };
  onRequestSubmitted?: () => void;
}

export default function CancellationRequestModal({
  isOpen,
  onClose,
  invoice,
  onRequestSubmitted
}: CancellationRequestModalProps) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: invoice.currency.toUpperCase(),
    }).format(amount / 100);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!reason.trim()) {
      toast.error('Please provide a reason for cancellation');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/whitelabel/billing/cancellation-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          invoiceId: invoice.id,
          reason: reason.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit cancellation request');
      }

      toast.success('Cancellation request submitted successfully');
      onRequestSubmitted?.();
      onClose();
      setReason('');
    } catch (error) {
      console.error('Error submitting cancellation request:', error);
      toast.error('Failed to submit cancellation request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
      setReason('');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-gray-900 border border-red-500/20 rounded-xl shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/20">
                  <FiAlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Request Cancellation</h3>
              </div>
              <button
                onClick={handleClose}
                className="p-1 text-gray-400 hover:text-white transition-colors"
                disabled={isSubmitting}
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <form onSubmit={handleSubmit} className="p-6">
              {/* Invoice Details */}
              <div className="mb-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                <div className="flex items-center gap-2 mb-3">
                  <FiRepeat className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-medium text-purple-400">Recurring Invoice</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Invoice:</span>
                    <span className="text-white">{invoice.invoiceNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Title:</span>
                    <span className="text-white">{invoice.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Amount:</span>
                    <span className="text-white font-medium">{formatAmount(invoice.amount)}</span>
                  </div>
                  {invoice.recurringInterval && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Frequency:</span>
                      <span className="text-white capitalize">{invoice.recurringInterval}</span>
                    </div>
                  )}
                  {invoice.nextPaymentDate && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Next Payment:</span>
                      <span className="text-white">{formatDate(invoice.nextPaymentDate)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Reason Input */}
              <div className="mb-6">
                <label htmlFor="reason" className="block text-sm font-medium text-gray-300 mb-2">
                  Reason for Cancellation <span className="text-red-400">*</span>
                </label>
                <textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Please let us know why you'd like to cancel this recurring invoice..."
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                  rows={4}
                  disabled={isSubmitting}
                  required
                />
              </div>

              {/* Info Message */}
              <div className="mb-6 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-sm text-blue-300">
                  Your cancellation request will be sent to your service provider for review. 
                  You'll receive a notification once it's processed.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !reason.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  <FiSend className="w-4 h-4" />
                  {isSubmitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
