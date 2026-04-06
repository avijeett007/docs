import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'API Documentation - Knotie AI Pro | Developer Docs',
  description: 'Comprehensive API documentation for Knotie AI Pro. Build AI automation with customer management, agent APIs, and MCP integration for voice AI platforms.',
  keywords: [
    'knotie ai api',
    'voice AI documentation',
    'AI platform developer docs',
    'MCP integration',
    'voice AI API',
    'knotie ai developer',
    'AI calling API',
    'voice AI SDK',
    'AI platform API reference',
    'voice automation API'
  ],
  openGraph: {
    title: 'API Documentation - Knotie AI Pro | Developer Docs',
    description: 'Comprehensive API documentation for Knotie AI Pro. Build AI automation with customer management, agent APIs, and MCP integration.',
    url: 'https://knotie-ai.pro/docs',
    siteName: 'Knotie AI Pro',
    images: [
      {
        url: 'https://knotie-ai.pro/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Knotie AI Pro API Documentation'
      }
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'API Documentation - Knotie AI Pro | Developer Docs',
    description: 'Comprehensive API documentation for Knotie AI Pro. Build AI automation with MCP integration.',
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
    canonical: 'https://knotie-ai.pro/docs',
  },
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
