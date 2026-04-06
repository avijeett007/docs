import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

/**
 * POST /api/internal/email
 * Internal email sending endpoint for KnotieManager and other internal services
 */
export async function POST(request: NextRequest) {
  try {
    // Verify internal API key
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.INTERNAL_API_KEY}`;
    
    if (!authHeader || authHeader !== expectedAuth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const {
      to,
      subject,
      html,
      from,
      fromName,
      partnerId,
      customerId,
      emailType,
      partnerSmtpSettings // Extract partner SMTP/SES settings
    } = body;

    // Validate required fields
    if (!to || !subject || !html) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: to, subject, or html' },
        { status: 400 }
      );
    }

    // Send the email using the main app's email system with partner settings
    const result = await sendEmail({
      to,
      subject,
      html,
      from,
      fromName: fromName || 'Knotie AI Pro',
      partnerId,
      customerId,
      emailType
    }, partnerSmtpSettings); // Pass partner SMTP/SES settings as second parameter

    if (!result.success) {
      const errorDetails = 'error' in result ? result.error : 'Unknown error';
      return NextResponse.json(
        { success: false, error: 'Failed to send email', details: errorDetails },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully',
      messageId: 'messageId' in result ? result.messageId : undefined
    });

  } catch (error) {
    console.error('Internal email API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/internal/email
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Internal email endpoint is healthy',
    timestamp: new Date().toISOString(),
  });
}
