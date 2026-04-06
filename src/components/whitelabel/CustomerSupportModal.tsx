'use client';

import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { FiX, FiSend, FiLoader, FiMail, FiMessageSquare, FiCheck, FiPhone } from 'react-icons/fi';
import toast from 'react-hot-toast';

interface CustomerSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCategory?: string;
  defaultSubject?: string;
  defaultDetails?: string;
}

const supportCategories = [
  { value: 'call_forwarding', label: 'Call Forwarding Issues', icon: FiPhone },
  { value: 'technical', label: 'Technical Support', icon: FiMessageSquare },
  { value: 'billing', label: 'Billing Questions', icon: FiMail },
  { value: 'general', label: 'General Support', icon: FiMessageSquare }
];

export default function CustomerSupportModal({
  isOpen,
  onClose,
  defaultCategory = 'call_forwarding',
  defaultSubject = '',
  defaultDetails = ''
}: CustomerSupportModalProps) {
  const [category, setCategory] = useState(defaultCategory);
  const [subject, setSubject] = useState(defaultSubject);
  const [details, setDetails] = useState(defaultDetails);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [supportId, setSupportId] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subject.trim() || !details.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/whitelabel/support/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category: category,
          subject: subject.trim(),
          details: details.trim()
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setSupportId(result.supportId);
        setIsSubmitted(true);
        toast.success('Support request submitted successfully!');
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
      setIsSubmitted(false);
      setSupportId('');
      setSubject(defaultSubject);
      setDetails(defaultDetails);
      setCategory(defaultCategory);
      onClose();
    }
  };

  const selectedCategoryData = supportCategories.find(cat => cat.value === category);
  const CategoryIcon = selectedCategoryData?.icon || FiMessageSquare;

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/90" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-gray-900 rounded-lg max-w-2xl w-full border border-gray-800 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-500/20">
                <CategoryIcon className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <Dialog.Title className="text-xl font-semibold text-white">
                  {isSubmitted ? 'Support Request Submitted' : 'Contact Support'}
                </Dialog.Title>
                <p className="text-sm text-gray-400">
                  {isSubmitted ? 'We\'ll get back to you soon' : 'Get help with your issue'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="text-gray-400 hover:text-white disabled:opacity-50"
            >
              <FiX className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6">
            {isSubmitted ? (
              /* Success State */
              <div className="text-center space-y-6">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                  <FiCheck className="w-8 h-8 text-green-400" />
                </div>
                
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">Request Submitted Successfully!</h3>
                  <p className="text-gray-400 mb-4">
                    Your support request has been sent to our team. We'll review it and get back to you as soon as possible.
                  </p>
                  
                  <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <p className="text-sm text-gray-300 mb-2">Your reference number:</p>
                    <p className="text-2xl font-mono text-blue-400 font-bold">{supportId}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      Please save this reference number for your records
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleClose}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              /* Form State */
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Category Selection */}
                <div>
                  <label className="block text-sm font-medium text-white mb-3">
                    What do you need help with?
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {supportCategories.map((cat) => {
                      const Icon = cat.icon;
                      return (
                        <button
                          key={cat.value}
                          type="button"
                          onClick={() => setCategory(cat.value)}
                          className={`p-3 rounded-lg border text-left flex items-center gap-3 transition-colors ${
                            category === cat.value
                              ? 'border-blue-500 bg-blue-500/10 text-white'
                              : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-500'
                          }`}
                        >
                          <Icon className={`w-5 h-5 ${category === cat.value ? 'text-blue-400' : 'text-gray-400'}`} />
                          <span className="font-medium">{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-white mb-2">
                    Subject *
                  </label>
                  <input
                    type="text"
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Brief description of your issue"
                    className="w-full p-3 rounded-lg border border-gray-600 bg-gray-800 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>

                {/* Details */}
                <div>
                  <label htmlFor="details" className="block text-sm font-medium text-white mb-2">
                    Details *
                  </label>
                  <textarea
                    id="details"
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="Please provide as much detail as possible about your issue..."
                    rows={6}
                    className="w-full p-3 rounded-lg border border-gray-600 bg-gray-800 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-vertical"
                    required
                  />
                </div>

                {/* Submit Button */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isSubmitting}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !subject.trim() || !details.trim()}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
            )}
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
