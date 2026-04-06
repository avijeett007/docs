'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ 
  children, 
  defaultTheme = 'dark' 
}) => {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [mounted, setMounted] = useState(false);

  // Handle hydration
  useEffect(() => {
    setMounted(true);
    
    // Check for saved theme preference or system preference
    const savedTheme = localStorage.getItem('knotie-theme') as Theme;
    if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
      setThemeState(savedTheme);
    } else {
      // Check system preference
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setThemeState(systemPrefersDark ? 'dark' : 'light');
    }
  }, []);

  // Update document class and localStorage when theme changes
  useEffect(() => {
    if (!mounted) return;
    
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    
    localStorage.setItem('knotie-theme', theme);
  }, [theme, mounted]);

  const toggleTheme = () => {
    setThemeState(prev => prev === 'light' ? 'dark' : 'light');
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const value: ThemeContextType = {
    theme,
    toggleTheme,
    setTheme
  };

  // Prevent flash of unstyled content
  if (!mounted) {
    return <div className="opacity-0">{children}</div>;
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Theme configuration for different components
export const themeConfig = {
  light: {
    background: 'bg-gradient-to-b from-gray-50 to-white',
    text: {
      primary: 'text-gray-900',
      secondary: 'text-gray-600',
      accent: 'text-blue-600'
    },
    button: {
      primary: 'bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white',
      secondary: 'border-2 border-blue-500 text-blue-600 hover:bg-blue-50'
    },
    card: 'bg-white/80 backdrop-blur-lg border border-gray-200/50',
    nav: 'bg-white/80 backdrop-blur-lg border-b border-gray-200/50'
  },
  dark: {
    background: 'bg-gradient-to-b from-gray-900 to-black',
    text: {
      primary: 'text-white',
      secondary: 'text-blue-100/80',
      accent: 'text-blue-400'
    },
    button: {
      primary: 'bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white',
      secondary: 'border-2 border-purple-400/50 text-purple-200 hover:border-purple-400 hover:text-white hover:bg-purple-400/10'
    },
    card: 'bg-gray-800/50 backdrop-blur-lg border border-blue-400/20',
    nav: 'bg-gray-900/80 backdrop-blur-lg border-b border-blue-400/20'
  }
};
