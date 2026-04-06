import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Affiliate Program - Earn Up to 40% Commission | Knotie AI Pro',
  description: 'Join the Knotie AI Pro affiliate program. Earn up to 40% lifetime commission promoting the leading white-label voice AI platform for agencies.',
  keywords: [
    'knotie ai affiliate',
    'voice AI affiliate program',
    'AI platform referral',
    'voice AI commission',
    'knotie ai referral',
    'AI calling affiliate',
    'voice AI partner program',
    'white label AI affiliate',
    'AI platform commission',
    'voice AI earnings'
  ],
  openGraph: {
    title: 'Affiliate Program - Earn Up to 40% Commission | Knotie AI Pro',
    description: 'Join the Knotie AI Pro affiliate program. Earn up to 40% lifetime commission promoting the leading white-label voice AI platform.',
    url: 'https://knotie-ai.pro/affiliates',
    siteName: 'Knotie AI Pro',
    images: [
      {
        url: 'https://knotie-ai.pro/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Knotie AI Pro Affiliate Program'
      }
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Affiliate Program - Earn Up to 40% Commission | Knotie AI Pro',
    description: 'Join the Knotie AI Pro affiliate program. Earn up to 40% lifetime commission.',
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
    canonical: 'https://knotie-ai.pro/affiliates',
  },
};

export default function AffiliatesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
