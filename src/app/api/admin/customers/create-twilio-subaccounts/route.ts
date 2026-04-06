import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createTwilioSubaccount } from '@/lib/twilio-subaccount';
import { getAuth } from '@clerk/nextjs/server';
import { isAdmin } from '@/lib/admin';

export async function POST(req: NextRequest) {
  try {
    // Check if user is authenticated and is an admin
    const auth = await getAuth(req);
    if (!auth.userId || !(await isAdmin(auth.userId))) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Get request parameters
    const body = await req.json();
    const { customerId, partnerId, dryRun = false } = body;

    // If customerId is provided, create subaccount for specific customer
    if (customerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        include: {
          credentials: {
            include: {
              partner: {
                select: { businessName: true },
              },
            },
            take: 1,
          },
        },
      });

      if (!customer) {
        return NextResponse.json(
          { error: 'Customer not found' },
          { status: 404 }
        );
      }

      if (customer.twilioSubaccountSid) {
        return NextResponse.json({
          message: 'Customer already has a Twilio subaccount',
          customerId: customer.id,
          twilioSubaccountSid: customer.twilioSubaccountSid,
        });
      }

      if (!dryRun) {
        const customerName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email;
        const partnerName = customer.credentials[0]?.partner.businessName || 'Unknown Partner';
        const result = await createTwilioSubaccount(
          customer.id,
          customerName,
          partnerName
        );

        return NextResponse.json({
          success: true,
          customerId: customer.id,
          twilioSubaccountSid: result.subaccountSid,
        });
      } else {
        return NextResponse.json({
          dryRun: true,
          message: 'Would create subaccount for customer',
          customerId: customer.id,
          customerEmail: customer.email,
        });
      }
    }

    // If partnerId is provided, create subaccounts for all customers of that partner
    if (partnerId) {
      const customers = await prisma.customer.findMany({
        where: {
          twilioSubaccountSid: null,
          credentials: {
            some: {
              partnerId: partnerId,
            },
          },
        },
        include: {
          credentials: {
            include: {
              partner: {
                select: { businessName: true },
              },
            },
            take: 1,
          },
        },
      });

      if (customers.length === 0) {
        return NextResponse.json({
          message: 'No customers without Twilio subaccounts found for this partner',
          partnerId,
        });
      }

      if (!dryRun) {
        const results = [];
        const errors = [];

        for (const customer of customers) {
          try {
            const customerName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email;
            const partnerName = customer.credentials[0]?.partner.businessName || 'Unknown Partner';
            const result = await createTwilioSubaccount(
              customer.id,
              customerName,
              partnerName
            );
            results.push({
              customerId: customer.id,
              email: customer.email,
              twilioSubaccountSid: result.subaccountSid,
            });
          } catch (error) {
            errors.push({
              customerId: customer.id,
              email: customer.email,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }

        return NextResponse.json({
          success: true,
          partnerId,
          created: results,
          errors,
        });
      } else {
        return NextResponse.json({
          dryRun: true,
          message: `Would create subaccounts for ${customers.length} customers`,
          partnerId,
          customers: customers.map(c => ({
            id: c.id,
            email: c.email,
          })),
        });
      }
    }

    // If no parameters provided, get count of customers without subaccounts
    const count = await prisma.customer.count({
      where: {
        twilioSubaccountSid: null,
      },
    });

    return NextResponse.json({
      message: 'Specify customerId or partnerId to create Twilio subaccounts',
      customersWithoutSubaccounts: count,
      parameters: {
        customerId: 'Create subaccount for specific customer',
        partnerId: 'Create subaccounts for all customers of a partner',
        dryRun: 'Set to true to see what would be created without actually creating',
      },
    });

  } catch (error) {
    console.error('Error creating Twilio subaccounts:', error);
    return NextResponse.json(
      { error: 'Failed to create Twilio subaccounts', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}