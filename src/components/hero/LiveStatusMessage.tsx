'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ClientOnly } from '../ui/client-only';
import { HeroMemberCounter } from '../ui/animated-counter';

interface LiveStatusMessageProps {
  className?: string;
}

export const LiveStatusMessage: React.FC<LiveStatusMessageProps> = ({ className = '' }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className={`
        inline-flex items-center rounded-full border px-6 py-2.5 text-sm mb-4 group transition-all duration-300
        backdrop-blur-md hover:border-blue-400/50
        border-blue-400/30 bg-blue-900/10 text-[#1F2937]
        dark:border-blue-400/30 dark:bg-blue-900/10 dark:text-blue-200
        ${className}
      `}
    >
      <motion.span 
        className="flex h-2 w-2 rounded-full bg-teal-400 mr-3"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [1, 0.7, 1]
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      <span>
        Join <ClientOnly fallback={<span className="text-teal-400 font-semibold">250+</span>}>
          <HeroMemberCounter className="text-teal-400 font-semibold" />
        </ClientOnly> agencies already scaling with Knotie
      </span>
    </motion.div>
  );
};
