import React from 'react';
import { motion } from 'framer-motion';

interface Step {
  title: string;
  description: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  steps,
  currentStep,
  onStepClick
}) => {
  return (
    <div className="w-full py-6">
      <div className="flex items-center justify-center">
        {steps.map((step, index) => (
          <React.Fragment key={step.title}>
            {/* Step Circle */}
            <motion.button
              onClick={() => onStepClick?.(index + 1)}
              className={`relative flex items-center justify-center w-12 h-12 rounded-full border-2 transition-colors duration-300 ${
                index + 1 === currentStep
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : index + 1 < currentStep
                  ? 'bg-green-500 border-green-500 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-400'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="text-sm font-medium">{index + 1}</span>
              <div className="absolute -bottom-6 w-32 text-center">
                <span className={`text-xs font-medium ${
                  index + 1 === currentStep ? 'text-blue-400' : 'text-gray-500'
                }`}>
                  {step.title}
                </span>
                <p className="text-[10px] text-gray-500">{step.description}</p>
              </div>
            </motion.button>
            
            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div className="flex-1 mx-4 h-0.5 max-w-[100px]">
                <div
                  className={`h-full transition-colors duration-300 ${
                    index + 1 < currentStep ? 'bg-green-500' : 'bg-gray-700'
                  }`}
                />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
