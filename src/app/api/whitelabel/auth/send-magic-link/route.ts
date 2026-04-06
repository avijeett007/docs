import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { sendEmail, buildPartnerEmailSettings } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { email: rawEmail, type = 'login' } = await request.json();
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

    // Find the partner to get branding information
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        id: true,
        businessName: true,
        logo: true,
        primaryColor: true,
        secondaryColor: true,
        subdomain: true,
        customDomain: true,
        customDomainVerified: true,
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

    if (!partner) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Find the customer credential
    const customerCredential = await prisma.customerCredential.findFirst({
      where: {
        partnerId: partnerId,
        email: email,
        status: 'active',
      },
      include: {
        customer: true,
      },
    });

    if (!customerCredential) {
      // For security, don't reveal if the email exists or not
      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, you will receive a magic link shortly.'
      });
    }

    // Generate a magic link token
    const magicLinkToken = crypto.randomBytes(32).toString('hex');
    const magicLinkExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now

    // Update the customer credential with the magic link token
    await prisma.customerCredential.update({
      where: { id: customerCredential.id },
      data: {
        magicLinkToken,
        magicLinkExpiry,
        magicLinkUsed: false,
        magicLinkType: type,
      },
    });

    // Determine the portal URL - always use partner domain for emails
    const baseUrl = partner.customDomainVerified && partner.customDomain
      ? `https://${partner.customDomain}`
      : `https://${partner.subdomain}.knotie-ai.pro`;

    // Determine the correct URL prefix based on ENABLE_PLATFORM_URLS setting
    const enablePlatformUrls = process.env.ENABLE_PLATFORM_URLS !== 'false';
    const urlPrefix = enablePlatformUrls ? '/platform' : '/whitelabel';

    const magicLinkUrl = `${baseUrl}${urlPrefix}/magic-login?token=${magicLinkToken}`;

    // Prepare email settings using shared helper (SES → SMTP → SendGrid priority)
    const partnerSmtpSettings = await buildPartnerEmailSettings(partner as any, partner.businessName);

    // Send the magic link email
    const customerName = `${customerCredential.customer.firstName || ''} ${customerCredential.customer.lastName || ''}`.trim() || 'Customer';

    // Create HTML email content based on type
    const isPasswordReset = type === 'password_reset';
    const actionText = isPasswordReset ? 'Reset Your Password' : 'Sign In';
    const subjectText = isPasswordReset ? 'Reset Your Password' : 'Your Magic Sign-In Link';
    const bodyText = isPasswordReset 
      ? 'We received a request to reset your password. Click the link below to securely reset your password.'
      : 'Click the link below to securely sign in to your account without entering your password.';

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        <div style="text-align: center; margin-bottom: 20px;">
          ${partner.logo ? `<img src="${partner.logo}" alt="${partner.businessName}" style="max-width: 150px; height: auto;" />` : ''}
          <h1 style="color: ${partner.primaryColor || '#4F46E5'}; margin-top: 20px;">${partner.businessName} Portal</h1>
        </div>

        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px;">
          <h2>${subjectText}</h2>
          <p>Hello ${customerName},</p>
          <p>${bodyText}</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${magicLinkUrl}" style="background-color: ${partner.primaryColor || '#4F46E5'}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">${actionText}</a>
          </div>

          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; background-color: #eee; padding: 10px; border-radius: 4px;">${magicLinkUrl}</p>

          <p><strong>Important:</strong> This link will expire in 30 minutes and can only be used once.</p>
          <p>If you didn't request this, you can safely ignore this email.</p>
        </div>

        <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
          <p>&copy; ${new Date().getFullYear()} ${partner.businessName}. All rights reserved.</p>
        </div>
      </div>
    `;

    await sendEmail({
      to: email,
      subject: `${subjectText} - ${partner.businessName} Portal`,
      html: htmlContent,
      from: partnerSmtpSettings?.smtpFromEmail,
      fromName: partnerSmtpSettings?.smtpFromName || partner.businessName,
      // Email tracking
      partnerId: partner.id,
      customerId: customerCredential.customerId,
      emailType: isPasswordReset ? 'magic_link_password_reset' : 'magic_link_login'
    }, partnerSmtpSettings);

    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email, you will receive a magic link shortly.'
    });
  } catch (error) {
    console.error('Error sending magic link:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
