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

// POST /api/partner/phone-numbers/[phoneNumberId]/invalidate-cache
// Invalidate the agent config cache for a phone number
export async function POST(
  request: NextRequest,
  { params }: { params: { phoneNumberId: string } }
) {
  try {
    const partner = await verifyPartnerToken(request);
    const { phoneNumberId } = params;

    // Find the phone number and verify it belongs to this partner
    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: {
        id: phoneNumberId,
        partnerId: partner.id
      },
      select: {
        id: true,
        phoneNumber: true,
        agentMappings: {
          where: {
            agentProvider: 'knova',
            status: 'active'
          },
          select: {
            id: true,
            agentId: true
          }
        }
      }
    });

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number not found' },
        { status: 404 }
      );
    }

    // Check if there's a Knova agent assigned
    if (phoneNumber.agentMappings.length === 0) {
      return NextResponse.json(
        { error: 'No Knova agent assigned to this phone number' },
        { status: 400 }
      );
    }

    // Call Connect Hub to invalidate the cache
    const connectHubUrl = process.env.CONNECT_HUB_URL || 'http://localhost:3001';
    const agentValidationKey = process.env.AGENT_VALIDATION_KEY;

    if (!agentValidationKey) {
      console.warn('[invalidate-cache] AGENT_VALIDATION_KEY not set');
      return NextResponse.json(
        { error: 'Cache invalidation not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(`${connectHubUrl}/agent-config/invalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-validation-key': agentValidationKey
      },
      body: JSON.stringify({ phoneNumber: phoneNumber.phoneNumber })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('[invalidate-cache] Cache invalidated successfully:', phoneNumber.phoneNumber.substring(0, 6) + '***');
      return NextResponse.json({
        success: true,
        message: 'Cache invalidated successfully',
        ...result
      });
    } else {
      const error = await response.json();
      console.error('[invalidate-cache] Failed to invalidate cache:', error);
      return NextResponse.json(
        { error: 'Failed to invalidate cache', details: error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error invalidating cache:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to invalidate cache' },
      { status: 500 }
    );
  }
}

