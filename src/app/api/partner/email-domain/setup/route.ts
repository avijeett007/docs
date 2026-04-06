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

    // Parse request body
    const { domain, fromEmail, fromName } = await request.json();

    // Validate input
    if (!domain || !fromEmail || !fromName) {
      return NextResponse.json(
        { success: false, error: 'MISSING_FIELDS', message: 'Domain, from email, and from name are required' },
        { status: 400 }
      );
    }

    // Validate domain format
    if (!SESService.isValidDomain(domain)) {
      return NextResponse.json(
        { success: false, error: 'INVALID_DOMAIN', message: 'Invalid domain format' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(fromEmail)) {
      return NextResponse.json(
        { success: false, error: 'INVALID_EMAIL', message: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Check if partner exists and has domain email service enabled
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        id: true,
        sesDomainEnabled: true,
        businessName: true,
        sesDomain: true
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

    // Initialize SES service
    const sesService = new SESService();

    try {
      // Verify domain with AWS SES and get DKIM tokens
      const verificationResult = await sesService.verifyDomain(domain);
      
      // Update partner with domain configuration
      const updatedPartner = await prisma.partner.update({
        where: { id: partnerId },
        data: {
          sesDomain: domain.toLowerCase(),
          sesDomainStatus: 'pending_verification',
          sesDomainVerificationToken: verificationResult.verificationToken,
          sesDomainVerificationStartedAt: new Date(),
          sesDkimTokens: JSON.stringify(verificationResult.dkimTokens),
          sesFromEmail: fromEmail.toLowerCase(),
          sesFromName: fromName,
          useSESDomain: true,
          sesDomainVerifiedAt: null // Reset verification date
        }
      });

      // Generate DNS records for the frontend
      const dnsRecords = SESService.generateRecommendedDNSRecords(domain);

      console.log(`Domain setup initiated for partner ${partnerId} (${partner.businessName}): ${domain}`);

      return NextResponse.json({
        success: true,
        message: 'Domain setup initiated successfully',
        partner: {
          id: updatedPartner.id,
          businessName: partner.businessName,
          sesDomain: updatedPartner.sesDomain,
          sesDomainStatus: updatedPartner.sesDomainStatus,
          sesDomainVerificationToken: updatedPartner.sesDomainVerificationToken,
          sesDomainVerificationStartedAt: updatedPartner.sesDomainVerificationStartedAt,
          sesDomainVerifiedAt: updatedPartner.sesDomainVerifiedAt,
          sesDkimTokens: updatedPartner.sesDkimTokens,
          sesFromEmail: updatedPartner.sesFromEmail,
          sesFromName: updatedPartner.sesFromName,
          useSESDomain: updatedPartner.useSESDomain,
          sesDomainEnabled: updatedPartner.sesDomainEnabled
        },
        dnsRecords
      });

    } catch (sesError) {
      console.error('AWS SES error during domain setup:', sesError);
      
      // If it's a domain already exists error, try to get the existing verification status
      if (sesError instanceof Error && sesError.message.includes('already exists')) {
        try {
          const statusResult = await sesService.getDomainVerificationStatus(domain);
          
          // Update partner with existing domain info
          const updatedPartner = await prisma.partner.update({
            where: { id: partnerId },
            data: {
              sesDomain: domain.toLowerCase(),
              sesDomainStatus: statusResult.verified ? 'verified' : 'pending_verification',
              sesFromEmail: fromEmail.toLowerCase(),
              sesFromName: fromName,
              useSESDomain: true,
              sesDomainVerifiedAt: statusResult.verified ? new Date() : null
            }
          });

          const dnsRecords = SESService.generateRecommendedDNSRecords(domain);

          return NextResponse.json({
            success: true,
            message: 'Domain configuration updated successfully',
            partner: {
              id: updatedPartner.id,
              businessName: partner.businessName,
              sesDomain: updatedPartner.sesDomain,
              sesDomainStatus: updatedPartner.sesDomainStatus,
              sesDomainVerificationToken: updatedPartner.sesDomainVerificationToken,
              sesDomainVerificationStartedAt: updatedPartner.sesDomainVerificationStartedAt,
              sesDomainVerifiedAt: updatedPartner.sesDomainVerifiedAt,
              sesDkimTokens: updatedPartner.sesDkimTokens,
              sesFromEmail: updatedPartner.sesFromEmail,
              sesFromName: updatedPartner.sesFromName,
              useSESDomain: updatedPartner.useSESDomain,
              sesDomainEnabled: updatedPartner.sesDomainEnabled
            },
            dnsRecords
          });
        } catch (statusError) {
          console.error('Error getting domain status:', statusError);
        }
      }
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'SES_ERROR', 
          message: `Failed to setup domain with email service: ${sesError instanceof Error ? sesError.message : 'Unknown error'}` 
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error setting up email domain:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'INTERNAL_ERROR', 
        message: 'An error occurred while setting up the email domain' 
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
