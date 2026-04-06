import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PricingConfig } from '@/types/experience';

export const dynamic = 'force-dynamic';

/**
 * GET /api/whitelabel/experience-pricing/[alias]
 *
 * Public endpoint (no auth required) for landing pages.
 * Fetches pricing tiers for an experience by alias.
 *
 * The partner is determined from the hostname (subdomain or custom domain).
 * The experience is looked up by alias (e.g., "assistant" → "/assistant").
 *
 * Returns: { tiers: PricingTier[], experienceType: string }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { alias: string } }
) {
  const { alias } = params;
  const normalizedAlias = alias.startsWith('/') ? alias : `/${alias}`;

  try {
    // Determine the partner from the hostname
    const hostname = request.headers.get('host') || '';
    const partnerId = request.headers.get('x-partner-id');

    let partner;

    if (partnerId) {
      // Partner ID set by middleware
      partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: { id: true },
      });
    } else {
      // Fallback: determine partner from hostname
      const subdomain = extractSubdomain(hostname);
      if (subdomain) {
        partner = await prisma.partner.findFirst({
          where: { subdomain: { equals: subdomain, mode: 'insensitive' } },
          select: { id: true },
        });
      }

      // Try custom domain if subdomain lookup failed
      if (!partner) {
        partner = await prisma.partner.findFirst({
          where: { customDomain: { equals: hostname.split(':')[0], mode: 'insensitive' } },
          select: { id: true },
        });
      }
    }

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    // Find the experience by alias
    const experience = await prisma.partnerExperience.findFirst({
      where: {
        partnerId: partner.id,
        alias: normalizedAlias,
        enabled: true,
      },
      select: {
        pricingConfig: true,
        experienceType: true,
      },
    });

    if (!experience) {
      // Return empty tiers if no experience found (landing page will use defaults)
      return NextResponse.json({
        tiers: [],
        experienceType: null,
      });
    }

    const pricingConfig = (experience.pricingConfig as PricingConfig) || {};
    const tiers = (pricingConfig.tiers || []).map(t => ({
      name: t.name,
      displayName: t.displayName,
      description: t.description,
      price: t.price,
      currency: t.currency || 'usd',
      interval: t.interval,
      features: t.features || [],
      highlighted: t.highlighted || false,
      highlightLabel: t.highlightLabel,
      // Include Stripe price ID for checkout integration
      stripePriceId: t.stripePriceId,
    }));

    return NextResponse.json({
      tiers,
      experienceType: experience.experienceType,
    });
  } catch (error) {
    console.error('Error fetching experience pricing:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Extract subdomain from hostname.
 * e.g., "mycompany.knotie-ai.pro" → "mycompany"
 * e.g., "mycompany.lvh.me:3000" → "mycompany"
 */
function extractSubdomain(hostname: string): string | null {
  const host = hostname.split(':')[0]; // Remove port
  const parts = host.split('.');

  // Handle lvh.me (local dev)
  if (host.endsWith('.lvh.me') && parts.length >= 3) {
    return parts[0];
  }

  // Handle knotie-ai.pro or custom domains
  if (parts.length >= 3) {
    return parts[0];
  }

  return null;
}

