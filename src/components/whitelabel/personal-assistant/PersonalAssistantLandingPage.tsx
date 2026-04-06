'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FiMessageCircle, FiCalendar, FiMail, FiClock, FiArrowRight,
  FiChevronDown, FiChevronUp, FiPhone, FiMapPin, FiTwitter,
  FiLinkedin, FiFacebook, FiInstagram, FiShield, FiZap, FiCheck,
  FiX, FiStar, FiGlobe, FiUsers, FiTrendingUp, FiFileText,
  FiHeadphones,
} from 'react-icons/fi';

import { PartnerBranding } from '@/types/partner';

// Extended branding type to include assistantName from experience branding API
interface PABranding extends PartnerBranding {
  assistantName?: string;
}

// Renders the assistant name with a vivid gradient so it pops on every dark section
function NameHighlight({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="font-extrabold"
      style={{
        background: `linear-gradient(135deg, ${color} 0%, ${color}bb 100%)`,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}
    >
      {name}
    </span>
  );
}

export default function PersonalAssistantLandingPage() {
  const [branding, setBranding] = useState<PABranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const response = await fetch('/api/whitelabel/experience-branding/assistant');
        if (!response.ok) {
          throw new Error(`Failed to fetch experience branding: ${response.status}`);
        }
        const data = await response.json();
        setBranding(data);
      } catch (err) {
        console.error('Error fetching branding:', err);
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    fetchBranding();
  }, []);

  const handleGetStarted = () => {
    window.location.href = '/assistant/onboarding/1';
  };

  const handleLogin = () => {
    // Use clean /login URL (middleware rewrites internally).
    // Pass ?from=/assistant so the back button on the login page returns here.
    window.location.href = '/login?from=/assistant';
  };

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

  if (error || !branding) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-400 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-white mb-2">Service Unavailable</h1>
          <p className="text-gray-400 mb-4">{error || 'Unable to load. Please try again later.'}</p>
          <button onClick={() => window.location.reload()} className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg transition-colors">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const brandName = branding.businessName || 'AI Personal Assistant';
  const assistantName = branding.assistantName || 'AI Assistant';
  const primaryColor = branding.primaryColor || '#10B981';

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white">
      {/* Navigation */}
      <PANavigation branding={branding} brandName={brandName} primaryColor={primaryColor} onGetStarted={handleGetStarted} onLogin={handleLogin} />

      {/* Hero Section */}
      <PAHeroSection branding={branding} brandName={brandName} assistantName={assistantName} primaryColor={primaryColor} onGetStarted={handleGetStarted} />

      {/* WhatsApp Integration Section */}
      <PAWhatsAppSection primaryColor={primaryColor} assistantName={assistantName} />

      {/* Problem / Solution Comparison */}
      <PAComparisonSection primaryColor={primaryColor} assistantName={assistantName} />

      {/* What You Get Section */}
      <PAWhatYouGetSection primaryColor={primaryColor} assistantName={assistantName} />

      {/* Features Grid */}
      <PAFeaturesSection primaryColor={primaryColor} />

      {/* How It Works */}
      <PAHowItWorksSection primaryColor={primaryColor} />

      {/* Pricing Section */}
      <PAPricingSection primaryColor={primaryColor} onGetStarted={handleGetStarted} />

      {/* Testimonials */}
      <PATestimonialsSection />

      {/* FAQs */}
      <PAFAQsSection primaryColor={primaryColor} />

      {/* CTA Section */}
      <PACTASection primaryColor={primaryColor} assistantName={assistantName} onGetStarted={handleGetStarted} />

      {/* Footer */}
      <PAFooterSection branding={branding} />
    </div>
  );
}

// ─── PA Navigation ──────────────────────────────────────────────────────────

