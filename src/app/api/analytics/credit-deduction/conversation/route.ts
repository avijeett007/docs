/**
 * N8N Chat Conversation Credit Deduction API
 *
 * Handles credit deduction for N8N Chat conversations.
 * Follows the same customer-based billing model as voice AI agents.
 * Respects agent billing configuration and customer AI Credits settings.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkAndSendLowCreditNotification } from '@/lib/services/lowCreditNotificationService';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Validation schema for conversation credit deduction
const ConversationCreditDeductionSchema = z.object({
  conversation_id: z.string().min(1, 'Conversation ID is required'),
  agent_id: z.string().min(1, 'Agent ID is required'),
  provider: z.string().default('n8n_chat'),
  message_count: z.number().int().min(0).default(0),
  agent_name: z.string().nullable().optional(),
  conversation_started_at: z.string().nullable().optional(),
  conversation_ended_at: z.string().nullable().optional(),
  webhook_id: z.string().nullable().optional(),
  deduction_type: z.literal('conversation').default('conversation'),
  credits_to_deduct: z.number().int().min(1).default(1)
});

// type ConversationCreditDeductionRequest = z.infer<typeof ConversationCreditDeductionSchema>;

/**
 * POST /api/analytics/credit-deduction/conversation
 * 
 * Process credit deduction for N8N Chat conversations
 */
