import { NextResponse, NextRequest } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { generatePartnerCode } from '@/lib/server-utils';
import { lookupContactByEmail, updateContact } from '@/lib/crm';
import { securePublicRoute, ValidationSchemas } from '@/lib/security/publicRoutesSecurity';
import { getRewardfulService } from '@/lib/rewardful';

// POST /api/partners/register - Create a new partner (Step 1)
export async function POST(req: NextRequest) {
  try {
    // Apply security measures
    const securityCheck = await securePublicRoute(req, {
      rateLimitRequests: 3, // Very restrictive for registration
      rateLimitWindowMs: 60 * 1000,
      requireOriginValidation: true,
      allowedMethods: ['POST'],
      maxRequestSize: 5 * 1024 * 1024 // 5MB for file uploads
    });

    if (!securityCheck.success) {
      return securityCheck.response;
    }

    const formData = await req.formData();
    
    // Get file and convert to base64 if present
    const fileEntry = formData.get('logo');
    const file = (fileEntry && typeof fileEntry !== 'string') ? fileEntry as File : null;
    let logo: string | undefined;
    
    if (file) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      logo = `data:${file.type};base64,${buffer.toString('base64')}`;
    }

    // Get other form data with validation
    const businessName = formData.get('businessName') as string;
    const contactName = formData.get('contactName') as string;
    const businessAddress = formData.get('businessAddress') as string;
    const emailAddress = formData.get('emailAddress') as string;
    const phoneNumber = formData.get('phoneNumber') as string;
    const areaOfBusiness = formData.get('areaOfBusiness') as string;
    const expertise = formData.get('expertise') as string;
    const learningSource = formData.get('learningSource') as string;
    const partnershipType = formData.get('partnershipType') as string;
    const country = formData.get('country') as string;

    /**
     * Note: referralId is sent from client but not used in this route.
     * Referral tracking works as follows:
     * 1. Client-side: Rewardful JS automatically tracks leads when users visit ?via=referral-code
     * 2. Stripe checkout: referralId is passed as metadata for conversion tracking
     * 3. Webhook: Only paid conversions are tracked server-side via Stripe webhook
     * 4. Database: No referral data stored since Rewardful manages lead attribution
     */


    // Validate required fields
    try {
      ValidationSchemas.email.parse(emailAddress);
      ValidationSchemas.businessName.parse(businessName);
      ValidationSchemas.sanitizedString.parse(contactName);
      ValidationSchemas.sanitizedString.parse(businessAddress);
      if (phoneNumber) ValidationSchemas.phoneNumber.parse(phoneNumber);
    } catch (validationError) {
      console.warn('Invalid registration data', { emailAddress, businessName, error: validationError });
      return NextResponse.json(
        { success: false, error: 'Invalid input data provided' },
        { status: 400 }
      );
    }

    // Check for duplicate email
    const existingPartner = await prisma.partner.findUnique({
      where: { emailAddress },
      select: { id: true }
    });

    if (existingPartner) {
      return NextResponse.json(
        { success: false, error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    // Generate a unique partner code
    const partnerCode = await generatePartnerCode();

    // Create the partner record with all data including logo and referral info
    const partner = await prisma.partner.create({
      data: {
        businessName,
        contactName,
        businessAddress,
        emailAddress,
        phoneNumber,
        areaOfBusiness,
        expertise,
        learningSource,
        partnershipType,
        partnerCode,
        approvalStatus: 'PENDING',
        country,
        logo,
      },
    });

    // Fire and forget GHL operations
    Promise.allSettled([
      lookupContactByEmail(emailAddress),
      updateContact(partner.id, partnershipType.toLowerCase(), [partnerCode]),
    ]).catch(error => {
      // Log GHL errors but don't fail the request
      console.error('GHL Integration Error:', error);
    });

    // Create affiliate silently for new partner (fire and forget)
    Promise.resolve().then(async () => {
      try {
        const rewardfulService = getRewardfulService();

        // Create affiliate in Rewardful with INACTIVE status initially
        const affiliateData = {
          email: emailAddress,
          first_name: contactName.split(' ')[0] || contactName,
          last_name: contactName.split(' ').slice(1).join(' ') || '',
          company: businessName,
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

    // Return success with partner data
    return NextResponse.json({
      success: true,
      message: 'Partner information saved successfully.',
      data: {
        partnerId: partner.id,
        businessName: partner.businessName,
        emailAddress: partner.emailAddress,
      }
    });

  } catch (error) {
    console.error('Error creating partner:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit partner application' },
      { status: 500 }
    );
  }
}
