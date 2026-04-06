'use client';

import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import {
  FiX,
  FiDollarSign,
  FiStar,
  FiLoader,
  FiInfo
} from 'react-icons/fi';

interface CreditPlanFormData {
  name: string;
  credits: number;
  priceCents: number;
  priceUSD: number;
  discountPercentage: number;
  isPopular: boolean;
  description?: string;
  sortOrder: number;
}

interface CreateCreditPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingPlan?: any;
}

const CreateCreditPlanModal: React.FC<CreateCreditPlanModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editingPlan
}) => {
  const [submitting, setSubmitting] = useState(false);
  const isEditing = !!editingPlan;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue
  } = useForm<CreditPlanFormData>({
    defaultValues: editingPlan ? {
      name: editingPlan.name,
      credits: editingPlan.credits,
      priceCents: editingPlan.priceCents,
      priceUSD: editingPlan.priceCents / 100,
      discountPercentage: editingPlan.discountPercentage,
      isPopular: editingPlan.isPopular,
      description: editingPlan.description || '',
      sortOrder: editingPlan.sortOrder
    } : {
      name: '',
      credits: 1000,
      priceCents: 1000, // $10.00
      priceUSD: 10.00,
      discountPercentage: 0,
      isPopular: false,
      description: '',
      sortOrder: 0
    }
  });

  const credits = watch('credits');
  const priceUSD = watch('priceUSD');

  const calculatePricePerCredit = () => {
    if (credits && priceUSD) {
      return (priceUSD / credits).toFixed(4);
    }
    return '0.0000';
  };

  const onSubmit = async (data: CreditPlanFormData) => {
    try {
      setSubmitting(true);

      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication token not found. Please log in again.');
        return;
      }

      const url = isEditing
        ? `/api/partner/customer-credit-plans/${editingPlan.id}`
        : '/api/partner/customer-credit-plans';

      const method = isEditing ? 'PUT' : 'POST';

      // Convert string values to numbers for API
      const payload = {
        ...data,
        credits: parseInt(data.credits.toString()) || 0,
        priceCents: parseInt(data.priceCents.toString()) || 0,
        discountPercentage: parseFloat(data.discountPercentage.toString()) || 0,
        sortOrder: parseInt(data.sortOrder.toString()) || 0,
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`Credit plan ${isEditing ? 'updated' : 'created'} successfully!`);
        reset();
        onSuccess();
        onClose();
      } else {
        toast.error(result.error || `Failed to ${isEditing ? 'update' : 'create'} credit plan`);
      }
    } catch (error) {
      console.error('Error submitting credit plan:', error);
      toast.error(`Failed to ${isEditing ? 'update' : 'create'} credit plan`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      reset();
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
              className="bg-gray-900 rounded-2xl shadow-2xl border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-700">
                <div>
                  <Dialog.Title className="text-2xl font-bold text-white">
                    {isEditing ? 'Edit Credit Plan' : 'Create Credit Plan'}
                  </Dialog.Title>
                  <p className="text-gray-400 mt-1">
                    {isEditing ? 'Update your customer credit plan' : 'Create a new credit plan for your customers'}
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  disabled={submitting}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
                >
                  <FiX className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Plan Name *
                    </label>
                    <input
                      {...register('name', {
                        required: 'Plan name is required',
                        maxLength: { value: 100, message: 'Name too long' }
                      })}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-gray-400"
                      placeholder="e.g., Starter Pack"
                    />
                    {errors.name && (
                      <p className="text-red-400 text-sm mt-1">{errors.name.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Credits *
                    </label>
                    <input
                      {...register('credits', {
                        required: 'Credits amount is required',
                        min: { value: 1, message: 'Must be at least 1 credit' },
                        max: { value: 1000000, message: 'Too many credits' }
                      })}
                      type="number"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-gray-400"
                      placeholder="1000"
                    />
                    {errors.credits && (
                      <p className="text-red-400 text-sm mt-1">{errors.credits.message}</p>
                    )}
                  </div>
                </div>

                {/* Pricing */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Price (USD) *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiDollarSign className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        {...register('priceUSD', {
                          required: 'Price is required',
                          min: { value: 0.50, message: 'Must be at least $0.50 to meet Stripe minimum requirements' },
                          max: { value: 10000, message: 'Price cannot exceed $10,000 per plan for security reasons' }
                        })}
                        type="number"
                        step="0.01"
                        className="w-full pl-10 pr-3 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-gray-400"
                        placeholder="10.00"
                        onChange={(e) => {
                          const dollarValue = parseFloat(e.target.value) || 0;
                          setValue('priceUSD', dollarValue);
                          setValue('priceCents', Math.round(dollarValue * 100));
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Enter price in dollars (e.g., 10.00 for $10.00). Minimum $0.50 required by Stripe.
                    </p>
                    {errors.priceUSD && (
                      <p className="text-red-400 text-sm mt-1">{errors.priceUSD.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Discount %
                    </label>
                    <input
                      {...register('discountPercentage', {
                        min: { value: 0, message: 'Cannot be negative' },
                        max: { value: 100, message: 'Cannot exceed 100%' }
                      })}
                      type="number"
                      step="0.1"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-gray-400"
                      placeholder="0"
                    />
                    {errors.discountPercentage && (
                      <p className="text-red-400 text-sm mt-1">{errors.discountPercentage.message}</p>
                    )}
                  </div>
                </div>

                {/* Price per credit display */}
                <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <FiInfo className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-medium text-blue-300">
                      Price per credit: ${calculatePricePerCredit()}
                    </span>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    {...register('description', {
                      maxLength: { value: 500, message: 'Description too long' }
                    })}
                    rows={3}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-gray-400"
                    placeholder="Optional description for this credit plan..."
                  />
                  {errors.description && (
                    <p className="text-red-400 text-sm mt-1">{errors.description.message}</p>
                  )}
                </div>

                {/* Options */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="flex items-center gap-3">
                      <input
                        {...register('isPopular')}
                        type="checkbox"
                        className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                      />
                      <div className="flex items-center gap-2">
                        <FiStar className="w-4 h-4 text-amber-400" />
                        <span className="text-sm font-medium text-gray-300">
                          Mark as Popular
                        </span>
                      </div>
                    </label>
                    <p className="text-xs text-gray-400 mt-1 ml-7">
                      Popular plans are highlighted to customers
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Sort Order
                    </label>
                    <input
                      {...register('sortOrder', {
                        min: { value: 0, message: 'Cannot be negative' }
                      })}
                      type="number"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-gray-400"
                      placeholder="0"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Lower numbers appear first
                    </p>
                  </div>
                </div>

                {/* Submit Buttons */}
                <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-700">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={submitting}
                    className="px-4 py-2 text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <FiLoader className="w-4 h-4 animate-spin" />
                        {isEditing ? 'Updating...' : 'Creating...'}
                      </>
                    ) : (
                      <>
                        <FiDollarSign className="w-4 h-4" />
                        {isEditing ? 'Update Plan' : 'Create Plan'}
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
};

export default CreateCreditPlanModal;
