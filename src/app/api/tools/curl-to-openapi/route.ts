import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';
interface ParsedCurl {
  method: string;
  url: string;
  headers: Record<string, string>;
  data?: string;
}

function parseCurl(curlCommand: string): ParsedCurl {
  const result: ParsedCurl = {
    method: 'GET',
    url: '',
    headers: {},
  };

  // Remove 'curl' from the start if present
  const cmd = curlCommand.trim().replace(/^curl\s+/, '');

  // Split the command into parts, respecting quotes
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < cmd.length; i++) {
    const char = cmd[i];
    if ((char === '"' || char === "'") && (i === 0 || cmd[i - 1] !== '\\')) {
      if (!inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === ' ' && !inQuotes && current) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current) {
    parts.push(current);
  }

  // Parse the parts
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    
    if (part.startsWith('http://') || part.startsWith('https://')) {
      result.url = part;
    } else if (part === '-X' || part === '--request') {
      result.method = parts[++i].toUpperCase();
    } else if (part === '-H' || part === '--header') {
      const header = parts[++i];
      const [key, ...valueParts] = header.split(':');
      const value = valueParts.join(':').trim();
      result.headers[key.trim()] = value;
    } else if (part === '-d' || part === '--data' || part === '--data-raw') {
      result.data = parts[++i];
      if (!result.headers['Content-Type']) {
        result.headers['Content-Type'] = 'application/json';
      }
      if (result.method === 'GET') {
        result.method = 'POST';
      }
    } else if (part.startsWith('--data=')) {
      result.data = part.slice(7);
      if (!result.headers['Content-Type']) {
        result.headers['Content-Type'] = 'application/json';
      }
      if (result.method === 'GET') {
        result.method = 'POST';
      }
    }
  }

  if (!result.url) {
    throw new Error('No URL found in cURL command');
  }

  return result;
}

export async function POST(req: NextRequest) {
  try {
    const { curlCommand } = await req.json();

    if (!curlCommand) {
      return NextResponse.json(
        { error: 'cURL command is required' },
        { status: 400 }
      );
    }

    // Parse curl command
    const parsed = parseCurl(curlCommand);
    const urlObj = new URL(parsed.url);

    // Create OpenAPI structure
    const spec: any = {
      openapi: '3.0.0',
      info: {
        title: 'API from cURL',
        version: '1.0.0',
        description: 'Generated from cURL command'
      },
      servers: [{
        url: `${urlObj.protocol}//${urlObj.host}`
      }],
      paths: {
        [urlObj.pathname]: {
          [parsed.method.toLowerCase()]: {
            summary: 'Operation from cURL',
            description: 'Generated from cURL command',
            parameters: [],
            responses: {
              '200': {
                description: 'Successful response'
              }
            }
          }
        }
      }
    };

    const operation = spec.paths[urlObj.pathname][parsed.method.toLowerCase()];

    // Add query parameters
    if (urlObj.searchParams.toString()) {
      urlObj.searchParams.forEach((value, key) => {
        operation.parameters.push({
          name: key,
          in: 'query',
          schema: {
            type: isNaN(Number(value)) ? 'string' : 'number'
          },
          example: value,
          required: true
        });
      });
    }

    // Add headers
    Object.entries(parsed.headers).forEach(([key, value]) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey === 'authorization') {
        // Handle auth header
        const authValue = value.toLowerCase();
        if (authValue.startsWith('bearer')) {
          spec.components = {
            securitySchemes: {
              BearerAuth: {
                type: 'http',
                scheme: 'bearer'
              }
            }
          };
          operation.security = [{ BearerAuth: [] }];
        } else if (authValue.startsWith('basic')) {
          spec.components = {
            securitySchemes: {
              BasicAuth: {
                type: 'http',
                scheme: 'basic'
              }
            }
          };
          operation.security = [{ BasicAuth: [] }];
        } else {
          // Treat as API key
          spec.components = {
            securitySchemes: {
              ApiKeyAuth: {
                type: 'apiKey',
                in: 'header',
                name: key
              }
            }
          };
          operation.security = [{ ApiKeyAuth: [] }];
        }
      } else if (lowerKey !== 'content-type') {
        operation.parameters.push({
          name: key,
          in: 'header',
          schema: { type: 'string' },
          example: value,
          required: true
        });
      }
    });

    // Add request body
    if (parsed.data) {
      const contentType = parsed.headers['Content-Type'] || 'application/json';
      
      if (contentType.includes('json')) {
        try {
          const jsonData = JSON.parse(parsed.data);
          operation.requestBody = {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: Object.entries(jsonData).reduce((acc, [key, value]) => ({
                    ...acc,
                    [key]: {
                      type: typeof value,
                      example: value
                    }
                  }), {})
                }
              }
            }
          };
        } catch {
          // If JSON parsing fails, treat as raw string
          operation.requestBody = {
            required: true,
            content: {
              'text/plain': {
                schema: {
                  type: 'string',
                  example: parsed.data
                }
              }
            }
          };
        }
      } else if (contentType.includes('form')) {
        const formData = new URLSearchParams(parsed.data);
        operation.requestBody = {
          required: true,
          content: {
            'application/x-www-form-urlencoded': {
              schema: {
                type: 'object',
                properties: Array.from(formData.entries()).reduce((acc, [key, value]) => ({
                  ...acc,
                  [key]: {
                    type: 'string',
                    example: value
                  }
                }), {})
              }
            }
          }
        };
      } else {
        operation.requestBody = {
          required: true,
          content: {
            [contentType]: {
              schema: {
                type: 'string',
                example: parsed.data
              }
            }
          }
        };
      }
    }

    return NextResponse.json(spec);
  } catch (error: any) {
    console.error('Error converting cURL:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to convert cURL command' },
      { status: 500 }
    );
  }
}
