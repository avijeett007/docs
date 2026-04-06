import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  createDeploymentSchema,
  sanitizeInput
} from '@/lib/validations/n8n';
import { N8nApiKeyEncryption } from '@/lib/security/n8n-encryption';
import { N8nApiClient } from '@/lib/n8n/client';
import { KnotieCredentialManager } from '@/lib/n8n/credentials';
import { WorkflowDeploymentEngine } from '@/lib/n8n/deployment';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { z } from 'zod';
import crypto from 'crypto';

// Utility function to create secure token hash
function createTokenHash(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex').substring(0, 32);
}

/**
 * GET /api/partner/n8n-workflow-deployments
 * Get partner's workflow deployments
 */
export async function GET(request: NextRequest) {
  try {
    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const partnerId = partner.id;

    // Parse query parameters
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const customerId = searchParams.get('customerId');
    const productId = searchParams.get('productId');

    // Build where clause
    const where: any = { partnerId };
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (productId) where.productId = productId;

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get total count
    const total = await prisma.n8nWorkflowDeployment.count({ where });

    // Get deployments
    const deployments = await prisma.n8nWorkflowDeployment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            category: true,
            difficulty: true,
          },
        },
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        instanceConfig: {
          select: {
            id: true,
            name: true,
            baseUrl: true,
          },
        },
      },
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return NextResponse.json({
      success: true,
      data: deployments,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext,
        hasPrev,
      },
    });
  } catch (error) {
    console.error('Error fetching workflow deployments:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch workflow deployments',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/partner/n8n-workflow-deployments
 * Create a new workflow deployment
 */
export async function POST(request: NextRequest) {
  try {
    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate input
    const validatedData = sanitizeInput(createDeploymentSchema, body);
    const partnerId = partner.id;

    // Validate that all referenced entities exist and belong to the partner
    const [product, customers, instanceConfig, knotieToken] = await Promise.all([
      prisma.n8nWorkflowProduct.findFirst({
        where: {
          id: validatedData.productId,
          isActive: true,
          isPublished: true,
        },
      }),
      prisma.customer.findMany({
        where: {
          id: { in: validatedData.customerIds },
          credentials: {
            some: {
              partnerId,
            },
          },
        },
      }),
      prisma.n8nInstanceConfiguration.findFirst({
        where: {
          id: validatedData.instanceConfigId,
          partnerId,
          isActive: true,
        },
      }),
      null, // knotieToken - removed for now as it's not in the schema
    ]);

    if (!product) {
      return NextResponse.json(
        {
          success: false,
          error: 'Product not found or not available',
        },
        { status: 404 }
      );
    }

    if (customers.length !== validatedData.customerIds.length) {
      return NextResponse.json(
        {
          success: false,
          error: 'One or more customers not found',
        },
        { status: 404 }
      );
    }

    if (!instanceConfig) {
      return NextResponse.json(
        {
          success: false,
          error: 'N8N instance configuration not found',
        },
        { status: 404 }
      );
    }

    // Knotie token validation removed - not in schema

    // Create deployment record
    const deployment = await prisma.n8nWorkflowDeployment.create({
      data: {
        partnerId,
        customerId: validatedData.customerIds[0],
        productId: validatedData.productId,
        instanceConfigId: validatedData.instanceConfigId,
        knotieTokenId: null, // Not in schema
        deploymentMode: validatedData.deploymentMode || 'automatic',
        status: 'pending',
      },
      include: {
        product: true,
        customer: true,
        instanceConfig: true,
      },
    });

    // If automatic deployment mode, start the deployment process
    if (validatedData.deploymentMode === 'automatic' && customers.length > 0) {
      // Start deployment in background (don't await to avoid timeout)
      processAutomaticDeployment(deployment.id, product, customers[0], instanceConfig, partnerId)
        .catch(error => {
          console.error('Background deployment failed:', error);
          // Update deployment status to failed
          prisma.n8nWorkflowDeployment.update({
            where: { id: deployment.id },
            data: {
              status: 'failed',
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
            },
          }).catch(console.error);
        });
    }

    return NextResponse.json({
      success: true,
      data: deployment,
      message: validatedData.deploymentMode === 'automatic' 
        ? 'Deployment started successfully' 
        : 'Deployment created successfully',
    });
  } catch (error) {
    console.error('Error creating workflow deployment:', error);
    
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
        error: 'Failed to create workflow deployment',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Process automatic deployment in background
 */
async function processAutomaticDeployment(
  deploymentId: string,
  product: any,
  customer: any,
  instanceConfig: any,
  partnerId: string
) {
  try {
    // Update deployment status to in_progress
    await prisma.n8nWorkflowDeployment.update({
      where: { id: deploymentId },
      data: {
        status: 'in_progress',
        startedAt: new Date(),
      },
    });

    // Decrypt API key (using common encryption utility)
    const decryptedApiKey = await N8nApiKeyEncryption.decrypt(instanceConfig.apiKey);

    // Initialize N8N client and deployment engine
    const n8nClient = new N8nApiClient(instanceConfig.baseUrl, decryptedApiKey);
    const credentialManager = new KnotieCredentialManager(n8nClient);
    const deploymentEngine = new WorkflowDeploymentEngine(n8nClient, credentialManager);

    // Get Connect Hub URL from environment
    const connectHubUrl = process.env.CONNECT_HUB_URL || 'https://connect-hub.knotie-ai.pro';

    // Create Knotie token automatically for the customer
    const tokenName = `Auto-${product.name}-${customer.firstName || 'Customer'}-${Date.now()}`;
    const tokenPayload = {
      partnerId,
      customerId: customer.customerId, // Use the actual Customer.id
      scope: 'all' as const,
      options: {
        expiresIn: 2592000, // 30 days
        usageLimit: 1000, // 1000 requests/hour
        tokenType: 'n8n' as const,
        metadata: {
          name: tokenName,
          description: `Auto-generated token for ${product.name} workflow deployment`,
          createdBy: partnerId
        }
      }
    };

    const tokenResponse = await fetch(`${connectHubUrl}/api/tokens/multi-tool`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CONNECT_HUB_API_KEY || ''}`
      },
      body: JSON.stringify(tokenPayload)
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Failed to create Knotie token: ${errorData.error || 'Unknown error'}`);
    }

    const tokenData = await tokenResponse.json();
    if (!tokenData.success) {
      throw new Error(`Failed to create Knotie token: ${tokenData.error || 'Unknown error'}`);
    }

    // Store token metadata in database
    const tokenRecord = await prisma.n8nToken.create({
      data: {
        partnerId,
        customerId: customer.id, // Use UserOnboarding ID for database storage
        name: tokenName,
        description: `Auto-generated token for ${product.name} workflow deployment`,
        scope: JSON.stringify('all'),
        tokenHash: createTokenHash(tokenData.data.token), // Store secure hash
        expiresAt: new Date(tokenData.data.metadata.expiresAt),
        usageLimit: 1000,
        isActive: true
      }
    });

    // Update deployment record with token ID
    await prisma.n8nWorkflowDeployment.update({
      where: { id: deploymentId },
      data: {
        knotieTokenId: tokenRecord.id,
      },
    });

    // Deploy workflow with the created token
    const result = await deploymentEngine.deployWorkflow(
      product,
      customer,
      tokenData.data, // Use the actual token data
      connectHubUrl
    );

    // Update deployment with results
    await prisma.n8nWorkflowDeployment.update({
      where: { id: deploymentId },
      data: {
        status: result.success ? 'completed' : 'failed',
        n8nWorkflowId: result.workflowId,
        n8nWorkflowName: null, // Not available in DeploymentResult
        n8nCredentialId: result.credentialId,
        deploymentLog: JSON.stringify(result.details || {}),
        errorMessage: result.error,
        completedAt: new Date(),
      },
    });

    // Increment deployment count for product if successful
    if (result.success) {
      await prisma.n8nWorkflowProduct.update({
        where: { id: product.id },
        data: {
          deploymentCount: {
            increment: 1,
          },
        },
      });
    }
  } catch (error) {
    console.error('Automatic deployment failed:', error);
    
    // Update deployment status to failed
    await prisma.n8nWorkflowDeployment.update({
      where: { id: deploymentId },
      data: {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
      },
    });
  }
}
