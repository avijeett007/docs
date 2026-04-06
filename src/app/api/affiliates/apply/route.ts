import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

interface AffiliateApplicationData {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  website: string;
  phoneNumber: string;
  socialMedia: {
    instagram: string;
    youtube: string;
    twitter: string;
    other: string;
  };
  audienceSize: string;
  experience: string;
  marketingStrategy: string;
  agreeToTerms: boolean;
}

/**
 * POST /api/affiliates/apply
 * Handle affiliate application form submission
 */
export async function POST(request: NextRequest) {
  try {
    const data: AffiliateApplicationData = await request.json();

    // Validate required fields
    if (!data.firstName || !data.lastName || !data.email || !data.audienceSize || !data.experience || !data.marketingStrategy) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!data.agreeToTerms) {
      return NextResponse.json(
        { error: 'Must agree to terms and conditions' },
        { status: 400 }
      );
    }

    // Prepare email content
    const emailSubject = `New Affiliate Application - ${data.firstName} ${data.lastName}`;

    const emailContent = `
      <h2>New Affiliate Application Received</h2>

      <h3>Personal Information</h3>
      <ul>
        <li><strong>Name:</strong> ${data.firstName} ${data.lastName}</li>
        <li><strong>Email:</strong> ${data.email}</li>
        <li><strong>Phone:</strong> ${data.phoneNumber || 'Not provided'}</li>
        <li><strong>Company:</strong> ${data.company || 'Not provided'}</li>
        <li><strong>Website:</strong> ${data.website || 'Not provided'}</li>
      </ul>

      <h3>Social Media & Audience</h3>
      <ul>
        <li><strong>Instagram:</strong> ${data.socialMedia.instagram || 'Not provided'}</li>
        <li><strong>YouTube:</strong> ${data.socialMedia.youtube || 'Not provided'}</li>
        <li><strong>Twitter/X:</strong> ${data.socialMedia.twitter || 'Not provided'}</li>
        <li><strong>Other Social Media:</strong> ${data.socialMedia.other || 'Not provided'}</li>
        <li><strong>Total Audience Size:</strong> ${data.audienceSize}</li>
      </ul>

      <h3>Experience & Strategy</h3>
      <div>
        <h4>Marketing Experience:</h4>
        <p>${data.experience.replace(/\n/g, '<br>')}</p>
      </div>

      <div>
        <h4>Marketing Strategy:</h4>
        <p>${data.marketingStrategy.replace(/\n/g, '<br>')}</p>
      </div>

      <h3>Application Details</h3>
      <ul>
        <li><strong>Agreed to Terms:</strong> ${data.agreeToTerms ? 'Yes' : 'No'}</li>
        <li><strong>Application Date:</strong> ${new Date().toLocaleString()}</li>
      </ul>

      <hr>
      <p><em>This application was submitted through the Knotie AI Pro affiliate signup page.</em></p>
    `;

    // Send email to support team
    await sendEmail({
      to: 'support@knotie-ai.pro',
      subject: emailSubject,
      html: emailContent,
    });
    // Send confirmation email to applicant
    const confirmationSubject = 'Your Knotie AI Pro Affiliate Application';
    const confirmationContent = `
      <h2>Thank you for your affiliate application!</h2>

      <p>Dear ${data.firstName},</p>

      <p>We've received your application to become a Knotie AI Pro affiliate. Our team will review your application and get back to you within 2-3 business days.</p>

      <h3>What's Next?</h3>
      <ul>
        <li>Our team will review your application and audience information</li>
        <li>We'll assess your marketing strategy and experience</li>
        <li>If approved, we'll send you affiliate program details and your unique referral links</li>
        <li>You'll receive access to our affiliate dashboard and marketing materials</li>
      </ul>

      <h3>Commission Tiers Available</h3>
      <ul>
        <li><strong>Public Affiliate:</strong> 10% commission for 6 months</li>
        <li><strong>Free Member:</strong> 20% commission for 1 year (sign up for free account)</li>
        <li><strong>Premium Subscriber:</strong> 40% lifetime commission (limited time offer)</li>
      </ul>

      <p>If you have any questions in the meantime, please don't hesitate to reach out to us at support@knotie-ai.pro.</p>

      <p>Best regards,<br>
      The Knotie AI Pro Team</p>

      <hr>
      <p><small>This is an automated confirmation email. Please do not reply to this message.</small></p>
    `;

    await sendEmail({
      to: data.email,
      subject: confirmationSubject,
      html: confirmationContent,
    });

    return NextResponse.json({
      success: true,
      message: 'Application submitted successfully',
    });

  } catch (error) {
    console.error('Error processing affiliate application:', error);
    return NextResponse.json(
      { error: 'Failed to submit application' },
      { status: 500 }
    );
  }
}
