'use client';

import React, { useState, useEffect } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { FiVolume2, FiLoader, FiPlay, FiPause, FiCheck, FiAlertTriangle, FiEye, FiEyeOff, FiCopy, FiBookOpen, FiX, FiMessageSquare } from 'react-icons/fi';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface VoiceOption {
  id: string;
  name: string;
  provider: string;
  language: string;
  gender: string;
  accent?: string;
  age?: string;
  previewUrl?: string;
}

interface AgentTemplate {
  id: string;
  name: string;
  description?: string;
  useCase: string;
  category: string;
  serviceAreas: string[];
  preferredLlm: string;
  toolNames: string[];
  systemPrompt: string;
  version: string;
  isActive: boolean;
  metadata?: any;
}

interface BasicSettingsPanelProps {
  formMethods: UseFormReturn<any>;
  errors: any;
  mode: 'create' | 'edit';
  apiKeyInfo?: {
    hasApiKey: boolean;
    status: string;
    usingPartnerKey: boolean;
    hasPartnerKeyFallback: boolean;
    lastVerified?: string;
    errorMessage?: string;
  } | null;
  partnerApiKey?: string;
  // Voice-related props (managed by parent)
  voices: VoiceOption[];
  voicesLoading: boolean;
  voicesError: string | null;
  needsApiKeyForVoices: boolean;
  loadVoicesWithApiKey: (apiKey: string) => void;
  currentApiKey?: string;
}

