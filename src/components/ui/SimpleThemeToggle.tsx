'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';

interface SimpleThemeToggleProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const SimpleThemeToggle: React.FC<SimpleThemeToggleProps> = ({ 
  className = '', 
  size = 'md' 
}) => {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

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

  useEffect(() => {
    setMounted(true);
    // Load theme from localStorage or default to dark
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' || 'dark';
    setTheme(savedTheme);
    // Apply theme to document
    document.documentElement.classList.toggle('dark', savedTheme === 'dark');
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

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
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        key={theme}
        initial={{ opacity: 0, rotate: -180 }}
        animate={{ opacity: 1, rotate: 0 }}
        exit={{ opacity: 0, rotate: 180 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-center"
      >
        {theme === 'dark' ? (
          <Moon 
            size={iconSizes[size]} 
            className="text-blue-400 group-hover:text-blue-300 transition-colors duration-300" 
          />
        ) : (
          <Sun 
            size={iconSizes[size]} 
            className="text-yellow-400 group-hover:text-yellow-300 transition-colors duration-300" 
          />
        )}
      </motion.div>
      
      {/* Glow effect */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </motion.button>
  );
};
