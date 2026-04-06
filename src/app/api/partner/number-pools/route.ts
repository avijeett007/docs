import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { obfuscateId, obfuscatePhoneNumber } from '@/lib/pii-obfuscation';
import { TierValidationService } from '@/lib/services/tierValidationService';

export const dynamic = 'force-dynamic';

const createNumberPoolSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  campaignId: z.string().nullable().optional(),
  phoneNumberIds: z.array(z.string().uuid()).optional().default([]),
});

function normalizePoolName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

function normalizeDescription(description?: string | null): string | null {
  if (!description) return null;
  const normalized = description.trim();
  return normalized.length > 0 ? normalized : null;
}

export async function GET(req: NextRequest) {
  try {
    const partnerAuth = await verifyPartnerJWT(req);
    if (!partnerAuth || !partnerAuth.isValid || !partnerAuth.payload?.partnerId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = partnerAuth.payload.partnerId;
    const db = prisma as any;

    const [pools, limitInfo] = await Promise.all([
      db.numberPool.findMany({
        where: { partnerId },
        include: {
          phoneNumbers: {
            include: {
              phoneNumber: {
                select: {
                  id: true,
                  phoneNumber: true,
                  friendlyName: true,
                  provider: true,
                  status: true,
                  customerId: true,
                },
              },
            },
            orderBy: { assignedAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      TierValidationService.validateNumberPoolCreation(partnerId),
    ]);

    const formattedPools = pools.map((pool: any) => ({
      id: pool.id,
      name: pool.name,
      description: pool.description,
      campaignId: pool.campaignId,
      createdAt: pool.createdAt,
      updatedAt: pool.updatedAt,
      phoneNumberCount: pool.phoneNumbers.length,
      phoneNumbers: pool.phoneNumbers.map((mapping: any) => ({
        id: mapping.phoneNumber.id,
        phoneNumber: mapping.phoneNumber.phoneNumber,
        friendlyName: mapping.phoneNumber.friendlyName,
        provider: mapping.phoneNumber.provider,
        status: mapping.phoneNumber.status,
        assignedAt: mapping.assignedAt,
      })),
    }));

    logger.debug('Fetched number pools', {
      operation: 'fetch_number_pools',
      partnerId: obfuscateId(partnerId),
      poolCount: formattedPools.length,
      numberPoolLimit: limitInfo.limit,
      numberPoolRemaining: limitInfo.remaining,
    });

    return NextResponse.json({
      success: true,
      data: {
        pools: formattedPools,
        limitInfo,
      },
    });
  } catch (error) {
    logger.error('Error fetching number pools', error as Error, {
      operation: 'fetch_number_pools',
    });

    return NextResponse.json(
      { success: false, error: 'Failed to fetch number pools' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const partnerAuth = await verifyPartnerJWT(req);
    if (!partnerAuth || !partnerAuth.isValid || !partnerAuth.payload?.partnerId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = partnerAuth.payload.partnerId;
    const body = await req.json();
    const validation = createNumberPoolSchema.safeParse(body);

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

    const payload = validation.data;
    const normalizedName = normalizePoolName(payload.name);

    if (!normalizedName) {
      return NextResponse.json(
        { success: false, error: 'Pool name is required' },
        { status: 400 }
      );
    }

    if (payload.campaignId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Campaign assignment is not enabled yet',
          code: 'CAMPAIGN_ASSIGNMENT_NOT_ENABLED',
        },
        { status: 400 }
      );
    }

    const limitInfo = await TierValidationService.validateNumberPoolCreation(partnerId);
    if (!limitInfo.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: limitInfo.message || 'Number pool limit reached',
          code: 'NUMBER_POOL_LIMIT_REACHED',
          validation: limitInfo,
        },
        { status: 403 }
      );
    }

    const db = prisma as any;

    const result = await prisma.$transaction(async (tx) => {
      const duplicate = await (tx as any).numberPool.findFirst({
        where: {
          partnerId,
          name: { equals: normalizedName, mode: 'insensitive' },
        },
        select: { id: true },
      });

      if (duplicate) {
        throw new Error('DUPLICATE_POOL_NAME');
      }

      const phoneNumberIds = payload.phoneNumberIds || [];
      if (phoneNumberIds.length > 0) {
        const ownedNumbers = await tx.phoneNumber.findMany({
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
          throw new Error('PHONE_NUMBER_ACCESS_DENIED');
        }
      }

      const createdPool = await (tx as any).numberPool.create({
        data: {
          partnerId,
          name: normalizedName,
          description: normalizeDescription(payload.description),
          campaignId: null,
        },
      });

      if (phoneNumberIds.length > 0) {
        await (tx as any).numberPoolPhoneNumber.createMany({
          data: phoneNumberIds.map((phoneNumberId) => ({
            numberPoolId: createdPool.id,
            phoneNumberId,
            assignedBy: partnerId,
          })),
          skipDuplicates: true,
        });
      }

      return createdPool;
    });

    const createdPoolWithNumbers = await db.numberPool.findUnique({
      where: { id: result.id },
      include: {
        phoneNumbers: {
          include: {
            phoneNumber: {
              select: {
                id: true,
                phoneNumber: true,
                friendlyName: true,
                provider: true,
                status: true,
              },
            },
          },
          orderBy: { assignedAt: 'desc' },
        },
      },
    });

    logger.info('Number pool created', {
      operation: 'create_number_pool',
      partnerId: obfuscateId(partnerId),
      poolId: obfuscateId(result.id),
      poolName: normalizedName,
      assignedPhoneNumbers: createdPoolWithNumbers?.phoneNumbers?.length || 0,
      assignedSample: (createdPoolWithNumbers?.phoneNumbers || []).slice(0, 3).map((item: any) =>
        obfuscatePhoneNumber(item.phoneNumber.phoneNumber)
      ),
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: createdPoolWithNumbers.id,
          name: createdPoolWithNumbers.name,
          description: createdPoolWithNumbers.description,
          campaignId: createdPoolWithNumbers.campaignId,
          createdAt: createdPoolWithNumbers.createdAt,
          updatedAt: createdPoolWithNumbers.updatedAt,
          phoneNumberCount: createdPoolWithNumbers.phoneNumbers.length,
          phoneNumbers: createdPoolWithNumbers.phoneNumbers.map((mapping: any) => ({
            id: mapping.phoneNumber.id,
            phoneNumber: mapping.phoneNumber.phoneNumber,
            friendlyName: mapping.phoneNumber.friendlyName,
            provider: mapping.phoneNumber.provider,
            status: mapping.phoneNumber.status,
            assignedAt: mapping.assignedAt,
          })),
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error?.message === 'DUPLICATE_POOL_NAME') {
      return NextResponse.json(
        {
          success: false,
          error: 'A number pool with this name already exists',
        },
        { status: 409 }
      );
    }

    if (error?.message === 'PHONE_NUMBER_ACCESS_DENIED') {
      return NextResponse.json(
        {
          success: false,
          error: 'One or more selected phone numbers are not accessible',
        },
        { status: 400 }
      );
    }

    logger.error('Error creating number pool', error as Error, {
      operation: 'create_number_pool',
    });

    return NextResponse.json(
      { success: false, error: 'Failed to create number pool' },
      { status: 500 }
    );
  }
}
