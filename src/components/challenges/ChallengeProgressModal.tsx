'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  FiX,
  FiCheck,
  FiPlay,
  FiExternalLink,
  FiUpload,
  FiGift,
  FiClock,
  FiCheckCircle,
  FiLock
} from 'react-icons/fi';
import { ChallengeWithProgress, PartnerChallengeProgress, ChallengeStep } from '@/services/ChallengeService';

interface ChallengeProgressModalProps {
  challenge: ChallengeWithProgress;
  progress: PartnerChallengeProgress | null | undefined;
  onClose: () => void;
  onStepComplete: (challengeId: string, stepId: string) => Promise<void>;
  onChallengeComplete: (challengeId: string, proofSubmitted?: string) => Promise<void>;
}

export const ChallengeProgressModal: React.FC<ChallengeProgressModalProps> = ({
  challenge,
  progress,
  onClose,
  onStepComplete,
  onChallengeComplete
}) => {
  const [proofText, setProofText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completingStepId, setCompletingStepId] = useState<string | null>(null);

  const completedSteps = progress?.completedSteps || [];
  const allStepsCompleted = completedSteps.length === challenge.steps.length;

  const triggerConfetti = () => {
    // Multiple confetti bursts for celebration
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      // Left side
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });

      // Right side
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);
  };

  const handleStepComplete = async (stepId: string) => {
    try {
      setCompletingStepId(stepId);
      await onStepComplete(challenge.id, stepId);
    } catch (error) {
      console.error('Failed to complete step:', error);
    } finally {
      setCompletingStepId(null);
    }
  };

  const handleChallengeComplete = async () => {
    try {
      setIsSubmitting(true);
      await onChallengeComplete(
        challenge.id,
        challenge.requiresProof ? proofText : undefined
      );

      // Trigger confetti celebration
      triggerConfetti();

      // Dispatch event to notify sidebar to refresh claims
      window.dispatchEvent(new CustomEvent('challengeCompleted', {
        detail: { challengeId: challenge.id, credits: challenge.rewardCredits }
      }));

      // Close modal after a short delay to show confetti
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error) {
      console.error('Failed to complete challenge:', error);
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-gray-900 rounded-lg border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white">{challenge.title}</h2>
            <div className="flex items-center gap-2 bg-yellow-500/20 rounded-full px-3 py-1">
              <FiGift className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-medium text-yellow-400">
                {challenge.rewardCredits} credits
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Description */}
          {challenge.description && (
            <p className="text-gray-300 mb-6 leading-relaxed">
              {challenge.description}
            </p>
          )}

          {/* Steps */}
          <div className="space-y-4 mb-6">
            {challenge.steps.map((step, index) => (
              <ChallengeStepCard
                key={step.id}
                step={step}
                index={index}
                isCompleted={completedSteps.includes(step.id)}
                isActive={index === completedSteps.length && !completedSteps.includes(step.id)}
                isLoading={completingStepId === step.id}
                onComplete={() => handleStepComplete(step.id)}
              />
            ))}
          </div>

          {/* Proof Submission */}
          {challenge.requiresProof && allStepsCompleted && progress?.status !== 'completed' && (
            <div className="bg-gray-800 rounded-lg p-4 mb-6">
              <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                <FiUpload className="w-4 h-4" />
                Submit Proof of Completion
              </h4>
              <textarea
                value={proofText}
                onChange={(e) => setProofText(e.target.value)}
                placeholder="Describe what you accomplished or provide links to screenshots/recordings..."
                className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-400 resize-none"
                rows={4}
              />
              <p className="text-gray-400 text-sm mt-2">
                Your submission will be reviewed and credits will be awarded upon approval.
              </p>
            </div>
          )}

          {/* Completion Status */}
          {progress?.status === 'completed' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-green-500/20 border border-green-500/30 rounded-lg p-4 mb-6"
            >
              <div className="flex items-center gap-3">
                <FiCheckCircle className="w-6 h-6 text-green-400" />
                <div>
                  <h4 className="text-green-400 font-medium">Challenge Completed!</h4>
                  <p className="text-green-300 text-sm">
                    You earned {challenge.rewardCredits} credits. 
                    {challenge.requiresProof && progress.proofStatus === 'pending' && 
                      ' Credits will be awarded after proof review.'}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-700">
          <div className="text-sm text-gray-400">
            {completedSteps.length}/{challenge.steps.length} steps completed
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Close
            </button>
            
            {allStepsCompleted && progress?.status !== 'completed' && (
              <motion.button
                onClick={handleChallengeComplete}
                disabled={isSubmitting || (challenge.requiresProof && !proofText.trim())}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <FiCheck className="w-4 h-4" />
                    Complete Challenge
                  </>
                )}
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

interface ChallengeStepCardProps {
  step: ChallengeStep;
  index: number;
  isCompleted: boolean;
  isActive: boolean;
  isLoading: boolean;
  onComplete: () => void;
}

const ChallengeStepCard: React.FC<ChallengeStepCardProps> = ({
  step,
  index,
  isCompleted,
  isActive,
  isLoading,
  onComplete
}) => {
  const [showVideo, setShowVideo] = useState(false);
  const [videoWatched, setVideoWatched] = useState(false);
  const [videoStarted, setVideoStarted] = useState(false);

  const getEmbedUrl = (url: string) => {
    // YouTube URL conversion with enablejsapi for tracking
    if (url.includes('youtube.com/watch?v=')) {
      const videoId = url.split('v=')[1]?.split('&')[0];
      return `https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${window.location.origin}`;
    }
    if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1]?.split('?')[0];
      return `https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${window.location.origin}`;
    }
    // Vimeo URL conversion
    if (url.includes('vimeo.com/')) {
      const videoId = url.split('vimeo.com/')[1]?.split('?')[0];
      return `https://player.vimeo.com/video/${videoId}`;
    }
    // Return original URL if not recognized
    return url;
  };

  // Simple timer-based video completion tracking
  React.useEffect(() => {
    if (showVideo && step.videoUrl && !videoWatched) {
      setVideoStarted(true);

      // For demo purposes, mark video as watched after 15 seconds
      // In production, you might want to integrate with YouTube/Vimeo APIs
      const timer = setTimeout(() => {
        setVideoWatched(true);
      }, 15000); // 15 seconds

      return () => clearTimeout(timer);
    }
  }, [showVideo, step.videoUrl, videoWatched]);

  const getStepIcon = () => {
    if (isCompleted) {
      return <FiCheck className="w-5 h-5 text-green-400" />;
    }
    if (isActive) {
      return <FiPlay className="w-5 h-5 text-blue-400" />;
    }
    return <span className="w-5 h-5 flex items-center justify-center text-gray-400 text-sm font-medium">{index + 1}</span>;
  };

  const getStepColor = () => {
    if (isCompleted) {
      return 'border-green-500/30 bg-green-500/10';
    }
    if (isActive) {
      return 'border-blue-500/30 bg-blue-500/10';
    }
    return 'border-gray-600 bg-gray-800/50';
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`border rounded-lg p-4 ${getStepColor()}`}
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 mt-1">
          {getStepIcon()}
        </div>
        
        <div className="flex-1">
          <h4 className="text-white font-medium mb-2">{step.title}</h4>
          <p className="text-gray-300 text-sm mb-3">{step.description}</p>
          
          {/* Step Details */}
          <div className="flex items-center gap-4 mb-3">
            {step.estimatedTime && (
              <div className="flex items-center gap-1 text-gray-400 text-sm">
                <FiClock className="w-3 h-3" />
                {step.estimatedTime} min
              </div>
            )}
            <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">
              {step.type}
            </span>
          </div>

          {/* Video Section - More Prominent */}
          {step.videoUrl && (
            <div className="mb-4">
              {!showVideo ? (
                <motion.div
                  className="relative bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-lg p-4 cursor-pointer hover:from-blue-600/30 hover:to-purple-600/30 transition-all duration-300"
                  onClick={() => setShowVideo(true)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                        <FiPlay className="w-6 h-6 text-blue-400 ml-1" />
                      </div>
                      <div>
                        <h4 className="text-white font-medium">Watch Tutorial Video</h4>
                        <p className="text-gray-400 text-sm">Required to complete this step</p>
                      </div>
                    </div>
                    <div className="text-blue-400">
                      <FiPlay className="w-5 h-5" />
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${videoWatched ? 'bg-green-400' : videoStarted ? 'bg-yellow-400' : 'bg-gray-400'}`} />
                      <span className="text-sm text-gray-300">
                        {videoWatched ? 'Video completed' : videoStarted ? 'Video in progress' : 'Video not started'}
                      </span>
                    </div>
                    <button
                      onClick={() => setShowVideo(false)}
                      className="text-gray-400 hover:text-white text-sm"
                    >
                      Hide Video
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Guide Link */}
          {step.guideUrl && (
            <div className="mb-3">
              <a
                href={step.guideUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm transition-colors"
              >
                <FiExternalLink className="w-4 h-4" />
                Read Documentation Guide
              </a>
            </div>
          )}

          {/* Embedded Video */}
          {step.videoUrl && showVideo && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 rounded-lg overflow-hidden bg-gray-800 border border-gray-700"
            >
              <iframe
                src={getEmbedUrl(step.videoUrl)}
                title={`Video for ${step.title}`}
                className="w-full h-64 border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
              {!videoWatched && (
                <div className="p-3 bg-yellow-500/10 border-t border-yellow-500/20">
                  <div className="flex items-center gap-2 text-yellow-400 text-sm">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                    Please watch the video to completion to unlock the "Mark Complete" button
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Notes */}
          {step.notes && (
            <p className="text-gray-400 text-sm italic mb-3">
              💡 {step.notes}
            </p>
          )}

          {/* Complete Button */}
          {isActive && !isCompleted && (
            <div className="space-y-2">
              {/* Video requirement notice */}
              {!!step.videoUrl && !videoWatched && (
                <div className="flex items-center gap-2 text-amber-400 text-sm bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                  <FiPlay className="w-4 h-4" />
                  <span>Watch the tutorial video above to unlock completion</span>
                </div>
              )}

              <button
                onClick={onComplete}
                disabled={isLoading || (!!step.videoUrl && !videoWatched)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                  isLoading || (!!step.videoUrl && !videoWatched)
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 text-white hover:scale-105'
                }`}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" />
                    Completing...
                  </>
                ) : (!!step.videoUrl && !videoWatched) ? (
                  <>
                    <FiLock className="w-4 h-4" />
                    Complete Video First
                  </>
                ) : (
                  <>
                    <FiCheck className="w-4 h-4" />
                    Mark Complete
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
