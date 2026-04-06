import { Suspense } from 'react';
import { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ExperienceType } from '@/types/experience';
import { EXPERIENCE_CONFIGS } from '@/lib/experiences/experienceTypes';
import { ExperienceStatus } from '@/types/experience';
import { prisma } from '@/lib/prisma';
import PersonalAssistantLandingPage from '@/components/whitelabel/personal-assistant/PersonalAssistantLandingPage';
import OpenClawLandingPage from '@/components/whitelabel/openclaw/OpenClawLandingPage';
import OpenClawAutoInstallLandingPage from '@/components/whitelabel/openclaw/OpenClawAutoInstallLandingPage';
import OpenClawSetupServiceLandingPage from '@/components/whitelabel/openclaw/OpenClawSetupServiceLandingPage';

export const dynamic = 'force-dynamic';

// Generate metadata based on experience type
export async function generateMetadata({ params }: { params: { type: string } }): Promise<Metadata> {
  const experienceType = params.type as ExperienceType;
  const config = EXPERIENCE_CONFIGS[experienceType];

  if (!config) {
    return {
      title: 'Experience Not Found',
      description: 'The requested experience could not be found.',
    };
  }

  return {
    title: `${config.name} - Get Started Today`,
    description: config.longDescription,
    openGraph: {
      title: `${config.name} - Get Started Today`,
      description: config.longDescription,
      type: 'website',
    },
  };
}

export default async function ExperiencePage({ params }: { params: { type: string } }) {
  const experienceType = params.type as ExperienceType;

  // Validate experience type exists
  if (!Object.values(ExperienceType).includes(experienceType)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-500 text-6xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Experience Not Found</h1>
          <p className="text-gray-600 mb-4">The requested experience type is not available.</p>
        </div>
      </div>
    );
  }

  // Check if the experience is enabled for this partner
  // If disabled, redirect to root domain
  const headersList = headers();
  const partnerId = headersList.get('x-partner-id');

  if (partnerId) {
    try {
      const experience = await prisma.partnerExperience.findFirst({
        where: {
          partnerId,
          experienceType,
        },
        select: { enabled: true },
      });

      // If experience exists but is disabled, redirect to root domain
      if (experience && !experience.enabled) {
        redirect('/');
      }
    } catch (error: unknown) {
      // Next.js redirect() throws a special error with digest 'NEXT_REDIRECT' — re-throw it
      if (typeof error === 'object' && error !== null && 'digest' in error) {
        throw error;
      }
      console.error('Error checking experience enabled status:', error);
      // On error, allow the page to render (fail open)
    }
  }

  const config = EXPERIENCE_CONFIGS[experienceType];

  // Route to experience-specific landing pages
  // Each experience has its own independent landing page component
  switch (experienceType) {
    case ExperienceType.AI_PERSONAL_ASSISTANT:
      return (
        <Suspense fallback={
          <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading your AI Personal Assistant...</p>
            </div>
          </div>
        }>
          <PersonalAssistantLandingPage />
        </Suspense>
      );

    case ExperienceType.OPENCLAW_WHITELABEL_SERVICE:
      return (
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center" style={{ background: '#070910' }}>
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: '#00C4B4' }}></div>
              <p style={{ color: '#7A7A9A' }}>Loading OpenClaw...</p>
            </div>
          </div>
        }>
          <OpenClawLandingPage />
        </Suspense>
      );

    case ExperienceType.OPENCLAW_AUTOINSTALL:
      return (
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center" style={{ background: '#070910' }}>
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: '#00C4B4' }}></div>
              <p style={{ color: '#7A7A9A' }}>Setting up your Personal AI...</p>
            </div>
          </div>
        }>
          <OpenClawAutoInstallLandingPage />
        </Suspense>
      );

    case ExperienceType.OPENCLAW_SETUP_SERVICE:
      return (
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center" style={{ background: '#070910' }}>
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: '#F97316' }}></div>
              <p style={{ color: '#7A7A9A' }}>Loading Setup Service...</p>
            </div>
          </div>
        }>
          <OpenClawSetupServiceLandingPage />
        </Suspense>
      );

    default:
      // For COMING_SOON experiences or those without a dedicated landing page
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-slate-100 flex items-center justify-center">
          <div className="text-center max-w-md mx-auto p-8">
            <div className="text-6xl mb-6">🚀</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">{config?.name || 'Experience'}</h1>
            <p className="text-gray-600 mb-6">{config?.longDescription || 'This experience is not yet available.'}</p>
            {config?.status === ExperienceStatus.COMING_SOON && (
              <span className="inline-flex items-center px-4 py-2 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                Coming Soon
              </span>
            )}
          </div>
        </div>
      );
  }
}

