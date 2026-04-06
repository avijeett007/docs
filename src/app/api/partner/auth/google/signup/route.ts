import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { signJWT } from '@/lib/jwt';
import { generatePartnerCode } from '@/lib/server-utils';
import { getRewardfulService } from '@/lib/rewardful';
import { validatePhoneNumber } from '@/lib/utils/phoneValidation';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

// Helper function to check if phone is verified
async function isPhoneVerified(phoneNumber: string): Promise<{ verified: boolean; channel?: string; verifiedAt?: Date }> {
  // Format phone number - ensure it has + prefix
  let formattedPhone = phoneNumber.replace(/[^\d+]/g, '');
  if (!formattedPhone.startsWith('+')) {
    formattedPhone = '+' + formattedPhone;
  }

  const verification = await prisma.phoneVerification.findFirst({
    where: {
      phoneNumber: formattedPhone,
      status: 'approved',
    },
    orderBy: { verifiedAt: 'desc' },
  });

  return {
    verified: !!verification,
    channel: verification?.channel,
    verifiedAt: verification?.verifiedAt || undefined,
  };
}

interface GoogleSignupRequest {
  googleUserData: string; // Base64 encoded Google user data
  businessName: string;
  phoneNumber: string;
  couponCode?: string;
  validatedCoupon?: {
    id: string;
    code: string;
    name: string;
    type: string;
    lifetimeOfferPrice?: number;
    originalPrice?: number;
  };
  showLifetimeOffer?: boolean;
  preSelectedPlan?: {
    planId: string;
    billingInterval: 'monthly' | 'yearly';
    planName: string;
    price: number;
  };
}

/**
 * POST /api/partner/auth/google/signup - Complete Google signup with additional info
 * Creates partner account after Google OAuth with business details
 */
