'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiArrowLeft, FiArrowRight, FiUpload, FiGlobe, FiFileText, FiSkipForward, FiPlus } from 'react-icons/fi';
import { PartnerBranding } from '@/types/partner';
import { saveProspectProgress } from '@/lib/prospectTracker';
import { navigateToOnboardingStep, navigateToPreviousOnboardingStep } from '@/lib/onboardingNavigation';
import { getBusinessInfo } from '@/lib/onboarding-storage';
import { loadLanguageDataWithLocale, getTranslatedText, type LanguageData, type SupportedLanguage } from '@/lib/languages';

interface Step5KnowledgeBaseProps {}

export default function Step5KnowledgeBase({}: Step5KnowledgeBaseProps) {
  const [branding, setBranding] = useState<PartnerBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'upload' | 'website'>('upload');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [websiteUrls, setWebsiteUrls] = useState<string[]>(['']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [websiteAutoPopulated, setWebsiteAutoPopulated] = useState(false);

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

  // Auto-populate website URL from Step 1 business info
  useEffect(() => {
    // Try to get website from onboarding storage first
    const businessInfo = getBusinessInfo();
    let savedWebsite = businessInfo?.website;

    // Fallback to legacy localStorage if not found
    if (!savedWebsite) {
      savedWebsite = localStorage.getItem('onboarding_website') || '';
    }

    // If we have a website URL and it's not already populated, set it
    if (savedWebsite && savedWebsite.trim() !== '') {
      // Ensure URL has protocol
      let fullUrl = savedWebsite.trim();
      if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
        fullUrl = `https://${fullUrl}`;
      }

      // Only set if websiteUrls is still the default empty state
      setWebsiteUrls(currentUrls => {
        // Check if it's the initial empty state or doesn't already contain this URL
        if (currentUrls.length === 1 && currentUrls[0] === '') {
          setWebsiteAutoPopulated(true);
          return [fullUrl];
        }
        // Don't duplicate if URL already exists
        if (currentUrls.includes(fullUrl)) {
          return currentUrls;
        }
        return currentUrls;
      });
    }
  }, []); // Run once on mount

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

  // Helper function to get translated text
  const getTranslation = (path: string, customText?: string) => {
    if (!languageData) return customText || path;
    return getTranslatedText(languageData, path, customText, branding?.businessName);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setUploadedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const addWebsiteUrl = () => {
    setWebsiteUrls(prev => [...prev, '']);
  };

  const updateWebsiteUrl = (index: number, url: string) => {
    setWebsiteUrls(prev => prev.map((u, i) => i === index ? url : u));
  };

  const removeWebsiteUrl = (index: number) => {
    setWebsiteUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Check if user is logged in (has customer token cookie) or in first-time onboarding (prospect token)
      const prospectToken = localStorage.getItem('onboarding_prospectToken');

      // Create headers - if user is logged in, cookies will be sent automatically
      // If user is in first-time onboarding, use prospect token
      const authHeaders: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      // Only add prospect token if we have one (for first-time onboarding)
      if (prospectToken) {
        authHeaders['Authorization'] = `Bearer ${prospectToken}`;
        console.log('Using prospect token for authentication');
      } else {
        console.log('Using customer token cookie for authentication');
      }

      // Step 1: Create or get default knowledge base
      let knowledgeBaseId: string;

      // First, check if customer already has a knowledge base
      const kbListResponse = await fetch('/api/whitelabel/knowledge-base', {
        headers: authHeaders
      });

      if (kbListResponse.ok) {
        const kbData = await kbListResponse.json();
        const existingKB = kbData.knowledgeBases?.find((kb: any) => kb.name === 'Onboarding Knowledge Base');

        if (existingKB) {
          knowledgeBaseId = existingKB.id;
          console.log('✅ Using existing knowledge base:', knowledgeBaseId);
        } else {
          // Create new knowledge base
          const createKBResponse = await fetch('/api/whitelabel/knowledge-base', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
              name: 'Onboarding Knowledge Base',
              description: 'Knowledge base created during onboarding process'
            })
          });

          if (!createKBResponse.ok) {
            throw new Error('Failed to create knowledge base');
          }

          const newKB = await createKBResponse.json();
          knowledgeBaseId = newKB.knowledgeBase.id;
          console.log('✅ Created new knowledge base:', knowledgeBaseId);
        }
      } else {
        throw new Error('Failed to access knowledge base system');
      }

      // Step 2: Upload files FIRST (sequentially to ensure workspace is created once)
      // This ensures the AnythingLLM workspace is created and stored in the knowledge base
      // before we attempt to add website URLs, preventing duplicate workspace creation
      const uploadResults = [];
      for (const file of uploadedFiles) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('knowledgeBaseId', knowledgeBaseId);
        formData.append('description', `File uploaded during onboarding: ${file.name}`);

        // Create headers for file upload (only add Authorization if we have prospect token)
        const uploadHeaders: Record<string, string> = {};
        if (prospectToken) {
          uploadHeaders['Authorization'] = `Bearer ${prospectToken}`;
        }

        try {
          const uploadResponse = await fetch('/api/whitelabel/knowledge-base/file', {
            method: 'POST',
            headers: uploadHeaders,
            body: formData
          });

          if (!uploadResponse.ok) {
            console.error(`Failed to upload file: ${file.name}`);
            uploadResults.push(null);
          } else {
            const result = await uploadResponse.json();
            console.log(`✅ Uploaded file: ${file.name}`);
            uploadResults.push(result);
          }
        } catch (error) {
          console.error(`Error uploading file: ${file.name}`, error);
          uploadResults.push(null);
        }
      }

      // Step 3: Add website URLs AFTER files (sequentially to use the same workspace)
      const validUrls = websiteUrls.filter(url => url.trim() !== '');
      const urlResults = [];
      for (const url of validUrls) {
        // Ensure URL has protocol
        const fullUrl = url.startsWith('http') ? url : `https://${url}`;

        try {
          const urlResponse = await fetch('/api/whitelabel/knowledge-base/website-urls', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
              knowledgeBaseId: knowledgeBaseId,
              baseUrl: fullUrl,
              selectedPages: [{ url: fullUrl, title: `Website: ${fullUrl}` }],
              scrapingFrequency: '24h'
            })
          });

          if (!urlResponse.ok) {
            console.error(`Failed to add website URL: ${url}`);
            urlResults.push(null);
          } else {
            const result = await urlResponse.json();
            console.log(`✅ Added website URL: ${url}`);
            urlResults.push(result);
          }
        } catch (error) {
          console.error(`Error adding website URL: ${url}`, error);
          urlResults.push(null);
        }
      }

      // All uploads and URL additions complete (processed sequentially)

      // Save prospect progress to database
      await saveProspectProgress(5, {
        knowledgeBaseFiles: uploadedFiles.map(f => f.name),
        knowledgeBaseUrls: validUrls
      });

      console.log('✅ Knowledge base setup completed successfully');
      navigateToOnboardingStep(6);
    } catch (error) {
      console.error('Error submitting knowledge base:', error);

      // Provide more helpful error messages
      let errorMessage = 'Failed to process knowledge base. Please try again.';
      if (error instanceof Error) {
        if (error.message.includes('Unauthorized') || error.message.includes('401')) {
          errorMessage = 'Authentication failed. Please refresh the page and try again, or restart the onboarding process.';
        } else if (error.message.includes('Failed to create knowledge base')) {
          errorMessage = 'Unable to create knowledge base. Please check your connection and try again.';
        } else {
          errorMessage = error.message;
        }
      }

      alert(errorMessage);
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    window.location.href = '/platform/onboarding/6';
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
              {getTranslation('saas.onboarding.step5.stepIndicator')}
            </div>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full">
          <div className="h-1.5 bg-gray-100">
            <div
              className="h-1.5 rounded-r-full transition-all duration-500 ease-out"
              style={{
                width: '55.55%', // 5/9 steps
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
            {getTranslation('saas.onboarding.step5.title')}
          </h1>
          <p className="text-lg text-gray-600 max-w-lg mx-auto leading-relaxed">
            {getTranslation('saas.onboarding.step5.subtitle')}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white rounded-3xl shadow-2xl shadow-blue-900/5 p-8 border border-white/50"
        >
          {/* Tab Navigation */}
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 mb-8">
            <button
              type="button"
              onClick={() => setSelectedTab('upload')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                selectedTab === 'upload'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FiUpload className="inline mr-2" />
              {getTranslation('saas.onboarding.step5.uploadTab')}
            </button>
            <button
              type="button"
              onClick={() => setSelectedTab('website')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                selectedTab === 'website'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FiGlobe className="inline mr-2" />
              {getTranslation('saas.onboarding.step5.websiteTab')}
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Upload Tab */}
            {selectedTab === 'upload' && (
              <div className="space-y-6">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
                  <FiFileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <span className="text-lg font-medium text-gray-900">{getTranslation('saas.onboarding.step5.dragDrop')}</span>
                    <p className="text-gray-500 mt-2">{getTranslation('saas.onboarding.step5.fileSupport')}</p>
                    <input
                      id="file-upload"
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <div className="mt-4">
                      <span className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
                        Choose Files
                      </span>
                    </div>
                  </label>
                </div>

                {/* Uploaded Files List */}
                {uploadedFiles.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-900">Uploaded Files:</h4>
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-700">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Website Tab */}
            {selectedTab === 'website' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {getTranslation('saas.onboarding.step5.addUrls')}
                  </label>

                  {/* Auto-populated notification */}
                  {websiteAutoPopulated && websiteUrls.length > 0 && websiteUrls[0] !== '' && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-700 flex items-center">
                        <span className="mr-2">✅</span>
                        {getTranslation('saas.onboarding.step5.websiteHint')}
                      </p>
                    </div>
                  )}

                  {websiteUrls.map((url, index) => (
                    <div key={index} className="flex space-x-2 mb-2">
                      <input
                        type="url"
                        value={url}
                        onChange={(e) => updateWebsiteUrl(index, e.target.value)}
                        placeholder="https://www.yourbusiness.com/about"
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                      />
                      {websiteUrls.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeWebsiteUrl(index)}
                          className="px-3 py-2 text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addWebsiteUrl}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    {getTranslation('saas.onboarding.step5.addMoreUrls')}
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-4 mt-8">
              <button
                type="button"
                onClick={() => navigateToPreviousOnboardingStep()}
                className="group py-4 px-8 rounded-xl font-medium border-2 border-gray-300 text-gray-600 hover:text-gray-900 hover:border-gray-400 hover:bg-gray-50 transition-all duration-200"
              >
                <div className="flex items-center justify-center">
                  <FiArrowLeft className="mr-2 transition-transform duration-200 group-hover:-translate-x-1" />
                  Back
                </div>
              </button>

              <button
                type="button"
                onClick={handleSkip}
                className="flex-1 py-4 px-6 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <FiSkipForward className="inline mr-2" />
                {getTranslation('saas.onboarding.step5.skip')}
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-4 px-6 rounded-lg font-semibold text-white transition-all duration-300 hover:shadow-lg transform hover:scale-105"
                style={{
                  background: `linear-gradient(135deg, ${branding?.primaryColor || '#3B82F6'}, ${branding?.secondaryColor || '#8B5CF6'})`
                }}
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    {getTranslation('saas.onboarding.step5.processing')}
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    {getTranslation('saas.onboarding.step5.continue')}
                    <FiArrowRight className="ml-2" />
                  </div>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
