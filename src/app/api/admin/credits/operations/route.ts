import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CreditService } from '@/lib/services/creditService';
import { createClient } from '@supabase/supabase-js';
import { adminRateLimit } from '@/lib/rateLimit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Verify admin authentication using custom Supabase admin cookies
async function verifyAdminAuth(request: NextRequest) {
  try {
    // Initialize Supabase client - SECURITY: Use server-side only environment variables
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase URL or Key is missing');
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
      return null;
    }

    return user;
  } catch (error) {
    console.error('Authentication exception');
    return null;
  }
}

// Helper functions for enhanced credit operations
async function handleSetMonthlyAllocation(
  partnerId: string,
  monthlyAllocation: number,
  reason: string,
  adminEmail?: string
) {
  try {
    // Get current balance for logging
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: { creditBalance: true }
    });

    if (!partner) {
      throw new Error('Partner not found');
    }

    // Update partner's monthly allocation
    await prisma.partner.update({
      where: { id: partnerId },
      data: { monthlyCreditAllocation: monthlyAllocation }
    });

    // Log the change
    await prisma.creditTransaction.create({
      data: {
        partnerId,
        type: 'adjustment',
        amount: 0, // No immediate credit change
        balanceAfter: partner.creditBalance,
        description: `Monthly allocation set to ${monthlyAllocation}: ${reason}`,
        createdBy: adminEmail || 'admin',
        metadata: {
          adminOperation: true,
          operationType: 'set_monthly_allocation',
          newMonthlyAllocation: monthlyAllocation,
          reason
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: `Monthly allocation set to ${monthlyAllocation} credits`,
      data: {
        partnerId,
        operation: 'set_monthly',
        monthlyAllocation,
        reason,
        performedBy: adminEmail || 'admin',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function handleStopMonthlyAllocation(
  partnerId: string,
  reason: string,
  adminEmail?: string
) {
  try {
    // Set monthly allocation to 0 and cancel any active recurring grants
    await prisma.$transaction(async (tx) => {
      // Get current balance for logging
      const partner = await tx.partner.findUnique({
        where: { id: partnerId },
        select: { creditBalance: true }
      });

      if (!partner) {
        throw new Error('Partner not found');
      }

      // Update partner's monthly allocation
      await tx.partner.update({
        where: { id: partnerId },
        data: { monthlyCreditAllocation: 0 }
      });

      // Cancel active recurring grants
      await tx.adminCreditGrant.updateMany({
        where: {
          partnerId,
          grantType: 'monthly_recurring',
          status: 'active'
        },
        data: { status: 'cancelled' }
      });

      // Log the change
      await tx.creditTransaction.create({
        data: {
          partnerId,
          type: 'adjustment',
          amount: 0,
          balanceAfter: partner.creditBalance,
          description: `Monthly allocation stopped: ${reason}`,
          createdBy: adminEmail || 'admin',
          metadata: {
            adminOperation: true,
            operationType: 'stop_monthly_allocation',
            reason
          }
        }
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Monthly allocation stopped',
      data: {
        partnerId,
        operation: 'stop_monthly',
        reason,
        performedBy: adminEmail || 'admin',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function handleRecurringCreditGrant(
  partnerId: string,
  amount: number,
  reason: string,
  adminEmail?: string,
  recurringMonths?: number,
  recurringEndDate?: string,
  metadata: Record<string, any> = {}
) {
  try {
    const endDate = recurringEndDate
      ? new Date(recurringEndDate)
      : recurringMonths
        ? new Date(Date.now() + (recurringMonths * 30 * 24 * 60 * 60 * 1000))
        : new Date(Date.now() + (12 * 30 * 24 * 60 * 60 * 1000)); // Default 12 months

    const nextGrantDate = new Date();
    nextGrantDate.setMonth(nextGrantDate.getMonth() + 1);

    await prisma.$transaction(async (tx) => {
      // Add initial credits
      const result = await CreditService.addCredits(
        partnerId,
        amount,
        'allocation',
        `Recurring credit grant (initial): ${reason}`,
        `recurring-grant-initial-${Date.now()}`,
        adminEmail || 'admin',
        {
          adminOperation: true,
          grantType: 'monthly_recurring',
          recurringMonths,
          recurringEndDate: endDate.toISOString(),
          reason,
          ...metadata
        }
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to add initial credits');
      }

      // Create recurring grant record
      await tx.adminCreditGrant.create({
        data: {
          partnerId,
          grantedBy: adminEmail || 'admin',
          creditsGranted: amount,
          grantType: 'monthly_recurring',
          recurringEndDate: endDate,
          reason,
          status: 'active',
          nextGrantDate,
          totalGranted: amount
        }
      });
    });

    return NextResponse.json({
      success: true,
      message: `Recurring credit grant set up: ${amount} credits monthly until ${endDate.toLocaleDateString()}`,
      data: {
        partnerId,
        operation: 'add',
        grantType: 'monthly_recurring',
        amount,
        recurringEndDate: endDate.toISOString(),
        reason,
        performedBy: adminEmail || 'admin',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Enhanced validation schemas with strict security checks
const creditOperationSchema = z.object({
  partnerId: z.string().uuid('Partner ID must be a valid UUID'),
  amount: z.number().int().min(1, 'Amount must be positive').max(1000000, 'Amount too large'),
  operation: z.enum(['add', 'deduct', 'set_monthly', 'stop_monthly']),
  reason: z.string().min(5, 'Reason must be at least 5 characters').max(500, 'Reason too long'),
  adminEmail: z.string().email('Valid admin email is required').optional(),
  metadata: z.record(z.any()).optional(),
  // Enhanced fields for recurring credits
  grantType: z.enum(['one_time', 'monthly_recurring']).optional(),
  recurringMonths: z.number().int().min(1, 'Minimum 1 month').max(60, 'Maximum 60 months').optional(),
  recurringEndDate: z.string().datetime('Invalid date format').optional(),
  monthlyAllocation: z.number().int().min(0, 'Monthly allocation cannot be negative').max(100000, 'Monthly allocation too large').optional()
}).refine((data) => {
  // Additional validation rules
  if (data.operation === 'add' && data.grantType === 'monthly_recurring' && !data.recurringMonths) {
    return false;
  }
  if (data.operation === 'set_monthly' && data.monthlyAllocation === undefined) {
    return false;
  }
  if ((data.operation === 'add' || data.operation === 'deduct') && !data.amount) {
    return false;
  }
  return true;
}, {
  message: "Invalid operation parameters"
});

/**
 * POST /api/admin/credits/operations
 * Perform manual credit operations (add/deduct)
 */
export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = adminRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.total.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
            'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString()
          }
        }
      );
    }

    // Verify admin authentication
    const user = await verifyAdminAuth(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check request body size (prevent large payloads)
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 10000) { // 10KB limit
      return NextResponse.json(
        { success: false, error: 'Request body too large' },
        { status: 413 }
      );
    }

    const body = await request.json();

    // Additional security: check if body is reasonable size
    if (JSON.stringify(body).length > 10000) {
      return NextResponse.json(
        { success: false, error: 'Request body too large' },
        { status: 413 }
      );
    }

    const validation = creditOperationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.error.errors
        },
        { status: 400 }
      );
    }

    const {
      partnerId,
      amount,
      operation,
      reason,
      adminEmail,
      metadata,
      grantType,
      recurringMonths,
      recurringEndDate,
      monthlyAllocation
    } = validation.data;

    // Handle different operation types
    if (operation === 'set_monthly') {
      return await handleSetMonthlyAllocation(partnerId, monthlyAllocation || 0, reason, adminEmail);
    }

    if (operation === 'stop_monthly') {
      return await handleStopMonthlyAllocation(partnerId, reason, adminEmail);
    }

    // Handle add/deduct operations with potential recurring setup
    if (operation === 'add' && grantType === 'monthly_recurring') {
      return await handleRecurringCreditGrant(
        partnerId,
        amount,
        reason,
        adminEmail,
        recurringMonths,
        recurringEndDate,
        metadata
      );
    }

    // Standard one-time operations
    // Determine transaction type and description
    let transactionType: 'allocation' | 'deduction' | 'refund' | 'adjustment';
    let description: string;

    if (operation === 'add') {
      transactionType = reason.toLowerCase().includes('refund') ? 'refund' : 'adjustment';
      description = `Admin credit addition: ${reason}`;
    } else {
      transactionType = 'adjustment';
      description = `Admin credit deduction: ${reason}`;
    }

    // Perform the operation
    let result;
    if (operation === 'add') {
      result = await CreditService.addCredits(
        partnerId,
        amount,
        transactionType,
        description,
        `admin-${Date.now()}`,
        adminEmail || 'admin',
        {
          adminOperation: true,
          adminEmail: adminEmail || 'admin',
          reason,
          ...metadata
        }
      );
    } else {
      result = await CreditService.deductCredits(
        partnerId,
        amount,
        'analytics', // Use a valid UsageType for admin adjustments
        undefined, // customerId
        undefined, // agentId
        undefined, // sessionId
        undefined, // durationSeconds
        {
          adminOperation: true,
          adminEmail: adminEmail || 'admin',
          reason
        },
        {
          adminOperation: true,
          adminEmail: adminEmail || 'admin',
          reason,
          ...metadata
        }
      );
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    // Admin operation completed successfully - logged in database transaction

    return NextResponse.json({
      success: true,
      message: `Successfully ${operation === 'add' ? 'added' : 'deducted'} ${amount} credits`,
      data: {
        partnerId,
        operation,
        amount,
        newBalance: result.newBalance,
        reason,
        performedBy: adminEmail || 'admin',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error performing credit operation:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/credits/operations
 * Get recent admin credit operations for audit trail
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const user = await verifyAdminAuth(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // Get admin operations from credit transactions
    const [operations, totalCount] = await Promise.all([
      prisma.creditTransaction.findMany({
        where: {
          OR: [
            { createdBy: { contains: 'admin' } },
            { metadata: { path: ['adminOperation'], equals: true } }
          ]
        },
        include: {
          partner: {
            select: {
              id: true,
              businessName: true,
              emailAddress: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.creditTransaction.count({
        where: {
          OR: [
            { createdBy: { contains: 'admin' } },
            { metadata: { path: ['adminOperation'], equals: true } }
          ]
        }
      })
    ]);

    return NextResponse.json({
      success: true,
      data: {
        operations: operations.map(op => ({
          id: op.id,
          partnerId: op.partnerId,
          partnerName: op.partner.businessName,
          partnerEmail: op.partner.emailAddress,
          type: op.type,
          amount: op.amount,
          balanceAfter: op.balanceAfter,
          description: op.description,
          createdBy: op.createdBy,
          createdAt: op.createdAt,
          metadata: op.metadata
        })),
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasNext: page * limit < totalCount,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Error fetching admin operations:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
