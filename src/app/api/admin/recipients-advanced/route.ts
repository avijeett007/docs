import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { createClient } from '@supabase/supabase-js';

// Verify admin authentication using custom Supabase admin cookies
async function verifyAdminAuth(request: NextRequest) {
  try {
    // Initialize Supabase client - SECURITY: Use server-side only variables
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase configuration error');
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

// GET - Fetch recipients based on advanced criteria
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const user = await verifyAdminAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get query parameters
    const url = new URL(request.url);
    const targetType = url.searchParams.get('targetType');
    const limit = url.searchParams.get('limit');
    const customLimit = url.searchParams.get('customLimit');

    console.log('Recipients API called with targetType:', targetType);

    let recipients: any[] = [];

    switch (targetType) {
      case 'all_partners':
        // All partners regardless of status
        const allPartners = await prisma.partner.findMany({
          select: {
            id: true,
            businessName: true,
            emailAddress: true,
            approvalStatus: true,
          },
          orderBy: {
            businessName: 'asc',
          },
        });

        recipients = allPartners.map((partner) => ({
          id: partner.id,
          name: partner.businessName,
          email: partner.emailAddress,
          type: 'partner',
          businessName: partner.businessName,
          approvalStatus: partner.approvalStatus
        }));
        break;

      case 'active_partners':
        // Only active partners
        const activePartners = await prisma.partner.findMany({
          select: {
            id: true,
            businessName: true,
            emailAddress: true,
            approvalStatus: true,
          },
          where: {
            approvalStatus: 'ACTIVE'
          },
          orderBy: {
            businessName: 'asc',
          },
        });

        recipients = activePartners.map((partner) => ({
          id: partner.id,
          name: partner.businessName,
          email: partner.emailAddress,
          type: 'partner',
          businessName: partner.businessName,
          approvalStatus: partner.approvalStatus
        }));
        break;

      case 'pending_partners':
        // Only pending partners
        const pendingPartners = await prisma.partner.findMany({
          select: {
            id: true,
            businessName: true,
            emailAddress: true,
            approvalStatus: true,
          },
          where: {
            approvalStatus: 'PENDING'
          },
          orderBy: {
            businessName: 'asc',
          },
        });

        recipients = pendingPartners.map((partner) => ({
          id: partner.id,
          name: partner.businessName,
          email: partner.emailAddress,
          type: 'partner',
          businessName: partner.businessName,
          approvalStatus: partner.approvalStatus
        }));
        break;

      case 'approved_partners':
        // Only approved partners
        const approvedPartners = await prisma.partner.findMany({
          select: {
            id: true,
            businessName: true,
            emailAddress: true,
            approvalStatus: true,
          },
          where: {
            approvalStatus: 'APPROVED'
          },
          orderBy: {
            businessName: 'asc',
          },
        });

        recipients = approvedPartners.map((partner) => ({
          id: partner.id,
          name: partner.businessName,
          email: partner.emailAddress,
          type: 'partner',
          businessName: partner.businessName,
          approvalStatus: partner.approvalStatus
        }));
        break;

      case 'rejected_partners':
        // Only rejected partners
        const rejectedPartners = await prisma.partner.findMany({
          select: {
            id: true,
            businessName: true,
            emailAddress: true,
            approvalStatus: true,
          },
          where: {
            approvalStatus: 'REJECTED'
          },
          orderBy: {
            businessName: 'asc',
          },
        });

        recipients = rejectedPartners.map((partner) => ({
          id: partner.id,
          name: partner.businessName,
          email: partner.emailAddress,
          type: 'partner',
          businessName: partner.businessName,
          approvalStatus: partner.approvalStatus
        }));
        break;

      case 'all_waitlist':
        // All waitlist members
        const allWaitlist = await prisma.waitlist.findMany({
          select: {
            id: true,
            name: true,
            email: true,
          },
          orderBy: {
            name: 'asc',
          },
        });

        recipients = allWaitlist.map((member) => ({
          id: member.id,
          name: member.name,
          email: member.email,
          type: 'waitlist'
        }));
        break;

      case 'limited_partners':
        // Limited number of active partners
        const limitedPartners = await prisma.partner.findMany({
          select: {
            id: true,
            businessName: true,
            emailAddress: true,
            approvalStatus: true,
          },
          where: {
            approvalStatus: 'ACTIVE'
          },
          orderBy: {
            businessName: 'asc',
          },
          take: limit ? parseInt(limit) : 10,
        });

        recipients = limitedPartners.map((partner) => ({
          id: partner.id,
          name: partner.businessName,
          email: partner.emailAddress,
          type: 'partner',
          businessName: partner.businessName,
          approvalStatus: partner.approvalStatus
        }));
        break;

      case 'limited_waitlist':
        // Limited number of waitlist members
        const limitedWaitlist = await prisma.waitlist.findMany({
          select: {
            id: true,
            name: true,
            email: true,
          },
          orderBy: {
            name: 'asc',
          },
          take: limit ? parseInt(limit) : 10,
        });

        recipients = limitedWaitlist.map((member) => ({
          id: member.id,
          name: member.name,
          email: member.email,
          type: 'waitlist'
        }));
        break;

      case 'custom_waitlist':
        // Custom number of waitlist members
        const customWaitlist = await prisma.waitlist.findMany({
          select: {
            id: true,
            name: true,
            email: true,
          },
          orderBy: {
            name: 'asc',
          },
          take: customLimit ? parseInt(customLimit) : 10,
        });

        recipients = customWaitlist.map((member) => ({
          id: member.id,
          name: member.name,
          email: member.email,
          type: 'waitlist'
        }));
        break;

      case 'everyone':
        // Active partners + all waitlist
        const everyonePartners = await prisma.partner.findMany({
          select: {
            id: true,
            businessName: true,
            emailAddress: true,
            approvalStatus: true,
          },
          where: {
            approvalStatus: 'ACTIVE'
          },
          orderBy: {
            businessName: 'asc',
          },
        });

        const everyoneWaitlist = await prisma.waitlist.findMany({
          select: {
            id: true,
            name: true,
            email: true,
          },
          orderBy: {
            name: 'asc',
          },
        });

        recipients = [
          ...everyonePartners.map((partner) => ({
            id: partner.id,
            name: partner.businessName,
            email: partner.emailAddress,
            type: 'partner',
            businessName: partner.businessName,
            approvalStatus: partner.approvalStatus
          })),
          ...everyoneWaitlist.map((member) => ({
            id: member.id,
            name: member.name,
            email: member.email,
            type: 'waitlist'
          }))
        ];
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid target type' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      recipients,
      count: recipients.length,
      targetType,
      criteria: {
        targetType,
        limit: limit ? parseInt(limit) : undefined,
        customLimit: customLimit ? parseInt(customLimit) : undefined
      }
    });
  } catch (error) {
    console.error('Error fetching advanced recipients:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recipients' },
      { status: 500 }
    );
  }
}