function PANavigation({ branding, brandName, primaryColor, onGetStarted, onLogin }: {
  branding: PABranding; brandName: string; primaryColor: string; onGetStarted: () => void; onLogin: () => void;
}) {
  const getLogoSizeClass = () => {
    switch (branding.logoSize) {
      case 'small': return 'h-8';
      case 'large': return 'h-14';
      case 'extra-large': return 'h-16';
      default: return 'h-10';
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0f1a]/80 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {branding.logo ? (
            <img src={branding.logo} alt={brandName} className={`${getLogoSizeClass()} w-auto object-contain`} />
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
                <FiMessageCircle className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-white">{brandName}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <button onClick={onLogin} className="text-gray-400 hover:text-white text-sm font-medium transition-colors">
            Sign In
          </button>
          <button
            onClick={onGetStarted}
            className="px-5 py-2 text-sm font-semibold text-white rounded-lg transition-all hover:opacity-90"
            style={{ backgroundColor: primaryColor }}
          >
            Get Started
          </button>
        </div>
      </div>
    </nav>
  );
}

// ─── PA Hero Section ─────────────────────────────────────────────────────────

interface PAHeroProps {
  branding: PABranding;
  brandName: string;
  assistantName: string;
  primaryColor: string;
  onGetStarted: () => void;
}

function PAHeroSection({ assistantName, primaryColor, onGetStarted }: PAHeroProps) {
  return (
    <section className="relative overflow-hidden pt-24 pb-16 lg:pt-32 lg:pb-24">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0f1a] via-[#0d1525] to-[#0a0f1a]" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full opacity-20 blur-3xl" style={{ background: `radial-gradient(circle, ${primaryColor}40, transparent 70%)` }} />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Text */}
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-emerald-400 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Your <NameHighlight name={assistantName} color={primaryColor} />, Ready for You
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
              A Personal AI Assistant everyone&apos;s obsessed with
            </h1>
            <p className="text-lg sm:text-xl text-gray-400 mb-8 leading-relaxed max-w-xl">
              Works 24/7, no setup needed. Manage your schedule, automate tasks, and get instant answers — all through WhatsApp.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <motion.button
                onClick={onGetStarted}
                className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white rounded-xl shadow-lg transition-all duration-300"
                style={{ backgroundColor: primaryColor }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="flex items-center gap-1">
                  Get Your <NameHighlight name={assistantName} color="#ffffff" />
                  <FiArrowRight className="ml-1 w-5 h-5" />
                </span>
              </motion.button>
              <p className="text-sm text-gray-500 self-center">Cancel anytime. No setup required.</p>
            </div>
          </motion.div>

          {/* Right: Chat Mockup (dark themed like myclaw) */}
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }} className="hidden lg:block">
            <div className="bg-[#111827] rounded-2xl border border-white/10 shadow-2xl overflow-hidden max-w-md mx-auto">
              {/* Chat header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                  <span className="text-sm font-medium text-white"><NameHighlight name={assistantName} color={primaryColor} /> Dashboard</span>
                </div>
                <span className="text-xs text-emerald-400 font-medium">Online</span>
              </div>
              {/* Chat tabs */}
              <div className="flex gap-4 px-5 py-2 border-b border-white/5 text-xs">
                <span className="text-white font-medium border-b-2 pb-1" style={{ borderColor: primaryColor }}>Chat</span>
                <span className="text-gray-500">Tasks</span>
                <span className="text-gray-500">Memory</span>
                <span className="text-gray-500">Settings</span>
              </div>
              {/* Chat messages */}
              <div className="p-5 space-y-4 min-h-[320px]">
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0" style={{ backgroundColor: primaryColor }}>🤖</div>
                  <div className="bg-white/5 rounded-xl rounded-tl-sm px-4 py-2.5 max-w-[85%]">
                    <p className="text-sm text-gray-300">Good morning! Here&apos;s your briefing: 3 emails need replies, your meeting moved to 2pm. Want me to handle the emails first?</p>
                  </div>
                </div>
                <div className="flex gap-3 justify-end">
                  <div className="rounded-xl rounded-tr-sm px-4 py-2.5 max-w-[85%]" style={{ backgroundColor: `${primaryColor}30` }}>
                    <p className="text-sm text-white">Yes, draft replies. Also block 1hr for deep work today.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0" style={{ backgroundColor: primaryColor }}>🤖</div>
                  <div className="bg-white/5 rounded-xl rounded-tl-sm px-4 py-2.5 max-w-[85%]">
                    <p className="text-sm text-gray-300">Done! ✅ 3 drafts ready. Blocked 3–4pm as &quot;Focus Time.&quot; Also found a scheduling conflict — want me to resolve it?</p>
                  </div>
                </div>
                <div className="flex gap-3 justify-end">
                  <div className="rounded-xl rounded-tr-sm px-4 py-2.5 max-w-[85%]" style={{ backgroundColor: `${primaryColor}30` }}>
                    <p className="text-sm text-white">Yes, resolve it and send me a summary.</p>
                  </div>
                </div>
              </div>
              {/* Chat input */}
              <div className="px-5 py-3 border-t border-white/5">
                <div className="flex items-center gap-3 bg-white/5 rounded-lg px-4 py-2.5">
                  <span className="text-sm text-gray-500">Message your <NameHighlight name={assistantName} color={primaryColor} />…</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─── PA WhatsApp Section ─────────────────────────────────────────────────────

const WA_LOGO_GREEN = '#25D366'; // authentic WhatsApp brand color — logo only

function PAWhatsAppSection({ primaryColor, assistantName }: { primaryColor: string; assistantName: string }) {
  const messages = [
    { from: 'user', text: 'Hey, what do I have on my schedule today?' },
    { from: 'bot',  text: `Hi! I'm ${assistantName} 👋 You have a team standup at 10am, a client call at 2pm, and a dentist appointment at 5pm. Want me to prep a brief for the client call?` },
    { from: 'user', text: 'Yes please, and block 30 min before it.' },
    { from: 'bot',  text: `Done ✅ Brief drafted and 1:30–2pm blocked as "Pre-call Prep". I've also added a reminder 15 min before. Anything else?` },
    { from: 'user', text: 'Reschedule the dentist to Thursday.' },
    { from: 'bot',  text: "On it! I found an opening at 4pm Thursday and sent the reschedule request. You'll get a confirmation shortly. 🦷" },
  ];

  return (
    <section className="py-20 relative overflow-hidden">
      {/* Brand glow — same pattern as PAHeroSection */}
      <div className="absolute top-1/2 right-0 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: `radial-gradient(circle, ${primaryColor}60, transparent 70%)` }} />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* Left: copy */}
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }}>
            {/* Badge — WhatsApp logo stays authentic green, rest uses primaryColor */}
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold mb-6"
              style={{ backgroundColor: `${primaryColor}18`, border: `1px solid ${primaryColor}40`, color: primaryColor }}>
              <svg viewBox="0 0 32 32" className="w-5 h-5 flex-shrink-0" fill={WA_LOGO_GREEN}>
                <path d="M16 1C7.716 1 1 7.716 1 16c0 2.637.691 5.112 1.897 7.253L1 31l7.956-1.87A14.942 14.942 0 0016 31c8.284 0 15-6.716 15-15S24.284 1 16 1zm0 27.25a12.218 12.218 0 01-6.22-1.698l-.446-.265-4.722 1.11 1.13-4.603-.292-.473A12.207 12.207 0 013.75 16C3.75 9.235 9.235 3.75 16 3.75S28.25 9.235 28.25 16 22.765 28.25 16 28.25zm6.698-9.152c-.367-.184-2.17-1.07-2.505-1.192-.336-.122-.58-.184-.824.184-.245.367-.948 1.192-1.162 1.437-.213.244-.428.275-.795.092-.367-.184-1.549-.57-2.951-1.82-1.09-.974-1.826-2.176-2.04-2.543-.213-.367-.023-.565.16-.748.165-.164.367-.428.55-.642.184-.213.245-.367.367-.611.122-.245.061-.459-.031-.642-.092-.184-.824-1.987-1.13-2.72-.297-.714-.6-.617-.824-.628l-.703-.012c-.244 0-.641.092-.977.459-.336.367-1.284 1.253-1.284 3.056s1.315 3.544 1.498 3.788c.184.245 2.588 3.95 6.272 5.54.877.379 1.561.605 2.094.774.88.28 1.682.24 2.315.146.706-.105 2.17-.887 2.476-1.744.306-.857.306-1.591.214-1.744-.091-.153-.336-.245-.703-.428z"/>
              </svg>
              WhatsApp Native
            </div>

            <h2 className="text-3xl sm:text-4xl font-bold text-white leading-tight mb-6">
              Chat with <NameHighlight name={assistantName} color={primaryColor} /> right inside{' '}
              <span className="text-white">WhatsApp</span>
            </h2>
            <p className="text-gray-400 text-lg mb-8 leading-relaxed">
              No new apps. No logins. Just open WhatsApp and start a conversation — <strong className="text-white">{assistantName}</strong> is already there, ready to handle your day.
            </p>

            <ul className="space-y-4">
              {[
                'Schedule meetings with a single message',
                'Get daily briefings every morning',
                'Delegate tasks and get instant confirmations',
                'Works on any phone, anywhere in the world',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-gray-300">
                  <span className="mt-1 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                    style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}>✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Right: phone mockup — same palette as hero chat card */}
          <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.15 }}
            className="flex justify-center lg:justify-end">
            <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-[#111827]">

              {/* Header — dark with brand-coloured avatar, same as hero chat card */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-[#111827]">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: primaryColor }}>
                  {assistantName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{assistantName}</p>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }} />
                    <span className="text-xs" style={{ color: primaryColor }}>online</span>
                  </div>
                </div>
                {/* WhatsApp logo in header — authentic brand color */}
                <svg viewBox="0 0 32 32" className="w-5 h-5 flex-shrink-0" fill={WA_LOGO_GREEN}>
                  <path d="M16 1C7.716 1 1 7.716 1 16c0 2.637.691 5.112 1.897 7.253L1 31l7.956-1.87A14.942 14.942 0 0016 31c8.284 0 15-6.716 15-15S24.284 1 16 1zm0 27.25a12.218 12.218 0 01-6.22-1.698l-.446-.265-4.722 1.11 1.13-4.603-.292-.473A12.207 12.207 0 013.75 16C3.75 9.235 9.235 3.75 16 3.75S28.25 9.235 28.25 16 22.765 28.25 16 28.25zm6.698-9.152c-.367-.184-2.17-1.07-2.505-1.192-.336-.122-.58-.184-.824.184-.245.367-.948 1.192-1.162 1.437-.213.244-.428.275-.795.092-.367-.184-1.549-.57-2.951-1.82-1.09-.974-1.826-2.176-2.04-2.543-.213-.367-.023-.565.16-.748.165-.164.367-.428.55-.642.184-.213.245-.367.367-.611.122-.245.061-.459-.031-.642-.092-.184-.824-1.987-1.13-2.72-.297-.714-.6-.617-.824-.628l-.703-.012c-.244 0-.641.092-.977.459-.336.367-1.284 1.253-1.284 3.056s1.315 3.544 1.498 3.788c.184.245 2.588 3.95 6.272 5.54.877.379 1.561.605 2.094.774.88.28 1.682.24 2.315.146.706-.105 2.17-.887 2.476-1.744.306-.857.306-1.591.214-1.744-.091-.153-.336-.245-.703-.428z"/>
                </svg>
              </div>

              {/* Chat messages — hero palette: user bubbles ${primaryColor}30, bot bubbles bg-white/5 */}
              <div className="p-4 space-y-3 min-h-[360px] bg-[#0a0f1a]">
                {messages.map((msg, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.1 }}
                    className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[82%] rounded-xl px-4 py-2.5 text-sm leading-relaxed shadow"
                      style={msg.from === 'user'
                        ? { backgroundColor: `${primaryColor}30`, color: '#ffffff', borderBottomRightRadius: 4 }
                        : { backgroundColor: 'rgba(255,255,255,0.05)', color: '#d1d5db', borderBottomLeftRadius: 4 }}>
                      {msg.text}
                      <span className="block text-right text-xs mt-1 opacity-40">
                        {['9:01', '9:01', '9:02', '9:02', '9:03', '9:03'][i]}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Input bar */}
              <div className="flex items-center gap-2 px-4 py-3 border-t border-white/5 bg-[#111827]">
                <div className="flex-1 bg-white/5 rounded-lg px-4 py-2 text-sm text-gray-500">
                  Message <NameHighlight name={assistantName} color={primaryColor} />…
                </div>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: primaryColor }}>
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                  </svg>
                </div>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}

// ─── PA Comparison Section (Without vs With) ────────────────────────────────

function PAComparisonSection({ primaryColor, assistantName }: { primaryColor: string; assistantName: string }) {
  const withoutItems = [
    'Drowning in emails and messages',
    'Forgetting meetings and deadlines',
    'Manually scheduling everything',
    'Wasting hours on repetitive tasks',
    'No work-life balance',
  ];
  const withItems = [
    'Inbox managed automatically',
    'Never miss a meeting again',
    'Smart scheduling in seconds',
    'Tasks handled while you sleep',
    'More time for what matters',
  ];

  return (
    <section className="py-20 relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Life Before &amp; After <NameHighlight name={assistantName} color={primaryColor} /></h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">See the difference an AI assistant makes in your daily workflow.</p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Without */}
          <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}
            className="bg-red-500/5 border border-red-500/20 rounded-2xl p-8"
          >
            <h3 className="text-xl font-bold text-red-400 mb-6 flex items-center gap-2"><FiX className="w-5 h-5" /> Without <span className="font-extrabold text-red-300">{assistantName}</span></h3>
            <ul className="space-y-4">
              {withoutItems.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-gray-400">
                  <FiX className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* With */}
          <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}
            className="border rounded-2xl p-8" style={{ backgroundColor: `${primaryColor}08`, borderColor: `${primaryColor}30` }}
          >
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2" style={{ color: primaryColor }}><FiCheck className="w-5 h-5" /> With <span className="font-extrabold">{assistantName}</span></h3>
            <ul className="space-y-4">
              {withItems.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-gray-300">
                  <FiCheck className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: primaryColor }} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─── PA What You Get Section ─────────────────────────────────────────────────

