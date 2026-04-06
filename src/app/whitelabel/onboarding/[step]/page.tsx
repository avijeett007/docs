'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import WhitelabelLayout from '@/components/whitelabel/WhitelabelLayout';

// Import onboarding step components
import Step1BusinessInfo from '@/components/whitelabel/saas/onboarding/Step1BusinessInfo';
import Step2WebsiteVerification from '@/components/whitelabel/saas/onboarding/Step2WebsiteVerification';
import Step3CustomerDetails from '@/components/whitelabel/saas/onboarding/Step3CustomerDetails';
import Step4ServiceCategories from '@/components/whitelabel/saas/onboarding/Step4ServiceCategories';
import Step5KnowledgeBase from '@/components/whitelabel/saas/onboarding/Step5KnowledgeBase';
import Step6PersonalizedGreeting from '@/components/whitelabel/saas/onboarding/Step6PersonalizedGreeting';
import Step7InformationCollection from '@/components/whitelabel/saas/onboarding/Step7InformationCollection';
import Step8CommunicationSettings from '@/components/whitelabel/saas/onboarding/Step8CommunicationSettings';
import Step9SummaryAndDeploy from '@/components/whitelabel/saas/onboarding/Step9SummaryAndDeploy';

export default function WhitelabelOnboardingPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [_prospectData, setProspectData] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const step = parseInt(params?.step as string || '1');

  useEffect(() => {
    const fetchProspectData = async () => {
      try {
        // Fetch incomplete onboarding data
        const response = await fetch('/api/whitelabel/prospects/resume');
        
        if (!response.ok) {
          if (response.status === 401) {
            router.push('/whitelabel/login');
            return;
          }
          throw new Error('Failed to fetch onboarding data');
        }

        const data = await response.json();
        
        if (!data.hasIncompleteOnboarding) {
          // No incomplete onboarding, redirect to dashboard
          router.push('/whitelabel/dashboard');
          return;
        }

        setProspectData(data.prospect);

        // Validate step access - user can only access current step or earlier
        if (step > data.prospect.currentStep) {
          router.push(`/whitelabel/onboarding/${data.prospect.currentStep}`);
          return;
        }

        // Pre-populate localStorage with existing data for form continuity
        if (data.prospect.businessName) {
          localStorage.setItem('onboarding_businessName', data.prospect.businessName);
        }
        if (data.prospect.businessWebsite) {
          localStorage.setItem('onboarding_businessWebsite', data.prospect.businessWebsite);
        }
        if (data.prospect.firstName) {
          localStorage.setItem('onboarding_firstName', data.prospect.firstName);
        }
        if (data.prospect.lastName) {
          localStorage.setItem('onboarding_lastName', data.prospect.lastName);
        }
        if (data.prospect.email) {
          localStorage.setItem('onboarding_email', data.prospect.email);
        }
        if (data.prospect.phone) {
          localStorage.setItem('onboarding_phone', data.prospect.phone);
        }
        if (data.prospect.id) {
          localStorage.setItem('onboarding_prospectId', data.prospect.id);
        }

      } catch (error) {
        console.error('Error fetching prospect data:', error);
        setError('Failed to load onboarding data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchProspectData();
  }, [step, router]);

  if (loading) {
    return (
      <WhitelabelLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      </WhitelabelLayout>
    );
  }

  if (error) {
    return (
      <WhitelabelLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => router.push('/whitelabel/dashboard')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </WhitelabelLayout>
    );
  }

  // Render the appropriate step component
  const renderStep = () => {
    switch (step) {
      case 1:
        return <Step1BusinessInfo />;
      case 2:
        return <Step2WebsiteVerification />;
      case 3:
        return <Step3CustomerDetails />;
      case 4:
        return <Step4ServiceCategories />;
      case 5:
        return <Step5KnowledgeBase />;
      case 6:
        return <Step6PersonalizedGreeting />;
      case 7:
        return <Step7InformationCollection />;
      case 8:
        return <Step8CommunicationSettings />;
      case 9:
        return <Step9SummaryAndDeploy />;
      default:
        return (
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Invalid Step</h1>
            <p className="text-gray-600 mb-4">Step {step} does not exist.</p>
            <button
              onClick={() => router.push('/whitelabel/dashboard')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Return to Dashboard
            </button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {renderStep()}
    </div>
  );
}
