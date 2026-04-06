'use client';

import React, { useState, useEffect } from 'react';
import { usePartnerBranding } from '@/lib/partnerBranding';
import { useRouter } from 'next/navigation';
import { PortalTheme, getThemeConfig } from '@/lib/portalThemes';
import Image from 'next/image';

export default function ChangePasswordPage() {
  const { branding } = usePartnerBranding();
  const router = useRouter();

  // Get theme config based on partner preference
  const theme = (branding.themePreference as PortalTheme) || PortalTheme.MODERN;
  const themeConfig = getThemeConfig(theme);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const [isFromMagicLinkReset, setIsFromMagicLinkReset] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    // Check if this is the first login or magic link reset
    const checkAuthStatus = async () => {
      try {
        const response = await fetch('/api/whitelabel/auth/me');
        if (response.ok) {
          const data = await response.json();
          setIsFirstLogin(data.isFirstLogin || false);
          setIsFromMagicLinkReset(data.isFromMagicLinkReset || false);
        }
      } catch (err) {
        console.error('Error checking auth status:', err);
      }
    };

    checkAuthStatus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    // Validate passwords
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      setIsLoading(false);
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/whitelabel/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          isFirstLogin,
          isFromMagicLinkReset
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to change password');
      }

      // Use the response data to determine the success message and redirect
      const redirectUrl = data.redirectUrl || '/whitelabel/dashboard';

      if (data.isFirstLogin || isFirstLogin || isFromMagicLinkReset) {
        setSuccess('Password set successfully! You are now logged in.');
      } else {
        setSuccess('Password changed successfully!');
      }

      // Clear form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // Start countdown and redirect
      setCountdown(3);
      const countdownInterval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            router.push(redirectUrl);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Password change failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

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
              {isFirstLogin || isFromMagicLinkReset ? 'Set Your Password' : 'Change Your Password'}
            </h2>
            <p className="text-gray-400 mt-1">
              {isFirstLogin
                ? 'Please set a new password for your account'
                : isFromMagicLinkReset
                ? 'Please set a new password for your account'
                : 'Update your account password'}
            </p>
          </div>

          <div className={`p-8 rounded-lg border border-gray-700 ${themeConfig.styleClasses.card}`}>
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-500">
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <div>{success}</div>
                    {countdown > 0 && (
                      <div className="text-sm mt-1 text-green-400">
                        Redirecting to dashboard in {countdown} second{countdown !== 1 ? 's' : ''}...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {!isFirstLogin && !isFromMagicLinkReset && (
                <div>
                  <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-300 mb-1">
                    Current Password
                  </label>
                  <input
                    id="currentPassword"
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800"
                    style={{ borderColor: `${branding.primaryColor}40` }}
                    placeholder="••••••••"
                  />
                </div>
              )}

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
                  disabled={isLoading}
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
                  ) : (
                    isFirstLogin || isFromMagicLinkReset ? 'Set Password' : 'Change Password'
                  )}
                </button>
              </div>
            </form>

            {/* Navigation options */}
            <div className="mt-6 text-center space-y-3">
              {!isFirstLogin && !isFromMagicLinkReset ? (
                <button
                  onClick={() => router.push('/whitelabel/dashboard')}
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Back to Dashboard
                </button>
              ) : (
                <div className="space-y-2">
                  {!success && (
                    <button
                      onClick={() => router.push('/whitelabel/login')}
                      className="text-sm text-gray-400 hover:text-white transition-colors"
                    >
                      ← Back to Login
                    </button>
                  )}
                  {success && countdown > 0 && (
                    <div className="space-y-2">
                      <div className="text-sm text-gray-400">
                        Redirecting to your dashboard in {countdown} second{countdown !== 1 ? 's' : ''}...
                      </div>
                      <button
                        onClick={() => router.push('/whitelabel/dashboard')}
                        className="text-sm text-blue-400 hover:text-blue-300 transition-colors underline"
                      >
                        Go to Dashboard Now
                      </button>
                    </div>
                  )}
                  {success && countdown === 0 && (
                    <div className="text-sm text-gray-400">
                      Redirecting now...
                    </div>
                  )}
                </div>
              )}
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
