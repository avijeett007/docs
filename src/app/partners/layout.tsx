import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Partner Program - White-Label Voice AI for Agencies | Knotie AI Pro',
  description: 'Become a Knotie AI Pro partner. Resell white-label voice AI to your clients with custom branding, pricing control, and dedicated support.',
  keywords: [
    'knotie ai partner',
    'voice AI reseller',
    'white label AI partnership',
    'agency AI platform',
    'knotie ai reseller',
    'voice AI agency program',
    'white label voice AI',
    'AI calling reseller',
    'voice AI white label',
    'agency voice AI platform'
  ],
  openGraph: {
    title: 'Partner Program - White-Label Voice AI for Agencies | Knotie AI Pro',
    description: 'Become a Knotie AI Pro partner. Resell white-label voice AI to your clients with custom branding, pricing control, and dedicated support.',
    url: 'https://knotie-ai.pro/partners',
    siteName: 'Knotie AI Pro',
    images: [
      {
        url: 'https://knotie-ai.pro/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Knotie AI Pro Partner Program'
      }
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Partner Program - White-Label Voice AI for Agencies | Knotie AI Pro',
    description: 'Become a Knotie AI Pro partner. Resell white-label voice AI with custom branding.',
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
    canonical: 'https://knotie-ai.pro/partners',
  },
};

export default function PartnersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
