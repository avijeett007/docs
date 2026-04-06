import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCustomHostnameStatus } from '@/lib/cloudflare';

export const dynamic = 'force-dynamic'; // Required because this route uses request.headers

// This endpoint will be called by a scheduled job (e.g., Vercel Cron)
export async function GET(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request (optional security)
    const authHeader = request.headers.get('Authorization');
    if (process.env.CRON_SECRET && (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all partners with pending custom domains
    const pendingDomains = await prisma.partner.findMany({
      where: {
        customDomain: { not: null },
        customDomainVerified: false,
        customDomainStatus: 'pending',
        customDomainCloudflareId: { not: null },
        customDomainVerificationStartedAt: {
          // Only check domains that started verification in the last 48 hours
          gte: new Date(Date.now() - 48 * 60 * 60 * 1000)
        }
      },
      select: {
        id: true,
        customDomain: true,
        customDomainCloudflareId: true,
        customDomainVerificationStartedAt: true,
        subdomain: true
      }
    });

    console.log(`Found ${pendingDomains.length} pending domains to verify`);

    const results = [];

    for (const partner of pendingDomains) {
      if (!partner.customDomain || !partner.customDomainCloudflareId) continue;

      console.log(`Verifying domain ${partner.customDomain} for partner ${partner.id}`);

      // Check status with Cloudflare
      const cloudflareResponse = await getCustomHostnameStatus(partner.customDomainCloudflareId);

      if (!cloudflareResponse.success) {
        console.error(`Error checking status for ${partner.customDomain}:`, cloudflareResponse.errors);
        continue;
      }

      const status = cloudflareResponse.result.status;
      const ssl = cloudflareResponse.result.ssl;

      console.log(`Verification results for ${partner.customDomain}: Hostname=${status}, SSL=${ssl.status}`);

      if (status === 'active' && ssl.status === 'active') {
        // Update domain as verified
        await prisma.partner.update({
          where: { id: partner.id },
          data: {
            customDomainVerified: true,
            customDomainStatus: 'verified'
          }
        });

        results.push({
          domain: partner.customDomain,
          status: 'verified',
          partnerId: partner.id
        });
      } else if (
        partner.customDomainVerificationStartedAt &&
        partner.customDomainVerificationStartedAt < new Date(Date.now() - 48 * 60 * 60 * 1000)
      ) {
        // Mark as failed after 48 hours
        await prisma.partner.update({
          where: { id: partner.id },
          data: {
            customDomainStatus: 'failed'
          }
        });

        results.push({
          domain: partner.customDomain,
          status: 'failed',
          partnerId: partner.id
        });
      } else {
        // Still pending
        results.push({
          domain: partner.customDomain,
          status: 'pending',
          partnerId: partner.id,
          hostnameStatus: status,
          sslStatus: ssl.status
        });
      }
    }

    return NextResponse.json({
      success: true,
      verified: results.filter(r => r.status === 'verified').length,
      failed: results.filter(r => r.status === 'failed').length,
      pending: results.filter(r => r.status === 'pending').length,
      results
    });
  } catch (error) {
    console.error('Error verifying domains:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
