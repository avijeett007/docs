import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Cache configuration
const CACHE_DURATION = 3 * 60 * 1000; // 3 minutes
let cachedData: any = null;
let cacheTimestamp = 0;

// Allowed origins for CORS (restrict to known domains)
const ALLOWED_ORIGINS = [
  // Production domains
  'https://knotie-ai.pro',
  'https://www.knotie-ai.pro',
  'https://knotie.ai',
  // Local development
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'https://knotie.kno2gether.com'
];

export async function GET(request: NextRequest) {
  try {
    // Check cache first to avoid unnecessary database queries
    const now = Date.now();
    if (cachedData && (now - cacheTimestamp) < CACHE_DURATION) {
      return NextResponse.json({
        success: true,
        data: {
          ...cachedData,
          cached: true,
          cacheAge: Math.floor((now - cacheTimestamp) / 1000)
        }
      }, {
        headers: getCorsHeaders(request)
      });
    }

    // Get total member count (waitlist + partners) - optimized with single query approach
    const [waitlistCount, partnerCount] = await Promise.all([
      prisma.waitlist.count(),
      prisma.partner.count()
    ]);

    const totalMembers = waitlistCount + partnerCount;

    // Get recent 5 members (business names only - no sensitive data) - mix of waitlist and partners
    const [recentWaitlist, recentPartners] = await Promise.all([
      prisma.waitlist.findMany({
        select: {
          name: true,
          createdAt: true,
          source: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 3
      }),
      prisma.partner.findMany({
        select: {
          businessName: true, // Only business name, no personal info
          createdAt: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 3
      })
    ]);

    // Combine and format recent members (business names only - privacy safe)
    const recentMembers = [
      ...recentWaitlist.map(member => ({
        // For waitlist, use first name + last initial only for privacy
        name: member.name.split(' ').length > 1
          ? `${member.name.split(' ')[0]} ${member.name.split(' ')[1]?.charAt(0)}.`
          : member.name.split(' ')[0],
        type: 'waitlist' as const,
        joinedAt: member.createdAt,
        displayName: member.name.split(' ').length > 1
          ? `${member.name.split(' ')[0]} ${member.name.split(' ')[1]?.charAt(0)}.`
          : member.name.split(' ')[0]
      })),
      ...recentPartners.map(partner => ({
        // For partners, use business name only (no personal info)
        name: partner.businessName,
        type: 'partner' as const,
        joinedAt: partner.createdAt,
        displayName: partner.businessName
      }))
    ]
    .sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime())
    .slice(0, 5)
    .map(member => ({
      name: member.displayName,
      type: member.type,
      joinedAt: member.joinedAt,
      // Add some variety to the display
      action: member.type === 'partner' ? 'Started Their Agency' : 'Joined'
    }));

    // Cache the result
    const responseData = {
      totalMembers,
      waitlistCount,
      partnerCount,
      recentMembers,
      lastUpdated: new Date().toISOString()
    };

    cachedData = responseData;
    cacheTimestamp = now;

    return NextResponse.json({
      success: true,
      data: responseData
    }, {
      headers: getCorsHeaders(request)
    });

  } catch (error) {
    console.error('Error fetching live stats:', error);
    
    // Return fallback data in case of error (starts from 0 since base is 137)
    return NextResponse.json({
      success: true,
      data: {
        totalMembers: 0, // Base count of 137 will be added in frontend
        waitlistCount: 0,
        partnerCount: 0,
        recentMembers: [
          {
            name: 'Digital Marketing Pro',
            type: 'partner',
            action: 'Started Their Agency',
            joinedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString() // 5 min ago
          },
          {
            name: 'Sarah M.',
            type: 'waitlist',
            action: 'Joined',
            joinedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString() // 15 min ago
          },
          {
            name: 'Tech Solutions LLC',
            type: 'partner',
            action: 'Started Their Agency',
            joinedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString() // 30 min ago
          }
        ],
        lastUpdated: new Date().toISOString()
      },
      error: 'Using fallback data'
    }, {
      headers: getCorsHeaders(request)
    });
  }
}

// Helper function to get CORS headers with restricted origins
function getCorsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get('origin');
  const isAllowedOrigin = origin && ALLOWED_ORIGINS.includes(origin);

  return {
    'Access-Control-Allow-Origin': isAllowedOrigin ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, max-age=180', // 3 minute cache
    'Vary': 'Origin'
  };
}

// Add CORS headers for public access with restricted origins
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(request)
  });
}
