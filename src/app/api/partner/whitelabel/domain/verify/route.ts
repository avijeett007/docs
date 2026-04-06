import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { getCustomHostnameStatus } from '@/lib/cloudflare';
import { verifyPartnerToken } from '@/lib/auth';

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
        id: true,
        customDomain: true,
        customDomainVerified: true,
        customDomainStatus: true,
        customDomainVerificationToken: true,
        customDomainTxtToken: true,
        customDomainTarget: true,
        customDomainCloudflareId: true
      }
    }) as {
      id: string;
      customDomain: string | null;
      customDomainVerified: boolean;
      customDomainStatus: string | null;
      customDomainVerificationToken: string | null;
      customDomainTxtToken: string | null;
      customDomainTarget: string | null;
      customDomainCloudflareId: string | null;
    };

    if (!partner || !partner.customDomain) {
      return NextResponse.json({ error: 'No custom domain configured' }, { status: 404 });
    }

    // If already verified, return success
    if (partner.customDomainVerified) {
      return NextResponse.json({
        success: true,
        status: 'verified',
        domain: partner.customDomain
      });
    }

    // If no Cloudflare ID, return error
    if (!partner.customDomainCloudflareId) {
      return NextResponse.json({ error: 'Verification not initiated' }, { status: 400 });
    }

    // Check status with Cloudflare
    const cloudflareResponse = await getCustomHostnameStatus(partner.customDomainCloudflareId);

    if (!cloudflareResponse.success) {
      console.error('Cloudflare API error:', cloudflareResponse.errors);
      return NextResponse.json({ error: 'Failed to check domain status with Cloudflare' }, { status: 500 });
    }

    const status = cloudflareResponse.result.status;
    const ssl = cloudflareResponse.result.ssl;

    // Check for TXT record verification
    let txtVerified = false;

    // For now, we'll skip TXT verification and rely on Cloudflare's hostname verification
    // This simplifies the process for partners and reduces potential errors
    txtVerified = true;

    if (partner.customDomainTxtToken && process.env.ENFORCE_TXT_VERIFICATION === 'true') {
      try {
        // Use DNS lookup to check for TXT record
        const txtRecordName = `_knotie-verification.${partner.customDomain}`;

        // Use fetch to call a DNS lookup service
        const dnsResponse = await fetch(`https://dns.google/resolve?name=${txtRecordName}&type=TXT`);
        const dnsData = await dnsResponse.json();

        // Check if the TXT record exists and matches our token
        if (dnsData.Answer && dnsData.Answer.length > 0) {
          // TXT records are returned with quotes, so we need to remove them
          const txtRecords = dnsData.Answer.map((record: any) => record.data.replace(/"/g, ''));
          txtVerified = txtRecords.includes(partner.customDomainTxtToken);

          console.log(`TXT verification for ${txtRecordName}: ${txtVerified ? 'Success' : 'Failed'}`);
        } else {
          console.log(`No TXT records found for ${txtRecordName}`);
          // Still mark as verified if TXT verification is not enforced
          txtVerified = !process.env.ENFORCE_TXT_VERIFICATION;
        }
      } catch (error) {
        console.error('Error checking TXT record:', error);
        // Continue with verification even if TXT check fails
        txtVerified = !process.env.ENFORCE_TXT_VERIFICATION;
      }
    }

    // If both hostname and SSL are active, and TXT record is verified (if required), mark as verified
    if (status === 'active' && ssl.status === 'active' && (!partner.customDomainTxtToken || txtVerified)) {
      await prisma.partner.update({
        where: { id: partnerId },
        data: {
          customDomainVerified: true,
          customDomainStatus: 'verified'
        }
      });

      return NextResponse.json({
        success: true,
        status: 'verified',
        domain: partner.customDomain
      });
    }

    // If TXT verification is required but failed, return specific error
    if (partner.customDomainTxtToken && !txtVerified) {
      return NextResponse.json({
        success: false,
        status: 'pending',
        domain: partner.customDomain,
        error: 'TXT record verification failed',
        verification: {
          hostnameStatus: status,
          sslStatus: ssl.status,
          txtVerified: false
        }
      });
    }

    // Return current verification status
    return NextResponse.json({
      success: true,
      status: 'pending',
      domain: partner.customDomain,
      verification: {
        hostnameStatus: status,
        sslStatus: ssl.status,
        instructions: {
          cname: {
            type: 'CNAME',
            name: partner.customDomain,
            value: 'customers.knotie-ai.pro'
          }
        }
      }
    });
  } catch (error) {
    console.error('Error checking domain verification:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
