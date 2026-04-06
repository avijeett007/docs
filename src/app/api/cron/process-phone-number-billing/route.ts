import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger, billingLogger } from '@/lib/logger';
import { obfuscatePhoneNumber } from '@/lib/pii-obfuscation';
import { sendEmail } from '@/lib/email';

/**
 * POST /api/cron/process-phone-number-billing
 * Process monthly phone number billing charges
 * 
 * This cron job runs daily to check for phone numbers that need monthly billing.
 * It processes all phoneNumberBilling entries where nextBillingDate <= today.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('Unauthorized phone number billing cron attempt', {
        hasAuth: !!authHeader,
        hasCronSecret: !!cronSecret
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('Starting phone number billing processing');

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of day

    // Find all phone number billing entries that are due for billing
    const dueForBilling = await prisma.phoneNumberBilling.findMany({
      where: {
        nextBillingDate: {
          lte: today
        },
        status: 'active'
      },
      include: {
        phoneNumber: {
          include: {
            partner: {
              select: {
                id: true,
                businessName: true,
                telephonyCreditBalanceCents: true
              }
            }
          }
        }
      }
    });

    logger.info(`Found ${dueForBilling.length} phone numbers due for billing`);

    let processedCount = 0;
    let errorCount = 0;
    const results = [];

    for (const billing of dueForBilling) {
      try {
        const { phoneNumber } = billing;
        const partner = phoneNumber.partner;
        
        if (!partner) {
          billingLogger.warn('Phone number has no associated partner', {
            phoneNumberId: phoneNumber.id,
            phoneNumber: obfuscatePhoneNumber(phoneNumber.phoneNumber),
            operation: 'phone_number_billing'
          });
          errorCount++;
          continue;
        }

        const monthlyAmount = billing.monthlyAmount;
        const currentBalance = partner.telephonyCreditBalanceCents || 0;

        // Process billing in transaction
        await prisma.$transaction(async (tx) => {
          // Race condition protection: Re-fetch and verify billing is still due
          // This prevents duplicate processing if multiple cron jobs run simultaneously
          const currentBilling = await tx.phoneNumberBilling.findUnique({
            where: { id: billing.id },
            select: {
              id: true,
              status: true,
              nextBillingDate: true
            }
          });

          // Skip if already processed by another concurrent job
          if (!currentBilling || currentBilling.status !== 'active' || currentBilling.nextBillingDate > today) {
            billingLogger.info('Billing entry already processed by concurrent job, skipping', {
              billingId: billing.id,
              phoneNumber: obfuscatePhoneNumber(phoneNumber.phoneNumber),
              operation: 'phone_number_billing'
            });
            return;
          }

          // Check if partner has sufficient credits
          if (currentBalance < monthlyAmount) {
            billingLogger.warn('Insufficient credits for phone number billing', {
              partnerId: partner.id,
              phoneNumber: obfuscatePhoneNumber(phoneNumber.phoneNumber),
              required: monthlyAmount,
              available: currentBalance,
              operation: 'phone_number_billing'
            });

            // Mark billing as failed but don't stop processing
            await tx.phoneNumberBilling.update({
              where: { id: billing.id },
              data: {
                status: 'failed'
              }
            });

            // Send email notification to partner about insufficient credits
            try {
              const partnerDetails = await tx.partner.findUnique({
                where: { id: partner.id },
                select: {
                  emailAddress: true,
                  businessName: true
                }
              });

              if (partnerDetails?.emailAddress) {
                await sendInsufficientTelephonyCreditEmailForBilling({
                  partnerEmail: partnerDetails.emailAddress,
                  partnerBusinessName: partnerDetails.businessName || 'Your Business',
                  phoneNumber: phoneNumber.phoneNumber,
                  requiredCredits: monthlyAmount,
                  currentCredits: currentBalance,
                  billingDate: billing.nextBillingDate
                });

                billingLogger.info('Sent insufficient telephony credit notification to partner', {
                  partnerId: partner.id,
                  partnerEmail: partnerDetails.emailAddress,
                  phoneNumber: obfuscatePhoneNumber(phoneNumber.phoneNumber),
                  operation: 'phone_number_billing'
                });
              }
            } catch (emailError) {
              // Don't fail the billing process if email fails
              billingLogger.error('Failed to send insufficient credit notification',
                emailError instanceof Error ? emailError : new Error(String(emailError)), {
                partnerId: partner.id,
                operation: 'phone_number_billing'
              });
            }

            return;
          }

          const newBalance = currentBalance - monthlyAmount;

          // Update partner balance
          await tx.partner.update({
            where: { id: partner.id },
            data: {
              telephonyCreditBalanceCents: newBalance,
              totalTelephonyDollarsUsed: {
                increment: monthlyAmount / 100
              }
            }
          });

          // Create transaction record
          await tx.telephonyCreditTransaction.create({
            data: {
              partnerId: partner.id,
              customerId: phoneNumber.customerId,
              type: 'phone_number_monthly',
              amount: -monthlyAmount,
              balanceAfter: newBalance,
              description: `Monthly billing for phone number: ${obfuscatePhoneNumber(phoneNumber.phoneNumber)}`,
              referenceId: phoneNumber.id,
              metadata: {
                phoneNumber: obfuscatePhoneNumber(phoneNumber.phoneNumber),
                phoneNumberId: phoneNumber.id,
                billingId: billing.id,
                monthlyAmount,
                billingPeriod: billing.nextBillingDate.toISOString().substring(0, 7) // YYYY-MM
              }
            }
          });

          // Update billing record
          const nextBillingDate = new Date(billing.nextBillingDate);
          nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

          await tx.phoneNumberBilling.update({
            where: { id: billing.id },
            data: {
              nextBillingDate,
              status: 'active'
            }
          });
        });

        processedCount++;
        results.push({
          phoneNumber: obfuscatePhoneNumber(phoneNumber.phoneNumber),
          partnerId: partner.id,
          amount: monthlyAmount,
          status: 'success'
        });

        billingLogger.info('Phone number billing processed successfully', {
          phoneNumber: obfuscatePhoneNumber(phoneNumber.phoneNumber),
          partnerId: partner.id,
          amount: monthlyAmount,
          operation: 'phone_number_billing'
        });

      } catch (error) {
        errorCount++;
        billingLogger.error('Error processing phone number billing', error instanceof Error ? error : new Error(String(error)), {
          billingId: billing.id,
          phoneNumber: obfuscatePhoneNumber(billing.phoneNumber.phoneNumber),
          operation: 'phone_number_billing'
        });

        results.push({
          phoneNumber: obfuscatePhoneNumber(billing.phoneNumber.phoneNumber),
          partnerId: billing.phoneNumber.partner?.id || undefined,
          amount: billing.monthlyAmount,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    logger.info('Phone number billing processing completed', {
      total: dueForBilling.length,
      processed: processedCount,
      errors: errorCount
    });

    return NextResponse.json({
      success: true,
      message: 'Phone number billing processing completed',
      stats: {
        total: dueForBilling.length,
        processed: processedCount,
        errors: errorCount
      },
      results
    });

  } catch (error) {
    logger.error('Phone number billing cron job failed', error instanceof Error ? error : new Error(String(error)));

    return NextResponse.json(
      {
        success: false,
        error: 'Phone number billing processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Send email notification to partner about insufficient telephony credits for monthly billing
 */
