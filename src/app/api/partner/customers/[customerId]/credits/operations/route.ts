import { NextRequest, NextResponse } from 'next/server';
import { CustomerCreditService } from '@/lib/services/customerCreditService';
import { partnerRateLimit } from '@/lib/rateLimit';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getLiteLLMClient } from '@/lib/litellm';
import { decryptData } from '@/lib/encryption';
import { logger } from '@/lib/logger';

// Input validation schema
const customerCreditOperationSchema = z.object({
  operation: z.enum(['add', 'deduct', 'set_monthly']),
  amount: z.number().int().min(1).max(1000000).optional(),
  monthlyAllocation: z.number().int().min(0).max(1000000).optional(),
  reason: z.string().min(5, 'Reason must be at least 5 characters').max(500, 'Reason too long'),
  grantType: z.enum(['one_time', 'monthly_recurring']).optional(),
  recurringMonths: z.number().int().min(1).max(60).optional(),
  rolloverEnabled: z.boolean().optional(),
  partnerEmail: z.string().email().optional()
}).refine((data) => {
  // Validate operation-specific requirements
  if ((data.operation === 'add' || data.operation === 'deduct') && !data.amount) {
    return false;
  }
  if (data.operation === 'set_monthly' && data.monthlyAllocation === undefined) {
    return false;
  }
  if (data.operation === 'add' && data.grantType === 'monthly_recurring' && !data.recurringMonths) {
    return false;
  }
  return true;
}, {
  message: "Invalid operation parameters"
});

// Verify partner authentication
async function verifyPartnerAuth(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cookieHeader = request.headers.get('cookie');
    
    let token = null;
    
    // Try Authorization header first
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    // Try cookie as fallback
    else if (cookieHeader) {
      const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>);
      
      token = cookies['partner_token'];
    }

    if (!token) {
      return null;
    }

    // Import JWT verification
    const { verifyJWT } = await import('@/lib/jwt');
    const payload = await verifyJWT(token);
    
    if (!payload || !payload.partnerId) {
      return null;
    }

    return payload;
  } catch (error) {
    logger.error('Partner authentication error', error instanceof Error ? error : new Error(String(error)), {
      operation: 'partner_credits_operations',
    });
    return null;
  }
}

/**
 * Re-enable any suspended AI Gateway keys for a customer after credits are restored.
 * Fire-and-forget: failures are logged but never propagate to the caller.
 */
