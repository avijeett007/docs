import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { TelephonyCreditService } from '@/lib/services/telephonyCreditService';
import { dollarsToCents } from '@/lib/types/credits';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partnerId = partner.id;
    const body = await request.json();

    // Validate and convert settings
    const settings: any = {};

    if (body.lowCreditThresholdDollars !== undefined) {
      if (body.lowCreditThresholdDollars < 0 || body.lowCreditThresholdDollars > 1000) {
        return NextResponse.json(
          { success: false, error: 'Low credit threshold must be between $0 and $1,000' },
          { status: 400 }
        );
      }
      settings.lowCreditThresholdCents = dollarsToCents(body.lowCreditThresholdDollars);
    }

    if (body.lowCreditNotificationsEnabled !== undefined) {
      settings.lowCreditNotificationsEnabled = Boolean(body.lowCreditNotificationsEnabled);
    }

    if (body.autoTopUpEnabled !== undefined) {
      settings.autoTopUpEnabled = Boolean(body.autoTopUpEnabled);
    }

    if (body.autoTopUpThresholdDollars !== undefined) {
      if (body.autoTopUpThresholdDollars < 0 || body.autoTopUpThresholdDollars > 1000) {
        return NextResponse.json(
          { success: false, error: 'Auto top-up threshold must be between $0 and $1,000' },
          { status: 400 }
        );
      }
      settings.autoTopUpThresholdCents = dollarsToCents(body.autoTopUpThresholdDollars);
    }

    if (body.autoTopUpAmountDollars !== undefined) {
      if (body.autoTopUpAmountDollars < 10 || body.autoTopUpAmountDollars > 1000) {
        return NextResponse.json(
          { success: false, error: 'Auto top-up amount must be between $10 and $1,000' },
          { status: 400 }
        );
      }
      settings.autoTopUpAmountCents = dollarsToCents(body.autoTopUpAmountDollars);
    }

    // Update settings
    const result = await TelephonyCreditService.updateTelephonyCreditSettings(partnerId, settings);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in telephony credit settings API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
