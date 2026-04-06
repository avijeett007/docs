'use client';

import React, { useEffect, useState } from 'react';
import { loadLanguageDataWithLocale, getTranslatedText, type LanguageData } from '@/lib/languages';

export default function TestTranslations() {
  const [languageData, setLanguageData] = useState<LanguageData | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadLanguage = async () => {
      try {
        setLoading(true);
        console.log('🧪 Test: Loading Spanish language data...');
        
        const { languageData: data, selectedLanguage: lang } = await loadLanguageDataWithLocale('es');
        
        console.log('🧪 Test: Language data loaded:', !!data);
        console.log('🧪 Test: Selected language:', lang);
        console.log('🧪 Test: Sample translations:', {
          heroTitle: data?.dashboard?.hero?.defaultTitle,
          featuresTitle: data?.dashboard?.features?.title,
          loginText: data?.dashboard?.hero?.getStarted
        });
        
        setLanguageData(data);
        setSelectedLanguage(lang);
      } catch (err) {
        console.error('🧪 Test: Failed to load language data:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    loadLanguage();
  }, []);

  const getTranslation = (path: string, customText?: string) => {
    if (!languageData) return customText || path;
    return getTranslatedText(languageData, path, customText, 'Test Brand');
  };

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Translation Test</h1>
        <p>Loading translations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Translation Test</h1>
        <p className="text-red-600">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Translation Test</h1>
      <p className="mb-4">Selected Language: <strong>{selectedLanguage}</strong></p>
      
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Hero Section:</h2>
          <p>Title: {getTranslation('dashboard.hero.defaultTitle')}</p>
          <p>Login: {getTranslation('dashboard.hero.login')}</p>
          <p>Get Started: {getTranslation('dashboard.hero.getStarted')}</p>
        </div>
        
        <div>
          <h2 className="text-lg font-semibold">Features Section:</h2>
          <p>Title: {getTranslation('dashboard.features.title')}</p>
          <p>Subtitle: {getTranslation('dashboard.features.subtitle')}</p>
        </div>
        
        <div>
          <h2 className="text-lg font-semibold">Footer Section:</h2>
          <p>Product: {getTranslation('dashboard.footer.product')}</p>
          <p>Support: {getTranslation('dashboard.footer.support')}</p>
          <p>Stay Updated: {getTranslation('dashboard.footer.stayUpdated')}</p>
        </div>
      </div>
      
      <div className="mt-8 p-4 bg-gray-100 rounded">
        <h3 className="font-semibold mb-2">Debug Info:</h3>
        <p>Language Data Loaded: {languageData ? 'Yes' : 'No'}</p>
        <p>Dashboard Object: {languageData?.dashboard ? 'Yes' : 'No'}</p>
        <p>Hero Object: {languageData?.dashboard?.hero ? 'Yes' : 'No'}</p>
      </div>
    </div>
  );
}
