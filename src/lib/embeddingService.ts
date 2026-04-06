// src/lib/embeddingService.ts
// Client for communicating with the Knowledge Base Embedding Service

interface EmbeddingServiceConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
}

interface FileUploadResponse {
  status: string;
  message: string;
  data?: {
    file_id: string;
    original_filename: string;
    file_key: string;
    size: number;
    content_type: string;
    processing_status: string;
    uploaded_at: string;
  };
  timestamp: string;
}

interface ProcessingStatusResponse {
  status: string;
  data?: {
    kb_id: string;
    collection_name: string;
    files: {
      total: number;
      processed: number;
      processing: number;
      failed: number;
      pending: number;
    };
    vectors: {
      total: number;
      average_per_file: number;
    };
    storage: {
      total_size: string;
      average_file_size: string;
    };
    processing: {
      total_cost: number;
      average_cost_per_file: number;
    };
    last_processed?: string;
  };
  timestamp: string;
}

interface QueryResponse {
  status: string;
  data?: {
    query: string;
    results: Array<{
      score: number;
      content: string;
      file_id: string;
      file_name?: string;
      metadata: Record<string, any>;
    }>;
    total_results: number;
    knowledge_bases_queried: number;
  };
  timestamp: string;
}

interface KnowledgeBaseResponse {
  status: string;
  message: string;
  data?: Record<string, any>;
  timestamp: string;
}

class EmbeddingServiceClient {
  private config: EmbeddingServiceConfig;

  constructor() {
    this.config = {
      baseUrl: process.env.EMBEDDING_SERVICE_URL || 'http://localhost:8000',
      apiKey: process.env.EMBEDDING_SERVICE_API_KEY || '',
      timeout: 30000, // 30 seconds
    };
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    const defaultHeaders = {
      'X-API-Key': this.config.apiKey,
      'Content-Type': 'application/json',
    };

    // Don't set Content-Type for FormData
    const headers = options.body instanceof FormData 
      ? { 'X-API-Key': this.config.apiKey }
      : defaultHeaders;

    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.detail || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      
      throw new Error(`Embedding service error: ${errorMessage}`);
    }

    return response.json();
  }

  /**
   * Create a knowledge base collection in the embedding service
   */
  async createKnowledgeBase(
    kbId: string,
    partnerId: string,
    customerId: string,
    name: string
  ): Promise<KnowledgeBaseResponse> {
    return this.makeRequest<KnowledgeBaseResponse>('/knowledge-bases', {
      method: 'POST',
      body: JSON.stringify({
        partner_id: partnerId,
        customer_id: customerId,
        kb_id: kbId,
        name,
      }),
    });
  }

  /**
   * Upload a file to the knowledge base
   */
  async uploadFile(
    kbId: string,
    partnerId: string,
    customerId: string,
    file: File | Blob,
    description?: string
  ): Promise<FileUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('partner_id', partnerId);
    formData.append('customer_id', customerId);
    if (description) {
      formData.append('description', description);
    }

    return this.makeRequest<FileUploadResponse>(
      `/knowledge-bases/${kbId}/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );
  }

  /**
   * Get processing status for a knowledge base
   */
  async getProcessingStatus(
    kbId: string,
    partnerId: string,
    customerId: string
  ): Promise<ProcessingStatusResponse> {
    const params = new URLSearchParams({
      partner_id: partnerId,
      customer_id: customerId,
    });

    return this.makeRequest<ProcessingStatusResponse>(
      `/knowledge-bases/${kbId}/stats?${params}`
    );
  }

  /**
   * Query a knowledge base for semantic search
   */
  async queryKnowledgeBase(
    kbId: string,
    partnerId: string,
    customerId: string,
    query: string,
    options: {
      limit?: number;
      scoreThreshold?: number;
      includeMetadata?: boolean;
    } = {}
  ): Promise<QueryResponse> {
    return this.makeRequest<QueryResponse>(
      `/knowledge-bases/${kbId}/query`,
      {
        method: 'POST',
        body: JSON.stringify({
          query,
          partner_id: partnerId,
          customer_id: customerId,
          limit: options.limit || 5,
          score_threshold: options.scoreThreshold || 0.7,
          include_metadata: options.includeMetadata !== false,
        }),
      }
    );
  }

  /**
   * Delete a knowledge base and all its data
   */
  async deleteKnowledgeBase(
    kbId: string,
    partnerId: string,
    customerId: string
  ): Promise<KnowledgeBaseResponse> {
    const params = new URLSearchParams({
      partner_id: partnerId,
      customer_id: customerId,
    });

    return this.makeRequest<KnowledgeBaseResponse>(
      `/knowledge-bases/${kbId}?${params}`,
      {
        method: 'DELETE',
      }
    );
  }

  /**
   * Get knowledge base information
   */
  async getKnowledgeBase(
    kbId: string,
    partnerId: string,
    customerId: string
  ): Promise<KnowledgeBaseResponse> {
    const params = new URLSearchParams({
      partner_id: partnerId,
      customer_id: customerId,
    });

    return this.makeRequest<KnowledgeBaseResponse>(
      `/knowledge-bases/${kbId}?${params}`
    );
  }

  /**
   * Check if the embedding service is healthy
   */
  async healthCheck(): Promise<{ status: string; services: Record<string, string> }> {
    return this.makeRequest<{ status: string; services: Record<string, string> }>('/health');
  }
}

// Export singleton instance
export const embeddingService = new EmbeddingServiceClient();

// Export types for use in other files
export type {
  FileUploadResponse,
  ProcessingStatusResponse,
  QueryResponse,
  KnowledgeBaseResponse,
};
