import { logger } from '@/lib/logger';

export interface N8nInstanceConfiguration {
  id: string;
  baseUrl: string;
  apiKey: string;
  timeoutSeconds: number;
  retryAttempts: number;
}

export interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  nodes: any[];
  connections: any;
  settings?: any;
  staticData?: any;
  tags?: string[];
}

export interface N8nCredential {
  id: string;
  name: string;
  type: string;
  data: any;
}

export interface N8nCredentialData {
  name: string;
  type: string;
  data: any;
}

export class N8nApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'N8nApiError';
  }
}

export class N8nApiClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;
  private retryAttempts: number;

  constructor(baseUrl: string, apiKey: string, config?: Partial<N8nInstanceConfiguration>) {
    this.baseUrl = baseUrl.replace(/\/$/, '') + '/api/v1';
    this.apiKey = apiKey;
    this.timeout = (config?.timeoutSeconds || 30) * 1000;
    this.retryAttempts = config?.retryAttempts || 3;
  }

  private async makeRequest(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': this.apiKey,
      ...options.headers,
    };

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          ...options,
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new N8nApiError(
            errorData.message || `HTTP ${response.status}: ${response.statusText}`,
            response.status,
            errorData
          );
        }

        return await response.json();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === this.retryAttempts) {
          break;
        }

        // Wait before retry (exponential backoff)
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError || new N8nApiError('Unknown error occurred');
  }

  // Health check
  async testConnection(): Promise<boolean> {
    try {
      await this.makeRequest('/workflows');
      return true;
    } catch (error) {
      logger.error('N8N connection test failed:', error as Error);
      return false;
    }
  }

  // Workflow methods
  async getWorkflows(): Promise<N8nWorkflow[]> {
    const response = await this.makeRequest('/workflows');
    return response.data || [];
  }

  async getWorkflow(id: string): Promise<N8nWorkflow> {
    return await this.makeRequest(`/workflows/${id}`);
  }

  async createWorkflow(workflow: Partial<N8nWorkflow>): Promise<N8nWorkflow> {
    return await this.makeRequest('/workflows', {
      method: 'POST',
      body: JSON.stringify(workflow),
    });
  }

  async updateWorkflow(id: string, workflow: Partial<N8nWorkflow>): Promise<N8nWorkflow> {
    return await this.makeRequest(`/workflows/${id}`, {
      method: 'PUT',
      body: JSON.stringify(workflow),
    });
  }

  async deleteWorkflow(id: string): Promise<void> {
    await this.makeRequest(`/workflows/${id}`, {
      method: 'DELETE',
    });
  }

  async activateWorkflow(id: string): Promise<N8nWorkflow> {
    return await this.makeRequest(`/workflows/${id}/activate`, {
      method: 'POST',
    });
  }

  async deactivateWorkflow(id: string): Promise<N8nWorkflow> {
    return await this.makeRequest(`/workflows/${id}/deactivate`, {
      method: 'POST',
    });
  }

  // Credential methods
  async getCredentials(): Promise<N8nCredential[]> {
    const response = await this.makeRequest('/credentials');
    return response.data || [];
  }

  async getCredential(id: string): Promise<N8nCredential> {
    return await this.makeRequest(`/credentials/${id}`);
  }

  async createCredential(credential: N8nCredentialData): Promise<N8nCredential> {
    return await this.makeRequest('/credentials', {
      method: 'POST',
      body: JSON.stringify(credential),
    });
  }

  async updateCredential(id: string, credential: Partial<N8nCredentialData>): Promise<N8nCredential> {
    return await this.makeRequest(`/credentials/${id}`, {
      method: 'PUT',
      body: JSON.stringify(credential),
    });
  }

  async deleteCredential(id: string): Promise<void> {
    await this.makeRequest(`/credentials/${id}`, {
      method: 'DELETE',
    });
  }

  // Execution methods
  async executeWorkflow(id: string, data?: any): Promise<any> {
    return await this.makeRequest(`/workflows/${id}/execute`, {
      method: 'POST',
      body: JSON.stringify({ data }),
    });
  }

  async getExecutions(workflowId?: string): Promise<any[]> {
    const endpoint = workflowId ? `/executions?workflowId=${workflowId}` : '/executions';
    const response = await this.makeRequest(endpoint);
    return response.data || [];
  }

  async getExecution(id: string): Promise<any> {
    return await this.makeRequest(`/executions/${id}`);
  }
}
