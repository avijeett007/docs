import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Developer Partner Network - Join Knotie AI Pro | Careers',
  description: 'Join the Knotie AI Pro developer partner network. Build, share, and earn with our voice AI platform. 70% revenue share for partners.',
  keywords: [
    'knotie ai careers',
    'voice AI developer jobs',
    'AI platform partnership',
    'developer partner program',
    'knotie ai jobs',
    'voice AI developer network',
    'AI platform careers',
    'voice AI partnership',
    'developer revenue share',
    'AI marketplace partnership'
  ],
  openGraph: {
    title: 'Developer Partner Network - Join Knotie AI Pro | Careers',
    description: 'Join the Knotie AI Pro developer partner network. Build, share, and earn with our voice AI platform. 70% revenue share for partners.',
    url: 'https://knotie-ai.pro/careers',
    siteName: 'Knotie AI Pro',
    images: [
      {
        url: 'https://knotie-ai.pro/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Knotie AI Pro Developer Partner Network'
      }
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Developer Partner Network - Join Knotie AI Pro | Careers',
    description: 'Join the Knotie AI Pro developer partner network. 70% revenue share for partners.',
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
    canonical: 'https://knotie-ai.pro/careers',
  },
};

export default function CareersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
