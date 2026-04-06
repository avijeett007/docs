'use client';

import React, { useEffect, useState } from 'react';
import { usePartnerBranding } from '@/lib/partnerBranding';
import LandingTemplate from '@/components/whitelabel/LandingTemplate';
import { PortalTheme } from '@/lib/portalThemes';
import { ToastProvider } from '@/components/toast/ToasterProvider';

export default function WhiteLabelHomePage() {
  const { branding } = usePartnerBranding();
  const [selectedTheme, setSelectedTheme] = useState<PortalTheme>(PortalTheme.MODERN);
  const [subdomain, setSubdomain] = useState<string | null>(null);

  // Extract subdomain and check if the partner has a preferred theme stored in the partner data
  useEffect(() => {
    // Extract subdomain from hostname (same logic as fetchPartnerBranding)
    let extractedSubdomain = null;
    const hostname = window.location.hostname;

    // Try to extract subdomain from hostname
    if (hostname.includes('.knotie-ai.pro') && !hostname.startsWith('www.')) {
      extractedSubdomain = hostname.split('.')[0];
    } else if (hostname.includes('.lvh.me')) {
      extractedSubdomain = hostname.split('.')[0];
    }

    // Also check URL parameters
    if (!extractedSubdomain) {
      const urlParams = new URLSearchParams(window.location.search);
      const paramSubdomain = urlParams.get('subdomain');
      if (paramSubdomain) {
        extractedSubdomain = paramSubdomain;
      }
    }

    setSubdomain(extractedSubdomain);

    // In the future, we can fetch the partner's preferred theme from the API
    // For now, we'll use the themePreference from branding if it exists
    const partnerTheme = (branding as any).themePreference as PortalTheme | undefined;
    if (partnerTheme && Object.values(PortalTheme).includes(partnerTheme)) {
      setSelectedTheme(partnerTheme);
    }

    // Log the branding data for debugging
    console.log('Whitelabel page branding data:', branding);
    console.log('Whitelabel page enableCustomerSignup:', branding?.enableCustomerSignup);
    console.log('Whitelabel page extracted subdomain:', extractedSubdomain);
  }, [branding]);

  // Create the branding object with explicit logging
  const brandingToPass = {
    businessName: branding.businessName || 'Knotie AI',
    logo: branding.logo,
    subdomain: subdomain, // Add subdomain for newsletter API
    logoSize: branding.logoSize || 'medium',
    primaryColor: branding.primaryColor || '#3B82F6',
    secondaryColor: branding.secondaryColor || '#10B981',
    fontFamily: branding.fontFamily || 'Inter',
    portalTitle: branding.portalTitle || 'Voice AI Portal',
    portalSlogan: branding.portalSlogan || 'Powered by advanced voice AI technology',
    themePreference: branding.themePreference,
    enableCustomerSignup: branding.enableCustomerSignup,
    voiceAiAgentEnabled: branding.voiceAiAgentEnabled,
    voiceAiAgentPricingNote: branding.voiceAiAgentPricingNote,
    voiceAiAgentSpecialOffer: branding.voiceAiAgentSpecialOffer,
    voiceAiAgentLanguage: 'en',
    voiceAiAgentVoiceConfig: null,
    // Multi-language support
    basicPortalLanguage: branding.basicPortalLanguage || 'en',
    saasPortalLanguage: branding.saasPortalLanguage || 'en',
    // Footer Section Controls
    showQuickLinks: branding.showQuickLinks,
    showResources: branding.showResources,
    showNewsletter: branding.showNewsletter,
    showLegal: branding.showLegal,
    showSocialMedia: branding.showSocialMedia,
    showContactInfo: branding.showContactInfo,
    showCommunity: branding.showCommunity,
    communityUrl: branding.communityUrl,
    moreTestimonialsUrl: branding.moreTestimonialsUrl,
    // Landing Page Content
    testimonials: branding.testimonials,
    faqs: branding.faqs,
    features: branding.features,
    trustIndicators: branding.trustIndicators,
    // Social Media Links
    twitterUrl: branding.twitterUrl,
    linkedinUrl: branding.linkedinUrl,
    facebookUrl: branding.facebookUrl,
    instagramUrl: branding.instagramUrl,
    // Contact Information
    supportEmail: branding.supportEmail,
    companyAddress: branding.companyAddress,
    companyPhone: branding.companyPhone,
    // Legal Links
    privacyPolicyUrl: branding.privacyPolicyUrl,
    termsOfServiceUrl: branding.termsOfServiceUrl,
    statusPageUrl: branding.statusPageUrl,
    // AI Translation System
    translatedTexts: (branding as any)?.translatedTexts,
    translationEnabled: (branding as any)?.translationEnabled
  };

  console.log('CRITICAL - Passing enableCustomerSignup to LandingTemplate:', brandingToPass.enableCustomerSignup);
  console.log('CRITICAL - Type of enableCustomerSignup:', typeof brandingToPass.enableCustomerSignup);
  console.log('🔍 WHITELABEL PAGE - Footer controls being passed to LandingTemplate:');
  console.log('  showQuickLinks:', brandingToPass.showQuickLinks);
  console.log('  showSocialMedia:', brandingToPass.showSocialMedia);
  console.log('  twitterUrl:', brandingToPass.twitterUrl);
  console.log('  linkedinUrl:', brandingToPass.linkedinUrl);
  console.log('🌐 WHITELABEL PAGE - Language settings being passed to LandingTemplate:');
  console.log('  basicPortalLanguage:', brandingToPass.basicPortalLanguage);
  console.log('  saasPortalLanguage:', brandingToPass.saasPortalLanguage);
  console.log('  Original branding basicPortalLanguage:', branding.basicPortalLanguage);
  console.log('  Original branding saasPortalLanguage:', branding.saasPortalLanguage);
  console.log('🔧 WHITELABEL PAGE - AI Translation fields being passed to LandingTemplate:');
  console.log('  translatedTexts:', brandingToPass.translatedTexts ? 'Present' : 'Missing');
  console.log('  translationEnabled:', brandingToPass.translationEnabled);
  console.log('  Original branding translatedTexts:', (branding as any)?.translatedTexts ? 'Present' : 'Missing');

  return (
    <ToastProvider>
      <LandingTemplate
        theme={selectedTheme}
        branding={brandingToPass}
      />
    </ToastProvider>
  );
}
