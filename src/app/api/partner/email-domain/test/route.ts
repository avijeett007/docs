import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerToken } from '@/lib/auth';
import { sendEmailWithSES } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    // Verify partner authentication
    const authResult = await verifyPartnerToken(request);
    if (!authResult.success || !authResult.partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partner = authResult.partner;

    // Check if partner has SES domain enabled and verified
    if (!partner.sesDomainEnabled) {
      return NextResponse.json({ 
        error: 'Domain Email Service is not enabled' 
      }, { status: 400 });
    }

    if (!partner.sesDomain || partner.sesDomainStatus !== 'verified') {
      return NextResponse.json({ 
        error: 'Domain must be verified before sending test emails' 
      }, { status: 400 });
    }

    if (!partner.sesFromEmail || !partner.sesFromName) {
      return NextResponse.json({ 
        error: 'Email configuration is incomplete' 
      }, { status: 400 });
    }

    // Get request body
    const body = await request.json();
    const { testEmail } = body;

    if (!testEmail || typeof testEmail !== 'string') {
      return NextResponse.json({ 
        error: 'Test email address is required' 
      }, { status: 400 });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(testEmail.trim())) {
      return NextResponse.json({ 
        error: 'Invalid email address format' 
      }, { status: 400 });
    }

    // Prepare test email content
    const emailData = {
      to: testEmail.trim(),
      subject: `Test Email from ${partner.businessName || 'Your Agency'}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Test Email</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Test Email Successful!</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; border-left: 4px solid #667eea;">
            <h2 style="color: #333; margin-top: 0;">Congratulations!</h2>
            <p style="font-size: 16px; margin-bottom: 20px;">
              Your domain email configuration is working perfectly! This test email was sent from your own domain using our Email Services.
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 6px; margin: 20px 0;">
              <h3 style="color: #667eea; margin-top: 0;">Email Configuration Details:</h3>
              <ul style="list-style: none; padding: 0;">
                <li style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>From Domain:</strong> ${partner.sesDomain}</li>
                <li style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>From Email:</strong> ${partner.sesFromEmail}</li>
                <li style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>From Name:</strong> ${partner.sesFromName}</li>
                <li style="padding: 8px 0;"><strong>Agency:</strong> ${partner.businessName || 'Your Agency'}</li>
              </ul>
            </div>
            
            <div style="background: #e8f5e8; padding: 15px; border-radius: 6px; border: 1px solid #c3e6c3;">
              <p style="margin: 0; color: #2d5a2d;">
                <strong>✅ Your customers will now receive all notifications from your professional domain!</strong>
              </p>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 14px; margin: 0;">
              This is an automated test email sent via Knotie AI Pro Email Services
            </p>
            <p style="color: #666; font-size: 12px; margin: 5px 0 0 0;">
              Sent on ${new Date().toLocaleString()}
            </p>
          </div>
        </body>
        </html>
      `,
      text: `
Test Email Successful!

Congratulations! Your domain email configuration is working perfectly! This test email was sent from your own domain using our Email Services.

Email Configuration Details:
- From Domain: ${partner.sesDomain}
- From Email: ${partner.sesFromEmail}
- From Name: ${partner.sesFromName}
- Agency: ${partner.businessName || 'Your Agency'}

✅ Your customers will now receive all notifications from your professional domain!

This is an automated test email sent via Knotie AI Pro Email Services
Sent on ${new Date().toLocaleString()}
      `
    };

    // Send the test email using SES
    const emailResult = await sendEmailWithSES(emailData, {
      useCustomSmtp: false,
      smtpHost: '',
      smtpPort: 587,
      smtpUsername: '',
      smtpPassword: '',
      smtpFromEmail: '',
      smtpFromName: '',
      sesDomain: partner.sesDomain,
      sesDomainStatus: partner.sesDomainStatus,
      sesFromEmail: partner.sesFromEmail,
      sesFromName: partner.sesFromName,
      sesDomainEnabled: partner.sesDomainEnabled,
      useSESDomain: partner.useSESDomain || false
    });

    if (!emailResult.success) {
      console.error('Failed to send test email:', emailResult.error);
      return NextResponse.json({ 
        error: emailResult.error || 'Failed to send test email' 
      }, { status: 500 });
    }

    console.log(`Test email sent successfully to ${testEmail} from ${partner.sesFromEmail}`);

    return NextResponse.json({ 
      success: true,
      message: `Test email sent successfully to ${testEmail}`,
      messageId: emailResult.messageId
    });

  } catch (error) {
    console.error('Error sending test email:', error);
    return NextResponse.json(
      { error: 'An error occurred while sending test email' },
      { status: 500 }
    );
  }
}
