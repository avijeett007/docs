'use client';

import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import partnerOnboardingQuestions from '@/config/dashboard/partnerOnboardingQuestions.json';

interface CustomerOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (customerData: any) => void;
  existingCustomer?: {
    firstName: string;
    lastName: string;
    companyName: string;
    email: string;
    monthlyCallVolume: string;
  } | null;
}

interface FormData {
  [key: string]: any;
}

interface BaseField {
  id: string;
  type: string;
  label: string;
  placeholder: string;
  required: boolean;
  validation?: string;
}

interface TextField extends BaseField {
  type: 'text' | 'email' | 'tel';
}

interface SelectField extends BaseField {
  type: 'select';
  options: string[];
}

interface RadioField extends BaseField {
  type: 'radio';
  options: string[];
}

type FormField = TextField | SelectField | RadioField;

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

const slideIn = {
  initial: { opacity: 0, x: 50 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -50 }
};

export default function CustomerOnboardingModal({ isOpen, onClose, onSuccess, existingCustomer }: CustomerOnboardingModalProps) {
  const [currentSection, setCurrentSection] = useState(0);
  const [currentField, setCurrentField] = useState(0);
  const [formData, setFormData] = useState<FormData>({});
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const sections = partnerOnboardingQuestions.questions;
  const currentSectionData = sections[currentSection];
  const currentFieldData = currentSectionData?.fields[currentField] as FormField;
  const totalQuestions = sections.reduce((acc, section) => acc + section.fields.length, 0);
  const questionsAnswered = sections.slice(0, currentSection).reduce((acc, section) => acc + section.fields.length, 0) + currentField;
  const progress = (questionsAnswered / totalQuestions) * 100;

  useEffect(() => {
    if (existingCustomer) {
      // Transform existing customer data into form data format
      const initialFormData: FormData = {
        basic: {
          firstName: existingCustomer.firstName,
          lastName: existingCustomer.lastName,
          email: existingCustomer.email,
        },
        business: {
          companyName: existingCustomer.companyName,
          monthlyCallVolume: existingCustomer.monthlyCallVolume,
        }
      };
      setFormData(initialFormData);
      // Reset to first section and field
      setCurrentSection(0);
      setCurrentField(0);
    } else {
      const savedData = localStorage.getItem('customerOnboardingData');
      if (savedData) {
        setFormData(JSON.parse(savedData));
      }
    }
  }, [existingCustomer, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      // Clear form data when modal is closed
      setFormData({});
      setCurrentSection(0);
      setCurrentField(0);
      setErrors({});
    }
  }, [isOpen]);

  useEffect(() => {
    localStorage.setItem('customerOnboardingData', JSON.stringify(formData));
  }, [formData]);

  const validateField = (field: FormField, value: any) => {
    if (field.required && !value) {
      return 'This field is required';
    }
    if (field.validation === 'email' && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return 'Please enter a valid email address';
      }
    }
    if (field.validation === 'phone' && value) {
      const phoneRegex = /^\+?[\d\s-()]+$/;
      if (!phoneRegex.test(value)) {
        return 'Please enter a valid phone number';
      }
    }
    return '';
  };

  const handleInputChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      [currentSectionData.section]: {
        ...prev[currentSectionData.section],
        [currentFieldData.id]: value
      }
    }));

    if (errors[`${currentSectionData.section}.${currentFieldData.id}`]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[`${currentSectionData.section}.${currentFieldData.id}`];
        return newErrors;
      });
    }
  };

  const handleNext = async () => {
    const value = formData[currentSectionData.section]?.[currentFieldData.id];
    const error = validateField(currentFieldData, value);

    if (error) {
      setErrors(prev => ({
        ...prev,
        [`${currentSectionData.section}.${currentFieldData.id}`]: error
      }));
      return;
    }

    const isLastSection = currentSection === sections.length - 1;
    const isLastField = currentField === currentSectionData.fields.length - 1;

    if (isLastSection && isLastField) {
      await handleSubmit();
    } else if (currentField === currentSectionData.fields.length - 1) {
      setCurrentSection(prev => prev + 1);
      setCurrentField(0);
    } else {
      setCurrentField(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentField > 0) {
      setCurrentField(prev => prev - 1);
    } else if (currentSection > 0) {
      setCurrentSection(prev => prev - 1);
      const prevSection = sections[currentSection - 1];
      setCurrentField(prevSection.fields.length - 1);
    }
  };

  const handleSubmit = async () => {
    try {
      const response = await fetch('/api/partner/create-customer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create customer');
      }

      localStorage.removeItem('customerOnboardingData');
      if (onSuccess && data.data) {
        // Pass just the customer data, not the entire response
        onSuccess(data.data);
      }
      onClose();
    } catch (error) {
      console.error('Error creating customer:', error);
      alert('Unable to create customer. Please try again later.');
    }
  };

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset the form? All progress will be lost.')) {
      setFormData({});
      setCurrentSection(0);
      setCurrentField(0);
      setErrors({});
      localStorage.removeItem('customerOnboardingData');
    }
  };

  const renderField = () => {
    if (!currentFieldData) return null;

    const value = formData[currentSectionData.section]?.[currentFieldData.id] || '';
    const error = errors[`${currentSectionData.section}.${currentFieldData.id}`];

    switch (currentFieldData.type) {
      case 'text':
      case 'email':
      case 'tel':
        return (
          <motion.div className="space-y-2" {...fadeIn}>
            <input
              type={currentFieldData.type}
              id={currentFieldData.id}
              value={value}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder={currentFieldData.placeholder}
              className={`w-full p-4 bg-gray-900/50 backdrop-blur-lg
                border ${error ? 'border-red-500' : 'border-gray-700'}
                rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent
                transition-all duration-200 text-white text-lg
                placeholder-gray-400
              `}
              autoFocus
              required={currentFieldData.required}
            />
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-500 text-sm mt-2"
              >
                {error}
              </motion.p>
            )}
          </motion.div>
        );
      case 'select':
        return (
          <motion.div className="space-y-4" {...fadeIn}>
            <select
              value={value}
              onChange={(e) => handleInputChange(e.target.value)}
              className={`w-full p-4 bg-gray-900/50 backdrop-blur-lg
                border ${error ? 'border-red-500' : 'border-gray-700'}
                rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent
                transition-all duration-200 text-white text-lg
              `}
              required={currentFieldData.required}
            >
              <option value="">Select an option</option>
              {(currentFieldData as SelectField).options.map((option: string) => (
                <option key={option} value={option} className="bg-gray-800">
                  {option}
                </option>
              ))}
            </select>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-500 text-sm mt-2"
              >
                {error}
              </motion.p>
            )}
          </motion.div>
        );
      case 'radio':
        return (
          <motion.div className="space-y-4" {...fadeIn}>
            {(currentFieldData as RadioField).options.map((option: string) => (
              <label
                key={option}
                className={`flex items-center space-x-3 p-4
                  ${value === option ? 'bg-gray-800 border-blue-500' : 'bg-gray-900/30 border-gray-700'}
                  border rounded-xl hover:bg-gray-800 transition-colors cursor-pointer
                `}
              >
                <input
                  type="radio"
                  name={currentFieldData.id}
                  value={option}
                  checked={value === option}
                  onChange={(e) => handleInputChange(e.target.value)}
                  className="text-blue-500 focus:ring-blue-500"
                  required={currentFieldData.required}
                />
                <span className="text-white">{option}</span>
              </label>
            ))}
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-500 text-sm mt-2"
              >
                {error}
              </motion.p>
            )}
          </motion.div>
        );
      default:
        return null;
    }
  };

  if (!currentSectionData || !currentFieldData) {
    return null;
  }

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      className="fixed inset-0 z-50 overflow-y-auto"
    >
      <div className="min-h-screen px-4 text-center">
        <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
        <span className="inline-block h-screen align-middle" aria-hidden="true">&#8203;</span>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-block w-full max-w-2xl p-8 my-8 overflow-hidden text-left align-middle transition-all transform bg-gray-900/90 backdrop-blur-xl shadow-xl rounded-2xl border border-gray-700"
        >
          {/* Progress Bar */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gray-800">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-500 to-teal-500"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          <div className="flex justify-between items-center mb-8">
            <div>
              <Dialog.Title className="text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                {currentSectionData.title}
              </Dialog.Title>
              <p className="text-gray-400 mt-2">{currentSectionData.subtitle}</p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleReset}
                className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 rounded-lg
                  hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500
                  transition-colors flex items-center space-x-1"
                title="Reset form"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
                <span>Reset</span>
              </button>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800
                  focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
                title="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={`${currentSection}-${currentField}`}
              initial="initial"
              animate="animate"
              exit="exit"
              variants={slideIn}
              className="mb-8"
            >
              <label className="block text-xl font-medium text-gray-200 mb-4">
                {currentFieldData.label}
              </label>
              {renderField()}
            </motion.div>
          </AnimatePresence>

          <div className="flex justify-between mt-8">
            <button
              onClick={handlePrevious}
              disabled={currentSection === 0 && currentField === 0}
              className="px-6 py-3 text-white bg-gray-800 rounded-xl
                hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500
                disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <div className="text-gray-400 self-center">
              Question {questionsAnswered + 1} of {totalQuestions}
            </div>
            <button
              onClick={handleNext}
              className="px-6 py-3 text-white bg-gradient-to-r from-blue-500 to-teal-500
                rounded-xl hover:from-blue-600 hover:to-teal-600
                focus:outline-none focus:ring-2 focus:ring-blue-500
                transition-all transform hover:scale-105"
            >
              {currentSection === sections.length - 1 && currentField === currentSectionData.fields.length - 1
                ? 'Submit'
                : 'Next'}
            </button>
          </div>
        </motion.div>
      </div>
    </Dialog>
  );
}
