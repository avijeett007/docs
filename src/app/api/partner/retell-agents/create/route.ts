import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerJWT } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/encryption';

// Transform function calls to Retell tools with proper security and schema handling
async function transformFunctionCallsToRetellTools(functionCalls: any[], partnerId: string, customerId: string): Promise<any[]> {
  const tools: any[] = [];

  // Always include end_call tool
  tools.push({
    type: "end_call",
    name: "end_call",
    description: "End the call with user."
  });

  const connectHubUrl = process.env.CONNECT_HUB_URL || 'http://localhost:3001';

  // Transform configured function calls
  for (const fc of functionCalls) {
    if (fc.appName === 'retell') {
      // Built-in Retell tool
      const tool: any = {
        type: fc.toolName,
        name: fc.customName,
        description: fc.customDescription
      };

      // Add tool-specific configuration from parameterValues
      if (fc.toolName === 'transfer_call' && fc.parameterValues) {
        tool.transfer_destination = fc.parameterValues.transfer_destination;
        tool.transfer_option = fc.parameterValues.transfer_option;
      }

      tools.push(tool);
    } else {
      // Custom Composio tool - generate proper security token and schema
      try {
        // Generate security token for this specific function call
        const tokenResponse = await fetch(`${connectHubUrl}/api/tokens/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.CONNECT_HUB_API_KEY || ''}`
          },
          body: JSON.stringify({
            partnerId,
            customerId,
            appName: fc.appName,
            toolName: fc.toolName,
            options: {
              expiresIn: 31536000, // 1 year in seconds
              usageLimit: 1000     // Higher limit for agent function calls
            }
          })
        });

        if (!tokenResponse.ok) {
          console.error(`Failed to generate security token for ${fc.appName}/${fc.toolName}`);
          continue; // Skip this function call if token generation fails
        }

        const tokenData = await tokenResponse.json();
        const securityToken = tokenData.token;

        // Get tool schema for proper parameter definition
        const schemaResponse = await fetch(`${connectHubUrl}/schemas/${customerId}/${fc.appName}/${fc.toolName}`, {
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

        // Generate webhook URL with actual IDs (no token in URL for security)
        const webhookUrl = `${connectHubUrl}/api/dynamic/${partnerId}/${customerId}/${fc.appName}/${fc.toolName}`;

        // Use frontend-generated parameters if available, otherwise transform from tool schema
        const parameters = fc.parameters || transformSchemaToRetellFormat(toolSchema?.inputSchema || {});



        // Ensure base description doesn't exceed limit before adding defaults
        const baseDescription = fc.customDescription || '';
        const maxDescriptionLength = 1024;

        const tool: any = {
          type: 'custom',
          name: fc.customName,
          description: baseDescription,
          url: webhookUrl,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Use customer-specific token in Authorization header (secure)
            'Authorization': `Bearer ${securityToken}`
          },
          parameters: parameters,
          speak_during_execution: fc.speakDuringExecution ?? true,
          speak_after_execution: fc.speakAfterExecution ?? true,
          execution_message_description: fc.executionMessageDescription ||
            getExecutionMessage(fc.toolName, fc.customDescription),
          timeout_ms: fc.timeoutMs || 30000
        };

        // Add pre-filled parameter values to the function description (Retell doesn't support defaults in schema)
        console.log('🔍 Backend - Function call data:', {
          customName: fc.customName,
          parameterValues: fc.parameterValues,
          hasParameterValues: !!fc.parameterValues,
          parameterValuesKeys: fc.parameterValues ? Object.keys(fc.parameterValues) : [],
          toolParametersProperties: tool.parameters.properties ? Object.keys(tool.parameters.properties) : []
        });

        if (fc.parameterValues && Object.keys(fc.parameterValues).length > 0) {
          const defaultValues: string[] = [];
          Object.entries(fc.parameterValues).forEach(([key, value]) => {
            if (value !== undefined && value !== '') {
              defaultValues.push(`${key}: "${value}"`);
              console.log(`🔍 Backend - Will include default value for ${key}:`, value);
            }
          });

          if (defaultValues.length > 0) {
            const defaultsText = `\n\nDefault values to use: ${defaultValues.join(', ')}`;
            let fullDescription = tool.description + defaultsText;

            // Truncate description to meet Retell's 1024 character limit
            const maxDescriptionLength = 1024;
            if (fullDescription.length > maxDescriptionLength) {
              fullDescription = fullDescription.substring(0, maxDescriptionLength - 3) + '...';
              console.log('🔍 Backend - Description truncated due to length limit');
            }

            tool.description = fullDescription;
            console.log('🔍 Backend - Updated description with defaults:', tool.description);
          }
        } else {
          console.log('🔍 Backend - No parameterValues to include in description');
        }

        tools.push(tool);

        // Store function call configuration in Connect Hub for tracking
        await fetch(`${connectHubUrl}/api/function-calls`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.CONNECT_HUB_API_KEY || ''}`
          },
          body: JSON.stringify({
            partnerId,
            customerId,
            appName: fc.appName,
            toolName: fc.toolName,
            customName: fc.customName,
            customDescription: fc.customDescription,
            securityToken,
            webhookUrl
          })
        });

      } catch (error) {
        console.error(`Error configuring function call ${fc.appName}/${fc.toolName}:`, error);
        // Continue with other function calls even if one fails
      }
    }
  }

  return tools;
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
  const required: string[] = [];

  // Transform each property
  for (const [key, value] of Object.entries(inputSchema.properties)) {
    const prop = value as any;

    // Basic type mapping
    properties[key] = {
      type: prop.type || 'string',
      description: prop.description || `${key} parameter`
    };

    // Add examples for better Retell understanding
    if (prop.examples && Array.isArray(prop.examples) && prop.examples.length > 0) {
      properties[key].examples = prop.examples;
    }

    // Add default values if available
    if (prop.default !== undefined && prop.default !== null) {
      properties[key].default = prop.default;
    }

    // Special handling for datetime fields to help Retell
    if (key.includes('datetime') || key.includes('time')) {
      if (!properties[key].examples) {
        const now = new Date();
        const futureTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
        const exampleDateTime = futureTime.toISOString().slice(0, 19); // Remove Z and milliseconds
        properties[key].examples = [exampleDateTime];
      }
      // Enhance description for datetime fields
      if (key === 'start_datetime') {
        properties[key].description = `${properties[key].description} IMPORTANT: Use format YYYY-MM-DDTHH:MM:SS (e.g., "2025-09-05T14:30:00"). Extract date and time from user's request.`;
      }
    }

    // Handle enum values
    if (prop.enum && Array.isArray(prop.enum)) {
      properties[key].enum = prop.enum;
    }

    // Handle array types
    if (prop.type === 'array' && prop.items) {
      properties[key].items = {
        type: prop.items.type || 'string',
        description: prop.items.description || 'Array item'
      };
    }

    // Handle object types
    if (prop.type === 'object' && prop.properties) {
      properties[key].properties = {};
      for (const [subKey, subValue] of Object.entries(prop.properties)) {
        const subProp = subValue as any;
        properties[key].properties[subKey] = {
          type: subProp.type || 'string',
          description: subProp.description || `${subKey} parameter`
        };
      }
    }
  }

  // Add required fields
  if (inputSchema.required && Array.isArray(inputSchema.required)) {
    required.push(...inputSchema.required);
  }

  return {
    type: "object",
    properties,
    required
  };
}

