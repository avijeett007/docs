import { prisma } from '@/lib/prisma';
import { getServerStripe } from '@/lib/stripe';
import Stripe from 'stripe';
import { 
  CreditPackage, 
  CreditPurchase, 
  CreditPurchaseRequest,
  calculateDiscountedPrice,
  DEFAULT_CREDIT_PACKAGES
} from '@/lib/types/credits';
import { CreditService } from './creditService';
import { logger } from '../logger';

export class CreditPurchaseService {
  /**
   * Get all available credit packages
   */
  static async getCreditPackages(): Promise<CreditPackage[]> {
    try {
      const packages = await prisma.creditPackage.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' }
      });

      return packages.map(pkg => ({
        ...pkg,
        discountPercentage: Number(pkg.discountPercentage)
      })) as CreditPackage[];
    } catch (error) {
      logger.error('Error getting credit packages', error as Error, {
        operation: 'credit_purchase_service'
      });
      return [];
    }
  }

  /**
   * Initialize default credit packages if they don't exist
   */
  static async initializeDefaultPackages(): Promise<void> {
    try {
      const existingCount = await prisma.creditPackage.count();
      
      if (existingCount === 0) {
        await prisma.creditPackage.createMany({
          data: DEFAULT_CREDIT_PACKAGES.map((pkg, index) => ({
            id: `pkg_${pkg.credits}`,
            name: pkg.displayName,
            credits: pkg.credits,
            priceCents: pkg.priceCents,
            discountPercentage: pkg.discountPercentage,
            sortOrder: index + 1,
          }))
        });
        logger.info('Default credit packages initialized', {
          operation: 'credit_purchase_service',
          packagesCount: DEFAULT_CREDIT_PACKAGES.length
        });
      }
    } catch (error) {
      logger.error('Error initializing default packages', error as Error, {
        operation: 'credit_purchase_service'
      });
    }
  }

  /**
   * Create a Stripe checkout session for credit purchase
   */
  static async createCheckoutSession(
    request: CreditPurchaseRequest
  ): Promise<{ success: boolean; checkoutUrl?: string; error?: string }> {
    try {
      const stripe = getServerStripe();

      // Get partner information
      const partner = await prisma.partner.findUnique({
        where: { id: request.partnerId },
        select: { emailAddress: true, businessName: true }
      });

      if (!partner) {
        return { success: false, error: 'Partner not found' };
      }

      let credits: number;
      let priceCents: number;
      let discountPercentage: number;
      let packageId: string | undefined;

      if (request.packageId) {
        // Using predefined package
        const creditPackage = await prisma.creditPackage.findUnique({
          where: { id: request.packageId, isActive: true }
        });

        if (!creditPackage) {
          return { success: false, error: 'Credit package not found' };
        }

        credits = creditPackage.credits;
        priceCents = creditPackage.priceCents;
        discountPercentage = Number(creditPackage.discountPercentage);
        packageId = creditPackage.id;
      } else if (request.customCredits) {
        // Custom credit amount
        credits = request.customCredits;
        const pricing = calculateDiscountedPrice(credits);
        priceCents = pricing.priceCents;
        discountPercentage = pricing.discountPercentage;
        packageId = undefined;
      } else {
        return { success: false, error: 'Either packageId or customCredits must be provided' };
      }

      // Create credit purchase record
      const creditPurchase = await prisma.creditPurchase.create({
        data: {
          partnerId: request.partnerId,
          packageId,
          creditsPurchased: credits,
          amountPaidCents: priceCents,
          discountApplied: discountPercentage,
          stripePaymentIntentId: '', // Will be updated after Stripe session creation
          status: 'pending',
          currency: 'usd',
          metadata: {
            customCredits: request.customCredits || null,
            originalRequest: JSON.stringify(request)
          }
        }
      });

      // Create Stripe checkout session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        billing_address_collection: 'required',
        customer_email: partner.emailAddress,
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `${credits.toLocaleString()} AI Credits`,
                description: `AI Credits for ${partner.businessName}${
                  discountPercentage > 0 ? ` (${discountPercentage}% discount applied)` : ''
                }`,
                metadata: {
                  type: 'ai_credits',
                  credits: credits.toString(),
                  partnerId: request.partnerId
                }
              },
              unit_amount: priceCents,
            },
            quantity: 1,
          },
        ],
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/partner/credits?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/partner/credits?canceled=true`,
        metadata: {
          type: 'credit_purchase',
          partnerId: request.partnerId,
          creditPurchaseId: creditPurchase.id,
          credits: credits.toString(),
        },
      });

      // Update credit purchase with Stripe session info
      await prisma.creditPurchase.update({
        where: { id: creditPurchase.id },
        data: {
          stripePaymentIntentId: session.payment_intent as string || session.id,
          metadata: {
            ...(creditPurchase.metadata as object || {}),
            stripeSessionId: session.id
          }
        }
      });

      return { success: true, checkoutUrl: session.url || undefined };
    } catch (error) {
      logger.error('Error creating checkout session', error as Error, {
        operation: 'credit_purchase_service',
        partnerId: request.partnerId,
        packageId: request.packageId
      });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Handle successful credit purchase (called from webhook)
   */
  static async handleSuccessfulPurchase(
    stripeSessionId: string,
    paymentIntentId: string
  ): Promise<{ success: boolean; error?: string; creditsAdded?: number }> {
    try {
      // Find the credit purchase record
      const creditPurchase = await prisma.creditPurchase.findFirst({
        where: {
          OR: [
            { stripePaymentIntentId: paymentIntentId },
            { stripePaymentIntentId: stripeSessionId }
          ],
          status: 'pending'
        }
      });

      if (!creditPurchase) {
        return { success: false, error: 'Credit purchase not found' };
      }

      await prisma.$transaction(async (tx) => {
        // Update credit purchase status
        await tx.creditPurchase.update({
          where: { id: creditPurchase.id },
          data: {
            status: 'completed',
            stripePaymentIntentId: paymentIntentId,
            metadata: {
              ...(creditPurchase.metadata as object || {}),
              completedAt: new Date().toISOString()
            }
          }
        });

        // Add credits to partner's balance
        const result = await CreditService.addCredits(
          creditPurchase.partnerId,
          creditPurchase.creditsPurchased,
          'purchase',
          `Credit purchase: ${creditPurchase.creditsPurchased.toLocaleString()} credits`,
          creditPurchase.id,
          undefined,
          {
            stripePaymentIntentId: paymentIntentId,
            amountPaid: creditPurchase.amountPaidCents,
            discountApplied: creditPurchase.discountApplied
          }
        );

        if (!result.success) {
          throw new Error(`Failed to add credits: ${result.error}`);
        }
      });

      return { success: true, creditsAdded: creditPurchase.creditsPurchased };
    } catch (error) {
      logger.error('Error handling successful purchase', error as Error, {
        operation: 'credit_purchase_service',
        stripeSessionId,
        paymentIntentId
      });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Handle failed credit purchase
   */
  static async handleFailedPurchase(
    paymentIntentId: string,
    failureReason?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await prisma.creditPurchase.updateMany({
        where: {
          stripePaymentIntentId: paymentIntentId,
          status: 'pending'
        },
        data: {
          status: 'failed',
          metadata: {
            failureReason,
            failedAt: new Date().toISOString()
          }
        }
      });

      return { success: true };
    } catch (error) {
      logger.error('Error handling failed purchase', error as Error, {
        operation: 'credit_purchase_service',
        paymentIntentId,
        failureReason
      });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get partner's credit purchase history
   */
  static async getPurchaseHistory(
    partnerId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    purchases: CreditPurchase[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      const where = { partnerId };

      const [purchases, total] = await Promise.all([
        prisma.creditPurchase.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            package: true
          }
        }),
        prisma.creditPurchase.count({ where })
      ]);

      return {
        purchases: purchases.map(purchase => ({
          ...purchase,
          discountApplied: Number(purchase.discountApplied),
          package: purchase.package ? {
            ...purchase.package,
            discountPercentage: Number(purchase.package.discountPercentage)
          } : null
        })) as CreditPurchase[],
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error getting purchase history', error as Error, {
        operation: 'credit_purchase_service',
        partnerId
      });
      return {
        purchases: [],
        pagination: { page, limit, total: 0, totalPages: 0 }
      };
    }
  }

  /**
   * Refund a credit purchase
   */
  static async refundPurchase(
    creditPurchaseId: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const creditPurchase = await prisma.creditPurchase.findUnique({
        where: { id: creditPurchaseId },
        include: { partner: true }
      });

      if (!creditPurchase) {
        return { success: false, error: 'Credit purchase not found' };
      }

      if (creditPurchase.status !== 'completed') {
        return { success: false, error: 'Can only refund completed purchases' };
      }

      const stripe = getServerStripe();

      // Create Stripe refund
      const refund = await stripe.refunds.create({
        payment_intent: creditPurchase.stripePaymentIntentId,
        reason: 'requested_by_customer',
        metadata: {
          creditPurchaseId,
          reason: reason || 'Manual refund'
        }
      });

      await prisma.$transaction(async (tx) => {
        // Update purchase status
        await tx.creditPurchase.update({
          where: { id: creditPurchaseId },
          data: {
            status: 'refunded',
            metadata: {
              ...(creditPurchase.metadata as object || {}),
              refundId: refund.id,
              refundReason: reason,
              refundedAt: new Date().toISOString()
            }
          }
        });

        // Deduct credits from partner's balance
        await CreditService.addCredits(
          creditPurchase.partnerId,
          -creditPurchase.creditsPurchased, // negative amount for refund
          'refund',
          `Credit refund: ${creditPurchase.creditsPurchased.toLocaleString()} credits`,
          creditPurchaseId,
          undefined,
          {
            stripeRefundId: refund.id,
            originalPurchaseId: creditPurchaseId,
            reason
          }
        );
      });

      return { success: true };
    } catch (error) {
      logger.error('Error refunding purchase', error as Error, {
        operation: 'credit_purchase_service',
        creditPurchaseId,
        reason
      });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}
