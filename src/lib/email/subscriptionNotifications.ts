import { prisma } from '@/lib/prisma';
import { getServerStripe } from '@/lib/stripe';
import { sendEmail } from '@/lib/email';
import Stripe from 'stripe';

const stripe = getServerStripe();

interface SubscriptionReminderData {
  partnerId: string;
  partnerName: string;
  businessName: string;
  emailAddress: string;
  subscriptionId: string;
  nextBillingDate: Date;
  amount: number;
  currency: string;
  planName: string;
  daysUntilRenewal: number;
}

/**
 * Get partners with upcoming subscription renewals
 */
export async function getUpcomingRenewals(daysAhead: number): Promise<SubscriptionReminderData[]> {
  try {
    // Get partners with active subscriptions
    const partners = await prisma.partner.findMany({
      where: {
        subscriptionStatus: 'ACTIVE',
        stripeSubscriptionId: { not: null },
        billingInterval: { in: ['monthly', 'yearly'] }, // Only recurring subscriptions
      },
      select: {
        id: true,
        contactName: true,
        businessName: true,
        emailAddress: true,
        stripeSubscriptionId: true,
        stripeCustomerId: true,
      },
    });

    const upcomingRenewals: SubscriptionReminderData[] = [];
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysAhead);

    for (const partner of partners) {
      if (!partner.stripeSubscriptionId) continue;

      try {
        // Get subscription details from Stripe
        const subscription = await stripe.subscriptions.retrieve(
          partner.stripeSubscriptionId,
          {
            expand: ['items.data.price.product'],
          }
        );

        const nextBillingDate = new Date(subscription.current_period_end * 1000);
        const daysUntilRenewal = Math.ceil(
          (nextBillingDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        );

        // Check if renewal is within the target timeframe
        if (daysUntilRenewal === daysAhead) {
          const priceItem = subscription.items.data[0];
          const product = priceItem.price.product as Stripe.Product;

          upcomingRenewals.push({
            partnerId: partner.id,
            partnerName: partner.contactName || partner.businessName,
            businessName: partner.businessName,
            emailAddress: partner.emailAddress,
            subscriptionId: subscription.id,
            nextBillingDate,
            amount: priceItem.price.unit_amount || 0,
            currency: priceItem.price.currency,
            planName: product.name || 'Knotie AI Pro',
            daysUntilRenewal,
          });
        }
      } catch (stripeError) {
        // Error handled silently for production
        continue;
      }
    }

    return upcomingRenewals;
  } catch (error) {
    // Error handled silently for production
    throw error;
  }
}

/**
 * Send subscription renewal reminder email
 */
export async function sendRenewalReminder(
  reminderData: SubscriptionReminderData,
  reminderType: '7_day' | '3_day'
): Promise<boolean> {
  try {
    const formatAmount = (amount: number, currency: string) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.toUpperCase(),
      }).format(amount / 100);
    };

    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    };

    const cancellationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/partner/settings?action=cancel_subscription`;
    const manageUrl = `${process.env.NEXT_PUBLIC_APP_URL}/partner/settings`;

    const subject = reminderType === '7_day' 
      ? `Your Knotie AI Pro subscription renews in 7 days`
      : `Your Knotie AI Pro subscription renews in 3 days`;

    const emailTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
        .billing-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
        .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin: 10px 5px; }
        .button.secondary { background: #6c757d; }
        .button.danger { background: #dc3545; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #6c757d; font-size: 14px; }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Subscription Renewal Reminder</h1>
            <p>Your Knotie AI Pro subscription is set to renew soon</p>
        </div>
        
        <div class="content">
            <p>Hello ${reminderData.partnerName},</p>
            
            <p>This is a friendly reminder that your Knotie AI Pro subscription for <strong>${reminderData.businessName}</strong> will automatically renew in <strong>${reminderData.daysUntilRenewal} days</strong>.</p>
            
            <div class="billing-details">
                <h3>Billing Details</h3>
                <p><strong>Plan:</strong> ${reminderData.planName}</p>
                <p><strong>Amount:</strong> ${formatAmount(reminderData.amount, reminderData.currency)}</p>
                <p><strong>Renewal Date:</strong> ${formatDate(reminderData.nextBillingDate)}</p>
                <p><strong>Billing Email:</strong> ${reminderData.emailAddress}</p>
            </div>
            
            <div class="warning">
                <h4>🔄 Automatic Renewal</h4>
                <p>Your subscription will automatically renew unless you cancel before the renewal date. You can continue using all features without interruption.</p>
            </div>
            
            <h3>What would you like to do?</h3>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${manageUrl}" class="button">Manage Subscription</a>
                <a href="${cancellationUrl}" class="button danger">Cancel Subscription</a>
            </div>
            
            <h4>Need Help?</h4>
            <p>If you have any questions about your subscription or need assistance, please don't hesitate to contact our support team:</p>
            <ul>
                <li>Email: <a href="mailto:support@knotie-ai.pro">support@knotie-ai.pro</a></li>
                <li>Visit: <a href="${manageUrl}">Partner Settings</a></li>
            </ul>
            
            <p>Thank you for being a valued Knotie AI Pro partner!</p>
            
            <p>Best regards,<br>
            The Knotie AI Team</p>
        </div>
        
        <div class="footer">
            <p>This email was sent to ${reminderData.emailAddress} because you have an active Knotie AI Pro subscription.</p>
            <p>Knotie AI Pro | <a href="${process.env.NEXT_PUBLIC_APP_URL}">knotie-ai.pro</a></p>
        </div>
    </div>
</body>
</html>
    `;

    const success = await sendEmail({
      to: reminderData.emailAddress,
      subject,
      html: emailTemplate,
      from: process.env.SMTP_FROM_EMAIL || 'noreply@knotie-ai.pro',
    });

    if (success.success) {
      // Log the reminder sent
      await prisma.auditLog.create({
        data: {
          partnerId: reminderData.partnerId,
          entityType: 'subscription',
          entityId: reminderData.subscriptionId,
          action: 'SUBSCRIPTION_REMINDER_SENT',
          details: {
            reminderType,
            daysUntilRenewal: reminderData.daysUntilRenewal,
            subscriptionId: reminderData.subscriptionId,
            amount: reminderData.amount,
            currency: reminderData.currency,
            sentAt: new Date().toISOString(),
          },
          ipAddress: 'system',
          userAgent: 'subscription-reminder-service',
        },
      });
    }

    return success.success;
  } catch (error) {
    // Error handled silently for production
    return false;
  }
}

/**
 * Process all subscription reminders for a specific day count
 */
export async function processSubscriptionReminders(daysAhead: number): Promise<{
  processed: number;
  successful: number;
  failed: number;
}> {
  try {
    const upcomingRenewals = await getUpcomingRenewals(daysAhead);
    const reminderType = daysAhead === 7 ? '7_day' : '3_day';
    
    let successful = 0;
    let failed = 0;

    // Processing subscription reminders

    for (const renewal of upcomingRenewals) {
      try {
        const success = await sendRenewalReminder(renewal, reminderType);
        if (success) {
          successful++;
          // Sent reminder successfully
        } else {
          failed++;
          // Error handled silently for production
        }
        
        // Add a small delay between emails to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        failed++;
        // Error handled silently for production
      }
    }

    return {
      processed: upcomingRenewals.length,
      successful,
      failed,
    };
  } catch (error) {
    // Error handled silently for production
    throw error;
  }
}
