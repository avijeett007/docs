import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/partner/agent-templates/[id] - Get specific agent template
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const partner = await verifyPartnerToken(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const template = await prisma.agentTemplate.findUnique({
      where: { id: params.id }
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: template
    });

  } catch (error) {
    console.error('Error fetching agent template:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent template' },
      { status: 500 }
    );
  }
}

// PATCH /api/partner/agent-templates/[id] - Update agent template
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const partner = await verifyPartnerToken(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      useCase,
      category,
      serviceAreas,
      preferredLlm,
      toolNames,
      systemPrompt,
      version,
      description,
      metadata,
      isActive
    } = body;

    // Check if template exists
    const existingTemplate = await prisma.agentTemplate.findUnique({
      where: { id: params.id }
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (useCase !== undefined) updateData.useCase = useCase;
    if (category !== undefined) updateData.category = category;
    if (serviceAreas !== undefined) updateData.serviceAreas = serviceAreas;
    if (preferredLlm !== undefined) updateData.preferredLlm = preferredLlm;
    if (toolNames !== undefined) updateData.toolNames = toolNames;
    if (systemPrompt !== undefined) updateData.systemPrompt = systemPrompt;
    if (version !== undefined) updateData.version = version;
    if (description !== undefined) updateData.description = description;
    if (metadata !== undefined) updateData.metadata = metadata;
    if (isActive !== undefined) updateData.isActive = isActive;

    const template = await prisma.agentTemplate.update({
      where: { id: params.id },
      data: updateData
    });

    return NextResponse.json({
      success: true,
      data: template
    });

  } catch (error) {
    console.error('Error updating agent template:', error);
    return NextResponse.json(
      { error: 'Failed to update agent template' },
      { status: 500 }
    );
  }
}

// DELETE /api/partner/agent-templates/[id] - Delete agent template
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const partner = await verifyPartnerToken(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if template exists
    const existingTemplate = await prisma.agentTemplate.findUnique({
      where: { id: params.id }
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    await prisma.agentTemplate.delete({
      where: { id: params.id }
    });

    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting agent template:', error);
    return NextResponse.json(
      { error: 'Failed to delete agent template' },
      { status: 500 }
    );
  }
}
