'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPlay, FiX } from 'react-icons/fi';

interface WelcomeVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: () => void;
  videoUrl: string; // YouTube embed URL
  partnerName?: string;
}

export default function WelcomeVideoModal({
  isOpen,
  onClose,
  onContinue,
  videoUrl,
  partnerName = 'Partner'
}: WelcomeVideoModalProps) {
  const [showContinueButton, setShowContinueButton] = useState(false);
  const [videoStarted, setVideoStarted] = useState(false);

  // Debug logging
  useEffect(() => {
    console.log('WelcomeVideoModal - isOpen:', isOpen);
    console.log('WelcomeVideoModal - videoUrl:', videoUrl);
    console.log('WelcomeVideoModal - partnerName:', partnerName);
    console.log('WelcomeVideoModal - showContinueButton:', showContinueButton);
    console.log('WelcomeVideoModal - videoStarted:', videoStarted);
  }, [isOpen, videoUrl, partnerName, showContinueButton, videoStarted]);

  const handleVideoStart = () => {
    setVideoStarted(true);
    // Show continue button immediately when video starts
    setShowContinueButton(true);
  };

  const handleContinue = () => {
    onContinue();
    onClose();
  };

  // Reset state when modal closes and auto-start when modal opens
  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setShowContinueButton(false);
      setVideoStarted(false);
    } else {
      // Auto-start video after 3 seconds when modal opens
      const autoStartTimer = setTimeout(() => {
        console.log('Auto-starting welcome video');
        setVideoStarted(true);
        setShowContinueButton(true);
      }, 3000);

      return () => clearTimeout(autoStartTimer);
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md"
          style={{ pointerEvents: 'auto' }}
        >
          {/* Full Page Container */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{
              type: "spring",
              damping: 25,
              stiffness: 300,
              duration: 0.5
            }}
            className="relative w-full h-full flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="relative p-8 bg-gradient-to-r from-blue-600/20 to-teal-600/20 border-b border-blue-500/30">
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-center max-w-4xl mx-auto"
              >
                <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent mb-4">
                  Welcome to Knotie AI Pro, {partnerName}! 🎉
                </h1>
                <p className="text-gray-300 text-xl">
                  Let's get you started with a quick platform overview
                </p>
              </motion.div>



              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-lg transition-all duration-200 hover:bg-gray-800/50 text-gray-400 hover:text-white"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>

            {/* Video Container */}
            <div className="flex-1 flex items-center justify-center p-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="relative w-full max-w-6xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-gray-700"
              >
                {!videoStarted ? (
                  /* Video Thumbnail/Play Button */
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-900/20 to-teal-900/20 backdrop-blur-sm">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleVideoStart}
                      className="flex items-center justify-center w-24 h-24 bg-gradient-to-r from-blue-500 to-teal-500 rounded-full shadow-2xl hover:shadow-blue-500/25 transition-all duration-300"
                    >
                      <FiPlay className="w-10 h-10 text-white ml-1" />
                    </motion.button>
                    <div className="absolute bottom-8 left-8 right-8 text-center">
                      <p className="text-white text-2xl font-medium mb-3">
                        Platform Navigation Guide
                      </p>
                      <p className="text-gray-300 text-lg">
                        Learn how to navigate and make the most of your Knotie AI Pro dashboard
                      </p>
                      <p className="text-blue-300 text-sm mt-4">
                        Click the play button to start your welcome tour with audio
                      </p>
                    </div>
                  </div>
                ) : (
                  /* YouTube Embed */
                  <iframe
                    src={videoStarted ?
                      `${videoUrl}?autoplay=1&mute=0&rel=0&modestbranding=1&showinfo=0&controls=1&enablejsapi=1` :
                      `${videoUrl}?autoplay=0&mute=0&rel=0&modestbranding=1&showinfo=0&controls=1&enablejsapi=1`
                    }
                    title="Welcome to Knotie AI Pro"
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                )}
              </motion.div>

            </div>

            {/* Continue Button */}
            <div className="p-8 bg-gradient-to-r from-blue-600/10 to-teal-600/10 border-t border-blue-500/30">
              <AnimatePresence>
                {showContinueButton && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="text-center"
                  >
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleContinue}
                      className="px-8 py-4 bg-gradient-to-r from-blue-500 to-teal-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-blue-500/25 transition-all duration-300 text-lg"
                    >
                      Continue to Dashboard →
                    </motion.button>
                    <p className="text-gray-400 text-sm mt-3">
                      Ready to explore your new partner dashboard
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>


            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
