'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiArrowRight, FiUser, FiMail, FiMessageCircle } from 'react-icons/fi';
import { PartnerBranding } from '@/types/partner';
import { saveProspectProgress } from '@/lib/prospectTracker';

/**
 * PA Step 2: Customer Details
 * Collects name, email, and WhatsApp number for the AI Personal Assistant.
 * Unlike AI Receptionist Step3, this focuses on WhatsApp (no phone country selection).
 */
export default function PAStep2CustomerDetails() {
  const [branding, setBranding] = useState<PartnerBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ firstName: '', lastName: '', email: '', whatsappNumber: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [error, setError] = useState('');
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const hostname = window.location.hostname;
        let subdomain = '';
        if (hostname.includes('.lvh.me')) subdomain = hostname.split('.')[0];
        else if (hostname.includes('.knotie-ai.pro')) subdomain = hostname.split('.')[0];
        else if (hostname !== 'localhost' && hostname !== '127.0.0.1') subdomain = hostname;
        if (!subdomain) throw new Error('Unable to determine partner');

        const response = await fetch(`/api/whitelabel/branding/${subdomain}`);
        if (!response.ok) throw new Error('Failed to fetch branding');
        setBranding(await response.json());
      } catch (err) {
        console.error('Error fetching branding:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBranding();
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'email') { setEmailError(''); setShowLoginPrompt(false); }
  };

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isValidWhatsApp = (num: string) => /^[\+]?[1-9][\d]{6,15}$/.test(num.replace(/[\s\-\(\)]/g, ''));

  const isFormValid = () => (
    formData.firstName.trim() && formData.lastName.trim() &&
    formData.email.trim() && isValidEmail(formData.email) &&
    formData.whatsappNumber.trim() && isValidWhatsApp(formData.whatsappNumber)
  );

  const checkEmailExists = async (email: string, partnerId: string) => {
    try {
      const response = await fetch('/api/whitelabel/prospects/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim(), partnerId })
      });
      return response.ok ? await response.json() : { exists: false };
    } catch { return { exists: false }; }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid()) return;
    setIsSubmitting(true);
    setEmailError('');
    setError('');
    setShowLoginPrompt(false);

    try {
      if (!branding?.id) throw new Error('Partner information not available');

      // Check if email already exists
      const emailCheck = await checkEmailExists(formData.email.trim(), branding.id);
      if (emailCheck.exists) {
        setEmailError(emailCheck.message);
        setShowLoginPrompt(true);
        setIsSubmitting(false);
        return;
      }

      let prospectId = localStorage.getItem('onboarding_prospectId');
      if (!prospectId) {
        await saveProspectProgress(1, {
          businessName: localStorage.getItem('onboarding_businessName') || '',
          businessWebsite: localStorage.getItem('onboarding_businessWebsite') || ''
        });
        prospectId = localStorage.getItem('onboarding_prospectId');
      }

      if (!prospectId) throw new Error('Failed to create prospect record');

      // Convert prospect to customer
      const convertResponse = await fetch('/api/whitelabel/prospects/convert-to-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospectId,
          partnerId: branding.id,
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.trim(),
          phone: formData.whatsappNumber.trim(),
          businessName: localStorage.getItem('onboarding_businessName') || '',
          experienceType: 'AI_PERSONAL_ASSISTANT',
        })
      });

      if (!convertResponse.ok) {
        const errorData = await convertResponse.json();
        if (errorData.error === 'CUSTOMER_ALREADY_EXISTS') {
          setError(errorData.message || 'You already have an account.');
          setShowLoginPrompt(true);
          return;
        }
        throw new Error(errorData.error || 'Failed to create customer account');
      }

      const customerData = await convertResponse.json();
      localStorage.setItem('onboarding_firstName', formData.firstName.trim());
      localStorage.setItem('onboarding_lastName', formData.lastName.trim());
      localStorage.setItem('onboarding_email', formData.email.trim());
      localStorage.setItem('onboarding_whatsappNumber', formData.whatsappNumber.trim());
      localStorage.setItem('onboarding_customerId', customerData.customer.id);

      // Generate prospect token
      try {
        const tokenResponse = await fetch('/api/whitelabel/onboarding/prospect-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prospectId, partnerId: branding.id })
        });
        if (tokenResponse.ok) {
          const tokenData = await tokenResponse.json();
          if (tokenData.token) localStorage.setItem('prospect_token', tokenData.token);
        }
      } catch (tokenErr) {
        console.error('Error generating prospect token:', tokenErr);
      }

      // Navigate to PA Step 3 (Knowledge Base)
      window.location.href = '/assistant/onboarding/3';
    } catch (err) {
      console.error('Error in step 2:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
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
        {/* Progress */}
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2 text-emerald-700 text-sm font-medium mb-2">
            <FiMessageCircle className="w-4 h-4" /> AI Personal Assistant Setup
          </div>
          <div className="flex gap-2 justify-center">
            {[1,2,3,4,5].map(s => (
              <div key={s} className={`h-2 w-12 rounded-full ${s <= 2 ? 'bg-emerald-500' : 'bg-gray-200'}`} />
            ))}
          </div>
          <p className="text-gray-500 text-xs mt-2">Step 2 of 5</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Your contact details</h1>
          <p className="text-gray-600 mb-6">We&apos;ll create your account and send login credentials to your email.</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <div className="relative">
                  <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input type="text" value={formData.firstName} onChange={(e) => handleInputChange('firstName', e.target.value)}
                    placeholder="John" className="w-full pl-9 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input type="text" value={formData.lastName} onChange={(e) => handleInputChange('lastName', e.target.value)}
                  placeholder="Doe" className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" required />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input type="email" value={formData.email} onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="john@example.com" className="w-full pl-9 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" required />
              </div>
              {emailError && <p className="text-red-500 text-xs mt-1">{emailError}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Number</label>
              <div className="relative">
                <FiMessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input type="tel" value={formData.whatsappNumber} onChange={(e) => handleInputChange('whatsappNumber', e.target.value)}
                  placeholder="+1 234 567 8900" className="w-full pl-9 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" required />
              </div>
              <p className="text-gray-400 text-xs mt-1">Include country code (e.g., +1 for US, +44 for UK)</p>
              {formData.whatsappNumber && !isValidWhatsApp(formData.whatsappNumber) && (
                <p className="text-red-500 text-xs mt-1">Please enter a valid WhatsApp number with country code</p>
              )}
            </div>

            {showLoginPrompt && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm">
                <p className="text-blue-700 mb-2">It looks like you already have an account.</p>
                <button type="button" onClick={() => window.location.href = '/whitelabel/login/'} className="text-blue-600 font-medium underline">
                  Sign in to your account
                </button>
              </div>
            )}

            <button type="submit" disabled={isSubmitting || !isFormValid()}
              className="w-full py-3 px-6 text-white font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg"
              style={{ backgroundColor: primaryColor }}>
              {isSubmitting ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> : <>Continue <FiArrowRight className="w-5 h-5" /></>}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
