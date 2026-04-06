'use client';

import React, { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { motion } from 'framer-motion';

interface ThemeToggleProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = '',
  size = 'md'
}) => {
  const [mounted, setMounted] = useState(false);

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
  };

  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 24
  };

  // Handle SSR and context availability
  let theme: 'light' | 'dark' = 'dark';
  let toggleTheme = () => {};

  try {
    const themeContext = useTheme();
    theme = themeContext.theme;
    toggleTheme = themeContext.toggleTheme;
  } catch (error) {
    // Fallback for SSR or when context is not available
    console.warn('ThemeToggle: Theme context not available, using fallback');
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render on server side
  if (!mounted) {
    return (
      <div className={`${sizeClasses[size]} rounded-full bg-gray-800/50 animate-pulse`} />
    );
  }

  return (
    <motion.button
      onClick={toggleTheme}
      className={`
        ${sizeClasses[size]}
        relative rounded-full
        bg-gradient-to-r from-blue-500/20 to-purple-500/20
        border border-blue-400/30
        backdrop-blur-md
        hover:border-blue-400/50
        hover:scale-105
        transition-all duration-300
        flex items-center justify-center
        group
        ${className}
      `}
      whileTap={{ scale: 0.95 }}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {/* Background glow effect */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400/10 to-purple-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      {/* Icon container with rotation animation */}
      <motion.div
        key={theme}
        initial={{ rotate: -180, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="relative z-10"
      >
        {theme === 'light' ? (
          <Moon 
            size={iconSizes[size]} 
            className="text-blue-600 dark:text-blue-400 group-hover:text-blue-500 transition-colors duration-300" 
          />
        ) : (
          <Sun 
            size={iconSizes[size]} 
            className="text-yellow-500 group-hover:text-yellow-400 transition-colors duration-300" 
          />
        )}
      </motion.div>

      {/* Tooltip */}
      <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <div className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs px-2 py-1 rounded whitespace-nowrap">
          {theme === 'light' ? 'Dark mode' : 'Light mode'}
        </div>
      </div>
    </motion.button>
  );
};
