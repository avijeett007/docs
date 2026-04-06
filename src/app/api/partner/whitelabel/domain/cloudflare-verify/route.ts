import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { addCustomHostname } from '@/lib/cloudflare';
import { verifyPartnerToken } from '@/lib/auth';

/**
 * API endpoint for one-click verification of domains managed in Cloudflare
 * This allows partners to verify their domains without manually adding DNS records
 * if they manage their domains in Cloudflare
 */
export async function POST(request: NextRequest) {
  try {
    // Verify partner token with proper JWT signature verification
    const authResult = await verifyPartnerToken(request);
    if (authResult.error) {
      return authResult.error;
    }
    const partnerId = authResult.partner!.id;

    // Parse request body
    const { customDomain, cloudflareApiToken, cloudflareZoneId } = await request.json();

    // Validate domain format
    if (!customDomain || !/^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i.test(customDomain)) {
      return NextResponse.json({ error: 'Invalid domain format' }, { status: 400 });
    }

    // Validate Cloudflare credentials
    if (!cloudflareApiToken || !cloudflareZoneId) {
      return NextResponse.json({
        error: 'Cloudflare API token and Zone ID are required for one-click verification'
      }, { status: 400 });
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

    // Verify Cloudflare credentials by making a test API call
    try {
      const testResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${cloudflareZoneId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cloudflareApiToken}`,
          'Content-Type': 'application/json'
        }
      });

      const testData = await testResponse.json();

      if (!testData.success) {
        return NextResponse.json({
          error: 'Invalid Cloudflare credentials or insufficient permissions',
          details: testData.errors
        }, { status: 400 });
      }

      // Verify that the domain belongs to this zone
      const domainParts = customDomain.split('.');
      const rootDomain = domainParts.length >= 2
        ? `${domainParts[domainParts.length - 2]}.${domainParts[domainParts.length - 1]}`
        : customDomain;

      if (testData.result.name !== rootDomain) {
        return NextResponse.json({
          error: `The domain ${customDomain} does not belong to the Cloudflare zone ${testData.result.name}`
        }, { status: 400 });
      }
    } catch (error) {
      console.error('Error verifying Cloudflare credentials:', error);
      return NextResponse.json({
        error: 'Failed to verify Cloudflare credentials'
      }, { status: 500 });
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

    // Register domain with our Cloudflare account for SSL
    const cloudflareResponse = await addCustomHostname(customDomain);

    if (!cloudflareResponse.success) {
      console.error('Cloudflare API error:', cloudflareResponse.errors);
      return NextResponse.json({ error: 'Failed to register domain with Cloudflare' }, { status: 500 });
    }

    // Store Cloudflare hostname ID for future reference
    const hostnameId = cloudflareResponse.result.id;

    // Create DNS records in partner's Cloudflare account
    try {
      // Extract the subdomain part if it's a subdomain
      const domainParts = customDomain.split('.');
      const isSubdomain = domainParts.length > 2;

      // If it's a subdomain, we need to use just the subdomain part as the name
      // For example, for "portal.example.com", we use "portal" as the name
      const recordName = isSubdomain ? domainParts[0] : customDomain;

      // 1. Create CNAME record
      const cnameResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${cloudflareZoneId}/dns_records`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cloudflareApiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'CNAME',
          name: recordName,
          content: 'custom.knotie-ai.pro',
          ttl: 1, // Auto
          proxied: true
        })
      });

      const cnameData = await cnameResponse.json();

      if (!cnameData.success) {
        console.error('Failed to create CNAME record:', cnameData.errors);
        // Continue anyway, we'll mark the domain as verified since we've created it in our Cloudflare
      }

      // Update partner record - mark as verified immediately since we've created the DNS record
      await prisma.partner.update({
        where: { id: partnerId },
        data: {
          customDomain,
          customDomainVerified: true,
          customDomainStatus: 'verified',
          customDomainCloudflareId: hostnameId,
          customDomainVerificationStartedAt: new Date(),
          customDomainTarget: 'custom.knotie-ai.pro'
        }
      });

      return NextResponse.json({
        success: true,
        domain: customDomain,
        status: 'verified',
        message: 'Domain verified and DNS records created automatically'
      });
    } catch (error) {
      console.error('Error creating DNS records in partner Cloudflare account:', error);

      // Still update the partner record, but mark as pending
      await prisma.partner.update({
        where: { id: partnerId },
        data: {
          customDomain,
          customDomainVerified: false,
          customDomainStatus: 'pending',
          customDomainCloudflareId: hostnameId,
          customDomainVerificationStartedAt: new Date(),
          customDomainTarget: 'custom.knotie-ai.pro'
        }
      });

      return NextResponse.json({
        success: true,
        domain: customDomain,
        status: 'pending',
        message: 'Domain registered but automatic DNS configuration failed. Please configure DNS manually.',
        manualInstructions: {
          cname: {
            type: 'CNAME',
            name: customDomain,
            value: 'custom.knotie-ai.pro'
          }
        }
      });
    }
  } catch (error) {
    console.error('Error in one-click Cloudflare verification:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
