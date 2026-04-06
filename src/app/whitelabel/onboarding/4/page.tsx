import { Metadata } from 'next';
import Step4ServiceCategories from '@/components/whitelabel/saas/onboarding/Step4ServiceCategories';

export const metadata: Metadata = {
  title: 'Service Categories - AI Receptionist Setup',
  description: 'Select the services your business offers to customize your AI receptionist',
};

export default function OnboardingStep4Page() {
  return <Step4ServiceCategories />;
}
