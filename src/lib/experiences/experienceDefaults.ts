/**
 * Default Landing Page Content per Experience Type
 *
 * These defaults are used when a partner hasn't customized the landing page.
 * Partners can override any of these via the landingPageConfig JSON field.
 */

import { ExperienceType, LandingPageConfig } from '@/types/experience';

/**
 * Default landing page content for each experience type.
 * The AI Receptionist defaults mirror the existing SaaS landing page content.
 * The AI Personal Assistant defaults are inspired by myclaw.ai.
 */
export const EXPERIENCE_LANDING_DEFAULTS: Record<ExperienceType, LandingPageConfig> = {
  [ExperienceType.AI_RECEPTIONIST]: {
    heroTitle: 'Your AI Receptionist, Always On Duty',
    heroSubtitle: 'Never miss a call again. Our AI receptionist handles incoming calls, books appointments, and answers customer questions — 24/7.',
    ctaText: 'Get Started Free',
    features: [
      { title: '24/7 Call Handling', description: 'Your AI receptionist never sleeps. Every call is answered professionally, day or night.', icon: 'FiPhone' },
      { title: 'Smart Appointment Booking', description: 'Automatically schedule appointments and sync with your calendar in real-time.', icon: 'FiCalendar' },
      { title: 'Instant FAQ Answers', description: 'Trained on your business knowledge to answer common questions accurately.', icon: 'FiMessageCircle' },
      { title: 'Call Routing & Transfer', description: 'Intelligently routes calls to the right team member when human help is needed.', icon: 'FiUsers' },
      { title: 'Multi-Language Support', description: 'Communicate with customers in their preferred language seamlessly.', icon: 'FiGlobe' },
      { title: 'Real-Time Analytics', description: 'Track call volumes, common questions, and customer satisfaction metrics.', icon: 'FiBarChart' },
    ],
    testimonials: [
      { name: 'Sarah Johnson', role: 'Dental Practice Owner', content: 'We reduced missed calls by 90% and our patients love the instant responses.', rating: 5 },
      { name: 'Mike Chen', role: 'Law Firm Partner', content: 'The AI receptionist handles intake calls perfectly. It paid for itself in the first week.', rating: 5 },
      { name: 'Lisa Rodriguez', role: 'Real Estate Agent', content: 'I never miss a lead now. The AI books showings while I\'m with other clients.', rating: 5 },
    ],
    faqs: [
      { question: 'How quickly can I get started?', answer: 'You can have your AI receptionist up and running in under 10 minutes. Just complete the onboarding steps and your AI agent will be ready to take calls.' },
      { question: 'Can the AI handle complex questions?', answer: 'Yes! The AI is trained on your specific business knowledge base and can handle a wide range of questions. For anything it can\'t answer, it seamlessly transfers to a human.' },
      { question: 'What happens if a caller needs a real person?', answer: 'The AI can transfer calls to your team members, take messages, or schedule callbacks based on your preferences.' },
      { question: 'Is there a free trial?', answer: 'Yes, most of our partners offer a free trial period so you can experience the AI receptionist before committing.' },
    ],
  },

  [ExperienceType.AI_PERSONAL_ASSISTANT]: {
    heroTitle: 'Your Personal AI Assistant on WhatsApp',
    heroSubtitle: 'Meet your new AI-powered personal assistant. Manage your schedule, get instant answers, and stay organized — all through WhatsApp.',
    ctaText: 'Get Your AI Assistant',
    features: [
      { title: 'WhatsApp Native', description: 'No new apps to download. Your AI assistant lives right in WhatsApp where you already are.', icon: 'FiMessageCircle' },
      { title: 'Smart Scheduling', description: 'Manage your calendar, set reminders, and never miss an important meeting again.', icon: 'FiCalendar' },
      { title: 'Task Management', description: 'Create to-do lists, set priorities, and get gentle reminders to stay on track.', icon: 'FiCheckSquare' },
      { title: 'Instant Research', description: 'Ask any question and get well-researched answers in seconds.', icon: 'FiSearch' },
      { title: 'Email Drafting', description: 'Compose professional emails and messages with AI assistance.', icon: 'FiMail' },
      { title: 'Always Available', description: 'Your assistant is available 24/7, ready to help whenever you need it.', icon: 'FiClock' },
    ],
    testimonials: [
      { name: 'David Park', role: 'Startup Founder', content: 'Having an AI assistant on WhatsApp changed how I manage my day. It\'s like having a chief of staff in my pocket.', rating: 5 },
      { name: 'Amanda Foster', role: 'Freelance Consultant', content: 'I save at least 2 hours a day. The AI handles scheduling and research while I focus on client work.', rating: 5 },
      { name: 'James Wilson', role: 'Small Business Owner', content: 'The best part is I didn\'t have to learn any new tools. It just works in WhatsApp.', rating: 5 },
    ],
    faqs: [
      { question: 'How does it work?', answer: 'After onboarding, you\'ll receive a WhatsApp number for your AI assistant. Simply message it like you would a human assistant — ask questions, set reminders, manage tasks, and more.' },
      { question: 'Is my data secure?', answer: 'Absolutely. All conversations are encrypted end-to-end through WhatsApp, and we never share your data with third parties.' },
      { question: 'Can it integrate with my calendar?', answer: 'Yes! Your AI assistant can connect with Google Calendar, Outlook, and other popular calendar apps to manage your schedule.' },
      { question: 'What can I ask it?', answer: 'Almost anything! From scheduling meetings and setting reminders to researching topics and drafting emails. The more you use it, the better it understands your preferences.' },
    ],
  },

  [ExperienceType.OPENCLAW_WHITELABEL_SERVICE]: {
    heroTitle: 'Stop Doing Everything Yourself. Get a Full AI Team Working 24/7.',
    heroSubtitle: 'Imagine having a Marketing Manager, Sales Assistant, Customer Support rep, and Operations coordinator — all working around the clock, knowing your business inside out. That\'s what we build for you.',
    ctaText: 'Get My FREE AI Blueprint 🗺️',
    features: [
      { title: 'Full AI Team Setup', description: 'We build and configure your complete AI team — each specialist with a defined role and deep knowledge of your business.', icon: 'FiUsers' },
      { title: 'WhatsApp, Email & More', description: 'Your AI team lives in the tools you already use — WhatsApp, Slack, Email, Telegram, and more.', icon: 'FiMessageCircle' },
      { title: 'Actually Takes Action', description: 'Not just chat — your AI team sends emails, books meetings, posts content, and follows up on leads automatically.', icon: 'FiZap' },
      { title: '24/7 Operation', description: 'Leads enquire at midnight? Customers need help on weekends? Your AI team is always on, never sleeps.', icon: 'FiClock' },
      { title: 'Built Around YOUR Business', description: 'Every AI team member is trained on your business knowledge, voice, and preferences — not a generic template.', icon: 'FiShield' },
      { title: 'Live in 48 Hours', description: 'From discovery call to a live AI team in under 48 hours. No lengthy onboarding, no technical headaches.', icon: 'FiTrendingUp' },
    ],
    testimonials: [
      { name: 'Marcus Webb', role: 'Agency Owner, London', content: 'I sold 3 AI team setups in the first week of enabling this. My clients are blown away by what\'s possible.', rating: 5 },
      { name: 'Priya Sharma', role: 'E-commerce Founder', content: 'The AI handles 80% of our customer support and all social media scheduling. It paid for itself in 10 days.', rating: 5 },
      { name: 'Tom Callahan', role: 'Real Estate Broker', content: 'ARIA — our AI Chief of Staff — coordinates our entire outreach pipeline. I\'ve saved 30+ hours a week.', rating: 5 },
    ],
    faqs: [
      { question: 'What is included in the AI team setup?', answer: 'We configure a suite of AI specialists tailored to your business — typically including a Chief of Staff (ARIA), a Sales Assistant, a Customer Support Agent, a Social Media Manager, and an Operations Coordinator. The exact team depends on your needs.' },
      { question: 'How long does setup take?', answer: 'Most AI teams go live within 48 hours of your discovery call. We handle all the technical setup — you just need to answer questions about your business.' },
      { question: 'What tools do the AI agents work in?', answer: 'Your AI team integrates with the tools you already use: WhatsApp, Email, Slack, Telegram, Discord, Google Calendar, Notion, and more. No new apps to learn.' },
      { question: 'Is my business data secure?', answer: 'Yes. Your AI team runs on a private system — your data is never shared with other businesses or used to train generic AI models.' },
      { question: 'Can I upgrade or add more AI team members later?', answer: 'Absolutely. You can start with a core team and expand as your business grows. Additional specialists can be added at any time.' },
    ],
  },

  [ExperienceType.OPENCLAW_AUTOINSTALL]: {
    heroTitle: 'Your Personal AI. One Click. No Tech Skills Needed.',
    heroSubtitle: 'Connect your Gmail, Google Calendar, Notion and more to a personal AI that lives in Telegram. Ask it anything, automate your day, and get things done — without lifting a finger.',
    ctaText: 'Get My Personal AI ⚡',
    features: [
      { title: 'Lives in Telegram', description: 'No app to install. Your AI assistant lives right inside Telegram — just send a message and it gets to work.', icon: 'FiSend' },
      { title: 'Connects Your Favourite Apps', description: 'Auto-connects to Gmail, Google Calendar, Notion and more. Your AI has full context of your life and work.', icon: 'FiLink' },
      { title: 'One-Click Setup', description: 'Paste your Telegram token, select your apps, hit go. Your personal AI is live in under 2 minutes.', icon: 'FiZap' },
      { title: 'Reads & Drafts Emails', description: 'Ask it to check your inbox, summarise emails, draft replies — all without opening Gmail.', icon: 'FiMail' },
      { title: 'Manages Your Calendar', description: 'Schedule meetings, get daily briefings, move appointments — your AI handles your calendar like a pro.', icon: 'FiCalendar' },
      { title: 'Always Learning You', description: 'The more you use it, the better it knows your preferences, priorities, and communication style.', icon: 'FiTrendingUp' },
    ],
    testimonials: [
      { name: 'Jamie O\'Brien', role: 'Freelance Consultant', content: 'I set it up in literally 90 seconds. Now my Telegram bot handles my calendar, emails and Notion pages. It\'s like having an EA for free.', rating: 5 },
      { name: 'Aisha Mensah', role: 'Startup Founder', content: 'The one-click setup was not a gimmick. I picked my apps, pasted my token, and it was working instantly. Unreal.', rating: 5 },
      { name: 'Daniel Kozlowski', role: 'Remote Product Manager', content: 'I ask my Telegram bot to summarise my unread emails every morning. Saves me 45 minutes a day easily.', rating: 5 },
    ],
    faqs: [
      { question: 'Do I need to install an app?', answer: 'No! Your personal AI lives entirely in Telegram — which you probably already have. Just connect it and start chatting.' },
      { question: 'How do I get a Telegram Bot Token?', answer: 'Open Telegram and message @BotFather. Type /newbot, follow the prompts, and it will give you a token. Paste it during setup and you\'re done.' },
      { question: 'Which apps can it connect to?', answer: 'Currently we support Gmail, Google Calendar, and Notion. More integrations (Slack, Notion, HubSpot, Linear, and more) are coming soon.' },
      { question: 'Is my data private?', answer: 'Your data stays between you and your connected apps. We never read, store, or share your personal emails, calendar events, or documents.' },
      { question: 'How long does setup take?', answer: 'Less than 2 minutes. Enter your name and email, paste your Telegram token, select which apps to connect, and hit submit. That\'s it.' },
    ],
  },

  [ExperienceType.OPENCLAW_SETUP_SERVICE]: {
    heroTitle: 'Get Your AI Set Up — By Experts, With You.',
    heroSubtitle: 'Skip the trial-and-error. Book a 1-on-1 setup call with our team and we\'ll configure your OpenClaw agent, connect your apps, and get your personal AI live in one session.',
    ctaText: 'Book My Free Setup Call 📅',
    features: [
      { title: 'Live 1-on-1 Session', description: 'A dedicated expert joins your call and configures everything live — no tickets, no waiting, no confusion.', icon: 'FiUsers' },
      { title: 'Apps Connected on the Call', description: 'We connect your Gmail, Calendar, Notion and more during the session. You leave with a fully working setup.', icon: 'FiLink' },
      { title: 'Custom to Your Workflow', description: 'We configure your AI around how you actually work — not a generic template. Your priorities, your language, your tools.', icon: 'FiSettings' },
      { title: 'No Technical Knowledge Needed', description: 'You don\'t need to know anything about APIs or bots. Just show up to the call and we handle the rest.', icon: 'FiShield' },
      { title: 'Works in Telegram', description: 'Your personal AI lives in Telegram — the app you already use. No new software to install or learn.', icon: 'FiSend' },
      { title: 'Ongoing Support', description: 'After your session, you\'re not left alone. We\'re available to help you expand and optimise as your needs grow.', icon: 'FiHeadphones' },
    ],
    testimonials: [
      { name: 'Sophie Andreou', role: 'Marketing Consultant', content: 'I had no idea how to set it up myself. The call took 40 minutes and by the end I had a working AI in my Telegram. It was incredible.', rating: 5 },
      { name: 'Ravi Nair', role: 'E-commerce Store Owner', content: 'They connected my Gmail and Notion while we were on the call. I was blown away. Saved me weeks of figuring it out myself.', rating: 5 },
      { name: 'Claire Hutchinson', role: 'Freelance Designer', content: 'The setup session was actually fun. The expert knew exactly what I needed and had everything running before we hung up.', rating: 5 },
    ],
    faqs: [
      { question: 'How long is the setup call?', answer: 'Most setup sessions take between 30 and 60 minutes. By the end of the call your OpenClaw agent will be fully configured and connected to your chosen apps.' },
      { question: 'What do I need to prepare before the call?', answer: 'Just make sure you have a Telegram account. We\'ll walk you through everything else — creating your bot, connecting apps, and testing your AI — live on the call.' },
      { question: 'Which apps can be connected during the session?', answer: 'We currently support Gmail, Google Calendar, and Notion. Slack, HubSpot, and Linear are coming soon. Let us know what you need and we\'ll prioritise it.' },
      { question: 'Is there a cost for the setup call?', answer: 'Pricing is set by the agency you\'re booking with. Many offer a free first session. Check the booking page for details.' },
      { question: 'What if I want to add more apps after the call?', answer: 'No problem — you can book a follow-up session at any time or get support directly from the agency to extend your setup.' },
    ],
  },

  // Coming soon experiences have minimal defaults
  [ExperienceType.AI_OUTBOUND_SDR]: {
    heroTitle: 'AI-Powered Outbound Sales',
    heroSubtitle: 'Automate your outbound sales development with an AI that makes calls, qualifies leads, and books meetings.',
    ctaText: 'Join Waitlist',
  },
  [ExperienceType.AI_CUSTOMER_SUPPORT]: {
    heroTitle: 'AI Customer Support, 24/7',
    heroSubtitle: 'Resolve customer issues instantly with an AI support agent that never sleeps.',
    ctaText: 'Join Waitlist',
  },
  [ExperienceType.AI_APPOINTMENT_SETTER]: {
    heroTitle: 'Never Miss an Appointment',
    heroSubtitle: 'An AI agent dedicated to booking, confirming, and managing appointments.',
    ctaText: 'Join Waitlist',
  },
  [ExperienceType.AI_LEAD_QUALIFIER]: {
    heroTitle: 'Qualify Leads Automatically',
    heroSubtitle: 'Score and route inbound leads with intelligent AI conversations.',
    ctaText: 'Join Waitlist',
  },
  [ExperienceType.AI_SURVEY_AGENT]: {
    heroTitle: 'AI-Powered Surveys',
    heroSubtitle: 'Collect feedback through natural conversations for higher response rates.',
    ctaText: 'Join Waitlist',
  },
  [ExperienceType.AI_COLLECTIONS_AGENT]: {
    heroTitle: 'Smart Collections Agent',
    heroSubtitle: 'Improve collection rates with professional, empathetic AI conversations.',
    ctaText: 'Join Waitlist',
  },
  [ExperienceType.AI_ONBOARDING_SPECIALIST]: {
    heroTitle: 'AI Onboarding Guide',
    heroSubtitle: 'Automate customer and employee onboarding with a personalized AI guide.',
    ctaText: 'Join Waitlist',
  },
};

/**
 * Get landing page defaults for an experience type, merged with any partner overrides
 */
export function getLandingPageContent(
  experienceType: ExperienceType,
  partnerOverrides?: Partial<LandingPageConfig>
): LandingPageConfig {
  const defaults = EXPERIENCE_LANDING_DEFAULTS[experienceType] || {};
  if (!partnerOverrides || Object.keys(partnerOverrides).length === 0) {
    return defaults;
  }
  return {
    ...defaults,
    ...partnerOverrides,
    // Deep merge arrays only if partner provides them
    features: partnerOverrides.features || defaults.features,
    testimonials: partnerOverrides.testimonials || defaults.testimonials,
    faqs: partnerOverrides.faqs || defaults.faqs,
  };
}

