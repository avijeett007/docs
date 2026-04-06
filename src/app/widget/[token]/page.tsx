'use client';

import React, { useState, useEffect } from 'react';
import { WidgetFactory } from '@/components/widgets';
import { WidgetConfig } from '@/providers/types';
import WidgetErrorBoundary from '@/components/widgets/WidgetErrorBoundary';

interface WidgetPageProps {
  params: {
    token: string;
  };
}

export default function WidgetPage({ params }: WidgetPageProps) {
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [testCredentials, setTestCredentials] = useState<{
    publicKey?: string;
    accessToken?: string;
  }>({});

  // Prevent hydration issues
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const loadWidgetConfig = async () => {
      try {
        // Get origin safely to avoid hydration issues
        let origin = '';
        try {
          origin = window.parent?.location?.origin || window.location.origin;
        } catch (e) {
          // Cross-origin access blocked, use current origin
          origin = window.location.origin;
        }

        console.log('[Widget] Loading config for token:', params.token, 'origin:', origin);

        const response = await fetch('/api/public/widget-config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token: params.token,
            origin: origin
          }),
        });

        console.log('[Widget] Response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Widget] API error:', response.status, errorText);
          throw new Error(`API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('[Widget] Response data:', data);

        if (data.success) {
          setConfig(data.config);
          console.log('[Widget] Config loaded successfully:', data.config);
          // Note: Credentials will be fetched when user initiates a call
        } else {
          console.error('[Widget] Config error:', data.error);
          // Don't set error in production - just log it
          if (process.env.NODE_ENV === 'development') {
            setError(data.error || 'Failed to load widget configuration');
          }
        }
      } catch (err) {
        console.error('[Widget] Error loading widget config:', err);
        // Don't show errors to end users in production
        if (process.env.NODE_ENV === 'development') {
          setError(`Failed to load widget configuration: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      } finally {
        setLoading(false);
      }
    };

    if (params.token) {
      loadWidgetConfig();
    }
  }, [params.token]);

  const fetchCallCredentials = async () => {
    // Get origin safely
    let origin = '';
    try {
      origin = window.parent?.location?.origin || window.location.origin;
    } catch (e) {
      origin = window.location.origin;
    }

    console.log('[Widget] Fetching call credentials...');

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_WIDGET_APP_URL || ''}/api/public/widget-call-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: params.token,
          origin,
          referer: document.referrer
        }),
      });

      const data = await response.json();

      if (data.success) {
        console.log('[Widget] Call credentials received:', {
          publicKey: data.credentials.publicKey ? 'present' : 'missing',
          accessToken: data.credentials.accessToken ? 'present' : 'missing'
        });

        setTestCredentials({
          publicKey: data.credentials.publicKey,
          accessToken: data.credentials.accessToken
        });

        return data.credentials;
      } else {
        throw new Error(data.error || 'Failed to get call credentials');
      }
    } catch (error) {
      console.error('[Widget] Error fetching call credentials:', error);
      throw error;
    }
  };

  // Pre-fetch credentials when widget loads for instant call start
  useEffect(() => {
    if (config && !testCredentials.accessToken && !testCredentials.publicKey) {
      console.log('[Widget] Pre-fetching credentials for instant call start...');
      fetchCallCredentials().catch(error => {
        console.warn('[Widget] Failed to pre-fetch credentials:', error);
        // Don't show error to user, credentials will be fetched on demand
      });
    }
  }, [config]);

  const handleAnalyticsEvent = async (eventType: string, data?: any) => {
    try {
      await fetch('/api/public/widget-analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: params.token,
          eventType,
          data: {
            ...data,
            origin: window.parent?.location?.origin || window.location.origin,
            timestamp: Date.now()
          }
        }),
      });
    } catch (error) {
      console.warn('Failed to track analytics event:', error);
    }
  };

  const handleError = (error: string) => {
    console.error('Widget error:', error);
    // Only track analytics, don't show errors to users in production
    handleAnalyticsEvent('error', { error });

    // In development, you might want to show errors
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Widget] Error in development mode:', error);
    }
  };

  const handleCallStart = () => {
    handleAnalyticsEvent('call_start');
  };

  const handleCallEnd = () => {
    handleAnalyticsEvent('call_end');
  };

  // Prevent hydration issues by not rendering until mounted
  if (!mounted) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ minHeight: '200px' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Initializing...</p>
        </div>
      </div>
    );
  }

  // Don't show anything while loading - just wait until ready
  if (loading || !config) {
    return null;
  }

  // Error state - only show in development
  if (error && process.env.NODE_ENV === 'development') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-6 max-w-md">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Widget Error</h3>
          <p className="text-gray-600 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // This case is now handled above with loading

  return (
    <WidgetErrorBoundary>
      <div style={{
        backgroundColor: 'transparent', // Don't override parent background
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <WidgetFactory
          config={config}
          onError={handleError}
          onCallStart={handleCallStart}
          onCallEnd={handleCallEnd}
          onAnalyticsEvent={handleAnalyticsEvent}
          previewMode={false} // Always use real mode, credentials fetched on demand
          publicKey={testCredentials.publicKey}
          accessToken={testCredentials.accessToken}
          fetchCredentials={fetchCallCredentials}
        />
      </div>
    </WidgetErrorBoundary>
  );
}
