import { z } from 'zod';

// Workflow Product Validation Schemas
export const workflowCategorySchema = z.enum(['email', 'crm', 'social', 'automation', 'general']);
export const workflowDifficultySchema = z.enum(['beginner', 'intermediate', 'advanced']);

export const n8nNodeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  position: z.tuple([z.number(), z.number()]),
  parameters: z.record(z.any()).optional(),
  credentials: z.record(z.object({
    id: z.string(),
    name: z.string(),
  })).optional(),
});

export const n8nWorkflowDataSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  nodes: z.array(n8nNodeSchema).min(1).max(100),
  connections: z.record(z.any()),
  settings: z.record(z.any()).optional(),
  staticData: z.record(z.any()).optional(),
  tags: z.array(z.string()).optional(),
  pinData: z.record(z.any()).optional(),
  meta: z.record(z.any()).optional(),
});

export const createWorkflowProductSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  category: workflowCategorySchema,
  tags: z.array(z.string().max(50)).max(20),
  difficulty: workflowDifficultySchema,
  estimatedSetupTime: z.number().int().min(1).max(300).optional(),
  workflowJson: n8nWorkflowDataSchema,
  setupVideoUrl: z.string().url().optional().or(z.literal('')),
  documentationUrl: z.string().url().optional().or(z.literal('')),
  blogArticleUrl: z.string().url().optional().or(z.literal('')),
  autoActivate: z.boolean(),
});

export const updateWorkflowProductSchema = createWorkflowProductSchema.partial().extend({
  isActive: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

// N8N Instance Configuration Validation Schemas
export const connectionStatusSchema = z.enum(['connected', 'failed', 'unknown']);

export const createInstanceConfigSchema = z.object({
  name: z.string().min(1).max(100),
  baseUrl: z.string().url().refine((url) => {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }, 'Must be a valid HTTP/HTTPS URL'),
  apiKey: z.string().min(10).max(500).refine((key) => {
    // N8N API keys can be JWT tokens or other formats - allow reasonable characters
    return /^[a-zA-Z0-9_\-\.]+$/.test(key);
  }, 'API key must contain only alphanumeric characters, underscores, hyphens, and dots'),
  description: z.string().max(500).optional(),
  isActive: z.boolean().default(true),
  timeoutSeconds: z.number().int().min(5).max(300).default(30),
  retryAttempts: z.number().int().min(0).max(10).default(3),
});

export const updateInstanceConfigSchema = createInstanceConfigSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// Deployment Validation Schemas
export const deploymentModeSchema = z.enum(['automatic', 'manual']);
export const deploymentStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'failed', 'cancelled']);

export const createDeploymentSchema = z.object({
  productId: z.string().uuid(),
  instanceConfigId: z.string().uuid(),
  customerIds: z.array(z.string().uuid()).min(1).max(50),
  deploymentMode: deploymentModeSchema.default('automatic'),
});

export const deploymentLogEntrySchema = z.object({
  step: z.string().min(1),
  status: z.enum(['in_progress', 'completed', 'failed']),
  message: z.string().min(1),
  timestamp: z.date(),
  details: z.record(z.any()).optional(),
});

// Filter Validation Schemas
export const workflowProductFiltersSchema = z.object({
  category: workflowCategorySchema.optional(),
  difficulty: workflowDifficultySchema.optional(),
  isActive: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  search: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt', 'deploymentCount', 'sortOrder']).default('sortOrder'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const deploymentFiltersSchema = z.object({
  status: deploymentStatusSchema.optional(),
  deploymentMode: deploymentModeSchema.optional(),
  customerId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'startedAt', 'completedAt', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// API Response Validation Schemas
export const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});

export const paginatedResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(z.any()),
  pagination: z.object({
    page: z.number().int(),
    limit: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
  }),
  error: z.string().optional(),
});