/**
 * Generate appropriate execution messages for different tool types
 */
function getExecutionMessage(toolName: string, customDescription: string): string {
  // Calendar-specific messages
  if (toolName.includes('CREATE_EVENT')) {
    return "I'm creating a calendar event for you. Please provide the date, time, and event details.";
  }
  if (toolName.includes('FIND_FREE_SLOTS')) {
    return "Let me check your calendar for available time slots.";
  }
  if (toolName.includes('LIST_EVENTS')) {
    return "I'm checking your upcoming calendar events.";
  }
  if (toolName.includes('GET_CURRENT_DATE_TIME')) {
    return "Let me get the current date and time for you.";
  }

  // Gmail-specific messages
  if (toolName.includes('SEND_EMAIL')) {
    return "I'm sending an email for you. Please provide the recipient, subject, and message.";
  }
  if (toolName.includes('READ_EMAIL')) {
    return "Let me check your emails.";
  }

  // Generic fallback
  return customDescription ?
    `Let me ${customDescription.toLowerCase()} for you.` :
    `I'm executing ${toolName.toLowerCase().replace(/_/g, ' ')} for you.`;
}
import axios from 'axios';
import { downloadFile } from '@/lib/supabase';
import { registerAgentInAnalytics, generateWebhookUrl } from '@/lib/analytics';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

interface CreateAgentRequest {
  agentName: string;
  generalPrompt: string;
  voiceId: string;
  apiKey: string;
  language: string;
  customerId?: string;
  beginMessage?: string;
  agentType: 'simple' | 'advanced';
  knowledgeBaseIds?: string[];

  // Voice Control Settings
  voiceTemperature?: number;
  voiceSpeed?: number;
  volume?: number;
  voiceModel?: string;
  fallbackVoiceIds?: string[];

  // Conversation Control Settings
  responsiveness?: number;
  interruptionSensitivity?: number;

  // Call Management Settings
  endCallAfterSilenceMs?: number;
  maxCallDurationMs?: number;
  reminderTriggerMs?: number;
  reminderMaxCount?: number;

  // Audio Enhancement Settings
  enableBackchannel?: boolean;
  backchannelFrequency?: number;
  backchannelWords?: string[];
  ambientSound?: string;
  ambientSoundVolume?: number;
  normalizeForSpeech?: boolean;

