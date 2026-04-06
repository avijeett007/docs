'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { usePartnerBranding } from '@/lib/partnerBranding';
import { useRouter, useSearchParams } from 'next/navigation';
import { PortalTheme, getThemeConfig } from '@/lib/portalThemes';
import Image from 'next/image';
import Link from 'next/link';

// Component that uses the search params
function ResetPasswordContent() {
  const { branding } = usePartnerBranding();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get('token');

  // Get theme config based on partner preference
  const theme = (branding.themePreference as PortalTheme) || PortalTheme.MODERN;
  const themeConfig = getThemeConfig(theme);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [isTokenChecked, setIsTokenChecked] = useState(false);

  // Verify token on page load
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setError('Reset token is missing');
        setIsTokenChecked(true);
        return;
      }

      try {
        // First try to verify as a customer token
        let response = await fetch('/api/whitelabel/auth/verify-reset-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });

        let data = await response.json();

        // If customer token verification fails, try team member token
        if (!response.ok) {
          console.log('Customer token verification failed, trying team member token');

          response = await fetch('/api/whitelabel/auth/verify-team-reset-token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token }),
          });

          data = await response.json();
        }

        if (response.ok && data.success) {
          setIsTokenValid(true);
          // Store if this is a team member token for later use
          if (data.data?.isTeamMember) {
            window.localStorage.setItem('isTeamMemberReset', 'true');
          } else {
            window.localStorage.removeItem('isTeamMemberReset');
          }
        } else {
          throw new Error(data.error || 'Invalid or expired token');
        }
      } catch (err) {
        console.error('Token verification failed:', err);
        setError(err instanceof Error ? err.message : 'Invalid or expired token');
      } finally {
        setIsTokenChecked(true);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    // Validate passwords
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      setIsLoading(false);
      return;
    }

    try {
      // Check if this is a team member reset or a customer reset
      const isTeamMemberReset = window.localStorage.getItem('isTeamMemberReset') === 'true';
      const endpoint = isTeamMemberReset
        ? '/api/whitelabel/auth/reset-team-password'
        : '/api/whitelabel/auth/reset-password';

      console.log(`Using ${isTeamMemberReset ? 'team member' : 'customer'} password reset endpoint`);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          // Use the appropriate parameter name based on the endpoint
          ...(isTeamMemberReset ? { password: newPassword } : { newPassword })
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      setSuccess('Password has been reset successfully. You will be redirected to the dashboard.');

      // Clear form
      setNewPassword('');
      setConfirmPassword('');

      // Clean up localStorage
      window.localStorage.removeItem('isTeamMemberReset');

      // Redirect to the appropriate page
      if (data.redirectUrl) {
        setTimeout(() => {
          router.push(data.redirectUrl);
        }, 3000);
      } else {
        // Default to login page if no redirect URL is provided
        setTimeout(() => {
          router.push('/whitelabel/login');
        }, 3000);
      }
    } catch (err) {
      console.error('Password reset failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state while checking token
  if (!isTokenChecked) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center ${themeConfig.styleClasses.container}`}>
        <div className="animate-spin h-12 w-12 border-t-2 border-b-2 rounded-full" style={{ borderColor: branding.primaryColor }}></div>
        <p className="mt-4 text-gray-400">Verifying reset token...</p>
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
            <h2 className="mt-4 text-2xl font-bold" style={{ color: branding.primaryColor }}>Reset Password</h2>
            <p className="text-gray-400 mt-1">Enter your new password</p>
          </div>

          <div className={`p-8 rounded-lg border border-gray-700 ${themeConfig.styleClasses.card}`}>
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-500">
                {success}
              </div>
            )}

            {isTokenValid ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-gray-300 mb-1">
                    New Password
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800"
                    style={{ borderColor: `${branding.primaryColor}40` }}
                    placeholder="••••••••"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Password must be at least 8 characters long
                  </p>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800"
                    style={{ borderColor: `${branding.primaryColor}40` }}
                    placeholder="••••••••"
                  />
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={isLoading || success !== ''}
                    className={`w-full px-4 py-3 rounded-lg font-medium text-white disabled:opacity-70 flex items-center justify-center ${themeConfig.styleClasses.button.primary}`}
                    style={{ backgroundColor: branding.primaryColor }}
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </>
                    ) : 'Reset Password'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center py-4">
                <p className="text-red-400 mb-4">
                  {error || 'Invalid or expired reset token'}
                </p>
                <Link
                  href="/whitelabel/forgot-password"
                  className="px-4 py-2 rounded-lg text-white"
                  style={{ backgroundColor: branding.primaryColor }}
                >
                  Request New Reset Link
                </Link>
              </div>
            )}

            <div className="mt-6 text-center">
              <Link href="/whitelabel/login" className="text-sm text-gray-400 hover:text-white">
                Back to Login
              </Link>
            </div>
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
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
