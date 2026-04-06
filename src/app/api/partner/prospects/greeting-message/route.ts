import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
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

    // Get customerId from query parameters
    const { searchParams } = new URL(request.url);
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
        lastName: true,
        email: true
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
        greetingText: true,
        businessName: true,
        voiceType: true,
        selectedVoiceId: true,
        businessWebsite: true,
        informationSettings: true,
        email: true,
        smsEnabled: true,
        meetingUrl: true,
        phone: true
      }
    });

    // Get partner info for portal link
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        characterName: true,
        customDomain: true,
        subdomain: true
      }
    });

    let greetingMessage = '';
    let source = 'none';

    if (prospect?.greetingText) {
      // Use the prospect's greeting message
      greetingMessage = prospect.greetingText;
      source = 'prospect';
    } else if (customer.businessName) {
      // Fallback to business name-based greeting
      greetingMessage = `Hi! Thank you for calling ${customer.businessName}. How can I help you today?`;
      source = 'business_name';
    } else if (customer.firstName && customer.lastName) {
      // Fallback to customer name-based greeting
      greetingMessage = `Hi! Thank you for calling ${customer.firstName} ${customer.lastName}. How can I help you today?`;
      source = 'customer_name';
    } else {
      // Generic fallback greeting
      greetingMessage = 'Hi! Thank you for calling. How can I help you today?';
      source = 'generic';
    }

    // Build portal link from partner domain
    let portalLink = '';
    if (partner?.customDomain) {
      portalLink = `https://${partner.customDomain}`;
    } else if (partner?.subdomain) {
      portalLink = `https://${partner.subdomain}.knotie-ai.pro`;
    }

    // Build metadata values for Knova agent system prompt
    const metadataValues = prospect ? {
      business_name: prospect.businessName || customer.businessName || '',
      business_website: prospect.businessWebsite || '',
      greeting_instruction: prospect.greetingText || greetingMessage,
      fields_to_collect: prospect.informationSettings || {},
      can_send_sms: prospect.smsEnabled || false,
      appointment_link: prospect.meetingUrl || '',
      should_notify_business: prospect.smsEnabled || false,
      portal_link: portalLink,
      owner_email: prospect.email || customer.email || '',
      owner_number: prospect.phone || ''
    } : null;

    return NextResponse.json({
      success: true,
      data: {
        greetingMessage,
        source,
        voiceInfo: prospect ? {
          voiceType: prospect.voiceType,
          selectedVoiceId: prospect.selectedVoiceId
        } : null,
        customerInfo: {
          businessName: customer.businessName,
          customerName: customer.firstName && customer.lastName
            ? `${customer.firstName} ${customer.lastName}`
            : null
        },
        metadataValues
      }
    });

  } catch (error) {
    console.error('Error fetching greeting message:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
