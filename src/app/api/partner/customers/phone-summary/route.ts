import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
// No PII obfuscation needed for IDs
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyPartnerJWT(request);
    if (!authResult.isValid || !authResult.payload) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const partnerId = authResult.payload.partnerId;
    
    logger.debug('Fetching customer phone summary for partner', {
      partnerId: partnerId,
      operation: 'fetch_customer_phone_summary'
    });
    
    // Get customers with phone numbers for this partner
    const customersWithPhones = await prisma.customer.findMany({
      where: {
        credentials: {
          some: { partnerId: partnerId }
        },
        phoneNumbers: {
          some: {} // Has at least one phone number
        }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        twilioSubaccountStatus: true,
        _count: {
          select: {
            phoneNumbers: true
          }
        },
        phoneNumbers: {
          select: {
            status: true,
            monthlyRecurringCost: true,
            agentMappings: {
              where: { status: 'active' },
              select: { agentProvider: true }
            }
          }
        }
      },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' },
        { email: 'asc' }
      ]
    });
    
    logger.debug('Found customers with phone numbers', {
      partnerId: partnerId,
      customerCount: customersWithPhones.length,
      operation: 'fetch_customer_phone_summary'
    });
    
    // Transform the data for frontend consumption
    const customerSummary = customersWithPhones.map(customer => {
      const customerName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email;
      const phoneNumbers = customer.phoneNumbers;
      
      // Calculate statistics
      const activeNumbers = phoneNumbers.filter(p => p.status === 'active').length;
      const numbersWithAgents = phoneNumbers.filter(p => p.agentMappings.length > 0).length;
      const totalMonthlyCost = phoneNumbers.reduce((sum, p) => sum + (p.monthlyRecurringCost || 0), 0);
      
      // Get unique agent providers
      const agentProviders = new Set(
        phoneNumbers.flatMap(p => p.agentMappings.map(a => a.agentProvider))
      );
      
      return {
        id: customer.id,
        name: customerName,
        email: customer.email,
        subaccountStatus: customer.twilioSubaccountStatus || 'unknown',
        phoneNumberCount: customer._count.phoneNumbers,
        activePhoneNumbers: activeNumbers,
        numbersWithAgents: numbersWithAgents,
        totalMonthlyCostCents: totalMonthlyCost,
        agentProviders: Array.from(agentProviders),
        stats: {
          total: customer._count.phoneNumbers,
          active: activeNumbers,
          withAgents: numbersWithAgents,
          withoutAgents: customer._count.phoneNumbers - numbersWithAgents,
          monthlyCostDollars: totalMonthlyCost / 100
        }
      };
    });
    
    // Calculate overall statistics
    const overallStats = {
      totalCustomers: customerSummary.length,
      totalPhoneNumbers: customerSummary.reduce((sum, c) => sum + c.phoneNumberCount, 0),
      totalActiveNumbers: customerSummary.reduce((sum, c) => sum + c.activePhoneNumbers, 0),
      totalNumbersWithAgents: customerSummary.reduce((sum, c) => sum + c.numbersWithAgents, 0),
      totalMonthlyCostCents: customerSummary.reduce((sum, c) => sum + c.totalMonthlyCostCents, 0),
      uniqueAgentProviders: new Set(customerSummary.flatMap(c => c.agentProviders)).size
    };
    
    return NextResponse.json({
      success: true,
      customers: customerSummary,
      stats: overallStats
    });
    
  } catch (error) {
    console.error('Error fetching customer phone summary:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch customer phone summary'
    }, { status: 500 });
  }
}
