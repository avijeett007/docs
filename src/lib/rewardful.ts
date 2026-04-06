/**
 * Rewardful API Service
 * Handles affiliate creation, management, and conversion tracking
 */

interface RewardfulConfig {
  apiSecret: string;
  baseUrl: string;
}

interface CreateAffiliateRequest {
  email: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  website?: string;
  commission_rate?: number;
  commission_duration?: number; // in months, null for lifetime
  commission_type?: 'percentage' | 'fixed';
  status?: 'active' | 'inactive';
  metadata?: Record<string, any>;
}

interface AffiliateResponse {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  website?: string;
  token: string;
  commission_rate: number;
  commission_duration?: number;
  commission_type: 'percentage' | 'fixed';
  status: 'active' | 'inactive' | 'pending';
  total_referrals: number;
  total_conversions: number;
  total_commission_earned: number;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

interface ConversionRequest {
  referral_id: string;
  amount: number;
  currency?: string;
  order_id: string;
  is_recurring?: boolean;
  metadata?: Record<string, any>;
}



export class RewardfulService {
  private config: RewardfulConfig;

  constructor() {
    this.config = {
      apiSecret: process.env.REWARDFUL_API_SECRET || '',
      baseUrl: process.env.REWARDFUL_API_URL || 'https://api.getrewardful.com/v1',
    };

    if (!this.config.apiSecret) {
      throw new Error('REWARDFUL_API_SECRET environment variable is required');
    }
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Basic ${Buffer.from(`${this.config.apiSecret}:`).toString('base64')}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Rewardful API error: ${response.status}`;
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      
      throw new Error(errorMessage);
    }

    return response.json();
  }

  /**
   * Create a new affiliate
   */
  async createAffiliate(data: CreateAffiliateRequest): Promise<AffiliateResponse> {
    return this.makeRequest<AffiliateResponse>('/affiliates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get affiliate by ID
   */
  async getAffiliate(affiliateId: string): Promise<AffiliateResponse> {
    return this.makeRequest<AffiliateResponse>(`/affiliates/${affiliateId}`);
  }

  /**
   * Update affiliate
   */
  async updateAffiliate(
    affiliateId: string,
    data: Partial<CreateAffiliateRequest>
  ): Promise<AffiliateResponse> {
    return this.makeRequest<AffiliateResponse>(`/affiliates/${affiliateId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * List all affiliates
   */
  async listAffiliates(params?: {
    page?: number;
    per_page?: number;
    status?: 'active' | 'inactive' | 'pending';
  }): Promise<{ data: AffiliateResponse[]; meta: any }> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.per_page) searchParams.set('per_page', params.per_page.toString());
    if (params?.status) searchParams.set('status', params.status);

    const endpoint = `/affiliates${searchParams.toString() ? `?${searchParams}` : ''}`;
    return this.makeRequest<{ data: AffiliateResponse[]; meta: any }>(endpoint);
  }



  /**
   * Track a conversion
   */
  async trackConversion(data: ConversionRequest): Promise<any> {
    return this.makeRequest('/conversions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get affiliate statistics
   */
  async getAffiliateStats(affiliateId: string): Promise<any> {
    return this.makeRequest(`/affiliates/${affiliateId}/stats`);
  }
}

// Lazy initialization to prevent module crash if environment variable is missing
let rewardfulServiceInstance: RewardfulService | null = null;

export function getRewardfulService(): RewardfulService {
  if (!rewardfulServiceInstance) {
    if (!process.env.REWARDFUL_API_SECRET) {
      throw new Error('Rewardful service not available: REWARDFUL_API_SECRET not configured');
    }
    rewardfulServiceInstance = new RewardfulService();
  }
  return rewardfulServiceInstance;
}

// For backward compatibility, but prefer using getRewardfulService()
export const rewardfulService = {
  get instance() {
    return getRewardfulService();
  }
};