const LANGUAGE_OPTIONS = [
  { value: 'multi', label: 'Multi-language (Recommended)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'en-AU', label: 'English (Australia)' },
  { value: 'es-ES', label: 'Spanish (Spain)' },
  { value: 'es-419', label: 'Spanish (Latin America)' },
  { value: 'fr-FR', label: 'French' },
  { value: 'de-DE', label: 'German' },
  { value: 'it-IT', label: 'Italian' },
  { value: 'pt-BR', label: 'Portuguese (Brazil)' },
  { value: 'zh-CN', label: 'Chinese (Mandarin)' },
  { value: 'ja-JP', label: 'Japanese' },
  { value: 'ko-KR', label: 'Korean' },
];

const BasicSettingsPanel: React.FC<BasicSettingsPanelProps> = ({
  formMethods,
  errors,
  mode,
  apiKeyInfo,
  partnerApiKey,
  voices,
  voicesLoading,
  voicesError,
  needsApiKeyForVoices,
  loadVoicesWithApiKey,
  currentApiKey
}) => {
  const { register, watch, setValue } = formMethods;
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | null>(null);
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<AgentTemplate | null>(null);
  const [loadingGreeting, setLoadingGreeting] = useState(false);
  const [loadingVoice, setLoadingVoice] = useState(false);

  const watchedValues = watch();
  const agentType = watch('agentType');
  const selectedVoiceId = watch('voiceId');
  const selectedCustomerId = watch('customerId');

  // Load templates on component mount
  useEffect(() => {
    loadTemplates();
  }, []);

  // Function to fetch greeting message from prospect
  const fetchGreetingMessage = async () => {
    if (!selectedCustomerId) {
      toast.error('Please select a customer first');
      return;
    }

    setLoadingGreeting(true);
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch(`/api/partner/prospects/greeting-message?customerId=${selectedCustomerId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch greeting message');
      }

      const data = await response.json();

      if (data.success && data.data.greetingMessage) {
        setValue('beginMessage', data.data.greetingMessage);

        // Show success message with source info
        const sourceMessages = {
          prospect: 'Greeting message loaded from prospect profile',
          business_name: 'Greeting message generated using business name',
          customer_name: 'Greeting message generated using customer name',
          generic: 'Generic greeting message applied'
        };

        toast.success(sourceMessages[data.data.source as keyof typeof sourceMessages] || 'Greeting message applied');
      } else {
        toast.error('No greeting message found');
      }
    } catch (error: any) {
      console.error('Error fetching greeting message:', error);
      toast.error(error.message || 'Failed to fetch greeting message');
    } finally {
      setLoadingGreeting(false);
    }
  };

  // Function to fetch voice configuration from prospect
  const fetchVoiceConfig = async () => {
    if (!selectedCustomerId) {
      toast.error('Please select a customer first');
      return;
    }

    // Check if voices are loaded
    if (voicesLoading) {
      toast.error('Please wait for voices to load first');
      return;
    }

    if (voices.length === 0) {
      toast.error('No voices available. Please ensure your Retell API key is configured correctly.');
      return;
    }

    setLoadingVoice(true);
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      // Build URL with customerId and optional API key
      const url = new URL(`/api/partner/prospects/voice-config`, window.location.origin);
      url.searchParams.set('customerId', selectedCustomerId);

      // If we have a current API key from the modal, send it
      if (currentApiKey && currentApiKey.trim() !== '') {
        url.searchParams.set('apiKey', currentApiKey.trim());
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch voice configuration');
      }

      const data = await response.json();

      if (data.success && data.data.selectedVoiceId) {
        // Check if the voice ID exists in the current voices list
        const voiceExists = voices.find(voice => voice.id === data.data.selectedVoiceId);

        if (voiceExists) {
          // Auto-select the voice
          setValue('voiceId', data.data.selectedVoiceId);

          // Auto-play voice preview for better UX
          setTimeout(() => {
            if (voiceExists.previewUrl) {
              playVoicePreview(voiceExists);
            }
          }, 500); // Small delay to ensure UI updates

          toast.success(`Voice "${voiceExists.name}" loaded and previewing from prospect profile`);
        } else {
          // Voice not found in current list - provide helpful info
          const prospectVoiceId = data.data.selectedVoiceId;
          const voiceProvider = prospectVoiceId.includes('-') ? prospectVoiceId.split('-')[0] : 'unknown';

          toast.error(
            `Prospect voice "${prospectVoiceId}" (${voiceProvider} provider) not found in current voice list. ` +
            `This might happen if voices aren't loaded yet or the voice is no longer available.`
          );

          console.log('Voice fetch details:', {
            prospectVoiceId,
            voiceProvider,
            availableVoices: voices.map(v => ({ id: v.id, name: v.name, provider: v.provider })),
            voicesLoaded: voices.length > 0
          });
        }
      } else {
        toast.error('No voice configuration found in prospect profile');
      }
    } catch (error: any) {
      console.error('Error fetching voice configuration:', error);

      // Handle specific error messages
      if (error.message.includes('SAAS_Audio_Mode')) {
        toast.error('Voice fetch is only available in SaaS Retell mode');
      } else if (error.message.includes('Retell API key required')) {
        toast.error('Please configure your Retell API key in mission control first');
      } else if (error.message.includes('No prospect found')) {
        toast.error('This customer was not created through SaaS onboarding');
      } else if (error.message.includes('No voice configuration')) {
        toast.error('Customer did not complete voice selection during onboarding');
      } else {
        toast.error(error.message || 'Failed to fetch voice configuration');
      }
    } finally {
      setLoadingVoice(false);
    }
  };

  // Load agent templates from demo systems
  const loadTemplates = async () => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch('/api/partner/agent-templates?isActive=true', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cookie': `partner_token=${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTemplates(data.data || []);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
      }
    };
  }, [audioElement]);



  // Apply template to form
  const applyTemplate = async (template: AgentTemplate) => {
    // Apply agent name if not already set
    const currentAgentName = watch('agentName');
    if (!currentAgentName || currentAgentName.trim() === '') {
      setValue('agentName', template.name);
    }

    // Apply system prompt
    setValue('generalPrompt', template.systemPrompt);

    // Apply preferred LLM model in advanced settings
    setValue('advancedSettings.model', template.preferredLlm);

    // Apply tools based on toolNames with proper schema fetching
    if (template.toolNames && template.toolNames.length > 0) {
      await applyTemplateFunctionCalls(template);
    }

    setSelectedTemplate(template);
    setShowTemplates(false);

    // Show success message
    toast.success(`Template "${template.name}" applied successfully!`);
  };

  // Retell built-in tools (copied from ToolSelector for consistency)
  const RETELL_BUILTIN_TOOLS = [
    {
      appName: 'retell',
      toolName: 'end_call',
      displayName: 'End Call',
      description: 'End the call with user',
      category: 'call_control',
      inputSchema: { type: 'object', properties: {}, required: [] }
    },
    {
      appName: 'retell',
      toolName: 'transfer_call',
      displayName: 'Transfer Call',
      description: 'Transfer call to another number or agent',
      category: 'call_control',
      inputSchema: {
        type: 'object',
        properties: {
          transfer_destination: {
            type: 'object',
            description: 'Destination to transfer the call to'
          },
          transfer_option: {
            type: 'object',
            description: 'Transfer options (cold/warm transfer settings)'
          }
        },
        required: ['transfer_destination', 'transfer_option']
      }
    },
    {
      appName: 'retell',
      toolName: 'send_sms',
      displayName: 'Send SMS',
      description: 'Send SMS message to user',
      category: 'communication',
      inputSchema: {
        type: 'object',
        properties: {
          sms_content: {
            type: 'object',
            description: 'SMS content configuration (predefined or inferred)'
          }
        },
        required: ['sms_content']
      }
    },
    {
      appName: 'retell',
      toolName: 'press_digit',
      displayName: 'Press Digit',
      description: 'Press DTMF digit during call (for IVR navigation)',
      category: 'call_control',
      inputSchema: {
        type: 'object',
        properties: {
          delay_ms: {
            type: 'integer',
            description: 'Delay in milliseconds before pressing digit (0-5000ms)',
            default: 1000
          }
        }
      }
    },
    {
      appName: 'retell',
      toolName: 'extract_dynamic_variable',
      displayName: 'Extract Dynamic Variable',
      description: 'Extract and store dynamic variables from conversation',
      category: 'data_extraction',
      inputSchema: {
        type: 'object',
        properties: {
          variables: {
            type: 'array',
            description: 'Array of variables to extract from the conversation'
          }
        },
        required: ['variables']
      }
    }
  ];

  // Helper function to apply template function calls with proper schemas
  const applyTemplateFunctionCalls = async (template: AgentTemplate) => {
    try {
      const customerId = watch('customerId');
      if (!customerId) {
        toast.error('Please select a customer first');
        return;
      }

      // Fetch available tool schemas for the customer
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch(`/api/partner/customers/${customerId}/tool-schemas`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load tool schemas');
      }

      const data = await response.json();
      const availableApps = data.data || {};

      // Get current function calls
      const currentFunctionCalls = watch('functionCalls') || [];
      const newFunctionCalls = [...currentFunctionCalls];

      // Process each tool name from template
      template.toolNames.forEach((toolName: string) => {
        // Check if tool already exists
        const exists = newFunctionCalls.some(fc =>
          fc.toolName === toolName || fc.customName === toolName
        );

        if (!exists) {
          // Find the tool schema in available apps or Retell built-ins
          let foundToolSchema = null;
          let foundAppName = '';

          // First check Retell built-in tools
          const retellTool = RETELL_BUILTIN_TOOLS.find(tool =>
            tool.toolName === toolName ||
            `retell_${tool.toolName}` === toolName
          );

          if (retellTool) {
            foundToolSchema = retellTool;
            foundAppName = 'retell';
          } else {
            // Search through all apps for the tool
            for (const [appName, tools] of Object.entries(availableApps)) {
              // Type assertion for tools array
              const toolsArray = Array.isArray(tools) ? tools : [];
              const toolSchema = toolsArray.find((tool: any) =>
                tool.toolName === toolName ||
                `${appName}_${tool.toolName}` === toolName ||
                // Handle internal tools that might be prefixed with app name in template
                (appName === 'internal' && toolName.startsWith('internal_') && tool.toolName === toolName.replace('internal_', '').toUpperCase())
              );

              if (toolSchema) {
                foundToolSchema = toolSchema;
                foundAppName = appName;
                break;
              }
            }
          }

          // If tool schema found, create proper function call
          if (foundToolSchema) {
            // Create a valid identifier name (no spaces, special chars)
            const validCustomName = (foundToolSchema.displayName || toolName)
              .replace(/[^a-zA-Z0-9_]/g, '_')  // Replace invalid chars with underscore
              .replace(/^[0-9]/, '_$&')        // Prefix with underscore if starts with number
              .replace(/_+/g, '_')             // Replace multiple underscores with single
              .replace(/^_|_$/g, '');          // Remove leading/trailing underscores

            const newFunctionCall = {
              appName: foundAppName,
              toolName: foundToolSchema.toolName,
              customName: validCustomName || toolName,
              customDescription: foundToolSchema.description || `Auto-added from template: ${template.name}`,
              isConfigured: false,
              parameters: foundToolSchema.inputSchema || {
                type: "object",
                properties: {},
                required: []
              }
            };

            newFunctionCalls.push(newFunctionCall);
          } else {
            // Fallback: create basic function call if schema not found
            let appName = 'internal';
            let actualToolName = toolName;

            if (toolName.includes('_')) {
              const parts = toolName.split('_');
              appName = parts[0];
              actualToolName = parts.slice(1).join('_');
            }

            const newFunctionCall = {
              appName,
              toolName: actualToolName,
              customName: toolName,
              customDescription: `Auto-added from template: ${template.name}`,
              isConfigured: false
            };

            newFunctionCalls.push(newFunctionCall);
          }
        }
      });

      // Update form with new function calls
      setValue('functionCalls', newFunctionCalls);

    } catch (error) {
      console.error('Error applying template function calls:', error);
      toast.error('Failed to load tool schemas. Function calls added with basic configuration.');

      // Fallback to basic function call creation
      const currentFunctionCalls = watch('functionCalls') || [];
      const newFunctionCalls = [...currentFunctionCalls];

      template.toolNames.forEach((toolName: string) => {
        const exists = newFunctionCalls.some(fc =>
          fc.toolName === toolName || fc.customName === toolName
        );

        if (!exists) {
          let appName = 'internal';
          let actualToolName = toolName;

          if (toolName.includes('_')) {
            const parts = toolName.split('_');
            appName = parts[0];
            actualToolName = parts.slice(1).join('_');
          }

          const newFunctionCall = {
            appName,
            toolName: actualToolName,
            customName: toolName,
            customDescription: `Auto-added from template: ${template.name}`,
            isConfigured: false
          };

          newFunctionCalls.push(newFunctionCall);
        }
      });

      setValue('functionCalls', newFunctionCalls);
    }
  };

  const playVoicePreview = async (voice: VoiceOption) => {
    if (!voice.previewUrl) return;

    try {
      // Stop current audio if playing
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
      }

      if (playingVoice === voice.id) {
        setPlayingVoice(null);
        return;
      }

      setPlayingVoice(voice.id);
      
      const audio = new Audio(voice.previewUrl);
      setAudioElement(audio);
      
      audio.onended = () => {
        setPlayingVoice(null);
      };
      
      audio.onerror = () => {
        setPlayingVoice(null);
        console.error('Error playing voice preview');
      };
      
      await audio.play();
    } catch (error) {
      console.error('Error playing voice preview:', error);
      setPlayingVoice(null);
    }
  };

  const getVoiceDisplayName = (voice: VoiceOption) => {
    let displayName = voice.name;
    if (voice.accent) {
      displayName += ` (${voice.accent})`;
    }
    if (voice.age) {
      displayName += ` - ${voice.age}`;
    }
    return displayName;
  };

  const getProviderIcon = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'elevenlabs':
        return '🎵';
      case 'openai':
        return '🤖';
      case 'deepgram':
        return '🎙️';
      default:
        return '🔊';
    }
  };

  return (
    <div className="space-y-6">
      {/* Getting Started Guide */}
      {mode === 'create' && (
        <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-green-400 text-lg">🚀</span>
            </div>
            <div>
              <h3 className="text-sm font-medium text-white mb-2">Let's Create Your AI Agent!</h3>
              <p className="text-sm text-gray-300 mb-3">
                We'll guide you through creating a professional AI agent that can handle customer calls for your business.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="flex items-center gap-2 text-green-300">
                  <span className="w-4 h-4 bg-green-500/20 rounded-full flex items-center justify-center text-xs">1</span>
                  <span>Basic Setup</span>
                </div>
                <div className="flex items-center gap-2 text-blue-300">
                  <span className="w-4 h-4 bg-blue-500/20 rounded-full flex items-center justify-center text-xs">2</span>
                  <span>Conversation Flow</span>
                </div>
                <div className="flex items-center gap-2 text-purple-300">
                  <span className="w-4 h-4 bg-purple-500/20 rounded-full flex items-center justify-center text-xs">3</span>
                  <span>Test & Deploy</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Template Selection */}
      {mode === 'create' && (
        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FiBookOpen className="w-5 h-5 text-blue-400" />
              <h3 className="text-sm font-medium text-white">Quick Start with Templates</h3>
            </div>
            <button
              type="button"
              onClick={() => setShowTemplates(!showTemplates)}
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              {showTemplates ? 'Hide Templates' : 'Browse Templates'}
            </button>
          </div>

          {selectedTemplate && (
            <div className="mb-3 p-3 bg-green-500/10 rounded-lg border border-green-500/30">
              <div className="flex items-center gap-2 mb-1">
                <FiCheck className="w-4 h-4 text-green-400" />
                <span className="text-sm font-medium text-green-300">Template Applied: {selectedTemplate.name}</span>
              </div>
              <p className="text-xs text-green-200">{selectedTemplate.description || selectedTemplate.useCase}</p>
              <div className="flex items-center gap-2 mt-1 text-xs text-green-300">
                <span>{selectedTemplate.category}</span>
                <span>•</span>
                <span>{selectedTemplate.version}</span>
                <span>•</span>
                <span>{selectedTemplate.preferredLlm}</span>
              </div>
            </div>
          )}

          {showTemplates && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="p-3 bg-gray-800/50 rounded-lg border border-gray-600 hover:border-blue-500/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-sm font-medium text-white">{template.name}</h4>
                    <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded-full">
                      {template.version}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mb-2">{template.useCase}</p>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-blue-400">{template.category}</span>
                    <span className="text-xs text-green-400">{template.preferredLlm}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewTemplate(template);
                        setShowTemplatePreview(true);
                      }}
                      className="flex-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        await applyTemplate(template);
                      }}
                      className="flex-1 px-2 py-1 text-xs bg-green-600 hover:bg-green-500 text-white rounded transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Agent Name */}
      <div>
        <label htmlFor="agentName" className="block text-sm font-medium text-gray-300 mb-2">
          Agent Name *
        </label>
        <input
          {...register('agentName')}
          type="text"
          id="agentName"
          placeholder="Enter agent name..."
          className={clsx(
            'w-full px-3 py-2 bg-gray-700 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500',
            errors.agentName ? 'border-red-500' : 'border-gray-600'
          )}
        />
        {errors.agentName && (
          <p className="mt-1 text-sm text-red-400">{errors.agentName.message}</p>
        )}
      </div>

      {/* Retell API Key */}
      <div>
        <label htmlFor="apiKey" className="block text-sm font-medium text-gray-300 mb-2">
          Retell API Key *
        </label>

        {/* Current API Key Status (Edit Mode) */}
        {mode === 'edit' && apiKeyInfo && (
          <div className="mb-3 p-3 bg-gray-800 rounded-lg border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-300">Current API Key Status:</span>
              <div
                className="flex items-center gap-1 text-sm"
                style={{
                  color: apiKeyInfo.status === 'valid' ? '#4ade80' :
                         apiKeyInfo.status === 'invalid' ? '#f87171' :
                         apiKeyInfo.usingPartnerKey ? '#fb923c' :
                         '#9ca3af'
                }}
              >
                {apiKeyInfo.status === 'valid' && <FiCheck className="w-4 h-4" />}
                {(apiKeyInfo.status === 'invalid' || apiKeyInfo.status === 'expired') && <FiAlertTriangle className="w-4 h-4" />}
                <span className="capitalize">
                  {apiKeyInfo.usingPartnerKey ? 'Using Partner Key' : apiKeyInfo.status.replace('_', ' ')}
                </span>
              </div>
            </div>

            <div className="text-xs text-gray-400 space-y-1">
              {apiKeyInfo.hasApiKey ? (
                <p>✓ This agent has its own API key</p>
              ) : (
                <p>• No individual API key set for this agent</p>
              )}

              {apiKeyInfo.usingPartnerKey && (
                <p>• Currently using partner-level API key as fallback</p>
              )}

              {apiKeyInfo.lastVerified && (
                <p>• Last verified: {new Date(apiKeyInfo.lastVerified).toLocaleString()}</p>
              )}

              {apiKeyInfo.errorMessage && (
                <p className="text-red-400">• Error: {apiKeyInfo.errorMessage}</p>
              )}
            </div>
          </div>
        )}

        {/* Partner API Key Status (Create Mode) */}
        {mode === 'create' && partnerApiKey && (
          <div className="mb-3 p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
            <div className="flex items-center gap-2 mb-2">
              <FiCheck className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-blue-300">Using Partner API Key as Default</span>
            </div>
            <div className="text-xs text-blue-200 space-y-1">
              <p>✓ Your partner-level Retell API key has been pre-filled</p>
              <p>• This agent will get its own copy of the API key</p>
              <p>• You can replace it with a different API key if needed</p>
            </div>
          </div>
        )}

        {/* No Partner API Key Warning (Create Mode) */}
        {mode === 'create' && !partnerApiKey && (
          <div className="mb-3 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
            <div className="flex items-center gap-2 mb-2">
              <FiAlertTriangle className="w-4 h-4" style={{ color: '#fb923c' }} />
              <span className="text-sm font-medium" style={{ color: '#fdba74' }}>No Partner API Key Found</span>
            </div>
            <div className="text-xs" style={{ color: '#fdba74' }}>
              <p>You'll need to provide a Retell API key for this agent</p>
            </div>
          </div>
        )}

        {/* API Key Input */}
        <div className="relative">
          <input
            {...register('apiKey')}
            type={showApiKey ? 'text' : 'password'}
            id="apiKey"
            placeholder={
              mode === 'edit' && apiKeyInfo?.hasApiKey
                ? "Enter new API key to update..."
                : mode === 'create' && partnerApiKey
                ? "Partner API key pre-filled (you can replace it)"
                : "Enter your Retell API key..."
            }
            className={clsx(
              'w-full px-3 py-2 pr-10 bg-gray-700 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm',
              errors.apiKey ? 'border-red-500' : 'border-gray-600'
            )}
          />
          <button
            type="button"
            onClick={() => setShowApiKey(!showApiKey)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
          >
            {showApiKey ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
          </button>
        </div>

        {/* Help Text */}
        {errors.apiKey ? (
          <p className="mt-1 text-sm text-red-400">{errors.apiKey.message}</p>
        ) : (
          <div className="mt-1 text-sm text-gray-400">
            {mode === 'create' ? (
              <div className="space-y-1">
                <p>This agent will use its own copy of the API key for Retell operations</p>
                {partnerApiKey ? (
                  <p className="text-blue-400">
                    ✓ Pre-filled with your partner API key - you can change it if needed
                  </p>
                ) : (
                  <p style={{ color: '#fdba74' }}>
                    Please provide a Retell API key for this agent
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <p>
                  {apiKeyInfo?.hasApiKey
                    ? "Update this agent's individual API key"
                    : "Set an individual API key for this agent"}
                </p>
                {!apiKeyInfo?.hasApiKey && apiKeyInfo?.hasPartnerKeyFallback && (
                  <p style={{ color: '#fdba74' }}>
                    Currently using partner-level API key as fallback
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* System Prompt */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="generalPrompt" className="block text-sm font-medium text-gray-300">
            System Prompt *
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const currentPrompt = watchedValues.generalPrompt || '';
                navigator.clipboard.writeText(currentPrompt);
              }}
              className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1"
              title="Copy prompt"
            >
              <FiCopy className="w-3 h-3" />
              Copy
            </button>
            <span className="text-xs text-gray-500">
              {watchedValues.generalPrompt?.length || 0}/5000
            </span>
          </div>
        </div>

        <div className="relative">
          <textarea
            {...register('generalPrompt')}
            id="generalPrompt"
            rows={8}
            placeholder="You are a professional assistant who helps customers with their inquiries. Be friendly, helpful, and concise in your responses. Always stay in character and focus on providing excellent customer service..."
            className={clsx(
              'w-full px-3 py-2 bg-gray-700 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm resize-y min-h-[120px]',
              errors.generalPrompt ? 'border-red-500' : 'border-gray-600'
            )}
          />
        </div>

        <div className="mt-2">
          {errors.generalPrompt ? (
            <p className="text-sm text-red-400">{errors.generalPrompt.message}</p>
          ) : (
            <div className="space-y-1">
              <p className="text-sm text-gray-400">
                Define your agent's personality, role, and behavior guidelines
              </p>
              <div className="text-xs text-gray-500 space-y-1">
                <p>💡 <strong>Tips:</strong> Be specific about the agent's role, tone, and boundaries</p>
                <p>🎯 Include industry-specific knowledge and common scenarios</p>
                <p>🚫 Set clear guidelines about what the agent should not do</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Voice Selection */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="voiceId" className="block text-sm font-medium text-gray-300">
            Voice Selection *
          </label>
          <div className="flex items-center gap-2">
            {/* Fetch Voice from Prospect button - only show in SaaS Retell mode when API key is available */}
            {process.env.NEXT_PUBLIC_SAAS_AUDIO_MODE === 'retell' && (apiKeyInfo?.hasPartnerKeyFallback || (currentApiKey && currentApiKey.trim() !== '')) && (
              <button
                type="button"
                onClick={fetchVoiceConfig}
                disabled={!selectedCustomerId || loadingVoice || voicesLoading || voices.length === 0}
                className={clsx(
                  'flex items-center gap-2 px-3 py-1 text-xs rounded-md transition-colors',
                  selectedCustomerId && !loadingVoice && !voicesLoading && voices.length > 0
                    ? 'bg-purple-600 hover:bg-purple-700 text-white'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                )}
                title={
                  !selectedCustomerId
                    ? 'Select a customer first'
                    : voicesLoading
                    ? 'Wait for voices to load first'
                    : voices.length === 0
                    ? 'No voices available - check API key configuration'
                    : 'Fetch and preview voice from prospect profile'
                }
              >
                {loadingVoice ? (
                  <>
                    <FiLoader className="w-3 h-3 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <FiVolume2 className="w-3 h-3" />
                    Fetch Voice
                  </>
                )}
              </button>
            )}
            {needsApiKeyForVoices && currentApiKey && currentApiKey.trim() !== '' && (
              <button
                type="button"
                onClick={() => loadVoicesWithApiKey(currentApiKey)}
                disabled={voicesLoading}
                className="flex items-center gap-2 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
              >
                {voicesLoading ? (
                  <>
                    <FiLoader className="w-4 h-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <FiVolume2 className="w-4 h-4" />
                    Load Voices
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Voice Selection Dropdown and Preview */}
        <div className="flex gap-3">
          <select
            {...register('voiceId')}
            id="voiceId"
            disabled={voicesLoading || needsApiKeyForVoices}
            className={clsx(
              'flex-1 px-3 py-2 bg-gray-700 border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500',
              errors.voiceId ? 'border-red-500' : 'border-gray-600',
              needsApiKeyForVoices && 'opacity-50'
            )}
          >
            {voicesLoading ? (
              <option>Loading voices...</option>
            ) : needsApiKeyForVoices ? (
              <option>Enter API key to load voices</option>
            ) : voices.length === 0 ? (
              <option>No voices available</option>
            ) : (
              <>
                <option value="">Select a voice</option>
                {voices.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {getProviderIcon(voice.provider)} {getVoiceDisplayName(voice)} ({voice.gender})
                  </option>
                ))}
              </>
            )}
          </select>

          {selectedVoiceId && !needsApiKeyForVoices && (
            <button
              type="button"
              onClick={() => {
                const voice = voices.find(v => v.id === selectedVoiceId);
                if (voice) playVoicePreview(voice);
              }}
              disabled={voicesLoading || !voices.find(v => v.id === selectedVoiceId)?.previewUrl}
              className={clsx(
                'px-4 py-2 rounded-lg transition-colors flex items-center gap-2',
                playingVoice === selectedVoiceId
                  ? 'bg-red-600 hover:bg-red-500 text-white'
                  : 'bg-blue-600 hover:bg-blue-500 text-white disabled:bg-gray-600 disabled:cursor-not-allowed'
              )}
            >
              {playingVoice === selectedVoiceId ? (
                <>
                  <FiPause className="w-4 h-4" />
                  Stop
                </>
              ) : (
                <>
                  <FiPlay className="w-4 h-4" />
                  Preview
                </>
              )}
            </button>
          )}
        </div>

        {/* Error Messages and Help Text */}
        {errors.voiceId && (
          <p className="mt-1 text-sm text-red-400">{errors.voiceId.message}</p>
        )}
        {voicesError && (
          <p className="mt-1 text-sm text-amber-400">{voicesError}</p>
        )}
        {needsApiKeyForVoices && (
          <p className="mt-1 text-sm text-gray-400">
            Please enter your Retell API key above to load available voices.
          </p>
        )}
        {!needsApiKeyForVoices && voices.length > 0 && (
          <p className="mt-1 text-sm text-gray-400">
            {voices.length} voices available. Click Preview to hear a sample.
          </p>
        )}
      </div>

      {/* Language */}
      <div>
        <label htmlFor="language" className="block text-sm font-medium text-gray-300 mb-2">
          Language
        </label>
        <select
          {...register('language')}
          id="language"
          className={clsx(
            'w-full px-3 py-2 bg-gray-700 border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500',
            errors.language ? 'border-red-500' : 'border-gray-600'
          )}
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {errors.language && (
          <p className="mt-1 text-sm text-red-400">{errors.language.message}</p>
        )}
      </div>

      {/* Begin Message */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="beginMessage" className="block text-sm font-medium text-gray-300">
            Begin Message (Optional)
          </label>
          <button
            type="button"
            onClick={fetchGreetingMessage}
            disabled={!selectedCustomerId || loadingGreeting}
            className={clsx(
              'flex items-center gap-2 px-3 py-1 text-xs rounded-md transition-colors',
              selectedCustomerId && !loadingGreeting
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            )}
            title={!selectedCustomerId ? 'Select a customer first' : 'Fetch greeting from prospect profile'}
          >
            {loadingGreeting ? (
              <>
                <FiLoader className="w-3 h-3 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <FiMessageSquare className="w-3 h-3" />
                Fetch Greeting
              </>
            )}
          </button>
        </div>
        <input
          {...register('beginMessage')}
          type="text"
          id="beginMessage"
          placeholder="Hi, how can I help you today?"
          className={clsx(
            'w-full px-3 py-2 bg-gray-700 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500',
            errors.beginMessage ? 'border-red-500' : 'border-gray-600'
          )}
        />
        <div className="flex justify-between items-center mt-1">
          {errors.beginMessage ? (
            <p className="text-sm text-red-400">{errors.beginMessage.message}</p>
          ) : (
            <p className="text-sm text-gray-400">
              First message the agent will say when the call starts
            </p>
          )}
          <span className="text-xs text-gray-500">
            {watchedValues.beginMessage?.length || 0}/500
          </span>
        </div>
      </div>

      {/* Boosted Keywords */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-300">
            Boosted Keywords (Optional)
          </label>
          <span className="text-xs text-gray-500">
            {(Array.isArray(watchedValues.boostedKeywords) ? watchedValues.boostedKeywords.length : 0)} keywords
          </span>
        </div>

        <div className="space-y-2">
          <input
            type="text"
            placeholder="Enter keywords separated by commas (e.g., appointment, booking, schedule)"
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            defaultValue={Array.isArray(watchedValues.boostedKeywords) ? watchedValues.boostedKeywords.join(', ') : ''}
            onChange={(e) => {
              const keywords = e.target.value.split(',').map(k => k.trim()).filter(k => k);
              setValue('boostedKeywords', keywords, { shouldDirty: true });
            }}
          />

          <div className="text-xs text-gray-400 space-y-1">
            <p>💡 <strong>Tip:</strong> Add important words your agent should recognize better</p>
            <p>Examples: business names, product names, technical terms, industry jargon</p>
          </div>

          {Array.isArray(watchedValues.boostedKeywords) && watchedValues.boostedKeywords.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {watchedValues.boostedKeywords.map((keyword: string, index: number) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs"
                >
                  {keyword}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Agent Type */}
      <div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            🤖 What type of agent do you want to create?
          </label>
          <p className="text-sm text-gray-400">
            Choose based on how complex your customer conversations need to be
          </p>
        </div>

        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer p-4 border border-gray-600 rounded-lg hover:border-blue-500/50 transition-colors">
            <input
              {...register('agentType')}
              type="radio"
              value="simple"
              className="mt-1 text-blue-600 focus:ring-blue-500"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">💬</span>
                <div className="font-medium text-white">Simple Agent</div>
                <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-300 rounded-full">Recommended</span>
              </div>
              <div className="text-sm text-gray-400 mb-2">
                Perfect for most businesses - handles customer inquiries with a single, smart conversation flow
              </div>
              <div className="text-xs text-gray-500">
                ✓ Easy to set up • ✓ Great for customer service • ✓ Appointment booking • ✓ Information requests
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer p-4 border border-gray-600 rounded-lg hover:border-purple-500/50 transition-colors">
            <input
              {...register('agentType')}
              type="radio"
              value="advanced"
              className="mt-1 text-purple-600 focus:ring-purple-500"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🎯</span>
                <div className="font-medium text-white">Advanced Agent</div>
                <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded-full">For Experts</span>
              </div>
              <div className="text-sm text-gray-400 mb-2">
                For complex businesses - create detailed conversation journeys with multiple steps and custom logic
              </div>
              <div className="text-xs text-gray-500">
                ✓ Multi-step conversations • ✓ Custom workflows • ✓ Advanced routing • ✓ Complex business logic
              </div>
            </div>
          </label>
        </div>

        <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <div className="flex items-start gap-2">
            <span className="text-amber-400 text-sm">💡</span>
            <div className="text-sm text-amber-200">
              <strong>Not sure?</strong> Start with Simple Agent - you can always upgrade to Advanced later!
            </div>
          </div>
        </div>
      </div>

      {/* State Builder for Advanced Agents */}
      {agentType === 'advanced' && (
        <div className="border border-gray-700 rounded-lg p-4 bg-gray-800/50">
          <h3 className="text-lg font-medium text-white mb-3">Conversation Flow Builder</h3>
          <div className="text-center py-8 text-gray-400">
            <p>Advanced state builder coming soon...</p>
            <p className="text-sm mt-2">For now, advanced agents will use the system prompt as a single state.</p>
          </div>
        </div>
      )}

      {/* Template Preview Modal */}
      {showTemplatePreview && previewTemplate && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-gray-900 rounded-xl shadow-xl border border-gray-800 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <div>
                <h3 className="text-xl font-semibold text-white">{previewTemplate.name}</h3>
                <p className="text-sm text-gray-400 mt-1">
                  {previewTemplate.useCase} • {previewTemplate.category} • {previewTemplate.version}
                </p>
              </div>
              <button
                onClick={() => setShowTemplatePreview(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 max-h-96 overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Description</h4>
                  <p className="text-gray-400 text-sm">
                    {previewTemplate.description || 'No description available'}
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Service Areas</h4>
                  <div className="flex flex-wrap gap-2">
                    {previewTemplate.serviceAreas?.map((area: string, index: number) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-blue-500/10 text-blue-400 text-xs rounded"
                      >
                        {area}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Preferred LLM</h4>
                  <span className="px-3 py-1 bg-green-500/10 text-green-400 text-sm rounded">
                    {previewTemplate.preferredLlm}
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Included Tools</h4>
                  <div className="flex flex-wrap gap-2">
                    {previewTemplate.toolNames?.map((tool: string, index: number) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-purple-500/10 text-purple-400 text-xs rounded"
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-2">System Prompt Preview</h4>
                  <div className="bg-gray-800 rounded-lg p-4 max-h-48 overflow-y-auto">
                    <pre className="text-xs text-gray-300 whitespace-pre-wrap">
                      {previewTemplate.systemPrompt?.substring(0, 500)}
                      {previewTemplate.systemPrompt?.length > 500 && '...'}
                    </pre>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-800">
              <button
                onClick={() => setShowTemplatePreview(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await applyTemplate(previewTemplate);
                  setShowTemplatePreview(false);
                }}
                className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
              >
                Apply Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BasicSettingsPanel;
