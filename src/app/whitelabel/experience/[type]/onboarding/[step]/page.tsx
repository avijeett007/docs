'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import WhitelabelLayout from '@/components/whitelabel/WhitelabelLayout';
import { ExperienceType } from '@/types/experience';
import { EXPERIENCE_CONFIGS } from '@/lib/experiences/experienceTypes';

// Import PA-specific onboarding step components (independent from AI Receptionist)
import PAStep1BusinessInfo from '@/components/whitelabel/personal-assistant/onboarding/PAStep1BusinessInfo';
import PAStep2CustomerDetails from '@/components/whitelabel/personal-assistant/onboarding/PAStep2CustomerDetails';
import PAStep3KnowledgeBase from '@/components/whitelabel/personal-assistant/onboarding/PAStep3KnowledgeBase';
import PAStep4PersonalizedGreeting from '@/components/whitelabel/personal-assistant/onboarding/PAStep4PersonalizedGreeting';
import PAStep5SummaryAndDeploy from '@/components/whitelabel/personal-assistant/onboarding/PAStep5SummaryAndDeploy';

export default function ExperienceOnboardingStepPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const experienceType = params?.type as ExperienceType;
  const stepParam = parseInt(params?.step as string || '1');

  // Get experience config to determine valid steps
  const experienceConfig = EXPERIENCE_CONFIGS[experienceType];
  const totalSteps = experienceType === ExperienceType.AI_PERSONAL_ASSISTANT ? 5 : (experienceConfig?.onboardingSteps?.length || 0);

  useEffect(() => {
    const initStep = () => {
      try {
        // Validate experience type
        if (!experienceConfig) {
          setError('Invalid experience type');
          setLoading(false);
          return;
        }

        // Validate step is within range
        if (stepParam < 1 || stepParam > totalSteps) {
          setError(`Invalid step. This experience has ${totalSteps} steps.`);
          setLoading(false);
          return;
        }

        // Store experience context in localStorage for step components to use
        localStorage.setItem('onboarding_experienceType', experienceType);
        localStorage.setItem('onboarding_experienceAlias', experienceConfig.defaultAlias || '');
        localStorage.setItem('onboarding_totalSteps', totalSteps.toString());
        localStorage.setItem('onboarding_currentStepPosition', stepParam.toString());

        setLoading(false);
      } catch (err) {
        console.error('Error initializing onboarding step:', err);
        setError('Failed to load onboarding step. Please try again.');
        setLoading(false);
      }
    };

    initStep();
  }, [experienceType, stepParam, experienceConfig, totalSteps]);

  if (loading) {
    return (
      <WhitelabelLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-emerald-600"></div>
        </div>
      </WhitelabelLayout>
    );
  }

  if (error || !experienceConfig) {
    return (
      <WhitelabelLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center max-w-md mx-auto p-6">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-red-600 mb-4">
              {error || 'Experience Not Found'}
            </h1>
            <button
              onClick={() => router.back()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
            >
              Go Back
            </button>
          </div>
        </div>
      </WhitelabelLayout>
    );
  }

  // Render experience-specific onboarding steps
  // Each experience has its own independent step components
  const renderStep = () => {
    switch (experienceType) {
      case ExperienceType.AI_PERSONAL_ASSISTANT:
        // PA has 5 independent steps - completely separate from AI Receptionist
        switch (stepParam) {
          case 1: return <PAStep1BusinessInfo />;
          case 2: return <PAStep2CustomerDetails />;
          case 3: return <PAStep3KnowledgeBase />;
          case 4: return <PAStep4PersonalizedGreeting />;
          case 5: return <PAStep5SummaryAndDeploy />;
          default: return null;
        }

      default:
        // For future experience types, add their own switch cases here
        return (
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center max-w-md mx-auto p-6">
              <div className="text-6xl mb-4">🚧</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Coming Soon</h1>
              <p className="text-gray-600 mb-4">
                The onboarding flow for this experience is not yet available.
              </p>
              <button
                onClick={() => router.back()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg"
              >
                Go Back
              </button>
            </div>
          </div>
        );
    }
  };

  return renderStep();
}
