import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isFeatureEnabled } from '@/config/featureFlags';
import { logger } from '@/lib/logger';

/**
 * GET /api/partner/phone-numbers/import/retell/list
 * 
 * Lists phone numbers from the partner's Retell account.
 * Requires the partner to provide their Retell API key as a query parameter or header.
 * Only returns retell-twilio and retell-telnyx numbers (not 'custom' SIP numbers).
 */
export async function POST(req: NextRequest) {
  try {
    // Check feature flag
    if (!isFeatureEnabled('providerPhoneImport.enabled')) {
      return NextResponse.json(
        { success: false, error: 'Feature not available' },
        { status: 404 }
      );
    }

    // Authenticate partner
    const partnerAuth = await verifyPartnerJWT(req);
    if (!partnerAuth || !partnerAuth.isValid || !partnerAuth.payload?.partnerId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const partnerId = partnerAuth.payload.partnerId;

    // Parse request body for API key
    const body = await req.json();
    const { apiKey } = body;

    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim().startsWith('key_')) {
      return NextResponse.json(
        { success: false, error: 'Valid Retell API key is required (must start with key_)' },
        { status: 400 }
      );
    }

    // Fetch phone numbers from Retell API
    const retellResponse = await fetch('https://api.retellai.com/list-phone-numbers', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`,
      },
      signal: AbortSignal.timeout(15000), // 15s timeout
    });

    if (!retellResponse.ok) {
      if (retellResponse.status === 401) {
        return NextResponse.json(
          { success: false, error: 'Invalid Retell API key' },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { success: false, error: `Retell API error: ${retellResponse.status}` },
        { status: 502 }
      );
    }

    const retellNumbers: any[] = await retellResponse.json();

    // Filter to only retell-twilio and retell-telnyx numbers (not 'custom' SIP numbers)
    const importableNumbers = retellNumbers.filter(
      (n: any) => n.phone_number_type === 'retell-twilio' || n.phone_number_type === 'retell-telnyx'
    );

    // Check which numbers are already imported in our system
    const existingNumbers = await prisma.phoneNumber.findMany({
      where: {
        partnerId,
        phoneNumber: {
          in: importableNumbers.map((n: any) => n.phone_number),
        },
      },
      select: {
        phoneNumber: true,
        id: true,
        provider: true,
      },
    });

    const existingNumberMap = new Map(
      existingNumbers.map((n) => [n.phoneNumber, { id: n.id, provider: n.provider }])
    );

    // Build response with import status
    const numbers = importableNumbers.map((n: any) => {
      const existing = existingNumberMap.get(n.phone_number);
      // Collect unique agent IDs from inbound and outbound agents
      const associatedAgentIds = new Set<string>();
      if (n.inbound_agent_id) associatedAgentIds.add(n.inbound_agent_id);
      if (n.outbound_agent_id) associatedAgentIds.add(n.outbound_agent_id);
      if (Array.isArray(n.inbound_agents)) {
        n.inbound_agents.forEach((a: any) => associatedAgentIds.add(a.agent_id));
      }
      if (Array.isArray(n.outbound_agents)) {
        n.outbound_agents.forEach((a: any) => associatedAgentIds.add(a.agent_id));
      }

      return {
        phone_number: n.phone_number,
        phone_number_pretty: n.phone_number_pretty,
        phone_number_type: n.phone_number_type,
        nickname: n.nickname || null,
        inbound_agent_id: n.inbound_agent_id || null,
        outbound_agent_id: n.outbound_agent_id || null,
        inbound_agents: n.inbound_agents || [],
        outbound_agents: n.outbound_agents || [],
        associated_agent_ids: Array.from(associatedAgentIds),
        area_code: n.area_code || null,
        already_imported: !!existing,
        existing_id: existing?.id || null,
        existing_provider: existing?.provider || null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        numbers,
        total: retellNumbers.length,
        importable: importableNumbers.length,
        already_imported: existingNumbers.length,
        skipped_custom: retellNumbers.length - importableNumbers.length,
      },
    });
  } catch (error: any) {
    logger.error('Error listing Retell phone numbers', error instanceof Error ? error : new Error(String(error?.message)), { operation: 'retell_phone_import_list' });
    return NextResponse.json(
      { success: false, error: 'Failed to list Retell phone numbers', message: error.message },
      { status: 500 }
    );
  }
}