  // Other Settings
  boostedKeywords?: string[];

  // Legacy advanced settings (for backward compatibility)
  advancedSettings?: {
    voiceSpeed?: number;
    voiceTemperature?: number;
    voiceModel?: string;
    model?: string;
    modelTemperature?: number;
    modelHighPriority?: boolean;
    interruptionSensitivity?: number;
    enableBackchannel?: boolean;
    normalizeForSpeech?: boolean;
    maxCallDurationMs?: number;
    endCallAfterSilenceMs?: number;
    webhookUrl?: string;
  };
  states?: any[];
  startingState?: string;
  functionCalls?: Array<{
    id?: string;
    appName: string;
    toolName: string;
    customName: string;
    customDescription: string;
    isConfigured?: boolean;
    webhookUrl?: string;
    parameterValues?: Record<string, any>;
    speakDuringExecution?: boolean;
    speakAfterExecution?: boolean;
    executionMessageDescription?: string;
    timeoutMs?: number;
  }>;
}



/**
 * Create or update Retell knowledge bases from selected knowledge base IDs
 * Reuses existing Retell KBs when available to avoid duplicate charges
 */
async function createRetellKnowledgeBases(
  knowledgeBaseIds: string[],
  customerId: string,
  partnerId: string,
  apiKey: string
): Promise<string[]> {
  if (!knowledgeBaseIds || knowledgeBaseIds.length === 0) {
    return [];
  }

  const retellKnowledgeBaseIds: string[] = [];

  for (const kbId of knowledgeBaseIds) {
    try {
      // Check if we already have a Retell KB mapping for this knowledge base
      const existingMapping = await prisma.knowledgeBaseProviderMapping.findUnique({
        where: {
          knowledgeBaseId_provider: {
            knowledgeBaseId: kbId,
            provider: 'retell',
          },
        },
      });

      if (existingMapping) {
        console.log(`[createRetellKnowledgeBases] Reusing existing Retell KB: ${existingMapping.providerKnowledgeBaseId} for knowledge base ${kbId}`);
        retellKnowledgeBaseIds.push(existingMapping.providerKnowledgeBaseId);

        // Update the last synced timestamp
        await prisma.knowledgeBaseProviderMapping.update({
          where: { id: existingMapping.id },
          data: { lastSyncedAt: new Date() },
        });

        continue;
      }



      // Get knowledge base details including website URLs
      const knowledgeBase = await prisma.knowledgeBase.findFirst({
        where: {
          id: kbId,
          customerId,
          partnerId,
        },
        include: {
          files: {
            // Include ALL files regardless of embedding status since we're not doing local processing yet
            select: {
              id: true,
              name: true,
              storageKey: true,
              bucketName: true,
              fileType: true,
              fileSize: true,
              embeddingStatus: true,
            },
          },
          websiteUrls: {
            where: {
              isActive: true,
            },
            include: {
              pages: {
                where: {
                  scrapingStatus: { in: ['completed', 'pending'] }, // Include pending since Retell will handle scraping
                },
                select: {
                  id: true,
                  url: true,
                  title: true,
                  scrapingStatus: true,
                },
              },
            },
          },
        },
      });

      if (!knowledgeBase) {
        console.warn(`[createRetellKnowledgeBases] Knowledge base ${kbId} not found`);
        continue;
      }

      console.log(`[createRetellKnowledgeBases] Knowledge base ${kbId} found with ${knowledgeBase.files.length} files and ${knowledgeBase.websiteUrls.length} website URLs`);
      console.log(`[createRetellKnowledgeBases] Files included for Retell:`);
      knowledgeBase.files.forEach(file => {
        console.log(`  - ${file.name}: ${file.embeddingStatus} (${file.fileSize} bytes)`);
      });

      if (knowledgeBase.files.length === 0 && knowledgeBase.websiteUrls.length === 0) {
        console.warn(`[createRetellKnowledgeBases] Knowledge base ${kbId} has no files or website URLs to send to Retell`);
        continue;
      }

      // Download files and prepare them for upload to Retell
      const fileBlobs: { name: string; blob: Blob }[] = [];
      for (const file of knowledgeBase.files) {
        try {
          // Download the file from Supabase
          const fullStorageKey = `${partnerId}/${customerId}/${file.storageKey}`;
          console.log(`[createRetellKnowledgeBases] Downloading file: ${file.name} from ${fullStorageKey}`);

          const fileData = await downloadFile(file.bucketName || 'files', fullStorageKey);
          if (fileData) {
            const blob = new Blob([fileData], { type: file.fileType || 'application/octet-stream' });
            fileBlobs.push({ name: file.name, blob });
            console.log(`[createRetellKnowledgeBases] Downloaded file ${file.name}: ${fileData.byteLength} bytes`);
          } else {
            console.warn(`[createRetellKnowledgeBases] Failed to download file ${file.name}`);
          }
        } catch (error) {
          console.error(`[createRetellKnowledgeBases] Error downloading file ${file.id}:`, error);
        }
      }

      // Collect website URLs - include all URLs since they're ready to be scraped by Retell
      const websiteUrls: string[] = [];
      let pendingPagesCount = 0;
      knowledgeBase.websiteUrls.forEach(websiteUrl => {
        websiteUrl.pages.forEach(page => {
          websiteUrls.push(page.url);
          if (page.scrapingStatus === 'pending') {
            pendingPagesCount++;
          }
        });
      });

      // Info about pending pages (this is just our internal scraping status)
      if (pendingPagesCount > 0) {
        console.log(`[createRetellKnowledgeBases] INFO: ${pendingPagesCount} pages are still being processed by our scraper, but URLs are valid and ready for Retell to scrape.`);
      }

      // Check if we have any content to create knowledge base with
      if (fileBlobs.length === 0 && websiteUrls.length === 0) {
        console.warn(`[createRetellKnowledgeBases] No valid files or website URLs for knowledge base ${kbId}`);
        continue;
      }

      // Try creating a single knowledge base with both files and URLs
      // Based on Retell documentation, this should work

      // Validate website URLs before sending to Retell
      const validWebsiteUrls = websiteUrls.filter(url => {
        try {
          new URL(url);
          return true;
        } catch {
          console.warn(`[createRetellKnowledgeBases] Invalid URL detected: ${url}`);
          return false;
        }
      });

      if (websiteUrls.length > 0 && validWebsiteUrls.length === 0) {
        throw new Error(`All website URLs in knowledge base "${knowledgeBase.name}" are invalid. Please check the URLs and try again.`);
      }

      // Create Retell knowledge base using binary files and/or website URLs
      const formData = new FormData();
      const kbName = knowledgeBase.name?.trim() || 'Untitled Knowledge Base';

      // Retell requires knowledge base name to be less than 40 characters
      let retellKbName = `${kbName} (Agent KB)`;
      if (retellKbName.length > 39) {
        // Truncate the original name to fit within limit
        const maxOriginalLength = 39 - ' (Agent KB)'.length;
        const truncatedName = kbName.substring(0, maxOriginalLength);
        retellKbName = `${truncatedName} (Agent KB)`;
      }

      formData.append('knowledge_base_name', retellKbName);

      // Add each file as binary data
      if (fileBlobs.length > 0) {
        fileBlobs.forEach(({ name, blob }) => {
          formData.append('knowledge_base_files', blob, name);
        });
      }

      // Add website URLs - try different approach based on documentation
      if (validWebsiteUrls.length > 0) {
        // Method 1: Try sending as JSON array (some APIs expect this)
        formData.append('knowledge_base_urls', JSON.stringify(validWebsiteUrls));
        formData.append('enable_auto_refresh', 'true');
      }

      console.log(`[createRetellKnowledgeBases] Creating Retell KB for ${knowledgeBase.name} with ${fileBlobs.length} files and ${validWebsiteUrls.length} URLs`);
      console.log(`[createRetellKnowledgeBases] Retell KB name: "${retellKbName}" (${retellKbName.length} chars)`);
      console.log(`[createRetellKnowledgeBases] API Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)} (${apiKey.length} chars)`);
      console.log(`[createRetellKnowledgeBases] File names:`, fileBlobs.map(f => f.name));
      console.log(`[createRetellKnowledgeBases] Website URLs:`, validWebsiteUrls);
      if (websiteUrls.length !== validWebsiteUrls.length) {
        console.warn(`[createRetellKnowledgeBases] Filtered out ${websiteUrls.length - validWebsiteUrls.length} invalid URLs`);
      }

      // Debug: Log FormData contents
      console.log(`[createRetellKnowledgeBases] FormData contents:`);
      for (const [key, value] of formData.entries()) {
        if (typeof value === 'object' && value !== null && 'size' in value) {
          console.log(`  ${key}: [File/Blob] ${value.constructor.name} (${(value as any).size} bytes)`);
        } else {
          console.log(`  ${key}: ${value}`);
        }
      }



      // Try creating the knowledge base
      // Test API key first with a simple request
      console.log(`[createRetellKnowledgeBases] Testing API key validity...`);
      try {
        const testResponse = await axios.get('https://api.retellai.com/list-knowledge-bases', {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
          timeout: 30000,
        });
        console.log(`[createRetellKnowledgeBases] ✅ API key test successful! Found ${testResponse.data?.length || 0} existing knowledge bases`);
      } catch (testError: any) {
        console.error(`[createRetellKnowledgeBases] ❌ API key test failed:`, {
          status: testError.response?.status,
          statusText: testError.response?.statusText,
          data: testError.response?.data,
          message: testError.message
        });

        if (testError.response?.status === 401) {
          throw new Error('Invalid Retell API key. Please check your API key configuration.');
        } else if (testError.response?.status === 403) {
          throw new Error('Retell API key does not have permission to access knowledge bases.');
        } else {
          console.warn(`[createRetellKnowledgeBases] API key test failed but continuing with knowledge base creation...`);
        }
      }

      console.log(`[createRetellKnowledgeBases] Attempting to create knowledge base...`);
      const response = await axios.post(
        'https://api.retellai.com/create-knowledge-base',
        formData,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            // Don't set Content-Type manually - let axios set it with proper boundary
          },
          timeout: 60000, // 60 second timeout
        }
      );

      console.log(`[createRetellKnowledgeBases] Success! Created knowledge base:`, response.data);

      console.log(`[createRetellKnowledgeBases] Retell API response status:`, response.status);
      console.log(`[createRetellKnowledgeBases] Retell API response data:`, response.data);

      if (response.data?.knowledge_base_id) {
        const retellKbId = response.data.knowledge_base_id;
        retellKnowledgeBaseIds.push(retellKbId);
        console.log(`[createRetellKnowledgeBases] Created Retell KB: ${retellKbId}`);

        // Save the provider mapping for future reuse
        try {
          await prisma.knowledgeBaseProviderMapping.create({
            data: {
              knowledgeBaseId: kbId,
              partnerId,
              customerId,
              provider: 'retell',
              providerKnowledgeBaseId: retellKbId,
              lastSyncedAt: new Date(),
              syncStatus: 'active',
            },
          });
          console.log(`[createRetellKnowledgeBases] Saved provider mapping for KB ${kbId} -> Retell KB ${retellKbId}`);
        } catch (mappingError) {
          console.error(`[createRetellKnowledgeBases] Failed to save provider mapping:`, mappingError);
          // Don't fail the entire process if mapping save fails
        }
      } else {
        console.warn(`[createRetellKnowledgeBases] No knowledge_base_id returned for ${knowledgeBase.name}`);
      }
    } catch (error: any) {
      console.error(`[createRetellKnowledgeBases] Error creating Retell KB for ${kbId}:`);
      console.error(`[createRetellKnowledgeBases] Error status:`, error.response?.status);
      console.error(`[createRetellKnowledgeBases] Error headers:`, error.response?.headers);
      console.error(`[createRetellKnowledgeBases] Error data:`, error.response?.data);
      console.error(`[createRetellKnowledgeBases] Error message:`, error.message);

      // Provide specific error messages based on the error type
      let errorMessage = 'Unknown error occurred';
      if (error.response?.status === 500) {
        errorMessage = 'Retell server error - this may be temporary. Please try again in a few minutes.';
      } else if (error.response?.status === 400) {
        errorMessage = 'Invalid knowledge base content. Please check your files and website URLs.';
      } else if (error.response?.status === 401) {
        errorMessage = 'Invalid Retell API key. Please check your API key configuration.';
      } else if (error.response?.status === 429) {
        errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        errorMessage = 'Network connection error. Please check your internet connection.';
      }

      // Throw error to stop the process instead of continuing
      throw new Error(`Failed to create knowledge base "${kbId}": ${errorMessage}`);
    }
  }

  return retellKnowledgeBaseIds;
}

