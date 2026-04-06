import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyCustomerJWT } from '@/lib/customerJwt';
import { logger } from '@/lib/logger';

export interface CustomerAuthResult {
  customerId: string;
  credentialId: string | null;
  partnerId: string;
  email: string;
  isTeamMember: boolean;
  teamMemberId: string | null;
  role: string;
}

/**
 * Verify customer authentication from a request
 * Returns the authenticated customer or null if authentication fails
 */
export async function verifyCustomerAuth(request: NextRequest): Promise<CustomerAuthResult | null> {
  try {
    // Get token from request cookies
    const cookieHeader = request.cookies.get('customer_token')?.value;

    if (!cookieHeader) {
      return null;
    }

    // Verify JWT token
    const decoded = await verifyCustomerJWT(cookieHeader);

    if (!decoded || !decoded.customerId || !decoded.partnerId) {
      return null;
    }

    // Handle team member authentication
    if (decoded.isTeamMember && decoded.teamMemberId) {
      // For team members, verify the team member exists and is active
      const teamMember = await prisma.customerTeamMember.findUnique({
        where: { id: decoded.teamMemberId },
        include: {
          customer: true
        }
      });

      if (!teamMember || teamMember.status !== 'active' || teamMember.customerId !== decoded.customerId) {
        return null;
      }

      return {
        customerId: decoded.customerId,
        credentialId: null, // Team members don't have credentials
        partnerId: decoded.partnerId,
        email: decoded.email,
        isTeamMember: true,
        teamMemberId: decoded.teamMemberId,
        role: decoded.role || 'member' // Default to 'member' if role is undefined
      };
    }

    // Handle regular customer authentication
    if (!decoded.credentialId) {
      return null;
    }

    // Get customer from database
    const customer = await prisma.customer.findUnique({
      where: { id: decoded.customerId }
    });

    if (!customer) {
      return null;
    }

    // Get customer credential from database
    const credential = await prisma.customerCredential.findUnique({
      where: { id: decoded.credentialId }
    });

    if (!credential || credential.status !== 'active') {
      return null;
    }

    return {
      customerId: decoded.customerId,
      credentialId: decoded.credentialId,
      partnerId: decoded.partnerId,
      email: decoded.email,
      isTeamMember: false,
      teamMemberId: null,
      role: 'admin' // Regular customers are admins
    };
  } catch (error) {
    logger.error('Error verifying customer auth', error as Error, {
      operation: 'customer_auth'
    });
    return null;
  }
}
