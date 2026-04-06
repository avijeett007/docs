'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { usePartnerBranding } from '@/lib/partnerBranding';
import { useRouter, useSearchParams } from 'next/navigation';
import { PortalTheme, getThemeConfig } from '@/lib/portalThemes';
import Image from 'next/image';

function VerifyEmailContent() {
  const { branding, loading: brandingLoading } = usePartnerBranding();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get('token');

  // Get theme config based on partner preference
  const theme = (branding.themePreference as PortalTheme) || PortalTheme.MODERN;
  const themeConfig = getThemeConfig(theme);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    if (token && !isVerified && !isLoading) {
      verifyEmail();
    }
  }, [token, isVerified, isLoading]);

  const verifyEmail = async () => {
    if (!token) {
      setError('Invalid verification link. Please check your email for the correct link.');
      return;
    }

    try {
      setIsLoading(true);
      setError('');

      const response = await fetch('/api/whitelabel/auth/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Email verification failed');
      }

      setSuccess('Email verified successfully! You can now sign in to your account.');
      setIsVerified(true);

      // Redirect to login after 3 seconds
      // Use relative URL - middleware will handle the correct routing based on ENABLE_PLATFORM_URLS
      setTimeout(() => {
        router.push('/login');
      }, 3000);

    } catch (err) {
      console.error('Email verification failed:', err);
      setError(err instanceof Error ? err.message : 'Email verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (brandingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
              Email Verification
            </h2>
            <p className="text-gray-400 mt-1">{branding.portalTitle || `${branding.businessName} Portal`}</p>
          </div>

          <div className={`p-8 rounded-lg border border-gray-700 ${themeConfig.styleClasses.card}`}>
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500">
                <h3 className="font-semibold mb-2">Verification Failed</h3>
                <p>{error}</p>
                <div className="mt-4">
                  <button
                    onClick={() => router.push('/whitelabel/login')}
                    className="text-sm underline hover:no-underline"
                  >
                    Go to Login
                  </button>
                </div>
              </div>
            )}

            {success && (
              <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-500">
                <h3 className="font-semibold mb-2">Email Verified!</h3>
                <p>{success}</p>
                <p className="text-sm mt-2">Redirecting to login page...</p>
              </div>
            )}

            {isLoading && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-400">Verifying your email address...</p>
              </div>
            )}

            {!token && !isLoading && (
              <div className="text-center py-8">
                <p className="text-gray-400 mb-4">Invalid verification link.</p>
                <button
                  onClick={() => router.push('/whitelabel/login')}
                  className={`px-6 py-2 rounded-lg font-medium text-white ${themeConfig.styleClasses.button.primary}`}
                  style={{ backgroundColor: branding.primaryColor }}
                >
                  Go to Login
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