async function reEnableCustomerGatewayKeys(customerId: string): Promise<void> {
  try {
    const suspendedKeys = await prisma.aiGatewayKey.findMany({
      where: { customerId, status: 'suspended' },
      select: { id: true, encryptedVirtualKey: true },
    });

    if (suspendedKeys.length === 0) return;

    const litellm = getLiteLLMClient();
    for (const key of suspendedKeys) {
      try {
        const rawVirtualKey = await decryptData(key.encryptedVirtualKey);
        await litellm.unblockKey(rawVirtualKey);
        await prisma.aiGatewayKey.update({
          where: { id: key.id },
          data: { status: 'active' },
        });
        logger.info(`[PartnerCreditsOps] Re-enabled AI Gateway key ${key.id} for customer ${customerId}`, {
          operation: 'partner_credits_operations',
          customerId,
          keyId: key.id,
        });
      } catch (err) {
        logger.error(`[PartnerCreditsOps] Failed to re-enable key ${key.id}`, err instanceof Error ? err : new Error(String(err)), {
          operation: 'partner_credits_operations',
          customerId,
          keyId: key.id,
        });
      }
    }
  } catch (err) {
    logger.error('[PartnerCreditsOps] reEnableCustomerGatewayKeys error', err instanceof Error ? err : new Error(String(err)), {
      operation: 'partner_credits_operations',
      customerId,
    });
  }
}

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { customerId: string } }
) {
  try {
    // Apply rate limiting
    const rateLimitResult = partnerRateLimit(request);
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
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
          }
        }
      );
    }

    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check request body size
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 10000) {
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

    const validation = customerCreditOperationSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid input',
          details: validation.error.errors
        },
        { status: 400 }
      );
    }

    const { 
      operation, 
      amount, 
      monthlyAllocation, 
      reason, 
      grantType = 'one_time',
      recurringMonths,
      rolloverEnabled = false,
      partnerEmail
    } = validation.data;

    const customerId = params.customerId;
    const partnerId = partner.partnerId;
    const performedBy = partnerEmail || partner.email || 'partner';

    let result;

    switch (operation) {
      case 'add':
        if (!amount) {
          return NextResponse.json(
            { success: false, error: 'Amount is required for add operation' },
            { status: 400 }
          );
        }
        result = await CustomerCreditService.addCredits(
          customerId,
          partnerId,
          amount,
          reason,
          performedBy,
          grantType,
          recurringMonths
        );
        break;

      case 'deduct':
        if (!amount) {
          return NextResponse.json(
            { success: false, error: 'Amount is required for deduct operation' },
            { status: 400 }
          );
        }
        result = await CustomerCreditService.deductCredits(
          customerId,
          partnerId,
          amount,
          reason,
          performedBy
        );
        break;

      case 'set_monthly':
        if (monthlyAllocation === undefined) {
          return NextResponse.json(
            { success: false, error: 'Monthly allocation is required for set_monthly operation' },
            { status: 400 }
          );
        }
        result = await CustomerCreditService.setMonthlyAllocation(
          customerId,
          partnerId,
          monthlyAllocation,
          reason,
          performedBy,
          rolloverEnabled
        );
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid operation' },
          { status: 400 }
        );
    }

    if (result.success) {
      // After successful credit addition, run fire-and-forget post-credit tasks
      if (operation === 'add') {
        // Use the actual Customer.id returned from the service, not the UserOnboarding.id from the path
        const actualCustomerId = result.customerId || customerId;

        // 1. Re-enable any suspended AI Gateway keys (credits restored)
        reEnableCustomerGatewayKeys(actualCustomerId);

        // 2. Reassociate any phone numbers suspended due to insufficient credits
        try {
          const connectHubUrl = process.env.CONNECT_HUB_URL;
          if (connectHubUrl) {
            logger.info(`[PartnerCreditsOps] Triggering phone reassociation for customer ${actualCustomerId}`, {
              operation: 'partner_credits_operations',
              customerId: actualCustomerId,
            });
            fetch(`${connectHubUrl}/api/phone-reassociation/${actualCustomerId}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.CONNECT_HUB_API_KEY || ''}`,
              },
            }).then(async (res) => {
              if (res.ok) {
                const data = await res.json();
                logger.info(`[PartnerCreditsOps] Phone reassociation completed for customer ${actualCustomerId}`, {
                  operation: 'partner_credits_operations',
                  customerId: actualCustomerId,
                  totalFound: data.totalFound,
                  restored: data.restored,
                  failed: data.failed,
                });
              } else {
                logger.warn(`[PartnerCreditsOps] Phone reassociation returned HTTP ${res.status} for customer ${actualCustomerId}`, {
                  operation: 'partner_credits_operations',
                  customerId: actualCustomerId,
                  status: res.status,
                });
              }
            }).catch((err: Error) => {
              logger.error(`[PartnerCreditsOps] Phone reassociation request failed for customer ${actualCustomerId}`, err, {
                operation: 'partner_credits_operations',
                customerId: actualCustomerId,
              });
            });
          }
        } catch (reassocError) {
          logger.error('[PartnerCreditsOps] Error triggering phone reassociation', reassocError instanceof Error ? reassocError : new Error(String(reassocError)), {
            operation: 'partner_credits_operations',
            customerId: actualCustomerId,
          });
        }
      }

      return NextResponse.json({
        success: true,
        message: `Customer credit ${operation} completed successfully`,
        data: {
          customerId,
          operation,
          amount: operation === 'set_monthly' ? monthlyAllocation : amount,
          newBalance: result.newBalance,
          transactionId: result.transactionId,
          performedBy,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      // Determine appropriate status code and error code based on error type
      let statusCode = 400;
      let errorCode = 'OPERATION_FAILED';

      if (result.error?.includes('portal access')) {
        statusCode = 403;
        errorCode = 'PORTAL_NOT_ENABLED';
      } else if (result.error?.includes('not been provisioned')) {
        statusCode = 403;
        errorCode = 'CUSTOMER_NOT_PROVISIONED';
      } else if (result.error?.includes('not found')) {
        statusCode = 404;
        errorCode = 'CUSTOMER_NOT_FOUND';
      } else if (result.error?.includes('insufficient')) {
        statusCode = 400;
        errorCode = 'INSUFFICIENT_CREDITS';
      }

      return NextResponse.json(
        {
          success: false,
          error: result.error,
          code: errorCode
        },
        { status: statusCode }
      );
    }

  } catch (error) {
    logger.error('Customer credit operation error', error instanceof Error ? error : new Error(String(error)), {
      operation: 'partner_credits_operations',
    });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { customerId: string } }
) {
  try {
    // Apply rate limiting
    const rateLimitResult = partnerRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const customerId = params.customerId;
    const partnerId = partner.partnerId;

    // Get customer credit info
    const creditInfo = await CustomerCreditService.getCustomerCreditInfo(customerId, partnerId);

    if (!creditInfo.success) {
      // Determine appropriate status code and error code based on error type
      let statusCode = 404;
      let errorCode = 'CUSTOMER_NOT_FOUND';

      if (creditInfo.error?.includes('portal access')) {
        statusCode = 403; // Forbidden - customer exists but portal not enabled
        errorCode = 'PORTAL_NOT_ENABLED';
      } else if (creditInfo.error?.includes('not been provisioned')) {
        statusCode = 403;
        errorCode = 'CUSTOMER_NOT_PROVISIONED';
      }

      return NextResponse.json(
        {
          success: false,
          error: creditInfo.error,
          code: errorCode
        },
        { status: statusCode }
      );
    }

    // Get recent transactions
    const transactions = await CustomerCreditService.getCustomerTransactions(
      customerId, 
      partnerId, 
      10, 
      0
    );

    return NextResponse.json({
      success: true,
      data: {
        customer: creditInfo.data,
        recentTransactions: transactions.success && transactions.data ? transactions.data.transactions : []
      }
    });

  } catch (error) {
    logger.error('Get customer credit info error', error instanceof Error ? error : new Error(String(error)), {
      operation: 'partner_credits_operations',
    });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
