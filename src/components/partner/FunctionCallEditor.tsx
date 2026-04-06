'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { FiX, FiSave, FiLoader, FiSettings, FiCode, FiInfo, FiCheck } from 'react-icons/fi';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { GHLCalendarSelector } from './GHLCalendarSelector';
import { GHLUserSelector } from './GHLUserSelector';
import { KnowledgeBaseSelector } from './KnowledgeBaseSelector';

interface FunctionCall {
  id?: string;
  appName: string;
  toolName: string;
  customName: string;
  customDescription: string;
  isConfigured?: boolean;
  webhookUrl?: string;
  parameterValues?: Record<string, any>; // Store pre-filled parameter values
  parameters?: {
    type: "object";
    properties: Record<string, any>;
    required: string[];
  }; // JSON schema for Retell
  // Retell-specific execution settings
  speakDuringExecution?: boolean;
  speakAfterExecution?: boolean;
  executionMessageDescription?: string;
  timeoutMs?: number;
  // GHL-specific settings
  calendarId?: string;
  calendarName?: string;
  userId?: string;
  userName?: string;
}

interface FunctionCallEditorProps {
  isOpen: boolean;
  onClose: () => void;
  functionCall: FunctionCall;
  onSave: (functionCall: FunctionCall) => void;
  customerId: string;
}

const functionCallSchema = z.object({
  customName: z.string()
    .min(1, 'Function name is required')
    .max(50, 'Function name must be less than 50 characters')
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Function name must be a valid identifier (letters, numbers, underscores only, cannot start with number)'),
  customDescription: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description must be less than 500 characters')
});

type FunctionCallFormData = z.infer<typeof functionCallSchema>;

