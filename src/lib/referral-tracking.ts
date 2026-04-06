/**
 * Referral Tracking Utilities
 * Handles capturing and managing referral IDs from Rewardful
 */

declare global {
  interface Window {
    rewardful?: {
      (action: string, data?: any): void;
      q?: any[];
    };
  }
}

/**
 * Get the current referral ID from Rewardful
 */
export function getReferralId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  // Try to get referral ID from Rewardful
  try {
    // Check if Rewardful is loaded
    if (window.rewardful) {
      // Get referral ID from Rewardful's internal storage
      const referralId = localStorage.getItem('rewardful_referral');
      if (referralId) {
        return referralId;
      }
    }

    // Fallback: Check URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const refParam = urlParams.get('via') || urlParams.get('ref') || urlParams.get('referral');
    if (refParam) {
      // Store for future use
      localStorage.setItem('rewardful_referral', refParam);
      return refParam;
    }

    // Check for referral in hash
    const hash = window.location.hash;
    if (hash.includes('ref=')) {
      const match = hash.match(/ref=([^&]+)/);
      if (match) {
        const referralId = match[1];
        localStorage.setItem('rewardful_referral', referralId);
        return referralId;
      }
    }
  } catch (error) {
    console.error('Error getting referral ID:', error);
  }

  return null;
}

/**
 * Set referral ID manually (useful for server-side operations)
 */
export function setReferralId(referralId: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem('rewardful_referral', referralId);
    
    // Also notify Rewardful if available
    if (window.rewardful) {
      window.rewardful('referral', referralId);
    }
  } catch (error) {
    console.error('Error setting referral ID:', error);
  }
}

/**
 * Clear stored referral ID
 */
export function clearReferralId(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem('rewardful_referral');
  } catch (error) {
    console.error('Error clearing referral ID:', error);
  }
}



/**
 * Track a conversion with Rewardful
 */
export function trackConversion(data: {
  amount: number;
  currency?: string;
  orderId: string;
  isRecurring?: boolean;
  metadata?: Record<string, any>;
}): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (window.rewardful) {
      window.rewardful('convert', {
        amount: data.amount,
        currency: data.currency || 'USD',
        order_id: data.orderId,
        is_recurring: data.isRecurring || false,
        ...data.metadata,
      });
    }
  } catch (error) {
    console.error('Error tracking conversion:', error);
  }
}

/**
 * Initialize referral tracking on page load
 */
export function initializeReferralTracking(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    // Check for referral parameters in URL
    const referralId = getReferralId();
    
    if (referralId && window.rewardful) {
      // Notify Rewardful about the referral
      window.rewardful('referral', referralId);
    }
  } catch (error) {
    console.error('Error initializing referral tracking:', error);
  }
}

/**
 * Get referral metadata for Stripe checkout
 */
export function getReferralMetadata(): Record<string, string> {
  const referralId = getReferralId();
  
  if (referralId) {
    return {
      referral_id: referralId,
      referral_source: 'rewardful',
    };
  }
  
  return {};
}

/**
 * Hook to use referral tracking in React components
 */
export function useReferralTracking() {
  const referralId = getReferralId();

  return {
    referralId,
    setReferralId,
    clearReferralId,
    trackConversion,
    getReferralMetadata,
  };
}
