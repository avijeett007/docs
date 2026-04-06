'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWalkthrough } from '@/context/WalkthroughContext';
import walkthroughConfig from '@/config/walkthroughJourney.json';

interface MenuAccessInfo {
  unlocked: boolean;
  requiredSteps: string[];
  completedRequiredSteps: string[];
  pendingSteps: string[];
}

interface UseMenuAccessReturn {
  isMenuUnlocked: (menuId: string) => boolean;
  getLockedMenus: () => string[];
  getUnlockedMenus: () => string[];
  getNextMenuToUnlock: () => string | null;
  getMenuAccessInfo: (menuId: string) => MenuAccessInfo | null;
  isLoading: boolean;
  error: string | null;
  refreshMenuAccess: () => Promise<void>;
}

export function useMenuAccess(): UseMenuAccessReturn {
  const { unlockedMenus, progress, isLoading: walkthroughLoading } = useWalkthrough();
  const [menuAccessData, setMenuAccessData] = useState<Record<string, MenuAccessInfo>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch menu access data from API
  const fetchMenuAccess = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/partner/walkthrough/menu-access', {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Not authenticated, use default access
          return;
        }
        throw new Error('Failed to fetch menu access');
      }

      const data = await response.json();
      if (data.success) {
        setMenuAccessData(data.data.menuStatus || {});
      }
    } catch (err) {
      console.error('Error fetching menu access:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch menu access');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialize on mount and when walkthrough state changes
  useEffect(() => {
    fetchMenuAccess();
  }, [fetchMenuAccess, unlockedMenus, progress]);

  // Check if a specific menu is unlocked
  const isMenuUnlocked = useCallback((menuId: string): boolean => {
    // If we have API data, use it
    if (menuAccessData[menuId]) {
      return menuAccessData[menuId].unlocked;
    }

    // Fallback to local logic
    if (unlockedMenus.includes(menuId)) {
      return true;
    }

    // Check against configuration rules
    const rule = walkthroughConfig.menuUnlockRules[menuId as keyof typeof walkthroughConfig.menuUnlockRules];
    if (!rule) {
      return true; // Unknown menus are unlocked by default
    }

    if (rule.unlockedByDefault) {
      return true;
    }

    if (!rule.requiredSteps || rule.requiredSteps.length === 0) {
      return true;
    }

    // Check if all required steps are completed
    if (progress?.steps) {
      const completedSteps = rule.requiredSteps.filter(stepId => {
        const stepConfig = walkthroughConfig.steps.find(s => s.id === stepId);
        if (!stepConfig) return false;
        return progress.steps[stepConfig.stepNumber]?.completed || false;
      });
      
      return completedSteps.length === rule.requiredSteps.length;
    }

    return false;
  }, [menuAccessData, unlockedMenus, progress]);

  // Get all locked menus
  const getLockedMenus = useCallback((): string[] => {
    const allMenus = Object.keys(walkthroughConfig.menuUnlockRules);
    return allMenus.filter(menuId => !isMenuUnlocked(menuId));
  }, [isMenuUnlocked]);

  // Get all unlocked menus
  const getUnlockedMenus = useCallback((): string[] => {
    const allMenus = Object.keys(walkthroughConfig.menuUnlockRules);
    return allMenus.filter(menuId => isMenuUnlocked(menuId));
  }, [isMenuUnlocked]);

  // Get the next menu that will be unlocked
  const getNextMenuToUnlock = useCallback((): string | null => {
    const lockedMenus = getLockedMenus();
    
    // Find the menu with the fewest pending required steps
    let nextMenu = null;
    let minPendingSteps = Infinity;

    for (const menuId of lockedMenus) {
      const accessInfo = getMenuAccessInfo(menuId);
      if (accessInfo && accessInfo.pendingSteps.length < minPendingSteps) {
        minPendingSteps = accessInfo.pendingSteps.length;
        nextMenu = menuId;
      }
    }

    return nextMenu;
  }, [getLockedMenus]);

  // Get detailed access information for a menu
  const getMenuAccessInfo = useCallback((menuId: string): MenuAccessInfo | null => {
    // If we have API data, use it
    if (menuAccessData[menuId]) {
      return menuAccessData[menuId];
    }

    // Fallback to local calculation
    const rule = walkthroughConfig.menuUnlockRules[menuId as keyof typeof walkthroughConfig.menuUnlockRules];
    if (!rule) {
      return {
        unlocked: true,
        requiredSteps: [],
        completedRequiredSteps: [],
        pendingSteps: [],
      };
    }

    const requiredSteps = rule.requiredSteps || [];
    const completedRequiredSteps: string[] = [];
    const pendingSteps: string[] = [];

    if (progress?.steps) {
      for (const stepId of requiredSteps) {
        const stepConfig = walkthroughConfig.steps.find(s => s.id === stepId);
        if (stepConfig && progress.steps[stepConfig.stepNumber]?.completed) {
          completedRequiredSteps.push(stepId);
        } else {
          pendingSteps.push(stepId);
        }
      }
    } else {
      pendingSteps.push(...requiredSteps);
    }

    const unlocked = rule.unlockedByDefault || 
                    requiredSteps.length === 0 || 
                    completedRequiredSteps.length === requiredSteps.length ||
                    unlockedMenus.includes(menuId);

    return {
      unlocked,
      requiredSteps,
      completedRequiredSteps,
      pendingSteps,
    };
  }, [menuAccessData, progress, unlockedMenus]);

  // Refresh menu access data
  const refreshMenuAccess = useCallback(async () => {
    await fetchMenuAccess();
  }, [fetchMenuAccess]);

  return {
    isMenuUnlocked,
    getLockedMenus,
    getUnlockedMenus,
    getNextMenuToUnlock,
    getMenuAccessInfo,
    isLoading: isLoading || walkthroughLoading,
    error,
    refreshMenuAccess,
  };
}
