'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiArrowLeft, FiArrowRight, FiCalendar, FiMessageSquare, FiPhone } from 'react-icons/fi';
import { PartnerBranding } from '@/types/partner';
import { saveProspectProgress } from '@/lib/prospectTracker';
import { navigateToPreviousOnboardingStep } from '@/lib/onboardingNavigation';
import { loadLanguageDataWithLocale, getTranslatedText, type LanguageData, type SupportedLanguage } from '@/lib/languages';

interface Step8CommunicationSettingsProps {}

export default function Step8CommunicationSettings({}: Step8CommunicationSettingsProps) {
  const [branding, setBranding] = useState<PartnerBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    meetingUrl: '',
    smsEnabled: false, // Default disabled - premium feature
    callTransferEnabled: false, // Default disabled - premium feature
    transferNumber: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Language data loading
  const [languageData, setLanguageData] = useState<LanguageData | null>(null);
  const [languageLoading, setLanguageLoading] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>('en');

  // Fetch partner branding
  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const hostname = window.location.hostname;
        let subdomain = '';
        
        if (hostname.includes('.lvh.me')) {
          subdomain = hostname.split('.')[0];
        } else if (hostname.includes('.knotie-ai.pro')) {
          subdomain = hostname.split('.')[0];
        } else if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
          subdomain = hostname;
        }

        if (!subdomain) {
          throw new Error('Unable to determine partner from hostname');
        }

        const response = await fetch(`/api/whitelabel/branding/${subdomain}`);
        if (!response.ok) {
          throw new Error('Failed to fetch partner branding');
        }

        const data = await response.json();
        setBranding(data);
      } catch (err) {
        console.error('Error fetching branding:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBranding();
  }, []);

  // Load language data
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const { languageData: data, selectedLanguage: detectedLanguage } = await loadLanguageDataWithLocale();
        setLanguageData(data);
        setSelectedLanguage(detectedLanguage);
      } catch (error) {
        console.error('Error loading language data:', error);
      } finally {
        setLanguageLoading(false);
      }
    };

    loadLanguage();
  }, []);

  // Helper function to get translated text
  const getTranslation = (path: string, customText?: string) => {
    if (!languageData) return customText || path;
    return getTranslatedText(languageData, path, customText, branding?.businessName);
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const isValidUrl = (url: string) => {
    if (!url) return true; // Optional field
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValidUrl(settings.meetingUrl)) {
      return;
    }

    setIsSubmitting(true);
    try {
      // Save communication settings to localStorage
      localStorage.setItem('onboarding_communicationSettings', JSON.stringify(settings));

      // Save prospect progress to database with complete communication settings
      await saveProspectProgress(8, {
        meetingUrl: settings.meetingUrl,
        smsEnabled: settings.smsEnabled,
        callTransferEnabled: false, // Always false as it's disabled for now
        transferNumber: settings.transferNumber || undefined
      });

      window.location.href = '/platform/onboarding/9';
    } catch (error) {
      console.error('Error submitting communication settings:', error);
      setIsSubmitting(false);
    }
  };

  if (loading || languageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <div className="bg-white sticky top-0 z-20 border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            {branding?.logo && (
              <img
                src={branding.logo}
                alt={`${branding.businessName} Logo`}
                className="h-10 w-auto object-contain"
              />
            )}
            <div className="text-xs font-bold uppercase tracking-wider text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              {getTranslation('saas.onboarding.step8.stepIndicator')}
            </div>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full">
          <div className="h-1.5 bg-gray-100">
            <div
              className="h-1.5 rounded-r-full transition-all duration-500 ease-out"
              style={{
                width: '88.88%', // 8/9 steps
                background: `linear-gradient(90deg, ${branding?.primaryColor || '#3B82F6'}, ${branding?.secondaryColor || '#8B5CF6'})`
              }}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4 tracking-tight">
            {getTranslation('saas.onboarding.step8.title')}
          </h1>
          <p className="text-lg text-gray-600 max-w-lg mx-auto leading-relaxed">
            {getTranslation('saas.onboarding.step8.subtitle')}
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          onSubmit={handleSubmit}
          className="bg-white rounded-3xl shadow-2xl shadow-blue-900/5 p-8 space-y-8 border border-white/50"
        >
          {/* Meeting URL */}
          <div>
            <label htmlFor="meetingUrl" className="block text-sm font-medium text-gray-700 mb-2">
              <FiCalendar className="inline mr-2" />
              {getTranslation('saas.onboarding.step8.meetingUrlLabel')}
            </label>
            <input
              type="url"
              id="meetingUrl"
              value={settings.meetingUrl}
              onChange={(e) => handleInputChange('meetingUrl', e.target.value)}
              placeholder={getTranslation('saas.onboarding.step8.meetingUrlPlaceholder')}
              className={`w-full px-4 py-3 border rounded-lg transition-colors text-gray-900 bg-white ${
                settings.meetingUrl && !isValidUrl(settings.meetingUrl)
                  ? 'border-red-300 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-blue-500'
              } focus:border-transparent`}
            />
            {settings.meetingUrl && !isValidUrl(settings.meetingUrl) && (
              <p className="text-red-500 text-sm mt-1">
                {getTranslation('saas.onboarding.step8.invalidUrl')}
              </p>
            )}
            <p className="text-gray-500 text-sm mt-1">
              {getTranslation('saas.onboarding.step8.meetingUrlHelper')}
            </p>
          </div>

          {/* SMS Settings */}
          <div className="border border-gray-200 rounded-lg p-6 relative">
            {/* Premium Badge */}
            <div className="absolute -top-2 -right-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold py-1 px-3 rounded-full shadow-lg">
              PREMIUM
            </div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                  <FiMessageSquare className="mr-2" />
                  {getTranslation('saas.onboarding.step8.smsTitle')}
                  <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">{getTranslation('saas.onboarding.step8.smsPremiumBadge')}</span>
                </h3>
                <p className="text-sm text-gray-600">
                  {getTranslation('saas.onboarding.step8.smsDesc')}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.smsEnabled}
                  onChange={(e) => handleInputChange('smsEnabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
            {!settings.smsEnabled && (
              <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <p className="text-sm text-purple-700">
                  {getTranslation('saas.onboarding.step8.smsUpgradeMessage')}
                </p>
              </div>
            )}
          </div>

          {/* Call Transfer Settings */}
          <div className="border border-gray-200 rounded-lg p-6 relative opacity-60">
            {/* Upcoming Feature Badge */}
            <div className="absolute -top-2 -right-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold py-1 px-3 rounded-full shadow-lg">
              COMING SOON
            </div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                  <FiPhone className="mr-2" />
                  {getTranslation('saas.onboarding.step8.callTransferTitle')}
                  <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">{getTranslation('saas.onboarding.step8.callTransferUpcomingBadge')}</span>
                </h3>
                <p className="text-sm text-gray-600">
                  {getTranslation('saas.onboarding.step8.callTransferDesc')}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-not-allowed">
                <input
                  type="checkbox"
                  checked={false}
                  disabled={true}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-300 rounded-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
              </label>
            </div>
            <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-700">
                {getTranslation('saas.onboarding.step8.callTransferComingSoon')}
              </p>
            </div>


          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              type="button"
              onClick={() => navigateToPreviousOnboardingStep()}
              className="group sm:w-auto w-full py-4 px-8 rounded-xl font-medium border-2 border-gray-300 text-gray-600 hover:text-gray-900 hover:border-gray-400 hover:bg-gray-50 transition-all duration-200"
            >
              <div className="flex items-center justify-center">
                <FiArrowLeft className="mr-2 transition-transform duration-200 group-hover:-translate-x-1" />
                Back
              </div>
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !isValidUrl(settings.meetingUrl)}
              className={`flex-1 w-full py-4 px-6 rounded-lg font-semibold text-white transition-all duration-300 ${
                isSubmitting || !isValidUrl(settings.meetingUrl)
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'hover:shadow-lg transform hover:scale-105'
              }`}
              style={{
                background: (isSubmitting || !isValidUrl(settings.meetingUrl))
                  ? '#9CA3AF'
                  : `linear-gradient(135deg, ${branding?.primaryColor || '#3B82F6'}, ${branding?.secondaryColor || '#8B5CF6'})`
              }}
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  {getTranslation('saas.onboarding.step8.processing')}
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  {getTranslation('saas.onboarding.step8.continue')}
                  <FiArrowRight className="ml-2" />
                </div>
              )}
            </button>
          </div>
        </motion.form>
      </div>
    </div>
  );
}
