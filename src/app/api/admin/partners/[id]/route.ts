import { NextRequest, NextResponse } from 'next/server';
import { protectAdminRoute } from '@/lib/admin-route-protection';
import { OnboardingTracker } from '@/services/OnboardingTracker';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin authentication using secure MFA enforcement
    const authResult = await protectAdminRoute(request);
    if (authResult) {
      return authResult; // Return the authentication error response
    }

    const partnerId = params.id;

    // Fetch comprehensive partner data
    const [
      partner,
      customerCount,
      agentCounts,
      creditTransactions,
      onboardingProgress,
      waitlistHistory,
      phoneActivations
    ] = await Promise.all([
      // Basic partner information
      prisma.partner.findUnique({
        where: { id: partnerId },
        select: {
          id: true,
          businessName: true,
          emailAddress: true,
          contactName: true,
          phoneNumber: true,
          createdAt: true,
          updatedAt: true,
          logo: true,
          subdomain: true,
          customDomain: true,
          manualSaasModeEnabled: true,
          manualBYOAModeEnabled: true,
          portalMode: true,
          experienceEntitlements: true,

          // Subscription & Payment Info
          planId: true,
          billingInterval: true,
          subscriptionStatus: true,
          marketingTier: true,
          approvalStatus: true,
          stripeCustomerId: true,
          stripeSubscriptionId: true,
          stripeAccountId: true,
          stripeChargesEnabled: true,
          stripeOnboardingCompleted: true,
          
          // Credit Management
          creditBalance: true,
          fractionalCredits: true,
          monthlyCreditAllocation: true,
          lastCreditAllocationDate: true,
          lowCreditThreshold: true,
          
          // Telephony Credits
          telephonyCreditBalanceCents: true,
          
          // Trial & Access
          hasStartedTrial: true,
          
          // Onboarding & Walkthrough
          walkthroughProgress: true,
          walkthroughStartedAt: true,
          walkthroughCompletedAt: true,
          currentWalkthroughStep: true,
          walkthroughSkipped: true,
          walkthroughVersion: true,
          hasSeenWelcomeVideo: true,
          
          // Email Configuration
          useCustomSmtp: true,
          smtpHost: true,
          useSESDomain: true,
          sesDomainStatus: true,
          
          // Counts
          _count: {
            select: {
              customers: true,
              retellAgents: true,
              vapiAgents: true,
              ultravoxAgents: true,
              elevenlabsAgents: true,
              ghlAgents: true,
              knovaAgents: true,
              n8nChatAgents: true,
              teamMembers: true,
            }
          }
        }
      }),
      
      // Customer details with activity
      prisma.customer.findMany({
        where: {
          credentials: {
            some: { partnerId }
          }
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          createdAt: true,
          credentials: {
            where: { partnerId },
            select: {
              lastLogin: true,
              status: true,
            }
          }
        },
        take: 10,
        orderBy: { createdAt: 'desc' }
      }),
      
      // Agent counts by provider
      Promise.all([
        prisma.retellAgent.count({ where: { partnerId } }),
        prisma.vapiAgent.count({ where: { partnerId } }),
        prisma.ultravoxAgent.count({ where: { partnerId } }),
        prisma.elevenLabsAgent.count({ where: { partnerId } }),
        prisma.ghlAgent.count({ where: { partnerId } }),
        prisma.knovaAgent.count({ where: { partnerId } }),
        prisma.n8nChatAgent.count({ where: { partnerId } }),
      ]),
      
      // Recent credit transactions
      prisma.creditTransaction.findMany({
        where: { partnerId },
        select: {
          id: true,
          amount: true,
          type: true,
          description: true,
          createdAt: true,
          metadata: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      
      // Onboarding progress using the tracker
      (async () => {
        try {
          const tracker = new OnboardingTracker(prisma);
          return await tracker.getProgress(partnerId);
        } catch (error) {
          console.error('Error getting onboarding progress:', error);
          return null;
        }
      })(),

      // Waitlist history - will be fetched after we get partner email
      Promise.resolve(null),

      // Phone service activations
      prisma.phoneServiceActivation.findMany({
        where: { partnerId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          country: true,
          businessName: true,
          businessType: true,
          businessAddress: true,
          businessRegistrationNumber: true,
          businessRegistrationAuthority: true,
          businessWebsite: true,
          contactFirstName: true,
          contactLastName: true,
          contactEmail: true,
          contactPhone: true,
          documents: true,
          twilioSubaccountSid: true,
          twilioAddressSid: true,
          twilioEndUserSid: true,
          twilioSupportingDocSids: true,
          regulatoryBundleSid: true,
          regulatoryBundleStatus: true,
          regulatoryBundleType: true,
          rejectionReason: true,
          status: true,
          submittedAt: true,
          approvedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    ]);

    if (!partner) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Now fetch waitlist history using partner's email
    const waitlistHistoryData = await (async () => {
      try {
        if (!partner.emailAddress) return null;
        return await prisma.waitlist.findFirst({
          where: { email: partner.emailAddress },
          select: {
            id: true,
            name: true,
            email: true,
            position: true,
            status: true,
            source: true,
            referralCode: true,
            referralCount: true,
            createdAt: true,
            updatedAt: true
          }
        });
      } catch (error) {
        console.error('Error checking waitlist history:', error);
        return null;
      }
    })();

    // Format agent counts
    const [retellCount, vapiCount, ultravoxCount, elevenlabsCount, ghlCount, knovaCount, n8nChatCount] = agentCounts;
    const totalAgents = retellCount + vapiCount + ultravoxCount + elevenlabsCount + ghlCount + knovaCount + n8nChatCount;

    // Calculate active customers
    const activeCustomers = customerCount.filter(customer =>
      customer.credentials.some(cred => cred.lastLogin && cred.status === 'ACTIVE')
    ).length;

    // Format the comprehensive response
    const partnerDetails = {
      // Basic Info
      id: partner.id,
      businessName: partner.businessName,
      email: partner.emailAddress,
      contactName: partner.contactName,
      phoneNumber: partner.phoneNumber,
      logo: partner.logo,
      createdAt: partner.createdAt,
      updatedAt: partner.updatedAt,
      
      // Domain & Branding
      subdomain: partner.subdomain,
      customDomain: partner.customDomain,
      manualSaasModeEnabled: partner.manualSaasModeEnabled,
      manualBYOAModeEnabled: partner.manualBYOAModeEnabled,
      portalMode: partner.portalMode,
      experienceEntitlements: (partner.experienceEntitlements ?? {}) as Record<string, boolean>,

      // Subscription & Payment
      subscription: {
        planId: partner.planId,
        billingInterval: partner.billingInterval,
        status: partner.subscriptionStatus,
        marketingTier: partner.marketingTier,
        approvalStatus: partner.approvalStatus,
        stripeCustomerId: partner.stripeCustomerId,
        stripeSubscriptionId: partner.stripeSubscriptionId,
        stripeAccountId: partner.stripeAccountId,
        stripeChargesEnabled: partner.stripeChargesEnabled,
        stripeOnboardingCompleted: partner.stripeOnboardingCompleted,
      },
      
      // Credits
      credits: {
        balance: partner.creditBalance,
        fractionalCredits: partner.fractionalCredits,
        monthlyAllocation: partner.monthlyCreditAllocation,
        lastAllocationDate: partner.lastCreditAllocationDate,
        lowThreshold: partner.lowCreditThreshold,
        telephonyBalance: partner.telephonyCreditBalanceCents,
        recentTransactions: creditTransactions,
      },
      
      // Trial Info
      trial: {
        hasStarted: partner.hasStartedTrial,
        startedAt: null, // Trial dates are in CustomerSubscription model, not Partner
        endedAt: null,
      },
      
      // Onboarding & Progress
      onboarding: {
        progress: onboardingProgress,
        walkthroughStartedAt: partner.walkthroughStartedAt,
        walkthroughCompletedAt: partner.walkthroughCompletedAt,
        currentStep: partner.currentWalkthroughStep,
        skipped: partner.walkthroughSkipped,
        version: partner.walkthroughVersion,
        hasSeenWelcomeVideo: partner.hasSeenWelcomeVideo,
      },
      
      // Configuration
      configuration: {
        useCustomSmtp: partner.useCustomSmtp,
        smtpHost: partner.smtpHost,
        useSESDomain: partner.useSESDomain,
        sesDomainStatus: partner.sesDomainStatus,
      },
      
      // Feature Access
      access: {
        canCreateCustomers: partner.subscriptionStatus === 'ACTIVE' || partner.hasStartedTrial,
        canCreateAgents: partner.subscriptionStatus === 'ACTIVE' || partner.hasStartedTrial,
      },
      
      // Statistics
      stats: {
        totalCustomers: partner._count.customers,
        activeCustomers,
        totalAgents,
        agentsByProvider: {
          retell: retellCount,
          vapi: vapiCount,
          ultravox: ultravoxCount,
          elevenlabs: elevenlabsCount,
          ghl: ghlCount,
          knova: knovaCount,
          n8nChat: n8nChatCount,
        },
        teamMembers: partner._count.teamMembers,
      },
      
      // Recent Customers
      recentCustomers: customerCount.map(customer => ({
        id: customer.id,
        email: customer.email,
        name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'N/A',
        createdAt: customer.createdAt,
        lastLogin: customer.credentials[0]?.lastLogin,
        status: customer.credentials[0]?.status,
      })),

      // Waitlist History
      waitlistHistory: waitlistHistoryData ? {
        wasOnWaitlist: true,
        waitlistId: waitlistHistoryData.id,
        waitlistName: waitlistHistoryData.name,
        waitlistPosition: waitlistHistoryData.position,
        waitlistStatus: waitlistHistoryData.status,
        waitlistSource: waitlistHistoryData.source,
        referralCode: waitlistHistoryData.referralCode,
        referralCount: waitlistHistoryData.referralCount,
        waitlistJoinedAt: waitlistHistoryData.createdAt,
        waitlistUpdatedAt: waitlistHistoryData.updatedAt,
      } : {
        wasOnWaitlist: false,
      },

      // Phone Service Activations
      phoneActivations: phoneActivations || [],
    };

    return NextResponse.json({
      success: true,
      data: partnerDetails
    });

  } catch (error) {
    console.error('Error fetching partner details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch partner details' },
      { status: 500 }
    );
  }
}
