'use client';

/**
 * OpenClaw Setup Service Landing Page
 *
 * Experience 3 — Agency-sold guided setup calls.
 * Prospect fills lead form → calendar embed to book a session.
 * Partner must configure calendarUrl in the experience settings.
 */

import { useState, useEffect } from 'react';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import { validatePhoneNumber } from '@/lib/utils/phoneValidation';

// ── Brand constants ─────────────────────────────────────────────────────────
const ORANGE  = '#F97316';   // Setup Service primary fallback
const BG_DARK = '#070910';
const BG_LIGHT = '#F8F9FC';

/** Darken a hex colour by a given percentage (0–100). */
function darkenHex(hex: string, pct: number): string {
  const h = hex.replace('#', '');
  const num = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  const r = Math.max(0, ((num >> 16) & 255) - Math.round(2.55 * pct));
  const g = Math.max(0, ((num >> 8) & 255) - Math.round(2.55 * pct));
  const b = Math.max(0, (num & 255) - Math.round(2.55 * pct));
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

// ── Branding type ──────────────────────────────────────────────────────────
interface OCBranding {
  primaryColor?: string;
  businessName?: string;
  logo?: string;
  calendarUrl?: string;
  /** When true, embed the calendar inside the onboarding flow; when false (default) the link is emailed instead */
  showEmbeddedCalendar?: boolean;
  privacyPolicyUrl?: string;
  termsOfServiceUrl?: string;
  supportEmail?: string;
  twitterUrl?: string;
  linkedinUrl?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  /** Experience-level character name override (set in experience settings) */
  assistantName?: string;
  /** Partner-level character name (from partner branding, used as fallback) */
  characterName?: string;
  themePreference?: string;
  prepaidBooking?: PrepaidBooking;
}

interface PrepaidBooking {
  enabled: boolean;
  amount: number;       // in cents
  currency: string;     // e.g. 'usd'
  description: string;
}



/** Format cents into a human-readable price string, e.g. 9900 → "$99" */
function formatPrice(amountCents: number, currency: string): string {
  const amount = amountCents / 100;
  const symbol = ({ usd: '$', gbp: '£', eur: '€', inr: '₹', aud: 'A$', cad: 'C$' } as Record<string, string>)[currency] ?? currency.toUpperCase() + ' ';
  return `${symbol}${amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2)}`;
}

// ── Loader ─────────────────────────────────────────────────────────────────
function OSSLoader({ primary }: { primary: string }) {
  return (
    <div style={{ minHeight: '100vh', background: BG_DARK, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 44, height: 44, border: `3px solid ${primary}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 16px' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ color: '#7A7A9A', fontSize: 14 }}>Loading...</p>
      </div>
    </div>
  );
}

// ── Nav ────────────────────────────────────────────────────────────────────
function OSSNav({ branding, brandName, primary, isDark, onToggleDark, onBook, prepaid }: {
  branding: OCBranding | null;
  brandName: string;
  primary: string;
  isDark: boolean;
  onToggleDark: () => void;
  onBook: () => void;
  prepaid?: PrepaidBooking;
}) {
  const navBg = isDark ? 'rgba(7,9,16,0.92)' : 'rgba(248,249,252,0.92)';
  const navText = isDark ? '#E8EAF0' : '#1A1A2E';
  const navBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const badgeBg = `${primary}1A`;
  const badgeBorder = `${primary}4D`;

  return (
    <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: navBg, backdropFilter: 'blur(12px)', borderBottom: `1px solid ${navBorder}`, padding: '14px 0' }}>
      <div className="oc-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        {/* Logo / brand */}
        {branding?.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={branding.logo} alt={brandName} style={{ height: 36, objectFit: 'contain' }} />
        ) : (
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 20, color: navText }}>
            {brandName}
            <span style={{ fontSize: 11, fontWeight: 600, color: primary, marginLeft: 8, background: badgeBg, border: `1px solid ${badgeBorder}`, borderRadius: 6, padding: '2px 7px' }}>Setup</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Dark/light toggle */}
          <button onClick={onToggleDark} title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{ background: 'transparent', border: `1px solid ${navBorder}`, borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 16, color: navText, lineHeight: 1 }}>
            {isDark ? '☀️' : '🌙'}
          </button>
          <button className="oss-btn-primary" onClick={onBook} style={{ padding: '9px 20px', fontSize: 13 }}>
            {prepaid?.enabled && prepaid.amount > 0
              ? `Book Now — ${formatPrice(prepaid.amount, prepaid.currency)} 💳`
              : 'Book Free Call 📅'}
          </button>
        </div>
      </div>
    </nav>
  );
}

// ── Hero ───────────────────────────────────────────────────────────────────
function OSSHero({ heroTitle, heroSubtitle, ctaText, onBook, prepaid, primary }: {
  heroTitle: string; heroSubtitle: string; ctaText: string; onBook: () => void; prepaid?: PrepaidBooking; primary: string;
}) {
  const priceLabel = prepaid?.enabled && prepaid.amount > 0
    ? formatPrice(prepaid.amount, prepaid.currency)
    : null;

  return (
    <section style={{ padding: '100px 0 80px', textAlign: 'center' }}>
      <div className="oc-wrap">
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: `${primary}1A`, border: `1px solid ${primary}40`, borderRadius: 20, padding: '6px 16px', fontSize: 12, fontWeight: 700, color: primary, marginBottom: 28, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          📅 1-on-1 Expert Setup Session
        </div>
        <h1 className="oc-sg" style={{ fontSize: 'clamp(32px, 5vw, 60px)', fontWeight: 900, lineHeight: 1.12, marginBottom: 22, maxWidth: 820, margin: '0 auto 22px' }}>
          {heroTitle}
        </h1>
        <p style={{ fontSize: 18, color: '#9A9AB0', maxWidth: 640, margin: '0 auto 40px', lineHeight: 1.7 }}>{heroSubtitle}</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
          <button className="oss-btn-primary" onClick={onBook} style={{ padding: '16px 36px', fontSize: 16 }}>
            {priceLabel ? `Book Now — ${priceLabel} 💳` : ctaText}
          </button>
        </div>
        <p style={{ fontSize: 12, color: '#4A4A6A', marginTop: 16 }}>
          {priceLabel
            ? `🔒 Secure payment powered by Stripe. ${priceLabel} one-time booking fee.`
            : '🔒 No payment needed to book. Completely free consultation.'}
        </p>
      </div>
    </section>
  );
}





// ── How It Works ───────────────────────────────────────────────────────────
function OSSHowItWorks({ onBook, primary }: { onBook: () => void; primary: string }) {
  const steps = [
    { n: '01', icon: '📝', title: 'Tell us about yourself', desc: 'Fill in a quick form so we know who you are and what tools you currently use.' },
    { n: '02', icon: '📅', title: 'Pick a time that suits you', desc: 'Choose a slot from our live calendar and book your setup session instantly.' },
    { n: '03', icon: '🎙️', title: 'Join the setup call', desc: 'A dedicated expert joins you on video or audio and configures everything live, step by step.' },
    { n: '04', icon: '🤖', title: 'Go live with your AI', desc: 'Leave the call with a fully working AI agent connected to your apps and ready to use.' },
  ];
  return (
    <section className="oc-section" style={{ background: 'rgba(255,255,255,0.015)', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="oc-wrap">
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: primary, textAlign: 'center', marginBottom: 10 }}>HOW IT WORKS</p>
        <h2 className="oc-sg" style={{ fontSize: 36, fontWeight: 800, textAlign: 'center', marginBottom: 52 }}>From booking to live AI in one session</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24 }}>
          {steps.map(s => (
            <div key={s.n} className="oc-card" style={{ padding: '28px 24px' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: primary, letterSpacing: '0.08em', marginBottom: 14 }}>{s.n}</div>
              <div style={{ fontSize: 32, marginBottom: 12 }}>{s.icon}</div>
              <h3 className="oc-sg" style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{s.title}</h3>
              <p style={{ fontSize: 14, color: '#7A7A9A', lineHeight: 1.6 }}>{s.desc}</p>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 48 }}>
          <button className="oss-btn-primary" onClick={onBook} style={{ padding: '14px 32px', fontSize: 15 }}>Book My Setup Call 📅</button>
        </div>
      </div>
    </section>
  );
}

// ── Features ───────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: '🎯', title: 'Live 1-on-1 Session', desc: 'A dedicated expert joins your call and configures everything live — no tickets, no waiting, no confusion.' },
  { icon: '🔗', title: 'Apps Connected on the Call', desc: 'We connect Gmail, Calendar, Notion and more during the session. You leave with a fully working AI.' },
  { icon: '⚙️', title: 'Custom to Your Workflow', desc: 'Configured around how you actually work — your priorities, your language, your tools.' },
  { icon: '🛡️', title: 'No Technical Knowledge Needed', desc: 'You don\'t need to know about APIs or bots. Just show up and we handle the rest.' },
  { icon: '💬', title: 'Works in Telegram', desc: 'Your personal AI lives in Telegram — the app you already use. No new software to install.' },
  { icon: '🎧', title: 'Ongoing Support', desc: 'After your session, we\'re available to help you expand and optimise as your needs grow.' },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function OSSFeatures({ onBook, primary }: { onBook: () => void; primary: string }) {
  return (
    <section className="oc-section">
      <div className="oc-wrap">
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: primary, textAlign: 'center', marginBottom: 10 }}>WHAT YOU GET</p>
        <h2 className="oc-sg" style={{ fontSize: 36, fontWeight: 800, textAlign: 'center', marginBottom: 52 }}>Everything in one expert-led session</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
          {FEATURES.map(f => (
            <div key={f.title} className="oc-card" style={{ padding: '24px' }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
              <h3 className="oc-sg" style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: '#7A7A9A', lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Testimonials ───────────────────────────────────────────────────────────
const TESTIMONIALS = [
  { name: 'Sophie Andreou', role: 'Marketing Consultant', content: 'I had no idea how to set it up myself. The call took 40 minutes and by the end I had a working AI in my Telegram. Incredible.', stars: 5 },
  { name: 'Ravi Nair', role: 'E-commerce Store Owner', content: 'They connected my Gmail and Notion while we were on the call. Saved me weeks of figuring it out alone.', stars: 5 },
  { name: 'Claire Hutchinson', role: 'Freelance Designer', content: 'The setup session was actually fun. The expert knew exactly what I needed and had everything running before we hung up.', stars: 5 },
];

function OSSTestimonials({ primary }: { primary: string }) {
  return (
    <section className="oc-section" style={{ background: 'rgba(255,255,255,0.015)', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="oc-wrap">
        <h2 className="oc-sg" style={{ fontSize: 36, fontWeight: 800, textAlign: 'center', marginBottom: 48 }}>What people say after their session</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {TESTIMONIALS.map(t => (
            <div key={t.name} className="oc-card" style={{ padding: '24px' }}>
              <div style={{ color: primary, fontSize: 16, marginBottom: 12 }}>{'★'.repeat(t.stars)}</div>
              <p style={{ fontSize: 14, color: '#B8BAD0', lineHeight: 1.7, marginBottom: 16, fontStyle: 'italic' }}>&quot;{t.content}&quot;</p>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{t.name}</div>
                <div style={{ fontSize: 12, color: '#7A7A9A' }}>{t.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── FAQ ────────────────────────────────────────────────────────────────────
function buildFAQs(brandName: string, characterName: string, prepaid?: PrepaidBooking) {
  const costAnswer = prepaid?.enabled && prepaid.amount > 0
    ? `${brandName} charges a one-time booking fee of ${formatPrice(prepaid.amount, prepaid.currency)} to secure your setup session. This covers the full guided call with ${characterName}.`
    : `${brandName} offers this setup session free of charge. Simply fill in your details and pick a time that suits you.`;

  return [
    {
      q: 'How long is the setup call?',
      a: `Most setup sessions with ${brandName} take between 30 and 60 minutes. By the end, your AI agent will be fully configured and connected to your chosen apps.`,
    },
    {
      q: 'What do I need before the call?',
      a: `Just make sure you have a Telegram account ready. ${characterName} will walk you through everything else — creating your bot, connecting apps, and testing — live on the call.`,
    },
    {
      q: 'Which apps can be connected?',
      a: 'Currently Gmail, Google Calendar, and Notion are supported. Slack, HubSpot, and Linear are coming soon. Let us know what tools you use and we\'ll do our best to accommodate.',
    },
    {
      q: 'Is there a cost?',
      a: costAnswer,
    },
    {
      q: 'What if I want to add more apps later?',
      a: `No problem — reach out to ${brandName} to book a follow-up session or get support extending your setup at any time.`,
    },
  ];
}

function OSSFAQ({ primary, brandName, characterName, prepaid }: {
  primary: string;
  brandName: string;
  characterName: string;
  prepaid?: PrepaidBooking;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const faqs = buildFAQs(brandName, characterName, prepaid);
  return (
    <section className="oc-section">
      <div className="oc-wrap" style={{ maxWidth: 720, margin: '0 auto' }}>
        <h2 className="oc-sg" style={{ fontSize: 36, fontWeight: 800, textAlign: 'center', marginBottom: 48 }}>Frequently asked questions</h2>
        {faqs.map((f, i) => (
          <div key={i} onClick={() => setOpen(open === i ? null : i)}
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '18px 0', cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{f.q}</span>
              <span style={{ color: primary, fontSize: 18, flexShrink: 0, marginLeft: 12 }}>{open === i ? '−' : '+'}</span>
            </div>
            {open === i && <p style={{ fontSize: 14, color: '#7A7A9A', lineHeight: 1.7, marginTop: 12 }}>{f.a}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

// ── CTA Banner ─────────────────────────────────────────────────────────────
function OSSCTA({ onBook, primary, prepaid }: { onBook: () => void; primary: string; prepaid?: PrepaidBooking }) {
  const isPaid = prepaid?.enabled && prepaid.amount > 0;
  const priceLabel = isPaid ? formatPrice(prepaid!.amount, prepaid!.currency) : null;
  return (
    <section style={{ padding: '80px 0', background: `linear-gradient(135deg, ${primary}1E, rgba(0,196,180,0.06))`, borderTop: `1px solid ${primary}26` }}>
      <div className="oc-wrap" style={{ textAlign: 'center' }}>
        <h2 className="oc-sg" style={{ fontSize: 40, fontWeight: 900, marginBottom: 16 }}>Ready to get your AI set up?</h2>
        <p style={{ fontSize: 16, color: '#9A9AB0', marginBottom: 36, maxWidth: 500, margin: '0 auto 36px' }}>
          {isPaid
            ? `Book your setup session today for just ${priceLabel}. A real expert walks you through everything — live, on the call.`
            : 'Book a free setup call today. A real expert walks you through everything — live, on the call.'}
        </p>
        <button className="oss-btn-primary" onClick={onBook} style={{ padding: '16px 40px', fontSize: 17 }}>
          {isPaid ? `Book My Session — ${priceLabel} 💳` : 'Book My Free Session 📅'}
        </button>
      </div>
    </section>
  );
}

// ── Footer ─────────────────────────────────────────────────────────────────
function OSSFooter({ branding, brandName, primary, isDark }: { branding: OCBranding | null; brandName: string; primary: string; isDark: boolean }) {
  const footerBg = isDark ? '#0A0B14' : '#F0F2F7';
  const borderCol = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const dimText = isDark ? '#4A4A6A' : '#8A8A9A';
  const logoText = isDark ? '#E8EAF0' : '#1A1A2E';

  const socialLinks = [
    branding?.twitterUrl && { href: branding.twitterUrl, label: '𝕏 Twitter' },
    branding?.linkedinUrl && { href: branding.linkedinUrl, label: 'LinkedIn' },
    branding?.facebookUrl && { href: branding.facebookUrl, label: 'Facebook' },
    branding?.instagramUrl && { href: branding.instagramUrl, label: 'Instagram' },
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <footer style={{ background: footerBg, borderTop: `1px solid ${borderCol}`, padding: '40px 0 24px' }}>
      <div className="oc-wrap">
        {/* Top row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 24, marginBottom: 32 }}>
          {/* Brand */}
          <div>
            {branding?.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logo} alt={brandName} style={{ height: 32, objectFit: 'contain', marginBottom: 8 }} />
            ) : (
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 18, color: logoText, marginBottom: 8 }}>
                {brandName} <span style={{ color: primary, fontSize: 13 }}>Setup</span>
              </div>
            )}
            {branding?.supportEmail && (
              <a href={`mailto:${branding.supportEmail}`} style={{ fontSize: 13, color: primary, textDecoration: 'none' }}>
                ✉ {branding.supportEmail}
              </a>
            )}
          </div>
          {/* Social links */}
          {socialLinks.length > 0 && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              {socialLinks.map(s => (
                <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 12, color: dimText, textDecoration: 'none', padding: '4px 10px', border: `1px solid ${borderCol}`, borderRadius: 6 }}>
                  {s.label}
                </a>
              ))}
            </div>
          )}
        </div>
        {/* Bottom row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, borderTop: `1px solid ${borderCol}`, paddingTop: 20 }}>
          <p style={{ fontSize: 12, color: dimText, margin: 0 }}>© {new Date().getFullYear()} {brandName}. All rights reserved.</p>
          <div style={{ display: 'flex', gap: 16 }}>
            {branding?.privacyPolicyUrl && (
              <a href={branding.privacyPolicyUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: dimText, textDecoration: 'none' }}>Privacy Policy</a>
            )}
            {branding?.termsOfServiceUrl && (
              <a href={branding.termsOfServiceUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: dimText, textDecoration: 'none' }}>Terms of Service</a>
            )}
            {branding?.supportEmail && (
              <a href={`mailto:${branding.supportEmail}`} style={{ fontSize: 12, color: dimText, textDecoration: 'none' }}>Support</a>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}

// ── Onboarding Modal ───────────────────────────────────────────────────────
// Step 0: lead info → (optional) Stripe payment → Step 1: calendar embed (when enabled) → success
interface OSSOnboardingProps {
  onClose: () => void;
  alias: string;
  calendarUrl?: string;
  /** When true, show the calendar embedded in the modal. When false/undefined, the link is emailed instead. */
  showEmbeddedCalendar?: boolean;
  prepaid?: PrepaidBooking;
  /** Jump straight to calendar step (user returned from Stripe success) */
  startAtCalendar?: boolean;
}

function OSSOnboarding({ onClose, alias, calendarUrl, showEmbeddedCalendar, prepaid, startAtCalendar }: OSSOnboardingProps) {
  // hasCalendar is true only when a URL is provided AND the embed is explicitly enabled
  const hasCalendar = Boolean(calendarUrl) && Boolean(showEmbeddedCalendar);
  const isPrepaid = Boolean(prepaid?.enabled && prepaid.amount && prepaid.amount > 0);

  const [step, setStep] = useState(startAtCalendar && hasCalendar ? 1 : 0);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(startAtCalendar && !hasCalendar ? true : false);
  const [data, setData] = useState({ name: '', email: '', phone: '', businessName: '', notes: '' });
  const [errors, setErrors] = useState({ name: '', email: '', phone: '' });

  const validateForm = (): boolean => {
    const newErrors = { name: '', email: '', phone: '' };
    let valid = true;

    if (!data.name.trim()) {
      newErrors.name = 'Your name is required.';
      valid = false;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!data.email.trim()) {
      newErrors.email = 'Email address is required.';
      valid = false;
    } else if (!emailRegex.test(data.email)) {
      newErrors.email = 'Please enter a valid email address.';
      valid = false;
    }

    if (!data.phone.trim()) {
      newErrors.phone = 'Phone number is required.';
      valid = false;
    } else {
      const phoneValidation = validatePhoneNumber('+' + data.phone);
      if (!phoneValidation.isValid) {
        newErrors.phone = phoneValidation.error || 'Please enter a valid phone number.';
        valid = false;
      }
    }

    setErrors(newErrors);
    return valid;
  };

  const canSubmit = Boolean(data.name && data.email && data.phone);

  const handleSubmit = async () => {
    if (!validateForm()) return;

    // Convert phone to E.164 before sending
    const phoneValidation = validatePhoneNumber('+' + data.phone);
    const e164Phone = phoneValidation.e164Format || ('+' + data.phone);

    setSubmitting(true);
    try {
      const res = await fetch(`/api/whitelabel/experience-leads/${alias}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, phone: e164Phone, experienceType: 'OPENCLAW_SETUP_SERVICE' }),
      });
      const json = res.ok ? await res.json() : null;
      const prospectId: string | undefined = json?.prospectId;

      // If prepaid booking is configured, redirect to Stripe checkout
      if (isPrepaid && prospectId) {
        const returnBase = window.location.origin + window.location.pathname;
        // Use Stripe's template literal {CHECKOUT_SESSION_ID} so the session ID
        // is embedded by Stripe into the redirect URL server-side (not client-side).
        const successUrl = `${returnBase}?session_id={CHECKOUT_SESSION_ID}&prospect=${prospectId}`;
        const cancelUrl  = `${returnBase}?cancelled=1&prospect=${prospectId}`;

        const checkoutRes = await fetch(`/api/whitelabel/experience-checkout/${alias}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prospectId, successUrl, cancelUrl }),
        });
        const checkoutJson = checkoutRes.ok ? await checkoutRes.json() : null;
        if (checkoutJson?.url) {
          window.location.href = checkoutJson.url;
          return; // browser navigates away
        }
        // If checkout creation fails, fall through to show calendar / success
      }
    } catch { /* silent */ }

    setSubmitting(false);
    if (hasCalendar) {
      setStep(1);
    } else {
      setSuccess(true);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(7,9,16,0.85)', backdropFilter: 'blur(8px)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: '#0E1020', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 18, width: '100%', maxWidth: step === 1 ? 900 : 480, boxShadow: '0 24px 80px rgba(0,0,0,0.6)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              {success
                ? 'All Done!'
                : step === 0
                  ? isPrepaid
                    ? `Step 1 of 3 — Tell us about you`
                    : 'Step 1 of 2 — Tell us about you'
                  : isPrepaid
                    ? 'Step 3 of 3 — Book your session'
                    : 'Step 2 of 2 — Book your session'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#7A7A9A', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 24px 28px' }}>
          {success ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>🎉</div>
              <h3 className="oc-sg" style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>You&apos;re on the list!</h3>
              <p style={{ fontSize: 14, color: '#7A7A9A', marginBottom: 24 }}>
                {hasCalendar ? 'Your session is booked. Check your email for the confirmation.' : 'We\'ve received your request. We\'ll be in touch shortly to schedule your setup session.'}
              </p>
              <button className="oss-btn-primary" onClick={onClose} style={{ padding: '12px 28px', fontSize: 14 }}>Close</button>
            </div>
          ) : step === 0 ? (
            <div>
              <h3 className="oc-sg" style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>
                {isPrepaid ? 'Book your setup session' : 'Book a free setup session'}
              </h3>
              {isPrepaid && prepaid && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: 8, padding: '5px 12px', fontSize: 13, fontWeight: 700, color: ORANGE, marginBottom: 12 }}>
                  💳 {formatPrice(prepaid.amount, prepaid.currency)} booking fee — paid securely via Stripe
                </div>
              )}
              <p style={{ fontSize: 14, color: '#7A7A9A', marginBottom: 20 }}>Tell us a little about yourself and we&apos;ll get a call in the diary.</p>
              {/* Name */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#7A7A9A' }}>Your Name *</label>
                <input
                  className="oss-input"
                  placeholder="Jane Smith"
                  value={data.name}
                  onChange={e => { setData(d => ({ ...d, name: e.target.value })); setErrors(er => ({ ...er, name: '' })); }}
                />
                {errors.name && <span style={{ fontSize: 11, color: '#F87171', marginTop: 2 }}>{errors.name}</span>}
              </div>

              {/* Email */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#7A7A9A' }}>Email Address *</label>
                <input
                  className="oss-input"
                  type="email"
                  placeholder="jane@company.com"
                  value={data.email}
                  onChange={e => { setData(d => ({ ...d, email: e.target.value })); setErrors(er => ({ ...er, email: '' })); }}
                />
                {errors.email && <span style={{ fontSize: 11, color: '#F87171', marginTop: 2 }}>{errors.email}</span>}
              </div>

              {/* Phone — country picker + WhatsApp hint */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#7A7A9A' }}>
                  Phone Number * <span style={{ fontWeight: 400, color: '#4A4A6A' }}>(WhatsApp-enabled)</span>
                </label>
                <style>{`
                  .oss-phone-wrap .react-tel-input .form-control {
                    width: 100% !important;
                    background: #121322 !important;
                    border: 1px solid rgba(255,255,255,0.07) !important;
                    border-radius: 9px !important;
                    padding: 11px 14px 11px 52px !important;
                    font-size: 14px !important;
                    color: #E8EAF0 !important;
                    font-family: 'Inter', sans-serif !important;
                    outline: none !important;
                    height: auto !important;
                    transition: border-color 0.2s !important;
                  }
                  .oss-phone-wrap .react-tel-input .form-control:focus {
                    border-color: rgba(249,115,22,0.4) !important;
                    box-shadow: none !important;
                  }
                  .oss-phone-wrap .react-tel-input .flag-dropdown {
                    background: #121322 !important;
                    border: 1px solid rgba(255,255,255,0.07) !important;
                    border-right: none !important;
                    border-radius: 9px 0 0 9px !important;
                  }
                  .oss-phone-wrap .react-tel-input .selected-flag:hover,
                  .oss-phone-wrap .react-tel-input .selected-flag:focus {
                    background: rgba(255,255,255,0.06) !important;
                    border-radius: 9px 0 0 9px !important;
                  }
                  .oss-phone-wrap .react-tel-input .country-list {
                    background: #0E1020 !important;
                    border: 1px solid rgba(255,255,255,0.1) !important;
                    border-radius: 9px !important;
                    color: #E8EAF0 !important;
                    max-height: 200px !important;
                  }
                  .oss-phone-wrap .react-tel-input .country-list .country:hover,
                  .oss-phone-wrap .react-tel-input .country-list .country.highlight {
                    background: rgba(249,115,22,0.15) !important;
                  }
                  .oss-phone-wrap .react-tel-input .country-list .country-name,
                  .oss-phone-wrap .react-tel-input .country-list .dial-code {
                    color: #E8EAF0 !important;
                  }
                  .oss-phone-wrap .react-tel-input .country-list .search-box {
                    background: #121322 !important;
                    border: 1px solid rgba(255,255,255,0.1) !important;
                    color: #E8EAF0 !important;
                    border-radius: 6px !important;
                    width: calc(100% - 10px) !important;
                  }
                `}</style>
                <div className="oss-phone-wrap">
                  <PhoneInput
                    country="gb"
                    value={data.phone}
                    onChange={v => { setData(d => ({ ...d, phone: v })); setErrors(er => ({ ...er, phone: '' })); }}
                    enableSearch
                    inputProps={{ name: 'phone', required: true }}
                    containerStyle={{ width: '100%' }}
                  />
                </div>
                {errors.phone
                  ? <span style={{ fontSize: 11, color: '#F87171', marginTop: 2 }}>{errors.phone}</span>
                  : <span style={{ fontSize: 11, color: '#4A4A6A', marginTop: 2 }}>📱 Please use your WhatsApp-enabled number so we can reach you.</span>
                }
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#7A7A9A' }}>Business Name</label>
                <input className="oss-input" placeholder="Acme Ltd" value={data.businessName} onChange={e => setData(d => ({ ...d, businessName: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 22 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#7A7A9A' }}>What would you like help setting up? (optional)</label>
                <textarea className="oss-input" placeholder="e.g. Connect Gmail and manage my calendar via Telegram..." value={data.notes} onChange={e => setData(d => ({ ...d, notes: e.target.value }))} style={{ resize: 'vertical', minHeight: 72 }} />
              </div>
              <button className="oss-btn-primary" onClick={handleSubmit} disabled={!canSubmit || submitting}
                style={{ width: '100%', padding: '13px', fontSize: 15, opacity: !canSubmit || submitting ? 0.45 : 1 }}>
                {submitting
                  ? (isPrepaid ? 'Preparing payment…' : 'Saving...')
                  : isPrepaid && prepaid
                    ? `Pay ${formatPrice(prepaid.amount, prepaid.currency)} & Book 💳`
                    : hasCalendar
                      ? 'Continue — Pick a Time →'
                      : 'Request My Setup Call 📅'}
              </button>
              <p style={{ fontSize: 11, color: '#4A4A6A', marginTop: 10, textAlign: 'center' }}>🔒 Your information is secure and will never be shared.</p>
            </div>
          ) : (
            <div>
              <h3 className="oc-sg" style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Pick a time for your setup call</h3>
              <p style={{ fontSize: 14, color: '#7A7A9A', marginBottom: 16 }}>Choose a slot that suits you. We&apos;ll send a calendar invite with the call details.</p>
              <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 16 }}>
                {/* eslint-disable-next-line jsx-a11y/iframe-has-title */}
                <iframe src={calendarUrl} width="100%" height="660" style={{ display: 'block', background: '#fff', border: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={{ flex: 1, padding: '11px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#7A7A9A', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600 }} onClick={() => setSuccess(true)}>
                  Skip for now
                </button>
                <button className="oss-btn-primary" onClick={() => setSuccess(true)} style={{ flex: 2, padding: '11px', fontSize: 13 }}>
                  I&apos;ve booked my session ✓
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────
export default function OpenClawSetupServiceLandingPage() {
  const [branding, setBranding] = useState<OCBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [startAtCalendar, setStartAtCalendar] = useState(false);
  const [alias, setAlias] = useState('openclaw-setup');
  const [isDark, setIsDark] = useState(true); // default dark; toggleable

  useEffect(() => {
    const slug = window.location.pathname.replace(/^\//, '') || 'openclaw-setup';
    setAlias(slug);

    // Detect return from Stripe via session_id and verify payment server-side.
    // This replaces the old insecure ?paid=1 client-side check.
    const params = new URLSearchParams(window.location.search);
    const stripeSessionId = params.get('session_id');
    if (stripeSessionId) {
      // Strip the query string immediately so it isn't bookmarked / shared
      window.history.replaceState({}, '', window.location.pathname);
      fetch(`/api/whitelabel/verify-payment/${slug}?session_id=${encodeURIComponent(stripeSessionId)}`)
        .then(r => r.json())
        .then((data: { paid?: boolean }) => {
          if (data.paid) {
            setStartAtCalendar(true);
            setShowOnboarding(true);
          }
        })
        .catch(() => { /* verification failure is silent — user can re-open the form */ });
    }

    fetch(`/api/whitelabel/experience-branding/${slug}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setBranding(d);
          // Honour partner's theme preference
          if (d.themePreference === 'LIGHT') setIsDark(false);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <OSSLoader primary={ORANGE} />;

  const brandName  = branding?.businessName || 'OpenClaw';
  const primary    = branding?.primaryColor || ORANGE;
  const primaryDk  = darkenHex(primary, 8);
  const bg         = isDark ? BG_DARK : BG_LIGHT;
  const textMain   = isDark ? '#E8EAF0' : '#1A1A2E';
  const textMuted  = isDark ? '#9A9AB0' : '#5A5A7A';
  const cardBg     = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
  const cardBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
  const inputBg    = isDark ? '#121322' : '#FFFFFF';

  const characterName = branding?.assistantName || branding?.characterName || 'our expert';
  const heroTitle   = `Get Your ${brandName} AI Set Up — By Experts, With You.`;
  const heroSubtitle = `Skip the trial-and-error. Book a 1-on-1 setup call with ${characterName} and we'll configure your AI agent, connect your apps, and get your personal AI live in one session.`;
  const isPrepaidEnabled = branding?.prepaidBooking?.enabled && (branding.prepaidBooking.amount ?? 0) > 0;
  const ctaText = isPrepaidEnabled
    ? `Book My Setup Call — ${formatPrice(branding!.prepaidBooking!.amount, branding!.prepaidBooking!.currency)} 💳`
    : 'Book My Free Setup Call 📅';

  return (
    <div style={{ background: bg, color: textMain, fontFamily: "'Inter', 'Segoe UI', sans-serif", minHeight: '100vh' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700;800&display=swap');
        :root { scroll-behavior: smooth; }
        .oc-wrap { max-width: 1100px; margin: 0 auto; padding: 0 24px; }
        .oc-section { padding: 96px 0; }
        .oc-card { background: ${cardBg}; border: 1px solid ${cardBorder}; border-radius: 14px; transition: border-color 0.2s; }
        .oc-card:hover { border-color: ${primary}40 !important; }
        .oc-sg { font-family: 'Space Grotesk', sans-serif; }
        .oss-btn-primary { background: linear-gradient(135deg, ${primary}, ${primaryDk}); color: white; font-weight: 700; cursor: pointer; border: none; border-radius: 10px; transition: all 0.2s; }
        .oss-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 0 28px ${primary}70; }
        .oss-input { background: ${inputBg}; border: 1px solid ${cardBorder}; border-radius: 9px; padding: 11px 14px; font-size: 14px; color: ${textMain}; font-family: 'Inter', sans-serif; outline: none; width: 100%; transition: border-color 0.2s; box-sizing: border-box; }
        .oss-input:focus { border-color: ${primary}66; }
        .oss-input::placeholder { color: ${isDark ? '#4A4A6A' : '#9A9AB0'}; }
        .oc-muted { color: ${textMuted}; }
        .oc-dim  { color: ${isDark ? '#7A7A9A' : '#7A7A9A'}; }
      `}</style>

      <OSSNav branding={branding} brandName={brandName} primary={primary} isDark={isDark} onToggleDark={() => setIsDark(d => !d)} onBook={() => setShowOnboarding(true)} prepaid={branding?.prepaidBooking} />
      <OSSHero heroTitle={heroTitle} heroSubtitle={heroSubtitle} ctaText={ctaText} onBook={() => setShowOnboarding(true)} prepaid={branding?.prepaidBooking} primary={primary} />
      <OSSHowItWorks onBook={() => setShowOnboarding(true)} primary={primary} />
      <OSSFeatures onBook={() => setShowOnboarding(true)} primary={primary} />
      <OSSTestimonials primary={primary} />
      <OSSFAQ primary={primary} brandName={brandName} characterName={characterName} prepaid={branding?.prepaidBooking} />
      <OSSCTA onBook={() => setShowOnboarding(true)} primary={primary} prepaid={branding?.prepaidBooking} />
      <OSSFooter branding={branding} brandName={brandName} primary={primary} isDark={isDark} />

      {showOnboarding && (
        <OSSOnboarding
          onClose={() => { setShowOnboarding(false); setStartAtCalendar(false); }}
          alias={alias}
          calendarUrl={branding?.calendarUrl}
          showEmbeddedCalendar={branding?.showEmbeddedCalendar}
          prepaid={branding?.prepaidBooking}
          startAtCalendar={startAtCalendar}
        />
      )}
    </div>
  );
}
