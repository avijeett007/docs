'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FiCheck, FiArrowRight, FiArrowLeft, FiMessageCircle,
  FiMail, FiPhone, FiMapPin, FiTwitter, FiLinkedin,
  FiFacebook, FiInstagram,
} from 'react-icons/fi';

import { PartnerBranding } from '@/types/partner';
import { PricingTier } from '@/types/experience';

interface PABranding extends PartnerBranding {
  assistantName?: string;
}

interface PricingData {
  tiers: PricingTier[];
  experienceType: string;
}

export default function ExperiencePricingPage() {
  const [branding, setBranding] = useState<PABranding | null>(null);
  const [pricingData, setPricingData] = useState<PricingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [brandingRes, pricingRes] = await Promise.all([
          fetch('/api/whitelabel/experience-branding/assistant'),
          fetch('/api/whitelabel/experience-pricing/assistant'),
        ]);

        if (brandingRes.ok) {
          const data = await brandingRes.json();
          setBranding(data);
        }
        if (pricingRes.ok) {
          const data = await pricingRes.json();
          setPricingData(data);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleGetStarted = () => {
    window.location.href = '/assistant/onboarding/1';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400 mx-auto mb-4" />
          <p className="text-gray-400">Loading pricing...</p>
        </div>
      </div>
    );
  }

  const brandName = branding?.businessName || 'AI Personal Assistant';
  const assistantName = branding?.assistantName || 'AI Assistant';
  const primaryColor = branding?.primaryColor || '#10B981';

  // Use partner-configured tiers or fallback defaults
  const tiers: Array<{
    name: string; price: string; period: string; description: string;
    features: string[]; highlighted: boolean; badge?: string;
  }> = pricingData?.tiers && pricingData.tiers.length > 0
    ? pricingData.tiers.map(t => ({
        name: t.displayName,
        price: `$${(t.price / 100).toFixed(t.price % 100 === 0 ? 0 : 2)}`,
        period: `/${t.interval}`,
        description: t.description,
        features: t.features,
        highlighted: t.highlighted || false,
        badge: t.highlightLabel,
      }))
    : [
        {
          name: 'Lite',
          price: '$19',
          period: '/month',
          description: 'Perfect for getting started with your AI assistant.',
          features: ['WhatsApp AI Assistant', 'Smart scheduling', 'Email summaries', 'Basic task management', 'Standard response time'],
          highlighted: false,
        },
        {
          name: 'Pro',
          price: '$39',
          period: '/month',
          description: 'For professionals who want the full AI experience.',
          features: ['Everything in Lite', 'Dedicated assistant', 'Priority responses', 'Document analysis', 'Custom workflows', 'Advanced integrations'],
          highlighted: true,
          badge: 'MOST POPULAR',
        },
      ];

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0f1a]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <a href="/assistant" className="flex items-center gap-3">
            {branding?.logo ? (
              <img src={branding.logo} alt={brandName} className="h-10 w-auto object-contain" />
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
                  <FiMessageCircle className="w-4 h-4 text-white" />
                </div>
                <span className="text-lg font-bold text-white">{brandName}</span>
              </div>
            )}
          </a>
          <div className="flex items-center gap-4">
            <a href="/assistant" className="text-gray-400 hover:text-white text-sm font-medium transition-colors flex items-center gap-1">
              <FiArrowLeft className="w-4 h-4" /> Home
            </a>
            <button onClick={handleGetStarted} className="px-5 py-2 text-sm font-semibold text-white rounded-lg transition-all hover:opacity-90" style={{ backgroundColor: primaryColor }}>
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-28 pb-12 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-15 blur-3xl" style={{ background: `radial-gradient(circle, ${primaryColor}40, transparent 70%)` }} />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <h1 className="text-4xl sm:text-5xl font-bold mb-4">Simple, Transparent Pricing</h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">Choose the plan that fits your needs. Get your {assistantName} up and running in minutes. Cancel anytime.</p>
          </motion.div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20 relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`grid gap-8 max-w-3xl mx-auto ${tiers.length === 1 ? 'grid-cols-1 max-w-md' : tiers.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
            {tiers.map((tier, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: i * 0.15 }}
                className={`relative rounded-2xl p-8 ${tier.highlighted ? 'border-2' : 'border border-white/10 bg-white/[0.03]'}`}
                style={tier.highlighted ? { borderColor: primaryColor, backgroundColor: `${primaryColor}08` } : {}}
              >
                {tier.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white" style={{ backgroundColor: primaryColor }}>
                    {tier.badge}
                  </div>
                )}
                <h3 className="text-2xl font-bold text-white mb-2">{tier.name}</h3>
                <p className="text-gray-400 text-sm mb-6">{tier.description}</p>
                <div className="mb-8">
                  <span className="text-5xl font-bold text-white">{tier.price}</span>
                  <span className="text-gray-500 text-lg">{tier.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {tier.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-3 text-sm text-gray-300">
                      <FiCheck className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: primaryColor }} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button onClick={handleGetStarted}
                  className={`w-full py-3.5 px-6 font-semibold rounded-xl transition-all text-lg ${tier.highlighted ? 'text-white hover:opacity-90' : 'text-white bg-white/10 hover:bg-white/15'}`}
                  style={tier.highlighted ? { backgroundColor: primaryColor } : {}}
                >
                  Get Started <FiArrowRight className="inline w-4 h-4 ml-1" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Money-back guarantee */}
      <section className="pb-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8">
            <div className="text-4xl mb-4">🛡️</div>
            <h3 className="text-xl font-bold text-white mb-2">Risk-Free Guarantee</h3>
            <p className="text-gray-400">Not satisfied? Cancel anytime with no questions asked. No long-term contracts, no hidden fees.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                {branding?.logo ? (
                  <img src={branding.logo} alt={branding.businessName} className="h-10 w-auto object-contain" />
                ) : (
                  <span className="text-lg font-bold text-white">{branding?.businessName || brandName}</span>
                )}
              </div>
              <p className="text-gray-500 text-sm">Your AI-powered personal assistant, available 24/7 on WhatsApp.</p>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4 text-sm">Contact</h3>
              <div className="space-y-2 text-sm text-gray-500">
                {branding?.supportEmail && <div className="flex items-center gap-2"><FiMail className="w-4 h-4" />{branding.supportEmail}</div>}
                {branding?.companyPhone && <div className="flex items-center gap-2"><FiPhone className="w-4 h-4" />{branding.companyPhone}</div>}
                {branding?.companyAddress && <div className="flex items-center gap-2"><FiMapPin className="w-4 h-4" />{branding.companyAddress}</div>}
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4 text-sm">Legal</h3>
              <div className="space-y-2 text-sm text-gray-500">
                {branding?.privacyPolicyUrl && <a href={branding.privacyPolicyUrl} className="block hover:text-white transition-colors">Privacy Policy</a>}
                {branding?.termsOfServiceUrl && <a href={branding.termsOfServiceUrl} className="block hover:text-white transition-colors">Terms of Service</a>}
              </div>
              {(branding?.twitterUrl || branding?.linkedinUrl || branding?.facebookUrl || branding?.instagramUrl) && (
                <div className="flex gap-3 mt-4">
                  {branding?.twitterUrl && <a href={branding.twitterUrl} className="text-gray-500 hover:text-white transition-colors"><FiTwitter className="w-5 h-5" /></a>}
                  {branding?.linkedinUrl && <a href={branding.linkedinUrl} className="text-gray-500 hover:text-white transition-colors"><FiLinkedin className="w-5 h-5" /></a>}
                  {branding?.facebookUrl && <a href={branding.facebookUrl} className="text-gray-500 hover:text-white transition-colors"><FiFacebook className="w-5 h-5" /></a>}
                  {branding?.instagramUrl && <a href={branding.instagramUrl} className="text-gray-500 hover:text-white transition-colors"><FiInstagram className="w-5 h-5" /></a>}
                </div>
              )}
            </div>
          </div>
          <div className="border-t border-white/5 mt-8 pt-8 text-center text-sm text-gray-600">
            © {new Date().getFullYear()} {branding?.businessName || brandName}. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

