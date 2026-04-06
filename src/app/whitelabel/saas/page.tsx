import { Suspense } from 'react';
import { Metadata } from 'next';
import SaaSLandingPage from '@/components/whitelabel/saas/SaaSLandingPage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'AI Receptionist - Get Started Today',
  description: 'Transform your business with an AI-powered receptionist that never sleeps, never takes a break, and always provides professional customer service.',
  keywords: 'AI receptionist, virtual assistant, business automation, customer service, voice AI',
  openGraph: {
    title: 'AI Receptionist - Get Started Today',
    description: 'Transform your business with an AI-powered receptionist that never sleeps, never takes a break, and always provides professional customer service.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Receptionist - Get Started Today',
    description: 'Transform your business with an AI-powered receptionist that never sleeps, never takes a break, and always provides professional customer service.',
  },
};

export default function SaaSPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your AI receptionist experience...</p>
        </div>
      </div>
    }>
      <SaaSLandingPage />
    </Suspense>
  );
}
