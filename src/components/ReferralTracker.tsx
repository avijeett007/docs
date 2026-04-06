'use client';

import { useEffect } from 'react';
import { initializeReferralTracking } from '@/lib/referral-tracking';

/**
 * Client-side component to initialize referral tracking
 * Should be included in the root layout or main pages
 */
export default function ReferralTracker() {
  useEffect(() => {
    // Initialize referral tracking when component mounts
    initializeReferralTracking();
  }, []);

  // This component doesn't render anything
  return null;
}
