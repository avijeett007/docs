import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const params = new URLSearchParams(body);
    
    const bundleSid = params.get('BundleSid');
    const status = params.get('Status');
    const rejectionReason = params.get('RejectionReason');
    
    console.log('Bundle status webhook received:', {
      bundleSid,
      status,
      rejectionReason,
    });

    if (!bundleSid || !status) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Find the bundle in our database
    const bundle = await prisma.twilioBundle.findUnique({
      where: { bundleSid },
      include: {
        customer: {
          select: { email: true, firstName: true, lastName: true }
        },
        partner: {
          select: { businessName: true, emailAddress: true }
        }
      }
    });

    if (!bundle) {
      console.warn(`Bundle not found in database: ${bundleSid}`);
      return NextResponse.json({ message: 'Bundle not found' }, { status: 404 });
    }

    // Update bundle status
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'approved') {
      updateData.approvedAt = new Date();
    } else if (status === 'rejected' && rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    }

    await prisma.twilioBundle.update({
      where: { bundleSid },
      data: updateData,
    });

    console.log(`Bundle ${bundleSid} status updated to: ${status}`);

    // TODO: Send notification to customer about status change
    // This could be an email notification or in-app notification
    if (status === 'approved') {
      console.log(`Bundle approved for customer ${bundle.customer.email} - they can now purchase phone numbers`);
    } else if (status === 'rejected') {
      console.log(`Bundle rejected for customer ${bundle.customer.email} - reason: ${rejectionReason}`);
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Bundle status webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
