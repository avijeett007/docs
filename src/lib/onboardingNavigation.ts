/**
 * Utility functions for onboarding navigation
 * Handles both pre-login (/platform/onboarding) and logged-in (/whitelabel/onboarding) flows
 */

/**
 * Navigate to the next onboarding step
 * Automatically detects if we're in logged-in or pre-login flow
 */
export function navigateToOnboardingStep(stepNumber: number): void {
  const isLoggedInFlow = window.location.pathname.startsWith('/whitelabel/onboarding');
  const basePath = isLoggedInFlow ? '/whitelabel/onboarding' : '/platform/onboarding';
  window.location.href = `${basePath}/${stepNumber}`;
}

/**
 * Get current onboarding step number from the URL path
 */
export function getCurrentOnboardingStep(): number | null {
  const match = window.location.pathname.match(/\/onboarding\/(\d+)/);
  if (!match) {
    return null;
  }

  const stepNumber = Number.parseInt(match[1], 10);
  return Number.isNaN(stepNumber) ? null : stepNumber;
}

/**
 * Get the current onboarding flow type
 */
export function getOnboardingFlowType(): 'logged-in' | 'pre-login' {
  return window.location.pathname.startsWith('/whitelabel/onboarding') ? 'logged-in' : 'pre-login';
}

/**
 * Get the base path for the current onboarding flow
 */
export function getOnboardingBasePath(): string {
  const isLoggedInFlow = window.location.pathname.startsWith('/whitelabel/onboarding');
  return isLoggedInFlow ? '/whitelabel/onboarding' : '/platform/onboarding';
}

/**
 * Navigate to the dashboard based on the current flow
 */
export function navigateToDashboard(): void {
  const isLoggedInFlow = window.location.pathname.startsWith('/whitelabel/onboarding');
  window.location.href = isLoggedInFlow ? '/whitelabel/dashboard' : '/whitelabel/login';
}

/**
 * Navigate to the previous browser route with onboarding-safe fallbacks.
 * Uses browser history when the referrer is same-origin, otherwise falls back
 * to previous onboarding step (if available) or dashboard/login.
 */
export function navigateToPreviousRoute(): void {
  try {
    const hasReferrer = Boolean(document.referrer);
    const isSameOriginReferrer = hasReferrer && new URL(document.referrer).origin === window.location.origin;

    if (isSameOriginReferrer && window.history.length > 1) {
      window.history.back();
      return;
    }
  } catch {
    // Ignore URL parsing issues and use safe fallbacks below.
  }

  const currentStep = getCurrentOnboardingStep();
  if (currentStep && currentStep > 1) {
    navigateToOnboardingStep(currentStep - 1);
    return;
  }

  navigateToDashboard();
}

/**
 * Navigate to the previous onboarding step in the current flow.
 */
export function navigateToPreviousOnboardingStep(): void {
  const currentStep = getCurrentOnboardingStep();

  if (currentStep && currentStep > 1) {
    navigateToOnboardingStep(currentStep - 1);
    return;
  }

  navigateToDashboard();
}
