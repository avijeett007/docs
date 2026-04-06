/**
 * Webhook Onboarding Request Validator
 *
 * Validates the request body for the prospect onboarding webhook API.
 * Uses Zod for schema validation with per-step data validation.
 */

import { z } from 'zod';

// --- Step Data Schemas ---

const businessInfoSchema = z.object({
  business_name: z.string().min(1).max(200),
  business_website: z.string().url().max(500).optional().or(z.literal('')),
  has_no_website: z.boolean().optional(),
  business_country: z.string().length(2).optional(), // ISO 2-letter code
}).optional();

const customerDetailsSchema = z.object({
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  email: z.string().email().max(255),
  phone: z.string().max(20).optional(),
  country: z.string().length(2).optional(),
}).optional();

const serviceCategoriesSchema = z.object({
  categories: z.array(z.string().max(100)).min(1).max(20),
  custom_services: z.string().max(500).optional(),
}).optional();

const knowledgeBaseSchema = z.object({
  urls: z.array(z.string().url().max(500)).max(10).optional(),
}).optional();

const greetingSchema = z.object({
  greeting_text: z.string().max(500).optional(),
  voice_type: z.enum(['male', 'female']).optional(),
  voice_id: z.string().max(200).optional(),
}).optional();

const informationCollectionSchema = z.object({
  fields: z.array(z.string().max(100)).max(20).optional(),
  custom_fields: z.array(z.object({
    name: z.string().min(1).max(100),
    type: z.enum(['text', 'select', 'number', 'email', 'phone']).optional(),
    options: z.array(z.string().max(100)).max(20).optional(),
    required: z.boolean().optional(),
  })).max(10).optional(),
}).optional();

const communicationSchema = z.object({
  meeting_url: z.string().url().max(500).optional().or(z.literal('')),
  sms_enabled: z.boolean().optional(),
  call_transfer_enabled: z.boolean().optional(),
  transfer_number: z.string().max(20).optional(),
}).optional();

const deploymentSchema = z.object({
  billing_model: z.enum(['free_trial', 'pay_as_you_go', 'subscription']).optional(),
}).optional();

// --- Step Data Container ---

const stepDataSchema = z.object({
  business_info: businessInfoSchema,
  customer_details: customerDetailsSchema,
  service_categories: serviceCategoriesSchema,
  knowledge_base: knowledgeBaseSchema,
  greeting: greetingSchema,
  information_collection: informationCollectionSchema,
  communication: communicationSchema,
  deployment: deploymentSchema,
}).optional();

// --- Prospect Identifier ---

const prospectIdentifierSchema = z.object({
  email: z.string().email().max(255).optional(),
  phone: z.string().max(20).optional(),
}).refine(
  (data) => data.email || data.phone,
  { message: 'At least one of email or phone must be provided' }
);

// --- Main Request Schema ---

export const webhookOnboardingRequestSchema = z.object({
  prospect_identifier: prospectIdentifierSchema,
  complete_from_step: z.number().int().min(1).max(9).nullable().optional(),
  step_data: stepDataSchema,
});

// --- Type Exports ---

export type WebhookOnboardingRequest = z.infer<typeof webhookOnboardingRequestSchema>;
export type StepData = z.infer<typeof stepDataSchema>;
export type BusinessInfoData = z.infer<typeof businessInfoSchema>;
export type CustomerDetailsData = z.infer<typeof customerDetailsSchema>;
export type ServiceCategoriesData = z.infer<typeof serviceCategoriesSchema>;
export type KnowledgeBaseData = z.infer<typeof knowledgeBaseSchema>;
export type GreetingData = z.infer<typeof greetingSchema>;
export type InformationCollectionData = z.infer<typeof informationCollectionSchema>;
export type CommunicationData = z.infer<typeof communicationSchema>;
export type DeploymentData = z.infer<typeof deploymentSchema>;

// --- Validation Function ---

export function validateWebhookOnboardingRequest(body: unknown): {
  success: boolean;
  data?: WebhookOnboardingRequest;
  errors?: string[];
} {
  try {
    const data = webhookOnboardingRequestSchema.parse(body);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`),
      };
    }
    return { success: false, errors: ['Invalid request body'] };
  }
}

