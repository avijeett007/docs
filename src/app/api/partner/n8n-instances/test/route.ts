import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerToken } from '@/lib/auth';
import { N8nApiClient } from '@/lib/n8n/client';
import { z } from 'zod';

const testConnectionSchema = z.object({
  baseUrl: z.string().url('Invalid base URL format'),
  apiKey: z.string().min(1, 'API key is required'),
});

/**
 * POST /api/partner/n8n-instances/test
 * Test N8N instance connection
 */
export async function POST(request: NextRequest) {
  try {
    // Verify partner authentication
    const authResult = await verifyPartnerToken(request);
    if (!authResult.success || !authResult.partner) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { baseUrl, apiKey } = testConnectionSchema.parse(body);

    // Create N8N client for testing
    const testClient = new N8nApiClient(baseUrl, apiKey, { timeoutSeconds: 10, retryAttempts: 1 });

    try {
      // Test connection
      const isConnected = await testClient.testConnection();

      if (!isConnected) {
        return NextResponse.json({
          success: false,
          error: 'Connection test failed',
        }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        data: {
          status: 'connected',
          version: 'unknown', // We don't get version from testConnection
          instanceType: 'unknown',
          lastTested: new Date().toISOString(),
          message: 'Connection successful',
        },
      });
    } catch (error) {
      console.error('N8N connection test failed:', error);
      
      let errorMessage = 'Connection failed';
      const errorDetails = null;

      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Provide more specific error messages
        if (error.message.includes('ENOTFOUND')) {
          errorMessage = 'Domain not found. Please check the base URL.';
        } else if (error.message.includes('ECONNREFUSED')) {
          errorMessage = 'Connection refused. Please check if N8N is running and accessible.';
        } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          errorMessage = 'Invalid API key. Please check your N8N API key.';
        } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
          errorMessage = 'API access forbidden. Please check your N8N API permissions.';
        } else if (error.message.includes('404')) {
          errorMessage = 'N8N API not found. Please check the base URL and ensure API is enabled.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Connection timeout. Please check your N8N instance availability.';
        }
      }

      return NextResponse.json({
        success: false,
        error: errorMessage,
        data: {
          status: 'failed',
          lastTested: new Date().toISOString(),
          errorDetails: errorDetails,
        },
      });
    }
  } catch (error) {
    console.error('Error testing N8N connection:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to test connection',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
