import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Verify admin authentication using custom Supabase admin cookies
async function verifyAdminAuth(request: NextRequest) {
  try {
    // Initialize Supabase client - SECURITY: Use server-side only variables
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase URL or Key is missing');
      return null;
    }

    // Extract cookies from the request
    const cookieHeader = request.headers.get('cookie') || '';
    console.log('Cookie header length:', cookieHeader.length);

    // Parse cookies to find our custom admin session cookie
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      if (key && value) {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, string>);

    console.log('Available cookies:', Object.keys(cookies));

    // Check for our custom admin session token
    const adminSessionToken = cookies['supabase-admin-session'];

    if (!adminSessionToken) {
      console.log('No admin session token found in cookies');
      console.log('Looking for supabase-admin-session in:', Object.keys(cookies));
      return null;
    }

    console.log('Admin session token found, verifying...');
    console.log('Token length:', adminSessionToken.length);
    console.log('Token starts with:', adminSessionToken.substring(0, 20) + '...');

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the token by setting it and getting the user
    const { data: { user }, error } = await supabase.auth.getUser(adminSessionToken);

    if (error) {
      console.error('Error verifying admin token:', error.message);
      console.error('Error details:', error);
      return null;
    }

    if (!user) {
      console.log('No user found for admin token');
      return null;
    }

    console.log('Admin authenticated successfully:', user.email);
    return user;

  } catch (error) {
    console.error('Error in admin auth verification:', error);
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    // Verify admin authentication
    const user = await verifyAdminAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const customerId = searchParams.get('customerId');
    const _partnerId = searchParams.get('partnerId');

    // Debug: log the action being requested
    console.log('Customer relations API called with action:', action);

    if (action === 'debug') {
      // Simple debug endpoint to test authentication
      return NextResponse.json({
        success: true,
        message: 'Authentication successful',
        user: {
          email: user.email,
          id: user.id
        },
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'analyze') {
      // Analyze customer relationships for a specific customer or all customers
      const whereClause = customerId ? { id: customerId } : {};
      
      const customers = await prisma.customer.findMany({
        where: whereClause,
        include: {
          userOnboarding: {
            include: {
              partner: {
                select: {
                  id: true,
                  businessName: true,
                  emailAddress: true,
                }
              }
            }
          },
          credentials: {
            include: {
              partner: {
                select: {
                  id: true,
                  businessName: true,
                  emailAddress: true,
                }
              }
            }
          },
          phoneNumbers: {
            select: {
              id: true,
              phoneNumber: true,
              partnerId: true,
              status: true,
            }
          }
        },
        take: customerId ? 1 : 50, // Limit to 50 customers if no specific customer
        orderBy: {
          createdAt: 'desc'
        }
      });

      const analysis = await Promise.all(customers.map(async customer => {
        const userOnboardingPartners = customer.userOnboarding.map(uo => ({
          partnerId: uo.partnerId,
          partnerName: uo.partner?.businessName || 'Unknown',
          hasCustomerId: !!uo.customerId,
          userOnboardingId: uo.id,
        }));

        // IMPORTANT: Also find orphaned UserOnboarding records that should be linked to this customer
        const orphanedUserOnboardingRecords = await prisma.userOnboarding.findMany({
          where: {
            customerId: null,
            OR: [
              { userId: customer.userId },
              { email: customer.email }
            ]
          },
          include: {
            partner: {
              select: {
                id: true,
                businessName: true,
                emailAddress: true,
              }
            }
          }
        });

        // Add orphaned records to the userOnboarding list
        const orphanedPartners = orphanedUserOnboardingRecords.map(uo => ({
          partnerId: uo.partnerId,
          partnerName: uo.partner?.businessName || 'Unknown',
          hasCustomerId: false, // These are the broken links
          userOnboardingId: uo.id,
        }));

        console.log(`Customer ${customer.email}: Found ${orphanedUserOnboardingRecords.length} orphaned UserOnboarding records`);

        // Combine linked and orphaned UserOnboarding records
        const allUserOnboardingPartners = [...userOnboardingPartners, ...orphanedPartners];

        const credentialPartners = customer.credentials.map(c => ({
          partnerId: c.partnerId,
          partnerName: c.partner?.businessName || 'Unknown',
          credentialId: c.id,
        }));

        const phoneNumberPartners = customer.phoneNumbers.map(pn => ({
          partnerId: pn.partnerId,
          phoneNumber: pn.phoneNumber,
          status: pn.status,
        }));

        // Check for issues
        const orphanedUserOnboarding = allUserOnboardingPartners.filter(up => !up.hasCustomerId);
        const phoneNumbersWithoutAccess = phoneNumberPartners.filter(pn => {
          const hasUserOnboardingAccess = allUserOnboardingPartners.some(up => up.partnerId === pn.partnerId && up.hasCustomerId);
          const hasCredentialAccess = credentialPartners.some(cp => cp.partnerId === pn.partnerId);
          return !hasUserOnboardingAccess && !hasCredentialAccess;
        });

        return {
          customer: {
            id: customer.id,
            email: customer.email,
            firstName: customer.firstName,
            lastName: customer.lastName,
            userId: customer.userId,
          },
          relationships: {
            userOnboarding: allUserOnboardingPartners,
            credentials: credentialPartners,
            phoneNumbers: phoneNumberPartners,
          },
          issues: {
            orphanedUserOnboarding,
            phoneNumbersWithoutAccess,
            hasIssues: orphanedUserOnboarding.length > 0 || phoneNumbersWithoutAccess.length > 0,
          }
        };
      }));

      return NextResponse.json({
        success: true,
        data: analysis,
        summary: {
          totalCustomers: analysis.length,
          customersWithIssues: analysis.filter(a => a.issues.hasIssues).length,
          totalOrphanedUserOnboarding: analysis.reduce((sum, a) => sum + a.issues.orphanedUserOnboarding.length, 0),
          totalPhoneNumbersWithoutAccess: analysis.reduce((sum, a) => sum + a.issues.phoneNumbersWithoutAccess.length, 0),
        }
      });
    }

    if (action === 'search') {
      // Search for customers by email or name
      const query = searchParams.get('query');
      if (!query) {
        return NextResponse.json({ error: 'Query parameter required for search' }, { status: 400 });
      }

      const customers = await prisma.customer.findMany({
        where: {
          OR: [
            { email: { contains: query, mode: 'insensitive' } },
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
          ]
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          userId: true,
          createdAt: true,
        },
        take: 20,
        orderBy: {
          createdAt: 'desc'
        }
      });

      return NextResponse.json({
        success: true,
        data: customers
      });
    }

    // Default: return summary statistics
    const stats = await prisma.$transaction(async (tx) => {
      const totalCustomers = await tx.customer.count();
      
      // Count UserOnboarding records without customerId but with userId
      const allUserOnboardingWithoutCustomerId = await tx.userOnboarding.findMany({
        where: {
          customerId: null
        },
        select: {
          id: true,
          userId: true
        }
      });

      const userOnboardingWithoutCustomerId = allUserOnboardingWithoutCustomerId.filter(
        uo => uo.userId && uo.userId.trim() !== ''
      ).length;

      const customersWithPhoneNumbers = await tx.customer.count({
        where: {
          phoneNumbers: {
            some: {}
          }
        }
      });

      return {
        totalCustomers,
        userOnboardingWithoutCustomerId,
        customersWithPhoneNumbers,
      };
    });

    return NextResponse.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error in customer relations API:', error);

    // More detailed error logging
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Verify admin authentication
    const user = await verifyAdminAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, customerId, userOnboardingId } = body;

    if (action === 'fix-customer-link') {
      if (!customerId || !userOnboardingId) {
        return NextResponse.json({ error: 'customerId and userOnboardingId are required' }, { status: 400 });
      }

      // Get the UserOnboarding record
      const userOnboarding = await prisma.userOnboarding.findUnique({
        where: { id: userOnboardingId },
        select: {
          id: true,
          userId: true,
          email: true,
          partnerId: true,
          customerId: true,
        }
      });

      if (!userOnboarding) {
        return NextResponse.json({ error: 'UserOnboarding record not found' }, { status: 404 });
      }

      // Get the Customer record
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          userId: true,
          email: true,
        }
      });

      if (!customer) {
        return NextResponse.json({ error: 'Customer record not found' }, { status: 404 });
      }

      // Verify that this is a valid link (same userId or email)
      const isValidLink = userOnboarding.userId === customer.userId ||
                         userOnboarding.email === customer.email;

      if (!isValidLink) {
        return NextResponse.json({
          error: 'Invalid link: UserOnboarding and Customer records do not match by userId or email',
          details: {
            userOnboarding: { userId: userOnboarding.userId, email: userOnboarding.email },
            customer: { userId: customer.userId, email: customer.email }
          }
        }, { status: 400 });
      }

      // Update the UserOnboarding record to link to the Customer
      const _updatedUserOnboarding = await prisma.userOnboarding.update({
        where: { id: userOnboardingId },
        data: { customerId: customerId }
      });

      console.log(`Admin ${user.email} fixed customer link: UserOnboarding ${userOnboardingId} -> Customer ${customerId}`);

      return NextResponse.json({
        success: true,
        message: 'Customer relationship fixed successfully',
        data: {
          userOnboardingId,
          customerId,
          previousCustomerId: userOnboarding.customerId,
          newCustomerId: customerId,
        }
      });
    }

    if (action === 'fix-all-for-customer') {
      if (!customerId) {
        return NextResponse.json({ error: 'customerId is required' }, { status: 400 });
      }

      // Get the customer
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          userId: true,
          email: true,
        }
      });

      if (!customer) {
        return NextResponse.json({ error: 'Customer record not found' }, { status: 404 });
      }

      // Find all UserOnboarding records that should be linked to this customer
      const orphanedUserOnboarding = await prisma.userOnboarding.findMany({
        where: {
          customerId: null,
          OR: [
            { userId: customer.userId },
            { email: customer.email }
          ]
        }
      });

      // Update all matching UserOnboarding records
      const updatePromises = orphanedUserOnboarding.map(uo =>
        prisma.userOnboarding.update({
          where: { id: uo.id },
          data: { customerId: customerId }
        })
      );

      const results = await Promise.all(updatePromises);

      console.log(`Admin ${user.email} fixed ${results.length} customer links for customer ${customerId}`);

      return NextResponse.json({
        success: true,
        message: `Fixed ${results.length} customer relationships`,
        data: {
          customerId,
          fixedUserOnboardingIds: results.map(r => r.id),
          count: results.length,
        }
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Error in customer relations POST API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