export async function POST(req: NextRequest) {
  try {
    // Verify the partner JWT
    const decoded = await verifyPartnerJWT(req);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;

    // Get the partner
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId }
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    // Parse request body with error handling
    let requestData: CreateAgentRequest;
    try {
      requestData = await req.json();
      console.log('[create/route] Request data received:', {
        agentName: requestData.agentName,
        hasApiKey: !!requestData.apiKey,
        voiceId: requestData.voiceId,
        language: requestData.language
      });
    } catch (error) {
      console.error('[create/route] Error parsing JSON:', error);
      return NextResponse.json({
        error: 'Invalid JSON in request body'
      }, { status: 400 });
    }

    // Validate required fields
    if (!requestData.agentName || !requestData.generalPrompt || !requestData.voiceId || !requestData.apiKey) {
      return NextResponse.json({
        error: 'Missing required fields: agentName, generalPrompt, voiceId, apiKey'
      }, { status: 400 });
    }

    // Use the provided API key (agent-level)
    const apiKeyToUse = requestData.apiKey;
    console.log('[create/route] Creating agent:', requestData.agentName);

    // Step 1: Create LLM Engine
    // Transform function calls to Retell tools
    const retellTools = await transformFunctionCallsToRetellTools(
      requestData.functionCalls || [],
      partnerId,
      requestData.customerId || ''
    );

    console.log('[create/route] Generated Retell tools:', JSON.stringify(retellTools, null, 2));

    // Step 1.5: Create Retell knowledge bases if selected
    let retellKnowledgeBaseIds: string[] = [];
    if (requestData.knowledgeBaseIds && requestData.knowledgeBaseIds.length > 0 && requestData.customerId) {
      console.log('[create/route] Creating Retell knowledge bases for:', requestData.knowledgeBaseIds);
      try {
        retellKnowledgeBaseIds = await createRetellKnowledgeBases(
          requestData.knowledgeBaseIds,
          requestData.customerId,
          partnerId,
          apiKeyToUse
        );
        console.log('[create/route] Created Retell knowledge bases:', retellKnowledgeBaseIds);

        // Check if any knowledge bases were selected but none were created successfully
        if (requestData.knowledgeBaseIds.length > 0 && retellKnowledgeBaseIds.length === 0) {
          throw new Error('Failed to create any of the selected knowledge bases in Retell. Please check your knowledge base content and try again.');
        }

        // Check if some knowledge bases failed to create
        if (retellKnowledgeBaseIds.length < requestData.knowledgeBaseIds.length) {
          console.warn(`[create/route] Only ${retellKnowledgeBaseIds.length} out of ${requestData.knowledgeBaseIds.length} knowledge bases were created successfully`);
        }
      } catch (error) {
        console.error('[create/route] Knowledge base creation failed:', error);
        throw new Error(`Knowledge base creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    const llmPayload = {
      model: requestData.advancedSettings?.model || 'gpt-4o',
      model_temperature: requestData.advancedSettings?.modelTemperature || 0.2,
      model_high_priority: requestData.advancedSettings?.modelHighPriority || false,
      general_prompt: requestData.generalPrompt,
      begin_message: requestData.beginMessage || undefined,
      general_tools: retellTools,
      knowledge_base_ids: retellKnowledgeBaseIds.length > 0 ? retellKnowledgeBaseIds : undefined
    };

    // Add states for advanced agents
    if (requestData.agentType === 'advanced' && requestData.states && requestData.states.length > 0) {
      (llmPayload as any).states = requestData.states;
      (llmPayload as any).starting_state = requestData.startingState;
    }

    console.log('[create/route] Creating LLM with payload:', JSON.stringify(llmPayload, null, 2));

    let llmResponse;
    try {
      llmResponse = await axios.post(
        'https://api.retellai.com/create-retell-llm',
        llmPayload,
        {
          headers: {
            'Authorization': `Bearer ${apiKeyToUse}`,
            'Content-Type': 'application/json',
          },
        }
      );
      console.log('[create/route] LLM created successfully:', llmResponse.data.llm_id);
    } catch (error: any) {
      console.error('[create/route] Error creating LLM:', error.response?.data || error.message);
      throw new Error(`Failed to create Retell LLM: ${error.response?.data?.message || error.message}`);
    }

    const llmId = llmResponse.data.llm_id;
    if (!llmId) {
      throw new Error('No LLM ID returned from Retell API');
    }

    // Step 2: Create Agent with comprehensive Retell API support
    const agentPayload: any = {
      response_engine: {
        type: "retell-llm",
        llm_id: llmId,
      },
      agent_name: requestData.agentName,
      voice_id: requestData.voiceId,
      language: requestData.language || 'multi',
    };

    // Voice Control Settings
    if (requestData.voiceTemperature !== undefined) {
      agentPayload.voice_temperature = requestData.voiceTemperature;
    }
    if (requestData.voiceSpeed !== undefined) {
      agentPayload.voice_speed = requestData.voiceSpeed;
    }
    if (requestData.volume !== undefined) {
      agentPayload.volume = requestData.volume;
    }
    if (requestData.voiceModel) {
      agentPayload.voice_model = requestData.voiceModel;
    }
    if (requestData.fallbackVoiceIds && requestData.fallbackVoiceIds.length > 0) {
      agentPayload.fallback_voice_ids = requestData.fallbackVoiceIds;
    }

    // Conversation Control Settings
    if (requestData.responsiveness !== undefined) {
      agentPayload.responsiveness = requestData.responsiveness;
    }
    if (requestData.interruptionSensitivity !== undefined) {
      agentPayload.interruption_sensitivity = requestData.interruptionSensitivity;
    }

    // Call Management Settings
    if (requestData.endCallAfterSilenceMs !== undefined) {
      agentPayload.end_call_after_silence_ms = requestData.endCallAfterSilenceMs;
    }
    if (requestData.maxCallDurationMs !== undefined) {
      agentPayload.max_call_duration_ms = requestData.maxCallDurationMs;
    }
    if (requestData.reminderTriggerMs !== undefined) {
      agentPayload.reminder_trigger_ms = requestData.reminderTriggerMs;
    }
    if (requestData.reminderMaxCount !== undefined) {
      agentPayload.reminder_max_count = requestData.reminderMaxCount;
    }

    // Audio Enhancement Settings
    if (requestData.enableBackchannel !== undefined) {
      agentPayload.enable_backchannel = requestData.enableBackchannel;
    }
    if (requestData.backchannelFrequency !== undefined) {
      agentPayload.backchannel_frequency = requestData.backchannelFrequency;
    }
    if (requestData.backchannelWords && requestData.backchannelWords.length > 0) {
      agentPayload.backchannel_words = requestData.backchannelWords;
    }
    if (requestData.ambientSound) {
      agentPayload.ambient_sound = requestData.ambientSound;
    }
    if (requestData.ambientSoundVolume !== undefined) {
      agentPayload.ambient_sound_volume = requestData.ambientSoundVolume;
    }
    if (requestData.normalizeForSpeech !== undefined) {
      agentPayload.normalize_for_speech = requestData.normalizeForSpeech;
    }

    // Boosted Keywords
    if (requestData.boostedKeywords && requestData.boostedKeywords.length > 0) {
      agentPayload.boosted_keywords = requestData.boostedKeywords;
    }

    // Legacy support for advancedSettings (fallback)
    if (requestData.advancedSettings?.webhookUrl && requestData.advancedSettings.webhookUrl.trim() !== '') {
      agentPayload.webhook_url = requestData.advancedSettings.webhookUrl;
    }

    console.log('[create/route] Creating agent with payload:', JSON.stringify(agentPayload, null, 2));

    let agentResponse;
    try {
      agentResponse = await axios.post(
        'https://api.retellai.com/create-agent',
        agentPayload,
        {
          headers: {
            'Authorization': `Bearer ${apiKeyToUse}`,
            'Content-Type': 'application/json',
          },
        }
      );
      console.log('[create/route] Agent created successfully:', agentResponse.data.agent_id);
    } catch (error: any) {
      console.error('[create/route] Error creating Agent:', error.response?.data || error.message);
      throw new Error(`Failed to create Retell Agent: ${error.response?.data?.message || error.message}`);
    }

    const agentId = agentResponse.data.agent_id;
    if (!agentId) {
      throw new Error('No Agent ID returned from Retell API');
    }

    // Step 3: Store agent in database
    const voiceConfig = {
      speed: requestData.advancedSettings?.voiceSpeed || 1.0,
      temperature: requestData.advancedSettings?.voiceTemperature || 1.0,
      model: requestData.advancedSettings?.voiceModel || null,
    };

    const callConfig = {
      interruptionSensitivity: requestData.advancedSettings?.interruptionSensitivity || 0.7,
      enableBackchannel: requestData.advancedSettings?.enableBackchannel ?? true,
      normalizeForSpeech: requestData.advancedSettings?.normalizeForSpeech ?? true,
      maxCallDurationMs: requestData.advancedSettings?.maxCallDurationMs || 3600000,
      endCallAfterSilenceMs: requestData.advancedSettings?.endCallAfterSilenceMs || 600000,
    };

    // Step 4: Handle customer mapping (if customerId provided)
    let customerToConnect = null;
    if (requestData.customerId) {
      console.log('[create/route] Setting up customer mapping for Customer ID:', requestData.customerId);
      console.log('[create/route] Partner ID:', partnerId);

      // The modal sends Customer ID (from Customer table)
      // Find the UserOnboarding record that has this customerId and belongs to this partner
      const userOnboarding = await prisma.userOnboarding.findFirst({
        where: {
          customerId: requestData.customerId,
          partnerId: partnerId
        }
      });

      console.log('[create/route] UserOnboarding query result:', userOnboarding);

      if (!userOnboarding) {
        console.warn(`[create/route] No UserOnboarding record found for Customer ID ${requestData.customerId} and Partner ID ${partnerId}`);
        console.warn('[create/route] Continuing without customer mapping...');
        customerToConnect = null;
      } else {
        // Find the actual Customer record
        const customer = await prisma.customer.findUnique({
          where: {
            id: requestData.customerId
          }
        });

        if (!customer) {
          console.warn(`[create/route] Customer record not found for ID ${requestData.customerId}`);
          console.warn('[create/route] Continuing without customer mapping...');
          customerToConnect = null;
        } else {
          customerToConnect = customer;
          console.log('[create/route] Customer mapping ready:', customer.id);
        }
      }
    }

    // Encrypt the API key for storage
    const encryptedApiKey = await encrypt(requestData.apiKey);

    const newAgent = await prisma.retellAgent.create({
      data: {
        id: agentId,
        partnerId: partnerId,
        name: requestData.agentName,
        voiceId: requestData.voiceId,
        voiceModel: requestData.advancedSettings?.voiceModel || null,
        responseEngine: {
          type: "retell-llm",
          llm_id: llmId,
        },
        voiceConfig: voiceConfig,
        callConfig: callConfig,
        webhookUrl: requestData.advancedSettings?.webhookUrl || null,
        language: requestData.language || 'multi',
        recordingEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        profitMultiplier: 1.2, // Default profit multiplier
        // API key fields
        apiKey: encryptedApiKey,
        apiKeyStatus: 'valid', // Assume valid since we just used it successfully
        apiKeyLastVerified: new Date(),
        // Customer connection (if provided)
        customerId: customerToConnect?.id || null,
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    console.log('[create/route] Agent stored in database:', newAgent.id);

    // Step 5: Automatically register with analytics service and setup webhook
    let analyticsAgentId = null;
    let webhookUrl = null;

    try {
      console.log('[create/route] Registering agent with analytics service...');
      const analyticsResult = await registerAgentInAnalytics({
        agentId: newAgent.id,
        provider: 'retell',
        partnerId: partnerId,
        agentName: newAgent.name,
        customerId: customerToConnect?.id,
        profitMultiplier: newAgent.profitMultiplier,
      });

      if (analyticsResult.success && analyticsResult.analyticsAgentId) {
        analyticsAgentId = analyticsResult.analyticsAgentId;

        // Generate webhook URL
        webhookUrl = generateWebhookUrl({
          provider: 'retell',
          analyticsAgentId: analyticsAgentId,
        });

        // Update the agent with analytics info
        await prisma.retellAgent.update({
          where: { id: newAgent.id },
          data: {
            analyticsAgentId: analyticsAgentId,
            webhookUrl: webhookUrl,
            webhookEnabled: true,
            webhookMode: 'automatic',
            forwardToPreExisting: true,
          },
        });

        // Update the webhook URL in Retell API
        try {
          await axios.patch(
            `https://api.retellai.com/update-agent/${agentId}`,
            {
              webhook_url: webhookUrl,
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKeyToUse}`,
              },
            }
          );

          console.log('[create/route] Webhook URL updated in Retell API');
        } catch (webhookError: any) {
          console.error('[create/route] Failed to update webhook URL in Retell API:', webhookError.response?.data || webhookError.message);
          // Non-blocking - continue even if webhook update fails
        }

        console.log('[create/route] Analytics registration successful:', analyticsAgentId);
      } else {
        console.warn('[create/route] Analytics registration failed, continuing without webhook');
      }
    } catch (analyticsError) {
      console.error('[create/route] Error setting up analytics/webhook:', analyticsError);
      // Non-blocking - continue even if analytics setup fails
    }

    // Return the agent in the same format as the retell-agents endpoint
    const createdAgent = {
      id: newAgent.id,
      name: newAgent.name,
      voiceId: newAgent.voiceId,
      voiceModel: newAgent.voiceModel,
      customerId: newAgent.customerId,
      customer: newAgent.customer,
      profitMultiplier: newAgent.profitMultiplier,
      responseEngine: newAgent.responseEngine,
      voiceConfig: newAgent.voiceConfig,
      callConfig: newAgent.callConfig,
      analyticsAgentId: analyticsAgentId || newAgent.analyticsAgentId,
      webhookUrl: webhookUrl || newAgent.webhookUrl,
      webhookEnabled: analyticsAgentId ? true : false,
      webhookMode: analyticsAgentId ? 'automatic' : 'manual',
      preExistingWebhookUrl: null,
      forwardToPreExisting: true,
      apiKeyStatus: newAgent.apiKeyStatus,
      apiKeyLastVerified: newAgent.apiKeyLastVerified?.toISOString() || null,
      apiKeyErrorMessage: newAgent.apiKeyErrorMessage,
      usingPartnerKey: false, // This agent has its own API key
      hasPartnerKeyFallback: !!partner.retellApiKey,
      language: newAgent.language,
      recordingEnabled: newAgent.recordingEnabled,
      importedAt: newAgent.importedAt,
      lastSyncedAt: newAgent.lastSyncedAt,
      createdAt: newAgent.createdAt,
      updatedAt: newAgent.updatedAt,
      isActive: newAgent.isActive,
      apiKey: undefined // Don't expose the actual API key
    };

    return NextResponse.json({
      success: true,
      agent: createdAgent,
      message: 'Agent created successfully'
    });

  } catch (error: any) {
    console.error('[create/route] Error creating agent:', error);

    // Handle specific error types
    if (error.message.includes('quota') || error.message.includes('Trial over') || error.message.includes('add payment')) {
      return NextResponse.json({
        error: 'quota_exceeded',
        message: 'Your Retell account has reached its usage limit. Please upgrade your plan to continue.',
      }, { status: 403 });
    }

    if (error.message.includes('Invalid API key')) {
      return NextResponse.json({
        error: 'invalid_api_key',
        message: 'Your Retell API key appears to be invalid. Please check your settings.',
      }, { status: 401 });
    }

    return NextResponse.json({
      error: 'creation_failed',
      message: error.message || 'Failed to create agent. Please try again.',
    }, { status: 500 });
  }
}