// Connection Test Validation Schemas
export const connectionTestResultSchema = z.object({
  success: z.boolean(),
  version: z.string().optional(),
  instanceType: z.string().optional(),
  message: z.string(),
  error: z.string().optional(),
});

// Security Validation Schemas
export const securityEventSchema = z.object({
  type: z.string().min(1),
  userId: z.string().uuid(),
  ipAddress: z.string().ip(),
  userAgent: z.string().min(1),
  resource: z.string().min(1),
  action: z.string().min(1),
  success: z.boolean(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  details: z.record(z.any()),
});

// Workflow JSON Security Validation
export const workflowSecurityValidationSchema = z.object({
  maxWorkflowSize: z.number().int().min(1024).default(1024 * 1024), // 1MB
  maxNodes: z.number().int().min(1).default(100),
  allowedNodeTypes: z.array(z.string()).optional(),
  blockedNodeTypes: z.array(z.string()).default([
    'n8n-nodes-base.executeCommand',
    'n8n-nodes-base.function',
    'n8n-nodes-base.functionItem',
  ]),
  allowCodeExecution: z.boolean().default(false),
  allowFileSystemAccess: z.boolean().default(false),
  allowNetworkAccess: z.boolean().default(true),
});

// Input Sanitization Schemas
export const sanitizeStringSchema = z.string().transform((val) => {
  return val.trim().replace(/[<>]/g, ''); // Basic XSS prevention
});

export const sanitizeHtmlSchema = z.string().transform((val) => {
  // Remove potentially dangerous HTML tags and attributes
  return val
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '') // Remove event handlers
    .trim();
});

// Rate Limiting Schemas
export const rateLimitConfigSchema = z.object({
  requests: z.number().int().min(1),
  window: z.number().int().min(1000), // milliseconds
  identifier: z.string().min(1),
});

// Audit Log Schemas
export const auditLogSchema = z.object({
  action: z.string().min(1),
  resource: z.string().min(1),
  resourceId: z.string().optional(),
  userId: z.string().uuid(),
  userRole: z.string().min(1),
  ipAddress: z.string().ip(),
  userAgent: z.string().min(1),
  success: z.boolean(),
  details: z.record(z.any()).optional(),
  timestamp: z.date().default(() => new Date()),
});

// Export type inference helpers
export type CreateWorkflowProductInput = z.infer<typeof createWorkflowProductSchema>;
export type UpdateWorkflowProductInput = z.infer<typeof updateWorkflowProductSchema>;
export type CreateInstanceConfigInput = z.infer<typeof createInstanceConfigSchema>;
export type UpdateInstanceConfigInput = z.infer<typeof updateInstanceConfigSchema>;
export type CreateDeploymentInput = z.infer<typeof createDeploymentSchema>;
export type WorkflowProductFilters = z.infer<typeof workflowProductFiltersSchema>;
export type DeploymentFilters = z.infer<typeof deploymentFiltersSchema>;
export type ConnectionTestResult = z.infer<typeof connectionTestResultSchema>;
export type SecurityEvent = z.infer<typeof securityEventSchema>;
export type WorkflowSecurityValidation = z.infer<typeof workflowSecurityValidationSchema>;
export type RateLimitConfig = z.infer<typeof rateLimitConfigSchema>;
export type AuditLog = z.infer<typeof auditLogSchema>;

// Validation helper functions
export function validateWorkflowJson(workflowJson: unknown): { isValid: boolean; errors: string[] } {
  try {
    n8nWorkflowDataSchema.parse(workflowJson);
    return { isValid: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`),
      };
    }
    return { isValid: false, errors: ['Invalid workflow JSON format'] };
  }
}

export function validateApiKey(apiKey: string): boolean {
  return apiKey.length >= 10 && apiKey.length <= 500 && /^[a-zA-Z0-9_\-\.]+$/.test(apiKey);
}

export function sanitizeInput<T>(schema: z.ZodSchema<T>, input: unknown): T {
  return schema.parse(input);
}
