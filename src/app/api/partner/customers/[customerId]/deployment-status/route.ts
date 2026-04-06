import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJWT } from '@/lib/jwt';
import { cookies } from 'next/headers';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { customerId: string } }
) {
  try {
    // Get the token from Authorization header or cookies
    let token: string | null = null;
    const authHeader = request.headers.get('Authorization');

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else {
      token = cookies().get('partner_token')?.value || null;
    }

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify JWT token
    const decoded = await verifyJWT(token);
    if (!decoded || !decoded.partnerId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { customerId } = params;
    const body = await request.json();
    const { deploymentStatus, deploymentNotes } = body;

    if (!deploymentStatus) {
      return NextResponse.json(
        { error: 'Deployment status is required' },
        { status: 400 }
      );
    }

    // Validate deployment status
    const validStatuses = [
      'not_started',
      'phone_provisioned', 
      'agent_deploying',
      'agent_ready',
      'completed'
    ];

    if (!validStatuses.includes(deploymentStatus)) {
      return NextResponse.json(
        { error: 'Invalid deployment status' },
        { status: 400 }
      );
    }

    // Get the customer and their partner relationship through UserOnboarding
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        deploymentStatus: true,
        userId: true
      }
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Get the partner relationship through UserOnboarding
    const userOnboarding = await prisma.userOnboarding.findUnique({
      where: { userId: customer.userId },
      select: { partnerId: true }
    });

    if (!userOnboarding?.partnerId) {
      return NextResponse.json(
        { error: 'Customer not associated with any partner' },
        { status: 404 }
      );
    }

    // Verify partner ownership
    const partner = await prisma.partner.findFirst({
      where: {
        id: userOnboarding.partnerId,
        OR: [
          { id: decoded.partnerId },
          {
            teamMembers: {
              some: {
                email: decoded.email,
                status: 'active'
              }
            }
          }
        ]
      }
    });

    if (!partner) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Prepare update data with timestamps
    const updateData: any = {
      deploymentStatus,
      deploymentNotes: deploymentNotes || null
    };

    // Set appropriate timestamps based on status
    const now = new Date();
    switch (deploymentStatus) {
      case 'phone_provisioned':
        if (customer.deploymentStatus === 'not_started') {
          updateData.phoneProvisionedAt = now;
        }
        break;
      case 'agent_deploying':
        updateData.agentDeployingAt = now;
        break;
      case 'agent_ready':
        updateData.agentReadyAt = now;
        break;
      case 'completed':
        updateData.deploymentCompletedAt = now;
        break;
    }

    // Update customer deployment status
    const updatedCustomer = await prisma.customer.update({
      where: { id: customerId },
      data: updateData,
      select: {
        id: true,
        deploymentStatus: true,
        deploymentNotes: true,
        deploymentRequestedAt: true,
        phoneProvisionedAt: true,
        agentDeployingAt: true,
        agentReadyAt: true,
        deploymentCompletedAt: true
      }
    });

    return NextResponse.json({
      success: true,
      customer: updatedCustomer,
      message: 'Deployment status updated successfully'
    });

  } catch (error) {
    console.error('Error updating deployment status:', error);
    return NextResponse.json(
      { error: 'Failed to update deployment status' },
      { status: 500 }
    );
  }
}
