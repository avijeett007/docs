import { Metadata } from 'next';
import Step5KnowledgeBase from '@/components/whitelabel/saas/onboarding/Step5KnowledgeBase';

export const metadata: Metadata = {
  title: 'Knowledge Base - AI Receptionist Setup',
  description: 'Upload documents or add website content to train your AI receptionist',
};

export default function OnboardingStep5Page() {
  return <Step5KnowledgeBase />;
}
