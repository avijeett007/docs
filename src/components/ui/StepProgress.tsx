import React from 'react';
import { motion } from 'framer-motion';
import { FiCheck } from 'react-icons/fi';

interface Step {
  title: string;
  description: string;
}

interface StepProgressProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export const StepProgress: React.FC<StepProgressProps> = ({
  steps,
  currentStep,
  onStepClick,
}) => {
  return (
    <div className="w-full py-8">
      <div className="relative flex items-center justify-between">
        {/* Progress Line */}
        <div className="absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2 bg-gray-700">
          <motion.div
            className="h-full bg-blue-500"
            initial={{ width: "0%" }}
            animate={{
              width: `${((currentStep - 1) / (steps.length - 1)) * 100}%`,
            }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Steps */}
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber === currentStep;
          const isCompleted = stepNumber < currentStep;
          const isClickable = stepNumber <= currentStep;

          return (
            <div
              key={step.title}
              className="relative flex flex-col items-center"
              style={{ width: `${100 / steps.length}%` }}
            >
              {/* Step Circle */}
              <motion.button
                disabled={!isClickable}
                onClick={() => onStepClick?.(stepNumber)}
                className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                  isActive
                    ? 'border-blue-500 bg-blue-500 text-white'
                    : isCompleted
                    ? 'border-green-500 bg-green-500 text-white'
                    : 'border-gray-700 bg-gray-800 text-gray-400'
                } ${
                  isClickable
                    ? 'cursor-pointer hover:scale-110'
                    : 'cursor-not-allowed opacity-50'
                }`}
                whileHover={isClickable ? { scale: 1.1 } : undefined}
                whileTap={isClickable ? { scale: 0.95 } : undefined}
              >
                {isCompleted ? (
                  <FiCheck className="h-5 w-5" />
                ) : (
                  <span className="text-sm font-medium">{stepNumber}</span>
                )}
              </motion.button>

              {/* Step Title */}
              <div className="absolute -bottom-12 left-1/2 w-32 -translate-x-1/2 text-center">
                <p
                  className={`text-sm font-medium transition-colors duration-300 ${
                    isActive ? 'text-blue-400' : 'text-gray-400'
                  }`}
                >
                  {step.title}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
