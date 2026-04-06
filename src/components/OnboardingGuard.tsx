import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isOnboardingCompleted } from '../services/onboardingStateService';
import routes from '../config/dashboard/routes.json';

interface OnboardingGuardProps {
  children: React.ReactNode;
}

interface Route {
  path: string;
  title: string;
  requiresAuth: boolean;
  requiresOnboarding?: boolean;
}

interface Routes {
  routes: {
    [key: string]: Route;
  };
  redirects: {
    default: string;
    unauthenticated: string;
    onboardingIncomplete: string;
  };
}

const typedRoutes = routes as Routes;

export const OnboardingGuard: React.FC<OnboardingGuardProps> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const currentRoute = Object.values(typedRoutes.routes).find(route => route.path === pathname);

  useEffect(() => {
    // Skip check for onboarding page itself
    if (pathname === typedRoutes.routes.onboarding.path) {
      return;
    }

    // If route requires onboarding and it's not completed, redirect to onboarding
    if (currentRoute?.requiresOnboarding && !isOnboardingCompleted()) {
      router.replace(typedRoutes.redirects.onboardingIncomplete);
    }
  }, [pathname, router, currentRoute]);

  return <>{children}</>;
};
