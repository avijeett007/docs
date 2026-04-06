'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ClientOnly } from '../ui/client-only';
import { HeroMemberCounter } from '../ui/animated-counter';

interface TrustIndicatorsProps {
  className?: string;
}

export const TrustIndicators: React.FC<TrustIndicatorsProps> = ({ className = '' }) => {
  const indicators = [
    { text: 'Official Retell AI Partner', color: 'text-teal-400' },
    {
      text: 'Trusted by',
      color: 'text-teal-400',
      hasCounter: true
    },
    { text: 'Deploy in Minutes', color: 'text-teal-400' }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.8 }}
      className={`flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-8 ${className}`}
    >
      {indicators.map((indicator, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.8 + (index * 0.1) }}
          className="flex items-center gap-2"
        >
          {/* Teal bullet point */}
          <motion.div
            className="w-2 h-2 bg-teal-400 rounded-full"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [1, 0.7, 1]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: index * 0.3,
              ease: "easeInOut"
            }}
          />

          {/* Text */}
          <span className={`text-sm md:text-base font-medium ${indicator.color}`}>
            {indicator.hasCounter ? (
              <>
                {indicator.text} <ClientOnly fallback={<span className="text-teal-400 font-bold">250+</span>}>
                  <span className="text-teal-400 font-bold">
                    <HeroMemberCounter />
                  </span>
                </ClientOnly> Agencies
              </>
            ) : (
              indicator.text
            )}
          </span>
        </motion.div>
      ))}
    </motion.div>
  );
};
