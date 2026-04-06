import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Voice Automation Pricing | Knotie AI Pro',
  description: 'Transparent pricing for white-label AI voice platform. Plans for agencies of all sizes. Start free, scale with AI calling software, appointment setters, and voice automation tools.',
  keywords: [
    'AI voice automation pricing',
    'white label AI voice platform pricing',
    'AI calling software pricing',
    'AI voice SaaS platform',
    'AI appointment setter pricing',
    'voice AI for marketing agencies',
    'AI phone automation pricing',
    'AI receptionist software cost',
    'AI dialer for agencies pricing',
    'retell ai alternative pricing',
    'ghl AI calling integration cost'
  ],
  openGraph: {
    title: 'AI Voice Automation Pricing | Knotie AI Pro',
    description: 'Transparent pricing for white-label AI voice platform. Plans for agencies of all sizes starting free.',
    url: 'https://knotie-ai.pro/pricing',
    siteName: 'Knotie AI Pro',
    images: [
      {
        url: 'https://knotie-ai.pro/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Knotie AI Pro Pricing - White Label AI Voice Platform'
      }
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Voice Automation Pricing | Knotie AI Pro',
    description: 'Transparent pricing for white-label AI voice platform. Plans for agencies of all sizes.',
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
    canonical: 'https://knotie-ai.pro/pricing',
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
