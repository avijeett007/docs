// src/lib/anythingLLMService.ts
// Client for communicating with the self-hosted AnythingLLM service
// Uses circuit breaker pattern for resilience

import { logger } from '@/lib/logger';
import { getCircuitBreaker, CircuitBreakerError } from '@/lib/circuitBreaker';

interface AnythingLLMConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
}

// Response Types
interface WorkspaceResponse {
  workspace: {
    id: number;
    name: string;
    slug: string;
    vectorTag: string | null;
    createdAt: string;
    openAiTemp: number | null;
    openAiHistory: number;
    lastUpdatedAt: string;
    openAiPrompt: string | null;
    similarityThreshold: number;
    chatProvider: string | null;
    chatModel: string | null;
    topN: number;
    chatMode: string;
    pfpFilename: string | null;
    agentProvider: string | null;
    agentModel: string | null;
    queryRefusalResponse: string | null;
  };
  message: string | null;
}

interface DocumentUploadResponse {
  success: boolean;
  error: string | null;
  documents: Array<{
    id: string;
    url: string | null;
    title: string | null;
    docAuthor: string | null;
    description: string | null;
    docSource: string;
    chunkSource: string;
    published: string | null;
    wordCount: number;
    token_count_estimate: number;
    location: string;
  }>;
}

interface QueryResponse {
  id: string;
  type: string;
  close: boolean;
  error: string | null;
  chatId: number;
  textResponse: string;
  sources: Array<{
    title: string | null;
    chunk: string;
    score: number;
  }>;
  metrics?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    outputTps?: number;
    duration?: number;
  };
}

interface WorkspaceConfig {
  topN?: number;
  similarityThreshold?: number;
  chatMode?: 'chat' | 'query';
}

class AnythingLLMServiceClient {
  private config: AnythingLLMConfig;
  private circuitBreaker;

  constructor() {
    this.config = {
      baseUrl: process.env.ANYTHINGLLM_BASE_URL || 'https://anyllm.knotie.ai',
      apiKey: process.env.ANYTHINGLLM_API_KEY || '',
      timeout: 60000, // 60 seconds for document processing
    };
    // Initialize circuit breaker for AnythingLLM service
    this.circuitBreaker = getCircuitBreaker({
      name: 'anythingllm',
      failureThreshold: 3,         // Open circuit after 3 failures
      resetTimeout: 30000,          // Try again after 30 seconds
      timeout: 60000,               // 60s timeout for document processing
      successThreshold: 2,          // 2 successes to close circuit
      halfOpenRequestPercentage: 50,
    });
  }

  /**
   * Check if AnythingLLM service is configured and available
   */
  isConfigured(): boolean {
    return Boolean(this.config.baseUrl && this.config.apiKey);
  }

  /**
   * Check if the circuit breaker is allowing requests
   */
  isAvailable(): boolean {
    return this.circuitBreaker.isAvailable();
  }