export async function POST(request: NextRequest) {
  try {
    // Check if Google auth is enabled
    const isGoogleAuthEnabled = process.env.NEXT_PUBLIC_FEATURE_GOOGLE_AUTH === 'true';
    if (!isGoogleAuthEnabled) {
      return NextResponse.json(
        { error: 'Google authentication is not enabled' },
        { status: 403 }
      );
    }

    const body: GoogleSignupRequest = await request.json();
    const {
      googleUserData,
      businessName,
      phoneNumber,
      validatedCoupon,
      showLifetimeOffer,
      preSelectedPlan
    } = body;

    // Decode and validate Google user data
    let googleUser;
    try {
      const decodedData = Buffer.from(googleUserData, 'base64').toString();
      googleUser = JSON.parse(decodedData);

      // Validate timestamp (data should be recent, within 10 minutes)
      const now = Date.now();
      if (!googleUser.timestamp || (now - googleUser.timestamp) > 10 * 60 * 1000) {
        throw new Error('Google authentication data has expired');
      }
    } catch (err) {
      return NextResponse.json(
        { error: 'Invalid Google authentication data' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!googleUser.email?.trim()) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    if (!googleUser.name?.trim()) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    if (!googleUser.id?.trim()) {
      return NextResponse.json(
        { error: 'Google ID is required' },
        { status: 400 }
      );
    }

    if (!businessName?.trim()) {
      return NextResponse.json(
        { error: 'Business Name is required' },
        { status: 400 }
      );
    }

    if (!phoneNumber?.trim()) {
      return NextResponse.json(
        { error: 'Phone Number is required' },
        { status: 400 }
      );
    }

    // Phone number format validation using libphonenumber-js (supports all countries)
    const phoneValidation = validatePhoneNumber(phoneNumber);
    if (!phoneValidation.isValid) {
      return NextResponse.json(
        { error: phoneValidation.error || 'Please enter a valid phone number' },
        { status: 400 }
      );
    }

    // Email validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(googleUser.email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    // Phone verification check - only when feature is enabled
    // Use server-side env var (FEATURE_PHONE_VERIFICATION) for backend routes
    const isPhoneVerificationEnabled = process.env.FEATURE_PHONE_VERIFICATION === 'true';
    let phoneVerification: { verified: boolean; channel?: string; verifiedAt?: Date } = { verified: false };

    if (isPhoneVerificationEnabled) {
      phoneVerification = await isPhoneVerified(phoneNumber);
      if (!phoneVerification.verified) {
        return NextResponse.json(
          { error: 'Phone number must be verified before registration' },
          { status: 400 }
        );
      }
    }

    // Check if partner already exists with this email
    const existingPartner = await prisma.partner.findUnique({
      where: { emailAddress: googleUser.email }
    });

    if (existingPartner) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 400 }
      );
    }

    // Check if Google ID is already used
    const existingGooglePartner = await prisma.partner.findUnique({
      where: { googleId: googleUser.id }
    });

    if (existingGooglePartner) {
      return NextResponse.json(
        { error: 'This Google account is already linked to another partner account' },
        { status: 400 }
      );
    }

    // Generate a unique partner code
    const partnerCode = await generatePartnerCode();

    // Create the partner record
    const partner = await prisma.partner.create({
      data: {
        businessName: businessName.trim(),
        contactName: googleUser.name.trim(),
        businessAddress: 'To be provided', // Placeholder
        emailAddress: googleUser.email.trim().toLowerCase(),
        phoneNumber: phoneNumber.trim(),
        areaOfBusiness: 'To be provided', // Placeholder
        expertise: 'To be provided', // Placeholder
        learningSource: 'Google OAuth', // Track signup source
        partnershipType: 'Business', // Default value
        partnerCode,
        approvalStatus: 'PENDING', // Will be set to ACTIVE after payment completion
        country: 'To be provided', // Placeholder
        googleId: googleUser.id.trim(),
        hasChangedPassword: true, // Google auth users don't need password change
        // Store phone verification info (only when feature is enabled)
        ...(isPhoneVerificationEnabled && {
          phoneVerified: true,
          phoneVerifiedAt: phoneVerification.verifiedAt || new Date(),
          phoneVerificationChannel: phoneVerification.channel || 'whatsapp',
        }),
        // Store pre-selected plan info if provided
        ...(preSelectedPlan && {
          planId: preSelectedPlan.planId,
          billingInterval: preSelectedPlan.billingInterval,
        }),
      },
    });

    // Create affiliate silently for new partner (fire and forget)
    Promise.resolve().then(async () => {
      try {
        const rewardfulService = getRewardfulService();

        // Create affiliate in Rewardful with INACTIVE status initially
        const affiliateData = {
          email: googleUser.email.trim().toLowerCase(),
          first_name: googleUser.name.trim().split(' ')[0] || googleUser.name.trim(),
          last_name: googleUser.name.trim().split(' ').slice(1).join(' ') || '',
          company: businessName.trim(),
          status: 'inactive' as const, // Start as inactive until they become paid users
        };

        const rewardfulAffiliate = await rewardfulService.createAffiliate(affiliateData);

        if (rewardfulAffiliate) {
          // Update partner with Rewardful affiliate data
          await prisma.partner.update({
            where: { id: partner.id },
            data: {
              rewardfulAffiliateId: rewardfulAffiliate.id,
              rewardfulToken: rewardfulAffiliate.token,
              affiliateStatus: 'INACTIVE',
              affiliateCommissionRate: 10.0, // Default 10% commission
              affiliateTotalConversions: 0,
              affiliateTotalCommissionEarned: 0,
            },
          });

          console.log(`Created affiliate for partner ${partner.id} with Rewardful ID: ${rewardfulAffiliate.id}`);
        }
      } catch (error) {
        console.error('Error creating affiliate for partner:', partner.id, error);
        // Don't fail the partner creation if affiliate creation fails
      }
    });

    // Generate JWT token
    const jwtPayload = {
      partnerId: partner.id,
      email: partner.emailAddress,
      hasChangedPassword: true,
    };

    const token = await signJWT(jwtPayload);

    // Set cookie with JWT token
    cookies().set('partner_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    // If there's a pre-selected plan, handle payment flow
    if (preSelectedPlan) {
      try {
        // Call the complete endpoint to set up payment
        const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const completeUrl = `${baseUrl}/api/partners/complete`;

        const completeResponse = await fetch(completeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            partnerId: partner.id,
            planId: preSelectedPlan.planId,
            billingInterval: preSelectedPlan.billingInterval,
            isQuickSignup: true,
            isLifetimeOffer: showLifetimeOffer || false,
          }),
        });

        if (completeResponse.ok) {
          const completeData = await completeResponse.json();
          if (completeData.success && completeData.url) {
            return NextResponse.json({
              success: true,
              message: 'Account created successfully',
              redirectUrl: completeData.url,
              data: {
                partnerId: partner.id,
                businessName: partner.businessName,
                emailAddress: partner.emailAddress,
              }
            });
          }
        }
      } catch (error) {
        console.error('Failed to create payment session:', error);
      }

      // If payment setup fails, redirect to partners page
      return NextResponse.json({
        success: true,
        message: 'Account created successfully',
        redirectUrl: `/partners?partnerId=${partner.id}&step=payment`,
        data: {
          partnerId: partner.id,
          businessName: partner.businessName,
          emailAddress: partner.emailAddress,
        }
      });
    }

    // No pre-selected plan, redirect to pricing
    return NextResponse.json({
      success: true,
      message: 'Account created successfully',
      redirectUrl: `/partners?partnerId=${partner.id}&step=pricing`,
      data: {
        partnerId: partner.id,
        businessName: partner.businessName,
        emailAddress: partner.emailAddress,
      }
    });

  } catch (error) {
    console.error('Error in Google signup:', error);
    return NextResponse.json(
      { error: 'Failed to create account. Please try again.' },
      { status: 500 }
    );
  }
}
