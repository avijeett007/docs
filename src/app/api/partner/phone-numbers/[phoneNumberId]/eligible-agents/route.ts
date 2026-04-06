import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

export async function GET(
  req: NextRequest,
  { params }: { params: { phoneNumberId: string } }
) {
  try {
    // Verify partner authentication
    const partnerAuth = await verifyPartnerJWT(req);
    if (!partnerAuth || !partnerAuth.isValid || !partnerAuth.payload?.partnerId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = partnerAuth.payload.partnerId;
    const { phoneNumberId } = params;

    console.log(`[DEBUG] Getting eligible agents for phone number: ${phoneNumberId}, partner: ${partnerId}`);

    // First, get the phone number and verify ownership
    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: {
        id: phoneNumberId,
        partnerId: partnerId
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    if (!phoneNumber) {
      return NextResponse.json(
        { success: false, error: 'Phone number not found' },
        { status: 404 }
      );
    }

    // Determine which agent types are compatible with this phone number
    // retell_provider numbers are locked to Retell agents only (from the same Retell account)
    const isRetellProviderNumber = phoneNumber.provider === 'retell_provider';
    const isRetellCompatible = ['imported_twilio', 'imported_telnyx', 'twilio', 'telnyx', 'retell_provider'].includes(phoneNumber.provider);
    const isVapiCompatible = ['imported_twilio', 'imported_telnyx', 'twilio', 'telnyx'].includes(phoneNumber.provider);
    const isKnovaCompatible = ['imported_twilio', 'imported_telnyx', 'twilio', 'telnyx'].includes(phoneNumber.provider);

    if (!isRetellCompatible && !isVapiCompatible && !isKnovaCompatible) {
      return NextResponse.json({
        success: false,
        error: 'This phone number type is not compatible with any agent providers'
      }, { status: 400 });
    }

    console.log(`[DEBUG] Phone number customer assignment: ${phoneNumber.customerId ? 'assigned' : 'unassigned'}`);
    console.log(`[DEBUG] Agent compatibility - Retell: ${isRetellCompatible}, VAPI: ${isVapiCompatible}, Knova: ${isKnovaCompatible}`);

    // Get eligible agents based on customer assignment rules and provider compatibility
    const allEligibleAgents = [];

    // Fetch Retell agents if compatible
    if (isRetellCompatible) {
      if (isRetellProviderNumber) {
        // For retell_provider numbers, list agents directly from the Retell account
        // that owns this number, using the stored encrypted API key.
        // This ensures partners only see agents from the correct Retell account.
        if (phoneNumber.providerCredentialId) {
          try {
            const providerCredential = await prisma.phoneNumberProvider.findUnique({
              where: { id: phoneNumber.providerCredentialId },
            });

            if (providerCredential && providerCredential.credentials) {
              const rawApiKey = await decrypt(providerCredential.credentials);
              const retellResponse = await fetch('https://api.retellai.com/list-agents', {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${rawApiKey}`,
                  'Accept': 'application/json',
                },
                signal: AbortSignal.timeout(10000),
              });

              if (retellResponse.ok) {
                const retellAgents: any[] = await retellResponse.json();
                const transformedRetellAgents = retellAgents.map((agent: any) => ({
                  id: agent.agent_id,
                  name: agent.agent_name || agent.agent_id,
                  customerId: null,
                  customerName: null,
                  isActive: true,
                  provider: 'retell' as const,
                }));
                allEligibleAgents.push(...transformedRetellAgents);
                console.log(`[DEBUG] Found ${retellAgents.length} eligible Retell agents from Retell API`);
              } else {
                console.warn(`[DEBUG] Failed to fetch agents from Retell API: ${retellResponse.status}`);
              }
            } else {
              console.warn('[DEBUG] retell_provider number has no valid provider credential record');
            }
          } catch (retellError: any) {
            console.error('[DEBUG] Error fetching agents from Retell API:', retellError.message);
          }
        } else {
          console.warn('[DEBUG] retell_provider number has no providerCredentialId — cannot list agents');
        }
      } else {
        // Standard telephony numbers: query DB for partner's Retell agents
        let retellAgents;

        if (phoneNumber.customerId) {
          // Phone number is assigned to a customer — show agents for same customer OR unassigned
          retellAgents = await prisma.retellAgent.findMany({
            where: {
              partnerId: partnerId,
              isActive: true,
              OR: [
                { customerId: phoneNumber.customerId },
                { customerId: null }
              ]
            },
            include: {
              customer: {
                select: { id: true, firstName: true, lastName: true, email: true }
              }
            },
            orderBy: [
              { customerId: 'asc' },
              { name: 'asc' }
            ]
          });
        } else {
          // Phone number is unassigned — show only unassigned agents
          retellAgents = await prisma.retellAgent.findMany({
            where: { partnerId: partnerId, customerId: null, isActive: true },
            include: {
              customer: {
                select: { id: true, firstName: true, lastName: true, email: true }
              }
            },
            orderBy: { name: 'asc' }
          });
        }

        const transformedRetellAgents = retellAgents.map(agent => ({
          id: agent.id,
          name: agent.name,
          customerId: agent.customerId,
          customerName: agent.customer
            ? `${agent.customer.firstName || ''} ${agent.customer.lastName || ''}`.trim()
            : null,
          isActive: agent.isActive,
          provider: 'retell' as const
        }));

        allEligibleAgents.push(...transformedRetellAgents);
        console.log(`[DEBUG] Found ${retellAgents.length} eligible Retell agents from DB`);
      }
    }

    // Fetch VAPI agents if compatible
    if (isVapiCompatible) {
      let vapiAgents;

      if (phoneNumber.customerId) {
        // Phone number is assigned to a customer
        // Show agents for the same customer OR unassigned agents
        vapiAgents = await prisma.vapiAgent.findMany({
          where: {
            partnerId: partnerId,
            isActive: true,
            OR: [
              { customerId: phoneNumber.customerId },
              { customerId: null }
            ]
          },
          include: {
            customer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          },
          orderBy: [
            { customerId: 'asc' }, // Show customer agents first
            { name: 'asc' }
          ]
        });
      } else {
        // Phone number is unassigned
        // Show only unassigned agents
        vapiAgents = await prisma.vapiAgent.findMany({
          where: {
            partnerId: partnerId,
            customerId: null,
            isActive: true
          },
          include: {
            customer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          },
          orderBy: {
            name: 'asc'
          }
        });
      }

      // Transform VAPI agents to unified format
      const transformedVapiAgents = vapiAgents.map(agent => ({
        id: agent.id,
        name: agent.name,
        customerId: agent.customerId,
        customerName: agent.customer
          ? `${agent.customer.firstName || ''} ${agent.customer.lastName || ''}`.trim()
          : null,
        isActive: agent.isActive,
        provider: 'vapi' as const
      }));

      allEligibleAgents.push(...transformedVapiAgents);
      console.log(`[DEBUG] Found ${vapiAgents.length} eligible VAPI agents`);
    }

    // Fetch Knova agents if compatible
    if (isKnovaCompatible) {
      let knovaAgents;

      if (phoneNumber.customerId) {
        // Phone number is assigned to a customer
        // Show agents for the same customer OR unassigned agents
        knovaAgents = await prisma.knovaAgent.findMany({
          where: {
            partnerId: partnerId,
            isActive: true,
            OR: [
              { customerId: phoneNumber.customerId },
              { customerId: null }
            ]
          },
          include: {
            customer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          },
          orderBy: [
            { customerId: 'asc' }, // Show customer agents first
            { name: 'asc' }
          ]
        });
      } else {
        // Phone number is unassigned
        // Show only unassigned agents
        knovaAgents = await prisma.knovaAgent.findMany({
          where: {
            partnerId: partnerId,
            customerId: null,
            isActive: true
          },
          include: {
            customer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          },
          orderBy: {
            name: 'asc'
          }
        });
      }

      // Transform Knova agents to unified format
      const transformedKnovaAgents = knovaAgents.map(agent => ({
        id: agent.id,
        name: agent.name,
        customerId: agent.customerId,
        customerName: agent.customer
          ? `${agent.customer.firstName || ''} ${agent.customer.lastName || ''}`.trim()
          : null,
        isActive: agent.isActive,
        provider: 'knova' as const
      }));

      allEligibleAgents.push(...transformedKnovaAgents);
      console.log(`[DEBUG] Found ${knovaAgents.length} eligible Knova agents`);
    }

    // Sort all agents by provider (Retell first, then VAPI, then Knova), then by customer assignment, then by name
    const providerOrder = { retell: 0, vapi: 1, knova: 2 };
    allEligibleAgents.sort((a, b) => {
      // First sort by provider
      const providerA = providerOrder[a.provider as keyof typeof providerOrder] ?? 99;
      const providerB = providerOrder[b.provider as keyof typeof providerOrder] ?? 99;
      if (providerA !== providerB) {
        return providerA - providerB;
      }
      // Then by customer assignment (assigned first)
      if ((a.customerId === null) !== (b.customerId === null)) {
        return a.customerId === null ? 1 : -1;
      }
      // Finally by name
      return a.name.localeCompare(b.name);
    });

    console.log(`[DEBUG] Total eligible agents: ${allEligibleAgents.length}`);

    return NextResponse.json({
      success: true,
      agents: allEligibleAgents,
      phoneNumber: {
        id: phoneNumber.id,
        phoneNumber: phoneNumber.phoneNumber,
        customerId: phoneNumber.customerId,
        customerName: phoneNumber.customer
          ? `${phoneNumber.customer.firstName || ''} ${phoneNumber.customer.lastName || ''}`.trim()
          : null,
        provider: phoneNumber.provider
      },
      compatibility: {
        retell: isRetellCompatible,
        vapi: isVapiCompatible,
        knova: isKnovaCompatible
      }
    });

  } catch (error: any) {
    console.error('Error fetching eligible agents:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch eligible agents' },
      { status: 500 }
    );
  }
}
