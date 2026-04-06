import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';


/**
 * This route handles HTTP validation requests from Cloudflare for custom domain verification.
 * When Cloudflare attempts to verify a custom domain, it makes a request to:
 * http://custom-domain.com/.well-known/acme-challenge/[token]
 *
 * We need to respond with the correct validation body for the domain to be verified.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const token = params.token;

    if (!token) {
      return new NextResponse('Token is required', { status: 400 });
    }

    // Get the host from the request
    const host = request.headers.get('host');

    if (!host) {
      return new NextResponse('Host header is required', { status: 400 });
    }

    // Extract the domain from the host (remove port if present)
    const domain = host.split(':')[0];

    // First, try to find a partner with this exact validation URL
    let partner = await prisma.partner.findFirst({
      where: {
        customDomainHttpValidationUrl: {
          contains: token
        }
      }
    });

    // If not found, try to find a partner with this domain
    if (!partner) {
      partner = await prisma.partner.findFirst({
        where: {
          customDomain: domain
        }
      });
    }

    if (!partner) {
      console.error(`No partner found for domain ${domain} or token ${token}`);
      return new NextResponse('Domain not found', { status: 404 });
    }

    // If we have a specific validation body for this token, return it
    // Use type assertion to safely access the property
    const validationBody = (partner as any).customDomainHttpValidationBody;

    if (validationBody) {
      console.log(`Found validation body for ${domain}: ${validationBody}`);
      return new NextResponse(validationBody, {
        headers: {
          'Content-Type': 'text/plain'
        }
      });
    }

    // If we don't have a specific validation body, try a few fallbacks

    // 1. Special case for the default HTTP validation token
    if (token === 'http-validation') {
      console.log('Returning default HTTP validation response');
      return new NextResponse('http-validation', {
        headers: {
          'Content-Type': 'text/plain'
        }
      });
    }

    // 2. Return the token itself as a fallback
    // This works in many cases where Cloudflare expects the token as the response
    console.log(`Returning token as fallback validation response: ${token}`);
    return new NextResponse(token, {
      headers: {
        'Content-Type': 'text/plain'
      }
    });
  } catch (error) {
    console.error('Error handling ACME challenge:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
