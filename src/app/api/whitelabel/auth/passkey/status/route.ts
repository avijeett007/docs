import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { email: rawEmail } = requestSchema.parse(body);
    // Normalize email to lowercase for case insensitive comparison
    const email = rawEmail?.toLowerCase().trim();

    // Find customer credential by email
    const customerCredential = await prisma.customerCredential.findFirst({
      where: { email },
      select: {
        id: true,
        passkeyEnabled: true,
        passkeyCredentials: true,
        customer: {
          select: {
            customerPortalEnabled: true,
          },
        },
      },
    });

    if (!customerCredential) {
      return NextResponse.json({
        hasPasskeys: false,
        isActive: false,
      });
    }

    // Check if customer portal is enabled
    const isActive = customerCredential.customer?.customerPortalEnabled || false;
    
    // Check if passkeys are available
    const hasPasskeys = customerCredential.passkeyEnabled && customerCredential.passkeyCredentials.length > 0;

    return NextResponse.json({
      hasPasskeys,
      isActive,
      credentialCount: customerCredential.passkeyCredentials.length,
    });

  } catch (error) {
    console.error('Customer passkey status check error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to check passkey status' },
      { status: 500 }
    );
  }
}
