'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FiArrowLeft, FiArrowRight, FiMessageCircle, FiCalendar, FiMail,
  FiFileText, FiTrendingUp, FiUsers, FiPhone, FiMapPin,
  FiTwitter, FiLinkedin, FiFacebook, FiInstagram, FiBriefcase,
  FiHome, FiHeart, FiDollarSign,
} from 'react-icons/fi';

import { PartnerBranding } from '@/types/partner';

interface PABranding extends PartnerBranding {
  assistantName?: string;
}

const useCases = [
  {
    icon: FiBriefcase, title: 'Busy Entrepreneurs',
    description: 'Manage your calendar, draft emails, and stay on top of follow-ups — all while you focus on growing your business.',
    benefits: ['Auto-schedule meetings', 'Draft & send emails', 'Track action items', 'Daily briefings'],
  },
  {
    icon: FiHome, title: 'Real Estate Agents',
    description: 'Never miss a lead. Your assistant follows up with prospects, schedules showings, and keeps your pipeline organized.',
    benefits: ['Lead follow-up automation', 'Showing scheduling', 'Client preference tracking', 'Market update summaries'],
  },
  {
    icon: FiDollarSign, title: 'Financial Advisors',
    description: 'Stay connected with clients, prepare meeting briefs, and manage your practice more efficiently.',
    benefits: ['Client meeting prep', 'Portfolio update summaries', 'Appointment reminders', 'Document organization'],
  },
  {
    icon: FiUsers, title: 'Consultants & Coaches',
    description: 'Automate client onboarding, session scheduling, and follow-ups so you can focus on delivering value.',
    benefits: ['Session scheduling', 'Client onboarding flows', 'Progress tracking', 'Resource sharing'],
  },
  {
    icon: FiHeart, title: 'Healthcare Professionals',
    description: 'Manage patient communications, appointment reminders, and administrative tasks with ease.',
    benefits: ['Appointment reminders', 'Patient follow-ups', 'Document management', 'Schedule optimization'],
  },
  {
    icon: FiTrendingUp, title: 'Sales Teams',
    description: 'Keep your pipeline moving with automated follow-ups, meeting scheduling, and CRM updates.',
    benefits: ['Lead qualification', 'Meeting scheduling', 'Follow-up sequences', 'Activity logging'],
  },
];

export default function ExperienceUseCasesPage() {
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
      <section className="pt-28 pb-12 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-15 blur-3xl" style={{ background: `radial-gradient(circle, ${primaryColor}40, transparent 70%)` }} />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <h1 className="text-4xl sm:text-5xl font-bold mb-4">Built for How You Work</h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">See how professionals across industries use {assistantName} to save hours every day and grow their business.</p>
          </motion.div>
        </div>
      </section>

      {/* Use Cases Grid */}
      <section className="pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {useCases.map((uc, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: i * 0.08 }}
                className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 hover:bg-white/[0.06] transition-all"
              >
                <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: `${primaryColor}15` }}>
                  <uc.icon className="w-6 h-6" style={{ color: primaryColor }} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{uc.title}</h3>
                <p className="text-gray-400 text-sm mb-4 leading-relaxed">{uc.description}</p>
                <ul className="space-y-2">
                  {uc.benefits.map((b, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-gray-300">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: primaryColor }} />
                      {b}
                    </li>
                  ))}
                </ul>
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
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Ready to Get Started?</h2>
              <p className="text-gray-400 text-lg mb-8 max-w-xl mx-auto">Join thousands of professionals who are already saving hours every day with {assistantName}.</p>
              <motion.button onClick={() => { window.location.href = '/assistant/onboarding/1'; }}
                className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white rounded-xl transition-all"
                style={{ backgroundColor: primaryColor }} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                Get Your {assistantName} <FiArrowRight className="ml-2 w-5 h-5" />
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

