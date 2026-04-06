'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import walkthroughConfig from '@/config/walkthroughJourney.json';

interface WalkthroughStep {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  videoUrl?: string;
  videoDuration?: number;
  targetPage?: string;
  unlocksMenus: string[];
  canSkip: boolean;
  isLastStep?: boolean;
  instructions: string;
  helpText?: string;
}

interface WalkthroughProgress {
  steps: Record<string, {
    stepId: string;
    completed: boolean;
    completedAt?: string;
    startedAt?: string;
    videoWatched: boolean;
    skipped: boolean;
    data?: Record<string, any>;
  }>;
  unlockedMenus: string[];
  totalSteps: number;
  completedSteps: number;
}

interface WalkthroughContextType {
  // State
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  completedSteps: number;
  progress: WalkthroughProgress | null;
  unlockedMenus: string[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  startWalkthrough: () => Promise<void>;
  completeStep: (stepId: string, data?: any) => Promise<void>;
  skipStep: (stepId: string, reason?: string) => Promise<void>;
  skipWalkthrough: (reason?: string) => Promise<void>;
  restartWalkthrough: () => Promise<void>;
  
  // Utilities
  isMenuUnlocked: (menuId: string) => boolean;
  getNextStep: () => WalkthroughStep | null;
  getCurrentStep: () => WalkthroughStep | null;
  refreshProgress: () => Promise<void>;
}

const WalkthroughContext = createContext<WalkthroughContextType | undefined>(undefined);

const WALKTHROUGH_STORAGE_KEY = 'knotie-walkthrough-progress';

export function WalkthroughProvider({ children }: { children: React.ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps] = useState(walkthroughConfig.totalSteps);
  const [completedSteps, setCompletedSteps] = useState(0);
  const [progress, setProgress] = useState<WalkthroughProgress | null>(null);
  const [unlockedMenus, setUnlockedMenus] = useState<string[]>(['dashboard']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();

  // Fetch progress from API
  const fetchProgress = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/partner/walkthrough/progress', {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Not authenticated, don't show error
          return;
        }
        throw new Error('Failed to fetch progress');
      }

