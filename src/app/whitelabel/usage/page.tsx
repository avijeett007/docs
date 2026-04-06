'use client';

import React from 'react';
import WhitelabelLayout from '@/components/whitelabel/WhitelabelLayout';
import WhitelabelAdvancedAnalytics from '@/components/whitelabel/WhitelabelAdvancedAnalytics';
import { usePartnerBranding } from '@/lib/partnerBranding';
import { FiBarChart2 } from 'react-icons/fi';

export default function WhiteLabelUsagePage() {
  const { branding } = usePartnerBranding();

  return (
    <WhitelabelLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2" style={{ color: branding.primaryColor }}>Analytics & Usage</h1>
        <p className="text-gray-400">View detailed analytics and usage statistics for your AI voice agents.</p>
      </div>

      <div className="bg-gray-800/30 rounded-lg p-6 mb-6">
        <div className="flex items-center mb-6">
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center mr-3"
            style={{ backgroundColor: `${branding.primaryColor}20` }}
          >
            <FiBarChart2 style={{ color: branding.primaryColor }} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Advanced Analytics</h2>
            <p className="text-gray-400 text-sm">Gain insights from your AI voice agent conversations</p>
          </div>
        </div>

        <WhitelabelAdvancedAnalytics />
      </div>
    </WhitelabelLayout>
  );
}
