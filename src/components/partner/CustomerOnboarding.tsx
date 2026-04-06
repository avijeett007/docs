import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BaseFormField {
  id: string;
  type: string;
  label: string;
  placeholder: string;
  required: boolean;
  validation?: string;
}

interface TextFormField extends BaseFormField {
  type: 'text' | 'email' | 'tel';
}

interface RadioFormField extends BaseFormField {
  type: 'radio';
  options: string[];
}

type FormField = TextFormField | RadioFormField;

interface FormSection {
  section: string;
  title: string;
  subtitle: string;
  fields: FormField[];
}

interface CustomerOnboardingProps {
  currentQuestionSet: FormSection;
  currentField: FormField;
  formData: Record<string, Record<string, any>>;
  errors: Record<string, string>;
  handleInputChange: (sectionId: string, fieldId: string, value: any) => void;
  handleReset: () => void;
  isLastSection: boolean;
  isLastField: boolean;
  handleBack: () => void;
  handleNext: () => void;
  handleSubmit: () => void;
  currentQuestionNumber: number;
  totalQuestions: number;
  isSubmitting: boolean;
}

const CustomerOnboarding: React.FC<CustomerOnboardingProps> = ({
  currentQuestionSet,
  currentField,
  formData,
  errors,
  handleInputChange,
  handleReset,
  isLastSection,
  isLastField,
  handleBack,
  handleNext,
  handleSubmit,
  currentQuestionNumber,
  totalQuestions,
  isSubmitting,
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="bg-gray-800 rounded-lg shadow-xl p-8"
          >
            <div>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">{currentQuestionSet.title}</h2>
                <p className="text-gray-400">{currentQuestionSet.subtitle}</p>
              </div>

              <form onSubmit={e => e.preventDefault()} className="space-y-6">
                <div key={currentField.id} className="space-y-2">
                  <label className="block text-xl font-medium text-white mb-4">
                    {currentField.label}
                    {currentField.required && <span className="text-red-500 ml-1">*</span>}
                  </label>

                  {currentField.type === 'text' && (
                    <input
                      type="text"
                      value={formData[currentQuestionSet.section]?.[currentField.id] || ''}
                      onChange={e => handleInputChange(currentQuestionSet.section, currentField.id, e.target.value)}
                      placeholder={currentField.placeholder}
                      className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  )}
                  
                  {currentField.type === 'email' && (
                    <input
                      type="email"
                      value={formData[currentQuestionSet.section]?.[currentField.id] || ''}
                      onChange={e => handleInputChange(currentQuestionSet.section, currentField.id, e.target.value)}
                      placeholder={currentField.placeholder}
                      className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  )}

                  {currentField.type === 'tel' && (
                    <input
                      type="tel"
                      value={formData[currentQuestionSet.section]?.[currentField.id] || ''}
                      onChange={e => handleInputChange(currentQuestionSet.section, currentField.id, e.target.value)}
                      placeholder={currentField.placeholder}
                      className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  )}
                  
                  {currentField.type === 'radio' && (
                    <div className="space-y-3">
                      {currentField.options?.map((option: string) => (
                        <label key={option} className="flex items-center space-x-3 cursor-pointer group">
                          <div className="relative flex items-center justify-center">
                            <input
                              type="radio"
                              value={option}
                              checked={formData[currentQuestionSet.section]?.[currentField.id] === option}
                              onChange={e => handleInputChange(currentQuestionSet.section, currentField.id, e.target.value)}
                              className="w-5 h-5 border-2 border-gray-700 rounded-full appearance-none checked:border-blue-500 checked:bg-blue-500/20"
                            />
                            <div className="absolute pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="w-2.5 h-2.5 bg-blue-500 rounded-full"></div>
                            </div>
                          </div>
                          <span className="text-gray-300 group-hover:text-white transition-colors">{option}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {errors[currentField.id] && (
                    <p className="text-sm text-red-500 mt-1">{errors[currentField.id]}</p>
                  )}
                </div>

                <div className="flex justify-between pt-6">
                  <div className="flex space-x-4">
                    <button
                      type="button"
                      onClick={handleBack}
                      disabled={currentQuestionNumber === 1}
                      className={`px-6 py-2 rounded-lg transition-all duration-200 ${
                        currentQuestionNumber === 1
                          ? 'bg-gray-800/50 text-gray-600 cursor-not-allowed'
                          : 'bg-gray-800/50 text-gray-300 hover:bg-gray-800'
                      }`}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="px-6 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all duration-200"
                    >
                      Reset
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={isLastSection && isLastField ? handleSubmit : handleNext}
                    disabled={isSubmitting}
                    className={`px-6 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-teal-500 text-white transition-all duration-200 ${
                      isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:from-blue-600 hover:to-teal-600'
                    }`}
                  >
                    {isSubmitting ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Processing...</span>
                      </div>
                    ) : isLastSection && isLastField ? (
                      'Create Customer'
                    ) : (
                      'Next'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default CustomerOnboarding;