      const data = await response.json();
      if (data.success) {
        const progressData = data.data;
        setCurrentStep(progressData.currentStep);
        setCompletedSteps(progressData.completedSteps);
        setProgress(progressData.progress);
        setUnlockedMenus(progressData.progress?.unlockedMenus || ['dashboard']);
        
        // Set active state based on completion status
        const shouldBeActive = !progressData.isCompleted && 
                              !progressData.isSkipped && 
                              progressData.startedAt;
        setIsActive(shouldBeActive);

        // Cache in localStorage for offline access
        localStorage.setItem(WALKTHROUGH_STORAGE_KEY, JSON.stringify(progressData));
      }
    } catch (err) {
      console.error('Error fetching walkthrough progress:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch progress');
      
      // Try to load from localStorage as fallback
      const cached = localStorage.getItem(WALKTHROUGH_STORAGE_KEY);
      if (cached) {
        try {
          const cachedData = JSON.parse(cached);
          setProgress(cachedData.progress);
          setUnlockedMenus(cachedData.progress?.unlockedMenus || ['dashboard']);
          setCurrentStep(cachedData.currentStep);
          setCompletedSteps(cachedData.completedSteps);
        } catch (parseError) {
          console.error('Error parsing cached progress:', parseError);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    fetchProgress();

    // Check if we should auto-start walkthrough for new partners
    const shouldAutoStart = localStorage.getItem('should_start_walkthrough');
    if (shouldAutoStart === 'true') {
      console.log('WalkthroughContext - Auto-starting walkthrough for new partner');
      // Delay to ensure component is mounted
      setTimeout(() => {
        startWalkthrough();
      }, 1000);
      localStorage.removeItem('should_start_walkthrough');
    }
  }, [fetchProgress]);

  // Start walkthrough
  const startWalkthrough = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/partner/walkthrough/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ version: '1.0' }),
      });

      if (!response.ok) {
        throw new Error('Failed to start walkthrough');
      }

      const data = await response.json();
      if (data.success) {
        setIsActive(true);
        setCurrentStep(0);
        setCompletedSteps(0);
        await fetchProgress(); // Refresh progress
      }
    } catch (err) {
      console.error('Error starting walkthrough:', err);
      setError(err instanceof Error ? err.message : 'Failed to start walkthrough');
    } finally {
      setIsLoading(false);
    }
  }, [fetchProgress]);

  // Complete step
  const completeStep = useCallback(async (stepId: string, data: any = {}) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/partner/walkthrough/step/${stepId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to complete step');
      }

      const result = await response.json();
      if (result.success) {
        await fetchProgress(); // Refresh progress
        
        if (result.data.walkthroughCompleted) {
          setIsActive(false);
        }
      }
    } catch (err) {
      console.error('Error completing step:', err);
      setError(err instanceof Error ? err.message : 'Failed to complete step');
    } finally {
      setIsLoading(false);
    }
  }, [fetchProgress]);

  // Skip step (individual)
  const skipStep = useCallback(async (stepId: string, reason?: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/partner/walkthrough/step/${stepId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ skipped: true, reason }),
      });

      if (!response.ok) {
        throw new Error('Failed to skip step');
      }

      const result = await response.json();
      if (result.success) {
        await fetchProgress(); // Refresh progress
      }
    } catch (err) {
      console.error('Error skipping step:', err);
      setError(err instanceof Error ? err.message : 'Failed to skip step');
    } finally {
      setIsLoading(false);
    }
  }, [fetchProgress]);

  // Skip entire walkthrough
  const skipWalkthrough = useCallback(async (reason?: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/partner/walkthrough/skip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ confirmSkip: true, reason }),
      });

      if (!response.ok) {
        throw new Error('Failed to skip walkthrough');
      }

      const result = await response.json();
      if (result.success) {
        setIsActive(false);
        await fetchProgress(); // Refresh progress
      }
    } catch (err) {
      console.error('Error skipping walkthrough:', err);
      setError(err instanceof Error ? err.message : 'Failed to skip walkthrough');
    } finally {
      setIsLoading(false);
    }
  }, [fetchProgress]);

  // Restart walkthrough
  const restartWalkthrough = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/partner/walkthrough/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ version: '1.0', resetProgress: true }),
      });

      if (!response.ok) {
        throw new Error('Failed to restart walkthrough');
      }

      const data = await response.json();
      if (data.success) {
        setIsActive(true);
        setCurrentStep(0);
        setCompletedSteps(0);
        await fetchProgress(); // Refresh progress
      }
    } catch (err) {
      console.error('Error restarting walkthrough:', err);
      setError(err instanceof Error ? err.message : 'Failed to restart walkthrough');
    } finally {
      setIsLoading(false);
    }
  }, [fetchProgress]);

  // Check if menu is unlocked
  const isMenuUnlocked = useCallback((menuId: string) => {
    return unlockedMenus.includes(menuId);
  }, [unlockedMenus]);

  // Get next step
  const getNextStep = useCallback((): WalkthroughStep | null => {
    if (currentStep >= totalSteps) return null;
    
    const nextStepConfig = walkthroughConfig.steps.find(
      step => step.stepNumber === currentStep + 1
    );
    
    return nextStepConfig as WalkthroughStep || null;
  }, [currentStep, totalSteps]);

  // Get current step
  const getCurrentStep = useCallback((): WalkthroughStep | null => {
    const currentStepConfig = walkthroughConfig.steps.find(
      step => step.stepNumber === currentStep + 1
    );
    
    return currentStepConfig as WalkthroughStep || null;
  }, [currentStep]);

  // Refresh progress
  const refreshProgress = useCallback(async () => {
    await fetchProgress();
  }, [fetchProgress]);

  return (
    <WalkthroughContext.Provider
      value={{
        isActive,
        currentStep,
        totalSteps,
        completedSteps,
        progress,
        unlockedMenus,
        isLoading,
        error,
        startWalkthrough,
        completeStep,
        skipStep,
        skipWalkthrough,
        restartWalkthrough,
        isMenuUnlocked,
        getNextStep,
        getCurrentStep,
        refreshProgress,
      }}
    >
      {children}
    </WalkthroughContext.Provider>
  );
}

export function useWalkthrough() {
  const context = useContext(WalkthroughContext);
  if (context === undefined) {
    throw new Error('useWalkthrough must be used within a WalkthroughProvider');
  }
  return context;
}
