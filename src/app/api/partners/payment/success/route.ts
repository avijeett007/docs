// Add dynamic route config at the top
export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateRandomPassword } from '@/lib/password-generator';
import { sendPartnerWelcomeEmail } from '@/lib/email';
import { headers } from 'next/headers';
import { getStripe } from '@/lib/stripe';
import Stripe from 'stripe';
import { securePublicRoute, validateStripeSession, ValidationSchemas } from '@/lib/security/publicRoutesSecurity';
import { isSessionAlreadyProcessed, markSessionAsProcessed } from '@/lib/security/sessionReplayProtection';


// Function to provision partner in analytics service
async function provisionPartnerInAnalytics(partner: {
  id: string;
  businessName: string;
  contactName: string;
  emailAddress: string;
}) {
  try {
    const analyticsApiUrl = process.env.ANALYTICS_API_URL || 'http://localhost:8001';
    const analyticsApiKey = process.env.ANALYTICS_ADMIN_API_KEY;

    if (!analyticsApiKey) {
      console.error('Missing ANALYTICS_ADMIN_API_KEY environment variable');
      return false;
    }

    const response = await fetch(`${analyticsApiUrl}/partners/provision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': analyticsApiKey
      },
      body: JSON.stringify({
        partner_id: partner.id,
        partner_name: partner.contactName || partner.businessName, // Required field - use contactName or fallback to businessName
        business_name: partner.businessName,
        contact_name: partner.contactName,
        email: partner.emailAddress
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Failed to provision partner in analytics:', errorData);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error provisioning partner in analytics:', error);
    return false;
  }
}

// GET /api/partners/payment/success - Handle successful Stripe payment
export async function GET(req: NextRequest) {
  try {
    // Apply security measures
    const securityCheck = await securePublicRoute(req, {
      rateLimitRequests: 5, // Very restrictive for payment success
      rateLimitWindowMs: 60 * 1000,
      requireOriginValidation: false, // Stripe redirects don't include origin
      allowedMethods: ['GET']
    });

    if (!securityCheck.success) {
      return securityCheck.response;
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');
    const partnerId = searchParams.get('partner_id');

    // Use the environment variable for the app URL instead of extracting from request
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    // Remove trailing slash if present
    const origin = appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl;

    if (!sessionId || !partnerId) {
      console.warn('Payment success called without required parameters', { sessionId: !!sessionId, partnerId: !!partnerId });
      return NextResponse.redirect(`${origin}/partners?error=invalid_session`);
    }

    // Validate input parameters
    try {
      ValidationSchemas.partnerId.parse(partnerId);
      ValidationSchemas.sessionId.parse(sessionId);
    } catch (validationError) {
      console.warn('Invalid parameters in payment success', { sessionId, partnerId, error: validationError });
      return NextResponse.redirect(`${origin}/partners?error=invalid_parameters`);
    }

    // Validate Stripe session with enhanced security
    const sessionValidation = await validateStripeSession(sessionId, partnerId);
    if (!sessionValidation.success) {
      console.warn('Stripe session validation failed', { sessionId, partnerId, error: sessionValidation.error });
      return NextResponse.redirect(`${origin}/partners?error=payment_verification_failed`);
    }

    const session = sessionValidation.session;

    // Check for session replay attacks
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     req.headers.get('x-real-ip') ||
                     'unknown';

    const alreadyProcessed = await isSessionAlreadyProcessed(sessionId, partnerId);
    if (alreadyProcessed) {
      console.warn('Attempted session replay detected', { sessionId, partnerId, clientIP });
      return NextResponse.redirect(`${origin}/partners?error=session_already_processed`);
    }

    // Mark session as being processed (prevents concurrent processing)
    try {
      await markSessionAsProcessed(sessionId, partnerId, clientIP);
    } catch (error) {
      console.warn('Session already being processed by another request', { sessionId, partnerId });
      return NextResponse.redirect(`${origin}/partners?error=session_already_processed`);
    }

    // Check payment status for all plans (including $0 subscriptions)
    if (session.payment_status !== 'paid') {
      return NextResponse.redirect(`${origin}/partners?error=payment_failed`);
    }

    // Check if this is a Google OAuth user (they don't need passwords)
    const existingPartner = await prisma.partner.findUnique({
      where: { id: partnerId }
    });

    const isGoogleUser = !!(existingPartner as any)?.googleId;
    let randomPassword = '';

    // Only set password for non-Google users
    if (!isGoogleUser) {
      randomPassword = generateRandomPassword();

      try {
        // Use INTERNAL_API_URL for server-to-server calls to prevent redirect loops
        // Falls back to NEXTAUTH_URL or localhost for backward compatibility
        const internalApiBaseUrl = process.env.INTERNAL_API_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';

        console.log(`🔧 Making internal API call to: ${internalApiBaseUrl}/api/partner/auth/set-password`);
        console.log(`📧 Setting password for email: ${session.customer_email}`);

        // Set password for the partner
        const response = await fetch(`${internalApiBaseUrl}/api/partner/auth/set-password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.PARTNER_API_KEY}`,
          },
          body: JSON.stringify({
            email: session.customer_email,
            password: randomPassword,
          }),
        });

        if (!response.ok) {
          let errorData;
          try {
            errorData = await response.json();
          } catch (jsonError) {
            // If response is not JSON, use status text
            errorData = { error: response.statusText || 'Unknown error' };
          }
          console.error(`❌ Set password API failed:`, {
            status: response.status,
            statusText: response.statusText,
            errorData,
            email: session.customer_email
          });
          throw new Error(`Failed to set password: ${errorData.error || 'Unknown error'}`);
        }

        console.log(`✅ Password set successfully for email: ${session.customer_email}`);

        // Try to parse response, but don't fail if it's empty
        try {
          await response.json();
        } catch (jsonError) {
          // Ignore JSON parsing errors for successful responses
          console.log('Set password response was not JSON (this is normal)');
        }
      } catch (passwordError) {
        console.error('Error setting password:', passwordError);
        throw passwordError;
      }
    }

    try {
      // Update partner status
      const updateData: any = {
        approvalStatus: 'ACTIVE' as const,
        stripeCustomerId: session.customer as string,
        subscriptionStatus: 'ACTIVE' as const,
      };

      // Set subscription ID if available (for all subscription-based plans including $0 subscriptions)
      if (session.subscription) {
        updateData.stripeSubscriptionId = session.subscription as string;
      }

      await prisma.partner.update({
        where: { id: partnerId },
        data: updateData,
      });

      // Get partner data for email
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: {
          businessName: true,
          emailAddress: true,
          contactName: true,
        },
      });

      if (!partner) {
        throw new Error('Partner not found');
      }

      // Provision partner in analytics service
      const analyticsResult = await provisionPartnerInAnalytics({
        id: partnerId,
        businessName: partner.businessName,
        contactName: partner.contactName || partner.businessName,
        emailAddress: partner.emailAddress,
      });

      if (!analyticsResult) {
        // Log the error but continue with the process
        console.warn('Partner provisioning in analytics service failed, but continuing with onboarding');
      } else {
        console.log(`Successfully provisioned partner ${partnerId} in analytics service`);
      }

      // Send welcome email (with password only for non-Google users)
      if (isGoogleUser) {
        // For Google users, send welcome email without password
        await sendPartnerWelcomeEmail({
          to: partner.emailAddress,
          businessName: partner.businessName,
          isGoogleUser: true,
        });
      } else {
        // For regular users, send welcome email with password
        await sendPartnerWelcomeEmail({
          to: partner.emailAddress,
          businessName: partner.businessName,
          password: randomPassword,
        });
      }

      // Redirect to success page with absolute URL
      return NextResponse.redirect(`${origin}/partners/welcome`);

    } catch (error) {
      console.error('Error in partner setup:', error);
      return NextResponse.redirect(`${origin}/partners?error=setup_failed`);
    }
  } catch (error) {
    console.error('Error processing payment success:', error);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const origin = appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl;
    return NextResponse.redirect(`${origin}/partners?error=payment_verification_failed`);
  }
}
