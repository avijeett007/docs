import { decrypt } from '@/lib/encryption';
import { prisma } from '@/lib/prisma';
import { logger } from './logger';

export interface ApiKeyResolutionResult {
  apiKey: string;
  source: 'agent' | 'partner';
  agentId: string;
  status: 'valid' | 'invalid' | 'expired' | 'not_set';
}

export interface ApiKeyErrorData {
  code: 'NO_API_KEY' | 'INVALID_API_KEY' | 'EXPIRED_API_KEY' | 'RATE_LIMITED' | 'DECRYPTION_ERROR';
  message: string;
  suggestions: string[];
  canUsePartnerKey: boolean;
}

/**
 * Resolves API key for an agent with priority order:
 * 1. Agent-level API key (highest priority)
 * 2. Partner-level API key (fallback)
 * 3. Error handling (no valid key found)
 */
export async function resolveApiKey(
  agentId: string, 
  provider: 'vapi' | 'retell'
): Promise<ApiKeyResolutionResult> {
  try {
    // Step 1: Try to get agent with its API key
    const agent = await getAgentWithApiKey(agentId, provider);
    
    if (!agent) {
      throw new ApiKeyError({
        code: 'NO_API_KEY',
        message: `Agent ${agentId} not found`,
        suggestions: ['Verify the agent ID is correct'],
        canUsePartnerKey: false
      });
    }

    // Step 2: Try agent-level API key first
    if (agent.apiKey && agent.apiKeyStatus === 'valid') {
      try {
        const decryptedKey = await decrypt(agent.apiKey);
        return {
          apiKey: decryptedKey,
          source: 'agent',
          agentId,
          status: 'valid'
        };
      } catch (error) {
        logger.error('Failed to decrypt agent API key', error as Error, {
          operation: 'api_key_resolution',
          agentId,
          source: 'agent'
        });
        // Continue to partner key fallback
      }
    }

    // Step 3: Fallback to partner-level API key
    const partner = await getPartnerApiKey(agent.partnerId, provider);
    if (partner?.apiKey) {
      try {
        const decryptedKey = await decrypt(partner.apiKey);
        return {
          apiKey: decryptedKey,
          source: 'partner',
          agentId,
          status: 'valid'
        };
      } catch (error) {
        logger.error('Failed to decrypt partner API key', error as Error, {
          operation: 'api_key_resolution',
          agentId,
          partnerId: agent.partnerId,
          source: 'partner'
        });
        throw new ApiKeyError({
          code: 'DECRYPTION_ERROR',
          message: 'Failed to decrypt API keys',
          suggestions: ['Contact support for key recovery'],
          canUsePartnerKey: false
        });
      }
    }

    // Step 4: No valid API key found
    throw new ApiKeyError({
      code: 'NO_API_KEY',
      message: `No valid ${provider} API key found for agent ${agentId}`,
      suggestions: [
        'Set an API key for this agent',
        'Update your partner API key in settings',
        'Import this agent with a valid API key'
      ],
      canUsePartnerKey: false
    });

  } catch (error) {
    if (error instanceof ApiKeyError) {
      throw error;
    }
    
    logger.error('Unexpected error resolving API key', error as Error, {
      operation: 'api_key_resolution',
      agentId
    });
    throw new ApiKeyError({
      code: 'NO_API_KEY',
      message: 'Unexpected error occurred while resolving API key',
      suggestions: ['Try again later', 'Contact support if the issue persists'],
      canUsePartnerKey: false
    });
  }
}

/**
 * Get agent with API key information
 */
async function getAgentWithApiKey(agentId: string, provider: 'vapi' | 'retell') {
  if (provider === 'vapi') {
    return await prisma.vapiAgent.findUnique({
      where: { id: agentId },
      select: {
        id: true,
        partnerId: true,
        apiKey: true,
        apiKeyStatus: true,
        apiKeyLastVerified: true,
        apiKeyErrorMessage: true
      }
    });
  } else {
    return await prisma.retellAgent.findUnique({
      where: { id: agentId },
      select: {
        id: true,
        partnerId: true,
        apiKey: true,
        apiKeyStatus: true,
        apiKeyLastVerified: true,
        apiKeyErrorMessage: true
      }
    });
  }
}

/**
 * Get partner API key
 */
async function getPartnerApiKey(partnerId: string, provider: 'vapi' | 'retell') {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: {
      id: true,
      vapiApiKey: provider === 'vapi',
      retellApiKey: provider === 'retell'
    }
  });

  if (!partner) {
    return null;
  }

  return {
    apiKey: provider === 'vapi' ? partner.vapiApiKey : partner.retellApiKey
  };
}

/**
 * Verify API key with provider
 */
export async function verifyApiKey(
  apiKey: string, 
  agentId: string, 
  provider: 'vapi' | 'retell'
): Promise<boolean> {
  try {
    if (provider === 'vapi') {
      return await verifyVapiApiKey(apiKey, agentId);
    } else {
      return await verifyRetellApiKey(apiKey, agentId);
    }
  } catch (error) {
    logger.error('API key verification failed', error as Error, {
      operation: 'api_key_verification',
      provider,
      agentId
    });
    return false;
  }
}

/**
 * Verify VAPI API key
 */
async function verifyVapiApiKey(apiKey: string, agentId: string): Promise<boolean> {
  try {
    const response = await fetch(`https://api.vapi.ai/assistant/${agentId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    });
    return response.ok;
  } catch (error) {
    logger.error('VAPI API key verification failed', error as Error, {
      operation: 'vapi_key_verification'
    });
    return false;
  }
}

/**
 * Verify Retell API key
 */
async function verifyRetellApiKey(apiKey: string, agentId: string): Promise<boolean> {
  try {
    const response = await fetch(`https://api.retellai.com/get-agent/${agentId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    });
    return response.ok;
  } catch (error) {
    logger.error('Retell API key verification failed', error as Error, {
      operation: 'retell_key_verification'
    });
    return false;
  }
}

/**
 * Update agent API key status
 */
export async function updateAgentApiKeyStatus(
  agentId: string,
  provider: 'vapi' | 'retell',
  status: string,
  errorMessage?: string
): Promise<void> {
  const updateData = {
    apiKeyStatus: status,
    apiKeyLastVerified: new Date(),
    apiKeyErrorMessage: errorMessage || null
  };

  if (provider === 'vapi') {
    await prisma.vapiAgent.update({
      where: { id: agentId },
      data: updateData
    });
  } else {
    await prisma.retellAgent.update({
      where: { id: agentId },
      data: updateData
    });
  }
}

/**
 * Custom error class for API key resolution
 */
class ApiKeyError extends Error {
  public code: string;
  public suggestions: string[];
  public canUsePartnerKey: boolean;

  constructor(errorData: ApiKeyErrorData) {
    super(errorData.message);
    this.name = 'ApiKeyError';
    this.code = errorData.code;
    this.suggestions = errorData.suggestions;
    this.canUsePartnerKey = errorData.canUsePartnerKey;
  }
}

export { ApiKeyError };
