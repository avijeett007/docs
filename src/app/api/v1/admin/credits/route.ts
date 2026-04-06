import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CreditService } from '@/lib/services/creditService';
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// Hash an API key using SHA-256 for lookup
function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

// Validate API key and return the key record if valid
async function validateApiKey(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '');

  if (!apiKey) return null;

  // Hash the incoming key and look up by hash
  const apiKeyHash = hashApiKey(apiKey);
  const keyRecord = await prisma.adminCreditApiKey.findUnique({
    where: { apiKey: apiKeyHash },
  });

  if (!keyRecord) return null;

  // Check status
  if (keyRecord.status !== 'active') return null;

  // Check scope permission — key must have 'credits' or 'all' scope
  const scopes = keyRecord.scopes || ['credits'];
  if (!scopes.includes('all') && !scopes.includes('credits')) return null;

  // Check expiry
  if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
    await prisma.adminCreditApiKey.update({
      where: { id: keyRecord.id },
      data: { status: 'expired' },
    });
    return null;
  }

  // Check daily rate limit BEFORE incrementing usage
  const now = new Date();
  const lastReset = keyRecord.lastResetAt;
  const shouldReset = lastReset.toDateString() !== now.toDateString();

  if (shouldReset) {
    await prisma.adminCreditApiKey.update({
      where: { id: keyRecord.id },
      data: { dailyUsage: 1, lastResetAt: now, usageCount: { increment: 1 }, lastUsedAt: now },
    });
  } else {
    // Check limit BEFORE incrementing to prevent off-by-one
    if (keyRecord.dailyLimit && keyRecord.dailyUsage >= keyRecord.dailyLimit) {
      return null; // Daily limit exceeded
    }
    await prisma.adminCreditApiKey.update({
      where: { id: keyRecord.id },
      data: { dailyUsage: { increment: 1 }, usageCount: { increment: 1 }, lastUsedAt: now },
    });
  }

  return keyRecord;
}

// Resolve partner by email
async function resolvePartnerByEmail(email: string) {
  return prisma.partner.findUnique({
    where: { emailAddress: email },
    select: { id: true, businessName: true, emailAddress: true, creditBalance: true },
  });
}

const externalCreditSchema = z.object({
  partnerEmail: z.string().email('Valid partner email is required'),
  operation: z.enum(['add', 'deduct', 'set_monthly', 'stop_monthly']),
  amount: z.number().int().min(1).max(1000000).optional(),
  reason: z.string().min(3).max(500),
  grantType: z.enum(['one_time', 'monthly_recurring']).optional().default('one_time'),
  recurringMonths: z.number().int().min(1).max(60).optional(),
  recurringEndDate: z.string().optional(),
  monthlyAllocation: z.number().int().min(0).max(100000).optional(),
  metadata: z.record(z.any()).optional(),
}).refine((data) => {
  if (['add', 'deduct'].includes(data.operation) && !data.amount) return false;
  if (data.operation === 'set_monthly' && data.monthlyAllocation === undefined) return false;
  if (data.grantType === 'monthly_recurring' && !data.recurringMonths) return false;
  return true;
}, { message: 'Invalid operation parameters. Check amount, monthlyAllocation, or recurringMonths.' });

/**
 * POST /api/v1/admin/credits
 * External API for CRM integrations to manage partner credits by email
 *
 * Headers: X-API-Key: ack_xxxxx
 * Body: { partnerEmail, operation, amount, reason, grantType?, ... }
 */
