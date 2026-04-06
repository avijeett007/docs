import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';



// Helper function to verify partner JWT
async function verifyPartnerToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    const partner = await prisma.partner.findUnique({
      where: { id: decoded.partnerId },
      select: { id: true, emailAddress: true }
    });

    return partner;
  } catch (error) {
    return null;
  }
}

// GET /api/partner/widgets/[widgetId] - Get widget details
export async function GET(
  request: NextRequest,
  { params }: { params: { widgetId: string } }
) {
  try {
    const partner = await verifyPartnerToken(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const widget = await prisma.agentWidget.findFirst({
      where: {
        id: params.widgetId,
        partnerId: partner.id
      },
      include: {
        _count: {
          select: {
            analytics: true
          }
        }
      }
    });

    if (!widget) {
      return NextResponse.json(
        { error: 'Widget not found' },
        { status: 404 }
      );
    }

    // Get analytics data
    const analytics = await prisma.widgetAnalytics.groupBy({
      by: ['eventType'],
      where: {
        widgetId: widget.id
      },
      _count: {
        eventType: true
      }
    });

    const lastUsed = await prisma.widgetAnalytics.findFirst({
      where: {
        widgetId: widget.id
      },
      orderBy: {
        timestamp: 'desc'
      },
      select: {
        timestamp: true
      }
    });

    return NextResponse.json({
      success: true,
      widget: {
        id: widget.id,
        name: widget.name,
        widgetType: widget.widgetType,
        agentType: widget.agentType,
        agentId: widget.agentId,
        customerId: widget.customerId,
        isActive: widget.isActive,
        allowedDomains: widget.allowedDomains,
        customization: {
          primaryColor: widget.primaryColor,
          secondaryColor: widget.secondaryColor,
          backgroundColor: widget.backgroundColor,
          textColor: widget.textColor,
          borderRadius: widget.borderRadius,
          position: widget.position,
          size: widget.size,
          autoStart: widget.autoStart,
          showBranding: widget.showBranding,
          showTranscript: widget.showTranscript,
          welcomeMessage: widget.welcomeMessage,
          buttonText: widget.buttonText,
          endCallText: widget.endCallText
        },
        widgetToken: widget.widgetToken,
        totalViews: analytics.find(a => a.eventType === 'view')?._count.eventType || 0,
        totalInteractions: analytics.find(a => a.eventType === 'interaction')?._count.eventType || 0,
        createdAt: widget.createdAt,
        updatedAt: widget.updatedAt,
        lastUsedAt: lastUsed?.timestamp
      }
    });

  } catch (error) {
    console.error('Error fetching widget:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/partner/widgets/[widgetId] - Update widget
export async function PATCH(
  request: NextRequest,
  { params }: { params: { widgetId: string } }
) {
  try {
    const partner = await verifyPartnerToken(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      isActive,
      allowedDomains,
      customization
    } = body;

    // Verify widget belongs to partner
    const existingWidget = await prisma.agentWidget.findFirst({
      where: {
        id: params.widgetId,
        partnerId: partner.id
      }
    });

    if (!existingWidget) {
      return NextResponse.json(
        { error: 'Widget not found' },
        { status: 404 }
      );
    }

    // Update widget
    const updateData: any = {};
    
    if (name !== undefined) updateData.name = name;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (allowedDomains !== undefined) updateData.allowedDomains = allowedDomains;
    if (customization !== undefined) updateData.customization = customization;

    const widget = await prisma.agentWidget.update({
      where: {
        id: params.widgetId
      },
      data: updateData
    });

    return NextResponse.json({
      success: true,
      widget: {
        id: widget.id,
        name: widget.name,
        widgetType: widget.widgetType,
        isActive: widget.isActive,
        updatedAt: widget.updatedAt
      }
    });

  } catch (error) {
    console.error('Error updating widget:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/partner/widgets/[widgetId] - Full widget update (for edit mode)
export async function PUT(
  request: NextRequest,
  { params }: { params: { widgetId: string } }
) {
  try {
    const partner = await verifyPartnerToken(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      widgetType,
      customization,
      allowedDomains
    } = body;

    // Verify widget belongs to partner
    const existingWidget = await prisma.agentWidget.findFirst({
      where: {
        id: params.widgetId,
        partnerId: partner.id
      }
    });

    if (!existingWidget) {
      return NextResponse.json(
        { error: 'Widget not found' },
        { status: 404 }
      );
    }

    // Update widget with full data
    const widget = await prisma.agentWidget.update({
      where: {
        id: params.widgetId
      },
      data: {
        name,
        widgetType,
        allowedDomains,
        // Flatten customization object to individual fields
        primaryColor: customization?.appearance?.primaryColor,
        secondaryColor: customization?.appearance?.secondaryColor,
        backgroundColor: customization?.appearance?.backgroundColor,
        textColor: customization?.appearance?.textColor,
        borderRadius: customization?.appearance?.borderRadius,
        position: customization?.behavior?.position,
        size: customization?.behavior?.size,
        autoStart: customization?.behavior?.autoStart,
        showBranding: customization?.behavior?.showBranding,
        showTranscript: customization?.behavior?.showTranscript,
        welcomeMessage: customization?.messages?.welcomeMessage,
        buttonText: customization?.messages?.buttonText,
        endCallText: customization?.messages?.endCallText,
        updatedAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      widget: {
        id: widget.id,
        name: widget.name,
        widgetType: widget.widgetType,
        agentType: widget.agentType,
        isActive: widget.isActive,
        allowedDomains: widget.allowedDomains,
        widgetToken: widget.widgetToken,
        customization: {
          appearance: {
            primaryColor: widget.primaryColor,
            secondaryColor: widget.secondaryColor,
            backgroundColor: widget.backgroundColor,
            textColor: widget.textColor,
            borderRadius: widget.borderRadius
          },
          behavior: {
            position: widget.position,
            size: widget.size,
            autoStart: widget.autoStart,
            showBranding: widget.showBranding,
            showTranscript: widget.showTranscript
          },
          messages: {
            welcomeMessage: widget.welcomeMessage,
            buttonText: widget.buttonText,
            endCallText: widget.endCallText
          }
        },
        createdAt: widget.createdAt,
        updatedAt: widget.updatedAt
      }
    });

  } catch (error) {
    console.error('Error updating widget:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/partner/widgets/[widgetId] - Delete widget
export async function DELETE(
  request: NextRequest,
  { params }: { params: { widgetId: string } }
) {
  try {
    const partner = await verifyPartnerToken(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify widget belongs to partner
    const existingWidget = await prisma.agentWidget.findFirst({
      where: {
        id: params.widgetId,
        partnerId: partner.id
      }
    });

    if (!existingWidget) {
      return NextResponse.json(
        { error: 'Widget not found' },
        { status: 404 }
      );
    }

    // Delete widget and related analytics (cascade delete)
    await prisma.agentWidget.delete({
      where: {
        id: params.widgetId
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Widget deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting widget:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
