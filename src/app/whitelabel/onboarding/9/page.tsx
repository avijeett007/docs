import { Metadata } from 'next';
import Step9SummaryAndDeploy from '@/components/whitelabel/saas/onboarding/Step9SummaryAndDeploy';

export const metadata: Metadata = {
  title: 'Summary & Deploy - AI Receptionist Setup',
  description: 'Review your settings and deploy your AI receptionist',
};

// Force dynamic rendering since this page uses browser-only APIs
export const dynamic = 'force-dynamic';

export default function OnboardingStep9Page() {
  return <Step9SummaryAndDeploy />;
}
