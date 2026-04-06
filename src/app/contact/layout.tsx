import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Knotie AI Pro - Get in Touch | Voice AI Support',
  description: 'Contact Knotie AI Pro for sales inquiries, support, or partnership opportunities. Reach our team for white-label voice AI platform assistance and demos.',
  keywords: [
    'contact knotie ai',
    'voice AI support',
    'AI platform sales',
    'voice AI demo request',
    'knotie ai contact',
    'AI calling software demo',
    'voice AI platform support',
    'white label AI contact',
    'AI voice platform inquiry',
    'knotie ai sales'
  ],
  openGraph: {
    title: 'Contact Knotie AI Pro - Get in Touch | Voice AI Support',
    description: 'Contact Knotie AI Pro for sales inquiries, support, or partnership opportunities. Reach our team for white-label voice AI platform assistance.',
    url: 'https://knotie-ai.pro/contact',
    siteName: 'Knotie AI Pro',
    images: [
      {
        url: 'https://knotie-ai.pro/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Contact Knotie AI Pro - Voice AI Support'
      }
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contact Knotie AI Pro - Get in Touch | Voice AI Support',
    description: 'Contact Knotie AI Pro for sales inquiries, support, or partnership opportunities.',
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
    canonical: 'https://knotie-ai.pro/contact',
  },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
