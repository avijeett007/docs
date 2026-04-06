// Initialize OpenTelemetry (must be first import)
import '@/lib/otel-init';

import { Metadata } from 'next';
import { Inter } from 'next/font/google';

// Optimize font loading with next/font
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  preload: true,
  fallback: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
});
import Script from 'next/script';
import { ToastProvider } from '@/components/toast/ToasterProvider';
import { PlaygroundToast } from '@/components/toast/PlaygroundToast';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from '@/context/ThemeContext';
import ReferralTracker from '@/components/ReferralTracker';
import '../styles/globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://knotie-ai.pro'),
  title: {
    default: 'Knotie AI Pro - White-Label Voice AI Platform for Agencies',
    template: '%s | Knotie AI Pro'
  },
  description: 'The ultimate white-label voice AI platform for agencies. Integrate VAPI, Retell, Ultravox. Automate calls, appointments, and customer service with AI voice agents.',
  keywords: [
    'white label AI voice platform',
    'AI calling software for agencies',
    'voice AI platform',
    'AI phone automation',
    'AI appointment setter',
    'AI voice agent',
    'VAPI integration',
    'Retell AI alternative',
    'voice AI SaaS',
    'AI receptionist software',
    'AI cold calling software',
    'voice AI for marketing agencies',
    'GHL AI calling integration',
    'AI dialer for agencies',
    'white label voice automation'
  ],
  authors: [{ name: 'SONTI LTD', url: 'https://knotie-ai.pro' }],
  creator: 'Knotie AI Pro',
  publisher: 'SONTI LTD',
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
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://knotie-ai.pro',
    siteName: 'Knotie AI Pro',
    title: 'Knotie AI Pro - White-Label Voice AI Platform for Agencies',
    description: 'The ultimate white-label voice AI platform for agencies. Automate calls, appointments, and customer service with AI voice agents.',
    images: [{
      url: 'https://knotie-ai.pro/og-image.png',
      width: 1200,
      height: 630,
      alt: 'Knotie AI Pro - Voice AI Platform for Agencies'
    }]
  },
  twitter: {
    card: 'summary_large_image',
    site: '@KnotieAI',
    creator: '@KnotieAI',
    title: 'Knotie AI Pro - White-Label Voice AI Platform for Agencies',
    description: 'The ultimate white-label voice AI platform for agencies. Automate calls with AI voice agents.',
    images: ['https://knotie-ai.pro/twitter-image.png'],
  },
  alternates: {
    canonical: 'https://knotie-ai.pro',
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Preconnect to external domains for faster resource loading */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://img.clerk.com" />
        <link rel="dns-prefetch" href="https://r.wdfl.co" />
        
        {/* Critical CSS for above-the-fold content - prevents FOUC and improves FCP */}
        <style dangerouslySetInnerHTML={{
          __html: `
            *,*::before,*::after{box-sizing:border-box}
            html{-webkit-text-size-adjust:100%;tab-size:4}
            body{margin:0;font-family:var(--font-inter),system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.5;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
            .bg-black{background-color:#000}
            .text-white{color:#fff}
            img,svg,video{max-width:100%;height:auto;display:block}
            .flex{display:flex}
            .min-h-screen{min-height:100vh}
          `
        }} />
      </head>
      <body className={`min-h-screen bg-black antialiased ${inter.variable}`} style={{ fontFamily: 'var(--font-inter), system-ui, -apple-system, sans-serif' }}>
        <ReferralTracker />
        <ThemeProvider>
          <ToastProvider>
            <PlaygroundToast />
            {children}
            <Toaster position="top-right" />
          </ToastProvider>
        </ThemeProvider>

        {/* Rewardful Tracking Script - Following official Next.js integration guide */}
        <Script
          src="https://r.wdfl.co/rw.js"
          data-rewardful={process.env.NEXT_PUBLIC_REWARDFUL_SUBDOMAIN || ''}
        />
        <Script
          id="rewardful-queue"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(w,r){w._rwq=r;w[r]=w[r]||function(){(w[r].q=w[r].q||[]).push(arguments)}})(window,'rewardful');`
          }}
        />
      </body>
    </html>
  );
}
