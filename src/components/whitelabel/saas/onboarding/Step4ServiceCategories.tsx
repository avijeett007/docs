'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiArrowRight, FiCheck, FiPlus, FiAlertTriangle } from 'react-icons/fi';
import { PartnerBranding } from '@/types/partner';
import { SERVICE_CATEGORIES, POPULAR_CATEGORIES, ServiceCategory, mapBusinessCategoryToServices } from '@/lib/serviceCategories';
import { saveProspectProgress } from '@/lib/prospectTracker';
import { navigateToOnboardingStep } from '@/lib/onboardingNavigation';
import { loadLanguageDataWithLocale, getTranslatedText, type LanguageData, type SupportedLanguage } from '@/lib/languages';

interface Step4ServiceCategoriesProps {}

interface WebsiteAnalysis {
  businessName: string;
  websiteTitle: string;
  businessDescription: string;
  businessCategory: string;
  contactInfo: {
    phone?: string | null;
    email?: string | null;
    address?: string | null;
  };
  services: string[];
}

export default function Step4ServiceCategories({}: Step4ServiceCategoriesProps) {
  const [branding, setBranding] = useState<PartnerBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [customServices, setCustomServices] = useState('');
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [websiteAnalysis, setWebsiteAnalysis] = useState<WebsiteAnalysis | null>(null);
  const [showBackWarning, setShowBackWarning] = useState(false);

  // Language data loading
  const [languageData, setLanguageData] = useState<LanguageData | null>(null);
  const [languageLoading, setLanguageLoading] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>('en');

  // Fetch partner branding and load website analysis data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch partner branding
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

        // Load website analysis data from localStorage (saved in Step 2)
        const storedAnalysis = localStorage.getItem('onboarding_websiteAnalysis');
        if (storedAnalysis) {
          try {
            const analysis: WebsiteAnalysis = JSON.parse(storedAnalysis);
            setWebsiteAnalysis(analysis);

            // Pre-select service categories based on AI analysis
            const suggestedCategories = mapBusinessCategoryToServices(
              analysis.businessCategory,
              analysis.services
            );

            if (suggestedCategories.length > 0) {
              setSelectedCategories(suggestedCategories);
            }
          } catch (parseError) {
            console.error('Error parsing website analysis:', parseError);
          }
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Load language data
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const { languageData: data, selectedLanguage } = await loadLanguageDataWithLocale();
        setLanguageData(data);
        setSelectedLanguage(selectedLanguage);
      } catch (error) {
        console.error('Error loading language data:', error);
      } finally {
        setLanguageLoading(false);
      }
    };

    loadLanguage();
  }, []);

  // Intercept browser back button on Step 4
  useEffect(() => {
    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
      setShowBackWarning(true);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleStartOver = () => {
    const keysToRemove = [
      'knotie_onboarding_data',
      'onboarding_businessName',
      'onboarding_website',
      'onboarding_hasNoWebsite',
      'onboarding_firstName',
      'onboarding_lastName',
      'onboarding_email',
      'onboarding_phone',
      'onboarding_prospectId',
      'onboarding_websiteAnalysis',
      'onboarding_serviceCategories',
      'onboarding_customServices',
    ];
    keysToRemove.forEach(key => localStorage.removeItem(key));
    navigateToOnboardingStep(1);
  };

  // Helper function to get translated text
  const getTranslation = (path: string, customText?: string) => {
    if (!languageData) return customText || path;
    return getTranslatedText(languageData, path, customText, branding?.businessName);
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev => 
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedCategories.length === 0 && !customServices.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      // Save selected categories and custom services to localStorage
      localStorage.setItem('onboarding_serviceCategories', JSON.stringify(selectedCategories));
      localStorage.setItem('onboarding_customServices', customServices.trim());

      // Save prospect progress to database
      await saveProspectProgress(4, {
        serviceCategories: selectedCategories,
        customServices: customServices.trim()
      });

      navigateToOnboardingStep(5);
    } catch (error) {
      console.error('Error submitting service categories:', error);
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
  const categoriesToShow = showAllCategories ? SERVICE_CATEGORIES : POPULAR_CATEGORIES;

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
              {getTranslation('saas.onboarding.step4.stepIndicator')}
            </div>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full">
          <div className="h-1.5 bg-gray-100">
            <div
              className="h-1.5 rounded-r-full transition-all duration-500 ease-out"
              style={{
                width: '44.44%', // 4/9 steps
                background: `linear-gradient(90deg, ${branding?.primaryColor || '#3B82F6'}, ${branding?.secondaryColor || '#8B5CF6'})`
              }}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4 tracking-tight">
            {getTranslation('saas.onboarding.step4.title')}
          </h1>
          <p className="text-lg text-gray-600 max-w-lg mx-auto leading-relaxed">
            {getTranslation('saas.onboarding.step4.subtitle')}
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          onSubmit={handleSubmit}
          className="bg-white rounded-3xl shadow-2xl shadow-blue-900/5 p-8 border border-white/50"
        >
          {/* AI-Suggested Categories (if available) */}
          {websiteAnalysis && selectedCategories.length > 0 && (
            <div className="mb-8 p-4 bg-green-50/50 border border-green-100 rounded-xl">
              <h3 className="text-lg font-semibold text-green-800 mb-2 flex items-center">
                <FiCheck className="mr-2" />
                {getTranslation('saas.onboarding.step4.aiSuggested')}
              </h3>
              <p className="text-sm text-green-700 mb-3">
                {getTranslation('saas.onboarding.step4.aiSuggestedDesc')}
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                {selectedCategories.map(categoryId => {
                  const category = SERVICE_CATEGORIES.find(c => c.id === categoryId);
                  return category ? (
                    <span
                      key={categoryId}
                      className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full border border-green-200 font-medium"
                    >
                      {category.name}
                    </span>
                  ) : null;
                })}
              </div>
              <div className="text-xs text-green-600 font-medium">
                <strong>{getTranslation('saas.onboarding.step4.detectedFrom')}</strong> {websiteAnalysis.businessCategory}
                {websiteAnalysis.services.length > 0 && (
                  <span> • Services: {websiteAnalysis.services.slice(0, 3).join(', ')}{websiteAnalysis.services.length > 3 ? '...' : ''}</span>
                )}
              </div>
            </div>
          )}

          {/* Service Categories Grid */}
          <div className="mb-8">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {showAllCategories ? getTranslation('saas.onboarding.step4.allServices') : getTranslation('saas.onboarding.step4.popularServices')}
              {websiteAnalysis && selectedCategories.length > 0 && (
                <span className="text-sm font-normal text-gray-500 ml-2">
                  (You can add more or remove any selections)
                </span>
              )}
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
              {categoriesToShow.map((category: ServiceCategory) => (
                <motion.button
                  key={category.id}
                  type="button"
                  onClick={() => toggleCategory(category.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                    selectedCategories.includes(category.id)
                      ? 'border-blue-500 bg-blue-50/50 text-blue-700 shadow-sm'
                      : 'border-gray-100 hover:border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold">{category.name}</span>
                    {selectedCategories.includes(category.id) && (
                      <FiCheck className="text-blue-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{category.description}</p>
                </motion.button>
              ))}
            </div>

            {/* Show More/Less Button */}
            <button
              type="button"
              onClick={() => setShowAllCategories(!showAllCategories)}
              className="text-blue-600 hover:text-blue-700 text-sm font-bold flex items-center mt-4 transition-colors"
            >
              <FiPlus className={`mr-1 transition-transform duration-300 ${showAllCategories ? 'rotate-45' : ''}`} />
              {showAllCategories ? getTranslation('saas.onboarding.step4.showFewer') : getTranslation('saas.onboarding.step4.showAll')}
            </button>
          </div>

          {/* Custom Services */}
          <div className="mb-8">
            <label htmlFor="customServices" className="block text-sm font-bold text-gray-900 mb-2.5">
              {getTranslation('saas.onboarding.step4.otherServices')}
            </label>
            <textarea
              id="customServices"
              value={customServices}
              onChange={(e) => setCustomServices(e.target.value)}
              placeholder={getTranslation('saas.onboarding.step4.otherServicesPlaceholder')}
              rows={3}
              className="w-full px-5 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none text-gray-900 bg-gray-50/50 hover:bg-white shadow-sm placeholder:text-gray-400"
            />
            <p className="text-gray-500 text-xs mt-2 ml-1">
              {getTranslation('saas.onboarding.step4.otherServicesHint')}
            </p>
          </div>

          {/* Selected Categories Summary */}
          {selectedCategories.length > 0 && (
            <div className="mb-8 p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
              <h4 className="font-bold text-blue-800 mb-3 text-sm uppercase tracking-wide">
                Selected Services ({selectedCategories.length}):
              </h4>
              <div className="flex flex-wrap gap-2">
                {selectedCategories.map(categoryId => {
                  const category = SERVICE_CATEGORIES.find(c => c.id === categoryId);
                  return category ? (
                    <span
                      key={categoryId}
                      className="px-3 py-1 bg-white text-blue-700 text-sm rounded-lg border border-blue-100 shadow-sm font-medium"
                    >
                      {category.name}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-2">
            <button
              type="submit"
              disabled={(selectedCategories.length === 0 && !customServices.trim()) || isSubmitting}
              className={`flex-1 w-full py-4 px-6 rounded-xl font-bold text-white shadow-sm transition-all duration-300 ${
                (selectedCategories.length === 0 && !customServices.trim()) || isSubmitting
                  ? 'bg-gray-300 cursor-not-allowed opacity-80'
                  : 'hover:shadow-xl hover:scale-[1.02]'
              }`}
              style={{
                background: ((selectedCategories.length === 0 && !customServices.trim()) || isSubmitting)
                  ? '#D1D5DB'
                  : `linear-gradient(135deg, ${branding?.primaryColor || '#3B82F6'}, ${branding?.secondaryColor || '#8B5CF6'})`
              }}
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  {getTranslation('saas.onboarding.step4.processing')}
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  {getTranslation('saas.onboarding.step4.continue')}
                  <FiArrowRight className="ml-2" />
                </div>
              )}
            </button>
          </div>
        </motion.form>
      </div>

      {/* Back Warning Modal */}
      {showBackWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4"
          >
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-amber-100 mx-auto mb-5">
              <FiAlertTriangle className="text-amber-500 text-2xl" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 text-center mb-3">
              Are you sure you want to go back?
            </h2>
            <p className="text-gray-600 text-center mb-7 leading-relaxed">
              Going back from this point will restart your onboarding from the beginning. Your progress so far will be lost.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setShowBackWarning(false)}
                className="flex-1 py-3 px-6 rounded-xl font-semibold border-2 border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-all duration-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartOver}
                className="flex-1 py-3 px-6 rounded-xl font-semibold text-white bg-red-500 hover:bg-red-600 transition-all duration-200"
              >
                Start Over
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
