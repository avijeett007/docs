export interface OnboardingFormData {
  business?: {
    companyName: string;
    phone: string;
  };
  callVolume?: {
    monthlyCallVolume: string;
    peakHours: string;
  };
  useCase?: {
    primaryUseCase: string;
    callComplexity: string;
  };
  integration?: {
    crm: string;
    existingPhone: string;
  };
  customization?: {
    scriptComplexity: string;
    languages: string[];
  };
  scheduling?: {
    timeline: string;
    existingAppointment: string;
  };
  workflowAutomation?: {
    customAutomation: string;
  };
  referral?: {
    isPartnerReferred: string;
    partnerCode: string;
  };
  additionalServices?: {
    webAIInterest: string;
    webChatVolume?: string;
    websiteInterest: string;
    domainAssistance: string;
  };
  automation?: {
    automationNeeds?: string[];
  };
}

export interface OnboardingState {
  formData: OnboardingFormData;
  isCompleted: boolean;
  lastUpdated: number;
}
