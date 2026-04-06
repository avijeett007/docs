'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiCheck, FiX, FiLoader, FiGlobe, FiSettings, FiEye, FiSave, FiAlertCircle, FiUpload, FiTrash2, FiImage, FiInfo, FiCheckCircle, FiPlay, FiPause, FiShield, FiFileText, FiActivity, FiExternalLink, FiZap } from 'react-icons/fi';
import PartnerLayout from '@/components/partner/PartnerLayout';
import { WhiteLabelSettings, Partner } from '@/types/partner';
import ThemeSelector from '@/components/whitelabel/ThemeSelector';
import PortalPreview from '@/components/whitelabel/PortalPreview';
import { PortalTheme } from '@/lib/portalThemes';
import PortalModeSelector from '@/components/whitelabel/PortalModeSelector';
import { PortalMode, PartnerTier, canAccessPortalMode, canAccessPortalModeWithManualSaaS, getAvailablePortalModes } from '@/lib/portalModes';
import { isFeatureEnabled } from '@/config/featureFlags';
import FeatureFlagControl from '@/components/admin/FeatureFlagControl';
import SubscriptionPlansSection from '@/components/partner/SubscriptionPlansSection';
import CustomerCreditPlansSection from '@/components/partner/CustomerCreditPlansSection';
import StripeConnectSettings from '@/components/settings/StripeConnectSettings';
import FeaturesBuilder from '@/components/whitelabel/FeaturesBuilder';
import TestimonialsBuilder from '@/components/whitelabel/TestimonialsBuilder';
import FAQsBuilder from '@/components/whitelabel/FAQsBuilder';
import TrustIndicatorsBuilder from '@/components/whitelabel/TrustIndicatorsBuilder';
import PremiumFeature from '@/components/ui/PremiumFeature';
import { FreeForeverUpgradeService } from '@/lib/services/freeForeverUpgradeService';
import FreeForeverUpgradeModal from '@/components/partner/FreeForeverUpgradeModal';
import BYOAVoiceSelector from '@/components/partner/BYOAVoiceSelector';
import { getLanguageOptions } from '@/lib/languages';
import { getAllAgentTiersClient, getDefaultAgentTier, AgentTierType, getStandardAgentTiersClient, getBYOATierConfigClient } from '@/lib/agentTiers';

