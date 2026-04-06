import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface JWTPayload {
  partnerId: string;
  email: string;
}

export async function GET(request: NextRequest) {
  try {
    // Get partner info from JWT token
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('partnerJwt')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    let decoded: JWTPayload;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { partnerId } = decoded;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';

    // Get all cancellation requests for this partner
    const cancellationRequests = await prisma.recurringInvoiceCancellationRequest.findMany({
      where: {
        partnerId: partnerId,
        ...(status !== 'all' && { status }),
      },
      include: {
        invoice: {
          select: {
            invoiceNumber: true,
            title: true,
            amount: true,
            currency: true,
            recurringInterval: true,
            nextPaymentDate: true,
          },
        },
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        requestedAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      requests: cancellationRequests,
    });

  } catch (error) {
    console.error('Error fetching cancellation requests:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Get partner info from JWT token
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('partnerJwt')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    let decoded: JWTPayload;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { partnerId } = decoded;
    const { requestId, action, partnerNotes } = await request.json();

    if (!requestId || !action || !['approve', 'deny'].includes(action)) {
      return NextResponse.json({ error: 'Request ID and valid action (approve/deny) are required' }, { status: 400 });
    }

    // Verify the cancellation request belongs to this partner
    const cancellationRequest = await prisma.recurringInvoiceCancellationRequest.findFirst({
      where: {
        id: requestId,
        partnerId: partnerId,
        status: 'pending',
      },
      include: {
        invoice: true,
      },
    });

    if (!cancellationRequest) {
      return NextResponse.json({ error: 'Cancellation request not found or already processed' }, { status: 404 });
    }

    // Update the cancellation request status
    const updatedRequest = await prisma.recurringInvoiceCancellationRequest.update({
      where: { id: requestId },
      data: {
        status: action === 'approve' ? 'approved' : 'denied',
        processedAt: new Date(),
        processedBy: decoded.email,
        partnerNotes: partnerNotes || null,
      },
    });

    // If approved, cancel the recurring invoice
    if (action === 'approve') {
      await prisma.invoice.update({
        where: { id: cancellationRequest.invoiceId },
        data: {
          status: 'cancelled',
          // Clear next payment date to stop future recurring payments
          nextPaymentDate: null,
        },
      });
    }

    // TODO: Send notification email to customer about the decision
    // This could be implemented later as part of the notification system

    return NextResponse.json({
      success: true,
      message: `Cancellation request ${action}d successfully`,
      request: updatedRequest,
    });

  } catch (error) {
    console.error('Error processing cancellation request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
