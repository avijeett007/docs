'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';

interface UserGuideContextType {
  hasSeenGuide: boolean;
  isGuideActive: boolean;
  startGuide: () => void;
  endGuide: () => void;
  resetGuide: () => void;
  currentStep: number;
  setCurrentStep: (step: number) => void;
}

const UserGuideContext = createContext<UserGuideContextType | undefined>(undefined);

const GUIDE_STORAGE_KEY = 'knotie-user-guide-seen';

export function UserGuideProvider({ children }: { children: React.ReactNode }) {
  const [hasSeenGuide, setHasSeenGuide] = useState(true);
  const [isGuideActive, setIsGuideActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    // Check if user has seen the guide before
    const seen = localStorage.getItem(GUIDE_STORAGE_KEY);
    if (!seen) {
      setHasSeenGuide(false);
      // Auto-start guide on partner dashboard
      if (pathname === '/partner/dashboard') {
        setIsGuideActive(true);
      }
    }
  }, [pathname]);

  // End any active guide when navigating to a different route
  useEffect(() => {
    if (isGuideActive) {
      // Small delay to allow the guide to start if it's supposed to on the new route
      const timer = setTimeout(() => {
        // Only end the guide if we're not on a route that should have a guide
        const guideSupportedRoutes = [
          '/partner/dashboard',
          '/partner/settings',
          '/partner/settings/whitelabel',
          '/partner/settings/api-keys',
          '/partner/usage-analytics',
          '/partner/ai-agents',
          '/partner/ai-agents/retell',
          '/partner/customers'
        ];

        if (pathname && !guideSupportedRoutes.includes(pathname)) {
          setIsGuideActive(false);
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [pathname, isGuideActive]);

  const startGuide = useCallback(() => {
    setIsGuideActive(true);
    setCurrentStep(0);
  }, []);

  const endGuide = useCallback(() => {
    setIsGuideActive(false);
    localStorage.setItem(GUIDE_STORAGE_KEY, 'true');
    setHasSeenGuide(true);

    // Force cleanup of intro.js elements
    setTimeout(() => {
      const introElements = document.querySelectorAll(
        '.introjs-overlay, .introjs-tooltip, .introjs-helperLayer, .introjs-tooltipReferenceLayer, .introjs-disableInteraction'
      );
      introElements.forEach(el => {
        try {
          el.remove();
        } catch (error) {
          // Ignore cleanup errors
        }
      });

      // Remove intro.js classes
      document.body.classList.remove('introjs-fixParent');
    }, 50);
  }, []);

  const resetGuide = useCallback(() => {
    localStorage.removeItem(GUIDE_STORAGE_KEY);
    setHasSeenGuide(false);
    setCurrentStep(0);
  }, []);

  // Keyboard shortcut to restart guide (Ctrl/Cmd + ?)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '?') {
        e.preventDefault();
        startGuide();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [startGuide]);

  return (
    <UserGuideContext.Provider
      value={{
        hasSeenGuide,
        isGuideActive,
        startGuide,
        endGuide,
        resetGuide,
        currentStep,
        setCurrentStep,
      }}
    >
      {children}
    </UserGuideContext.Provider>
  );
}

export function useUserGuide() {
  const context = useContext(UserGuideContext);
  if (context === undefined) {
    throw new Error('useUserGuide must be used within a UserGuideProvider');
  }
  return context;
}