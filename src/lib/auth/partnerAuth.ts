import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyJWT } from '@/lib/jwt';
import { logger } from '@/lib/logger';

/**
 * Verify partner authentication from a request
 * Returns the authenticated partner or null if authentication fails
 * Supports both Authorization header (Bearer token) and cookie-based authentication
 */
export async function verifyPartnerAuth(request: NextRequest) {
  try {
    let token: string | null = null;

    // First, try to get token from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    // If no Authorization header token, try cookies as fallback
    if (!token) {
      token = cookies().get('partner_token')?.value || null;
    }

    if (!token) {
      return null;
    }

    // Verify JWT token using the shared JWT verification function
    const decoded = await verifyJWT(token);

    if (!decoded || !decoded.partnerId) {
      return null;
    }

    // Get partner from database
    const partner = await prisma.partner.findUnique({
      where: { id: decoded.partnerId }
    });

    return partner;
  } catch (error) {
    logger.error('Error verifying partner auth', error as Error, {
      operation: 'partner_auth'
    });
    return null;
  }
}

/**
 * Extract partner ID from request
 * Returns the partner ID or null if authentication fails
 */
export async function getPartnerIdFromRequest(request: NextRequest): Promise<string | null> {
  const partner = await verifyPartnerAuth(request);
  return partner?.id || null;
}
