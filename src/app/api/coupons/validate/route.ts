import { NextResponse, NextRequest } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';

interface CouponValidationResponse {
  valid: boolean;
  coupon?: {
    id: string;
    code: string;
    name: string;
    description?: string;
    type: string;
    discountType?: string;
    discountValue?: number;
    lifetimeOfferPrice?: number;
    originalPrice?: number;
    validUntil: string;
  };
  error?: string;
  eligibleForLifetimeOffer?: boolean;
}

// POST /api/coupons/validate - Validate coupon code
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, partnerId } = body;

    if (!code) {
      return NextResponse.json<CouponValidationResponse>({
        valid: false,
        error: 'Coupon code is required'
      }, { status: 400 });
    }

    // Find the coupon
    const coupon = await prisma.coupon.findUnique({
      where: { 
        code: code.toUpperCase() 
      },
      include: {
        usages: partnerId ? {
          where: {
            partnerId: partnerId
          }
        } : false,
        _count: {
          select: {
            usages: true
          }
        }
      }
    });

    if (!coupon) {
      return NextResponse.json<CouponValidationResponse>({
        valid: false,
        error: 'Invalid coupon code'
      });
    }

    // Check if coupon is active
    if (!coupon.isActive) {
      return NextResponse.json<CouponValidationResponse>({
        valid: false,
        error: 'This coupon is no longer active'
      });
    }

    // Check date validity
    const now = new Date();
    const validFrom = new Date(coupon.validFrom);
    const validUntil = new Date(coupon.validUntil);

    if (now < validFrom) {
      return NextResponse.json<CouponValidationResponse>({
        valid: false,
        error: 'This coupon is not yet valid'
      });
    }

    if (now > validUntil) {
      return NextResponse.json<CouponValidationResponse>({
        valid: false,
        error: 'This coupon has expired'
      });
    }

    // Check usage limits
    if (coupon.maxUses && coupon._count.usages >= coupon.maxUses) {
      return NextResponse.json<CouponValidationResponse>({
        valid: false,
        error: 'This coupon has reached its usage limit'
      });
    }

    // Check if partner has already used this coupon
    if (partnerId && Array.isArray(coupon.usages) && coupon.usages.length > 0) {
      return NextResponse.json<CouponValidationResponse>({
        valid: false,
        error: 'You have already used this coupon'
      });
    }

    // Determine if eligible for lifetime offer
    const eligibleForLifetimeOffer = coupon.type === 'lifetime_offer' &&
                                   coupon.lifetimeOfferPrice &&
                                   Number(coupon.lifetimeOfferPrice) > 0;

    // Return valid coupon
    return NextResponse.json<CouponValidationResponse>({
      valid: true,
      eligibleForLifetimeOffer: eligibleForLifetimeOffer || undefined,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        name: coupon.name,
        description: coupon.description || undefined,
        type: coupon.type,
        discountType: coupon.discountType || undefined,
        discountValue: coupon.discountValue ? Number(coupon.discountValue) : undefined,
        lifetimeOfferPrice: coupon.lifetimeOfferPrice ? Number(coupon.lifetimeOfferPrice) : undefined,
        originalPrice: coupon.originalPrice ? Number(coupon.originalPrice) : undefined,
        validUntil: coupon.validUntil.toISOString()
      }
    });

  } catch (error) {
    console.error('Error validating coupon:', error);
    return NextResponse.json<CouponValidationResponse>({
      valid: false,
      error: 'Failed to validate coupon'
    }, { status: 500 });
  }
}

// GET /api/coupons/validate - Validate coupon code via query params (for quick checks)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const partnerId = searchParams.get('partnerId');

    if (!code) {
      return NextResponse.json<CouponValidationResponse>({
        valid: false,
        error: 'Coupon code is required'
      }, { status: 400 });
    }

    // Use the same validation logic as POST
    const postRequest = new Request(req.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code, partnerId })
    });

    return POST(postRequest as NextRequest);

  } catch (error) {
    console.error('Error validating coupon:', error);
    return NextResponse.json<CouponValidationResponse>({
      valid: false,
      error: 'Failed to validate coupon'
    }, { status: 500 });
  }
}
