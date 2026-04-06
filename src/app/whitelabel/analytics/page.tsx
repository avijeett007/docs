'use client';

import React, { useState, useEffect } from 'react';
import WhitelabelLayout from '@/components/whitelabel/WhitelabelLayout';
import WhitelabelAdvancedAnalytics from '@/components/whitelabel/WhitelabelAdvancedAnalytics';

export default function AnalyticsPage() {
  const [customerId, setCustomerId] = useState<string | undefined>(undefined);

  // Fetch customer info on page load
  useEffect(() => {
    const fetchCustomerInfo = async () => {
      try {
        const response = await fetch('/api/whitelabel/auth/me');

        if (response.ok) {
          const data = await response.json();
          setCustomerId(data.customer?.id);
        }
      } catch (error) {
        console.error('Error fetching customer info:', error);
      }
    };

    fetchCustomerInfo();
  }, []);

  return (
    <WhitelabelLayout>
      <WhitelabelAdvancedAnalytics customerId={customerId} />
    </WhitelabelLayout>
  );
}
