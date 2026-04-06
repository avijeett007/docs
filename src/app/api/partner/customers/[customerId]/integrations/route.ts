import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';



// Helper function to verify partner token
async function verifyPartnerToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cookieHeader = request.headers.get('cookie');
  
  let token = null;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (cookieHeader) {
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);
    token = cookies.partner_token;
  }

  if (!token) {
    throw new Error('No token provided');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const partner = await prisma.partner.findUnique({
      where: { id: decoded.partnerId }
    });

    if (!partner) {
      throw new Error('Partner not found');
    }

    return partner;
  } catch (error) {
    throw new Error('Invalid token');
  }
}

// GET /api/partner/customers/[customerId]/integrations - Get integrations for a customer
export async function GET(
  request: NextRequest,
  { params }: { params: { customerId: string } }
) {
  try {
    const partner = await verifyPartnerToken(request);
    const { customerId } = params;

    // Verify customer belongs to partner
    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        userOnboarding: {
          some: {
            partnerId: partner.id
          }
        }
      }
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found or does not belong to this partner' },
        { status: 404 }
      );
    }

    // For now, return a mock list of integrations since we don't have an integrations table yet
    // This should be replaced with actual integration data from the database
    const mockIntegrations = [
      {
        id: 'ghl-integration',
        name: 'GoHighLevel CRM',
        type: 'crm',
        description: 'Customer relationship management integration'
      },
      {
        id: 'calendar-integration',
        name: 'Calendar Booking',
        type: 'scheduling',
        description: 'Appointment scheduling integration'
      },
      {
        id: 'email-integration',
        name: 'Email Marketing',
        type: 'email',
        description: 'Email marketing and automation'
      },
      {
        id: 'sms-integration',
        name: 'SMS Messaging',
        type: 'messaging',
        description: 'SMS communication integration'
      }
    ];

    return NextResponse.json({ data: mockIntegrations });
  } catch (error) {
    console.error('Error fetching customer integrations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch integrations' },
      { status: 500 }
    );
  }
}
