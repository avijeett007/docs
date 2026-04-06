import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyCustomerJWT } from '@/lib/customerJwt';
import { sendEmail } from '@/lib/email';
import { decrypt } from '@/lib/encryption';
import {
  generatePartnerCancellationNotificationHTML,
  generateCustomerCancellationConfirmationHTML
} from '@/lib/emailTemplates/cancellationRequest';

export async function POST(_request: NextRequest) {
  try {
    // Get customer token from cookies (whitelabel authentication pattern)
    const cookieStore = cookies();
    const token = cookieStore.get('customer_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Verify customer JWT token
    const payload = await verifyCustomerJWT(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { customerId, partnerId } = payload;
    const { invoiceId, reason } = await _request.json();

    if (!invoiceId || !reason) {
      return NextResponse.json({ error: 'Invoice ID and reason are required' }, { status: 400 });
    }

    // Verify the invoice exists and belongs to the customer
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        customerId: customerId,
        partnerId: partnerId,
        type: 'recurring', // Only allow cancellation requests for recurring invoices
      },
      include: {
        customer: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            businessName: true,
          },
        },
        partner: {
          select: {
            id: true,
            businessName: true,
            emailAddress: true,
            logo: true,
            primaryColor: true,
            secondaryColor: true,
            fontFamily: true,
            portalTitle: true,
            // Email configuration for SES/SMTP priority
            useCustomSmtp: true,
            smtpHost: true,
            smtpPort: true,
            smtpUsername: true,
            smtpPassword: true,
            smtpFromEmail: true,
            smtpFromName: true,
            sesDomainEnabled: true,
            useSESDomain: true,
            sesDomain: true,
            sesDomainStatus: true,
            sesFromEmail: true,
            sesFromName: true,
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found or not eligible for cancellation' }, { status: 404 });
    }

    // Type assertion for included relations
    const invoiceWithRelations = invoice as typeof invoice & {
      customer: {
        firstName: string;
        lastName: string;
        email: string;
        businessName: string;
      };
      partner: {
        businessName: string;
        emailAddress: string;
        logo: string | null;
        primaryColor: string | null;
        secondaryColor: string | null;
        fontFamily: string | null;
        portalTitle: string | null;
      };
    };

    // Check if there's already a pending cancellation request for this invoice
    const existingRequest = await prisma.recurringInvoiceCancellationRequest.findFirst({
      where: {
        invoiceId: invoiceId,
        status: 'pending',
      },
    });

    if (existingRequest) {
      return NextResponse.json({ error: 'A cancellation request is already pending for this invoice' }, { status: 409 });
    }

    // Create the cancellation request
    const cancellationRequest = await prisma.recurringInvoiceCancellationRequest.create({
      data: {
        invoiceId: invoiceId,
        customerId: customerId,
        partnerId: partnerId,
        reason: reason,
        status: 'pending',
      },
    });

    // Send email notifications
    try {
      const customerName = invoiceWithRelations.customer.businessName ||
        (invoiceWithRelations.customer.firstName && invoiceWithRelations.customer.lastName
          ? `${invoiceWithRelations.customer.firstName} ${invoiceWithRelations.customer.lastName}`.trim()
          : 'Customer');

      const emailData = {
        customerName,
        customerEmail: invoiceWithRelations.customer.email,
        invoiceNumber: invoiceWithRelations.invoiceNumber,
        invoiceTitle: invoiceWithRelations.title,
        invoiceAmount: invoiceWithRelations.amount,
        currency: invoiceWithRelations.currency,
        reason,
        requestId: cancellationRequest.id,
        partnerBusinessName: invoiceWithRelations.partner.businessName,
        branding: {
          businessName: invoiceWithRelations.partner.businessName,
          logo: invoiceWithRelations.partner.logo || undefined,
          primaryColor: invoiceWithRelations.partner.primaryColor || undefined,
          secondaryColor: invoiceWithRelations.partner.secondaryColor || undefined,
          fontFamily: invoiceWithRelations.partner.fontFamily || undefined,
          portalTitle: invoiceWithRelations.partner.portalTitle || undefined,
        },
      };

      // Send notification to partner
      const partnerEmailHtml = generatePartnerCancellationNotificationHTML(emailData);
      await sendEmail({
        to: invoiceWithRelations.partner.emailAddress,
        subject: `Cancellation Request - Invoice ${invoiceWithRelations.invoiceNumber}`,
        html: partnerEmailHtml,
        from: 'notification@knotie-ai.pro',
        fromName: 'Knotie AI Pro Notifications',
      });

      // Build partner email settings for customer email (SES → SMTP → SendGrid)
      const partner = invoiceWithRelations.partner;
      let partnerSmtpSettings;

      if (partner.sesDomainEnabled && partner.useSESDomain && partner.sesDomainStatus === 'verified') {
        partnerSmtpSettings = {
          useCustomSmtp: false,
          smtpHost: '',
          smtpPort: 587,
          smtpUsername: '',
          smtpPassword: '',
          smtpFromEmail: '',
          smtpFromName: '',
          sesDomainEnabled: partner.sesDomainEnabled,
          useSESDomain: partner.useSESDomain,
          sesDomain: partner.sesDomain || undefined,
          sesDomainStatus: partner.sesDomainStatus || undefined,
          sesFromEmail: partner.sesFromEmail || `noreply@${partner.sesDomain}`,
          sesFromName: partner.sesFromName || partner.businessName
        };
      } else if (partner.useCustomSmtp && partner.smtpHost && partner.smtpUsername && partner.smtpPassword && !partner.sesDomainEnabled) {
        const decryptedPassword = await decrypt(partner.smtpPassword);
        partnerSmtpSettings = {
          useCustomSmtp: true,
          smtpHost: partner.smtpHost,
          smtpPort: partner.smtpPort || 587,
          smtpUsername: partner.smtpUsername,
          smtpPassword: decryptedPassword,
          smtpFromEmail: partner.smtpFromEmail || 'noreply@knotie-ai.pro',
          smtpFromName: partner.smtpFromName || partner.businessName,
          sesDomainEnabled: partner.sesDomainEnabled || false,
          useSESDomain: false,
          sesDomain: partner.sesDomain || undefined,
          sesDomainStatus: partner.sesDomainStatus || undefined,
          sesFromEmail: partner.sesFromEmail || undefined,
          sesFromName: partner.sesFromName || undefined
        };
      }

      // Send confirmation to customer with partner email settings
      const customerEmailHtml = generateCustomerCancellationConfirmationHTML(emailData);
      await sendEmail({
        to: invoiceWithRelations.customer.email,
        subject: `Cancellation Request Submitted - ${invoiceWithRelations.invoiceNumber}`,
        html: customerEmailHtml,
        from: partnerSmtpSettings?.sesFromEmail || partnerSmtpSettings?.smtpFromEmail,
        fromName: partnerSmtpSettings?.sesFromName || partnerSmtpSettings?.smtpFromName || invoiceWithRelations.partner.businessName,
        partnerId: partner.id,
        customerId: customerId,
        emailType: 'cancellation_confirmation'
      }, partnerSmtpSettings);

      console.log('Cancellation request emails sent successfully');
    } catch (emailError) {
      console.error('Failed to send cancellation request emails:', emailError);
      // Don't fail the request if email sending fails
    }

    return NextResponse.json({
      success: true,
      requestId: cancellationRequest.id,
      message: 'Cancellation request submitted successfully',
    });

  } catch (error) {
    console.error('Error creating cancellation request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(_request: NextRequest) {
  try {
    // Get customer token from cookies (whitelabel authentication pattern)
    const cookieStore = cookies();
    const token = cookieStore.get('customer_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Verify customer JWT token
    const payload = await verifyCustomerJWT(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { customerId, partnerId } = payload;

    // Get all cancellation requests for this customer
    const cancellationRequests = await prisma.recurringInvoiceCancellationRequest.findMany({
      where: {
        customerId: customerId,
        partnerId: partnerId,
      },
      include: {
        invoice: {
          select: {
            invoiceNumber: true,
            title: true,
            amount: true,
            currency: true,
            recurringInterval: true,
          },
        },
      },
      orderBy: {
        requestedAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      requests: cancellationRequests,
    });

  } catch (error) {
    console.error('Error fetching cancellation requests:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
