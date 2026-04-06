import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { obfuscateId } from '@/lib/pii-obfuscation';

export const dynamic = 'force-dynamic';

const phoneNumberMutationSchema = z.object({
  phoneNumberIds: z.array(z.string().uuid()).min(1),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { poolId: string } }
) {
  try {
    const partnerAuth = await verifyPartnerJWT(req);
    if (!partnerAuth || !partnerAuth.isValid || !partnerAuth.payload?.partnerId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = partnerAuth.payload.partnerId;
    const { poolId } = params;

    const db = prisma as any;

    const pool = await db.numberPool.findFirst({
      where: {
        id: poolId,
        partnerId,
      },
      select: { id: true },
    });

    if (!pool) {
      return NextResponse.json(
        { success: false, error: 'Number pool not found' },
        { status: 404 }
      );
    }

    const [allPhoneNumbers, poolMappings] = await Promise.all([
      prisma.phoneNumber.findMany({
        where: { partnerId },
        select: {
          id: true,
          phoneNumber: true,
          friendlyName: true,
          provider: true,
          status: true,
          customerId: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.numberPoolPhoneNumber.findMany({
        where: { numberPoolId: poolId },
        select: {
          phoneNumberId: true,
          assignedAt: true,
        },
      }),
    ]);

    const poolPhoneNumberIds = new Set(poolMappings.map((m: any) => m.phoneNumberId));
    const mappingsByPhoneNumberId = new Map<string, { phoneNumberId: string; assignedAt: Date }>(
      poolMappings.map((m: any) => [m.phoneNumberId, m])
    );

    const enrichedPhoneNumbers = allPhoneNumbers.map((phone: any) => ({
      ...phone,
      assignedToThisPool: poolPhoneNumberIds.has(phone.id),
      assignedAt: mappingsByPhoneNumberId.get(phone.id)?.assignedAt || null,
    }));

    logger.debug('Fetched number pool phone numbers', {
      operation: 'fetch_number_pool_phone_numbers',
      partnerId: obfuscateId(partnerId),
      poolId: obfuscateId(poolId),
      totalPhoneNumbers: allPhoneNumbers.length,
      assignedToPool: poolMappings.length,
    });

    return NextResponse.json({
      success: true,
      data: {
        poolId,
        allPhoneNumbers: enrichedPhoneNumbers,
        assignedCount: poolMappings.length,
        totalCount: allPhoneNumbers.length,
      },
    });
  } catch (error) {
    logger.error('Error fetching number pool phone numbers', error as Error, {
      operation: 'fetch_number_pool_phone_numbers',
      poolId: params.poolId,
    });

    return NextResponse.json(
      { success: false, error: 'Failed to fetch phone numbers' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { poolId: string } }
) {
  try {
    const partnerAuth = await verifyPartnerJWT(req);
    if (!partnerAuth || !partnerAuth.isValid || !partnerAuth.payload?.partnerId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = partnerAuth.payload.partnerId;
    const { poolId } = params;
    const body = await req.json();
    const validation = phoneNumberMutationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { phoneNumberIds } = validation.data;
    const db = prisma as any;

    const pool = await db.numberPool.findFirst({
      where: {
        id: poolId,
        partnerId,
      },
      select: { id: true },
    });

    if (!pool) {
      return NextResponse.json(
        { success: false, error: 'Number pool not found' },
        { status: 404 }
      );
    }

    const ownedNumbers = await prisma.phoneNumber.findMany({
      where: {
        partnerId,
        id: { in: phoneNumberIds },
      },
      select: {
        id: true,
        phoneNumber: true,
      },
    });

    if (ownedNumbers.length !== phoneNumberIds.length) {
      return NextResponse.json(
        {
          success: false,
          error: 'One or more phone numbers are not accessible',
        },
        { status: 400 }
      );
    }

    await db.numberPoolPhoneNumber.createMany({
      data: phoneNumberIds.map((phoneNumberId) => ({
        numberPoolId: poolId,
        phoneNumberId,
        assignedBy: partnerId,
      })),
      skipDuplicates: true,
    });

    logger.info('Phone numbers added to number pool', {
      operation: 'add_phone_numbers_to_pool',
      partnerId: obfuscateId(partnerId),
      poolId: obfuscateId(poolId),
      phoneNumberCount: phoneNumberIds.length,
    });

    return NextResponse.json({
      success: true,
      message: 'Phone numbers added to pool',
      addedCount: phoneNumberIds.length,
    });
  } catch (error) {
    logger.error('Error adding phone numbers to pool', error as Error, {
      operation: 'add_phone_numbers_to_pool',
      poolId: params.poolId,
    });

    return NextResponse.json(
      { success: false, error: 'Failed to add phone numbers to pool' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { poolId: string } }
) {
  try {
    const partnerAuth = await verifyPartnerJWT(req);
    if (!partnerAuth || !partnerAuth.isValid || !partnerAuth.payload?.partnerId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = partnerAuth.payload.partnerId;
    const { poolId } = params;
    const body = await req.json();
    const validation = phoneNumberMutationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { phoneNumberIds } = validation.data;
    const db = prisma as any;

    const pool = await db.numberPool.findFirst({
      where: {
        id: poolId,
        partnerId,
      },
      select: { id: true },
    });

    if (!pool) {
      return NextResponse.json(
        { success: false, error: 'Number pool not found' },
        { status: 404 }
      );
    }

    const result = await db.numberPoolPhoneNumber.deleteMany({
      where: {
        numberPoolId: poolId,
        phoneNumberId: { in: phoneNumberIds },
      },
    });

    logger.info('Phone numbers removed from number pool', {
      operation: 'remove_phone_numbers_from_pool',
      partnerId: obfuscateId(partnerId),
      poolId: obfuscateId(poolId),
      removedCount: result.count,
    });

    return NextResponse.json({
      success: true,
      message: 'Phone numbers removed from pool',
      removedCount: result.count,
    });
  } catch (error) {
    logger.error('Error removing phone numbers from pool', error as Error, {
      operation: 'remove_phone_numbers_from_pool',
      poolId: params.poolId,
    });

    return NextResponse.json(
      { success: false, error: 'Failed to remove phone numbers from pool' },
      { status: 500 }
    );
  }
}
