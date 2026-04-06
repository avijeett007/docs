'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface BenefitCardProps {
  title: string;
  description: string;
  icon: string;
  index: number;
}

export default function BenefitCard({ title, description, icon, index }: BenefitCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="relative group"
    >
      {/* Animated glow effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-teal-500/20 rounded-xl blur-xl"
        animate={{
          scale: [1, 1.05, 1],
          opacity: [0.5, 0.3, 0.5],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
          delay: index * 0.2,
        }}
      />

      {/* Content */}
      <div className="relative h-full p-6 bg-gray-900/90 backdrop-blur-xl rounded-xl border border-blue-400/20 transition-transform duration-300 group-hover:scale-[1.02]">
        <div className="text-4xl mb-4">{icon}</div>
        <h3 className="text-xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">
          {title}
        </h3>
        <p className="text-gray-400">{description}</p>
      </div>
    </motion.div>
  );
}
