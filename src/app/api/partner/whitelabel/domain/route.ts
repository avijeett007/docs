import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { getDomainVerificationInstructions, generateVerificationToken } from '@/lib/domainVerification';
import { addCustomHostname, deleteCustomHostname, getCustomHostnameStatus } from '@/lib/cloudflare';
import { verifyPartnerToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Verify partner token with proper JWT signature verification
    const authResult = await verifyPartnerToken(request);
    if (authResult.error) {
      return authResult.error;
    }
    const partnerId = authResult.partner!.id;

    // Parse request body
    const { customDomain } = await request.json();

    // Validate domain format
    if (!customDomain || !/^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i.test(customDomain)) {
      return NextResponse.json({ error: 'Invalid domain format' }, { status: 400 });
    }

    // Check if domain is already in use
    const existingPartner = await prisma.partner.findFirst({
      where: {
        customDomain,
        id: { not: partnerId }
      }
    });

    if (existingPartner) {
      return NextResponse.json({ error: 'Domain is already in use' }, { status: 400 });
    }

    // Get the partner details to check for existing subdomain
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        id: true,
        subdomain: true
      }
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    // Check if partner already has a subdomain, if not, generate one
    let partnerSubdomain = partner.subdomain;

    if (!partnerSubdomain) {
      // Generate a random subdomain based on partner ID and a timestamp
      const randomId = Math.random().toString(36).substring(2, 8);
      partnerSubdomain = `p-${partner.id.substring(0, 6)}-${randomId}`;

      // Update the partner with the new subdomain
      await prisma.partner.update({
        where: { id: partnerId },
        data: {
          subdomain: partnerSubdomain
        }
      });

      console.log(`Generated new subdomain ${partnerSubdomain} for partner ${partnerId}`);
    }

    // Register domain with Cloudflare
    const cloudflareResponse = await addCustomHostname(customDomain);

    if (!cloudflareResponse.success) {
      console.error('Cloudflare API error:', cloudflareResponse.errors);
      return NextResponse.json({ error: 'Failed to register domain with Cloudflare' }, { status: 500 });
    }

    // Store Cloudflare hostname ID for future reference
    const hostnameId = cloudflareResponse.result.id;

    // Extract HTTP validation details if available
    let httpValidationUrl = '';
    let httpValidationBody = '';

    // Check if Cloudflare returned validation details
    if (cloudflareResponse.result.ssl &&
        cloudflareResponse.result.ssl.validation_records &&
        cloudflareResponse.result.ssl.validation_records.length > 0) {

      // The validation_records structure depends on the validation method
      const validationRecord = cloudflareResponse.result.ssl.validation_records[0] as any;

      if (validationRecord.http_url) {
        httpValidationUrl = validationRecord.http_url;
        httpValidationBody = validationRecord.http_body || '';
      } else if (validationRecord.txt_name) {
        // For DNS validation, we'll still store these values
        httpValidationUrl = validationRecord.txt_name;
        httpValidationBody = validationRecord.txt_value;
      }
    }

    // If Cloudflare didn't provide validation details, we'll check the hostname status
    if (!httpValidationUrl) {
      try {
        // Wait a moment for Cloudflare to generate the validation records
        await new Promise(resolve => setTimeout(resolve, 1000));

        const hostnameStatus = await getCustomHostnameStatus(hostnameId);
        console.log('Hostname status response:', JSON.stringify(hostnameStatus, null, 2));

        if (hostnameStatus.success &&
            hostnameStatus.result.ssl &&
            hostnameStatus.result.ssl.validation_records &&
            hostnameStatus.result.ssl.validation_records.length > 0) {

          const validationRecord = hostnameStatus.result.ssl.validation_records[0] as any;
          console.log('Validation record:', JSON.stringify(validationRecord, null, 2));

          if (validationRecord.http_url) {
            httpValidationUrl = validationRecord.http_url;
            httpValidationBody = validationRecord.http_body || '';
            console.log(`Found HTTP validation: URL=${httpValidationUrl}, Body=${httpValidationBody}`);
          } else if (validationRecord.txt_name) {
            httpValidationUrl = validationRecord.txt_name;
            httpValidationBody = validationRecord.txt_value;
            console.log(`Found TXT validation: Name=${httpValidationUrl}, Value=${httpValidationBody}`);
          }
        } else {
          // If no validation records are found, use default values
          console.log('No validation records found, using default values');
          httpValidationUrl = `http://${customDomain}/.well-known/acme-challenge/http-validation`;
          httpValidationBody = 'http-validation';
        }
      } catch (error) {
        console.error('Error getting hostname status:', error);
        // Continue anyway, we'll just use the default verification method
        httpValidationUrl = `http://${customDomain}/.well-known/acme-challenge/http-validation`;
        httpValidationBody = 'http-validation';
      }
    }

    // Generate verification token and set domain target
    const verificationToken = generateVerificationToken();
    const domainTarget = 'custom.knotie-ai.pro'; // Dedicated subdomain for custom domains

    // Generate a unique TXT record verification token
    const txtVerificationToken = `knotie-verify-${Math.random().toString(36).substring(2, 15)}`;

    // Update partner record with all required verification information
    await prisma.partner.update({
      where: { id: partnerId },
      data: {
        customDomain,
        customDomainVerified: false,
        customDomainStatus: 'pending',
        customDomainCloudflareId: hostnameId,
        customDomainVerificationStartedAt: new Date(),
        customDomainVerificationToken: verificationToken,
        customDomainTxtToken: txtVerificationToken, // Store TXT verification token
        customDomainTarget: domainTarget,
        customDomainHttpValidationUrl: httpValidationUrl,
        customDomainHttpValidationBody: httpValidationBody
      }
    });

    // Get formatted instructions for the partner
    const instructions = getDomainVerificationInstructions(
      customDomain,
      verificationToken,
      domainTarget,
      txtVerificationToken // Pass the TXT token for verification
    );

    // Get the updated partner record to return complete information
    const updatedPartner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        customDomain: true,
        customDomainVerified: true,
        customDomainStatus: true,
        customDomainVerificationToken: true,
        customDomainTarget: true
      }
    });

    return NextResponse.json({
      success: true,
      domain: customDomain,
      instructions,
      partner: updatedPartner,
      message: "Domain registered successfully. Please configure your DNS records as shown below, then click Verify."
    });
  } catch (error) {
    console.error('Error registering custom domain:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify partner token with proper JWT signature verification
    const authResult = await verifyPartnerToken(request);
    if (authResult.error) {
      return authResult.error;
    }
    const partnerId = authResult.partner!.id;

    // Get partner's domain information
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        customDomain: true,
        customDomainVerified: true,
        customDomainStatus: true,
        customDomainVerificationToken: true,
        customDomainTxtToken: true, // Include TXT token
        customDomainTarget: true,
        customDomainVerificationStartedAt: true
      }
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    // If no custom domain is set, return empty response
    if (!partner.customDomain) {
      return NextResponse.json({
        success: true,
        hasDomain: false
      });
    }

    // If domain is verified, return success
    if (partner.customDomainVerified) {
      return NextResponse.json({
        success: true,
        hasDomain: true,
        domain: partner.customDomain,
        status: 'verified'
      });
    }

    // If domain is pending verification, return instructions
    if (partner.customDomainStatus === 'pending' &&
        partner.customDomainVerificationToken &&
        partner.customDomainTarget) {

      const instructions = getDomainVerificationInstructions(
        partner.customDomain,
        partner.customDomainVerificationToken,
        partner.customDomainTarget,
        partner.customDomainTxtToken || undefined // Convert null to undefined
      );

      return NextResponse.json({
        success: true,
        hasDomain: true,
        domain: partner.customDomain,
        status: partner.customDomainStatus,
        instructions
      });
    }

    // For any other status
    return NextResponse.json({
      success: true,
      hasDomain: true,
      domain: partner.customDomain,
      status: partner.customDomainStatus || 'unknown'
    });
  } catch (error) {
    console.error('Error getting domain information:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Verify partner token with proper JWT signature verification
    const authResult = await verifyPartnerToken(request);
    if (authResult.error) {
      return authResult.error;
    }
    const partnerId = authResult.partner!.id;

    // Get partner's current domain information
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        customDomain: true,
        customDomainCloudflareId: true
      }
    });

    if (!partner || !partner.customDomain) {
      return NextResponse.json({ error: 'No custom domain configured' }, { status: 404 });
    }

    // Delete the custom hostname from Cloudflare if we have an ID
    if (partner.customDomainCloudflareId) {
      try {
        const cloudflareResponse = await deleteCustomHostname(partner.customDomainCloudflareId);

        if (!cloudflareResponse.success) {
          console.error('Cloudflare API error:', cloudflareResponse.errors);
          // Continue anyway to clean up our database
        }
      } catch (error) {
        console.error('Error deleting custom hostname from Cloudflare:', error);
        // Continue anyway to clean up our database
      }
    }

    // Update partner record to remove custom domain
    await prisma.partner.update({
      where: { id: partnerId },
      data: {
        customDomain: null,
        customDomainVerified: false,
        customDomainStatus: null,
        customDomainVerificationToken: null,
        customDomainTarget: null,
        customDomainVerificationStartedAt: null,
        customDomainCloudflareId: null
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Custom domain removed successfully'
    });
  } catch (error) {
    console.error('Error removing custom domain:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
