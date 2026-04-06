'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import PartnerLayout from '@/components/partner/PartnerLayout';
import NeonContainer from '@/components/NeonContainer';
import {
  FiArrowLeft,
  FiSave,
  FiToggleLeft,
  FiToggleRight,
  FiExternalLink,
  FiMessageCircle,
  FiPhone,
  FiSettings,
  FiLink,
  FiType,
  FiInfo,
  FiImage,
  FiUpload,
  FiUser,
  FiDollarSign,
  FiPlus,
  FiTrash2,
  FiCheck,
  FiStar,
  FiBookOpen,
} from 'react-icons/fi';
import { ExperienceType, ExperienceBranding, PricingTier } from '@/types/experience';
import { EXPERIENCE_CONFIGS } from '@/lib/experiences/experienceTypes';
import { toast } from 'react-hot-toast';

interface ExperienceData {
  id: string;
  experienceType: string;
  alias: string | null;
  displayName: string;
  enabled: boolean;
  isDefault: boolean;
  totalProspects: number;
  totalCustomers: number;
  createdAt: string;
  landingPageConfig?: {
    branding?: ExperienceBranding;
    [key: string]: unknown;
  };
  pricingConfig?: {
    tiers?: PricingTier[];
    [key: string]: unknown;
  };
}

export default function ExperienceSettingsPage() {
  const router = useRouter();
  const params = useParams();
  const rawType = params?.type;
  const typeParam = (typeof rawType === 'string' ? rawType : '')?.toUpperCase(); // e.g., ai_personal_assistant → AI_PERSONAL_ASSISTANT

  const [partnerName, setPartnerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [experience, setExperience] = useState<ExperienceData | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [alias, setAlias] = useState('');
  const [enabled, setEnabled] = useState(true);

  // Per-experience branding overrides
  const [brandingLogo, setBrandingLogo] = useState('');
  const [brandingPrimaryColor, setBrandingPrimaryColor] = useState('');
  const [brandingSecondaryColor, setBrandingSecondaryColor] = useState('');
  const [brandingBusinessName, setBrandingBusinessName] = useState('');
  const [brandingAssistantName, setBrandingAssistantName] = useState('');
  const [brandingEnabled, setBrandingEnabled] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Calendar booking URL
  const [calendarUrl, setCalendarUrl] = useState('');
  const [showEmbeddedCalendar, setShowEmbeddedCalendar] = useState(false);

  // Prepaid booking
  const [prepaidEnabled, setPrepaidEnabled] = useState(false);
  const [prepaidAmount, setPrepaidAmount] = useState('');        // dollars (e.g. "99")
  const [prepaidCurrency, setPrepaidCurrency] = useState('usd');
  const [prepaidDescription, setPrepaidDescription] = useState('');

  // Pricing tiers
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [savingPricing, setSavingPricing] = useState(false);

  // Resolve the experience type from URL param
  const experienceType = Object.values(ExperienceType).find(
    (t) => t === typeParam
  );
  const config = experienceType ? EXPERIENCE_CONFIGS[experienceType] : null;

  useEffect(() => {
    const token = localStorage.getItem('partner_token');
    if (!token) {
      router.push('/partner/login');
      return;
    }
    const storedName = localStorage.getItem('partner_name');
    if (storedName) setPartnerName(storedName);

    if (!experienceType || !config) {
      setLoading(false);
      return;
    }

    fetchExperience(token);
  }, [router, experienceType, config]);

  const fetchExperience = async (token: string) => {
    try {
      const response = await fetch('/api/partner/experiences', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        if (response.status === 401) { router.push('/partner/login'); return; }
        setLoading(false);
        return;
      }
      const data = await response.json();
      if (data.success && data.experiences) {
        const match = data.experiences.find(
          (e: ExperienceData) => e.experienceType === experienceType
        );
        if (match) {
          setExperience(match);
          setDisplayName(match.displayName || '');
          setAlias(match.alias || '');
          setEnabled(match.enabled);

          // Populate branding overrides from landingPageConfig
          const expBranding = match.landingPageConfig?.branding;
          if (expBranding) {
            setBrandingEnabled(true);
            setBrandingLogo(expBranding.logo || '');
            setBrandingPrimaryColor(expBranding.primaryColor || '');
            setBrandingSecondaryColor(expBranding.secondaryColor || '');
            setBrandingBusinessName(expBranding.businessName || '');
            setBrandingAssistantName(expBranding.assistantName || '');
          }

          // Populate calendar URL and embed toggle
          setCalendarUrl((match.landingPageConfig?.calendarUrl as string) || '');
          setShowEmbeddedCalendar(match.landingPageConfig?.showEmbeddedCalendar === true);

          // Populate prepaid booking
          const prepaid = match.landingPageConfig?.prepaidBooking as Record<string, unknown> | undefined;
          if (prepaid) {
            setPrepaidEnabled(prepaid.enabled === true);
            setPrepaidAmount(prepaid.amount ? String(Math.round(Number(prepaid.amount) / 100)) : '');
            setPrepaidCurrency((prepaid.currency as string) || 'usd');
            setPrepaidDescription((prepaid.description as string) || '');
          }

          // Populate pricing tiers
          const existingTiers = match.pricingConfig?.tiers;
          if (existingTiers && existingTiers.length > 0) {
            setPricingTiers(existingTiers);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching experience:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!experience) return;
    const token = localStorage.getItem('partner_token');
    if (!token) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/partner/experiences/${experience.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          displayName: displayName.trim() || undefined,
          alias: alias.trim() || config?.defaultAlias || undefined,
          enabled,
          // Include branding overrides and calendarUrl in landingPageConfig
          landingPageConfig: {
            ...(brandingEnabled
              ? {
                  branding: {
                    ...(brandingLogo.trim() ? { logo: brandingLogo.trim() } : {}),
                    ...(brandingPrimaryColor.trim() ? { primaryColor: brandingPrimaryColor.trim() } : {}),
                    ...(brandingSecondaryColor.trim() ? { secondaryColor: brandingSecondaryColor.trim() } : {}),
                    ...(brandingBusinessName.trim() ? { businessName: brandingBusinessName.trim() } : {}),
                    ...(brandingAssistantName.trim() ? { assistantName: brandingAssistantName.trim() } : {}),
                  },
                }
              : { branding: {} }),
            ...(calendarUrl.trim() ? { calendarUrl: calendarUrl.trim() } : {}),
            showEmbeddedCalendar,
            prepaidBooking: {
              enabled: prepaidEnabled,
              amount: prepaidEnabled && prepaidAmount.trim() ? Math.round(parseFloat(prepaidAmount.trim()) * 100) : 0,
              currency: prepaidCurrency,
              description: prepaidDescription.trim(),
            },
          },
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        toast.error(errData.error || 'Failed to save settings');
        return;
      }

      toast.success('Experience settings saved successfully!');
      // Refresh data
      await fetchExperience(token);
    } catch (error) {
      console.error('Error saving experience:', error);
      toast.error('An error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('partner_token');
    localStorage.removeItem('partner_name');
    router.push('/partner/login');
  };

  const handleToggleEnabled = async () => {
    if (!experience) return;
    const token = localStorage.getItem('partner_token');
    if (!token) return;

    const newEnabled = !enabled;
    setEnabled(newEnabled);

    try {
      await fetch(`/api/partner/experiences/${experience.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled: newEnabled }),
      });
      toast.success(newEnabled ? 'Experience enabled' : 'Experience disabled');
    } catch (error) {
      console.error('Error toggling experience:', error);
      setEnabled(!newEnabled); // revert
      toast.error('Failed to toggle experience');
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !experience) return;
    const token = localStorage.getItem('partner_token');
    if (!token) return;

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/partner/experiences/${experience.id}/logo`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        toast.error(errData.error || 'Failed to upload logo');
        return;
      }

      const data = await response.json();
      if (data.success && data.logoUrl) {
        setBrandingLogo(data.logoUrl);
        toast.success('Logo uploaded successfully!');
      }
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error('Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const addPricingTier = () => {
    setPricingTiers(prev => [...prev, {
      name: prev.length === 0 ? 'lite' : prev.length === 1 ? 'pro' : `tier_${prev.length + 1}`,
      displayName: prev.length === 0 ? 'Lite' : prev.length === 1 ? 'Pro' : `Tier ${prev.length + 1}`,
      description: '',
      price: 0,
      currency: 'usd',
      interval: 'month',
      features: [],
      highlighted: prev.length === 1, // Second tier highlighted by default
    }]);
  };

  const removePricingTier = (index: number) => {
    setPricingTiers(prev => prev.filter((_, i) => i !== index));
  };

  const updatePricingTier = (index: number, field: keyof PricingTier, value: unknown) => {
    setPricingTiers(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t));
  };

  const handleSavePricing = async () => {
    if (!experience || pricingTiers.length === 0) return;
    const token = localStorage.getItem('partner_token');
    if (!token) return;

    setSavingPricing(true);
    try {
      const response = await fetch(`/api/partner/experiences/${experience.id}/pricing`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tiers: pricingTiers }),
      });

      if (!response.ok) {
        const errData = await response.json();
        toast.error(errData.error || 'Failed to save pricing');
        return;
      }

      const data = await response.json();
      if (data.success && data.tiers) {
        setPricingTiers(data.tiers);
        toast.success('Pricing tiers saved with Stripe products created!');
      }
    } catch (error) {
      console.error('Error saving pricing:', error);
      toast.error('An error occurred while saving pricing');
    } finally {
      setSavingPricing(false);
    }
  };

  // Not found state
  if (!loading && (!experienceType || !config)) {
    return (
      <PartnerLayout partnerName={partnerName} onLogout={handleLogout}>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold mb-2">Experience Not Found</h1>
          <p className="text-gray-400 mb-6">The requested experience type does not exist.</p>
          <button
            onClick={() => router.push('/partner/experiences')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <FiArrowLeft className="w-4 h-4" /> Back to Experiences
          </button>
        </div>
      </PartnerLayout>
    );
  }

  // Loading state
  if (loading) {
    return (
      <PartnerLayout partnerName={partnerName} onLogout={handleLogout}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
        </div>
      </PartnerLayout>
    );
  }

  // Experience not enabled for this partner
  if (!experience) {
    return (
      <PartnerLayout partnerName={partnerName} onLogout={handleLogout}>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="text-6xl mb-4">⚙️</div>
          <h1 className="text-2xl font-bold mb-2">{config?.name} Not Enabled</h1>
          <p className="text-gray-400 mb-6">Enable this experience from the catalog first to configure its settings.</p>
          <button
            onClick={() => router.push('/partner/experiences')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <FiArrowLeft className="w-4 h-4" /> Back to Experiences
          </button>
        </div>
      </PartnerLayout>
    );
  }

  const IconComponent = config?.icon === 'FiMessageCircle' ? FiMessageCircle : FiPhone;

  return (
    <PartnerLayout partnerName={partnerName} onLogout={handleLogout}>
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push('/partner/experiences')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
        >
          <FiArrowLeft className="w-4 h-4" /> Back to Experiences
        </button>
        <div className="flex items-center gap-4">
          <div
            className="p-3 rounded-xl"
            style={{ backgroundColor: `${config?.color}20`, color: config?.color }}
          >
            <IconComponent className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{config?.name} Settings</h1>
            <p className="text-gray-400">{config?.shortDescription}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 max-w-3xl">
        {/* Status & Toggle */}
        <NeonContainer className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <FiSettings className="w-5 h-5 text-gray-400" /> Status
              </h2>
              <p className="text-gray-400 mt-1 text-sm">Enable or disable this experience for your customers</p>
            </div>
            <button
              onClick={handleToggleEnabled}
              className="flex items-center gap-2 transition-colors"
            >
              {enabled ? (
                <FiToggleRight className="w-10 h-10 text-green-400" />
              ) : (
                <FiToggleLeft className="w-10 h-10 text-gray-500" />
              )}
              <span className={`text-sm font-medium ${enabled ? 'text-green-400' : 'text-gray-500'}`}>
                {enabled ? 'Active' : 'Disabled'}
              </span>
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-700">
            <div>
              <p className="text-sm text-gray-400">Total Prospects</p>
              <p className="text-2xl font-bold">{experience.totalProspects}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Total Customers</p>
              <p className="text-2xl font-bold">{experience.totalCustomers}</p>
            </div>
          </div>
        </NeonContainer>

        {/* General Settings */}
        <NeonContainer className="p-6">
          <h2 className="text-xl font-semibold flex items-center gap-2 mb-6">
            <FiType className="w-5 h-5 text-gray-400" /> General Settings
          </h2>

          <div className="space-y-5">
            {/* Display Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={config?.defaultDisplayName}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
              <p className="text-xs text-gray-500 mt-1">The name shown to your customers on the landing page</p>
            </div>

            {/* URL Alias */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <FiLink className="w-4 h-4" /> URL Path
              </label>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-sm">yourdomain.com</span>
                <input
                  type="text"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  placeholder={config?.defaultAlias || '/'}
                  className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                The URL path where this experience is accessible (e.g., /assistant)
              </p>
            </div>
          </div>
        </NeonContainer>

        {/* Experience Branding Overrides */}
        <NeonContainer className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <FiImage className="w-5 h-5 text-gray-400" /> Experience Branding
            </h2>
            <button
              onClick={() => setBrandingEnabled(!brandingEnabled)}
              className="flex items-center gap-2 transition-colors"
            >
              {brandingEnabled ? (
                <FiToggleRight className="w-8 h-8 text-green-400" />
              ) : (
                <FiToggleLeft className="w-8 h-8 text-gray-500" />
              )}
              <span className={`text-xs font-medium ${brandingEnabled ? 'text-green-400' : 'text-gray-500'}`}>
                {brandingEnabled ? 'Custom' : 'Default'}
              </span>
            </button>
          </div>

          <p className="text-sm text-gray-400 mb-4">
            {brandingEnabled
              ? 'Custom branding is enabled for this experience. Fields left empty will fall back to your whitelabel branding.'
              : 'Using your default whitelabel branding. Enable to set custom branding for this experience.'}
          </p>

          {brandingEnabled && (
            <div className="space-y-5 pt-4 border-t border-gray-700">
              {/* Logo Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                  <FiUpload className="w-4 h-4" /> Logo
                </label>
                <div className="space-y-3">
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp,image/svg+xml"
                    onChange={handleLogoUpload}
                    disabled={uploadingLogo}
                    className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-500 file:text-white hover:file:bg-blue-600 file:cursor-pointer disabled:opacity-50"
                  />
                  {uploadingLogo && (
                    <p className="text-xs text-blue-400 flex items-center gap-2">
                      <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-400" />
                      Uploading...
                    </p>
                  )}
                  {brandingLogo && (
                    <div className="p-3 bg-gray-800/50 rounded-lg">
                      <img src={brandingLogo} alt="Logo preview" className="h-10 w-auto object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">Upload a logo for this experience&apos;s landing page (max 5MB, JPEG/PNG/WebP/SVG)</p>
              </div>

              {/* Business Name Override */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Business Name</label>
                <input
                  type="text"
                  value={brandingBusinessName}
                  onChange={(e) => setBrandingBusinessName(e.target.value)}
                  placeholder="Leave empty to use whitelabel business name"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
                <p className="text-xs text-gray-500 mt-1">Override the business name shown on this experience</p>
              </div>

              {/* Assistant/Character Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                  <FiUser className="w-4 h-4" /> Assistant Name
                </label>
                <input
                  type="text"
                  value={brandingAssistantName}
                  onChange={(e) => setBrandingAssistantName(e.target.value)}
                  placeholder="e.g., Aria, Max, Luna"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
                <p className="text-xs text-gray-500 mt-1">Character name for the AI assistant (shown in branding and on the portal)</p>
              </div>

              {/* Colors */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Primary Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={brandingPrimaryColor || '#3B82F6'}
                      onChange={(e) => setBrandingPrimaryColor(e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer border border-gray-700 bg-transparent"
                    />
                    <input
                      type="text"
                      value={brandingPrimaryColor}
                      onChange={(e) => setBrandingPrimaryColor(e.target.value)}
                      placeholder="#3B82F6"
                      className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Secondary Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={brandingSecondaryColor || '#10B981'}
                      onChange={(e) => setBrandingSecondaryColor(e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer border border-gray-700 bg-transparent"
                    />
                    <input
                      type="text"
                      value={brandingSecondaryColor}
                      onChange={(e) => setBrandingSecondaryColor(e.target.value)}
                      placeholder="#10B981"
                      className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </NeonContainer>

        {/* Calendar Booking URL */}
        <NeonContainer className="p-6">
          <h2 className="text-xl font-semibold flex items-center gap-2 mb-2">
            <FiPhone className="w-5 h-5 text-teal-400" /> Calendar Booking
          </h2>
          <p className="text-sm text-gray-400 mb-5">
            Paste your booking link (Calendly, Cal.com, Google Meet, etc.). By default, the link is sent to
            prospects in their confirmation email — turn on the embed toggle below to show it as an inline
            calendar inside the onboarding flow instead.
          </p>
          <div className="space-y-5">
            {/* Booking URL */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <FiLink className="w-4 h-4" /> Booking URL
              </label>
              <input
                type="url"
                value={calendarUrl}
                onChange={(e) => setCalendarUrl(e.target.value)}
                placeholder="https://calendly.com/your-name/discovery-call"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
              />
              <p className="text-xs text-gray-500 mt-1">
                Any public booking link — Calendly, Cal.com, TidyCal, Hubspot Meetings, Google Calendar, etc.
                Leave empty to skip the booking step entirely.
              </p>
            </div>

            {/* Embedded calendar toggle */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-700">
              <div>
                <p className="text-sm font-medium text-gray-300">Show Embedded Calendar</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Off (default): booking link is sent by email. On: calendar is embedded inline in the onboarding flow.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEmbeddedCalendar(v => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${showEmbeddedCalendar ? 'bg-teal-500' : 'bg-gray-700'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${showEmbeddedCalendar ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
        </NeonContainer>

        {/* Prepaid Booking */}
        <NeonContainer className="p-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <FiDollarSign className="w-5 h-5 text-orange-400" /> Prepaid Booking
            </h2>
            {/* Toggle */}
            <button
              type="button"
              onClick={() => setPrepaidEnabled(v => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${prepaidEnabled ? 'bg-orange-500' : 'bg-gray-700'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${prepaidEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          <p className="text-sm text-gray-400 mb-5">
            Require a one-time payment before the prospect can book a calendar slot. Payment goes directly to your Stripe account.
            {!prepaidEnabled && <span className="ml-1 text-gray-500">Toggle on to configure.</span>}
          </p>

          {prepaidEnabled && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Booking Fee (in your local currency)</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={prepaidAmount}
                    onChange={e => setPrepaidAmount(e.target.value)}
                    placeholder="e.g. 99"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                  />
                  <p className="text-xs text-gray-500 mt-1">Enter the amount in whole units (e.g. 99 for $99 / £99).</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Currency</label>
                  <select
                    value={prepaidCurrency}
                    onChange={e => setPrepaidCurrency(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                  >
                    <option value="usd">USD — US Dollar</option>
                    <option value="gbp">GBP — British Pound</option>
                    <option value="eur">EUR — Euro</option>
                    <option value="inr">INR — Indian Rupee</option>
                    <option value="aud">AUD — Australian Dollar</option>
                    <option value="cad">CAD — Canadian Dollar</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Payment Description (shown on Stripe checkout page)</label>
                <input
                  type="text"
                  value={prepaidDescription}
                  onChange={e => setPrepaidDescription(e.target.value)}
                  placeholder="e.g. 1-on-1 OpenClaw AI Setup Session"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                />
              </div>
              <div className="flex items-start gap-2 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg text-xs text-orange-300">
                <FiDollarSign className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>Stripe Connect must be configured in your Settings → Integrations for payments to work. Funds go directly to your Stripe account.</span>
              </div>
            </div>
          )}
        </NeonContainer>

        {/* Pricing Tiers */}
        <NeonContainer className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <FiDollarSign className="w-5 h-5 text-emerald-400" /> Pricing Tiers
            </h2>
            <button
              onClick={addPricingTier}
              className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm transition-colors"
            >
              <FiPlus className="w-4 h-4" /> Add Tier
            </button>
          </div>
          <p className="text-sm text-gray-400 mb-6">
            Configure pricing tiers for your customers. Each tier creates a Stripe product and price in your connected account.
          </p>

          {pricingTiers.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-gray-700 rounded-lg">
              <FiDollarSign className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 mb-2">No pricing tiers configured</p>
              <p className="text-sm text-gray-500 mb-4">Add Lite and Pro tiers to start selling your Personal Assistant service</p>
              <button
                onClick={addPricingTier}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm transition-colors"
              >
                <FiPlus className="w-4 h-4 inline mr-1" /> Add First Tier
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {pricingTiers.map((tier, index) => (
                <div key={index} className="border border-gray-700 rounded-lg p-5 bg-gray-800/50 relative">
                  {/* Tier header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-semibold text-white">
                        {tier.displayName || `Tier ${index + 1}`}
                      </span>
                      {tier.highlighted && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                          <FiStar className="w-3 h-3" /> {tier.highlightLabel || 'Popular'}
                        </span>
                      )}
                      {tier.stripeProductId && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
                          <FiCheck className="w-3 h-3" /> Stripe Connected
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => removePricingTier(index)}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Remove tier"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Tier fields */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Internal Name</label>
                      <input
                        type="text"
                        value={tier.name}
                        onChange={(e) => updatePricingTier(index, 'name', e.target.value)}
                        placeholder="e.g., lite, pro"
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Display Name</label>
                      <input
                        type="text"
                        value={tier.displayName}
                        onChange={(e) => updatePricingTier(index, 'displayName', e.target.value)}
                        placeholder="e.g., Lite, Pro"
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
                    <textarea
                      value={tier.description}
                      onChange={(e) => updatePricingTier(index, 'description', e.target.value)}
                      placeholder="Describe what this tier includes..."
                      rows={2}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Price ($)</label>
                      <input
                        type="number"
                        value={tier.price / 100}
                        onChange={(e) => updatePricingTier(index, 'price', Math.round(parseFloat(e.target.value || '0') * 100))}
                        placeholder="19.00"
                        min="0"
                        step="0.01"
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Currency</label>
                      <select
                        value={tier.currency || 'usd'}
                        onChange={(e) => updatePricingTier(index, 'currency', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      >
                        <option value="usd">USD</option>
                        <option value="eur">EUR</option>
                        <option value="gbp">GBP</option>
                        <option value="inr">INR</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Interval</label>
                      <select
                        value={tier.interval}
                        onChange={(e) => updatePricingTier(index, 'interval', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      >
                        <option value="month">Monthly</option>
                        <option value="year">Yearly</option>
                      </select>
                    </div>
                  </div>

                  {/* Highlighted toggle */}
                  <div className="flex items-center gap-4 mb-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tier.highlighted || false}
                        onChange={(e) => updatePricingTier(index, 'highlighted', e.target.checked)}
                        className="w-4 h-4 rounded border-gray-600 bg-gray-900 text-emerald-500 focus:ring-emerald-500"
                      />
                      <span className="text-sm text-gray-300 flex items-center gap-1">
                        <FiStar className="w-3 h-3 text-yellow-400" /> Highlight this tier
                      </span>
                    </label>
                    {tier.highlighted && (
                      <input
                        type="text"
                        value={tier.highlightLabel || ''}
                        onChange={(e) => updatePricingTier(index, 'highlightLabel', e.target.value)}
                        placeholder="MOST POPULAR"
                        className="px-3 py-1 bg-gray-900 border border-gray-700 rounded-lg text-yellow-400 text-xs placeholder-gray-500 focus:ring-2 focus:ring-yellow-500 outline-none"
                      />
                    )}
                  </div>

                  {/* Features */}
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Features (one per line)</label>
                    <textarea
                      value={(tier.features || []).join('\n')}
                      onChange={(e) => updatePricingTier(index, 'features', e.target.value.split('\n').filter((f: string) => f.trim()))}
                      placeholder={"24/7 AI Personal Assistant\nWhatsApp Integration\nCustom Knowledge Base\nPriority Support"}
                      rows={4}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none font-mono"
                    />
                  </div>

                  {/* Stripe IDs (read-only) */}
                  {(tier.stripeProductId || tier.stripePriceId) && (
                    <div className="mt-4 pt-3 border-t border-gray-700">
                      <p className="text-xs text-gray-500 mb-2">Stripe Integration</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {tier.stripeProductId && (
                          <div>
                            <span className="text-gray-500">Product: </span>
                            <span className="text-gray-400 font-mono">{tier.stripeProductId}</span>
                          </div>
                        )}
                        {tier.stripePriceId && (
                          <div>
                            <span className="text-gray-500">Price: </span>
                            <span className="text-gray-400 font-mono">{tier.stripePriceId}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Save Pricing Button */}
              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSavePricing}
                  disabled={savingPricing}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {savingPricing ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  ) : (
                    <FiDollarSign className="w-4 h-4" />
                  )}
                  {savingPricing ? 'Creating Stripe Products...' : 'Save Pricing & Create Stripe Products'}
                </button>
              </div>
            </div>
          )}
        </NeonContainer>

        {/* Quick Links */}
        <NeonContainer className="p-6">
          <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
            <FiInfo className="w-5 h-5 text-gray-400" /> Quick Links
          </h2>
          <div className="space-y-3">
            {(alias || config?.defaultAlias) && (
              <button
                onClick={() => {
                  const url = alias || config?.defaultAlias;
                  if (url) window.open(url, '_blank');
                }}
                className="flex items-center gap-3 w-full px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-left"
              >
                <FiExternalLink className="w-5 h-5 text-blue-400" />
                <div>
                  <p className="text-sm font-medium">View Landing Page</p>
                  <p className="text-xs text-gray-500">{alias || config?.defaultAlias}</p>
                </div>
              </button>
            )}
            <button
              onClick={() => router.push('/partner/prospects')}
              className="flex items-center gap-3 w-full px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-left"
            >
              <FiMessageCircle className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-sm font-medium">View Prospects</p>
                <p className="text-xs text-gray-500">See prospects from this experience</p>
              </div>
            </button>
            {experienceType === ExperienceType.OPENCLAW_SETUP_SERVICE &&
              process.env.NEXT_PUBLIC_OPENCLAW_SETUP_GUIDE_URL && (
              <a
                href={process.env.NEXT_PUBLIC_OPENCLAW_SETUP_GUIDE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 w-full px-4 py-3 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 rounded-lg transition-colors text-left"
              >
                <FiBookOpen className="w-5 h-5 text-orange-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-orange-300">OpenClaw Setup Guide</p>
                  <p className="text-xs text-orange-400/60">Step-by-step script for your setup call with the prospect</p>
                </div>
                <FiExternalLink className="w-4 h-4 text-orange-400/40 ml-auto flex-shrink-0" />
              </a>
            )}
          </div>
        </NeonContainer>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
            ) : (
              <FiSave className="w-5 h-5" />
            )}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </PartnerLayout>
  );
}

