'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiArrowLeft, FiArrowRight, FiPlus, FiX } from 'react-icons/fi';
import { PartnerBranding } from '@/types/partner';
import { saveProspectProgress } from '@/lib/prospectTracker';
import { navigateToOnboardingStep, navigateToPreviousOnboardingStep } from '@/lib/onboardingNavigation';
import { loadLanguageDataWithLocale, getTranslatedText, type LanguageData, type SupportedLanguage } from '@/lib/languages';

interface Step7InformationCollectionProps {}

const DEFAULT_INFO_FIELDS = [
  { id: 'name', label: 'Customer Name', required: true },
  { id: 'phone', label: 'Phone Number', required: true },
  { id: 'email', label: 'Email Address', required: false },
  { id: 'service', label: 'Service Needed', required: true },
  { id: 'preferred_time', label: 'Preferred Appointment Time', required: false },
];

export default function Step7InformationCollection({}: Step7InformationCollectionProps) {
  const [branding, setBranding] = useState<PartnerBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFields, setSelectedFields] = useState<string[]>(['name', 'phone', 'service']);
  const [customFields, setCustomFields] = useState<Array<{id: string, label: string, required: boolean}>>([]);
  const [newFieldLabel, setNewFieldLabel] = useState('');
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

  const toggleField = (fieldId: string) => {
    setSelectedFields(prev => 
      prev.includes(fieldId)
        ? prev.filter(id => id !== fieldId)
        : [...prev, fieldId]
    );
  };

  const addCustomField = () => {
    if (!newFieldLabel.trim()) return;
    
    const customField = {
      id: `custom_${Date.now()}`,
      label: newFieldLabel.trim(),
      required: false
    };
    
    setCustomFields(prev => [...prev, customField]);
    setSelectedFields(prev => [...prev, customField.id]);
    setNewFieldLabel('');
  };

  const removeCustomField = (fieldId: string) => {
    setCustomFields(prev => prev.filter(field => field.id !== fieldId));
    setSelectedFields(prev => prev.filter(id => id !== fieldId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedFields.length === 0) return;

    setIsSubmitting(true);
    try {
      // Save information collection settings to localStorage
      localStorage.setItem('onboarding_collectName', selectedFields.includes('name').toString());
      localStorage.setItem('onboarding_collectEmail', selectedFields.includes('email').toString());
      localStorage.setItem('onboarding_collectPhone', selectedFields.includes('phone').toString());
      localStorage.setItem('onboarding_collectCompany', selectedFields.includes('company').toString());
      localStorage.setItem('onboarding_customFields', JSON.stringify(customFields));

      // Save prospect progress to database with complete information collection settings
      const allSelectedFields = [...DEFAULT_INFO_FIELDS, ...customFields].filter(field =>
        selectedFields.includes(field.id)
      );

      await saveProspectProgress(7, {
        informationSettings: {
          selectedFields: selectedFields,
          allFields: allSelectedFields,
          collectName: selectedFields.includes('name'),
          collectEmail: selectedFields.includes('email'),
          collectPhone: selectedFields.includes('phone'),
          collectService: selectedFields.includes('service'),
          collectPreferredTime: selectedFields.includes('preferred_time'),
          collectCompany: selectedFields.includes('company'),
          customFields: customFields
        }
      });

      navigateToOnboardingStep(8);
    } catch (error) {
      console.error('Error submitting information collection:', error);
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

  const allFields = [...DEFAULT_INFO_FIELDS, ...customFields];

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
              {getTranslation('saas.onboarding.step7.stepIndicator')}
            </div>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full">
          <div className="h-1.5 bg-gray-100">
            <div
              className="h-1.5 rounded-r-full transition-all duration-500 ease-out"
              style={{
                width: '77.77%', // 7/9 steps
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
            {getTranslation('saas.onboarding.step7.title')}
          </h1>
          <p className="text-lg text-gray-600 max-w-lg mx-auto leading-relaxed">
            {getTranslation('saas.onboarding.step7.subtitle')}
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          onSubmit={handleSubmit}
          className="bg-white rounded-3xl shadow-2xl shadow-blue-900/5 p-8 border border-white/50"
        >
          {/* Default Fields */}
          <div className="mb-8">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <span className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center mr-3 text-blue-600">1</span>
              {getTranslation('saas.onboarding.step7.standardInfo')}
            </h3>
            <div className="space-y-3">
              {DEFAULT_INFO_FIELDS.map((field) => (
                <label key={field.id} className="flex items-center p-4 border border-gray-100 rounded-xl hover:border-gray-200 hover:bg-gray-50/50 transition-all cursor-pointer group">
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedFields.includes(field.id)}
                      onChange={() => toggleField(field.id)}
                      className="peer w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 transition-all cursor-pointer"
                    />
                  </div>
                  <span className="ml-3 text-gray-700 font-medium group-hover:text-gray-900">{getTranslation(`saas.onboarding.step7.fields.${field.id}`, field.label)}</span>
                  {field.required && (
                    <span className="ml-auto text-[10px] uppercase font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full tracking-wide">
                      {getTranslation('saas.onboarding.step7.required')}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Custom Fields */}
          <div className="mb-8">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <span className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center mr-3 text-purple-600">2</span>
              {getTranslation('saas.onboarding.step7.customInfo')}
            </h3>
            
            {/* Add Custom Field */}
            <div className="flex space-x-2 mb-4">
              <input
                type="text"
                value={newFieldLabel}
                onChange={(e) => setNewFieldLabel(e.target.value)}
                placeholder={getTranslation('saas.onboarding.step7.customFieldPlaceholder')}
                className="flex-1 px-5 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900 bg-gray-50/50 hover:bg-white shadow-sm placeholder:text-gray-400"
              />
              <button
                type="button"
                onClick={addCustomField}
                disabled={!newFieldLabel.trim()}
                className="px-5 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-200 disabled:cursor-not-allowed shadow-sm hover:shadow-md transition-all font-bold"
              >
                <FiPlus className="text-xl" />
              </button>
            </div>

            {/* Custom Fields List */}
            {customFields.length > 0 && (
              <div className="space-y-2">
                {customFields.map((field) => (
                  <div key={field.id} className="flex items-center justify-between p-4 bg-purple-50/30 border border-purple-100 rounded-xl">
                    <label className="flex items-center space-x-3 cursor-pointer flex-1">
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedFields.includes(field.id)}
                          onChange={() => toggleField(field.id)}
                          className="peer w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 transition-all cursor-pointer"
                        />
                      </div>
                      <span className="text-gray-700 font-medium">{field.label}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => removeCustomField(field.id)}
                      className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <FiX />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
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
              disabled={selectedFields.length === 0 || isSubmitting}
              className={`flex-1 w-full py-4 px-6 rounded-xl font-bold text-white shadow-sm transition-all duration-300 ${
                selectedFields.length === 0 || isSubmitting
                  ? 'bg-gray-300 cursor-not-allowed opacity-80'
                  : 'hover:shadow-xl hover:scale-[1.02]'
              }`}
              style={{
                background: (selectedFields.length === 0 || isSubmitting)
                  ? '#D1D5DB'
                  : `linear-gradient(135deg, ${branding?.primaryColor || '#3B82F6'}, ${branding?.secondaryColor || '#8B5CF6'})`
              }}
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  {getTranslation('saas.onboarding.step7.processing')}
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  {getTranslation('saas.onboarding.step7.continue')}
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
