/**
 * Free Forever Upgrade Service
 * Utility service to check if partner is on free forever plan and needs upgrade encouragement
 */

export interface PartnerPlanInfo {
  planId: string | null;
  subscriptionStatus: string;
  isFreeForever: boolean;
}

// Simple in-memory cache with TTL
interface CacheEntry {
  data: PartnerPlanInfo;
  timestamp: number;
}

export class FreeForeverUpgradeService {
  private static cache: CacheEntry | null = null;
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Check if partner is on free forever plan with caching
   */
  static async checkPartnerPlan(): Promise<PartnerPlanInfo> {
    try {
      // Check cache first
      if (this.cache && (Date.now() - this.cache.timestamp) < this.CACHE_TTL) {
        return this.cache.data;
      }

      const token = localStorage.getItem('partner_token');
      if (!token) {
        throw new Error('Authentication token not found. Please log in again.');
      }

      const response = await fetch('/api/partner/subscription', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch partner subscription data');
      }

      const data = await response.json();
      const partner = data.data?.partner;
      const subscription = data.data?.subscription;

      const planId = subscription?.planId || partner?.planId || null;
      const subscriptionStatus = partner?.subscriptionStatus || 'INACTIVE';
      const tier = subscription?.tier || null; // Use tier from API (based on actual subscription data)

      // Check if user is on FREE Forever plan
      const isFreeForeverUser = Boolean(
        tier === 'free_forever' ||
        planId === 'free_forever_trial' ||
        planId === 'free_forever'
      );

      // Check if user is on FREE Forever plan
      // For customers and Retell agents: only show modal when exceeding limits
      // For other features (VAPI, ElevenLabs, etc.): show modal immediately for FREE Forever users
      const isFreeForever = isFreeForeverUser;

      const planInfo: PartnerPlanInfo = {
        planId,
        subscriptionStatus,
        isFreeForever,
      };

      // Cache the result
      this.cache = {
        data: planInfo,
        timestamp: Date.now(),
      };

      return planInfo;
    } catch (error) {
      // Return safe defaults on error
      return {
        planId: null,
        subscriptionStatus: 'INACTIVE',
        isFreeForever: false,
      };
    }
  }

  /**
   * Check if partner should see upgrade encouragement
   * Returns true if partner is on free forever plan AND their trial has expired
   */
  static async shouldShowUpgradeEncouragement(): Promise<boolean> {
    try {
      const planInfo = await this.checkPartnerPlan();
      return planInfo.isFreeForever;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear the cache (useful after plan changes)
   */
  static clearCache(): void {
    this.cache = null;
  }

  /**
   * Get upgrade encouragement message based on feature being accessed
   */
  static getUpgradeMessage(feature: string): {
    title: string;
    message: string;
    featureDescription: string;
  } {
    const messages = {
      customers: {
        title: 'Unlock Unlimited Customers',
        message: 'You\'re currently on the Free Forever plan with limited customers. Upgrade to add unlimited customers and scale your business.',
        featureDescription: 'Create and manage unlimited customers',
      },
      retell_agents: {
        title: 'Unlock More Retell Agents',
        message: 'You\'re currently on the Free Forever plan with limited Retell agents. Upgrade to create unlimited voice AI agents.',
        featureDescription: 'Create unlimited Retell voice AI agents',
      },
      n8n_agents: {
        title: 'Unlock More N8N Chat Agents',
        message: 'You\'re currently on the Free Forever plan with limited N8N chat agents. Upgrade to create unlimited chat automation agents.',
        featureDescription: 'Create unlimited N8N chat agents',
      },
      custom_domain: {
        title: 'Unlock Custom Domain',
        message: 'Custom domains are a premium feature. Upgrade to use your own domain for your customer portal.',
        featureDescription: 'Use your own custom domain for branding',
      },
      team_members: {
        title: 'Unlock Team Collaboration',
        message: 'Team member management is a premium feature. Upgrade to invite team members and collaborate.',
        featureDescription: 'Add team members and collaborate',
      },
      email_domain: {
        title: 'Unlock Email Domain Integration',
        message: 'Email domain integration is a premium feature. Upgrade to send emails from your own domain.',
        featureDescription: 'Send professional emails from your domain',
      },
      vapi_agents: {
        title: 'Unlock VAPI Voice AI Agents',
        message: 'VAPI agents are a premium feature. Upgrade to create advanced voice AI agents with VAPI\'s powerful platform.',
        featureDescription: 'Create unlimited VAPI voice AI agents',
      },
      ultravox_agents: {
        title: 'Unlock Ultravox Voice AI Agents',
        message: 'Ultravox agents are a premium feature. Upgrade to create sophisticated voice AI agents with sentiment analysis.',
        featureDescription: 'Create unlimited Ultravox voice AI agents',
      },
      elevenlabs_agents: {
        title: 'Unlock ElevenLabs Voice AI Agents',
        message: 'ElevenLabs agents are a premium feature. Upgrade to create lifelike voice AI agents with premium voice synthesis.',
        featureDescription: 'Create unlimited ElevenLabs voice AI agents',
      },
      ghl_agents: {
        title: 'Unlock Go High Level Integration',
        message: 'GHL agent integration is a premium feature. Upgrade to connect your Go High Level voice AI agents.',
        featureDescription: 'Integrate unlimited GHL voice AI agents',
      },
      knova_agents: {
        title: 'Unlock Knova AI Hosted Agents',
        message: 'Knova AI hosted agents are a premium feature. Upgrade to create sophisticated AI agents with advanced capabilities.',
        featureDescription: 'Create unlimited Knova AI hosted agents',
      },
      workflows: {
        title: 'Unlock AI Workflow System',
        message: 'AI-powered workflows are a premium feature. Upgrade to create and manage automated business processes.',
        featureDescription: 'Create unlimited AI-powered workflows',
      },
      phone_numbers: {
        title: 'Unlock Unlimited Phone Number Imports',
        message: 'You\'re currently on the Free Forever plan with 1 free phone number import. Additional imports cost $10 per number. Upgrade for unlimited free imports.',
        featureDescription: 'Import unlimited phone numbers at no extra cost',
      },
      number_pools: {
        title: 'Unlock Number Pool Management',
        message: 'Number Pool is available on paid plans. Upgrade to organize phone numbers into pools and manage routing at scale.',
        featureDescription: 'Create and manage up to 5 number pools on Solo Agency and unlimited on Enterprise',
      },
    };

    return messages[feature as keyof typeof messages] || {
      title: 'Upgrade to Premium',
      message: 'This is a premium feature. Upgrade your plan to access all advanced features.',
      featureDescription: 'Access premium features',
    };
  }
}
