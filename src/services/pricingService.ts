import { OnboardingFormData } from '../types';

export interface PricingTier {
  name: string;
  monthlyPrice: number;
  setupFee: number;
  includedMinutes: number;
  features: string[];
}

const BASE_TIERS: PricingTier[] = [
  {
    name: 'Starter',
    monthlyPrice: 699,
    setupFee: 299,
    includedMinutes: 500,
    features: [
      'AI Voice Assistant',
      'Basic CRM Integration',
      'Standard Business Hours Coverage',
      'Basic Call Scripts',
      'Up to 500 Minutes Included'
    ]
  },
  {
    name: 'Professional',
    monthlyPrice: 899,
    setupFee: 299,
    includedMinutes: 1000,
    features: [
      'Everything in Starter',
      'Extended Hours Coverage',
      'Advanced CRM Integration',
      'Custom Call Scripts',
      'Up to 1,000 Minutes Included'
    ]
  },
  {
    name: 'Enterprise',
    monthlyPrice: 1499,
    setupFee: 0,
    includedMinutes: 5000,
    features: [
      'Everything in Professional',
      '24/7 Coverage Available',
      'Enterprise CRM Integration',
      'Custom Workflows',
      'Up to 5,000 Minutes Included'
    ]
  },
  {
    name: 'Enterprise Plus',
    monthlyPrice: 1799,
    setupFee: 0,
    includedMinutes: 10000,
    features: [
      'Everything in Enterprise',
      'Priority Support',
      'Custom Development',
      'Dedicated Account Manager',
      'Up to 10,000 Minutes Included'
    ]
  }
];

interface PricingFactors {
  monthlyPriceAdjustment: number;
  setupFeeAdjustment: number;
  recommendedTier: number;
}

export interface PricingResult {
  recommendedTier: PricingTier;
  adjustedMonthlyPrice: number;
  adjustedSetupFee: number;
  totalFirstMonth: number;
  additionalFeatures: string[];
}

export const calculatePricing = (formData: OnboardingFormData): PricingResult => {
  const factors = calculatePricingFactors(formData);
  const tier = BASE_TIERS[factors.recommendedTier];
  
  const adjustedMonthlyPrice = tier.monthlyPrice + factors.monthlyPriceAdjustment;
  const adjustedSetupFee = tier.setupFee + factors.setupFeeAdjustment;
  
  return {
    recommendedTier: tier,
    adjustedMonthlyPrice,
    adjustedSetupFee,
    totalFirstMonth: adjustedMonthlyPrice + adjustedSetupFee,
    additionalFeatures: getAdditionalFeatures(formData)
  };
};

const calculatePricingFactors = (formData: OnboardingFormData): PricingFactors => {
  let monthlyPriceAdjustment = 0;
  let setupFeeAdjustment = 0;
  let recommendedTier = 0;

  // Determine base tier from call volume
  switch (formData.callVolume?.monthlyCallVolume) {
    case "Up to 100 calls":
    case "101-500 calls":
      recommendedTier = 0; // Starter
      break;
    case "501-1000 calls":
      recommendedTier = 1; // Professional
      break;
    case "1001-5000 calls":
      recommendedTier = 2; // Enterprise
      break;
    case "Over 5000 calls":
      recommendedTier = 3; // Enterprise Plus
      break;
  }

  // Adjust for 24/7 coverage
  if (formData.callVolume?.peakHours === "24/7 Coverage") {
    monthlyPriceAdjustment += 200;
  }

  // Adjust for CRM integration complexity
  if (formData.integration?.crm && 
      formData.integration.crm !== "Go High Level (GHL)" && 
      formData.integration.crm !== "Other (We'll discuss during onboarding)") {
    setupFeeAdjustment += 100;
  }

  // Adjust for script complexity
  if (formData.customization?.scriptComplexity === "I need help developing scripts") {
    setupFeeAdjustment += 150;
  }

  // Adjust for automation features
  const automationCount = formData.automation?.automationNeeds?.length || 0;
  if (automationCount > 3) {
    monthlyPriceAdjustment += (automationCount - 3) * 50;
  }

  // Adjust for web chat integration
  if (formData.additionalServices?.webAIInterest === "Yes, I want web chat AI integration") {
    monthlyPriceAdjustment += 100;
    
    // Additional adjustment based on chat volume
    switch (formData.additionalServices?.webChatVolume) {
      case "501-1000 chats":
        monthlyPriceAdjustment += 50;
        break;
      case "1001-5000 chats":
        monthlyPriceAdjustment += 100;
        break;
      case "Over 5000 chats":
        monthlyPriceAdjustment += 200;
        break;
    }
  }

  return {
    monthlyPriceAdjustment,
    setupFeeAdjustment,
    recommendedTier
  };
};

const getAdditionalFeatures = (formData: OnboardingFormData): string[] => {
  const features: string[] = [];

  // Add web-related features
  if (formData.additionalServices?.websiteInterest === "Yes, I'm interested in a complimentary website") {
    features.push("Complimentary Modern Website");
  }
  
  if (formData.additionalServices?.domainAssistance === "Yes, please help me set up a domain") {
    features.push("Domain Setup Assistance");
  }

  if (formData.additionalServices?.webAIInterest === "Yes, I want web chat AI integration") {
    features.push("Web Chat AI Integration");
  }

  // Add automation features
  if (formData.automation?.automationNeeds) {
    formData.automation.automationNeeds.forEach(need => {
      if (need !== "None at this time" && need !== "Custom automation needs") {
        features.push(need);
      }
    });
  }

  return features;
};
