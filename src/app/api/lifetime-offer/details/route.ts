import { NextResponse, NextRequest } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';

// GET /api/lifetime-offer/details - Get lifetime offer details
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const partnerId = searchParams.get('partnerId');
    const couponId = searchParams.get('couponId');

    if (!partnerId || !couponId) {
      return NextResponse.json(
        { success: false, error: 'Partner ID and Coupon ID are required' },
        { status: 400 }
      );
    }

    // Fetch partner details
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        id: true,
        businessName: true,
        emailAddress: true,
        approvalStatus: true
      }
    });

    if (!partner) {
      return NextResponse.json(
        { success: false, error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Fetch coupon details
    const coupon = await prisma.coupon.findUnique({
      where: { id: couponId },
      include: {
        usages: {
          where: {
            partnerId: partnerId
          }
        }
      }
    });

    if (!coupon) {
      return NextResponse.json(
        { success: false, error: 'Coupon not found' },
        { status: 404 }
      );
    }

    // Validate coupon
    if (!coupon.isActive) {
      return NextResponse.json(
        { success: false, error: 'This coupon is no longer active' },
        { status: 400 }
      );
    }

    if (coupon.type !== 'lifetime_offer') {
      return NextResponse.json(
        { success: false, error: 'This coupon is not valid for lifetime offers' },
        { status: 400 }
      );
    }

    // Check if coupon is still valid
    const now = new Date();
    if (now > new Date(coupon.validUntil)) {
      return NextResponse.json(
        { success: false, error: 'This coupon has expired' },
        { status: 400 }
      );
    }

    // Check if partner has already used this coupon
    if (coupon.usages.length > 0) {
      return NextResponse.json(
        { success: false, error: 'You have already used this coupon' },
        { status: 400 }
      );
    }

    // Check usage limits and calculate remaining with FOMO logic
    let remainingUses = null;
    let actualRemaining = null;

    if (coupon.maxUses) {
      const totalUsages = await prisma.couponUsage.count({
        where: { couponId: coupon.id }
      });

      actualRemaining = coupon.maxUses - totalUsages;

      if (actualRemaining <= 0) {
        return NextResponse.json(
          { success: false, error: 'This coupon has reached its usage limit' },
          { status: 400 }
        );
      }

      // FOMO Logic: Show "1 remaining" until actually 1 left
      if (actualRemaining === 1) {
        remainingUses = 1;
      } else if (actualRemaining > 1) {
        remainingUses = 1; // Always show 1 remaining for FOMO effect
      }
    }

    // Validate lifetime offer pricing
    if (!coupon.lifetimeOfferPrice || Number(coupon.lifetimeOfferPrice) <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid lifetime offer pricing' },
        { status: 400 }
      );
    }

    // Return offer details
    return NextResponse.json({
      success: true,
      partner: {
        id: partner.id,
        businessName: partner.businessName,
        emailAddress: partner.emailAddress
      },
      coupon: {
        id: coupon.id,
        code: coupon.code,
        name: coupon.name,
        description: coupon.description,
        lifetimeOfferPrice: Number(coupon.lifetimeOfferPrice),
        originalPrice: Number(coupon.originalPrice || 2997), // Default original price
        validUntil: coupon.validUntil.toISOString(),
        remainingUses: remainingUses,
        hasUsageLimit: coupon.maxUses !== null,
        videoUrl: coupon.videoUrl,
        stripePriceId: coupon.stripePriceId
      }
    });

  } catch (error) {
    console.error('Error fetching lifetime offer details:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch offer details' },
      { status: 500 }
    );
  }
}
