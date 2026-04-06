'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiCheckCircle, 
  FiCircle, 
  FiX, 
  FiChevronUp, 
  FiChevronDown,
  FiGift
} from 'react-icons/fi';
import { OnboardingProgress, ONBOARDING_STEPS } from '@/types/onboarding';
import confetti from 'canvas-confetti';

interface FloatingOnboardingProgressProps {
  partnerId: string;
  className?: string;
}

export default function FloatingOnboardingProgress({
  partnerId,
  className = ''
}: FloatingOnboardingProgressProps) {
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [showReward, setShowReward] = useState(false);

  const fetchProgress = async () => {
    try {
      const response = await fetch('/api/partner/onboarding/progress');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const newProgress = data.data;
          
          // Check if onboarding just completed (show reward)
          if (progress && !progress.isComplete && newProgress.isComplete) {
            setShowReward(true);
            triggerCompletionConfetti();
          }

          // Auto-hide the component after onboarding is complete and reward is claimed
          if (newProgress.isComplete && !showReward) {
            setIsVisible(false);
          }

          setProgress(newProgress);
        }
      }
    } catch (error) {
      console.error('Error fetching onboarding progress:', error);
    }
  };

  useEffect(() => {
    fetchProgress();

    // Reduced polling frequency to avoid aggressive API calls (especially when OnboardingProgressBar is also polling)
    const interval = setInterval(fetchProgress, 30000); // 30 seconds instead of 5
    return () => clearInterval(interval);
  }, [partnerId]);

  const triggerCompletionConfetti = () => {
    // More elaborate confetti for completion
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti(Object.assign({}, defaults, { 
        particleCount, 
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } 
      }));
      confetti(Object.assign({}, defaults, { 
        particleCount, 
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } 
      }));
    }, 250);
  };

  const handleCompleteReward = async () => {
    try {
      const response = await fetch('/api/partner/onboarding/progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'complete' })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Onboarding completion reward:', data);
      }
    } catch (error) {
      console.error('Error claiming completion reward:', error);
    }
    setShowReward(false);
    // Hide the component after claiming reward
    setTimeout(() => {
      setIsVisible(false);
    }, 1000); // Small delay to show the completion
  };

  const handleStepClick = (stepNumber: number) => {
    const step = ONBOARDING_STEPS.find(s => s.id === stepNumber);
    if (step?.targetPage) {
      window.location.href = step.targetPage;
    }
  };

  // Don't show if no progress data
  if (!progress) {
    return null;
  }

  // Hide only if onboarding is complete AND user has dismissed the component
  if (progress.isComplete && !isVisible && !showReward) {
    return null;
  }

  // Don't show if not visible
  if (!isVisible) {
    return null;
  }

  return (
    <>
      {/* Floating Progress Bar */}
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={`fixed top-4 right-4 z-40 bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-w-sm ${className}`}
      >
        {/* Collapsed Header */}
        <div 
          className="flex items-center justify-between p-3 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center space-x-2">
            <FiGift className="text-blue-400" />
            <span className="text-sm font-medium text-white">
              Getting Started ({progress.completedSteps}/{progress.totalSteps})
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-16 bg-gray-700 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-blue-500 to-teal-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress.progressPercentage}%` }}
              />
            </div>
            {isExpanded ? (
              <FiChevronUp className="text-gray-400" />
            ) : (
              <FiChevronDown className="text-gray-400" />
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsVisible(false);
              }}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <FiX size={16} />
            </button>
          </div>
        </div>

        {/* Expanded Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-gray-700"
            >
              <div className="p-3 space-y-2">
                <p className="text-xs text-gray-400 mb-3">
                  Complete setup to unlock 100 Knotie Credits
                </p>
                
                {/* Step List */}
                <div className="space-y-2">
                  {ONBOARDING_STEPS.map((step) => {
                    const isCompleted = progress[`step${step.id}_${step.key}` as keyof OnboardingProgress] as boolean;
                    const isNext = progress.nextStep === step.id;
                    
                    return (
                      <div
                        key={step.id}
                        onClick={() => handleStepClick(step.id)}
                        className={`flex items-center space-x-2 p-2 rounded cursor-pointer transition-colors ${
                          isNext 
                            ? 'bg-blue-500/20 border border-blue-500/30' 
                            : 'hover:bg-gray-700/50'
                        }`}
                      >
                        {isCompleted ? (
                          <FiCheckCircle className="text-green-400 flex-shrink-0" size={16} />
                        ) : (
                          <FiCircle className={`flex-shrink-0 ${isNext ? 'text-blue-400' : 'text-gray-500'}`} size={16} />
                        )}
                        <span className={`text-xs ${isCompleted ? 'text-green-400' : isNext ? 'text-blue-400' : 'text-gray-300'}`}>
                          {step.title}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Completion Reward Modal */}
      <AnimatePresence>
        {showReward && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-md w-full text-center"
            >
              <div className="mb-6">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FiGift className="text-white text-2xl" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  🎉 Congratulations!
                </h3>
                <p className="text-gray-300 mb-4">
                  You've completed the onboarding process and earned
                </p>
                <div className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">
                  100 Knotie Credits
                </div>
                <p className="text-sm text-gray-400 mt-2">
                  Use these credits for AI features and services
                </p>
              </div>
              
              <button
                onClick={handleCompleteReward}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-teal-500 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-teal-600 transition-all duration-200"
              >
                Claim Reward & Continue
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
