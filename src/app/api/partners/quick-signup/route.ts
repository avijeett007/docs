import { NextResponse, NextRequest } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { generatePartnerCode } from '@/lib/server-utils';
import { getRewardfulService } from '@/lib/rewardful';
import { affiliateCommissionHandler } from '@/lib/affiliate-commission-handler';
import { validatePhoneNumber } from '@/lib/utils/phoneValidation';

// Helper function to check if phone is verified
async function isPhoneVerified(phoneNumber: string): Promise<boolean> {
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

  return !!verification;
}

// Helper function to call the complete endpoint with retry logic
async function callCompleteEndpoint(partnerId: string, planId: string, billingInterval: string, maxRetries = 2) {
  // Use INTERNAL_API_URL for server-to-server calls to prevent redirect loops
  const baseUrl = process.env.INTERNAL_API_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const completeUrl = `${baseUrl}/api/partners/complete`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Calling complete endpoint (attempt ${attempt}/${maxRetries}):`, {
        partnerId,
        url: completeUrl,
        planId,
        billingInterval
      });

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const completeResponse = await fetch(completeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partnerId,
          planId,
          billingInterval,
          isQuickSignup: true
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const completeData = await completeResponse.json();

      console.log(`📨 Complete endpoint response (attempt ${attempt}):`, {
        ok: completeResponse.ok,
        status: completeResponse.status,
        hasUrl: !!completeData.url,
        error: completeData.error
      });

      if (completeResponse.ok && completeData.url) {
        return { success: true, url: completeData.url };
      } else {
        console.error(`❌ Complete endpoint failed (attempt ${attempt}):`, {
          status: completeResponse.status,
          error: completeData.error,
          partnerId
        });

        // If this is the last attempt, return the error
        if (attempt === maxRetries) {
          return { success: false, error: completeData.error || 'Failed to create payment session' };
        }

        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    } catch (error) {
      // Type-safe error handling
      const isAbortError = error instanceof Error && error.name === 'AbortError';
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      console.error(`❌ Error calling complete endpoint (attempt ${attempt}):`, {
        error: errorMessage,
        partnerId,
        isAbortError
      });

      // If this is the last attempt, return the error
      if (attempt === maxRetries) {
        return { success: false, error: errorMessage || 'Failed to create payment session' };
      }

      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }

  return { success: false, error: 'Max retries exceeded' };
}

interface QuickSignupRequest {
  businessName: string;
  emailAddress: string;
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
  referralId?: string; // Referral ID from client-side tracking
}

// POST /api/partners/quick-signup - Create a simplified partner record
export async function POST(req: NextRequest) {
  console.log('🚀 Quick signup API called');
  let emailAddress = '';
  let preSelectedPlan: QuickSignupRequest['preSelectedPlan'];

  try {
    const body: QuickSignupRequest = await req.json();
    console.log('📝 Request body received:', JSON.stringify(body, null, 2));

    const { businessName, phoneNumber, validatedCoupon, showLifetimeOffer } = body;
    emailAddress = body.emailAddress;
    preSelectedPlan = body.preSelectedPlan;

    // Debug logging
    console.log('Quick signup request:', {
      showLifetimeOffer,
      validatedCoupon: validatedCoupon ? { id: validatedCoupon.id, type: validatedCoupon.type } : null,
      preSelectedPlan: preSelectedPlan ? { planId: preSelectedPlan.planId } : null
    });

    // Validate required fields
    if (!businessName?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Business Name is required' },
        { status: 400 }
      );
    }

    if (!emailAddress?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Email Address is required' },
        { status: 400 }
      );
    }

    if (!phoneNumber?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Phone Number is required' },
        { status: 400 }
      );
    }

    // Phone number format validation using libphonenumber-js (supports all countries)
    const phoneValidation = validatePhoneNumber(phoneNumber);
    if (!phoneValidation.isValid) {
      return NextResponse.json(
        { success: false, error: phoneValidation.error || 'Please enter a valid phone number' },
        { status: 400 }
      );
    }

    // Email validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(emailAddress)) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    // Phone verification check - only when feature is enabled
    // Use server-side env var (FEATURE_PHONE_VERIFICATION) for backend routes
    const isPhoneVerificationEnabled = process.env.FEATURE_PHONE_VERIFICATION === 'true';
    let phoneVerified = false;

    if (isPhoneVerificationEnabled) {
      phoneVerified = await isPhoneVerified(phoneNumber);
      if (!phoneVerified) {
        return NextResponse.json(
          { success: false, error: 'Phone number must be verified before registration' },
          { status: 400 }
        );
      }
    }

    // Check if partner already exists
    const existingPartner = await prisma.partner.findUnique({
      where: { emailAddress }
    });

    if (existingPartner) {
      // If partner exists and is in PENDING status, allow them to continue
      if (existingPartner.approvalStatus === 'PENDING') {
        // Get phone verification details
        let formattedPhoneForUpdate = phoneNumber.replace(/[^\d+]/g, '');
        if (!formattedPhoneForUpdate.startsWith('+')) {
          formattedPhoneForUpdate = '+' + formattedPhoneForUpdate;
        }
        const existingVerification = await prisma.phoneVerification.findFirst({
          where: {
            phoneNumber: formattedPhoneForUpdate,
            status: 'approved',
          },
          orderBy: { verifiedAt: 'desc' },
        });

        // Update the existing partner with new information if provided
        const updatedPartner = await prisma.partner.update({
          where: { id: existingPartner.id },
          data: {
            businessName: businessName.trim(),
            contactName: businessName.trim(), // Use business name as placeholder
            phoneNumber: phoneNumber.trim(),
            // Update phone verification info (only when feature is enabled)
            ...(isPhoneVerificationEnabled && {
              phoneVerified: true,
              phoneVerifiedAt: existingVerification?.verifiedAt || new Date(),
              phoneVerificationChannel: existingVerification?.channel || 'whatsapp',
            }),
            // Store pre-selected plan info if provided
            ...(preSelectedPlan && {
              planId: preSelectedPlan.planId,
              billingInterval: preSelectedPlan.billingInterval
            })
          },
        });

        // Continue with the existing partner ID
        const partnerId = existingPartner.id;

        // If there's a lifetime offer coupon, redirect to lifetime offer checkout
        if (showLifetimeOffer && validatedCoupon) {
          console.log('✅ Existing partner - Redirecting to lifetime offer:', {
            partnerId: partnerId,
            couponId: validatedCoupon.id,
            redirectUrl: `/lifetime-offer?partnerId=${partnerId}&couponId=${validatedCoupon.id}`
          });

          return NextResponse.json({
            success: true,
            message: 'Account updated successfully',
            redirectUrl: `/lifetime-offer?partnerId=${partnerId}&couponId=${validatedCoupon.id}`,
            data: {
              partnerId: partnerId,
              businessName: updatedPartner.businessName,
              emailAddress: updatedPartner.emailAddress,
            }
          });
        }

        // If there's a pre-selected plan, redirect to payment
        if (preSelectedPlan) {
          const completeResult = await callCompleteEndpoint(
            partnerId,
            preSelectedPlan.planId,
            preSelectedPlan.billingInterval
          );

          if (completeResult.success && completeResult.url) {
            return NextResponse.json({
              success: true,
              message: 'Account updated successfully',
              redirectUrl: completeResult.url,
              data: {
                partnerId: partnerId,
                businessName: updatedPartner.businessName,
                emailAddress: updatedPartner.emailAddress,
              }
            });
          } else {
            // If payment setup fails, still return success but redirect to partners page
            console.error('❌ Failed to create payment session for existing partner after retries:', {
              error: completeResult.error,
              partnerId
            });
            return NextResponse.json({
              success: true,
              message: 'Account updated successfully',
              redirectUrl: `/partners?partnerId=${partnerId}&step=payment`,
              data: {
                partnerId: partnerId,
                businessName: updatedPartner.businessName,
                emailAddress: updatedPartner.emailAddress,
              }
            });
          }
        } else {
          // No pre-selected plan, redirect to pricing selection
          return NextResponse.json({
            success: true,
            message: 'Account updated successfully',
            redirectUrl: `/partners?partnerId=${partnerId}&step=pricing`,
            data: {
              partnerId: partnerId,
              businessName: updatedPartner.businessName,
              emailAddress: updatedPartner.emailAddress,
            }
          });
        }
      } else {
        // Partner exists and is ACTIVE/APPROVED - don't reveal this information
        // Return a generic error to prevent email enumeration attacks
        return NextResponse.json(
          { success: false, error: 'Unable to create account. Please try again or contact support.' },
          { status: 400 }
        );
      }
    }

    // Generate a unique partner code
    const partnerCode = await generatePartnerCode();

    // Get phone verification details for the partner record
    let formattedPhone = phoneNumber.replace(/[^\d+]/g, '');
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    }
    const phoneVerificationRecord = await prisma.phoneVerification.findFirst({
      where: {
        phoneNumber: formattedPhone,
        status: 'approved',
      },
      orderBy: { verifiedAt: 'desc' },
    });

    // Create the partner record with minimal data
    // Use placeholder values for required fields that will be collected later
    const partner = await prisma.partner.create({
      data: {
        businessName: businessName.trim(),
        contactName: businessName.trim(), // Use business name as placeholder
        businessAddress: 'To be provided', // Placeholder
        emailAddress: emailAddress.trim().toLowerCase(),
        phoneNumber: phoneNumber.trim(),
        areaOfBusiness: 'To be provided', // Placeholder
        expertise: 'To be provided', // Placeholder
        learningSource: 'Website', // Default value
        partnershipType: 'Business', // Default value
        partnerCode,
        approvalStatus: 'PENDING',
        country: 'To be provided', // Placeholder
        // Store phone verification info (only when feature is enabled)
        ...(isPhoneVerificationEnabled && {
          phoneVerified: true,
          phoneVerifiedAt: phoneVerificationRecord?.verifiedAt || new Date(),
          phoneVerificationChannel: phoneVerificationRecord?.channel || 'whatsapp',
        }),
        // Store pre-selected plan info if provided
        ...(preSelectedPlan && {
          planId: preSelectedPlan.planId,
          billingInterval: preSelectedPlan.billingInterval
        })
      },
    });

    // Handle referral attribution and affiliate creation (fire and forget)
    Promise.resolve().then(async () => {
      try {
        // Check for referral attribution first
        const referralId = body.referralId;
        if (referralId) {
          // Store referral attribution for Free Forever users
          await affiliateCommissionHandler.trackReferralAttribution(partner.id, referralId);
        }

        // Create affiliate in Rewardful with INACTIVE status initially
        const rewardfulService = getRewardfulService();
        const affiliateData = {
          email: emailAddress.trim().toLowerCase(),
          first_name: businessName.trim().split(' ')[0] || businessName.trim(),
          last_name: businessName.trim().split(' ').slice(1).join(' ') || '',
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

    // If there's a lifetime offer coupon, redirect to lifetime offer checkout
    console.log('Checking lifetime offer condition:', {
      showLifetimeOffer: showLifetimeOffer,
      showLifetimeOfferType: typeof showLifetimeOffer,
      validatedCoupon: validatedCoupon,
      validatedCouponType: typeof validatedCoupon,
      conditionMet: showLifetimeOffer && validatedCoupon
    });

    if (showLifetimeOffer && validatedCoupon) {
      console.log('✅ Redirecting to lifetime offer:', {
        partnerId: partner.id,
        couponId: validatedCoupon.id,
        redirectUrl: `/lifetime-offer?partnerId=${partner.id}&couponId=${validatedCoupon.id}`
      });

      return NextResponse.json({
        success: true,
        message: 'Account created successfully',
        redirectUrl: `/lifetime-offer?partnerId=${partner.id}&couponId=${validatedCoupon.id}`,
        data: {
          partnerId: partner.id,
          businessName: partner.businessName,
          emailAddress: partner.emailAddress,
        }
      });
    } else {
      console.log('❌ Lifetime offer condition not met, continuing to regular flow');
    }

    // If there's a pre-selected plan, redirect to payment
    if (preSelectedPlan) {
      const completeResult = await callCompleteEndpoint(
        partner.id,
        preSelectedPlan.planId,
        preSelectedPlan.billingInterval
      );

      if (completeResult.success && completeResult.url) {
        return NextResponse.json({
          success: true,
          message: 'Account created successfully',
          redirectUrl: completeResult.url,
          data: {
            partnerId: partner.id,
            businessName: partner.businessName,
            emailAddress: partner.emailAddress,
          }
        });
      } else {
        // If payment setup fails, still return success but redirect to partners page
        console.error('❌ Failed to create payment session for new partner after retries:', {
          error: completeResult.error,
          partnerId: partner.id
        });
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
    } else {
      // No pre-selected plan, redirect to pricing selection
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
    }

  } catch (error) {
    console.error('Error in quick signup:', error);

    // Handle unique constraint violations (race condition case)
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      // This could happen if two requests come in simultaneously
      // Try to find the partner that was just created and handle accordingly
      try {
        const existingPartner = await prisma.partner.findUnique({
          where: { emailAddress: emailAddress.trim().toLowerCase() }
        });

        if (existingPartner && existingPartner.approvalStatus === 'PENDING') {
          // Return success with existing partner info
          return NextResponse.json({
            success: true,
            message: 'Account found - continuing where you left off',
            redirectUrl: preSelectedPlan
              ? `/partners?partnerId=${existingPartner.id}&step=payment`
              : `/partners?partnerId=${existingPartner.id}&step=pricing`,
            data: {
              partnerId: existingPartner.id,
              businessName: existingPartner.businessName,
              emailAddress: existingPartner.emailAddress,
            }
          });
        }
      } catch (findError) {
        console.error('Error finding existing partner:', findError);
      }

      // Generic error for security
      return NextResponse.json(
        { success: false, error: 'Unable to create account. Please try again or contact support.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create account. Please try again.' },
      { status: 500 }
    );
  }
}
