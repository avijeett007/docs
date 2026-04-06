import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { z } from 'zod';
import crypto from 'crypto';

// Validation schema for webhook test
const testWebhookSchema = z.object({
  webhook_url: z.string().url('Valid webhook URL is required'),
  webhook_secret: z.string().optional(), // Make webhook_secret optional for testing
});

export const dynamic = 'force-dynamic';

// POST - Test webhook connectivity
export async function POST(request: NextRequest) {
  try {
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    console.log('[TEST-WEBHOOK] Request body:', body);

    // Validate request body
    const validationResult = testWebhookSchema.safeParse(body);
    if (!validationResult.success) {
      console.log('[TEST-WEBHOOK] Validation failed:', validationResult.error.errors);
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const { webhook_url, webhook_secret } = validationResult.data;
    console.log('[TEST-WEBHOOK] Testing webhook:', webhook_url, 'with secret:', webhook_secret ? 'provided' : 'not provided');

    // Prepare test payload in N8N Chat Trigger expected format
    const testPayload = {
      sessionId: 'test_session_' + Date.now(), // N8N Chat Trigger expects 'sessionId'
      messageId: 'test_msg_' + Date.now(),
      message: 'This is a test message from Knotie Analytics to verify webhook connectivity.',
      timestamp: new Date().toISOString(),
      metadata: {
        test: true,
        source: 'knotie_webhook_test',
        partner_id: partner.id
      }
    };

    // Generate signature for webhook authentication (if webhook_secret is provided)
    const signature = webhook_secret ? crypto
      .createHmac('sha256', webhook_secret)
      .update(JSON.stringify(testPayload))
      .digest('hex') : null;

    const startTime = Date.now();

    try {
      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Knotie-Analytics/1.0.0',
        'X-Knotie-Test': 'true'
      };

      // Add Basic Auth header if webhook_secret is provided (for N8N Chat Trigger)
      if (webhook_secret) {
        const authString = `knotie:${webhook_secret}`;
        const authB64 = Buffer.from(authString).toString('base64');
        headers['Authorization'] = `Basic ${authB64}`;
      }

      // Add signature header if webhook_secret is provided (for custom nodes)
      if (signature) {
        headers['X-Knotie-Signature'] = `sha256=${signature}`;
      }

      // Send test request to N8N webhook
      const response = await fetch(webhook_url, {
        method: 'POST',
        headers,
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        // Try to parse response
        let responseData = null;
        try {
          const responseText = await response.text();
          if (responseText) {
            responseData = JSON.parse(responseText);
          }
        } catch (parseError) {
          // Response might not be JSON, that's okay
        }

        return NextResponse.json({
          success: true,
          message: 'Webhook test successful',
          test_result: {
            status: 'success',
            response_time_ms: responseTime,
            status_code: response.status,
            response_data: responseData
          }
        });
      } else {
        return NextResponse.json({
          success: false,
          message: 'Webhook test failed',
          test_result: {
            status: 'failed',
            response_time_ms: responseTime,
            status_code: response.status,
            error_message: `HTTP ${response.status}: ${response.statusText}`
          }
        }); // Return 200 with failure details instead of 400
      }

    } catch (fetchError: any) {
      const responseTime = Date.now() - startTime;
      
      let errorMessage = 'Unknown error';
      if (fetchError.name === 'AbortError') {
        errorMessage = 'Request timeout (10 seconds)';
      } else if (fetchError.code === 'ENOTFOUND') {
        errorMessage = 'DNS resolution failed - webhook URL not found';
      } else if (fetchError.code === 'ECONNREFUSED') {
        errorMessage = 'Connection refused - webhook endpoint not accessible';
      } else if (fetchError.code === 'ECONNRESET') {
        errorMessage = 'Connection reset by server';
      } else if (fetchError.message) {
        errorMessage = fetchError.message;
      }

      return NextResponse.json({
        success: false,
        message: 'Webhook test failed',
        test_result: {
          status: 'failed',
          response_time_ms: responseTime,
          error_message: errorMessage,
          error_code: fetchError.code || 'UNKNOWN'
        }
      }); // Return 200 with failure details instead of 400
    }

  } catch (error) {
    console.error('Error testing webhook:', error);
    return NextResponse.json(
      { error: 'Failed to test webhook' },
      { status: 500 }
    );
  }
}
