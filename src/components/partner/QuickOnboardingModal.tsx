'use client';

import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiUser, FiMail, FiHome, FiPhone, FiAlertCircle, FiCheck } from 'react-icons/fi';

interface QuickOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (customerData: any) => void;
}

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  companyName: string;
  businessPhone: string;
  monthlyCallVolume: string;
  allowPortalAccess: boolean;
}

const defaultFormData: FormData = {
  firstName: '',
  lastName: '',
  email: '',
  companyName: '',
  businessPhone: '',
  monthlyCallVolume: '100-500',
  allowPortalAccess: true
};

export default function QuickOnboardingModal({ isOpen, onClose, onSuccess }: QuickOnboardingModalProps) {
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [partnerData, setPartnerData] = useState<any>(null);
  const [hasPartnerAsCustomer, setHasPartnerAsCustomer] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens
      setFormData(defaultFormData);
      setErrors({});
      checkPartnerAsCustomer();
    }
  }, [isOpen]);

  const checkPartnerAsCustomer = async () => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch('/api/partner/check-self-customer', {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      if (response.ok) {
        const data = await response.json();
        setHasPartnerAsCustomer(data.hasCustomerAccount);
        setPartnerData(data.partnerData);
      }
    } catch (error) {
      console.error('Error checking partner customer status:', error);
    }
  };

  const handleInputChange = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.companyName.trim()) {
      newErrors.companyName = 'Company name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleOnboardMyself = () => {
    if (partnerData) {
      setFormData({
        firstName: partnerData.contactName?.split(' ')[0] || '',
        lastName: partnerData.contactName?.split(' ').slice(1).join(' ') || '',
        email: partnerData.emailAddress || '',
        companyName: partnerData.businessName || '',
        businessPhone: partnerData.phoneNumber || '',
        monthlyCallVolume: '100-500',
        allowPortalAccess: true
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Default values for quick onboarding
      const defaultValues = {
        peakHours: 'Business Hours (9 AM - 5 PM)',
        primaryUseCase: 'Customer Support',
        callComplexity: 'Medium',
        crmSystem: 'None',
        phoneSystem: 'Cloud-based',
        scriptComplexity: 'Medium',
        languages: ['English'],
        deploymentTimeline: '1-2 weeks',
        wantsDemo: false,
        customAutomation: 'Standard package'
      };

      const requestData = {
        basic: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          businessPhone: formData.businessPhone
        },
        business: {
          companyName: formData.companyName,
          monthlyCallVolume: formData.monthlyCallVolume,
          peakHours: defaultValues.peakHours,
          primaryUseCase: defaultValues.primaryUseCase
        },
        requirements: {
          callComplexity: defaultValues.callComplexity,
          scriptComplexity: defaultValues.scriptComplexity,
          languages: defaultValues.languages,
          customAutomation: defaultValues.customAutomation
        },
        integration: {
          crmSystem: defaultValues.crmSystem,
          phoneSystem: defaultValues.phoneSystem
        },
        deployment: {
          deploymentTimeline: defaultValues.deploymentTimeline,
          wantsDemo: defaultValues.wantsDemo
        },
        isQuickOnboarding: true,
        allowPortalAccess: formData.allowPortalAccess
      };

      const response = await fetch('/api/partner/create-customer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create customer');
      }

      const result = await response.json();
      
      if (onSuccess) {
        onSuccess(result);
      }

      onClose();
    } catch (error) {
      console.error('Error creating customer:', error);
      setErrors({ submit: error instanceof Error ? error.message : 'An error occurred' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog
          static
          open={isOpen}
          onClose={onClose}
          className="fixed inset-0 z-50"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />

          <div className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto">
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
              className="relative bg-gray-900/95 backdrop-blur-xl rounded-xl p-6 w-full max-w-md shadow-2xl border border-gray-800/50 shadow-blue-500/10 max-h-[90vh] overflow-y-auto my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <Dialog.Title className="text-xl font-semibold text-white">
                  Quick Customer Onboarding
                </Dialog.Title>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              {/* Quick Onboard Myself Button */}
              {!hasPartnerAsCustomer && partnerData && (
                <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <FiUser className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-medium text-blue-400">Quick Option</span>
                  </div>
                  <p className="text-sm text-gray-300 mb-3">
                    Onboard yourself as a customer to access the customer portal
                  </p>
                  <button
                    type="button"
                    onClick={handleOnboardMyself}
                    className="w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white rounded-lg transition-all duration-300 transform hover:scale-105 text-sm font-medium shadow-lg shadow-blue-500/25"
                  >
                    Onboard Myself
                  </button>
                </div>
              )}

              {/* Default Values Notice */}
              <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <FiAlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-400 mb-1">Using Default Values</p>
                    <p className="text-xs text-gray-300">
                      This quick onboarding uses standard defaults. Estimated pricing may not be accurate. 
                      Use full onboarding for detailed pricing calculations.
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      First Name *
                    </label>
                    <div className="relative">
                      <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => handleInputChange('firstName', e.target.value)}
                        className={`w-full pl-10 pr-4 py-2 bg-gray-800 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          errors.firstName ? 'border-red-500' : 'border-gray-700'
                        }`}
                        placeholder="John"
                      />
                    </div>
                    {errors.firstName && (
                      <p className="text-red-400 text-xs mt-1">{errors.firstName}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Last Name *
                    </label>
                    <div className="relative">
                      <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => handleInputChange('lastName', e.target.value)}
                        className={`w-full pl-10 pr-4 py-2 bg-gray-800 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          errors.lastName ? 'border-red-500' : 'border-gray-700'
                        }`}
                        placeholder="Doe"
                      />
                    </div>
                    {errors.lastName && (
                      <p className="text-red-400 text-xs mt-1">{errors.lastName}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email Address *
                  </label>
                  <div className="relative">
                    <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className={`w-full pl-10 pr-4 py-2 bg-gray-800 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.email ? 'border-red-500' : 'border-gray-700'
                      }`}
                      placeholder="john@company.com"
                    />
                  </div>
                  {errors.email && (
                    <p className="text-red-400 text-xs mt-1">{errors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Company Name *
                  </label>
                  <div className="relative">
                    <FiHome className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      value={formData.companyName}
                      onChange={(e) => handleInputChange('companyName', e.target.value)}
                      className={`w-full pl-10 pr-4 py-2 bg-gray-800 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.companyName ? 'border-red-500' : 'border-gray-700'
                      }`}
                      placeholder="Company Inc."
                    />
                  </div>
                  {errors.companyName && (
                    <p className="text-red-400 text-xs mt-1">{errors.companyName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Business Phone
                  </label>
                  <div className="relative">
                    <FiPhone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="tel"
                      value={formData.businessPhone}
                      onChange={(e) => handleInputChange('businessPhone', e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Monthly Call Volume
                  </label>
                  <select
                    value={formData.monthlyCallVolume}
                    onChange={(e) => handleInputChange('monthlyCallVolume', e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="1-50">1-50 calls</option>
                    <option value="51-100">51-100 calls</option>
                    <option value="100-500">100-500 calls</option>
                    <option value="500-1000">500-1000 calls</option>
                    <option value="1000+">1000+ calls</option>
                  </select>
                </div>

                {/* Portal Access Checkbox */}
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.allowPortalAccess}
                      onChange={(e) => handleInputChange('allowPortalAccess', e.target.checked)}
                      className="mt-1 w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-blue-400">Allow Portal Access</span>
                      <p className="text-xs text-gray-300 mt-1">
                        Enable customer to login to their whitelabel portal immediately. They will receive an email with login credentials.
                      </p>
                    </div>
                  </label>
                </div>

                {errors.submit && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-red-400 text-sm">{errors.submit}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-4 py-2 bg-gray-800/50 border border-gray-700 hover:bg-gray-700/50 hover:border-gray-600 text-white rounded-lg transition-all duration-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 shadow-lg shadow-green-500/25"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                        Creating...
                      </>
                    ) : (
                      <>
                        <FiCheck className="w-4 h-4" />
                        Create Customer
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
