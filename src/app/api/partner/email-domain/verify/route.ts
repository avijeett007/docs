import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPartnerToken } from '@/lib/auth';
import { SESService } from '@/lib/aws-ses';

export async function POST(request: NextRequest) {
  try {
    // Verify partner authentication
    const authResult = await verifyPartnerToken(request);

    if (!authResult.success || !authResult.partner) {
      return authResult.error;
    }

    const partnerId = authResult.partner.id;

    // Get partner with domain configuration
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        id: true,
        businessName: true,
        sesDomain: true,
        sesDomainStatus: true,
        sesDomainEnabled: true,
        sesDomainVerificationToken: true,
        sesDomainVerificationStartedAt: true,
        sesDomainVerifiedAt: true,
        sesDkimTokens: true,
        sesFromEmail: true,
        sesFromName: true,
        useSESDomain: true
      }
    });

    if (!partner) {
      return NextResponse.json(
        { success: false, error: 'PARTNER_NOT_FOUND', message: 'Partner not found' },
        { status: 404 }
      );
    }

    if (!partner.sesDomainEnabled) {
      return NextResponse.json(
        { success: false, error: 'SERVICE_NOT_ENABLED', message: 'Domain email service is not enabled' },
        { status: 403 }
      );
    }

    if (!partner.sesDomain) {
      return NextResponse.json(
        { success: false, error: 'NO_DOMAIN_CONFIGURED', message: 'No domain has been configured yet' },
        { status: 400 }
      );
    }

    // Initialize SES service
    const sesService = new SESService();

    try {
      // Check domain verification status with AWS SES
      const verificationStatus = await sesService.getDomainVerificationStatus(partner.sesDomain);
      
      let newStatus: string;
      let verifiedAt: Date | null = partner.sesDomainVerifiedAt;

      // Map AWS SES status to our internal status
      if (verificationStatus.verified) {
        newStatus = 'verified';
        if (!verifiedAt) {
          verifiedAt = new Date();
        }
      } else {
        newStatus = 'pending_verification';
      }

      // Update partner status if it has changed
      let updatedPartner = partner;
      if (partner.sesDomainStatus !== newStatus || (!partner.sesDomainVerifiedAt && verifiedAt)) {
        updatedPartner = await prisma.partner.update({
          where: { id: partnerId },
          data: {
            sesDomainStatus: newStatus,
            sesDomainVerifiedAt: verifiedAt
          }
        });

        console.log(`Domain verification status updated for partner ${partnerId} (${partner.businessName}): ${partner.sesDomain} -> ${newStatus}`);
      }

      return NextResponse.json({
        success: true,
        message: `Domain verification status: ${newStatus}`,
        partner: {
          id: updatedPartner.id,
          businessName: partner.businessName,
          sesDomain: updatedPartner.sesDomain,
          sesDomainStatus: newStatus,
          sesDomainVerificationToken: updatedPartner.sesDomainVerificationToken,
          sesDomainVerificationStartedAt: updatedPartner.sesDomainVerificationStartedAt,
          sesDomainVerifiedAt: verifiedAt,
          sesDkimTokens: updatedPartner.sesDkimTokens,
          sesFromEmail: updatedPartner.sesFromEmail,
          sesFromName: updatedPartner.sesFromName,
          useSESDomain: updatedPartner.useSESDomain,
          sesDomainEnabled: updatedPartner.sesDomainEnabled
        },
        verificationDetails: {
          verified: verificationStatus.verified,
          dkimVerified: verificationStatus.dkimVerified,
          dkimTokens: verificationStatus.dkimTokens
        }
      });

    } catch (sesError) {
      console.error('AWS SES error during domain verification:', sesError);
      
      // If domain doesn't exist in SES, mark as failed
      if (sesError instanceof Error && (
        sesError.message.includes('does not exist') || 
        sesError.message.includes('not found')
      )) {
        const updatedPartner = await prisma.partner.update({
          where: { id: partnerId },
          data: {
            sesDomainStatus: 'failed'
          }
        });

        return NextResponse.json({
          success: false,
          error: 'DOMAIN_NOT_FOUND',
          message: 'Domain not found in email service. Please setup the domain again.',
          partner: {
            id: updatedPartner.id,
            businessName: partner.businessName,
            sesDomain: updatedPartner.sesDomain,
            sesDomainStatus: 'failed',
            sesDomainVerificationToken: updatedPartner.sesDomainVerificationToken,
            sesDomainVerificationStartedAt: updatedPartner.sesDomainVerificationStartedAt,
            sesDomainVerifiedAt: updatedPartner.sesDomainVerifiedAt,
            sesDkimTokens: updatedPartner.sesDkimTokens,
            sesFromEmail: updatedPartner.sesFromEmail,
            sesFromName: updatedPartner.sesFromName,
            useSESDomain: updatedPartner.useSESDomain,
            sesDomainEnabled: updatedPartner.sesDomainEnabled
          }
        }, { status: 404 });
      }
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'SES_ERROR', 
          message: `Failed to verify domain: ${sesError instanceof Error ? sesError.message : 'Unknown error'}` 
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error verifying email domain:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'INTERNAL_ERROR', 
        message: 'An error occurred while verifying the email domain' 
      },
      { status: 500 }
    );
  }
}

// Only allow POST method
export async function GET() {
  return NextResponse.json(
    { success: false, error: 'METHOD_NOT_ALLOWED', message: 'Only POST method is allowed' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { success: false, error: 'METHOD_NOT_ALLOWED', message: 'Only POST method is allowed' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { success: false, error: 'METHOD_NOT_ALLOWED', message: 'Only POST method is allowed' },
    { status: 405 }
  );
}