  /**
   * Check if an error is a circuit breaker error (service unavailable)
   */
  isCircuitBreakerError(error: unknown): boolean {
    return error instanceof CircuitBreakerError;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Wrap the request in circuit breaker
    return this.circuitBreaker.execute(async () => {
      const url = `${this.config.baseUrl}/api/v1${endpoint}`;

      const defaultHeaders: Record<string, string> = {
        'Authorization': `Bearer ${this.config.apiKey}`,
      };

      // Don't set Content-Type for FormData (let browser set it with boundary)
      if (!(options.body instanceof FormData)) {
        defaultHeaders['Content-Type'] = 'application/json';
      }

      const response = await fetch(url, {
        ...options,
        headers: {
          ...defaultHeaders,
          ...options.headers,
        },
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}`;

        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }

        throw new Error(`AnythingLLM service error: ${errorMessage}`);
      }

      return response.json();
    });
  }

  /**
   * Generate workspace slug from knowledge base, customer, and partner IDs
   */
  generateWorkspaceSlug(knowledgeBaseId: string, customerId: string, partnerId: string): string {
    // Create a clean slug using first 8 chars of each ID
    const kbShort = knowledgeBaseId.replace(/-/g, '').substring(0, 8);
    const custShort = customerId.replace(/-/g, '').substring(0, 8);
    const partShort = partnerId.replace(/-/g, '').substring(0, 8);
    return `kb_${kbShort}_${custShort}_${partShort}`;
  }

  /**
   * Create a new workspace in AnythingLLM
   */
  async createWorkspace(
    name: string,
    config: WorkspaceConfig = {}
  ): Promise<WorkspaceResponse> {
    logger.info('Creating AnythingLLM workspace', {
      operation: 'anythingllm_create_workspace',
      workspaceName: name,
    });

    const response = await this.makeRequest<WorkspaceResponse>('/workspace/new', {
      method: 'POST',
      body: JSON.stringify({
        name,
        topN: config.topN || 4,
        similarityThreshold: config.similarityThreshold || 0.7,
        chatMode: config.chatMode || 'query',
      }),
    });

    logger.info('AnythingLLM workspace created successfully', {
      operation: 'anythingllm_create_workspace',
      workspaceId: response.workspace.id,
      workspaceSlug: response.workspace.slug,
    });

    return response;
  }


  /**
   * Upload a file to AnythingLLM and optionally add to a workspace
   */
  async uploadDocument(
    file: File | Blob,
    filename: string,
    workspaceSlug?: string
  ): Promise<DocumentUploadResponse> {
    logger.info('Uploading document to AnythingLLM', {
      operation: 'anythingllm_upload_document',
      filename,
      workspaceSlug,
      fileSize: file.size,
    });

    const formData = new FormData();
    formData.append('file', file, filename);

    // If workspace slug is provided, add document directly to workspace
    if (workspaceSlug) {
      formData.append('addToWorkspaces', workspaceSlug);
    }

    const response = await this.makeRequest<DocumentUploadResponse>('/document/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.success) {
      throw new Error(`Document upload failed: ${response.error || 'Unknown error'}`);
    }

    logger.info('Document uploaded to AnythingLLM successfully', {
      operation: 'anythingllm_upload_document',
      filename,
      documentCount: response.documents?.length || 0,
      documentLocation: response.documents?.[0]?.location,
    });

    return response;
  }

  /**
   * Upload a website URL to AnythingLLM for scraping and embedding
   */
  async uploadLink(
    url: string,
    workspaceSlug?: string
  ): Promise<DocumentUploadResponse> {
    logger.info('Uploading website link to AnythingLLM', {
      operation: 'anythingllm_upload_link',
      url,
      workspaceSlug,
    });

    const body: Record<string, string> = { link: url };
    if (workspaceSlug) {
      body.addToWorkspaces = workspaceSlug;
    }

    const response = await this.makeRequest<DocumentUploadResponse>('/document/upload-link', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (!response.success) {
      throw new Error(`Link upload failed: ${response.error || 'Unknown error'}`);
    }

    logger.info('Website link uploaded to AnythingLLM successfully', {
      operation: 'anythingllm_upload_link',
      url,
      documentCount: response.documents?.length || 0,
      documentLocation: response.documents?.[0]?.location,
    });

    return response;
  }

  /**
   * Query a workspace for semantic search/RAG
   */
  async queryWorkspace(
    workspaceSlug: string,
    query: string,
    sessionId?: string
  ): Promise<QueryResponse> {
    logger.info('Querying AnythingLLM workspace', {
      operation: 'anythingllm_query',
      workspaceSlug,
      queryLength: query.length,
      sessionId,
    });

    const response = await this.makeRequest<QueryResponse>(`/workspace/${workspaceSlug}/chat`, {
      method: 'POST',
      body: JSON.stringify({
        message: query,
        mode: 'query',
        sessionId: sessionId || `query-${Date.now()}`,
      }),
    });

    if (response.error) {
      throw new Error(`Query failed: ${response.error}`);
    }

    logger.info('AnythingLLM query completed', {
      operation: 'anythingllm_query',
      workspaceSlug,
      responseLength: response.textResponse?.length || 0,
      sourcesCount: response.sources?.length || 0,
      totalTokens: response.metrics?.total_tokens,
      duration: response.metrics?.duration,
    });

    return response;
  }

  /**
   * Update workspace embeddings (add or remove documents)
   */
  async updateWorkspaceEmbeddings(
    workspaceSlug: string,
    adds?: string[],
    deletes?: string[]
  ): Promise<{ message: string }> {
    logger.info('Updating AnythingLLM workspace embeddings', {
      operation: 'anythingllm_update_embeddings',
      workspaceSlug,
      addCount: adds?.length || 0,
      deleteCount: deletes?.length || 0,
    });

    const response = await this.makeRequest<{ message: string }>(
      `/workspace/${workspaceSlug}/update-embeddings`,
      {
        method: 'POST',
        body: JSON.stringify({
          adds: adds || [],
          deletes: deletes || [],
        }),
      }
    );

    logger.info('AnythingLLM embeddings updated', {
      operation: 'anythingllm_update_embeddings',
      workspaceSlug,
    });

    return response;
  }

  /**
   * Get workspace details
   */
  async getWorkspace(slug: string): Promise<WorkspaceResponse> {
    return this.makeRequest<WorkspaceResponse>(`/workspace/${slug}`);
  }

  /**
   * Check if a workspace exists
   */
  async workspaceExists(slug: string): Promise<boolean> {
    try {
      await this.getWorkspace(slug);
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const anythingLLMService = new AnythingLLMServiceClient();

/**
 * Generate workspace name based on knowledge base, customer, and partner IDs
 * Format: kb_{kbId}_{customerId}_{partnerId}
 */
export function generateWorkspaceName(
  knowledgeBaseId: string,
  customerId: string,
  partnerId: string
): string {
  // Use first 8 chars of each UUID for readability while maintaining uniqueness
  const kbShort = knowledgeBaseId.substring(0, 8);
  const custShort = customerId.substring(0, 8);
  const partnerShort = partnerId.substring(0, 8);
  return `kb_${kbShort}_${custShort}_${partnerShort}`;
}

/**
 * Ensure a knowledge base has an AnythingLLM workspace.
 * Uses optimistic locking with database-level check to prevent race conditions.
 *
 * This function is designed to be called from multiple concurrent requests safely.
 * It handles the following scenarios:
 * 1. Workspace already exists in DB - returns existing slug
 * 2. Workspace needs to be created - creates and updates DB atomically
 * 3. Race condition detected - re-fetches from DB to get the slug created by another request
 *
 * @param prismaClient - The Prisma client instance
 * @param knowledgeBaseId - The knowledge base ID
 * @param customerId - The customer ID
 * @param partnerId - The partner ID
 * @returns The workspace slug, or null if workspace creation is not possible
 */
export async function ensureAnythingLLMWorkspace(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prismaClient: any,
  knowledgeBaseId: string,
  customerId: string,
  partnerId: string
): Promise<string | null> {
  // Check if AnythingLLM service is configured
  if (!anythingLLMService.isConfigured()) {
    logger.warn('AnythingLLM service not configured, skipping workspace creation', {
      knowledgeBaseId,
      customerId,
      partnerId,
    });
    return null;
  }

  // Step 1: Fetch the current knowledge base state
  const knowledgeBase = await prismaClient.knowledgeBase.findUnique({
    where: { id: knowledgeBaseId },
    select: {
      id: true,
      name: true,
      anythingLLMWorkspaceSlug: true,
      anythingLLMWorkspaceId: true,
    },
  });

  if (!knowledgeBase) {
    logger.error('Knowledge base not found for workspace creation', undefined, {
      knowledgeBaseId,
      customerId,
      partnerId,
    });
    return null;
  }

  // Step 2: If workspace already exists, return it
  if (knowledgeBase.anythingLLMWorkspaceSlug) {
    logger.info('Using existing AnythingLLM workspace', {
      knowledgeBaseId,
      workspaceSlug: knowledgeBase.anythingLLMWorkspaceSlug,
    });
    return knowledgeBase.anythingLLMWorkspaceSlug;
  }

  // Step 3: Create workspace with optimistic locking
  try {
    const workspaceName = generateWorkspaceName(knowledgeBaseId, customerId, partnerId);

    logger.info('Creating AnythingLLM workspace', {
      knowledgeBaseId,
      customerId,
      partnerId,
      workspaceName,
    });

    // Create the workspace in AnythingLLM
    const response = await anythingLLMService.createWorkspace(workspaceName);

    // Use atomic update with WHERE clause to handle race condition
    // Only update if anythingLLMWorkspaceSlug is still null
    const updateResult = await prismaClient.knowledgeBase.updateMany({
      where: {
        id: knowledgeBaseId,
        anythingLLMWorkspaceSlug: null, // Optimistic lock condition
      },
      data: {
        anythingLLMWorkspaceSlug: response.workspace.slug,
        anythingLLMWorkspaceId: response.workspace.id,
        anythingLLMCreatedAt: new Date(),
      },
    });

    if (updateResult.count > 0) {
      // We successfully created and linked the workspace
      logger.info('AnythingLLM workspace created and linked to knowledge base', {
        knowledgeBaseId,
        workspaceSlug: response.workspace.slug,
        workspaceId: response.workspace.id,
      });
      return response.workspace.slug;
    } else {
      // Race condition: another request already created the workspace
      // Re-fetch the knowledge base to get the workspace created by the other request
      logger.info('Race condition detected, fetching workspace created by concurrent request', {
        knowledgeBaseId,
      });

      const updatedKB = await prismaClient.knowledgeBase.findUnique({
        where: { id: knowledgeBaseId },
        select: { anythingLLMWorkspaceSlug: true },
      });

      if (updatedKB?.anythingLLMWorkspaceSlug) {
        // Note: We created a duplicate workspace in AnythingLLM, but this is acceptable
        // as it won't be used. In production, we could delete the orphaned workspace.
        logger.info('Using workspace created by concurrent request', {
          knowledgeBaseId,
          workspaceSlug: updatedKB.anythingLLMWorkspaceSlug,
        });
        return updatedKB.anythingLLMWorkspaceSlug;
      }

      // This shouldn't happen, but handle gracefully
      logger.error('Failed to resolve workspace after race condition', undefined, {
        knowledgeBaseId,
      });
      return null;
    }
  } catch (error) {
    logger.error('Error creating AnythingLLM workspace',
      error instanceof Error ? error : undefined,
      { knowledgeBaseId, customerId, partnerId }
    );
    return null;
  }
}

// Export types for use in other files
export type {
  WorkspaceResponse,
  DocumentUploadResponse,
  QueryResponse,
  WorkspaceConfig,
};