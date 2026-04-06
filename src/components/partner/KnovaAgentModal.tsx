'use client';

import React, { useState, useEffect, useRef, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { FiX, FiSave, FiLoader, FiUser, FiCheck, FiBook, FiDatabase, FiAlertTriangle, FiZap, FiPlay, FiPause, FiSearch, FiSettings, FiInfo, FiVolume2, FiChevronDown, FiChevronRight, FiFileText } from 'react-icons/fi';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import FunctionCallsPanel from './FunctionCallsPanel';
import AgentCreationSummaryModal from './AgentCreationSummaryModal';

// Interfaces
interface Customer {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  companyName?: string;
  monthlyCallVolume?: number;
  estimatedPrice?: number;
  priceBreakdown?: any;
  orderStatus?: string;
  userId?: string;
  isOnboardingCompleted?: boolean;
  customerId?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  totalFiles: number;
  totalFolders: number;
  totalWebsiteUrls?: number;
  activeWebsiteUrls?: number;
  totalWebsitePages?: number;
  scrapedWebsitePages?: number;
  processingWebsitePages?: number;
  totalSize: number;
  isReady: boolean;
  readyFiles: number;
  processingFiles: number;
  failedFiles: number;
  createdAt: string;
  updatedAt: string;
}

interface Voice {
  id: string;
  voiceId?: string;
  name: string;
  displayName?: string;
  description?: string;
  provider: 'inworld' | 'cartesia';
  gender?: string;
  tags?: string[];
  languages?: string[];
  isProspectVoice?: boolean; // Flag to indicate this is the prospect's selected voice
}

interface AgentTemplate {
  id: string;
  name: string;
  useCase: string;
  category: string;
  serviceAreas: string[];
  preferredLlm: string;
  toolNames: string[];
  systemPrompt: string;
  version: string;
  description?: string;
  isActive: boolean;
  metadata?: any;
}

interface FunctionCall {
  id?: string;
  appName: string;
  toolName: string;
  customName: string;
  customDescription: string;
  isConfigured?: boolean;
  webhookUrl?: string;
  securityToken?: string;
  parameterValues?: Record<string, any>;
  parameters?: { type: "object"; properties: Record<string, any>; required: string[]; };
  speakDuringExecution?: boolean;
  speakAfterExecution?: boolean;
  executionMessageDescription?: string;
  timeoutMs?: number;
  calendarId?: string;
  calendarName?: string;
}

type AgentMode = 'essential' | 'moderate' | 'premium';

const AGENT_MODE_OPTIONS: { value: AgentMode; label: string; description: string }[] = [
  { value: 'essential', label: 'Essential', description: 'Cost-effective with fast response times. Great for simple interactions.' },
  { value: 'moderate', label: 'Moderate', description: 'Balanced performance and intelligence. Recommended for most use cases.' },
  { value: 'premium', label: 'Premium', description: 'Highest intelligence with nuanced understanding. Best for complex conversations.' },
];

const LANGUAGE_OPTIONS = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'es-ES', label: 'Spanish (Spain)' },
  { value: 'es-MX', label: 'Spanish (Mexico)' },
  { value: 'fr-FR', label: 'French' },
  { value: 'de-DE', label: 'German' },
  { value: 'it-IT', label: 'Italian' },
  { value: 'pt-BR', label: 'Portuguese (Brazil)' },
  { value: 'multi', label: 'Multi-language' },
];

// Validation schema
const createValidationSchema = (mode: 'create' | 'edit') => {
  return z.object({
    customerId: mode === 'create' ? z.string().min(1, 'Customer selection is required') : z.string().optional(),
    knowledgeBaseIds: z.array(z.string()).optional(),
    templateId: z.string().optional(),
    agentName: z.string().min(1, 'Agent name is required').max(100, 'Agent name must be less than 100 characters'),
    systemPrompt: z.string().min(10, 'System prompt must be at least 10 characters').max(10000, 'System prompt must be less than 10000 characters'),
    voiceId: z.string().min(1, 'Please select a voice'),
    voiceProvider: z.enum(['inworld', 'cartesia']).optional(),
    language: z.string().optional(),
    greetingMessage: z.string().max(500, 'Greeting message must be less than 500 characters').optional(),
    agentType: z.enum(['website', 'outbound']).optional(),
    communicationChannel: z.enum(['web', 'telephony']).optional(),
    agentMode: z.enum(['essential', 'moderate', 'premium']).optional(),
    enableBackchannel: z.boolean().optional(),
    backchannelWords: z.array(z.string()).optional(),
    normalizeForSpeech: z.boolean().optional(),
    functionCalls: z.array(z.any()).optional(),
  });
};

const baseSchema = createValidationSchema('create');
type AgentFormData = z.infer<typeof baseSchema>;

interface KnovaAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId?: string;
  mode: 'create' | 'edit';
  onAgentSaved?: (agent: any) => void;
}

type TabType = 'customer' | 'setup' | 'basic' | 'advanced' | 'functions';


