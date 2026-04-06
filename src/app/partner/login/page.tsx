'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FiShield } from 'react-icons/fi';
import Logo from '@/components/Logo';
import NeonContainer from '@/components/NeonContainer';
import MFAVerificationModal from '@/components/mfa/MFAVerificationModal';
import PasskeyAuthButton from '@/components/passkey/PasskeyAuthButton';
import PasskeyDevNotice from '@/components/passkey/PasskeyDevNotice';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import { logger } from '@/lib/logger';
import { checkPasskeySupport } from '@/lib/passkey-client';
import { obfuscateEmail } from '@/lib/pii-obfuscation';
import content from '@/config/partner/content.json';

function PartnerLoginContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetStatus, setResetStatus] = useState<{ message?: string; error?: string } | null>(null);
  const [isResetLoading, setIsResetLoading] = useState(false);

  // MFA states
  const [showMFAVerification, setShowMFAVerification] = useState(false);
  const [mfaPartnerId, setMfaPartnerId] = useState('');
  const [mfaAuthProvider, setMfaAuthProvider] = useState<'password' | 'passkey' | 'google'>('password');

  // Passkey states
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [showPasskeyOption, setShowPasskeyOption] = useState(false);
  const [showPasskeyOnlyMode, setShowPasskeyOnlyMode] = useState(false);

  // Google auth state
  const [isGoogleAuthEnabled, setIsGoogleAuthEnabled] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const resolvedSearchParams = useMemo(
    () => searchParams ?? new URLSearchParams(),
    [searchParams]
  );
  const { title, subtitle, emailPlaceholder, passwordPlaceholder, buttonText, loadingText } = content.login;

  useEffect(() => {
    // Check passkey support on component mount
    checkPasskeySupport().then(support => {
      setPasskeySupported(support.isSupported);
    });
  }, []);

  useEffect(() => {
    // Check if Google auth is enabled
    setIsGoogleAuthEnabled(process.env.NEXT_PUBLIC_FEATURE_GOOGLE_AUTH === 'true');
  }, []);

  const checkPasskeyAvailability = useCallback(async () => {
    if (!email || !email.includes('@')) {
      setShowPasskeyOption(false);
      return;
    }

    try {
      const response = await fetch('/api/partner/auth/passkey/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        const data = await response.json();
        setShowPasskeyOption(data.hasPasskeys && data.isActive);
      } else {
        setShowPasskeyOption(false);
      }
    } catch (error) {
      logger.error('Partner login passkey availability check failed', error instanceof Error ? error : undefined, {
        email: obfuscateEmail(email),
        operation: 'partner_login_passkey_availability',
      });
      setShowPasskeyOption(false);
    }
  }, [email]);

  useEffect(() => {
    // Check if passkey is available for the entered email
    if (email && passkeySupported) {
      checkPasskeyAvailability();
    } else {
      setShowPasskeyOption(false);
    }
  }, [checkPasskeyAvailability, email, passkeySupported]);

  useEffect(() => {
    const requiresMFA = resolvedSearchParams.get('mfa_required');
    const partnerIdParam = resolvedSearchParams.get('partnerId');
    const emailParam = resolvedSearchParams.get('email');
    const authProviderParam = resolvedSearchParams.get('auth_provider');

    if (requiresMFA === 'true' && partnerIdParam) {
      if (emailParam) {
        setEmail(emailParam);
      }

      if (authProviderParam === 'google') {
        setMfaAuthProvider('google');
      }

      setMfaPartnerId(partnerIdParam);
      setShowMFAVerification(true);

      const nextParams = new URLSearchParams(resolvedSearchParams.toString());
      nextParams.delete('mfa_required');
      nextParams.delete('partnerId');
      nextParams.delete('email');
      nextParams.delete('auth_provider');

      router.replace(nextParams.toString() ? `/partner/login?${nextParams.toString()}` : '/partner/login');
    }
  }, [resolvedSearchParams, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // First try regular partner login
      let response = await fetch('/api/partner/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      // If regular login fails with 401, try team member login
      if (response.status === 401) {
        logger.info('Partner login falling back to team member login', {
          email: obfuscateEmail(email),
          operation: 'partner_login_team_member_fallback',
        });
        response = await fetch('/api/partner/auth/team-login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        });
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to login');
      }

      // Check if MFA is required
      if (data.requiresMFA) {
        setMfaAuthProvider('password');
        setMfaPartnerId(data.partnerId);
        setShowMFAVerification(true);
        return;
      }

      // Store partner name and token in localStorage
      if (data.name) {
        localStorage.setItem('partner_name', data.name);
      }
      if (data.partnerName) {
        localStorage.setItem('partner_business_name', data.partnerName);
      }
      if (data.token) {
        localStorage.setItem('partner_token', data.token);
      }
      if (data.isTeamMember) {
        localStorage.setItem('is_team_member', 'true');
        localStorage.setItem('team_member_role', data.role || 'member');
      }
      // Store partner email for customer mapping checks
      localStorage.setItem('partner_email', email);

      // Store first-time login status for welcome video
      if (data.isFirstTimeLogin !== undefined) {
        localStorage.setItem('is_first_time_login', data.isFirstTimeLogin.toString());
      }

      // Store walkthrough status
      if (data.shouldStartWalkthrough !== undefined) {
        localStorage.setItem('should_start_walkthrough', data.shouldStartWalkthrough.toString());
      }

      // Check if password change is required
      if (data.requirePasswordChange) {
        router.push('/partner/change-password');
      } else {
        router.push('/partner/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetStatus(null);
    setIsResetLoading(true);

    try {
      const response = await fetch('/api/partner/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: resetEmail }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      setResetStatus({ message: data.message || 'Password reset email sent successfully' });
      // Auto-close the modal after 3 seconds on success
      setTimeout(() => {
        setShowResetModal(false);
        setResetStatus(null);
      }, 3000);
    } catch (err: any) {
      setResetStatus({ error: err.message || 'Failed to reset password' });
    } finally {
      setIsResetLoading(false);
    }
  };

  const handleMFASuccess = (token: string, data: any) => {
    // Store partner data
    if (data.name) {
      localStorage.setItem('partner_name', data.name);
    }
    localStorage.setItem('partner_token', token);
    localStorage.setItem('partner_email', email);

    // Store first-time login status for welcome video
    if (data.isFirstTimeLogin !== undefined) {
      localStorage.setItem('is_first_time_login', data.isFirstTimeLogin.toString());
    }

    // Store walkthrough status
    if (data.shouldStartWalkthrough !== undefined) {
      localStorage.setItem('should_start_walkthrough', data.shouldStartWalkthrough.toString());
    }

    setShowMFAVerification(false);

    // Check if password change is required
    if (data.requirePasswordChange && mfaAuthProvider !== 'google') {
      router.push('/partner/change-password');
    } else {
      router.push('/partner/dashboard');
    }
  };

  const handleMFACancel = () => {
    setShowMFAVerification(false);
    setMfaPartnerId('');
    setMfaAuthProvider('password');
  };

  const handlePasskeySuccess = (result: any) => {
    if (result.requiresMFA) {
      setMfaAuthProvider('passkey');
      setMfaPartnerId(result.partnerId);
      setShowMFAVerification(true);
      return;
    }

    if (result.name || result.user?.name) {
      localStorage.setItem('partner_name', result.name || result.user.name);
    }
    if (result.token) {
      localStorage.setItem('partner_token', result.token);
    }
    localStorage.setItem('partner_email', email);

    // Store first-time login status for welcome video
    if (result.isFirstTimeLogin !== undefined) {
      localStorage.setItem('is_first_time_login', result.isFirstTimeLogin.toString());
    }

    // Store walkthrough status
    if (result.shouldStartWalkthrough !== undefined) {
      localStorage.setItem('should_start_walkthrough', result.shouldStartWalkthrough.toString());
    }

    // Redirect based on requirements
    if (result.redirectUrl) {
      router.push(result.redirectUrl);
    } else {
      router.push('/partner/dashboard');
    }
  };

  const handlePasskeyError = (error: string) => {
    setError(error);
  };

  const handleGoogleAuthError = (error: string) => {
    setError(error);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex flex-col items-center justify-center p-4">
      <PasskeyDevNotice />
      <NeonContainer className="w-full max-w-md space-y-8 p-8">
        <div className="flex flex-col items-center">
          <Logo />
          <h2 className="mt-6 text-3xl font-bold">{title}</h2>
          <p className="mt-2 text-gray-400">{subtitle}</p>
        </div>

        {/* Passkey-only mode */}
        {showPasskeyOnlyMode ? (
          <div className="mt-8 space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="text-center">
              <div className="mb-4">
                <div className="w-16 h-16 mx-auto bg-blue-500/20 rounded-full flex items-center justify-center mb-4">
                  <FiShield className="w-8 h-8 text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Login with Passkey</h3>
                <p className="text-gray-400 text-sm">Use your fingerprint, face, or device PIN to sign in securely</p>
              </div>

              <div className="space-y-4">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-gray-800/50 border border-blue-400/20 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white placeholder-gray-400"
                  placeholder="Enter your email"
                />

                {showPasskeyOption && (
                  <PasskeyAuthButton
                    email={email}
                    onSuccess={handlePasskeySuccess}
                    onError={handlePasskeyError}
                    disabled={isLoading}
                    variant="primary"
                    className="w-full"
                  />
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowPasskeyOnlyMode(false)}
                className="mt-4 text-blue-400 hover:text-blue-300 text-sm"
              >
                ← Back to password login
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-gray-800/50 border border-blue-400/20 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white placeholder-gray-400"
                  placeholder={emailPlaceholder}
                />
              </div>

              <div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-gray-800/50 border border-blue-400/20 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white placeholder-gray-400"
                  placeholder={passwordPlaceholder}
                />
              </div>
            </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full px-6 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-teal-500 text-white font-semibold hover:from-blue-600 hover:to-teal-600 transition-all duration-300 transform hover:scale-105 ${
              isLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isLoading ? loadingText : buttonText}
          </button>

          {/* Google Sign-in Option */}
          {isGoogleAuthEnabled && (
            <div className="mt-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-600"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-gray-900 text-gray-400">or</span>
                </div>
              </div>

              <div className="mt-4">
                <GoogleSignInButton
                  isSignup={false}
                  returnTo="/partner/dashboard"
                  disabled={isLoading}
                  variant="secondary"
                  onError={handleGoogleAuthError}
                  className="w-full"
                />
              </div>
            </div>
          )}

          {/* Passkey Authentication Option */}
          {showPasskeyOption && (
            <div className="mt-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-600"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-gray-900 text-gray-400">or</span>
                </div>
              </div>

              <div className="mt-4">
                <PasskeyAuthButton
                  email={email}
                  onSuccess={handlePasskeySuccess}
                  onError={handlePasskeyError}
                  disabled={isLoading}
                  variant="secondary"
                  className="w-full"
                />
              </div>
            </div>
          )}

          {/* Alternative: Login with Passkey button */}
          {passkeySupported && !showPasskeyOption && (
            <div className="mt-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-600"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-gray-900 text-gray-400">or</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowPasskeyOnlyMode(true)}
                className="mt-4 w-full px-4 py-3 rounded-lg bg-gray-800/50 border border-gray-600 text-gray-300 hover:bg-gray-700/50 hover:border-gray-500 transition-all duration-200 flex items-center justify-center gap-2"
              >
                <FiShield className="w-4 h-4" />
                Login with Passkey
              </button>
            </div>
          )}

          <div className="text-center mt-4">
            <button
              type="button"
              onClick={() => {
                setShowResetModal(true);
                setResetEmail(email); // Pre-fill with login email if available
              }}
              className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
            >
              Forgot password?
            </button>
          </div>
        </form>
        )}
      </NeonContainer>

      {/* Reset Password Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-blue-500/20 rounded-lg w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-white mb-4">Reset Password</h3>
            <p className="text-gray-400 mb-4">
              Enter your partner email address. If your account is active, we'll send you a temporary password.
            </p>

            <form onSubmit={handleResetPassword}>
              {resetStatus?.error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-4">
                  {resetStatus.error}
                </div>
              )}

              {resetStatus?.message && (
                <div className="bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-3 rounded-lg mb-4">
                  {resetStatus.message}
                </div>
              )}

              <div className="mb-4">
                <input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-gray-800/50 border border-blue-400/20 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white placeholder-gray-400"
                  placeholder="Enter your partner email"
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetModal(false);
                    setResetStatus(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResetLoading}
                  className={`px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-teal-500 text-white font-semibold hover:from-blue-600 hover:to-teal-600 transition-all duration-300 ${
                    isResetLoading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isResetLoading ? 'Processing...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MFA Verification Modal */}
      <MFAVerificationModal
        isOpen={showMFAVerification}
        partnerId={mfaPartnerId}
        onSuccess={handleMFASuccess}
        onCancel={handleMFACancel}
      />
    </div>
  );
}

export default function PartnerLogin() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8 p-8 text-center text-gray-400">
          Loading...
        </div>
      </div>
    }>
      <PartnerLoginContent />
    </Suspense>
  );
}
