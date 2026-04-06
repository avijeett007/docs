'use client';

/**
 * OpenClaw Auto-Install Landing Page
 *
 * KiloClaw-inspired landing page for the OPENCLAW_AUTOINSTALL experience.
 * Focuses on personal AI setup — Telegram, Gmail, Google Calendar, Notion.
 * 4-step onboarding: Email/Name → Budget → Telegram Token → App Selection.
 */

import { useState, useEffect } from 'react';

// ── Design tokens ─────────────────────────────────────────────────────────────
const OC = '#00C4B4';
const OC_DARK = '#00A89A';
const ORANGE = '#F97316';
const BG = '#070910';

// ── Types ─────────────────────────────────────────────────────────────────────
interface OCBranding {
  logo?: string;
  businessName?: string;
  primaryColor?: string;
  calendarUrl?: string;
}

interface OAIOnboardingData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  budget: string;
  telegramToken: string;
  selectedApps: string[];
}

const SUPPORTED_APPS = [
  { id: 'gmail', label: 'Gmail', icon: '📧', desc: 'Read, draft & send emails' },
  { id: 'google-calendar', label: 'Google Calendar', icon: '📅', desc: 'Schedule & manage events' },
  { id: 'notion', label: 'Notion', icon: '📝', desc: 'Query & update pages' },
  { id: 'slack', label: 'Slack', icon: '💬', desc: 'Coming soon', disabled: true },
  { id: 'hubspot', label: 'HubSpot', icon: '📊', desc: 'Coming soon', disabled: true },
  { id: 'linear', label: 'Linear', icon: '🔷', desc: 'Coming soon', disabled: true },
];

const BUDGET_OPTIONS = [
  'Under $50/mo',
  '$50 – $100/mo',
  '$100 – $300/mo',
  '$300 – $500/mo',
  '$500+/mo',
];

