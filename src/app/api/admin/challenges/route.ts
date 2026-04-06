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

// GET - List all challenges with pagination and filtering
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const adminUser = await verifyAdminAuth(request);
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const isActive = searchParams.get('isActive');
    const scheduledDate = searchParams.get('scheduledDate');

    const skip = (page - 1) * limit;

    // Build where clause
    const whereClause: any = {};
    
    if (isActive !== null) {
      whereClause.isActive = isActive === 'true';
    }
    
    if (scheduledDate) {
      whereClause.scheduledDate = new Date(scheduledDate);
    }

    // Get challenges with pagination
    const [challenges, totalCount] = await Promise.all([
      prisma.dailyChallenge.findMany({
        where: whereClause,
        include: {
          creator: {
            select: {
              id: true,
              businessName: true,
              emailAddress: true
            }
          },
          partnerProgress: {
            select: {
              status: true
            }
          }
        },
        orderBy: {
          scheduledDate: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.dailyChallenge.count({
        where: whereClause
      })
    ]);

    // Add progress statistics to each challenge
    const challengesWithStats = challenges.map(challenge => {
      const progressStats = challenge.partnerProgress.reduce((acc, progress) => {
        acc[progress.status] = (acc[progress.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        ...challenge,
        progressStats: {
          total: challenge.partnerProgress.length,
          completed: progressStats.completed || 0,
          inProgress: progressStats.in_progress || 0,
          notStarted: progressStats.not_started || 0
        },
        partnerProgress: undefined // Remove detailed progress data
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        challenges: challengesWithStats,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasNext: page * limit < totalCount,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Error fetching challenges:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 });
  }
}

// POST - Create new challenge
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const adminUser = await verifyAdminAuth(request);
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json();
    const {
      title,
      description,
      steps,
      rewardCredits,
      requiresProof,
      scheduledDate,
      createdBy
    } = body;

    // Validate required fields
    if (!title || !steps || !Array.isArray(steps)) {
      return NextResponse.json({ 
        error: 'Title and steps are required. Steps must be an array.' 
      }, { status: 400 });
    }

    // Validate steps structure
    for (const step of steps) {
      if (!step.id || !step.title || !step.type) {
        return NextResponse.json({ 
          error: 'Each step must have id, title, and type fields' 
        }, { status: 400 });
      }
    }

    // Create challenge
    const challenge = await prisma.dailyChallenge.create({
      data: {
        title,
        description,
        steps,
        rewardCredits: rewardCredits || 0,
        requiresProof: requiresProof || false,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        createdBy: null, // Admin-created challenges don't need partner reference
        isActive: true
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
      data: challenge,
      message: 'Challenge created successfully'
    });

  } catch (error) {
    console.error('Error creating challenge:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 });
  }
}