const FunctionCallEditor: React.FC<FunctionCallEditorProps> = ({
  isOpen,
  onClose,
  functionCall,
  onSave,
  customerId
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [toolSchema, setToolSchema] = useState<any>(null);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [parameterValues, setParameterValues] = useState<Record<string, any>>(() => {
    const saved = functionCall.parameterValues || {};
    // Backward compat: seed assignedUserId from userId if not already in parameterValues
    if (functionCall.userId && !saved.assignedUserId) {
      return { ...saved, assignedUserId: functionCall.userId };
    }
    return saved;
  });

  // Execution settings state
  const [speakDuringExecution, setSpeakDuringExecution] = useState<boolean>(
    functionCall.speakDuringExecution ?? true
  );
  const [speakAfterExecution, setSpeakAfterExecution] = useState<boolean>(
    functionCall.speakAfterExecution ?? true
  );
  const [executionMessageDescription, setExecutionMessageDescription] = useState<string>(
    functionCall.executionMessageDescription || ''
  );
  const [timeoutMs, setTimeoutMs] = useState<number>(
    functionCall.timeoutMs || 30000
  );

  // GHL calendar selection state
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>(
    functionCall.calendarId || ''
  );
  const [selectedCalendarName, setSelectedCalendarName] = useState<string>(
    functionCall.calendarName || ''
  );

  // GHL user selection state
  const [selectedUserId, setSelectedUserId] = useState<string>(
    functionCall.userId || ''
  );
  const [selectedUserName, setSelectedUserName] = useState<string>(
    functionCall.userName || ''
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    reset,
    watch
  } = useForm<FunctionCallFormData>({
    resolver: zodResolver(functionCallSchema),
    defaultValues: {
      customName: functionCall.customName,
      customDescription: functionCall.customDescription
    },
    mode: 'onChange'
  });

  const watchedValues = watch();

  // Load tool schema when modal opens
  useEffect(() => {
    if (isOpen && functionCall.appName && functionCall.toolName) {
      loadToolSchema();
    }
  }, [isOpen, functionCall.appName, functionCall.toolName]);

  // Reset form when functionCall changes
  useEffect(() => {
    reset({
      customName: functionCall.customName,
      customDescription: functionCall.customDescription
    });

    // Only reset parameter values if we don't have a schema loaded yet
    // This prevents overriding defaults that were set by loadToolSchema
    if (!toolSchema) {
      const saved = functionCall.parameterValues || {};
      // Backward compat: seed assignedUserId from userId if not already in parameterValues
      if (functionCall.userId && !saved.assignedUserId) {
        setParameterValues({ ...saved, assignedUserId: functionCall.userId });
      } else {
        setParameterValues(saved);
      }
    }

    setSpeakDuringExecution(functionCall.speakDuringExecution ?? true);
    setSpeakAfterExecution(functionCall.speakAfterExecution ?? true);
    setExecutionMessageDescription(functionCall.executionMessageDescription || '');
    setTimeoutMs(functionCall.timeoutMs || 30000);
    setSelectedCalendarId(functionCall.calendarId || '');
    setSelectedCalendarName(functionCall.calendarName || '');
    setSelectedUserId(functionCall.userId || '');
    setSelectedUserName(functionCall.userName || '');
  }, [functionCall, reset, toolSchema]);

  const loadGHLLocationId = async (defaultValues: Record<string, any>) => {
    try {
      console.log('🔍 Loading GHL LocationId for customer:', customerId);
      const token = localStorage.getItem('partner_token');
      if (!token) {
        console.log('🔍 No partner token found');
        return;
      }

      // Get GHL locations for the customer
      const response = await fetch(
        `/api/partner/customers/${customerId}/ghl/locations`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      console.log('🔍 GHL locations API response:', response.status, response.ok);

      if (response.ok) {
        const data = await response.json();
        console.log('🔍 GHL locations data:', data);
        const locations = data.locations || [];

        // Use the first location's ID as default (most customers have one location)
        if (locations.length > 0) {
          defaultValues.locationId = locations[0].id;
          console.log('🔍 GHL LocationId loaded:', locations[0].id);
        } else {
          console.log('🔍 No GHL locations found for customer');
        }
      } else {
        const errorText = await response.text();
        console.log('🔍 GHL locations API error:', errorText);
      }
    } catch (error) {
      console.error('🔍 Failed to load GHL locationId:', error);
      // Don't throw - this is optional enhancement
    }
  };

  const loadToolSchema = async () => {
    setLoadingSchema(true);
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch(
        `/api/partner/customers/${customerId}/tool-schemas?appName=${functionCall.appName}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load tool schema');
      }

      const data = await response.json();
      const appTools = data.data[functionCall.appName] || [];
      const schema = appTools.find((tool: any) => tool.toolName === functionCall.toolName);



      setToolSchema(schema);

      // Initialize parameter values with defaults from schema
      if (schema?.inputSchema?.properties) {
        const defaultValues: Record<string, any> = {};
        Object.entries(schema.inputSchema.properties).forEach(([paramName, paramDef]: [string, any]) => {
          if (paramDef.default !== undefined) {
            defaultValues[paramName] = paramDef.default;
          }
        });

        // For GHL tools, fetch the customer's locationId
        if (functionCall.appName === 'ghl') {
          await loadGHLLocationId(defaultValues);
        }

        // Merge defaults with existing values, prioritizing defaults for empty values
        setParameterValues(prev => {
          const existingValues = functionCall.parameterValues || {};
          const newValues = { ...existingValues };

          Object.entries(defaultValues).forEach(([paramName, defaultValue]) => {
            // Set default if no existing value or existing value is empty
            if (!newValues[paramName] || newValues[paramName] === '') {
              newValues[paramName] = defaultValue;
            }
          });

          console.log('🔍 Final parameterValues after merge:', newValues);
          console.log('🔍 DefaultValues used for merge:', defaultValues);

          return newValues;
        });
      }
    } catch (error) {
      console.error('Error loading tool schema:', error);
      toast.error('Failed to load tool details');
    } finally {
      setLoadingSchema(false);
    }
  };

  const onSubmit = async (data: FunctionCallFormData, event?: React.FormEvent) => {
    // Prevent the form submission from bubbling up to parent forms
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    setIsLoading(true);
    try {
      // Generate the Retell function schema with parameter values
      const retellFunctionSchema = generateRetellFunction();



      const updatedFunctionCall: FunctionCall = {
        ...functionCall,
        customName: data.customName,
        customDescription: data.customDescription,
        parameterValues: parameterValues,
        parameters: retellFunctionSchema?.parameters || {
          type: "object" as const,
          properties: {},
          required: []
        },
        speakDuringExecution: speakDuringExecution,
        speakAfterExecution: speakAfterExecution,
        executionMessageDescription: executionMessageDescription,
        timeoutMs: timeoutMs,
        calendarId: selectedCalendarId,
        calendarName: selectedCalendarName,
        userId: selectedUserId,
        userName: selectedUserName,
        isConfigured: true
      };

      onSave(updatedFunctionCall);
    } catch (error) {
      console.error('Error saving function call:', error);
      toast.error('Failed to save function call');
    } finally {
      setIsLoading(false);
    }
  };

  const getAppIcon = (appName: string) => {
    const iconMap: Record<string, string> = {
      gmail: '📧',
      slack: '💬',
      notion: '📝',
      airtable: '📊',
      hubspot: '🏢',
      salesforce: '☁️',
      shopify: '🛍️',
      googlecalendar: '📅'
    };
    return iconMap[appName.toLowerCase()] || '🔧';
  };

  const generateRetellFunction = () => {
    if (!toolSchema || !watchedValues.customName || !watchedValues.customDescription) {
      return null;
    }

    // Truncate description to meet Retell's 1024 character limit
    const maxDescriptionLength = 1024;
    let description = watchedValues.customDescription;

    if (description.length > maxDescriptionLength) {
      description = description.substring(0, maxDescriptionLength - 3) + '...';
    }

    return {
      name: watchedValues.customName,
      description: description,
      parameters: transformSchemaToRetellFormat(toolSchema.inputSchema || {})
    };
  };

  const transformSchemaToRetellFormat = (inputSchema: any) => {
    // Handle case where inputSchema is null/undefined
    if (!inputSchema) {
      return {
        type: "object" as const,
        properties: {},
        required: []
      };
    }

    // Handle case where inputSchema doesn't have properties (empty schema)
    if (!inputSchema.properties) {
      return {
        type: "object" as const,
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

      // Add pre-filled default value if configured
      if (parameterValues[key] !== undefined && parameterValues[key] !== '') {
        properties[key].default = parameterValues[key];
        console.log(`🔍 Added default value for ${key}:`, parameterValues[key]);
      } else {
        console.log(`🔍 No default value for ${key}:`, {
          value: parameterValues[key],
          hasKey: key in parameterValues,
          allParameterValues: parameterValues
        });
      }

      if (propDef.enum) {
        properties[key].enum = propDef.enum;
      }

      if (propDef.format) {
        properties[key].format = propDef.format;
      }

      if (propDef.type === 'array' && propDef.items) {
        properties[key].items = {
          type: propDef.items.type || 'string',
          description: propDef.items.description
        };
      }
    }

    const finalSchema = {
      type: "object" as const,
      properties,
      required
    };

    console.log('🔍 Final schema being returned:', finalSchema);
    console.log('🔍 ParameterValues at schema creation:', parameterValues);

    return finalSchema;
  };

  // Helper function to render form field based on parameter type
  const renderParameterField = (paramName: string, paramDef: any) => {
    // Use default value if available, otherwise use current parameter value or empty string
    const value = parameterValues[paramName] || paramDef.default || '';
    const isRequired = toolSchema?.inputSchema?.required?.includes(paramName);

    const updateParameterValue = (newValue: any) => {
      setParameterValues(prev => ({
        ...prev,
        [paramName]: newValue
      }));
    };

    // Special handling for EMAIL_SEND_NOTIFICATION tool parameters
    if (functionCall.appName === 'internal' && functionCall.toolName === 'EMAIL_SEND_NOTIFICATION') {
      // Template selection with preview
      if (paramName === 'template') {
        return (
          <div key={paramName} className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
              Email Template {isRequired && <span className="text-red-400">*</span>}
            </label>
            <select
              value={value}
              onChange={(e) => updateParameterValue(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">Select Template</option>
              <option value="agent_call_notification">Agent Call Notification</option>
              <option value="simple_notification">Simple Notification</option>
              <option value="business_alert">Business Alert</option>
              <option value="custom">Custom Email</option>
            </select>
            {value === 'agent_call_notification' && (
              <div className="mt-2 p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg">
                <p className="text-xs text-blue-300 font-medium">Template Preview:</p>
                <p className="text-xs text-blue-200 mt-1">
                  Subject: "Your Agent Has Picked Up a Call"<br/>
                  Automatically includes agent name, call duration, summary, and next steps.
                </p>
              </div>
            )}
            {value === 'simple_notification' && (
              <div className="mt-2 p-3 bg-green-900/20 border border-green-700/50 rounded-lg">
                <p className="text-xs text-green-300 font-medium">Template Preview:</p>
                <p className="text-xs text-green-200 mt-1">
                  Subject: "AI Agent Notification"<br/>
                  Clean notification without personal addressing. Includes notification title, timestamp, and action required.
                </p>
              </div>
            )}
            {value === 'business_alert' && (
              <div className="mt-2 p-3 bg-orange-900/20 border border-orange-700/50 rounded-lg">
                <p className="text-xs text-orange-300 font-medium">Template Preview:</p>
                <p className="text-xs text-orange-200 mt-1">
                  Subject: "Business Alert"<br/>
                  Professional business alert with alert type, priority, affected system, and resolution steps.
                </p>
              </div>
            )}
            {value === 'custom' && (
              <div className="mt-2 p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
                <p className="text-xs text-yellow-300 font-medium">Custom Template:</p>
                <p className="text-xs text-yellow-200 mt-1">
                  You'll need to provide the subject and message body for this template.
                </p>
              </div>
            )}
            {paramDef.description && (
              <p className="text-xs text-gray-500">{paramDef.description}</p>
            )}
          </div>
        );
      }

      // Message body with enhanced textarea for custom template
      if (paramName === 'message_body') {
        return (
          <div key={paramName} className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
              Message Body {isRequired && <span className="text-red-400">*</span>}
            </label>
            <textarea
              value={value}
              onChange={(e) => updateParameterValue(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              placeholder="Enter the email message content. This will be sent to the recipient."
            />
            <div className="text-xs text-gray-400">
              <p>💡 <strong>Tip:</strong> This content will be included in the email template.</p>
              <p>For "Agent Call Notification" template, this appears as additional details.</p>
              <p>For "Custom" template, this is the main email content.</p>
            </div>
            {paramDef.description && (
              <p className="text-xs text-gray-500">{paramDef.description}</p>
            )}
          </div>
        );
      }

      // Variables object with helper UI
      if (paramName === 'variables') {
        return (
          <div key={paramName} className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
              Template Variables {isRequired && <span className="text-red-400">*</span>}
            </label>
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Agent Name</label>
                  <input
                    type="text"
                    value={value?.agent_name || ''}
                    onChange={(e) => updateParameterValue({...value, agent_name: e.target.value})}
                    className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    placeholder="e.g., Customer Support Agent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Call Duration</label>
                  <input
                    type="text"
                    value={value?.call_duration || ''}
                    onChange={(e) => updateParameterValue({...value, call_duration: e.target.value})}
                    className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    placeholder="e.g., 5 minutes"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Call Summary</label>
                <textarea
                  value={value?.call_summary || ''}
                  onChange={(e) => updateParameterValue({...value, call_summary: e.target.value})}
                  rows={2}
                  className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500 resize-none"
                  placeholder="Brief summary of what was discussed during the call"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Next Steps</label>
                <textarea
                  value={value?.next_steps || ''}
                  onChange={(e) => updateParameterValue({...value, next_steps: e.target.value})}
                  rows={2}
                  className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500 resize-none"
                  placeholder="Recommended actions or follow-up steps"
                />
              </div>
            </div>
            <div className="text-xs text-gray-400">
              <p>💡 <strong>Note:</strong> These variables will be dynamically inserted into the email template.</p>
              <p>Leave fields empty if they will be provided by the agent at runtime.</p>
            </div>
            {paramDef.description && (
              <p className="text-xs text-gray-500">{paramDef.description}</p>
            )}
          </div>
        );
      }

      // Send to both customer and partner checkbox
      if (paramName === 'send_to_both') {
        return (
          <div key={paramName} className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id={`send_to_both_${functionCall.id}`}
                checked={value || false}
                onChange={(e) => updateParameterValue(e.target.checked)}
                className="w-4 h-4 text-green-600 bg-gray-800 border-gray-600 rounded focus:ring-green-500 focus:ring-2"
              />
              <label htmlFor={`send_to_both_${functionCall.id}`} className="text-sm font-medium text-gray-300">
                Send to both customer and partner
              </label>
            </div>
            <div className="text-xs text-gray-400">
              <p>💡 When enabled, the email will be sent to both the customer and the partner's email address.</p>
              <p>This is useful for keeping partners informed about agent activities.</p>
            </div>
            {paramDef.description && (
              <p className="text-xs text-gray-500">{paramDef.description}</p>
            )}
          </div>
        );
      }
    }

    // Special handling for GHL calendarId parameter - show calendar selector instead of text input
    if (paramName === 'calendarId' && functionCall.appName === 'ghl') {
      return (
        <div key={paramName} className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            {paramName} {isRequired && <span className="text-red-400">*</span>}
          </label>
          <GHLCalendarSelector
            customerId={customerId}
            selectedCalendarId={value}
            onCalendarSelect={(calendarId, calendarName) => {
              updateParameterValue(calendarId);
            }}
          />
          {paramDef.description && (
            <p className="text-xs text-gray-500">{paramDef.description}</p>
          )}
        </div>
      );
    }

    // Special handling for GHL assignedUserId parameter - show user selector
    if (paramName === 'assignedUserId' && functionCall.appName === 'ghl') {
      return (
        <div key={paramName} className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            {paramName} {isRequired && <span className="text-red-400">*</span>}
          </label>
          <GHLUserSelector
            customerId={customerId}
            selectedUserId={value}
            onUserSelect={(userId, userName) => {
              updateParameterValue(userId);
            }}
          />
          {paramDef.description && (
            <p className="text-xs text-gray-500">{paramDef.description}</p>
          )}
        </div>
      );
    }

    // Special handling for GHL locationId parameter - show as read-only with pre-filled value
    if (paramName === 'locationId' && functionCall.appName === 'ghl') {
      return (
        <div key={paramName} className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            {paramName} {isRequired && <span className="text-red-400">*</span>}
          </label>
          <div className="relative">
            <input
              type="text"
              value={value}
              readOnly
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-300 cursor-not-allowed"
              placeholder={value ? value : "Location ID will be automatically filled"}
            />
            {value && (
              <div className="absolute right-2 top-2 text-green-400">
                <FiCheck className="w-4 h-4" />
              </div>
            )}
          </div>
          <p className="text-xs text-green-400">
            ✓ GHL Location ID (automatically filled from your connected location)
          </p>
        </div>
      );
    }

    // Special handling for knowledge_base_id parameter - show knowledge base selector
    if (paramName === 'knowledge_base_id' && functionCall.appName === 'internal' && functionCall.toolName === 'KNOWLEDGE_BASE_QUERY') {
      return (
        <div key={paramName} className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            Knowledge Base {isRequired && <span className="text-red-400">*</span>}
          </label>
          <KnowledgeBaseSelector
            customerId={customerId}
            selectedKnowledgeBaseId={value}
            onKnowledgeBaseSelect={(kbId, kbName) => {
              updateParameterValue(kbId);
            }}
            autoSelectIfSingle={true}
          />
          {paramDef.description && (
            <p className="text-xs text-gray-500">{paramDef.description}</p>
          )}
          <p className="text-xs text-gray-400">
            💡 Select the knowledge base to query. If not specified, the customer&apos;s default knowledge base will be used.
          </p>
        </div>
      );
    }

    // Handle different parameter types
    if (paramDef.type === 'boolean') {
      return (
        <div key={paramName} className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={value === true}
              onChange={(e) => updateParameterValue(e.target.checked)}
              className="w-4 h-4 text-green-600 bg-gray-800 border-gray-600 rounded focus:ring-green-500"
            />
            <span className="text-sm font-medium text-gray-300">
              {paramName} {isRequired && <span className="text-red-400">*</span>}
            </span>
          </label>
          {paramDef.description && (
            <p className="text-xs text-gray-500 ml-6">{paramDef.description}</p>
          )}
        </div>
      );
    }

    if (paramDef.enum && Array.isArray(paramDef.enum)) {
      return (
        <div key={paramName} className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            {paramName} {isRequired && <span className="text-red-400">*</span>}
          </label>
          <select
            value={value}
            onChange={(e) => updateParameterValue(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Select {paramName}</option>
            {paramDef.enum.map((option: any) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {paramDef.description && (
            <p className="text-xs text-gray-500">{paramDef.description}</p>
          )}
        </div>
      );
    }

    if (paramDef.type === 'number' || paramDef.type === 'integer') {
      return (
        <div key={paramName} className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            {paramName} {isRequired && <span className="text-red-400">*</span>}
          </label>
          <input
            type="number"
            value={value}
            onChange={(e) => updateParameterValue(e.target.value ? Number(e.target.value) : '')}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder={`Enter ${paramName}`}
          />
          {paramDef.description && (
            <p className="text-xs text-gray-500">{paramDef.description}</p>
          )}
        </div>
      );
    }

    // Handle array types
    if (paramDef.type === 'array') {
      return (
        <div key={paramName} className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            {paramName} {isRequired && <span className="text-red-400">*</span>}
          </label>
          <textarea
            value={Array.isArray(value) ? value.join('\n') : value}
            onChange={(e) => {
              const lines = e.target.value.split('\n').filter(line => line.trim());
              updateParameterValue(lines);
            }}
            rows={3}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            placeholder={`Enter ${paramName} (one per line)`}
          />
          {paramDef.description && (
            <p className="text-xs text-gray-500">{paramDef.description}</p>
          )}
          <p className="text-xs text-gray-400">Enter one item per line</p>
        </div>
      );
    }

    // Handle object types (like headers)
    if (paramDef.type === 'object') {
      return (
        <div key={paramName} className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            {paramName} {isRequired && <span className="text-red-400">*</span>}
          </label>
          <textarea
            value={typeof value === 'object' && value !== null ? JSON.stringify(value, null, 2) : value || ''}
            onChange={(e) => {
              try {
                const parsed = e.target.value.trim() ? JSON.parse(e.target.value) : null;
                updateParameterValue(parsed);
              } catch (error) {
                // Keep the raw string value if JSON is invalid
                updateParameterValue(e.target.value);
              }
            }}
            rows={4}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 resize-none font-mono text-sm"
            placeholder={`Enter ${paramName} as JSON (e.g., {"key": "value"})`}
          />
          {paramDef.description && (
            <p className="text-xs text-gray-500">{paramDef.description}</p>
          )}
          <p className="text-xs text-gray-400">Enter valid JSON format</p>
        </div>
      );
    }

    // Default to text input for strings and other types
    const inputType = paramDef.format === 'email' ? 'email' :
                     paramDef.format === 'uri' ? 'url' :
                     paramDef.format === 'date-time' ? 'datetime-local' :
                     'text';

    return (
      <div key={paramName} className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">
          {paramName} {isRequired && <span className="text-red-400">*</span>}
        </label>
        {paramDef.description && paramDef.description.length > 100 ? (
          <textarea
            value={value}
            onChange={(e) => updateParameterValue(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            placeholder={`Enter ${paramName}`}
          />
        ) : (
          <input
            type={inputType}
            value={value}
            onChange={(e) => updateParameterValue(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder={`Enter ${paramName}`}
          />
        )}
        {paramDef.description && (
          <p className="text-xs text-gray-500">{paramDef.description}</p>
        )}
        {paramDef.examples && paramDef.examples.length > 0 && (
          <p className="text-xs text-gray-400">
            Example: {(() => {
              const example = Array.isArray(paramDef.examples) ? paramDef.examples[0] : paramDef.examples;
              return typeof example === 'object' && example !== null
                ? JSON.stringify(example, null, 2)
                : example;
            })()}
          </p>
        )}
      </div>
    );
  };

  const retellFunction = generateRetellFunction();

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-gray-900 border border-gray-700 text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{getAppIcon(functionCall.appName)}</div>
                    <div>
                      <Dialog.Title className="text-xl font-semibold text-white">
                        Configure Function Call
                      </Dialog.Title>
                      <p className="text-sm text-gray-400 mt-1">
                        {functionCall.appName} • {functionCall.toolName}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <FiX className="w-5 h-5" />
                  </button>
                </div>

                {/* Content */}
                <form onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSubmit((data) => onSubmit(data, e))(e);
                }} className="flex flex-col h-[600px]">
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Tool Information */}
                    {loadingSchema ? (
                      <div className="flex items-center gap-3 p-4 bg-gray-800 rounded-lg">
                        <FiLoader className="w-5 h-5 animate-spin text-gray-400" />
                        <span className="text-gray-400">Loading tool details...</span>
                      </div>
                    ) : toolSchema && (
                      <div className="p-4 bg-gray-800 rounded-lg">
                        <div className="flex items-center gap-2 mb-3">
                          <FiInfo className="w-4 h-4 text-blue-400" />
                          <h3 className="font-medium text-white">Tool Information</h3>
                        </div>
                        <p className="text-sm text-gray-300">{toolSchema.description}</p>
                        {toolSchema.category && (
                          <span className="inline-block mt-2 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                            {toolSchema.category}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Function Configuration */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <FiSettings className="w-4 h-4 text-green-400" />
                        <h3 className="font-medium text-white">Function Configuration</h3>
                      </div>

                      {/* Custom Name */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Function Name *
                        </label>
                        <input
                          {...register('customName')}
                          type="text"
                          className={clsx(
                            "w-full px-3 py-2 bg-gray-800 border rounded-lg text-white focus:outline-none focus:ring-2",
                            errors.customName
                              ? "border-red-500 focus:ring-red-500"
                              : "border-gray-600 focus:ring-green-500 focus:border-green-500"
                          )}
                          placeholder="e.g., send_email_to_customer"
                        />
                        {errors.customName && (
                          <p className="mt-1 text-sm text-red-400">{errors.customName.message}</p>
                        )}
                        <p className="mt-1 text-xs text-gray-500">
                          This is the function name that will be available to your AI agent
                        </p>
                      </div>

                      {/* Custom Description */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Function Description *
                        </label>
                        <textarea
                          {...register('customDescription')}
                          rows={3}
                          className={clsx(
                            "w-full px-3 py-2 bg-gray-800 border rounded-lg text-white focus:outline-none focus:ring-2 resize-none",
                            errors.customDescription
                              ? "border-red-500 focus:ring-red-500"
                              : "border-gray-600 focus:ring-green-500 focus:border-green-500"
                          )}
                          placeholder="Describe what this function does and when the AI should use it..."
                        />
                        {errors.customDescription && (
                          <p className="mt-1 text-sm text-red-400">{errors.customDescription.message}</p>
                        )}
                        <div className="mt-1 flex justify-between items-start">
                          <p className="text-xs text-gray-500">
                            Clear description helps the AI understand when and how to use this function
                          </p>
                          <div className="text-xs">
                            {(() => {
                              const currentLength = watchedValues.customDescription?.length || 0;
                              const maxLength = 1024;
                              const isNearLimit = currentLength > maxLength * 0.8;
                              const isOverLimit = currentLength > maxLength;

                              return (
                                <span className={clsx(
                                  isOverLimit ? "text-red-400" :
                                  isNearLimit ? "text-yellow-400" :
                                  "text-gray-500"
                                )}>
                                  {currentLength}/{maxLength}
                                  {isOverLimit && " (will be truncated)"}
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* GHL Calendar Selection */}
                    {functionCall.appName === 'ghl' && toolSchema?.requiresCalendarSelection && (
                      <div className="space-y-4 p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
                        <div className="flex items-center gap-2">
                          <FiSettings className="w-4 h-4 text-indigo-400" />
                          <h3 className="font-medium text-indigo-300">GHL Configuration</h3>
                        </div>

                        <GHLCalendarSelector
                          customerId={customerId}
                          selectedCalendarId={selectedCalendarId}
                          onCalendarSelect={(calendarId, calendarName) => {
                            setSelectedCalendarId(calendarId);
                            setSelectedCalendarName(calendarName);
                          }}
                        />

                        {selectedCalendarId && (
                          <div className="text-xs text-indigo-300">
                            ✓ This tool will use the selected calendar for all operations.
                          </div>
                        )}
                      </div>
                    )}

                    {/* GHL User Selection */}
                    {functionCall.appName === 'ghl' && toolSchema?.requiresUserSelection && (
                      <div className="space-y-4 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                        <div className="flex items-center gap-2">
                          <FiSettings className="w-4 h-4 text-purple-400" />
                          <h3 className="font-medium text-purple-300">GHL Staff Assignment</h3>
                        </div>

                        <GHLUserSelector
                          customerId={customerId}
                          selectedUserId={selectedUserId}
                          onUserSelect={(userId, userName) => {
                            setSelectedUserId(userId);
                            setSelectedUserName(userName);
                            // Also sync parameterValues so transformSchemaToRetellFormat
                            // bakes assignedUserId as a default value in the Retell schema
                            setParameterValues(prev => ({
                              ...prev,
                              assignedUserId: userId
                            }));
                          }}
                        />

                        {selectedUserId && (
                          <div className="text-xs text-purple-300">
                            ✓ Appointments will be assigned to the selected staff member.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Parameter Configuration */}
                    {toolSchema?.inputSchema?.properties && Object.keys(toolSchema.inputSchema.properties).length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <FiSettings className="w-4 h-4 text-blue-400" />
                          <h3 className="font-medium text-white">Parameter Configuration</h3>
                        </div>
                        <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                          <div className="mb-4">
                            <p className="text-sm text-gray-400 mb-2">
                              Configure default values for parameters. These will be pre-filled when the AI calls this function.
                            </p>
                            <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                              <FiInfo className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                              <div className="text-xs text-blue-300">
                                <p className="font-medium mb-1">Pro Tip:</p>
                                <p>Pre-fill values like calendar_id, timezone, or default settings that should be consistent across all calls. Leave dynamic fields (like event title, description) empty for the AI to fill.</p>
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.entries(toolSchema.inputSchema.properties).map(([paramName, paramDef]) =>
                              renderParameterField(paramName, paramDef as any)
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Execution Settings */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <FiSettings className="w-4 h-4 text-purple-400" />
                        <h3 className="font-medium text-white">Execution Settings</h3>
                      </div>
                      <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700 space-y-4">
                        <div className="mb-4">
                          <p className="text-sm text-gray-400 mb-2">
                            Configure how the AI agent behaves when executing this function.
                          </p>
                          <div className="flex items-start gap-2 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                            <FiInfo className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                            <div className="text-xs text-purple-300">
                              <p className="font-medium mb-1">Execution Tips:</p>
                              <p>Enable "speak during execution" for functions that take time (more than 2s). This keeps the conversation flowing while the function runs.</p>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={speakDuringExecution}
                              onChange={(e) => setSpeakDuringExecution(e.target.checked)}
                              className="w-4 h-4 text-purple-600 bg-gray-800 border-gray-600 rounded focus:ring-purple-500"
                            />
                            <span className="text-sm text-gray-300">Speak during execution</span>
                          </label>

                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={speakAfterExecution}
                              onChange={(e) => setSpeakAfterExecution(e.target.checked)}
                              className="w-4 h-4 text-purple-600 bg-gray-800 border-gray-600 rounded focus:ring-purple-500"
                            />
                            <span className="text-sm text-gray-300">Speak after execution</span>
                          </label>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Execution Message Description
                          </label>
                          <textarea
                            value={executionMessageDescription}
                            onChange={(e) => setExecutionMessageDescription(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                            placeholder="What the agent should say while executing this function..."
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Example: "Let me check your calendar availability" or "I'm sending that email for you now"
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Timeout (milliseconds)
                          </label>
                          <input
                            type="number"
                            value={timeoutMs}
                            onChange={(e) => setTimeoutMs(Number(e.target.value))}
                            min={1000}
                            max={600000}
                            step={1000}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Function timeout (1s - 10min). Default: 30s
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Retell Function Preview */}
                    {retellFunction && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <FiCode className="w-4 h-4 text-purple-400" />
                          <h3 className="font-medium text-white">Retell Function Preview</h3>
                        </div>
                        <div className="p-4 bg-gray-800 rounded-lg border border-gray-600">
                          <pre className="text-sm text-gray-300 whitespace-pre-wrap overflow-x-auto">
                            {JSON.stringify(retellFunction, null, 2)}
                          </pre>
                        </div>
                        <div className="flex items-start gap-2 text-xs text-gray-500">
                          <FiCode className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <div>
                            <p>This is how the function will appear in your Retell agent configuration.</p>
                            {Object.keys(parameterValues).some(key => parameterValues[key] !== undefined && parameterValues[key] !== '') && (
                              <p className="text-green-400 mt-1">
                                ✓ {Object.keys(parameterValues).filter(key => parameterValues[key] !== undefined && parameterValues[key] !== '').length} parameter(s) pre-configured
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between p-6 border-t border-gray-700">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!isValid || isLoading}
                      className={clsx(
                        "flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-colors",
                        isValid && !isLoading
                          ? "bg-green-600 hover:bg-green-700 text-white"
                          : "bg-gray-600 text-gray-400 cursor-not-allowed"
                      )}
                    >
                      {isLoading ? (
                        <>
                          <FiLoader className="w-4 h-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <FiSave className="w-4 h-4" />
                          Save Function Call
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default FunctionCallEditor;
