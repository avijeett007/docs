/**
 * Onboarding types and constants - Client-safe
 * 
 * This file contains only types and constants that can be safely imported
 * in client components without causing Edge Runtime compatibility issues.
 */

export interface OnboardingProgress {
  step1_customizePod: boolean;
  step2_onboardCustomer: boolean;
  step3_importAgent: boolean;
  step4_reviewAnalytics: boolean;
  step5_completeWhitelabel: boolean;
  step6_setupPayments: boolean;
  completedSteps: number;
  totalSteps: number;
  completedAt?: Date | null;
  isComplete: boolean;
  nextStep?: number;
  progressPercentage: number;
}

export interface OnboardingStep {
  id: number;
  key: string;
  title: string;
  description: string;
  targetPage: string;
  videoUrl?: string;
  estimatedTime: number;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 1,
    key: "customizePod",
    title: "Customize Your Pod",
    description: "Set up your whitelabel portal with subdomain or custom domain",
    targetPage: "/partner/settings/whitelabel",
    estimatedTime: 5
  },
  {
    id: 2,
    key: "onboardCustomer",
    title: "Onboard Your First Customer",
    description: "Create your first customer account",
    targetPage: "/partner/customers",
    estimatedTime: 7
  },
  {
    id: 3,
    key: "importAgent",
    title: "Import an Agent",
    description: "Create an AI agent using any provider (Retell, VAPI, Ultravox, ElevenLabs, GHL)",
    targetPage: "/partner/ai-agents",
    estimatedTime: 10
  },
  {
    id: 4,
    key: "reviewAnalytics",
    title: "Review Analytics",
    description: "Ensure your customer has accessed their portal",
    targetPage: "/partner/ai-usage",
    estimatedTime: 5
  },
  {
    id: 5,
    key: "completeWhitelabel",
    title: "Complete Whitelabeling",
    description: "Configure email settings (SMTP or SES domain)",
    targetPage: "/partner/settings/email-domain",
    estimatedTime: 8
  },
  {
    id: 6,
    key: "setupPayments",
    title: "Setup Your Payments",
    description: "Integrate Stripe Connect account",
    targetPage: "/partner/settings",
    estimatedTime: 10
  }
];
