/**
 * Example API Route with Signoz Telemetry
 * 
 * This demonstrates how to use the telemetry utilities in your API routes.
 * You can use this as a reference for instrumenting your own routes.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  traceAsync,
  addSpanAttributes,
  recordEvent,
  traceDbOperation,
} from '@/lib/telemetry';

/**
 * Example: Simple traced operation
 */
async function fetchUserData(userId: string) {
  return traceAsync(
    'example.fetchUserData',
    async () => {
      // Simulate database query
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return {
        id: userId,
        name: 'John Doe',
        email: 'john@example.com',
      };
    },
    {
      userId,
      operation: 'fetch',
    }
  );
}

/**
 * Example: Database operation with tracing
 */
async function createRecord(data: any) {
  return traceDbOperation('create', 'example_table', async () => {
    // Simulate database insert
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return {
      id: Math.random().toString(36).substring(7),
      ...data,
      createdAt: new Date().toISOString(),
    };
  });
}

/**
 * Example: Complex operation with multiple traces
 */
async function processRequest(userId: string, action: string) {
  return traceAsync(
    'example.processRequest',
    async () => {
      // Add context to the current span
      addSpanAttributes({
        'user.id': userId,
        'request.action': action,
        'request.timestamp': Date.now(),
      });

      // Record an event
      recordEvent('request.started', {
        action,
        userId,
      });

      // Fetch user data (creates a child span)
      const user = await fetchUserData(userId);

      // Create a record (creates another child span)
      const record = await createRecord({
        userId,
        action,
        userName: user.name,
      });

      // Record completion event
      recordEvent('request.completed', {
        recordId: record.id,
        duration: 150, // ms
      });

      return {
        success: true,
        user,
        record,
      };
    },
    {
      'request.type': 'example',
    }
  );
}

/**
 * GET /api/telemetry/example
 * 
 * Example endpoint demonstrating telemetry usage
 */
export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId') || 'user-123';
    const action = searchParams.get('action') || 'test';

    // Process the request with full tracing
    const result = await processRequest(userId, action);

    return NextResponse.json({
      success: true,
      message: 'Request processed successfully',
      data: result,
      telemetry: {
        enabled: process.env.NEXT_PUBLIC_SIGNOZ_ENABLED === 'true',
        serviceName: process.env.SIGNOZ_SERVICE_NAME || 'knotie-ai-pro',
      },
    });
  } catch (error) {
    console.error('Error processing request:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/telemetry/example
 * 
 * Example endpoint for POST requests with telemetry
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Trace the entire operation
    const result = await traceAsync(
      'api.telemetry.example.post',
      async () => {
        // Add request details to the trace
        addSpanAttributes({
          'http.method': 'POST',
          'request.body.size': JSON.stringify(body).length,
          'request.has_userId': !!body.userId,
        });

        // Record the request event
        recordEvent('api.request.received', {
          endpoint: '/api/telemetry/example',
          method: 'POST',
        });

        // Process the data
        const processed = await processRequest(
          body.userId || 'anonymous',
          body.action || 'create'
        );

        return processed;
      },
      {
        'http.route': '/api/telemetry/example',
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Data processed successfully',
      data: result,
    });
  } catch (error) {
    console.error('Error processing POST request:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

