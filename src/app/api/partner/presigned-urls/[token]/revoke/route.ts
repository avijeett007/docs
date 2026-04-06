import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import PresignedUrlService from '@/lib/services/presignedUrlService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/partner/presigned-urls/[token]/revoke
 * Revoke a presigned URL
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    // Verify partner authentication
    const authResult = await verifyPartnerAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partnerId = authResult.id;
    const { token } = params;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400 }
      );
    }

    // Revoke the presigned URL
    const success = await PresignedUrlService.revokePresignedUrl(token, partnerId);

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Token not found or already revoked' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Presigned URL revoked successfully',
    });

  } catch (error) {
    console.error('Error revoking presigned URL:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
