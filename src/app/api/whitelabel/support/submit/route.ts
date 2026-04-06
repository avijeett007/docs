import { NextRequest, NextResponse } from 'next/server';
import { verifyWhitelabelAuth } from '@/lib/whitelabelAuth';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { generateSupportTicketConfirmationHTML } from '@/lib/emailTemplates/supportTicketConfirmation';

export async function POST(request: NextRequest) {
  try {
    // Verify customer authentication
    const auth = await verifyWhitelabelAuth(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { customerId, partnerId, userId } = auth;

    // Get customer and partner information
    const [customer, partner] = await Promise.all([
      prisma.customer.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      }),
      prisma.partner.findUnique({
        where: { id: partnerId },
        select: {
          id: true,
          businessName: true,
          contactName: true,
          emailAddress: true,
          supportEmail: true
        }
      })
    ]);

    if (!customer || !partner) {
      return NextResponse.json(
        { success: false, error: 'Customer or partner not found' },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { subject, details, category = 'call_forwarding' } = body;

    if (!subject || !details) {
      return NextResponse.json(
        { success: false, error: 'Subject and details are required' },
        { status: 400 }
      );
    }

    // Generate support ID based on category
    const timestamp = Date.now();
    const categoryPrefix = category === 'call_forwarding' ? 'TEL' : 
                          category === 'technical' ? 'TECH' : 
                          category === 'billing' ? 'BILL' : 'GEN';
    const supportId = `${categoryPrefix}-${timestamp}-${customer.id.slice(-4)}`;

    // Prepare email content for partner
    const customerName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email;
    const partnerEmail = partner.supportEmail || partner.emailAddress;
    
    if (!partnerEmail) {
      return NextResponse.json(
        { success: false, error: 'Partner support email not configured' },
        { status: 500 }
      );
    }

    // Send support request email to partner
    const emailSubject = `Customer Support Request - ${supportId}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        <div style="background: linear-gradient(135deg, #3B82F6, #10B981); padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Customer Support Request</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border: 1px solid #e9ecef; border-top: none; border-radius: 0 0 8px 8px;">
          <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #3B82F6; margin-top: 0;">Support Ticket Details</h2>
            <p><strong>Reference ID:</strong> <span style="color: #10B981; font-family: monospace; font-size: 16px;">${supportId}</span></p>
            <p><strong>Category:</strong> ${category.replace('_', ' ').toUpperCase()}</p>
            <p><strong>Subject:</strong> ${subject}</p>
            <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
          </div>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #3B82F6; margin-top: 0;">Customer Information</h3>
            <p><strong>Name:</strong> ${customerName}</p>
            <p><strong>Email:</strong> ${customer.email}</p>
            <p><strong>Customer ID:</strong> ${customer.id}</p>
          </div>
          
          <div style="background: white; padding: 20px; border-radius: 8px;">
            <h3 style="color: #3B82F6; margin-top: 0;">Issue Description</h3>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 4px; border-left: 4px solid #3B82F6;">
              ${details.replace(/\n/g, '<br>')}
            </div>
          </div>
          
          <div style="margin-top: 20px; padding: 15px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px;">
            <p style="margin: 0; color: #856404;"><strong>Action Required:</strong> Please respond to this customer support request promptly.</p>
          </div>
        </div>
      </div>
    `;

    await sendEmail({
      to: partnerEmail,
      subject: emailSubject,
      html: emailHtml,
      from: process.env.SENDGRID_FROM_EMAIL || 'support@knotie-ai.pro',
      fromName: 'Knotie AI Pro - Customer Support',
      partnerId: partner.id,
      emailType: 'customer_support_request'
    });

    return NextResponse.json({
      success: true,
      supportId,
      message: 'Support request submitted successfully'
    });

  } catch (error) {
    console.error('Error submitting customer support request:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit support request' },
      { status: 500 }
    );
  }
}
