import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'White Label AI Voice Platform for Agencies | Knotie AI Pro',
  description: 'Complete AI calling software for agencies. Automate phone calls, appointments, and customer service with our white-label voice AI platform. Integrate VAPI, Retell, GHL, and more.',
  keywords: [
    'white label AI voice platform',
    'AI calling software for agencies',
    'AI phone call automation',
    'AI appointment setter software',
    'AI voice agent for agencies',
    'AI cold calling software',
    'retell ai alternative',
    'ghl AI calling integration',
    'AI dialer for agencies',
    'AI receptionist software',
    'AI voice automation platform',
    'voice AI for marketing agencies',
    'AI sales call software',
    'AI call center automation',
    'AI phone bot for business',
    'AI voice SaaS platform',
    'AI customer service voice bot'
  ],
  openGraph: {
    title: 'White Label AI Voice Platform for Agencies | Knotie AI Pro',
    description: 'Complete AI calling software for agencies. Automate phone calls, appointments, and customer service with our white-label voice AI platform.',
    url: 'https://knotie-ai.pro/features',
    siteName: 'Knotie AI Pro',
    images: [
      {
        url: 'https://knotie-ai.pro/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Knotie AI Pro - White Label AI Voice Platform'
      }
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'White Label AI Voice Platform for Agencies | Knotie AI Pro',
    description: 'Complete AI calling software for agencies. Automate phone calls, appointments, and customer service.',
    images: ['https://knotie-ai.pro/twitter-image.png'],
    creator: '@KnotieAI',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: 'https://knotie-ai.pro/features',
  },
};

export default function FeaturesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
