export type OrderStatus = 
  | 'Submitted'
  | 'Processing'
  | 'Additional Info Requested'
  | 'Under Review'
  | 'Regulatory approval submitted'
  | 'Regulatory approval completed'
  | 'Business Agreement Established'
  | 'Under Development'
  | 'System under review'
  | 'Voice AI Agent Live';

export interface PricingBreakdown {
  platformBasePrice: number;
  voiceAICosts: number;
  telephonyCosts: number;
  communicationCosts: number;
  additionalCosts: number;
}

export interface PricingInfo {
  isEstimate: boolean;
  totalPrice: number;
  breakdown: PricingBreakdown;
  orderStatus?: OrderStatus;
  agreedPrice?: number;
}
