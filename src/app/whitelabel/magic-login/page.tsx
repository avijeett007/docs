'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { usePartnerBranding } from '@/lib/partnerBranding';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { PortalTheme, getThemeConfig } from '@/lib/portalThemes';

// Component that uses the search params
function MagicLoginContent() {
  const { branding, loading: brandingLoading } = usePartnerBranding();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get('token');

  // Get theme config based on partner preference
  const theme = (branding.themePreference as PortalTheme) || PortalTheme.MODERN;
  const themeConfig = getThemeConfig(theme);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Invalid magic link - no token provided');
      setIsLoading(false);
      return;
    }

    // Automatically verify the magic link when component mounts
    verifyMagicLink();
  }, [token]);

  const verifyMagicLink = async () => {
    try {
      setIsLoading(true);
      setError('');

      const response = await fetch('/api/whitelabel/auth/verify-magic-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Magic link verification failed');
      }

      setSuccess('Successfully signed in! Redirecting...');
      
      // Redirect based on the magic link type
      setTimeout(() => {
        router.push(data.redirectUrl || '/whitelabel/dashboard');
      }, 2000);

    } catch (err) {
      console.error('Magic link verification failed:', err);
      setError(err instanceof Error ? err.message : 'Magic link verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading modal while branding is loading
  if (brandingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col ${themeConfig.styleClasses.container}`}>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            {branding.logo ? (
              <Image
                src={branding.logo}
                alt={branding.businessName}
                width={64}
                height={64}
                className="mx-auto rounded-lg"
              />
            ) : (
              <div
                className="w-16 h-16 rounded-lg flex items-center justify-center text-white font-bold text-2xl mx-auto"
                style={{ background: `linear-gradient(to right, ${branding.primaryColor}, ${branding.secondaryColor})` }}
              >
                {branding.businessName.substring(0, 1)}
              </div>
            )}
            <h2 className="mt-4 text-2xl font-bold" style={{ color: branding.primaryColor }}>
              {branding.portalTitle || `${branding.businessName} Portal`}
            </h2>
            <p className="text-gray-400 mt-1">Magic Link Sign In</p>
          </div>

          <div className={`p-8 rounded-lg border border-gray-700 ${themeConfig.styleClasses.card}`}>
            {isLoading && (
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 mx-auto mb-4" style={{ borderColor: branding.primaryColor }}></div>
                <p className="text-gray-300">Verifying your magic link...</p>
              </div>
            )}

            {error && (
              <div className="text-center">
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500">
                  <h3 className="font-semibold mb-2">Magic Link Error</h3>
                  <p>{error}</p>
                </div>
                <div className="space-y-3">
                  <button
                    onClick={() => router.push('/whitelabel/login')}
                    className={`w-full px-4 py-3 rounded-lg font-medium text-white ${themeConfig.styleClasses.button.primary}`}
                    style={{ backgroundColor: branding.primaryColor }}
                  >
                    Back to Login
                  </button>
                  <button
                    onClick={() => router.push('/whitelabel/forgot-password')}
                    className="w-full px-4 py-3 rounded-lg font-medium text-gray-300 border border-gray-600 hover:bg-gray-700"
                  >
                    Request New Magic Link
                  </button>
                </div>
              </div>
            )}

            {success && (
              <div className="text-center">
                <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-500">
                  <div className="flex items-center justify-center mb-2">
                    <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <h3 className="font-semibold">Success!</h3>
                  </div>
                  <p>{success}</p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 text-center text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} {branding.businessName}. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
}

// Main page component with Suspense boundary
export default function MagicLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    }>
      <MagicLoginContent />
    </Suspense>
  );
}
