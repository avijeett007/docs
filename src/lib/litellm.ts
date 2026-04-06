import { logger } from '@/lib/logger';

// ============================================
// Types
// ============================================

export interface LiteLLMTeamRequest {
  team_alias: string;
  models?: string[];
  max_budget?: number;
  budget_duration?: string; // e.g. "30d"
  rpm_limit?: number; // requests per minute limit
  tpm_limit?: number; // tokens per minute limit
  metadata?: Record<string, any>;
}

export interface LiteLLMTeamResponse {
  team_id: string;
  team_alias: string;
  models: string[];
  max_budget: number | null;
  spend: number;
  budget_duration: string | null;
  metadata: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface LiteLLMKeyGenerateRequest {
  team_id: string;
  models?: string[];
  max_budget?: number;
  key_alias?: string;
  duration?: string;
  metadata?: Record<string, any>;
}

export interface LiteLLMKeyGenerateResponse {
  key: string; // the virtual key (sk-...)
  token: string; // hashed token for identification
  key_alias: string | null;
  key_name: string | null;
  team_id: string;
  models: string[];
  max_budget: number | null;
  spend: number;
  expires: string | null;
  user_id: string | null;
}

/** The inner team_info object returned by LiteLLM /team/info */
export interface LiteLLMTeamInfoData {
  team_id: string;
  team_alias: string;
  models: string[];
  max_budget: number | null;
  spend: number;
  budget_duration: string | null;
  metadata: Record<string, any>;
  members_with_roles: Array<{ role: string; user_id: string }>;
}

/** Top-level response from LiteLLM GET /team/info — spend is inside team_info, not at root */
export interface LiteLLMTeamInfoResponse {
  team_id: string;
  team_info: LiteLLMTeamInfoData;
  keys: Array<{
    token: string;
    key_alias: string | null;
    spend: number;
    max_budget: number | null;
    models: string[];
    expires: string | null;
  }>;
}

export interface LiteLLMTeamUpdateRequest {
  team_id: string;
  max_budget?: number;
  models?: string[];
  metadata?: Record<string, any>;
  budget_duration?: string;
  rpm_limit?: number;
  tpm_limit?: number;
}

export interface LiteLLMKeyUpdateRequest {
  /** Raw virtual key (sk-...) — required by LiteLLM /key/update */
  key: string;
  blocked?: boolean;
  max_budget?: number;
  models?: string[];
  metadata?: Record<string, any>;
}

export interface LiteLLMModelInfo {
  model_name: string;
  litellm_params: {
    model: string;
    [key: string]: any;
  };
  model_info: {
    id: string;
    input_cost_per_token?: number;
    output_cost_per_token?: number;
    max_tokens?: number;
    [key: string]: any;
  };
}

export interface LiteLLMModelListResponse {
  data: LiteLLMModelInfo[];
}

export class LiteLLMApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'LiteLLMApiError';
  }
}

// ============================================
// Client
// ============================================

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRY_ATTEMPTS = 2; // 1 initial + 1 retry
const RETRY_BACKOFF_MS = 2_000;

export class LiteLLMClient {
  private baseUrl: string;
  private masterKey: string;
  private timeout: number;
  private retryAttempts: number;

  constructor(config?: {
    baseUrl?: string;
    masterKey?: string;
    timeoutMs?: number;
    retryAttempts?: number;
  }) {
    this.baseUrl = (config?.baseUrl || process.env.LITELLM_PROXY_URL || '').replace(/\/$/, '');
    this.masterKey = config?.masterKey || process.env.LITELLM_MASTER_KEY || '';
    this.timeout = config?.timeoutMs || DEFAULT_TIMEOUT_MS;
    this.retryAttempts = config?.retryAttempts || DEFAULT_RETRY_ATTEMPTS;

    if (!this.baseUrl) {
      throw new Error('LiteLLM proxy URL is required (set LITELLM_PROXY_URL env var)');
    }
    if (!this.masterKey) {
      throw new Error('LiteLLM master key is required (set LITELLM_MASTER_KEY env var)');
    }
  }

