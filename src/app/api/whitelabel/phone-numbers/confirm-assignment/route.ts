/**
 * Phone Number Assignment API Route
 *
 * This route handles phone number assignment to customers from various sources:
 * - partner_pool: Numbers already owned by the partner (free)
 * - global_pool: Numbers from Knotie's global pool (cost + markup)
 * - twilio_search: Fresh purchase from Twilio
 * - telnyx_search: Fresh purchase from Telnyx
 *
 * ## Billing Feature Status: DISABLED
 *
 * The recurring billing logic (PhoneNumberBilling) is currently DISABLED.
 * While the code creates billing entries and deducts credits, the monthly
 * recurring billing is not being processed by any cron job.
 *
 * ### Current Behavior:
 * - One-time telephony credit deduction happens on assignment
 * - PhoneNumberBilling records are created with nextBillingDate
 * - BUT no recurring charges are processed
 *
 * ### Future Enhancement:
 * - KnotieManager should run a daily/weekly check for partners
 * - Verify partners have sufficient telephony credits to cover auto-deployed numbers
 * - Send reminder emails when credits are low
 * - Optionally implement auto-charge/auto-top-up feature
 *
 * @see documentations/automated-ai-receptionist/11-billing-and-credits.md
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyWhitelabelAuth } from '@/lib/whitelabelAuth';
import { prisma } from '@/lib/prisma';
import { initTwilioClient } from '@/lib/twilio';
import { logger } from '@/lib/logger';
import { TelephonyCreditService } from '@/lib/services/telephonyCreditService';
import { sendInsufficientTelephonyCreditNotification } from '@/lib/email';
import { twilioWebhookService } from '@/lib/services/twilioWebhookService';
import PhoneNumberProviderFactory from '@/lib/services/phoneNumberProviders';

export const dynamic = 'force-dynamic';

interface ConfirmAssignmentRequest {
  poolId?: string;     // For pool numbers
  phoneNumber: string;
  source: 'partner_pool' | 'global_pool' | 'twilio_search' | 'telnyx_search';
  provider?: 'twilio' | 'telnyx'; // Provider information
  friendlyName?: string;
  countryCode?: string;
  region?: string;
  locality?: string;
  type?: string;
  capabilities?: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
    fax: boolean;
  };
}

export async function POST(req: NextRequest) {
  try {
    // Use whitelabel authentication
    const authResult = await verifyWhitelabelAuth(req);

    if (!authResult) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { customerId, partnerId } = authResult;
    const body: ConfirmAssignmentRequest = await req.json();
    const { poolId, phoneNumber, source, provider, friendlyName, countryCode, region, locality, type, capabilities } = body;

    // Get partner to check telephony credits and get contact email
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId }
    });

    if (!partner) {
      return new NextResponse('Partner not found', { status: 404 });
    }

    // Get customer information for notification
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        firstName: true,
        lastName: true,
        email: true
      }
    });

    if (!customer) {
      return new NextResponse('Customer not found', { status: 404 });
    }

    // Calculate monthly price based on source
    let monthlyPrice = 0;
    if (source === 'global_pool') {
      // For global pool, get the original cost from the pool entry
      const poolEntry = await prisma.phoneNumberPool.findUnique({
        where: { id: poolId },
        include: { phoneNumber: true }
      });
      monthlyPrice = (poolEntry?.phoneNumber.originalCost || 100) + 200; // Original cost + $2 profit
    } else if (source === 'twilio_search' || source === 'telnyx_search') {
      // For fresh purchases, estimate $1.00 base + $2.00 profit
      monthlyPrice = 300; // $3.00 total
    }
    // Partner pool is free (monthlyPrice = 0)

    // Check if partner has sufficient telephony credits (except for partner pool)
    if (source !== 'partner_pool' && partner.telephonyCreditBalanceCents < monthlyPrice) {
      const partnerEmail = partner.emailAddress || 'support@knotie-ai.pro';

      // Send notification to partner about insufficient credits
      try {
        const customerName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email;

        await sendInsufficientTelephonyCreditNotification({
          partnerEmail: partnerEmail,
          partnerBusinessName: partner.businessName || 'Your Business',
          customerName: customerName,
          customerEmail: customer.email,
          requiredCredits: monthlyPrice,
          currentCredits: partner.telephonyCreditBalanceCents,
          phoneNumber: phoneNumber
        });

        logger.info('Sent insufficient telephony credit notification to partner', {
          partnerId: partnerId,
          partnerEmail: partnerEmail,
          customerId: customerId,
          customerEmail: customer.email,
          requiredCredits: monthlyPrice,
          currentCredits: partner.telephonyCreditBalanceCents
        });
      } catch (emailError) {
        logger.error('Failed to send insufficient telephony credit notification', emailError as Error, {
          partnerId: partnerId,
          partnerEmail: partnerEmail,
          customerId: customerId
        });
        // Don't fail the API call if email fails
      }

      return NextResponse.json({
        success: false,
        error: 'insufficient_credits',
        message: `Something went wrong. We've notified our internal team to help you with getting a number. Please try again in a few minutes or contact us for immediate assistance.`
      }, { status: 400 });
    }

    const transactionResult = await prisma.$transaction(async (tx) => {
      let phoneNumberRecord;

      if (source === 'partner_pool') {
        // Assign from partner pool (free)
        const poolEntry = await tx.phoneNumberPool.findUnique({
          where: { id: poolId },
          include: { phoneNumber: true }
        });

        if (!poolEntry || poolEntry.status !== 'available') {
          throw new Error('Pool number not available');
        }

        // Update pool entry
        await tx.phoneNumberPool.update({
          where: { id: poolId },
          data: {
            status: 'assigned',
            assignedAt: new Date()
          }
        });

        // Update phone number assignment
        phoneNumberRecord = await tx.phoneNumber.update({
          where: { id: poolEntry.phoneNumberId },
          data: {
            customerId: customerId,
            status: 'active'
          }
        });

      } else if (source === 'global_pool') {
        // Assign from global pool (charge customer)
        const poolEntry = await tx.phoneNumberPool.findUnique({
          where: { id: poolId },
          include: { phoneNumber: true }
        });

        if (!poolEntry || poolEntry.status !== 'available') {
          throw new Error('Pool number not available');
        }

        // Deduct telephony credits
        await tx.partner.update({
          where: { id: partnerId },
          data: {
            telephonyCreditBalanceCents: {
              decrement: monthlyPrice
            },
            totalTelephonyDollarsUsed: {
              increment: monthlyPrice / 100
            }
          }
        });

        // Create telephony credit transaction record
        await tx.telephonyCreditTransaction.create({
          data: {
            partnerId: partnerId,
            customerId: customerId,
            type: 'phone_number_purchase',
            amount: -monthlyPrice, // Negative for deduction
            balanceAfter: partner.telephonyCreditBalanceCents - monthlyPrice,
            description: `Phone number assignment from global pool: ${poolEntry.phoneNumber.phoneNumber}`,
            referenceId: poolEntry.phoneNumberId,
            metadata: {
              phoneNumber: poolEntry.phoneNumber.phoneNumber,
              phoneNumberId: poolEntry.phoneNumberId,
              source: 'global_pool',
              poolId: poolId,
              originalCost: poolEntry.phoneNumber.originalCost || (monthlyPrice - 200),
              profitMargin: 200,
              monthlyAmount: monthlyPrice
            }
          }
        });

        // Update pool entry to partner pool
        await tx.phoneNumberPool.update({
          where: { id: poolId },
          data: {
            partnerId: partnerId,
            poolType: 'partner',
            status: 'assigned',
            assignedAt: new Date()
          }
        });

        // Update phone number assignment
        phoneNumberRecord = await tx.phoneNumber.update({
          where: { id: poolEntry.phoneNumberId },
          data: {
            customerId: customerId,
            partnerId: partnerId,
            status: 'active',
            poolStatus: 'partner_pool'
          }
        });

        // Create billing entry
        await tx.phoneNumberBilling.create({
          data: {
            phoneNumberId: poolEntry.phoneNumberId,
            partnerId: partnerId,
            customerId: customerId,
            monthlyAmount: monthlyPrice,
            originalCost: poolEntry.phoneNumber.originalCost || (monthlyPrice - 200),
            profitMargin: 200,
            nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            status: 'active'
          }
        });

      } else if (source === 'twilio_search' || source === 'telnyx_search') {
        // Fresh provider purchase (Twilio or Telnyx)
        const providerName = provider || (source === 'telnyx_search' ? 'telnyx' : 'twilio');

        try {
          let purchasedNumber;

          if (providerName === 'telnyx') {
            // Purchase from Telnyx
            const telnyxApiKey = process.env.TELNYX_API_KEY;
            if (!telnyxApiKey) {
              throw new Error('Telnyx API key not configured');
            }

            const telnyxProvider = PhoneNumberProviderFactory.createProvider('telnyx', {
              apiKey: telnyxApiKey
            });

            const purchaseResult = await telnyxProvider.purchasePhoneNumber({
              phoneNumber: phoneNumber,
              friendlyName: friendlyName || `${locality || countryCode} Number`,
              metadata: {
                countryCode: countryCode || 'US',
                type: type || 'local'
              }
            });

            purchasedNumber = {
              sid: purchaseResult.id,
              phoneNumber: purchaseResult.phoneNumber
            };

          } else {
            // Purchase from Twilio (default)
            const twilioClient = initTwilioClient();

            // Configure webhook URLs for usage tracking
            const connectHubBaseUrl = process.env.CONNECT_HUB_URL || 'https://connecthub.knotie-ai.pro';
            const usageWebhookUrl = `${connectHubBaseUrl}/webhook/twilio/usage/${partnerId}/${customerId}`;

            purchasedNumber = await twilioClient.purchasePhoneNumberWithBundleRetry({
              phoneNumber: phoneNumber,
              friendlyName: friendlyName || `${locality || countryCode} Number`,
              voiceUrl: process.env.TWILIO_VOICE_WEBHOOK_URL || 'https://api.knotie-ai.pro/twilio/inbound-call',
              voiceMethod: 'POST',
              smsUrl: process.env.TWILIO_SMS_WEBHOOK_URL || 'https://api.knotie-ai.pro/webhook/sms',
              smsMethod: 'POST',
              statusCallback: usageWebhookUrl,
              statusCallbackMethod: 'POST',
              countryCode: countryCode,
              numberType: type,
            });
          }

          // Create phone number record
          phoneNumberRecord = await tx.phoneNumber.create({
            data: {
              phoneNumber: phoneNumber,
              friendlyName: friendlyName || `${locality || countryCode} Number`,
              customerId: customerId,
              partnerId: partnerId,
              status: 'active',
              countryCode: countryCode || 'US',
              region: region || '',
              locality: locality || '',
              type: type || 'local',
              capabilities: capabilities || { voice: true, sms: true, mms: false, fax: false },
              originalCost: 100, // $1.00 base cost
              profitMargin: 200,  // $2.00 profit
              poolStatus: 'none',
              phoneNumberSid: purchasedNumber.sid,
              provider: providerName // Set the correct provider (telnyx or twilio)
            }
          });

          // Deduct telephony credits for fresh purchase
          await tx.partner.update({
            where: { id: partnerId },
            data: {
              telephonyCreditBalanceCents: {
                decrement: monthlyPrice
              },
              totalTelephonyDollarsUsed: {
                increment: monthlyPrice / 100
              }
            }
          });

          // Create telephony credit transaction record
          await tx.telephonyCreditTransaction.create({
            data: {
              partnerId: partnerId,
              customerId: customerId,
              type: 'phone_number_purchase',
              amount: -monthlyPrice, // Negative for deduction
              balanceAfter: partner.telephonyCreditBalanceCents - monthlyPrice,
              description: `Phone number purchase: ${phoneNumber}`,
              referenceId: phoneNumberRecord.id,
              metadata: {
                phoneNumber: phoneNumber,
                phoneNumberId: phoneNumberRecord.id,
                source: source,
                provider: providerName,
                countryCode: countryCode,
                type: type,
                originalCost: 100,
                profitMargin: 200,
                monthlyAmount: monthlyPrice
              }
            }
          });

          // Create billing entry
          await tx.phoneNumberBilling.create({
            data: {
              phoneNumberId: phoneNumberRecord.id,
              partnerId: partnerId,
              customerId: customerId,
              monthlyAmount: monthlyPrice,
              originalCost: 100,
              profitMargin: 200,
              nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
              status: 'active'
            }
          });

        } catch (providerError) {
          console.error(`${providerName} purchase error:`, providerError);
          throw new Error(`Failed to purchase number from ${providerName}. Please try again or contact support.`);
        }

      } else {
        throw new Error('Invalid source specified');
      }

      // Return data for webhook setup after transaction commits
      return {
        phoneNumberRecord,
        shouldSetupWebhooks: source === 'twilio_search' && !!phoneNumberRecord.phoneNumberSid
      };
    });

    // Setup webhooks AFTER transaction commits (only for fresh Twilio purchases)
    // This must be outside the transaction so the record is visible to other Prisma connections
    if (transactionResult.shouldSetupWebhooks) {
      try {
        await twilioWebhookService.setupWebhooks({
          partnerId: partnerId,
          customerId: customerId,
          phoneNumberSid: transactionResult.phoneNumberRecord.phoneNumberSid!,
          phoneNumber: transactionResult.phoneNumberRecord.phoneNumber
        });
      } catch (webhookError) {
        console.error('Failed to setup webhooks (non-critical):', webhookError);
        // Don't fail the entire request if webhook setup fails
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        phoneNumber: transactionResult.phoneNumberRecord.phoneNumber,
        friendlyName: transactionResult.phoneNumberRecord.friendlyName,
        status: transactionResult.phoneNumberRecord.status,
        source: source,
        message: 'Phone number assigned successfully! It\'s ready for your business calls.'
      }
    });

  } catch (error) {
    console.error('Error confirming phone number assignment:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
