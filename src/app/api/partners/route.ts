import { NextResponse, NextRequest } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { generatePartnerCode } from '@/lib/server-utils';
import { lookupContactByEmail, updateContact } from '@/lib/crm';
import { generateRandomPassword } from '@/lib/password-generator';
import { sendPartnerWelcomeEmail } from '@/lib/email';
import { headers } from 'next/headers';
import { getRewardfulService } from '@/lib/rewardful';

// POST /api/partners - Create a new partner
export async function POST(_req: NextRequest) {
  try {
    const formData = await _req.formData();
    
    // Get file and convert to base64 if present
    const file = formData.get('logo');
    let logo: string | undefined;

    if (file && typeof file !== 'string') {
      const fileObj = file as File;
      const bytes = await fileObj.arrayBuffer();
      const buffer = Buffer.from(bytes);
      logo = `data:${fileObj.type};base64,${buffer.toString('base64')}`;
    }

    // Get other form data
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

    // Generate a unique partner code
    const partnerCode = await generatePartnerCode();

    // Create the partner record with all data including logo
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
          // @ts-ignore - Prisma client may not be fully regenerated yet
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

    // Generate random password and set it
    const randomPassword = generateRandomPassword();
    
    try {
      // Get the host from the request headers
      const host = headers().get('host') || 'localhost:3000';
      const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
      
      // Set password for the partner
      const response = await fetch(`${protocol}://${host}/api/partner/auth/set-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.PARTNER_API_KEY}`,
        },
        body: JSON.stringify({
          email: emailAddress,
          password: randomPassword,
        }),
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (jsonError) {
          // If response is not JSON, use status text
          errorData = { error: response.statusText || 'Unknown error' };
        }
        throw new Error(`Failed to set password: ${errorData.error || 'Unknown error'}`);
      }

      // Try to parse response, but don't fail if it's empty
      try {
        await response.json();
      } catch (jsonError) {
        // Ignore JSON parsing errors for successful responses
        console.log('Set password response was not JSON (this is normal)');
      }

      // Send welcome email with password
      await sendPartnerWelcomeEmail({
        to: emailAddress,
        businessName,
        password: randomPassword,
      });
    } catch (error) {
      console.error('Error in post-registration process:', error);
      // Continue execution - we don't want to fail the registration
    }

    // Return success with partner data
    return NextResponse.json({ 
      success: true, 
      message: 'Your partner application has been submitted successfully. Please check your email for login credentials.',
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

// GET /api/partners - Get all partners (admin only)
export async function GET(_req: NextRequest) {
  try {
    // TODO: Add proper admin authentication
    const partners = await prisma.partner.findMany({
      select: {
        id: true,
        businessName: true,
        contactName: true,
        emailAddress: true,
        partnershipType: true,
        approvalStatus: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, data: partners });
  } catch (error) {
    console.error('Error fetching partners:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch partners' },
      { status: 500 }
    );
  }
}
