'use client';

import React, { useEffect, useState } from 'react';
import { usePartnerBranding } from '@/lib/partnerBranding';
import { PortalTheme, getThemeConfig, animationVariants, portalThemes } from '@/lib/portalThemes';
import Image from 'next/image';
import Link from 'next/link';
import { FiArrowRight, FiMic, FiBarChart2, FiPhone, FiMessageSquare, FiMail, FiMapPin, FiExternalLink, FiTwitter, FiLinkedin, FiFacebook, FiInstagram, FiShield, FiClock, FiUsers, FiStar, FiCheckCircle, FiHelpCircle, FiLock, FiAward, FiGlobe, FiTrendingUp } from 'react-icons/fi';
import { SiGooglecalendar, SiSlack, SiShopify, SiNotion, SiAirtable, SiHubspot, SiSalesforce, SiWhatsapp, SiGmail } from 'react-icons/si';
import { FaRocket, FaFire, FaPlus } from 'react-icons/fa';
import SubscriptionPlansDisplay from './SubscriptionPlansDisplay';
import { WhitelabelConnectionProvider } from '@/hooks/useWhitelabelConnection';
import WhitelabelVoiceAgentWithLiveKit from './WhitelabelVoiceAgentWithLiveKit';
import { loadLanguageDataWithLocale, getTranslatedText, type LanguageData, type SupportedLanguage } from '@/lib/languages';
import { WhitelabelThemeToggle } from './WhitelabelThemeToggle';

// Define proper type for branding data
export interface PartnerBrandingData {
  id?: string;
  businessName: string;
  logo?: string | null;
  logoSize?: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily?: string;
  portalTitle?: string;
  portalSlogan?: string;
  customerPortalEnabled?: boolean;
  enableCustomerSignup?: boolean;
  themePreference?: string;
  basicPortalLanguage?: string;
  saasPortalLanguage?: string;
  voiceAiAgentEnabled?: boolean;
  voiceAiAgentPricingNote?: string;
  voiceAiAgentSpecialOffer?: string;
  voiceAiAgentLanguage?: string;
  voiceAiAgentVoiceConfig?: any;

  // Enhanced Landing Page Configuration
  supportEmail?: string;
  companyAddress?: string;
  companyPhone?: string;
  privacyPolicyUrl?: string;
  termsOfServiceUrl?: string;
  statusPageUrl?: string;

  // Social Media Links
  twitterUrl?: string;
  linkedinUrl?: string;
  facebookUrl?: string;
  instagramUrl?: string;

  // Landing Page Content
  testimonials?: string; // JSON string of testimonials array
  faqs?: string; // JSON string of FAQs array
  features?: string; // JSON string of enhanced features array
  trustIndicators?: string; // JSON string of trust indicators array
  moreTestimonialsUrl?: string; // URL for "More Testimonials" link

  // Footer Section Controls
  showQuickLinks?: boolean;
  showResources?: boolean;
  showNewsletter?: boolean;
  showLegal?: boolean;
  showSocialMedia?: boolean;
  showContactInfo?: boolean;

  // SaaS Portal Configuration
  characterName?: string;
  freeTrialEnabled?: boolean;
  saasOnboardingEnabled?: boolean;
  freeAiCredits?: number;
  pricingModel?: string; // 'subscription' or 'payasyougo'
  payAsYouGoRate?: number;

  // AI Translation System
  translatedTexts?: Record<string, any>; // JSON object storing translations for all languages
  translationEnabled?: boolean;
}

interface LandingTemplateProps {
  theme?: PortalTheme;
  branding?: PartnerBrandingData | null;
  isLoading?: boolean;
  error?: string | null;
  isAuthenticated?: boolean;
  subdomain?: string | null;
}

