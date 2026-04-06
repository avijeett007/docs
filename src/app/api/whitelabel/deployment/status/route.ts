import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyWhitelabelAuth } from '@/lib/whitelabelAuth';

export async function PATCH(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyWhitelabelAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { customerId, partnerId } = authResult;
    const body = await request.json();
    const { deploymentStatus } = body;

    // Validate deployment status
    const validStatuses = ['not_started', 'phone_provisioned', 'agent_deploying', 'agent_ready', 'completed'];
    if (!deploymentStatus || !validStatuses.includes(deploymentStatus)) {
      return NextResponse.json(
        { success: false, error: 'Invalid deployment status' },
        { status: 400 }
      );
    }

    // Update customer deployment status
    const updatedCustomer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        deploymentStatus,
        // Set completion timestamp if status is completed
        ...(deploymentStatus === 'completed' && {
          deploymentCompletedAt: new Date()
        }),
        // Set agent ready timestamp if status is agent_ready
        ...(deploymentStatus === 'agent_ready' && {
          agentReadyAt: new Date()
        })
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        deploymentStatus: updatedCustomer.deploymentStatus,
        deploymentCompletedAt: updatedCustomer.deploymentCompletedAt,
        agentReadyAt: updatedCustomer.agentReadyAt
      }
    });

  } catch (error) {
    console.error('Error updating deployment status:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
