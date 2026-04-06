import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';

/**
 * POST /api/partner/phone-numbers/[phoneNumberId]/reassign-agent
 * Reassign a phone number to a different agent (delete + reimport approach)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { phoneNumberId: string } }
) {
  try {
    const phoneNumberId = params.phoneNumberId;
    const {
      agentProvider,
      agentId,
      inboundAgentId,
      outboundAgentId,
      assignmentType = 'inbound',
      enableInboundWebhook = true // Default to true for AI Receptionist functionality
    } = await request.json();

    // Verify partner authentication
    const authResult = await verifyPartnerJWT(request);
    if (!authResult.isValid || !authResult.payload) {
      return authResult.error || NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[DEBUG] Reassigning phone number: ${phoneNumberId} with assignment type: ${assignmentType}`);

    // Validate input based on assignment type
    if (assignmentType === 'dual') {
      if (!agentProvider || !inboundAgentId || !outboundAgentId) {
        return NextResponse.json({
          success: false,
          error: 'Agent provider, inbound agent ID, and outbound agent ID are required for dual assignment'
        }, { status: 400 });
      }
    } else {
      if (!agentProvider || !agentId) {
        return NextResponse.json({
          success: false,
          error: 'Agent provider and agent ID are required'
        }, { status: 400 });
      }
    }

    // Currently only support Retell
    if (agentProvider !== 'retell') {
      return NextResponse.json({
        success: false,
        error: 'Only Retell agents are currently supported'
      }, { status: 400 });
    }

    // 1. First unassign from current agent
    console.log(`[DEBUG] Step 1: Unassigning from current agent...`);
    const unassignResponse = await fetch(`${request.nextUrl.origin}/api/partner/phone-numbers/${phoneNumberId}/unassign-agent`, {
      method: 'POST',
      headers: {
        'Authorization': request.headers.get('Authorization') || '',
        'Content-Type': 'application/json'
      }
    });

    if (!unassignResponse.ok) {
      const unassignError = await unassignResponse.json();
      // If phone number is not assigned, that's okay - continue with assignment
      if (unassignResponse.status !== 400) {
        return NextResponse.json({
          success: false,
          error: `Failed to unassign: ${unassignError.error}`
        }, { status: unassignResponse.status });
      }
    }

    console.log(`[DEBUG] Step 2: Assigning to new agent...`);

    // 2. Then assign to new agent (webhook URL will be automatically updated by assign-agent endpoint)
    const assignResponse = await fetch(`${request.nextUrl.origin}/api/partner/phone-numbers/${phoneNumberId}/assign-agent`, {
      method: 'POST',
      headers: {
        'Authorization': request.headers.get('Authorization') || '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(
        assignmentType === 'dual'
          ? {
              agentProvider,
              inboundAgentId,
              outboundAgentId,
              assignmentType,
              enableInboundWebhook
            }
          : {
              agentProvider,
              agentId,
              assignmentType,
              enableInboundWebhook
            }
      )
    });

    if (!assignResponse.ok) {
      const assignError = await assignResponse.json();
      return NextResponse.json({
        success: false,
        error: `Failed to assign to new agent: ${assignError.error}`
      }, { status: assignResponse.status });
    }

    const assignResult = await assignResponse.json();

    return NextResponse.json({
      success: true,
      message: `Phone number successfully reassigned to ${agentProvider} agent`,
      data: assignResult.data
    });

  } catch (error: any) {
    console.error('Error reassigning phone number:', error);
    return NextResponse.json({
      success: false,
      error: `Failed to reassign phone number: ${error.message}`
    }, { status: 500 });
  }
}
