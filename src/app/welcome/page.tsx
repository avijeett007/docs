'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PortalTheme } from '@/lib/portalThemes';
import LandingTemplate from '@/components/whitelabel/LandingTemplate';
import { ToastProvider } from '@/components/toast/ToasterProvider';
import { usePartnerBranding } from '@/lib/partnerBranding';


export default function WhiteLabelWelcomePage() {
  const router = useRouter();
  const { branding, loading } = usePartnerBranding();
  const [selectedTheme, setSelectedTheme] = useState<PortalTheme>(PortalTheme.MODERN);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partnerSubdomain, setPartnerSubdomain] = useState<string | null>(null);


  // Environment variable to control redirection behavior
  // Redirection is disabled by default, only enabled when set to 'true'
  const enableWelcomeRedirect = process.env.NEXT_PUBLIC_ENABLE_WELCOME_REDIRECT === 'true';

  // Extract subdomain or custom domain from query parameter or URL
  useEffect(() => {
    // Check URL parameters for subdomain
    const urlParams = new URLSearchParams(window.location.search);
    const subdomainParam = urlParams.get('subdomain');

    if (subdomainParam) {
      setPartnerSubdomain(subdomainParam);
      console.log('Subdomain from params:', subdomainParam);
    } else {
      // Try to extract from hostname if not in params
      const hostname = window.location.hostname;

      // Check if this is a subdomain (knotie-ai.pro or lvh.me for local dev)
      if (hostname.includes('knotie-ai.pro') || hostname.includes('lvh.me')) {
        // For subdomains of knotie-ai.pro or lvh.me
        if (!hostname.startsWith('www.')) {
          const extractedSubdomain = hostname.split('.')[0];
          setPartnerSubdomain(extractedSubdomain);
          console.log('Subdomain from hostname:', extractedSubdomain);
        }
      } else {
        // For custom domains, we'll use the generic API which relies on middleware
        console.log('Custom domain detected:', hostname);
        // We don't set a subdomain here, we'll use the generic API
      }
    }
  }, []);

  // Set theme based on branding data
  useEffect(() => {
    if (branding && branding.themePreference) {
      console.log('🎨 WELCOME PAGE - Setting theme from branding:', branding.themePreference);
      if (Object.values(PortalTheme).includes(branding.themePreference as PortalTheme)) {
        setSelectedTheme(branding.themePreference as PortalTheme);
      }
    }
  }, [branding]);

  // Check if user is already authenticated
  useEffect(() => {
    // Check for customer token in cookies
    const checkAuth = async () => {
      try {
        // Simple check for existing customer token
        const token = document.cookie
          .split('; ')
          .find(row => row.startsWith('customer_token='));

        if (token) {
          // Token exists, redirect to dashboard
          setIsAuthenticated(true);
          // Short delay to allow branding to load
          setTimeout(() => {
            router.push('/whitelabel/dashboard');
          }, 200);
        }
      } catch (err) {
        console.error('Error checking authentication:', err);
        setError('Error verifying authentication status');
      }
    };

    // Check auth once the component is mounted
    checkAuth();
  }, [router]);

  // Handle SaaS mode and custom domain redirection logic
  useEffect(() => {
    if (!loading && branding) {
      // Set document title based on partner branding
      const pageTitle = branding.portalTitle || `${branding.businessName} Portal`;
      document.title = pageTitle;
      console.log('Setting document title to:', pageTitle);

      // SaaS mode redirection is now handled in the layout
      // This ensures a single, smooth transition without multiple loading states

      // Check if this is a custom domain
      const hostname = window.location.hostname;
      const isCustomDomain = !hostname.includes('knotie-ai.pro') &&
                            !hostname.includes('localhost') &&
                            !hostname.includes('127.0.0.1') &&
                            !hostname.includes('lvh.me');

      // For custom domains, redirect to /whitelabel after a short delay (only if enabled)
      if (isCustomDomain && enableWelcomeRedirect) {
        console.log('Custom domain detected, will redirect to /whitelabel shortly');
        setTimeout(() => {
          router.push('/whitelabel');
        }, 500);
      } else if (isCustomDomain && !enableWelcomeRedirect) {
        console.log('Custom domain detected, but redirection is disabled by default (set NEXT_PUBLIC_ENABLE_WELCOME_REDIRECT=true to enable)');
      }
    }
  }, [loading, branding, router, enableWelcomeRedirect]);



  // Show loading state while branding is being fetched
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading portal...</p>
          {branding && (
            <p className="mt-2 text-sm text-blue-300">Applying {branding.businessName} branding...</p>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center max-w-lg px-6">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-200 mb-2">Portal Unavailable</h1>
          <p className="text-gray-400 mb-4">We're sorry, this portal is currently unavailable. Please try again later or contact support.</p>
          <p className="text-sm text-gray-500">Error: {error}</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  // Create the branding object with the same structure as the main whitelabel page
  const brandingToPass = {
    businessName: branding.businessName || 'Knotie AI',
    logo: branding.logo,
    subdomain: partnerSubdomain, // Add subdomain for newsletter API
    logoSize: branding.logoSize || 'medium',
    primaryColor: branding.primaryColor || '#3B82F6',
    secondaryColor: branding.secondaryColor || '#10B981',
    fontFamily: branding.fontFamily || 'Inter',
    portalTitle: branding.portalTitle || 'Voice AI Portal',
    portalSlogan: branding.portalSlogan || 'Powered by advanced voice AI technology',
    themePreference: branding.themePreference,
    portalMode: branding.portalMode || 'BASIC', // Add portal mode for conditional rendering
    enableCustomerSignup: branding.enableCustomerSignup,
    voiceAiAgentEnabled: branding.voiceAiAgentEnabled,
    voiceAiAgentPricingNote: branding.voiceAiAgentPricingNote,
    voiceAiAgentSpecialOffer: branding.voiceAiAgentSpecialOffer,
    voiceAiAgentLanguage: 'en',
    voiceAiAgentVoiceConfig: null,
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
    // Landing Page Content - THIS IS THE KEY FIX!
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
    statusPageUrl: branding.statusPageUrl
  };

  console.log('🎉 WELCOME PAGE - Using usePartnerBranding hook with testimonials:', brandingToPass.testimonials);
  console.log('🎉 WELCOME PAGE - Portal mode:', branding.portalMode);
  console.log('🎉 WELCOME PAGE - Theme preference:', brandingToPass.themePreference);

  // Use the same LandingTemplate component as the main white-label page
  // Theme styling is now handled by the layout.tsx file
  return (
    <ToastProvider>
      <LandingTemplate
        theme={selectedTheme}
        branding={brandingToPass}
        isLoading={loading}
      />
    </ToastProvider>
  );

}
