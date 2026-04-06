import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { getOnboardingState, updateOnboardingData } from '../services/onboardingStateService';
import { OnboardingState } from '../types';

interface OnboardingManagerProps {
  onEditStart: () => void;
}

export const OnboardingManager: React.FC<OnboardingManagerProps> = ({ onEditStart }) => {
  const [showSummary, setShowSummary] = useState(true);
  const onboardingState = getOnboardingState() as OnboardingState | null;

  if (!onboardingState?.formData) {
    return null;
  }

  const formData = onboardingState.formData;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-900/50 backdrop-blur-lg rounded-xl p-8 border border-gray-800 shadow-xl mb-8"
    >
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-bold text-white">AI Assistant Configuration</h3>
        <button
          onClick={onEditStart}
          className="px-4 py-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
        >
          Edit Configuration
        </button>
      </div>

      {showSummary && (
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
              <span className="text-gray-400">CRM System:</span>{' '}
              {formData.integration?.crm || 'Not specified'}
            </p>
            <p className="text-gray-300">
              <span className="text-gray-400">Phone System:</span>{' '}
              {formData.integration?.existingPhone || 'Not specified'}
            </p>
          </div>

          {/* Customization */}
          <div>
            <h4 className="text-lg font-semibold text-blue-400 mb-2">AI Assistant Customization</h4>
            <p className="text-gray-300">
              <span className="text-gray-400">Script Complexity:</span>{' '}
              {formData.customization?.scriptComplexity}
            </p>
            <p className="text-gray-300">
              <span className="text-gray-400">Languages:</span>{' '}
              {formData.customization?.languages?.join(', ') || 'English only'}
            </p>
          </div>

          {/* Last Updated */}
          <div className="pt-4 border-t border-gray-800">
            <p className="text-sm text-gray-400">
              Last Updated: {new Date(onboardingState.lastUpdated).toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
};
