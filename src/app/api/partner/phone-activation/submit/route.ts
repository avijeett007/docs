import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { RegulatoryBundleService } from '@/lib/services/RegulatoryBundleService';

export async function POST(req: NextRequest) {
  try {
    // Verify partner authentication
    const partnerAuth = await verifyPartnerJWT(req);
    if (!partnerAuth || !partnerAuth.isValid || !partnerAuth.payload?.partnerId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = partnerAuth.payload.partnerId;
    const body = await req.json();

    // Validate required fields
    const requiredFields = ['country', 'businessName', 'businessAddress', 'contactFirstName', 'contactLastName', 'contactEmail', 'contactPhone'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { success: false, error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate business address
    const addressFields = ['street', 'city', 'state', 'postalCode', 'country'];
    for (const field of addressFields) {
      if (!body.businessAddress[field]) {
        return NextResponse.json(
          { success: false, error: `Missing required address field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate documents
    if (!body.documents || !Array.isArray(body.documents) || body.documents.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one document is required' },
        { status: 400 }
      );
    }

    logger.info('Phone activation submission received', {
      operation: 'phone_activation_api',
      partnerId,
      country: body.country
    });

    const service = new RegulatoryBundleService();

    // Create draft
    const activationId = await service.createDraft({
      partnerId,
      customerId: body.customerId || undefined,
      country: body.country,
      businessName: body.businessName,
      businessType: body.businessType,
      businessAddress: body.businessAddress,
      businessRegistrationNumber: body.businessRegistrationNumber,
      businessRegistrationAuthority: body.businessRegistrationAuthority,
      businessWebsite: body.businessWebsite,
      contactFirstName: body.contactFirstName,
      contactLastName: body.contactLastName,
      contactEmail: body.contactEmail,
      contactPhone: body.contactPhone,
      documents: body.documents,
      numberType: body.numberType || 'mobile',
    });

    // Process and submit asynchronously (don't block the response)
    // We use a fire-and-forget pattern here since the processing can take time
    service.processAndSubmit(activationId).catch((error) => {
      logger.error('Background phone activation processing failed', error as Error, {
        operation: 'phone_activation_api',
        activationId,
        partnerId
      });
    });

    return NextResponse.json({
      success: true,
      data: {
        activationId,
        status: 'submitted',
        message: 'Your phone service activation has been submitted. We are processing your documents and will notify you of the status.',
      },
    });
  } catch (error) {
    logger.error('Phone activation submission failed', error as Error, {
      operation: 'phone_activation_api'
    });
    return NextResponse.json(
      { success: false, error: 'Failed to submit phone activation' },
      { status: 500 }
    );
  }
}

