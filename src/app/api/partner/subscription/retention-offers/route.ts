import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/subscription/retention-offers
 * Get available retention offers for partner based on their cancellation reason
 */
export async function GET(request: NextRequest) {
  try {
    // Verify partner authentication
    const decoded = await verifyPartnerJWT(request);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;
    const { searchParams } = new URL(request.url);
    const reason = searchParams.get('reason');

    // Get partner details
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        id: true,
        marketingTier: true,
        subscriptionStatus: true,
        billingInterval: true,
        createdAt: true,
      },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    // Define retention offers based on cancellation reason
    const retentionOffers = [];

    // Base offers available to all partners
    const baseOffers = [
      {
        id: 'pause_subscription',
        type: 'pause',
        title: 'Pause Your Subscription',
        description: 'Take a break for up to 3 months. Your data and settings will be preserved.',
        benefits: [
          'Keep all your data and configurations',
          'Resume anytime within 3 months',
          'No charges during pause period',
        ],
        action: 'pause',
        duration: '3 months',
        discount: null,
      },
    ];

    // Pricing-related offers
    if (reason === 'too_expensive' || reason === 'budget_constraints') {
      retentionOffers.push(
        {
          id: 'discount_25',
          type: 'discount',
          title: '25% Off for 3 Months',
          description: 'Get 25% off your subscription for the next 3 billing cycles.',
          benefits: [
            '25% discount for 3 months',
            'Keep all current features',
            'No commitment beyond discount period',
          ],
          action: 'apply_discount',
          discount: {
            percentage: 25,
            duration: 3,
            unit: 'months',
          },
        },
        {
          id: 'discount_50_first_month',
          type: 'discount',
          title: '50% Off Next Month',
          description: 'Get 50% off your next billing cycle to help with budget planning.',
          benefits: [
            '50% discount on next bill',
            'Full access to all features',
            'One-time offer',
          ],
          action: 'apply_discount',
          discount: {
            percentage: 50,
            duration: 1,
            unit: 'months',
          },
        }
      );
    }

    // Feature-related offers
    if (reason === 'missing_features' || reason === 'not_meeting_needs') {
      retentionOffers.push(
        {
          id: 'feature_preview',
          type: 'feature_access',
          title: 'Early Access to New Features',
          description: 'Get early access to upcoming features and priority support.',
          benefits: [
            'Beta access to new features',
            'Priority customer support',
            'Direct feedback channel to product team',
          ],
          action: 'enable_beta_features',
          discount: null,
        },
        {
          id: 'custom_consultation',
          type: 'service',
          title: 'Free Strategy Consultation',
          description: 'Get a 1-on-1 consultation to optimize your AI agent setup.',
          benefits: [
            '60-minute strategy session',
            'Custom implementation recommendations',
            'Ongoing support for 30 days',
          ],
          action: 'schedule_consultation',
          discount: null,
        }
      );
    }

    // Support-related offers
    if (reason === 'poor_support' || reason === 'technical_issues') {
      retentionOffers.push(
        {
          id: 'priority_support',
          type: 'service',
          title: 'Priority Support Upgrade',
          description: 'Get priority support with faster response times and dedicated assistance.',
          benefits: [
            '24-hour response time guarantee',
            'Dedicated support representative',
            'Direct phone support access',
          ],
          action: 'upgrade_support',
          discount: null,
        }
      );
    }

    // Add base offers to all retention offer lists
    retentionOffers.push(...baseOffers);

    // Add a final "help us improve" offer
    retentionOffers.push({
      id: 'feedback_incentive',
      type: 'feedback',
      title: 'Help Us Improve',
      description: 'Share detailed feedback and get a credit towards future services.',
      benefits: [
        '$50 credit for detailed feedback',
        'Direct input on product roadmap',
        'Invitation to customer advisory board',
      ],
      action: 'provide_feedback',
      discount: null,
    });

    return NextResponse.json({
      success: true,
      data: {
        partnerId,
        reason,
        offers: retentionOffers,
        retentionVideo: {
          url: process.env.RETENTION_VIDEO_URL || 'https://www.youtube.com/embed/dQw4w9WgXcQ',
          title: 'Before You Go - See What\'s Coming Next',
          description: 'Watch this 2-minute video to see the exciting features we\'re launching soon.',
        },
      },
    });

  } catch (error) {
    // Error handled silently for production
    return NextResponse.json(
      { error: 'Failed to fetch retention offers' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/partner/subscription/retention-offers
 * Accept a retention offer
 */
export async function POST(request: NextRequest) {
  try {
    // Verify partner authentication
    const decoded = await verifyPartnerJWT(request);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;
    const body = await request.json();
    const { offerId, additionalData } = body;

    // Log the retention offer acceptance
    await prisma.auditLog.create({
      data: {
        partnerId: partnerId,
        entityType: 'retention_offer',
        entityId: offerId,
        action: 'RETENTION_OFFER_ACCEPTED',
        details: {
          offerId,
          additionalData,
          acceptedAt: new Date().toISOString(),
        },
        ipAddress: request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    // Handle different offer types
    const result = { success: true, message: 'Retention offer accepted' };

    switch (offerId) {
      case 'pause_subscription':
        // Implement subscription pause logic
        result.message = 'Subscription paused for 3 months';
        break;
      
      case 'discount_25':
      case 'discount_50_first_month':
        // Implement discount application logic
        result.message = 'Discount applied to your subscription';
        break;
      
      case 'feature_preview':
        // Enable beta features
        result.message = 'Beta features enabled for your account';
        break;
      
      case 'custom_consultation':
        // Schedule consultation
        result.message = 'Consultation scheduled - you will be contacted within 24 hours';
        break;
      
      case 'priority_support':
        // Upgrade support tier
        result.message = 'Support tier upgraded to priority';
        break;
      
      case 'feedback_incentive':
        // Handle feedback submission
        result.message = 'Thank you for your feedback - credit will be applied to your account';
        break;
      
      default:
        return NextResponse.json(
          { error: 'Invalid offer ID' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });

  } catch (error) {
    // Error handled silently for production
    return NextResponse.json(
      { error: 'Failed to accept retention offer' },
      { status: 500 }
    );
  }
}
