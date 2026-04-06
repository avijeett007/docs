import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Help Center - Knotie AI Pro Documentation & Support',
  description: 'Find answers to your questions about Knotie AI Pro. Access FAQs, documentation, and support resources for our white-label voice AI platform.',
  keywords: [
    'knotie ai help',
    'voice AI documentation',
    'AI platform support',
    'voice AI FAQ',
    'knotie ai support',
    'AI calling software help',
    'voice AI troubleshooting',
    'AI platform guides',
    'voice AI tutorials',
    'knotie ai resources'
  ],
  openGraph: {
    title: 'Help Center - Knotie AI Pro Documentation & Support',
    description: 'Find answers to your questions about Knotie AI Pro. Access FAQs, documentation, and support resources for our white-label voice AI platform.',
    url: 'https://knotie-ai.pro/help',
    siteName: 'Knotie AI Pro',
    images: [
      {
        url: 'https://knotie-ai.pro/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Knotie AI Pro Help Center'
      }
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Help Center - Knotie AI Pro Documentation & Support',
    description: 'Find answers to your questions about Knotie AI Pro. Access FAQs and support resources.',
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
    canonical: 'https://knotie-ai.pro/help',
  },
};

export default function HelpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
