import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { addDays, format, subDays } from 'date-fns';
import { verifyJWT } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Get the token from the Authorization header
    const authHeader = request.headers.get('Authorization');
    console.log('Auth header:', authHeader);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No valid Authorization header found');
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    console.log('Extracted token:', token.substring(0, 20) + '...');

    const payload = await verifyJWT(token);
    console.log('Verified JWT payload:', payload);

    if (!payload) {
      console.log('No payload returned from verifyJWT');
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    if (!payload.partnerId) {
      console.log('No partnerId in payload:', payload);
      return NextResponse.json({ error: 'Invalid token payload' }, { status: 401 });
    }

    console.log('Looking up partner with ID:', payload.partnerId);

    // First verify that the partner exists
    console.log('Executing partner findUnique query...');
    const partnerResult = await prisma.partner.findUnique({
      where: {
        id: payload.partnerId,
      },
    });
    console.log('Partner query result:', partnerResult);

    if (!partnerResult) {
      console.log('No partner found with ID:', payload.partnerId);
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    console.log('Found partner:', {
      id: partnerResult.id,
      businessName: partnerResult.businessName,
      email: partnerResult.emailAddress
    });

    // Get all customers for this partner with their estimated prices
    console.log('Executing customer findMany query...');
    const customers = await prisma.userOnboarding.findMany({
      where: {
        OR: [
          {
            partnerId: payload.partnerId
          },
          {
            partner: {
              id: payload.partnerId
            }
          }
        ]
      },
      select: {
        id: true,
        customerId: true,
        createdAt: true,
        orderStatus: true,
        estimatedPrice: true,
        agreedPrice: true,
        dealStatus: true,
        billingType: true,
        enableAdvancedAnalytics: true,
        enableDetailedCallAnalysis: true,
        enableActionPointAnalysis: true,
        customerPortalEnabled: true,
      },
    });
    console.log('Customer query result:', JSON.stringify(customers, null, 2));

    console.log(`Found ${customers.length} customers for partner ${payload.partnerId}`);

    // Calculate Total Opportunity Value (sum of all estimated prices for non-failed deals)
    console.log('Calculating metrics...');
    const totalOpportunityValue = customers.reduce((total, customer) => {
      // Only include opportunities that haven't failed
      if (customer.dealStatus !== 'FAILED') {
        const price = typeof customer.estimatedPrice === 'number' ? customer.estimatedPrice : 0;
        console.log(`Customer ${customer.id} estimated price: ${price}`);
        return total + price;
      }
      return total;
    }, 0);

    console.log('Total Opportunity Value:', totalOpportunityValue);

    // Calculate Monthly Recurring Revenue (MRR) from customers with agreed prices
    const totalMRR = customers.reduce((total, customer) => {
      if (customer.dealStatus === 'AGREED' && typeof customer.agreedPrice === 'number') {
        // Only count as MRR if billing type is MONTHLY
        if (customer.billingType === 'MONTHLY') {
          console.log(`Customer ${customer.id} MRR: ${customer.agreedPrice}`);
          return total + customer.agreedPrice;
        }
      }
      return total;
    }, 0);
    console.log('Total MRR:', totalMRR);

    console.log('Calculating customer counts...');
    const totalUsers = customers.length;
    const liveUsers = customers.filter(customer =>
      customer.orderStatus === 'Voice AI Agent Live' ||
      customer.orderStatus === 'live'
    ).length;
    console.log('Live users:', liveUsers);

    const dealAgreed = customers.filter(customer => customer.dealStatus === 'AGREED').length;
    console.log('Deals agreed:', dealAgreed);

    const dealFailed = customers.filter(customer => customer.dealStatus === 'FAILED').length;
    console.log('Deals failed:', dealFailed);

    const dealPending = customers.filter(customer => customer.dealStatus === 'PENDING').length;
    console.log('Deals pending:', dealPending);

    // Generate timeline data for the last 30 days
    console.log('Generating timeline data...');
    const timelineData = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = subDays(today, i);
      const dateStr = format(date, 'MMM dd');

      const customersUntilDate = customers.filter(customer =>
        new Date(customer.createdAt) <= date
      );

      timelineData.push({
        date: dateStr,
        totalUsers: customersUntilDate.length,
        dealAgreed: customersUntilDate.filter(customer => customer.dealStatus === 'AGREED').length,
        dealFailed: customersUntilDate.filter(customer => customer.dealStatus === 'FAILED').length,
        dealPending: customersUntilDate.filter(customer => customer.dealStatus === 'PENDING').length,
        liveUsers: customersUntilDate.filter(customer =>
          customer.orderStatus === 'Voice AI Agent Live' ||
          customer.orderStatus === 'live'
        ).length,
      });
    }
    console.log('Timeline data generated for 30 days');

    // Calculate customer portal statistics
    console.log('Calculating customer portal statistics...');
    const customersWithPortalAccess = customers.filter(customer => customer.customerPortalEnabled).length;

    // Get total unique customers for this partner (UserOnboarding + CustomerCredential)
    // This includes both partner-onboarded and self-registered customers
    const customerCredentials = await prisma.customerCredential.findMany({
      where: {
        partnerId: payload.partnerId,
        status: 'active'
      },
      select: {
        customerId: true
      }
    });

    // Get unique customer IDs from UserOnboarding (those with customerId)
    const userOnboardingCustomerIds = new Set(
      customers
        .map(c => c.customerId)
        .filter(id => id !== null)
    );

    // Get unique customer IDs from CustomerCredential
    const credentialCustomerIds = new Set(
      customerCredentials.map(cc => cc.customerId)
    );

    // Combine both sets to get total unique customers
    const allUniqueCustomerIds = new Set([
      ...userOnboardingCustomerIds,
      ...credentialCustomerIds
    ]);

    const totalRegisteredCustomers = allUniqueCustomerIds.size;

    console.log(`Portal statistics: ${customersWithPortalAccess} with access, ${totalRegisteredCustomers} total registered customers`);

    // Get phone numbers count
    const totalPhoneNumbers = await prisma.phoneNumber.count({
      where: {
        customer: {
          userOnboarding: {
            some: {
              partnerId: payload.partnerId
            }
          }
        }
      }
    });
    console.log(`Phone numbers: ${totalPhoneNumbers} total`);

    const response = {
      totalOpportunityValue: Number(totalOpportunityValue.toFixed(2)),
      totalMRR: Number(totalMRR.toFixed(2)),
      totalUsers,
      liveUsers,
      dealAgreed,
      dealFailed,
      dealPending,
      timelineData,
      // Customer portal statistics
      customersWithPortalAccess,
      totalRegisteredCustomers,
      totalPhoneNumbers,
    };

    console.log('Final response:', response);
    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in metrics endpoint:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack
      });
    }
    return NextResponse.json(
      { error: 'An error occurred while fetching metrics' },
      { status: 500 }
    );
  }
}
