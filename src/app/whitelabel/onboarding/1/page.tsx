import { Metadata } from 'next';
import Step1BusinessInfo from '@/components/whitelabel/saas/onboarding/Step1BusinessInfo';

export const metadata: Metadata = {
  title: 'Business Information - AI Receptionist Setup',
  description: 'Tell us about your business to get started with your AI receptionist',
};

export default function OnboardingStep1Page() {
  return <Step1BusinessInfo />;
}
