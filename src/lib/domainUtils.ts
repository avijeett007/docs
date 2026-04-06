import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export interface DomainInfo {
  type: 'subdomain' | 'customDomain' | 'mainDomain' | 'unknown';
  partnerId?: string;
  partnerSubdomain?: string;
  partnerCustomDomain?: string;
}

// Extract domain information from the request
export function extractDomainInfo(request: NextRequest): { hostname: string, isSubdomain: boolean, subdomain: string | null } {
  const hostname = request.headers.get('host') || '';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'knotie-ai.pro';
  const isLocalhost = hostname.includes('localhost') || hostname.includes('127.0.0.1');
  
  // Handle local development
  if (isLocalhost) {
    // For local testing, check if subdomain is simulated via a query param
    const url = new URL(request.url);
    const simulatedSubdomain = url.searchParams.get('subdomain');
    
    if (simulatedSubdomain) {
      return {
        hostname,
        isSubdomain: true,
        subdomain: simulatedSubdomain
      };
    }
    
    return {
      hostname,
      isSubdomain: false,
      subdomain: null
    };
  }
  
  // Production domain handling
  const isSubdomain = hostname.endsWith(`.${baseUrl}`) && hostname !== `www.${baseUrl}`;
  
  if (isSubdomain) {
    const subdomain = hostname.replace(`.${baseUrl}`, '');
    return {
      hostname,
      isSubdomain: true,
      subdomain
    };
  }
  
  // Check if it's a custom domain (not the main domain)
  const isMainDomain = hostname === baseUrl || hostname === `www.${baseUrl}`;
  
  return {
    hostname,
    isSubdomain: false,
    subdomain: isMainDomain ? null : hostname // If not main domain, it might be a custom domain
  };
}

// Get partner information based on domain
export async function getPartnerFromDomain(request: NextRequest): Promise<DomainInfo> {
  const { hostname, isSubdomain, subdomain } = extractDomainInfo(request);
  
  // If it's a subdomain of our main domain
  if (isSubdomain && subdomain) {
    const partner = await prisma.partner.findFirst({
      where: {
        subdomain: subdomain,
        customerPortalEnabled: true
      },
      select: {
        id: true,
        customDomain: true
      }
    });
    
    if (partner) {
      return {
        type: 'subdomain',
        partnerId: partner.id,
        partnerSubdomain: subdomain
      };
    }
  } 
  // If it's potentially a custom domain
  else if (!isSubdomain && subdomain && subdomain !== hostname) {
    const partner = await prisma.partner.findFirst({
      where: {
        customDomain: hostname,
        customerPortalEnabled: true
      },
      select: {
        id: true,
        customDomain: true
      }
    });
    
    if (partner) {
      return {
        type: 'customDomain',
        partnerId: partner.id,
        partnerCustomDomain: partner.customDomain || undefined
      };
    }
  }
  
  // Main domain or unknown domain
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'knotie-ai.pro';
  const isMainDomain = hostname === baseUrl || hostname === `www.${baseUrl}`;
  
  return {
    type: isMainDomain ? 'mainDomain' : 'unknown'
  };
}

// A React hook to get the current partner ID from the x-partner-id header
export function usePartnerId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  
  // In the client, we can check for a partner ID in a meta tag
  const partnerIdMeta = document.querySelector('meta[name="partner-id"]');
  return partnerIdMeta ? partnerIdMeta.getAttribute('content') : null;
}
