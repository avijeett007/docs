import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { obfuscateId } from '@/lib/pii-obfuscation';

export const dynamic = 'force-dynamic';

const updateNumberPoolSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  campaignId: z.string().nullable().optional(),
});

function normalizePoolName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

function normalizeDescription(description?: string | null): string | null {
  if (!description) return null;
  const normalized = description.trim();
  return normalized.length > 0 ? normalized : null;
}

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
    });

    if (!pool) {
      return NextResponse.json(
        { success: false, error: 'Number pool not found' },
        { status: 404 }
      );
    }

    const formattedPool = {
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
    };

    logger.debug('Fetched number pool', {
      operation: 'fetch_number_pool',
      partnerId: obfuscateId(partnerId),
      poolId: obfuscateId(poolId),
      phoneNumberCount: formattedPool.phoneNumberCount,
    });

    return NextResponse.json({
      success: true,
      data: formattedPool,
    });
  } catch (error) {
    logger.error('Error fetching number pool', error as Error, {
      operation: 'fetch_number_pool',
      poolId: params.poolId,
    });

    return NextResponse.json(
      { success: false, error: 'Failed to fetch number pool' },
      { status: 500 }
    );
  }
}

export async function PATCH(
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
    const validation = updateNumberPoolSchema.safeParse(body);

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
    const db = prisma as any;

    const existingPool = await db.numberPool.findFirst({
      where: {
        id: poolId,
        partnerId,
      },
    });

    if (!existingPool) {
      return NextResponse.json(
        { success: false, error: 'Number pool not found' },
        { status: 404 }
      );
    }

    if (payload.campaignId !== undefined) {
      return NextResponse.json(
        {
          success: false,
          error: 'Campaign assignment is not enabled yet',
          code: 'CAMPAIGN_ASSIGNMENT_NOT_ENABLED',
        },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (payload.name !== undefined) {
      const normalizedName = normalizePoolName(payload.name);
      if (!normalizedName) {
        return NextResponse.json(
          { success: false, error: 'Pool name cannot be empty' },
          { status: 400 }
        );
      }

      const duplicate = await db.numberPool.findFirst({
        where: {
          partnerId,
          name: { equals: normalizedName, mode: 'insensitive' },
          id: { not: poolId },
        },
        select: { id: true },
      });

      if (duplicate) {
        return NextResponse.json(
          {
            success: false,
            error: 'A number pool with this name already exists',
          },
          { status: 409 }
        );
      }

      updateData.name = normalizedName;
    }

    if (payload.description !== undefined) {
      updateData.description = normalizeDescription(payload.description);
    }

    const updatedPool = await db.numberPool.update({
      where: { id: poolId },
      data: updateData,
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

    logger.info('Number pool updated', {
      operation: 'update_number_pool',
      partnerId: obfuscateId(partnerId),
      poolId: obfuscateId(poolId),
      updatedFields: Object.keys(updateData),
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updatedPool.id,
        name: updatedPool.name,
        description: updatedPool.description,
        campaignId: updatedPool.campaignId,
        createdAt: updatedPool.createdAt,
        updatedAt: updatedPool.updatedAt,
        phoneNumberCount: updatedPool.phoneNumbers.length,
        phoneNumbers: updatedPool.phoneNumbers.map((mapping: any) => ({
          id: mapping.phoneNumber.id,
          phoneNumber: mapping.phoneNumber.phoneNumber,
          friendlyName: mapping.phoneNumber.friendlyName,
          provider: mapping.phoneNumber.provider,
          status: mapping.phoneNumber.status,
          assignedAt: mapping.assignedAt,
        })),
      },
    });
  } catch (error) {
    logger.error('Error updating number pool', error as Error, {
      operation: 'update_number_pool',
      poolId: params.poolId,
    });

    return NextResponse.json(
      { success: false, error: 'Failed to update number pool' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { poolId: string } }
) {
  return PATCH(req, { params });
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

    const db = prisma as any;

    const existingPool = await db.numberPool.findFirst({
      where: {
        id: poolId,
        partnerId,
      },
      include: {
        phoneNumbers: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!existingPool) {
      return NextResponse.json(
        { success: false, error: 'Number pool not found' },
        { status: 404 }
      );
    }

    await prisma.$transaction(async (tx) => {
      if (existingPool.phoneNumbers.length > 0) {
        await (tx as any).numberPoolPhoneNumber.deleteMany({
          where: {
            numberPoolId: poolId,
          },
        });
      }

      await (tx as any).numberPool.delete({
        where: { id: poolId },
      });
    });

    logger.info('Number pool deleted', {
      operation: 'delete_number_pool',
      partnerId: obfuscateId(partnerId),
      poolId: obfuscateId(poolId),
      removedPhoneNumberMappings: existingPool.phoneNumbers.length,
    });

    return NextResponse.json({
      success: true,
      message: 'Number pool deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting number pool', error as Error, {
      operation: 'delete_number_pool',
      poolId: params.poolId,
    });

    return NextResponse.json(
      { success: false, error: 'Failed to delete number pool' },
      { status: 500 }
    );
  }
}
