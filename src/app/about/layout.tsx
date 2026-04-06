import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About Knotie AI Pro - Voice AI Platform Company',
  description: 'Learn about Knotie AI Pro, the company revolutionizing business communication with white-label voice AI technology for agencies worldwide. Discover our mission and vision.',
  keywords: [
    'about knotie ai',
    'voice AI company',
    'AI automation company',
    'white label voice AI provider',
    'voice AI platform team',
    'knotie ai story',
    'AI voice technology company',
    'voice automation provider',
    'AI calling platform company',
    'voice AI innovation'
  ],
  openGraph: {
    title: 'About Knotie AI Pro - Voice AI Platform Company',
    description: 'Learn about Knotie AI Pro, the company revolutionizing business communication with white-label voice AI technology for agencies worldwide.',
    url: 'https://knotie-ai.pro/about',
    siteName: 'Knotie AI Pro',
    images: [
      {
        url: 'https://knotie-ai.pro/og-image.png',
        width: 1200,
        height: 630,
        alt: 'About Knotie AI Pro - Voice AI Platform Company'
      }
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About Knotie AI Pro - Voice AI Platform Company',
    description: 'Learn about Knotie AI Pro, revolutionizing business communication with white-label voice AI technology.',
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
    canonical: 'https://knotie-ai.pro/about',
  },
};

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
