'use client';

import React from 'react';
import WhitelabelLayout from '@/components/whitelabel/WhitelabelLayout';
import DetailedUsage from '@/components/whitelabel/DetailedUsage';
import EnhancedAnalyticsServiceDetailedUsage from '@/components/whitelabel/EnhancedAnalyticsServiceDetailedUsage';

// Check if we should use analytics service
const USE_ANALYTICS_SERVICE = process.env.NEXT_PUBLIC_USE_ANALYTICS_SERVICE_WHITELABEL_AI_USAGE === 'true';

export default function WhiteLabelAIUsagePage() {
  return (
    <WhitelabelLayout>
      {USE_ANALYTICS_SERVICE ? (
        <EnhancedAnalyticsServiceDetailedUsage />
      ) : (
        <DetailedUsage />
      )}
    </WhitelabelLayout>
  );
}
