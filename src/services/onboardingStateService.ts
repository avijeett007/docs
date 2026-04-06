import { OnboardingFormData } from '../types';

const ONBOARDING_STATE_KEY = 'knotie_onboarding_state';
const ONBOARDING_COMPLETED_KEY = 'knotie_onboarding_completed';

interface OnboardingState {
  completed: boolean;
  formData: OnboardingFormData | null;
  lastUpdated: string;
}

export const saveOnboardingState = (formData: OnboardingFormData): void => {
  const state: OnboardingState = {
    completed: true,
    formData,
    lastUpdated: new Date().toISOString()
  };
  localStorage.setItem(ONBOARDING_STATE_KEY, JSON.stringify(state));
  localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
};

export const getOnboardingState = (): OnboardingState | null => {
  const stateStr = localStorage.getItem(ONBOARDING_STATE_KEY);
  if (!stateStr) return null;
  
  try {
    return JSON.parse(stateStr);
  } catch {
    return null;
  }
};

export const isOnboardingCompleted = (): boolean => {
  return localStorage.getItem(ONBOARDING_COMPLETED_KEY) === 'true';
};

export const clearOnboardingState = (): void => {
  localStorage.removeItem(ONBOARDING_STATE_KEY);
  localStorage.removeItem(ONBOARDING_COMPLETED_KEY);
};

export const updateOnboardingData = (formData: Partial<OnboardingFormData>): void => {
  const currentState = getOnboardingState();
  if (!currentState) return;

  const updatedState: OnboardingState = {
    ...currentState,
    formData: {
      ...currentState.formData,
      ...formData
    },
    lastUpdated: new Date().toISOString()
  };

  localStorage.setItem(ONBOARDING_STATE_KEY, JSON.stringify(updatedState));
};
