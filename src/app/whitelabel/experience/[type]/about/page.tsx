'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FiArrowLeft, FiArrowRight, FiMessageCircle, FiShield, FiZap,
  FiHeart, FiGlobe, FiLock, FiMail, FiPhone, FiMapPin,
  FiTwitter, FiLinkedin, FiFacebook, FiInstagram,
} from 'react-icons/fi';

import { PartnerBranding } from '@/types/partner';

interface PABranding extends PartnerBranding {
  assistantName?: string;
}

export default function ExperienceAboutPage() {
  const [branding, setBranding] = useState<PABranding | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const res = await fetch('/api/whitelabel/experience-branding/assistant');
        if (res.ok) setBranding(await res.json());
      } catch (err) {
        console.error('Error fetching branding:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBranding();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400 mx-auto mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  const brandName = branding?.businessName || 'AI Personal Assistant';
  const assistantName = branding?.assistantName || 'AI Assistant';
  const primaryColor = branding?.primaryColor || '#10B981';

  const values = [
    { icon: FiShield, title: 'Privacy First', desc: 'Your data is encrypted end-to-end. We never sell or share your information with third parties.' },
    { icon: FiZap, title: 'Always Improving', desc: 'Our AI gets smarter every day, learning your preferences to deliver better results over time.' },
    { icon: FiHeart, title: 'Human-Centered', desc: 'Technology should serve people, not the other way around. We build tools that feel natural.' },
    { icon: FiGlobe, title: 'Accessible to All', desc: 'Available on WhatsApp — the app billions already use. No new software to learn.' },
    { icon: FiLock, title: 'Enterprise Security', desc: 'SOC 2 compliant infrastructure with enterprise-grade security for your peace of mind.' },
    { icon: FiMessageCircle, title: 'Always Available', desc: 'Your assistant works 24/7, across time zones, so you never miss a beat.' },
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
            <a href="/assistant/pricing" className="text-gray-400 hover:text-white text-sm font-medium transition-colors">Pricing</a>
            <button onClick={() => { window.location.href = '/assistant/onboarding/1'; }}
              className="px-5 py-2 text-sm font-semibold text-white rounded-lg transition-all hover:opacity-90" style={{ backgroundColor: primaryColor }}>
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-28 pb-16 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-15 blur-3xl" style={{ background: `radial-gradient(circle, ${primaryColor}40, transparent 70%)` }} />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <h1 className="text-4xl sm:text-5xl font-bold mb-6">About {brandName}</h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
              We believe everyone deserves a personal assistant. {assistantName} is built to help busy professionals
              reclaim their time and focus on what truly matters — powered by cutting-edge AI, delivered through WhatsApp.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Mission */}
      <section className="pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
            className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8 sm:p-12 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">Our Mission</h2>
            <p className="text-gray-400 text-lg leading-relaxed max-w-2xl mx-auto">
              To democratize access to personal AI assistance, making it as simple as sending a WhatsApp message.
              We&apos;re building the future where everyone has a tireless, intelligent assistant that handles the busywork
              so you can focus on the work that matters.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Values */}
      <section className="pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">What We Stand For</h2>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {values.map((v, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: i * 0.08 }}
                className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6">
                <div className="w-11 h-11 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: `${primaryColor}15` }}>
                  <v.icon className="w-5 h-5" style={{ color: primaryColor }} />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{v.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{v.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>


      {/* CTA */}
      <section className="pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="relative rounded-2xl overflow-hidden p-12 sm:p-16" style={{ background: `linear-gradient(135deg, ${primaryColor}20, ${primaryColor}05)` }}>
            <div className="absolute inset-0 border rounded-2xl" style={{ borderColor: `${primaryColor}30` }} />
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="relative">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Ready to Meet {assistantName}?</h2>
              <p className="text-gray-400 text-lg mb-8 max-w-xl mx-auto">Get started in minutes. No credit card required for your free trial.</p>
              <motion.button onClick={() => { window.location.href = '/assistant/onboarding/1'; }}
                className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white rounded-xl transition-all"
                style={{ backgroundColor: primaryColor }} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                Get Started <FiArrowRight className="ml-2 w-5 h-5" />
              </motion.button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              {branding?.logo ? (
                <img src={branding.logo} alt={branding.businessName} className="h-10 w-auto object-contain mb-4" />
              ) : (
                <span className="text-lg font-bold text-white block mb-4">{branding?.businessName || brandName}</span>
              )}
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