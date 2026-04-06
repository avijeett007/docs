'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiPlay,
  FiCheck,
  FiClock,
  FiStar,
  FiChevronRight,
  FiAward as FiTrophy,
  FiGift
} from 'react-icons/fi';
import { useDailyChallenges } from '@/hooks/useDailyChallenges';
import { ChallengeProgressModal } from './ChallengeProgressModal';

interface DailyChallengeWidgetProps {
  partnerId: string;
  className?: string;
}

export const DailyChallengeWidget: React.FC<DailyChallengeWidgetProps> = ({
  partnerId,
  className = ''
}) => {
  const [showModal, setShowModal] = useState(false);
  const {
    currentChallenge,
    isLoading,
    error,
    startChallenge,
    completeStep,
    completeChallenge
  } = useDailyChallenges(partnerId);

  // Check if we're in development mode
  const isDevelopment = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
     window.location.hostname.includes('127.0.0.1') ||
     process.env.NODE_ENV === 'development');

  if (isLoading) {
    return <ChallengeWidgetSkeleton className={className} />;
  }

  if (error) {
    return (
      <div className={`bg-red-900/20 border border-red-500/30 rounded-lg p-6 ${className}`}>
        <div className="text-red-400 text-sm">
          Error loading daily challenge: {error}
        </div>
      </div>
    );
  }

  if (!currentChallenge) {
    return <NoChallengeMessage className={className} />;
  }

  const progress = currentChallenge.partnerProgress;
  const completedSteps = progress?.completedSteps || [];
  const totalSteps = currentChallenge.steps.length;
  const progressPercentage = (completedSteps.length / totalSteps) * 100;

  const handleStartChallenge = async () => {
    try {
      await startChallenge(currentChallenge.id);
      setShowModal(true);
    } catch (error) {
      console.error('Failed to start challenge:', error);
    }
  };

  const getStatusIcon = () => {
    if (progress?.status === 'completed') {
      return <FiTrophy className="w-5 h-5 text-yellow-400" />;
    }
    if (progress?.status === 'in_progress') {
      return <FiClock className="w-5 h-5 text-blue-400" />;
    }
    return <FiPlay className="w-5 h-5 text-green-400" />;
  };

  const getStatusText = () => {
    if (progress?.status === 'completed') {
      return isDevelopment ? 'Restart Challenge' : 'Completed!';
    }
    if (progress?.status === 'in_progress') {
      return 'Continue Challenge';
    }
    return 'Start Challenge';
  };

  const getStatusColor = () => {
    if (progress?.status === 'completed') {
      return 'from-yellow-500/20 to-orange-500/20 border-yellow-500/30';
    }
    if (progress?.status === 'in_progress') {
      return 'from-blue-500/20 to-purple-500/20 border-blue-500/30';
    }
    return 'from-green-500/20 to-teal-500/20 border-green-500/30';
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`bg-gradient-to-br ${getStatusColor()} backdrop-blur-sm rounded-lg p-6 border ${className}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ 
                rotate: progress?.status === 'completed' ? 360 : 0,
                scale: progress?.status === 'completed' ? [1, 1.2, 1] : 1
              }}
              transition={{ duration: 0.5 }}
            >
              {getStatusIcon()}
            </motion.div>
            <h3 className="text-lg font-semibold text-white">Today's Challenge</h3>
          </div>
          
          <div className="flex items-center gap-2 bg-gray-800/50 rounded-full px-3 py-1">
            <FiGift className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-medium text-yellow-400">
              {currentChallenge.rewardCredits} credits
            </span>
          </div>
        </div>

        {/* Challenge Title & Description */}
        <div className="mb-4">
          <h4 className="text-xl font-bold text-white mb-2">
            {currentChallenge.title}
          </h4>
          {currentChallenge.description && (
            <p className="text-gray-300 text-sm leading-relaxed">
              {currentChallenge.description}
            </p>
          )}
        </div>

        {/* Progress Bar */}
        {progress?.status === 'in_progress' && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Progress</span>
              <span className="text-sm text-gray-400">
                {completedSteps.length}/{totalSteps} steps
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <motion.div
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-400">
            <FiClock className="w-4 h-4 inline mr-1" />
            {currentChallenge.steps.reduce((total, step) => total + (step.estimatedTime || 5), 0)} minutes
          </div>
          
          <motion.button
            onClick={
              progress?.status === 'completed'
                ? (isDevelopment ? handleStartChallenge : undefined)
                : (progress?.status === 'in_progress' ? () => setShowModal(true) : handleStartChallenge)
            }
            disabled={progress?.status === 'completed' && !isDevelopment}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              progress?.status === 'completed' && !isDevelopment
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-white text-gray-900 hover:bg-gray-100 hover:scale-105'
            }`}
            whileHover={!(progress?.status === 'completed' && !isDevelopment) ? { scale: 1.05 } : {}}
            whileTap={!(progress?.status === 'completed' && !isDevelopment) ? { scale: 0.95 } : {}}
          >
            {getStatusIcon()}
            {getStatusText()}
            {(progress?.status !== 'completed' || isDevelopment) && (
              <FiChevronRight className="w-4 h-4" />
            )}
          </motion.button>
        </div>

        {/* Completion Celebration */}
        {progress?.status === 'completed' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-4 p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg"
          >
            <div className="flex items-center gap-2 text-yellow-400">
              <FiStar className="w-4 h-4" />
              <span className="text-sm font-medium">
                Challenge completed! You earned {currentChallenge.rewardCredits} credits.
                {isDevelopment && (
                  <span className="block text-xs text-gray-400 mt-1">
                    Development mode: Click "Restart Challenge" to test again
                  </span>
                )}
              </span>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Challenge Progress Modal */}
      <AnimatePresence>
        {showModal && currentChallenge && (
          <ChallengeProgressModal
            challenge={currentChallenge}
            progress={progress}
            onClose={() => setShowModal(false)}
            onStepComplete={completeStep}
            onChallengeComplete={completeChallenge}
          />
        )}
      </AnimatePresence>
    </>
  );
};

const ChallengeWidgetSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-gray-800 rounded-lg p-6 border border-gray-700 ${className}`}>
    <div className="animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 bg-gray-600 rounded"></div>
          <div className="h-5 bg-gray-600 rounded w-32"></div>
        </div>
        <div className="h-6 bg-gray-600 rounded w-20"></div>
      </div>
      <div className="h-6 bg-gray-600 rounded w-3/4 mb-2"></div>
      <div className="h-4 bg-gray-600 rounded w-full mb-4"></div>
      <div className="flex justify-between">
        <div className="h-4 bg-gray-600 rounded w-20"></div>
        <div className="h-8 bg-gray-600 rounded w-32"></div>
      </div>
    </div>
  </div>
);

const NoChallengeMessage: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-gray-800/50 border border-gray-700 rounded-lg p-6 text-center ${className}`}>
    <FiClock className="w-8 h-8 text-gray-400 mx-auto mb-3" />
    <h3 className="text-lg font-semibold text-white mb-2">No Challenge Today</h3>
    <p className="text-gray-400 text-sm">
      Check back tomorrow for a new daily challenge!
    </p>
  </div>
);
