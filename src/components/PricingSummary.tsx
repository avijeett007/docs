import React from 'react';
import { motion } from 'framer-motion';
import { PricingResult } from '../services/pricingService';
import { OnboardingFormData } from '../types';

interface PricingSummaryProps {
  pricing: PricingResult;
  formData: OnboardingFormData;
  onEditAnswers: () => void;
  onScheduleCall: () => void;
  onComparePricing: () => void;
}

export const PricingSummary: React.FC<PricingSummaryProps> = ({
  pricing,
  formData,
  onEditAnswers,
  onScheduleCall,
  onComparePricing
}) => {
  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      {/* Pricing Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-900/50 backdrop-blur-lg rounded-xl p-8 border border-gray-800 shadow-xl mb-8"
      >
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">
            {pricing.recommendedTier.name} Plan
          </h2>
          <p className="text-gray-400">
            Based on your requirements
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Monthly Price */}
          <div className="text-center p-4 bg-gray-800/50 rounded-lg">
            <p className="text-gray-400 mb-2">Monthly Subscription</p>
            <p className="text-4xl font-bold text-white">
              ${pricing.adjustedMonthlyPrice}
              <span className="text-sm text-gray-400">/mo</span>
            </p>
          </div>

          {/* Setup Fee */}
          <div className="text-center p-4 bg-gray-800/50 rounded-lg">
            <p className="text-gray-400 mb-2">One-Time Setup Fee</p>
            <p className="text-4xl font-bold text-white">
              ${pricing.adjustedSetupFee}
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-white mb-4">Included Features</h3>
          <ul className="space-y-2">
            {pricing.recommendedTier.features.map((feature, index) => (
              <li key={index} className="flex items-center text-gray-300">
                <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {/* Additional Features */}
        {pricing.additionalFeatures.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-white mb-4">Additional Features</h3>
            <ul className="space-y-2">
              {pricing.additionalFeatures.map((feature, index) => (
                <li key={index} className="flex items-center text-gray-300">
                  <svg className="w-5 h-5 text-teal-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Total First Month */}
        <div className="text-center p-6 bg-gradient-to-r from-blue-500/20 to-teal-500/20 rounded-lg mb-8">
          <p className="text-gray-300 mb-2">Total First Month</p>
          <p className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">
            ${pricing.totalFirstMonth}
          </p>
          <p className="text-sm text-gray-400 mt-2">
            Includes setup fee and first month subscription
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col md:flex-row justify-center gap-4">
          <button
            onClick={onEditAnswers}
            className="px-6 py-3 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors"
          >
            Edit Answers
          </button>
          <button
            onClick={onComparePricing}
            className="px-6 py-3 rounded-lg border border-blue-500 text-blue-400 hover:bg-blue-500/10 transition-colors"
          >
            Compare with Others
          </button>
          <button
            onClick={onScheduleCall}
            className="px-6 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-teal-500 text-white hover:from-blue-600 hover:to-teal-600 transition-colors"
          >
            Schedule a Call
          </button>
        </div>
      </motion.div>

      {/* Summary of Answers */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-gray-900/50 backdrop-blur-lg rounded-xl p-8 border border-gray-800 shadow-xl"
      >
        <h3 className="text-2xl font-bold text-white mb-6">Your Selections</h3>
        <div className="space-y-6">
          {/* Call Volume */}
          <div>
            <h4 className="text-lg font-semibold text-blue-400 mb-2">Call Management</h4>
            <p className="text-gray-300">
              <span className="text-gray-400">Monthly Volume:</span>{' '}
              {formData.callVolume?.monthlyCallVolume}
            </p>
            <p className="text-gray-300">
              <span className="text-gray-400">Operating Hours:</span>{' '}
              {formData.callVolume?.peakHours}
            </p>
          </div>

          {/* Integration */}
          <div>
            <h4 className="text-lg font-semibold text-blue-400 mb-2">System Integration</h4>
            <p className="text-gray-300">
              <span className="text-gray-400">CRM:</span>{' '}
              {formData.integration?.crm || 'None'}
            </p>
          </div>

          {/* Web Services */}
          {formData.additionalServices && (
            <div>
              <h4 className="text-lg font-semibold text-blue-400 mb-2">Additional Services</h4>
              <p className="text-gray-300">
                <span className="text-gray-400">Website Interest:</span>{' '}
                {formData.additionalServices.websiteInterest}
              </p>
              {formData.additionalServices.webAIInterest === "Yes, I want web chat AI integration" && (
                <p className="text-gray-300">
                  <span className="text-gray-400">Web Chat Volume:</span>{' '}
                  {formData.additionalServices.webChatVolume}
                </p>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
