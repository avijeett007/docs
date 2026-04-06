import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { generateSecurePassword } from '@/lib/passwordUtils';
import { sendWhitelabelSignupEmail } from '@/lib/services/email-service';
import { getEffectivePortalLoginUrl } from '@/lib/portalUrlUtils';
import { logger } from '@/lib/logger';
import { getPartnerDefaultPlan, applyPlanFeaturesToCustomer } from '@/lib/services/planFeatureService';

export async function POST(request: NextRequest) {
  try {
    const { prospectId, partnerId, firstName, lastName, email, phone, businessName } = await request.json();

    if (!prospectId || !partnerId || !firstName || !lastName || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if customer already exists with this email for this partner
    const existingCredential = await prisma.customerCredential.findUnique({
      where: {
        partnerId_email: {
          partnerId: partnerId,
          email: email.toLowerCase().trim()
        }
      }
    });

    if (existingCredential) {
      return NextResponse.json({
        error: 'CUSTOMER_ALREADY_EXISTS',
        message: 'It looks like you already have an account with us. Please login to continue accessing your dashboard.',
        loginUrl: '/whitelabel/login'
      }, { status: 409 });
    }

    // Generate a secure but memorable temporary password
    const temporaryPassword = generateSecurePassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 12);

    // Get partner information for branding and auto-deploy config
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        businessName: true,
        subdomain: true,
        customDomain: true,
        customDomainVerified: true,
        logo: true,
        primaryColor: true,
        secondaryColor: true,
        autoDeployEnabled: true,
        planId: true,
        approvalStatus: true,
        customLandingPageUrl: true
      }
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    // Get the prospect to copy GHL contact ID
    const prospect = await prisma.prospect.findUnique({
      where: { id: prospectId },
      select: { ghlContactId: true }
    });

    // Generate unique userId for the customer
    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // Create customer account and credentials in a transaction
    let customer;
    try {
      customer = await prisma.customer.create({
        data: {
          userId: userId,
          email: email.toLowerCase().trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          businessName: `${firstName} ${lastName}`,
          status: 'active',
          customerPortalEnabled: true,
          // Copy GHL contact ID from prospect to avoid duplicate contact creation
          ghlContactId: prospect?.ghlContactId || null,
          isGhlSynced: prospect?.ghlContactId ? true : false,
          ghlSyncStatus: prospect?.ghlContactId ? 'synced' : 'pending'
        }
      });

      // Create customer credentials
      await prisma.customerCredential.create({
        data: {
          customerId: customer.id,
          partnerId: partnerId,
          email: email.toLowerCase().trim(),
          passwordHash: hashedPassword
        }
      });
    } catch (prismaError: any) {
      // Handle specific Prisma errors
      if (prismaError.code === 'P2002') {
        // Unique constraint violation
        if (prismaError.meta?.target?.includes('partner_id') && prismaError.meta?.target?.includes('email')) {
          return NextResponse.json({
            error: 'CUSTOMER_ALREADY_EXISTS',
            message: 'It looks like you already have an account with us. Please login to continue accessing your dashboard.',
            loginUrl: '/whitelabel/login'
          }, { status: 409 });
        }
      }
      // Re-throw other errors
      throw prismaError;
    }

    // Create UserOnboarding record for partner portal compatibility
    // If partner has autoDeployEnabled, automatically enable autoEmbeddingEnabled for customer
    // This allows Knowledge Base uploads during AI Receptionist onboarding to be auto-processed by AnythingLLM
    await prisma.userOnboarding.create({
      data: {
        userId: customer.userId,
        email: email.toLowerCase().trim(),
        firstName: firstName,
        lastName: lastName,
        companyName: businessName || `${firstName} ${lastName}`,
        partnerId: partnerId,
        customerId: customer.id,
        customerPortalEnabled: true,
        isOnboardingCompleted: false, // Will be completed when they finish full onboarding
        orderStatus: 'pending', // Default status
        autoEmbeddingEnabled: partner.autoDeployEnabled === true
      }
    });

    // Update prospect with customer conversion info
    await prisma.prospect.update({
      where: { id: prospectId },
      data: {
        convertedToCustomerId: customer.id,
        convertedAt: new Date(),
        firstName: firstName,
        lastName: lastName,
        email: email.toLowerCase().trim(),
        phone: phone
      }
    });

    // Apply partner's default plan features to the customer
    try {
      const defaultPlanId = await getPartnerDefaultPlan(partnerId);
      
      if (defaultPlanId) {
        logger.info('Applying default plan features to converted customer', {
          operation: 'convert-to-customer',
          partnerId,
          customerId: customer.id,
          planId: defaultPlanId
        });
        
        await applyPlanFeaturesToCustomer(defaultPlanId, customer.id, partnerId);
        
        logger.info('Successfully applied plan features to converted customer', {
          operation: 'convert-to-customer',
          partnerId,
          customerId: customer.id,
          planId: defaultPlanId
        });
      } else {
        logger.info('No default plan found for partner, skipping plan feature application', {
          operation: 'convert-to-customer',
          partnerId,
          customerId: customer.id
        });
      }
    } catch (planError) {
      // Log error but don't fail customer conversion - features can be applied manually later
      logger.error(
        'Failed to apply plan features during prospect conversion',
        planError instanceof Error ? planError : new Error(String(planError)),
        {
          operation: 'convert-to-customer',
          partnerId,
          customerId: customer.id
        }
      );
    }

    // Determine the login URL for the signup email.
    // getEffectivePortalLoginUrl returns the partner's custom landing page URL for
    // Starter/Enterprise partners, or the standard portal login URL otherwise.
    const loginUrl = getEffectivePortalLoginUrl(partner as any);

    // Send signup email using partner's email settings (SMTP → SES → Platform default)
    await sendWhitelabelSignupEmail({
      to: email,
      firstName: firstName,
      businessName: partner.businessName,
      temporaryPassword: temporaryPassword,
      loginUrl: loginUrl,
      partnerId: partnerId, // Pass partnerId to use partner's email settings
      partnerBranding: {
        logo: partner.logo || undefined,
        primaryColor: partner.primaryColor || undefined,
        secondaryColor: partner.secondaryColor || undefined,
        businessName: partner.businessName || 'Partner'
      }
    });

    return NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        name: `${firstName} ${lastName}`
      },
      message: 'Customer account created successfully. Check your email for login credentials.'
    });

  } catch (error) {
    logger.error('Error converting prospect to customer', error instanceof Error ? error : undefined, { operation: 'CONVERT_PROSPECT_TO_CUSTOMER' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
