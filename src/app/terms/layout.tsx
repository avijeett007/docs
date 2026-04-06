import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service - Knotie AI Pro | Legal',
  description: 'Review Knotie AI Pro\'s terms of service for our white-label voice AI platform. Understand usage rights, partner agreements, and policies.',
  keywords: [
    'knotie ai terms',
    'voice AI terms of service',
    'AI platform legal',
    'voice AI agreement',
    'knotie ai legal',
    'AI calling terms',
    'voice AI platform terms',
    'white label AI terms',
    'AI platform agreement',
    'knotie ai TOS'
  ],
  openGraph: {
    title: 'Terms of Service - Knotie AI Pro | Legal',
    description: 'Review Knotie AI Pro\'s terms of service for our white-label voice AI platform. Understand usage rights, partner agreements, and policies.',
    url: 'https://knotie-ai.pro/terms',
    siteName: 'Knotie AI Pro',
    images: [
      {
        url: 'https://knotie-ai.pro/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Knotie AI Pro Terms of Service'
      }
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Terms of Service - Knotie AI Pro | Legal',
    description: 'Review Knotie AI Pro\'s terms of service for our white-label voice AI platform.',
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
    canonical: 'https://knotie-ai.pro/terms',
  },
};

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
