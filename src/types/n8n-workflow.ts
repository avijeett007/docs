// N8N Workflow Deployment System Types

// Core N8N API Types
export interface N8nHealthStatus {
  status: string;
  version?: string;
  instanceType?: string;
}

export interface N8nCredentialData {
  name: string;
  type: string;
  data: Record<string, any>;
}

export interface N8nCredential {
  id: string;
  name: string;
  type: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface N8nWorkflowData {
  name: string;
  nodes: N8nNode[];
  connections: Record<string, any>;
  settings?: Record<string, any>;
  staticData?: Record<string, any>;
  tags?: string[];
}

export interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  nodes: N8nNode[];
  connections: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

export interface N8nNode {
  id: string;
  name: string;
  type: string;
  position: [number, number];
  parameters?: Record<string, any>;
  credentials?: Record<string, { id: string; name: string }>;
}

// Workflow Product Types
export interface WorkflowProduct {
  id: string;
  name: string;
  description?: string;
  category: WorkflowCategory;
  tags: string[];
  difficulty: WorkflowDifficulty;
  estimatedSetupTime?: number;
  workflowJson: N8nWorkflowData;
  requiredNodes: string[];
  setupVideoUrl?: string;
  setupVideoThumbnail?: string;
  documentationUrl?: string;
  blogArticleUrl?: string;
  isActive: boolean;
  isPublished: boolean;
  publishedAt?: Date;
  sortOrder: number;
  downloadCount: number;
  deploymentCount: number;
  autoActivate: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export type WorkflowCategory = 'email' | 'crm' | 'social' | 'automation' | 'general';
export type WorkflowDifficulty = 'beginner' | 'intermediate' | 'advanced';

// N8N Instance Configuration Types
export interface N8nInstanceConfiguration {
  id: string;
  partnerId: string;
  name: string;
  baseUrl: string;
  apiKey: string; // Encrypted
  description?: string;
  isActive: boolean;
  lastConnectionTest?: Date;
  connectionStatus: ConnectionStatus;
  connectionError?: string;
  n8nVersion?: string;
  timeoutSeconds: number;
  retryAttempts: number;
  createdAt: Date;
  updatedAt: Date;
}

export type ConnectionStatus = 'connected' | 'failed' | 'unknown';

// Deployment Types
export interface WorkflowDeployment {
  id: string;
  partnerId: string;
  customerId?: string;
  productId: string;
  instanceConfigId: string;
  deploymentMode: DeploymentMode;
  status: DeploymentStatus;
  n8nWorkflowId?: string;
  n8nWorkflowName?: string;
  n8nCredentialId?: string;
  knotieTokenId?: string;
  deploymentLog: DeploymentLogEntry[];
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  updatedAt: Date;
}

export type DeploymentMode = 'automatic' | 'manual';
export type DeploymentStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export interface DeploymentLogEntry {
  step: string;
  status: 'in_progress' | 'completed' | 'failed';
  message: string;
  timestamp: Date;
  details?: Record<string, any>;
}

// API Request/Response Types
export interface CreateWorkflowProductRequest {
  name: string;
  description?: string;
  category: WorkflowCategory;
  tags?: string[];
  difficulty?: WorkflowDifficulty;
  estimatedSetupTime?: number;
  workflowJson: N8nWorkflowData;
  setupVideoUrl?: string;
  documentationUrl?: string;
  blogArticleUrl?: string;
  autoActivate?: boolean;
}

export interface UpdateWorkflowProductRequest extends Partial<CreateWorkflowProductRequest> {
  isActive?: boolean;
  isPublished?: boolean;
  sortOrder?: number;
}

export interface CreateInstanceConfigRequest {
  name: string;
  baseUrl: string;
  apiKey: string;
  description?: string;
  timeoutSeconds?: number;
  retryAttempts?: number;
}

export interface UpdateInstanceConfigRequest extends Partial<CreateInstanceConfigRequest> {
  isActive?: boolean;
}

export interface CreateDeploymentRequest {
  productId: string;
  instanceConfigId: string;
  customerIds: string[];
  deploymentMode?: DeploymentMode;
}

export interface DeploymentResult {
  success: boolean;
  workflowId?: string;
  workflowName?: string;
  credentialId?: string;
  deploymentLog: DeploymentLogEntry[];
  error?: string;
}

// Validation Types
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface ConnectionTestResult {
  success: boolean;
  version?: string;
  instanceType?: string;
  message: string;
  error?: string;
}

export interface CredentialTestResult {
  success: boolean;
  message: string;
  error?: string;
}

// Filter and Search Types
export interface WorkflowProductFilters {
  category?: WorkflowCategory;
  difficulty?: WorkflowDifficulty;
  isActive?: boolean;
  isPublished?: boolean;
  search?: string;
  tags?: string[];
}

export interface DeploymentFilters {
  status?: DeploymentStatus;
  deploymentMode?: DeploymentMode;
  customerId?: string;
  productId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

// Statistics Types
export interface DeploymentStats {
  totalDeployments: number;
  successfulDeployments: number;
  failedDeployments: number;
  pendingDeployments: number;
  successRate: number;
  averageDeploymentTime: number;
  deploymentsByStatus: Record<DeploymentStatus, number>;
  deploymentsByProduct: Array<{
    productId: string;
    productName: string;
    deploymentCount: number;
  }>;
  recentDeployments: WorkflowDeployment[];
}

// Error Types
export class N8nApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public responseBody?: string
  ) {
    super(message);
    this.name = 'N8nApiError';
  }
}

export class N8nConnectionError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = 'N8nConnectionError';
  }
}

export class N8nValidationError extends Error {
  constructor(message: string, public validationErrors?: string[]) {
    super(message);
    this.name = 'N8nValidationError';
  }
}

export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

// Security Types
export interface SecurityEvent {
  type: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
  resource: string;
  action: string;
  success: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any>;
}
