import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { 
  ReportConfigResponse, 
  UpdateReportConfigRequest,
  ReportFrequency,
  ReportMetric 
} from '@/types/customerReport';

export const dynamic = 'force-dynamic';

/**
 * Type guard to validate ReportFrequency
 */
function isValidFrequency(value: unknown): value is ReportFrequency {
  return typeof value === 'string' && ['none', 'daily', 'weekly'].includes(value);
}

/**
 * Type guard to validate ReportMetric array
 */
function isValidMetrics(value: unknown): value is ReportMetric[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  
  const validMetrics: ReportMetric[] = [
    'agentName', 
    'totalCalls', 
    'totalDuration', 
    'avgDuration', 
    'successRate', 
    'failureRate'
  ];
  
  return value.every(item => 
    typeof item === 'string' && validMetrics.includes(item as ReportMetric)
  );
}

/**
 * Calculate next scheduled time based on frequency
 */
function calculateNextScheduledAt(frequency: ReportFrequency): Date | null {
  if (frequency === 'none') return null;
  
  const now = new Date();
  const nextSchedule = new Date(now);
  
  if (frequency === 'daily') {
    // Tomorrow at 8:00 AM UTC
    nextSchedule.setUTCDate(now.getUTCDate() + 1);
    nextSchedule.setUTCHours(8, 0, 0, 0);
  } else if (frequency === 'weekly') {
    // Next Monday at 8:00 AM UTC
    const daysUntilMonday = (8 - now.getUTCDay()) % 7 || 7;
    nextSchedule.setUTCDate(now.getUTCDate() + daysUntilMonday);
    nextSchedule.setUTCHours(8, 0, 0, 0);
  }
  
  return nextSchedule;
}

/**
 * GET /api/partner/customers/[customerId]/report-config
 * Fetch report configuration for a customer
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { customerId: string } }
) {
  try {
    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Look up UserOnboarding to get the actual Customer.id
    const userOnboarding = await prisma.userOnboarding.findUnique({
      where: { id: params.customerId },
      select: { 
        customerId: true,
        partnerId: true 
      }
    });

    if (!userOnboarding) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Verify this customer belongs to the authenticated partner
    if (userOnboarding.partnerId !== partner.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    if (!userOnboarding.customerId) {
      return NextResponse.json(
        { error: 'Customer record not linked' },
        { status: 400 }
      );
    }

    // Fetch report config
    const config = await prisma.customerReportConfig.findUnique({
      where: {
        customerId_partnerId: {
          customerId: userOnboarding.customerId,
          partnerId: partner.id
        }
      }
    });

    // Return config or default values
    if (!config) {
      const defaultConfig: ReportConfigResponse = {
        id: '',
        customerId: userOnboarding.customerId,
        partnerId: partner.id,
        frequency: 'none',
        includedMetrics: ['agentName', 'totalCalls', 'totalDuration', 'avgDuration', 'successRate', 'failureRate'],
        isEnabled: true,
        lastSentAt: null,
        nextScheduledAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      return NextResponse.json(defaultConfig);
    }

    const response: ReportConfigResponse = {
      id: config.id,
      customerId: config.customerId,
      partnerId: config.partnerId,
      frequency: config.frequency as ReportFrequency,
      includedMetrics: config.includedMetrics as ReportMetric[],
      isEnabled: config.isEnabled,
      lastSentAt: config.lastSentAt?.toISOString() || null,
      nextScheduledAt: config.nextScheduledAt?.toISOString() || null,
      createdAt: config.createdAt.toISOString(),
      updatedAt: config.updatedAt.toISOString()
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching report config:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/partner/customers/[customerId]/report-config
 * Update report configuration for a customer
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { customerId: string } }
) {
  try {
    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Look up UserOnboarding to get the actual Customer.id
    const userOnboarding = await prisma.userOnboarding.findUnique({
      where: { id: params.customerId },
      select: { 
        customerId: true,
        partnerId: true 
      }
    });

    if (!userOnboarding) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Verify this customer belongs to the authenticated partner
    if (userOnboarding.partnerId !== partner.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    if (!userOnboarding.customerId) {
      return NextResponse.json(
        { error: 'Customer record not linked' },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    
    // Type guard validations
    if (!isValidFrequency(body.frequency)) {
      return NextResponse.json(
        { error: 'Invalid frequency. Must be one of: none, daily, weekly' },
        { status: 400 }
      );
    }

    if (!isValidMetrics(body.includedMetrics)) {
      return NextResponse.json(
        { error: 'Invalid includedMetrics. Must be a non-empty array of valid metric keys' },
        { status: 400 }
      );
    }

    if (typeof body.isEnabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid isEnabled. Must be a boolean' },
        { status: 400 }
      );
    }

    const requestData: UpdateReportConfigRequest = {
      frequency: body.frequency,
      includedMetrics: body.includedMetrics,
      isEnabled: body.isEnabled
    };

    // Calculate nextScheduledAt based on frequency
    const nextScheduledAt = calculateNextScheduledAt(requestData.frequency);

    // Upsert config
    const config = await prisma.customerReportConfig.upsert({
      where: {
        customerId_partnerId: {
          customerId: userOnboarding.customerId,
          partnerId: partner.id
        }
      },
      create: {
        customerId: userOnboarding.customerId,
        partnerId: partner.id,
        frequency: requestData.frequency,
        includedMetrics: requestData.includedMetrics,
        isEnabled: requestData.isEnabled,
        nextScheduledAt
      },
      update: {
        frequency: requestData.frequency,
        includedMetrics: requestData.includedMetrics,
        isEnabled: requestData.isEnabled,
        nextScheduledAt
      }
    });

    const response: ReportConfigResponse = {
      id: config.id,
      customerId: config.customerId,
      partnerId: config.partnerId,
      frequency: config.frequency as ReportFrequency,
      includedMetrics: config.includedMetrics as ReportMetric[],
      isEnabled: config.isEnabled,
      lastSentAt: config.lastSentAt?.toISOString() || null,
      nextScheduledAt: config.nextScheduledAt?.toISOString() || null,
      createdAt: config.createdAt.toISOString(),
      updatedAt: config.updatedAt.toISOString()
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error updating report config:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
