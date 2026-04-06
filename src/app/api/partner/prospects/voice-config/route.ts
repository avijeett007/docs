import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Check if SAAS_Audio_Mode is set to retell
    if (process.env.SAAS_Audio_Mode !== 'retell') {
      return NextResponse.json({ 
        error: 'Voice fetch is only available when SAAS_Audio_Mode is set to retell' 
      }, { status: 400 });
    }

    // Get partner token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    let partnerId: string;

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      partnerId = decoded.partnerId;
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get API key from query parameters (if provided) or from partner database
    const { searchParams } = new URL(request.url);
    const providedApiKey = searchParams.get('apiKey');

    let retellApiKey: string | null = null;

    if (providedApiKey && providedApiKey.trim() !== '') {
      // Use the API key provided in the request (from modal)
      retellApiKey = providedApiKey.trim();
    } else {
      // Fall back to partner's stored API key
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: { retellApiKey: true }
      });

      if (!partner?.retellApiKey) {
        return NextResponse.json({
          success: false,
          error: 'Retell API key required',
          message: 'Please provide a Retell API key or configure one in mission control'
        }, { status: 400 });
      }

      retellApiKey = partner.retellApiKey;
    }

    // Get customerId from query parameters (searchParams already extracted above)
    const customerId = searchParams.get('customerId');

    if (!customerId) {
      return NextResponse.json({ error: 'customerId is required' }, { status: 400 });
    }

    // First, verify the customer belongs to this partner
    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        credentials: {
          some: { partnerId: partnerId }
        }
      },
      select: {
        id: true,
        businessName: true,
        firstName: true,
        lastName: true
      }
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found or access denied' }, { status: 404 });
    }

    // Look for prospect that was converted to this customer
    const prospect = await prisma.prospect.findFirst({
      where: {
        convertedToCustomerId: customerId,
        partnerId: partnerId
      },
      select: {
        voiceType: true,
        selectedVoiceId: true,
        businessName: true
      }
    });

    if (!prospect) {
      return NextResponse.json({
        success: false,
        error: 'No prospect found for this customer',
        message: 'This customer was not created through the SaaS onboarding flow'
      }, { status: 404 });
    }

    if (!prospect.selectedVoiceId) {
      return NextResponse.json({
        success: false,
        error: 'No voice configuration found',
        message: 'The prospect did not complete voice selection during onboarding'
      }, { status: 404 });
    }

    // Note: Retell API includes voices from multiple providers (cartesia, elevenlabs, openai)
    // All voices returned by Retell API are valid for use, regardless of provider prefix
    // We'll validate against the actual Retell API when the voice is used

    return NextResponse.json({
      success: true,
      data: {
        voiceType: prospect.voiceType,
        selectedVoiceId: prospect.selectedVoiceId,
        source: 'prospect',
        customerInfo: {
          businessName: customer.businessName,
          customerName: customer.firstName && customer.lastName
            ? `${customer.firstName} ${customer.lastName}`
            : null
        }
      }
    });

  } catch (error) {
    console.error('Error fetching voice configuration:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
