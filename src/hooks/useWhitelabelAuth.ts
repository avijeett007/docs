'use client';

import { useState, useEffect } from 'react';

interface WhitelabelAuthData {
  customerId: string | null;
  partnerId: string | null;
  isLoading: boolean;
  error: string | null;
}

export function useWhitelabelAuth(): WhitelabelAuthData {
  const [authData, setAuthData] = useState<WhitelabelAuthData>({
    customerId: null,
    partnerId: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const fetchAuthData = async () => {
      try {
        const response = await fetch('/api/whitelabel/auth/me');
        
        if (!response.ok) {
          throw new Error('Failed to get authentication data');
        }

        const data = await response.json();
        
        setAuthData({
          customerId: data.customerId || null,
          partnerId: data.partnerId || null,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        console.error('Error fetching auth data:', error);
        setAuthData({
          customerId: null,
          partnerId: null,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    };

    fetchAuthData();
  }, []);

  return authData;
}