const KnovaAgentModal: React.FC<KnovaAgentModalProps> = ({
  isOpen,
  onClose,
  agentId,
  mode,
  onAgentSaved
}) => {
  // Tab state - Customer is first tab
  const [currentTab, setCurrentTab] = useState<TabType>('customer');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [agentData, setAgentData] = useState<any>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [pendingSubmissionData, setPendingSubmissionData] = useState<AgentFormData | null>(null);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [isSubmissionComplete, setIsSubmissionComplete] = useState(false); // Flag to bypass unsaved changes check

  // Data states
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loadingKnowledgeBases, setLoadingKnowledgeBases] = useState(false);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | null>(null);

  // Voice playback
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [generatingPreview, setGeneratingPreview] = useState<string | null>(null);
  const [voiceSearch, setVoiceSearch] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Prospect data (greeting, voice from onboarding)
  const [prospectGreeting, setProspectGreeting] = useState<string>('');
  const [prospectVoiceId, setProspectVoiceId] = useState<string>('');
  const [prospectVoiceProvider, setProspectVoiceProvider] = useState<'inworld' | 'cartesia' | null>(null);
  const [loadingProspectData, setLoadingProspectData] = useState(false);
  const [prospectMetadata, setProspectMetadata] = useState<Record<string, any> | null>(null);

  // Form setup
  const validationSchema = createValidationSchema(mode);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isDirty }
  } = useForm<AgentFormData>({
    resolver: zodResolver(validationSchema),
    defaultValues: {
      customerId: '',
      knowledgeBaseIds: [],
      templateId: '',
      agentName: '',
      systemPrompt: '',
      voiceId: '',
      voiceProvider: 'inworld',
      language: 'en-US',
      greetingMessage: '',
      agentType: 'website',
      communicationChannel: 'telephony',
      agentMode: 'moderate',
      enableBackchannel: true,
      backchannelWords: ['yeah', 'uh-huh', 'I see', 'got it'],
      normalizeForSpeech: true,
      functionCalls: [],
    }
  });

  const selectedCustomerId = watch('customerId');
  const selectedVoiceId = watch('voiceId');
  const functionCalls = watch('functionCalls') || [];

  // Track unsaved changes
  useEffect(() => {
    setHasUnsavedChanges(isDirty);
  }, [isDirty]);

  // Load initial data when modal opens
  useEffect(() => {
    if (isOpen) {
      // Reset all modal states when modal opens
      setIsSubmissionComplete(false);
      setShowConfirmClose(false);
      setHasUnsavedChanges(false);

      fetchCustomers();
      fetchVoices();
      fetchTemplates();
      if (mode === 'create') {
        setCurrentTab('customer');
        reset();
      } else if (mode === 'edit' && agentId) {
        loadAgentData();
      }
    }
  }, [isOpen, mode, agentId]);

  // Load prospect data when customer changes
  useEffect(() => {
    if (selectedCustomerId) {
      fetchProspectData(selectedCustomerId);
    } else {
      setProspectGreeting('');
      setProspectVoiceId('');
      setProspectMetadata(null);
    }
  }, [selectedCustomerId]);

  // Auto-set voice from prospect when loaded
  useEffect(() => {
    if (prospectVoiceId && voices.length > 0 && mode === 'create') {
      // Find the matching voice in the list
      const matchingVoice = voices.find(v => v.id === prospectVoiceId || v.voiceId === prospectVoiceId);

      if (matchingVoice) {
        setValue('voiceId', prospectVoiceId, { shouldValidate: true });
        setValue('voiceProvider', matchingVoice.provider, { shouldValidate: true });
        setProspectVoiceProvider(matchingVoice.provider);
      } else {
        // Voice not in list, add it as a special "prospect voice" entry
        // Try to determine provider - check both APIs
        const checkProvider = async () => {
          // Check if it's an Inworld voice (Inworld voice IDs typically have specific patterns)
          // For now, we'll default to inworld since that's the primary provider for Knova
          setValue('voiceId', prospectVoiceId, { shouldValidate: true });
          setValue('voiceProvider', 'inworld', { shouldValidate: true });
          setProspectVoiceProvider('inworld');
        };
        checkProvider();
      }
    }
  }, [prospectVoiceId, voices, mode]);

  // Auto-set greeting from prospect when loaded
  useEffect(() => {
    if (prospectGreeting && mode === 'create') {
      setValue('greetingMessage', prospectGreeting, { shouldValidate: true });
    }
  }, [prospectGreeting, mode]);

  // Fetch customers - only those who completed onboarding (step 9) or were manually created
  const fetchCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      // Fetch customers
      const customersResponse = await fetch('/api/partner/customers', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      // Fetch prospects to check completion status
      const prospectsResponse = await fetch('/api/partner/prospects', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (customersResponse.ok) {
        const customersData = await customersResponse.json();
        const allCustomers = customersData.data || [];

        // Get prospects data for filtering
        const prospectsMap: Record<string, { currentStep: number; isCompleted: boolean }> = {};
        if (prospectsResponse.ok) {
          const prospectsData = await prospectsResponse.json();
          const prospects = prospectsData.data || prospectsData.prospects || [];
          prospects.forEach((prospect: { convertedToCustomerId?: string; currentStep: number; isCompleted: boolean }) => {
            if (prospect.convertedToCustomerId) {
              prospectsMap[prospect.convertedToCustomerId] = {
                currentStep: prospect.currentStep || 1,
                isCompleted: prospect.isCompleted || false
              };
            }
          });
        }

        // Filter customers: only show those who completed onboarding (step >= 9 or isCompleted)
        // OR don't have a prospect (manually created)
        const filteredCustomers = allCustomers.filter((customer: Customer) => {
          const customerId = customer.customerId || customer.id;
          const prospectInfo = prospectsMap[customerId];

          // If no prospect record, customer was manually created - include them
          if (!prospectInfo) return true;

          // If prospect exists, only include if they completed all 9 steps
          return prospectInfo.currentStep >= 9 || prospectInfo.isCompleted;
        });

        setCustomers(filteredCustomers);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast.error('Failed to load customers');
    } finally {
      setLoadingCustomers(false);
    }
  };

  // Fetch voices
  const fetchVoices = async () => {
    setLoadingVoices(true);
    try {
      // Fetch voices from both Inworld and Cartesia in parallel
      const [inworldResponse, cartesiaResponse] = await Promise.all([
        fetch('/api/inworld/voices?gender=all&limit=50'),
        fetch('/api/cartesia/voices?gender=all&limit=50')
      ]);

      const allVoices: Voice[] = [];

      // Process Inworld voices
      if (inworldResponse.ok) {
        const inworldData = await inworldResponse.json();
        const inworldVoices = (inworldData.voices || []).map((v: any) => ({
          id: v.id || v.voiceId,
          voiceId: v.voiceId,
          name: v.name || v.displayName,
          displayName: v.displayName,
          description: v.description,
          provider: 'inworld' as const,
          gender: v.gender,
          tags: v.tags,
          languages: v.languages,
        }));
        allVoices.push(...inworldVoices);
      }

      // Process Cartesia voices
      if (cartesiaResponse.ok) {
        const cartesiaData = await cartesiaResponse.json();
        const cartesiaVoices = (cartesiaData.voices || []).map((v: any) => ({
          id: v.id,
          voiceId: v.id,
          name: v.name,
          displayName: v.name,
          description: v.description,
          provider: 'cartesia' as const,
          gender: v.gender === 'masculine' ? 'male' : v.gender === 'feminine' ? 'female' : 'neutral',
          tags: [],
          languages: v.language ? [v.language] : [],
        }));
        allVoices.push(...cartesiaVoices);
      }

      setVoices(allVoices);
    } catch (error) {
      console.error('Error fetching voices:', error);
    } finally {
      setLoadingVoices(false);
    }
  };

  // Fetch templates
  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;
      const response = await fetch('/api/partner/agent-templates?isActive=true', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  // Fetch prospect data (greeting & voice from onboarding)
  const fetchProspectData = async (customerId: string) => {
    setLoadingProspectData(true);
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      // Fetch greeting message and metadata
      const greetingResponse = await fetch(`/api/partner/prospects/greeting-message?customerId=${customerId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (greetingResponse.ok) {
        const greetingData = await greetingResponse.json();
        if (greetingData.success && greetingData.data?.greetingMessage) {
          setProspectGreeting(greetingData.data.greetingMessage);
        }
        if (greetingData.data?.voiceInfo?.selectedVoiceId) {
          setProspectVoiceId(greetingData.data.voiceInfo.selectedVoiceId);
        }
        // Store metadata values for agent creation
        if (greetingData.data?.metadataValues) {
          setProspectMetadata(greetingData.data.metadataValues);
        }
      }
    } catch (error) {
      console.error('Error fetching prospect data:', error);
    } finally {
      setLoadingProspectData(false);
    }
  };

  // Load agent data for edit mode
  const loadAgentData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;
      const response = await fetch(`/api/partner/knova-agents/${agentId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const agent = await response.json();
        setAgentData(agent);

        // Parse llmConfig to get agentMode
        let agentMode: AgentMode = 'moderate';
        if (agent.llmConfig) {
          const llmConfig = typeof agent.llmConfig === 'string' ? JSON.parse(agent.llmConfig) : agent.llmConfig;
          agentMode = llmConfig.agentMode || 'moderate';
        }

        reset({
          customerId: agent.customerId || '',
          knowledgeBaseIds: agent.knowledgeBaseIds || [],
          agentName: agent.name || '',
          systemPrompt: agent.systemPrompt || '',
          voiceId: agent.voiceConfig?.voiceId || '',
          voiceProvider: agent.voiceConfig?.provider || 'inworld',
          language: agent.language || 'en-US',
          greetingMessage: agent.greetingMessage || '',
          agentType: agent.agentType || 'website',
          communicationChannel: agent.communicationChannel || 'telephony',
          agentMode: agentMode,
          enableBackchannel: agent.backchannelConfig?.enabled ?? true,
          backchannelWords: agent.backchannelConfig?.words || ['yeah', 'uh-huh', 'I see', 'got it'],
          normalizeForSpeech: agent.speechConfig?.normalizeForSpeech ?? true,
          functionCalls: agent.toolDefinitions ? JSON.parse(agent.toolDefinitions) : [],
        });

        setCurrentTab('basic');
      }
    } catch (error) {
      console.error('Error loading agent data:', error);
      toast.error('Failed to load agent data');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle template selection - apply system prompt and load tools
  const handleTemplateSelect = async (template: AgentTemplate) => {
    setSelectedTemplate(template);
    setValue('templateId', template.id, { shouldValidate: true });

    // Get customer info for template variable replacement
    const customer = customers.find(c => (c.customerId || c.id) === selectedCustomerId);
    let systemPrompt = template.systemPrompt;

    // Replace template variables with customer data
    if (customer) {
      systemPrompt = systemPrompt
        .replace(/\{\{business_name\}\}/gi, customer.companyName || `${customer.firstName} ${customer.lastName}` || 'the business')
        .replace(/\{\{agent_name\}\}/gi, watch('agentName') || 'AI Assistant')
        .replace(/\{\{services_category\}\}/gi, 'professional services');
    }

    setValue('systemPrompt', systemPrompt, { shouldValidate: true });

    // Load function calls from template's toolNames
    if (template.toolNames && template.toolNames.length > 0 && selectedCustomerId) {
      try {
        const token = localStorage.getItem('partner_token');
        if (!token) return;

        // Fetch tool schemas for the customer to match with template toolNames
        const response = await fetch(`/api/partner/customers/${selectedCustomerId}/tool-schemas`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          const allTools: FunctionCall[] = [];

          // Iterate through all apps and their tools
          Object.entries(data.apps || {}).forEach(([appName, tools]) => {
            (tools as any[]).forEach((tool: any) => {
              // Check if this tool is in the template's toolNames
              const toolIdentifier = `${appName}:${tool.toolName}`;
              const toolNameLower = tool.toolName?.toLowerCase();

              if (template.toolNames.some(tn =>
                tn === toolIdentifier ||
                tn.toLowerCase() === toolNameLower ||
                tn === tool.toolName
              )) {
                allTools.push({
                  appName: appName,
                  toolName: tool.toolName,
                  customName: tool.displayName || tool.toolName,
                  customDescription: tool.description || '',
                  isConfigured: false,
                  parameters: tool.inputSchema ? {
                    type: "object" as const,
                    properties: tool.inputSchema.properties || {},
                    required: tool.inputSchema.required || []
                  } : undefined
                });
              }
            });
          });

          if (allTools.length > 0) {
            setValue('functionCalls', allTools, { shouldDirty: true });
            toast.success(`Loaded ${allTools.length} tool(s) from template`);
          }
        }
      } catch (error) {
        console.error('Error loading tools from template:', error);
      }
    }

    setHasUnsavedChanges(true);
    toast.success(`Template "${template.name}" applied`);
  };

  // Voice playback handler - generates TTS preview using greeting message
  const handleVoicePlayback = async (voice: Voice) => {
    // If already playing this voice, stop it
    if (playingVoiceId === voice.id) {
      audioRef.current?.pause();
      setPlayingVoiceId(null);
      return;
    }

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // Get the greeting message to use for preview
    const greetingMessage = watch('greetingMessage') || 'Hello! Thank you for calling. How can I help you today?';
    const previewText = greetingMessage.substring(0, 160); // Limit to 160 chars for preview

    setGeneratingPreview(voice.id);
    setPlayingVoiceId(null);

    try {
      // Determine which TTS API to use based on provider
      const ttsEndpoint = voice.provider === 'cartesia' ? '/api/cartesia/tts' : '/api/inworld/tts';

      const response = await fetch(ttsEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: previewText,
          voiceId: voice.voiceId || voice.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate voice preview');
      }

      const data = await response.json();

      if (data.success && data.audioData) {
        // Convert base64 to audio blob and play
        const audioBlob = new Blob(
          [Uint8Array.from(atob(data.audioData), c => c.charCodeAt(0))],
          { type: data.contentType || 'audio/wav' }
        );
        const audioUrl = URL.createObjectURL(audioBlob);

        audioRef.current = new Audio(audioUrl);
        audioRef.current.onended = () => {
          setPlayingVoiceId(null);
          URL.revokeObjectURL(audioUrl);
        };
        audioRef.current.onerror = () => {
          setPlayingVoiceId(null);
          toast.error('Error playing audio');
        };

        await audioRef.current.play();
        setPlayingVoiceId(voice.id);
      }
    } catch (error) {
      console.error('Error generating voice preview:', error);
      toast.error('Failed to generate voice preview');
    } finally {
      setGeneratingPreview(null);
    }
  };

  // Handle close with unsaved changes check
  const handleClose = () => {
    // Skip unsaved changes check if submission was just completed
    if (isSubmissionComplete) {
      setIsSubmissionComplete(false);
      onClose();
      return;
    }

    if (hasUnsavedChanges) {
      setShowConfirmClose(true);
    } else {
      onClose();
    }
  };

  const confirmClose = () => {
    setShowConfirmClose(false);
    setHasUnsavedChanges(false);
    onClose();
  };

  const cancelClose = () => {
    setShowConfirmClose(false);
  };

  // Tab change handler
  const handleTabChange = (tab: TabType) => {
    setCurrentTab(tab);
  };

  // Form submission
  const onSubmit = (data: AgentFormData) => {
    setPendingSubmissionData(data);
    setShowSummaryModal(true);
  };

  const onError = (errors: any) => {
    console.error('Form validation errors:', errors);
    const firstError = Object.values(errors)[0] as any;
    if (firstError?.message) {
      toast.error(firstError.message);
    }
  };

  const performAgentSubmission = async (data: AgentFormData) => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) throw new Error('Not authenticated');

      // Build llmConfig based on agentMode
      const llmConfig = {
        agentMode: data.agentMode || 'moderate',
        // The actual provider/model mapping happens on the backend from env vars
      };

      const payload = {
        name: data.agentName,
        customerId: data.customerId,
        agentType: data.agentType || 'website',
        communicationChannel: data.communicationChannel || 'telephony',
        systemPrompt: data.systemPrompt,
        greetingMessage: data.greetingMessage,
        language: data.language || 'en-US',
        voiceConfig: {
          voiceId: data.voiceId,
          provider: data.voiceProvider || 'inworld'
        },
        llmConfig: llmConfig,
        knowledgeBaseIds: data.knowledgeBaseIds || [],
        backchannelConfig: {
          enabled: data.enableBackchannel ?? true,
          words: data.backchannelWords || ['yeah', 'uh-huh', 'I see', 'got it']
        },
        speechConfig: {
          normalizeForSpeech: data.normalizeForSpeech ?? true
        },
        toolDefinitions: data.functionCalls && data.functionCalls.length > 0
          ? JSON.stringify(data.functionCalls)
          : null,
        metadataValues: prospectMetadata || null
      };

      console.log('[KnovaAgentModal] Submitting agent with payload:', JSON.stringify(payload, null, 2));
      console.log('[KnovaAgentModal] Function calls:', data.functionCalls);
      console.log('[KnovaAgentModal] Tool definitions string:', payload.toolDefinitions);

      const url = mode === 'create'
        ? '/api/partner/knova-agents'
        : `/api/partner/knova-agents/${agentId}`;
      const method = mode === 'create' ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to ${mode} agent`);
      }

      const result = await response.json();
      toast.success(`Agent ${mode === 'create' ? 'created' : 'updated'} successfully!`);

      // Close all modals and reset states BEFORE calling onClose
      setShowSummaryModal(false);
      setShowConfirmClose(false);
      setIsSubmissionComplete(true);
      setHasUnsavedChanges(false);

      // Notify parent
      onAgentSaved?.(result);

      // Close the modal - parent will set isOpen to false
      onClose();

      // Reset form state after closing (for next time modal opens)
      setTimeout(() => {
        reset({
          customerId: '',
          knowledgeBaseIds: [],
          templateId: '',
          agentName: '',
          systemPrompt: '',
          voiceId: '',
          voiceProvider: 'inworld',
          language: 'en-US',
          greetingMessage: '',
          agentType: 'website',
          communicationChannel: 'telephony',
          agentMode: 'moderate',
          enableBackchannel: true,
          backchannelWords: ['yeah', 'uh-huh', 'I see', 'got it'],
          normalizeForSpeech: true,
          functionCalls: [],
        });
      }, 100);
    } catch (error) {
      console.error('Error saving agent:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save agent');
    } finally {
      setIsSaving(false);
    }
  };

  // Prepare summary data
  const prepareSummaryData = (data: AgentFormData) => {
    const selectedCustomer = customers.find(c => (c.customerId || c.id) === data.customerId);
    const selectedVoice = voices.find(v => v.id === data.voiceId || v.voiceId === data.voiceId);
    const selectedKbs = knowledgeBases.filter(kb => data.knowledgeBaseIds?.includes(kb.id));
    const modeOption = AGENT_MODE_OPTIONS.find(m => m.value === data.agentMode);
    const voiceProvider = data.voiceProvider || selectedVoice?.provider || 'inworld';

    return {
      agentName: data.agentName,
      generalPrompt: data.systemPrompt,
      customerId: data.customerId || '',
      customerName: selectedCustomer?.companyName || `${selectedCustomer?.firstName} ${selectedCustomer?.lastName}` || 'Unknown',
      voiceId: data.voiceId,
      voiceName: selectedVoice?.displayName || selectedVoice?.name || data.voiceId,
      voiceProvider: voiceProvider === 'inworld' ? 'Inworld' : 'Cartesia',
      language: data.language || 'en-US',
      beginMessage: data.greetingMessage,
      agentMode: modeOption?.label || 'Moderate',
      functionCalls: data.functionCalls || [],
      knowledgeBaseIds: data.knowledgeBaseIds || [],
      knowledgeBases: selectedKbs.map(kb => ({
        id: kb.id,
        name: kb.name,
        description: kb.description,
        fileCount: kb.totalFiles,
        totalSize: kb.totalSize
      }))
    };
  };

  // Tabs configuration - Customer is first
  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'customer', label: 'Customer', icon: <FiUser className="w-4 h-4" /> },
    { id: 'setup', label: 'Template', icon: <FiFileText className="w-4 h-4" /> },
    { id: 'basic', label: 'Basic', icon: <FiSettings className="w-4 h-4" /> },
    { id: 'advanced', label: 'Advanced', icon: <FiZap className="w-4 h-4" /> },
    { id: 'functions', label: 'Functions', icon: <FiBook className="w-4 h-4" /> },
  ];

  // Filter and sort voices - prospect voice first, then by search
  const filteredVoices = voices
    .filter(voice =>
      voice.name.toLowerCase().includes(voiceSearch.toLowerCase()) ||
      voice.displayName?.toLowerCase().includes(voiceSearch.toLowerCase()) ||
      voice.provider?.toLowerCase().includes(voiceSearch.toLowerCase()) ||
      voice.gender?.toLowerCase().includes(voiceSearch.toLowerCase())
    )
    .map(voice => ({
      ...voice,
      isProspectVoice: prospectVoiceId ? (voice.id === prospectVoiceId || voice.voiceId === prospectVoiceId) : false
    }))
    .sort((a, b) => {
      // Prospect voice always first
      if (a.isProspectVoice && !b.isProspectVoice) return -1;
      if (!a.isProspectVoice && b.isProspectVoice) return 1;
      // Then sort by provider (inworld first)
      if (a.provider === 'inworld' && b.provider !== 'inworld') return -1;
      if (a.provider !== 'inworld' && b.provider === 'inworld') return 1;
      // Then alphabetically by name
      return (a.name || '').localeCompare(b.name || '');
    });

  // Render Customer Tab (First tab)
  const renderCustomerTab = () => (
    <div className="space-y-6">
      {/* Customer Selection */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <FiUser className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Select Customer</h3>
        </div>
        <p className="text-sm text-gray-400">Choose the customer this agent will serve. This will load their greeting and voice preferences from onboarding.</p>

        {loadingCustomers ? (
          <div className="flex items-center gap-2 text-gray-400 py-4">
            <FiLoader className="w-4 h-4 animate-spin" />
            <span>Loading customers...</span>
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <FiUser className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No customers found. Create a customer first.</p>
          </div>
        ) : (
          <div className="grid gap-3 max-h-[300px] overflow-y-auto">
            {customers.map((customer) => {
              const customerId = customer.customerId || customer.id;
              const isSelected = selectedCustomerId === customerId;
              return (
                <label
                  key={customerId}
                  className={clsx(
                    'flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-all',
                    isSelected
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                  )}
                >
                  <input
                    type="radio"
                    value={customerId}
                    {...register('customerId')}
                    className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-white">
                      {customer.companyName || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email}
                    </p>
                    <p className="text-sm text-gray-400">{customer.email}</p>
                  </div>
                  {isSelected && <FiCheck className="w-5 h-5 text-blue-500" />}
                </label>
              );
            })}
          </div>
        )}
        {errors.customerId && (
          <p className="text-red-400 text-sm">{errors.customerId.message}</p>
        )}
      </div>
    </div>
  );

  // Render Setup Tab (Template Selection Only)
  const renderSetupTab = () => (
    <div className="space-y-6">
      {/* Agent Name */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">Agent Name *</label>
        <input
          type="text"
          {...register('agentName')}
          placeholder="e.g., AI Receptionist"
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {errors.agentName && <p className="text-red-400 text-sm">{errors.agentName.message}</p>}
      </div>

      {/* Template Selection */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <FiFileText className="w-5 h-5 text-green-400" />
          <h3 className="text-lg font-semibold text-white">Select Template</h3>
        </div>
        <p className="text-sm text-gray-400">Choose a template to automatically configure your agent&apos;s system prompt and behavior.</p>

        {loadingTemplates ? (
          <div className="flex items-center gap-2 text-gray-400 py-4">
            <FiLoader className="w-4 h-4 animate-spin" />
            <span>Loading templates...</span>
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <FiFileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No templates available.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {templates.map((template) => {
              const isSelected = selectedTemplate?.id === template.id;
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleTemplateSelect(template)}
                  className={clsx(
                    'flex items-start gap-4 p-4 rounded-lg border text-left transition-all',
                    isSelected
                      ? 'border-green-500 bg-green-500/10'
                      : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                  )}
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <FiFileText className="w-5 h-5 text-green-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-white">{template.name}</p>
                      <span className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 rounded">{template.version}</span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">{template.description || template.useCase}</p>
                    <p className="text-xs text-gray-500 mt-2">Category: {template.category}</p>
                  </div>
                  {isSelected && <FiCheck className="w-5 h-5 text-green-500 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // Render Basic Tab
  const renderBasicTab = () => (
    <div className="space-y-6">
      {/* System Prompt */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">System Prompt *</label>
        <p className="text-xs text-gray-500">This is the main instruction for your AI agent. Select a template to auto-populate.</p>
        <textarea
          {...register('systemPrompt')}
          rows={8}
          placeholder="Enter the system prompt..."
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
        {errors.systemPrompt && <p className="text-red-400 text-sm">{errors.systemPrompt.message}</p>}
      </div>

      {/* Greeting Message */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="block text-sm font-medium text-gray-300">Greeting Message</label>
          {loadingProspectData && <FiLoader className="w-3 h-3 animate-spin text-gray-400" />}
          {prospectGreeting && <span className="text-xs text-green-400">(Loaded from onboarding)</span>}
        </div>
        <textarea
          {...register('greetingMessage')}
          rows={3}
          placeholder="Hi! Thank you for calling. How can I help you today?"
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
        {errors.greetingMessage && <p className="text-red-400 text-sm">{errors.greetingMessage.message}</p>}
      </div>

      {/* Language */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">Language</label>
        <select
          {...register('language')}
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
        >
          {LANGUAGE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Voice Selection */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FiVolume2 className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">Voice</h3>
          {prospectVoiceId && <span className="text-xs text-green-400">(Pre-selected from onboarding)</span>}
        </div>

        {/* Search */}
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={voiceSearch}
            onChange={(e) => setVoiceSearch(e.target.value)}
            placeholder="Search voices..."
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
          />
        </div>

        {loadingVoices ? (
          <div className="flex items-center gap-2 text-gray-400">
            <FiLoader className="w-4 h-4 animate-spin" />
            <span>Loading voices...</span>
          </div>
        ) : filteredVoices.length === 0 ? (
          <div className="text-gray-400 text-center py-4">
            No voices found. Try a different search term.
          </div>
        ) : (
          <div className="grid gap-2 max-h-[250px] overflow-y-auto">
            {filteredVoices.map((voice) => {
              const isSelected = selectedVoiceId === voice.id || selectedVoiceId === voice.voiceId;
              const isGenerating = generatingPreview === voice.id;
              const isPlaying = playingVoiceId === voice.id;

              return (
                <label
                  key={voice.id}
                  className={clsx(
                    'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                    voice.isProspectVoice
                      ? 'border-green-500 bg-green-500/10 ring-1 ring-green-500/30'
                      : isSelected
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                  )}
                  onClick={() => {
                    setValue('voiceId', voice.id, { shouldValidate: true });
                    setValue('voiceProvider', voice.provider, { shouldValidate: true });
                  }}
                >
                  <input
                    type="radio"
                    value={voice.id}
                    checked={isSelected}
                    onChange={() => {
                      setValue('voiceId', voice.id, { shouldValidate: true });
                      setValue('voiceProvider', voice.provider, { shouldValidate: true });
                    }}
                    className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-white truncate">{voice.displayName || voice.name}</p>
                      {voice.isProspectVoice && (
                        <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium bg-green-500/20 text-green-400 rounded">
                          Selected
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={clsx(
                        'px-1.5 py-0.5 text-[10px] font-medium rounded',
                        voice.provider === 'inworld' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                      )}>
                        {voice.provider === 'inworld' ? 'Inworld' : 'Cartesia'}
                      </span>
                      {voice.gender && (
                        <span className="text-xs text-gray-400 capitalize">{voice.gender}</span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleVoicePlayback(voice);
                    }}
                    disabled={isGenerating}
                    className={clsx(
                      'p-2 rounded-full transition-colors flex-shrink-0',
                      isGenerating
                        ? 'bg-gray-600 cursor-wait'
                        : isPlaying
                          ? 'bg-green-600 hover:bg-green-500'
                          : 'bg-gray-700 hover:bg-gray-600'
                    )}
                    title="Preview voice with greeting message"
                  >
                    {isGenerating ? (
                      <FiLoader className="w-4 h-4 animate-spin" />
                    ) : isPlaying ? (
                      <FiPause className="w-4 h-4" />
                    ) : (
                      <FiPlay className="w-4 h-4" />
                    )}
                  </button>
                </label>
              );
            })}
          </div>
        )}
        {errors.voiceId && <p className="text-red-400 text-sm">{errors.voiceId.message}</p>}
        <p className="text-xs text-gray-500">
          Click the play button to preview the voice using your greeting message.
        </p>
      </div>
    </div>
  );

  // Render Advanced Tab (Agent Mode Only)
  const renderAdvancedTab = () => {
    const currentAgentMode = watch('agentMode') || 'moderate';

    return (
      <div className="space-y-6">
        {/* Agent Mode Selection */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <FiZap className="w-5 h-5 text-yellow-400" />
            <h3 className="text-lg font-semibold text-white">Agent Mode</h3>
          </div>
          <p className="text-sm text-gray-400">
            Select the intelligence level for your agent. Higher modes provide better understanding but may have higher latency.
          </p>

          <div className="grid gap-3">
            {AGENT_MODE_OPTIONS.map((option) => {
              const isSelected = currentAgentMode === option.value;
              return (
                <label
                  key={option.value}
                  className={clsx(
                    'flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-all',
                    isSelected
                      ? 'border-yellow-500 bg-yellow-500/10'
                      : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                  )}
                >
                  <input
                    type="radio"
                    value={option.value}
                    {...register('agentMode')}
                    className="mt-1 w-4 h-4 text-yellow-600 bg-gray-700 border-gray-600"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-white">{option.label}</p>
                      {option.value === 'essential' && (
                        <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded">Fastest</span>
                      )}
                      {option.value === 'moderate' && (
                        <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded">Recommended</span>
                      )}
                      {option.value === 'premium' && (
                        <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded">Smartest</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mt-1">{option.description}</p>
                  </div>
                  {isSelected && <FiCheck className="w-5 h-5 text-yellow-500 flex-shrink-0" />}
                </label>
              );
            })}
          </div>
        </div>

        {/* Backchannel Settings */}
        <div className="space-y-4 pt-4 border-t border-gray-800">
          <div className="flex items-center gap-3">
            <FiInfo className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Backchannel</h3>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              {...register('enableBackchannel')}
              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded"
            />
            <span className="text-gray-300">Enable backchannel responses</span>
          </label>
          <p className="text-xs text-gray-500">
            Backchannel responses like &quot;uh-huh&quot;, &quot;I see&quot; make conversations feel more natural.
          </p>
        </div>

        {/* Speech Normalization */}
        <div className="space-y-4 pt-4 border-t border-gray-800">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              {...register('normalizeForSpeech')}
              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded"
            />
            <span className="text-gray-300">Normalize text for speech</span>
          </label>
          <p className="text-xs text-gray-500">
            Converts numbers, abbreviations, and symbols to spoken form for better TTS output.
          </p>
        </div>
      </div>
    );
  };

  // Render Functions Tab
  const renderFunctionsTab = () => {
    if (!selectedCustomerId) {
      return (
        <div className="text-center py-12 text-gray-400">
          <FiAlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">Customer Required</p>
          <p className="text-sm mt-2">Please select a customer first to configure function calls.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <FiBook className="w-5 h-5 text-orange-400" />
          <h3 className="text-lg font-semibold text-white">Function Calls</h3>
        </div>
        <p className="text-sm text-gray-400">
          Configure tools and integrations that your agent can use during conversations.
        </p>

        <FunctionCallsPanel
          customerId={selectedCustomerId}
          agentId={agentId}
          functionCalls={functionCalls as FunctionCall[]}
          onChange={(calls) => {
            setValue('functionCalls', calls, { shouldDirty: true });
            setHasUnsavedChanges(true);
          }}
          mode={mode}
        />
      </div>
    );
  };

  // Render current tab content
  const renderTabContent = () => {
    switch (currentTab) {
      case 'customer': return renderCustomerTab();
      case 'setup': return renderSetupTab();
      case 'basic': return renderBasicTab();
      case 'advanced': return renderAdvancedTab();
      case 'functions': return renderFunctionsTab();
      default: return null;
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => {}}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/70" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Dialog.Panel className="w-full max-w-4xl bg-gray-900 rounded-2xl p-8">
                <div className="flex items-center justify-center py-12">
                  <FiLoader className="w-8 h-8 animate-spin text-blue-500" />
                  <span className="ml-3 text-gray-300">Loading agent data...</span>
                </div>
              </Dialog.Panel>
            </div>
          </div>
        </Dialog>
      </Transition>
    );
  }

  return (
    <>
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={handleClose}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/70" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-4xl bg-gray-900 rounded-2xl shadow-xl">
                  {/* Header */}
                  <div className="flex items-center justify-between p-6 border-b border-gray-800">
                    <Dialog.Title className="text-xl font-semibold text-white">
                      {mode === 'create' ? 'Create Knova Agent' : 'Edit Knova Agent'}
                    </Dialog.Title>
                    <button
                      onClick={handleClose}
                      className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
                    >
                      <FiX className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>

                  {/* Tabs */}
                  <div className="flex border-b border-gray-800 px-6 overflow-x-auto">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => handleTabChange(tab.id)}
                        className={clsx(
                          'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                          currentTab === tab.id
                            ? 'border-blue-500 text-blue-400'
                            : 'border-transparent text-gray-400 hover:text-gray-300'
                        )}
                      >
                        {tab.icon}
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSubmit(onSubmit, onError)}>
                    {/* Tab Content */}
                    <div className="p-6 max-h-[60vh] overflow-y-auto">
                      {renderTabContent()}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between p-6 border-t border-gray-800">
                      <div className="text-sm text-gray-500">
                        {hasUnsavedChanges && (
                          <span className="text-yellow-400">• Unsaved changes</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={handleClose}
                          className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSaving}
                          className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                          {isSaving ? (
                            <>
                              <FiLoader className="w-4 h-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <FiSave className="w-4 h-4" />
                              {mode === 'create' ? 'Create Agent' : 'Save Changes'}
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </form>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Summary Modal */}
      {showSummaryModal && pendingSubmissionData && (
        <AgentCreationSummaryModal
          isOpen={showSummaryModal}
          onClose={() => {
            setShowSummaryModal(false);
            setPendingSubmissionData(null);
          }}
          onConfirm={() => performAgentSubmission(pendingSubmissionData)}
          agentData={prepareSummaryData(pendingSubmissionData)}
          isCreating={isSaving}
        />
      )}

      {/* Unsaved Changes Confirmation */}
      <Transition appear show={showConfirmClose} as={Fragment}>
        <Dialog as="div" className="relative z-[60]" onClose={cancelClose}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/70" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md bg-gray-900 rounded-2xl p-6 shadow-xl">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                      <FiAlertTriangle className="w-5 h-5 text-yellow-400" />
                    </div>
                    <Dialog.Title className="text-lg font-semibold text-white">
                      Unsaved Changes
                    </Dialog.Title>
                  </div>
                  <p className="text-gray-400 mb-6">
                    You have unsaved changes. Are you sure you want to close without saving?
                  </p>
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={cancelClose}
                      className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                    >
                      Keep Editing
                    </button>
                    <button
                      type="button"
                      onClick={confirmClose}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                    >
                      Discard Changes
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
};

export default KnovaAgentModal;