import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { decryptData } from '@/lib/encryption';

/**
 * Test SMTP connection
 */
export async function POST(request: NextRequest) {
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
      smtpHost,
      smtpPort,
      smtpUsername,
      smtpPassword,
      smtpFromEmail,
      smtpFromName
    } = body;

    // Validate required fields
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
    // Handle the case where we need to use the existing password
    let passwordToUse = smtpPassword;

    if (smtpPassword === '**use-existing-password**') {
      // Fetch the partner's current SMTP password from the database
      const partnerData = await prisma.partner.findUnique({
        where: { id: partner.id },
        select: { smtpPassword: true }
      });

      if (!partnerData?.smtpPassword) {
        return NextResponse.json(
          { error: 'No existing SMTP password found' },
          { status: 400 }
        );
      }

      // Decrypt the password
      passwordToUse = await decryptData(partnerData.smtpPassword);
    } else if (!smtpPassword) {
      return NextResponse.json(
        { error: 'SMTP Password is required' },
        { status: 400 }
      );
    }

    if (!smtpFromEmail) {
      return NextResponse.json(
        { error: 'From Email is required' },
        { status: 400 }
      );
    }

    // Create a transporter with the provided SMTP settings
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort.toString()),
      secure: parseInt(smtpPort.toString()) === 465, // true for 465, false for other ports
      auth: {
        user: smtpUsername,
        pass: passwordToUse
      },
      // Set a timeout for the connection attempt
      connectionTimeout: 10000, // 10 seconds
      // Don't throw an error for self-signed certificates
      tls: {
        rejectUnauthorized: false
      }
    });

    // Verify the connection
    try {
      // First, try to verify the connection
      await transporter.verify();

      // If verify succeeds, try to send a test email to the from address
      // This is a more thorough test that ensures the SMTP server allows sending
      try {
        const info = await transporter.sendMail({
          from: `"${smtpFromName || 'SMTP Test'}" <${smtpFromEmail}>`,
          to: smtpFromEmail, // Send to the same address
          subject: "SMTP Test Email",
          text: "This is a test email to verify your SMTP settings.",
          html: "<p>This is a test email to verify your SMTP settings.</p>"
        });

        console.log('Test email sent successfully:', info.messageId);

        // If both verify and send succeed, return success
        return NextResponse.json({
          success: true,
          message: 'SMTP connection successful! A test email was sent to your From Email address.'
        });
      } catch (sendError: any) {
        console.error('SMTP send test error:', sendError);

        // If verify succeeds but send fails, return a partial success
        return NextResponse.json({
          success: true,
          message: 'SMTP connection verified, but sending a test email failed. Your server might have restrictions on sending emails.',
          warning: sendError.message
        });
      }
    } catch (verifyError: any) {
      console.error('SMTP verification error:', verifyError);

      // Return a more user-friendly error message
      let errorMessage = 'Failed to connect to SMTP server.';

      if (verifyError.code === 'ECONNREFUSED') {
        errorMessage = 'Connection refused. Please check your SMTP host and port.';
      } else if (verifyError.code === 'ETIMEDOUT') {
        errorMessage = 'Connection timed out. Please check your SMTP host and port.';
      } else if (verifyError.code === 'EAUTH') {
        errorMessage = 'Authentication failed. Please check your username and password.';
      } else if (verifyError.code === 'ESOCKET') {
        errorMessage = 'Socket error. Please check your SMTP host, port, and security settings.';
      } else if (verifyError.code === 'EENVELOPE') {
        errorMessage = 'Envelope error. Please check your from email address.';
      } else if (verifyError.code === 'EMESSAGE') {
        errorMessage = 'Message error. There might be an issue with your SMTP server configuration.';
      } else if (verifyError.message && verifyError.message.includes('certificate')) {
        errorMessage = 'SSL/TLS certificate error. Your SMTP server might be using a self-signed or invalid certificate.';
      } else if (verifyError.message) {
        errorMessage = `SMTP Error: ${verifyError.message}`;
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Error testing SMTP settings:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to test SMTP settings' },
      { status: 500 }
    );
  }
}
