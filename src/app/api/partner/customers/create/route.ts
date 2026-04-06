import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';
import { verifyPartnerJWT } from '@/lib/auth';
import crypto from 'crypto';
import { onboardCustomerTwilioSubaccount } from '@/lib/twilio-subaccount';
import { applyPlanFeaturesToCustomer } from '@/lib/services/planFeatureService';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Verify partner token
    const decoded = await verifyPartnerJWT(request);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    const partnerId = decoded.payload.partnerId;

    // Parse request body
    const body = await request.json();
    const { email, firstName, lastName, companyName, password, planId } = body;

    // Basic validation
    if (!email || !firstName || !lastName || !companyName || !password) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    // We already verified the partner from the JWT token

    // Check if the partner exists
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId }
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    // Check if white-label portal is enabled for this partner
    if (!partner.customerPortalEnabled) {
      return NextResponse.json({ 
        error: 'White-label customer portal is not enabled for this partner' 
      }, { status: 403 });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // First, create the customer
    const customer = await prisma.customer.create({
      data: {
        userId: crypto.randomUUID(),
        email,
        firstName,
        lastName,
        status: 'active',
        customerPortalEnabled: true // Enable portal access for partner-created customers
      }
    });
    
    // Then create the customer credential linked to both partner and customer
    const customerCredential = await prisma.customerCredential.create({
      data: {
        email,
        passwordHash: hashedPassword,
        status: 'active',
        customerId: customer.id,
        partnerId,
        lastReset: new Date() // Mark that password has been set (partner-created users set their own password)
      }
    });

    // Create Twilio subaccount for the customer (non-blocking)
    onboardCustomerTwilioSubaccount(customer.id, partnerId).catch(error => {
      logger.error('Failed to create Twilio subaccount for customer', error instanceof Error ? error : new Error(String(error)), { customerId: customer.id, partnerId });
    });

    // If a planId was provided, apply plan features to the customer
    if (planId) {
      try {
        logger.info('Applying plan features to partner-created customer', { planId, customerId: customer.id, partnerId });
        await applyPlanFeaturesToCustomer(planId, customer.id, partnerId);
        logger.info('Successfully applied plan features to customer', { planId, customerId: customer.id, partnerId });
      } catch (planError) {
        logger.error('Failed to apply plan features during customer creation', planError instanceof Error ? planError : new Error(String(planError)), { planId, customerId: customer.id, partnerId });
      }
    }

    // Return success without including sensitive information
    return NextResponse.json({
      id: customerCredential.id,
      email: customerCredential.email,
      customerId: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      createdAt: customerCredential.createdAt
    });
  } catch (error: any) {
    logger.error('Error creating customer', error instanceof Error ? error : new Error(String(error)), { operation: 'partner-create-customer' });
    
    // Handle duplicate email error for CustomerCredential (partner-scoped)
    if (error?.code === 'P2002' && error?.meta?.target?.includes('partner_id') && error?.meta?.target?.includes('email')) {
      return NextResponse.json({
        error: 'A customer with this email already exists for this partner'
      }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'An error occurred while creating the customer' }, { status: 500 });
  }
}
