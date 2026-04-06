import { NextRequest, NextResponse } from 'next/server';
import { verifyWhitelabelAuth } from '@/lib/whitelabelAuth';
import { prisma } from '@/lib/prisma';
import { getCustomerTwilioClient, createSubaccountForExistingCustomer } from '@/lib/twilio-subaccount';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Verify whitelabel authentication
    const authResult = await verifyWhitelabelAuth(req);
    if (!authResult) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { customerId, partnerId } = authResult;
    const body = await req.json();
    const { phoneNumber, numberType, countryCode, address } = body;

    // Validate required fields
    if (!phoneNumber || !numberType || !countryCode || !address) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate address fields
    const { street, city, state, postalCode, country } = address;
    if (!street || !city || !state || !postalCode || !country) {
      return NextResponse.json(
        { error: 'All address fields are required' },
        { status: 400 }
      );
    }

    // Get customer's Twilio client (create subaccount if needed)
    let twilioClient;
    try {
      twilioClient = await getCustomerTwilioClient(customerId);
    } catch (error: any) {
      if (error.message.includes('No Twilio subaccount found') || error.message.includes('does not have a Twilio subaccount')) {
        console.log(`Creating Twilio subaccount for existing customer: ${customerId}`);
        await createSubaccountForExistingCustomer(customerId);
        twilioClient = await getCustomerTwilioClient(customerId);
      } else {
        throw error;
      }
    }

    // Create address in Twilio
    console.log('Creating Twilio address for:', { street, city, state, postalCode, country });
    
    const twilioAddress = await twilioClient.createAddress({
      CustomerName: `Customer ${customerId}`,
      Street: street,
      City: city,
      Region: state,
      PostalCode: postalCode,
      IsoCountry: country
    });

    console.log('Twilio address created:', twilioAddress.sid);

    // Store address information using Prisma model (production-safe)
    const addressRecord = await prisma.phoneNumberAddress.upsert({
      where: {
        phoneNumber: phoneNumber
      },
      update: {
        addressSid: twilioAddress.sid,
        street: address.street,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country,
        updatedAt: new Date()
      },
      create: {
        customerId: customerId,
        partnerId: partnerId,
        phoneNumber: phoneNumber,
        addressSid: twilioAddress.sid,
        street: address.street,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country
      }
    });

    console.log('Address record saved:', addressRecord.id);

    return NextResponse.json({
      success: true,
      message: 'Address saved successfully',
      addressId: addressRecord.id,
      twilioAddressSid: twilioAddress.sid
    });

  } catch (error: any) {
    console.error('Basic address creation error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to save address',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
