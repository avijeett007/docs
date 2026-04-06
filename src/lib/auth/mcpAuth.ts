import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { logger } from '@/lib/logger';

/**
 * MCP (Model Context Protocol) Authentication
 * Validates MCP API keys for secure service-to-service communication
 */

export interface MCPAuthContext {
  partnerId: string;
  partnerEmail: string;
  partnerName: string;
  source: 'mcp';
  permissions: string[];
}

/**
 * Verify MCP API key authentication from a request
 * Returns the authenticated partner context or null if authentication fails
 */
export async function verifyMCPAuth(request: NextRequest): Promise<MCPAuthContext | null> {
  try {
    // Get MCP API key and partner ID from request headers
    const mcpApiKey = request.headers.get('X-MCP-API-Key');
    const partnerIdHeader = request.headers.get('X-Partner-ID');
    const mcpSource = request.headers.get('X-MCP-Source');

    if (!mcpApiKey || !partnerIdHeader) {
      return null;
    }

    // Validate that this is from MCP service
    if (mcpSource !== 'analytics-service') {
      return null;
    }

    // Find ALL active API keys for the partner
    const partnerApiKeys = await prisma.partnerApiKey.findMany({
      where: {
        partnerId: partnerIdHeader,
        status: 'active',
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        partner: {
          select: {
            id: true,
            emailAddress: true,
            businessName: true,
            approvalStatus: true,
            subscriptionStatus: true
          }
        }
      }
    });

    if (!partnerApiKeys || partnerApiKeys.length === 0) {
      return null;
    }

    // Get partner info from the first key (all keys belong to the same partner)
    const partner = partnerApiKeys[0].partner;
    if (!partner) {
      return null;
    }

    // Verify partner is active
    if (partner.approvalStatus !== 'ACTIVE' ||
        partner.subscriptionStatus !== 'ACTIVE') {
      return null;
    }

    // Try to decrypt and match against ANY of the API keys
    let matchedKey = null;
    for (const apiKeyRecord of partnerApiKeys) {
      try {
        const decryptedKey = await decrypt(apiKeyRecord.apiKey);
        if (mcpApiKey === decryptedKey) {
          // Found a matching API key!
          logger.info('MCP auth successful', {
            operation: 'mcp_auth',
            apiKeyName: apiKeyRecord.name || 'Unnamed',
            apiKeyPrefix: apiKeyRecord.prefix,
            partnerId: partnerIdHeader
          });
          matchedKey = apiKeyRecord;
          break;
        }
      } catch (error) {
        logger.error('Error decrypting API key', error as Error, {
          operation: 'mcp_auth',
          apiKeyId: apiKeyRecord.id
        });
        // Continue to next key
        continue;
      }
    }

    if (!matchedKey) {
      return null;
    }

    // Return MCP authentication context with limited permissions
    return {
      partnerId: partner.id,
      partnerEmail: partner.emailAddress,
      partnerName: partner.businessName,
      source: 'mcp',
      permissions: [
        'customer:create',
        'customer:read',
        'customer:update',
        'customer:portal',
        'agent:map',
        'agent:unmap'
      ]
    };

  } catch (error) {
    logger.error('Error verifying MCP auth', error as Error, {
      operation: 'mcp_auth'
    });
    return null;
  }
}

/**
 * Check if MCP context has required permission
 */
export function hasMCPPermission(context: MCPAuthContext, permission: string): boolean {
  return context.permissions.includes(permission);
}

/**
 * Middleware to check MCP authentication and permissions
 */
export async function withMCPAuth(
  request: NextRequest,
  requiredPermission: string,
  handler: (request: NextRequest, mcpContext: MCPAuthContext) => Promise<Response>
): Promise<Response> {
  const mcpContext = await verifyMCPAuth(request);

  if (!mcpContext) {
    return new Response(
      JSON.stringify({ error: 'Invalid or missing MCP authentication' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!hasMCPPermission(mcpContext, requiredPermission)) {
    return new Response(
      JSON.stringify({ error: `Insufficient permissions. Required: ${requiredPermission}` }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return handler(request, mcpContext);
}

/**
 * Rate limiting for MCP requests (per partner)
 */
const mcpRateLimits = new Map<string, { count: number; resetTime: number }>();

export function checkMCPRateLimit(partnerId: string, maxRequests: number = 100, windowMs: number = 60000): boolean {
  const now = Date.now();
  const key = `mcp:${partnerId}`;
  
  const current = mcpRateLimits.get(key);
  
  if (!current || now > current.resetTime) {
    // Reset or initialize
    mcpRateLimits.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (current.count >= maxRequests) {
    return false;
  }
  
  current.count++;
  return true;
}

/**
 * Audit logging for MCP operations
 */
export async function logMCPOperation(
  context: MCPAuthContext,
  operation: string,
  details: Record<string, any> = {}
): Promise<void> {
  try {
    // Log to console for now - in production, use proper audit logging
    logger.info('MCP operation audit', {
      operation: 'mcp_audit',
      partnerId: context.partnerId,
      mcpOperation: operation,
      details
    });
    
    // TODO: Implement proper audit logging to database or external service
    // await auditLog.create({
    //   source: 'mcp',
    //   partnerId: context.partnerId,
    //   operation,
    //   details,
    //   timestamp: new Date()
    // });
  } catch (error) {
    logger.error('Error logging MCP operation', error as Error, {
      operation: 'mcp_audit'
    });
  }
}
