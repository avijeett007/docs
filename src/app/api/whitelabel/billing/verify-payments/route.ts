import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

/**
 * Background job to verify "processing" invoices
 * Should be called every 2-3 minutes to check for stuck payments
 * Only updates invoices that have been in "processing" state for more than 5 minutes
 *
 * SECURITY: Requires internal API key authentication
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Verify internal API key
    const authHeader = request.headers.get('authorization');
    const apiKey = authHeader?.replace('Bearer ', '');

    // Enhanced security check: Ensure INTERNAL_API_KEY is set and matches
    if (!process.env.INTERNAL_API_KEY) {
      console.error('❌ INTERNAL_API_KEY environment variable not set');
      return NextResponse.json({
        success: false,
        error: 'Server configuration error'
      }, { status: 500 });
    }

    if (!apiKey || apiKey !== process.env.INTERNAL_API_KEY) {
      console.error('❌ Unauthorized payment verification attempt');
      return NextResponse.json({
        success: false,
        error: 'Unauthorized - Internal API key required'
      }, { status: 401 });
    }

    console.log('🔍 Starting payment verification job...');
    
    // Find invoices that have been in "processing" state for more than 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const processingInvoices = await prisma.invoice.findMany({
      where: {
        status: 'processing',
        updatedAt: {
          lt: fiveMinutesAgo
        }
      },
      include: {
        payments: true,
        partner: {
          select: {
            stripeAccountId: true
          }
        }
      }
    });
    
    console.log(`📋 Found ${processingInvoices.length} invoices stuck in processing state`);
    
    if (processingInvoices.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No stuck invoices found',
        processed: 0
      });
    }
    
    let processedCount = 0;
    const results = [];
    
    for (const invoice of processingInvoices) {
      try {
        if (!invoice.stripePaymentIntentId) {
          console.log(`⚠️ Invoice ${invoice.id} has no payment intent ID`);
          continue;
        }
        
        // Check payment status in Stripe with proper Connect account context
        const retrieveOptions = invoice.partner.stripeAccountId
          ? { stripeAccount: invoice.partner.stripeAccountId }
          : {};

        const paymentIntent = await stripe.paymentIntents.retrieve(
          invoice.stripePaymentIntentId,
          {},
          retrieveOptions
        );
        
        console.log(`🔍 Checking invoice ${invoice.id}: Stripe status = ${paymentIntent.status}`);
        
        if (paymentIntent.status === 'succeeded') {
          // Payment succeeded in Stripe - update invoice to paid
          await prisma.$transaction(async (tx) => {
            // Update invoice status
            await tx.invoice.update({
              where: { id: invoice.id },
              data: {
                status: 'paid',
                paidAt: new Date(),
              },
            });

            // Create payment record if it doesn't exist
            const existingPayment = await tx.invoicePayment.findFirst({
              where: {
                invoiceId: invoice.id,
                stripePaymentIntentId: paymentIntent.id
              }
            });

            if (!existingPayment) {
              await tx.invoicePayment.create({
                data: {
                  invoiceId: invoice.id,
                  amount: paymentIntent.amount,
                  currency: paymentIntent.currency,
                  status: 'succeeded',
                  stripePaymentIntentId: paymentIntent.id,
                  paidAt: new Date(),
                },
              });
            }
          });
          
          console.log(`✅ Updated invoice ${invoice.id} to paid status`);
          processedCount++;
          results.push({
            invoiceId: invoice.id,
            action: 'updated_to_paid',
            stripeStatus: paymentIntent.status
          });
          
        } else if (paymentIntent.status === 'canceled') {
          // Payment failed - revert to sent status so user can try again
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              status: 'sent',
            },
          });
          
          console.log(`🔄 Reverted invoice ${invoice.id} to sent status (payment ${paymentIntent.status})`);
          results.push({
            invoiceId: invoice.id,
            action: 'reverted_to_sent',
            stripeStatus: paymentIntent.status
          });
          
        } else {
          console.log(`⏳ Invoice ${invoice.id} still processing in Stripe (${paymentIntent.status})`);
          results.push({
            invoiceId: invoice.id,
            action: 'still_processing',
            stripeStatus: paymentIntent.status
          });
        }
        
      } catch (error) {
        console.error(`❌ Error processing invoice ${invoice.id}:`, error);
        results.push({
          invoiceId: invoice.id,
          action: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    console.log(`✅ Payment verification job completed. Processed ${processedCount} invoices.`);
    
    return NextResponse.json({
      success: true,
      message: `Processed ${processedCount} stuck invoices`,
      processed: processedCount,
      total: processingInvoices.length,
      results
    });
    
  } catch (error) {
    console.error('❌ Error in payment verification job:', error);
    return NextResponse.json({
      success: false,
      error: 'Payment verification job failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