export async function POST(request: NextRequest) {
  try {
    // Validate API key
    const keyRecord = await validateApiKey(request);
    if (!keyRecord) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired API key' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = externalCreditSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { partnerEmail, operation, amount, reason, grantType, recurringMonths,
            recurringEndDate, monthlyAllocation, metadata } = validation.data;

    // Resolve partner by email
    const partner = await resolvePartnerByEmail(partnerEmail);
    if (!partner) {
      return NextResponse.json(
        { success: false, error: `Partner not found with email: ${partnerEmail}` },
        { status: 404 }
      );
    }

    const partnerId = partner.id;
    const apiKeyName = keyRecord.name;
    const createdBy = `api-key:${apiKeyName}`;

    // Handle set_monthly — use transaction for atomicity
    if (operation === 'set_monthly') {
      await prisma.$transaction(async (tx) => {
        await tx.partner.update({
          where: { id: partnerId },
          data: { monthlyCreditAllocation: monthlyAllocation || 0 },
        });
        await tx.creditTransaction.create({
          data: {
            partnerId, type: 'adjustment', amount: 0,
            balanceAfter: partner.creditBalance,
            description: `Monthly allocation set to ${monthlyAllocation} via API: ${reason}`,
            createdBy,
            metadata: { adminOperation: true, operationType: 'set_monthly_allocation', apiKey: apiKeyName, ...(metadata || {}) },
          },
        });
      });
      return NextResponse.json({
        success: true,
        message: `Monthly allocation set to ${monthlyAllocation} credits for ${partner.businessName}`,
        data: { partnerEmail, partnerId, operation, monthlyAllocation, reason, timestamp: new Date().toISOString() },
      });
    }

    // Handle stop_monthly
    if (operation === 'stop_monthly') {
      await prisma.$transaction(async (tx) => {
        await tx.partner.update({ where: { id: partnerId }, data: { monthlyCreditAllocation: 0 } });
        await tx.adminCreditGrant.updateMany({
          where: { partnerId, grantType: 'monthly_recurring', status: 'active' },
          data: { status: 'cancelled' },
        });
        await tx.creditTransaction.create({
          data: {
            partnerId, type: 'adjustment', amount: 0,
            balanceAfter: partner.creditBalance,
            description: `Monthly allocation stopped via API: ${reason}`,
            createdBy,
            metadata: { adminOperation: true, operationType: 'stop_monthly_allocation', apiKey: apiKeyName, ...(metadata || {}) },
          },
        });
      });
      return NextResponse.json({
        success: true,
        message: `Monthly allocation stopped for ${partner.businessName}`,
        data: { partnerEmail, partnerId, operation, reason, timestamp: new Date().toISOString() },
      });
    }

    // Handle add with recurring
    if (operation === 'add' && grantType === 'monthly_recurring') {
      const endDate = recurringEndDate
        ? new Date(recurringEndDate)
        : new Date(Date.now() + (recurringMonths! * 30 * 24 * 60 * 60 * 1000));

      const nextGrantDate = new Date();
      nextGrantDate.setMonth(nextGrantDate.getMonth() + 1);

      await prisma.$transaction(async (tx) => {
        const result = await CreditService.addCredits(
          partnerId, amount!, 'allocation',
          `Recurring credit grant (initial) via API: ${reason}`,
          `api-recurring-grant-${Date.now()}`, createdBy,
          { adminOperation: true, grantType: 'monthly_recurring', apiKey: apiKeyName, ...(metadata || {}) }
        );
        if (!result.success) throw new Error(result.error || 'Failed to add initial credits');

        await tx.adminCreditGrant.create({
          data: {
            partnerId, grantedBy: createdBy, creditsGranted: amount!,
            grantType: 'monthly_recurring', recurringEndDate: endDate,
            reason, status: 'active', nextGrantDate, totalGranted: amount!,
          },
        });
      });

      return NextResponse.json({
        success: true,
        message: `Recurring credit grant set up: ${amount} credits monthly for ${partner.businessName}`,
        data: { partnerEmail, partnerId, operation, grantType, amount, recurringEndDate: endDate.toISOString(), reason, timestamp: new Date().toISOString() },
      });
    }

    // Handle one-time add or deduct
    let result;
    if (operation === 'add') {
      result = await CreditService.addCredits(
        partnerId, amount!, 'adjustment',
        `Admin credit addition via API: ${reason}`,
        `api-${Date.now()}`, createdBy,
        { adminOperation: true, apiKey: apiKeyName, ...(metadata || {}) }
      );
    } else {
      // deduct
      result = await CreditService.deductCredits(
        partnerId, amount!, 'analytics',
        undefined, undefined, undefined, undefined,
        { adminOperation: true, apiKey: apiKeyName, reason },
        { adminOperation: true, apiKey: apiKeyName, ...(metadata || {}) }
      );
    }

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully ${operation === 'add' ? 'added' : 'deducted'} ${amount} credits for ${partner.businessName}`,
      data: {
        partnerEmail, partnerId, operation, amount,
        newBalance: result.newBalance, reason,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error in external credit API:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/admin/credits?partnerEmail=xxx
 * Get partner credit balance by email
 */
export async function GET(request: NextRequest) {
  try {
    const keyRecord = await validateApiKey(request);
    if (!keyRecord) {
      return NextResponse.json({ success: false, error: 'Invalid or expired API key' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const partnerEmail = searchParams.get('partnerEmail');

    if (!partnerEmail) {
      return NextResponse.json({ success: false, error: 'partnerEmail query parameter is required' }, { status: 400 });
    }

    const partner = await resolvePartnerByEmail(partnerEmail);
    if (!partner) {
      return NextResponse.json({ success: false, error: `Partner not found with email: ${partnerEmail}` }, { status: 404 });
    }

    const balance = await CreditService.getPartnerCreditBalance(partner.id);

    return NextResponse.json({
      success: true,
      data: {
        partnerEmail: partner.emailAddress,
        businessName: partner.businessName,
        ...balance,
      },
    });
  } catch (error) {
    console.error('Error fetching partner credits:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
