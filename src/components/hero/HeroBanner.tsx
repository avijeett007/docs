'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface HeroBannerProps {
  className?: string;
  onGetStarted?: () => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ className = '', onGetStarted }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className={`
        bg-gradient-to-r from-purple-600 via-blue-500 to-teal-500 
        text-white px-4 py-3 text-center text-sm sm:text-base 
        border-b border-blue-400/20 relative z-[9999]
        ${className}
      `}
    >
      <div className="flex items-center justify-center gap-2">
        <span>We are building Knotie AI Pro V2</span>
        <span className="text-white/80">→</span>
        <button
          onClick={() => {
            if (onGetStarted) {
              onGetStarted();
            }
          }}
          className="underline hover:no-underline transition-all duration-200 font-medium"
        >
          Get Started Now for Early Bird offer
        </button>
      </div>
    </motion.div>
  );
};
