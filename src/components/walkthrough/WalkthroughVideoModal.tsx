'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiPlay, FiSkipForward, FiClock, FiCheckCircle } from 'react-icons/fi';

interface WalkthroughStep {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  videoUrl?: string;
  videoDuration?: number;
  canSkip: boolean;
  instructions: string;
  helpText?: string;
}

interface WalkthroughVideoModalProps {
  isOpen: boolean;
  step: WalkthroughStep;
  onVideoComplete: (watchPercentage: number) => void;
  onSkip: () => void;
  onClose: () => void;
  autoAdvance?: boolean;
  autoAdvanceDelay?: number;
}

export default function WalkthroughVideoModal({
  isOpen,
  step,
  onVideoComplete,
  onSkip,
  onClose,
  autoAdvance = false,
  autoAdvanceDelay = 5
}: WalkthroughVideoModalProps) {
  const [videoStarted, setVideoStarted] = useState(false);
  const [videoCompleted, setVideoCompleted] = useState(false);
  const [watchPercentage, setWatchPercentage] = useState(0);
  const [showContinueButton, setShowContinueButton] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(autoAdvanceDelay);
  const [isAutoAdvancing, setIsAutoAdvancing] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Reset state when step changes
  useEffect(() => {
    if (isOpen) {
      setVideoStarted(false);
      setVideoCompleted(false);
      setWatchPercentage(0);
      setShowContinueButton(false);
      setTimeRemaining(autoAdvanceDelay);
      setIsAutoAdvancing(false);
    }
  }, [step.id, isOpen, autoAdvanceDelay]);

  // Handle video completion
  useEffect(() => {
    if (videoCompleted && !showContinueButton) {
      setShowContinueButton(true);
      
      if (autoAdvance) {
        setIsAutoAdvancing(true);
        const timer = setInterval(() => {
          setTimeRemaining(prev => {
            if (prev <= 1) {
              clearInterval(timer);
              handleContinue();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        return () => clearInterval(timer);
      }
    }
  }, [videoCompleted, showContinueButton, autoAdvance]);

  // Simulate video progress tracking (in real implementation, this would use YouTube API)
  useEffect(() => {
    if (videoStarted && !videoCompleted && step.videoDuration) {
      const interval = setInterval(() => {
        setWatchPercentage(prev => {
          const newPercentage = Math.min(prev + (100 / step.videoDuration!), 100);
          if (newPercentage >= 80 && !videoCompleted) {
            setVideoCompleted(true);
          }
          return newPercentage;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [videoStarted, videoCompleted, step.videoDuration]);

  const handleVideoStart = () => {
    setVideoStarted(true);
  };

  const handleContinue = () => {
    onVideoComplete(watchPercentage);
  };

  const handleSkip = () => {
    onSkip();
  };

  const handleClose = () => {
    if (videoCompleted || step.canSkip) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && handleClose()}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative w-full max-w-6xl mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-center space-x-4">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full">
                <span className="text-sm font-bold text-blue-600">
                  {step.stepNumber}
                </span>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {step.title}
                </h2>
                <p className="text-sm text-gray-600">
                  {step.description}
                </p>
              </div>
            </div>

            {/* Close button (only if skippable or completed) */}
            {(step.canSkip || videoCompleted) && (
              <button
                onClick={handleClose}
                className="flex items-center justify-center w-8 h-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <FiX className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Video Container */}
          <div className="relative aspect-video bg-black">
            {!videoStarted ? (
              /* Video Thumbnail/Play Button */
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-900/20 to-indigo-900/20 backdrop-blur-sm">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleVideoStart}
                  className="flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full shadow-2xl hover:shadow-blue-500/25 transition-all duration-300"
                >
                  <FiPlay className="w-8 h-8 text-white ml-1" />
                </motion.button>
                
                <div className="absolute bottom-8 left-8 right-8 text-center">
                  <p className="text-white text-lg font-medium mb-2">
                    {step.title}
                  </p>
                  <p className="text-gray-300 text-sm">
                    {step.helpText || step.instructions}
                  </p>
                  {step.videoDuration && (
                    <div className="flex items-center justify-center mt-3 text-blue-300 text-sm">
                      <FiClock className="w-4 h-4 mr-1" />
                      {Math.floor(step.videoDuration / 60)}:{(step.videoDuration % 60).toString().padStart(2, '0')} minutes
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* YouTube Embed */
              <iframe
                ref={iframeRef}
                src={step.videoUrl ? 
                  `${step.videoUrl}?autoplay=1&mute=0&rel=0&modestbranding=1&showinfo=0&controls=1&enablejsapi=1` :
                  undefined
                }
                title={step.title}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            )}

            {/* Progress overlay */}
            {videoStarted && !videoCompleted && (
              <div className="absolute bottom-4 left-4 right-4">
                <div className="bg-black/50 backdrop-blur-sm rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white text-sm">Video Progress</span>
                    <span className="text-white text-sm font-medium">
                      {Math.round(watchPercentage)}%
                    </span>
                  </div>
                  <div className="w-full bg-white/20 rounded-full h-2">
                    <motion.div
                      className="bg-blue-500 h-2 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${watchPercentage}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-gray-900 mb-1">
                  Next Steps:
                </h3>
                <p className="text-sm text-gray-600">
                  {step.instructions}
                </p>
              </div>

              <div className="flex items-center space-x-3 ml-6">
                {/* Skip button */}
                {step.canSkip && !videoCompleted && (
                  <button
                    onClick={handleSkip}
                    className="flex items-center px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <FiSkipForward className="w-4 h-4 mr-2" />
                    Skip Video
                  </button>
                )}

                {/* Continue button */}
                {showContinueButton && (
                  <motion.button
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    onClick={handleContinue}
                    className="flex items-center px-6 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    <FiCheckCircle className="w-4 h-4 mr-2" />
                    Continue
                    {isAutoAdvancing && (
                      <span className="ml-2 text-xs">
                        ({timeRemaining}s)
                      </span>
                    )}
                  </motion.button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
