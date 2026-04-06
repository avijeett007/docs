'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiArrowRight, FiGlobe, FiHome, FiMessageCircle } from 'react-icons/fi';
import { PartnerBranding } from '@/types/partner';
import { saveBusinessInfo, markStepCompleted, getAutoFillData, hasBusinessLookupData } from '@/lib/onboarding-storage';

/**
 * PA Step 1: Business Information
 * Collects business name and website for the AI Personal Assistant experience.
 * Independent from AI Receptionist Step1BusinessInfo.
 */
export default function PAStep1BusinessInfo() {
  const [branding, setBranding] = useState<PartnerBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [businessName, setBusinessName] = useState('');
  const [website, setWebsite] = useState('');
  const [hasNoWebsite, setHasNoWebsite] = useState(false);
  const [isValidUrl, setIsValidUrl] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch partner branding
  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const hostname = window.location.hostname;
        let subdomain = '';
        if (hostname.includes('.lvh.me')) subdomain = hostname.split('.')[0];
        else if (hostname.includes('.knotie-ai.pro')) subdomain = hostname.split('.')[0];
        else if (hostname !== 'localhost' && hostname !== '127.0.0.1') subdomain = hostname;

        if (!subdomain) throw new Error('Unable to determine partner from hostname');

        const response = await fetch(`/api/whitelabel/branding/${subdomain}`);
        if (!response.ok) throw new Error('Failed to fetch partner branding');
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

  // Auto-fill from localStorage
  useEffect(() => {
    if (hasBusinessLookupData()) {
      const autoFillData = getAutoFillData();
      if (autoFillData.businessName) {
        setBusinessName(autoFillData.businessName);
        setWebsite(autoFillData.website || '');
        setHasNoWebsite(!autoFillData.hasWebsite);
      }
    }
  }, []);

  // URL validation
  useEffect(() => {
    if (hasNoWebsite) { setIsValidUrl(true); return; }
    if (!website || website.trim().length < 4) { setIsValidUrl(false); return; }
    try {
      let cleanUrl = website.trim().toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '');
      if (cleanUrl.length < 4 || !cleanUrl.includes('.')) { setIsValidUrl(false); return; }
      const fullUrl = `https://www.${cleanUrl}`;
      const urlObj = new URL(fullUrl);
      const parts = urlObj.hostname.split('.');
      setIsValidUrl(parts.length >= 3 && parts.every(p => p.length > 0 && /^[a-zA-Z0-9-]+$/.test(p)));
    } catch { setIsValidUrl(false); }
  }, [website, hasNoWebsite]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim() || (!hasNoWebsite && (!website.trim() || !isValidUrl))) return;
    setIsSubmitting(true);

    try {
      saveBusinessInfo({ name: businessName.trim(), website: hasNoWebsite ? '' : website.trim(), hasWebsite: !hasNoWebsite, step1Completed: true });
      markStepCompleted(1);
      localStorage.setItem('onboarding_businessName', businessName.trim());
      localStorage.setItem('onboarding_website', hasNoWebsite ? '' : website.trim());
      localStorage.setItem('onboarding_hasNoWebsite', hasNoWebsite.toString());
      localStorage.setItem('onboarding_experienceType', 'AI_PERSONAL_ASSISTANT');

      // Save prospect to database
      if (branding?.id) {
        try {
          await fetch('/api/whitelabel/prospects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              partnerId: branding.id,
              step: 1,
              data: {
                businessName: businessName.trim(),
                businessWebsite: hasNoWebsite ? null : website.trim(),
                hasNoWebsite,
                currentStep: 2,
                experienceType: 'AI_PERSONAL_ASSISTANT',
              }
            })
          });
        } catch (dbError) {
          console.error('Error saving prospect:', dbError);
        }
      }

      // Navigate to PA Step 2 (Customer Details)
      window.location.href = '/assistant/onboarding/2';
    } catch (error) {
      console.error('Error in step 1:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || !branding) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  const primaryColor = branding.primaryColor || '#10B981';

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg">
        {/* Progress indicator */}
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2 text-emerald-700 text-sm font-medium mb-2">
            <FiMessageCircle className="w-4 h-4" /> AI Personal Assistant Setup
          </div>
          <div className="flex gap-2 justify-center">
            {[1,2,3,4,5].map(s => (
              <div key={s} className={`h-2 w-12 rounded-full ${s === 1 ? 'bg-emerald-500' : 'bg-gray-200'}`} />
            ))}
          </div>
          <p className="text-gray-500 text-xs mt-2">Step 1 of 5</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Tell us about your business</h1>
          <p className="text-gray-600 mb-6">We&apos;ll use this to personalize your AI assistant.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Business Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
              <div className="relative">
                <FiHome className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g., Acme Corp"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  required
                />
              </div>
            </div>

            {/* Website */}
            {!hasNoWebsite && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Website</label>
                <div className="relative">
                  <FiGlobe className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="e.g., acmecorp.com"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  />
                </div>
                {website && !isValidUrl && (
                  <p className="text-red-500 text-xs mt-1">Please enter a valid website URL</p>
                )}
              </div>
            )}

            {/* No website checkbox */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasNoWebsite}
                onChange={(e) => { setHasNoWebsite(e.target.checked); if (e.target.checked) setWebsite(''); }}
                className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-gray-600">I don&apos;t have a website</span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting || !businessName.trim() || (!hasNoWebsite && !isValidUrl)}
              className="w-full py-3 px-6 text-white font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg"
              style={{ backgroundColor: primaryColor }}
            >
              {isSubmitting ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
              ) : (
                <>Continue <FiArrowRight className="w-5 h-5" /></>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

