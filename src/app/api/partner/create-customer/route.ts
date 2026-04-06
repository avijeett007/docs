import { NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { calculatePrice, type PricingInput, type CallVolumeRangeKey, type ComplexityKey } from '@/lib/pricing';
import type { NextRequest } from 'next/server';
import { backgroundQueue } from '@/lib/backgroundJobs';
import { makeGHLRequest } from '@/lib/crm';
import { decrypt } from '@/lib/encryption';
import { checkMCPAuthIfPresent, PERMISSIONS } from '@/lib/auth/mcpAuthHelper';
import { generateSecurePassword } from '@/lib/utils';
import { hashPassword } from '@/lib/auth/password';
import { sendCustomerPortalInvite } from '@/lib/email';
import { getEffectivePortalBaseUrl } from '@/lib/portalUrlUtils';
import { applyPlanFeaturesToCustomer, getPartnerDefaultPlan } from '@/lib/services/planFeatureService';
import { logger } from '@/lib/logger';

if (!process.env.CLERK_SECRET_KEY) {
  throw new Error('Missing CLERK_SECRET_KEY environment variable');
}

export async function POST(request: NextRequest) {
  try {
    // Check for MCP authentication first
    const mcpAuth = await checkMCPAuthIfPresent(request, PERMISSIONS.CUSTOMER_CREATE);

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
      // Get token from cookies or Authorization header
      let token = cookies().get('partner_token')?.value;

    // If no cookie token, check Authorization header
    if (!token) {
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return NextResponse.json({
        error: 'Unauthorized',
        message: 'No partner token found'
      }, { status: 401 });
    }

    // Verify JWT token
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      return NextResponse.json({ 
        error: 'Server configuration error', 
        message: 'JWT secret not configured' 
      }, { status: 500 });
    }

    let decodedToken;
    try {
      decodedToken = jwt.verify(token, JWT_SECRET) as { email: string };
    } catch (error) {
      return NextResponse.json({ 
        error: 'Invalid token', 
        message: 'Your session has expired. Please log in again.' 
      }, { status: 401 });
    }

      // Get partner using the JWT token's user ID
      partner = await prisma.partner.findFirst({
        where: {
          AND: [
            { emailAddress: decodedToken.email },
            { approvalStatus: 'ACTIVE' }
          ]
        }
      });

      if (!partner) {
        return NextResponse.json({
          error: 'Partner not found or not active',
          message: 'Please ensure your partner account is active before onboarding customers.'
        }, { status: 403 });
      }
    } // End of MCP/JWT authentication block

    // Parse request body (works for both MCP and JWT requests)
    const body = await request.json();
    console.log('Request body:', body);

    // Extract data from the form sections
    const { basic, business, requirements, integration, deployment, isQuickOnboarding, allowPortalAccess, planId } = body;

    // Validate required fields
    if (!basic?.email) {
      return NextResponse.json({
        error: 'Customer email is required',
        message: 'Please provide a valid email address for the customer.'
      }, { status: 400 });
    }

    // Check if a user with this email already exists for this partner
    const existingUser = await prisma.userOnboarding.findFirst({
      where: {
        email: basic.email,
        partnerId: partner.id
      }
    });

    if (existingUser) {
      return NextResponse.json({
        error: 'User already exists',
        message: 'A customer with this email already exists for your account.'
      }, { status: 400 });
    }

    // Check if this is a partner onboarding themselves
    const isPartnerSelfOnboarding = basic.email === partner.emailAddress;

    // Calculate pricing based on form data
    let priceBreakdown;

    if (isQuickOnboarding) {
      // Use default pricing for quick onboarding
      const defaultPricingInput: PricingInput = {
        monthlyCallVolume: "0-1000",
        callComplexity: "Moderate",
        scriptComplexity: "Moderate"
      };
      priceBreakdown = calculatePrice(defaultPricingInput);
      console.log('Quick onboarding - using default price breakdown:', priceBreakdown);
    } else {
      // Full onboarding - calculate based on actual form data
      const monthlyCallVolume: CallVolumeRangeKey = (() => {
        switch (business.monthlyCallVolume) {
          case "Up to 100 calls":
          case "101-500 calls":
          case "501-1000 calls": return "0-1000";
          case "1001-5000 calls": return "1001-5000";
          case "Over 5000 calls": return "5001-10000";
          default: return "0-1000";
        }
      })();

      const callComplexity: ComplexityKey = requirements.callComplexity === 'Simple' ? 'Simple' :
                            requirements.callComplexity === 'Moderate' ? 'Moderate' : 'Complex';

      const scriptComplexity: ComplexityKey = requirements.scriptComplexity === 'Simple' ? 'Simple' :
                              requirements.scriptComplexity === 'Moderate' ? 'Moderate' : 'Complex';

      const pricingInput: PricingInput = {
        monthlyCallVolume,
        callComplexity,
        scriptComplexity
      };

      priceBreakdown = calculatePrice(pricingInput);
      console.log('Full onboarding - calculated price breakdown:', priceBreakdown);
    }

    // Create user onboarding record with pricing information
    const userOnboarding = await prisma.userOnboarding.create({
      data: {
        partnerId: partner.id,
        userId: 'temp_' + Math.random().toString(36).substring(7), // Temporary userId until Clerk integration is fixed
        email: basic.email,
        firstName: basic.firstName,
        lastName: basic.lastName,
        businessPhone: basic.businessPhone,
        companyName: business.companyName,
        monthlyCallVolume: business.monthlyCallVolume,
        peakHours: business.peakHours || (isQuickOnboarding ? 'Business Hours (9 AM - 5 PM)' : undefined),
        primaryUseCase: requirements.primaryUseCase || (isQuickOnboarding ? 'Customer Support' : undefined),
        callComplexity: requirements.callComplexity || (isQuickOnboarding ? 'Medium' : undefined),
        scriptComplexity: requirements.scriptComplexity || (isQuickOnboarding ? 'Medium' : undefined),
        crmSystem: integration.crmSystem || (isQuickOnboarding ? 'None' : undefined),
        phoneSystem: integration.phoneSystem || (isQuickOnboarding ? 'Cloud-based' : undefined),
        deploymentTimeline: deployment.deploymentTimeline || (isQuickOnboarding ? '1-2 weeks' : undefined),
        wantsDemo: deployment.wantsDemo === 'Yes' || (isQuickOnboarding ? false : undefined),
        isOnboardingCompleted: true,
        estimatedPrice: priceBreakdown.totalPrice || 0,
        priceBreakdown: JSON.stringify(priceBreakdown.breakdown || {}),
        orderStatus: 'PENDING',
        languages: JSON.stringify(requirements.languages || ['English']),
        customAutomation: requirements.customAutomation || (isQuickOnboarding ? 'Standard package' : undefined),
        // Mark partner-associated accounts
        ...(isPartnerSelfOnboarding && {
          orderStatus: 'PARTNER_SELF_ONBOARDING',
          dealStatus: 'PARTNER_ACCOUNT'
        })
      }
    });

    // Prepare contact data for CRM
    const contactData = {
      email: basic.email,
      firstName: basic.firstName,
      lastName: basic.lastName,
      companyName: business.companyName,
      phone: basic.businessPhone,
      tags: [`knotie-ai-pro-partner-${partner.id}`], // Tag with partner ID
    };

    // Update our CRM asynchronously
    backgroundQueue.addJob(
      `update-our-crm-${userOnboarding.id}`,
      async () => {
        try {
          const response = await makeGHLRequest(
            `${process.env.NEXT_PUBLIC_GOHIGHLEVEL_API_URL}/contacts/`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.GOHIGHLEVEL_BEARER_TOKEN}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(contactData),
            }
          );
          console.log('Our CRM updated successfully:', response);
        } catch (error) {
          console.error('Error updating our CRM:', error);
        }
      }
    );

    // Update partner's CRM asynchronously if they have GHL credentials
    if (partner.ghlApiKey) {
      backgroundQueue.addJob(
        `update-partner-crm-${userOnboarding.id}`,
        async () => {
          try {
            const decryptedApiKey = await decrypt(partner.ghlApiKey!);
            const response = await makeGHLRequest(
              `${process.env.NEXT_PUBLIC_GOHIGHLEVEL_API_URL}/contacts/`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${decryptedApiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  ...contactData,
                  tags: ['knotie-ai-customer-onboarded'], // Tag for partner's CRM
                }),
              }
            );
            console.log('Partner CRM updated successfully:', response);
          } catch (error) {
            console.error('Error updating partner CRM:', error);
          }
        }
      );
    }

    // Enable portal access if requested
    if (allowPortalAccess === true) {
      try {
        console.log(`Enabling portal access for customer ${userOnboarding.id}`);

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

          // Update the UserOnboarding record to link it to the Customer
          await prisma.userOnboarding.update({
            where: { id: userOnboarding.id },
            data: { customerId: customer.id }
          });
          console.log(`Updated UserOnboarding record ${userOnboarding.id} with customerId ${customer.id}`);
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
              where: { id: userOnboarding.id },
              data: { customerId: customer.id }
            });
            console.log(`Updated UserOnboarding record ${userOnboarding.id} with customerId ${customer.id}`);
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
          where: { id: userOnboarding.id },
          data: {
            customerPortalEnabled: true
          }
        });

        // Determine the portal URL (root/base URL only — no action paths)
        // Use getEffectivePortalBaseUrl so Starter/Enterprise partners can redirect
        // to their custom landing page. Falls back to the standard portal base URL.
        const portalUrl = getEffectivePortalBaseUrl(partner as any);

        console.log(`Portal URL for customer: ${portalUrl}`);

        // Send email to customer with portal access instructions
        console.log(`Sending portal invite email to ${customer.email}`);
        try {
          const emailResult = await sendCustomerPortalInvite({
            to: customer.email,
            firstName: customer.firstName || 'Valued Customer',
            businessName: partner.businessName || 'Your Agency',
            password: tempPassword,
            portalUrl,
            // Include partner branding
            partnerLogo: partner.logo || undefined,
            primaryColor: partner.primaryColor || '#3B82F6',
            secondaryColor: partner.secondaryColor || '#10B981',
            fontFamily: partner.fontFamily || 'Arial, sans-serif',
            portalTitle: partner.portalTitle || `${partner.businessName} Portal`
          }, partner.id);

          console.log('Email sending result:', emailResult);

          if (emailResult && !emailResult.success) {
            console.error('Email sending failed with result:', emailResult);
          }
        } catch (emailError: any) {
          console.error('Failed to send portal invite email:', emailError);
          console.error('Error details:', emailError.message);
          // Continue execution even if email fails
        }

        console.log(`Portal access enabled successfully for customer ${userOnboarding.id}`);

        // Apply plan features to the customer
        // First try using provided planId, then fall back to partner's default plan
        if (customer) {
          try {
            let planIdToApply = planId;
            
            if (!planIdToApply) {
              // No planId provided - get partner's default plan
              planIdToApply = await getPartnerDefaultPlan(partner.id);
              
              if (planIdToApply) {
                logger.info('No planId provided during partner customer creation, using partner default plan', {
                  operation: 'partner-create-customer',
                  partnerId: partner.id,
                  customerId: customer.id,
                  planId: planIdToApply
                });
              } else {
                logger.info('No planId provided and no default plan found, skipping plan feature application', {
                  operation: 'partner-create-customer',
                  partnerId: partner.id,
                  customerId: customer.id
                });
              }
            }
            
            if (planIdToApply) {
              logger.info('Applying plan features during partner customer creation', {
                operation: 'partner-create-customer',
                planId: planIdToApply,
                customerId: customer.id,
                partnerId: partner.id
              });
              
              await applyPlanFeaturesToCustomer(planIdToApply, customer.id, partner.id);
              
              logger.info('Successfully applied plan features to customer', {
                operation: 'partner-create-customer',
                planId: planIdToApply,
                customerId: customer.id,
                partnerId: partner.id
              });
            }
          } catch (planError) {
            logger.error(
              'Failed to apply plan features during partner customer creation',
              planError instanceof Error ? planError : new Error(String(planError)),
              {
                operation: 'partner-create-customer',
                customerId: customer.id,
                partnerId: partner.id,
                planId
              }
            );
          }
        }
      } catch (portalError) {
        console.error('Error enabling portal access:', portalError);
        // Don't fail the entire request if portal access fails
        // The customer was created successfully, portal access can be enabled later
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Customer onboarded successfully',
      data: userOnboarding
    });

  } catch (error) {
    console.error('Error in create-customer route:', error);
    return NextResponse.json({ 
      error: 'Failed to create customer', 
      message: 'An error occurred while creating the customer. Please try again.'
    }, { status: 500 });
  }
}