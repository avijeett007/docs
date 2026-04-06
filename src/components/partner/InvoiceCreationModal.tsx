'use client';

import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  FiX,
  FiDollarSign,
  FiCalendar,
  FiFileText,
  FiRepeat,
  FiClock
} from 'react-icons/fi';
import { FormattedInvoice, InvoiceType, RecurringInterval } from '@/types/invoice';

interface InvoiceCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    companyName: string;
    email: string;
  };
  onInvoiceCreated: (invoice: FormattedInvoice) => void;
}

interface InvoiceFormData {
  title: string;
  description: string;
  amount: string;
  currency: string;
  dueDate: string;
  type: InvoiceType;
  recurringInterval?: RecurringInterval;
  recurringCount?: string;
}

export default function InvoiceCreationModal({
  isOpen,
  onClose,
  customer,
  onInvoiceCreated
}: InvoiceCreationModalProps) {
  const [formData, setFormData] = useState<InvoiceFormData>({
    title: '',
    description: '',
    amount: '',
    currency: 'usd',
    dueDate: '',
    type: 'one_time',
    recurringInterval: 'monthly',
    recurringCount: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isValidatingCustomer, setIsValidatingCustomer] = useState(false);
  const [actualCustomerId, setActualCustomerId] = useState<string | null>(null);

  // Validate and resolve customer ID - handles both Customer ID and UserOnboarding ID
  const validateCustomerId = async (): Promise<string | null> => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      // Check if this customer exists and get their portal eligibility
      // This will tell us if customer.id is a UserOnboarding ID and give us the actual Customer ID
      const eligibilityResponse = await fetch(`/api/partner/customers/${customer.id}/check-portal-eligibility`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (eligibilityResponse.ok) {
        const eligibilityData = await eligibilityResponse.json();
        if (eligibilityData.eligible && eligibilityData.customerId) {
          // This means customer.id was a UserOnboarding ID, and we got the actual Customer ID
          console.log('Resolved UserOnboarding ID to Customer ID:', eligibilityData.customerId);
          return eligibilityData.customerId;
        }
      }

      // If eligibility check failed, assume customer.id is already the Customer ID
      // (this handles the case when called from CustomerBillingTab)
      console.log('Using customer.id directly as Customer ID:', customer.id);
      return customer.id;
    } catch (error) {
      console.error('Error validating customer ID:', error);
      return null;
    }
  };

  const handleInputChange = (field: keyof InvoiceFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.amount.trim()) {
      newErrors.amount = 'Amount is required';
    } else {
      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        newErrors.amount = 'Amount must be a positive number';
      } else if (amount < 0.50) {
        newErrors.amount = 'Minimum amount is $0.50';
      }
    }

    if (formData.type === 'recurring' && formData.recurringCount) {
      const count = parseInt(formData.recurringCount);
      if (isNaN(count) || count <= 0) {
        newErrors.recurringCount = 'Recurring count must be a positive number';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Validate and get the actual customer ID
      const validCustomerId = await validateCustomerId();
      if (!validCustomerId) {
        throw new Error('Customer record not found. Please ensure the customer is properly onboarded before creating invoices.');
      }

      const token = localStorage.getItem('partner_token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      // Convert amount to cents
      const amountInCents = Math.round(parseFloat(formData.amount) * 100);

      const requestData = {
        customerId: validCustomerId, // Use the validated customer ID
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        amount: amountInCents,
        currency: formData.currency,
        dueDate: formData.dueDate || undefined,
        type: formData.type,
        ...(formData.type === 'recurring' && {
          recurringInterval: formData.recurringInterval,
          recurringCount: formData.recurringCount ? parseInt(formData.recurringCount) : undefined,
        }),
      };

      const response = await fetch('/api/partner/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create invoice');
      }

      const data = await response.json();
      if (data.success) {
        onInvoiceCreated(data.data);
        onClose();
        // Reset form
        setFormData({
          title: '',
          description: '',
          amount: '',
          currency: 'usd',
          dueDate: '',
          type: 'one_time',
          recurringInterval: 'monthly',
          recurringCount: '',
        });
      }
    } catch (error: any) {
      console.error('Error creating invoice:', error);
      toast.error(error.message || 'Failed to create invoice');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  // Get default due date (30 days from now)
  const getDefaultDueDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().split('T')[0];
  };

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      className="relative z-50"
    >
      <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <Dialog.Panel
          as={motion.div}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
            transition: {
              type: "spring",
              damping: 25,
              stiffness: 300
            }
          }}
          exit={{
            opacity: 0,
            y: 20,
            scale: 0.95,
            transition: {
              duration: 0.2
            }
          }}
          className="relative bg-gray-900 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl border border-gray-800"
        >
          <div className="flex justify-between items-start mb-6">
            <div>
              <Dialog.Title className="text-2xl font-bold text-white">
                Create Invoice
              </Dialog.Title>
              <p className="text-gray-400 mt-1">
                Create a new invoice for {customer.companyName || `${customer.firstName} ${customer.lastName}`}
              </p>
            </div>
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <FiX className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Invoice Title */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Invoice Title *
              </label>
              <div className="relative">
                <FiFileText className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="e.g., Monthly Service Fee, Setup Cost"
                  className={`w-full pl-10 pr-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.title ? 'border-red-500' : 'border-gray-700'
                  }`}
                />
              </div>
              {errors.title && (
                <p className="text-red-400 text-sm mt-1">{errors.title}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description (Optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Add any additional details about this invoice..."
                rows={3}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Amount and Currency */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Amount *
                </label>
                <div className="relative">
                  <FiDollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="number"
                    step="0.01"
                    min="0.50"
                    value={formData.amount}
                    onChange={(e) => handleInputChange('amount', e.target.value)}
                    placeholder="0.00"
                    className={`w-full pl-10 pr-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.amount ? 'border-red-500' : 'border-gray-700'
                    }`}
                  />
                </div>
                {errors.amount && (
                  <p className="text-red-400 text-sm mt-1">{errors.amount}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Currency
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => handleInputChange('currency', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="usd">USD</option>
                  <option value="eur">EUR</option>
                  <option value="gbp">GBP</option>
                </select>
              </div>
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Due Date (Optional)
              </label>
              <div className="relative">
                <FiCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => handleInputChange('dueDate', e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="text-gray-500 text-sm mt-1">
                Leave empty for no due date, or{' '}
                <button
                  type="button"
                  onClick={() => handleInputChange('dueDate', getDefaultDueDate())}
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  set to 30 days from now
                </button>
              </p>
            </div>

            {/* Invoice Type */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Invoice Type
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => handleInputChange('type', 'one_time')}
                  className={`p-4 rounded-lg border-2 transition-colors ${
                    formData.type === 'one_time'
                      ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                      : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <FiDollarSign className="w-6 h-6 mx-auto mb-2" />
                  <div className="font-medium">One-time</div>
                  <div className="text-sm opacity-75">Single payment</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleInputChange('type', 'recurring')}
                  className={`p-4 rounded-lg border-2 transition-colors ${
                    formData.type === 'recurring'
                      ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                      : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <FiRepeat className="w-6 h-6 mx-auto mb-2" />
                  <div className="font-medium">Recurring</div>
                  <div className="text-sm opacity-75">Repeat payments</div>
                </button>
              </div>
            </div>

            {/* Recurring Options */}
            {formData.type === 'recurring' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Recurring Interval
                  </label>
                  <select
                    value={formData.recurringInterval}
                    onChange={(e) => handleInputChange('recurringInterval', e.target.value as RecurringInterval)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Number of Payments (Optional)
                  </label>
                  <div className="relative">
                    <FiClock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="number"
                      min="1"
                      value={formData.recurringCount}
                      onChange={(e) => handleInputChange('recurringCount', e.target.value)}
                      placeholder="Unlimited"
                      className={`w-full pl-10 pr-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.recurringCount ? 'border-red-500' : 'border-gray-700'
                      }`}
                    />
                  </div>
                  {errors.recurringCount && (
                    <p className="text-red-400 text-sm mt-1">{errors.recurringCount}</p>
                  )}
                  <p className="text-gray-500 text-sm mt-1">
                    Leave empty for unlimited recurring payments
                  </p>
                </div>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex justify-end gap-3 pt-6 border-t border-gray-800">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-6 py-3 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isValidatingCustomer}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-teal-500 rounded-lg font-semibold hover:from-blue-600 hover:to-teal-600 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                    <span>Creating...</span>
                  </>
                ) : isValidatingCustomer ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                    <span>Validating...</span>
                  </>
                ) : (
                  <>
                    <FiDollarSign className="w-4 h-4" />
                    <span>Create Invoice</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