export async function POST(request: NextRequest) {
  let validatedData: z.infer<typeof ConversationCreditDeductionSchema> | undefined;

  try {
    // Verify API key authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const apiKey = authHeader.replace('Bearer ', '');
    const expectedApiKey = process.env.INTERNAL_API_KEY;

    if (!expectedApiKey || apiKey !== expectedApiKey) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    validatedData = ConversationCreditDeductionSchema.parse(body);

    const {
      conversation_id,
      agent_id,
      provider,
      message_count,
      agent_name: providedAgentName,
      conversation_started_at,
      conversation_ended_at,
      webhook_id,
      credits_to_deduct
    } = validatedData;

    console.log(`🔄 Processing conversation credit deduction for conversation ${conversation_id} (provider: ${provider})`);

    // Agent lookup - support both N8N Chat and Retell Chat providers
    const agentSelect = {
      id: true,
      name: true,
      customerId: true,
      partnerId: true,
      creditConfig: true,
      status: true,
      isActive: true,
      partner: {
        select: {
          id: true,
          businessName: true,
          creditBalance: true,
          totalCreditsUsed: true
        }
      },
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          aiCreditsEnabled: true,
          aiCreditPricePerMinute: true,
          aiCreditGracePeriodSeconds: true,
          creditBalance: true,
          totalCreditsUsed: true
        }
      }
    } as const;

    let agent;
    if (provider === 'retell_chat') {
      agent = await prisma.retellChatAgent.findUnique({
        where: { id: agent_id },
        select: agentSelect
      });
    } else {
      agent = await prisma.n8nChatAgent.findUnique({
        where: { id: agent_id },
        select: {
          ...agentSelect,
          integrationMode: true
        }
      });
    }

    if (!agent) {
      return NextResponse.json(
        { error: `${provider === 'retell_chat' ? 'Retell Chat' : 'N8N Chat'} agent not found` },
        { status: 404 }
      );
    }

    // Check if agent is in active state - only deduct credits for active agents
    if (agent.status !== 'active' || !agent.isActive) {
      console.log(`⏭️ Agent ${agent.id} is not active (status: ${agent.status}, isActive: ${agent.isActive}), skipping credit deduction`);

      return NextResponse.json({
        success: true,
        status: 'skipped',
        reason: `Agent is not active (status: ${agent.status}, isActive: ${agent.isActive})`,
        conversation_id,
        credits_deducted: 0,
        agent: {
          id: agent.id,
          name: agent.name,
          status: agent.status,
          is_active: agent.isActive
        }
      });
    }

    const partner = agent.partner;
    const customer = agent.customer;

    if (!partner) {
      return NextResponse.json(
        { error: 'Partner not found for agent' },
        { status: 404 }
      );
    }

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found for agent' },
        { status: 404 }
      );
    }

    // Check if AI Credits are enabled for the customer (like voice agents)
    if (!customer.aiCreditsEnabled) {
      console.log(`⏭️ AI Credits not enabled for customer ${customer.id}, skipping credit deduction`);

      return NextResponse.json({
        success: true,
        status: 'skipped',
        reason: 'AI Credits not enabled for customer',
        conversation_id,
        credits_deducted: 0,
        customer: {
          id: customer.id,
          name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email,
          ai_credits_enabled: false
        }
      });
    }

    // Get agent's credit configuration with proper typing
    interface CreditConfig {
      billing_mode: 'per_conversation' | 'per_message_pair' | 'per_10_messages' | 'per_minute';
      credits_per_unit: number;
      minimum_credits: number;
    }

    const creditConfig: CreditConfig = (agent.creditConfig as unknown as CreditConfig) || {
      billing_mode: 'per_conversation',
      credits_per_unit: 1,
      minimum_credits: 1
    };

    // Calculate credits to deduct based on agent's billing configuration
    let calculatedCredits = 0;

    try {
      switch (creditConfig.billing_mode) {
        case 'per_conversation':
          calculatedCredits = Math.max(creditConfig.credits_per_unit, 0);
          break;
        case 'per_message_pair':
          const messagePairs = Math.ceil(Math.max(message_count || 0, 0) / 2);
          calculatedCredits = Math.max(messagePairs * creditConfig.credits_per_unit, creditConfig.minimum_credits);
          break;
        case 'per_10_messages':
          const messageGroups = Math.ceil(Math.max(message_count || 0, 0) / 10);
          calculatedCredits = Math.max(messageGroups * creditConfig.credits_per_unit, creditConfig.minimum_credits);
          break;
        case 'per_minute':
          // For per_minute billing, use customer's rate (like voice agents)
          let conversationDuration = 1; // Default to 1 minute
          if (conversation_ended_at && conversation_started_at) {
            const startTime = new Date(conversation_started_at).getTime();
            const endTime = new Date(conversation_ended_at).getTime();
            if (!isNaN(startTime) && !isNaN(endTime) && endTime > startTime) {
              conversationDuration = Math.ceil((endTime - startTime) / (1000 * 60));
            }
          }
          calculatedCredits = conversationDuration * (customer.aiCreditPricePerMinute || creditConfig.credits_per_unit);
          break;
        default:
          console.warn(`Unknown billing mode: ${creditConfig.billing_mode}, using default`);
          calculatedCredits = creditConfig.credits_per_unit;
      }
    } catch (error) {
      console.error('Error calculating credits:', error);
      calculatedCredits = creditConfig.credits_per_unit; // Fallback to default
    }

    // Use calculated credits or fallback to provided credits_to_deduct
    const finalCreditsToDeduct = Math.max(calculatedCredits || credits_to_deduct, 0);

    console.log(`💰 Credit calculation: mode=${creditConfig.billing_mode}, messages=${message_count}, calculated=${calculatedCredits}, final=${finalCreditsToDeduct}`);

    // Validate final credits amount
    if (finalCreditsToDeduct <= 0) {
      console.warn(`Invalid credit amount calculated: ${finalCreditsToDeduct}, using minimum of 1`);
      // Don't process if no credits to deduct
      return NextResponse.json({
        success: true,
        message: 'No credits to deduct',
        conversation_id,
        credits_deducted: 0,
        customer_balance: customer.creditBalance,
        customer: {
          id: customer.id,
          name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email
        }
      });
    }

    // Check if customer has sufficient credits
    if (customer.creditBalance < finalCreditsToDeduct) {
      console.log(`❌ Insufficient credits for customer ${customer.id}: ${customer.creditBalance} < ${finalCreditsToDeduct}`);
      
      // Still record the usage but mark as insufficient credits
      await prisma.aIUsage.create({
        data: {
          partnerId: partner.id,
          customerId: customer.id,
          ...(provider === 'retell_chat'
            ? { retellChatAgentId: agent_id }
            : { n8nChatAgentId: agent_id }),
          vendorType: provider,
          usageType: 'conversation',
          usageAmount: finalCreditsToDeduct,
          costPerUnit: 0.01,
          totalCost: finalCreditsToDeduct * 0.01,
          usageDate: new Date(),
          chatUsage: finalCreditsToDeduct,
          vendorCost: finalCreditsToDeduct * 0.01,
          billedCost: finalCreditsToDeduct * 0.01,
          createdAt: new Date(),
          metadata: {
            conversation_id,
            message_count,
            agent_name: providedAgentName || agent.name,
            conversation_started_at,
            conversation_ended_at,
            webhook_id,
            billing_mode: creditConfig.billing_mode,
            integration_mode: 'integrationMode' in agent ? String((agent as any).integrationMode) : provider,
            agent_status: agent.status,
            agent_is_active: agent.isActive,
            credits_calculated: calculatedCredits,
            insufficient_credits: true
          }
        }
      });

      return NextResponse.json(
        {
          error: 'Insufficient credits',
          customer_balance: customer.creditBalance,
          credits_required: finalCreditsToDeduct,
          customer: {
            id: customer.id,
            name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email
          }
        },
        { status: 402 } // Payment Required
      );
    }

    // Check for duplicate conversation processing using metadata
    const existingUsage = await prisma.aIUsage.findFirst({
      where: {
        partnerId: partner.id,
        customerId: customer.id,
        ...(provider === 'retell_chat'
          ? { retellChatAgentId: agent_id }
          : { n8nChatAgentId: agent_id }),
        vendorType: provider,
        usageType: 'conversation',
        metadata: {
          path: ['conversation_id'],
          equals: conversation_id
        }
      }
    });

    if (existingUsage) {
      console.log(`⚠️ Conversation ${conversation_id} already processed for credit deduction`);
      return NextResponse.json({
        success: true,
        message: 'Conversation already processed',
        conversation_id,
        credits_deducted: 0,
        customer_balance: customer.creditBalance,
        customer: {
          id: customer.id,
          name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email
        },
        duplicate: true
      });
    }

    // Process credit deduction in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Deduct credits from CUSTOMER balance (like voice agents)
      const updatedCustomer = await tx.customer.update({
        where: { id: customer.id },
        data: {
          creditBalance: {
            decrement: finalCreditsToDeduct
          },
          totalCreditsUsed: {
            increment: finalCreditsToDeduct
          }
        }
      });

      // Record the usage
      const usage = await tx.aIUsage.create({
        data: {
          partnerId: partner.id,
          customerId: customer.id,
          ...(provider === 'retell_chat'
            ? { retellChatAgentId: agent_id }
            : { n8nChatAgentId: agent_id }),
          vendorType: provider,
          usageType: 'conversation',
          usageAmount: finalCreditsToDeduct,
          costPerUnit: 0.01,
          totalCost: finalCreditsToDeduct * 0.01,
          usageDate: new Date(),
          chatUsage: finalCreditsToDeduct,
          vendorCost: finalCreditsToDeduct * 0.01,
          billedCost: finalCreditsToDeduct * 0.01,
          createdAt: new Date(),
          metadata: {
            conversation_id,
            message_count,
            agent_name: providedAgentName || agent.name,
            conversation_started_at,
            conversation_ended_at,
            webhook_id,
            billing_mode: creditConfig.billing_mode,
            integration_mode: 'integrationMode' in agent ? String((agent as any).integrationMode) : provider,
            agent_status: agent.status,
            agent_is_active: agent.isActive,
            credits_calculated: calculatedCredits,
            processed_at: new Date().toISOString()
          }
        }
      });

      return {
        updatedCustomer,
        usage
      };
    });

    console.log(`✅ Successfully deducted ${finalCreditsToDeduct} credits for conversation ${conversation_id}`);
    console.log(`💰 Customer ${customer.firstName || ''} ${customer.lastName || ''} balance: ${result.updatedCustomer.creditBalance} credits`);

    // Check and send low credit notification after successful deduction
    try {
      const notificationResult = await checkAndSendLowCreditNotification(customer.id, result.updatedCustomer.creditBalance);
      if (notificationResult.sent) {
        console.log(`📧 Low credit notification sent to customer ${customer.id}`);
      } else if (notificationResult.reason) {
        console.log(`📧 Low credit notification not sent: ${notificationResult.reason}`);
      }
    } catch (error) {
      console.error('Error sending low credit notification:', error);
      // Don't fail the credit deduction if notification fails
    }

    return NextResponse.json({
      success: true,
      message: 'Credit deduction processed successfully',
      conversation_id,
      credits_deducted: finalCreditsToDeduct,
      customer_balance: result.updatedCustomer.creditBalance,
      usage_id: result.usage.id,
      billing_mode: creditConfig.billing_mode,
      partner: {
        id: partner.id,
        name: partner.businessName
      },
      agent: {
        id: agent.id,
        name: agent.name,
        integration_mode: 'integrationMode' in agent ? agent.integrationMode : provider,
        status: agent.status,
        is_active: agent.isActive,
        credit_config: creditConfig
      },
      customer: {
        id: customer.id,
        name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email,
        credit_balance: result.updatedCustomer.creditBalance,
        total_credits_used: result.updatedCustomer.totalCreditsUsed,
        ai_credits_enabled: customer.aiCreditsEnabled
      }
    });

  } catch (error) {
    console.error('❌ Error processing conversation credit deduction:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      conversation_id: validatedData?.conversation_id,
      agent_id: validatedData?.agent_id
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: error.errors,
          conversation_id: validatedData?.conversation_id
        },
        { status: 400 }
      );
    }

    // Handle Prisma errors
    if (error && typeof error === 'object' && 'code' in error) {
      const prismaError = error as { code: string; message: string };
      if (prismaError.code === 'P2002') {
        return NextResponse.json(
          {
            error: 'Duplicate record constraint violation',
            conversation_id: validatedData?.conversation_id
          },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        conversation_id: validatedData?.conversation_id
      },
      { status: 500 }
    );
  }
}
