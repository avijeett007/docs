import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { invoiceEmailService } from '@/lib/email/invoiceEmailService';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: invoiceId } = params;

    // Get the invoice and verify it belongs to this partner
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        partnerId: partner.id,
      },
      include: {
        customer: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        partner: {
          select: {
            businessName: true,
            emailAddress: true,
            stripeAccountId: true,
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Check if invoice is in draft status
    if (invoice.status !== 'draft') {
      return NextResponse.json(
        { success: false, error: 'Only draft invoices can be sent' },
        { status: 400 }
      );
    }

    // Finalize and send the Stripe invoice if it exists
    if (invoice.stripeInvoiceId && invoice.partner.stripeAccountId) {
      try {
        // Finalize the Stripe invoice
        await stripe.invoices.finalizeInvoice(invoice.stripeInvoiceId, {}, {
          stripeAccount: invoice.partner.stripeAccountId,
        });

        // Send the Stripe invoice
        await stripe.invoices.sendInvoice(invoice.stripeInvoiceId, {}, {
          stripeAccount: invoice.partner.stripeAccountId,
        });

        console.log(`Stripe invoice ${invoice.stripeInvoiceId} finalized and sent`);
      } catch (stripeError) {
        console.error('Error finalizing/sending Stripe invoice:', stripeError);
        // Continue with database update even if Stripe fails
      }
    }

    // Update invoice status to 'sent'
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'sent',
        updatedAt: new Date(),
      },
    });

    // Send email notification to customer
    try {
      const emailSent = await invoiceEmailService.sendInvoiceNotification(invoiceId);
      if (emailSent) {
        console.log(`Email notification sent successfully for invoice ${invoiceId}`);
      } else {
        console.warn(`Failed to send email notification for invoice ${invoiceId}`);
      }
    } catch (error) {
      console.error(`Error sending email notification for invoice ${invoiceId}:`, error);
      // Don't fail the request if email fails - invoice is still sent
    }

    return NextResponse.json({
      success: true,
      message: 'Invoice sent successfully',
      data: {
        invoiceId: updatedInvoice.id,
        status: updatedInvoice.status,
        sentAt: updatedInvoice.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error sending invoice:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send invoice' },
      { status: 500 }
    );
  }
}
