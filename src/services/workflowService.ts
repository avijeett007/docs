import { OnboardingFormData } from '../types';
import { PricingResult } from './pricingService';

interface WorkflowSubmission {
  formData: OnboardingFormData;
  pricing: PricingResult;
  timestamp: string;
  source: string;
}

export const submitToWorkflow = async (
  formData: OnboardingFormData,
  pricing: PricingResult
): Promise<boolean> => {
  const isEnabled = process.env.ENABLE_WORKFLOW_SUBMISSION === 'true';
  if (!isEnabled) {
    console.log('Workflow submission is disabled');
    return false;
  }

  const workflowUrl = process.env.WORKFLOW_SUBMISSION_URL;
  const apiKey = process.env.WORKFLOW_API_KEY;

  if (!workflowUrl || !apiKey) {
    console.error('Workflow configuration is missing');
    return false;
  }

  try {
    const submission: WorkflowSubmission = {
      formData,
      pricing,
      timestamp: new Date().toISOString(),
      source: 'onboarding-form'
    };

    const response = await fetch(workflowUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(submission)
    });

    if (!response.ok) {
      throw new Error(`Workflow submission failed: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error('Error submitting to workflow:', error);
    return false;
  }
};
