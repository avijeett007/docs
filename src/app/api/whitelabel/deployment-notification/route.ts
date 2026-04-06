import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, customerEmail, customerName, businessName, partnerId } = body;

    if (!customerId || !customerEmail || !partnerId) {
      return NextResponse.json(
        { error: 'Missing required fields: customerId, customerEmail, partnerId' },
        { status: 400 }
      );
    }

    // Get partner information including credit balances and autoDeployEnabled
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        id: true,
        businessName: true,
        emailAddress: true,
        contactName: true,
        autoDeployEnabled: true,
        telephonyCreditBalanceCents: true,
        creditBalance: true
      }
    });

    if (!partner) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Update customer deployment status (only for manual mode)
    // For auto-deploy mode, the status is already set to 'queued' by save-onboarding-details
    if (!partner.autoDeployEnabled) {
      await prisma.customer.update({
        where: { id: customerId },
        data: {
          deploymentStatus: 'phone_provisioned',
          deploymentRequestedAt: new Date()
        }
      });
    }

    // Get deployment guide URL from environment variable
    const deploymentGuideUrl = process.env.DEPLOYMENT_GUIDE_URL || 'https://docs.knotie-ai.pro/deployment-guide';

    // Format credit balances for display
    const telephonyBalanceDollars = (partner.telephonyCreditBalanceCents / 100).toFixed(2);
    const knotieCredits = (partner.creditBalance || 0).toFixed(2);

    // Prepare email content based on auto-deploy mode
    let emailSubject: string;
    let emailHtml: string;
    let emailText: string;

    if (partner.autoDeployEnabled) {
      // Auto-deploy mode email
      emailSubject = `🤖 New Customer Onboarding - Auto-Deployment in Progress - ${businessName || customerName}`;

      emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #10B981, #059669); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🤖 Auto-Deployment in Progress</h1>
          </div>

          <div style="background: #f8f9fa; padding: 25px; border-radius: 10px; margin-bottom: 25px;">
            <h2 style="color: #333; margin-top: 0;">New Customer Onboarded</h2>
            <p><strong>Customer Name:</strong> ${customerName || 'Not provided'}</p>
            <p><strong>Business Name:</strong> ${businessName || 'Not provided'}</p>
            <p><strong>Email Address:</strong> ${customerEmail}</p>
          </div>

          <div style="background: #e8f5e9; border: 1px solid #a5d6a7; padding: 20px; border-radius: 10px; margin-bottom: 25px;">
            <h3 style="color: #2e7d32; margin-top: 0;">✅ Knotie is Handling This Automatically</h3>
            <p style="color: #1b5e20; margin-bottom: 0;">
              Since you have <strong>Auto-Deploy</strong> enabled, Knotie AI Pro is automatically:
            </p>
            <ul style="color: #1b5e20; padding-left: 20px; margin-top: 10px;">
              <li>Provisioning a phone number for this customer</li>
              <li>Creating and configuring the AI Receptionist agent</li>
              <li>Setting up all necessary integrations</li>
            </ul>
            <p style="color: #1b5e20; margin-bottom: 0;">
              You and your customer will receive a notification once the agent is ready!
            </p>
          </div>

          <div style="background: #fef3c7; border: 1px solid #fcd34d; padding: 20px; border-radius: 10px; margin-bottom: 25px;">
            <h3 style="color: #b45309; margin-top: 0;">💰 Your Credit Balance</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0;"><strong>Telephony Credits:</strong></td>
                <td style="padding: 8px 0; text-align: right; font-size: 18px; font-weight: bold; color: #059669;">$${telephonyBalanceDollars}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Knotie Credits:</strong></td>
                <td style="padding: 8px 0; text-align: right; font-size: 18px; font-weight: bold; color: #059669;">${knotieCredits}</td>
              </tr>
            </table>
            <p style="color: #92400e; font-size: 13px; margin-top: 15px; margin-bottom: 0;">
              💡 <strong>Tip:</strong> Keep your credit balance healthy to ensure uninterrupted auto-deployment for all your customers.
            </p>
          </div>

          <div style="text-align: center; padding: 20px; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 14px; margin: 0;">
              This is an automated notification from your Knotie AI Pro system.
            </p>
          </div>
        </div>
      `;

      emailText = `
New Customer Onboarding - Auto-Deployment in Progress

Customer Details:
- Name: ${customerName || 'Not provided'}
- Business: ${businessName || 'Not provided'}
- Email: ${customerEmail}

Knotie is Handling This Automatically:
Since you have Auto-Deploy enabled, Knotie AI Pro is automatically:
- Provisioning a phone number for this customer
- Creating and configuring the AI Receptionist agent
- Setting up all necessary integrations

You and your customer will receive a notification once the agent is ready!

Your Credit Balance:
- Telephony Credits: $${telephonyBalanceDollars}
- Knotie Credits: ${knotieCredits}

Tip: Keep your credit balance healthy to ensure uninterrupted auto-deployment for all your customers.

This is an automated notification from your Knotie AI Pro system.
      `;
    } else {
      // Manual deployment mode email (original)
      emailSubject = `🚀 New AI Agent Deployment Request - ${businessName || customerName}`;

      emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #3B82F6, #8B5CF6); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🚀 New Deployment Request</h1>
          </div>

          <div style="background: #f8f9fa; padding: 25px; border-radius: 10px; margin-bottom: 25px;">
            <h2 style="color: #333; margin-top: 0;">Customer Details</h2>
            <p><strong>Customer Name:</strong> ${customerName || 'Not provided'}</p>
            <p><strong>Business Name:</strong> ${businessName || 'Not provided'}</p>
            <p><strong>Email Address:</strong> ${customerEmail}</p>
            <p><strong>Customer ID:</strong> ${customerId}</p>
          </div>

          <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 10px; margin-bottom: 25px;">
            <h3 style="color: #856404; margin-top: 0;">⚡ Action Required</h3>
            <p style="color: #856404; margin-bottom: 15px;">
              A customer has submitted a request to deploy their AI Reception agent. Please take immediate action to set up their agent.
            </p>
            <a href="${deploymentGuideUrl}"
               style="display: inline-block; background: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              📖 View Deployment Guide
            </a>
          </div>

          <div style="background: #e3f2fd; padding: 20px; border-radius: 10px; margin-bottom: 25px;">
            <h3 style="color: #1565c0; margin-top: 0;">Next Steps</h3>
            <ol style="color: #1565c0; padding-left: 20px;">
              <li>Review the customer's onboarding details in your partner portal</li>
              <li>Provision a phone number for the customer</li>
              <li>Create and configure the AI agent</li>
              <li>Update the deployment status in the customer management panel</li>
              <li>Test the agent and notify the customer when ready</li>
            </ol>
          </div>

          <div style="text-align: center; padding: 20px; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 14px; margin: 0;">
              This is an automated notification from your Knotie AI Pro system.
            </p>
          </div>
        </div>
      `;

      emailText = `
New AI Agent Deployment Request

Customer Details:
- Name: ${customerName || 'Not provided'}
- Business: ${businessName || 'Not provided'}
- Email: ${customerEmail}
- Customer ID: ${customerId}

Action Required:
A customer has submitted a request to deploy their AI Reception agent. Please take immediate action to set up their agent.

Deployment Guide: ${deploymentGuideUrl}

Next Steps:
1. Review the customer's onboarding details in your partner portal
2. Provision a phone number for the customer
3. Create and configure the AI agent
4. Update the deployment status in the customer management panel
5. Test the agent and notify the customer when ready

This is an automated notification from your Knotie AI Pro system.
      `;
    }

    // Send email to partner - always uses platform default (notification@knotie-ai.pro)
    // Do NOT pass partnerSmtpSettings since this is a notification TO the partner, not TO a customer
    await sendEmail({
      to: partner.emailAddress,
      subject: emailSubject,
      html: emailHtml,
      text: emailText,
      from: 'notification@knotie-ai.pro',
      fromName: 'Knotie AI Pro',
    });
    // Note: Not passing partnerSmtpSettings ensures platform default is used

    return NextResponse.json({
      success: true,
      message: 'Deployment notification sent successfully'
    });

  } catch (error) {
    console.error('Error sending deployment notification:', error);
    return NextResponse.json(
      { error: 'Failed to send deployment notification' },
      { status: 500 }
    );
  }
}
