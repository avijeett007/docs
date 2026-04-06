import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@supabase/supabase-js';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

interface UpdateWebhookKeyRequest {
  name?: string;
  description?: string;
  status?: 'active' | 'inactive';
  expiresAt?: string | null;
  rateLimit?: number | null;
  dailyLimit?: number | null;
  allowedOrigins?: string[];
  metadata?: Record<string, any>;
}

// Verify admin authentication using custom Supabase admin cookies
async function verifyAdminAuth(request: NextRequest) {
  try {
    // Initialize Supabase client - SECURITY: Use server-side only variables
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase configuration error');
      return null;
    }

    // Extract cookies from the request
    const cookieHeader = request.headers.get('cookie') || '';

    // Parse cookies to find our custom admin session cookie
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    // Check for our custom admin session token
    const adminSessionToken = cookies['supabase-admin-session'];

    if (!adminSessionToken) {
      console.log('Authentication failed: missing token');
      return null;
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the token by setting it and getting the user
    const { data: { user }, error } = await supabase.auth.getUser(adminSessionToken);

    if (error) {
      console.error('Authentication error');
      return null;
    }

    if (!user) {
      console.log('Authentication failed: invalid token');
      return null;
    }

    console.log('Admin authentication successful');
    return user;
  } catch (error) {
    console.error('Authentication exception');
    return null;
  }
}

// GET /api/admin/marketing-webhook-keys/[id] - Get a specific webhook API key
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin authentication
    const adminUser = await verifyAdminAuth(request);
    if (!adminUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;

    // Fetch the webhook API key
    const webhookKey = await prisma.marketingWebhookApiKey.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        prefix: true,
        status: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
        createdBy: true,
        rateLimit: true,
        dailyLimit: true,
        usageCount: true,
        dailyUsage: true,
        lastResetAt: true,
        allowedOrigins: true,
        metadata: true,
        // Don't return the actual API key for security
      },
    });

    if (!webhookKey) {
      return NextResponse.json(
        { error: 'Webhook API key not found' },
        { status: 404 }
      );
    }

    // Check if key is expired and update status
    const now = new Date();
    if (webhookKey.status === 'active' && webhookKey.expiresAt && webhookKey.expiresAt < now) {
      await prisma.marketingWebhookApiKey.update({
        where: { id },
        data: { status: 'expired' },
      });
      webhookKey.status = 'expired';
    }

    return NextResponse.json({
      success: true,
      data: webhookKey,
    });

  } catch (error) {
    console.error('Error fetching webhook API key:', error);
    return NextResponse.json(
      { error: 'Failed to fetch webhook API key' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/marketing-webhook-keys/[id] - Update a webhook API key
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin authentication
    const adminUser = await verifyAdminAuth(request);
    if (!adminUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;
    const body: UpdateWebhookKeyRequest = await request.json();

    // Check if the webhook key exists
    const existingKey = await prisma.marketingWebhookApiKey.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!existingKey) {
      return NextResponse.json(
        { error: 'Webhook API key not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {};

    if (body.name !== undefined) {
      if (!body.name.trim()) {
        return NextResponse.json(
          { error: 'Name cannot be empty' },
          { status: 400 }
        );
      }
      updateData.name = body.name.trim();
    }

    if (body.description !== undefined) {
      updateData.description = body.description?.trim() || null;
    }

    if (body.status !== undefined) {
      if (!['active', 'inactive'].includes(body.status)) {
        return NextResponse.json(
          { error: 'Invalid status. Must be "active" or "inactive"' },
          { status: 400 }
        );
      }
      updateData.status = body.status;
    }

    if (body.expiresAt !== undefined) {
      if (body.expiresAt === null) {
        updateData.expiresAt = null;
      } else {
        const expiresAt = new Date(body.expiresAt);
        if (isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
          return NextResponse.json(
            { error: 'Invalid expiration date. Must be in the future.' },
            { status: 400 }
          );
        }
        updateData.expiresAt = expiresAt;
      }
    }

    if (body.rateLimit !== undefined) {
      if (body.rateLimit !== null && (body.rateLimit < 1 || body.rateLimit > 1000)) {
        return NextResponse.json(
          { error: 'Rate limit must be between 1 and 1000 requests per minute' },
          { status: 400 }
        );
      }
      updateData.rateLimit = body.rateLimit;
    }

    if (body.dailyLimit !== undefined) {
      if (body.dailyLimit !== null && (body.dailyLimit < 1 || body.dailyLimit > 100000)) {
        return NextResponse.json(
          { error: 'Daily limit must be between 1 and 100,000 requests per day' },
          { status: 400 }
        );
      }
      updateData.dailyLimit = body.dailyLimit;
    }

    if (body.allowedOrigins !== undefined) {
      updateData.allowedOrigins = body.allowedOrigins || [];
    }

    if (body.metadata !== undefined) {
      updateData.metadata = body.metadata || {};
    }

    // Update the webhook API key
    const updatedKey = await prisma.marketingWebhookApiKey.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        description: true,
        prefix: true,
        status: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
        createdBy: true,
        rateLimit: true,
        dailyLimit: true,
        usageCount: true,
        dailyUsage: true,
        lastResetAt: true,
        allowedOrigins: true,
        metadata: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Webhook API key updated successfully',
      data: updatedKey,
    });

  } catch (error) {
    console.error('Error updating webhook API key:', error);
    return NextResponse.json(
      { error: 'Failed to update webhook API key' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/marketing-webhook-keys/[id] - Delete a webhook API key
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin authentication
    const adminUser = await verifyAdminAuth(request);
    if (!adminUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;

    // Check if the webhook key exists
    const existingKey = await prisma.marketingWebhookApiKey.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!existingKey) {
      return NextResponse.json(
        { error: 'Webhook API key not found' },
        { status: 404 }
      );
    }

    // Delete the webhook API key
    await prisma.marketingWebhookApiKey.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: `Webhook API key "${existingKey.name}" deleted successfully`,
    });

  } catch (error) {
    console.error('Error deleting webhook API key:', error);
    return NextResponse.json(
      { error: 'Failed to delete webhook API key' },
      { status: 500 }
    );
  }
}