function PAWhatYouGetSection({ primaryColor, assistantName }: { primaryColor: string; assistantName: string }) {
  const benefits = [
    { icon: FiCalendar, title: 'Smart Scheduling', desc: 'Manages your calendar, books meetings, and resolves conflicts automatically.' },
    { icon: FiMail, title: 'Email Management', desc: 'Drafts replies, summarizes threads, and flags what needs your attention.' },
    { icon: FiFileText, title: 'Document Assistant', desc: 'Summarizes documents, extracts key info, and helps you draft content.' },
    { icon: FiTrendingUp, title: 'Business Insights', desc: 'Tracks your KPIs, generates reports, and surfaces actionable insights.' },
    { icon: FiUsers, title: 'Client Management', desc: 'Remembers client preferences, follows up automatically, and keeps relationships warm.' },
    { icon: FiGlobe, title: 'Available 24/7', desc: 'Works around the clock across time zones. Never takes a day off.' },
  ];

  return (
    <section className="py-20 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">What You Get with <NameHighlight name={assistantName} color={primaryColor} /></h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">Everything you need to 10x your productivity, all through WhatsApp.</p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {benefits.map((b, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: i * 0.08 }}
              className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 hover:bg-white/[0.06] transition-all group"
            >
              <div className="w-11 h-11 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: `${primaryColor}15` }}>
                <b.icon className="w-5 h-5" style={{ color: primaryColor }} />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{b.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{b.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── PA Features Section ─────────────────────────────────────────────────────

function PAFeaturesSection({ primaryColor }: { primaryColor: string }) {
  const features = [
    { icon: FiMessageCircle, label: 'WhatsApp Native' },
    { icon: FiShield, label: 'Enterprise Security' },
    { icon: FiZap, label: 'Instant Responses' },
    { icon: FiClock, label: '24/7 Availability' },
    { icon: FiHeadphones, label: 'Voice & Text' },
    { icon: FiGlobe, label: 'Multi-language' },
  ];

  return (
    <section className="py-16 border-y border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {features.map((f, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.05 }}
              className="flex flex-col items-center gap-3 py-4"
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${primaryColor}15` }}>
                <f.icon className="w-5 h-5" style={{ color: primaryColor }} />
              </div>
              <span className="text-sm text-gray-400 font-medium text-center">{f.label}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── PA How It Works Section ─────────────────────────────────────────────────

function PAHowItWorksSection({ primaryColor }: { primaryColor: string }) {
  const steps = [
    { step: '01', title: 'Sign Up & Tell Us About You', description: 'Quick 2-minute setup. Share your name and what you need help with.' },
    { step: '02', title: 'Customize Your Assistant', description: 'Train it with your preferences, documents, and workflows.' },
    { step: '03', title: 'Start Chatting on WhatsApp', description: 'Your AI assistant is ready. Just send a message and watch the magic.' },
  ];

  return (
    <section className="py-20 relative">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Up and Running in 3 Minutes</h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">No technical skills needed. No complicated setup.</p>
        </motion.div>

        <div className="space-y-8">
          {steps.map((item, index) => (
            <motion.div key={index} initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: index * 0.15 }}
              className="flex items-start gap-6 bg-white/[0.03] border border-white/[0.06] rounded-xl p-6"
            >
              <div className="text-3xl font-bold flex-shrink-0 w-14 text-center" style={{ color: primaryColor }}>{item.step}</div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-gray-400">{item.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}


// ─── PA Pricing Section ──────────────────────────────────────────────────────

function PAPricingSection({ primaryColor, onGetStarted }: { primaryColor: string; onGetStarted: () => void }) {
  interface DisplayTier {
    name: string;
    displayName: string;
    price: number;
    currency: string;
    interval: 'month' | 'year';
    description: string;
    features: string[];
    highlighted: boolean;
    highlightLabel?: string;
  }

  const defaultTiers: DisplayTier[] = [
    {
      name: 'Lite',
      displayName: 'Lite',
      price: 1900,
      currency: 'usd',
      interval: 'month',
      description: 'Perfect for getting started with your AI assistant.',
      features: ['WhatsApp AI Assistant', 'Smart scheduling', 'Email summaries', 'Basic task management', 'Standard response time'],
      highlighted: false,
      highlightLabel: '',
    },
    {
      name: 'Pro',
      displayName: 'Pro',
      price: 3900,
      currency: 'usd',
      interval: 'month',
      description: 'For professionals who want the full AI experience.',
      features: ['Everything in Lite', 'Dedicated assistant', 'Priority responses', 'Document analysis', 'Custom workflows', 'Advanced integrations'],
      highlighted: true,
      highlightLabel: 'MOST POPULAR',
    },
  ];

  const [tiers, setTiers] = useState(defaultTiers);

  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const res = await fetch('/api/whitelabel/experience-pricing/assistant');
        if (res.ok) {
          const data = await res.json();
          if (data.tiers && data.tiers.length > 0) {
            setTiers(data.tiers);
          }
        }
      } catch {
        // Use default tiers on error
      }
    };
    fetchPricing();
  }, []);

  const formatPrice = (price: number, currency: string) => {
    const symbol = currency === 'eur' ? '€' : currency === 'gbp' ? '£' : currency === 'inr' ? '₹' : '$';
    return `${symbol}${(price / 100).toFixed(price % 100 === 0 ? 0 : 2)}`;
  };

  return (
    <section className="py-20 relative">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Simple, Transparent Pricing</h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">Choose the plan that fits your needs. Cancel anytime.</p>
        </motion.div>

        <div className={`grid gap-8 max-w-3xl mx-auto ${tiers.length === 1 ? 'md:grid-cols-1 max-w-md' : tiers.length >= 3 ? 'md:grid-cols-3 max-w-5xl' : 'md:grid-cols-2'}`}>
          {tiers.map((tier, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: i * 0.15 }}
              className={`relative rounded-2xl p-8 ${tier.highlighted ? 'border-2' : 'border border-white/10 bg-white/[0.03]'}`}
              style={tier.highlighted ? { borderColor: primaryColor, backgroundColor: `${primaryColor}08` } : {}}
            >
              {tier.highlighted && tier.highlightLabel && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white" style={{ backgroundColor: primaryColor }}>
                  {tier.highlightLabel}
                </div>
              )}
              <h3 className="text-xl font-bold text-white mb-2">{tier.displayName || tier.name}</h3>
              <p className="text-gray-400 text-sm mb-6">{tier.description}</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-white">{formatPrice(tier.price, tier.currency || 'usd')}</span>
                <span className="text-gray-500">/{tier.interval === 'year' ? 'year' : 'month'}</span>
              </div>
              <ul className="space-y-3 mb-8">
                {tier.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-3 text-sm text-gray-300">
                    <FiCheck className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: primaryColor }} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={onGetStarted}
                className={`w-full py-3 px-6 font-semibold rounded-xl transition-all ${tier.highlighted ? 'text-white hover:opacity-90' : 'text-white bg-white/10 hover:bg-white/15'}`}
                style={tier.highlighted ? { backgroundColor: primaryColor } : {}}
              >
                Get Started
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── PA Testimonials Section ─────────────────────────────────────────────────

function PATestimonialsSection() {
  const testimonials = [
    { name: 'Sarah K.', role: 'Freelance Consultant', content: 'I used to spend 2 hours a day on emails alone. Now my assistant handles it in minutes. Game changer.', avatar: '👩‍💼' },
    { name: 'Marcus T.', role: 'Startup Founder', content: 'It\'s like having a chief of staff who never sleeps. Scheduling, follow-ups, research — all handled.', avatar: '👨‍💻' },
    { name: 'Priya M.', role: 'Real Estate Agent', content: 'My clients are impressed by how fast I respond now. They don\'t know it\'s my AI assistant doing the heavy lifting!', avatar: '👩‍🏫' },
  ];

  return (
    <section className="py-20 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Loved by Professionals</h2>
          <p className="text-gray-400 text-lg">See what people are saying about their AI assistant.</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: i * 0.1 }}
              className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-lg">{t.avatar}</div>
                <div>
                  <p className="font-semibold text-white text-sm">{t.name}</p>
                  <p className="text-xs text-gray-500">{t.role}</p>
                </div>
              </div>
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: 5 }).map((_, j) => (
                  <FiStar key={j} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                ))}
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">&ldquo;{t.content}&rdquo;</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── PA FAQs Section ─────────────────────────────────────────────────────────

function PAFAQsSection({ primaryColor: _primaryColor }: { primaryColor: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    { question: 'How does the AI assistant work?', answer: 'Your AI assistant connects through WhatsApp. Simply send a message and it will respond instantly — managing your schedule, drafting emails, answering questions, and more.' },
    { question: 'Do I need any technical skills?', answer: 'Not at all! If you can send a WhatsApp message, you can use your AI assistant. Setup takes less than 3 minutes.' },
    { question: 'Is my data secure?', answer: 'Absolutely. We use enterprise-grade encryption and never share your data with third parties. Your conversations are private and secure.' },
    { question: 'Can I cancel anytime?', answer: 'Yes, you can cancel your subscription at any time with no questions asked. No long-term contracts or hidden fees.' },
    { question: 'What\'s the difference between Lite and Pro?', answer: 'Lite gives you a shared AI assistant with core features. Pro gives you a dedicated assistant with priority responses, advanced integrations, and custom workflows tailored to your needs.' },
  ];

  return (
    <section className="py-20 relative">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Frequently Asked Questions</h2>
        </motion.div>

        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <motion.div key={index} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: index * 0.05 }}
              className="border border-white/10 rounded-xl overflow-hidden bg-white/[0.02]"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/[0.03] transition-colors"
              >
                <span className="font-medium text-white">{faq.question}</span>
                {openIndex === index ? (
                  <FiChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0" />
                ) : (
                  <FiChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />
                )}
              </button>
              {openIndex === index && (
                <div className="px-6 pb-4">
                  <p className="text-gray-400 leading-relaxed text-sm">{faq.answer}</p>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── PA CTA Section ──────────────────────────────────────────────────────────

function PACTASection({ primaryColor, assistantName, onGetStarted }: { primaryColor: string; assistantName: string; onGetStarted: () => void }) {
  return (
    <section className="py-20 relative">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="relative rounded-2xl overflow-hidden p-12 sm:p-16" style={{ background: `linear-gradient(135deg, ${primaryColor}20, ${primaryColor}05)` }}>
          <div className="absolute inset-0 border rounded-2xl" style={{ borderColor: `${primaryColor}30` }} />
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="relative">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Ready to Get Your <NameHighlight name={assistantName} color={primaryColor} />?</h2>
            <p className="text-gray-400 text-lg mb-8 max-w-xl mx-auto">Join thousands of professionals who are already saving hours every day with their AI assistant.</p>
            <motion.button
              onClick={onGetStarted}
              className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white rounded-xl transition-all"
              style={{ backgroundColor: primaryColor }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
            >
              Get Started Now
              <FiArrowRight className="ml-2 w-5 h-5" />
            </motion.button>
            <p className="text-sm text-gray-500 mt-4">No credit card required. Cancel anytime.</p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─── PA Footer Section ───────────────────────────────────────────────────────

function PAFooterSection({ branding }: { branding: PABranding }) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-white/5 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              {branding.logo ? (
                <img src={branding.logo} alt={branding.businessName} className="h-8 w-auto object-contain" />
              ) : (
                <span className="text-lg font-bold text-white">{branding.businessName}</span>
              )}
            </div>
            <p className="text-gray-500 text-sm">Your AI-powered personal assistant, available 24/7 on WhatsApp.</p>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold text-white mb-4 text-sm">Contact</h3>
            <div className="space-y-2 text-sm text-gray-500">
              {branding.supportEmail && (
                <div className="flex items-center gap-2"><FiMail className="w-4 h-4" />{branding.supportEmail}</div>
              )}
              {branding.companyPhone && (
                <div className="flex items-center gap-2"><FiPhone className="w-4 h-4" />{branding.companyPhone}</div>
              )}
              {branding.companyAddress && (
                <div className="flex items-center gap-2"><FiMapPin className="w-4 h-4" />{branding.companyAddress}</div>
              )}
            </div>
          </div>

          {/* Legal & Social */}
          <div>
            <h3 className="font-semibold text-white mb-4 text-sm">Legal</h3>
            <div className="space-y-2 text-sm text-gray-500">
              {branding.privacyPolicyUrl && <a href={branding.privacyPolicyUrl} className="block hover:text-white transition-colors">Privacy Policy</a>}
              {branding.termsOfServiceUrl && <a href={branding.termsOfServiceUrl} className="block hover:text-white transition-colors">Terms of Service</a>}
            </div>
            {(branding.twitterUrl || branding.linkedinUrl || branding.facebookUrl || branding.instagramUrl) && (
              <div className="flex gap-3 mt-4">
                {branding.twitterUrl && <a href={branding.twitterUrl} className="text-gray-500 hover:text-white transition-colors"><FiTwitter className="w-5 h-5" /></a>}
                {branding.linkedinUrl && <a href={branding.linkedinUrl} className="text-gray-500 hover:text-white transition-colors"><FiLinkedin className="w-5 h-5" /></a>}
                {branding.facebookUrl && <a href={branding.facebookUrl} className="text-gray-500 hover:text-white transition-colors"><FiFacebook className="w-5 h-5" /></a>}
                {branding.instagramUrl && <a href={branding.instagramUrl} className="text-gray-500 hover:text-white transition-colors"><FiInstagram className="w-5 h-5" /></a>}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-white/5 mt-8 pt-8 text-center text-sm text-gray-600">
          © {currentYear} {branding.businessName}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}