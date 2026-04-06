'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiArrowLeft, FiArrowRight, FiUser, FiMail, FiPhone, FiGlobe } from 'react-icons/fi';
import { PartnerBranding } from '@/types/partner';
import { saveProspectProgress } from '@/lib/prospectTracker';
import { navigateToOnboardingStep, navigateToPreviousRoute } from '@/lib/onboardingNavigation';
import { loadLanguageDataWithLocale, getTranslatedText, type LanguageData, type SupportedLanguage } from '@/lib/languages';

// Supported countries for phone number provisioning
const SUPPORTED_COUNTRIES = [
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'IE', name: 'Ireland' },
  { code: 'AT', name: 'Austria' },
  { code: 'BE', name: 'Belgium' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'PL', name: 'Poland' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
  { code: 'NZ', name: 'New Zealand' },
];


interface Step3CustomerDetailsProps {}

export default function Step3CustomerDetails({}: Step3CustomerDetailsProps) {
  const [branding, setBranding] = useState<PartnerBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    country: 'GB', // Default to UK
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [existingProspectInfo, setExistingProspectInfo] = useState<any>(null);

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
      } catch (err) {
        console.error('Error fetching branding:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBranding();
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

  // Load saved country from localStorage (from Google Maps lookup or previous session)
  useEffect(() => {
    const savedCountry = localStorage.getItem('onboarding_country');
    if (savedCountry && SUPPORTED_COUNTRIES.some(c => c.code === savedCountry)) {
      setFormData(prev => ({ ...prev, country: savedCountry }));
    }
  }, []);

  // Helper function to get translated text
  const getTranslation = (path: string, customText?: string) => {
    if (!languageData) return customText || path;
    return getTranslatedText(languageData, path, customText, branding?.businessName);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear email error when user starts typing
    if (field === 'email') {
      setEmailError('');
      setShowLoginPrompt(false);
    }
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const isValidPhone = (phone: string) => {
    return /^[\+]?[1-9][\d]{0,15}$/.test(phone.replace(/[\s\-\(\)]/g, ''));
  };

  const isFormValid = () => {
    return (
      formData.firstName.trim() &&
      formData.lastName.trim() &&
      formData.email.trim() &&
      isValidEmail(formData.email) &&
      formData.phone.trim() &&
      isValidPhone(formData.phone)
    );
  };

  const checkEmailExists = async (email: string, partnerId: string) => {
    try {
      const response = await fetch('/api/whitelabel/prospects/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim(), partnerId })
      });

      if (response.ok) {
        return await response.json();
      }
      return { exists: false };
    } catch (error) {
      console.error('Error checking email:', error);
      return { exists: false };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isFormValid()) return;

    setIsSubmitting(true);
    setEmailError('');
    setError('');
    setShowLoginPrompt(false);

    try {
      // Get partner ID from branding
      if (!branding?.id) {
        throw new Error('Partner information not available');
      }

      // Check if we're in a logged-in whitelabel flow
      const isLoggedInFlow = window.location.pathname.startsWith('/whitelabel/onboarding');

      if (isLoggedInFlow) {
        // Logged-in flow: Just update prospect data, customer already exists
        const prospectId = localStorage.getItem('onboarding_prospectId');

        if (!prospectId) {
          throw new Error('Prospect ID not found. Please start from the beginning.');
        }

        // Save customer details to localStorage for later steps
        localStorage.setItem('onboarding_firstName', formData.firstName.trim());
        localStorage.setItem('onboarding_lastName', formData.lastName.trim());
        localStorage.setItem('onboarding_email', formData.email.trim());
        localStorage.setItem('onboarding_phone', formData.phone.trim());
        localStorage.setItem('onboarding_country', formData.country);

        // Update prospect progress (including businessCountry for phone provisioning)
        await saveProspectProgress(3, {
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          businessCountry: formData.country
        });

        // Continue to next step
        navigateToOnboardingStep(4);
        return;
      }

      // Original pre-login flow continues below...
      // Check if email already exists
      const emailCheck = await checkEmailExists(formData.email.trim(), branding.id);

      if (emailCheck.exists) {
        setEmailError(emailCheck.message);
        setExistingProspectInfo(emailCheck);
        setShowLoginPrompt(true);
        setIsSubmitting(false);
        return;
      }

      // Get current prospect ID from localStorage or create new one
      let prospectId = localStorage.getItem('onboarding_prospectId');

      if (!prospectId) {
        // Create new prospect first
        await saveProspectProgress(1, {
          businessName: localStorage.getItem('onboarding_businessName') || '',
          businessWebsite: localStorage.getItem('onboarding_businessWebsite') || ''
        });
        prospectId = localStorage.getItem('onboarding_prospectId');
      }

      if (!prospectId) {
        throw new Error('Failed to create prospect record');
      }

      // Convert prospect to customer and send credentials
      const convertResponse = await fetch('/api/whitelabel/prospects/convert-to-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospectId: prospectId,
          partnerId: branding.id,
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          businessName: localStorage.getItem('onboarding_businessName') || ''
        })
      });

      if (!convertResponse.ok) {
        const errorData = await convertResponse.json();

        // Handle specific error cases
        if (errorData.error === 'CUSTOMER_ALREADY_EXISTS') {
          setError(errorData.message || 'It looks like you already have an account with us.');
          setShowLoginPrompt(true);
          return;
        }

        throw new Error(errorData.error || 'Failed to create customer account');
      }

      const customerData = await convertResponse.json();

      // Save customer details to localStorage for later steps
      localStorage.setItem('onboarding_firstName', formData.firstName.trim());
      localStorage.setItem('onboarding_lastName', formData.lastName.trim());
      localStorage.setItem('onboarding_email', formData.email.trim());
      localStorage.setItem('onboarding_phone', formData.phone.trim());
      localStorage.setItem('onboarding_country', formData.country);
      localStorage.setItem('onboarding_customerId', customerData.customer.id);

      // Generate prospect token for subsequent onboarding steps
      try {
        const tokenResponse = await fetch('/api/whitelabel/onboarding/prospect-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            prospectId: prospectId,
            customerId: customerData.customer.id,
            partnerId: branding.id,
            email: formData.email.trim()
          })
        });

        if (tokenResponse.ok) {
          const tokenData = await tokenResponse.json();
          // Store prospect token for use in subsequent steps
          localStorage.setItem('onboarding_prospectToken', tokenData.prospectToken);
          console.log('✅ Prospect token generated and stored for onboarding steps');
        } else {
          console.error('Failed to generate prospect token');
        }
      } catch (tokenError) {
        console.error('Error generating prospect token:', tokenError);
        // Continue anyway - this is not critical for the flow
      }

      // Update prospect progress (including businessCountry for phone provisioning)
      await saveProspectProgress(3, {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        businessCountry: formData.country
      });

      // Continue to next step silently (customer account created in background)
      navigateToOnboardingStep(4);

    } catch (error) {
      console.error('Error submitting customer details:', error);
      setEmailError(error instanceof Error ? error.message : 'An error occurred. Please try again.');
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
              {getTranslation('saas.onboarding.step3.stepIndicator')}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full">
          <div className="h-1.5 bg-gray-100">
            <div 
              className="h-1.5 rounded-r-full transition-all duration-500 ease-out"
              style={{ 
                width: '33.33%', // 3/9 steps
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
            {getTranslation('saas.onboarding.step3.title')}
          </h1>
          <p className="text-lg text-gray-600 max-w-lg mx-auto leading-relaxed">
            {getTranslation('saas.onboarding.step3.subtitle')}
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          onSubmit={handleSubmit}
          className="bg-white rounded-3xl shadow-2xl shadow-blue-900/5 p-8 border border-white/50"
        >
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* First Name */}
            <div>
              <label htmlFor="firstName" className="block text-sm font-bold text-gray-900 mb-2.5">
                <div className="flex items-center">
                  <FiUser className="mr-2 text-gray-400" />
                  First Name
                </div>
              </label>
              <input
                type="text"
                id="firstName"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                placeholder="First name"
                className="w-full px-5 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900 bg-gray-50/50 hover:bg-white shadow-sm placeholder:text-gray-400"
                required
              />
            </div>

            {/* Last Name */}
            <div>
              <label htmlFor="lastName" className="block text-sm font-bold text-gray-900 mb-2.5">
                Last Name
              </label>
              <input
                type="text"
                id="lastName"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                placeholder="Last name"
                className="w-full px-5 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900 bg-gray-50/50 hover:bg-white shadow-sm placeholder:text-gray-400"
                required
              />
            </div>
          </div>

          {/* Email */}
          <div className="mb-6">
            <label htmlFor="email" className="block text-sm font-bold text-gray-900 mb-2.5">
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center mr-3 text-blue-600">
                  <FiMail className="text-lg" />
                </div>
                Email Address
              </div>
            </label>
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="you@company.com"
              className={`w-full px-5 py-4 border rounded-xl transition-all text-gray-900 shadow-sm placeholder:text-gray-400 ${
                formData.email && !isValidEmail(formData.email)
                  ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500 bg-red-50/30'
                  : 'border-gray-200 focus:ring-blue-500/20 focus:border-blue-500 bg-gray-50/50 hover:bg-white'
              }`}
              required
            />
            {formData.email && !isValidEmail(formData.email) && (
              <p className="text-red-500 text-sm mt-2 font-medium">
                Please enter a valid email address
              </p>
            )}
            {emailError && (
              <p className="text-red-500 text-sm mt-2 font-medium">
                {emailError}
              </p>
            )}
          </div>

          {/* Phone */}
          <div className="mb-6">
            <label htmlFor="phone" className="block text-sm font-bold text-gray-900 mb-2.5">
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center mr-3 text-green-600">
                  <FiPhone className="text-lg" />
                </div>
                Phone Number
              </div>
            </label>
            <input
              type="tel"
              id="phone"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              placeholder="+1 (555) 123-4567"
              className={`w-full px-5 py-4 border rounded-xl transition-all text-gray-900 shadow-sm placeholder:text-gray-400 ${
                formData.phone && !isValidPhone(formData.phone)
                  ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500 bg-red-50/30'
                  : 'border-gray-200 focus:ring-blue-500/20 focus:border-blue-500 bg-gray-50/50 hover:bg-white'
              }`}
              required
            />
            {formData.phone && !isValidPhone(formData.phone) && (
              <p className="text-red-500 text-sm mt-2 font-medium">
                Please enter a valid phone number
              </p>
            )}
            <p className="text-gray-500 text-xs mt-2 ml-1">
              We'll use this to notify you when your AI receptionist is ready
            </p>
          </div>

          {/* Country Selection */}
          <div className="mb-8">
            <label htmlFor="country" className="block text-sm font-bold text-gray-900 mb-2.5">
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center mr-3 text-purple-600">
                  <FiGlobe className="text-lg" />
                </div>
                Business Country
              </div>
            </label>
            <div className="relative">
              <select
                id="country"
                value={formData.country}
                onChange={(e) => handleInputChange('country', e.target.value)}
                className="w-full px-5 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900 bg-gray-50/50 hover:bg-white shadow-sm appearance-none cursor-pointer"
                required
              >
                {SUPPORTED_COUNTRIES.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            <p className="text-gray-500 text-xs mt-2 ml-1">
              This determines the phone number region for your AI receptionist
            </p>
          </div>

          {/* Login Prompt for Existing Users */}
          {showLoginPrompt && (existingProspectInfo || error) && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <FiMail className="h-5 w-5 text-blue-400 mt-0.5" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    Account Already Exists
                  </h3>
                  <div className="mt-2 text-sm text-blue-700">
                    {error ? (
                      <>
                        <p>{error}</p>
                        <p className="mt-2">
                          <a
                            href="/whitelabel/login"
                            className="font-medium underline hover:text-blue-600"
                          >
                            Click here to log in and access your dashboard
                          </a>
                        </p>
                      </>
                    ) : existingProspectInfo ? (
                      <>
                        <p>{existingProspectInfo.message}</p>
                        {existingProspectInfo.isCustomer ? (
                          <p className="mt-2">
                            <a
                              href="/whitelabel/login"
                              className="font-medium underline hover:text-blue-600"
                            >
                              Click here to log in and access your dashboard
                            </a>
                          </p>
                        ) : (
                          <p className="mt-2">
                            <a
                              href="/whitelabel/login"
                              className="font-medium underline hover:text-blue-600"
                            >
                              Click here to log in and continue from step {existingProspectInfo.currentStep}
                            </a>
                          </p>
                        )}
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          )}

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
              disabled={!isFormValid() || isSubmitting}
              className={`flex-1 w-full py-4 px-6 rounded-xl font-bold text-white shadow-sm transition-all duration-300 ${
                !isFormValid() || isSubmitting
                  ? 'bg-gray-300 cursor-not-allowed opacity-80'
                  : 'hover:shadow-xl hover:scale-[1.02]'
              }`}
              style={{
                background: (!isFormValid() || isSubmitting)
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
                  Continue
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
