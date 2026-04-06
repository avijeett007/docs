import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

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
        { error: 'Partner not found in database' },
        { status: 404 }
      );
    }

    // Find the customer credential
    const customerCredential = await prisma.customerCredential.findFirst({
      where: {
        partnerId: partnerId,
        email: email,
      },
      include: {
        customer: true,
      },
    });

    // If no customer found, still return success for security reasons
    // This prevents email enumeration attacks
    if (!customerCredential) {
      console.log(`No customer found with email ${email} for partner ${partnerId}`);
      return NextResponse.json({ success: true });
    }

    // Generate a reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    // Update the customer credential with the reset token
    await prisma.customerCredential.update({
      where: { id: customerCredential.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    // Determine the portal URL - always use partner domain for emails
    const baseUrl = partner.customDomainVerified && partner.customDomain
      ? `https://${partner.customDomain}`
      : `https://${partner.subdomain}.knotie-ai.pro`;

    // Determine the correct URL prefix based on ENABLE_PLATFORM_URLS setting
    const enablePlatformUrls = process.env.ENABLE_PLATFORM_URLS !== 'false';
    const urlPrefix = enablePlatformUrls ? '/platform' : '/whitelabel';

    const resetUrl = `${baseUrl}${urlPrefix}/reset-password?token=${resetToken}`;

    // Prepare email settings using shared helper (SES → SMTP → SendGrid priority)
    const partnerSmtpSettings = await buildPartnerEmailSettings(partner as any, partner.businessName);

    // Send the reset email
    const customerName = `${customerCredential.customer.firstName || ''} ${customerCredential.customer.lastName || ''}`.trim() || 'Customer';

    // Create HTML email content
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        <div style="text-align: center; margin-bottom: 20px;">
          ${partner.logo ? `<img src="${partner.logo}" alt="${partner.businessName}" style="max-width: 150px; height: auto;" />` : ''}
          <h1 style="color: ${partner.primaryColor || '#4F46E5'}; margin-top: 20px;">${partner.businessName} Portal</h1>
        </div>

        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px;">
          <h2>Password Reset Request</h2>
          <p>Hello ${customerName},</p>
          <p>We received a request to reset your password for the ${partner.businessName} Portal. If you didn't make this request, you can safely ignore this email.</p>
          <p>To reset your password, click the button below:</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: ${partner.primaryColor || '#4F46E5'}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">Reset Password</a>
          </div>

          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; background-color: #eee; padding: 10px; border-radius: 4px;">${resetUrl}</p>

          <p>This link will expire in 1 hour.</p>
          <p>If you have any questions, please contact support.</p>
        </div>

        <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
          <p>&copy; ${new Date().getFullYear()} ${partner.businessName}. All rights reserved.</p>
        </div>
      </div>
    `;

    await sendEmail({
      to: email,
      subject: `Reset Your ${partner.businessName} Portal Password`,
      html: htmlContent,
      from: partnerSmtpSettings?.smtpFromEmail,
      fromName: partnerSmtpSettings?.smtpFromName || partner.businessName,
      // Email tracking
      partnerId: partner.id,
      customerId: customerCredential.customerId,
      emailType: 'password_reset'
    }, partnerSmtpSettings);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing forgot password request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
