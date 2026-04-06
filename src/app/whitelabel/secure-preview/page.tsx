'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SecurePreviewPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'waiting' | 'processing' | 'success' | 'error'>('waiting');
  const [error, setError] = useState<string>('');

  const processToken = async (token: string) => {
    setStatus('processing');

    try {
      if (!token) {
        throw new Error('No impersonation token provided');
      }

      // Process the impersonation token securely
      console.log('Calling impersonation API...');
      const response = await fetch('/api/whitelabel/impersonate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
        credentials: 'include'
      });

      console.log('API response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.log('API error:', errorData);
        throw new Error(errorData.error || 'Failed to process impersonation token');
      }

      const data = await response.json();

      if (data.success) {
        setStatus('success');

        // Clear any traces from browser history
        window.history.replaceState({}, '', '/whitelabel/dashboard');

        // Redirect to dashboard after a brief delay
        setTimeout(() => {
          router.push('/whitelabel/dashboard');
        }, 1000);
      } else {
        throw new Error(data.error || 'Impersonation failed');
      }

    } catch (err: any) {
      console.error('Token processing error:', err);
      setError(err.message || 'An unexpected error occurred');
      setStatus('error');
    }
  };

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    // Check if token is in URL parameters as fallback
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');

    console.log('Secure preview page loaded:', {
      url: window.location.href,
      hasUrlToken: !!urlToken,
      hostname: window.location.hostname,
      port: window.location.port
    });

    if (urlToken) {
      console.log('Processing URL token');
      processToken(urlToken);
      return;
    }

    // Check if token is in localStorage (fallback for cross-domain issues)
    const storageToken = localStorage.getItem('impersonation_token');
    if (storageToken) {
      console.log('Processing localStorage token');
      localStorage.removeItem('impersonation_token'); // Clean up immediately
      processToken(storageToken);
      return;
    }

    const handleMessage = async (event: MessageEvent) => {
      // Verify origin for security
      const isDevelopment = typeof window !== 'undefined' &&
        (window.location.hostname.includes('lvh.me') ||
         window.location.hostname === 'localhost' ||
         window.location.hostname === '127.0.0.1' ||
         window.location.port === '3000');

      const allowedOrigins = [];

      if (isDevelopment) {
        // Development origins - be more permissive for lvh.me subdomains
        allowedOrigins.push(
          'http://localhost:3000',
          'http://127.0.0.1:3000',
          'http://lvh.me:3000'
        );

        // Allow any lvh.me subdomain in development
        const isLvhMeDomain = event.origin.match(/^http:\/\/[^.]*\.?lvh\.me:3000$/);
        if (isLvhMeDomain) {
          allowedOrigins.push(event.origin);
        }
      } else {
        // Production origins
        allowedOrigins.push(
          'https://knotie-ai.pro'
        );

        // Add dynamic partner domains for production
        if (event.origin.includes('.knotie-ai.pro') ||
            (event.origin.startsWith('https://') && !event.origin.includes('knotie-ai.pro'))) {
          // Allow partner custom domains and subdomains
          allowedOrigins.push(event.origin);
        }
      }

      const isOriginAllowed = allowedOrigins.includes(event.origin) ||
        (isDevelopment && event.origin.match(/^http:\/\/[^.]*\.?lvh\.me:3000$/));

      if (!isOriginAllowed) {
        console.warn('Received message from unauthorized origin:', event.origin);
        return;
      }

      if (event.data.type === 'IMPERSONATION_TOKEN') {
        const { token } = event.data;
        await processToken(token);
      }
    };

    // Listen for postMessage from parent window
    window.addEventListener('message', handleMessage);

    // Set timeout for waiting too long
    timeoutId = setTimeout(() => {
      if (status === 'waiting') {
        setError('Timeout waiting for secure authentication');
        setStatus('error');
      }
    }, 10000);

    return () => {
      window.removeEventListener('message', handleMessage);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [router, status]);

  if (status === 'waiting') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Establishing Secure Connection...
          </h2>
          <p className="text-gray-600">
            Please wait while we securely authenticate your preview session.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'processing') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-pulse rounded-full h-12 w-12 bg-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Authenticating...
          </h2>
          <p className="text-gray-600">
            Processing secure authentication credentials.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="rounded-full h-12 w-12 bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Authentication Successful
          </h2>
          <p className="text-gray-600 mb-4">
            Redirecting to customer dashboard...
          </p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto">
          <div className="rounded-full h-12 w-12 bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Authentication Failed
          </h2>
          <p className="text-gray-600 mb-4">
            {error}
          </p>
          <button
            onClick={() => window.close()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Close Window
          </button>
        </div>
      </div>
    );
  }

  return null;
}
