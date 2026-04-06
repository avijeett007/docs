'use client';

import React, { useState, useEffect } from 'react';
import { FiUser, FiMail, FiLock, FiCheck, FiLoader, FiAlertCircle } from 'react-icons/fi';
import WhitelabelLayout from '@/components/whitelabel/WhitelabelLayout';
import { usePartnerBranding } from '@/lib/partnerBranding';
import { getThemeConfig, PortalTheme } from '@/lib/portalThemes';
import { loadLanguageDataWithLocale, getTranslatedText, type LanguageData, type SupportedLanguage } from '@/lib/languages';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { Permission } from '@/lib/rbac';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import TeamManagement from '@/components/whitelabel/TeamManagement';

interface UserInfo {
  customer: {
    id: string;
    name: string;
    email: string;
  };
  isFirstLogin: boolean;
  lastPasswordReset: string | null;
}

export default function AccountSettingsPage() {
  const { branding } = usePartnerBranding();
  const themeConfig = getThemeConfig((branding.themePreference as PortalTheme) || PortalTheme.MODERN);
  const { hasPermission } = useCustomerAuth();

  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Language state
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>('en');
  const [languageData, setLanguageData] = useState<LanguageData | null>(null);
  const [languageLoaded, setLanguageLoaded] = useState(false);

  // Helper function for translations
  const getTranslation = (path: string, fallback?: string) => {
    if (!languageData) return fallback || path;
    return getTranslatedText(
      languageData,
      path,
      fallback,
      branding?.businessName,
      branding?.translatedTexts,
      selectedLanguage
    );
  };

  // Load language data
  useEffect(() => {
    const loadLanguageData = async () => {
      if (!branding || languageLoaded) return;
      try {
        const { languageData: data, selectedLanguage: lang } = await loadLanguageDataWithLocale(
          branding.basicPortalLanguage
        );
        setLanguageData(data);
        setSelectedLanguage(lang);
        setLanguageLoaded(true);
      } catch (error) {
        console.error('Failed to load language:', error);
      }
    };
    loadLanguageData();
  }, [branding, languageLoaded]);

  // Fetch user information
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const response = await fetch('/api/whitelabel/auth/me');
        if (response.ok) {
          const data = await response.json();
          setUserInfo(data);
        } else {
          console.error('Failed to fetch user info');
        }
      } catch (error) {
        console.error('Error fetching user info:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserInfo();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Reset messages
    setError('');
    setSuccess('');

    // Validate passwords
    if (newPassword !== confirmPassword) {
      setError(getTranslation('portal.accountSettings.passwordMismatch', 'New passwords do not match'));
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/whitelabel/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          isFirstLogin: false
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(getTranslation('portal.accountSettings.passwordChangeSuccess', 'Password changed successfully'));
        // Clear form
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setError(data.error || getTranslation('portal.accountSettings.passwordChangeFailed', 'Failed to change password'));
      }
    } catch (error) {
      console.error('Error changing password:', error);
      setError(getTranslation('portal.accountSettings.unexpectedError', 'An unexpected error occurred'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ProtectedRoute
      hasPermission={hasPermission}
      requiredPermission={Permission.MANAGE_SETTINGS}
      fallbackPath="/whitelabel/dashboard"
    >
      <WhitelabelLayout>
        <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6" style={{ color: branding.primaryColor }}>
          {getTranslation('portal.accountSettings.title', 'Account Settings')}
        </h1>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <FiLoader className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* User Information Card */}
              <div className="md:col-span-1">
                <div className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-lg p-6`}
                     style={{ borderColor: `${branding.primaryColor}40` }}>
                  <h2 className="text-lg font-semibold mb-4">{getTranslation('portal.accountSettings.userInfo.title', 'User Information')}</h2>

                  {userInfo ? (
                    <div className="space-y-4">
                      <div className="flex items-start">
                        <FiUser className="mt-1 mr-3 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-400">{getTranslation('portal.accountSettings.userInfo.name', 'Name')}</p>
                          <p className="font-medium">{userInfo.customer.name}</p>
                        </div>
                      </div>

                      <div className="flex items-start">
                        <FiMail className="mt-1 mr-3 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-400">{getTranslation('portal.accountSettings.userInfo.email', 'Email')}</p>
                          <p className="font-medium">{userInfo.customer.email}</p>
                        </div>
                      </div>

                      <div className="flex items-start">
                        <FiLock className="mt-1 mr-3 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-400">{getTranslation('portal.accountSettings.userInfo.password', 'Password')}</p>
                          <p className="font-medium">••••••••</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {userInfo.lastPasswordReset
                              ? getTranslation('portal.accountSettings.userInfo.lastChanged', `Last changed: ${new Date(userInfo.lastPasswordReset).toLocaleDateString()}`).replace('{date}', new Date(userInfo.lastPasswordReset).toLocaleDateString())
                              : getTranslation('portal.accountSettings.userInfo.neverChanged', 'Never changed')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-400">{getTranslation('portal.accountSettings.userInfo.unableToLoad', 'Unable to load user information')}</p>
                  )}
                </div>
              </div>

              {/* Change Password Form */}
              <div className="md:col-span-2">
                <div className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-lg p-6`}
                     style={{ borderColor: `${branding.primaryColor}40` }}>
                  <h2 className="text-lg font-semibold mb-4">{getTranslation('portal.accountSettings.changePassword.title', 'Change Password')}</h2>

                  {error && (
                    <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-lg flex items-center text-red-400">
                      <FiAlertCircle className="mr-2 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {success && (
                    <div className="mb-4 p-3 bg-green-900/30 border border-green-800 rounded-lg flex items-center text-green-400">
                      <FiCheck className="mr-2 flex-shrink-0" />
                      <span>{success}</span>
                    </div>
                  )}

                  <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-300 mb-1">
                          {getTranslation('portal.accountSettings.changePassword.currentPassword', 'Current Password')}
                        </label>
                        <input
                          id="currentPassword"
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                      </div>

                      <div>
                        <label htmlFor="newPassword" className="block text-sm font-medium text-gray-300 mb-1">
                          {getTranslation('portal.accountSettings.changePassword.newPassword', 'New Password')}
                        </label>
                        <input
                          id="newPassword"
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                          minLength={8}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {getTranslation('portal.accountSettings.changePassword.passwordRequirement', 'Password must be at least 8 characters long')}
                        </p>
                      </div>

                      <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-1">
                          {getTranslation('portal.accountSettings.changePassword.confirmPassword', 'Confirm New Password')}
                        </label>
                        <input
                          id="confirmPassword"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                      </div>

                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="w-full px-4 py-2 rounded-lg font-medium text-white transition-colors flex items-center justify-center"
                          style={{
                            backgroundColor: branding.primaryColor,
                            opacity: isSubmitting ? 0.7 : 1
                          }}
                        >
                          {isSubmitting ? (
                            <>
                              <FiLoader className="animate-spin mr-2" />
                              {getTranslation('portal.accountSettings.changePassword.changingPassword', 'Changing Password...')}
                            </>
                          ) : (
                            getTranslation('portal.accountSettings.changePassword.changePasswordButton', 'Change Password')
                          )}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>

            {/* Team Management Section */}
            {userInfo && (
              <TeamManagement customerId={userInfo.customer.id} />
            )}
          </div>
        )}
        </div>
      </WhitelabelLayout>
    </ProtectedRoute>
  );
}
