import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

// Configuration validation schema
const configSchema = z.object({
  kbProcessingCostCredits: z.number().int().min(1).max(1000).optional(),
  kbMaxFileSizeMB: z.number().int().min(1).max(100).optional(),
  kbOverageCostPerMB: z.number().int().min(1).max(50).optional(),
});

// Customer processing enable/disable schema
const customerProcessingSchema = z.object({
  customerId: z.string().uuid(),
  enabled: z.boolean(),
});

// GET /api/partner/knowledge-base/config
// Get partner's KB processing configuration
export async function GET(request: NextRequest) {
  try {
    // Get partner ID from headers or session
    const partnerId = request.headers.get('X-Partner-ID');
    
    if (!partnerId) {
      return NextResponse.json(
        { error: 'Partner ID is required' },
        { status: 400 }
      );
    }

    // Get partner configuration
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        kbProcessingCostCredits: true,
        kbMaxFileSizeMB: true,
        kbOverageCostPerMB: true,
        creditBalance: true,
      }
    });

    if (!partner) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        kbProcessingCostCredits: partner.kbProcessingCostCredits || 50,
        kbMaxFileSizeMB: partner.kbMaxFileSizeMB || 10,
        kbOverageCostPerMB: partner.kbOverageCostPerMB || 5,
        currentCreditBalance: partner.creditBalance,
        defaults: {
          kbProcessingCostCredits: 50,
          kbMaxFileSizeMB: 10,
          kbOverageCostPerMB: 5,
        }
      }
    });

  } catch (error) {
    console.error('Error getting KB processing config:', error);
    return NextResponse.json(
      { error: 'Failed to get configuration' },
      { status: 500 }
    );
  }
}

// PUT /api/partner/knowledge-base/config
// Update partner's KB processing configuration
export async function PUT(request: NextRequest) {
  try {
    // Get partner ID from headers or session
    const partnerId = request.headers.get('X-Partner-ID');
    
    if (!partnerId) {
      return NextResponse.json(
        { error: 'Partner ID is required' },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = configSchema.parse(body);

    // Update partner configuration
    const updatedPartner = await prisma.partner.update({
      where: { id: partnerId },
      data: {
        ...validatedData,
        updatedAt: new Date(),
      },
      select: {
        kbProcessingCostCredits: true,
        kbMaxFileSizeMB: true,
        kbOverageCostPerMB: true,
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Knowledge base processing configuration updated successfully',
      data: updatedPartner,
    });

  } catch (error) {
    console.error('Error updating KB processing config:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid configuration data',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          }))
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update configuration' },
      { status: 500 }
    );
  }
}

// POST /api/partner/knowledge-base/config/customer-processing
// Enable/disable KB processing for a specific customer
export async function POST(request: NextRequest) {
  try {
    // Get partner ID from headers or session
    const partnerId = request.headers.get('X-Partner-ID');
    
    if (!partnerId) {
      return NextResponse.json(
        { error: 'Partner ID is required' },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const { customerId, enabled } = customerProcessingSchema.parse(body);

    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: {
        id: customerId,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        kbProcessingEnabled: true,
      }
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Update customer processing status
    const updatedCustomer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        kbProcessingEnabled: enabled,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        kbProcessingEnabled: true,
      }
    });

    return NextResponse.json({
      success: true,
      message: `Knowledge base processing ${enabled ? 'enabled' : 'disabled'} for customer`,
      data: {
        customerId: updatedCustomer.id,
        customerName: `${updatedCustomer.firstName} ${updatedCustomer.lastName}`,
        kbProcessingEnabled: updatedCustomer.kbProcessingEnabled,
      }
    });

  } catch (error) {
    console.error('Error updating customer KB processing:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          }))
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update customer processing status' },
      { status: 500 }
    );
  }
}
