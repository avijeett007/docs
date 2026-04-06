'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiPlay,
  FiCheckCircle,
  FiGift,
  FiChevronRight,
  FiX,
  FiRefreshCw
} from 'react-icons/fi';
import { OnboardingProgress, OnboardingStep, ONBOARDING_STEPS } from '@/types/onboarding';
import confetti from 'canvas-confetti';

interface OnboardingProgressBarProps {
  partnerId: string;
  className?: string;
  onStepClick?: (stepNumber: number) => void;
}

interface PartnerData {
  rewardfulAffiliateId?: string;
  rewardfulToken?: string;
  affiliateStatus?: string;
}

export default function OnboardingProgressBar({
  partnerId,
  className = '',
  onStepClick
}: OnboardingProgressBarProps) {
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReward, setShowReward] = useState(false);
  const [lastCompletedSteps, setLastCompletedSteps] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [partnerData, setPartnerData] = useState<PartnerData | null>(null);

  const fetchPartnerData = async () => {
    try {
      const response = await fetch('/api/partner/profile');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setPartnerData({
            rewardfulAffiliateId: data.data.rewardfulAffiliateId,
            rewardfulToken: data.data.rewardfulToken,
            affiliateStatus: data.data.affiliateStatus,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching partner data:', error);
    }
  };

  const fetchProgress = async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) {
        setIsRefreshing(true);
      }

      const response = await fetch('/api/partner/onboarding/progress');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const newProgress = data.data;

          // Check if we completed a new step (trigger confetti)
          if (progress && newProgress.completedSteps > progress.completedSteps) {
            console.log('🎉 Step completed! Triggering confetti...');
            triggerConfetti();
          }

          // Check if onboarding just completed (show reward)
          if (progress && !progress.isComplete && newProgress.isComplete) {
            console.log('🎊 Onboarding completed! Showing reward...');
            setShowReward(true);
            triggerCompletionConfetti();
          }

          setProgress(newProgress);
          setLastCompletedSteps(newProgress.completedSteps);
        }
      }
    } catch (error) {
      console.error('Error fetching onboarding progress:', error);
    } finally {
      setLoading(false);
      if (showRefreshIndicator) {
        setIsRefreshing(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();

    // Debounced fetch function to prevent excessive API calls
    const debouncedFetch = (() => {
      let timeoutId: NodeJS.Timeout;
      return () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          if (!controller.signal.aborted) {
            fetchProgress();
          }
        }, 1000);
      };
    })();

    // Initial fetch
    fetchProgress();
    fetchPartnerData();

    // Further reduced polling frequency to avoid aggressive API calls (FloatingOnboardingProgress also polls)
    const interval = setInterval(debouncedFetch, 20000); // 20 seconds instead of 10

    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, [partnerId]);

  // Manual refresh function
  const handleManualRefresh = () => {
    fetchProgress(true);
  };

  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

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

  const generateAffiliateLink = (originalUrl: string): string => {
    // If partner has an active affiliate account, append referral parameter
    if (partnerData?.rewardfulToken && partnerData?.affiliateStatus === 'ACTIVE') {
      const separator = originalUrl.includes('?') ? '&' : '?';
      return `${originalUrl}${separator}ref=${partnerData.rewardfulToken}`;
    }
    return originalUrl;
  };

  const handleStepClick = (stepNumber: number) => {
    if (onStepClick) {
      onStepClick(stepNumber);
    } else {
      const step = ONBOARDING_STEPS.find(s => s.id === stepNumber);
      if (step) {
        const targetUrl = generateAffiliateLink(step.targetPage);
        window.location.href = targetUrl;
      }
    }
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
  };

  if (loading) {
    return (
      <div className={`bg-gray-800 rounded-lg p-4 border border-gray-700 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-700 rounded w-1/3 mb-2"></div>
          <div className="h-2 bg-gray-700 rounded w-full"></div>
        </div>
      </div>
    );
  }

  if (!progress) {
    return null;
  }

  // Don't show progress bar if onboarding is complete (will be replaced by daily challenges)
  if (progress.isComplete) {
    return null;
  }

  return (
    <>
      <motion.div
        className={`relative bg-gradient-to-br from-gray-800 via-gray-800 to-gray-900 rounded-xl p-6 border border-gray-600 shadow-2xl overflow-hidden ${className}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        {/* Animated radiant background overlay */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-teal-500/5 rounded-xl"
          animate={{
            background: [
              "linear-gradient(to right, rgba(59, 130, 246, 0.05), rgba(168, 85, 247, 0.05), rgba(20, 184, 166, 0.05))",
              "linear-gradient(to right, rgba(20, 184, 166, 0.05), rgba(59, 130, 246, 0.05), rgba(168, 85, 247, 0.05))",
              "linear-gradient(to right, rgba(168, 85, 247, 0.05), rgba(20, 184, 166, 0.05), rgba(59, 130, 246, 0.05))",
              "linear-gradient(to right, rgba(59, 130, 246, 0.05), rgba(168, 85, 247, 0.05), rgba(20, 184, 166, 0.05))"
            ]
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />

        {/* Subtle shimmer effect */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/2 to-transparent rounded-xl"
          animate={{
            x: ['-100%', '100%']
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />

        {/* Pulsing border glow */}
        <motion.div
          className="absolute inset-0 rounded-xl border border-blue-500/20"
          animate={{
            borderColor: [
              "rgba(59, 130, 246, 0.2)",
              "rgba(168, 85, 247, 0.2)",
              "rgba(20, 184, 166, 0.2)",
              "rgba(59, 130, 246, 0.2)"
            ]
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />

        {/* Content */}
        <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-500/20 to-teal-500/20 rounded-xl border border-blue-500/30">
              <FiGift className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-1">
                Getting Started ({progress.completedSteps}/{progress.totalSteps})
              </h3>
              <p className="text-sm text-gray-300 flex items-center space-x-2">
                <span>Complete setup to unlock</span>
                <span className="inline-flex items-center px-2 py-1 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-400 text-xs font-semibold rounded-full border border-yellow-500/30">
                  <FiGift className="w-3 h-3 mr-1" />
                  100 Knotie Credits
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="p-2 text-gray-400 hover:text-blue-400 transition-colors disabled:opacity-50 rounded-lg hover:bg-blue-500/10"
              title="Refresh progress"
            >
              <FiRefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Enhanced Progress Bar */}
        <div className="relative mb-4">
          <div className="w-full bg-gray-700/50 rounded-full h-4 mb-4 shadow-inner border border-gray-600/30 overflow-hidden">
            <motion.div
              className="bg-gradient-to-r from-blue-500 via-purple-500 to-teal-500 h-4 rounded-full shadow-lg relative overflow-hidden"
              initial={{ width: 0 }}
              animate={{ width: `${progress.progressPercentage}%` }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            >
              {/* Animated flowing shine effect */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                animate={{
                  x: ['-100%', '100%']
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />

              {/* Subtle pulsing overlay */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-blue-400/20 via-purple-400/20 to-teal-400/20"
                animate={{
                  opacity: [0.3, 0.7, 0.3]
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            </motion.div>
          </div>

          {/* Enhanced progress percentage badge */}
          <motion.div
            className="absolute -top-2 right-0 transform translate-y-[-100%]"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5, type: "spring" }}
          >
            <motion.div
              className="bg-gradient-to-r from-blue-500 to-teal-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-xl border border-blue-400/30"
              animate={{
                boxShadow: [
                  "0 4px 20px rgba(59, 130, 246, 0.3)",
                  "0 4px 20px rgba(20, 184, 166, 0.3)",
                  "0 4px 20px rgba(59, 130, 246, 0.3)"
                ]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              {progress.progressPercentage}%
            </motion.div>
          </motion.div>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-2">
          {ONBOARDING_STEPS.map((step, index) => {
            const stepNumber = index + 1;
            // Map step numbers to progress properties
            const stepKeys = [
              'step1_customizePod',
              'step2_onboardCustomer',
              'step3_importAgent',
              'step4_reviewAnalytics',
              'step5_completeWhitelabel',
              'step6_setupPayments'
            ];
            const isCompleted = progress[stepKeys[index] as keyof OnboardingProgress] as boolean;
            const isNext = progress.nextStep === stepNumber;

            return (
              <motion.button
                key={step.id}
                onClick={() => handleStepClick(stepNumber)}
                className={`relative p-4 rounded-xl text-left transition-all duration-300 group ${
                  isCompleted
                    ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/20 text-green-400 border border-green-500/30 shadow-lg shadow-green-500/10'
                    : isNext
                    ? 'bg-gradient-to-br from-blue-500/20 to-purple-500/20 text-blue-400 border border-blue-500/30 hover:from-blue-500/30 hover:to-purple-500/30 shadow-lg shadow-blue-500/10'
                    : 'bg-gradient-to-br from-gray-700/30 to-gray-800/30 text-gray-400 border border-gray-600/30 hover:from-gray-700/50 hover:to-gray-800/50'
                }`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                whileHover={{
                  scale: 1.03,
                  y: -4,
                  boxShadow: isNext
                    ? "0 10px 30px rgba(59, 130, 246, 0.2)"
                    : isCompleted
                    ? "0 10px 30px rgba(34, 197, 94, 0.2)"
                    : "0 10px 30px rgba(0, 0, 0, 0.1)"
                }}
                whileTap={{ scale: 0.97 }}
              >
                {/* Subtle shimmer effect for next step */}
                {isNext && (
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-400/10 to-transparent"
                    animate={{
                      x: ['-100%', '100%']
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />
                )}


                <div className="flex items-start space-x-3">
                  <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                    isCompleted
                      ? 'bg-green-500/30'
                      : isNext
                      ? 'bg-blue-500/30'
                      : 'bg-gray-600/30'
                  }`}>
                    {isCompleted ? (
                      <FiCheckCircle className="w-5 h-5" />
                    ) : isNext ? (
                      <FiPlay className="w-4 h-4" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-current" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm mb-1 group-hover:text-white transition-colors">
                      {step.title}
                    </h4>
                    <p className="text-xs opacity-80 leading-relaxed">
                      {step.description}
                    </p>

                  </div>
                </div>

                {isNext && (
                  <>
                    {/* Pulsing indicator */}
                    <motion.div
                      className="absolute top-2 right-2 w-4 h-4 bg-blue-400 rounded-full"
                      animate={{
                        scale: [1, 1.4, 1],
                        opacity: [1, 0.6, 1],
                        boxShadow: [
                          "0 0 0 0 rgba(59, 130, 246, 0.4)",
                          "0 0 0 8px rgba(59, 130, 246, 0)",
                          "0 0 0 0 rgba(59, 130, 246, 0)"
                        ]
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                    {/* Secondary pulse ring */}
                    <motion.div
                      className="absolute top-1 right-1 w-6 h-6 border-2 border-blue-400/30 rounded-full"
                      animate={{
                        scale: [1, 1.5, 1],
                        opacity: [0.5, 0, 0.5]
                      }}
                      transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                    />
                  </>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Next Step Info */}
        {progress.nextStep && (
          <div className="mt-3 p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs font-medium text-blue-300">
                  Next: {ONBOARDING_STEPS[progress.nextStep - 1]?.title}
                </p>
                <p className="text-xs text-blue-200 opacity-80">
                  {ONBOARDING_STEPS[progress.nextStep - 1]?.description}
                </p>
              </div>
              <FiChevronRight className="w-4 h-4 text-blue-400 ml-2" />
            </div>
          </div>
        )}
        </div>
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
              className="bg-gray-800 rounded-xl p-6 border border-gray-700 max-w-md w-full text-center"
            >
              <div className="flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-full mx-auto mb-4">
                <FiGift className="w-8 h-8 text-green-400" />
              </div>
              
              <h3 className="text-xl font-bold text-white mb-2">
                🎉 Onboarding Complete!
              </h3>
              
              <p className="text-gray-300 mb-4">
                Congratulations! You've completed all essential setup steps.
              </p>
              
              <div className="bg-gradient-to-r from-blue-500/20 to-teal-500/20 rounded-lg p-4 mb-6 border border-blue-500/30">
                <p className="text-lg font-semibold text-white">
                  🎁 You've earned 100 Knotie Credits!
                </p>
                <p className="text-sm text-gray-300">
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
