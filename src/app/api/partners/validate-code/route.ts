import { NextResponse, NextRequest } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { getAuth } from '@clerk/nextjs/server';
import { validateApiKey } from '@/lib/apiAuth';

export async function POST(req: NextRequest) {
  try {
    // First try API key authentication
    const apiKeyValidation = validateApiKey(req);
    
    // If API key is not valid, fall back to Clerk authentication
    if (!apiKeyValidation.isValid) {
      const { userId } = getAuth(req);
      
      if (!userId) {
        return NextResponse.json(
          { error: 'Unauthorized - Invalid API key or user authentication' },
          { status: 401 }
        );
      }
    }

    const data = await req.json();
    const partnerCode = data?.partnerCode;

    if (!partnerCode) {
      return NextResponse.json(
        { error: 'Partner code is required' },
        { status: 400 }
      );
    }

    // Check if the partner table exists first
    try {
      const partner = await prisma.partner.findFirst({
        where: {
          partnerCode,
          approvalStatus: 'ACTIVE',
        },
        select: {
          id: true,
          businessName: true,
          partnerCode: true,
          approvalStatus: true,
        },
      });

      if (!partner) {
        return NextResponse.json(
          { error: 'Invalid or unapproved partner code' },
          { status: 404 }
        );
      }

      return NextResponse.json({ 
        success: true,
        data: partner
      });
    } catch (dbError) {
      // If the table doesn't exist yet, return a generic error
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Invalid partner code' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Error validating partner code:', error);
    return NextResponse.json(
      { error: 'Failed to validate partner code' },
      { status: 500 }
    );
  }
}
