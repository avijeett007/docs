import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { encryptData } from '@/lib/encryption';

/**
 * Update partner SMTP settings
 */
export async function PUT(request: NextRequest) {
  try {
    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get request body
    const body = await request.json();
    const {
      useCustomSmtp,
      smtpHost,
      smtpPort,
      smtpUsername,
      smtpPassword,
      smtpFromEmail,
      smtpFromName
    } = body;

    // Validate required fields if using custom SMTP
    if (useCustomSmtp) {
      if (!smtpHost) {
        return NextResponse.json(
          { error: 'SMTP Host is required' },
          { status: 400 }
        );
      }
      if (!smtpPort) {
        return NextResponse.json(
          { error: 'SMTP Port is required' },
          { status: 400 }
        );
      }
      if (!smtpUsername) {
        return NextResponse.json(
          { error: 'SMTP Username is required' },
          { status: 400 }
        );
      }
      if (!smtpFromEmail) {
        return NextResponse.json(
          { error: 'From Email is required' },
          { status: 400 }
        );
      }
      if (!smtpFromName) {
        return NextResponse.json(
          { error: 'From Name is required' },
          { status: 400 }
        );
      }
    }

    // Prepare update data
    const updateData: any = {
      useCustomSmtp
    };

    if (useCustomSmtp) {
      updateData.smtpHost = smtpHost;
      updateData.smtpPort = smtpPort;
      updateData.smtpUsername = smtpUsername;
      updateData.smtpFromEmail = smtpFromEmail;
      updateData.smtpFromName = smtpFromName;

      // Only update password if provided
      if (smtpPassword) {
        // Encrypt the SMTP password
        updateData.smtpPassword = await encryptData(smtpPassword);
      }
    } else {
      // If disabling custom SMTP, keep the settings but don't use them
      // This way, they can be re-enabled later without re-entering everything
    }

    // Update partner in database
    const updatedPartner = await prisma.partner.update({
      where: { id: partner.id },
      data: updateData
    });

    // Return only the fields we want to expose
    return NextResponse.json({
      id: updatedPartner.id,
      businessName: updatedPartner.businessName,
      contactName: updatedPartner.contactName,
      emailAddress: updatedPartner.emailAddress,
      phoneNumber: updatedPartner.phoneNumber,
      // Use type assertion for the SMTP fields since they're new and TypeScript doesn't know about them yet
      useCustomSmtp: (updatedPartner as any).useCustomSmtp,
      smtpHost: (updatedPartner as any).smtpHost,
      smtpPort: (updatedPartner as any).smtpPort,
      smtpUsername: (updatedPartner as any).smtpUsername,
      smtpFromEmail: (updatedPartner as any).smtpFromEmail,
      smtpFromName: (updatedPartner as any).smtpFromName
      // Don't return the password
    });
  } catch (error: any) {
    console.error('Error updating SMTP settings:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update SMTP settings' },
      { status: 500 }
    );
  }
}
