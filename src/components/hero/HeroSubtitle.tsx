'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface HeroSubtitleProps {
  className?: string;
}

export const HeroSubtitle: React.FC<HeroSubtitleProps> = ({ className = '' }) => {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    // Check initial theme
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };

    checkTheme();

    // Listen for theme changes
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  const darkModeText = "The complete white-label Voice AI platform built for agencies. Compare provider costs, integrate seamlessly with GHL and n8n, and retain clients with built-in lock-in technology.";
  
  const lightModeText = "Streamline clients, campaigns, and conversations — powered by next-gen voice automation and real-time CRM intelligence.";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.4 }}
      className={`text-center max-w-3xl mx-auto ${className}`}
    >
      <p className="text-lg md:text-xl lg:text-2xl text-[#1F2937] dark:text-gray-300 leading-relaxed font-light">
        {isDark ? darkModeText : lightModeText}
      </p>
    </motion.div>
  );
};
