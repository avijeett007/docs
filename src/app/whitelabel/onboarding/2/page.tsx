import { Metadata } from 'next';
import Step2WebsiteVerification from '@/components/whitelabel/saas/onboarding/Step2WebsiteVerification';

export const metadata: Metadata = {
  title: 'Website Verification - AI Receptionist Setup',
  description: 'Verify your website and see how your AI receptionist will help your business',
};

export default function OnboardingStep2Page() {
  return <Step2WebsiteVerification />;
}
