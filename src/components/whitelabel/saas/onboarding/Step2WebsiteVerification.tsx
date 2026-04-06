'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiArrowLeft, FiArrowRight, FiCheck, FiGlobe, FiStar, FiClock, FiPhone } from 'react-icons/fi';
import { PartnerBranding } from '@/types/partner';
import { saveProspectProgress } from '@/lib/prospectTracker';
import { navigateToOnboardingStep, navigateToPreviousRoute } from '@/lib/onboardingNavigation';
import { loadLanguageDataWithLocale, getTranslatedText, type LanguageData, type SupportedLanguage } from '@/lib/languages';

interface Step2WebsiteVerificationProps {}

export default function Step2WebsiteVerification({}: Step2WebsiteVerificationProps) {
  const [branding, setBranding] = useState<PartnerBranding | null>(null);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [websiteAnalysis, setWebsiteAnalysis] = useState<any>(null);
  const [verificationStep, setVerificationStep] = useState(0);
  const [shouldSkip, setShouldSkip] = useState(false);

  // Language data loading with browser locale detection
  const [languageData, setLanguageData] = useState<LanguageData | null>(null);
  const [languageLoading, setLanguageLoading] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>('en');

  // Dynamic messages based on language data
  const stepMessages = languageData?.saas.onboarding.step2.verificationMessages || [
    'Connecting to your website...',
    'Analyzing your business content...',
    'Understanding your services...',
    'Identifying your business category...',
    'Finalizing your AI assistant setup...'
  ];

  const marketingMessages = languageData?.saas.onboarding.step2.marketingMessages || [
    'Cherry will answer every call, 24/7 - never miss a customer again!',
    'Automatically book appointments and send confirmations to your calendar.',
    'Handle multiple calls simultaneously while you focus on your business.',
    'Trained specifically on your business to provide accurate, helpful responses.',
    'Seamlessly transfer complex calls to you when needed.'
  ];

  // Function to verify website using real API with step animations and marketing content
  const verifyWebsite = async (businessName: string, website: string) => {
    setIsVerifying(true);
    setVerificationError(null);
    setVerificationStep(0);

    try {
      // Animate through steps with marketing messages
      for (let i = 0; i < stepMessages.length; i++) {
        setVerificationStep(i);
        await new Promise(resolve => setTimeout(resolve, 1200)); // 1.2s per step for better UX
      }

      const hostname = window.location.hostname;
      let subdomain = '';

      if (hostname.includes('.lvh.me')) {
        subdomain = hostname.split('.')[0];
      } else if (hostname.includes('.knotie-ai.pro')) {
        subdomain = hostname.split('.')[0];
      } else if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
        subdomain = hostname;
      }

      const response = await fetch('/api/whitelabel/website-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessName,
          businessWebsite: website,
          partnerId: subdomain,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setWebsiteAnalysis(result.analysis);
        setIsVerified(true);
      } else {
        setVerificationError(result.error || 'Website verification failed');
        setIsVerified(false);
      }
    } catch (error) {
      console.error('Website verification error:', error);
      setVerificationError('Failed to verify website. Please try again.');
      setIsVerified(false);
    } finally {
      setIsVerifying(false);
    }
  };

  // Fetch partner branding and stored data
  useEffect(() => {
    const fetchData = async () => {
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

        // Get business info from localStorage (saved from Step 1)
        const storedBusinessName = localStorage.getItem('onboarding_businessName') || 'Your Business';
        const storedWebsite = localStorage.getItem('onboarding_website') || '';
        const hasNoWebsite = localStorage.getItem('onboarding_hasNoWebsite') === 'true';

        // Check if we should skip this step
        if (hasNoWebsite || !storedWebsite) {
          setShouldSkip(true);
          // Auto-redirect to step 3 after a brief delay
          setTimeout(() => {
            navigateToOnboardingStep(3);
          }, 2000);
          return;
        }

        // Start website verification if we have a website
        if (storedWebsite && storedWebsite !== 'www.yourbusiness.com') {
          await verifyWebsite(storedBusinessName, storedWebsite);
        } else {
          // No valid website to verify
          setIsVerified(false);
          setIsVerifying(false);
        }

      } catch (err) {
        console.error('Error fetching data:', err);
      }
    };

    fetchData();
  }, []);

  // Load language data based on partner's SaaS portal language
  useEffect(() => {
    const loadLanguage = async () => {
      if (!branding) return;

      try {
        setLanguageLoading(true);
        // Use the new function that prioritizes browser locale
        const { languageData: data, selectedLanguage: lang } = await loadLanguageDataWithLocale(
          branding.saasPortalLanguage
        );
        setLanguageData(data);
        setSelectedLanguage(lang);
      } catch (error) {
        console.error('Failed to load language data:', error);
        // Fallback to English
        try {
          const { languageData: fallbackData } = await loadLanguageDataWithLocale('en');
          setLanguageData(fallbackData);
          setSelectedLanguage('en');
        } catch (fallbackError) {
          console.error('Failed to load fallback language data:', fallbackError);
        }
      } finally {
        setLanguageLoading(false);
      }
    };

    loadLanguage();
  }, [branding]);

  // Helper function to get translated text
  const getTranslation = (path: string, customText?: string) => {
    if (!languageData) return customText || path;
    return getTranslatedText(languageData, path, customText, branding?.businessName);
  };



  const handleContinue = async () => {
    if (!isVerified) return;

    setIsSubmitting(true);
    try {
      // Save website analysis data to localStorage for use in later steps
      if (websiteAnalysis) {
        localStorage.setItem('onboarding_websiteAnalysis', JSON.stringify(websiteAnalysis));
      }

      // Save prospect progress to database
      const businessName = localStorage.getItem('onboarding_businessName') || '';
      const website = localStorage.getItem('onboarding_website') || '';

      await saveProspectProgress(2, {
        businessName: businessName,
        businessWebsite: website || undefined,
        // Website analysis data is automatically saved by the verification API
      });

      navigateToOnboardingStep(3);
    } catch (error) {
      console.error('Error continuing:', error);
      setIsSubmitting(false);
    }
  };



  const brandName = branding?.characterName || branding?.businessName || 'Your AI Assistant';

  // Show skip message if no website
  if (shouldSkip) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="bg-white rounded-2xl shadow-xl p-8"
          >
            <div className="text-6xl mb-4">🚀</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              No Website? No Problem!
            </h2>
            <p className="text-gray-600 mb-6">
              We're skipping the website verification step and moving directly to your contact details.
            </p>
            <div className="flex items-center justify-center space-x-2 text-blue-600">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <span>Redirecting to next step...</span>
            </div>
          </motion.div>
        </div>
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
              {getTranslation('saas.onboarding.step2.stepIndicator')}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full">
          <div className="h-1.5 bg-gray-100">
            <div 
              className="h-1.5 rounded-r-full transition-all duration-500 ease-out"
              style={{ 
                width: '22.22%', // 2/9 steps
                background: `linear-gradient(90deg, ${branding?.primaryColor || '#3B82F6'}, ${branding?.secondaryColor || '#8B5CF6'})`
              }}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4 tracking-tight">
            {getTranslation('saas.onboarding.step2.title')}
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
            {getTranslation('saas.onboarding.step2.subtitle')}
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column - Website Verification */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-white rounded-3xl shadow-2xl shadow-blue-900/5 p-8 border border-white/50 min-h-[600px] flex flex-col"
          >
            <div className="text-center mb-8 flex-1 flex flex-col justify-center">
              <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                <FiGlobe className="text-blue-600 text-3xl" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Website Verification</h3>

              {isVerifying ? (
                <div className="space-y-8 mt-6">
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <div className="relative">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-100 border-t-blue-600"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-2 w-2 bg-blue-600 rounded-full"></div>
                      </div>
                    </div>
                    <span className="font-semibold text-blue-900">Setting up {brandName} for your business...</span>
                  </div>

                  {/* Progress Steps */}
                  <motion.div
                    key={verificationStep}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="text-center max-w-sm mx-auto"
                  >
                    <div className="text-lg font-bold text-gray-800 mb-2">
                      {stepMessages[verificationStep]}
                    </div>
                    <div className="text-sm text-blue-600 font-medium bg-blue-50 py-2 px-4 rounded-lg inline-block">
                      {marketingMessages[verificationStep]}
                    </div>
                  </motion.div>

                  {/* Progress Bar */}
                  <div className="w-full bg-gray-100 rounded-full h-2 max-w-xs mx-auto overflow-hidden">
                    <motion.div
                      className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full"
                      initial={{ width: '0%' }}
                      animate={{ width: `${((verificationStep + 1) / stepMessages.length) * 100}%` }}
                      transition={{ duration: 0.8 }}
                    />
                  </div>

                  {/* Step Counter */}
                  <div className="text-center text-xs font-medium text-gray-400 uppercase tracking-wide">
                    Step {verificationStep + 1} of {stepMessages.length}
                  </div>
                </div>
              ) : isVerified ? (
                <div className="flex flex-col items-center justify-center space-y-3 mt-6">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <FiCheck className="text-3xl text-green-600" />
                  </div>
                  <span className="text-xl font-bold text-green-700">Website verified successfully!</span>
                </div>
              ) : verificationError ? (
                <div className="flex flex-col items-center justify-center space-y-3 mt-6">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-3xl">⚠️</span>
                  </div>
                  <span className="text-xl font-bold text-red-600">Verification failed</span>
                </div>
              ) : (
                <p className="text-gray-500 font-medium">Checking your website details...</p>
              )}
            </div>

            {verificationError && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="bg-red-50 border border-red-100 rounded-xl p-5 mb-6"
              >
                <h4 className="font-bold text-red-800 mb-2 flex items-center">
                  <span className="mr-2">❌</span> Verification Error:
                </h4>
                <p className="text-sm text-red-700 mb-3">{verificationError}</p>
                <button
                  onClick={() => {
                    const storedBusinessName = localStorage.getItem('onboarding_businessName') || 'Your Business';
                    const storedWebsite = localStorage.getItem('onboarding_website') || '';
                    if (storedWebsite) {
                      verifyWebsite(storedBusinessName, storedWebsite);
                    }
                  }}
                  className="px-4 py-2 bg-white border border-red-200 text-red-700 rounded-lg text-sm font-semibold hover:bg-red-50 transition-colors shadow-sm"
                >
                  Try Again
                </button>
              </motion.div>
            )}

            <div className="flex-1 flex flex-col justify-center">
              {isVerified && websiteAnalysis && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="bg-green-50/50 border border-green-100 rounded-2xl p-6 mb-8"
                >
                  <h4 className="font-bold text-green-800 mb-4 text-center flex items-center justify-center">
                    <FiCheck className="mr-2" /> Website Details Found
                  </h4>
                  <div className="space-y-4">
                    <div className="text-center bg-white/60 p-4 rounded-xl">
                      <div className="text-lg font-bold text-gray-900">{websiteAnalysis.businessName}</div>
                      <div className="text-sm text-gray-500 mt-1 line-clamp-1">{websiteAnalysis.websiteTitle}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="bg-white/60 p-3 rounded-xl">
                        <span className="font-semibold text-gray-500 block text-xs uppercase mb-1">Business Type</span>
                        <div className="text-green-700 font-bold">{websiteAnalysis.businessCategory}</div>
                      </div>
                      <div className="bg-white/60 p-3 rounded-xl">
                        <span className="font-semibold text-gray-500 block text-xs uppercase mb-1">Category</span>
                        <div className="text-green-700 font-bold">
                          {websiteAnalysis.services?.length > 0 ? 'Service' : 'Product'}
                        </div>
                      </div>
                    </div>

                    {websiteAnalysis.services?.length > 0 && (
                      <div className="bg-white/60 p-3 rounded-xl">
                        <span className="font-semibold text-gray-500 block text-xs uppercase mb-2">Services Detected</span>
                        <div className="flex flex-wrap gap-2">
                          {websiteAnalysis.services.slice(0, 3).map((service: string, i: number) => (
                            <span key={i} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-md font-medium">
                              {service}
                            </span>
                          ))}
                          {websiteAnalysis.services.length > 3 && (
                            <span className="text-xs text-gray-400 py-1 pl-1">+{websiteAnalysis.services.length - 3} more</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <button
                type="button"
                onClick={navigateToPreviousRoute}
                className="group sm:w-auto w-full py-4 px-8 rounded-xl font-medium border-2 border-gray-300 text-gray-600 hover:text-gray-900 hover:border-gray-400 hover:bg-gray-50 transition-all duration-200"
              >
                <div className="flex items-center justify-center">
                  <FiArrowLeft className="mr-2 transition-transform duration-200 group-hover:-translate-x-1" />
                  Back
                </div>
              </button>

              <button
                onClick={handleContinue}
                disabled={!isVerified || isSubmitting}
                className={`flex-1 w-full py-4 px-6 rounded-xl font-bold text-white shadow-sm transition-all duration-300 ${
                  !isVerified || isSubmitting
                    ? 'bg-gray-300 cursor-not-allowed opacity-80'
                    : 'hover:shadow-xl hover:scale-[1.02]'
                }`}
                style={{
                  background: (!isVerified || isSubmitting)
                    ? '#D1D5DB'
                    : `linear-gradient(135deg, ${branding?.primaryColor || '#3B82F6'}, ${branding?.secondaryColor || '#8B5CF6'})`
                }}
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Processing...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    Continue Setup
                    <FiArrowRight className="ml-2" />
                  </div>
                )}
              </button>
            </div>
          </motion.div>

          {/* Right Column - Features Preview */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="min-h-[600px]"
          >
            <div className="bg-white rounded-2xl shadow-xl p-8 h-full flex flex-col">
              <h3 className="text-xl font-semibold text-gray-900 mb-6">
                {getTranslation('saas.onboarding.step2.benefitsTitle')}
              </h3>

              <div className="space-y-6 flex-1">
                <div className="flex items-start space-x-4">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <FiPhone className="text-green-600 text-lg" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">{getTranslation('saas.onboarding.step2.benefit1Title')}</h4>
                    <p className="text-gray-600">{getTranslation('saas.onboarding.step2.benefit1Desc')}</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <FiClock className="text-blue-600 text-lg" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">{getTranslation('saas.onboarding.step2.benefit2Title')}</h4>
                    <p className="text-gray-600">{getTranslation('saas.onboarding.step2.benefit2Desc')}</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <FiStar className="text-purple-600 text-lg" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">{getTranslation('saas.onboarding.step2.benefit3Title')}</h4>
                    <p className="text-gray-600">{getTranslation('saas.onboarding.step2.benefit3Desc')}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
