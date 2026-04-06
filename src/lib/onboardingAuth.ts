import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyCustomerJWT } from '@/lib/customerJwt';
import { verifyProspectJWT } from '@/lib/prospectJwt';
import { logger } from './logger';

interface OnboardingAuthResult {
  customerId: string;
  partnerId: string;
  userId: string;
  authType: 'customer' | 'prospect';
}

/**
 * Verify authentication for onboarding-specific APIs
 * Supports both customer tokens (from cookies) and prospect tokens (from headers)
 * This should ONLY be used for onboarding-related APIs, not general whitelabel APIs
 */
export async function verifyOnboardingAuth(request: NextRequest): Promise<OnboardingAuthResult | null> {
  try {
    // First, try customer token from cookies (for returning customers)
    const cookieStore = cookies();
    const customerToken = cookieStore.get('customer_token')?.value;

    if (customerToken) {
      const payload = await verifyCustomerJWT(customerToken);
      if (payload) {
        const { customerId, partnerId } = payload;

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

        if (customer) {
          return {
            customerId,
            partnerId,
            userId: customer.userId,
            authType: 'customer'
          };
        }
      }
    }

    // Try prospect token from Authorization header (for first-time onboarding)
    const authHeader = request.headers.get('Authorization');

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const prospectToken = authHeader.split(' ')[1];
      const prospectPayload = await verifyProspectJWT(prospectToken);

      if (prospectPayload) {
        const { prospectId, customerId, partnerId } = prospectPayload;

        // Verify prospect and customer exist and are properly linked
        const prospect = await prisma.prospect.findUnique({
          where: { id: prospectId },
          select: {
            id: true,
            convertedToCustomerId: true,
            partnerId: true
          }
        });

        if (prospect && prospect.convertedToCustomerId === customerId && prospect.partnerId === partnerId) {
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

          if (customer) {
            return {
              customerId,
              partnerId,
              userId: customer.userId,
              authType: 'prospect'
            };
          }
        }
      }
    }

    return null;
  } catch (error) {
    logger.error('Error verifying onboarding auth', error as Error, {
      operation: 'onboarding_auth_verification'
    });
    return null;
  }
}
