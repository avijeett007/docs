import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Verify admin authentication using custom Supabase admin cookies
async function verifyAdminAuth(request: NextRequest) {
  try {
    // Initialize Supabase client - SECURITY: Use server-side only environment variables
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase URL or Key is missing');
      return null;
    }

    // Extract cookies from the request
    const cookieHeader = request.headers.get('cookie') || '';

    // Parse cookies to find our custom admin session cookie
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);
    
    // Check for our custom admin session token
    const adminSessionToken = cookies['supabase-admin-session'];
    
    if (!adminSessionToken) {
      console.log('Authentication failed: missing token');
      return null;
    }
    
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Verify the token by setting it and getting the user
    const { data: { user }, error } = await supabase.auth.getUser(adminSessionToken);
    
    if (error) {
      console.error('Authentication error');
      return null;
    }
    
    if (!user) {
      console.log('Authentication failed: invalid token');
      return null;
    }
    
    console.log('Admin authentication successful');
    return user;
  } catch (error) {
    console.error('Authentication exception');
    return null;
  }
}

/**
 * GET /api/admin/credits/recurring-grants
 * Get active recurring credit grants for partners
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const user = await verifyAdminAuth(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const partnerId = searchParams.get('partnerId');

    // Build where clause
    const whereClause: any = {
      grantType: 'monthly_recurring',
      status: 'active'
    };

    if (partnerId) {
      whereClause.partnerId = partnerId;
    }

    // Get active recurring grants
    const grants = await prisma.adminCreditGrant.findMany({
      where: whereClause,
      include: {
        partner: {
          select: {
            id: true,
            businessName: true,
            emailAddress: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      success: true,
      data: {
        grants: grants.map(grant => ({
          id: grant.id,
          partnerId: grant.partnerId,
          partnerName: grant.partner.businessName,
          partnerEmail: grant.partner.emailAddress,
          creditsGranted: grant.creditsGranted,
          totalGranted: grant.totalGranted,
          recurringEndDate: grant.recurringEndDate,
          nextGrantDate: grant.nextGrantDate,
          reason: grant.reason,
          grantedBy: grant.grantedBy,
          createdAt: grant.createdAt
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching recurring grants:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/credits/recurring-grants
 * Cancel a recurring credit grant
 */
export async function DELETE(request: NextRequest) {
  try {
    // Verify admin authentication
    const user = await verifyAdminAuth(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const grantId = searchParams.get('grantId');

    if (!grantId) {
      return NextResponse.json(
        { success: false, error: 'Grant ID is required' },
        { status: 400 }
      );
    }

    // Cancel the grant
    const updatedGrant = await prisma.adminCreditGrant.update({
      where: { id: grantId },
      data: { status: 'cancelled' },
      include: {
        partner: {
          select: {
            businessName: true
          }
        }
      }
    });

    // Log the cancellation
    await prisma.creditTransaction.create({
      data: {
        partnerId: updatedGrant.partnerId,
        type: 'adjustment',
        amount: 0,
        balanceAfter: 0, // Will be updated with actual balance
        description: `Recurring credit grant cancelled by admin`,
        createdBy: user.email || 'admin',
        metadata: {
          adminOperation: true,
          operationType: 'cancel_recurring_grant',
          grantId: updatedGrant.id,
          originalReason: updatedGrant.reason
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: `Recurring grant cancelled for ${updatedGrant.partner.businessName}`,
      data: {
        grantId: updatedGrant.id,
        partnerId: updatedGrant.partnerId,
        cancelledBy: user.email || 'admin',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error cancelling recurring grant:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
