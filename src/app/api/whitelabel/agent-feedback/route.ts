import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { verifyWhitelabelAuth } from '@/lib/whitelabelAuth';

export async function POST(request: NextRequest) {
  try {
    // Verify whitelabel authentication
    const authResult = await verifyWhitelabelAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { customerId, partnerId } = authResult;
    const body = await request.json();
    const { agentId, agentName, feedbackType, phoneNumber } = body;

    // Validate input
    if (!agentId || !feedbackType || !['happy', 'improvement'].includes(feedbackType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid feedback data' },
        { status: 400 }
      );
    }

    // Get customer and partner details
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        businessName: true,
        deploymentStatus: true,
      }
    });

    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        id: true,
        businessName: true,
        contactName: true,
        emailAddress: true,
      }
    });

    if (!customer || !partner) {
      return NextResponse.json(
        { success: false, error: 'Customer or partner not found' },
        { status: 404 }
      );
    }

    const customerName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email;
    const businessName = customer.businessName || 'their business';

    // If customer is happy, mark deployment as completed
    if (feedbackType === 'happy') {
      // Only update if not already completed
      if (customer.deploymentStatus !== 'completed') {
        await prisma.customer.update({
          where: { id: customerId },
          data: {
            deploymentStatus: 'completed',
            deploymentCompletedAt: new Date(),
            agentDeployed: true,
            agentDeployedAt: new Date(),
          }
        });

        console.log(`✅ Deployment marked as completed for customer ${customerId} after positive feedback`);
      }
    }

    // Send email to partner if customer needs improvement
    if (feedbackType === 'improvement') {
      const emailSubject = `🔧 Agent Feedback: ${customerName} needs assistance`;
      
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f97316, #ea580c); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-box { background: white; border-left: 4px solid #f97316; padding: 15px; margin: 20px 0; border-radius: 5px; }
            .info-label { font-weight: bold; color: #666; margin-bottom: 5px; }
            .info-value { color: #333; }
            .cta-button { display: inline-block; background: linear-gradient(135deg, #f97316, #ea580c); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">🔧 Agent Improvement Needed</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">A customer has requested assistance with their AI agent</p>
            </div>
            <div class="content">
              <p>Hello ${partner.contactName || partner.businessName},</p>
              
              <p><strong>${customerName}</strong> has tested their AI Receptionist and indicated that they need some improvements.</p>
              
              <div class="info-box">
                <div class="info-label">Customer Details:</div>
                <div class="info-value">
                  <strong>Name:</strong> ${customerName}<br>
                  <strong>Email:</strong> ${customer.email}<br>
                  <strong>Business:</strong> ${businessName}
                </div>
              </div>
              
              <div class="info-box">
                <div class="info-label">Agent Details:</div>
                <div class="info-value">
                  <strong>Agent Name:</strong> ${agentName || 'AI Receptionist'}<br>
                  <strong>Agent ID:</strong> ${agentId}<br>
                  ${phoneNumber ? `<strong>Phone Number:</strong> ${phoneNumber}<br>` : ''}
                </div>
              </div>
              
              <p><strong>Next Steps:</strong></p>
              <ul>
                <li>Reach out to ${customerName} to understand their specific concerns</li>
                <li>Review the agent configuration and make necessary adjustments</li>
                <li>Schedule a follow-up call to ensure they're satisfied</li>
              </ul>
              
              <p>Please contact them as soon as possible to provide assistance.</p>
              
              <div style="text-align: center;">
                <a href="mailto:${customer.email}" class="cta-button">Contact Customer</a>
              </div>
            </div>
            <div class="footer">
              <p>This is an automated notification from your Knotie AI Pro system.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      // Send email to partner
      await sendEmail({
        to: partner.emailAddress,
        subject: emailSubject,
        html: emailHtml,
        from: 'notification@knotie-ai.pro',
        fromName: 'Knotie AI Pro',
        partnerId: partner.id,
        customerId: customer.id,
        emailType: 'agent_feedback_improvement'
      });
    }

    return NextResponse.json({
      success: true,
      message: feedbackType === 'improvement' 
        ? 'Feedback submitted. Our team will reach out soon!' 
        : 'Thank you for your feedback!'
    });

  } catch (error) {
    console.error('Error submitting agent feedback:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit feedback' },
      { status: 500 }
    );
  }
}

