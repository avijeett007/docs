// Constants for pricing
export const PLATFORM_FEE = 99;  // Base platform fee per month
export const VOICE_AI_RATE = 0.10;  // Per minute
export const TELEPHONY_RATE = 0.06;  // Per minute
export const EMAIL_RATE = 0.01;  // Per email
export const SMS_RATE = 0.002;  // Per SMS

// Competitor (VAPI) rates
export const VAPI_PLATFORM_RATE = 0.05;  // Per minute
export const VAPI_VOICE_AI_RATE = 0.28;  // Per minute
export const VAPI_TELEPHONY_RATE = 0.06;  // Per minute

// Define the valid call volume range keys
export type CallVolumeRangeKey = '0-1000' | '1001-5000' | '5001-10000' | '10001+';
export type ComplexityKey = 'Simple' | 'Moderate' | 'Complex';

// Call volume ranges
const CALL_VOLUME_RANGES: Record<CallVolumeRangeKey, { min: number; max: number; avgMinutes: number }> = {
  '0-1000': { min: 0, max: 1000, avgMinutes: 5 },
  '1001-5000': { min: 1001, max: 5000, avgMinutes: 5 },
  '5001-10000': { min: 5001, max: 10000, avgMinutes: 5 },
  '10001+': { min: 10001, max: 50000, avgMinutes: 5 }
};

// Complexity multipliers
const COMPLEXITY_MULTIPLIERS: Record<ComplexityKey, number> = {
  Simple: 1,
  Moderate: 1.5,
  Complex: 2
};

export interface PricingInput {
  monthlyCallVolume: CallVolumeRangeKey;
  callComplexity: ComplexityKey;
  scriptComplexity: ComplexityKey;
}

export interface PricingBreakdown {
  platformFee: number;
  voiceAICost: number;
  telephonyCost: number;
  emailCost: number;
  smsCost: number;
  totalCost: number;
}

export interface CompetitorPricing {
  platformUsageCost: number;
  voiceAICost: number;
  telephonyCost: number;
  totalCost: number;
}

export function calculatePrice(input: PricingInput) {
  const volumeRange = CALL_VOLUME_RANGES[input.monthlyCallVolume] || CALL_VOLUME_RANGES['0-1000'];
  const complexityMultiplier = COMPLEXITY_MULTIPLIERS[input.callComplexity] || COMPLEXITY_MULTIPLIERS.Simple;
  
  // Calculate average monthly minutes
  const avgMonthlyMinutes = ((volumeRange.min + volumeRange.max) / 2) * volumeRange.avgMinutes;
  
  // Calculate costs
  const voiceAICost = avgMonthlyMinutes * VOICE_AI_RATE * complexityMultiplier;
  const telephonyCost = avgMonthlyMinutes * TELEPHONY_RATE;
  
  // Estimate notification costs (assuming 1 email and 1 SMS per call)
  const avgMonthlyVolume = (volumeRange.min + volumeRange.max) / 2;
  const emailCost = avgMonthlyVolume * EMAIL_RATE;
  const smsCost = avgMonthlyVolume * SMS_RATE;
  
  const totalPrice = PLATFORM_FEE + voiceAICost + telephonyCost + emailCost + smsCost;
  
  return {
    totalPrice: Math.round(totalPrice * 100) / 100,
    breakdown: {
      platformFee: PLATFORM_FEE,
      voiceAICost: Math.round(voiceAICost * 100) / 100,
      telephonyCost: Math.round(telephonyCost * 100) / 100,
      emailCost: Math.round(emailCost * 100) / 100,
      smsCost: Math.round(smsCost * 100) / 100,
      totalCost: Math.round(totalPrice * 100) / 100
    }
  };
}

export function calculateCompetitorPrice(input: PricingInput) {
  const volumeRange = CALL_VOLUME_RANGES[input.monthlyCallVolume] || CALL_VOLUME_RANGES['0-1000'];
  const complexityMultiplier = COMPLEXITY_MULTIPLIERS[input.callComplexity] || COMPLEXITY_MULTIPLIERS.Simple;
  
  // Calculate average monthly minutes
  const avgMonthlyMinutes = ((volumeRange.min + volumeRange.max) / 2) * volumeRange.avgMinutes;
  
  // Calculate VAPI costs
  const platformUsageCost = avgMonthlyMinutes * VAPI_PLATFORM_RATE;
  const voiceAICost = avgMonthlyMinutes * VAPI_VOICE_AI_RATE * complexityMultiplier;
  const telephonyCost = avgMonthlyMinutes * VAPI_TELEPHONY_RATE;
  
  const totalPrice = platformUsageCost + voiceAICost + telephonyCost;
  
  return {
    totalPrice: Math.round(totalPrice * 100) / 100,
    breakdown: {
      platformUsageCost: Math.round(platformUsageCost * 100) / 100,
      voiceAICost: Math.round(voiceAICost * 100) / 100,
      telephonyCost: Math.round(telephonyCost * 100) / 100,
      totalCost: Math.round(totalPrice * 100) / 100
    }
  };
}

export function calculatePriceWithInput(input: PricingInput) {
  const knotiePrice = calculatePrice(input);
  const competitorPrice = calculateCompetitorPrice(input);
  
  return {
    knotieAI: knotiePrice,
    competitor: competitorPrice,
    savings: Math.round((competitorPrice.totalPrice - knotiePrice.totalPrice) * 100) / 100
  };
}
