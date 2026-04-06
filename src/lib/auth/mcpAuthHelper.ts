import { NextRequest, NextResponse } from 'next/server';
import { verifyMCPAuth, hasMCPPermission, checkMCPRateLimit, logMCPOperation, MCPAuthContext } from './mcpAuth';
import { verifyJWT } from '@/lib/jwt';
import { logger } from '@/lib/logger';

/**
 * Helper functions to add MCP authentication support to existing partner API routes
 */

export interface PartnerAuthContext {
  partnerId: string;
  partnerEmail: string;
  source: 'jwt' | 'mcp';
  permissions?: string[];
}

/**
 * Check if request is from MCP and handle MCP authentication
 * Returns MCP context if authenticated, null if not MCP request, throws if MCP auth fails
 */
export async function handleMCPAuth(request: NextRequest, requiredPermission: string): Promise<MCPAuthContext | null> {
  const mcpApiKey = request.headers.get('X-MCP-API-Key');
  if (!mcpApiKey) {
    return null; // Not an MCP request
  }

  // This is an MCP request, validate it
  const mcpContext = await verifyMCPAuth(request);
  if (!mcpContext) {
    throw new Error('Invalid MCP authentication');
  }

  // Check permissions
  if (!hasMCPPermission(mcpContext, requiredPermission)) {
    throw new Error(`Insufficient MCP permissions. Required: ${requiredPermission}`);
  }

  // Check rate limits
  if (!checkMCPRateLimit(mcpContext.partnerId)) {
    throw new Error('MCP rate limit exceeded');
  }

  // Log the operation
  await logMCPOperation(mcpContext, requiredPermission, {
    method: request.method,
    url: request.url
  });

  return mcpContext;
}

/**
 * Unified authentication for partner API routes
 * Supports both JWT tokens and MCP API keys
 */
export async function authenticatePartnerRequest(request: NextRequest): Promise<PartnerAuthContext | null> {
  // Check for MCP authentication first
  const mcpApiKey = request.headers.get('X-MCP-API-Key');
  if (mcpApiKey) {
    const mcpContext = await verifyMCPAuth(request);
    if (mcpContext) {
      return {
        partnerId: mcpContext.partnerId,
        partnerEmail: mcpContext.partnerEmail,
        source: 'mcp',
        permissions: mcpContext.permissions
      };
    }
    return null;
  }

  // Fall back to JWT authentication
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const payload = await verifyJWT(token);
      if (payload && payload.partnerId) {
        return {
          partnerId: payload.partnerId,
          partnerEmail: payload.email,
          source: 'jwt'
        };
      }
    } catch (error) {
      logger.error('JWT verification failed', error as Error, {
        operation: 'mcp_auth_helper'
      });
    }
  }

  return null;
}

/**
 * Check if the authenticated context has permission for an operation
 */
export function hasPermission(context: PartnerAuthContext, operation: string): boolean {
  if (context.source === 'jwt') {
    // JWT tokens have full permissions
    return true;
  }
  
  if (context.source === 'mcp' && context.permissions) {
    return context.permissions.includes(operation);
  }
  
  return false;
}

/**
 * Wrapper for partner API routes that adds MCP authentication support
 */
export function withPartnerAuth(
  requiredPermission: string,
  handler: (request: NextRequest, context: PartnerAuthContext) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      // Authenticate the request
      const authContext = await authenticatePartnerRequest(request);
      if (!authContext) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }

      // Check permissions
      if (!hasPermission(authContext, requiredPermission)) {
        return NextResponse.json(
          { error: `Insufficient permissions. Required: ${requiredPermission}` },
          { status: 403 }
        );
      }

      // Rate limiting for MCP requests
      if (authContext.source === 'mcp') {
        if (!checkMCPRateLimit(authContext.partnerId)) {
          return NextResponse.json(
            { error: 'Rate limit exceeded' },
            { status: 429 }
          );
        }
      }

      // Call the handler
      const response = await handler(request, authContext);

      // Log MCP operations
      if (authContext.source === 'mcp') {
        await logMCPOperation(
          {
            partnerId: authContext.partnerId,
            partnerEmail: authContext.partnerEmail,
            partnerName: '', // Will be filled by logMCPOperation
            source: 'mcp',
            permissions: authContext.permissions || []
          },
          requiredPermission,
          {
            method: request.method,
            url: request.url,
            status: response.status
          }
        );
      }

      return response;

    } catch (error) {
      logger.error('Partner auth wrapper error', error as Error, {
        operation: 'mcp_auth_helper'
      });
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Permission constants for different operations
 */
export const PERMISSIONS = {
  CUSTOMER_CREATE: 'customer:create',
  CUSTOMER_READ: 'customer:read',
  CUSTOMER_UPDATE: 'customer:update',
  CUSTOMER_PORTAL: 'customer:portal',
  AGENT_MAP: 'agent:map',
  AGENT_UNMAP: 'agent:unmap'
} as const;

/**
 * Helper to extract partner ID from authenticated context
 */
export function getPartnerId(context: PartnerAuthContext): string {
  return context.partnerId;
}

/**
 * Helper to check if request is from MCP
 */
export function isMCPRequest(context: PartnerAuthContext): boolean {
  return context.source === 'mcp';
}

/**
 * Helper to get request source for logging
 */
export function getRequestSource(context: PartnerAuthContext): string {
  return context.source === 'mcp' ? 'MCP API' : 'Partner Portal';
}

/**
 * Simple helper to add MCP support to existing route handlers
 * Add this at the beginning of your existing POST/GET/PUT handlers
 */
export async function checkMCPAuthIfPresent(request: NextRequest, requiredPermission: string): Promise<{
  isMCP: boolean;
  partnerId?: string;
  partnerEmail?: string;
  error?: string;
}> {
  try {
    const mcpContext = await handleMCPAuth(request, requiredPermission);
    if (mcpContext) {
      return {
        isMCP: true,
        partnerId: mcpContext.partnerId,
        partnerEmail: mcpContext.partnerEmail
      };
    }
    return { isMCP: false };
  } catch (error) {
    // MCP auth failed, return error info instead of throwing
    return {
      isMCP: true,
      error: (error as Error).message
    };
  }
}
