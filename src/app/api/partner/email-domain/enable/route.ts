import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPartnerToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Verify partner authentication
    const authResult = await verifyPartnerToken(request);

    if (!authResult.success || !authResult.partner) {
      return authResult.error;
    }

    const partnerId = authResult.partner.id;

    // Get current partner data
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        id: true,
        sesDomainEnabled: true,
        useCustomSmtp: true,
        businessName: true
      }
    });

    if (!partner) {
      return NextResponse.json(
        { success: false, error: 'PARTNER_NOT_FOUND', message: 'Partner not found' },
        { status: 404 }
      );
    }

    // Check if domain email service is already enabled
    if (partner.sesDomainEnabled) {
      return NextResponse.json(
        { success: false, error: 'ALREADY_ENABLED', message: 'Domain email service is already enabled' },
        { status: 409 }
      );
    }

    // Enable domain email service and disable SMTP
    const updatedPartner = await prisma.partner.update({
      where: { id: partnerId },
      data: {
        sesDomainEnabled: true,
        useCustomSmtp: false, // Disable SMTP when domain email service is enabled
        // Clear SMTP settings for security (optional)
        // smtpHost: null,
        // smtpPort: null,
        // smtpUsername: null,
        // smtpPassword: null,
        // smtpFromEmail: null,
        // smtpFromName: null,
      }
    });

    console.log(`Domain email service enabled for partner ${partnerId} (${partner.businessName})`);

    return NextResponse.json({
      success: true,
      message: 'Domain email service enabled successfully',
      data: {
        sesDomainEnabled: updatedPartner.sesDomainEnabled,
        useCustomSmtp: updatedPartner.useCustomSmtp
      }
    });

  } catch (error) {
    console.error('Error enabling domain email service:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'INTERNAL_ERROR', 
        message: 'An error occurred while enabling domain email service' 
      },
      { status: 500 }
    );
  }
}

// Only allow POST method
export async function GET() {
  return NextResponse.json(
    { success: false, error: 'METHOD_NOT_ALLOWED', message: 'Only POST method is allowed' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { success: false, error: 'METHOD_NOT_ALLOWED', message: 'Only POST method is allowed' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { success: false, error: 'METHOD_NOT_ALLOWED', message: 'Only POST method is allowed' },
    { status: 405 }
  );
}
