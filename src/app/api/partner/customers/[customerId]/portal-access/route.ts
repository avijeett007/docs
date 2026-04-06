import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { generateSecurePassword } from '@/lib/utils';
import { hashPassword } from '@/lib/auth/password';
import { sendCustomerPortalInvite } from '@/lib/email';
import { getEffectivePortalBaseUrl } from '@/lib/portalUrlUtils';
import { checkMCPAuthIfPresent, PERMISSIONS } from '@/lib/auth/mcpAuthHelper';

/**
 * API route to enable/reset customer portal access
 * This creates or updates credentials and sends an email to the customer
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { customerId: string } }
) {
  try {
    console.log('Portal access API called for customer ID:', params.customerId);

    // Check for MCP authentication first
    const mcpAuth = await checkMCPAuthIfPresent(request, PERMISSIONS.CUSTOMER_PORTAL);

    // Handle MCP authentication errors
    if (mcpAuth.isMCP && mcpAuth.error) {
      return NextResponse.json({
        error: 'MCP Authentication Failed',
        message: mcpAuth.error
      }, { status: 401 });
    }

    let partner;

    if (mcpAuth.isMCP && !mcpAuth.error) {
      // Handle MCP request - find partner by ID
      partner = await prisma.partner.findFirst({
        where: {
          AND: [
            { id: mcpAuth.partnerId },
            { approvalStatus: 'ACTIVE' }
          ]
        }
      });

      if (!partner) {
        return NextResponse.json({
          error: 'Partner not found or not active',
          message: 'MCP partner account not found or not active.'
        }, { status: 403 });
      }
    } else {
      // Handle regular JWT request
      partner = await verifyPartnerAuth(request);
      if (!partner) {
        console.log('Partner authentication failed');
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    console.log('Partner authenticated successfully:', partner.id);

    const { customerId } = params;

    // Verify that the customer is associated with this partner through UserOnboarding
    console.log(`Looking for customer with ID: ${customerId} for partner: ${partner.id}`);

    // First check if the user onboarding record exists for this partner
    const userOnboarding = await prisma.userOnboarding.findFirst({
      where: {
        partnerId: partner.id,
        id: customerId
      },
      include: {
        partner: {
          select: {
            businessName: true,
            subdomain: true,
            customDomain: true,
            customDomainVerified: true,
            logo: true,
            primaryColor: true,
            secondaryColor: true,
            fontFamily: true,
            portalTitle: true,
            planId: true,
            approvalStatus: true,
            customLandingPageUrl: true
          }
        }
      }
    });

    if (!userOnboarding) {
      console.log(`UserOnboarding with ID ${customerId} not found for partner ${partner.id}`);
      return NextResponse.json(
        { error: 'Customer not found or not associated with this partner' },
        { status: 404 }
      );
    }

    console.log(`UserOnboarding ${customerId} found for partner ${partner.id}`);

    // Check if a Customer record exists for this user
    let customer = await prisma.customer.findFirst({
      where: {
        userId: userOnboarding.userId
      }
    });

    // If no Customer record exists, create one
    if (!customer) {
      console.log(`Creating new Customer record for userId ${userOnboarding.userId}`);
      customer = await prisma.customer.create({
        data: {
          userId: userOnboarding.userId,
          email: userOnboarding.email,
          firstName: userOnboarding.firstName || null,
          lastName: userOnboarding.lastName || null,
          customerPortalEnabled: true
        }
      });
      console.log(`Created new Customer record with ID ${customer.id}`);

      // IMPORTANT: Update the UserOnboarding record to link it to the Customer
      await prisma.userOnboarding.update({
        where: { id: customerId },
        data: { customerId: customer.id }
      });
      console.log(`Updated UserOnboarding record ${customerId} with customerId ${customer.id}`);
    } else {
      // Update the existing Customer record
      console.log(`Updating existing Customer record with ID ${customer.id}`);
      customer = await prisma.customer.update({
        where: {
          id: customer.id
        },
        data: {
          customerPortalEnabled: true
        }
      });

      // Ensure the UserOnboarding record is linked to the Customer
      if (!userOnboarding.customerId) {
        await prisma.userOnboarding.update({
          where: { id: customerId },
          data: { customerId: customer.id }
        });
        console.log(`Updated UserOnboarding record ${customerId} with customerId ${customer.id}`);
      }
    }

    console.log(`Customer record ready with ID ${customer.id}`);

    // Generate a secure temporary password
    const tempPassword = generateSecurePassword(12);
    const passwordHash = await hashPassword(tempPassword);

    // Find existing credentials
    const existingCredentials = await prisma.customerCredential.findFirst({
      where: {
        customerId: customer.id,
        partnerId: partner.id
      },
    });

    // Create or update customer credentials
    if (existingCredentials) {
      console.log(`Updating existing credentials for customer ${customer.id}`);
      // Update existing credentials
      await prisma.customerCredential.update({
        where: { id: existingCredentials.id },
        data: {
          passwordHash,
          resetToken: null,
          resetTokenExpiry: null,
          lastReset: new Date(),
          status: 'active'
        }
      });
    } else {
      console.log(`Creating new credentials for customer ${customer.id}`);
      // Create new credentials
      await prisma.customerCredential.create({
        data: {
          customerId: customer.id,
          partnerId: partner.id,
          email: customer.email,
          passwordHash,
          status: 'active',
          lastReset: new Date()
        }
      });
    }

    // Update UserOnboarding record to enable customer portal
    await prisma.userOnboarding.update({
      where: { id: customerId },
      data: {
        customerPortalEnabled: true
      }
    });

    // Determine the portal URL (root/base URL only — no action paths)
    const partnerData = userOnboarding.partner || {
      businessName: 'Your Agency',
      subdomain: null,
      customDomain: null,
      customDomainVerified: false,
      logo: null,
      primaryColor: '#3B82F6',
      secondaryColor: '#10B981',
      fontFamily: 'Arial, sans-serif',
      portalTitle: null,
      planId: null,
      approvalStatus: null,
      customLandingPageUrl: null
    };

    // Use getEffectivePortalBaseUrl so Starter/Enterprise partners can redirect
    // to their custom landing page. Falls back to the standard portal base URL.
    const portalUrl = getEffectivePortalBaseUrl(partnerData);

    console.log(`Portal URL for customer: ${portalUrl}`);

    // Send email to customer with portal access instructions
    console.log(`Sending portal invite email to ${customer.email}`);
    try {
      console.log('Preparing to send email with the following data:');
      console.log('- To:', customer.email);
      console.log('- First Name:', customer.firstName || 'Valued Customer');
      console.log('- Business Name:', partnerData.businessName || 'Your Agency');
      console.log('- Portal URL:', portalUrl);
      console.log('- Has Logo:', !!partnerData.logo);
      console.log('- Primary Color:', partnerData.primaryColor || '#3B82F6');
      console.log('- Secondary Color:', partnerData.secondaryColor || '#10B981');

      const emailResult = await sendCustomerPortalInvite({
        to: customer.email,
        firstName: customer.firstName || 'Valued Customer',
        businessName: partnerData.businessName || 'Your Agency',
        password: tempPassword,
        portalUrl,
        // Include partner branding
        partnerLogo: partnerData.logo || undefined,
        primaryColor: partnerData.primaryColor || '#3B82F6',
        secondaryColor: partnerData.secondaryColor || '#10B981',
        fontFamily: partnerData.fontFamily || 'Arial, sans-serif',
        portalTitle: partnerData.portalTitle || `${partnerData.businessName} Portal`
      }, partner.id); // Pass the partner ID to use their SMTP settings if available

      console.log('Email sending result:', emailResult);

      // Check if the email was sent successfully
      if (emailResult && !emailResult.success) {
        console.error('Email sending failed with result:', emailResult);
        // We'll continue execution but log the error
      }
    } catch (emailError: any) {
      console.error('Failed to send portal invite email:', emailError);
      console.error('Error details:', emailError.message);

      // Log more detailed error information if available
      if (emailError.response) {
        console.error('SendGrid error response:', {
          statusCode: emailError.response.statusCode,
          body: emailError.response.body,
          headers: emailError.response.headers
        });
      }

      // Continue execution even if email fails - we don't want to roll back the credential creation
      // but we should log the error for debugging
    }

    return NextResponse.json({
      success: true,
      message: `Portal access enabled and credentials sent to ${customer.email}`
    });
  } catch (error: any) {
    console.error('Error enabling customer portal:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to enable customer portal' },
      { status: 500 }
    );
  }
}
