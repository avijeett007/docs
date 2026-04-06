import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/services/email-service';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Verify admin authentication using custom Supabase admin cookies
async function verifyAdminAuth(request: NextRequest) {
  try {
    // Initialize Supabase client - SECURITY: Use server-side only environment variables
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
      console.log('Authentication failed: no user found');
      return null;
    }

    console.log('Admin authentication successful:', user.email);
    return user;
  } catch (error) {
    console.error('Error in admin authentication:', error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    // Verify admin authentication
    const user = await verifyAdminAuth(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { receiptId } = await req.json();

    if (!receiptId) {
      return NextResponse.json(
        { success: false, error: 'Receipt ID is required' },
        { status: 400 }
      );
    }

    // Get receipt with related data
    const receipt = await prisma.receipt.findUnique({
      where: { id: receiptId },
      include: {
        partner: true,
        coupon: true,
      }
    });

    if (!receipt) {
      return NextResponse.json(
        { success: false, error: 'Receipt not found' },
        { status: 404 }
      );
    }

    // Prepare receipt data for email
    const receiptData = {
      customerName: receipt.customerName,
      customerEmail: receipt.customerEmail,
      businessName: receipt.businessName,
      amount: Number(receipt.amount),
      couponCode: receipt.coupon?.code || 'N/A',
      couponName: receipt.coupon?.name || 'Lifetime Offer',
      transactionId: receipt.stripePaymentIntentId || receipt.stripeSessionId || receipt.receiptNumber,
      date: receipt.createdAt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
    };

    // Send receipt email
    const emailSent = await emailService.sendReceiptEmail(receiptData);

    if (emailSent) {
      // Update receipt record
      await prisma.receipt.update({
        where: { id: receiptId },
        data: {
          emailSent: true,
          emailSentAt: new Date(),
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Receipt email sent successfully',
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to send receipt email' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error resending receipt:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Get all receipts for admin
export async function GET(req: NextRequest) {
  try {
    // Verify admin authentication
    const user = await verifyAdminAuth(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const partnerId = searchParams.get('partnerId');
    const skip = (page - 1) * limit;

    const where = partnerId ? { partnerId } : {};

    const [receipts, total] = await Promise.all([
      prisma.receipt.findMany({
        where,
        include: {
          partner: {
            select: {
              businessName: true,
              emailAddress: true,
            }
          },
          coupon: {
            select: {
              code: true,
              name: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.receipt.count({ where })
    ]);

    return NextResponse.json({
      success: true,
      data: {
        receipts,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        }
      }
    });
  } catch (error) {
    console.error('Error fetching receipts:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
