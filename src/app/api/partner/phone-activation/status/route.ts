import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { RegulatoryBundleService } from '@/lib/services/RegulatoryBundleService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Verify partner authentication
    const partnerAuth = await verifyPartnerJWT(req);
    if (!partnerAuth || !partnerAuth.isValid || !partnerAuth.payload?.partnerId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = partnerAuth.payload.partnerId;
    const { searchParams } = new URL(req.url);
    const country = searchParams.get('country') || undefined;
    const activationId = searchParams.get('id') || undefined;

    const service = new RegulatoryBundleService();

    if (activationId) {
      // Get specific activation
      const activation = await service.getActivation(activationId, partnerId);
      if (!activation) {
        return NextResponse.json(
          { success: false, error: 'Activation not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: activation,
      });
    }

    // Get all activations for partner
    const activations = await service.getActivationStatus(partnerId, country);

    return NextResponse.json({
      success: true,
      data: activations,
    });
  } catch (error) {
    logger.error('Phone activation status check failed', error as Error, {
      operation: 'phone_activation_api'
    });
    return NextResponse.json(
      { success: false, error: 'Failed to get activation status' },
      { status: 500 }
    );
  }
}

