import { Metadata } from 'next';
import Step6PersonalizedGreeting from '@/components/whitelabel/saas/onboarding/Step6PersonalizedGreeting';

export const metadata: Metadata = {
  title: 'Personalized Greeting - AI Receptionist Setup',
  description: 'Create a personalized greeting for your AI receptionist',
};

// Force dynamic rendering since this page uses browser-only APIs
export const dynamic = 'force-dynamic';

export default function OnboardingStep6Page() {
  return <Step6PersonalizedGreeting />;
}
