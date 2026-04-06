'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { usePartnerBranding } from '@/lib/partnerBranding';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { PortalTheme, getThemeConfig } from '@/lib/portalThemes';
import PasskeyAuthButton from '@/components/passkey/PasskeyAuthButton';
import PasskeyDevNotice from '@/components/passkey/PasskeyDevNotice';
import { checkPasskeySupport } from '@/lib/passkey-client';
import { WhitelabelThemeToggle } from '@/components/whitelabel/WhitelabelThemeToggle';
import { loadLanguageDataWithLocale, getTranslatedText, type LanguageData, type SupportedLanguage } from '@/lib/languages';

// Component that uses the search params
function LoginContent() {
  const { branding, loading: brandingLoading } = usePartnerBranding();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Where to go after successful login (defaults to /platform — the main customer portal)
  const redirectUrl = searchParams?.get('redirect') || '/platform';
  // Where the back button should return (the page the user came from)
  const fromUrl = searchParams?.get('from') || '/';

  // Light/Dark mode state
  const [isLightMode, setIsLightMode] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>('en');
  const [languageData, setLanguageData] = useState<LanguageData | null>(null);
  const [languageLoaded, setLanguageLoaded] = useState(false);

  // Get theme config based on partner preference and light mode
  const theme = (branding.themePreference as PortalTheme) || PortalTheme.MODERN;
  const themeConfig = getThemeConfig(theme, isLightMode);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMagicLinkLoading, setIsMagicLinkLoading] = useState(false);
  const [error, setError] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  // Passkey states
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [showPasskeyOption, setShowPasskeyOption] = useState(false);

  useEffect(() => {
    // Check passkey support on component mount
    checkPasskeySupport().then(support => {
      setPasskeySupported(support.isSupported);
    });

    // Load theme preference from localStorage
    const savedTheme = localStorage.getItem('whitelabel-theme-mode');
    if (savedTheme === 'light') {
      setIsLightMode(true);
    }
  }, []);

  // Language loading effect
  useEffect(() => {
    const loadLanguageData = async () => {
      if (!branding || languageLoaded) return;

      try {
        // Use the language loading function with browser locale priority
        const { languageData: data, selectedLanguage: lang } = await loadLanguageDataWithLocale(
          branding.basicPortalLanguage
        );

        setLanguageData(data);
        setSelectedLanguage(lang);
        setLanguageLoaded(true);
      } catch (error) {
        console.error('Failed to load language:', error);
        // Fallback to English
        try {
          const { languageData: fallbackData } = await loadLanguageDataWithLocale('en');
          setLanguageData(fallbackData);
          setSelectedLanguage('en');
          setLanguageLoaded(true);
        } catch (fallbackError) {
          console.error('Failed to load fallback language:', fallbackError);
          setLanguageLoaded(true);
        }
      }
    };

    loadLanguageData();
  }, [branding, languageLoaded]);

  // Helper function to get translated text with fallback to custom partner text
  const getTranslation = (path: string, customText?: string, fieldName?: string) => {
    if (!languageData) return customText || path;
    return getTranslatedText(
      languageData,
      path,
      customText,
      branding?.businessName,
      branding?.translatedTexts,
      selectedLanguage,
      fieldName
    );
  };

  useEffect(() => {
    // Check if passkey is available for the entered email
    if (email && passkeySupported) {
      checkPasskeyAvailability();
    } else {
      setShowPasskeyOption(false);
    }
  }, [email, passkeySupported]); // checkPasskeyAvailability is defined inline

  const checkPasskeyAvailability = async () => {
    try {
      // Normalize email to lowercase for case insensitive comparison
      const normalizedEmail = email.toLowerCase().trim();

      const response = await fetch('/api/whitelabel/auth/passkey/authenticate-begin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      setShowPasskeyOption(response.ok);
    } catch (error) {
      setShowPasskeyOption(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Normalize email to lowercase for case insensitive comparison
      const normalizedEmail = email.toLowerCase().trim();

      // First try regular customer login
      let response = await fetch('/api/whitelabel/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });

      let data;

      // If regular login fails with 401, try team member login
      if (response.status === 401) {
        console.log('Regular customer login failed, trying team member login');
        const teamResponse = await fetch('/api/whitelabel/auth/team-login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: normalizedEmail, password }),
        });

        data = await teamResponse.json();
        if (teamResponse.ok) {
          // If team member login succeeds, use that response
          response = teamResponse;
        } else {
          // If both logins fail, use the original response data
          data = await response.json();
        }
      } else {
        // Regular login succeeded or failed with non-401 error
        data = await response.json();
      }

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Check if this is the first login and redirect to change password if needed
      if (data.redirectUrl) {
        console.log('Login successful, redirecting to:', data.redirectUrl);
        router.push(data.redirectUrl);
      } else {
        console.log('Login successful, redirecting to:', redirectUrl);
        router.push(redirectUrl);
      }
    } catch (err) {
      console.error('Login failed:', err);
      setError(err instanceof Error ? err.message : 'Invalid email or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };



  const handlePasskeySuccess = (result: any) => {
    // Redirect based on the result
    if (result.redirectUrl) {
      console.log('Passkey login successful, redirecting to:', result.redirectUrl);
      router.push(result.redirectUrl);
    } else {
      console.log('Passkey login successful, redirecting to:', redirectUrl);
      router.push(redirectUrl);
    }
  };

  const handlePasskeyError = (error: string) => {
    setError(error);
  };

  const handleMagicLinkRequest = async () => {
    if (!email) {
      setError('Please enter your email address first');
      return;
    }

    // Normalize email to lowercase for case insensitive comparison
    const normalizedEmail = email.toLowerCase().trim();

    setIsMagicLinkLoading(true);
    setError('');

    try {
      const response = await fetch('/api/whitelabel/auth/send-magic-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: normalizedEmail, type: 'login' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send magic link');
      }

      setMagicLinkSent(true);
      setError('');
    } catch (err) {
      console.error('Magic link request failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to send magic link');
    } finally {
      setIsMagicLinkLoading(false);
    }
  };

  // Show loading modal while branding is loading
  if (brandingLoading || !languageLoaded) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isLightMode ? 'bg-gray-50' : 'bg-gray-900'}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className={`text-lg ${isLightMode ? 'text-gray-900' : 'text-white'}`}>
            {getTranslation('', '', 'loading') || 'Loading portal...'}
          </p>
        </div>
      </div>
    );
  }

  // We'll use our theme button classes instead of custom styles

  return (
    <div className={`min-h-screen flex flex-col ${themeConfig.styleClasses.container}`}>
      <PasskeyDevNotice />

      {/* Back Button */}
      <div className="absolute top-6 left-6 z-10">
        <Link
          href={fromUrl}
          className={`group flex items-center gap-3 pl-2 pr-5 py-2 rounded-full border transition-all duration-300 shadow-sm hover:shadow-md ${
            isLightMode
              ? 'bg-white/90 border-gray-200/80 hover:border-gray-300 text-gray-600 hover:text-gray-900 backdrop-blur-md'
              : 'bg-gray-900/60 border-gray-700/60 hover:border-gray-600 text-gray-300 hover:text-white backdrop-blur-md'
          }`}
        >
          <div 
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
              isLightMode 
                ? 'bg-gray-100 group-hover:bg-gray-200/80' 
                : 'bg-gray-800 group-hover:bg-gray-700'
            }`}
            style={{ color: branding.primaryColor }}
          >
            <svg 
              className="w-4 h-4 transform transition-transform duration-300 group-hover:-translate-x-0.5" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </div>
          <span className="text-sm font-medium tracking-wide">{getTranslation('navigation.back', 'Back')}</span>
        </Link>
      </div>

      {/* Theme Toggle */}
      <div className="absolute top-4 right-4 z-10">
        <WhitelabelThemeToggle
          size="sm"
          onThemeChange={setIsLightMode}
          primaryColor={branding.primaryColor}
        />
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            {branding.logo ? (
              <Image
                src={branding.logo}
                alt={branding.businessName}
                width={64}
                height={64}
                className="mx-auto rounded-xl"
              />
            ) : (
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-bold text-2xl mx-auto"
                style={{ background: `linear-gradient(to right, ${branding.primaryColor}, ${branding.secondaryColor})` }}
              >
                {branding.businessName.substring(0, 1)}
              </div>
            )}
            <h2 className="mt-4 text-2xl font-bold" style={{ color: branding.primaryColor }}>
              {getTranslation('', branding.portalTitle, 'portalTitle') || `${branding.businessName} Portal`}
            </h2>
            <p className={`mt-1 ${isLightMode ? 'text-gray-600' : 'text-gray-400'}`}>
              {getTranslation('auth.login.subtitle') || 'Sign in to access your account'}
            </p>
          </div>

          <div className={`p-8 md:p-10 rounded-2xl border shadow-xl ${
            isLightMode 
              ? 'border-gray-100 bg-white/80 backdrop-blur-sm' 
              : 'border-gray-700/50 bg-gray-800/80 backdrop-blur-sm'
          } ${themeConfig.styleClasses.card}`}>
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500">
                {error}
              </div>
            )}

            {magicLinkSent && (
              <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-green-500">
                <h3 className="font-semibold mb-2">{getTranslation('auth.magicLink.sent') || 'Magic Link Sent!'}</h3>
                <p>{getTranslation('auth.magicLink.checkEmail') || 'Check your email for a secure sign-in link. The link will expire in 30 minutes.'}</p>
              </div>
            )}



            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className={`block text-sm font-medium mb-1 ${isLightMode ? 'text-gray-700' : 'text-gray-300'}`}>
                  {getTranslation('auth.email') || 'Email Address'}
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-offset-2 ${
                    isLightMode
                      ? 'bg-white border-gray-300 text-gray-900 focus:ring-offset-white'
                      : 'bg-gray-700 border-gray-600 text-white focus:ring-offset-gray-800'
                  }`}
                  style={{ borderColor: `${branding.primaryColor}40` }}
                  placeholder={getTranslation('auth.emailPlaceholder') || 'you@example.com'}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="password" className={`block text-sm font-medium ${isLightMode ? 'text-gray-700' : 'text-gray-300'}`}>
                    {getTranslation('auth.password') || 'Password'}
                  </label>
                  <Link
                    href="/forgot-password"
                    className={`text-sm hover:underline ${isLightMode ? 'text-gray-600 hover:text-gray-900' : 'text-gray-400 hover:text-white'}`}
                    style={{ color: branding.secondaryColor }}
                  >
                    {getTranslation('auth.forgotPassword') || 'Forgot password?'}
                  </Link>
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-offset-2 ${
                    isLightMode
                      ? 'bg-white border-gray-300 text-gray-900 focus:ring-offset-white'
                      : 'bg-gray-700 border-gray-600 text-white focus:ring-offset-gray-800'
                  }`}
                  style={{ borderColor: `${branding.primaryColor}40` }}
                  placeholder="••••••••"
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isLoading || isMagicLinkLoading}
                  className={`w-full px-4 py-3 rounded-xl font-medium text-white disabled:opacity-70 flex items-center justify-center ${
                    isLightMode ? 'shadow-lg hover:shadow-xl transition-all duration-300' : themeConfig.styleClasses.button.primary
                  }`}
                  style={isLightMode ? { background: `linear-gradient(to right, ${branding.primaryColor}, ${branding.secondaryColor})` } : { backgroundColor: branding.primaryColor }}
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {getTranslation('auth.signingIn') || 'Signing in...'}
                    </>
                  ) : (getTranslation('auth.signIn') || 'Sign in')}
                </button>
              </div>

              {/* Magic Link Option */}
              <div className="mt-4">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className={`w-full border-t ${isLightMode ? 'border-gray-300' : 'border-gray-600'}`}></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span
                      className={`px-2 ${isLightMode ? 'text-gray-600' : 'text-gray-400'}`}
                      style={{ backgroundColor: isLightMode ? 'white' : (themeConfig.styleClasses.card.includes('bg-gray-800') ? '#1f2937' : '#111827') }}
                    >
                      {getTranslation('auth.or') || 'or'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleMagicLinkRequest}
                  disabled={isLoading || isMagicLinkLoading || !email}
                  className={`mt-4 w-full px-4 py-3 rounded-xl font-medium border disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center ${
                    isLightMode
                      ? 'text-gray-700 border-gray-300 bg-white hover:bg-gray-50'
                      : 'text-gray-300 border-gray-600 hover:bg-gray-700'
                  }`}
                >
                  {isMagicLinkLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {getTranslation('auth.sendingMagicLink') || 'Sending Magic Link...'}
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      {getTranslation('auth.sendMagicLink') || 'Send Magic Link'}
                    </>
                  )}
                </button>
                {!email && (
                  <p className={`mt-2 text-xs text-center ${isLightMode ? 'text-gray-500' : 'text-gray-500'}`}>
                    {getTranslation('auth.enterEmailForMagicLink') || 'Enter your email address above to send a magic link'}
                  </p>
                )}
              </div>

              {/* Passkey Authentication Option */}
              {showPasskeyOption && (
                <div className="mt-4">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className={`w-full border-t ${isLightMode ? 'border-gray-300' : 'border-gray-600'}`}></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span
                        className={`px-2 ${isLightMode ? 'text-gray-600' : 'text-gray-400'}`}
                        style={{ backgroundColor: isLightMode ? 'white' : (themeConfig.styleClasses.card.includes('bg-gray-800') ? '#1f2937' : '#111827') }}
                      >
                        {getTranslation('auth.or') || 'or'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <PasskeyAuthButton
                      email={email}
                      isCustomer={true}
                      onSuccess={handlePasskeySuccess}
                      onError={handlePasskeyError}
                      disabled={isLoading}
                      variant="secondary"
                      className="w-full"
                    />
                  </div>
                </div>
              )}
            </form>

            <div className="mt-6 text-center">
              <p className={`${isLightMode ? 'text-gray-600' : 'text-gray-400'}`}>
                {getTranslation('auth.noAccount') || "Don't have an account?"}{' '}
                <Link
                  href="/register"
                  className={`hover:underline ${isLightMode ? 'hover:text-gray-900' : 'text-white hover:text-white'}`}
                  style={{ color: branding.primaryColor }}
                >
                  {getTranslation('auth.registerButton') || 'Register'}
                </Link>
              </p>
              <p className={`mt-2 ${isLightMode ? 'text-gray-600' : 'text-gray-400'}`}>
                <Link
                  href="/forgot-password"
                  className="text-sm hover:underline"
                  style={{ color: branding.secondaryColor }}
                >
                  {getTranslation('auth.troubleReset') || 'Having trouble? Reset your password here'}
                </Link>
              </p>
            </div>
          </div>

          <div className={`mt-8 text-center text-sm ${isLightMode ? 'text-gray-500' : 'text-gray-500'}`}>
            &copy; {new Date().getFullYear()} {branding.businessName}. {getTranslation('footer.allRightsReserved') || 'All rights reserved.'}
          </div>
        </div>
      </div>
    </div>
  );
}

// Main page component with Suspense boundary
export default function WhiteLabelLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
