'use client';

import { useEffect, useState } from 'react';
import {
  FiZap, FiMessageCircle, FiClock, FiUsers, FiShield, FiTrendingUp,
  FiCheck, FiX, FiArrowRight, FiChevronDown, FiChevronUp,
} from 'react-icons/fi';
import { PartnerBranding } from '@/types/partner';

interface OCBranding extends PartnerBranding {
  assistantName?: string;
  calendarUrl?: string;
}

interface PricingTier {
  name: string;
  displayName: string;
  description: string;
  price: number;
  currency: string;
  interval: string;
  features: string[];
  highlighted?: boolean;
  highlightLabel?: string;
  stripePriceId?: string;
}

// ── Colour tokens ─────────────────────────────────────────────────────────────
const OC = '#00C4B4';
const OC_DARK = '#009E90';
const ORANGE = '#F97316';

// ── Small reusable helpers ────────────────────────────────────────────────────
function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ border: `1px solid rgba(0,196,180,0.3)`, background: 'rgba(0,196,180,0.12)' }}
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full text-[#00C4B4]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#00C4B4] animate-pulse" />
      {children}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-bold tracking-widest uppercase text-[#00C4B4] mb-2">{children}</p>;
}

function GradientText({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ background: `linear-gradient(135deg, ${OC} 0%, ${ORANGE} 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
      {children}
    </span>
  );
}

function formatPrice(price: number, currency: string) {
  const symbol = currency === 'eur' ? '€' : currency === 'gbp' ? '£' : currency === 'inr' ? '₹' : '$';
  return `${symbol}${(price / 100).toFixed(price % 100 === 0 ? 0 : 2)}`;
}

// ── Default content ────────────────────────────────────────────────────────────
const DEFAULT_FEATURES = [
  { icon: FiUsers, title: 'Full AI Team Setup', description: 'We build and configure your complete AI team — each specialist with a defined role and deep knowledge of your business.' },
  { icon: FiMessageCircle, title: 'WhatsApp, Email & More', description: 'Your AI team lives in the tools you already use — WhatsApp, Slack, Email, Telegram, and more.' },
  { icon: FiZap, title: 'Actually Takes Action', description: 'Not just chat — your AI sends emails, books meetings, posts content, and follows up on leads automatically.' },
  { icon: FiClock, title: '24/7 Operation', description: 'Leads at midnight? Customers on weekends? Your AI team never sleeps, never takes a day off.' },
  { icon: FiShield, title: 'Built Around YOUR Business', description: 'Every AI team member is trained on your knowledge, voice, and preferences — not a generic template.' },
  { icon: FiTrendingUp, title: 'Live in 48 Hours', description: 'From discovery call to a live AI team in under 48 hours. No lengthy setup, no technical headaches.' },
];

const DEFAULT_TESTIMONIALS = [
  { name: 'Marcus Webb', role: 'Agency Owner, London', content: 'I sold 3 AI team setups in the first week. My clients are blown away by what\'s possible.', rating: 5, initials: 'MW' },
  { name: 'Priya Sharma', role: 'E-commerce Founder', content: 'The AI handles 80% of our customer support and all social scheduling. It paid for itself in 10 days.', rating: 5, initials: 'PS' },
  { name: 'Tom Callahan', role: 'Real Estate Broker', content: 'ARIA — our AI Chief of Staff — coordinates our entire outreach pipeline. I\'ve saved 30+ hours a week.', rating: 5, initials: 'TC' },
];

const DEFAULT_FAQS = [
  { q: 'What is included in the AI team setup?', a: 'We configure a suite of AI specialists tailored to your business — typically a Chief of Staff, Sales Assistant, Customer Support Agent, Social Media Manager, and Operations Coordinator. The exact team depends on your needs.' },
  { q: 'How long does setup take?', a: 'Most AI teams go live within 48 hours of your discovery call. We handle all the technical setup — you just need to answer a few questions about your business.' },
  { q: 'What tools do the AI agents work in?', a: 'Your AI team integrates with tools you already use: WhatsApp, Email, Slack, Telegram, Google Calendar, Notion, and many more. No new apps to learn.' },
  { q: 'Is my business data secure?', a: 'Yes. Your AI team runs on a private system — your data is never shared with other businesses or used to train generic AI models.' },
  { q: 'Can I upgrade or add more AI team members later?', a: 'Absolutely. Start with a core team and expand as your business grows. Additional specialists can be added at any time.' },
];

const DEFAULT_TIERS: PricingTier[] = [
  { name: 'starter', displayName: 'Starter', description: 'For solopreneurs and small teams getting started with AI.', price: 49700, currency: 'gbp', interval: 'month', features: ['AI Chief of Staff (ARIA)', '2 AI team specialists', 'WhatsApp & Email integration', 'Setup & onboarding call', '30-day support'] },
  { name: 'growth', displayName: 'Growth', description: 'For growing businesses that need a full AI workforce.', price: 99700, currency: 'gbp', interval: 'month', features: ['AI Chief of Staff (ARIA)', '5 AI team specialists', 'All channel integrations', 'Priority setup (24h)', 'Dedicated account manager', '90-day support & tuning'], highlighted: true, highlightLabel: 'MOST POPULAR' },
  { name: 'enterprise', displayName: 'Enterprise', description: 'Custom AI organization for established businesses.', price: 199700, currency: 'gbp', interval: 'month', features: ['Unlimited AI team members', 'Custom channel integrations', 'White-label option', 'Same-day setup', 'Ongoing AI management', 'Monthly strategy reviews'] },
];

// ── OCLoader ──────────────────────────────────────────────────────────────────
function OCLoader() {
  return (
    <div style={{ background: '#070910', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, border: `3px solid rgba(0,196,180,0.2)`, borderTopColor: OC, borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: '#7A7A9A', fontSize: 14 }}>Loading...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

// ── OCNav ─────────────────────────────────────────────────────────────────────
function OCNav({ branding, brandName, primaryColor, onGetBlueprint }: { branding: OCBranding | null; brandName: string; primaryColor: string; onGetBlueprint: () => void }) {
  return (
    <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200, background: 'rgba(7,9,16,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0 24px' }}>
      <div className="oc-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {branding?.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logo} alt={brandName} style={{ height: 36, objectFit: 'contain' }} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em', color: '#E8EAF0', cursor: 'pointer' }}>
              <svg width="36" height="36" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="38" height="38" rx="10" fill="#0D0E1A"/>
                <path d="M10 28 C9 24 11 19 14 15 C16 12 18.5 11 18.5 11" stroke={OC} strokeWidth="2.4" strokeLinecap="round"/>
                <path d="M18.5 28 C18 23 19.5 18 21 15 C22 12.5 18.5 11 18.5 11" stroke={OC} strokeWidth="2.4" strokeLinecap="round"/>
                <path d="M27 28 C28.5 24 27 19 24 15 C22 12 18.5 11 18.5 11" stroke={OC} strokeWidth="2.4" strokeLinecap="round"/>
                <circle cx="18.5" cy="8.5" r="2.5" fill={OC}/>
                <path d="M7 11 L7 19 M7 15 L11.5 11 M7 15 L11.5 19" stroke={ORANGE} strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
              <span>Kno<span style={{ color: primaryColor }}>Claw</span></span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }} className="oc-nav-links">
          {[['#pain', 'Pain Points'], ['#features', 'Features'], ['#pricing', 'Pricing'], ['#faq', 'FAQ']].map(([href, label]) => (
            <a key={href} href={href} style={{ color: '#7A7A9A', textDecoration: 'none', fontSize: 14, fontWeight: 500, transition: 'color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.color = OC)}
              onMouseLeave={e => (e.currentTarget.style.color = '#7A7A9A')}>{label}</a>
          ))}
        </div>
        <button className="oc-btn-primary" onClick={onGetBlueprint} style={{ padding: '9px 20px', fontSize: 13 }}>
          Get Free Blueprint →
        </button>
      </div>
    </nav>
  );
}

// ── OCHero ────────────────────────────────────────────────────────────────────
function OCHero({ onGetBlueprint }: { onGetBlueprint: () => void }) {
  return (
    <section style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', paddingTop: 80, background: `radial-gradient(ellipse 90% 55% at 50% -5%, rgba(0,196,180,0.1) 0%, transparent 65%), radial-gradient(ellipse 40% 30% at 90% 85%, rgba(249,115,22,0.07) 0%, transparent 60%), #070910` }} id="home">
      <div className="oc-wrap" style={{ padding: '80px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'center' }}>
        <div>
          <div style={{ marginBottom: 18 }}><Badge>Used by growing businesses worldwide</Badge></div>
          <h1 className="oc-sg" style={{ fontSize: 'clamp(32px, 4.5vw, 54px)', fontWeight: 800, lineHeight: 1.08, marginBottom: 20, letterSpacing: '-0.03em' }}>
            Stop Doing Everything Yourself.<br />Get a <GradientText>Full AI Team</GradientText> Working 24/7.
          </h1>
          <p style={{ fontSize: 18, color: '#7A7A9A', marginBottom: 32, lineHeight: 1.8 }}>
            Imagine having a Marketing Manager, Sales Assistant, Customer Support rep, and Operations coordinator — all working around the clock, knowing your business inside out.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
            <button className="oc-btn-orange" onClick={onGetBlueprint} style={{ padding: '14px 32px', fontSize: 16 }}>Get My FREE AI Blueprint 🗺️</button>
            <a href="#features" className="oc-btn-ghost" style={{ padding: '14px 32px', fontSize: 16, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>See Features</a>
          </div>
          <div style={{ background: 'linear-gradient(135deg, rgba(0,196,180,0.12), rgba(249,115,22,0.08))', border: '1px solid rgba(0,196,180,0.25)', borderRadius: 14, padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${OC}, ${OC_DARK})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🗺️</div>
              <div>
                <h4 className="oc-sg" style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>Free AI Business Blueprint — Worth £500</h4>
                <p style={{ fontSize: 12, color: '#7A7A9A', margin: 0 }}>Tell us about your business. We research it overnight and build your personalised AI team plan — zero cost, zero obligation.</p>
              </div>
            </div>
            <button className="oc-btn-primary" onClick={onGetBlueprint} style={{ padding: '10px 20px', fontSize: 13, whiteSpace: 'nowrap' }}>Claim Free Blueprint →</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}>
            {['No technical knowledge needed', 'Tool-agnostic — we find what fits YOU', 'Works on WhatsApp, email & more', 'Your data stays 100% private'].map(t => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#7A7A9A' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: OC, flexShrink: 0, display: 'inline-block' }} />{t}
              </div>
            ))}
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <div style={{ background: '#121322', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: 22, boxShadow: '0 40px 80px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 14 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: `linear-gradient(135deg, ${OC}, ${OC_DARK})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🤖</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>ARIA — Your AI Chief of Staff</div>
                <div style={{ fontSize: 10, color: OC }}>● Online now</div>
              </div>
            </div>
            {[
              { from: 'ARIA', text: 'Good morning! 🌅 3 new leads, 2 tickets resolved, newsletter draft ready.', me: false },
              { from: 'You', text: 'Great — follow up with those leads and schedule social posts.', me: true },
              { from: 'ARIA → Sales + Social', text: 'On it! ✅ Delegating to Sarah (Sales) and Marco (Social). Done within the hour.', me: false },
            ].map((msg, i) => (
              <div key={i} style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', alignItems: msg.me ? 'flex-end' : 'flex-start' }}>
                <div style={{ fontSize: 10, color: '#4A4A6A', marginBottom: 4, fontFamily: "'DM Mono', monospace" }}>{msg.from}</div>
                <div style={{ padding: '9px 13px', borderRadius: 12, fontSize: 13, lineHeight: 1.55, maxWidth: '88%', ...(msg.me ? { background: `linear-gradient(135deg, ${OC}, ${OC_DARK})`, color: '#070910', fontWeight: 500 } : { background: '#181830', border: '1px solid rgba(255,255,255,0.07)', color: '#E8EAF0' }) }}>
                  {msg.text}
                </div>
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 12 }}>
              {[['24/7', 'Always on'], ['5+', 'Team members'], ['48h', 'Go live']].map(([v, l]) => (
                <div key={l} style={{ background: '#181830', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: OC }}>{v}</div>
                  <div style={{ fontSize: 10, color: '#4A4A6A' }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── OCStrip ───────────────────────────────────────────────────────────────────
function OCStrip() {
  const items = ['📱 WhatsApp', '✈️ Telegram', '💬 Slack', '🎮 Discord', '📧 Email', '📅 Calendar', '📊 Google Sheets', '📝 Notion'];
  return (
    <div style={{ background: '#0D0E1A', borderTop: '1px solid rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '20px 0' }}>
      <div className="oc-wrap" style={{ display: 'flex', justifyContent: 'center', gap: 32, flexWrap: 'wrap' }}>
        {items.map(i => <div key={i} style={{ fontSize: 12.5, fontWeight: 600, color: '#4A4A6A' }}>{i}</div>)}
      </div>
    </div>
  );
}

// ── OCPainPoints ──────────────────────────────────────────────────────────────
function OCPainPoints() {
  const pains = [
    { icon: '⏰', title: "You're the bottleneck", desc: "Every question, every follow-up needs you. Your business can't grow because it runs through your head — and your evenings." },
    { icon: '🔄', title: 'Repetitive tasks eat your day', desc: 'Answering the same 10 customer questions, manually sending follow-ups, updating spreadsheets — skilled work on unskilled tasks.' },
    { icon: '💸', title: 'Hiring is expensive and risky', desc: 'A full-time assistant costs £30–60K/year. Part-timers are unreliable. There\'s a gap between DIY and building a real team.' },
    { icon: '😴', title: 'Your business sleeps when you do', desc: 'Leads enquire at midnight. Without someone always on, you\'re losing business to competitors who respond faster.' },
    { icon: '🧩', title: "Your tools don't talk to each other", desc: 'Your calendar, email, CRM, social media — each lives in its own world. You\'re the human glue. That\'s exhausting.' },
    { icon: '📉', title: 'Good leads fall through the cracks', desc: 'A lead fills in your form. You get busy. Three days later you remember — but they\'ve already gone with someone who replied first.' },
  ];
  return (
    <section className="oc-section" id="pain" style={{ background: '#0D0E1A' }}>
      <div className="oc-wrap">
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <SectionLabel>The Problem</SectionLabel>
          <h2 className="oc-sg" style={{ fontSize: 'clamp(24px, 3.5vw, 40px)', fontWeight: 700, lineHeight: 1.15, marginBottom: 14, letterSpacing: '-0.025em' }}>
            Most business owners are doing<br /><span style={{ color: '#F43F5E' }}>jobs that AI should handle.</span>
          </h2>
          <p style={{ fontSize: 17, color: '#7A7A9A', maxWidth: 560, margin: '0 auto', lineHeight: 1.8 }}>You started your business to do meaningful work. Not to answer the same questions on repeat, chase invoices, or manually post on social media every day.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
          {pains.map(p => (
            <div key={p.title} className="oc-card" style={{ padding: 26, transition: 'all 0.3s', cursor: 'default' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(244,63,94,0.3)'; (e.currentTarget as HTMLElement).style.background = 'rgba(244,63,94,0.03)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{p.icon}</div>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 7 }}>{p.title}</h3>
              <p style={{ fontSize: 13, color: '#7A7A9A', lineHeight: 1.65, margin: 0 }}>{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── OCComparison ──────────────────────────────────────────────────────────────
function OCComparison() {
  const bads = ['A chatbot that answers generic questions', 'No memory — explains itself every session', "Doesn't connect to your tools or channels", "Can't take action — only gives text answers", 'Off when you\'re offline', 'Everyone uses the same generic version'];
  const goods = ['A real team of specialists, each with a defined job', 'Remembers your business, clients, and preferences', 'Lives in WhatsApp, email, Slack — wherever you work', 'Actually sends emails, posts content, books meetings', 'Works 24/7 without needing you to be there', 'Built specifically around your business and voice'];
  return (
    <section className="oc-section" style={{ background: '#0D0E1A' }} id="vs">
      <div className="oc-wrap">
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <SectionLabel>The Shift</SectionLabel>
          <h2 className="oc-sg" style={{ fontSize: 'clamp(24px, 3.5vw, 40px)', fontWeight: 700, lineHeight: 1.15, marginBottom: 14, letterSpacing: '-0.025em' }}>
            This isn&apos;t a chatbot.<br />It&apos;s your <GradientText>AI-powered workforce.</GradientText>
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 14, padding: 28 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16, color: '#F43F5E' }}>❌ What you get from typical AI tools</div>
            {bads.map(t => <div key={t} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 14, padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.07)', color: '#7A7A9A', lineHeight: 1.5 }}><span>😶</span>{t}</div>)}
          </div>
          <div style={{ background: 'rgba(0,196,180,0.05)', border: `1px solid rgba(0,196,180,0.25)`, borderRadius: 14, padding: 28 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16, color: OC }}>✅ What we build for you</div>
            {goods.map(t => <div key={t} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 14, padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.07)', color: '#7A7A9A', lineHeight: 1.5 }}><span>🌟</span>{t}</div>)}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── OCFeatures ────────────────────────────────────────────────────────────────
function OCFeatures() {
  return (
    <section className="oc-section" id="features" style={{ background: '#070910' }}>
      <div className="oc-wrap">
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <SectionLabel>What You Get</SectionLabel>
          <h2 className="oc-sg" style={{ fontSize: 'clamp(24px, 3.5vw, 40px)', fontWeight: 700, lineHeight: 1.15, marginBottom: 14, letterSpacing: '-0.025em' }}>
            Everything you need, <GradientText>nothing you don&apos;t.</GradientText>
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {DEFAULT_FEATURES.map(f => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="oc-card" style={{ padding: 24, display: 'flex', gap: 16, alignItems: 'flex-start', transition: 'all 0.3s', cursor: 'default' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,196,180,0.3)'; (e.currentTarget as HTMLElement).style.background = 'rgba(0,196,180,0.04)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}>
                <div style={{ width: 44, height: 44, borderRadius: 11, background: 'rgba(0,196,180,0.12)', border: `1px solid rgba(0,196,180,0.22)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon style={{ width: 20, height: 20, color: OC }} />
                </div>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 5 }}>{f.title}</h3>
                  <p style={{ fontSize: 13, color: '#7A7A9A', lineHeight: 1.65, margin: 0 }}>{f.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── OCPricing ─────────────────────────────────────────────────────────────────
function OCPricing({ tiers, onGetBlueprint }: { tiers: PricingTier[]; onGetBlueprint: () => void }) {
  return (
    <section className="oc-section" id="pricing" style={{ background: '#070910' }}>
      <div className="oc-wrap">
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <SectionLabel>Investment</SectionLabel>
          <h2 className="oc-sg" style={{ fontSize: 'clamp(24px, 3.5vw, 40px)', fontWeight: 700, lineHeight: 1.15, marginBottom: 14, letterSpacing: '-0.025em' }}>
            Simple, transparent pricing.
          </h2>
          <p style={{ fontSize: 17, color: '#7A7A9A', maxWidth: 540, margin: '0 auto', lineHeight: 1.8 }}>One setup fee + monthly retainer. No hidden costs. Cancel anytime.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {tiers.map(tier => (
            <div key={tier.name} style={{ background: tier.highlighted ? 'linear-gradient(160deg, rgba(0,196,180,0.08) 0%, rgba(255,255,255,0.02) 100%)' : 'rgba(255,255,255,0.02)', border: `1px solid ${tier.highlighted ? OC : 'rgba(255,255,255,0.07)'}`, borderRadius: 16, padding: 30, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', transition: 'all 0.3s', ...(tier.highlighted ? { boxShadow: `0 0 48px rgba(0,196,180,0.12)` } : {}) }}
              onMouseEnter={e => { if (!tier.highlighted) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,196,180,0.3)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = tier.highlighted ? OC : 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}>
              {tier.highlightLabel && (
                <div style={{ position: 'absolute', top: 14, right: 14, background: OC, color: '#070910', fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 100, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{tier.highlightLabel}</div>
              )}
              <div style={{ fontSize: 12, fontWeight: 700, color: OC, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>{tier.displayName}</div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", marginBottom: 6 }}>
                <span style={{ fontSize: 40, fontWeight: 800 }}>{formatPrice(tier.price, tier.currency)}</span>
                <span style={{ fontSize: 14, color: '#7A7A9A' }}>/{tier.interval}</span>
              </div>
              <p style={{ fontSize: 13, color: '#7A7A9A', marginBottom: 22, lineHeight: 1.65 }}>{tier.description}</p>
              <ul style={{ listStyle: 'none', flex: 1, marginBottom: 26, padding: 0 }}>
                {tier.features.map(f => (
                  <li key={f} style={{ fontSize: 13, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'flex-start', gap: 8, color: '#7A7A9A', lineHeight: 1.5 }}>
                    <FiCheck style={{ color: OC, flexShrink: 0, marginTop: 2 }} />{f}
                  </li>
                ))}
              </ul>
              <button className={tier.highlighted ? 'oc-btn-primary' : 'oc-btn-ghost'} onClick={onGetBlueprint} style={{ width: '100%', padding: '12px 0', fontSize: 14, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                Get Started <FiArrowRight />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── OCTestimonials ────────────────────────────────────────────────────────────
function OCTestimonials() {
  return (
    <section className="oc-section" style={{ background: '#0D0E1A' }}>
      <div className="oc-wrap">
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <SectionLabel>Social Proof</SectionLabel>
          <h2 className="oc-sg" style={{ fontSize: 'clamp(24px, 3.5vw, 40px)', fontWeight: 700, lineHeight: 1.15, marginBottom: 14, letterSpacing: '-0.025em' }}>
            Businesses already running on AI.
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
          {DEFAULT_TESTIMONIALS.map(t => (
            <div key={t.name} className="oc-card" style={{ padding: 26 }}>
              <div style={{ color: '#F59E0B', fontSize: 14, marginBottom: 12 }}>{'★'.repeat(t.rating)}</div>
              <p style={{ fontSize: 14, color: '#7A7A9A', lineHeight: 1.8, marginBottom: 18, fontStyle: 'italic' }}>&ldquo;{t.content}&rdquo;</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: `linear-gradient(135deg, ${OC}, ${ORANGE})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'white', fontSize: 14 }}>{t.initials}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: '#4A4A6A' }}>{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── OCFaq ─────────────────────────────────────────────────────────────────────
function OCFaq({ openFaq, setOpenFaq }: { openFaq: number | null; setOpenFaq: (i: number | null) => void }) {
  return (
    <section className="oc-section" id="faq" style={{ background: '#070910' }}>
      <div className="oc-wrap">
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <SectionLabel>FAQ</SectionLabel>
          <h2 className="oc-sg" style={{ fontSize: 'clamp(24px, 3.5vw, 40px)', fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.025em' }}>Common questions.</h2>
        </div>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          {DEFAULT_FAQS.map((faq, i) => (
            <div key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{ width: '100%', background: 'none', border: 'none', color: openFaq === i ? OC : '#E8EAF0', fontSize: 15, fontWeight: 500, padding: '20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', textAlign: 'left', fontFamily: "'Inter', sans-serif", gap: 16, transition: 'color 0.2s' }}>
                {faq.q}
                {openFaq === i ? <FiChevronUp style={{ color: OC, flexShrink: 0 }} /> : <FiChevronDown style={{ color: OC, flexShrink: 0 }} />}
              </button>
              {openFaq === i && <div style={{ fontSize: 14, color: '#7A7A9A', lineHeight: 1.8, paddingBottom: 20 }}>{faq.a}</div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── OCCTA ─────────────────────────────────────────────────────────────────────
function OCCTA({ onGetBlueprint }: { onGetBlueprint: () => void }) {
  const [email, setEmail] = useState('');
  return (
    <section className="oc-section" style={{ background: 'linear-gradient(135deg, rgba(0,196,180,0.07) 0%, rgba(249,115,22,0.06) 100%)', borderTop: '1px solid rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="oc-wrap">
        <div style={{ textAlign: 'center', maxWidth: 660, margin: '0 auto' }}>
          <h2 className="oc-sg" style={{ fontSize: 'clamp(26px, 4vw, 44px)', fontWeight: 800, marginBottom: 14, letterSpacing: '-0.025em' }}>
            Ready to build your <GradientText>AI team?</GradientText>
          </h2>
          <p style={{ fontSize: 17, color: '#7A7A9A', marginBottom: 32, lineHeight: 1.8 }}>Start with a free AI Business Blueprint. Tell us about your business and we&apos;ll build your personalised plan.</p>
          <div style={{ display: 'flex', gap: 10, maxWidth: 460, margin: '0 auto', marginBottom: 10 }}>
            <input className="oc-input" type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} style={{ flex: 1 }} />
            <button className="oc-btn-primary" onClick={onGetBlueprint} style={{ padding: '11px 20px', fontSize: 14, whiteSpace: 'nowrap' }}>Get Blueprint →</button>
          </div>
          <div style={{ fontSize: 11.5, color: '#4A4A6A' }}>No spam. No credit card. Just your free AI blueprint.</div>
        </div>
      </div>
    </section>
  );
}

// ── OCFooter ──────────────────────────────────────────────────────────────────
function OCFooter({ branding, brandName }: { branding: OCBranding | null; brandName: string }) {
  return (
    <footer style={{ background: '#070910', borderTop: '1px solid rgba(255,255,255,0.07)', padding: '48px 0 28px' }}>
      <div className="oc-wrap">
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 40, marginBottom: 40 }}>
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 18, marginBottom: 12 }}>Kno<span style={{ color: OC }}>Claw</span></div>
            <p style={{ fontSize: 13, color: '#7A7A9A', lineHeight: 1.75 }}>We build AI teams for businesses that are ready to stop doing everything themselves.</p>
          </div>
          <div>
            <h4 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#4A4A6A', textTransform: 'uppercase', marginBottom: 12 }}>Service</h4>
            {['#features', '#pricing', '#faq'].map(href => (
              <a key={href} href={href} style={{ display: 'block', fontSize: 13, color: '#7A7A9A', textDecoration: 'none', marginBottom: 7, transition: 'color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.color = OC)} onMouseLeave={e => (e.currentTarget.style.color = '#7A7A9A')}>
                {href.replace('#', '').charAt(0).toUpperCase() + href.replace('#', '').slice(1)}
              </a>
            ))}
          </div>
          <div>
            <h4 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#4A4A6A', textTransform: 'uppercase', marginBottom: 12 }}>Contact</h4>
            {branding?.supportEmail && <div style={{ fontSize: 13, color: '#7A7A9A', marginBottom: 7 }}>{branding.supportEmail}</div>}
            {branding?.companyPhone && <div style={{ fontSize: 13, color: '#7A7A9A', marginBottom: 7 }}>{branding.companyPhone}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 20, flexWrap: 'wrap', gap: 10 }}>
          <p style={{ fontSize: 12, color: '#4A4A6A' }}>© {new Date().getFullYear()} {brandName}. All rights reserved.</p>
          <div style={{ display: 'flex', gap: 16 }}>
            {branding?.privacyPolicyUrl && <a href={branding.privacyPolicyUrl} style={{ fontSize: 12, color: '#4A4A6A', textDecoration: 'none' }}>Privacy Policy</a>}
            {branding?.termsOfServiceUrl && <a href={branding.termsOfServiceUrl} style={{ fontSize: 12, color: '#4A4A6A', textDecoration: 'none' }}>Terms of Service</a>}
          </div>
        </div>
      </div>
    </footer>
  );
}

// ── OCOnboarding ──────────────────────────────────────────────────────────────
interface OCOnboardingProps {
  step: number; data: Record<string, string>; submitting: boolean; success: boolean;
  calendarUrl?: string;
  onClose: () => void; onNext: () => void; onBack: () => void;
  onChange: (key: string, val: string) => void; onSubmit: () => void;
  onBookingDone: () => void;
}

function OCOnboarding({ step, data, submitting, success, calendarUrl, onClose, onNext, onBack, onChange, onSubmit, onBookingDone }: OCOnboardingProps) {
  const hasCalendar = Boolean(calendarUrl);
  const steps = hasCalendar
    ? ['Your Business', 'Your Challenge', 'Your Details', 'Book a Call']
    : ['Your Business', 'Your Challenge', 'Your Details'];
  const progress = success ? 100 : Math.round(((step + 1) / steps.length) * 100);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(4,5,10,0.88)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#0D0E1A', border: `1px solid rgba(0,196,180,0.25)`, borderRadius: 20, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 40px 80px rgba(0,0,0,0.6)' }}>
        <div style={{ padding: '20px 24px 0', position: 'relative' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, width: 28, height: 28, borderRadius: '50%', background: '#181830', border: '1px solid rgba(255,255,255,0.07)', color: '#7A7A9A', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><FiX /></button>
          {!success && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ height: 3, background: '#181830', borderRadius: 2, overflow: 'hidden', marginBottom: 12 }}>
                <div style={{ height: '100%', background: `linear-gradient(90deg, ${OC}, ${ORANGE})`, borderRadius: 2, width: `${progress}%`, transition: 'width 0.4s' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {steps.map((s, i) => (
                  <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: i < step ? OC : i === step ? ORANGE : '#181830', border: `1px solid ${i <= step ? (i < step ? OC : ORANGE) : '#4A4A6A'}`, display: 'inline-block', transition: 'all 0.3s' }} />
                    <label style={{ fontSize: 9, color: i <= step ? '#7A7A9A' : '#4A4A6A', fontWeight: 600, letterSpacing: '0.04em', textAlign: 'center' }}>{s}</label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{ padding: '8px 24px 28px' }}>
          {success ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: `linear-gradient(135deg, ${OC}, ${OC_DARK})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, margin: '0 auto 20px', boxShadow: `0 0 40px rgba(0,196,180,0.3)` }}>✅</div>
              <h3 className="oc-sg" style={{ fontSize: 24, fontWeight: 800, marginBottom: 10 }}>Blueprint Request Received!</h3>
              <p style={{ fontSize: 15, color: '#7A7A9A', lineHeight: 1.7, marginBottom: 24, maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>Our AI team is researching your business overnight. You&apos;ll receive your personalised AI blueprint within 24 hours.</p>
              {[['🗺️', 'AI Blueprint', 'Personalised team plan built overnight'], ['📞', 'Discovery Call', 'We walk you through your blueprint'], ['🚀', 'Go Live', 'Your AI team up in 48 hours']].map(([ic, h, d]) => (
                <div key={h} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: '#121322', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '13px 16px', textAlign: 'left', marginBottom: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(0,196,180,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{ic}</div>
                  <div><h5 style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{h}</h5><p style={{ fontSize: 12, color: '#7A7A9A', margin: 0, lineHeight: 1.5 }}>{d}</p></div>
                </div>
              ))}
              <button className="oc-btn-primary" onClick={onClose} style={{ marginTop: 16, padding: '12px 32px', fontSize: 14 }}>Close</button>
            </div>
          ) : step === 3 && hasCalendar ? (
            /* Step 4: Book a call via embedded calendar */
            <div>
              <p className="oc-sg" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: OC, marginBottom: 6 }}>Step 4 of 4</p>
              <h3 className="oc-sg" style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Book your Discovery Call</h3>
              <p style={{ fontSize: 14, color: '#7A7A9A', marginBottom: 18 }}>
                Pick a time that works for you. We&apos;ll walk you through your personalised AI blueprint on the call.
              </p>
              <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 20 }}>
                {/* eslint-disable-next-line jsx-a11y/iframe-has-title */}
                <iframe
                  src={calendarUrl}
                  width="100%"
                  height="520"
                  style={{ display: 'block', background: '#fff', border: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button className="oc-btn-ghost" onClick={onBookingDone} style={{ padding: '10px 18px', fontSize: 12 }}>
                  Skip for now
                </button>
                <button className="oc-btn-primary" onClick={onBookingDone} style={{ padding: '12px 24px', fontSize: 14 }}>
                  I&apos;ve booked my call ✓
                </button>
              </div>
            </div>
          ) : step === 0 ? (
            <div>
              <p className="oc-sg" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: OC, marginBottom: 6 }}>Step 1 of 3</p>
              <h3 className="oc-sg" style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Tell us about your business</h3>
              <p style={{ fontSize: 14, color: '#7A7A9A', marginBottom: 22 }}>We&apos;ll research your business overnight to build your personalised AI team blueprint.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#7A7A9A' }}>Business Name *</label>
                  <input className="oc-input" placeholder="Acme Corp" value={data.businessName} onChange={e => onChange('businessName', e.target.value)} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#7A7A9A' }}>Website</label>
                  <input className="oc-input" placeholder="acme.com" value={data.website} onChange={e => onChange('website', e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 22 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#7A7A9A' }}>Industry</label>
                <select className="oc-select" value={data.industry} onChange={e => onChange('industry', e.target.value)}>
                  <option value="">Select your industry</option>
                  {['Agency / Consulting', 'E-commerce / Retail', 'Real Estate', 'Professional Services', 'Healthcare', 'Hospitality', 'SaaS / Tech', 'Education', 'Other'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 22 }}>
                <button className="oc-btn-primary" onClick={onNext} disabled={!data.businessName} style={{ padding: '12px 28px', fontSize: 14, opacity: !data.businessName ? 0.4 : 1 }}>Next →</button>
              </div>
            </div>
          ) : step === 1 ? (
            <div>
              <p className="oc-sg" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: OC, marginBottom: 6 }}>Step 2 of 3</p>
              <h3 className="oc-sg" style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>What&apos;s your biggest challenge?</h3>
              <p style={{ fontSize: 14, color: '#7A7A9A', marginBottom: 22 }}>Help us understand where AI can make the biggest difference for you.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
                {[['📱', 'Customer support taking too long'], ['📧', 'Lead follow-ups slipping through'], ['📅', 'Scheduling & calendar chaos'], ['📊', 'Manual reporting & spreadsheets'], ['💬', 'Social media management'], ['🔄', 'Repetitive admin tasks']].map(([ic, label]) => (
                  <div key={label} onClick={() => onChange('challenges', label)}
                    style={{ background: data.challenges === label ? 'rgba(0,196,180,0.12)' : '#121322', border: `1px solid ${data.challenges === label ? OC : 'rgba(255,255,255,0.07)'}`, borderRadius: 10, padding: '11px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, fontWeight: 500, transition: 'all 0.2s' }}>
                    <span>{ic}</span>{label}
                    <span style={{ marginLeft: 'auto', width: 16, height: 16, borderRadius: '50%', background: data.challenges === label ? OC : 'transparent', border: `1px solid ${data.challenges === label ? OC : '#4A4A6A'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#070910', flexShrink: 0 }}>{data.challenges === label ? '✓' : ''}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 22 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#7A7A9A' }}>Monthly Revenue Range</label>
                <select className="oc-select" value={data.revenue} onChange={e => onChange('revenue', e.target.value)}>
                  <option value="">Select range</option>
                  {['Under £2K/mo', '£2K – £5K/mo', '£5K – £15K/mo', '£15K – £50K/mo', '£50K+/mo'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 22 }}>
                <button className="oc-btn-ghost" onClick={onBack} style={{ padding: '11px 20px', fontSize: 13 }}>← Back</button>
                <button className="oc-btn-primary" onClick={onNext} style={{ padding: '12px 28px', fontSize: 14 }}>Next →</button>
              </div>
            </div>
          ) : (
            <div>
              <p className="oc-sg" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: OC, marginBottom: 6 }}>Step 3 of 3</p>
              <h3 className="oc-sg" style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>How should we reach you?</h3>
              <p style={{ fontSize: 14, color: '#7A7A9A', marginBottom: 22 }}>We&apos;ll send your blueprint here and schedule a free discovery call.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#7A7A9A' }}>Your Name *</label>
                  <input className="oc-input" placeholder="Jane Smith" value={data.name} onChange={e => onChange('name', e.target.value)} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#7A7A9A' }}>Phone</label>
                  <input className="oc-input" placeholder="+44 7700 900000" value={data.phone} onChange={e => onChange('phone', e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 22 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#7A7A9A' }}>Email Address *</label>
                <input className="oc-input" type="email" placeholder="jane@company.com" value={data.email} onChange={e => onChange('email', e.target.value)} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 22 }}>
                <button className="oc-btn-ghost" onClick={onBack} style={{ padding: '11px 20px', fontSize: 13 }}>← Back</button>
                <button className="oc-btn-primary" onClick={onSubmit} disabled={!data.name || !data.email || submitting}
                  style={{ padding: '12px 28px', fontSize: 14, opacity: (!data.name || !data.email || submitting) ? 0.4 : 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {submitting ? 'Sending...' : 'Get My Blueprint 🗺️'}
                </button>
              </div>
              <p style={{ fontSize: 11, color: '#4A4A6A', marginTop: 10, display: 'flex', alignItems: 'center', gap: 5 }}>🔒 Your information is secure and will never be shared.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function OpenClawLandingPage() {
  const [branding, setBranding] = useState<OCBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [tiers, setTiers] = useState<PricingTier[]>(DEFAULT_TIERS);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [obStep, setObStep] = useState(0);
  const [obData, setObData] = useState({ businessName: '', website: '', industry: '', name: '', email: '', phone: '', challenges: '', revenue: '' });
  const [obSubmitting, setObSubmitting] = useState(false);
  const [obSuccess, setObSuccess] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/whitelabel/experience-branding/openclaw').then(r => r.ok ? r.json() : null),
      fetch('/api/whitelabel/experience-pricing/openclaw').then(r => r.ok ? r.json() : null),
    ]).then(([brandData, pricingData]) => {
      if (brandData) setBranding(brandData);
      if (pricingData?.tiers?.length) setTiers(pricingData.tiers);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <OCLoader />;

  const brandName = branding?.businessName || 'KnoClaw';
  const primaryColor = branding?.primaryColor || OC;
  const calendarUrl = (branding as OCBranding | null)?.calendarUrl || '';

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: '#070910', color: '#E8EAF0', lineHeight: '1.6', overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        :root { scroll-behavior: smooth; }
        .oc-wrap { max-width: 1100px; margin: 0 auto; padding: 0 24px; }
        .oc-section { padding: 96px 0; }
        .oc-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; }
        .oc-card:hover { border-color: rgba(0,196,180,0.25) !important; }
        .oc-sg { font-family: 'Space Grotesk', sans-serif; }
        .oc-mono { font-family: 'DM Mono', monospace; }
        .oc-chip { background: rgba(0,196,180,0.1); border: 1px solid rgba(0,196,180,0.22); border-radius: 8px; }
        .oc-btn-primary { background: linear-gradient(135deg, ${OC}, ${OC_DARK}); color: #070910; font-weight: 700; cursor: pointer; border: none; border-radius: 10px; transition: all 0.2s; }
        .oc-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 0 28px rgba(0,196,180,0.4); }
        .oc-btn-orange { background: linear-gradient(135deg, ${ORANGE}, #EA6310); color: white; font-weight: 700; cursor: pointer; border: none; border-radius: 10px; transition: all 0.2s; }
        .oc-btn-orange:hover { transform: translateY(-2px); box-shadow: 0 0 28px rgba(249,115,22,0.4); }
        .oc-btn-ghost { background: transparent; color: #7A7A9A; border: 1px solid rgba(255,255,255,0.07); font-weight: 600; cursor: pointer; border-radius: 10px; transition: all 0.2s; }
        .oc-btn-ghost:hover { color: #E8EAF0; border-color: rgba(255,255,255,0.18); }
        .oc-input { background: #121322; border: 1px solid rgba(255,255,255,0.07); border-radius: 9px; padding: 11px 14px; font-size: 14px; color: #E8EAF0; font-family: 'Inter', sans-serif; outline: none; width: 100%; transition: border-color 0.2s; }
        .oc-input:focus { border-color: rgba(0,196,180,0.4); }
        .oc-input::placeholder { color: #4A4A6A; }
        .oc-select { background: #121322; border: 1px solid rgba(255,255,255,0.07); border-radius: 9px; padding: 11px 14px; font-size: 14px; color: #E8EAF0; font-family: 'Inter', sans-serif; outline: none; width: 100%; appearance: none; }
        .oc-select:focus { border-color: rgba(0,196,180,0.4); }
      `}</style>

      <OCNav branding={branding} brandName={brandName} primaryColor={primaryColor} onGetBlueprint={() => { setShowOnboarding(true); setObStep(0); }} />
      <OCHero onGetBlueprint={() => { setShowOnboarding(true); setObStep(0); }} />
      <OCStrip />
      <OCPainPoints />
      <OCComparison />
      <OCFeatures />
      <OCPricing tiers={tiers} onGetBlueprint={() => { setShowOnboarding(true); setObStep(0); }} />
      <OCTestimonials />
      <OCFaq openFaq={openFaq} setOpenFaq={setOpenFaq} />
      <OCCTA onGetBlueprint={() => { setShowOnboarding(true); setObStep(0); }} />
      <OCFooter branding={branding} brandName={brandName} />

      {showOnboarding && (
        <OCOnboarding
          step={obStep}
          data={obData}
          submitting={obSubmitting}
          success={obSuccess}
          calendarUrl={calendarUrl}
          onClose={() => { setShowOnboarding(false); setObStep(0); setObSuccess(false); }}
          onNext={() => setObStep(s => s + 1)}
          onBack={() => setObStep(s => s - 1)}
          onChange={(key, val) => setObData(d => ({ ...d, [key]: val }))}
          onSubmit={async () => {
            setObSubmitting(true);
            try {
              await fetch('/api/whitelabel/experience-leads/openclaw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...obData, experienceType: 'OPENCLAW_WHITELABEL_SERVICE' }),
              });
            } catch { /* silent */ }
            setObSubmitting(false);
            // If partner configured a calendar URL, go to booking step; otherwise show success
            if (calendarUrl) {
              setObStep(3);
            } else {
              setObSuccess(true);
            }
          }}
          onBookingDone={() => setObSuccess(true)}
        />
      )}
    </div>
  );
}

