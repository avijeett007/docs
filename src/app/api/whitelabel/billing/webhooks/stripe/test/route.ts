import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    message: 'Webhook endpoint is accessible',
    timestamp: new Date().toISOString(),
    method: 'GET',
    url: request.url,
    headers: {
      'user-agent': request.headers.get('user-agent'),
      'host': request.headers.get('host'),
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Test the recurring invoice processing
    if (body.type === 'invoice.paid' && body.data?.object?.metadata?.invoiceId) {
      console.log('🧪 Testing recurring invoice processing...');

      try {
        const { recurringPaymentService } = await import('../../../../../../../lib/billing/recurringPaymentService');
        await recurringPaymentService.handleRecurringInvoicePayment(body.data.object.metadata.invoiceId);

        return NextResponse.json({
          status: 'success',
          message: 'Recurring invoice processing test completed',
          invoiceId: body.data.object.metadata.invoiceId,
          timestamp: new Date().toISOString()
        });
      } catch (recurringError) {
        return NextResponse.json({
          status: 'error',
          message: 'Error testing recurring invoice processing',
          error: recurringError instanceof Error ? recurringError.message : 'Unknown error',
          invoiceId: body.data.object.metadata.invoiceId,
          timestamp: new Date().toISOString()
        }, { status: 500 });
      }
    }

    return NextResponse.json({
      status: 'test_ok',
      message: 'Webhook test endpoint received request',
      timestamp: new Date().toISOString(),
      eventType: body.type || 'unknown',
      hasInvoiceId: !!(body.data?.object?.metadata?.invoiceId)
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: 'Error processing test request',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