// ── Small helpers ─────────────────────────────────────────────────────────────
function GradientText({ children }: { children: React.ReactNode }) {
  return <span style={{ background: `linear-gradient(135deg, ${OC}, ${ORANGE})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{children}</span>;
}
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `rgba(0,196,180,0.1)`, border: `1px solid rgba(0,196,180,0.22)`, borderRadius: 8, padding: '4px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: OC, marginBottom: 12 }}>{children}</div>;
}
function Badge({ children }: { children: React.ReactNode }) {
  return <span style={{ background: `rgba(0,196,180,0.1)`, border: `1px solid rgba(0,196,180,0.22)`, borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 600, color: OC }}>{children}</span>;
}
function OAILoader() {
  return <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 40, height: 40, border: `3px solid rgba(0,196,180,0.2)`, borderTopColor: OC, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></div>;
}

// ── Nav ───────────────────────────────────────────────────────────────────────
function OAINav({ branding, brandName, primaryColor, onGetStarted }: { branding: OCBranding | null; brandName: string; primaryColor: string; onGetStarted: () => void }) {
  return (
    <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200, background: 'rgba(7,9,16,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0 24px' }}>
      <div className="oc-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {branding?.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logo} alt={brandName} style={{ height: 36, objectFit: 'contain' }} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em', color: '#E8EAF0' }}>
              <svg width="36" height="36" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="38" height="38" rx="10" fill="#0D0E1A"/>
                <path d="M10 28 C9 24 11 19 14 15 C16 12 18.5 11 18.5 11" stroke={OC} strokeWidth="2.4" strokeLinecap="round"/>
                <path d="M18.5 28 C18 23 19.5 18 21 15 C22 12.5 18.5 11 18.5 11" stroke={OC} strokeWidth="2.4" strokeLinecap="round"/>
                <path d="M27 28 C28.5 24 27 19 24 15 C22 12 18.5 11 18.5 11" stroke={OC} strokeWidth="2.4" strokeLinecap="round"/>
                <circle cx="18.5" cy="8.5" r="2.5" fill={OC}/>
                <path d="M7 11 L7 19 M7 15 L11.5 11 M7 15 L11.5 19" stroke={ORANGE} strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
              <span>Open<span style={{ color: primaryColor }}>Claw</span></span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }} className="oc-nav-links">
          {[['#how', 'How it Works'], ['#features', 'Features'], ['#faq', 'FAQ']].map(([href, label]) => (
            <a key={href} href={href} style={{ color: '#7A7A9A', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>{label}</a>
          ))}
        </div>
        <button className="oc-btn-primary" onClick={onGetStarted} style={{ padding: '9px 20px', fontSize: 13 }}>
          Get Started Free ⚡
        </button>
      </div>
    </nav>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────
function OAIHero({ heroTitle, heroSubtitle, ctaText, primaryColor, onGetStarted }: {
  heroTitle: string; heroSubtitle: string; ctaText: string; primaryColor: string; onGetStarted: () => void;
}) {
  return (
    <section style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', paddingTop: 80 }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes fadein { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        .oc-wrap { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
        .oc-section { padding: 96px 0; }
        .oc-btn-primary { background: linear-gradient(135deg, #00C4B4, #009E90); color: #fff; border: none; border-radius: 10px; font-weight: 700; cursor: pointer; font-family: 'Inter', sans-serif; transition: opacity 0.2s, transform 0.15s; }
        .oc-btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }
        .oc-btn-secondary { background: rgba(255,255,255,0.05); color: #E8EAF0; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; font-weight: 600; cursor: pointer; font-family: 'Inter', sans-serif; transition: background 0.2s; }
        .oc-btn-secondary:hover { background: rgba(255,255,255,0.09); }
        .oc-input { background: #0D0E1A; border: 1px solid rgba(255,255,255,0.1); color: #E8EAF0; border-radius: 10px; padding: 11px 14px; font-size: 14px; outline: none; font-family: 'Inter', sans-serif; width: 100%; box-sizing: border-box; }
        .oc-input:focus { border-color: #00C4B4; box-shadow: 0 0 0 3px rgba(0,196,180,0.12); }
        .oc-sg { color: #E8EAF0; font-family: 'Space Grotesk', 'Inter', sans-serif; margin: 0; }
        .oc-nav-links a:hover { color: #00C4B4 !important; }
        @media (max-width: 640px) { .oc-nav-links { display: none !important; } }
      `}</style>
      <div className="oc-wrap" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center', animation: 'fadein 0.6s ease' }}>
        <div>
          <Badge>⚡ One-Click Setup</Badge>
          <h1 className="oc-sg" style={{ fontSize: 'clamp(30px,4.5vw,56px)', fontWeight: 900, lineHeight: 1.1, letterSpacing: '-0.03em', margin: '20px 0 18px' }}>
            <GradientText>{heroTitle}</GradientText>
          </h1>
          <p style={{ fontSize: 18, color: '#7A7A9A', lineHeight: 1.8, marginBottom: 36 }}>{heroSubtitle}</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button className="oc-btn-primary" onClick={onGetStarted} style={{ padding: '14px 28px', fontSize: 16 }}>{ctaText}</button>
            <a href="#how" className="oc-btn-secondary" style={{ padding: '14px 24px', fontSize: 15, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>How it works →</a>
          </div>
          <div style={{ marginTop: 28, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {['📱 No app install', '⚡ Live in 2 min', '🔒 100% private'].map(t => (
              <span key={t} style={{ fontSize: 13, color: '#7A7A9A' }}>{t}</span>
            ))}
          </div>
        </div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* Decorative "phone" mockup */}
          <div style={{ width: 280, background: '#0D0E1A', border: `2px solid rgba(0,196,180,0.25)`, borderRadius: 28, padding: 20, boxShadow: `0 0 80px rgba(0,196,180,0.12)`, animation: 'float 4s ease-in-out infinite' }}>
            <div style={{ background: '#181830', borderRadius: 16, padding: '16px 14px', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg, ${primaryColor}, #009E90)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🤖</div>
                <div><div style={{ fontSize: 11, fontWeight: 700, color: '#E8EAF0' }}>Your AI Assistant</div><div style={{ fontSize: 10, color: '#4A4A6A' }}>Telegram</div></div>
              </div>
              {[
                { from: 'You', msg: 'What\'s on my calendar today?', align: 'flex-end', bg: `rgba(0,196,180,0.12)` },
                { from: 'AI', msg: '3 meetings: 9am standup, 11am client call, 2pm review. Want me to prep your notes?', align: 'flex-start', bg: '#0D0E1A' },
                { from: 'You', msg: 'Yes please!', align: 'flex-end', bg: `rgba(0,196,180,0.12)` },
              ].map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: m.align, marginBottom: 8 }}>
                  <div style={{ background: m.bg, border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '8px 10px', maxWidth: '82%', fontSize: 11, color: '#C8CAD8', lineHeight: 1.5 }}>{m.msg}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              {[['📧', 'Gmail'], ['📅', 'Calendar'], ['📝', 'Notion']].map(([ic, lbl]) => (
                <div key={lbl} style={{ background: '#181830', borderRadius: 10, padding: '8px 4px', textAlign: 'center', border: '1px solid rgba(0,196,180,0.12)' }}>
                  <div style={{ fontSize: 18 }}>{ic}</div><div style={{ fontSize: 9, color: OC, fontWeight: 700 }}>{lbl}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── How it works ───────────────────────────────────────────────────────────────
function OAIHowItWorks({ primaryColor, onGetStarted }: { primaryColor: string; onGetStarted: () => void }) {
  const steps = [
    { num: '1', icon: '📝', title: 'Enter Your Details', desc: 'Tell us your name and email. Takes 30 seconds.' },
    { num: '2', icon: '🤖', title: 'Get Your Telegram Bot', desc: 'Open @BotFather on Telegram, create a bot, and paste the token.' },
    { num: '3', icon: '🔗', title: 'Connect Your Apps', desc: 'Pick Gmail, Google Calendar, Notion and more — we auto-connect everything.' },
    { num: '4', icon: '🚀', title: 'Go Live', desc: 'Your personal AI is live in Telegram. Start chatting and getting things done.' },
  ];
  return (
    <section className="oc-section" id="how" style={{ background: '#0A0B14' }}>
      <div className="oc-wrap">
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <SectionLabel>How it Works</SectionLabel>
          <h2 className="oc-sg" style={{ fontSize: 'clamp(26px,3.5vw,44px)', fontWeight: 800, letterSpacing: '-0.025em', marginBottom: 12 }}>Setup in under <GradientText>2 minutes</GradientText></h2>
          <p style={{ fontSize: 16, color: '#7A7A9A', maxWidth: 520, margin: '0 auto' }}>No developers, no app installs, no waiting. Just four simple steps.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ background: '#0D0E1A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 24 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `rgba(0,196,180,0.1)`, border: `1px solid rgba(0,196,180,0.2)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 14 }}>{s.icon}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: primaryColor, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Step {s.num}</div>
              <h4 className="oc-sg" style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{s.title}</h4>
              <p style={{ fontSize: 13, color: '#7A7A9A', lineHeight: 1.7, margin: 0 }}>{s.desc}</p>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 40 }}>
          <button className="oc-btn-primary" onClick={onGetStarted} style={{ padding: '13px 32px', fontSize: 15 }}>Start My Setup ⚡</button>
        </div>
      </div>
    </section>
  );
}

// ── Features ──────────────────────────────────────────────────────────────────
const DEFAULT_FEATURES = [
  { icon: '📱', title: 'Lives in Telegram', desc: 'No app to install. Your AI lives in Telegram — just message it.' },
  { icon: '🔗', title: 'Connects Your Apps', desc: 'Gmail, Google Calendar, Notion and more — auto-connected in one click.' },
  { icon: '⚡', title: 'One-Click Setup', desc: 'Paste your token, select apps, hit submit. Done in 2 minutes.' },
  { icon: '📧', title: 'Reads & Drafts Emails', desc: 'Ask it to check your inbox, summarise threads, or draft replies instantly.' },
  { icon: '📅', title: 'Manages Your Calendar', desc: 'Schedule meetings, daily briefings, and reschedule — all via chat.' },
  { icon: '📈', title: 'Always Learning You', desc: 'The more you use it, the better it knows your preferences and style.' },
];

function OAIFeatures({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <section className="oc-section" id="features" style={{ background: BG }}>
      <div className="oc-wrap">
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <SectionLabel>Features</SectionLabel>
          <h2 className="oc-sg" style={{ fontSize: 'clamp(26px,3.5vw,44px)', fontWeight: 800, letterSpacing: '-0.025em', marginBottom: 12 }}>Your AI. <GradientText>Your Apps. Your Way.</GradientText></h2>
          <p style={{ fontSize: 16, color: '#7A7A9A', maxWidth: 520, margin: '0 auto' }}>Everything a personal assistant should do — minus the salary.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {DEFAULT_FEATURES.map((f, i) => (
            <div key={i} style={{ background: '#0D0E1A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '22px 20px', transition: 'border-color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(0,196,180,0.3)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
              <h4 className="oc-sg" style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{f.title}</h4>
              <p style={{ fontSize: 13, color: '#7A7A9A', lineHeight: 1.7, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 44 }}>
          <button className="oc-btn-primary" onClick={onGetStarted} style={{ padding: '13px 32px', fontSize: 15 }}>Get My Personal AI ⚡</button>
        </div>
      </div>
    </section>
  );
}

// ── Social proof ──────────────────────────────────────────────────────────────
const DEFAULT_TESTIMONIALS = [
  { name: 'Jamie O\'Brien', role: 'Freelance Consultant', initials: 'JO', content: 'Set it up in 90 seconds. Now my Telegram bot handles my calendar, emails and Notion. Like having an EA for free.' },
  { name: 'Aisha Mensah', role: 'Startup Founder', initials: 'AM', content: 'The one-click setup was not a gimmick. Picked apps, pasted token — working instantly. Unreal.' },
  { name: 'Daniel Kozlowski', role: 'Remote Product Manager', initials: 'DK', content: 'I ask my Telegram bot to summarise unread emails every morning. Saves me 45 minutes a day.' },
];

function OAITestimonials() {
  return (
    <section className="oc-section" style={{ background: '#0A0B14' }}>
      <div className="oc-wrap">
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <SectionLabel>Testimonials</SectionLabel>
          <h2 className="oc-sg" style={{ fontSize: 'clamp(24px,3.5vw,40px)', fontWeight: 800, letterSpacing: '-0.025em' }}>Loved by early adopters.</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {DEFAULT_TESTIMONIALS.map((t, i) => (
            <div key={i} style={{ background: '#0D0E1A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '22px 20px' }}>
              <div style={{ color: OC, fontSize: 14, marginBottom: 12 }}>{'★'.repeat(5)}</div>
              <p style={{ fontSize: 14, color: '#C8CAD8', lineHeight: 1.8, marginBottom: 18 }}>&ldquo;{t.content}&rdquo;</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: `linear-gradient(135deg, ${OC}, #009E90)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#070910' }}>{t.initials}</div>
                <div><div style={{ fontSize: 13, fontWeight: 700, color: '#E8EAF0' }}>{t.name}</div><div style={{ fontSize: 12, color: '#7A7A9A' }}>{t.role}</div></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── FAQ ────────────────────────────────────────────────────────────────────────
const DEFAULT_FAQS = [
  { q: 'Do I need to install an app?', a: 'No. Your personal AI lives in Telegram — which you probably already have. Just connect it and start chatting.' },
  { q: 'How do I get a Telegram Bot Token?', a: 'Open Telegram and message @BotFather. Type /newbot, follow the prompts, and it gives you a token. Paste it during setup — done.' },
  { q: 'Which apps can it connect to?', a: 'Currently Gmail, Google Calendar, and Notion. More (Slack, HubSpot, Linear) are coming soon.' },
  { q: 'Is my data private?', a: 'Your data stays between you and your connected apps. We never read, store or share your emails, calendar events, or documents.' },
  { q: 'How long does setup take?', a: 'Less than 2 minutes. Enter your name and email, paste your Telegram token, select apps, and hit submit.' },
];

function OAIFAQ() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section className="oc-section" id="faq" style={{ background: BG }}>
      <div className="oc-wrap">
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <SectionLabel>FAQ</SectionLabel>
          <h2 className="oc-sg" style={{ fontSize: 'clamp(24px,3.5vw,40px)', fontWeight: 800, letterSpacing: '-0.025em' }}>Common questions.</h2>
        </div>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          {DEFAULT_FAQS.map((faq, i) => (
            <div key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <button onClick={() => setOpen(open === i ? null : i)}
                style={{ width: '100%', background: 'none', border: 'none', color: open === i ? OC : '#E8EAF0', fontSize: 15, fontWeight: 500, padding: '20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', textAlign: 'left', fontFamily: "'Inter', sans-serif", gap: 16 }}>
                {faq.q}
                <span style={{ color: OC, fontSize: 18, flexShrink: 0 }}>{open === i ? '−' : '+'}</span>
              </button>
              {open === i && <div style={{ fontSize: 14, color: '#7A7A9A', lineHeight: 1.8, paddingBottom: 20 }}>{faq.a}</div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Onboarding modal ───────────────────────────────────────────────────────────
function OAIOnboarding({
  onClose, alias, calendarUrl,
}: {
  onClose: () => void; alias: string; calendarUrl?: string;
}) {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [data, setData] = useState<OAIOnboardingData>({
    firstName: '', lastName: '', email: '', phone: '',
    budget: '', telegramToken: '', selectedApps: [],
  });

  const hasCalendar = Boolean(calendarUrl);
  const totalSteps = hasCalendar ? 5 : 4;
  const stepLabels = hasCalendar
    ? ['Your Info', 'Budget', 'Telegram', 'Apps', 'Book a Call']
    : ['Your Info', 'Budget', 'Telegram', 'Apps'];

  const progress = success ? 100 : Math.round(((step + 1) / totalSteps) * 100);

  const toggleApp = (appId: string) => {
    setData(d => ({ ...d, selectedApps: d.selectedApps.includes(appId) ? d.selectedApps.filter(a => a !== appId) : [...d.selectedApps, appId] }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const serviceCategories = {
        serviceType: 'OPENCLAW_AUTOINSTALL',
        budget: data.budget,
        telegramToken: data.telegramToken,
        selectedApps: data.selectedApps,
      };
      await fetch(`/api/whitelabel/experience-leads/${alias}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: data.firstName, lastName: data.lastName,
          email: data.email, phone: data.phone,
          businessName: `${data.firstName} ${data.lastName}`.trim(),
          serviceCategories,
        }),
      });
      if (hasCalendar) { setStep(4); } else { setSuccess(true); }
    } catch { /* show success anyway */ setSuccess(true); }
    finally { setSubmitting(false); }
  };

  const canNext = () => {
    if (step === 0) return data.firstName.trim() && data.email.trim();
    if (step === 1) return Boolean(data.budget);
    if (step === 2) return data.telegramToken.trim().length > 10;
    if (step === 3) return data.selectedApps.length > 0;
    return true;
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(4,5,10,0.88)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#0D0E1A', border: `1px solid rgba(0,196,180,0.25)`, borderRadius: 20, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 40px 80px rgba(0,0,0,0.6)' }}>
        <div style={{ padding: '20px 24px 0', position: 'relative' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, width: 28, height: 28, borderRadius: '50%', background: '#181830', border: '1px solid rgba(255,255,255,0.07)', color: '#7A7A9A', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>✕</button>
          {!success && step < totalSteps - (hasCalendar ? 1 : 0) && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ height: 3, background: '#181830', borderRadius: 2, overflow: 'hidden', marginBottom: 12 }}>
                <div style={{ height: '100%', background: `linear-gradient(90deg, ${OC}, ${ORANGE})`, borderRadius: 2, width: `${progress}%`, transition: 'width 0.4s' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {stepLabels.map((s, i) => (
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
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: `linear-gradient(135deg, ${OC}, ${OC_DARK})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, margin: '0 auto 20px', boxShadow: `0 0 40px rgba(0,196,180,0.3)` }}>🤖</div>
              <h3 className="oc-sg" style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>You&apos;re on the list!</h3>
              <p style={{ fontSize: 15, color: '#7A7A9A', lineHeight: 1.7, marginBottom: 24 }}>Our team will connect your apps and have your personal AI live in Telegram within 24 hours.</p>
              {[['⚡', 'Auto-Setup', 'We configure your AI overnight'], ['📱', 'Telegram Activation', 'Your bot goes live in your chat'], ['🔗', 'App Connections', 'Gmail, Calendar & Notion linked']].map(([ic, h, d]) => (
                <div key={h} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: '#121322', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '13px 16px', textAlign: 'left', marginBottom: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(0,196,180,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{ic}</div>
                  <div><h5 style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{h}</h5><p style={{ fontSize: 12, color: '#7A7A9A', margin: 0 }}>{d}</p></div>
                </div>
              ))}
              <button className="oc-btn-primary" onClick={onClose} style={{ marginTop: 16, padding: '12px 32px', fontSize: 14 }}>Close</button>
            </div>
          ) : step === 0 ? (
            <div>
              <h3 className="oc-sg" style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Tell us about yourself</h3>
              <p style={{ fontSize: 14, color: '#7A7A9A', marginBottom: 20 }}>We&apos;ll use this to set up your personal AI.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div><label style={{ fontSize: 12, color: '#7A7A9A', fontWeight: 600, display: 'block', marginBottom: 6 }}>First Name *</label><input className="oc-input" placeholder="Jane" value={data.firstName} onChange={e => setData(d => ({ ...d, firstName: e.target.value }))} /></div>
                <div><label style={{ fontSize: 12, color: '#7A7A9A', fontWeight: 600, display: 'block', marginBottom: 6 }}>Last Name</label><input className="oc-input" placeholder="Smith" value={data.lastName} onChange={e => setData(d => ({ ...d, lastName: e.target.value }))} /></div>
              </div>
              <div style={{ marginBottom: 12 }}><label style={{ fontSize: 12, color: '#7A7A9A', fontWeight: 600, display: 'block', marginBottom: 6 }}>Email *</label><input className="oc-input" type="email" placeholder="jane@example.com" value={data.email} onChange={e => setData(d => ({ ...d, email: e.target.value }))} /></div>
              <div style={{ marginBottom: 24 }}><label style={{ fontSize: 12, color: '#7A7A9A', fontWeight: 600, display: 'block', marginBottom: 6 }}>Phone (optional)</label><input className="oc-input" type="tel" placeholder="+44 7700 000000" value={data.phone} onChange={e => setData(d => ({ ...d, phone: e.target.value }))} /></div>
              <button className="oc-btn-primary" onClick={() => setStep(1)} disabled={!canNext()} style={{ width: '100%', padding: '13px', fontSize: 15, opacity: canNext() ? 1 : 0.4 }}>Continue →</button>
            </div>
          ) : step === 1 ? (
            <div>
              <h3 className="oc-sg" style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>What&apos;s your budget?</h3>
              <p style={{ fontSize: 14, color: '#7A7A9A', marginBottom: 20 }}>Helps us recommend the right AI setup for you.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                {BUDGET_OPTIONS.map(opt => (
                  <button key={opt} onClick={() => setData(d => ({ ...d, budget: opt }))}
                    style={{ padding: '13px 16px', borderRadius: 10, border: `1px solid ${data.budget === opt ? OC : 'rgba(255,255,255,0.1)'}`, background: data.budget === opt ? 'rgba(0,196,180,0.1)' : '#181830', color: data.budget === opt ? OC : '#7A7A9A', fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {opt} {data.budget === opt && <span>✓</span>}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="oc-btn-secondary" onClick={() => setStep(0)} style={{ flex: 1, padding: '12px' }}>← Back</button>
                <button className="oc-btn-primary" onClick={() => setStep(2)} disabled={!canNext()} style={{ flex: 2, padding: '12px', opacity: canNext() ? 1 : 0.4 }}>Continue →</button>
              </div>
            </div>
          ) : step === 2 ? (
            <div>
              <h3 className="oc-sg" style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Connect Telegram</h3>
              <p style={{ fontSize: 14, color: '#7A7A9A', marginBottom: 8 }}>Your AI lives in Telegram. Get your bot token from <strong style={{ color: OC }}>@BotFather</strong> in 60 seconds.</p>
              <div style={{ background: '#121322', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                {[['1.', 'Open Telegram → search @BotFather'], ['2.', 'Send /newbot and follow prompts'], ['3.', 'Copy the token it gives you → paste below']].map(([n, t]) => (
                  <div key={n} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 13, color: '#7A7A9A' }}><span style={{ color: OC, fontWeight: 700 }}>{n}</span>{t}</div>
                ))}
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 12, color: '#7A7A9A', fontWeight: 600, display: 'block', marginBottom: 6 }}>Telegram Bot Token *</label>
                <input className="oc-input" placeholder="1234567890:ABCDEFabcdef..." value={data.telegramToken} onChange={e => setData(d => ({ ...d, telegramToken: e.target.value }))} style={{ fontFamily: 'monospace', fontSize: 13 }} />
                <div style={{ fontSize: 11, color: '#4A4A6A', marginTop: 6 }}>🔒 Stored securely and only used to connect your bot.</div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="oc-btn-secondary" onClick={() => setStep(1)} style={{ flex: 1, padding: '12px' }}>← Back</button>
                <button className="oc-btn-primary" onClick={() => setStep(3)} disabled={!canNext()} style={{ flex: 2, padding: '12px', opacity: canNext() ? 1 : 0.4 }}>Continue →</button>
              </div>
            </div>
          ) : step === 3 ? (
            <div>
              <h3 className="oc-sg" style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Which apps should we connect?</h3>
              <p style={{ fontSize: 14, color: '#7A7A9A', marginBottom: 20 }}>Select the tools your AI should have access to. You can add more later.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
                {SUPPORTED_APPS.map(app => {
                  const selected = data.selectedApps.includes(app.id);
                  return (
                    <button key={app.id} onClick={() => !app.disabled && toggleApp(app.id)} disabled={app.disabled}
                      style={{ padding: '14px 12px', borderRadius: 12, border: `1px solid ${selected ? OC : 'rgba(255,255,255,0.08)'}`, background: selected ? 'rgba(0,196,180,0.1)' : '#181830', cursor: app.disabled ? 'not-allowed' : 'pointer', opacity: app.disabled ? 0.4 : 1, textAlign: 'left', transition: 'all 0.2s' }}>
                      <div style={{ fontSize: 22, marginBottom: 4 }}>{app.icon}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: selected ? OC : '#E8EAF0', marginBottom: 2 }}>{app.label}</div>
                      <div style={{ fontSize: 11, color: '#7A7A9A' }}>{app.desc}</div>
                      {selected && <div style={{ fontSize: 11, color: OC, marginTop: 4, fontWeight: 700 }}>✓ Selected</div>}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="oc-btn-secondary" onClick={() => setStep(2)} style={{ flex: 1, padding: '12px' }}>← Back</button>
                <button className="oc-btn-primary" onClick={handleSubmit} disabled={submitting || !canNext()} style={{ flex: 2, padding: '12px', opacity: submitting || !canNext() ? 0.4 : 1 }}>
                  {submitting ? 'Submitting...' : hasCalendar ? 'Submit & Book Call →' : 'Submit & Get Started ⚡'}
                </button>
              </div>
            </div>
          ) : step === 4 && hasCalendar ? (
            <div>
              <h3 className="oc-sg" style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Book your onboarding call</h3>
              <p style={{ fontSize: 14, color: '#7A7A9A', marginBottom: 16 }}>Pick a time and we&apos;ll walk you through your personal AI setup on the call.</p>
              <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 16 }}>
                {/* eslint-disable-next-line jsx-a11y/iframe-has-title */}
                <iframe src={calendarUrl} width="100%" height="480" style={{ display: 'block', background: '#fff', border: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="oc-btn-secondary" onClick={() => setSuccess(true)} style={{ flex: 1, padding: '11px', fontSize: 13 }}>Skip for now</button>
                <button className="oc-btn-primary" onClick={() => setSuccess(true)} style={{ flex: 2, padding: '11px', fontSize: 13 }}>I&apos;ve booked my call ✓</button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── Footer ─────────────────────────────────────────────────────────────────────
function OAIFooter({ branding, brandName }: { branding: OCBranding | null; brandName: string }) {
  return (
    <footer style={{ background: '#0A0B14', borderTop: '1px solid rgba(255,255,255,0.07)', padding: '40px 0 24px' }}>
      <div className="oc-wrap" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 18, color: '#E8EAF0' }}>
          Open<span style={{ color: OC }}>Claw</span>
        </div>
        <p style={{ fontSize: 12, color: '#4A4A6A', margin: 0 }}>© {new Date().getFullYear()} {brandName}. All rights reserved.</p>
        <div style={{ display: 'flex', gap: 16 }}>
          {branding && 'privacyPolicyUrl' in branding && (branding as { privacyPolicyUrl?: string }).privacyPolicyUrl && (
            <a href={(branding as { privacyPolicyUrl?: string }).privacyPolicyUrl} style={{ fontSize: 12, color: '#4A4A6A', textDecoration: 'none' }}>Privacy</a>
          )}
          {branding && 'termsOfServiceUrl' in branding && (branding as { termsOfServiceUrl?: string }).termsOfServiceUrl && (
            <a href={(branding as { termsOfServiceUrl?: string }).termsOfServiceUrl} style={{ fontSize: 12, color: '#4A4A6A', textDecoration: 'none' }}>Terms</a>
          )}
        </div>
      </div>
    </footer>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────
export default function OpenClawAutoInstallLandingPage() {
  const [branding, setBranding] = useState<OCBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [alias, setAlias] = useState('openclaw-autoinstall');

  useEffect(() => {
    const slug = window.location.pathname.replace(/^\//, '') || 'openclaw-autoinstall';
    setAlias(slug);
    fetch(`/api/whitelabel/experience-branding/${slug}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setBranding(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <OAILoader />;

  const primaryColor = branding?.primaryColor || OC;
  const brandName = branding?.businessName || 'OpenClaw';
  const heroTitle = 'Your Personal AI. One Click. No Tech Skills Needed.';
  const heroSubtitle = 'Connect Gmail, Google Calendar, Notion and more to a personal AI that lives in Telegram. Ask it anything. Automate your day.';
  const ctaText = 'Get My Personal AI ⚡';

  return (
    <div style={{ background: BG, color: '#E8EAF0', fontFamily: "'Inter', 'Segoe UI', sans-serif", minHeight: '100vh' }}>
      <OAINav branding={branding} brandName={brandName} primaryColor={primaryColor} onGetStarted={() => setShowOnboarding(true)} />
      <OAIHero heroTitle={heroTitle} heroSubtitle={heroSubtitle} ctaText={ctaText} primaryColor={primaryColor} onGetStarted={() => setShowOnboarding(true)} />
      <OAIHowItWorks primaryColor={primaryColor} onGetStarted={() => setShowOnboarding(true)} />
      <OAIFeatures onGetStarted={() => setShowOnboarding(true)} />
      <OAITestimonials />
      <OAIFAQ />
      <OAIFooter branding={branding} brandName={brandName} />
      {showOnboarding && (
        <OAIOnboarding onClose={() => setShowOnboarding(false)} alias={alias} calendarUrl={branding?.calendarUrl} />
      )}
    </div>
  );
}

