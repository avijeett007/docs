import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyCustomerJWT } from '@/lib/customerJwt';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/whitelabel/ai-gateway/request-url
 * Customer clicks "Request API URL" on the whitelabel AI Gateway page.
 * Sends a notification email to the partner (support or primary email)
 * letting them know this customer is asking for the API gateway base URL.
 * We do NOT expose the Knotie/LiteLLM URL directly to whitelabel customers.
 */
export async function POST(_request: NextRequest) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('customer_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await verifyCustomerJWT(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { customerId, partnerId } = payload;

    // Fetch customer name + email and partner contact info in parallel
    const [customer, partner] = await Promise.all([
      prisma.customer.findUnique({
        where: { id: customerId },
        select: { firstName: true, lastName: true, email: true },
      }),
      prisma.partner.findUnique({
        where: { id: partnerId },
        select: {
          businessName: true,
          emailAddress: true,
          supportEmail: true,
        },
      }),
    ]);

    if (!customer || !partner) {
      return NextResponse.json({ error: 'Customer or partner not found' }, { status: 404 });
    }

    const partnerEmail = partner.supportEmail || partner.emailAddress;
    if (!partnerEmail) {
      // Nothing to send to, but we still acknowledge the customer gracefully
      logger.warn('Partner has no email configured for AI Gateway URL request notification', {
        operation: 'ai_gateway_request_url',
        partnerId,
        customerId,
      });
      return NextResponse.json({ success: true });
    }

    const customerName =
      `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email;
    const businessName = partner.businessName || 'your platform';
    const requestedAt = new Date().toLocaleString('en-US', { timeZone: 'UTC' }) + ' UTC';

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        <div style="background: linear-gradient(135deg, #7C3AED, #4F46E5); padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 22px;">⚡ AI Gateway URL Request</h1>
        </div>
        <div style="background: #f8f9fa; padding: 20px; border: 1px solid #e9ecef; border-top: none; border-radius: 0 0 8px 8px;">
          <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 16px;">
            <p style="margin: 0 0 12px 0; font-size: 15px;">
              One of your customers on <strong>${businessName}</strong> has requested the
              <strong>AI Gateway base URL</strong> so they can connect their application.
            </p>
          </div>
          <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 16px;">
            <h3 style="color: #7C3AED; margin-top: 0;">Customer Details</h3>
            <p style="margin: 4px 0;"><strong>Name:</strong> ${customerName}</p>
            <p style="margin: 4px 0;"><strong>Email:</strong> ${customer.email}</p>
            <p style="margin: 4px 0;"><strong>Customer ID:</strong> <span style="font-family: monospace; font-size: 13px;">${customerId}</span></p>
            <p style="margin: 4px 0;"><strong>Requested at:</strong> ${requestedAt}</p>
          </div>
          <div style="background: #FFF7ED; border: 1px solid #FED7AA; padding: 15px; border-radius: 8px;">
            <p style="margin: 0; color: #92400E;">
              <strong>Action Required:</strong> Please reply to <strong>${customer.email}</strong> with
              the AI Gateway base URL and any integration instructions you wish to share.
            </p>
          </div>
        </div>
      </div>
    `;

    // Fire-and-forget: non-fatal — customer already sees the confirmation UI
    sendEmail({
      to: partnerEmail,
      subject: `AI Gateway URL Requested by ${customerName}`,
      html: emailHtml,
      from: 'notification@knotie-ai.pro',
      fromName: 'Knotie AI Pro Notifications',
      partnerId,
      customerId,
      emailType: 'ai_gateway_url_request',
    }).catch(err =>
      logger.warn('Failed to send AI Gateway URL request notification', {
        operation: 'ai_gateway_request_url',
        error: String(err),
        partnerId,
        customerId,
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error processing AI Gateway URL request', error as Error, {
      operation: 'ai_gateway_request_url',
    });
    return NextResponse.json({ error: 'Failed to send request' }, { status: 500 });
  }
}

