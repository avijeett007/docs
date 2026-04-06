'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Play } from 'lucide-react';

interface HeroButtonsProps {
  onGetStarted: () => void;
  onSeeHowItWorks: () => void;
  className?: string;
}

export const HeroButtons: React.FC<HeroButtonsProps> = ({ 
  onGetStarted, 
  onSeeHowItWorks, 
  className = '' 
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.6 }}
      className={`flex flex-col sm:flex-row items-center justify-center gap-4 ${className}`}
    >
      {/* Get Started Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onGetStarted}
        className="
          px-8 py-4 rounded-xl 
          bg-gradient-to-r from-teal-500 to-cyan-500 
          hover:from-teal-600 hover:to-cyan-600
          text-white font-semibold text-lg
          transition-all duration-300 
          shadow-lg shadow-teal-500/25
          hover:shadow-xl hover:shadow-teal-500/40
          relative overflow-hidden group
        "
      >
        <span className="relative flex items-center justify-center gap-2">
          Get Started
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
        </span>
      </motion.button>

      {/* See How It Works Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onSeeHowItWorks}
        className="
          px-8 py-4 rounded-xl 
          border-2 border-gray-300 dark:border-gray-600
          text-gray-700 dark:text-gray-300
          hover:border-teal-500 hover:text-teal-600 dark:hover:text-teal-400
          font-semibold text-lg
          transition-all duration-300
          hover:bg-teal-50 dark:hover:bg-teal-900/20
          relative overflow-hidden group
        "
      >
        <span className="relative flex items-center justify-center gap-2">
          <Play className="w-5 h-5" />
          See How It Works
        </span>
      </motion.button>
    </motion.div>
  );
};
