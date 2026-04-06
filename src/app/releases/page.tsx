import { Metadata } from 'next';
import { redirect } from 'next/navigation';

// Redirect to the main roadmap page which now includes the cinematic showcase
export default function ReleasesPage() {
  redirect('/roadmap');
}

export const metadata: Metadata = {
  title: 'Knotie AI Pro Release Notes - Voice AI Platform Updates',
  description: 'Discover the latest updates and features in Knotie AI Pro, the leading white-label Voice AI platform for agencies. Track our journey of innovation in Voice AI technology.',
  keywords: 'Knotie AI Pro, Voice AI Agents, Voice AI Industry, VAPI, Retell, Ultravox, Voice AI Reselling, Voice AI Agencies, AI Agencies, Marketing Agencies, White-label Voice AI, Voice AI Platform, AI Agent Management, Voice AI Analytics, Voice AI Integration',
  authors: [{ name: 'Knotie AI Pro Team' }],
  creator: 'Knotie AI Pro',
  publisher: 'Knotie AI Pro',
  metadataBase: new URL('https://knotie-ai.pro'),
  alternates: {
    canonical: '/releases',
  },
  openGraph: {
    title: 'Knotie AI Pro Release Notes - Voice AI Platform Updates',
    description: 'Discover the latest updates and features in Knotie AI Pro, the leading white-label Voice AI platform for agencies.',
    url: '/releases',
    siteName: 'Knotie AI Pro',
    type: 'website',
    images: [
      {
        url: '/images/og-releases.png',
        width: 1200,
        height: 630,
        alt: 'Knotie AI Pro Release Notes',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Knotie AI Pro Release Notes - Voice AI Platform Updates',
    description: 'Discover the latest updates and features in Knotie AI Pro, the leading white-label Voice AI platform for agencies.',
    creator: '@knotieaipro',
    images: ['/images/og-releases.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
};
