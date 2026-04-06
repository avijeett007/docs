'use client';

import React, { useState, useEffect } from 'react';
import { usePartnerBranding } from '@/lib/partnerBranding';
import { useRouter } from 'next/navigation';
import { PortalTheme, getThemeConfig } from '@/lib/portalThemes';
import { loadLanguageDataWithLocale, getTranslatedText, type LanguageData, type SupportedLanguage } from '@/lib/languages';
import { WhitelabelThemeToggle } from '@/components/whitelabel/WhitelabelThemeToggle';
import Image from 'next/image';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const { branding } = usePartnerBranding();
  const router = useRouter();

  // Theme state management
  const [isLightMode, setIsLightMode] = useState(false);

  // Language state management
  const [languageData, setLanguageData] = useState<LanguageData | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>('en');
  const [languageLoaded, setLanguageLoaded] = useState(false);

  // Get theme config based on partner preference and light mode
  const theme = (branding?.themePreference as PortalTheme) || PortalTheme.MODERN;
  const themeConfig = getThemeConfig(theme, isLightMode);

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Load theme preference from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('whitelabel-theme');
    setIsLightMode(savedTheme === 'light');
  }, []);

  // Load language data
  useEffect(() => {
    if (!branding || languageLoaded) return;

    const loadLanguageData = async () => {
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

  const handleThemeChange = (lightMode: boolean) => {
    setIsLightMode(lightMode);
    localStorage.setItem('whitelabel-theme', lightMode ? 'light' : 'dark');
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');
    
    try {
      // Normalize email to lowercase for case insensitive comparison
      const normalizedEmail = email.toLowerCase().trim();

      // Use the new magic link endpoint for password reset
      const response = await fetch('/api/whitelabel/auth/send-magic-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: normalizedEmail, type: 'password_reset' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process request');
      }

      setSuccess(getTranslation('auth.forgotPasswordPage.resetLinkSent') || 'If an account exists with this email, you will receive a secure password reset link shortly.');
      setEmail('');
    } catch (err) {
      console.error('Password reset request failed:', err);
      // Don't reveal if the email exists or not for security reasons
      setSuccess(getTranslation('auth.forgotPasswordPage.resetLinkSent') || 'If an account exists with this email, you will receive a secure password reset link shortly.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Show loading state while branding is being fetched
  if (!branding) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col ${themeConfig.styleClasses.container}`}>
      {/* Theme Toggle */}
      <div className="absolute top-4 right-4 z-10">
        <WhitelabelThemeToggle
          onThemeChange={handleThemeChange}
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
              {getTranslation('auth.forgotPasswordPage.title') || 'Reset Password'}
            </h2>
            <p className={`mt-1 ${isLightMode ? 'text-gray-600' : 'text-gray-400'}`}>
              {getTranslation('auth.forgotPasswordPage.subtitle') || 'Enter your email to receive a secure reset link'}
            </p>
          </div>

          <div className={`p-8 rounded-lg border ${isLightMode ? 'border-gray-200' : 'border-gray-700'} ${themeConfig.styleClasses.card}`}>
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
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-offset-2 ${
                    isLightMode
                      ? 'bg-white border-gray-300 text-gray-900 focus:ring-offset-white'
                      : 'bg-gray-700 border-gray-600 text-white focus:ring-offset-gray-800'
                  }`}
                  style={{ borderColor: `${branding.primaryColor}40` }}
                  placeholder={getTranslation('auth.emailPlaceholder') || 'you@example.com'}
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
                      {getTranslation('auth.forgotPasswordPage.processing') || 'Processing...'}
                    </>
                  ) : (getTranslation('auth.forgotPasswordPage.sendResetLink') || 'Send Reset Link')}
                </button>
              </div>
            </form>

            <div className="mt-6 text-center">
              <Link
                href="/whitelabel/login"
                className={`text-sm hover:underline ${isLightMode ? 'text-gray-600 hover:text-gray-900' : 'text-gray-400 hover:text-white'}`}
                style={{ color: branding.secondaryColor }}
              >
                {getTranslation('auth.forgotPasswordPage.backToLogin') || 'Back to Login'}
              </Link>
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
