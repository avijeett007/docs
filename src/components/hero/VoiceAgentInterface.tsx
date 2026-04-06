'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Mic, Loader2 } from 'lucide-react';

interface VoiceAgentInterfaceProps {
  isProcessing?: boolean;
  isRecording?: boolean;
  isActive?: boolean;
  onMicClick: () => void;
  permissionError?: string | null;
  className?: string;
}

export const VoiceAgentInterface: React.FC<VoiceAgentInterfaceProps> = ({
  isProcessing = false,
  isRecording = false,
  isActive = false,
  onMicClick,
  permissionError = null,
  className = ''
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, delay: 1.0 }}
      className={`flex flex-col items-center justify-center gap-6 ${className}`}
    >
      {/* Main Voice Interface Circle */}
      <div className="relative">
        {/* Permission Error Tooltip */}
        {permissionError && (
          <div className="absolute bottom-full mb-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg text-sm whitespace-nowrap z-10">
            {permissionError}
          </div>
        )}

        {/* Main Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onMicClick}
          disabled={isProcessing}
          className={`
            relative group
            w-48 h-48 md:w-52 md:h-52 rounded-full
            bg-gradient-to-br from-cyan-400/10 via-teal-400/10 to-cyan-500/10
            dark:from-blue-600/20 dark:via-purple-600/20 dark:to-teal-500/20
            border-2 border-cyan-400/40 dark:border-blue-400/30
            backdrop-blur-md
            shadow-[0_8px_32px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)]
            dark:shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)]
            transition-all duration-500
            hover:border-cyan-400/50 dark:hover:border-blue-400/50
            hover:shadow-2xl hover:shadow-cyan-400/20 dark:hover:shadow-blue-400/20
            ${isRecording ? 'border-red-400/60 shadow-xl shadow-red-400/20' : ''}
            ${isProcessing ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}
          `}
        >
          {/* Outer Ring for 3D Effect */}
          <div className="absolute -inset-2 rounded-full border border-cyan-400/30 dark:border-teal-400/30" />

          {/* Ripple Effects */}
          {(isRecording || isActive) && (
            <>
              <div className="absolute inset-0 rounded-full border-2 border-red-400/50 animate-ping" />
            </>
          )}

          {/* Animated Ripple Effects */}
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute inset-0 rounded-full border-2 border-cyan-400/30 dark:border-teal-400/20"
              animate={{
                scale: [1, 1.2 + i * 0.1],
                opacity: [0.6, 0]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.4
              }}
            />
          ))}

          {/* Active Recording Ring */}
          {(isRecording || isProcessing) && (
            <motion.div 
              className="absolute inset-0 rounded-full border-4 border-red-400/60"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          )}

          {/* Microphone/Loading Icon */}
          {isProcessing ? (
            <Loader2
              className="w-14 h-14 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2
                        animate-spin text-teal-400"
            />
          ) : isRecording ? (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="flex space-x-3">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="w-2.5 h-10 bg-gradient-to-t from-red-400 to-blue-400 rounded-full animate-pulse"
                    style={{ animationDelay: `${i * 200}ms` }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <Mic
              className={`
                w-14 h-14 absolute
                top-1/2 left-1/2
                transform -translate-x-1/2 -translate-y-1/2
                transition-all duration-500
                ${isActive ? 'text-red-400 scale-110' : 'text-cyan-600 dark:text-blue-300'}
                group-hover:scale-110 group-hover:text-cyan-700 dark:group-hover:text-blue-200
                stroke-[1.5]
              `}
            />
          )}
        </motion.button>
      </div>

      {/* Status Label with 3D Ring Effect */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 1.0 }}
        className={`
          px-6 py-3 rounded-full text-sm font-medium
          transition-all duration-300
          backdrop-blur-md
          shadow-[0_4px_16px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)]
          dark:shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)]
          ${isRecording
            ? 'bg-red-500/20 text-red-200 border border-red-400/30'
            : 'bg-cyan-500/10 text-gray-700 dark:bg-blue-500/20 dark:text-blue-300 border border-cyan-400/30 dark:border-blue-400/30'
          }
        `}
      >
        {isRecording ? 'Click to End Call' : (
          <>
            Hi, I'm Knotie. <span className="text-cyan-600 dark:text-cyan-400">Tap to talk.</span>
          </>
        )}
      </motion.div>

      {/* Permission Error Message */}
      {permissionError && (
        <p className="text-red-500 text-center max-w-xs text-sm">
          {permissionError}
        </p>
      )}
    </motion.div>
  );
};
