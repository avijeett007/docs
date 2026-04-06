import { logger } from './logger';

/**
 * Prospect Tracking Utility
 * Handles saving prospect progress through the 9-step SaaS onboarding process
 */

export interface ProspectData {
  // Step 1: Business Information
  businessName?: string;
  businessWebsite?: string;
  hasNoWebsite?: boolean;
  
  // Step 2: Website Analysis (saved automatically by API)
  
  // Step 3: Contact Details
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  businessCountry?: string; // ISO 2-letter country code (e.g., 'GB', 'US')
  
  // Step 4: Service Categories
  serviceCategories?: string[];
  customServices?: string;
  
  // Step 5: Knowledge Base
  knowledgeBaseFiles?: string[];
  knowledgeBaseUrls?: string[];
  
  // Step 6: Greeting Setup
  greetingText?: string;
  voiceType?: string;
  selectedVoiceId?: string;

  // Step 7: Information Collection
  informationSettings?: {
    selectedFields?: string[];
    allFields?: any[];
    collectName?: boolean;
    collectEmail?: boolean;
    collectPhone?: boolean;
    collectService?: boolean;
    collectPreferredTime?: boolean;
    collectCompany?: boolean;
    customFields?: any[];
  };

  // Step 8: Communication Settings
  meetingUrl?: string;
  smsEnabled?: boolean;
  callTransferEnabled?: boolean;
  transferNumber?: string;
  
  // Step 9: Summary & Deploy
  selectedPricingPlan?: string;
  billingModel?: string; // 'free_trial', 'pay_as_you_go', 'subscription'
  isCompleted?: boolean;
  deploymentSettings?: any;
  
  // Progress tracking
  currentStep?: number;
}

/**
 * Get partner ID from current hostname/subdomain
 */
export async function getPartnerIdFromHostname(): Promise<string | null> {
  try {
    const hostname = window.location.hostname;
    let subdomain = '';
    
    if (hostname.includes('.lvh.me')) {
      subdomain = hostname.split('.')[0];
    } else if (hostname.includes('.knotie-ai.pro')) {
      subdomain = hostname.split('.')[0];
    } else if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      subdomain = hostname;
    }

    if (!subdomain) {
      return null;
    }

    // Get partner ID from branding API
    const response = await fetch(`/api/whitelabel/branding/${subdomain}`);
    if (!response.ok) {
      return null;
    }

    const brandingData = await response.json();
    return brandingData.id || null;
  } catch (error) {
    logger.error('Error getting partner ID', error as Error, {
      operation: 'prospect_tracker'
    });
    return null;
  }
}

/**
 * Save prospect progress to database
 */
export async function saveProspectProgress(
  step: number,
  data: ProspectData,
  partnerId?: string
): Promise<boolean> {
  try {
    // Get partner ID if not provided
    const finalPartnerId = partnerId || await getPartnerIdFromHostname();

    if (!finalPartnerId) {
      logger.error('Could not determine partner ID', new Error('Partner ID determination failed'), {
        operation: 'prospect_tracker'
      });
      return false;
    }

    // Get existing prospect ID from localStorage for steps > 1
    const existingProspectId = step > 1 ? localStorage.getItem('onboarding_prospectId') : null;

    const response = await fetch('/api/whitelabel/prospects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        partnerId: finalPartnerId,
        step: step,
        prospectId: existingProspectId,
        data: {
          ...data,
          currentStep: step + 1 // Next step they should go to
        }
      })
    });

    if (!response.ok) {
      logger.error('Failed to save prospect progress', new Error(response.statusText), {
        operation: 'prospect_tracker',
        status: response.status
      });
      return false;
    }

    const result = await response.json();

    // Store prospect ID in localStorage for later use
    if (result.prospect?.id) {
      localStorage.setItem('onboarding_prospectId', result.prospect.id);
    }

    return result.success || false;
  } catch (error) {
    logger.error('Error saving prospect progress', error as Error, {
      operation: 'prospect_tracker'
    });
    return false;
  }
}

/**
 * Mark prospect as completed (Step 9)
 */
export async function completeProspectOnboarding(
  data: ProspectData,
  partnerId?: string
): Promise<boolean> {
  return await saveProspectProgress(9, {
    ...data,
    isCompleted: true,
    currentStep: 9
  }, partnerId);
}

/**
 * Get step names for display
 */
export function getStepName(step: number): string {
  const steps = [
    'Business Info',
    'Website Verification', 
    'Contact Details',
    'Service Categories',
    'Knowledge Base',
    'Greeting Setup',
    'Information Collection',
    'Communication Settings',
    'Summary & Deploy'
  ];
  return steps[step - 1] || 'Unknown';
}

/**
 * Get step descriptions for display
 */
export function getStepDescription(step: number): string {
  const descriptions = [
    'Collect business name and website information',
    'Analyze website and extract business details',
    'Gather contact information for the business owner',
    'Select service categories and business type',
    'Upload knowledge base files and URLs',
    'Create personalized greeting message',
    'Configure information collection settings',
    'Set up communication preferences',
    'Review and deploy the AI agent'
  ];
  return descriptions[step - 1] || 'Unknown step';
}
