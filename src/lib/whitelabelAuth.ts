import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyCustomerJWT } from '@/lib/customerJwt';
import { logger } from './logger';

interface AuthResult {
  customerId: string;
  partnerId: string;
  userId: string;
}

/**
 * Verify authentication for whitelabel portal
 * Returns customer ID and partner ID if authenticated
 * ONLY supports customer tokens (from cookies) - for security reasons
 * For onboarding APIs that need prospect token support, use verifyOnboardingAuth instead
 */
export async function verifyWhitelabelAuth(request: NextRequest): Promise<AuthResult | null> {
  try {
    // Get customer token from cookies (logged-in users only)
    const cookieStore = cookies();
    const customerToken = cookieStore.get('customer_token')?.value;

    if (!customerToken) {
      return null;
    }

    // Verify customer token
    const payload = await verifyCustomerJWT(customerToken);
    if (!payload) {
      return null;
    }

    // Get the customer ID and partner ID from the token
    const { customerId, partnerId } = payload;

    // Get the customer record to verify it exists and get the userId
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        userId: true,
        credentials: {
          where: { partnerId },
          select: { partnerId: true }
        }
      }
    });

    if (!customer) {
      return null;
    }

    // Return the customer ID, partner ID, and user ID
    return {
      customerId,
      partnerId,
      userId: customer.userId
    };
  } catch (error) {
    logger.error('Error verifying whitelabel auth', error as Error, {
      operation: 'whitelabel_auth'
    });
    return null;
  }
}
