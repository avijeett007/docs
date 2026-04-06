import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/partner/agent-templates - Get all agent templates
export async function GET(request: NextRequest) {
  try {
    const partner = await verifyPartnerToken(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const isActive = searchParams.get('isActive');

    const whereClause: any = {};
    
    if (category) {
      whereClause.category = category;
    }
    
    if (isActive !== null) {
      whereClause.isActive = isActive === 'true';
    }

    const templates = await prisma.agentTemplate.findMany({
      where: whereClause,
      orderBy: [
        { isActive: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    return NextResponse.json({
      success: true,
      data: templates
    });

  } catch (error) {
    console.error('Error fetching agent templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent templates' },
      { status: 500 }
    );
  }
}

// POST /api/partner/agent-templates - Create new agent template
export async function POST(request: NextRequest) {
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
      metadata
    } = body;

    // Validate required fields
    if (!name || !useCase || !category || !preferredLlm || !systemPrompt || !version) {
      return NextResponse.json(
        { error: 'Missing required fields: name, useCase, category, preferredLlm, systemPrompt, version' },
        { status: 400 }
      );
    }

    const template = await prisma.agentTemplate.create({
      data: {
        name,
        useCase,
        category,
        serviceAreas: serviceAreas || [],
        preferredLlm,
        toolNames: toolNames || [],
        systemPrompt,
        version,
        description,
        metadata,
        isActive: true
      }
    });

    return NextResponse.json({
      success: true,
      data: template
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating agent template:', error);
    return NextResponse.json(
      { error: 'Failed to create agent template' },
      { status: 500 }
    );
  }
}
