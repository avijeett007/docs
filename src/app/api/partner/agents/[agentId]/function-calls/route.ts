import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// Validation schemas
const paramsSchema = z.object({
  agentId: z.string().min(1)
});

const functionCallConfigSchema = z.object({
  appName: z.string().min(1),
  toolName: z.string().min(1),
  customName: z.string().min(1).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Custom name must be a valid function name'),
  customDescription: z.string().min(1).max(500)
});

const createFunctionCallsSchema = z.object({
  partnerId: z.string().min(1),
  customerId: z.string().min(1),
  functionCalls: z.array(functionCallConfigSchema).min(1).max(20)
});

/**
 * POST /api/partner/agents/:agentId/function-calls
 * Configure function calls for a Retell agent
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    // Validate parameters
    const { agentId } = paramsSchema.parse(params);
    
    // Parse and validate request body
    const body = await request.json();
    const { partnerId, customerId, functionCalls } = createFunctionCallsSchema.parse(body);

    logger.info('Configuring function calls for agent', {
      agentId,
      partnerId,
      customerId,
      functionCallsCount: functionCalls.length
    });

    // Get Connect Hub URL from environment
    const connectHubUrl = process.env.CONNECT_HUB_URL;
    if (!connectHubUrl) {
      throw new Error('CONNECT_HUB_URL not configured');
    }

    // Generate function calls with security tokens
    const generatedFunctionCalls = [];
    const webhookUrls: Record<string, string> = {};

    for (const functionCall of functionCalls) {
      try {
        // Generate security token for this specific tool
        const tokenResponse = await fetch(`${connectHubUrl}/api/tokens/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.CONNECT_HUB_API_KEY || ''}`
          },
          body: JSON.stringify({
            partnerId,
            customerId,
            appName: functionCall.appName,
            toolName: functionCall.toolName,
            options: {
              expiresIn: 86400, // 24 hours
              usageLimit: 100   // 100 requests per hour
            }
          })
        });

        if (!tokenResponse.ok) {
          throw new Error(`Failed to generate token for ${functionCall.toolName}`);
        }

        const tokenData = await tokenResponse.json();
        const securityToken = tokenData.token;

        // Generate webhook URL (no token in URL for security)
        const webhookUrl = `${connectHubUrl}/api/dynamic/${partnerId}/${customerId}/${functionCall.appName}/${functionCall.toolName}`;

        // Get tool schema for parameter definition
        const schemaResponse = await fetch(`${connectHubUrl}/schemas/${customerId}/${functionCall.appName}/${functionCall.toolName}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.CONNECT_HUB_API_KEY || ''}`
          }
        });

        let toolSchema = null;
        if (schemaResponse.ok) {
          const schemaData = await schemaResponse.json();
          toolSchema = schemaData.data;
        }

        // Generate Retell-compatible function definition
        const retellFunction = {
          name: functionCall.customName,
          description: functionCall.customDescription,
          parameters: transformSchemaToRetellFormat(toolSchema?.inputSchema || {})
        };

        generatedFunctionCalls.push(retellFunction);
        webhookUrls[functionCall.customName] = webhookUrl;

        // Store function call configuration in Connect Hub
        await fetch(`${connectHubUrl}/api/function-calls`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.CONNECT_HUB_API_KEY || ''}`
          },
          body: JSON.stringify({
            agentId,
            partnerId,
            customerId,
            appName: functionCall.appName,
            toolName: functionCall.toolName,
            customName: functionCall.customName,
            customDescription: functionCall.customDescription,
            securityToken,
            webhookUrl
          })
        });

        logger.debug('Function call configured', {
          agentId,
          toolName: functionCall.toolName,
          customName: functionCall.customName
        });

      } catch (error: any) {
        logger.error('Failed to configure function call', error, {
          agentId,
          toolName: functionCall.toolName
        });
        throw error;
      }
    }

    // Generate complete Retell configuration
    const retellConfig = {
      functions: generatedFunctionCalls
    };

    logger.info('Function calls configured successfully', {
      agentId,
      partnerId,
      customerId,
      functionsCount: generatedFunctionCalls.length
    });

    return NextResponse.json({
      success: true,
      data: {
        agentId,
        functionCalls: generatedFunctionCalls,
        webhookUrls,
        retellConfig
      },
      metadata: {
        partnerId,
        customerId,
        functionsCount: generatedFunctionCalls.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    logger.error('Failed to configure function calls', error, {
      agentId: params.agentId
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        code: 'VALIDATION_ERROR',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to configure function calls',
      code: 'CONFIGURATION_ERROR'
    }, { status: 500 });
  }
}

/**
 * GET /api/partner/agents/:agentId/function-calls
 * Get configured function calls for an agent
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    // Validate parameters
    const { agentId } = paramsSchema.parse(params);

    logger.info('Fetching function calls for agent', { agentId });

    // Get Connect Hub URL from environment
    const connectHubUrl = process.env.CONNECT_HUB_URL;
    if (!connectHubUrl) {
      throw new Error('CONNECT_HUB_URL not configured');
    }

    // Fetch function calls from Connect Hub
    const response = await fetch(`${connectHubUrl}/api/function-calls/${agentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.CONNECT_HUB_API_KEY || ''}`
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({
          success: true,
          data: {
            agentId,
            functionCalls: [],
            retellConfig: { functions: [] }
          },
          metadata: {
            functionsCount: 0,
            timestamp: new Date().toISOString()
          }
        });
      }

      const errorText = await response.text();
      logger.error('Connect Hub API error', new Error(errorText), {
        status: response.status,
        agentId
      });

      return NextResponse.json({
        success: false,
        error: 'Failed to fetch function calls',
        code: 'CONNECT_HUB_ERROR'
      }, { status: response.status });
    }

    const data = await response.json();

    logger.info('Function calls fetched successfully', {
      agentId,
      functionsCount: data.data?.functionCalls?.length || 0
    });

    return NextResponse.json({
      success: true,
      data: data.data,
      metadata: {
        ...data.metadata,
        source: 'connect-hub',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    logger.error('Failed to fetch function calls', error, {
      agentId: params.agentId
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid parameters',
        code: 'VALIDATION_ERROR',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}

/**
 * Transform Composio tool schema to Retell-compatible format
 */
function transformSchemaToRetellFormat(inputSchema: any): {
  type: "object";
  properties: Record<string, any>;
  required: string[];
} {
  if (!inputSchema || !inputSchema.properties) {
    return {
      type: "object",
      properties: {},
      required: []
    };
  }

  const properties: Record<string, any> = {};
  const required: string[] = inputSchema.required || [];

  for (const [key, prop] of Object.entries(inputSchema.properties)) {
    const propDef = prop as any;
    
    properties[key] = {
      type: propDef.type || 'string',
      description: propDef.description || `${key} parameter`
    };

    // Add enum values if present
    if (propDef.enum) {
      properties[key].enum = propDef.enum;
    }

    // Add format for specific types
    if (propDef.format) {
      properties[key].format = propDef.format;
    }

    // Handle array types
    if (propDef.type === 'array' && propDef.items) {
      properties[key].items = {
        type: propDef.items.type || 'string',
        description: propDef.items.description
      };
    }
  }

  return {
    type: "object",
    properties,
    required
  };
}
