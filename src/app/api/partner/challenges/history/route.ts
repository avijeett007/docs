import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Extract JWT token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    let partnerId: string;

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { partnerId: string };
      partnerId = decoded.partnerId;
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get URL parameters for pagination
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status'); // 'completed', 'in_progress', 'not_started'

    const skip = (page - 1) * limit;

    // Build where clause
    const whereClause: any = {
      partnerId
    };

    if (status) {
      whereClause.status = status;
    }

    // Get challenge history with pagination
    const [challengeHistory, totalCount] = await Promise.all([
      prisma.partnerChallengeProgress.findMany({
        where: whereClause,
        include: {
          challenge: {
            select: {
              id: true,
              title: true,
              description: true,
              rewardCredits: true,
              requiresProof: true,
              scheduledDate: true,
              steps: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.partnerChallengeProgress.count({
        where: whereClause
      })
    ]);

    // Calculate summary statistics
    const stats = await prisma.partnerChallengeProgress.groupBy({
      by: ['status'],
      where: { partnerId },
      _count: {
        status: true
      },
      _sum: {
        creditsAwarded: true
      }
    });

    const summary = {
      totalChallenges: totalCount,
      completed: stats.find(s => s.status === 'completed')?._count.status || 0,
      inProgress: stats.find(s => s.status === 'in_progress')?._count.status || 0,
      totalCreditsEarned: stats.reduce((sum, s) => sum + (s._sum.creditsAwarded || 0), 0)
    };

    // Format response data
    const formattedHistory = challengeHistory.map(progress => ({
      id: progress.id,
      challengeId: progress.challengeId,
      challenge: {
        title: progress.challenge.title,
        description: progress.challenge.description,
        rewardCredits: progress.challenge.rewardCredits,
        requiresProof: progress.challenge.requiresProof,
        scheduledDate: progress.challenge.scheduledDate,
        totalSteps: Array.isArray(progress.challenge.steps) ? progress.challenge.steps.length : 0
      },
      status: progress.status,
      completedSteps: Array.isArray(progress.completedSteps) ? progress.completedSteps.length : 0,
      creditsAwarded: progress.creditsAwarded,
      proofStatus: progress.proofStatus,
      startedAt: progress.startedAt,
      completedAt: progress.completedAt,
      createdAt: progress.createdAt
    }));

    return NextResponse.json({
      success: true,
      data: {
        challenges: formattedHistory,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasNext: page * limit < totalCount,
          hasPrev: page > 1
        },
        summary
      }
    });

  } catch (error) {
    console.error('Error fetching challenge history:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 });
  }
}
