'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPlay, FiX, FiVolumeX, FiVolume2 } from 'react-icons/fi';

interface FloatingVideoIconProps {
  videoUrl: string;
  title: string;
  description?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  className?: string;
}

export default function FloatingVideoIcon({
  videoUrl,
  title,
  description,
  position = 'bottom-right',
  className = ''
}: FloatingVideoIconProps) {
  const [showModal, setShowModal] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // Start muted by default

  // Safety check
  if (!videoUrl || !title) {
    return null;
  }

  const getPositionClasses = () => {
    switch (position) {
      case 'bottom-left':
        return 'bottom-6 left-6';
      case 'top-right':
        return 'top-6 right-6';
      case 'top-left':
        return 'top-6 left-6';
      default:
        return 'bottom-6 right-6';
    }
  };

  const getVideoEmbedUrl = (url: string) => {
    // YouTube
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = url.includes('youtube.com/watch?v=')
        ? url.split('v=')[1].split('&')[0]
        : url.includes('youtu.be/')
          ? url.split('youtu.be/')[1].split('?')[0]
          : '';
      const muteParam = isMuted ? '&mute=1' : '&mute=0';
      return `https://www.youtube.com/embed/${videoId}?autoplay=1${muteParam}`;
    }

    // Loom
    if (url.includes('loom.com')) {
      if (url.includes('/share/')) {
        return url.replace('/share/', '/embed/');
      }
      return url;
    }

    // Default: return the original URL
    return url;
  };

  return (
    <>
      {/* Floating Video Icon */}
      <motion.button
        onClick={() => setShowModal(true)}
        className={`fixed ${getPositionClasses()} z-[999999] group ${className}`}
        initial={{ scale: 0, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        transition={{
          duration: 0.5,
          type: "spring",
          stiffness: 300,
          damping: 20
        }}
      >
        <div className="relative">
          {/* Outer glow ring */}
          <motion.div
            className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-teal-500 opacity-20 blur-lg"
            animate={{
              scale: [1, 1.2, 1],
              rotate: [0, 180, 360]
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "linear"
            }}
          />

          {/* Main button with brand gradient */}
          <motion.div
            className="relative w-16 h-16 bg-gradient-to-br from-blue-500 via-purple-500 to-teal-500 rounded-full shadow-2xl flex items-center justify-center text-white overflow-hidden"
            whileHover={{
              boxShadow: "0 0 30px rgba(59, 130, 246, 0.5), 0 0 60px rgba(168, 85, 247, 0.3)"
            }}
          >
            {/* Animated background shimmer */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
              animate={{
                x: ['-100%', '100%']
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />

            {/* Play icon with subtle animation */}
            <motion.div
              animate={{
                scale: [1, 1.1, 1]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <FiPlay className="w-7 h-7 ml-1 relative z-10" />
            </motion.div>
          </motion.div>

          {/* Pulsing ring animation */}
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-blue-400/60"
            animate={{
              scale: [1, 1.4, 1],
              opacity: [0.8, 0, 0.8]
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />

          {/* Secondary pulse ring */}
          <motion.div
            className="absolute inset-0 rounded-full border border-purple-400/40"
            animate={{
              scale: [1, 1.6, 1],
              opacity: [0.6, 0, 0.6]
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.5
            }}
          />

          {/* Enhanced tooltip */}
          <motion.div
            className="absolute bottom-full right-0 mb-3 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none"
            initial={{ y: 10, opacity: 0 }}
            whileHover={{ y: 0, opacity: 1 }}
          >
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white text-sm px-3 py-2 rounded-lg shadow-xl border border-gray-700 whitespace-nowrap">
              <div className="flex items-center gap-2">
                <FiPlay className="w-3 h-3" />
                Watch Tutorial
              </div>
              {/* Tooltip arrow */}
              <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
            </div>
          </motion.div>
        </div>
      </motion.button>

      {/* Video Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 z-[999999] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
            />
            
            {/* Modal Content */}
            <motion.div
              className="relative bg-gray-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-gray-700"
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-700">
                <div>
                  <h3 className="text-lg font-semibold text-white">{title}</h3>
                  {description && (
                    <p className="text-sm text-gray-400 mt-1">{description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Mute/Unmute Button */}
                  <motion.button
                    onClick={() => setIsMuted(!isMuted)}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    title={isMuted ? 'Unmute video' : 'Mute video'}
                  >
                    <motion.div
                      key={isMuted ? 'muted' : 'unmuted'}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      {isMuted ? (
                        <FiVolumeX className="w-5 h-5" />
                      ) : (
                        <FiVolume2 className="w-5 h-5" />
                      )}
                    </motion.div>
                  </motion.button>

                  {/* Close Button */}
                  <button
                    onClick={() => setShowModal(false)}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <FiX className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              {/* Video Container */}
              <div className="relative aspect-video bg-black">
                <iframe
                  src={getVideoEmbedUrl(videoUrl)}
                  className="w-full h-full"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={title}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