async function sendInsufficientTelephonyCreditEmailForBilling(data: {
  partnerEmail: string;
  partnerBusinessName: string;
  phoneNumber: string;
  requiredCredits: number;
  currentCredits: number;
  billingDate: Date;
}) {
  try {
    const subject = `🚨 Urgent: Insufficient Telephony Credits for Phone Number Billing`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="UTF-8">
          <title>Insufficient Telephony Credits</title>
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .container { background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
              .header { text-align: center; margin-bottom: 30px; }
              .logo { font-size: 28px; font-weight: bold; color: #3b82f6; margin-bottom: 10px; }
              .alert { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 20px 0; }
              .alert-title { color: #dc2626; font-weight: bold; font-size: 18px; margin-bottom: 10px; }
              .credit-info { background: #f9fafb; border-radius: 8px; padding: 15px; margin: 20px 0; }
              .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; }
              .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <div class="logo">Knotie AI Pro</div>
                  <p style="color: #6b7280;">Telephony Credit Alert</p>
              </div>

              <div class="alert">
                  <div class="alert-title">⚠️ Monthly Phone Number Billing Failed</div>
                  <p>We were unable to process the monthly billing for one of your phone numbers due to insufficient telephony credits.</p>
              </div>

              <h3>Phone Number Details:</h3>
              <p><strong>Phone Number:</strong> ${data.phoneNumber}</p>
              <p><strong>Billing Date:</strong> ${data.billingDate.toLocaleDateString()}</p>

              <div class="credit-info">
                  <h3>Credit Information:</h3>
                  <p><strong>Required Credits:</strong> $${(data.requiredCredits / 100).toFixed(2)}</p>
                  <p><strong>Current Balance:</strong> $${(data.currentCredits / 100).toFixed(2)}</p>
                  <p><strong>Shortfall:</strong> $${((data.requiredCredits - data.currentCredits) / 100).toFixed(2)}</p>
              </div>

              <p><strong>What happens next:</strong></p>
              <ul>
                  <li>The phone number remains active for now</li>
                  <li>Billing will be retried tomorrow</li>
                  <li>If credits remain insufficient, the number may be suspended</li>
              </ul>

              <p><strong>What you need to do:</strong></p>
              <ol>
                  <li>Add telephony credits to your account immediately</li>
                  <li>Ensure you have enough credits for all your phone numbers</li>
                  <li>Consider enabling auto top-up to prevent future issues</li>
              </ol>

              <div style="text-align: center; margin: 30px 0;">
                  <a href="${process.env.NEXT_PUBLIC_BASE_URL}/partner/telephony-credits" class="button">Add Telephony Credits Now</a>
              </div>

              <p><strong>Need Help?</strong></p>
              <p>Contact our support team at <a href="mailto:support@knotie-ai.pro">support@knotie-ai.pro</a> if you need assistance with adding credits or managing your phone numbers.</p>

              <div class="footer">
                  <p>This is an automated notification from Knotie AI Pro.</p>
                  <p>You're receiving this because monthly billing for your phone number could not be processed.</p>
              </div>
          </div>
      </body>
      </html>
    `;

    await sendEmail({
      to: data.partnerEmail,
      subject: subject,
      from: 'billing@knotie-ai.pro',
      fromName: 'Knotie AI Pro Billing',
      html: htmlContent,
      emailType: 'insufficient_telephony_credits_billing'
    });

    logger.info('Insufficient telephony credit notification sent for monthly billing', {
      operation: 'phone_number_billing',
      partnerEmail: data.partnerEmail,
      phoneNumber: obfuscatePhoneNumber(data.phoneNumber)
    });
  } catch (error) {
    logger.error('Error sending insufficient telephony credit notification',
      error instanceof Error ? error : new Error(String(error)), {
      operation: 'phone_number_billing',
      partnerEmail: data.partnerEmail
    });
    throw error;
  }
}
