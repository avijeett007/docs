import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { queueEmail } from '@/lib/services/emailQueueService';
import { prisma } from '@/lib/prisma';

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
    const body = await request.json();
    
    const {
      limitType,
      currentCount,
      maxCount,
      attemptedCount,
      action
    } = body;

    // Validate required fields
    if (!limitType || currentCount === undefined || maxCount === undefined || attemptedCount === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (action === 'interested') {
      // Send email to support team
      const supportEmail = 'support@knotie-ai.pro';
      const subject = `🚀 Upgrade Interest: ${partner.businessName} wants unlimited ${limitType}`;
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Upgrade Interest Notification</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
            .info-box { background: white; padding: 15px; margin: 15px 0; border-radius: 6px; border-left: 4px solid #667eea; }
            .highlight { background: #e3f2fd; padding: 10px; border-radius: 4px; margin: 10px 0; }
            .urgent { background: #fff3e0; border-left-color: #ff9800; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚀 New Upgrade Interest!</h1>
              <p>A partner is interested in upgrading to unlimited agents</p>
            </div>
            
            <div class="content">
              <div class="info-box urgent">
                <h3>🎯 Partner Information</h3>
                <p><strong>Business Name:</strong> ${partner.businessName}</p>
                <p><strong>Contact Name:</strong> ${partner.contactName}</p>
                <p><strong>Email:</strong> ${partner.emailAddress}</p>
                <p><strong>Phone:</strong> ${partner.phoneNumber || 'Not provided'}</p>
                <p><strong>Partner ID:</strong> ${partner.id}</p>
                <p><strong>Current Tier:</strong> ${partner.marketingTier || 'Unknown'}</p>
              </div>

              <div class="info-box">
                <h3>📊 Limit Details</h3>
                <p><strong>Agent Type:</strong> ${limitType}</p>
                <p><strong>Current Usage:</strong> ${currentCount} / ${maxCount} agents</p>
                <p><strong>Attempted to Import:</strong> ${attemptedCount} agents</p>
                <p><strong>Additional Needed:</strong> ${Math.max(0, (currentCount + attemptedCount) - maxCount)} agents</p>
              </div>

              <div class="highlight">
                <h3>💡 Recommended Actions</h3>
                <ul>
                  <li>Contact the partner within 24 hours</li>
                  <li>Assess their specific needs and usage patterns</li>
                  <li>Provide a customized upgrade offer</li>
                  <li>Consider their current tier and potential for growth</li>
                </ul>
              </div>

              <div class="info-box">
                <h3>📞 Next Steps</h3>
                <p>This partner has expressed interest in upgrading to unlimited ${limitType}. They are currently blocked from importing additional agents and are actively looking for a solution.</p>
                <p><strong>Priority:</strong> High - Active user hitting limits</p>
                <p><strong>Opportunity:</strong> Upgrade to unlimited tier</p>
              </div>
            </div>

            <div class="footer">
              <p>This notification was generated automatically by Knotie AI Pro</p>
              <p>Timestamp: ${new Date().toISOString()}</p>
            </div>
          </div>
        </body>
        </html>
      `;

      // Send the email
      // Queue email with high priority for immediate processing
      await queueEmail(
        supportEmail,
        subject,
        htmlContent,
        { priority: 'high', maxAttempts: 5 }
      );

      // Log the upgrade interest in the database (optional - for tracking)
      try {
        await prisma.partnerUpgradeInterest.create({
          data: {
            partnerId: partner.id,
            limitType,
            currentCount,
            maxCount,
            attemptedCount,
            status: 'pending',
            createdAt: new Date(),
          },
        });
      } catch (dbError) {
        // Don't fail the request if logging fails - silently continue
      }

      return NextResponse.json({
        success: true,
        message: 'Upgrade interest registered successfully'
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
