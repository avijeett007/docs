import { Metadata } from 'next';
import Step3CustomerDetails from '@/components/whitelabel/saas/onboarding/Step3CustomerDetails';

export const metadata: Metadata = {
  title: 'Customer Details - AI Receptionist Setup',
  description: 'Provide your contact details to complete your AI receptionist setup',
};

export default function OnboardingStep3Page() {
  return <Step3CustomerDetails />;
}
