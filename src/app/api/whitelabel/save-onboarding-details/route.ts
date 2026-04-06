import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendEmail } from '@/lib/email';
import { getPartnerDefaultPlan, applyPlanFeaturesToCustomer } from '@/lib/services/planFeatureService';

// KnotieManager URL for auto-deploy jobs
const KNOTIE_MANAGER_URL = process.env.KNOTIE_MANAGER_URL || 'http://localhost:3003';
const KNOTIE_MANAGER_API_KEY = process.env.KNOTIE_MANAGER_API_KEY;

/**
 * Send support notification email when auto-deploy fails
 */
async function sendAutoDeployFailureNotification(params: {
  partnerId: string;
  partnerName: string;
  customerId: string;
  customerEmail: string;
  customerName: string;
  businessName: string;
  error: string;
}): Promise<void> {
  try {
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #dc2626;">⚠️ Auto-Deploy Failed - Manual Action Required</h2>

        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #991b1b;">Error Details</h3>
          <p style="color: #7f1d1d;"><strong>Error:</strong> ${params.error}</p>
        </div>

        <h3>Partner Information</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Partner ID:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${params.partnerId}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Partner Name:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${params.partnerName}</td>
          </tr>
        </table>

        <h3>Customer Information</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Customer ID:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${params.customerId}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Customer Name:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${params.customerName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Customer Email:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${params.customerEmail}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Business Name:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${params.businessName}</td>
          </tr>
        </table>

        <div style="margin-top: 20px; padding: 15px; background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px;">
          <p style="margin: 0; color: #92400e;">
            <strong>Action Required:</strong> Please investigate this failure and consider contacting the partner
            to assist with manual deployment steps if necessary.
          </p>
        </div>

        <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
          Timestamp: ${new Date().toISOString()}
        </p>
      </div>
    `;

    await sendEmail({
      to: 'support@knotie-ai.pro',
      subject: `[Auto-Deploy Failed] ${params.partnerName} - ${params.businessName}`,
      html: emailHtml,
      from: 'notification@knotie-ai.pro',
      fromName: 'Knotie AI Pro - System Alert',
      emailType: 'auto_deploy_failure'
    });

    logger.info('[AutoDeploy] Failure notification email sent to support', {
      partnerId: params.partnerId,
      customerId: params.customerId
    });
  } catch (emailError) {
    // Log but don't throw - this is a best-effort notification
    logger.error(
      '[AutoDeploy] Failed to send failure notification email',
      emailError instanceof Error ? emailError : new Error('Unknown error')
    );
  }
}

/**
 * Send notification to partner about insufficient credits for auto-deploy
 */
async function sendInsufficientCreditsNotification(params: {
  partnerId: string;
  partnerEmail: string;
  partnerName: string;
  customerId: string;
  customerEmail: string;
  customerName: string;
  businessName: string;
  telephonyCreditBalanceCents: number;
  creditBalance: number;
  minTelephonyCreditsCents: number;
  minKnotieCredits: number;
}): Promise<void> {
  try {
    const telephonyBalanceDollars = (params.telephonyCreditBalanceCents / 100).toFixed(2);
    const minTelephonyDollars = (params.minTelephonyCreditsCents / 100).toFixed(2);

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
          <h1 style="color: white; margin: 0; font-size: 24px;">⚠️ Auto-Deployment Pending - Credits Required</h1>
        </div>

        <div style="background: #f8f9fa; padding: 25px; border-radius: 10px; margin-bottom: 25px;">
          <h2 style="color: #333; margin-top: 0;">New Customer Onboarded</h2>
          <p><strong>Customer Name:</strong> ${params.customerName}</p>
          <p><strong>Business Name:</strong> ${params.businessName}</p>
          <p><strong>Email Address:</strong> ${params.customerEmail}</p>
        </div>

        <div style="background: #fef3c7; border: 1px solid #fcd34d; padding: 20px; border-radius: 10px; margin-bottom: 25px;">
          <h3 style="color: #b45309; margin-top: 0;">💰 Insufficient Credits</h3>
          <p style="color: #92400e;">
            Auto-deployment is on hold because your credit balance is below the required minimum.
          </p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <tr>
              <td style="padding: 8px 0;"><strong>Your Telephony Credits:</strong></td>
              <td style="padding: 8px 0; text-align: right; color: ${params.telephonyCreditBalanceCents < params.minTelephonyCreditsCents ? '#dc2626' : '#059669'}; font-weight: bold;">$${telephonyBalanceDollars}</td>
              <td style="padding: 8px 0; text-align: right; color: #666;">(min: $${minTelephonyDollars})</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Your Knotie Credits:</strong></td>
              <td style="padding: 8px 0; text-align: right; color: ${params.creditBalance < params.minKnotieCredits ? '#dc2626' : '#059669'}; font-weight: bold;">${params.creditBalance}</td>
              <td style="padding: 8px 0; text-align: right; color: #666;">(min: ${params.minKnotieCredits})</td>
            </tr>
          </table>
        </div>

        <div style="background: #e0f2fe; border: 1px solid #7dd3fc; padding: 20px; border-radius: 10px; margin-bottom: 25px;">
          <h3 style="color: #0369a1; margin-top: 0;">📋 Next Steps</h3>
          <ol style="color: #0c4a6e; padding-left: 20px; margin: 0;">
            <li style="margin-bottom: 10px;">Add more credits to your account in the Partner Portal</li>
            <li style="margin-bottom: 10px;">Go to the Customers page and find this customer</li>
            <li style="margin-bottom: 10px;">Click the "Continue Deployment" button to resume auto-deployment</li>
          </ol>
        </div>

        <div style="text-align: center; padding: 20px; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 14px; margin: 0;">
            This is an automated notification from your Knotie AI Pro system.
          </p>
        </div>
      </div>
    `;

    await sendEmail({
      to: params.partnerEmail,
      subject: `⚠️ Auto-Deployment Pending - Credits Required - ${params.businessName}`,
      html: emailHtml,
      from: 'notification@knotie-ai.pro',
      fromName: 'Knotie AI Pro',
      emailType: 'insufficient_credits_notification'
    });

    logger.info('[AutoDeploy] Insufficient credits notification sent to partner', {
      partnerId: params.partnerId,
      partnerEmail: params.partnerEmail,
      customerId: params.customerId
    });
  } catch (emailError) {
    logger.error(
      '[AutoDeploy] Failed to send insufficient credits notification',
      emailError instanceof Error ? emailError : new Error('Unknown error')
    );
  }
}

/**
 * Queue auto-deploy job to KnotieManager
 * This is called when partner has autoDeployEnabled flag set to true
 */
async function queueAutoDeployJob(params: {
  customerId: string;
  partnerId: string;
  prospectId: string;
  customerEmail: string;
  customerFirstName: string;
  customerLastName: string;
  customerPhone?: string;
  businessName: string;
  country?: string;
}): Promise<{ success: boolean; jobId?: string; error?: string }> {
  try {
    if (!KNOTIE_MANAGER_API_KEY) {
      logger.error('[AutoDeploy] KNOTIE_MANAGER_API_KEY not configured');
      return { success: false, error: 'KnotieManager API key not configured' };
    }

    const response = await fetch(`${KNOTIE_MANAGER_URL}/api/auto-deploy/queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-api-key': KNOTIE_MANAGER_API_KEY
      },
      body: JSON.stringify(params)
    });

    const data = await response.json();

    if (!response.ok) {
      logger.warn('[AutoDeploy] Failed to queue auto-deploy job', {
        operation: 'auto-deploy-queue',
        customerId: params.customerId,
        partnerId: params.partnerId
      });
      return { success: false, error: data.error || data.message };
    }

    logger.info('[AutoDeploy] Auto-deploy job queued successfully', {
      operation: 'auto-deploy-queue',
      customerId: params.customerId
    });

    return { success: true, jobId: data.jobId };
  } catch (error) {
    logger.error(
      '[AutoDeploy] Error queuing auto-deploy job',
      error instanceof Error ? error : new Error('Unknown error'),
      { operation: 'auto-deploy-queue', customerId: params.customerId }
    );
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      prospectId,
      partnerId,
      firstName,
      lastName,
      email,
      phone,
      businessName,
      selectedPricingPlan
    } = await request.json();

    if (!prospectId || !partnerId || !firstName || !lastName || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get the existing customer (created in Step 3) through CustomerCredential
    const customerCredential = await prisma.customerCredential.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        partnerId: partnerId
      },
      include: {
        customer: true
      }
    });

    if (!customerCredential || !customerCredential.customer) {
      return NextResponse.json({
        error: 'Customer not found. Please complete Step 3 first.'
      }, { status: 404 });
    }

    const customer = customerCredential.customer;

    // Fetch partner to check autoDeployEnabled flag and credit balances
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        id: true,
        autoDeployEnabled: true,
        businessName: true,
        telephonyCreditBalanceCents: true,
        creditBalance: true, // Knotie credits
        emailAddress: true,
        planId: true, // For free forever partner detection
      }
    });

    // Helper function to check if partner is on free forever plan
    const isFreeForeverPartner = (planId: string | null): boolean => {
      if (!planId) return false;
      const freeForeverPriceId = process.env.STRIPE_FREE_FOREVER_PRICE_ID;
      return (
        planId === 'free_forever_trial' ||
        planId === 'free_forever' ||
        (freeForeverPriceId !== undefined && planId === freeForeverPriceId)
      );
    };

    // Credit thresholds for auto-deploy (only checked when autoDeployEnabled is true)
    // Free forever partners require $10, others require $5
    const isFreeForever = isFreeForeverPartner(partner?.planId || null);
    const MIN_TELEPHONY_CREDITS_CENTS = isFreeForever ? 1000 : 500; // $10.00 for free forever, $5.00 for others
    const MIN_KNOTIE_CREDITS = 200; // 200 Knotie credits minimum

    // Get prospect data for country information
    const prospect = await prisma.prospect.findUnique({
      where: { id: prospectId },
      select: {
        id: true,
        businessCountry: true,
        businessName: true
      }
    });

    // Update the prospect record with final completion status
    await prisma.prospect.update({
      where: { id: prospectId },
      data: {
        currentStep: 9,
        isCompleted: true,
        updatedAt: new Date()
      }
    });

    // Check if partner has sufficient credits for auto-deploy
    const hasSufficientTelephonyCredits = (partner?.telephonyCreditBalanceCents || 0) >= MIN_TELEPHONY_CREDITS_CENTS;
    const hasSufficientKnotieCredits = (partner?.creditBalance || 0) >= MIN_KNOTIE_CREDITS;
    const hasSufficientCredits = hasSufficientTelephonyCredits && hasSufficientKnotieCredits;

    // Determine deployment status based on auto-deploy and credit availability
    let deploymentStatus = 'not_started';
    if (partner?.autoDeployEnabled) {
      deploymentStatus = hasSufficientCredits ? 'queued' : 'pending_credits';
    }

    // Update customer record with completion timestamp and deployment request
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        updatedAt: new Date(),
        deploymentStatus: deploymentStatus,
        deploymentRequestedAt: new Date()
      }
    });

    logger.info(`Onboarding completed for customer ${customer.id} (${email})`, {
      autoDeployEnabled: partner?.autoDeployEnabled,
      partnerId,
      hasSufficientCredits,
      deploymentStatus
    });

    // Apply plan features to customer
    try {
      let planIdToApply: string | undefined = undefined;

      // Priority 1: Use the plan selected by user in Step9 (if provided)
      if (selectedPricingPlan) {
        planIdToApply = selectedPricingPlan;
        logger.info('Using plan selected by user in onboarding wizard', {
          operation: 'save-onboarding-details',
          customerId: customer.id,
          partnerId,
          planId: planIdToApply,
          source: 'user-selected'
        });
      } else {
        // Priority 2: Check if customer has an active subscription
        const activeSubscription = await prisma.customerSubscription.findFirst({
          where: {
            customerId: customer.id,
            partnerId: partnerId,
            status: {
              in: ['active', 'trialing', 'past_due']
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          select: {
            planId: true,
            plan: {
              select: {
                name: true
              }
            }
          }
        });

        if (activeSubscription) {
          planIdToApply = activeSubscription.planId;
          logger.info('Found active subscription for customer, using subscription plan', {
            operation: 'save-onboarding-details',
            customerId: customer.id,
            partnerId,
            planId: planIdToApply,
            planName: activeSubscription.plan.name,
            source: 'active-subscription'
          });
        } else {
          // Priority 3: Fall back to partner's default plan
          planIdToApply = (await getPartnerDefaultPlan(partnerId)) ?? undefined;
          if (planIdToApply) {
            logger.info('No user selection or active subscription, using partner default plan', {
              operation: 'save-onboarding-details',
              customerId: customer.id,
              partnerId,
              planId: planIdToApply,
              source: 'default-plan'
            });
          } else {
            logger.info('No plan selected, no subscription, and no default plan found - skipping plan feature application', {
              operation: 'save-onboarding-details',
              customerId: customer.id,
              partnerId
            });
          }
        }
      }

      // Apply plan features if we found a plan
      if (planIdToApply) {
        await applyPlanFeaturesToCustomer(planIdToApply, customer.id, partnerId);
        logger.info('Successfully applied plan features after onboarding completion', {
          operation: 'save-onboarding-details',
          customerId: customer.id,
          partnerId,
          planId: planIdToApply
        });
      }
    } catch (planError) {
      // Log error but don't fail onboarding - features can be applied manually later
      logger.error(
        'Failed to apply plan features during onboarding completion',
        planError instanceof Error ? planError : new Error(String(planError)),
        {
          operation: 'save-onboarding-details',
          customerId: customer.id,
          partnerId,
          selectedPricingPlan
        }
      );
    }

    // If partner has autoDeployEnabled, check credits and queue the auto-deploy job
    let autoDeployResult: { success: boolean; jobId?: string; error?: string; pendingCredits?: boolean } | null = null;

    if (partner?.autoDeployEnabled) {
      if (!hasSufficientCredits) {
        // Insufficient credits - hold deployment and notify partner
        logger.info('[AutoDeploy] Insufficient credits for auto-deploy, holding deployment', {
          partnerId,
          customerId: customer.id,
          telephonyCreditBalanceCents: partner.telephonyCreditBalanceCents,
          creditBalance: partner.creditBalance,
          hasSufficientTelephonyCredits,
          hasSufficientKnotieCredits
        });

        // Send notification to partner about insufficient credits
        await sendInsufficientCreditsNotification({
          partnerId: partnerId,
          partnerEmail: partner.emailAddress,
          partnerName: partner.businessName || 'Partner',
          customerId: customer.id,
          customerEmail: email,
          customerName: `${firstName} ${lastName}`,
          businessName: businessName || prospect?.businessName || 'Unknown Business',
          telephonyCreditBalanceCents: partner.telephonyCreditBalanceCents,
          creditBalance: partner.creditBalance,
          minTelephonyCreditsCents: MIN_TELEPHONY_CREDITS_CENTS,
          minKnotieCredits: MIN_KNOTIE_CREDITS
        });

        autoDeployResult = {
          success: false,
          pendingCredits: true,
          error: 'Insufficient credits for auto-deployment'
        };
      } else {
        // Sufficient credits - proceed with auto-deploy
        logger.info('[AutoDeploy] Partner has autoDeployEnabled and sufficient credits, queuing auto-deploy job', {
          partnerId,
          customerId: customer.id
        });

        autoDeployResult = await queueAutoDeployJob({
          customerId: customer.id,
          partnerId: partnerId,
          prospectId: prospectId,
          customerEmail: email,
          customerFirstName: firstName,
          customerLastName: lastName,
          customerPhone: phone,
          businessName: businessName || prospect?.businessName || '',
          country: prospect?.businessCountry || undefined
        });

        if (!autoDeployResult.success) {
          // Log the error but don't fail the request - manual deployment is still possible
          logger.warn('[AutoDeploy] Failed to queue auto-deploy job, manual deployment required', {
            operation: 'auto-deploy-queue',
            customerId: customer.id
          });

          // Send support notification email
          await sendAutoDeployFailureNotification({
            partnerId: partnerId,
            partnerName: partner.businessName || 'Unknown Partner',
            customerId: customer.id,
            customerEmail: email,
            customerName: `${firstName} ${lastName}`,
            businessName: businessName || prospect?.businessName || 'Unknown Business',
            error: autoDeployResult.error || 'Unknown error'
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Onboarding details saved successfully',
      customer: {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName
      },
      autoDeploy: partner?.autoDeployEnabled ? {
        enabled: true,
        queued: autoDeployResult?.success || false,
        pendingCredits: autoDeployResult?.pendingCredits || false,
        jobId: autoDeployResult?.jobId,
        error: autoDeployResult?.error
      } : {
        enabled: false
      }
    });

  } catch (error) {
    logger.error(
      'Error saving onboarding details',
      error instanceof Error ? error : new Error('Unknown error'),
      { operation: 'save-onboarding-details' }
    );
    return NextResponse.json({
      error: 'Internal server error',
      message: 'Failed to save onboarding details. Please try again.'
    }, { status: 500 });
  }
}
