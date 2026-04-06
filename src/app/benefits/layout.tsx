import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Agency Benefits of White Label AI Voice Platform | Knotie AI Pro',
  description: 'Discover the agency benefits of Knotie AI Pro. Scale voice automation, improve margins, and deliver measurable client outcomes with our white-label AI voice platform for agencies.',
  keywords: [
    'AI voice agency benefits',
    'white label AI voice platform benefits',
    'agency growth AI platform',
    'AI calling software for agencies',
    'voice AI agency revenue',
    'AI voice reseller benefits',
    'white label voice AI profit margins',
    'AI appointment setter agency',
    'voice AI client retention',
    'retell ai reseller benefits',
    'vapi reseller platform',
    'ghl AI calling agency benefits',
    'AI voice SaaS agency',
    'voice AI white label reseller',
    'AI phone automation agency'
  ],
  openGraph: {
    title: 'Agency Benefits of White Label AI Voice Platform | Knotie AI Pro',
    description: 'Discover the agency benefits of Knotie AI Pro. Scale voice automation, improve margins, and deliver measurable client outcomes.',
    url: 'https://knotie-ai.pro/benefits',
    siteName: 'Knotie AI Pro',
    images: [
      {
        url: 'https://knotie-ai.pro/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Knotie AI Pro Benefits - Agency Growth Platform'
      }
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Agency Benefits of White Label AI Voice Platform | Knotie AI Pro',
    description: 'Scale voice automation, improve margins, and deliver measurable client outcomes with Knotie AI Pro.',
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
    canonical: 'https://knotie-ai.pro/benefits',
  },
};

export default function BenefitsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
