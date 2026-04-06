import { Metadata } from 'next';
import Step8CommunicationSettings from '@/components/whitelabel/saas/onboarding/Step8CommunicationSettings';

export const metadata: Metadata = {
  title: 'Communication Settings - AI Receptionist Setup',
  description: 'Configure meeting scheduling, SMS, and call transfer options',
};

export default function OnboardingStep8Page() {
  return <Step8CommunicationSettings />;
}
