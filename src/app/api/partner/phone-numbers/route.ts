import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { obfuscateId, obfuscatePhoneNumber, obfuscateName } from '@/lib/pii-obfuscation';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Verify partner authentication
    const partnerAuth = await verifyPartnerJWT(req);
    if (!partnerAuth || !partnerAuth.isValid || !partnerAuth.payload?.partnerId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = partnerAuth.payload.partnerId;

    // Get pagination parameters from URL
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
    const search = searchParams.get('search') || '';
    const provider = searchParams.get('provider') || '';
    const status = searchParams.get('status') || '';
    const assignment = searchParams.get('assignment') || '';
    const ownership = searchParams.get('ownership') || '';
    const customerId = searchParams.get('customerId') || '';
    const billingType = searchParams.get('billingType') || '';

    const skip = (page - 1) * limit;

    logger.debug('Fetching phone numbers for partner with pagination', {
      partnerId: obfuscateId(partnerId),
      page,
      limit,
      search,
      operation: 'fetch_phone_numbers_paginated'
    });

    // Build where clause for filtering using AND array to avoid OR conflicts
    const andConditions: any[] = [{ partnerId: partnerId }];

    // Add search filter (phone number or owner name only)
    if (search) {
      andConditions.push({
        OR: [
          { phoneNumber: { contains: search, mode: 'insensitive' } },
          { friendlyName: { contains: search, mode: 'insensitive' } },
          { customer: { firstName: { contains: search, mode: 'insensitive' } } },
          { customer: { lastName: { contains: search, mode: 'insensitive' } } },
        ]
      });
    }

    // Add provider filter
    if (provider && provider !== 'all') {
      andConditions.push({ provider });
    }

    // Add status filter
    if (status && status !== 'all') {
      andConditions.push({ status });
    }

    // Add ownership filter (derived from customerId — no 'ownership' column on model)
    if (ownership && ownership !== 'all') {
      if (ownership === 'partner') {
        andConditions.push({ customerId: null });
      } else if (ownership === 'customer') {
        andConditions.push({ customerId: { not: null } });
      }
    }

    // Add customer filter (supports special __with_name__ / __no_name__ values)
    // "Name" = customer firstName/lastName OR friendlyName that starts with a letter (not digits/+)
    const DIGIT_PREFIXES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+'];

    if (customerId && customerId !== 'all') {
      if (customerId === '__with_name__') {
        // Phone numbers that have a meaningful display name:
        // either a customer with firstName/lastName, or a friendlyName starting with a letter
        andConditions.push({
          OR: [
            // Customer with a non-empty first or last name
            { customer: { OR: [
              { AND: [{ firstName: { not: null } }, { firstName: { not: '' } }] },
              { AND: [{ lastName: { not: null } }, { lastName: { not: '' } }] },
            ]}},
            // friendlyName that starts with a letter (not null, not empty, not digit/+ prefix)
            { AND: [
              { friendlyName: { not: null } },
              { friendlyName: { not: '' } },
              ...DIGIT_PREFIXES.map(d => ({ NOT: { friendlyName: { startsWith: d } } }))
            ]}
          ]
        });
      } else if (customerId === '__no_name__') {
        // Phone numbers with NO meaningful display name:
        // no customer name AND no meaningful friendlyName
        andConditions.push({
          OR: [
            { customerId: null },
            { customer: { AND: [
              { OR: [{ firstName: null }, { firstName: '' }] },
              { OR: [{ lastName: null }, { lastName: '' }] },
            ]}},
          ]
        });
        andConditions.push({
          OR: [
            { friendlyName: null },
            { friendlyName: '' },
            ...DIGIT_PREFIXES.map(d => ({ friendlyName: { startsWith: d } }))
          ]
        });
      } else {
        andConditions.push({ customerId });
      }
    }

    // Add assignment filter
    if (assignment && assignment !== 'all') {
      if (assignment === 'assigned') {
        andConditions.push({ customerId: { not: null } });
      } else if (assignment === 'unassigned') {
        andConditions.push({ customerId: null });
      }
    }

    // Add billing type filter (chargeable = not imported, imported = isImported)
    if (billingType && billingType !== 'all') {
      if (billingType === 'chargeable') {
        andConditions.push({ isImported: false });
      } else if (billingType === 'imported') {
        andConditions.push({ isImported: true });
      }
    }

    const whereClause: any = { AND: andConditions };

    // Get total count and stats for pagination (using full dataset)
    const totalCount = await prisma.phoneNumber.count({
      where: whereClause
    });

    // Compute stats using efficient count/aggregate queries instead of fetching all records
    // Helper to safely add extra conditions to the AND-based whereClause
    const withExtra = (...extra: any[]) => ({ AND: [...andConditions, ...extra] });

    const [
      partnerOwnedCount,
      customerOwnedCount,
      activeCount,
      importedCount,
      verifiedOrApprovedCount,
      agentAssignedCount,
      sipConfiguredCount,
      distinctProviders,
      distinctCustomers,
      totalMonthlyCost,
    ] = await Promise.all([
      prisma.phoneNumber.count({ where: withExtra({ customerId: null }) }),
      prisma.phoneNumber.count({ where: withExtra({ NOT: { customerId: null } }) }),
      prisma.phoneNumber.count({ where: withExtra({ status: { in: ['active', 'in-use'] } }) }),
      prisma.phoneNumber.count({ where: withExtra({ isImported: true }) }),
      prisma.phoneNumber.count({
        where: withExtra({ OR: [{ verificationStatus: 'verified' }, { regulatoryStatus: 'approved' }] }),
      }),
      prisma.phoneNumber.count({
        where: withExtra({ agentMappings: { some: { status: 'active' } } }),
      }),
      prisma.phoneNumber.count({
        where: withExtra({ sipConfig: { isNot: null } }),
      }),
      prisma.phoneNumber.findMany({
        where: whereClause,
        select: { provider: true },
        distinct: ['provider'],
      }),
      prisma.phoneNumber.findMany({
        where: withExtra({ NOT: { customerId: null } }),
        select: { customerId: true },
        distinct: ['customerId'],
      }),
      prisma.phoneNumber.aggregate({
        where: whereClause,
        _sum: { monthlyRecurringCost: true },
      }),
    ]);

    // Get phone numbers with pagination
    const phoneNumbers = await prisma.phoneNumber.findMany({
      where: whereClause,
      skip,
      take: limit,
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            twilioSubaccountSid: true,
            twilioSubaccountStatus: true
          }
        },
        agentMappings: {
          where: {
            status: 'active'
          },
          select: {
            id: true,
            agentProvider: true,
            agentId: true,
            agentName: true,
            customerId: true,
            status: true,
            inboundEnabled: true,
            outboundEnabled: true,
            createdAt: true
          }
        },
        sipConfig: {
          select: {
            id: true,
            sipTrunkSid: true,
            originationUri: true,
            status: true
          }
        },
        purchases: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            purchasePrice: true,
            setupFee: true,
            monthlyRecurringCost: true,
            createdAt: true,
            status: true
          }
        }
      },
      orderBy: [
        { customerId: 'asc' }, // Partner numbers first (NULL), then customer numbers
        { createdAt: 'desc' }
      ]
    });

    logger.debug('Found phone numbers for partner', {
      partnerId: obfuscateId(partnerId),
      phoneNumberCount: phoneNumbers.length,
      operation: 'fetch_phone_numbers'
    });

    phoneNumbers.forEach(number => {
      const customerName = number.customer ? `${number.customer.firstName || ''} ${number.customer.lastName || ''}`.trim() : 'Unassigned';
      logger.debug('Phone number details', {
        partnerId: obfuscateId(partnerId),
        customerId: number.customerId ? obfuscateId(number.customerId) : undefined,
        phoneNumber: obfuscatePhoneNumber(number.phoneNumber),
        customerName: obfuscateName(customerName),
        status: number.status,
        isImported: number.isImported,
        operation: 'fetch_phone_numbers'
      });
    });

    // Helper function to determine inbound capability
    const getInboundCapability = (number: any) => {
      // Voice capability from provider + not suspended/released = can receive inbound
      const capabilities = number.capabilities as any;
      const hasVoiceCapability = capabilities?.voice || capabilities?.VOICE || false;
      const isOperational = !['released', 'suspended'].includes(number.status?.toLowerCase());
      return hasVoiceCapability && isOperational;
    };

    // Transform the data to match the frontend interface with ownership information
    const transformedNumbers = phoneNumbers.map(number => {
      const isCustomerOwned = !!number.customerId;
      const latestPurchase = number.purchases?.[0];

      return {
        id: number.id,
        phoneNumber: number.phoneNumber,
        friendlyName: number.friendlyName,
        provider: number.provider,
        status: number.status,
        regulatoryStatus: number.regulatoryStatus || 'pending',
        verificationStatus: number.verificationStatus || 'unverified',
        capabilities: {
          voice: (number.capabilities as any)?.voice || (number.capabilities as any)?.VOICE || false,
          sms: (number.capabilities as any)?.sms || (number.capabilities as any)?.SMS || false,
          mms: (number.capabilities as any)?.mms || (number.capabilities as any)?.MMS || false,
          fax: (number.capabilities as any)?.fax || (number.capabilities as any)?.FAX || false
        },
        // Enhanced capability indicators
        canReceiveInbound: getInboundCapability(number),
        canSendOutbound: number.verificationStatus === 'verified' || number.regulatoryStatus === 'approved',
        hideFromCustomer: number.hideFromCustomer,

        // Ownership information
        ownership: isCustomerOwned ? 'customer' as const : 'partner' as const,

        // Customer information (enhanced with subaccount status)
        customer: number.customer ? {
          id: number.customer.id,
          name: `${number.customer.firstName || ''} ${number.customer.lastName || ''}`.trim() || number.customer.email,
          email: number.customer.email,
          subaccountStatus: number.customer.twilioSubaccountStatus || 'unknown'
        } : null,

        // Financial information
        monthlyRecurringCost: number.monthlyRecurringCost || 0,
        purchaseInfo: latestPurchase ? {
          purchasePrice: latestPurchase.purchasePrice,
          setupFee: latestPurchase.setupFee,
          monthlyRecurringCost: latestPurchase.monthlyRecurringCost,
          purchasedAt: latestPurchase.createdAt.toISOString(),
          status: latestPurchase.status
        } : null,

        // Agent assignment information
        agentMappings: number.agentMappings || [],
        hasAgentAssignment: number.agentMappings && number.agentMappings.length > 0,
        agentInfo: number.agentMappings?.[0] ? {
          provider: number.agentMappings[0].agentProvider,
          agentId: number.agentMappings[0].agentId,
          agentName: number.agentMappings[0].agentName || `${number.agentMappings[0].agentProvider} Agent`,
          inboundEnabled: number.agentMappings[0].inboundEnabled,
          outboundEnabled: number.agentMappings[0].outboundEnabled
        } : null,

        // SIP configuration status
        sipConfig: number.sipConfig ? {
          id: number.sipConfig.id,
          sipTrunkSid: number.sipConfig.sipTrunkSid,
          originationUri: number.sipConfig.originationUri,
          status: number.sipConfig.status
        } : null,
        hasSipConfig: !!number.sipConfig,
        sipConfigured: !!number.sipConfig,

        // Legacy fields (maintaining backward compatibility)
        isAssigned: !!number.customerId,
        purchasedAt: number.createdAt.toISOString(),
        isImported: number.isImported || false,
        importedAt: number.importedAt?.toISOString(),
        originalProvider: number.originalProvider,
        countryCode: number.countryCode,
        type: number.type
      };
    });

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return NextResponse.json({
      success: true,
      phoneNumbers: transformedNumbers,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage,
        hasPrevPage
      },
      stats: {
        total: totalCount,

        // Ownership stats from efficient count queries
        partnerOwned: partnerOwnedCount,
        customerOwned: customerOwnedCount,

        // Legacy stats (maintaining backward compatibility)
        assigned: customerOwnedCount,
        unassigned: partnerOwnedCount,
        active: activeCount,
        imported: importedCount,
        inboundReady: activeCount, // Approximation: active numbers are inbound-ready
        outboundReady: verifiedOrApprovedCount,
        providers: distinctProviders.length,

        // Agent assignment stats
        agentAssigned: agentAssignedCount,
        agentUnassigned: totalCount - agentAssignedCount,
        sipConfigured: sipConfiguredCount,
        retellReady: 0, // Complex cross-filter; computed client-side if needed

        // Customer-specific stats
        customersWithNumbers: distinctCustomers.length,
        totalMonthlyRecurringCost: totalMonthlyCost._sum.monthlyRecurringCost || 0
      }
    });

  } catch (error) {
    logger.error('Error fetching partner phone numbers', error as Error, {
      operation: 'fetch_phone_numbers_paginated'
    });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch phone numbers' },
      { status: 500 }
    );
  }
}
