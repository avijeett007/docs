import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { RegulatoryBundleService } from '@/lib/services/RegulatoryBundleService';

export const dynamic = 'force-dynamic';

/**
 * Twilio Regulatory Bundle Status Webhook
 * 
 * Twilio sends POST requests to this endpoint when a regulatory bundle's
 * status changes (e.g., pending-review -> in-review -> twilio-approved/twilio-rejected).
 * 
 * The webhook payload is form-encoded with fields:
 * - BundleSid: The SID of the bundle
 * - Status: The new status
 * - RejectionReason: (optional) Reason for rejection
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const params = new URLSearchParams(body);

    const bundleSid = params.get('BundleSid');
    const status = params.get('Status');

    logger.info('Regulatory bundle webhook received', {
      operation: 'phone_activation_webhook',
      bundleSid,
      status,
    });

    if (!bundleSid || !status) {
      return NextResponse.json(
        { error: 'Missing required parameters: BundleSid and Status' },
        { status: 400 }
      );
    }

    const service = new RegulatoryBundleService();
    await service.handleBundleStatusUpdate(bundleSid, status);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Regulatory bundle webhook error', error as Error, {
      operation: 'phone_activation_webhook'
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

