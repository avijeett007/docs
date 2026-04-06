'use client';

import React, { useState, useEffect } from 'react';
import WhitelabelLayout from '@/components/whitelabel/WhitelabelLayout';
import AgentConversations from '@/components/whitelabel/AgentConversations';
import { usePartnerBranding } from '@/lib/partnerBranding';
import { loadLanguageDataWithLocale, getTranslatedText, type LanguageData, type SupportedLanguage } from '@/lib/languages';

export default function WhiteLabelConversationsPage() {
  const { branding } = usePartnerBranding();

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

  return (
    <WhitelabelLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 text-white">{getTranslation('portal.conversations.title', 'Chat logs')}</h1>
        <p className="text-gray-400">{getTranslation('portal.conversations.subtitle', 'Conversation details and transcript')}</p>
      </div>

      <AgentConversations />
    </WhitelabelLayout>
  );
}
