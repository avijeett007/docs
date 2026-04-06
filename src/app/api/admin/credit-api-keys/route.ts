import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminAuth } from '@/lib/adminAuth';
import { Prisma } from '@prisma/client';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// Valid scopes for API keys
const VALID_SCOPES = ['credits', 'email', 'all'];

// Hash an API key using SHA-256 for secure storage
function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

// Generate a secure API key with prefix
function generateApiKey(): { apiKey: string; prefix: string; apiKeyHash: string } {
  const prefix = 'ack'; // admin credit/campaign key
  const randomBytes = crypto.randomBytes(32).toString('hex');
  const apiKey = `${prefix}_${randomBytes}`;
  const apiKeyHash = hashApiKey(apiKey);
  return { apiKey, prefix: `${prefix}_${randomBytes.substring(0, 8)}`, apiKeyHash };
}

// GET /api/admin/credit-api-keys - List all admin credit API keys
export async function GET(request: NextRequest) {
  try {
    const adminUser = await verifyAdminAuth(request);
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: Prisma.AdminCreditApiKeyWhereInput = {};
    if (status && ['active', 'revoked', 'expired'].includes(status)) {
      where.status = status;
    }

    const [keys, total] = await Promise.all([
      prisma.adminCreditApiKey.findMany({
        where,
        select: {
          id: true, name: true, description: true, prefix: true,
          status: true, scopes: true, expiresAt: true, lastUsedAt: true,
          createdAt: true, updatedAt: true, createdBy: true,
          rateLimit: true, dailyLimit: true, usageCount: true,
          dailyUsage: true, lastResetAt: true, allowedOrigins: true, metadata: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.adminCreditApiKey.count({ where }),
    ]);

    // Auto-expire keys
    const now = new Date();
    const expiredKeys = keys.filter(key =>
      key.status === 'active' && key.expiresAt && key.expiresAt < now
    );
    if (expiredKeys.length > 0) {
      await prisma.adminCreditApiKey.updateMany({
        where: { id: { in: expiredKeys.map(k => k.id) } },
        data: { status: 'expired' },
      });
      expiredKeys.forEach(key => { key.status = 'expired'; });
    }

    return NextResponse.json({
      success: true,
      data: { keys, pagination: { total, limit, offset, hasMore: offset + limit < total } },
    });
  } catch (error) {
    console.error('Error fetching credit API keys:', error);
    return NextResponse.json({ error: 'Failed to fetch credit API keys' }, { status: 500 });
  }
}

// POST /api/admin/credit-api-keys - Create a new admin credit API key
export async function POST(request: NextRequest) {
  try {
    const adminUser = await verifyAdminAuth(request);
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    let expiresAt: Date | null = null;
    if (body.expiresAt) {
      expiresAt = new Date(body.expiresAt);
      if (isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
        return NextResponse.json({ error: 'Expiration date must be in the future.' }, { status: 400 });
      }
    }

    if (body.rateLimit && (body.rateLimit < 1 || body.rateLimit > 1000)) {
      return NextResponse.json({ error: 'Rate limit must be between 1 and 1000 requests per minute' }, { status: 400 });
    }
    if (body.dailyLimit && (body.dailyLimit < 1 || body.dailyLimit > 100000)) {
      return NextResponse.json({ error: 'Daily limit must be between 1 and 100,000 requests per day' }, { status: 400 });
    }

    // Validate scopes
    const scopes: string[] = body.scopes && Array.isArray(body.scopes) && body.scopes.length > 0
      ? body.scopes.filter((s: string) => VALID_SCOPES.includes(s))
      : ['credits']; // Default to credits-only for backward compatibility

    if (scopes.length === 0) {
      return NextResponse.json({ error: `Invalid scopes. Valid values: ${VALID_SCOPES.join(', ')}` }, { status: 400 });
    }

    const { apiKey, prefix, apiKeyHash } = generateApiKey();

    const creditKey = await prisma.adminCreditApiKey.create({
      data: {
        name: body.name.trim(),
        description: body.description?.trim(),
        apiKey: apiKeyHash, // Store hash, not plain text
        prefix, expiresAt,
        scopes,
        createdBy: adminUser.id,
        rateLimit: body.rateLimit,
        dailyLimit: body.dailyLimit,
        allowedOrigins: body.allowedOrigins || [],
        metadata: body.metadata || {},
      },
    });

    // Return the plain-text key ONLY on creation — it cannot be retrieved again
    return NextResponse.json({
      success: true,
      message: 'Admin credit API key created successfully. Save this key — it will not be shown again.',
      data: { ...creditKey, apiKey }, // Override hash with plain key for one-time display
    });
  } catch (error) {
    console.error('Error creating credit API key:', error);
    return NextResponse.json({ error: 'Failed to create credit API key' }, { status: 500 });
  }
}

// PATCH /api/admin/credit-api-keys - Update (revoke/reactivate) an API key
export async function PATCH(request: NextRequest) {
  try {
    const adminUser = await verifyAdminAuth(request);
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, status: newStatus } = body;

    if (!id) {
      return NextResponse.json({ error: 'Key ID is required' }, { status: 400 });
    }

    if (!newStatus || !['active', 'revoked'].includes(newStatus)) {
      return NextResponse.json({ error: 'Status must be "active" or "revoked"' }, { status: 400 });
    }

    const updated = await prisma.adminCreditApiKey.update({
      where: { id },
      data: { status: newStatus },
      select: { id: true, name: true, status: true, updatedAt: true },
    });

    return NextResponse.json({
      success: true,
      message: `API key ${newStatus === 'revoked' ? 'revoked' : 'reactivated'} successfully`,
      data: updated,
    });
  } catch (error) {
    console.error('Error updating credit API key:', error);
    return NextResponse.json({ error: 'Failed to update credit API key' }, { status: 500 });
  }
}

// DELETE /api/admin/credit-api-keys - Delete API keys
export async function DELETE(request: NextRequest) {
  try {
    const adminUser = await verifyAdminAuth(request);
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('ids');

    if (!idsParam) {
      return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
    }

    const ids = idsParam.split(',').filter(id => id.trim());
    if (ids.length === 0) {
      return NextResponse.json({ error: 'No valid IDs provided' }, { status: 400 });
    }

    const result = await prisma.adminCreditApiKey.deleteMany({
      where: { id: { in: ids } },
    });

    return NextResponse.json({
      success: true,
      message: `Deleted ${result.count} credit API key(s)`,
      deletedCount: result.count,
    });
  } catch (error) {
    console.error('Error deleting credit API keys:', error);
    return NextResponse.json({ error: 'Failed to delete credit API keys' }, { status: 500 });
  }
}

