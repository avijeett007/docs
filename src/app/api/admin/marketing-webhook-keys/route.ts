import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

interface CreateWebhookKeyRequest {
  name: string;
  description?: string;
  expiresAt?: string;
  rateLimit?: number;
  dailyLimit?: number;
  allowedOrigins?: string[];
  metadata?: Record<string, any>;
}

// Generate a secure API key with prefix
function generateApiKey(): { apiKey: string; prefix: string } {
  const prefix = 'mwk'; // marketing webhook key
  const randomBytes = crypto.randomBytes(32).toString('hex');
  const apiKey = `${prefix}_${randomBytes}`;
  return { apiKey, prefix };
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

// GET /api/admin/marketing-webhook-keys - List all webhook API keys
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const adminUser = await verifyAdminAuth(request);
    if (!adminUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause
    const where: any = {};
    if (status && ['active', 'inactive', 'expired'].includes(status)) {
      where.status = status;
    }

    // Fetch webhook API keys
    const [keys, total] = await Promise.all([
      prisma.marketingWebhookApiKey.findMany({
        where,
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
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.marketingWebhookApiKey.count({ where }),
    ]);

    // Check for expired keys and update status
    const now = new Date();
    const expiredKeys = keys.filter(key => 
      key.status === 'active' && 
      key.expiresAt && 
      key.expiresAt < now
    );

    if (expiredKeys.length > 0) {
      await prisma.marketingWebhookApiKey.updateMany({
        where: {
          id: { in: expiredKeys.map(k => k.id) },
        },
        data: { status: 'expired' },
      });

      // Update the status in our response
      expiredKeys.forEach(key => {
        key.status = 'expired';
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        keys,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      },
    });

  } catch (error) {
    console.error('Error fetching webhook API keys:', error);
    return NextResponse.json(
      { error: 'Failed to fetch webhook API keys' },
      { status: 500 }
    );
  }
}

// POST /api/admin/marketing-webhook-keys - Create a new webhook API key
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const adminUser = await verifyAdminAuth(request);
    if (!adminUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: CreateWebhookKeyRequest = await request.json();

    // Validate required fields
    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Validate expiration date if provided
    let expiresAt: Date | null = null;
    if (body.expiresAt) {
      expiresAt = new Date(body.expiresAt);
      if (isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
        return NextResponse.json(
          { error: 'Invalid expiration date. Must be in the future.' },
          { status: 400 }
        );
      }
    }

    // Validate rate limits
    if (body.rateLimit && (body.rateLimit < 1 || body.rateLimit > 1000)) {
      return NextResponse.json(
        { error: 'Rate limit must be between 1 and 1000 requests per minute' },
        { status: 400 }
      );
    }

    if (body.dailyLimit && (body.dailyLimit < 1 || body.dailyLimit > 100000)) {
      return NextResponse.json(
        { error: 'Daily limit must be between 1 and 100,000 requests per day' },
        { status: 400 }
      );
    }

    // Generate API key
    const { apiKey, prefix } = generateApiKey();

    // Create the webhook API key
    const webhookKey = await prisma.marketingWebhookApiKey.create({
      data: {
        name: body.name.trim(),
        description: body.description?.trim(),
        apiKey,
        prefix,
        expiresAt,
        createdBy: adminUser.id,
        rateLimit: body.rateLimit,
        dailyLimit: body.dailyLimit,
        allowedOrigins: body.allowedOrigins || [],
        metadata: body.metadata || {},
      },
      select: {
        id: true,
        name: true,
        description: true,
        apiKey: true, // Return the API key only on creation
        prefix: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        createdBy: true,
        rateLimit: true,
        dailyLimit: true,
        allowedOrigins: true,
        metadata: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Webhook API key created successfully',
      data: webhookKey,
    });

  } catch (error) {
    console.error('Error creating webhook API key:', error);
    return NextResponse.json(
      { error: 'Failed to create webhook API key' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/marketing-webhook-keys - Delete multiple webhook API keys
export async function DELETE(request: NextRequest) {
  try {
    // Verify admin authentication
    const adminUser = await verifyAdminAuth(request);
    if (!adminUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('ids');
    
    if (!idsParam) {
      return NextResponse.json(
        { error: 'No IDs provided' },
        { status: 400 }
      );
    }

    const ids = idsParam.split(',').filter(id => id.trim());
    
    if (ids.length === 0) {
      return NextResponse.json(
        { error: 'No valid IDs provided' },
        { status: 400 }
      );
    }

    // Delete the webhook API keys
    const result = await prisma.marketingWebhookApiKey.deleteMany({
      where: {
        id: { in: ids },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Deleted ${result.count} webhook API key(s)`,
      deletedCount: result.count,
    });

  } catch (error) {
    console.error('Error deleting webhook API keys:', error);
    return NextResponse.json(
      { error: 'Failed to delete webhook API keys' },
      { status: 500 }
    );
  }
}
