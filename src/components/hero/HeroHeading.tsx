'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface HeroHeadingProps {
  className?: string;
}

export const HeroHeading: React.FC<HeroHeadingProps> = ({ className = '' }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.2 }}
      className={`text-center ${className}`}
    >
      <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight tracking-tight">
        <span className="text-gray-900 dark:text-white">
          Everything Your AI Agency
        </span>
        <br />
        <span className="text-gray-900 dark:text-white">
          Needs—
        </span>
        <span className="text-transparent bg-gradient-to-r from-teal-400 via-cyan-400 to-blue-500 bg-clip-text">
          Tied Together
        </span>
      </h1>
    </motion.div>
  );
};
