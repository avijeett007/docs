'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiArrowLeft, FiArrowRight, FiGlobe, FiHome, FiCheck } from 'react-icons/fi';
import { PartnerBranding } from '@/types/partner';
import { navigateToOnboardingStep, navigateToPreviousRoute } from '@/lib/onboardingNavigation';
import { loadLanguageDataWithLocale, getTranslatedText, type LanguageData, type SupportedLanguage } from '@/lib/languages';
import BusinessLookupAutocomplete from '@/components/whitelabel/business-lookup/BusinessLookupAutocomplete';
import { saveBusinessInfo, markStepCompleted, getAutoFillData, hasBusinessLookupData } from '@/lib/onboarding-storage';
import { clientLogger } from '@/lib/client-logger';

interface Step1BusinessInfoProps {}

export default function Step1BusinessInfo({}: Step1BusinessInfoProps) {
  const [branding, setBranding] = useState<PartnerBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [businessName, setBusinessName] = useState('');
  const [website, setWebsite] = useState('');
  const [hasNoWebsite, setHasNoWebsite] = useState(false);
  const [isValidUrl, setIsValidUrl] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [businessLookupEnabled, setBusinessLookupEnabled] = useState(false);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [businessDataLoaded, setBusinessDataLoaded] = useState(false);
  const [businessLookupData, setBusinessLookupData] = useState<any>(null);

  // Language data loading with browser locale detection
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
        setPartnerId(data.id);

        // Check if business lookup is enabled for this partner
        try {
          const settingsResponse = await fetch(`/api/whitelabel/settings/${data.id}`);
          if (settingsResponse.ok) {
            const settingsData = await settingsResponse.json();
            setBusinessLookupEnabled(settingsData.businessLookupEnabled || false);
          }
        } catch (settingsErr) {
          clientLogger.error('Error fetching partner settings', settingsErr as Error, {
            component: 'Step1BusinessInfo',
            operation: 'fetch_partner_settings'
          });
          // Default to disabled if settings fetch fails
          setBusinessLookupEnabled(false);
        }
      } catch (err) {
        clientLogger.error('Error fetching branding', err as Error, {
          component: 'Step1BusinessInfo',
          operation: 'fetch_branding'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchBranding();
  }, []);

  // Auto-fill form data from localStorage if available
  useEffect(() => {
    if (hasBusinessLookupData()) {
      const autoFillData = getAutoFillData();
      if (autoFillData.businessName) {
        setBusinessName(autoFillData.businessName);
        setWebsite(autoFillData.website || '');
        setHasNoWebsite(!autoFillData.hasWebsite);
        setBusinessDataLoaded(true);
        clientLogger.info('Auto-filled form data from localStorage', {
          component: 'Step1BusinessInfo',
          hasBusinessData: true,
          businessName: autoFillData.name
        });
      }
    }
  }, []);

  // Load language data with browser locale priority
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
        clientLogger.error('Failed to load language data', error as Error, {
          component: 'Step1BusinessInfo',
          operation: 'load_language_data'
        });
        // Fallback to English
        try {
          const { languageData: fallbackData } = await loadLanguageDataWithLocale('en');
          setLanguageData(fallbackData);
          setSelectedLanguage('en');
        } catch (fallbackError) {
          clientLogger.error('Failed to load fallback language data', fallbackError as Error, {
            component: 'Step1BusinessInfo',
            operation: 'load_fallback_language'
          });
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

  // Handle business selection from autocomplete
  const handleBusinessSelect = (business: any) => {
    clientLogger.info('Selected business data', {
      component: 'Step1BusinessInfo',
      businessName: business.name,
      hasWebsite: business.hasWebsite,
      rating: business.rating
    });

    setBusinessName(business.name);
    setBusinessDataLoaded(true);

    // Auto-fill website if available and not manually set
    if (business.website && !website && !hasNoWebsite) {
      setWebsite(business.website);
      setHasNoWebsite(false);
    } else if (!business.hasWebsite) {
      // If business has no website, suggest checking the "no website" option
      setHasNoWebsite(true);
      setWebsite('');
    }

    // Save comprehensive business data using utility function
    saveBusinessInfo({
      name: business.name,
      address: business.address,
      phone: business.phone,
      website: business.website,
      rating: business.rating,
      totalReviews: business.totalReviews,
      businessType: business.types?.[0],
      coordinates: business.coordinates,
      priceLevel: business.priceLevel,
      businessStatus: business.businessStatus,
      openingHours: business.openingHours,
      amenities: business.amenities,
      hasWebsite: business.hasWebsite,
      step1Completed: false
    });

    // Save country from business lookup for phone number provisioning
    if (business.country) {
      localStorage.setItem('onboarding_country', business.country);
    }

    // Store business lookup data for database saving
    setBusinessLookupData(business);
  };

  // Validate URL format
  useEffect(() => {
    // If no website checkbox is checked, URL validation is not needed
    if (hasNoWebsite) {
      setIsValidUrl(true);
      return;
    }

    if (!website || website.trim().length < 4) {
      setIsValidUrl(false);
      return;
    }

    try {
      // Clean up the website input
      let cleanUrl = website.trim().toLowerCase();

      // Remove common prefixes if present
      cleanUrl = cleanUrl.replace(/^(https?:\/\/)?(www\.)?/, '');

      // Must have at least domain.tld format (minimum 4 chars like a.co)
      if (cleanUrl.length < 4) {
        setIsValidUrl(false);
        return;
      }

      // Must contain at least one dot
      if (!cleanUrl.includes('.')) {
        setIsValidUrl(false);
        return;
      }

      // Add https:// and www. prefix for validation
      const fullUrl = `https://www.${cleanUrl}`;

      // Validate using URL constructor
      const urlObj = new URL(fullUrl);

      // Additional validation: must have a valid domain structure
      const hostname = urlObj.hostname;
      const parts = hostname.split('.');

      // Must have at least 2 parts (domain.tld) after www
      if (parts.length < 3) { // www.domain.tld = 3 parts minimum
        setIsValidUrl(false);
        return;
      }

      // Each part must be valid (no empty parts, valid characters)
      const isValidDomain = parts.every(part =>
        part.length > 0 &&
        /^[a-zA-Z0-9-]+$/.test(part) &&
        !part.startsWith('-') &&
        !part.endsWith('-')
      ) &&
      hostname.length > 6 && // minimum: www.a.co = 7 chars
      /^[a-zA-Z0-9.-]+$/.test(hostname);

      setIsValidUrl(isValidDomain);
    } catch (error) {
      setIsValidUrl(false);
    }
  }, [website, hasNoWebsite]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!businessName.trim() || (!hasNoWebsite && (!website.trim() || !isValidUrl))) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Save business info using utility function and mark step as completed
      saveBusinessInfo({
        name: businessName.trim(),
        website: hasNoWebsite ? '' : website.trim(),
        hasWebsite: !hasNoWebsite,
        step1Completed: true
      });

      markStepCompleted(1);

      // Legacy localStorage for backward compatibility
      localStorage.setItem('onboarding_businessName', businessName.trim());
      localStorage.setItem('onboarding_website', hasNoWebsite ? '' : website.trim());
      localStorage.setItem('onboarding_hasNoWebsite', hasNoWebsite.toString());

      // Save prospect data to database
      const hostname = window.location.hostname;
      let subdomain = '';

      if (hostname.includes('.lvh.me')) {
        subdomain = hostname.split('.')[0];
      } else if (hostname.includes('.knotie-ai.pro')) {
        subdomain = hostname.split('.')[0];
      } else if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
        subdomain = hostname;
      }

      if (subdomain) {
        try {
          // Get partner ID from branding
          const brandingResponse = await fetch(`/api/whitelabel/branding/${subdomain}`);
          if (brandingResponse.ok) {
            const brandingData = await brandingResponse.json();

            // Save prospect to database
            await fetch('/api/whitelabel/prospects', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                partnerId: brandingData.id,
                step: 1,
                data: {
                  businessName: businessName.trim(),
                  businessWebsite: hasNoWebsite ? null : website.trim(),
                  hasNoWebsite: hasNoWebsite,
                  currentStep: hasNoWebsite ? 3 : 2,
                  // Include business lookup data if available
                  ...(businessLookupData && {
                    businessLookupData: businessLookupData,
                    businessRating: businessLookupData.rating ? parseFloat(businessLookupData.rating.toString()) : null,
                    businessPhone: businessLookupData.phone,
                    businessAddress: businessLookupData.address,
                    businessTypes: businessLookupData.types,
                    businessReviewsCount: businessLookupData.totalReviews,
                    businessWebsiteVerified: !!businessLookupData.website,
                    businessLookupTimestamp: new Date().toISOString(),
                    businessCountry: businessLookupData.country || 'GB' // Use detected country from business lookup
                  })
                }
              })
            });
          }
        } catch (dbError) {
          clientLogger.error('Error saving prospect to database', dbError as Error, {
            component: 'Step1BusinessInfo',
            operation: 'save_prospect',
            businessName
          });
          // Continue with navigation even if database save fails
        }
      }

      // Navigate to next step - skip step 2 if no website
      const nextStepNumber = hasNoWebsite ? 3 : 2;
      navigateToOnboardingStep(nextStepNumber);
    } catch (error) {
      clientLogger.error('Error submitting business info', error as Error, {
        component: 'Step1BusinessInfo',
        operation: 'submit_business_info',
        businessName
      });
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

  const brandName = branding?.characterName || branding?.businessName || 'Your AI Assistant';

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
              {getTranslation('saas.onboarding.step1.stepIndicator')}
            </div>
          </div>
        </div>
        
        {/* Progress Bar - Integrated into Header */}
        <div className="w-full">
          <div className="h-1.5 bg-gray-100">
            <div 
              className="h-1.5 rounded-r-full transition-all duration-500 ease-out"
              style={{ 
                width: '11.11%', // 1/9 steps
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
            {getTranslation('saas.onboarding.step1.title')}
          </h1>
          <p className="text-lg text-gray-600 max-w-lg mx-auto leading-relaxed">
            {getTranslation('saas.onboarding.step1.subtitle')}
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          onSubmit={handleSubmit}
          className="bg-white rounded-3xl shadow-2xl shadow-blue-900/5 p-8 border border-white/50"
        >
          {/* Business Name Field */}
          <div className="mb-8">
            <label htmlFor="businessName" className="block text-sm font-bold text-gray-900 mb-2.5">
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center mr-3 text-blue-600">
                  <FiHome className="text-lg" />
                </div>
                {getTranslation('saas.onboarding.step1.businessName')}
              </div>
            </label>

            {businessLookupEnabled && partnerId ? (
              <>
                <div className="relative group">
                  <BusinessLookupAutocomplete
                    value={businessName}
                    onChange={setBusinessName}
                    onBusinessSelect={handleBusinessSelect}
                    placeholder={getTranslation('saas.onboarding.step1.businessNamePlaceholder')}
                    partnerId={partnerId}
                    className="w-full px-5 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900 bg-gray-50/50 group-hover:bg-white shadow-sm"
                  />
                </div>
                {businessDataLoaded && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-3 p-4 bg-green-50/50 border border-green-100 rounded-xl"
                  >
                    <p className="text-sm text-green-700 flex items-center font-medium">
                      <span className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center mr-2 text-green-600 text-xs">✓</span>
                      Business found! We've auto-filled your details.
                    </p>
                  </motion.div>
                )}
              </>
            ) : (
              <input
                type="text"
                id="businessName"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder={getTranslation('saas.onboarding.step1.businessNamePlaceholder')}
                className="w-full px-5 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900 bg-gray-50/50 hover:bg-white shadow-sm placeholder:text-gray-400"
                required
              />
            )}
          </div>

          {/* Website Field */}
          <div className="mb-8">
            <label htmlFor="website" className="block text-sm font-bold text-gray-900 mb-2.5">
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center mr-3 text-purple-600">
                  <FiGlobe className="text-lg" />
                </div>
                {getTranslation('saas.onboarding.step1.website')}
              </div>
            </label>
            <div className="relative">
              <input
                type="text"
                id="website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder={getTranslation('saas.onboarding.step1.websitePlaceholder')}
                disabled={hasNoWebsite}
                className={`w-full px-5 py-4 border rounded-xl transition-all text-gray-900 shadow-sm placeholder:text-gray-400 ${
                  hasNoWebsite
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
                    : `bg-gray-50/50 hover:bg-white ${
                        website && !isValidUrl
                          ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500'
                          : 'border-gray-200 focus:ring-blue-500/20 focus:border-blue-500'
                      }`
                }`}
                required={!hasNoWebsite}
              />
              {website && isValidUrl && !hasNoWebsite && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-green-500 bg-white rounded-full shadow-sm">
                  <FiCheck className="w-5 h-5" />
                </div>
              )}
            </div>
            
            {website && !isValidUrl && !hasNoWebsite && (
              <p className="text-red-500 text-sm mt-2 ml-1 font-medium">
                Please enter a valid website URL
              </p>
            )}
            
            {hasNoWebsite && businessDataLoaded && (
              <p className="text-blue-500 text-sm mt-2 ml-1 flex items-center font-medium">
                <span className="mr-1">ℹ️</span>
                No website found - you can add one later
              </p>
            )}
          </div>

          {/* No Website Checkbox */}
          <div className="mb-10">
            <label className="flex items-center space-x-3 cursor-pointer group">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={hasNoWebsite}
                  onChange={(e) => {
                    setHasNoWebsite(e.target.checked);
                    if (e.target.checked) {
                      setWebsite('');
                    }
                  }}
                  className="peer w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 transition-all cursor-pointer"
                />
              </div>
              <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors font-medium">
                {getTranslation('saas.onboarding.step1.noWebsite')}
              </span>
            </label>
          </div>

          {/* Action Buttons */}
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
              type="submit"
              disabled={!businessName.trim() || (!hasNoWebsite && (!website.trim() || !isValidUrl)) || isSubmitting}
              className={`flex-1 w-full py-4 px-6 rounded-xl font-bold text-white shadow-sm transition-all duration-300 ${
                !businessName.trim() || (!hasNoWebsite && (!website.trim() || !isValidUrl)) || isSubmitting
                  ? 'bg-gray-300 cursor-not-allowed opacity-80'
                  : 'hover:shadow-xl hover:scale-[1.02]'
              }`}
              style={{
                background: (!businessName.trim() || (!hasNoWebsite && (!website.trim() || !isValidUrl)) || isSubmitting)
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
                  {getTranslation('saas.onboarding.step1.continue')}
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
