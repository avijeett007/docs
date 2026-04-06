import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { provisionPartnerInAnalytics } from '@/lib/analytics-service';
import { encrypt } from '@/lib/encryption';

export const dynamic = 'force-dynamic';

/**
 * API route to provision a new partner in both the main app and analytics service
 * This should be called when a new partner is created through the admin portal
 */
export async function POST(request: Request) {
  try {
    // Check for admin API key (in production, this should be properly secured)
    const apiKey = request.headers.get('X-Admin-API-Key');
    if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get request body
    const body = await request.json();
    const {
      businessName,
      contactName,
      businessAddress,
      emailAddress,
      phoneNumber,
      areaOfBusiness,
      expertise,
      partnershipType,
      profitMultiplier,
      vapiApiKey,
      retellApiKey
    } = body;

    // Validate required fields
    if (!businessName || !contactName || !emailAddress) {
      return NextResponse.json({ 
        error: 'Missing required fields', 
        requiredFields: ['businessName', 'contactName', 'emailAddress'] 
      }, { status: 400 });
    }

    // Prepare partner data
    const partnerData: any = {
      businessName,
      contactName,
      businessAddress,
      emailAddress,
      phoneNumber,
      areaOfBusiness,
      expertise,
      partnershipType,
      approvalStatus: 'APPROVED', // Default to approved for now
      profitMultiplier: profitMultiplier || 1.2
    };

    // Encrypt any provided API keys
    if (vapiApiKey) {
      partnerData.vapiApiKey = await encrypt(vapiApiKey);
    }

    if (retellApiKey) {
      partnerData.retellApiKey = await encrypt(retellApiKey);
    }

    // Create the partner in the database
    const partner = await prisma.partner.create({
      data: partnerData,
      select: {
        id: true,
        businessName: true,
        contactName: true,
        emailAddress: true,
        phoneNumber: true,
        areaOfBusiness: true,
        expertise: true,
        partnershipType: true,
        approvalStatus: true,
        partnerCode: true,
        createdAt: true
      }
    });

    // Provision the partner in the analytics service
    const analyticsResult = await provisionPartnerInAnalytics(
      partner as any, // Cast to any to avoid TypeScript issues with profitMultiplier
      vapiApiKey,
      retellApiKey
    );

    return NextResponse.json({
      partner,
      analytics: analyticsResult
    });
  } catch (error) {
    console.error('Error provisioning partner:', error);
    return NextResponse.json(
      { error: 'An error occurred while provisioning partner' },
      { status: 500 }
    );
  }
}
