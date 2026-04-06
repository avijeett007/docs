import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Knotie AI Pro Roadmap - Voice AI Platform Journey & Release Notes',
  description: 'Explore the evolution of Knotie AI Pro through our comprehensive roadmap and release notes. Discover how we\'re revolutionizing Voice AI for agencies with VAPI, Retell, and Ultravox integrations.',
  keywords: [
    'Knotie AI Pro',
    'Voice AI Roadmap',
    'Voice AI Agents',
    'Voice AI Industry',
    'VAPI',
    'Retell',
    'Ultravox',
    'Voice AI Reselling',
    'Voice AI Agencies',
    'AI Agencies',
    'Marketing Agencies',
    'White-label Voice AI',
    'Voice AI Platform',
    'AI Agent Management',
    'Voice AI Analytics',
    'Voice AI Integration',
    'Release Notes'
  ],
  authors: [{ name: 'Knotie AI Pro Team' }],
  creator: 'Knotie AI Pro',
  publisher: 'Knotie AI Pro',
  openGraph: {
    title: 'Knotie AI Pro Roadmap - Voice AI Platform Journey & Release Notes',
    description: 'Explore the evolution of Knotie AI Pro through our comprehensive roadmap and release notes. Discover how we\'re revolutionizing Voice AI for agencies.',
    url: 'https://knotie-ai.pro/roadmap',
    siteName: 'Knotie AI Pro',
    type: 'website',
    images: [
      {
        url: 'https://knotie-ai.pro/images/og-roadmap.png',
        width: 1200,
        height: 630,
        alt: 'Knotie AI Pro Roadmap and Release Journey',
      },
    ],
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Knotie AI Pro Roadmap - Voice AI Platform Journey',
    description: 'Explore the evolution of Knotie AI Pro through our comprehensive roadmap and release notes.',
    creator: '@knotieaipro',
    images: ['https://knotie-ai.pro/images/og-roadmap.png'],
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
    canonical: 'https://knotie-ai.pro/roadmap',
  },
  category: 'Technology',
};

export default function RoadmapLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