export default function LandingTemplate({
  theme = PortalTheme.MODERN,
  branding: propBranding,
  isLoading = false,
  error = null,
  isAuthenticated: _isAuthenticated = false,
  subdomain = null
}: LandingTemplateProps) {
  // Extract subdomain from window location if not provided
  const [currentSubdomain, setCurrentSubdomain] = useState<string | null>(subdomain);
  const [customDomain, setCustomDomain] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;

      // Check if it's a subdomain (knotie-ai.pro or lvh.me for local dev)
      if (hostname.includes('knotie-ai.pro') || hostname.includes('lvh.me')) {
        // Extract subdomain from knotie-ai.pro or lvh.me
        const parts = hostname.split('.');
        if (parts.length > 2 && parts[0] !== 'www') {
          setCurrentSubdomain(parts[0]);
        }
      } else {
        // It's a custom domain (not knotie-ai.pro or lvh.me)
        setCustomDomain(hostname);
      }
    }
  }, []);
  // Only use the hook if no branding is provided via props
  const { branding: hookBranding } = usePartnerBranding();

  // Prioritize props branding over hook branding
  const branding = propBranding || hookBranding;

  // Light/Dark mode state
  const [isLightMode, setIsLightMode] = useState(false);
  const themeConfig = getThemeConfig(theme, isLightMode);

  // Debug logging
  console.log('🎨 LandingTemplate Debug:', {
    isLightMode,
    theme,
    containerClass: themeConfig.styleClasses.container,
    hasLightMode: !!portalThemes[theme]?.lightMode
  });
  const [isLoaded, setIsLoaded] = useState(false);

  // Language data loading with browser locale detection
  const [languageData, setLanguageData] = useState<LanguageData | null>(null);
  const [languageLoading, setLanguageLoading] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>('en');

  // Load language data with browser locale priority
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        setLanguageLoading(true);
        console.log('🌐 LandingTemplate: Loading language data...');
        console.log('🌐 LandingTemplate: Partner basicPortalLanguage:', branding?.basicPortalLanguage);
        console.log('🌐 LandingTemplate: Full branding object:', branding);

        // Use the new function that prioritizes browser locale
        const { languageData: data, selectedLanguage: lang } = await loadLanguageDataWithLocale(
          branding?.basicPortalLanguage
        );
        console.log('🌐 LandingTemplate: Selected language after detection:', lang);
        console.log('🌐 LandingTemplate: Language data loaded successfully');
        console.log('🌐 LandingTemplate: Sample translations:', {
          heroTitle: data?.dashboard?.hero?.defaultTitle,
          featuresTitle: data?.dashboard?.features?.title,
          loginText: data?.dashboard?.hero?.getStarted
        });

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
  }, [branding?.basicPortalLanguage]);

  // Helper function to get translated text with fallback to custom partner text
  const getTranslation = (path: string, customText?: string, fieldName?: string) => {
    if (!languageData) return customText || path;
    return getTranslatedText(
      languageData,
      path,
      customText,
      branding?.businessName,
      (branding as any)?.translatedTexts,
      selectedLanguage,
      fieldName
    );
  };



  // Prepare derived branding values with fallbacks
  const brandingWithDefaults: PartnerBrandingData = {
    primaryColor: branding?.primaryColor || '#3B82F6',
    secondaryColor: branding?.secondaryColor || '#10B981',
    fontFamily: branding?.fontFamily || 'Inter',
    portalTitle: getTranslation('dashboard.hero.defaultTitle', branding?.portalTitle, 'portalTitle'),
    portalSlogan: getTranslation('dashboard.hero.defaultSlogan', branding?.portalSlogan, 'portalSlogan'),
    logo: branding?.logo || null,
    logoSize: branding?.logoSize || 'medium',
    businessName: branding?.businessName || 'Voice AI',
    enableCustomerSignup: branding?.enableCustomerSignup === true,
    voiceAiAgentEnabled: branding?.voiceAiAgentEnabled === true,
    voiceAiAgentPricingNote: branding?.voiceAiAgentPricingNote || '',
    voiceAiAgentSpecialOffer: branding?.voiceAiAgentSpecialOffer || '',
    // Enhanced Landing Page Configuration
    supportEmail: (branding as any)?.supportEmail || undefined,
    companyAddress: (branding as any)?.companyAddress || undefined,
    companyPhone: (branding as any)?.companyPhone || undefined,
    privacyPolicyUrl: (branding as any)?.privacyPolicyUrl || undefined,
    termsOfServiceUrl: (branding as any)?.termsOfServiceUrl || undefined,
    statusPageUrl: (branding as any)?.statusPageUrl || undefined,
    // Social Media Links
    twitterUrl: (branding as any)?.twitterUrl || undefined,
    linkedinUrl: (branding as any)?.linkedinUrl || undefined,
    facebookUrl: (branding as any)?.facebookUrl || undefined,
    instagramUrl: (branding as any)?.instagramUrl || undefined,
    // Landing Page Content
    testimonials: (branding as any)?.testimonials || undefined,
    faqs: (branding as any)?.faqs || undefined,
    features: (branding as any)?.features || undefined,
    trustIndicators: (branding as any)?.trustIndicators || undefined,
    // More Testimonials Link
    moreTestimonialsUrl: (branding as any)?.moreTestimonialsUrl || undefined,
  };

  // Debug logging removed for production




  // Get logo dimensions based on size setting
  const getLogoDimensions = (size: string) => {
    switch (size) {
      case 'small':
        return { width: 32, height: 32, className: 'w-8 h-8' };
      case 'medium':
        return { width: 48, height: 48, className: 'w-12 h-12' };
      case 'large':
        return { width: 64, height: 64, className: 'w-16 h-16' };
      case 'extra-large':
        return { width: 80, height: 80, className: 'w-20 h-20' };
      default:
        return { width: 48, height: 48, className: 'w-12 h-12' };
    }
  };

  const logoDimensions = getLogoDimensions(brandingWithDefaults.logoSize || 'medium');



  // Define component style based on branding
  const pageStyle: React.CSSProperties = {
    fontFamily: brandingWithDefaults.fontFamily,
  };

  // Create gradient styles
  const gradientBg = `linear-gradient(135deg, ${brandingWithDefaults.primaryColor}, ${brandingWithDefaults.secondaryColor})`;

  // Simplified text style - no gradient, just solid color for reliability
  const titleTextStyle: React.CSSProperties = {
    color: brandingWithDefaults.primaryColor,
    position: 'relative',
    zIndex: 10,
    textShadow: '0 1px 2px rgba(0,0,0,0.1)'
  };

  // Animation classes based on theme
  const baseAnimation = themeConfig.animation;
  const animationClasses = {
    header: `${animationVariants[baseAnimation].hidden}`,
    hero: `${animationVariants[baseAnimation].hidden}`,
    features: `${animationVariants[baseAnimation].hidden}`,
    cta: `${animationVariants[baseAnimation].hidden}`,
  };

  // Set animation loaded state
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Show loading state if isLoading prop is true or language data is still loading
  if (isLoading || languageLoading) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${getThemeConfig(PortalTheme.MODERN).styleClasses.container}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white">Loading portal...</p>
          {branding && (
            <p className="mt-2 text-sm text-blue-300">Applying {branding.businessName} branding...</p>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${getThemeConfig(PortalTheme.MODERN).styleClasses.container}`}>
        <div className={`text-center max-w-md mx-auto p-6 ${getThemeConfig(PortalTheme.MODERN).styleClasses.card} rounded-xl shadow-xl`}>
          <div className="text-red-500 text-6xl mb-4">!</div>
          <h2 className="text-xl font-bold text-white mb-4">Error Loading Portal</h2>
          <p className="text-gray-300 mb-6">{error}</p>
          <Link
            href="/"
            className={`px-4 py-2 text-white rounded-lg transition-colors ${getThemeConfig(PortalTheme.MODERN).styleClasses.button.secondary}`}
          >
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col ${themeConfig.styleClasses.container}`} style={pageStyle}>
      {/* Themed Top Border */}
      <div className="h-1 w-full" style={{ background: gradientBg }}></div>

      {/* Header */}
      <header className={`${themeConfig.styleClasses.header} sticky top-0 z-10 ${isLoaded ? animationVariants[baseAnimation].visible : animationClasses.header}`}>
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {brandingWithDefaults.logo ? (
              <Image
                src={brandingWithDefaults.logo}
                alt={brandingWithDefaults.businessName}
                width={logoDimensions.width}
                height={logoDimensions.height}
                className={`rounded-md object-contain`}
                style={{ maxHeight: `${logoDimensions.height}px` }}
              />
            ) : (
              <div
                className={`${logoDimensions.className} rounded-md flex items-center justify-center ${isLightMode ? 'text-white' : 'text-white'} font-bold`}
                style={{ background: gradientBg }}
              >
                {brandingWithDefaults.businessName.substring(0, 1)}
              </div>
            )}
            <span className={`${themeConfig.styleClasses.text.primary} font-medium text-lg relative z-10`}>{brandingWithDefaults.portalTitle}</span>
          </div>

          <div className="flex items-center space-x-4">
            {/* Theme Toggle */}
            <WhitelabelThemeToggle
              size="md"
              onThemeChange={setIsLightMode}
              primaryColor={brandingWithDefaults.primaryColor}
              className="mr-2"
            />

            <Link
              href="/login"
              className={`${themeConfig.styleClasses.text.secondary} hover:${themeConfig.styleClasses.text.primary} hidden sm:block transition-colors`}
            >
              {getTranslation('dashboard.hero.login')}
            </Link>
            {(brandingWithDefaults.enableCustomerSignup === true) && (
              <Link
                href="/register"
                className={`px-4 py-2 text-white text-sm font-medium ${themeConfig.styleClasses.button.primary}`}
                style={{ background: gradientBg }}
              >
                {getTranslation('dashboard.hero.getStarted')}
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className={`py-16 md:py-24 px-4 relative overflow-hidden ${isLoaded ? animationVariants[baseAnimation].visible : animationClasses.hero}`} style={{
        transitionDelay: '150ms'
      }}>
        {/* Background gradient overlay */}
        <div className={`absolute inset-0 ${isLightMode ? 'bg-gradient-to-br from-blue-50/50 to-purple-50/50' : 'bg-gradient-to-br from-gray-900/50 to-gray-800/50'}`}></div>
        <div className="relative z-10">
        <div className="container mx-auto">
          <div className={`${themeConfig.styleClasses.hero} p-8 md:p-12 max-w-6xl mx-auto`}>
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="space-y-6">
                <h1
                  className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight relative z-10"
                  style={titleTextStyle}
                >
                  {brandingWithDefaults.portalTitle}
                </h1>
                <p className="text-gray-300 text-lg md:text-xl relative z-10">
                  {brandingWithDefaults.portalSlogan}
                </p>
                <div className="pt-4 flex flex-col sm:flex-row gap-4">
                  {/* Debug info */}
                  <div style={{ display: 'none' }}>
                    {`Signup button check: ${brandingWithDefaults.enableCustomerSignup} (${typeof brandingWithDefaults.enableCustomerSignup})`}
                  </div>

                  {(brandingWithDefaults.enableCustomerSignup === true) && (
                    <Link
                      href="/register"
                      className={`px-6 py-3 text-white text-center font-medium ${isLightMode ? 'shadow-lg hover:shadow-xl transition-all duration-300' : themeConfig.styleClasses.button.primary}`}
                      style={isLightMode ? { background: gradientBg } : {}}
                    >
                      {getTranslation('dashboard.hero.startFreeTrial')}
                      <FiArrowRight className="ml-2 inline" />
                    </Link>
                  )}
                  <Link
                    href="/login"
                    className={`px-6 py-3 text-gray-300 text-center font-medium ${themeConfig.styleClasses.button.secondary}`}
                  >
                    {getTranslation('dashboard.hero.loginToDashboard')}
                  </Link>
                </div>
              </div>
              <div className="relative">
                <div className="aspect-w-16 aspect-h-9 rounded-lg overflow-hidden shadow-2xl">
                  <div className={`w-full h-full ${isLightMode ? 'bg-gradient-to-br from-gray-100 to-gray-200' : 'bg-gradient-to-br from-gray-700 to-gray-900'} flex items-center justify-center p-8`}>
                    <div className="relative w-full h-full flex items-center justify-center">
                      <div
                        className="absolute w-40 h-40 rounded-full opacity-20"
                        style={{ backgroundColor: brandingWithDefaults.primaryColor, filter: 'blur(40px)' }}
                      ></div>
                      <div
                        className="absolute w-32 h-32 rounded-full opacity-20 -translate-x-20 translate-y-10"
                        style={{ backgroundColor: brandingWithDefaults.secondaryColor, filter: 'blur(30px)' }}
                      ></div>
                      <div className="relative z-10 text-center">
                        {brandingWithDefaults.voiceAiAgentEnabled ? (
                          // Interactive Voice AI Agent
                          <WhitelabelConnectionProvider>
                            <WhitelabelVoiceAgentWithLiveKit />
                          </WhitelabelConnectionProvider>
                        ) : (
                          // Static microphone icon (original)
                          <>
                            <FiMic
                              className="mx-auto mb-4 w-16 h-16"
                              style={{ color: brandingWithDefaults.primaryColor }}
                            />
                            <p className={`${isLightMode ? 'text-gray-900' : 'text-white'} text-xl font-medium`}>Advanced Voice AI</p>
                            <p className="text-gray-400 mt-2">24/7 customer engagement</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* Enhanced Features Section */}
      <section className={`py-20 px-4 ${isLightMode ? 'bg-gray-50/50 border-t border-gray-200/50' : 'bg-gray-900/50 border-t border-gray-700/50'} ${isLoaded ? animationVariants[baseAnimation].visible : animationClasses.features}`} style={{
        transitionDelay: '300ms'
      }}>
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className={`text-4xl font-bold ${themeConfig.styleClasses.text.primary} mb-6`}>{getTranslation('dashboard.features.title')}</h2>
            <p className={`text-lg ${themeConfig.styleClasses.text.secondary} max-w-3xl mx-auto`}>
              {getTranslation('dashboard.features.subtitle')}
            </p>
          </div>

          {/* Main Features Grid */}
          {(() => {
            try {
              const featuresText = getTranslation('', branding?.features, 'features');
              const customFeatures = featuresText
                ? JSON.parse(featuresText.replace(/\r\n/g, '\n'))
                : null;

              const defaultFeatures = [
                {
                  icon: "FiPhone",
                  title: getTranslation('dashboard.features.availability.title'),
                  description: getTranslation('dashboard.features.availability.description'),
                  benefits: languageData?.dashboard?.features?.availability?.benefits || ["Never miss a call", "Instant response time", "Global timezone support"]
                },
                {
                  icon: "FiBarChart2",
                  title: getTranslation('dashboard.features.analytics.title'),
                  description: getTranslation('dashboard.features.analytics.description'),
                  benefits: languageData?.dashboard?.features?.analytics?.benefits || ["Real-time metrics", "Conversation insights", "Performance tracking"]
                },
                {
                  icon: "FiMessageSquare",
                  title: getTranslation('dashboard.features.multiChannel.title'),
                  description: getTranslation('dashboard.features.multiChannel.description'),
                  benefits: languageData?.dashboard?.features?.multiChannel?.benefits || ["Unified inbox", "Cross-platform sync", "Seamless handoffs"]
                },
                {
                  icon: "FiShield",
                  title: getTranslation('dashboard.features.security.title'),
                  description: getTranslation('dashboard.features.security.description'),
                  benefits: languageData?.dashboard?.features?.security?.benefits || ["SOC 2 compliant", "GDPR ready", "Data encryption"]
                },
                {
                  icon: "FiUsers",
                  title: getTranslation('dashboard.features.collaboration.title'),
                  description: getTranslation('dashboard.features.collaboration.description'),
                  benefits: languageData?.dashboard?.features?.collaboration?.benefits || ["Shared dashboards", "Team permissions", "Activity logs"]
                },
                {
                  icon: "FiCheckCircle",
                  title: getTranslation('dashboard.features.integration.title'),
                  description: getTranslation('dashboard.features.integration.description'),
                  benefits: languageData?.dashboard?.features?.integration?.benefits || ["REST API", "Webhooks", "Pre-built connectors"]
                }
              ];

              const features = customFeatures || defaultFeatures;
              const iconMap: Record<string, any> = {
                FiPhone,
                FiBarChart2,
                FiMessageSquare,
                FiShield,
                FiUsers,
                FiCheckCircle,
                FiMic,
                FiClock
              };

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                  {features.slice(0, 6).map((feature: any, index: number) => {
                    const IconComponent = iconMap[feature.icon] || FiCheckCircle;
                    return (
                      <div key={index} className={`group ${themeConfig.styleClasses.card} p-8 rounded-2xl hover:transform hover:scale-105 transition-all duration-300 border border-gray-200/50 dark:border-gray-700/50 hover:shadow-xl`}>
                        <div className="w-16 h-16 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg" style={{ background: gradientBg }}>
                          <IconComponent className="text-white w-8 h-8" />
                        </div>
                        <h3 className={`text-xl font-bold ${themeConfig.styleClasses.text.primary} mb-4`}>{feature.title}</h3>
                        <p className={`${themeConfig.styleClasses.text.secondary} mb-6 leading-relaxed`}>
                          {feature.description}
                        </p>
                        {feature.benefits && (
                          <ul className="space-y-2">
                            {feature.benefits.slice(0, 3).map((benefit: string, benefitIndex: number) => (
                              <li key={benefitIndex} className={`flex items-center text-sm ${themeConfig.styleClasses.text.muted}`}>
                                <FiCheckCircle className="w-4 h-4 mr-2 text-green-400 flex-shrink-0" />
                                {benefit}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            } catch (error) {
              console.error('Error parsing features:', error);
              // Fallback to default features
              return (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className={`${themeConfig.styleClasses.card} p-6 rounded-xl`}>
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4" style={{ background: gradientBg }}>
                      <FiPhone className="text-white w-6 h-6" />
                    </div>
                    <h3 className={`text-xl font-semibold ${themeConfig.styleClasses.text.primary} mb-2`}>24/7 Availability</h3>
                    <p className={themeConfig.styleClasses.text.secondary}>
                      Ensure your business is always accessible to customers with AI-powered voice responses.
                    </p>
                  </div>

                  <div className={`${themeConfig.styleClasses.card} p-6 rounded-xl`}>
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4" style={{ background: gradientBg }}>
                      <FiBarChart2 className="text-white w-6 h-6" />
                    </div>
                    <h3 className={`text-xl font-semibold ${themeConfig.styleClasses.text.primary} mb-2`}>Analytics Dashboard</h3>
                    <p className={themeConfig.styleClasses.text.secondary}>
                      Track customer interactions and gain insights with detailed conversation analytics.
                    </p>
                  </div>

                  <div className={`${themeConfig.styleClasses.card} p-6 rounded-xl`}>
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4" style={{ background: gradientBg }}>
                      <FiMessageSquare className="text-white w-6 h-6" />
                    </div>
                    <h3 className={`text-xl font-semibold ${themeConfig.styleClasses.text.primary} mb-2`}>Multi-Channel Support</h3>
                    <p className={themeConfig.styleClasses.text.secondary}>
                      Connect with customers through voice, SMS, email, and more from a single platform.
                    </p>
                  </div>
                </div>
              );
            }
          })()}
        </div>
      </section>

      {/* Testimonials Section */}
      {(() => {
        try {
          const testimonialsText = getTranslation('', branding?.testimonials, 'testimonials');
          const testimonials = testimonialsText
            ? JSON.parse(testimonialsText.replace(/\r\n/g, '\n'))
            : [
                {
                  name: "Sarah Johnson",
                  company: "TechStart Inc.",
                  role: "CEO",
                  content: "This voice AI solution has transformed how we handle customer inquiries. Our response time improved by 80% and customer satisfaction is at an all-time high.",
                  rating: 5
                },
                {
                  name: "Michael Chen",
                  company: "Global Solutions",
                  role: "Operations Manager",
                  content: "The 24/7 availability and natural conversation flow has been a game-changer for our business. Highly recommend to any company looking to scale their customer service.",
                  rating: 5
                },
                {
                  name: "Emily Rodriguez",
                  company: "StartupXYZ",
                  role: "Founder",
                  content: "Implementation was seamless and the results were immediate. Our customers love the instant responses and we've seen a significant reduction in support tickets.",
                  rating: 5
                }
              ];

          if (testimonials && testimonials.length > 0) {
            return (
              <section className={`py-20 px-4 ${isLightMode ? 'bg-gray-50/50 border-t border-gray-200/50' : 'bg-gray-900/50 border-t border-gray-700/50'} ${isLoaded ? animationVariants[baseAnimation].visible : animationClasses.features}`} style={{
                transitionDelay: '350ms'
              }}>
                <div className="container mx-auto">
                  <div className="text-center mb-16">
                    <h2 className={`text-4xl font-bold ${themeConfig.styleClasses.text.primary} mb-6`}>
                      {getTranslation('dashboard.testimonials.title')}
                    </h2>
                    <p className={`text-lg ${themeConfig.styleClasses.text.secondary} max-w-3xl mx-auto`}>
                      {getTranslation('dashboard.testimonials.subtitle')}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                    {testimonials.slice(0, 3).map((testimonial: any, index: number) => (
                      <div key={index} className={`group ${themeConfig.styleClasses.card} p-8 rounded-2xl relative border border-gray-200/50 dark:border-gray-700/50 hover:shadow-xl transition-all duration-300 hover:scale-105`}>
                        {/* Rating Stars */}
                        <div className="flex space-x-1 mb-4">
                          {[...Array(testimonial.rating || 5)].map((_, i) => (
                            <FiStar key={i} className="w-4 h-4 text-amber-400 fill-current" />
                          ))}
                        </div>

                        {/* Testimonial Content */}
                        <blockquote className={`${themeConfig.styleClasses.text.muted} mb-6 italic`}>
                          "{testimonial.content}"
                        </blockquote>

                        {/* Customer Info */}
                        <div className="flex items-center">
                          <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg mr-4" style={{ background: gradientBg }}>
                            {testimonial.name.charAt(0)}
                          </div>
                          <div>
                            <div className={`${themeConfig.styleClasses.text.primary} font-semibold`}>{testimonial.name}</div>
                            <div className={`${themeConfig.styleClasses.text.secondary} text-sm`}>{testimonial.role}</div>
                            <div className={`${themeConfig.styleClasses.text.muted} text-sm`}>{testimonial.company}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* More Testimonials Link - Only show if URL provided */}
                  {(brandingWithDefaults as any).moreTestimonialsUrl && (
                    <div className="text-center mt-8">
                      <a
                        href={(brandingWithDefaults as any).moreTestimonialsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center space-x-2 ${themeConfig.styleClasses.text.secondary} hover:${themeConfig.styleClasses.text.primary} text-sm transition-colors`}
                      >
                        <span>View More Testimonials</span>
                        <FiExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  )}

                  {/* Trust Indicators */}
                  {(() => {
                    try {
                      const trustIndicatorsText = getTranslation('', branding?.trustIndicators, 'trustIndicators');
                      const trustIndicators = trustIndicatorsText
                        ? JSON.parse(trustIndicatorsText.replace(/\r\n/g, '\n'))
                        : [
                            { icon: 'FiUsers', text: '10,000+ Active Users' },
                            { icon: 'FiCheckCircle', text: '99.9% Uptime Guarantee' },
                            { icon: 'FiShield', text: 'Enterprise Security' },
                            { icon: 'FiClock', text: '24/7 Support' }
                          ];

                      const trustIconMap: Record<string, any> = {
                        FiUsers,
                        FiCheckCircle,
                        FiShield,
                        FiClock,
                        FiLock,
                        FiAward,
                        FiStar,
                        FiGlobe,
                        FiTrendingUp
                      };

                      if (trustIndicators && trustIndicators.length > 0) {
                        return (
                          <div className="mt-12 pt-8 border-t border-gray-700">
                            <div className="flex flex-wrap justify-center items-center gap-8 text-gray-400">
                              {trustIndicators.map((indicator: any, index: number) => {
                                const IconComponent = trustIconMap[indicator.icon] || FiShield;
                                const iconColors = ['text-green-400', 'text-blue-400', 'text-purple-400', 'text-amber-400'];
                                const iconColor = iconColors[index % iconColors.length];

                                return (
                                  <div key={index} className="flex items-center space-x-2">
                                    <IconComponent className={`w-5 h-5 ${iconColor}`} />
                                    <span className="text-sm">{indicator.text}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    } catch (error) {
                      console.error('Error parsing trust indicators:', error);
                      // Fallback to default trust indicators
                      return (
                        <div className="mt-12 pt-8 border-t border-gray-700">
                          <div className="flex flex-wrap justify-center items-center gap-8 text-gray-400">
                            <div className="flex items-center space-x-2">
                              <FiUsers className="w-5 h-5" />
                              <span className="text-sm">10,000+ Active Users</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <FiCheckCircle className="w-5 h-5 text-green-400" />
                              <span className="text-sm">99.9% Uptime Guarantee</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <FiShield className="w-5 h-5 text-blue-400" />
                              <span className="text-sm">Enterprise Security</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <FiClock className="w-5 h-5 text-purple-400" />
                              <span className="text-sm">24/7 Support</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                  })()}
                </div>
              </section>
            );
          }
          return null;
        } catch (error) {
          console.error('Error parsing testimonials:', error);

          // Try to render with fallback testimonials and still show the More Testimonials Link
          const fallbackTestimonials = [
            {
              name: "Sarah Johnson",
              company: "TechStart Inc.",
              role: "CEO",
              content: "This voice AI solution has transformed how we handle customer inquiries. Our response time improved by 80% and customer satisfaction is at an all-time high.",
              rating: 5
            },
            {
              name: "Michael Chen",
              company: "Global Solutions",
              role: "CTO",
              content: "The integration was seamless and the AI responses are incredibly natural. Our customers can't tell the difference between AI and human agents.",
              rating: 5
            },
            {
              name: "Emily Rodriguez",
              company: "StartupHub",
              role: "Founder",
              content: "Implementation was seamless and the results were immediate. Our customers love the instant responses and we've seen a significant reduction in support tickets.",
              rating: 5
            }
          ];

          return (
            <section className={`py-20 px-4 ${isLightMode ? 'bg-gray-50/50 border-t border-gray-200/50' : 'bg-gray-900/50 border-t border-gray-700/50'} ${isLoaded ? animationVariants[baseAnimation].visible : animationClasses.features}`} style={{
              transitionDelay: '350ms'
            }}>
              <div className="container mx-auto">
                <div className="text-center mb-16">
                  <h2 className={`text-4xl font-bold ${themeConfig.styleClasses.text.primary} mb-6`}>
                    {getTranslation('dashboard.testimonials.title')}
                  </h2>
                  <p className={`text-lg ${themeConfig.styleClasses.text.secondary} max-w-3xl mx-auto`}>
                    {getTranslation('dashboard.testimonials.subtitle')}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                  {fallbackTestimonials.slice(0, 3).map((testimonial: any, index: number) => (
                    <div key={index} className={`group ${themeConfig.styleClasses.card} p-8 rounded-2xl relative border border-gray-200/50 dark:border-gray-700/50 hover:shadow-xl transition-all duration-300 hover:scale-105`}>
                      {/* Rating Stars */}
                      <div className="flex space-x-1 mb-4">
                        {[...Array(testimonial.rating || 5)].map((_, i) => (
                          <FiStar key={i} className="w-4 h-4 text-amber-400 fill-current" />
                        ))}
                      </div>

                      <blockquote className={`${themeConfig.styleClasses.text.secondary} text-lg leading-relaxed mb-6 italic`}>
                        "{testimonial.content}"
                      </blockquote>

                      <div className="flex items-center space-x-4">
                        <div className={`w-12 h-12 ${themeConfig.styleClasses.button.primary} rounded-full flex items-center justify-center text-white font-semibold text-lg`}>
                          {testimonial.name.charAt(0)}
                        </div>
                        <div>
                          <div className={`${themeConfig.styleClasses.text.primary} font-semibold`}>{testimonial.name}</div>
                          <div className={`${themeConfig.styleClasses.text.secondary} text-sm`}>{testimonial.role}</div>
                          <div className={`${themeConfig.styleClasses.text.muted} text-sm`}>{testimonial.company}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* More Testimonials Link - Only show if URL provided */}
                {(brandingWithDefaults as any).moreTestimonialsUrl && (
                  <div className="text-center mt-8">
                    <a
                      href={(brandingWithDefaults as any).moreTestimonialsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center space-x-2 ${themeConfig.styleClasses.text.secondary} hover:${themeConfig.styleClasses.text.primary} text-sm transition-colors`}
                    >
                      <span>View More Testimonials</span>
                      <FiExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                )}
              </div>
            </section>
          );
        }
      })()}

      {/* Pricing Section */}
      <SubscriptionPlansDisplay
        subdomain={currentSubdomain || undefined}
        customDomain={customDomain || undefined}
        primaryColor={brandingWithDefaults.primaryColor}
        secondaryColor={brandingWithDefaults.secondaryColor}
        themeClasses={themeConfig.styleClasses}
        pricingModel={(branding as any)?.pricingModel || 'subscription'}
        payAsYouGoRate={(branding as any)?.payAsYouGoRate || 0.10}
        freeTrialEnabled={(branding as any)?.freeTrialEnabled || false}
        characterName={(branding as any)?.characterName || brandingWithDefaults.businessName}
      />

      {/* Integrations Section */}
      <section id="integrations" className={`py-20 px-4 ${isLightMode ? 'bg-white border-t border-gray-200/50' : 'bg-gray-800 border-t border-gray-700/50'} ${isLoaded ? animationVariants[baseAnimation].visible : animationClasses.features}`} style={{
        transitionDelay: '300ms'
      }}>
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className={`text-4xl font-bold ${themeConfig.styleClasses.text.primary} mb-6`}>{getTranslation('dashboard.integrations.title')}</h2>
            <p className={`text-lg ${themeConfig.styleClasses.text.secondary} max-w-3xl mx-auto`}>
              {getTranslation('dashboard.integrations.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
            {[
              { name: 'GoHighLevel', IconComponent: FaRocket, color: 'from-purple-500 to-purple-600', bgColor: isLightMode ? 'bg-purple-50' : 'bg-purple-900/20' },
              { name: 'Gmail', IconComponent: SiGmail, color: 'from-red-500 to-red-600', bgColor: isLightMode ? 'bg-red-50' : 'bg-red-900/20' },
              { name: 'Google Calendar', IconComponent: SiGooglecalendar, color: 'from-blue-500 to-blue-600', bgColor: isLightMode ? 'bg-blue-50' : 'bg-blue-900/20' },
              { name: 'Slack', IconComponent: SiSlack, color: 'from-green-500 to-green-600', bgColor: isLightMode ? 'bg-green-50' : 'bg-green-900/20' },
              { name: 'Shopify', IconComponent: SiShopify, color: 'from-green-600 to-green-700', bgColor: isLightMode ? 'bg-green-50' : 'bg-green-900/20' },
              { name: 'Notion', IconComponent: SiNotion, color: 'from-gray-600 to-gray-700', bgColor: isLightMode ? 'bg-gray-50' : 'bg-gray-900/20' },
              { name: 'Airtable', IconComponent: SiAirtable, color: 'from-orange-500 to-orange-600', bgColor: isLightMode ? 'bg-orange-50' : 'bg-orange-900/20' },
              { name: 'HubSpot', IconComponent: SiHubspot, color: 'from-orange-600 to-orange-700', bgColor: isLightMode ? 'bg-orange-50' : 'bg-orange-900/20' },
              { name: 'Salesforce', IconComponent: SiSalesforce, color: 'from-blue-600 to-blue-700', bgColor: isLightMode ? 'bg-blue-50' : 'bg-blue-900/20' },
              { name: 'WhatsApp', IconComponent: SiWhatsapp, color: 'from-green-500 to-green-600', bgColor: isLightMode ? 'bg-green-50' : 'bg-green-900/20' },
              { name: 'Firecrawl', IconComponent: FaFire, color: 'from-red-600 to-red-700', bgColor: isLightMode ? 'bg-red-50' : 'bg-red-900/20' },
              { name: 'More...', IconComponent: FaPlus, color: 'from-gray-500 to-gray-600', bgColor: isLightMode ? 'bg-gray-50' : 'bg-gray-900/20' }
            ].map((integration, index) => (
              <div key={index} className={`group ${themeConfig.styleClasses.card} ${integration.bgColor} p-6 rounded-xl text-center hover:scale-105 hover:shadow-lg transition-all duration-300 border ${isLightMode ? 'border-gray-200/50' : 'border-gray-700/50'}`}>
                <div className={`w-16 h-16 bg-gradient-to-br ${integration.color} rounded-xl flex items-center justify-center text-white mx-auto mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                  <integration.IconComponent className="w-8 h-8" />
                </div>
                <div className={`${themeConfig.styleClasses.text.primary} text-sm font-semibold`}>
                  {integration.name}
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link
              href="/whitelabel/integration"
              className={`inline-flex items-center space-x-2 ${themeConfig.styleClasses.button.secondary} px-6 py-3 rounded-lg transition-colors`}
            >
              <span>View All Integrations</span>
              <FiArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      {(() => {
        try {
          const faqsText = getTranslation('', branding?.faqs, 'faqs');
          const faqs = faqsText
            ? JSON.parse(faqsText.replace(/\r\n/g, '\n'))
            : (languageData?.dashboard.faqs.defaultQuestions || [
                {
                  question: "How quickly can I get started?",
                  answer: "You can get started immediately! Sign up for a free account and you'll have access to our voice AI platform within minutes. Our setup wizard will guide you through the initial configuration."
                },
                {
                  question: "What kind of support do you provide?",
                  answer: "We offer 24/7 customer support through multiple channels including live chat, email, and phone. Our dedicated support team is here to help you succeed with our platform."
                },
                {
                  question: "Is my data secure?",
                  answer: "Absolutely. We use enterprise-grade security with end-to-end encryption, SOC 2 compliance, and GDPR compliance. Your data is stored securely and never shared with third parties."
                }
              ]);

          if (faqs && faqs.length > 0) {
            return (
              <section className={`py-20 px-4 ${isLightMode ? 'bg-white border-t border-gray-200/50' : 'bg-gray-800 border-t border-gray-700/50'} ${isLoaded ? animationVariants[baseAnimation].visible : animationClasses.features}`} style={{
                transitionDelay: '400ms'
              }}>
                <div className="container mx-auto max-w-4xl">
                  <div className="text-center mb-16">
                    <h2 className={`text-4xl font-bold ${themeConfig.styleClasses.text.primary} mb-6`}>Frequently Asked Questions</h2>
                    <p className={`text-lg ${themeConfig.styleClasses.text.secondary}`}>
                      Get answers to common questions about our voice AI platform.
                    </p>
                  </div>

                  <div className="space-y-8">
                    {faqs.map((faq: any, index: number) => (
                      <details key={index} className={`${themeConfig.styleClasses.card} rounded-2xl group border ${isLightMode ? 'border-gray-200/50' : 'border-gray-700/50'} hover:shadow-lg transition-all duration-300`}>
                        <summary className={`flex items-center justify-between p-8 cursor-pointer list-none ${isLightMode ? 'hover:bg-gray-50/50' : 'hover:bg-gray-700/50'} rounded-2xl transition-colors`}>
                          <h3 className={`text-lg font-bold ${themeConfig.styleClasses.text.primary} pr-4`}>{faq.question}</h3>
                          <div className="flex-shrink-0">
                            <FiHelpCircle className={`w-6 h-6 ${themeConfig.styleClasses.text.secondary} group-open:${themeConfig.styleClasses.text.primary} transition-colors`} />
                          </div>
                        </summary>
                        <div className="px-8 pb-8">
                          <p className={`${themeConfig.styleClasses.text.secondary} leading-relaxed text-base`}>{faq.answer}</p>
                        </div>
                      </details>
                    ))}
                  </div>

                  {/* Contact Support CTA */}
                  <div className="text-center mt-12">
                    <p className={`${themeConfig.styleClasses.text.secondary} mb-4`}>Still have questions?</p>
                    {(brandingWithDefaults as any).supportEmail ? (
                      <a
                        href={`mailto:${(brandingWithDefaults as any).supportEmail}`}
                        className={`inline-flex items-center px-6 py-3 font-medium hover:opacity-90 transition-opacity rounded-lg shadow-md ${isLightMode ? 'text-gray-900' : `text-white ${themeConfig.styleClasses.button.secondary}`}`}
                        style={isLightMode ? { backgroundColor: brandingWithDefaults.secondaryColor || '#f3f4f6' } : {}}
                      >
                        Contact Support
                        <FiArrowRight className="ml-2 w-4 h-4" />
                      </a>
                    ) : (
                      <a
                        href="#contact"
                        className={`inline-flex items-center px-6 py-3 font-medium hover:opacity-90 transition-opacity rounded-lg shadow-md ${isLightMode ? 'text-gray-900' : `text-white ${themeConfig.styleClasses.button.secondary}`}`}
                        style={isLightMode ? { backgroundColor: brandingWithDefaults.secondaryColor || '#f3f4f6' } : {}}
                      >
                        Contact Support
                        <FiArrowRight className="ml-2 w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              </section>
            );
          }
          return null;
        } catch (error) {
          console.error('Error parsing FAQs:', error);
          return null;
        }
      })()}

      {/* CTA Section */}
      <section className={`py-20 px-4 ${isLightMode ? 'bg-gradient-to-br from-blue-50 to-purple-50 border-t border-gray-200/50' : 'bg-gradient-to-br from-gray-900 to-gray-800 border-t border-gray-700/50'} ${isLoaded ? animationVariants[baseAnimation].visible : animationClasses.cta}`} style={{
        transitionDelay: '450ms'
      }}>
        <div className="container mx-auto">
          <div className={`${themeConfig.styleClasses.card} p-12 md:p-16 rounded-2xl text-center max-w-4xl mx-auto shadow-xl border ${isLightMode ? 'border-gray-200/50' : 'border-gray-700/50'}`}>
            <h2 className={`text-4xl md:text-5xl font-bold ${themeConfig.styleClasses.text.primary} mb-8`}>
              {getTranslation('dashboard.cta.title')}
            </h2>
            <p className={`text-lg ${themeConfig.styleClasses.text.muted} mb-10 max-w-2xl mx-auto`}>
              {getTranslation('dashboard.cta.subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {/* Debug info */}
              <div style={{ display: 'none' }}>
                {`CTA signup button check: ${brandingWithDefaults.enableCustomerSignup} (${typeof brandingWithDefaults.enableCustomerSignup})`}
              </div>

              {(brandingWithDefaults.enableCustomerSignup === true) && (
                <Link
                  href="/register"
                  className={`px-8 py-4 text-white text-lg font-medium ${isLightMode ? 'rounded-lg shadow-lg hover:shadow-xl transition-all duration-300' : themeConfig.styleClasses.button.primary}`}
                  style={isLightMode ? { background: gradientBg } : {}}
                >
                  Start Your Free Trial
                </Link>
              )}
              {(brandingWithDefaults as any).supportEmail ? (
                <a
                  href={`mailto:${(brandingWithDefaults as any).supportEmail}`}
                  className={`px-8 py-4 text-lg font-medium rounded-lg shadow-lg transition-all duration-300 ${isLightMode ? 'text-gray-900 hover:opacity-90' : `text-white ${themeConfig.styleClasses.button.secondary}`}`}
                  style={isLightMode ? { backgroundColor: brandingWithDefaults.secondaryColor || '#f3f4f6' } : {}}
                >
                  Contact Sales
                </a>
              ) : (
                <a
                  href="#contact"
                  className={`px-8 py-4 text-lg font-medium rounded-lg shadow-lg transition-all duration-300 ${isLightMode ? 'text-gray-900 hover:opacity-90' : `text-white ${themeConfig.styleClasses.button.secondary}`}`}
                  style={isLightMode ? { backgroundColor: brandingWithDefaults.secondaryColor || '#f3f4f6' } : {}}
                >
                  Contact Sales
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Enhanced Footer */}
      <footer className={`mt-auto ${themeConfig.styleClasses.container} border-t ${isLightMode ? 'border-gray-200' : 'border-white/10'}`}>
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
            {/* Company Info */}
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                {brandingWithDefaults.logo ? (
                  <Image
                    src={brandingWithDefaults.logo}
                    alt={brandingWithDefaults.businessName}
                    width={32}
                    height={32}
                    className="rounded-md object-contain"
                  />
                ) : (
                  <div
                    className="w-8 h-8 rounded-md flex items-center justify-center text-white font-bold text-sm"
                    style={{ background: gradientBg }}
                  >
                    {brandingWithDefaults.businessName.substring(0, 1)}
                  </div>
                )}
                <span className={`${isLightMode ? 'text-gray-900' : 'text-white'} font-medium`}>{brandingWithDefaults.businessName}</span>
              </div>
              <p className={`${themeConfig.styleClasses.text.secondary} text-sm`}>
                {brandingWithDefaults.portalSlogan}
              </p>

              {/* Contact Information - Only show if enabled and has contact info */}
              {(brandingWithDefaults as any).showContactInfo !== false && ((brandingWithDefaults as any).supportEmail || (brandingWithDefaults as any).companyPhone || (brandingWithDefaults as any).companyAddress) && (
                <div className="space-y-2">
                  {(brandingWithDefaults as any).supportEmail && (
                    <div className={`flex items-center space-x-2 ${themeConfig.styleClasses.text.secondary} text-sm`}>
                      <FiMail className="w-4 h-4" />
                      <a
                        href={`mailto:${(brandingWithDefaults as any).supportEmail}`}
                        className={`hover:${themeConfig.styleClasses.text.primary} transition-colors`}
                      >
                        {(brandingWithDefaults as any).supportEmail}
                      </a>
                    </div>
                  )}
                  {(brandingWithDefaults as any).companyPhone && (
                    <div className={`flex items-center space-x-2 ${themeConfig.styleClasses.text.secondary} text-sm`}>
                      <FiPhone className="w-4 h-4" />
                      <a
                        href={`tel:${(brandingWithDefaults as any).companyPhone}`}
                        className={`hover:${themeConfig.styleClasses.text.primary} transition-colors`}
                      >
                        {(brandingWithDefaults as any).companyPhone}
                      </a>
                    </div>
                  )}
                  {(brandingWithDefaults as any).companyAddress && (
                    <div className={`flex items-start space-x-2 ${themeConfig.styleClasses.text.secondary} text-sm`}>
                      <FiMapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{(brandingWithDefaults as any).companyAddress}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Product Links - Only show if enabled */}
            {(brandingWithDefaults as any).showQuickLinks !== false && (
              <div className="space-y-4">
                <h3 className={`${themeConfig.styleClasses.text.primary} font-semibold`}>{getTranslation('dashboard.footer.product')}</h3>
                <div className="space-y-2">
                  {/* Features - Always show, maps to features section */}
                  <a href="#features" className={`block ${themeConfig.styleClasses.text.secondary} hover:${themeConfig.styleClasses.text.primary} text-sm transition-colors`}>
                    {getTranslation('dashboard.footer.features')}
                  </a>

                  {/* Pricing - Only show if partner has subscription plans or pricing model configured */}
                  {((brandingWithDefaults as any).pricingModel || (brandingWithDefaults as any).hasSubscriptionPlans) && (
                    <a href="#pricing" className={`block ${themeConfig.styleClasses.text.secondary} hover:${themeConfig.styleClasses.text.primary} text-sm transition-colors`}>
                      {getTranslation('dashboard.footer.pricing')}
                    </a>
                  )}

                  {/* Integrations - Show integrations showcase */}
                  <a href="#integrations" className={`block ${themeConfig.styleClasses.text.secondary} hover:${themeConfig.styleClasses.text.primary} text-sm transition-colors`}>
                    {getTranslation('dashboard.footer.integrations')}
                  </a>

                  {/* API Documentation - Show as coming soon */}
                  <div className={`flex items-center justify-between ${themeConfig.styleClasses.text.secondary} text-sm`}>
                    <span>{getTranslation('dashboard.footer.apiDocumentation')}</span>
                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">Coming Soon</span>
                  </div>

                  {/* System Status - Only if URL provided */}
                  {(brandingWithDefaults as any).statusPageUrl && (
                    <a
                      href={(brandingWithDefaults as any).statusPageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center space-x-1 ${themeConfig.styleClasses.text.secondary} hover:${themeConfig.styleClasses.text.primary} text-sm transition-colors`}
                    >
                      <span>System Status</span>
                      <FiExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Support Links - Only show if enabled */}
            {(brandingWithDefaults as any).showResources !== false && (
              <div className="space-y-4">
                <h3 className={`${themeConfig.styleClasses.text.primary} font-semibold`}>{getTranslation('dashboard.footer.support')}</h3>
                <div className="space-y-2">
                  {/* Help Center - Coming Soon */}
                  <div className={`flex items-center justify-between ${themeConfig.styleClasses.text.secondary} text-sm`}>
                    <span>{getTranslation('dashboard.footer.helpCenter')}</span>
                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">Coming Soon</span>
                  </div>

                  {/* Contact Support - Use partner's support email if available */}
                  {(brandingWithDefaults as any).supportEmail ? (
                    <a
                      href={`mailto:${(brandingWithDefaults as any).supportEmail}`}
                      className={`block ${themeConfig.styleClasses.text.secondary} hover:${themeConfig.styleClasses.text.primary} text-sm transition-colors`}
                    >
                      {getTranslation('dashboard.footer.contactSupport')}
                    </a>
                  ) : (
                    <Link href="#contact" className={`block ${themeConfig.styleClasses.text.secondary} hover:${themeConfig.styleClasses.text.primary} text-sm transition-colors`}>
                      {getTranslation('dashboard.footer.contactSupport')}
                    </Link>
                  )}

                  {/* Tutorials - Coming Soon */}
                  <div className={`flex items-center justify-between ${themeConfig.styleClasses.text.secondary} text-sm`}>
                    <span>Tutorials</span>
                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">Coming Soon</span>
                  </div>

                  {/* Community - Only show if enabled and URL provided */}
                  {(brandingWithDefaults as any).showCommunity && (brandingWithDefaults as any).communityUrl && (
                    <a
                      href={(brandingWithDefaults as any).communityUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center space-x-1 ${themeConfig.styleClasses.text.secondary} hover:${themeConfig.styleClasses.text.primary} text-sm transition-colors`}
                    >
                      <span>Community</span>
                      <FiExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Newsletter Signup - Only show if enabled */}
            {(brandingWithDefaults as any).showNewsletter !== false && (
              <div className="space-y-4">
                <h3 className={`${themeConfig.styleClasses.text.primary} font-semibold`}>{getTranslation('dashboard.footer.stayUpdated')}</h3>
                <p className={`${themeConfig.styleClasses.text.secondary} text-sm`}>
                  {getTranslation('dashboard.footer.newsletterDescription')}
                </p>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target as HTMLFormElement);
                    const email = formData.get('email') as string;

                    // Basic email validation
                    if (!email || !email.includes('@')) {
                      alert('Please enter a valid email address');
                      return;
                    }

                    try {
                      const response = await fetch('/api/whitelabel/newsletter', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          email,
                          subdomain: (brandingWithDefaults as any).subdomain
                        }),
                      });

                      const result = await response.json();

                      if (response.ok) {
                        alert(result.message || 'Thank you for subscribing! We\'ll keep you updated.');
                        (e.target as HTMLFormElement).reset();
                      } else {
                        alert(result.error || 'Failed to subscribe. Please try again.');
                      }
                    } catch (error) {
                      console.error('Newsletter subscription error:', error);
                      alert('Failed to subscribe. Please try again.');
                    }
                  }}
                  className="space-y-3"
                >
                  <div className="flex">
                    <input
                      type="email"
                      name="email"
                      placeholder={getTranslation('dashboard.footer.enterEmail')}
                      className={`flex-1 px-3 py-2 border rounded-l-lg text-sm focus:outline-none focus:border-blue-500 ${isLightMode ? 'bg-white text-gray-900 border-gray-300' : `${themeConfig.styleClasses.card} text-white border-white/20`}`}
                      required
                    />
                    <button
                      type="submit"
                      className={`px-4 py-2 text-white text-sm font-medium rounded-r-lg transition-colors ${isLightMode ? 'shadow-md hover:shadow-lg' : themeConfig.styleClasses.button.primary}`}
                      style={isLightMode ? { background: gradientBg } : {}}
                    >
                      {getTranslation('dashboard.footer.subscribe')}
                    </button>
                  </div>
                  <p className={`${themeConfig.styleClasses.text.muted} text-xs`}>
                    {getTranslation('dashboard.footer.privacyNote')}
                  </p>
                </form>
              </div>
            )}

            {/* Legal & Social - Only show if enabled */}
            {((brandingWithDefaults as any).showLegal !== false || ((brandingWithDefaults as any).showSocialMedia !== false && ((brandingWithDefaults as any).twitterUrl || (brandingWithDefaults as any).linkedinUrl || (brandingWithDefaults as any).facebookUrl || (brandingWithDefaults as any).instagramUrl))) && (
              <div className="space-y-4">
                {/* Legal Section */}
                {(brandingWithDefaults as any).showLegal !== false && (
                  <>
                    <h3 className={`${themeConfig.styleClasses.text.primary} font-semibold`}>Legal</h3>
                    <div className="space-y-2">
                      {(brandingWithDefaults as any).privacyPolicyUrl ? (
                        <a
                          href={(brandingWithDefaults as any).privacyPolicyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center space-x-1 ${themeConfig.styleClasses.text.secondary} hover:${themeConfig.styleClasses.text.primary} text-sm transition-colors`}
                        >
                          <span>{getTranslation('dashboard.footer.privacyPolicy')}</span>
                          <FiExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <Link href="/whitelabel/privacy" className={`block ${themeConfig.styleClasses.text.secondary} hover:${themeConfig.styleClasses.text.primary} text-sm transition-colors`}>
                          {getTranslation('dashboard.footer.privacyPolicy')}
                        </Link>
                      )}
                      {(brandingWithDefaults as any).termsOfServiceUrl ? (
                        <a
                          href={(brandingWithDefaults as any).termsOfServiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center space-x-1 ${themeConfig.styleClasses.text.secondary} hover:${themeConfig.styleClasses.text.primary} text-sm transition-colors`}
                        >
                          <span>{getTranslation('dashboard.footer.termsOfService')}</span>
                          <FiExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <Link href="/whitelabel/terms" className={`block ${themeConfig.styleClasses.text.secondary} hover:${themeConfig.styleClasses.text.primary} text-sm transition-colors`}>
                          {getTranslation('dashboard.footer.termsOfService')}
                        </Link>
                      )}
                      <Link href="/whitelabel/cookies" className={`block ${themeConfig.styleClasses.text.secondary} hover:${themeConfig.styleClasses.text.primary} text-sm transition-colors`}>
                        {getTranslation('dashboard.footer.cookiePolicy')}
                      </Link>
                    </div>
                  </>
                )}

                {/* Social Media Links - Only show if enabled and has social links */}
                {(brandingWithDefaults as any).showSocialMedia !== false && ((brandingWithDefaults as any).twitterUrl || (brandingWithDefaults as any).linkedinUrl || (brandingWithDefaults as any).facebookUrl || (brandingWithDefaults as any).instagramUrl) && (
                  <div className="pt-4">
                    <h4 className={`${themeConfig.styleClasses.text.primary} font-medium text-sm mb-3`}>Follow Us</h4>
                    <div className="flex space-x-3">
                      {(brandingWithDefaults as any).twitterUrl && (
                        <a
                          href={(brandingWithDefaults as any).twitterUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${themeConfig.styleClasses.text.secondary} hover:${themeConfig.styleClasses.text.primary} transition-colors`}
                          aria-label="Twitter"
                        >
                          <FiTwitter className="w-5 h-5" />
                        </a>
                      )}
                      {(brandingWithDefaults as any).linkedinUrl && (
                        <a
                          href={(brandingWithDefaults as any).linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${themeConfig.styleClasses.text.secondary} hover:${themeConfig.styleClasses.text.primary} transition-colors`}
                          aria-label="LinkedIn"
                        >
                          <FiLinkedin className="w-5 h-5" />
                        </a>
                      )}
                      {(brandingWithDefaults as any).facebookUrl && (
                        <a
                          href={(brandingWithDefaults as any).facebookUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${themeConfig.styleClasses.text.secondary} hover:${themeConfig.styleClasses.text.primary} transition-colors`}
                          aria-label="Facebook"
                        >
                          <FiFacebook className="w-5 h-5" />
                        </a>
                      )}
                      {(brandingWithDefaults as any).instagramUrl && (
                        <a
                          href={(brandingWithDefaults as any).instagramUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${themeConfig.styleClasses.text.secondary} hover:${themeConfig.styleClasses.text.primary} transition-colors`}
                          aria-label="Instagram"
                        >
                          <FiInstagram className="w-5 h-5" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Bar */}
          <div className={`border-t ${isLightMode ? 'border-gray-200' : 'border-white/10'} mt-8 pt-8 flex flex-col md:flex-row justify-between items-center`}>
            <p className={`${themeConfig.styleClasses.text.secondary} text-sm mb-4 md:mb-0`}>
              © {new Date().getFullYear()} {brandingWithDefaults.businessName}. All rights reserved.
            </p>
            <div className={`flex items-center space-x-4 ${themeConfig.styleClasses.text.secondary} text-sm`}>
              <span className="flex items-center space-x-1">
                <FiShield className="w-4 h-4" />
                <span>Secure & Compliant</span>
              </span>
              <span className="flex items-center space-x-1">
                <FiClock className="w-4 h-4" />
                <span>99.9% Uptime</span>
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
