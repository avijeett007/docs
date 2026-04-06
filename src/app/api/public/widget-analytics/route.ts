import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';



// Rate limiting map (in production, use Redis or similar)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Simple rate limiting function
function isRateLimited(identifier: string, maxRequests = 100, windowMs = 60000): boolean {
  const now = Date.now();
  const windowStart = now - windowMs;
  
  const current = rateLimitMap.get(identifier);
  
  if (!current || current.resetTime < windowStart) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs });
    return false;
  }
  
  if (current.count >= maxRequests) {
    return true;
  }
  
  current.count++;
  return false;
}

// POST /api/public/widget-analytics - Track widget analytics
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, eventType, data, timestamp } = body;

    if (!token || !eventType) {
      return NextResponse.json(
        { success: false, error: 'Token and eventType are required' },
        { status: 400 }
      );
    }

    // Get client IP for rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';

    // Rate limiting
    if (isRateLimited(`${clientIP}:${token}`, 50, 60000)) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Find widget by token
    const widget = await prisma.agentWidget.findUnique({
      where: {
        widgetToken: token
      },
      select: {
        id: true,
        isActive: true,
        allowedDomains: true,
        partnerId: true,
        customerId: true
      }
    });

    if (!widget) {
      return NextResponse.json(
        { success: false, error: 'Widget not found' },
        { status: 404 }
      );
    }

    if (!widget.isActive) {
      return NextResponse.json(
        { success: false, error: 'Widget is not active' },
        { status: 403 }
      );
    }

    // Validate origin if provided in data
    if (data?.origin && widget.allowedDomains.length > 0) {
      // Flatten domains in case they're stored as comma-separated strings (legacy format)
      const flattenedDomains = widget.allowedDomains.flatMap(domain => {
        if (typeof domain === 'string' && domain.includes(',')) {
          return domain.split(',').map(d => d.trim());
        }
        return [domain];
      }).filter(d => d && d.length > 0);

      const isDomainAllowed = flattenedDomains.some(allowed => {
        try {
          const originUrl = new URL(data.origin);
          const originDomain = originUrl.hostname;

          // Remove protocol if present in allowed domain
          const cleanAllowed = allowed.replace(/^https?:\/\//, '');

          // Exact match
          if (cleanAllowed === originDomain) return true;

          // Wildcard match
          if (cleanAllowed.startsWith('*.')) {
            const baseDomain = cleanAllowed.substring(2);
            return originDomain.endsWith('.' + baseDomain) || originDomain === baseDomain;
          }

          // Subdomain match
          return originDomain.endsWith('.' + allowed);
        } catch {
          return false;
        }
      });

      if (!isDomainAllowed) {
        return NextResponse.json(
          { success: false, error: 'Domain not allowed' },
          { status: 403 }
        );
      }
    }

    // Determine analytics values based on event type
    let views = 0;
    let interactions = 0;

    switch (eventType) {
      case 'view':
      case 'widget_loaded':
        views = 1;
        break;
      case 'call_start':
      case 'call_end':
      case 'interaction':
      case 'button_click':
        interactions = 1;
        break;
      default:
        // Unknown event type, still track but don't increment counters
        break;
    }

    // Create analytics record
    await prisma.widgetAnalytics.create({
      data: {
        widgetId: widget.id,
        partnerId: widget.partnerId,
        customerId: widget.customerId,
        eventType,
        domain: data?.origin || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        metadata: data ? JSON.stringify(data) : {},
        timestamp: timestamp ? new Date(timestamp) : new Date()
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Analytics tracked successfully'
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });

  } catch (error) {
    console.error('Error tracking widget analytics:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle preflight requests
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