export default function WhiteLabelSettingsPage() {
  const router = useRouter();

  // Feature flag checks
  const whitelabelEnabled = isFeatureEnabled('whitelabel.enabled');
  const themeSelectorEnabled = isFeatureEnabled('whitelabel.themeSelector');
  const customizationEnabled = isFeatureEnabled('whitelabel.customization');
  const subdomainsEnabled = isFeatureEnabled('whitelabel.subdomains');

  // Show admin notice if feature is disabled but we're in this page
  const [isAdmin, setIsAdmin] = useState(false);

  const [isSubdomainAvailable, setIsSubdomainAvailable] = useState<boolean | null>(null);
  const [checkingSubdomain, setCheckingSubdomain] = useState(false);
  const [subdomainCheckResult, setSubdomainCheckResult] = useState<{
    available: boolean;
    reason: 'available' | 'reserved' | 'taken' | 'invalid';
    message: string;
    suggestions?: string[];
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [partner, setPartner] = useState<Partial<Partner> | null>(null);

  // Free Forever Upgrade Modal state
  const [showFreeForeverUpgrade, setShowFreeForeverUpgrade] = useState(false);
  const [freeForeverUpgradeData, setFreeForeverUpgradeData] = useState({
    title: '',
    message: '',
    featureDescription: '',
  });
  const [pendingAction, setPendingAction] = useState<'custom_domain' | null>(null);
  const [upgradeModalDismissed, setUpgradeModalDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<PortalTheme>(PortalTheme.MODERN);
  const [selectedPortalMode, setSelectedPortalMode] = useState<PortalMode>(PortalMode.BASIC);
  const [partnerTier, setPartnerTier] = useState<PartnerTier>(PartnerTier.FREE_FOREVER);
  const [showPortalModeUpgrade, setShowPortalModeUpgrade] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showPricingHelp, setShowPricingHelp] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [removeFavicon, setRemoveFavicon] = useState(false);

  // AI Translation state
  const [enableTranslation, setEnableTranslation] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [showAutoDeployCharges, setShowAutoDeployCharges] = useState(false);
  const [translationResult, setTranslationResult] = useState<{
    success: boolean;
    message: string;
    creditsUsed?: number;
    languagesTranslated?: string[];
  } | null>(null);

  // Voice-related state
  const [voices, setVoices] = useState<any[]>([]);
  const [filteredVoices, setFilteredVoices] = useState<any[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [selectedVoiceConfig, setSelectedVoiceConfig] = useState<any>(null);

  // Retell API Key Modal state (for BYOA tier)
  const [showRetellApiKeyModal, setShowRetellApiKeyModal] = useState(false);
  const [retellApiKeyInput, setRetellApiKeyInput] = useState('');
  const [savingRetellApiKey, setSavingRetellApiKey] = useState(false);
  const [retellApiKeyError, setRetellApiKeyError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<WhiteLabelSettings>();

  const subdomain = watch('subdomain');
  const customDomain = watch('customDomain');
  const customerPortalEnabled = watch('customerPortalEnabled');
  const voiceAiAgentLanguage = watch('voiceAiAgentLanguage');
  const voiceAiAgentVoiceType = watch('voiceAiAgentVoiceType');

  // Create stable callback functions to prevent infinite re-renders
  const handleFeaturesChange = useCallback((value: string) => {
    setValue('features', value);
  }, [setValue]);

  const handleTestimonialsChange = useCallback((value: string) => {
    setValue('testimonials', value);
  }, [setValue]);

  const handleFAQsChange = useCallback((value: string) => {
    setValue('faqs', value);
  }, [setValue]);

  const handleTrustIndicatorsChange = useCallback((value: string) => {
    setValue('trustIndicators', value);
  }, [setValue]);

  // Function to save Retell API key (for BYOA tier)
  const handleSaveRetellApiKey = async () => {
    if (!retellApiKeyInput.trim()) {
      setRetellApiKeyError('Please enter your Retell API key');
      return;
    }

    setSavingRetellApiKey(true);
    setRetellApiKeyError(null);

    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        setRetellApiKeyError('Authentication required');
        return;
      }

      // Validate the API key first
      const validateResponse = await fetch('https://api.retellai.com/list-agents', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${retellApiKeyInput.trim()}`
        }
      });

      if (!validateResponse.ok) {
        setRetellApiKeyError('Invalid Retell API key. Please check and try again.');
        return;
      }

      // Save the API key
      const response = await fetch('/api/partner/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          retellApiKey: retellApiKeyInput.trim()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save API key');
      }

      // Update local partner state
      setPartner(prev => prev ? { ...prev, retellApiKey: '••••••••' } : prev);
      setShowRetellApiKeyModal(false);
      setRetellApiKeyInput('');
      setSuccess('Retell API key saved successfully! Remember to click "Save Settings" to save your BYOA tier selection.');
    } catch (error) {
      console.error('Error saving Retell API key:', error);
      setRetellApiKeyError('Failed to save API key. Please try again.');
    } finally {
      setSavingRetellApiKey(false);
    }
  };

  // Function to proceed with pending action (used by "Maybe Later" callback)
  const proceedWithPendingAction = () => {
    if (pendingAction === 'custom_domain') {
      // Allow user to focus on custom domain input
      setUpgradeModalDismissed(true);
      // Focus the custom domain input after a short delay
      setTimeout(() => {
        (document.getElementById('customDomain') as HTMLInputElement)?.focus();
      }, 100);
    }
    setPendingAction(null);
  };

  const handlePrimaryColorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setValue('primaryColor', e.target.value);
  }, [setValue]);

  const handleSecondaryColorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setValue('secondaryColor', e.target.value);
  }, [setValue]);

  // Voice utility functions
  const getVoiceLanguagesDisplay = (voice: any): string => {
    if (voice.languageCapabilities && voice.languageCapabilities.length > 0) {
      const languages = voice.languageCapabilities.map((lang: string) => {
        const languageNames: Record<string, string> = {
          'en': 'English',
          'es': 'Spanish',
          'ar': 'Arabic',
          'hi': 'Hindi',
          'it': 'Italian',
          'de': 'German',
          'bn': 'Bengali',
          'multilingual': 'Multilingual'
        };
        return languageNames[lang.toLowerCase()] || lang;
      });
      return languages.join(', ');
    }
    return voice.language === 'en-US' || voice.language === 'en' ? 'English' : voice.language || 'English';
  };

  const getVoiceUseCasesDisplay = (voice: any): string => {
    if (voice.useCases && voice.useCases.length > 0) {
      const useCases = voice.useCases.map((useCase: string) => {
        const useCaseNames: Record<string, string> = {
          'customer_service': 'Customer Service',
          'sales': 'Sales',
          'support': 'Support',
          'marketing': 'Marketing',
          'education': 'Education',
          'healthcare': 'Healthcare',
          'finance': 'Finance',
          'real_estate': 'Real Estate',
          'hospitality': 'Hospitality',
          'retail': 'Retail',
          'appointment_booking': 'Appointments',
          'lead_qualification': 'Lead Qualification',
          'general_inquiry': 'General Inquiry'
        };
        return useCaseNames[useCase.toLowerCase()] || useCase.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      });
      return useCases.slice(0, 3).join(', ') + (useCases.length > 3 ? '...' : '');
    }
    return 'General Use';
  };

  // Fetch voices
  const fetchVoices = useCallback(async () => {
    try {
      setLoadingVoices(true);

      // Get the partner token for authentication
      const token = localStorage.getItem('partner_token');
      if (!token) {
        console.error('No partner token found');
        router.push('/partner/login');
        return;
      }

      const response = await fetch('/api/voices', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        // If unauthorized, redirect to login
        localStorage.removeItem('partner_token');
        router.push('/partner/login');
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setVoices(data.voices || []);
      } else {
        console.error('Failed to fetch voices:', response.statusText);
      }
    } catch (error) {
      console.error('Error fetching voices:', error);
    } finally {
      setLoadingVoices(false);
    }
  }, [router]);

  // Check if user is admin
  useEffect(() => {
    // Check if user is admin - this would connect to your admin system
    // For now we'll simulate this by checking localStorage
    setIsAdmin(localStorage.getItem('isAdmin') === 'true');
  }, []);

  // If feature is disabled and user is not admin, redirect to settings page
  useEffect(() => {
    if (!whitelabelEnabled && !isAdmin) {
      router.push('/partner/settings');
    }
  }, [whitelabelEnabled, isAdmin, router]);

  // Fetch voices on component mount
  useEffect(() => {
    fetchVoices();
  }, [fetchVoices]);

  // Filter voices based on language and voice type
  useEffect(() => {
    if (!voices.length) return;

    const selectedLanguage = voiceAiAgentLanguage || 'en';
    const selectedVoiceType = voiceAiAgentVoiceType || 'female';

    const filtered = voices.filter(voice => {
      // Filter by voice type (sex)
      const voiceTypeMatch = voice.sex.toLowerCase() === selectedVoiceType.toLowerCase();

      // Filter by language capability
      let languageMatch = false;
      if (voice.languageCapabilities && voice.languageCapabilities.length > 0) {
        languageMatch = voice.languageCapabilities.some((lang: string) => {
          const normalizedLang = lang.toLowerCase();
          const normalizedTarget = selectedLanguage.toLowerCase();

          return normalizedLang === normalizedTarget ||
                 normalizedLang === 'multilingual' ||
                 (normalizedTarget === 'en' && normalizedLang === 'english') ||
                 (normalizedTarget === 'es' && normalizedLang === 'spanish');
        });
      } else {
        // Fallback to primary language
        languageMatch = voice.language?.toLowerCase() === selectedLanguage.toLowerCase() ||
                      (selectedLanguage === 'en' && (voice.language === 'en-US' || voice.language === 'en'));
      }

      return voiceTypeMatch && languageMatch && voice.isActive;
    });

    setFilteredVoices(filtered);
  }, [voices, voiceAiAgentLanguage, voiceAiAgentVoiceType]);

  // Fetch partner data function
  const fetchPartnerDetails = useCallback(async () => {
    try {
      // First check if we have a token
      const token = localStorage.getItem('partner_token');
      if (!token) {
        router.push('/partner/login');
        return;
      }

      // Use the proper endpoint with authentication
      const response = await fetch('/api/partner/whitelabel/settings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        // If unauthorized, redirect to login
        localStorage.removeItem('partner_token');
        router.push('/partner/login');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch partner details');
      }

      const data = await response.json();
      setPartner(data.partner);

      // Use partner tier from API response (computed server-side with proper env vars)
      // This ensures accurate Stripe price ID matching for enterprise detection
      const tier = data.partner.partnerTier as PartnerTier || PartnerTier.FREE_FOREVER;
      setPartnerTier(tier);

      // Set theme if available
      if (data.partner.themePreference) {
        setSelectedTheme(data.partner.themePreference as PortalTheme);
      }

      // Set portal mode if available, otherwise default to BASIC
      if (data.partner.portalMode) {
        const mode = data.partner.portalMode as PortalMode;
        // Validate that the partner can access this mode (including manual SaaS mode)
        if (canAccessPortalModeWithManualSaaS(tier, mode, data.partner.manualSaasModeEnabled)) {
          setSelectedPortalMode(mode);
        } else {
          // If they can't access the saved mode, default to BASIC
          setSelectedPortalMode(PortalMode.BASIC);
        }
      } else {
        setSelectedPortalMode(PortalMode.BASIC);
      }

      // Set logo preview if available
      if (data.partner.logo) {
        setLogoPreview(data.partner.logo);
      }

      // Set favicon preview if available
      if (data.partner.favicon) {
        setFaviconPreview(data.partner.favicon);
      }

      // Pre-fill form with existing data
      setValue('subdomain', data.partner.subdomain || '');
      setValue('customDomain', data.partner.customDomain || '');
      setValue('customerPortalEnabled', data.partner.customerPortalEnabled || false);
      setValue('enableCustomerSignup', data.partner.enableCustomerSignup || false);
      setValue('logoSize', data.partner.logoSize || 'medium');
      setValue('primaryColor', data.partner.primaryColor || '#3B82F6');
      setValue('secondaryColor', data.partner.secondaryColor || '#10B981');
      setValue('fontFamily', data.partner.fontFamily || 'Inter');
      setValue('portalTitle', data.partner.portalTitle || `${data.partner.businessName} AI Portal`);
      setValue('portalSlogan', data.partner.portalSlogan || 'Powered by advanced voice AI technology');
      setValue('themePreference', data.partner.themePreference || PortalTheme.MODERN);
      setValue('basicPortalLanguage', data.partner.basicPortalLanguage || 'en');
      setValue('saasPortalLanguage', data.partner.saasPortalLanguage || 'en');
      setValue('saasAgentTier', data.partner.saasAgentTier || getDefaultAgentTier());
      setValue('voiceAiAgentEnabled', data.partner.voiceAiAgentEnabled || false);
      setValue('voiceAiAgentPricingNote', data.partner.voiceAiAgentPricingNote || '');
      setValue('voiceAiAgentSpecialOffer', data.partner.voiceAiAgentSpecialOffer || '');
      setValue('voiceAiAgentName', data.partner.voiceAiAgentName || 'Knotie');
      setValue('voiceAiAgentVoiceType', data.partner.voiceAiAgentVoiceType || 'female');
      setValue('voiceAiAgentLanguage', data.partner.voiceAiAgentLanguage || 'en');
      setValue('voiceAiAgentVoiceConfig', data.partner.voiceAiAgentVoiceConfig ? JSON.stringify(data.partner.voiceAiAgentVoiceConfig) : '');

      // Enhanced Landing Page Configuration
      setValue('supportEmail', data.partner.supportEmail || '');
      setValue('companyAddress', data.partner.companyAddress || '');
      setValue('companyPhone', data.partner.companyPhone || '');
      setValue('privacyPolicyUrl', data.partner.privacyPolicyUrl || '');
      setValue('termsOfServiceUrl', data.partner.termsOfServiceUrl || '');
      setValue('statusPageUrl', data.partner.statusPageUrl || '');
      setValue('customLandingPageUrl', (data.partner as any).customLandingPageUrl || '');

      // Social Media Links
      setValue('twitterUrl', data.partner.twitterUrl || '');
      setValue('linkedinUrl', data.partner.linkedinUrl || '');
      setValue('facebookUrl', data.partner.facebookUrl || '');
      setValue('instagramUrl', data.partner.instagramUrl || '');

      // Landing Page Content
      setValue('features', data.partner.features || '');
      setValue('testimonials', data.partner.testimonials || '');
      setValue('faqs', data.partner.faqs || '');
      setValue('trustIndicators', data.partner.trustIndicators || '');

      // Footer Section Controls (default to true for better UX)
      setValue('showQuickLinks', data.partner.showQuickLinks !== false);
      setValue('showResources', data.partner.showResources !== false);
      setValue('showNewsletter', data.partner.showNewsletter !== false);
      setValue('showLegal', data.partner.showLegal !== false);
      setValue('showSocialMedia', data.partner.showSocialMedia !== false);
      setValue('showContactInfo', data.partner.showContactInfo !== false);
      setValue('showCommunity', data.partner.showCommunity || false);
      setValue('communityUrl', data.partner.communityUrl || '');
      setValue('moreTestimonialsUrl', data.partner.moreTestimonialsUrl || '');

      // SaaS Portal Configuration
      setValue('characterName', data.partner.characterName || '');
      setValue('freeTrialEnabled', data.partner.freeTrialEnabled !== false); // Default to true
      setValue('saasOnboardingEnabled', data.partner.saasOnboardingEnabled || false);
      setValue('freeAiCredits', data.partner.freeAiCredits || 50);
      setValue('pricingModel', data.partner.pricingModel || 'subscription');
      setValue('payAsYouGoRate', data.partner.payAsYouGoRate || 0.10);
      setValue('autoDeployEnabled', data.partner.autoDeployEnabled || false);

      // Telephony Provider Configuration
      setValue('useOwnTelephonyProvider', data.partner.useOwnTelephonyProvider || false);
      setValue('telephonyProvider', data.partner.telephonyProvider || '');
      // Credentials are decrypted on the server side and passed as individual fields for display
      setValue('telephonyAccountSid', data.partner.telephonyAccountSid || '');
      setValue('telephonyAuthToken', data.partner.telephonyAuthToken || '');
      setValue('telephonyApiKey', data.partner.telephonyApiKey || '');

      // Fixed Price Configuration (Display Only)
      setValue('fixedPrice', data.partner.fixedPrice || 0);
      setValue('fixedPriceCurrency', data.partner.fixedPriceCurrency || 'USD');
      setValue('fixedPricePeriod', data.partner.fixedPricePeriod || 'month');
      setValue('fixedPriceFeatures', data.partner.fixedPriceFeatures || '');

      // Business Lookup Configuration
      setValue('businessLookupEnabled', data.partner.businessLookupEnabled || false);
      setValue('businessLookupDailyLimit', data.partner.businessLookupDailyLimit || 1000);
      setValue('businessLookupMonthlyBudgetUsd', data.partner.businessLookupMonthlyBudgetUsd || 100.00);

      // Set the voice configuration state if it exists
      if (data.partner.voiceAiAgentVoiceConfig) {
        setSelectedVoiceConfig(data.partner.voiceAiAgentVoiceConfig);
      }
    } catch (error) {
      console.error('Error fetching partner:', error);
      setError('Failed to load partner details');
    } finally {
      setLoading(false);
    }
  }, [router, setValue]);

  // Fetch partner data on component mount
  useEffect(() => {
    fetchPartnerDetails();
  }, [fetchPartnerDetails]);

  // Check subdomain availability when it changes
  useEffect(() => {
    if (!subdomain || subdomain.length < 3) {
      setIsSubdomainAvailable(null);
      setSubdomainCheckResult(null);
      return;
    }

    // Don't check if it's the same as existing subdomain
    if (partner && subdomain === partner.subdomain) {
      setIsSubdomainAvailable(true);
      setSubdomainCheckResult({
        available: true,
        reason: 'available',
        message: 'This is your current subdomain'
      });
      return;
    }

    const checkSubdomain = async () => {
      setCheckingSubdomain(true);
      try {
        const token = localStorage.getItem('partner_token');
        if (!token) {
          router.push('/partner/login');
          return;
        }

        const response = await fetch(`/api/partner/settings/check-subdomain?subdomain=${encodeURIComponent(subdomain)}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.status === 401) {
          localStorage.removeItem('partner_token');
          router.push('/partner/login');
          return;
        }

        const data = await response.json();

        if (response.ok) {
          setIsSubdomainAvailable(data.available);
          setSubdomainCheckResult(data);
        } else {
          console.error('Error checking subdomain:', data.error);
          setIsSubdomainAvailable(null);
          setSubdomainCheckResult(null);
        }
      } catch (error) {
        console.error('Error checking subdomain:', error);
        setIsSubdomainAvailable(null);
        setSubdomainCheckResult(null);
      } finally {
        setCheckingSubdomain(false);
      }
    };

    const timer = setTimeout(checkSubdomain, 500);
    return () => clearTimeout(timer);
  }, [subdomain, partner, router]);

  // Cleanup audio and timeouts on component unmount
  useEffect(() => {
    // Clear timeout on page navigation/refresh
    const handleBeforeUnload = () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);

      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
        currentAudioRef.current = null;
      }

      // Clear any pending refresh timeout
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
    };
  }, []);

  // Handle logo file selection
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        setError('Logo image must be less than 2MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setLogoFile(file);
      setRemoveLogo(false);
    }
  };

  // Handle logo removal
  const handleRemoveLogo = () => {
    setLogoPreview(null);
    setLogoFile(null);
    setRemoveLogo(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle favicon upload
  const handleFaviconChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type (accept common favicon formats)
      const validTypes = ['image/x-icon', 'image/vnd.microsoft.icon', 'image/png', 'image/jpeg', 'image/gif', 'image/svg+xml'];
      if (!validTypes.includes(file.type)) {
        alert('Please select a valid favicon file (ICO, PNG, JPG, GIF, or SVG)');
        return;
      }

      // Validate file size (max 1MB for favicon)
      if (file.size > 1024 * 1024) {
        alert('Favicon file size must be less than 1MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        setFaviconPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setFaviconFile(file);
      setRemoveFavicon(false);
    }
  };

  // Handle favicon removal
  const handleRemoveFavicon = () => {
    setFaviconPreview(null);
    setFaviconFile(null);
    setRemoveFavicon(true);
    if (faviconInputRef.current) {
      faviconInputRef.current.value = '';
    }
  };

  // Handle voice playback
  const handleVoicePlayback = async (voice: any) => {
    try {
      // Stop any currently playing audio
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
        currentAudioRef.current = null;
      }

      // If clicking on the same voice that's currently playing, just stop it
      if (playingVoiceId === voice.id) {
        setPlayingVoiceId(null);
        return;
      }

      if (!voice.sampleUrl) {
        console.warn('No sample URL available for voice:', voice.name);
        return;
      }

      const response = await fetch(`/api/voices/${voice.id}/play`);
      if (!response.ok) {
        throw new Error(`Failed to get voice URL: ${response.statusText}`);
      }

      const data = await response.json();
      const audio = new Audio(data.url);

      // Store reference to current audio
      currentAudioRef.current = audio;

      audio.onended = () => {
        setPlayingVoiceId(null);
        currentAudioRef.current = null;
      };

      audio.onerror = () => {
        setPlayingVoiceId(null);
        currentAudioRef.current = null;
      };

      await audio.play();
      setPlayingVoiceId(voice.id);
    } catch (error) {
      console.error('Error playing voice:', error);
      setPlayingVoiceId(null);
      currentAudioRef.current = null;
    }
  };

  // Handle voice selection
  const handleVoiceSelect = (voice: any) => {
    const voiceConfig = {
      voiceId: voice.name,
      voiceModelId: voice.voiceModelId || voice.name,
      provider: voice.provider,
      displayName: voice.displayName,
      language: voiceAiAgentLanguage || 'en',
      languageCapabilities: voice.languageCapabilities || ['en'],
      useCases: voice.useCases || []
    };

    setSelectedVoiceConfig(voiceConfig);
    setValue('voiceAiAgentVoiceConfig', JSON.stringify(voiceConfig));
  };

  // Handle subdomain suggestion click
  const handleSubdomainSuggestionClick = (suggestion: string) => {
    setValue('subdomain', suggestion);
    // Clear the current check result to trigger a new check
    setSubdomainCheckResult(null);
    setIsSubdomainAvailable(null);
  };

  const onSubmit = async (data: WhiteLabelSettings) => {
    if (data.subdomain && (!isSubdomainAvailable || (subdomainCheckResult && !subdomainCheckResult.available))) {
      const errorMessage = subdomainCheckResult?.message || 'Subdomain not available. Please choose a different subdomain.';
      setError(errorMessage);
      return;
    }

    // Validate portal mode access (including manual SaaS mode)
    if (!canAccessPortalModeWithManualSaaS(partnerTier, selectedPortalMode, partner?.manualSaasModeEnabled)) {
      setError(`You don't have access to ${selectedPortalMode} portal mode. Please upgrade your plan or select a different mode.`);
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    // When form is submitted, update the themePreference and portalMode values
    data.themePreference = selectedTheme;
    data.portalMode = selectedPortalMode;

    try {
      // Prepare form data
      const formData = new FormData();
      formData.append('subdomain', data.subdomain || '');
      formData.append('customDomain', data.customDomain || '');
      formData.append('customerPortalEnabled', String(data.customerPortalEnabled));
      formData.append('enableCustomerSignup', String(data.enableCustomerSignup || false));
      formData.append('logoSize', data.logoSize || 'medium');
      formData.append('primaryColor', data.primaryColor || '#3B82F6');
      formData.append('secondaryColor', data.secondaryColor || '#10B981');
      formData.append('fontFamily', data.fontFamily || 'Inter');
      formData.append('portalTitle', data.portalTitle || '');
      formData.append('portalSlogan', data.portalSlogan || '');
      formData.append('themePreference', selectedTheme);
      formData.append('basicPortalLanguage', data.basicPortalLanguage || 'en');
      formData.append('saasPortalLanguage', data.saasPortalLanguage || 'en');
      formData.append('saasAgentTier', data.saasAgentTier || getDefaultAgentTier());
      formData.append('portalMode', selectedPortalMode);
      formData.append('voiceAiAgentEnabled', String(data.voiceAiAgentEnabled || false));
      formData.append('voiceAiAgentPricingNote', data.voiceAiAgentPricingNote || '');
      formData.append('voiceAiAgentSpecialOffer', data.voiceAiAgentSpecialOffer || '');
      formData.append('voiceAiAgentName', data.voiceAiAgentName || 'Knotie');
      formData.append('voiceAiAgentVoiceType', data.voiceAiAgentVoiceType || 'female');
      formData.append('voiceAiAgentLanguage', data.voiceAiAgentLanguage || 'en');
      formData.append('voiceAiAgentVoiceConfig', (() => {
        if (!data.voiceAiAgentVoiceConfig) return '';
        if (typeof data.voiceAiAgentVoiceConfig === 'string') return data.voiceAiAgentVoiceConfig;
        return JSON.stringify(data.voiceAiAgentVoiceConfig);
      })());

      // Enhanced Landing Page Configuration
      formData.append('supportEmail', data.supportEmail || '');
      formData.append('companyAddress', data.companyAddress || '');
      formData.append('companyPhone', data.companyPhone || '');
      formData.append('privacyPolicyUrl', data.privacyPolicyUrl || '');
      formData.append('termsOfServiceUrl', data.termsOfServiceUrl || '');
      formData.append('statusPageUrl', data.statusPageUrl || '');
      // Only send customLandingPageUrl if the tier is eligible (the API enforces this server-side too)
      if (partnerTier === PartnerTier.STARTER || partnerTier === PartnerTier.LIFETIME || partnerTier === PartnerTier.ENTERPRISE) {
        formData.append('customLandingPageUrl', (data as any).customLandingPageUrl || '');
      }

      // Social Media Links
      formData.append('twitterUrl', data.twitterUrl || '');
      formData.append('linkedinUrl', data.linkedinUrl || '');
      formData.append('facebookUrl', data.facebookUrl || '');
      formData.append('instagramUrl', data.instagramUrl || '');

      // Landing Page Content
      formData.append('features', data.features || '');
      formData.append('testimonials', data.testimonials || '');
      formData.append('faqs', data.faqs || '');
      formData.append('trustIndicators', data.trustIndicators || '');

      // Footer Section Controls
      formData.append('showQuickLinks', String(data.showQuickLinks !== false)); // Default to true
      formData.append('showResources', String(data.showResources !== false)); // Default to true
      formData.append('showNewsletter', String(data.showNewsletter !== false)); // Default to true
      formData.append('showLegal', String(data.showLegal !== false)); // Default to true
      formData.append('showSocialMedia', String(data.showSocialMedia !== false)); // Default to true
      formData.append('showContactInfo', String(data.showContactInfo !== false)); // Default to true
      formData.append('showCommunity', String(data.showCommunity || false));
      formData.append('communityUrl', data.communityUrl || '');
      formData.append('moreTestimonialsUrl', data.moreTestimonialsUrl || '');

      // SaaS Portal Configuration
      formData.append('characterName', data.characterName || '');
      formData.append('freeTrialEnabled', String(data.freeTrialEnabled !== false)); // Default to true
      formData.append('saasOnboardingEnabled', String(selectedPortalMode === 'SAAS'));
      formData.append('freeAiCredits', String(data.freeAiCredits || 50));
      formData.append('pricingModel', data.pricingModel || '');
      formData.append('payAsYouGoRate', String(data.payAsYouGoRate || 0.10));
      formData.append('autoDeployEnabled', String(data.autoDeployEnabled || false));

      // Telephony Provider Configuration
      formData.append('useOwnTelephonyProvider', String(data.useOwnTelephonyProvider || false));
      formData.append('telephonyProvider', data.telephonyProvider || '');
      // Twilio credentials
      formData.append('telephonyAccountSid', data.telephonyAccountSid || '');
      formData.append('telephonyAuthToken', data.telephonyAuthToken || '');
      // Telnyx credentials
      formData.append('telephonyApiKey', data.telephonyApiKey || '');

      // Fixed Price Configuration (Display Only)
      formData.append('fixedPrice', String(data.fixedPrice || 0));
      formData.append('fixedPriceCurrency', data.fixedPriceCurrency || 'USD');
      formData.append('fixedPricePeriod', data.fixedPricePeriod || 'month');
      formData.append('fixedPriceFeatures', data.fixedPriceFeatures || '');

      // Business Lookup Configuration
      formData.append('businessLookupEnabled', String(data.businessLookupEnabled || false));
      formData.append('businessLookupDailyLimit', String(data.businessLookupDailyLimit || 1000));
      formData.append('businessLookupMonthlyBudgetUsd', String(data.businessLookupMonthlyBudgetUsd || 100.00));

      // Handle logo upload
      if (logoFile) {
        formData.append('logo', logoFile);
      } else if (removeLogo) {
        formData.append('removeLogo', 'true');
      }

      // Handle favicon upload
      if (faviconFile) {
        formData.append('favicon', faviconFile);
      } else if (removeFavicon) {
        formData.append('removeFavicon', 'true');
      }

      // Handle AI translation if enabled
      if (enableTranslation) {
        setTranslating(true);
        try {
          const translationResponse = await fetch('/api/partner/whitelabel/translate-texts', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('partner_token')}`,
              'Content-Type': 'application/json'
            }
          });

          if (translationResponse.ok) {
            const translationData = await translationResponse.json();
            setTranslationResult({
              success: true,
              message: `Texts translated successfully to ${translationData.languagesTranslated?.length || 0} languages`,
              creditsUsed: translationData.creditsUsed,
              languagesTranslated: translationData.languagesTranslated
            });
          } else {
            const errorData = await translationResponse.json();
            setTranslationResult({
              success: false,
              message: errorData.error || 'Translation failed'
            });
          }
        } catch (translationError) {
          console.error('Translation error:', translationError);
          setTranslationResult({
            success: false,
            message: 'Translation service unavailable'
          });
        } finally {
          setTranslating(false);
        }
      }

      // Submit to API
      const response = await fetch('/api/partner/whitelabel/settings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('partner_token')}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to update settings');
      }

      // If a new custom domain was added, register it
      await response.json();

      if (data.customDomain &&
          (!partner?.customDomain || data.customDomain !== partner.customDomain) &&
          !partner?.customDomainVerified) {

        try {
          // Register the custom domain
          const domainResponse = await fetch('/api/partner/whitelabel/domain', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('partner_token')}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              customDomain: data.customDomain
            })
          });

          if (!domainResponse.ok) {
            throw new Error('Failed to register custom domain');
          }

          const domainData = await domainResponse.json();

          // Show a more detailed success message with DNS instructions
          setSuccess(
            `White-label settings updated successfully! Your custom domain has been registered.
             Please follow the DNS configuration instructions below to verify your domain.`
          );

          // Update the partner object with the new domain information
          // This ensures the DNS instructions are displayed immediately
          if (domainData.partner) {
            setPartner(prevPartner => ({
              ...prevPartner,
              ...domainData.partner
            }));
          }

          // Don't reload the page immediately so the user can see the DNS instructions
          return;
        } catch (error) {
          console.error('Error registering custom domain:', error);
          setError('Failed to register custom domain. Please try again.');
          setSubmitting(false);
          return;
        }
      }

      setSuccess('White-label settings updated successfully!');

      // Don't re-fetch partner data immediately to avoid overriding user's form selections
      // The form will retain the user's selections and they can refresh manually if needed
    } catch (error) {
      console.error('Error saving settings:', error);
      setError('Failed to save settings. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'knotie-ai.pro';

  if (loading) {
    return (
      <PartnerLayout partnerName="Partner" onLogout={() => {
        localStorage.removeItem('partner_token');
        router.push('/partner/login');
      }}>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <FiLoader className="animate-spin w-8 h-8 mb-4 mx-auto text-blue-500" />
            <p>Loading settings...</p>
          </div>
        </div>
      </PartnerLayout>
    );
  }

  // If feature is disabled and user is not admin, show feature unavailable message
  if (!whitelabelEnabled && !isAdmin) {
    return (
      <PartnerLayout partnerName={partner?.businessName || 'Partner'} onLogout={() => {
        localStorage.removeItem('partner_token');
        router.push('/partner/login');
      }}>
        <div className="flex items-center justify-center h-96">
          <div className="text-center max-w-md">
            <FiAlertCircle className="w-16 h-16 mb-6 mx-auto text-amber-500/70" />
            <h2 className="text-xl font-semibold text-white mb-2">White-Label Feature Unavailable</h2>
            <p className="text-gray-400">This feature is currently being tested and is not available yet. Please check back later.</p>
          </div>
        </div>
      </PartnerLayout>
    );
  }

  return (
    <PartnerLayout partnerName={partner?.businessName || 'Partner'} onLogout={() => {
      localStorage.removeItem('partner_token');
      router.push('/partner/login');
    }}>
      {/* Admin Feature Flag Controls - Only visible to admins */}
      {isAdmin && <FeatureFlagControl />}

      <div className="mb-6">
        <nav className="flex mb-4">
          <Link href="/partner/dashboard" className="text-blue-400 hover:text-blue-300">Dashboard</Link>
          <span className="mx-2 text-gray-500">/</span>
          <Link href="/partner/settings" className="text-blue-400 hover:text-blue-300">Settings</Link>
          <span className="mx-2 text-gray-500">/</span>
          <span className="text-gray-300">White Label</span>
        </nav>
        <h1 className="text-2xl font-bold text-white mt-4">White-Label Customer Portal</h1>
        <p className="text-gray-400 mt-1">
          Configure your branded customer portal to provide a seamless experience for your customers.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6 text-red-500">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-6 text-green-500">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-start mb-4">
              <div className="p-2 bg-blue-500/20 rounded-lg mr-3">
                <FiGlobe className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Domain Settings</h2>
                <p className="text-gray-400 text-sm">Configure how customers access your portal</p>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)}>
              {/* Enable Customer Portal */}
              <div className="mb-6">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="customerPortalEnabled"
                    className="w-4 h-4 bg-gray-800 border-gray-700 rounded focus:ring-blue-600"
                    {...register('customerPortalEnabled')}
                  />
                  <label htmlFor="customerPortalEnabled" className="ml-2 text-white font-medium">
                    Enable Customer Portal
                  </label>
                </div>
                <p className="text-gray-500 text-xs ml-6 mt-1">
                  Activate a branded portal for your customers to access voice AI services
                </p>
              </div>

              {/* Enable Customer Signup */}
              <div className="mb-6">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="enableCustomerSignup"
                    className="w-4 h-4 bg-gray-800 border-gray-700 rounded focus:ring-blue-600"
                    {...register('enableCustomerSignup')}
                  />
                  <label htmlFor="enableCustomerSignup" className="ml-2 text-white font-medium">
                    Enable Customer Signup
                  </label>
                </div>
                <p className="text-gray-500 text-xs ml-6 mt-1">
                  Allow new customers to sign up directly through your branded portal
                </p>
                <div className="bg-blue-900/30 border border-blue-800 rounded-lg p-3 mt-2 text-blue-400 text-xs">
                  <FiInfo className="inline-block mr-1" />
                  When enabled, your branded portal will display "Get Started" and "Sign Up" buttons, allowing potential customers to create accounts. You'll be notified of new signups and can manage these customers from your dashboard.
                </div>
              </div>

              {/* Voice AI Agent Configuration */}
              <div className="mb-6">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="voiceAiAgentEnabled"
                    className="w-4 h-4 bg-gray-800 border-gray-700 rounded focus:ring-blue-600"
                    {...register('voiceAiAgentEnabled')}
                  />
                  <label htmlFor="voiceAiAgentEnabled" className="ml-2 text-white font-medium">
                    Enable Interactive Voice AI Agent
                  </label>
                </div>
                <p className="text-gray-500 text-xs ml-6 mt-1">
                  Replace the static microphone button with an interactive Voice AI Agent that customers can talk to
                </p>
                <div className="bg-amber-900/30 border border-amber-800 rounded-lg p-3 mt-2 text-amber-400 text-xs">
                  <FiAlertCircle className="inline-block mr-1" />
                  <strong>Important:</strong> Enabling this feature requires AI Credits. Based on usage, your AI Credits will be deducted for each conversation. Make sure you have sufficient credits before enabling this feature.
                </div>

                {/* Voice AI Agent Configuration Options - Only shown when enabled */}
                {watch('voiceAiAgentEnabled') && (
                  <div className="mt-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                    <h4 className="text-white text-sm font-medium mb-3">Voice AI Agent Configuration</h4>

                    {/* Agent Name */}
                    <div className="mb-4">
                      <label htmlFor="voiceAiAgentName" className="block mb-2 text-sm font-medium text-white">
                        Agent Name
                      </label>
                      <input
                        type="text"
                        id="voiceAiAgentName"
                        className="bg-gray-800 text-white text-sm rounded-lg border border-gray-700 block w-full p-2.5"
                        placeholder="Knotie"
                        {...register('voiceAiAgentName')}
                      />
                      <p className="text-gray-500 text-xs mt-1">
                        The name your AI agent will use when introducing itself to customers
                      </p>
                    </div>

                    {/* Primary Language */}
                    <div className="mb-4">
                      <label htmlFor="voiceAiAgentLanguage" className="block mb-2 text-sm font-medium text-white">
                        Primary Language
                      </label>
                      <select
                        id="voiceAiAgentLanguage"
                        className="bg-gray-800 text-white text-sm rounded-lg border border-gray-700 block w-full p-2.5"
                        {...register('voiceAiAgentLanguage')}
                      >
                        <option value="en">English</option>
                        <option value="es">Spanish</option>
                        <option value="ar">Arabic</option>
                        <option value="hi">Hindi</option>
                        <option value="it">Italian</option>
                        <option value="de">German</option>
                        <option value="bn">Bengali</option>
                      </select>
                      <p className="text-gray-500 text-xs mt-1">
                        The primary language your AI agent will speak
                      </p>
                    </div>

                    {/* Voice Type */}
                    <div className="mb-4">
                      <label htmlFor="voiceAiAgentVoiceType" className="block mb-2 text-sm font-medium text-white">
                        Voice Type
                      </label>
                      <select
                        id="voiceAiAgentVoiceType"
                        className="bg-gray-800 text-white text-sm rounded-lg border border-gray-700 block w-full p-2.5"
                        {...register('voiceAiAgentVoiceType')}
                      >
                        <option value="female">Female Voice</option>
                        <option value="male">Male Voice</option>
                      </select>
                      <p className="text-gray-500 text-xs mt-1">
                        Choose the gender of your AI agent's voice
                      </p>
                    </div>

                    {/* Voice Selection */}
                    <div className="mb-4">
                      <label className="block mb-2 text-sm font-medium text-white">
                        Voice Selection
                        {selectedVoiceConfig && (
                          <span className="ml-2 px-2 py-1 text-xs bg-green-900/30 text-green-400 rounded-full border border-green-800">
                            {selectedVoiceConfig.displayName} Selected
                          </span>
                        )}
                      </label>

                      {loadingVoices ? (
                        <div className="flex items-center justify-center py-8 bg-gray-800 rounded-lg border border-gray-700">
                          <FiLoader className="animate-spin w-5 h-5 text-gray-400 mr-2" />
                          <span className="text-gray-400">Loading voices...</span>
                        </div>
                      ) : filteredVoices.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto bg-gray-800 rounded-lg border border-gray-700 p-3">
                          {filteredVoices.map((voice) => (
                            <div
                              key={voice.id}
                              onClick={() => handleVoiceSelect(voice)}
                              className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                                selectedVoiceConfig?.voiceId === voice.name
                                  ? 'border-blue-500 bg-blue-500/10'
                                  : 'border-gray-600 hover:border-gray-500 bg-gray-700'
                              }`}
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-white truncate flex items-center gap-2">
                                    {voice.displayName}
                                    {selectedVoiceConfig?.voiceId === voice.name && (
                                      <FiCheck className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                    )}
                                  </h4>
                                  <div className="mt-1 space-y-1">
                                    <div className="text-xs text-gray-400">
                                      <span className="font-medium text-gray-300">Languages:</span> {getVoiceLanguagesDisplay(voice)}
                                    </div>
                                    <div className="text-xs text-gray-400">
                                      <span className="font-medium text-gray-300">Best for:</span> {getVoiceUseCasesDisplay(voice)}
                                    </div>
                                    <div className="text-xs text-gray-400">
                                      <span className="font-medium text-gray-300">Voice:</span> {voice.sex} • {voice.voiceType}
                                      {voice.accent && ` • ${voice.accent}`}
                                    </div>
                                  </div>
                                </div>

                                {voice.sampleUrl && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleVoicePlayback(voice);
                                    }}
                                    className={`p-2 rounded-full flex-shrink-0 ml-2 ${
                                      playingVoiceId === voice.id
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-gray-600 hover:bg-gray-500 text-gray-300'
                                    } transition-colors`}
                                    aria-label={playingVoiceId === voice.id ? "Pause voice" : "Play voice"}
                                  >
                                    {playingVoiceId === voice.id ? (
                                      <FiPause className="w-4 h-4" />
                                    ) : (
                                      <FiPlay className="w-4 h-4" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 bg-gray-800 rounded-lg border border-gray-700">
                          <p className="text-gray-400">No voices available for the selected language and voice type.</p>
                          <p className="text-gray-500 text-xs mt-1">Try selecting a different language or voice type.</p>
                        </div>
                      )}

                      <p className="text-gray-500 text-xs mt-2">
                        Select a specific voice for your AI agent. Voices are filtered by your selected language and voice type.
                      </p>

                      {/* Hidden input for voice configuration */}
                      <input
                        type="hidden"
                        {...register('voiceAiAgentVoiceConfig')}
                      />
                    </div>

                    {/* Pricing Note */}
                    <div className="mb-4">
                      <label htmlFor="voiceAiAgentPricingNote" className="block mb-2 text-sm font-medium text-white">
                        Pricing Note (Optional)
                      </label>
                      <textarea
                        id="voiceAiAgentPricingNote"
                        className="bg-gray-800 text-white text-sm rounded-lg border border-gray-700 block w-full p-2.5"
                        placeholder="e.g., Free for first 5 minutes, then $0.10/minute"
                        rows={2}
                        {...register('voiceAiAgentPricingNote')}
                      />
                      <p className="text-gray-500 text-xs mt-1">
                        Display pricing information to customers before they start using the Voice AI Agent
                      </p>
                    </div>

                    {/* Special Offer */}
                    <div className="mb-4">
                      <label htmlFor="voiceAiAgentSpecialOffer" className="block mb-2 text-sm font-medium text-white">
                        Special Offer (Optional)
                      </label>
                      <textarea
                        id="voiceAiAgentSpecialOffer"
                        className="bg-gray-800 text-white text-sm rounded-lg border border-gray-700 block w-full p-2.5"
                        placeholder="e.g., Get 50% off your first consultation when you book through our AI agent"
                        rows={2}
                        {...register('voiceAiAgentSpecialOffer')}
                      />
                      <p className="text-gray-500 text-xs mt-1">
                        Promote special offers or discounts to encourage customers to use the Voice AI Agent
                      </p>
                    </div>

                    <div className="bg-blue-900/30 border border-blue-800 rounded-lg p-3 text-blue-400 text-xs">
                      <FiInfo className="inline-block mr-1" />
                      The Voice AI Agent will use your business branding and can reference your pricing note and special offers during conversations to provide personalized responses to your customers.
                    </div>
                  </div>
                )}
              </div>

              {/* Subdomain - Only shown if subdomains feature is enabled or user is admin */}
              {(subdomainsEnabled || isAdmin) && (
                <div className="mb-6">
                  <label htmlFor="subdomain" className="block mb-2 text-sm font-medium text-white">
                    Subdomain
                    {!subdomainsEnabled && isAdmin && (
                      <span className="ml-2 text-xs text-amber-500">(Admin Preview)</span>
                    )}
                  </label>
                  <div className="flex items-center">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        id="subdomain"
                        className={`
                          bg-gray-800 text-white text-sm rounded-l-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5
                          ${errors.subdomain ? 'border-red-500' : 'border-gray-700'}
                          ${partner?.subdomain ? 'bg-gray-700 cursor-not-allowed' : ''}
                        `}
                        placeholder="your-brand"
                        {...register('subdomain', {
                          required: !partner?.subdomain && subdomainsEnabled,
                          pattern: /^[a-z0-9-]+$/i,
                          minLength: 3,
                          maxLength: 30
                        })}
                        disabled={!!partner?.subdomain}
                        aria-invalid={errors.subdomain ? 'true' : 'false'}
                      />
                      {checkingSubdomain && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          <FiLoader className="animate-spin h-4 w-4 text-gray-400" />
                        </div>
                      )}
                      {!checkingSubdomain && subdomain && subdomain.length >= 3 && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          {isSubdomainAvailable ? (
                            <FiCheck className="h-4 w-4 text-green-500" />
                          ) : (
                            <FiX className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                      )}
                    </div>
                    <span className="inline-flex items-center px-3 text-sm text-gray-400 bg-gray-700 rounded-r-lg border border-l-0 border-gray-700">
                      .{baseUrl}
                    </span>
                  </div>

                  {!!partner?.subdomain && (
                    <p className="text-amber-500 text-xs mt-2">
                      <FiAlertCircle className="inline mr-1" size={12} />
                      Subdomains cannot be changed after registration for security reasons.
                    </p>
                  )}

                  {errors.subdomain && (
                    <p className="text-red-500 text-xs mt-2">
                      Subdomain must be 3-30 characters and contain only letters, numbers, and hyphens.
                    </p>
                  )}

                  {/* Subdomain availability feedback */}
                  {subdomainCheckResult && subdomain && !checkingSubdomain && !errors.subdomain && (
                    <div className="mt-2">
                      {subdomainCheckResult.available ? (
                        <p className="text-green-500 text-xs">
                          <FiCheckCircle className="inline mr-1" size={12} />
                          {subdomainCheckResult.message}
                        </p>
                      ) : (
                        <div>
                          <p className="text-red-500 text-xs">
                            <FiX className="inline mr-1" size={12} />
                            {subdomainCheckResult.message}
                          </p>

                          {/* Show suggestions for taken subdomains */}
                          {subdomainCheckResult.reason === 'taken' && subdomainCheckResult.suggestions && subdomainCheckResult.suggestions.length > 0 && (
                            <div className="mt-2">
                              <p className="text-gray-400 text-xs mb-1">Available alternatives:</p>
                              <div className="flex flex-wrap gap-1">
                                {subdomainCheckResult.suggestions.map((suggestion, index) => (
                                  <button
                                    key={index}
                                    type="button"
                                    onClick={() => handleSubdomainSuggestionClick(suggestion)}
                                    className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded border border-blue-500/30 hover:bg-blue-500/30 transition-colors"
                                  >
                                    {suggestion}.{baseUrl}
                                  </button>
                                ))}
                              </div>
                              <p className="text-gray-500 text-xs mt-1">
                                <FiInfo className="inline mr-1" size={10} />
                                We may add random numbers to ensure availability if your preferred subdomain is taken.
                              </p>
                            </div>
                          )}

                          {/* Warning for reserved subdomains */}
                          {subdomainCheckResult.reason === 'reserved' && (
                            <p className="text-amber-500 text-xs mt-1">
                              <FiAlertCircle className="inline mr-1" size={10} />
                              Reserved subdomains are protected for system use and cannot be registered.
                            </p>
                          )}

                          {/* Warning for invalid format */}
                          {subdomainCheckResult.reason === 'invalid' && (
                            <p className="text-amber-500 text-xs mt-1">
                              <FiAlertCircle className="inline mr-1" size={10} />
                              Please use only letters, numbers, and hyphens (3-30 characters).
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Custom Domain */}
              <div className="mb-6">
                <label htmlFor="customDomain" className="block mb-2 text-sm font-medium text-white flex items-center">
                  <PremiumFeature iconSize="sm">
                    <span>Custom Domain</span>
                  </PremiumFeature>
                  {partner?.customDomainVerified && (
                    <span className="ml-2 text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">Verified</span>
                  )}
                  {partner?.customDomainStatus === 'pending' && (
                    <span className="ml-2 text-xs bg-yellow-500/20 text-amber-400 px-2 py-0.5 rounded-full">Pending Verification</span>
                  )}
                  {partner?.customDomainStatus === 'failed' && (
                    <span className="ml-2 text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">Verification Failed</span>
                  )}
                </label>
                <div className="flex">
                  <input
                    type="text"
                    id="customDomain"
                    className="bg-gray-800 text-white text-sm rounded-lg border border-gray-700 block w-full p-2.5"
                    placeholder="portal.yourdomain.com"
                    {...register('customDomain')}
                    disabled={partner?.customDomainVerified}
                    onFocus={async () => {
                      try {
                        // Don't show modal if already dismissed in this session
                        if (upgradeModalDismissed) {
                          return;
                        }

                        const shouldShowFreeForeverUpgrade = await FreeForeverUpgradeService.shouldShowUpgradeEncouragement();

                        if (shouldShowFreeForeverUpgrade) {
                          // Show free forever upgrade modal
                          const upgradeMessage = FreeForeverUpgradeService.getUpgradeMessage('custom_domain');
                          setFreeForeverUpgradeData(upgradeMessage);
                          setShowFreeForeverUpgrade(true);
                          setPendingAction('custom_domain');
                          // Blur the input to prevent typing
                          (document.getElementById('customDomain') as HTMLInputElement)?.blur();
                        }
                      } catch (error) {
                        console.error('Error checking custom domain access:', error);
                      }
                    }}
                  />
                  {partner?.customDomain && !partner?.customDomainVerified && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          setVerifying(true);
                          const response = await fetch('/api/partner/whitelabel/domain/verify', {
                            headers: {
                              'Authorization': `Bearer ${localStorage.getItem('partner_token')}`
                            }
                          });

                          if (!response.ok) {
                            throw new Error('Failed to verify domain');
                          }

                          const data = await response.json();

                          if (data.status === 'verified') {
                            setSuccess('Domain verified successfully!');

                            // Update the partner state
                            setPartner(prevPartner => ({
                              ...prevPartner,
                              customDomainVerified: true,
                              customDomainStatus: 'verified'
                            }));

                            // Disable the input field
                            const customDomainInput = document.getElementById('customDomain') as HTMLInputElement;
                            if (customDomainInput) {
                              customDomainInput.disabled = true;
                            }

                            // Save the updated state to the server to ensure it persists
                            try {
                              // Use the existing settings API to save the updated state
                              const formData = new FormData();
                              formData.append('customDomainVerified', 'true');
                              formData.append('customDomainStatus', 'verified');

                              // Include other required fields to avoid overwriting them
                              if (partner?.subdomain) {
                                formData.append('subdomain', partner.subdomain);
                              }
                              if (partner?.customDomain) {
                                formData.append('customDomain', partner.customDomain);
                              }
                              formData.append('customerPortalEnabled', String(partner?.customerPortalEnabled || false));

                              // Send the update to the server
                              fetch('/api/partner/whitelabel/settings', {
                                method: 'POST',
                                headers: {
                                  'Authorization': `Bearer ${localStorage.getItem('partner_token')}`
                                },
                                body: formData
                              }).then(response => {
                                if (!response.ok) {
                                  console.error('Failed to save verification status');
                                } else {
                                  console.log('Verification status saved successfully');
                                }
                              }).catch(error => {
                                console.error('Error saving verification status:', error);
                              });
                            } catch (error) {
                              console.error('Error saving verification status:', error);
                            }
                          } else if (data.verification) {
                            // Show detailed verification status
                            setError(
                              `Domain verification in progress. Current status:
                              Hostname: ${data.verification.hostnameStatus},
                              SSL: ${data.verification.sslStatus}.
                              Please check your DNS settings and try again.`
                            );
                          } else {
                            setError(`Domain verification pending. Please check DNS settings.`);
                          }
                        } catch (error) {
                          console.error('Error verifying domain:', error);
                          setError('Failed to verify domain. Please try again.');
                        } finally {
                          setVerifying(false);
                        }
                      }}
                      className="ml-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center"
                      disabled={verifying}
                    >
                      {verifying ? (
                        <>
                          <FiLoader className="mr-1.5 animate-spin" size={14} />
                          Verifying...
                        </>
                      ) : (
                        <>Verify</>
                      )}
                    </button>
                  )}
                </div>
                <p className="text-gray-500 text-xs mt-1">
                  Use your own domain for the customer portal (requires DNS setup).
                  {partner?.customDomainVerified && (
                    <span className="block mt-1 text-amber-500">
                      <FiAlertCircle className="inline mr-1" size={12} />
                      Custom domains cannot be changed after verification for security reasons.
                    </span>
                  )}
                </p>

                {/* Show success message if domain is verified */}
                {partner?.customDomain && partner?.customDomainVerified && (
                  <div className="mt-3 animate-fadeIn">
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                      <h4 className="text-green-400 text-sm font-medium mb-2 flex items-center">
                        <FiCheckCircle className="mr-1.5" size={14} />
                        Domain Verified Successfully
                      </h4>
                      <p className="text-gray-400 text-xs">
                        Your custom domain <span className="font-mono text-green-400">{partner.customDomain}</span> is now active and ready to use.
                        Your customers can access your portal at <a href={`https://${partner.customDomain}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">https://{partner.customDomain}</a>.
                      </p>
                    </div>
                  </div>
                )}

                {/* Show verification instructions if domain is pending verification */}
                {partner?.customDomain && partner?.customDomainStatus === 'pending' && (
                  <div className="mt-3 animate-fadeIn">
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                      <h4 className="text-amber-400 text-sm font-medium mb-2 flex items-center">
                        <FiAlertCircle className="mr-1.5" size={14} />
                        Domain Verification Required
                      </h4>

                      <div className="bg-gray-800/50 p-3 rounded-lg mb-3">
                        <h5 className="text-white text-xs font-medium mb-2">How to Verify Your Domain</h5>
                        <ol className="text-gray-400 text-xs space-y-1 ml-4 list-decimal">
                          <li>Log in to your domain registrar or DNS provider (e.g., GoDaddy, Namecheap, Cloudflare)</li>
                          <li>Navigate to the DNS management section for <span className="font-mono text-blue-400">{partner.customDomain}</span></li>
                          <li>Add the CNAME record shown in the table below</li>
                          {partner.customDomainTxtToken && (
                            <li>Add the TXT record for domain ownership verification</li>
                          ) as React.ReactNode}
                          <li>Wait for DNS propagation (can take from a few minutes to 48 hours)</li>
                          <li>Click the "Verify" button to check if your domain is properly configured</li>
                        </ol>
                      </div>

                      <h5 className="text-white text-xs font-medium mb-2">Required DNS Records:</h5>
                      <div className="mt-2 overflow-x-auto bg-gray-900/50 p-2 rounded-lg border border-gray-700">
                        <table className="text-xs w-full">
                          <thead>
                            <tr className="text-gray-400 border-b border-gray-700">
                              <th className="text-left py-2 px-2">Record Type</th>
                              <th className="text-left py-2 px-2">Name</th>
                              <th className="text-left py-2 px-2">Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b border-gray-700">
                              <td className="py-2 px-2 font-mono text-blue-400">CNAME</td>
                              <td className="py-2 px-2 font-mono text-white">{partner.customDomain}</td>
                              <td className="py-2 px-2 font-mono text-green-400">{partner.customDomainTarget || `custom.knotie-ai.pro`}</td>
                            </tr>
                            {partner.customDomainTxtToken && (
                              <tr>
                                <td className="py-2 px-2 font-mono text-blue-400">TXT</td>
                                <td className="py-2 px-2 font-mono text-white">_knotie-verification.{partner.customDomain}</td>
                                <td className="py-2 px-2 font-mono text-green-400">{partner.customDomainTxtToken}</td>
                              </tr>
                            ) as React.ReactNode}
                          </tbody>
                        </table>
                      </div>

                      <div className="mt-3 bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                        <h5 className="text-blue-400 text-xs font-medium mb-1 flex items-center">
                          <FiInfo className="mr-1.5" size={12} />
                          Important Note
                        </h5>
                        <p className="text-gray-400 text-xs mb-2">
                          After adding the CNAME record, we'll automatically handle the SSL certificate for your domain.
                          This process is managed through HTTP validation, which requires your domain to be properly pointing to our servers.
                        </p>
                      </div>

                      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mt-3">
                        <h5 className="text-blue-400 text-xs font-medium mb-1 flex items-center">
                          <FiInfo className="mr-1.5" size={12} />
                          DNS Configuration Tips
                        </h5>
                        <ul className="text-gray-400 text-xs space-y-1 ml-4 list-disc">
                          <li>For the CNAME record, some providers require you to enter only the subdomain part (e.g., "portal" instead of "portal.yourdomain.com")</li>
                          <li>If you're using Cloudflare, make sure to set the proxy status to "Proxied" (orange cloud)</li>
                          <li>If your domain is managed in Cloudflare, you can use the one-click verification option below</li>
                        </ul>
                      </div>

                      <p className="text-gray-400 text-xs mt-3">
                        DNS changes can take up to 48 hours to propagate. Click the "Verify" button to check if your domain is verified.
                      </p>

                      {/* Cloudflare One-Click Verification Option */}
                      <div className="mt-6 pt-5 border-t border-gray-700">
                        <div className="bg-blue-600/20 border border-blue-500/40 rounded-lg p-4">
                          <h4 className="text-blue-300 text-sm font-medium mb-2 flex items-center">
                            <FiGlobe className="mr-2" size={16} />
                            Using Cloudflare? Verify Instantly
                          </h4>
                          <p className="text-gray-300 text-xs mb-3">
                            If your domain is managed in Cloudflare, you can verify it instantly and have the DNS records
                            automatically configured for you.
                          </p>

                          <div className="bg-gray-800/50 p-3 rounded-lg mb-3">
                            <h5 className="text-white text-xs font-medium mb-2">How to use One-Click Verification:</h5>
                            <ol className="text-gray-400 text-xs space-y-1 ml-4 list-decimal">
                              <li>Create a Cloudflare API Token with <span className="text-blue-300">Zone:DNS:Edit</span> permission for your domain</li>
                              <li>Find your Zone ID in the Cloudflare dashboard (Overview page, right sidebar)</li>
                              <li>Click the button below and enter these credentials when prompted</li>
                            </ol>
                          </div>

                          <button
                            type="button"
                            onClick={async () => {
                              // Show a modal or prompt for Cloudflare credentials
                              const cloudflareApiToken = prompt("Enter your Cloudflare API Token (with DNS edit permissions):");
                              if (!cloudflareApiToken) return;

                              const cloudflareZoneId = prompt("Enter your Cloudflare Zone ID for this domain:");
                              if (!cloudflareZoneId) return;

                              setSubmitting(true);
                              try {
                                const response = await fetch('/api/partner/whitelabel/domain/cloudflare-verify', {
                                  method: 'POST',
                                  headers: {
                                    'Authorization': `Bearer ${localStorage.getItem('partner_token')}`,
                                    'Content-Type': 'application/json'
                                  },
                                  body: JSON.stringify({
                                    customDomain: partner.customDomain,
                                    cloudflareApiToken,
                                    cloudflareZoneId
                                  })
                                });

                                const data = await response.json();

                                if (response.ok && data.success) {
                                  setSuccess('Domain verified successfully! Your DNS records have been automatically configured.');

                                  // Update the partner state
                                  setPartner(prevPartner => ({
                                    ...prevPartner,
                                    customDomainVerified: true,
                                    customDomainStatus: 'verified'
                                  }));

                                  // Disable the input field
                                  const customDomainInput = document.getElementById('customDomain') as HTMLInputElement;
                                  if (customDomainInput) {
                                    customDomainInput.disabled = true;
                                  }

                                  // Save the updated state to the server to ensure it persists
                                  try {
                                    // Use the existing settings API to save the updated state
                                    const formData = new FormData();
                                    formData.append('customDomainVerified', 'true');
                                    formData.append('customDomainStatus', 'verified');

                                    // Include other required fields to avoid overwriting them
                                    if (partner?.subdomain) {
                                      formData.append('subdomain', partner.subdomain);
                                    }
                                    if (partner?.customDomain) {
                                      formData.append('customDomain', partner.customDomain);
                                    }
                                    formData.append('customerPortalEnabled', String(partner?.customerPortalEnabled || false));

                                    // Send the update to the server
                                    fetch('/api/partner/whitelabel/settings', {
                                      method: 'POST',
                                      headers: {
                                        'Authorization': `Bearer ${localStorage.getItem('partner_token')}`
                                      },
                                      body: formData
                                    }).then(response => {
                                      if (!response.ok) {
                                        console.error('Failed to save verification status');
                                      } else {
                                        console.log('Verification status saved successfully');
                                      }
                                    }).catch(error => {
                                      console.error('Error saving verification status:', error);
                                    });
                                  } catch (error) {
                                    console.error('Error saving verification status:', error);
                                  }
                                } else {
                                  setError(data.error || 'Failed to verify domain with Cloudflare. Please try manual verification.');
                                }
                              } catch (error) {
                                console.error('Error verifying with Cloudflare:', error);
                                setError('Failed to verify domain. Please try manual verification.');
                              } finally {
                                setSubmitting(false);
                              }
                            }}
                            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center justify-center"
                          >
                            <FiGlobe className="mr-2" size={16} />
                            One-Click Verify with Cloudflare
                          </button>
                          <p className="text-gray-400 text-xs mt-2 text-center">
                            Your Cloudflare credentials are used only for this verification and are not stored.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Show feature details when user starts typing */}
                {customDomain && customDomain.length > 0 && !partner?.customDomain && (
                  <div className="mt-3 animate-fadeIn">
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                      <h4 className="text-blue-400 text-xs font-medium mb-1 flex items-center">
                        <FiGlobe className="mr-1.5" size={12} />
                        Custom Domain Setup
                      </h4>
                      <p className="text-gray-400 text-xs">
                        Custom domains allow your customers to access the portal using your own branded domain
                        (e.g., portal.yourbrand.com) instead of a subdomain.
                      </p>
                    </div>

                    <div className="mt-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                      <h4 className="text-amber-400 text-xs font-medium mb-1 flex items-center">
                        <FiAlertCircle className="mr-1.5" size={12} />
                        How It Works
                      </h4>
                      <p className="text-gray-400 text-xs">
                        After saving your settings:
                      </p>
                      <ol className="text-gray-400 text-xs mt-2 ml-4 list-decimal">
                        <li className="mb-1">You'll receive DNS configuration instructions</li>
                        <li className="mb-1">Add the required DNS records at your domain registrar</li>
                        <li className="mb-1">Click "Verify" to check your domain setup</li>
                        <li>Once verified, your custom domain will be active</li>
                      </ol>
                    </div>

                    <div className="mt-3 bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                      <h4 className="text-blue-400 text-xs font-medium mb-1 flex items-center">
                        <FiGlobe className="mr-1.5" size={12} />
                        Using Cloudflare?
                      </h4>
                      <p className="text-gray-400 text-xs mb-2">
                        If your domain is managed in Cloudflare, you can use our one-click verification after saving.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Portal Branding */}
              {(customizationEnabled || isAdmin) && (
                <div className="mt-8">
                  <h3 className="text-white text-md font-medium mb-4">
                    Portal Branding
                    {!customizationEnabled && isAdmin && (
                      <span className="ml-2 text-xs text-amber-500">(Admin Preview)</span>
                    )}
                  </h3>

                  {/* Logo Upload */}
                  <div className="mb-6">
                    <label className="block mb-2 text-sm font-medium text-white">
                      Company Logo
                    </label>
                    <div className="flex items-center gap-4">
                      <div className="h-20 w-40 bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden">
                        {logoPreview ? (
                          <img
                            src={logoPreview}
                            alt="Logo Preview"
                            className="h-full object-contain"
                          />
                        ) : (
                          <div className="text-center">
                            <FiImage className="h-8 w-8 mx-auto text-gray-500 mb-1" />
                            <span className="text-gray-400 text-xs">No logo</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoChange}
                          className="hidden"
                          ref={fileInputRef}
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                        >
                          <FiUpload className="w-4 h-4" />
                          Upload Logo
                        </button>
                        {logoPreview && (
                          <button
                            type="button"
                            onClick={handleRemoveLogo}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                          >
                            <FiTrash2 className="w-4 h-4" />
                            Remove Logo
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Recommended size: 300x150px. Max size: 2MB.</p>
                  </div>

                  {/* Logo Size */}
                  <div className="mb-6">
                    <label htmlFor="logoSize" className="block mb-2 text-sm font-medium text-white">
                      Logo Size
                    </label>
                    <select
                      id="logoSize"
                      className="bg-gray-800 text-white text-sm rounded-lg border border-gray-700 block w-full p-2.5"
                      {...register('logoSize')}
                    >
                      <option value="small">Small (32px height)</option>
                      <option value="medium">Medium (48px height)</option>
                      <option value="large">Large (64px height)</option>
                      <option value="extra-large">Extra Large (80px height)</option>
                    </select>
                    <p className="text-xs text-gray-400 mt-2">
                      Choose how large your logo appears in the customer portal header.
                    </p>
                  </div>

                  {/* Favicon Upload */}
                  <div className="mb-6">
                    <label className="block mb-2 text-sm font-medium text-white">
                      Favicon
                    </label>
                    <div className="flex items-center gap-4">
                      <div className="h-16 w-16 bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden">
                        {faviconPreview ? (
                          <img
                            src={faviconPreview}
                            alt="Favicon Preview"
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <div className="text-center">
                            <FiImage className="h-6 w-6 mx-auto text-gray-500 mb-1" />
                            <span className="text-gray-400 text-xs">No favicon</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <input
                          type="file"
                          accept=".ico,.png,.jpg,.jpeg,.gif,.svg,image/x-icon,image/vnd.microsoft.icon,image/png,image/jpeg,image/gif,image/svg+xml"
                          onChange={handleFaviconChange}
                          className="hidden"
                          ref={faviconInputRef}
                        />
                        <button
                          type="button"
                          onClick={() => faviconInputRef.current?.click()}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                        >
                          <FiUpload className="w-4 h-4" />
                          Upload Favicon
                        </button>
                        {faviconPreview && (
                          <button
                            type="button"
                            onClick={handleRemoveFavicon}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                          >
                            <FiTrash2 className="w-4 h-4" />
                            Remove Favicon
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      Upload your brand favicon (ICO, PNG, JPG, GIF, or SVG). Recommended size: 32x32px or 16x16px. Max size: 1MB.
                    </p>
                  </div>

                  {/* Brand Colors */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                      <label htmlFor="primaryColor" className="block mb-2 text-sm font-medium text-white">
                        Primary Color
                      </label>
                      <div className="flex items-center">
                        <input
                          type="color"
                          id="primaryColor"
                          className="h-10 w-10 rounded border-0 bg-transparent cursor-pointer"
                          {...register('primaryColor')}
                        />
                        <input
                          type="text"
                          className="bg-gray-800 text-white text-sm rounded-lg border border-gray-700 ml-2 p-2.5 flex-1"
                          value={watch('primaryColor') || '#3B82F6'}
                          onChange={handlePrimaryColorChange}
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="secondaryColor" className="block mb-2 text-sm font-medium text-white">
                        Secondary Color
                      </label>
                      <div className="flex items-center">
                        <input
                          type="color"
                          id="secondaryColor"
                          className="h-10 w-10 rounded border-0 bg-transparent cursor-pointer"
                          {...register('secondaryColor')}
                        />
                        <input
                          type="text"
                          className="bg-gray-800 text-white text-sm rounded-lg border border-gray-700 ml-2 p-2.5 flex-1"
                          value={watch('secondaryColor') || '#10B981'}
                          onChange={handleSecondaryColorChange}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Font Selection */}
                  <div className="mb-6">
                    <label htmlFor="fontFamily" className="block mb-2 text-sm font-medium text-white">
                      Font Family
                    </label>
                    <select
                      id="fontFamily"
                      className="bg-gray-800 text-white text-sm rounded-lg border border-gray-700 block w-full p-2.5"
                      {...register('fontFamily')}
                    >
                      <option value="Inter">Inter</option>
                      <option value="Poppins">Poppins</option>
                      <option value="Roboto">Roboto</option>
                      <option value="Montserrat">Montserrat</option>
                    </select>
                  </div>

                  {/* Portal Title */}
                  <div className="mb-4">
                    <label htmlFor="portalTitle" className="block mb-2 text-sm font-medium text-white">
                      Portal Title
                    </label>
                    <input
                      type="text"
                      id="portalTitle"
                      className="bg-gray-800 text-white text-sm rounded-lg border border-gray-700 block w-full p-2.5"
                      placeholder="Your Brand AI Portal"
                      {...register('portalTitle')}
                    />
                  </div>

                  {/* Portal Slogan */}
                  <div className="mb-4">
                    <label htmlFor="portalSlogan" className="block mb-2 text-sm font-medium text-white">
                      Portal Slogan
                    </label>
                    <input
                      type="text"
                      id="portalSlogan"
                      className="bg-gray-800 text-white text-sm rounded-lg border border-gray-700 block w-full p-2.5"
                      placeholder="Powered by advanced voice AI technology"
                      {...register('portalSlogan')}
                    />
                  </div>
                </div>
              )}

              {/* Enhanced Landing Page Configuration */}
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mt-8">
                <div className="flex items-start mb-4">
                  <div className="p-2 bg-purple-500/20 rounded-lg mr-3">
                    <FiSettings className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Landing Page Configuration</h2>
                    <p className="text-gray-400 text-sm">Configure additional content and contact information for your landing page</p>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="mb-6">
                  <h3 className="text-white font-medium mb-3">Contact Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="supportEmail" className="block mb-2 text-sm font-medium text-white">
                        Support Email
                      </label>
                      <input
                        type="email"
                        id="supportEmail"
                        className="bg-gray-800 text-white text-sm rounded-lg border border-gray-700 block w-full p-2.5"
                        placeholder="support@yourbusiness.com"
                        {...register('supportEmail')}
                      />
                      <p className="text-gray-500 text-xs mt-1">
                        Email address for customer support inquiries
                      </p>
                    </div>
                    <div>
                      <label htmlFor="companyPhone" className="block mb-2 text-sm font-medium text-white">
                        Company Phone
                      </label>
                      <input
                        type="tel"
                        id="companyPhone"
                        className="bg-gray-800 text-white text-sm rounded-lg border border-gray-700 block w-full p-2.5"
                        placeholder="+1 (555) 123-4567"
                        {...register('companyPhone')}
                      />
                      <p className="text-gray-500 text-xs mt-1">
                        Phone number for customer contact
                      </p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <label htmlFor="companyAddress" className="block mb-2 text-sm font-medium text-white">
                      Company Address
                    </label>
                    <textarea
                      id="companyAddress"
                      className="bg-gray-800 text-white text-sm rounded-lg border border-gray-700 block w-full p-2.5"
                      placeholder="123 Business St, Suite 100, City, State 12345"
                      rows={2}
                      {...register('companyAddress')}
                    />
                    <p className="text-gray-500 text-xs mt-1">
                      Physical address of your business
                    </p>
                  </div>
                </div>

                {/* Legal Links */}
                <div className="mb-6">
                  <h3 className="text-white font-medium mb-3">Legal & Policy Links</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="privacyPolicyUrl" className="block mb-2 text-sm font-medium text-white">
                        Privacy Policy URL
                      </label>
                      <input
                        type="url"
                        id="privacyPolicyUrl"
                        className="bg-gray-800 text-white text-sm rounded-lg border border-gray-700 block w-full p-2.5"
                        placeholder="https://yourbusiness.com/privacy"
                        {...register('privacyPolicyUrl')}
                      />
                    </div>
                    <div>
                      <label htmlFor="termsOfServiceUrl" className="block mb-2 text-sm font-medium text-white">
                        Terms of Service URL
                      </label>
                      <input
                        type="url"
                        id="termsOfServiceUrl"
                        className="bg-gray-800 text-white text-sm rounded-lg border border-gray-700 block w-full p-2.5"
                        placeholder="https://yourbusiness.com/terms"
                        {...register('termsOfServiceUrl')}
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label htmlFor="statusPageUrl" className="block mb-2 text-sm font-medium text-white">
                      Status Page URL (Optional)
                    </label>
                    <input
                      type="url"
                      id="statusPageUrl"
                      className="bg-gray-800 text-white text-sm rounded-lg border border-gray-700 block w-full p-2.5"
                      placeholder="https://status.yourbusiness.com"
                      {...register('statusPageUrl')}
                    />
                    <p className="text-gray-500 text-xs mt-1">
                      Link to your system status page for transparency
                    </p>
                  </div>

                  {/* Custom Landing Page URL – Starter/Lifetime/Enterprise only */}
                  {(partnerTier === PartnerTier.STARTER || partnerTier === PartnerTier.LIFETIME || partnerTier === PartnerTier.ENTERPRISE) ? (
                    <div className="mt-4">
                      <label htmlFor="customLandingPageUrl" className="block mb-2 text-sm font-medium text-white flex items-center gap-2">
                        Custom Landing Page URL
                        <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded border border-purple-500/30">
                          Starter / Lifetime / Enterprise
                        </span>
                      </label>
                      <input
                        type="url"
                        id="customLandingPageUrl"
                        className="bg-gray-800 text-white text-sm rounded-lg border border-gray-700 block w-full p-2.5"
                        placeholder="https://yourbusiness.com/welcome"
                        {...register('customLandingPageUrl')}
                      />
                      <p className="text-gray-500 text-xs mt-1">
                        When set, customer Welcome and Portal Invite emails will link to this page instead of the default portal login. Action links (password reset, email verification) are not affected.
                      </p>

                      {/* Warning: only shown when a URL has been entered */}
                      {watch('customLandingPageUrl') && (
                        <div className="mt-3 flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                          <FiAlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-amber-300 text-xs font-medium mb-1">
                              Important: Add a Login button to your landing page
                            </p>
                            <p className="text-amber-200/70 text-xs leading-relaxed">
                              Customers receive emails with their login credentials and a <strong className="text-amber-200">"Login to Your Dashboard"</strong> button that points to this URL. Make sure your landing page includes a clearly visible login link or button so customers can access their portal — otherwise they will not know where to sign in.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="block text-sm font-medium text-gray-500">Custom Landing Page URL</span>
                        <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded border border-purple-500/30">
                          Starter / Lifetime / Enterprise
                        </span>
                      </div>
                      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                        <p className="text-gray-500 text-xs">
                          Upgrade to the Starter, Lifetime, or Enterprise plan to redirect customer emails to a custom landing page.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Default Pages Preview */}
                  <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <h4 className="text-blue-400 font-medium mb-3 flex items-center">
                      <FiInfo className="w-4 h-4 mr-2" />
                      Default Legal Pages Available
                    </h4>
                    <p className="text-gray-400 text-sm mb-4">
                      We provide branded default pages for your customers. Leave the URL fields empty to use our default pages,
                      or provide your own URLs to override them.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <a
                        href={`/whitelabel/privacy`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-blue-500/50 transition-colors group"
                      >
                        <div className="flex items-center space-x-2">
                          <FiShield className="w-4 h-4 text-blue-400" />
                          <span className="text-white text-sm">Privacy Policy</span>
                        </div>
                        <FiExternalLink className="w-3 h-3 text-gray-500 group-hover:text-blue-400 transition-colors" />
                      </a>
                      <a
                        href={`/whitelabel/terms`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-blue-500/50 transition-colors group"
                      >
                        <div className="flex items-center space-x-2">
                          <FiFileText className="w-4 h-4 text-blue-400" />
                          <span className="text-white text-sm">Terms of Service</span>
                        </div>
                        <FiExternalLink className="w-3 h-3 text-gray-500 group-hover:text-blue-400 transition-colors" />
                      </a>
                      <a
                        href={`/whitelabel/status`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-blue-500/50 transition-colors group"
                      >
                        <div className="flex items-center space-x-2">
                          <FiActivity className="w-4 h-4 text-blue-400" />
                          <span className="text-white text-sm">Status Page</span>
                        </div>
                        <FiExternalLink className="w-3 h-3 text-gray-500 group-hover:text-blue-400 transition-colors" />
                      </a>
                    </div>
                  </div>
                </div>

                {/* Social Media Links */}
                <div className="mb-6">
                  <h3 className="text-white font-medium mb-3">Social Media Links</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="twitterUrl" className="block mb-2 text-sm font-medium text-white">
                        Twitter/X URL
                      </label>
                      <input
                        type="url"
                        id="twitterUrl"
                        className="bg-gray-800 text-white text-sm rounded-lg border border-gray-700 block w-full p-2.5"
                        placeholder="https://twitter.com/yourbusiness"
                        {...register('twitterUrl')}
                      />
                    </div>
                    <div>
                      <label htmlFor="linkedinUrl" className="block mb-2 text-sm font-medium text-white">
                        LinkedIn URL
                      </label>
                      <input
                        type="url"
                        id="linkedinUrl"
                        className="bg-gray-800 text-white text-sm rounded-lg border border-gray-700 block w-full p-2.5"
                        placeholder="https://linkedin.com/company/yourbusiness"
                        {...register('linkedinUrl')}
                      />
                    </div>
                    <div>
                      <label htmlFor="facebookUrl" className="block mb-2 text-sm font-medium text-white">
                        Facebook URL
                      </label>
                      <input
                        type="url"
                        id="facebookUrl"
                        className="bg-gray-800 text-white text-sm rounded-lg border border-gray-700 block w-full p-2.5"
                        placeholder="https://facebook.com/yourbusiness"
                        {...register('facebookUrl')}
                      />
                    </div>
                    <div>
                      <label htmlFor="instagramUrl" className="block mb-2 text-sm font-medium text-white">
                        Instagram URL
                      </label>
                      <input
                        type="url"
                        id="instagramUrl"
                        className="bg-gray-800 text-white text-sm rounded-lg border border-gray-700 block w-full p-2.5"
                        placeholder="https://instagram.com/yourbusiness"
                        {...register('instagramUrl')}
                      />
                    </div>
                  </div>
                  <p className="text-gray-500 text-xs mt-2">
                    Social media links will appear in your landing page footer
                  </p>
                </div>

                {/* Footer Section Controls */}
                <div className="mb-6">
                  <h3 className="text-white font-medium mb-3">Footer Section Controls</h3>
                  <p className="text-gray-400 text-sm mb-4">
                    Choose which sections to display in your landing page footer. Sections with no content will be automatically hidden.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Quick Links Section */}
                    <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                      <div>
                        <label className="text-white font-medium text-sm">Quick Links</label>
                        <p className="text-gray-400 text-xs">Navigation links like Features, Get Started</p>
                      </div>
                      <input
                        type="checkbox"
                        {...register('showQuickLinks')}
                        className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                      />
                    </div>

                    {/* Resources Section */}
                    <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                      <div>
                        <label className="text-white font-medium text-sm">Resources</label>
                        <p className="text-gray-400 text-xs">Help Center, Documentation, Community</p>
                      </div>
                      <input
                        type="checkbox"
                        {...register('showResources')}
                        className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                      />
                    </div>

                    {/* Newsletter Section */}
                    <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                      <div>
                        <label className="text-white font-medium text-sm">Newsletter Signup</label>
                        <p className="text-gray-400 text-xs">Email subscription form</p>
                      </div>
                      <input
                        type="checkbox"
                        {...register('showNewsletter')}
                        className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                      />
                    </div>

                    {/* Community Section */}
                    <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                      <div>
                        <label className="text-white font-medium text-sm">Community</label>
                        <p className="text-gray-400 text-xs">Link to your community forum/Discord</p>
                      </div>
                      <input
                        type="checkbox"
                        {...register('showCommunity')}
                        className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                      />
                    </div>

                    {/* Community URL - Only show if community is enabled */}
                    {watch('showCommunity') && (
                      <div className="ml-4 p-3 bg-gray-700/50 rounded-lg">
                        <label htmlFor="communityUrl" className="block mb-2 text-sm font-medium text-white">
                          Community URL
                        </label>
                        <input
                          type="url"
                          id="communityUrl"
                          className="bg-gray-800 text-white text-sm rounded-lg border border-gray-700 block w-full p-2.5"
                          placeholder="https://discord.gg/your-community or https://community.yoursite.com"
                          {...register('communityUrl')}
                        />
                        <p className="text-gray-500 text-xs mt-1">
                          Link to your Discord, Slack, or community forum
                        </p>
                      </div>
                    )}

                    {/* Legal Section */}
                    <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                      <div>
                        <label className="text-white font-medium text-sm">Legal Links</label>
                        <p className="text-gray-400 text-xs">Privacy Policy, Terms of Service</p>
                      </div>
                      <input
                        type="checkbox"
                        {...register('showLegal')}
                        className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                      />
                    </div>

                    {/* Social Media Section */}
                    <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                      <div>
                        <label className="text-white font-medium text-sm">Social Media</label>
                        <p className="text-gray-400 text-xs">Social media icons and links</p>
                      </div>
                      <input
                        type="checkbox"
                        {...register('showSocialMedia')}
                        className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                      />
                    </div>

                    {/* Contact Info Section */}
                    <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                      <div>
                        <label className="text-white font-medium text-sm">Contact Information</label>
                        <p className="text-gray-400 text-xs">Email, phone, address in footer</p>
                      </div>
                      <input
                        type="checkbox"
                        {...register('showContactInfo')}
                        className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <p className="text-gray-500 text-xs mt-2">
                    Sections will only appear if they have content to display. Contact Information and Legal sections are recommended for professional appearance.
                  </p>
                </div>

                {/* Landing Page Content Customization */}
                <div className="mb-6">
                  <h3 className="text-white font-medium mb-3">Landing Page Content</h3>
                  <p className="text-gray-400 text-sm mb-4">
                    Customize the content sections of your landing page. Leave fields empty to use default content.
                  </p>

                  {/* Features Section */}
                  <div className="mb-4">
                    <FeaturesBuilder
                      value={watch('features') || ''}
                      onChange={handleFeaturesChange}
                    />
                  </div>

                  {/* Testimonials Section */}
                  <div className="mb-4">
                    <TestimonialsBuilder
                      value={watch('testimonials') || ''}
                      onChange={handleTestimonialsChange}
                    />

                    {/* More Testimonials URL - Optional */}
                    <div className="mt-3 p-3 bg-gray-800/50 rounded-lg">
                      <label htmlFor="moreTestimonialsUrl" className="block mb-2 text-sm font-medium text-white">
                        More Testimonials Link (Optional)
                      </label>
                      <input
                        type="url"
                        id="moreTestimonialsUrl"
                        className="bg-gray-800 text-white text-sm rounded-lg border border-gray-700 block w-full p-2.5"
                        placeholder="https://yoursite.com/testimonials or https://reviews.google.com/..."
                        {...register('moreTestimonialsUrl')}
                      />
                      <p className="text-gray-500 text-xs mt-1">
                        If provided, a "View More" link will appear in the testimonials section
                      </p>
                    </div>
                  </div>

                  {/* FAQs Section */}
                  <div className="mb-4">
                    <FAQsBuilder
                      value={watch('faqs') || ''}
                      onChange={handleFAQsChange}
                    />
                  </div>

                  {/* Trust Indicators Section */}
                  <div className="mb-4">
                    <TrustIndicatorsBuilder
                      value={watch('trustIndicators') || ''}
                      onChange={handleTrustIndicatorsChange}
                    />
                  </div>

                  <div className="bg-blue-900/30 border border-blue-800 rounded-lg p-3 text-blue-400 text-xs">
                    <FiInfo className="inline-block mr-1" />
                    <strong>Tip:</strong> Use the interactive builders above to customize your landing page content. Leave any section empty to use our default content.
                  </div>
                </div>
              </div>

              {/* Stripe Connect Section */}
              <div className="mt-8" id="stripe-connect">
                <StripeConnectSettings
                  partnerId={partner?.id || ''}
                  onStatusUpdate={(status) => {
                    // Refresh partner data when Stripe status changes
                    if (status.onboardingCompleted) {
                      fetchPartnerDetails();
                    }
                  }}
                />
              </div>

              {/* Subscription Plans Section */}
              <div className="mt-8">
                <SubscriptionPlansSection
                  partnerId={partner?.id}
                  isFreeForever={partnerTier === PartnerTier.FREE_FOREVER}
                  partnerAiAnalyticsEnabled={partner?.enableAiAnalytics ?? false}
                />
              </div>

              {/* Customer Credit Plans Section */}
              <div className="mt-8">
                <CustomerCreditPlansSection
                  partnerId={partner?.id}
                  isFreeForever={partnerTier === PartnerTier.FREE_FOREVER}
                />
              </div>

              {/* AI Translation Section */}
              <div className="mt-8 p-6 bg-gray-800/50 rounded-lg border border-gray-700">
                <div className="flex items-start mb-4">
                  <div className="p-2 bg-purple-500/20 rounded-lg mr-3">
                    <FiGlobe className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">AI Translation Service</h3>
                    <p className="text-gray-400 text-sm">Automatically translate your custom texts to all supported languages</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="enableTranslation"
                      checked={enableTranslation}
                      onChange={(e) => setEnableTranslation(e.target.checked)}
                      className="w-4 h-4 bg-gray-800 border-gray-700 rounded focus:ring-purple-600"
                    />
                    <label htmlFor="enableTranslation" className="ml-3 text-white font-medium">
                      Auto-translate custom texts to all supported languages
                    </label>
                  </div>
                  <div className="text-right">
                    <div className="text-purple-400 font-semibold">8 Knotie Credits</div>
                    <div className="text-gray-500 text-xs">One-time translation cost</div>
                  </div>
                </div>

                {enableTranslation && (
                  <div className="mt-4 p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
                    <div className="flex items-start">
                      <FiInfo className="h-4 w-4 text-purple-400 mt-0.5 mr-2 flex-shrink-0" />
                      <div className="text-sm text-purple-200">
                        <p className="font-medium mb-1">What gets translated:</p>
                        <ul className="text-purple-300 space-y-1">
                          <li>• Portal title and slogan</li>
                          <li>• Voice AI agent pricing notes and special offers</li>
                          <li>• Company contact information</li>
                          <li>• Features, testimonials, FAQs, and trust indicators</li>
                          <li>• Character name and other custom texts</li>
                        </ul>
                        <p className="mt-2 text-purple-400 font-medium">
                          Translations will be automatically used based on visitor's browser language.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {translationResult && (
                  <div className={`mt-4 p-4 rounded-lg border ${
                    translationResult.success
                      ? 'bg-green-500/10 border-green-500/20 text-green-200'
                      : 'bg-red-500/10 border-red-500/20 text-red-200'
                  }`}>
                    <div className="flex items-start">
                      {translationResult.success ? (
                        <FiCheckCircle className="h-4 w-4 text-green-400 mt-0.5 mr-2 flex-shrink-0" />
                      ) : (
                        <FiAlertCircle className="h-4 w-4 text-red-400 mt-0.5 mr-2 flex-shrink-0" />
                      )}
                      <div className="text-sm">
                        <p className="font-medium">{translationResult.message}</p>
                        {translationResult.success && translationResult.creditsUsed && (
                          <p className="mt-1 opacity-80">
                            {translationResult.creditsUsed} credits used • {translationResult.languagesTranslated?.length || 0} languages translated
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="mt-8 flex justify-end">
                <button
                  type="submit"
                  disabled={submitting || translating}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center shadow-md disabled:opacity-70"
                >
                  {submitting || translating ? (
                    <>
                      <FiLoader className="animate-spin mr-2" />
                      {translating ? 'Translating & Saving...' : 'Saving...'}
                    </>
                  ) : (
                    <>
                      <FiSave className="mr-2" />
                      Save Settings
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="space-y-6 sticky top-6">
          {/* Portal Mode Selector */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-start mb-4">
              <div className="p-2 bg-purple-500/20 rounded-lg mr-3">
                <FiGlobe className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Portal Mode
                </h2>
                <p className="text-gray-400 text-sm">Choose your portal experience type</p>
              </div>
            </div>

            <PortalModeSelector
              selected={selectedPortalMode}
              onChange={setSelectedPortalMode}
              partnerTier={partnerTier}
              manualSaasModeEnabled={partner?.manualSaasModeEnabled || false}
              onUpgradeRequired={(_mode) => {
                setShowPortalModeUpgrade(true);
                // You can add upgrade modal logic here
              }}
            />
          </div>

          {/* SaaS Configuration - Only shown when SaaS mode is selected */}
          {selectedPortalMode === 'SAAS' && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <div className="flex items-start mb-4">
                <div className="p-2 bg-purple-500/20 rounded-lg mr-3">
                  <FiSettings className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    SaaS Portal Configuration
                    <span className="px-2 py-1 text-xs bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30 font-medium">
                      Beta
                    </span>
                  </h2>
                  <p className="text-gray-400 text-sm">Configure your AI receptionist onboarding experience</p>
                </div>
              </div>

              <div className="space-y-6">
                {/* Character Name */}
                <div>
                  <label htmlFor="characterName" className="block text-sm font-medium text-gray-300 mb-2">
                    Character Name (Optional)
                  </label>
                  <input
                    type="text"
                    id="characterName"
                    {...register('characterName')}
                    placeholder="e.g., Sarah, Alex, or leave empty to use business name"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    If provided, this character name will be used throughout the onboarding experience instead of your business name
                  </p>
                </div>

                {/* Free Trial Toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <label htmlFor="freeTrialEnabled" className="text-sm font-medium text-gray-300">
                      Enable Free Trial
                    </label>
                    <p className="text-xs text-gray-400 mt-1">
                      Show "Let's Get Started For FREE" instead of "Let's Get Started"
                    </p>
                    {!partner?.stripeOnboardingCompleted && (
                      <div className="text-xs text-amber-400 mt-1">
                        <p className="flex items-center">
                          <FiAlertCircle className="mr-1" />
                          Requires Stripe Connect setup to disable
                        </p>
                        <button
                          type="button"
                          onClick={() => fetchPartnerDetails()}
                          className="text-blue-400 hover:text-blue-300 underline mt-1"
                        >
                          Refresh status
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      // Can only disable if Stripe Connect is set up
                      if (!watch('freeTrialEnabled') || partner?.stripeOnboardingCompleted) {
                        const currentValue = watch('freeTrialEnabled');
                        setValue('freeTrialEnabled', !currentValue);
                      }
                    }}
                    disabled={watch('freeTrialEnabled') && !partner?.stripeOnboardingCompleted}
                    className={`
                      relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                      ${watch('freeTrialEnabled') ? 'bg-purple-500' : 'bg-gray-600'}
                      ${watch('freeTrialEnabled') && !partner?.stripeOnboardingCompleted ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    <span
                      className={`
                        inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                        ${watch('freeTrialEnabled') ? 'translate-x-6' : 'translate-x-1'}
                      `}
                    />
                  </button>
                </div>

                {/* Auto Deploy Toggle */}
                <div className="flex items-start justify-between">
                  <div className="flex-1 pr-4">
                    <div className="flex items-center gap-2">
                      <label htmlFor="autoDeployEnabled" className="text-sm font-medium text-gray-300">
                        Auto-Deploy
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowAutoDeployCharges(!showAutoDeployCharges)}
                        className="p-1 hover:bg-gray-700 rounded-full transition-colors"
                        title="View auto-deploy details"
                      >
                        <FiInfo className="w-4 h-4 text-gray-400 hover:text-white" />
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Automatically deploy AI Receptionist agents when customers complete onboarding
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const currentValue = watch('autoDeployEnabled');
                      setValue('autoDeployEnabled', !currentValue);
                    }}
                    className={`
                      relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors
                      ${watch('autoDeployEnabled') ? 'bg-green-500' : 'bg-gray-600'}
                    `}
                  >
                    <span
                      className={`
                        inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                        ${watch('autoDeployEnabled') ? 'translate-x-6' : 'translate-x-1'}
                      `}
                    />
                  </button>
                </div>

                {/* Market Availability Notice */}
                <div className="p-2 bg-blue-900/20 border border-blue-700/50 rounded-lg">
                  <p className="text-xs text-blue-300">
                    <FiInfo className="inline w-3 h-3 mr-1" />
                    Auto-Deploy is currently available for <span className="font-medium">US, UK &amp; Canada</span> markets only.
                    For other markets, please enable &quot;Use Own Twilio Account&quot; below.
                  </p>
                </div>

                {/* Auto Deploy Information */}
                {showAutoDeployCharges && (
                  <div className="p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
                    <h4 className="text-sm font-medium text-white mb-2">Auto-Deploy Process</h4>
                    <div className="space-y-2 text-xs text-gray-300">
                      <p>When a customer completes AI Inbound usecase onboarding and submits for AI Receptionist agent:</p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>A phone number is automatically purchased and provisioned</li>
                        <li>An Agent is deployed automatically</li>
                        <li>Knowledge base is processed and prepared automatically</li>
                        <li>The phone number is integrated with the agent automatically</li>
                      </ul>
                      <div className="mt-2 pt-2 border-t border-gray-600">
                        <p className="text-amber-400 font-medium">
                          <FiZap className="inline w-3 h-3 mr-1" />
                          Relevant charges will be deducted using Knotie credits and telephony credits
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Use Own Twilio Account Toggle */}
                <div className="flex items-start justify-between">
                  <div className="flex-1 pr-4">
                    <label htmlFor="useOwnTelephonyProvider" className="text-sm font-medium text-gray-300">
                      Use Own Twilio Account
                    </label>
                    <p className="text-xs text-gray-400 mt-1">
                      Use your own Twilio credentials for phone number provisioning
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const currentValue = watch('useOwnTelephonyProvider');
                      setValue('useOwnTelephonyProvider', !currentValue);
                      // Auto-set provider to twilio when enabling (Telnyx support coming soon)
                      if (!currentValue) {
                        setValue('telephonyProvider', 'twilio');
                      }
                    }}
                    className={`
                      relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors
                      ${watch('useOwnTelephonyProvider') ? 'bg-green-500' : 'bg-gray-600'}
                    `}
                  >
                    <span
                      className={`
                        inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                        ${watch('useOwnTelephonyProvider') ? 'translate-x-6' : 'translate-x-1'}
                      `}
                    />
                  </button>
                </div>

                {/* Free Forever Admin Fee Notice */}
                {partnerTier === PartnerTier.FREE_FOREVER && watch('useOwnTelephonyProvider') && (
                  <div className="p-2 bg-amber-900/20 border border-amber-700/50 rounded-lg">
                    <p className="text-xs text-amber-300">
                      <FiAlertCircle className="inline w-3 h-3 mr-1" />
                      <strong>Free Forever Plan:</strong> Each phone number imported via your own credentials will incur a <span className="font-medium">$2.00 admin fee</span> deducted from your telephony credits.
                      <span className="block mt-1 text-amber-400/80">Upgrade your plan to remove this fee.</span>
                    </p>
                  </div>
                )}

                {/* Telephony Provider Configuration - Twilio Only */}
                {watch('useOwnTelephonyProvider') && (
                  <div className="space-y-4 p-4 border border-gray-700 rounded-lg bg-gray-800/30">
                    {/* Auto-select Twilio as the provider */}
                    <input type="hidden" {...register('telephonyProvider')} value="twilio" />

                    {/* Twilio Credentials */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-gray-300">Twilio Credentials</span>
                        <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">Required</span>
                      </div>
                      <div>
                        <label htmlFor="telephonyAccountSid" className="block text-sm font-medium text-gray-300 mb-1">
                          Account SID
                        </label>
                        <input
                          type="text"
                          id="telephonyAccountSid"
                          {...register('telephonyAccountSid')}
                          placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor="telephonyAuthToken" className="block text-sm font-medium text-gray-300 mb-1">
                          Auth Token
                        </label>
                        <input
                          type="password"
                          id="telephonyAuthToken"
                          {...register('telephonyAuthToken')}
                          placeholder="Enter your Twilio Auth Token"
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                        />
                      </div>
                      <p className="text-xs text-gray-500">
                        You can find your Account SID and Auth Token in your <a href="https://console.twilio.com/" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300">Twilio Console</a>.
                      </p>
                    </div>

                    {/* Security Note */}
                    <div className="p-2 bg-gray-800/50 border border-gray-700 rounded-lg">
                      <p className="text-xs text-gray-400">
                        <FiShield className="inline w-3 h-3 mr-1 text-green-400" />
                        Your credentials are encrypted and stored securely. We never share your API keys with third parties.
                      </p>
                    </div>
                  </div>
                )}

                {/* Free AI Credits Setting */}
                <div>
                  <label htmlFor="freeAiCredits" className="block text-sm font-medium text-gray-300 mb-2">
                    Free AI Credits for New Customers
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      id="freeAiCredits"
                      min="0"
                      max="1000"
                      {...register('freeAiCredits')}
                      className="w-24 px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="50"
                    />
                    <span className="text-sm text-gray-400">credits</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Automatically assign this many AI credits to new customers when they complete onboarding (one-time only)
                  </p>
                </div>

                {/* Agent Tier Selection */}
                <div className="border border-purple-500/30 rounded-lg p-4 bg-purple-500/10">
                  <div className="flex items-start mb-4">
                    <FiZap className="text-purple-400 mt-1 mr-2 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-medium text-purple-400">Agent Tier</h4>
                      <p className="text-xs text-gray-400">
                        Select the AI quality tier for your customers&apos; agents
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {/* Standard Tiers - Available to all partners */}
                    {getStandardAgentTiersClient().map((tier) => {
                      const isPremium = tier.name === 'PREMIUM';

                      return (
                        <label
                          key={tier.name}
                          className={`flex items-start p-3 rounded-lg border transition-all ${
                            watch('saasAgentTier') === tier.name
                              ? isPremium
                                ? 'border-yellow-500 bg-yellow-500/20 cursor-pointer'
                                : 'border-purple-500 bg-purple-500/20 cursor-pointer'
                              : 'border-gray-700 bg-gray-800/50 hover:border-gray-600 cursor-pointer'
                          }`}
                        >
                          <input
                            type="radio"
                            {...register('saasAgentTier')}
                            value={tier.name}
                            className={`mt-1 mr-3 focus:ring-purple-500 ${isPremium ? 'text-yellow-500' : 'text-purple-500'}`}
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-white">
                                  {tier.displayName}
                                </span>
                                {isPremium && (
                                  <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded border border-yellow-500/30">
                                    ⚡ Grok/xAI
                                  </span>
                                )}
                              </div>
                              <span className={`text-xs font-semibold ${isPremium ? 'text-yellow-400' : 'text-purple-400'}`}>
                                {tier.creditsPerMinute} credits/min
                              </span>
                            </div>
                            <p className="text-xs mt-1 text-gray-400">
                              {tier.description}
                            </p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300">
                                LLM: {tier.llmProvider}/{tier.llmModel}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300">
                                TTS: {tier.ttsProvider}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300">
                                STT: {tier.sttProvider}
                              </span>
                            </div>
                          </div>
                        </label>
                      );
                    })}

                    {/* BYOA Tier Section */}
                    {(() => {
                      const byoaTier = getBYOATierConfigClient();
                      const isBYOASelected = watch('saasAgentTier') === 'BYOA';
                      const hasRetellApiKey = !!partner?.retellApiKey;
                      // Use server-computed partnerTier for accurate enterprise detection
                      const isEnterprise = partnerTier === PartnerTier.ENTERPRISE;
                      // Allow access if enterprise tier OR manually enabled by admin
                      const canAccessBYOA = isEnterprise || !!(partner as any)?.manualBYOAModeEnabled;

                      return (
                        <div className="mt-4 pt-4 border-t border-gray-700">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded border border-emerald-500/30">
                              🏢 Enterprise Exclusive
                            </span>
                            {!isEnterprise && canAccessBYOA && (
                              <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded border border-blue-500/30">
                                ✓ Admin Enabled
                              </span>
                            )}
                          </div>
                          <label
                            className={`flex items-start p-3 rounded-lg border transition-all ${
                              !canAccessBYOA
                                ? 'border-gray-700 bg-gray-800/30 opacity-60 cursor-not-allowed'
                                : isBYOASelected
                                  ? 'border-emerald-500 bg-emerald-500/20 cursor-pointer'
                                  : 'border-gray-700 bg-gray-800/50 hover:border-gray-600 cursor-pointer'
                            }`}
                          >
                            <input
                              type="radio"
                              {...register('saasAgentTier')}
                              value="BYOA"
                              disabled={!canAccessBYOA}
                              className="mt-1 mr-3 focus:ring-emerald-500 text-emerald-500 disabled:opacity-50"
                            />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-white">
                                  {byoaTier.displayName}
                                </span>
                              </div>
                              <p className="text-xs mt-1 text-gray-400">
                                Use your own Retell API key for full control and unlimited agents
                              </p>

                              {/* Show upgrade message for non-enterprise without manual override */}
                              {!canAccessBYOA && (
                                <div className="mt-2 p-2 rounded-lg bg-gray-800/50 border border-gray-600">
                                  <p className="text-xs text-gray-400">
                                    <FiInfo className="inline-block mr-1 text-amber-400" />
                                    Upgrade to Enterprise to unlock this feature
                                  </p>
                                </div>
                              )}

                              {/* Retell API Key Status - Only for users with BYOA access */}
                              {canAccessBYOA && isBYOASelected && (
                                <div className={`mt-3 p-2 rounded-lg flex items-center justify-between ${hasRetellApiKey ? 'bg-green-900/30 border border-green-500/30' : 'bg-amber-900/30 border border-amber-500/30'}`}>
                                  <div className="flex items-center gap-2">
                                    {hasRetellApiKey ? (
                                      <>
                                        <FiCheckCircle className="text-green-400 w-4 h-4" />
                                        <span className="text-xs text-green-400">
                                          Retell API Key configured
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <FiAlertCircle className="text-amber-400 w-4 h-4" />
                                        <span className="text-xs text-amber-400">
                                          Retell API Key required
                                        </span>
                                      </>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setShowRetellApiKeyModal(true);
                                    }}
                                    className={`text-xs px-2 py-1 rounded ${hasRetellApiKey ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'}`}
                                  >
                                    {hasRetellApiKey ? 'Update' : 'Configure'}
                                  </button>
                                </div>
                              )}

                              {/* BYOA Voice Selector - Only shown when BYOA is selected and user has access */}
                              {canAccessBYOA && isBYOASelected && (
                                <BYOAVoiceSelector
                                  partnerId={partner?.id || ''}
                                  hasRetellApiKey={hasRetellApiKey}
                                  onConfigureApiKey={() => setShowRetellApiKeyModal(true)}
                                />
                              )}
                            </div>
                          </label>
                        </div>
                      );
                    })()}
                  </div>
                  <p className="text-xs text-gray-400 mt-3">
                    <FiInfo className="inline-block mr-1" />
                    This tier determines the AI models used for your customers&apos; voice agents and the credit consumption rate.
                  </p>
                </div>

                {/* Pricing Model Configuration - Always shown when Stripe is connected */}
                {partner?.stripeOnboardingCompleted && (
                  <div className="border border-amber-500/30 rounded-lg p-4 bg-amber-500/10">
                    <div className="flex items-start mb-4">
                      <FiShield className="text-amber-400 mt-1 mr-2 flex-shrink-0" />
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-sm font-medium text-amber-400">Pricing Configuration</h4>
                          <button
                            type="button"
                            onClick={() => setShowPricingHelp(true)}
                            className="text-blue-400 hover:text-blue-300 text-xs underline"
                          >
                            How does this work?
                          </button>
                        </div>
                        <p className="text-xs text-gray-400">
                          Configure how customers will see pricing on your landing page and during onboarding
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* Free Forever Restriction Banner for Pricing */}
                      {partnerTier === PartnerTier.FREE_FOREVER && (
                        <div className="bg-amber-900/20 border border-amber-600 rounded-lg p-3 mb-2">
                          <div className="flex items-start gap-2">
                            <FiAlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-amber-200 text-xs">
                                Subscription and Pay-as-you-go pricing models require a paid plan.
                                <Link href="/partner/settings" className="ml-1 text-amber-400 hover:text-amber-300 underline">
                                  Upgrade your plan
                                </Link> to access these features.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Pricing Model Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Pricing Model
                        </label>
                        <div className="space-y-2">
                          <label className={`flex items-center ${partnerTier === PartnerTier.FREE_FOREVER ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            <input
                              type="radio"
                              {...register('pricingModel')}
                              value="subscription"
                              disabled={partnerTier === PartnerTier.FREE_FOREVER}
                              className="mr-2 text-purple-500 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            <span className="text-sm text-gray-300">Use Subscription Plans</span>
                            {partnerTier === PartnerTier.FREE_FOREVER && (
                              <span className="ml-2 text-xs text-amber-400">(Upgrade Required)</span>
                            )}
                          </label>
                          <label className={`flex items-center ${partnerTier === PartnerTier.FREE_FOREVER ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            <input
                              type="radio"
                              {...register('pricingModel')}
                              value="payasyougo"
                              disabled={partnerTier === PartnerTier.FREE_FOREVER}
                              className="mr-2 text-purple-500 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            <span className="text-sm text-gray-300">Pay-as-you-go Model</span>
                            {partnerTier === PartnerTier.FREE_FOREVER && (
                              <span className="ml-2 text-xs text-amber-400">(Upgrade Required)</span>
                            )}
                          </label>
                          <label className="flex items-center">
                            <input
                              type="radio"
                              {...register('pricingModel')}
                              value="fixedprice"
                              className="mr-2 text-purple-500 focus:ring-purple-500"
                            />
                            <span className="text-sm text-gray-300">Fixed Price (Display Only)</span>
                          </label>
                        </div>
                      </div>

                      {/* Pay-as-you-go Configuration */}
                      {watch('pricingModel') === 'payasyougo' && (
                        <div>
                          <label htmlFor="payAsYouGoRate" className="block text-sm font-medium text-gray-300 mb-2">
                            Rate per Minute
                          </label>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-400">$</span>
                            <input
                              type="number"
                              id="payAsYouGoRate"
                              step="0.01"
                              min="0.01"
                              max="10.00"
                              {...register('payAsYouGoRate')}
                              className="w-24 px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                              placeholder="0.10"
                            />
                            <span className="text-sm text-gray-400">per minute</span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            This will be converted to credits and displayed to customers
                          </p>
                        </div>
                      )}

                      {/* Fixed Price Configuration */}
                      {watch('pricingModel') === 'fixedprice' && (
                        <div className="space-y-4">
                          <div className="bg-yellow-900/30 border border-yellow-800 rounded-lg p-3 text-yellow-400 text-xs">
                            <FiInfo className="inline-block mr-1" />
                            This pricing is for <strong>display purposes only</strong> on your AI Receptionist landing page.
                            Actual client billing must be done using the{' '}
                            <Link href="/partner/billing" className="underline hover:text-yellow-300">
                              Invoicing feature
                            </Link>.
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label htmlFor="fixedPrice" className="block text-sm font-medium text-gray-300 mb-2">
                                Price
                              </label>
                              <input
                                type="number"
                                id="fixedPrice"
                                step="0.01"
                                min="0"
                                {...register('fixedPrice')}
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder="99.00"
                              />
                            </div>

                            <div>
                              <label htmlFor="fixedPriceCurrency" className="block text-sm font-medium text-gray-300 mb-2">
                                Currency
                              </label>
                              <select
                                id="fixedPriceCurrency"
                                {...register('fixedPriceCurrency')}
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                              >
                                <option value="USD">USD ($)</option>
                                <option value="EUR">EUR (€)</option>
                                <option value="GBP">GBP (£)</option>
                                <option value="CAD">CAD ($)</option>
                                <option value="AUD">AUD ($)</option>
                                <option value="INR">INR (₹)</option>
                                <option value="JPY">JPY (¥)</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label htmlFor="fixedPricePeriod" className="block text-sm font-medium text-gray-300 mb-2">
                              Billing Period
                            </label>
                            <select
                              id="fixedPricePeriod"
                              {...register('fixedPricePeriod')}
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                            >
                              <option value="month">per month</option>
                              <option value="year">per year</option>
                              <option value="one-time">one-time</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              Features (one per line)
                            </label>
                            <textarea
                              {...register('fixedPriceFeatures')}
                              rows={6}
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                              placeholder="24/7 AI Receptionist&#10;Unlimited calls&#10;Call recording & transcription&#10;CRM integration&#10;Priority support"
                            />
                            <p className="text-xs text-gray-400 mt-1">
                              Enter one feature per line. These will be displayed as bullet points on your landing page.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Subscription Plans Note */}
                      {watch('pricingModel') === 'subscription' && (
                        <div className="bg-blue-900/30 border border-blue-800 rounded-lg p-3 text-blue-400 text-xs">
                          <FiInfo className="inline-block mr-1" />
                          Your existing subscription plans will be displayed to customers. Make sure you have created plans in the Subscription Plans section below.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Business Lookup Configuration */}
                <div className="border border-gray-700 rounded-lg p-6 bg-gray-800/50">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 pr-4">
                      <h4 className="text-lg font-semibold text-amber-400 mb-2">Business Information Lookup</h4>
                      <p className="text-sm text-gray-400 leading-relaxed">
                        Allow customers to search and auto-fill their business information during onboarding
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const currentValue = watch('businessLookupEnabled');
                          setValue('businessLookupEnabled', !currentValue);
                        }}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800 ${
                          watch('businessLookupEnabled') ? 'bg-purple-600' : 'bg-gray-600'
                        }`}
                      >
                        <span className="sr-only">Toggle business lookup</span>
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform ${
                            watch('businessLookupEnabled') ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {watch('businessLookupEnabled') && (
                    <div className="space-y-6 mt-6 pt-6 border-t border-gray-700">
                      {/* Credits per Search - Informational Only */}
                      <div className="bg-gradient-to-r from-purple-900/20 to-purple-800/20 rounded-lg p-5 border border-purple-700/30">
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="w-3 h-3 bg-purple-500 rounded-full shadow-lg"></div>
                          <h4 className="text-base font-semibold text-purple-300">Pricing Information</h4>
                        </div>
                        <p className="text-sm text-gray-300 leading-relaxed">
                          <span className="font-bold text-purple-400 text-base">10 Knotie credits</span> will be deducted from your account for each business information lookup that provides additional data capture during customer onboarding.
                        </p>
                      </div>

                      {/* Configuration Options */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Daily Limit */}
                        <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50">
                          <label htmlFor="businessLookupDailyLimit" className="block text-sm font-semibold text-gray-300 mb-3">
                            Daily Limit
                          </label>
                          <input
                            type="number"
                            id="businessLookupDailyLimit"
                            min="10"
                            max="10000"
                            {...register('businessLookupDailyLimit')}
                            className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="1000"
                          />
                          <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                            Maximum number of lookups per day across all customers
                          </p>
                        </div>

                        {/* Monthly Budget */}
                        <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50">
                          <label htmlFor="businessLookupMonthlyBudgetUsd" className="block text-sm font-semibold text-gray-300 mb-3">
                            Monthly Budget (USD)
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 font-medium">$</span>
                            <input
                              type="number"
                              id="businessLookupMonthlyBudgetUsd"
                              step="0.01"
                              min="1.00"
                              max="10000.00"
                              {...register('businessLookupMonthlyBudgetUsd')}
                              className="w-full pl-8 pr-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              placeholder="100.00"
                            />
                        </div>
                          <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                            Maximum monthly spend on business lookups (safety limit)
                          </p>
                        </div>
                      </div>

                      {/* Information Note */}
                      <div className="bg-blue-900/30 border border-blue-800 rounded-lg p-4 text-blue-300 text-sm">
                        <FiInfo className="inline-block mr-2 text-blue-400" />
                        Business lookup uses Google Places API to provide comprehensive business information including reviews, ratings, contact details, and business hours.
                      </div>
                    </div>
                  )}
                </div>

                {/* SaaS Preview */}
                <div className="border border-gray-700 rounded-lg p-4 bg-gray-800/50">
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Preview</h4>
                  <div className="text-xs text-gray-400 space-y-1">
                    <p>• Landing page with {watch('characterName') || 'your business'} branding</p>
                    <p>• {watch('freeTrialEnabled') ? 'Free trial' : 'Standard'} onboarding button</p>
                    <p>• Pricing section with {
                      watch('pricingModel') === 'subscription'
                        ? 'subscription plans'
                        : watch('pricingModel') === 'fixedprice'
                        ? 'fixed price display'
                        : 'pay-as-you-go rates'
                    }</p>
                    <p>• 9-step AI receptionist setup process</p>
                    <p>• Automated agent deployment with phone number</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Theme Selector - Only shown if theme selection feature is enabled or user is admin */}
          {(themeSelectorEnabled || isAdmin) && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <div className="flex items-start mb-4">
                <div className="p-2 bg-blue-500/20 rounded-lg mr-3">
                  <FiSettings className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Portal Theme
                    {!themeSelectorEnabled && isAdmin && (
                      <span className="ml-2 text-xs text-amber-500">(Admin Preview)</span>
                    )}
                  </h2>
                  <p className="text-gray-400 text-sm">Select a theme for your customer portal</p>
                </div>
              </div>

              <ThemeSelector
                selected={selectedTheme}
                onChange={setSelectedTheme}
              />
            </div>
          )}

          {/* Language Selection */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-start mb-4">
              <div className="p-2 bg-green-500/20 rounded-lg mr-3">
                <FiGlobe className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Portal Languages</h2>
                <p className="text-gray-400 text-sm">Choose the default language for your portal content</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Basic Portal Language */}
              <div>
                <label htmlFor="basicPortalLanguage" className="block text-sm font-medium text-gray-300 mb-2">
                  Basic Portal Language
                </label>
                <select
                  {...register('basicPortalLanguage')}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {getLanguageOptions().map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-gray-500 text-xs mt-1">
                  Language for dashboard landing page and basic portal features
                </p>
              </div>

              {/* SaaS Portal Language */}
              <div>
                <label htmlFor="saasPortalLanguage" className="block text-sm font-medium text-gray-300 mb-2">
                  SaaS Portal Language
                </label>
                <select
                  {...register('saasPortalLanguage')}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {getLanguageOptions().map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-gray-500 text-xs mt-1">
                  Language for SaaS onboarding flow and related features
                </p>
              </div>
            </div>

            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-blue-400 text-sm">
                <FiInfo className="inline mr-2" />
                Custom text you enter in other sections will always take precedence over the default language translations.
              </p>
            </div>
          </div>

          {/* Preview Button */}
          {(customerPortalEnabled && partner?.subdomain) && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <a
                href={`https://${partner.subdomain}.${baseUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center py-2.5 px-4 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 transition-colors"
              >
                <FiEye className="mr-2" />
                View Live Portal
              </a>
            </div>
          )}

          {/* Portal Preview */}
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="w-full flex items-center justify-center py-2.5 px-4 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors border border-gray-700"
          >
            <FiEye className="mr-2" />
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>

          {showPreview && (
            <PortalPreview
              theme={selectedTheme}
              branding={{
                businessName: partner?.businessName || 'Your Brand',
                logo: logoPreview || undefined,
                primaryColor: watch('primaryColor') || '#3B82F6',
                secondaryColor: watch('secondaryColor') || '#10B981',
                portalTitle: watch('portalTitle') || `${partner?.businessName || 'Your Brand'} AI Portal`,
                portalSlogan: watch('portalSlogan') || 'Powered by advanced voice AI technology',
                fontFamily: watch('fontFamily') || 'Inter',
              }}
            />
          )}
        </div>
      </div>

      {/* Free Forever Upgrade Modal */}
      <FreeForeverUpgradeModal
        isOpen={showFreeForeverUpgrade}
        onClose={() => {
          setShowFreeForeverUpgrade(false);
          setPendingAction(null);
          // Mark as dismissed to prevent loop
          setUpgradeModalDismissed(true);
        }}
        onProceed={pendingAction ? proceedWithPendingAction : undefined}
        title={freeForeverUpgradeData.title}
        message={freeForeverUpgradeData.message}
        featureDescription={freeForeverUpgradeData.featureDescription}
      />

      {/* Pricing Help Modal */}
      {showPricingHelp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-white">Pricing Configuration Guide</h3>
              <button
                onClick={() => setShowPricingHelp(false)}
                className="text-gray-400 hover:text-white"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6 text-gray-300">
              <div>
                <h4 className="text-lg font-medium text-amber-400 mb-2">Understanding AI Credits</h4>
                <p className="text-sm mb-2">
                  <strong>1 AI Credit = 1 Minute</strong> of conversation time with your AI assistant.
                </p>
                <p className="text-sm">
                  This is a simple way for customers to understand usage, regardless of your actual per-minute cost.
                </p>
              </div>

              <div>
                <h4 className="text-lg font-medium text-blue-400 mb-2">Subscription Model</h4>
                <ul className="text-sm space-y-1 list-disc list-inside">
                  <li>Create subscription plans in your Stripe Connect dashboard</li>
                  <li>Set specific AI credit limits per plan (e.g., 100, 500, 1000 credits/month)</li>
                  <li>For unlimited usage, set credits to <strong>-1</strong> (shows as "Unlimited")</li>
                  <li>Customers see your subscription tiers on the landing page</li>
                  <li>Perfect for predictable monthly revenue</li>
                </ul>
              </div>

              <div>
                <h4 className="text-lg font-medium text-green-400 mb-2">Pay-as-you-go Model</h4>
                <ul className="text-sm space-y-1 list-disc list-inside">
                  <li>Set your rate per minute (e.g., $0.20/minute)</li>
                  <li>Customers purchase AI credit packages (100, 500, 1000 credits)</li>
                  <li>If you set $0.20/minute and customer buys $20, they get 100 credits</li>
                  <li>Credits never expire - customers use them when needed</li>
                  <li>Great for customers with variable usage</li>
                </ul>
              </div>

              <div>
                <h4 className="text-lg font-medium text-purple-400 mb-2">Free Trial</h4>
                <p className="text-sm">
                  Can be enabled with either pricing model. New customers get free credits (set in "Free AI Credits" field)
                  before they need to purchase more or subscribe.
                </p>
              </div>

              <div className="bg-gray-700 p-4 rounded-lg">
                <h4 className="text-lg font-medium text-yellow-400 mb-2">💡 Pro Tips</h4>
                <ul className="text-sm space-y-1 list-disc list-inside">
                  <li><strong>Subscription + Unlimited:</strong> Best for agencies offering "all-you-can-use" plans</li>
                  <li><strong>Pay-as-you-go:</strong> Perfect for small businesses with occasional usage</li>
                  <li><strong>Mixed approach:</strong> Offer both subscription tiers AND credit top-ups</li>
                </ul>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowPricingHelp(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Retell API Key Modal (for BYOA tier) */}
      {showRetellApiKeyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">Configure Retell API Key</h3>
              <button
                onClick={() => {
                  setShowRetellApiKeyModal(false);
                  setRetellApiKeyInput('');
                  setRetellApiKeyError(null);
                }}
                className="text-gray-400 hover:text-white"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-400 mb-4">
              Enter your Retell API key to enable BYOA (Bring Your Own Agent) mode.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2">Retell API Key</label>
                <input
                  type="password"
                  value={retellApiKeyInput}
                  onChange={(e) => setRetellApiKeyInput(e.target.value)}
                  placeholder="key_..."
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {retellApiKeyError && (
                <div className="p-2 bg-red-900/30 border border-red-500/30 rounded-lg">
                  <p className="text-xs text-red-400 flex items-center gap-1">
                    <FiAlertCircle className="w-3 h-3" />
                    {retellApiKeyError}
                  </p>
                </div>
              )}

              <p className="text-xs text-gray-500">
                Get your API key from{' '}
                <a
                  href="https://dashboard.retellai.com/apikeys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 underline"
                >
                  Retell Dashboard
                </a>
              </p>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowRetellApiKeyModal(false);
                  setRetellApiKeyInput('');
                  setRetellApiKeyError(null);
                }}
                className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRetellApiKey}
                disabled={savingRetellApiKey || !retellApiKeyInput.trim()}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {savingRetellApiKey ? (
                  <>
                    <FiLoader className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save API Key'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </PartnerLayout>
  );
}
