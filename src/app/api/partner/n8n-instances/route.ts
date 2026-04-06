import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPartnerToken } from '@/lib/auth';
import {
  createInstanceConfigSchema,
  sanitizeInput
} from '@/lib/validations/n8n';
import { N8nApiKeyEncryption } from '@/lib/security/n8n-encryption';
import { N8nApiClient } from '@/lib/n8n/client';
import { z } from 'zod';

/**
 * GET /api/partner/n8n-instances
 * Get partner's N8N instance configurations
 */
export async function GET(request: NextRequest) {
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

    const instances = await prisma.n8nInstanceConfiguration.findMany({
      where: { partnerId },
      orderBy: { createdAt: 'desc' },
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
        // Don't expose encrypted API key
        _count: {
          select: {
            deployments: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: instances,
    });
  } catch (error) {
    console.error('Error fetching N8N instances:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch N8N instances',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/partner/n8n-instances
 * Create a new N8N instance configuration
 */
export async function POST(request: NextRequest) {
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
    const body = await request.json();

    // Validate input
    const validatedData = sanitizeInput(createInstanceConfigSchema, body);

    // Encrypt API key (using common encryption utility)
    const encryptedApiKey = await N8nApiKeyEncryption.encrypt(validatedData.apiKey);

    // Test connection before saving
    const testClient = new N8nApiClient(validatedData.baseUrl, validatedData.apiKey);
    
    let connectionStatus = 'unknown';
    let connectionError: string | null = null;
    let n8nVersion: string | null = null;

    try {
      const isConnected = await testClient.testConnection();
      connectionStatus = isConnected ? 'connected' : 'failed';
      n8nVersion = null; // We don't get version from testConnection
    } catch (error) {
      connectionStatus = 'failed';
      connectionError = error instanceof Error ? error.message : 'Connection test failed';
    }

    // Create instance configuration
    const instance = await prisma.n8nInstanceConfiguration.create({
      data: {
        partnerId,
        name: validatedData.name,
        baseUrl: validatedData.baseUrl,
        apiKey: encryptedApiKey,
        description: validatedData.description,
        timeoutSeconds: validatedData.timeoutSeconds || 30,
        retryAttempts: validatedData.retryAttempts || 3,
        connectionStatus,
        connectionError,
        n8nVersion,
        lastConnectionTest: new Date(),
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
        // Don't expose encrypted API key
      },
    });

    return NextResponse.json({
      success: true,
      data: instance,
      message: 'N8N instance configuration created successfully',
    });
  } catch (error) {
    console.error('Error creating N8N instance configuration:', error);
    
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
        error: 'Failed to create N8N instance configuration',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
