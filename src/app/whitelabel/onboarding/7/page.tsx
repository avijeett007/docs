import { Metadata } from 'next';
import Step7InformationCollection from '@/components/whitelabel/saas/onboarding/Step7InformationCollection';

export const metadata: Metadata = {
  title: 'Information Collection - AI Receptionist Setup',
  description: 'Configure what information your AI receptionist should collect from callers',
};

export default function OnboardingStep7Page() {
  return <Step7InformationCollection />;
}
