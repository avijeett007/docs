import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPartnerToken } from '@/lib/auth';
import { 
  updateInstanceConfigSchema,
  sanitizeInput 
} from '@/lib/validations/n8n';
import { N8nApiKeyEncryption } from '@/lib/security/n8n-encryption';
import { N8nApiClient } from '@/lib/n8n/client';
import { z } from 'zod';

/**
 * GET /api/partner/n8n-instances/[id]
 * Get a specific N8N instance configuration
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify partner authentication
    const authResult = await verifyPartnerToken(request);
    if (!authResult.success || !authResult.partner) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partnerId = authResult.partner.id;
    const { id } = params;

    // Validate ID format
    const uuidSchema = z.string().uuid();
    const validatedId = uuidSchema.parse(id);

    // Get instance configuration
    const instance = await prisma.n8nInstanceConfiguration.findUnique({
      where: { 
        id: validatedId,
        partnerId, // Ensure partner owns this instance
      },
      select: {
        id: true,
        name: true,
        baseUrl: true,
        description: true,
        isActive: true,
        lastConnectionTest: true,
        connectionStatus: true,
        connectionError: true,
        n8nVersion: true,
        timeoutSeconds: true,
        retryAttempts: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            deployments: true,
          },
        },
      },
    });

    if (!instance) {
      return NextResponse.json(
        {
          success: false,
          error: 'Instance not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: instance,
    });
  } catch (error) {
    console.error('Error fetching N8N instance:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid instance ID',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch N8N instance',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/partner/n8n-instances/[id]
 * Update an N8N instance configuration
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify partner authentication
    const authResult = await verifyPartnerToken(request);
    if (!authResult.success || !authResult.partner) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partnerId = authResult.partner.id;
    const { id } = params;
    const body = await request.json();

    // Validate ID format
    const uuidSchema = z.string().uuid();
    const validatedId = uuidSchema.parse(id);

    // Validate input
    const validatedData = sanitizeInput(updateInstanceConfigSchema, body);

    // Check if instance exists and belongs to partner
    const existingInstance = await prisma.n8nInstanceConfiguration.findUnique({
      where: { 
        id: validatedId,
        partnerId,
      },
    });

    if (!existingInstance) {
      return NextResponse.json(
        {
          success: false,
          error: 'Instance not found',
        },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {
      name: validatedData.name,
      baseUrl: validatedData.baseUrl,
      description: validatedData.description,
      isActive: validatedData.isActive,
      timeoutSeconds: validatedData.timeoutSeconds,
      retryAttempts: validatedData.retryAttempts,
    };

    // Handle API key update if provided
    if (validatedData.apiKey) {
      const encryptedApiKey = await N8nApiKeyEncryption.encrypt(validatedData.apiKey);
      updateData.apiKey = encryptedApiKey;

      // Test connection with new API key
      const testClient = new N8nApiClient(validatedData.baseUrl || existingInstance.baseUrl, validatedData.apiKey);
      
      try {
        const isConnected = await testClient.testConnection();
        updateData.connectionStatus = isConnected ? 'connected' : 'failed';
        updateData.connectionError = null;
        updateData.n8nVersion = null; // We don't get version from testConnection
        updateData.lastConnectionTest = new Date();
      } catch (error) {
        updateData.connectionStatus = 'failed';
        updateData.connectionError = error instanceof Error ? error.message : 'Connection test failed';
        updateData.lastConnectionTest = new Date();
      }
    }

    // Update instance configuration
    const instance = await prisma.n8nInstanceConfiguration.update({
      where: { id: validatedId },
      data: updateData,
      select: {
        id: true,
        name: true,
        baseUrl: true,
        description: true,
        isActive: true,
        lastConnectionTest: true,
        connectionStatus: true,
        connectionError: true,
        n8nVersion: true,
        timeoutSeconds: true,
        retryAttempts: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: instance,
      message: 'N8N instance updated successfully',
    });
  } catch (error) {
    console.error('Error updating N8N instance:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update N8N instance',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/partner/n8n-instances/[id]
 * Delete an N8N instance configuration
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify partner authentication
    const authResult = await verifyPartnerToken(request);
    if (!authResult.success || !authResult.partner) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partnerId = authResult.partner.id;
    const { id } = params;

    // Validate ID format
    const uuidSchema = z.string().uuid();
    const validatedId = uuidSchema.parse(id);

    // Check if instance exists and belongs to partner
    const existingInstance = await prisma.n8nInstanceConfiguration.findUnique({
      where: { 
        id: validatedId,
        partnerId,
      },
      include: {
        deployments: {
          where: {
            status: { in: ['pending', 'in_progress'] },
          },
        },
      },
    });

    if (!existingInstance) {
      return NextResponse.json(
        {
          success: false,
          error: 'Instance not found',
        },
        { status: 404 }
      );
    }

    // Check for active deployments
    if (existingInstance.deployments.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot delete instance with active deployments',
          message: `Instance has ${existingInstance.deployments.length} active deployments`,
        },
        { status: 400 }
      );
    }

    // Delete instance configuration
    await prisma.n8nInstanceConfiguration.delete({
      where: { id: validatedId },
    });

    return NextResponse.json({
      success: true,
      message: 'N8N instance deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting N8N instance:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid instance ID',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete N8N instance',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
