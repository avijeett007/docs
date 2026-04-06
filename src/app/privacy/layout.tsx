import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy - Knotie AI Pro | Data Protection',
  description: 'Read Knotie AI Pro\'s privacy policy. Learn how we protect your data on our white-label voice AI platform for agencies. GDPR compliant.',
  keywords: [
    'knotie ai privacy',
    'voice AI data protection',
    'AI platform privacy policy',
    'voice AI security',
    'knotie ai data policy',
    'AI calling privacy',
    'voice AI GDPR',
    'AI platform data security',
    'voice AI compliance',
    'knotie ai privacy policy'
  ],
  openGraph: {
    title: 'Privacy Policy - Knotie AI Pro | Data Protection',
    description: 'Read Knotie AI Pro\'s privacy policy. Learn how we protect your data on our white-label voice AI platform for agencies.',
    url: 'https://knotie-ai.pro/privacy',
    siteName: 'Knotie AI Pro',
    images: [
      {
        url: 'https://knotie-ai.pro/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Knotie AI Pro Privacy Policy'
      }
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Privacy Policy - Knotie AI Pro | Data Protection',
    description: 'Read Knotie AI Pro\'s privacy policy. Learn how we protect your data.',
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
    canonical: 'https://knotie-ai.pro/privacy',
  },
};

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
