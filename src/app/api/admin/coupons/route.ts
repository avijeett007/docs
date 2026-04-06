import { NextResponse, NextRequest } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';

// GET /api/admin/coupons - Fetch all coupons
export async function GET(_req: NextRequest) {
  try {
    const coupons = await prisma.coupon.findMany({
      include: {
        campaign: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            usages: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Transform the data to include usage count
    const transformedCoupons = coupons.map(coupon => ({
      ...coupon,
      usedCount: coupon._count.usages,
      _count: undefined
    }));

    return NextResponse.json({
      success: true,
      coupons: transformedCoupons
    });

  } catch (error) {
    console.error('Error fetching coupons:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch coupons' },
      { status: 500 }
    );
  }
}

// POST /api/admin/coupons - Create or update coupon
export async function POST(_req: NextRequest) {
  try {
    const body = await _req.json();
    
    const {
      id,
      code,
      name,
      description,
      type,
      discountType,
      discountValue,
      maxUses,
      isActive,
      validFrom,
      validUntil,
      campaignId,
      lifetimeOfferPrice,
      originalPrice,
      videoUrl,
      stripePriceId
    } = body;

    // Validate required fields
    if (!code || !name || !type || !validFrom || !validUntil) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate dates
    const fromDate = new Date(validFrom);
    const untilDate = new Date(validUntil);
    
    if (fromDate >= untilDate) {
      return NextResponse.json(
        { success: false, error: 'Valid from date must be before valid until date' },
        { status: 400 }
      );
    }

    // Check if coupon code already exists (for new coupons or when changing code)
    if (!id || (id && code)) {
      const existingCoupon = await prisma.coupon.findUnique({
        where: { code },
        select: { id: true }
      });

      if (existingCoupon && existingCoupon.id !== id) {
        return NextResponse.json(
          { success: false, error: 'Coupon code already exists' },
          { status: 409 }
        );
      }
    }

    const couponData = {
      code: code.toUpperCase(),
      name,
      description: description || null,
      type,
      discountType: discountType || null,
      discountValue: discountValue ? parseFloat(discountValue.toString()) : null,
      maxUses: maxUses ? parseInt(maxUses.toString()) : null,
      isActive: Boolean(isActive),
      validFrom: new Date(validFrom),
      validUntil: new Date(validUntil),
      campaignId: campaignId || null,
      lifetimeOfferPrice: lifetimeOfferPrice ? parseFloat(lifetimeOfferPrice.toString()) : null,
      originalPrice: originalPrice ? parseFloat(originalPrice.toString()) : null,
      videoUrl: videoUrl || null,
      stripePriceId: stripePriceId || null,
      metadata: {}
    };

    let coupon;
    
    if (id) {
      // Update existing coupon
      coupon = await prisma.coupon.update({
        where: { id },
        data: couponData,
        include: {
          campaign: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });
    } else {
      // Create new coupon
      coupon = await prisma.coupon.create({
        data: couponData,
        include: {
          campaign: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: `Coupon ${id ? 'updated' : 'created'} successfully`,
      coupon
    });

  } catch (error) {
    console.error('Error saving coupon:', error);
    
    // Handle unique constraint violations
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { success: false, error: 'Coupon code already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to save coupon' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/coupons - Delete coupon
export async function DELETE(_req: NextRequest) {
  try {
    const { searchParams } = new URL(_req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Coupon ID is required' },
        { status: 400 }
      );
    }

    // Check if coupon exists
    const existingCoupon = await prisma.coupon.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            usages: true
          }
        }
      }
    });

    if (!existingCoupon) {
      return NextResponse.json(
        { success: false, error: 'Coupon not found' },
        { status: 404 }
      );
    }

    // Check if coupon has been used
    if (existingCoupon._count.usages > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete coupon that has been used' },
        { status: 400 }
      );
    }

    // Delete the coupon
    await prisma.coupon.delete({
      where: { id }
    });

    return NextResponse.json({
      success: true,
      message: 'Coupon deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting coupon:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete coupon' },
      { status: 500 }
    );
  }
}
