'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import HeroSection from './sections/HeroSection';
import FeaturesSection from './sections/FeaturesSection';
import PricingSection from './sections/PricingSection';
import TestimonialsSection from './sections/TestimonialsSection';
import FAQsSection from './sections/FAQsSection';
import TrustIndicatorsSection from './sections/TrustIndicatorsSection';
import FooterSection from './sections/FooterSection';
import { PartnerBranding } from '@/types/partner';
import { LanguageData, loadLanguageDataWithLocale, SupportedLanguage } from '@/lib/languages';

interface SaaSLandingPageProps {}

export default function SaaSLandingPage({}: SaaSLandingPageProps) {
  const [branding, setBranding] = useState<PartnerBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [languageData, setLanguageData] = useState<LanguageData | null>(null);
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>('en');
  const searchParams = useSearchParams();

  useEffect(() => {
    const fetchBrandingAndLanguage = async () => {
      try {
        // Get the current hostname to determine the partner
        const hostname = window.location.hostname;
        let apiEndpoint = '';

        // Determine the correct API endpoint based on hostname
        if (hostname.includes('.lvh.me')) {
          // Local development subdomain
          const subdomain = hostname.split('.')[0];
          apiEndpoint = `/api/whitelabel/branding/${subdomain}`;
        } else if (hostname.includes('.knotie-ai.pro')) {
          // Production subdomain
          const subdomain = hostname.split('.')[0];
          apiEndpoint = `/api/whitelabel/branding/${subdomain}`;
        } else if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
          // Custom domain - use the domain-specific API endpoint
          apiEndpoint = `/api/whitelabel/branding/domain/${hostname}`;
        } else {
          throw new Error('Unable to determine partner from hostname');
        }

        if (!apiEndpoint) {
          throw new Error('Unable to determine partner from hostname');
        }

        console.log(`🔍 SaaSLandingPage: Fetching branding from ${apiEndpoint}`);
        const response = await fetch(apiEndpoint);
        if (!response.ok) {
          throw new Error(`Failed to fetch partner branding: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('🔍 SaaSLandingPage: Received branding data:', data);
        setBranding(data);

        // Load language data based on partner language preference
        const { languageData: langData, selectedLanguage } = await loadLanguageDataWithLocale(data.language);
        setLanguageData(langData);
        setCurrentLanguage(selectedLanguage);
      } catch (err) {
        console.error('Error fetching branding:', err);
        setError(err instanceof Error ? err.message : 'Failed to load branding');
      } finally {
        setLoading(false);
      }
    };

    fetchBrandingAndLanguage();
  }, []);

  // Helper function to get translated text for SaaS landing page
  const getTranslation = useCallback((key: string, fallback?: string): string => {
    if (!languageData) return fallback || key;

    // Navigate to the nested key in saas.landing
    const keys = key.split('.');
    let value: unknown = languageData.saas?.landing;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        return fallback || key;
      }
    }

    if (typeof value === 'string') {
      // Replace {brandName} placeholder
      const brandName = branding?.characterName || branding?.businessName || 'AI Assistant';
      return value.replace(/\{brandName\}/g, brandName);
    }

    return fallback || key;
  }, [languageData, branding]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{languageData?.saas?.landing?.loading || 'Loading your AI receptionist experience...'}</p>
        </div>
      </div>
    );
  }

  if (error || !branding) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{languageData?.saas?.landing?.error?.title || 'Service Unavailable'}</h1>
          <p className="text-gray-600 mb-4">
            {error || languageData?.saas?.landing?.error?.message || 'Unable to load the AI receptionist service. Please try again later.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg transition-colors"
          >
            {languageData?.saas?.landing?.error?.tryAgain || 'Try Again'}
          </button>
        </div>
      </div>
    );
  }

  // Determine the brand name to use
  const brandName = branding.characterName || branding.businessName || 'AI Assistant';
  const isFreeTrial = branding.freeTrialEnabled || false;

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <HeroSection
        branding={branding}
        brandName={brandName}
        isFreeTrial={isFreeTrial}
        getTranslation={getTranslation}
      />

      {/* Features Section */}
      <FeaturesSection
        branding={branding}
        brandName={brandName}
        getTranslation={getTranslation}
      />

      {/* Pricing Section (only shown for fixed price model) */}
      <PricingSection
        branding={branding}
        getTranslation={getTranslation}
      />

      {/* Testimonials Section */}
      <TestimonialsSection
        branding={branding}
        getTranslation={getTranslation}
      />

      {/* Trust Indicators Section */}
      <TrustIndicatorsSection
        branding={branding}
        getTranslation={getTranslation}
      />

      {/* FAQs Section */}
      <FAQsSection
        branding={branding}
        getTranslation={getTranslation}
      />

      {/* Footer Section */}
      <FooterSection
        branding={branding}
        getTranslation={getTranslation}
      />
    </div>
  );
}