  // --- Private helpers ---

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.masterKey}`,
      ...(options.headers as Record<string, string> || {}),
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
          throw new LiteLLMApiError(
            errorData.error?.message || errorData.message || `HTTP ${response.status}: ${response.statusText}`,
            response.status,
            errorData
          );
        }

        return (await response.json()) as T;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on 4xx client errors (except 429 rate limit)
        if (error instanceof LiteLLMApiError && error.statusCode && error.statusCode < 500 && error.statusCode !== 429) {
          break;
        }

        if (attempt < this.retryAttempts) {
          logger.warn(`LiteLLM request failed, retrying (attempt ${attempt}/${this.retryAttempts})`, {
            operation: 'litellm_client',
            endpoint,
            error: (error as Error).message,
          });
          await new Promise(resolve => setTimeout(resolve, RETRY_BACKOFF_MS * attempt));
        }
      }
    }

    logger.error('LiteLLM request failed after all retries', lastError as Error, {
      operation: 'litellm_client',
      endpoint,
    });
    throw lastError || new LiteLLMApiError('Unknown LiteLLM error');
  }

  // --- Public API methods ---

  /**
   * Create a new LiteLLM team for isolation.
   * Each AI Gateway key maps 1:1 to a LiteLLM team.
   */
  async createTeam(params: LiteLLMTeamRequest): Promise<LiteLLMTeamResponse> {
    logger.info('Creating LiteLLM team', {
      operation: 'litellm_client',
      teamAlias: params.team_alias,
    });
    return this.makeRequest<LiteLLMTeamResponse>('/team/new', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * Generate a virtual key for a team.
   */
  async generateKey(params: LiteLLMKeyGenerateRequest): Promise<LiteLLMKeyGenerateResponse> {
    logger.info('Generating LiteLLM key', {
      operation: 'litellm_client',
      teamId: params.team_id,
      keyAlias: params.key_alias,
    });
    return this.makeRequest<LiteLLMKeyGenerateResponse>('/key/generate', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * Get team info including spend data.
   * Primary source for delta-based spend sync.
   */
  async getTeamInfo(teamId: string): Promise<LiteLLMTeamInfoResponse> {
    return this.makeRequest<LiteLLMTeamInfoResponse>(`/team/info?team_id=${encodeURIComponent(teamId)}`);
  }

  /**
   * Update team settings (e.g., increase max_budget for top-up).
   */
  async updateTeam(params: LiteLLMTeamUpdateRequest): Promise<LiteLLMTeamResponse> {
    logger.info('Updating LiteLLM team', {
      operation: 'litellm_client',
      teamId: params.team_id,
      maxBudget: params.max_budget,
    });
    return this.makeRequest<LiteLLMTeamResponse>('/team/update', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * Update a virtual key's settings.
   * Requires the raw virtual key (sk-...) — NOT the hashed token.
   */
  async updateKey(params: LiteLLMKeyUpdateRequest): Promise<void> {
    logger.info('Updating LiteLLM key', {
      operation: 'litellm_client',
      blocked: params.blocked,
    });
    await this.makeRequest<any>('/key/update', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * Block (suspend) a virtual key so it is rejected at the proxy.
   * Requires the raw virtual key (sk-...) — NOT the hashed token.
   * Uses the dedicated /key/block endpoint.
   */
  async blockKey(rawVirtualKey: string): Promise<void> {
    logger.info('Blocking LiteLLM key', { operation: 'litellm_client' });
    await this.makeRequest<any>('/key/block', {
      method: 'POST',
      body: JSON.stringify({ key: rawVirtualKey }),
    });
  }

  /**
   * Unblock a previously blocked virtual key.
   * Requires the raw virtual key (sk-...) — NOT the hashed token.
   * Uses the dedicated /key/unblock endpoint.
   */
  async unblockKey(rawVirtualKey: string): Promise<void> {
    logger.info('Unblocking LiteLLM key', { operation: 'litellm_client' });
    await this.makeRequest<any>('/key/unblock', {
      method: 'POST',
      body: JSON.stringify({ key: rawVirtualKey }),
    });
  }

  /**
   * Delete one or more virtual keys.
   */
  async deleteKey(keys: string[]): Promise<{ deleted_keys: string[] }> {
    logger.info('Deleting LiteLLM key(s)', {
      operation: 'litellm_client',
      keyCount: keys.length,
    });
    return this.makeRequest<{ deleted_keys: string[] }>('/key/delete', {
      method: 'POST',
      body: JSON.stringify({ keys }),
    });
  }

  /**
   * Regenerate a virtual key (new key value, same config).
   */
  async regenerateKey(keyToken: string): Promise<LiteLLMKeyGenerateResponse> {
    logger.info('Regenerating LiteLLM key', {
      operation: 'litellm_client',
    });
    return this.makeRequest<LiteLLMKeyGenerateResponse>(`/key/${encodeURIComponent(keyToken)}/regenerate`, {
      method: 'POST',
    });
  }

  /**
   * List all available models on the LiteLLM proxy.
   */
  async listModels(): Promise<LiteLLMModelInfo[]> {
    const response = await this.makeRequest<LiteLLMModelListResponse>('/model/info');
    return response.data || [];
  }

  /**
   * Delete one or more teams.
   */
  async deleteTeam(teamIds: string[]): Promise<void> {
    logger.info('Deleting LiteLLM team(s)', {
      operation: 'litellm_client',
      teamCount: teamIds.length,
    });
    await this.makeRequest<any>('/team/delete', {
      method: 'POST',
      body: JSON.stringify({ team_ids: teamIds }),
    });
  }

  /**
   * Health check — verify connectivity to the LiteLLM proxy.
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.makeRequest('/health');
      return true;
    } catch (error) {
      logger.error('LiteLLM connection test failed', error as Error, {
        operation: 'litellm_client',
      });
      return false;
    }
  }
}

// ============================================
// Singleton instance (lazy)
// ============================================

let litellmClientInstance: LiteLLMClient | null = null;

export function getLiteLLMClient(): LiteLLMClient {
  if (!litellmClientInstance) {
    if (!process.env.LITELLM_PROXY_URL || !process.env.LITELLM_MASTER_KEY) {
      throw new Error('LiteLLM client not available: LITELLM_PROXY_URL and LITELLM_MASTER_KEY must be set');
    }
    litellmClientInstance = new LiteLLMClient();
  }
  return litellmClientInstance;
}

/**
 * Reset the singleton (useful for testing).
 */
export function resetLiteLLMClient(): void {
  litellmClientInstance = null;
}

