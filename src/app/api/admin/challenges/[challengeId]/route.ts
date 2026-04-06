import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';

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

    return user;
  } catch (error) {
    console.error('Admin auth verification error:', error);
    return null;
  }
}

// GET - Get specific challenge details
export async function GET(
  request: NextRequest,
  { params }: { params: { challengeId: string } }
) {
  try {
    // Verify admin authentication
    const adminUser = await verifyAdminAuth(request);
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { challengeId } = params;

    const challenge = await prisma.dailyChallenge.findUnique({
      where: { id: challengeId },
      include: {
        creator: {
          select: {
            id: true,
            businessName: true,
            emailAddress: true
          }
        },
        partnerProgress: {
          include: {
            partner: {
              select: {
                id: true,
                businessName: true,
                emailAddress: true
              }
            }
          }
        }
      }
    });

    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: challenge
    });

  } catch (error) {
    console.error('Error fetching challenge:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 });
  }
}

// PUT - Update challenge
export async function PUT(
  request: NextRequest,
  { params }: { params: { challengeId: string } }
) {
  try {
    // Verify admin authentication
    const adminUser = await verifyAdminAuth(request);
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { challengeId } = params;
    const body = await request.json();
    const {
      title,
      description,
      steps,
      rewardCredits,
      requiresProof,
      scheduledDate,
      isActive
    } = body;

    // Check if challenge exists
    const existingChallenge = await prisma.dailyChallenge.findUnique({
      where: { id: challengeId }
    });

    if (!existingChallenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    // Validate steps if provided
    if (steps && Array.isArray(steps)) {
      for (const step of steps) {
        if (!step.id || !step.title || !step.type) {
          return NextResponse.json({ 
            error: 'Each step must have id, title, and type fields' 
          }, { status: 400 });
        }
      }
    }

    // Update challenge
    const updatedChallenge = await prisma.dailyChallenge.update({
      where: { id: challengeId },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(steps && { steps }),
        ...(rewardCredits !== undefined && { rewardCredits }),
        ...(requiresProof !== undefined && { requiresProof }),
        ...(scheduledDate && { scheduledDate: new Date(scheduledDate) }),
        ...(isActive !== undefined && { isActive }),
        updatedAt: new Date()
      },
      include: {
        creator: {
          select: {
            id: true,
            businessName: true,
            emailAddress: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: updatedChallenge,
      message: 'Challenge updated successfully'
    });

  } catch (error) {
    console.error('Error updating challenge:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 });
  }
}

// DELETE - Delete challenge
export async function DELETE(
  request: NextRequest,
  { params }: { params: { challengeId: string } }
) {
  try {
    // Verify admin authentication
    const adminUser = await verifyAdminAuth(request);
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { challengeId } = params;

    // Check if challenge exists
    const existingChallenge = await prisma.dailyChallenge.findUnique({
      where: { id: challengeId },
      include: {
        partnerProgress: true
      }
    });

    if (!existingChallenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    // Check if challenge has any progress (prevent deletion if partners have started)
    if (existingChallenge.partnerProgress.length > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete challenge with existing partner progress. Deactivate instead.' 
      }, { status: 400 });
    }

    // Delete challenge
    await prisma.dailyChallenge.delete({
      where: { id: challengeId }
    });

    return NextResponse.json({
      success: true,
      message: 'Challenge deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting challenge:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 });
  }
}
