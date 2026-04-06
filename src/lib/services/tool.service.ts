import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { ConnectedTool } from '@prisma/client';
import { logger } from '@/lib/logger';

export class PluginToolService {
  // Get all tools with optional filtering
  static async getTools(options?: {
    provider?: 'official' | 'verified' | 'community';
    category?: string;
    status?: string;
  }): Promise<ConnectedTool[]> {
    const where: any = {};
    if (options?.provider) where.provider = options.provider;
    if (options?.category) where.category = options.category;
    if (options?.status) where.status = options.status;

    return prisma.connectedTool.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  // Get a single tool by ID
  static async getTool(id: string): Promise<ConnectedTool | null> {
    return prisma.connectedTool.findUnique({
      where: { id },
    });
  }

  // Get tool connection for a user
  static async getToolConnection(
    toolId: string,
    workspaceId: string
  ): Promise<ConnectedTool | null> {
    return prisma.connectedTool.findFirst({
      where: {
        toolId,
        workspaceId,
      },
    });
  }

  // Get decrypted auth data for a tool connection
  static async getToolAuthData(connection: ConnectedTool): Promise<any> {
    try {
      if (!connection.authData) {
        return null;
      }
      const decryptedData = await decrypt(connection.authData);
      return JSON.parse(decryptedData);
    } catch (error) {
      logger.error('Error decrypting tool auth data', error as Error, {
        operation: 'tool_service',
        toolId: connection.toolId,
        workspaceId: connection.workspaceId
      });
      throw new Error('Failed to decrypt tool authentication data');
    }
  }

  // Update tool status (for approval process)
  static async updateToolStatus(
    id: string,
    status: 'connected' | 'disconnected' | 'failed'
  ): Promise<ConnectedTool> {
    return prisma.connectedTool.update({
      where: { id },
      data: {
        status,
      },
    });
  }

  // Get all connections for a workspace
  static async getWorkspaceConnections(workspaceId: string): Promise<ConnectedTool[]> {
    return prisma.connectedTool.findMany({
      where: { workspaceId },
    });
  }

  // Disconnect a tool
  static async disconnectTool(toolId: string, workspaceId: string): Promise<void> {
    await prisma.connectedTool.updateMany({
      where: {
        toolId,
        workspaceId,
      },
      data: {
        status: 'disconnected',
      },
    });
  }

  // Check if a tool needs token refresh
  static async checkTokenExpiry(connection: ConnectedTool): Promise<boolean> {
    if (!connection.expiresAt) return false;
    
    // Add buffer time (5 minutes) to ensure we refresh before expiry
    const bufferTime = 5 * 60 * 1000;
    const expiryTime = new Date(connection.expiresAt).getTime() - bufferTime;
    return Date.now() >= expiryTime;
  }
}
