'use client';

import React, { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import { motion } from 'framer-motion';

interface WhitelabelThemeToggleProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  onThemeChange?: (isLightMode: boolean) => void;
  primaryColor?: string;
}

export const WhitelabelThemeToggle: React.FC<WhitelabelThemeToggleProps> = ({
  className = '',
  size = 'md',
  onThemeChange,
  primaryColor = '#3B82F6'
}) => {
  const [mounted, setMounted] = useState(false);
  const [isLightMode, setIsLightMode] = useState(false);

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
    
    // Check if user has a saved preference
    const savedTheme = localStorage.getItem('whitelabel-theme-mode');
    if (savedTheme) {
      const lightMode = savedTheme === 'light';
      setIsLightMode(lightMode);
      onThemeChange?.(lightMode);
    } else {
      // Default to light mode for better visibility
      setIsLightMode(true);
      onThemeChange?.(true);
    }
  }, [onThemeChange]);

  const toggleTheme = () => {
    const newLightMode = !isLightMode;
    console.log('🌓 Theme Toggle Debug:', {
      currentMode: isLightMode ? 'light' : 'dark',
      newMode: newLightMode ? 'light' : 'dark',
      onThemeChangeExists: !!onThemeChange
    });
    setIsLightMode(newLightMode);
    localStorage.setItem('whitelabel-theme-mode', newLightMode ? 'light' : 'dark');
    onThemeChange?.(newLightMode);
  };

  // Don't render on server side
  if (!mounted) {
    return (
      <div className={`${sizeClasses[size]} rounded-full bg-gray-200 animate-pulse`} />
    );
  }

  return (
    <motion.button
      onClick={toggleTheme}
      className={`
        ${sizeClasses[size]}
        relative rounded-full
        ${isLightMode 
          ? 'bg-white/80 border border-gray-300 shadow-md hover:shadow-lg' 
          : 'bg-gray-800/80 border border-gray-600 shadow-md hover:shadow-lg'
        }
        backdrop-blur-md
        hover:scale-105
        transition-all duration-300
        flex items-center justify-center
        group
        ${className}
      `}
      whileTap={{ scale: 0.95 }}
      aria-label={`Switch to ${isLightMode ? 'dark' : 'light'} mode`}
      style={{
        borderColor: isLightMode ? `${primaryColor}20` : `${primaryColor}40`
      }}
    >
      {/* Background glow effect */}
      <div 
        className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" 
        style={{
          background: `linear-gradient(135deg, ${primaryColor}10, ${primaryColor}05)`
        }}
      />
      
      {/* Icon container with rotation animation */}
      <motion.div
        key={isLightMode ? 'light' : 'dark'}
        initial={{ rotate: -180, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="relative z-10"
      >
        {isLightMode ? (
          <Moon 
            size={iconSizes[size]} 
            className="text-gray-600 group-hover:text-gray-800 transition-colors duration-300" 
            style={{ color: primaryColor }}
          />
        ) : (
          <Sun 
            size={iconSizes[size]} 
            className="text-yellow-400 group-hover:text-yellow-300 transition-colors duration-300" 
          />
        )}
      </motion.div>
      
      {/* Tooltip */}
      <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap">
        {isLightMode ? 'Switch to dark mode' : 'Switch to light mode'}
      </div>
    </motion.button>
  );
};
