import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { sendEmail, buildPartnerEmailSettings } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { email: rawEmail } = await request.json();
    // Normalize email to lowercase for case insensitive comparison
    const email = rawEmail?.toLowerCase().trim();

    // Get the partner ID from the x-partner-id header (set by our middleware)
    const partnerId = request.headers.get('x-partner-id');

    if (!partnerId) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Find the customer credential
    const customerCredential = await prisma.customerCredential.findFirst({
      where: {
        email,
        partnerId,
        status: 'active'
      },
      include: {
        customer: true,
      }
    });

    if (!customerCredential) {
      // For security, don't reveal if the email exists or not
      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, you will receive a verification email shortly.'
      });
    }

    // Check if email is already verified
    if (customerCredential.emailVerified) {
      return NextResponse.json({
        success: true,
        message: 'Your email is already verified. You can sign in normally.'
      });
    }

    // Generate a new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const magicLinkExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    // Update the customer credential with the new verification token
    await prisma.customerCredential.update({
      where: { id: customerCredential.id },
      data: {
        magicLinkToken: verificationToken,
        magicLinkExpiry,
        magicLinkUsed: false,
        magicLinkType: 'email_verification',
      },
    });

    // Get partner details for branding the email
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        businessName: true,
        contactName: true,
        logo: true,
        primaryColor: true,
        customDomain: true,
        customDomainVerified: true,
        subdomain: true,
        useCustomSmtp: true,
        smtpHost: true,
        smtpPort: true,
        smtpUsername: true,
        smtpPassword: true,
        smtpFromEmail: true,
        smtpFromName: true,
        // SES configuration fields
        sesDomainEnabled: true,
        useSESDomain: true,
        sesDomain: true,
        sesDomainStatus: true,
        sesFromEmail: true,
        sesFromName: true,
      }
    });

    if (partner) {
      // Send email verification email with magic link
      const customerName = `${customerCredential.customer.firstName || ''} ${customerCredential.customer.lastName || ''}`.trim() || 'Customer';
      
      await sendEmailVerificationEmail(
        customerCredential,
        partner,
        verificationToken,
        customerName
      );

      console.log('Email verification email resent to customer:', email);
    }

    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email, you will receive a verification email shortly.'
    });
  } catch (error) {
    console.error('Error resending verification email:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to send email verification email (reused from register route)
async function sendEmailVerificationEmail(
  customerCredential: any,
  partner: any,
  verificationToken: string,
  customerName: string
) {
  // Determine the portal URL - always use partner domain for emails
  const baseUrl = partner.customDomainVerified && partner.customDomain
    ? `https://${partner.customDomain}`
    : `https://${partner.subdomain}.knotie-ai.pro`;

  // Determine the correct URL prefix based on ENABLE_PLATFORM_URLS setting
  const enablePlatformUrls = process.env.ENABLE_PLATFORM_URLS !== 'false';
  const urlPrefix = enablePlatformUrls ? '/platform' : '/whitelabel';

  const verificationUrl = `${baseUrl}${urlPrefix}/verify-email?token=${verificationToken}`;

  // Prepare email settings using shared helper (SES → SMTP → SendGrid priority)
  const partnerSmtpSettings = await buildPartnerEmailSettings(partner as any, partner.businessName);

  // Create HTML email content
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        ${partner.logo ? `<img src="${partner.logo}" alt="${partner.businessName}" style="max-width: 150px; height: auto;">` : ''}
        <h1 style="color: ${partner.primaryColor || '#3B82F6'}; margin: 20px 0;">${partner.businessName}</h1>
      </div>
      
      <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 30px;">
        <h2 style="color: #333; margin-top: 0;">Verify Your Email Address</h2>
        <p>Hello ${customerName},</p>
        <p>Please verify your email address to complete your account setup and gain access to your ${partner.businessName} portal.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="background: ${partner.primaryColor || '#3B82F6'}; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Verify Email Address</a>
        </div>
        
        <p style="color: #666; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="color: #666; font-size: 14px; word-break: break-all;">${verificationUrl}</p>
        
        <p style="color: #666; font-size: 14px; margin-top: 30px;">This verification link will expire in 24 hours for security reasons.</p>
      </div>
      
      <div style="text-align: center; color: #666; font-size: 12px;">
        <p>&copy; ${new Date().getFullYear()} ${partner.businessName}. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: customerCredential.email,
    subject: `Verify Your Email - ${partner.businessName} Portal`,
    html: htmlContent,
    from: partnerSmtpSettings?.smtpFromEmail,
    fromName: partnerSmtpSettings?.smtpFromName || partner.businessName,
    // Email tracking
    partnerId: partner.id,
    customerId: customerCredential.customerId,
    emailType: 'email_verification'
  }, partnerSmtpSettings);
}
