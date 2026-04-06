import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { generateSupportTicketConfirmationHTML } from '@/lib/emailTemplates/supportTicketConfirmation';



export async function POST(request: NextRequest) {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Authorization header required' },
        { status: 401 }
      );
    }

    // Verify JWT token
    const token = authHeader.substring(7);
    const decoded = await verifyJWT(token);

    if (!decoded) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Get partner information
    const partner = await prisma.partner.findUnique({
      where: { id: decoded.partnerId },
      select: {
        id: true,
        businessName: true,
        contactName: true,
        emailAddress: true
      }
    });

    if (!partner) {
      return NextResponse.json(
        { success: false, error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { subject, details, context = 'general' } = body;

    if (!subject || !details) {
      return NextResponse.json(
        { success: false, error: 'Subject and details are required' },
        { status: 400 }
      );
    }

    // Generate support ID based on context
    const timestamp = Date.now();
    const contextPrefix = context === 'credits' ? 'CREDIT' : 
                         context === 'billing' ? 'BILL' : 
                         context === 'telephony' ? 'TEL' : 'GEN';
    const supportId = `${contextPrefix}-${timestamp}-${partner.id.slice(-4)}`;

    // Prepare webhook payload
    const webhookPayload = {
      supportId,
      partnerName: partner.businessName || partner.contactName || 'Unknown',
      partnerEmail: partner.emailAddress || decoded.email,
      subject: subject.trim(),
      details: details.trim(),
      context,
      timestamp: new Date().toISOString(),
      partnerId: partner.id
    };

    // Send webhook
    const webhookUrl = process.env.SUPPORT_WEBHOOK_URL;
    const webhookApiKey = process.env.SUPPORT_WEBHOOK_API_KEY;

    if (!webhookUrl || !webhookApiKey) {
      console.error('Support webhook configuration missing');
      return NextResponse.json(
        { success: false, error: 'Support system configuration error' },
        { status: 500 }
      );
    }

    try {
      const webhookResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': webhookApiKey
        },
        body: JSON.stringify(webhookPayload)
      });

      if (!webhookResponse.ok) {
        console.error('Webhook failed:', webhookResponse.status, webhookResponse.statusText);
        // Don't fail the request if webhook fails, just log it
      }
    } catch (webhookError) {
      console.error('Webhook error:', webhookError);
      // Don't fail the request if webhook fails, just log it
    }

    // Send confirmation email to partner
    try {
      const emailHtml = generateSupportTicketConfirmationHTML({
        partnerName: partner.businessName || partner.contactName || 'Partner',
        supportId,
        subject: subject.trim(),
        details: details.trim(),
        context,
        timestamp: new Date().toISOString()
      });

      await sendEmail({
        to: partner.emailAddress || decoded.email,
        subject: `Support Ticket Created - ${supportId}`,
        html: emailHtml,
        from: process.env.SENDGRID_FROM_EMAIL || 'support@knotie-ai.pro',
        fromName: 'Knotie AI Pro Support',
        // Email tracking
        partnerId: partner.id,
        emailType: 'support_ticket_confirmation'
      });

      console.log(`Confirmation email sent to ${partner.emailAddress || decoded.email} for ticket ${supportId}`);
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
      // Don't fail the request if email fails, just log it
    }

    return NextResponse.json({
      success: true,
      message: 'Support request submitted successfully',
      supportId
    });

  } catch (error) {
    console.error('Support submission error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
