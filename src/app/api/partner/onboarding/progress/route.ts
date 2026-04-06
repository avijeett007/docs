import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJWT } from '@/lib/jwt';
import { OnboardingTracker } from '@/services/OnboardingTracker';
import { securePublicRoute } from '@/lib/security/publicRoutesSecurity';

export const dynamic = 'force-dynamic';

async function getPartnerIdFromRequest(request: NextRequest): Promise<string | null> {
  try {
    // Try to get token from Authorization header first
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = await verifyJWT(token);
      return payload?.partnerId || null;
    }

    // Fallback to cookie
    const token = request.cookies.get('partner_token')?.value;
    if (token) {
      const payload = await verifyJWT(token);
      return payload?.partnerId || null;
    }

    return null;
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Apply security measures
    const securityCheck = await securePublicRoute(request, {
      rateLimitRequests: 20, // Reasonable for progress checking
      rateLimitWindowMs: 60 * 1000,
      requireOriginValidation: false, // Allow cross-origin for progress checking
      allowedMethods: ['GET']
    });

    if (!securityCheck.success) {
      return securityCheck.response;
    }

    const partnerId = await getPartnerIdFromRequest(request);

    if (!partnerId) {
      // For unauthenticated requests, return minimal progress data
      return NextResponse.json({
        success: true,
        data: {
          isComplete: false,
          completedSteps: [],
          totalSteps: 0,
          progress: 0
        }
      });
    }

    const tracker = new OnboardingTracker(prisma);
    const progress = await tracker.getProgress(partnerId);

    return NextResponse.json({
      success: true,
      data: progress
    });
  } catch (error) {
    console.error('Error getting onboarding progress:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Apply security measures
    const securityCheck = await securePublicRoute(request, {
      rateLimitRequests: 10, // Moderate for onboarding actions
      rateLimitWindowMs: 60 * 1000,
      requireOriginValidation: true,
      allowedMethods: ['POST']
    });

    if (!securityCheck.success) {
      return securityCheck.response;
    }

    const partnerId = await getPartnerIdFromRequest(request);

    if (!partnerId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { action } = await request.json();

    if (action === 'complete') {
      const tracker = new OnboardingTracker(prisma);
      const progress = await tracker.getProgress(partnerId);
      
      if (!progress.isComplete) {
        return NextResponse.json(
          { success: false, error: 'Onboarding not yet complete' },
          { status: 400 }
        );
      }

      // Award credits and mark completion
      const result = await tracker.completeOnboarding(partnerId);
      
      return NextResponse.json({
        success: true,
        message: 'Onboarding completed successfully!',
        data: result
      });
    }

    if (action === 'refresh') {
      // Force refresh of progress (clears any cache if implemented)
      const tracker = new OnboardingTracker(prisma);
      const progress = await tracker.getProgress(partnerId);
      
      return NextResponse.json({
        success: true,
        message: 'Progress refreshed successfully',
        data: progress
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error processing onboarding action:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
