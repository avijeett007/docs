'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface NeonContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function NeonContainer({ children, className = '' }: NeonContainerProps) {
  return (
    <div className="relative">
      {/* Animated border effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-blue-500 to-teal-500 rounded-lg opacity-50 blur-lg"
        animate={{
          scale: [1, 1.02, 1],
          opacity: [0.5, 0.3, 0.5],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      {/* Content container with glass effect */}
      <div className={cn("relative bg-gray-900/90 backdrop-blur-xl rounded-lg border border-blue-400/20", className)}>
        {children}
      </div>
    </div>
  );
}
