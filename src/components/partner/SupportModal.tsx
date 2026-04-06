'use client';

import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiSend, FiLoader, FiMail, FiMessageSquare } from 'react-icons/fi';
import toast from 'react-hot-toast';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  partnerName?: string;
  partnerEmail?: string;
  context?: string; // e.g., 'credits', 'billing', etc.
}

export default function SupportModal({
  isOpen,
  onClose,
  partnerName = '',
  partnerEmail = '',
  context = 'general'
}: SupportModalProps) {
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subject.trim() || !details.trim()) {
      toast.error('Please fill in both subject and details');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/partner/support/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('partner_token')}`
        },
        body: JSON.stringify({
          subject: subject.trim(),
          details: details.trim(),
          context
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast.success(`Support ticket created! Reference ID: ${result.supportId}`);
        setSubject('');
        setDetails('');
        onClose();
      } else {
        toast.error(result.error || 'Failed to submit support request');
      }
    } catch (error) {
      console.error('Error submitting support request:', error);
      toast.error('Failed to submit support request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setSubject('');
      setDetails('');
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog
          as={motion.div}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          open={isOpen}
          onClose={handleClose}
          className="relative z-50"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel
              as={motion.div}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-gray-800 border border-gray-700 rounded-lg shadow-xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <FiMessageSquare className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <Dialog.Title className="text-lg font-semibold text-white">
                      Contact Support
                    </Dialog.Title>
                    <p className="text-sm text-gray-400">
                      We'll get back to you as soon as possible
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {/* Subject */}
                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-gray-300 mb-2">
                    Subject *
                  </label>
                  <input
                    id="subject"
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Brief description of your issue"
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                    maxLength={100}
                  />
                  <p className="text-xs text-gray-500 mt-1">{subject.length}/100 characters</p>
                </div>

                {/* Details */}
                <div>
                  <label htmlFor="details" className="block text-sm font-medium text-gray-300 mb-2">
                    Details *
                  </label>
                  <textarea
                    id="details"
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="Please provide detailed information about your issue or question..."
                    disabled={isSubmitting}
                    rows={5}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 resize-none"
                    maxLength={1000}
                  />
                  <p className="text-xs text-gray-500 mt-1">{details.length}/1000 characters</p>
                </div>

                {/* Info */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <FiMail className="w-4 h-4 text-blue-400 mt-0.5" />
                    <div className="text-sm text-blue-300">
                      <p className="font-medium mb-1">Your request will include:</p>
                      <ul className="text-xs text-blue-200 space-y-0.5">
                        <li>• Partner: {partnerName || 'Not available'}</li>
                        <li>• Email: {partnerEmail || 'Not available'}</li>
                        <li>• Context: {context.charAt(0).toUpperCase() + context.slice(1)} page</li>
                        <li>• Auto-generated support ID for tracking</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-2">
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
                    disabled={isSubmitting || !subject.trim() || !details.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <FiLoader className="w-4 h-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <FiSend className="w-4 h-4" />
                        Submit Request
                      </>
                    )}
                  </button>
                </div>
              </form>
            </Dialog.Panel>
          </div>
        </Dialog>
      )}
    </AnimatePresence>
  );
}
