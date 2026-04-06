/**
 * Onboarding Data Storage Utilities
 * Manages localStorage for onboarding flow data persistence
 */

export interface BusinessInfo {
  name: string;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  totalReviews?: number;
  businessType?: string;
  coordinates?: { lat: number; lng: number };
  priceLevel?: number;
  businessStatus?: string;
  openingHours?: any;
  amenities?: any;
  hasWebsite: boolean;
  lastUpdated: string;
  step1Completed: boolean;
}

export interface OnboardingData {
  businessInfo?: BusinessInfo;
  contactInfo?: {
    email?: string;
    phone?: string;
    contactPerson?: string;
  };
  preferences?: {
    industry?: string;
    businessSize?: string;
    goals?: string[];
  };
  currentStep: number;
  completedSteps: number[];
  startedAt: string;
  lastUpdated: string;
}

const STORAGE_KEY = 'knotie_onboarding_data';

/**
 * Save business information to localStorage
 */
export function saveBusinessInfo(businessInfo: Partial<BusinessInfo>): void {
  try {
    const existingData = getOnboardingData();
    const updatedBusinessInfo = {
      ...existingData.businessInfo,
      ...businessInfo,
      lastUpdated: new Date().toISOString()
    };

    const updatedData: OnboardingData = {
      ...existingData,
      businessInfo: updatedBusinessInfo as BusinessInfo,
      lastUpdated: new Date().toISOString()
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData));
    console.log('💾 Business info saved to localStorage:', businessInfo);
  } catch (error) {
    console.error('❌ Failed to save business info to localStorage:', error);
  }
}

/**
 * Get all onboarding data from localStorage
 */
export function getOnboardingData(): OnboardingData {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('❌ Failed to retrieve onboarding data from localStorage:', error);
  }

  // Return default structure if no data exists
  return {
    currentStep: 1,
    completedSteps: [],
    startedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Get business information from localStorage
 */
export function getBusinessInfo(): BusinessInfo | null {
  const data = getOnboardingData();
  return data.businessInfo || null;
}

/**
 * Mark a step as completed
 */
export function markStepCompleted(stepNumber: number): void {
  try {
    const data = getOnboardingData();
    const completedSteps = [...new Set([...data.completedSteps, stepNumber])];
    
    const updatedData: OnboardingData = {
      ...data,
      completedSteps,
      currentStep: Math.max(data.currentStep, stepNumber + 1),
      lastUpdated: new Date().toISOString()
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData));
    console.log(`✅ Step ${stepNumber} marked as completed`);
  } catch (error) {
    console.error('❌ Failed to mark step as completed:', error);
  }
}

/**
 * Clear all onboarding data
 */
export function clearOnboardingData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('🗑️ Onboarding data cleared');
  } catch (error) {
    console.error('❌ Failed to clear onboarding data:', error);
  }
}

/**
 * Check if business lookup data is available
 */
export function hasBusinessLookupData(): boolean {
  const businessInfo = getBusinessInfo();
  return !!(businessInfo && businessInfo.address && businessInfo.lastUpdated);
}

/**
 * Get formatted business summary for display
 */
export function getBusinessSummary(): string | null {
  const businessInfo = getBusinessInfo();
  if (!businessInfo) return null;

  const parts = [businessInfo.name];
  if (businessInfo.address) parts.push(businessInfo.address);
  if (businessInfo.businessType) parts.push(businessInfo.businessType);
  if (businessInfo.rating) parts.push(`${businessInfo.rating}⭐`);

  return parts.join(' • ');
}

/**
 * Auto-fill form data from saved business information
 */
export function getAutoFillData(): Record<string, any> {
  const businessInfo = getBusinessInfo();
  if (!businessInfo) return {};

  return {
    businessName: businessInfo.name,
    website: businessInfo.website,
    phone: businessInfo.phone,
    address: businessInfo.address,
    businessType: businessInfo.businessType,
    hasWebsite: businessInfo.hasWebsite
  };
}
