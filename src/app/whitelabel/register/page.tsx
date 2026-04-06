'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { usePartnerBranding } from '@/lib/partnerBranding';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { PortalTheme, getThemeConfig } from '@/lib/portalThemes';
import { WhitelabelThemeToggle } from '@/components/whitelabel/WhitelabelThemeToggle';
import { loadLanguageDataWithLocale, getTranslatedText, type LanguageData, type SupportedLanguage } from '@/lib/languages';

function WhiteLabelRegisterPageContent() {
  const { branding, loading: brandingLoading } = usePartnerBranding();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams?.get('redirect') || '/whitelabel';
  const planId = searchParams?.get('plan') || undefined;

  // Light/Dark mode state
  const [isLightMode, setIsLightMode] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>('en');
  const [languageData, setLanguageData] = useState<LanguageData | null>(null);
  const [languageLoaded, setLanguageLoaded] = useState(false);

  // Get theme config based on partner preference and light mode
  const theme = (branding.themePreference as PortalTheme) || PortalTheme.MODERN;
  const themeConfig = getThemeConfig(theme, isLightMode);
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [emailVerificationSent, setEmailVerificationSent] = useState(false);

  useEffect(() => {
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

  // Get logo dimensions based on size setting
  const getLogoDimensions = (size: string) => {
    switch (size) {
      case 'small':
        return { width: 48, height: 48, className: 'w-12 h-12' };
      case 'medium':
        return { width: 64, height: 64, className: 'w-16 h-16' };
      case 'large':
        return { width: 80, height: 80, className: 'w-20 h-20' };
      case 'extra-large':
        return { width: 96, height: 96, className: 'w-24 h-24' };
      default:
        return { width: 64, height: 64, className: 'w-16 h-16' };
    }
  };

  const logoDimensions = getLogoDimensions(branding.logoSize || 'medium');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Basic validation
    if (password !== confirmPassword) {
      setError(getTranslation('auth.passwordsDoNotMatch') || 'Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (password.length < 8) {
      setError(getTranslation('auth.passwordTooShort') || 'Password must be at least 8 characters long');
      setIsLoading(false);
      return;
    }

    try {
      /**
       * Capture referral ID for internal tracking purposes:
       * 1. Pass to Stripe checkout sessions as metadata
       * 2. Track conversions when users upgrade to paid plans
       * 3. Rewardful handles lead tracking automatically via client-side JS
       * Note: We don't store this in database since Rewardful manages lead attribution
       */
      const { getReferralId } = await import('@/lib/referral-tracking');
      const referralId = getReferralId();

      const response = await fetch('/api/whitelabel/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password, referralId, planId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // Check if payment is required (pay-first flow)
      if (data.requiresPayment && data.checkoutUrl) {
        console.log('Payment required, redirecting to Stripe Checkout:', data.checkoutUrl);
        window.location.href = data.checkoutUrl;
        return;
      }

      if (data.emailVerificationRequired) {
        setSuccess(data.message || getTranslation('auth.accountCreatedVerifyEmail') || 'Account created successfully! Please check your email and click the verification link to complete your registration.');
        setEmailVerificationSent(true);
      } else {
        console.log('Registration successful, redirecting to:', redirectUrl);
        router.push(redirectUrl);
      }
    } catch (err) {
      console.error('Registration failed:', err);
      setError(err instanceof Error ? err.message : (getTranslation('auth.registrationError') || 'An error occurred during registration. Please try again.'));
    } finally {
      setIsLoading(false);
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

  return (
    <div className={`min-h-screen flex flex-col ${themeConfig.styleClasses.container}`}>
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
                width={logoDimensions.width}
                height={logoDimensions.height}
                className={`mx-auto rounded-xl object-contain`}
                style={{ maxHeight: `${logoDimensions.height}px` }}
              />
            ) : (
              <div
                className={`${logoDimensions.className} rounded-xl flex items-center justify-center text-white font-bold text-2xl mx-auto`}
                style={{ background: `linear-gradient(to right, ${branding.primaryColor}, ${branding.secondaryColor})` }}
              >
                {branding.businessName.substring(0, 1)}
              </div>
            )}
            <h2 className="mt-4 text-2xl font-bold" style={{ color: branding.primaryColor }}>
              {getTranslation('', branding.portalTitle, 'portalTitle') || `${branding.businessName} Portal`}
            </h2>
            <p className={`mt-1 ${isLightMode ? 'text-gray-600' : 'text-gray-400'}`}>
              {getTranslation('auth.register.subtitle') || 'Create your account'}
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

            {success && (
              <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-green-500">
                <h3 className="font-semibold mb-2">{getTranslation('auth.registrationSuccessful') || 'Registration Successful!'}</h3>
                <p>{success}</p>
                {emailVerificationSent && (
                  <div className="mt-4">
                    <p className="text-sm">{getTranslation('auth.emailNotReceived') || "Didn't receive the email? Check your spam folder or contact support."}</p>
                  </div>
                )}
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className={`block text-sm font-medium mb-1 ${isLightMode ? 'text-gray-700' : 'text-gray-300'}`}>
                  {getTranslation('auth.fullName') || 'Full Name'}
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-offset-2 ${
                    isLightMode
                      ? 'bg-white border-gray-300 text-gray-900 focus:ring-offset-white'
                      : 'bg-gray-700 border-gray-600 text-white focus:ring-offset-gray-800'
                  }`}
                  style={{ borderColor: `${branding.primaryColor}40` }}
                  placeholder={getTranslation('auth.fullNamePlaceholder') || 'John Doe'}
                />
              </div>

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
                <label htmlFor="password" className={`block text-sm font-medium mb-1 ${isLightMode ? 'text-gray-700' : 'text-gray-300'}`}>
                  {getTranslation('auth.password') || 'Password'}
                </label>
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
                <p className={`text-xs mt-1 ${isLightMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  {getTranslation('auth.passwordRequirement') || 'Must be at least 8 characters long'}
                </p>
              </div>

              <div>
                <label htmlFor="confirmPassword" className={`block text-sm font-medium mb-1 ${isLightMode ? 'text-gray-700' : 'text-gray-300'}`}>
                  {getTranslation('auth.confirmPassword') || 'Confirm Password'}
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
                  disabled={isLoading}
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
                      {getTranslation('auth.creatingAccount') || 'Creating account...'}
                    </>
                  ) : (getTranslation('auth.createAccount') || 'Create Account')}
                </button>
              </div>
            </form>

            <div className="mt-6 text-center">
              <p className={`${isLightMode ? 'text-gray-600' : 'text-gray-400'}`}>
                {getTranslation('auth.alreadyHaveAccount') || 'Already have an account?'}{' '}
                <Link
                  href="/login"
                  className={`hover:underline ${isLightMode ? 'hover:text-gray-900' : 'hover:text-white'}`}
                >
                  <span className="underline" style={{ color: branding.secondaryColor }}>
                    {getTranslation('auth.signIn') || 'Sign in'}
                  </span>
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

export default function WhiteLabelRegisterPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <WhiteLabelRegisterPageContent />
    </Suspense>
  );
}
