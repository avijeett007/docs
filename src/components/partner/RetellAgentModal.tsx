'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { FiX, FiSave, FiLoader, FiUser, FiCheck, FiBook, FiDatabase, FiAlertTriangle, FiZap } from 'react-icons/fi';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import BasicSettingsPanel from './BasicSettingsPanel';
import AdvancedSettingsPanel from './AdvancedSettingsPanel';
import FunctionCallsPanel from './FunctionCallsPanel';
import AgentCreationSummaryModal from './AgentCreationSummaryModal';

// Customer interface
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

// Knowledge Base interface
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
  websiteUrls?: Array<{
    id: string;
    baseUrl: string;
    scrapingFrequency: string;
    isActive: boolean;
    lastScrapedAt?: string;
    nextScrapeAt?: string;
    totalPages: number;
    scrapedPages: number;
    processingPages: number;
    pages: Array<{
      id: string;
      url: string;
      title?: string;
      scrapingStatus: string;
      lastScrapedAt?: string;
    }>;
  }>;
  providerMappings?: Array<{
    id: string;
    provider: string;
    providerKnowledgeBaseId: string;
    lastSyncedAt?: string;
    syncStatus: string;
  }>;
}

// Create validation schema dynamically based on mode and existing API key
const createValidationSchema = (mode: 'create' | 'edit', hasExistingApiKey: boolean = false) => {
  const stateSchema = z.object({
    name: z.string().min(1, 'State name is required'),
    state_prompt: z.string().min(1, 'State prompt is required'),
    edges: z.array(z.object({
      description: z.string().min(1, 'Edge description is required'),
      destination_state_name: z.string().min(1, 'Destination state is required')
    })).optional(),
    tools: z.array(z.any()).optional()
  });

  const toolSchema = z.object({
    type: z.string().min(1, 'Tool type is required'),
    name: z.string().min(1, 'Tool name is required'),
    description: z.string().min(1, 'Tool description is required')
  });

  return z.object({
    // Customer selection (required for create mode, optional for edit mode)
    customerId: mode === 'create'
      ? z.string().min(1, 'Customer selection is required')
      : z.string().optional(),

    // Knowledge base selection (optional)
    knowledgeBaseIds: z.array(z.string()).optional(),

    agentName: z.string()
      .min(1, 'Agent name is required')
      .max(100, 'Agent name must be less than 100 characters'),
    generalPrompt: z.string()
      .min(10, 'System prompt must be at least 10 characters')
      .max(5000, 'System prompt must be less than 5000 characters'),
    voiceId: z.string().min(1, 'Please select a voice'),
    apiKey: mode === 'create' || !hasExistingApiKey
      ? z.string().min(1, 'Retell API key is required')
      : z.string().optional(),
    language: z.string().optional(),
    beginMessage: z.string().max(500, 'Begin message must be less than 500 characters').optional(),

    // Voice Control Settings
    voiceTemperature: z.number().min(0).max(2).optional(),
    voiceSpeed: z.number().min(0.5).max(2).optional(),
    volume: z.number().min(0).max(2).optional(),
    voiceModel: z.string().optional(),
    fallbackVoiceIds: z.array(z.string()).optional(),

    // Conversation Control Settings
    responsiveness: z.number().min(0).max(1).optional(),
    interruptionSensitivity: z.number().min(0).max(1).optional(),
    agentType: z.enum(['simple', 'advanced']).optional(),
    advancedSettings: z.any().optional(),
    states: z.array(stateSchema).optional().refine((states) => {
      if (!states || states.length === 0) return true;
      // Check for duplicate state names
      const names = states.map(s => s.name);
      return names.length === new Set(names).size;
    }, 'State names must be unique'),
    startingState: z.string().optional(),
    generalTools: z.array(toolSchema).optional(),
    boostedKeywords: z.array(z.string()).optional(),
    isOutbound: z.boolean().optional(),
    businessName: z.string().max(100, 'Business name must be less than 100 characters').optional(),
    characterName: z.string().max(50, 'Character name must be less than 50 characters').optional(),

    // Call Management Settings
    endCallAfterSilenceMs: z.number().min(10000).max(3600000).optional(), // 10s to 1hr
    maxCallDurationMs: z.number().min(60000).max(7200000).optional(), // 1min to 2hrs
    reminderTriggerMs: z.number().min(1000).max(60000).optional(), // 1s to 1min
    reminderMaxCount: z.number().min(0).max(10).optional(),

    // Backchannel Settings
    enableBackchannel: z.boolean().optional(),
    backchannelFrequency: z.number().min(0).max(1).optional(),
    backchannelWords: z.array(z.string()).optional(),

    // Audio Enhancement Settings
    ambientSound: z.string().optional(),
    ambientSoundVolume: z.number().min(0).max(2).optional(),
    normalizeForSpeech: z.boolean().optional(),
    functionCalls: z.array(z.object({
      id: z.string().optional(),
      appName: z.string(),
      toolName: z.string(),
      customName: z.string(),
      customDescription: z.string(),
      isConfigured: z.boolean().optional(),
      webhookUrl: z.string().optional(),
      parameterValues: z.record(z.any()).optional(), // Store pre-filled parameter values
      parameters: z.object({
        type: z.literal("object"),
        properties: z.record(z.any()),
        required: z.array(z.string())
      }).optional(), // JSON schema for Retell
      // Retell-specific execution settings
      speakDuringExecution: z.boolean().optional(),
      speakAfterExecution: z.boolean().optional(),
      executionMessageDescription: z.string().optional(),
      timeoutMs: z.number().optional(),
      // GHL-specific settings
      calendarId: z.string().optional(),
      calendarName: z.string().optional()
    })).optional(),
  }).refine((data) => {
    // If agent type is advanced and has states, starting state must be specified
    if (data.agentType === 'advanced' && data.states && data.states.length > 0) {
      return data.startingState && data.states.some(s => s.name === data.startingState);
    }
    return true;
  }, {
    message: 'Starting state must be selected when using advanced agent with states',
    path: ['startingState']
  });
};

// Create a base schema for type inference
const baseSchema = createValidationSchema('create', false);
type AgentFormData = z.infer<typeof baseSchema>;

interface RetellAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId?: string; // undefined for create mode
  mode: 'create' | 'edit';
  onAgentSaved?: (agent: any) => void;
  onOpenKnowledgeBaseViewer?: (knowledgeBase: any, customerId: string) => void;
}

type TabType = 'setup' | 'customer' | 'basic' | 'advanced' | 'functions';

const RetellAgentModal: React.FC<RetellAgentModalProps> = ({
  isOpen,
  onClose,
  agentId,
  mode,
  onAgentSaved,
  onOpenKnowledgeBaseViewer
}) => {
  const [currentTab, setCurrentTab] = useState<TabType>('basic'); // Will be set properly in useEffect
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [agentData, setAgentData] = useState<any>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [pendingSubmissionData, setPendingSubmissionData] = useState<any>(null);
  const [apiKeyInfo, setApiKeyInfo] = useState<{
    hasApiKey: boolean;
    status: string;
    usingPartnerKey: boolean;
    hasPartnerKeyFallback: boolean;
    lastVerified?: string;
    errorMessage?: string;
  } | null>(null);
  const [partnerApiKey, setPartnerApiKey] = useState<string>('');

  // Customer and Knowledge Base state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingKnowledgeBases, setLoadingKnowledgeBases] = useState(false);
  const [retellKbCount, setRetellKbCount] = useState<number>(0);
  const [loadingRetellKbCount, setLoadingRetellKbCount] = useState(false);

  // Voice-related state (moved from BasicSettingsPanel to persist across tab switches)
  const [voices, setVoices] = useState<any[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(true);
  const [voicesError, setVoicesError] = useState<string | null>(null);
  const [needsApiKeyForVoices, setNeedsApiKeyForVoices] = useState(false);

  // Confirmation modal state
  const [showConfirmClose, setShowConfirmClose] = useState(false);



  // Open knowledge base viewer
  const openKnowledgeBaseViewer = (kb: KnowledgeBase) => {
    console.log('[RetellAgentModal] Opening knowledge base viewer:', {
      knowledgeBase: kb.name,
      selectedCustomerId,
      hasCallback: !!onOpenKnowledgeBaseViewer
    });

    if (onOpenKnowledgeBaseViewer && selectedCustomerId) {
      // Reset form dirty state to prevent unsaved changes popup
      const currentFormState = formMethods.getValues();
      formMethods.reset(currentFormState, { keepDirty: false });
      onOpenKnowledgeBaseViewer(kb, selectedCustomerId);
    } else {
      console.warn('[RetellAgentModal] Cannot open knowledge base viewer:', {
        hasCallback: !!onOpenKnowledgeBaseViewer,
        selectedCustomerId
      });
    }
  };

  // Fetch customers for partner
  const fetchCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch('/api/partner/customers', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cookie': `partner_token=${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCustomers(data.data || []); // Fix: use data.data instead of data.customers
      } else {
        console.error('Failed to fetch customers:', response.status);
        toast.error('Failed to load customers');
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast.error('Failed to load customers');
    } finally {
      setLoadingCustomers(false);
    }
  };

  // Fetch knowledge bases for selected customer
  const fetchKnowledgeBases = async (customerId: string) => {
    if (!customerId) {
      setKnowledgeBases([]);
      return;
    }

    setLoadingKnowledgeBases(true);
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch(`/api/partner/customers/${customerId}/knowledge-bases`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cookie': `partner_token=${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setKnowledgeBases(data.data?.knowledgeBases || []);
      } else {
        console.error('Failed to fetch knowledge bases:', response.status);
        setKnowledgeBases([]);
      }
    } catch (error) {
      console.error('Error fetching knowledge bases:', error);
      setKnowledgeBases([]);
    } finally {
      setLoadingKnowledgeBases(false);
    }
  };

  // Map agent to customer in edit mode
  const mapAgentToCustomer = async (customerId: string) => {
    if (!agentId || mode !== 'edit') return;

    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch(`/api/partner/retell-agents/${agentId}/map-customer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          customerId: customerId,
          profitMultiplier: 1.2 // Default multiplier
        })
      });

      if (response.ok) {
        // Update agent data to reflect the new customer assignment
        if (agentData) {
          setAgentData({
            ...agentData,
            customerId: customerId
          });
        }
        toast.success('Agent successfully assigned to customer');
      } else {
        console.error('Failed to map agent to customer');
        toast.error('Failed to assign agent to customer');
      }
    } catch (error) {
      console.error('Error mapping agent to customer:', error);
      toast.error('Failed to assign agent to customer');
    }
  };

  // Fetch Retell KB count for pricing display
  const fetchRetellKbCount = async () => {
    setLoadingRetellKbCount(true);
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch('/api/partner/retell-kb-count', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cookie': `partner_token=${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRetellKbCount(data.count || 0);
      } else {
        console.error('Failed to fetch Retell KB count:', response.status);
        setRetellKbCount(0);
      }
    } catch (error) {
      console.error('Error fetching Retell KB count:', error);
      setRetellKbCount(0);
    } finally {
      setLoadingRetellKbCount(false);
    }
  };

  // Fetch partner's API key for create mode
  const fetchPartnerApiKey = async () => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        console.log('[fetchPartnerApiKey] No token found');
        return;
      }

      console.log('[fetchPartnerApiKey] Fetching partner settings...');
      const response = await fetch('/api/partner/settings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('[fetchPartnerApiKey] Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('[fetchPartnerApiKey] Response data:', {
          hasRetellApiKey: !!data.retellApiKey,
          retellApiKeyLength: data.retellApiKey ? data.retellApiKey.length : 0
        });

        if (data.retellApiKey) {
          console.log('[fetchPartnerApiKey] Found Retell API key, pre-filling form');
          setPartnerApiKey(data.retellApiKey);
          // Pre-populate the form with partner's API key
          setValue('apiKey', data.retellApiKey, { shouldValidate: false });
        } else {
          console.log('[fetchPartnerApiKey] No Retell API key found in response');
        }
      } else {
        console.error('[fetchPartnerApiKey] API request failed:', response.status);
      }
    } catch (error) {
      console.error('Error fetching partner API key:', error);
    }
  };



  // Fetch API key information for existing agents
  const fetchApiKeyInfo = async (agentId: string) => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch(`/api/partner/retell-agents/${agentId}/api-key`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setApiKeyInfo(data);
      }
    } catch (error) {
      console.error('Error fetching API key info:', error);
    }
  };

  // Load voices using partner's API key
  const loadVoices = async () => {
    try {
      setVoicesLoading(true);
      setVoicesError(null);
      setNeedsApiKeyForVoices(false);

      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch('/api/partner/retell-agents/voices', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const voiceList = data.voices || [];
        setVoices(voiceList);

        // Set first voice as default if no voice is currently selected
        const currentVoiceId = watch('voiceId');
        if (!currentVoiceId && voiceList.length > 0) {
          setValue('voiceId', voiceList[0].id, { shouldValidate: true });
        }
      } else {
        const errorData = await response.json();
        if (errorData.error === 'RETELL_API_KEY_MISSING') {
          setNeedsApiKeyForVoices(true);
          setVoicesError('Please enter your Retell API key to load available voices');
        } else {
          setVoicesError('Failed to load voices: ' + (errorData.error || 'Unknown error'));
        }
        console.error('Failed to load voices:', errorData);
      }
    } catch (error) {
      console.error('Error loading voices:', error);
      setVoicesError('Failed to load voices. Please check your connection.');
    } finally {
      setVoicesLoading(false);
    }
  };

  // Load voices using provided API key
  const loadVoicesWithApiKey = async (apiKey: string) => {
    if (!apiKey || apiKey.trim() === '') {
      setVoicesError('Please enter a valid API key');
      return;
    }

    try {
      setVoicesLoading(true);
      setVoicesError(null);

      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch('/api/partner/retell-agents/voices', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ apiKey: apiKey.trim() })
      });

      if (response.ok) {
        const data = await response.json();
        const voiceList = data.voices || [];
        setVoices(voiceList);
        setNeedsApiKeyForVoices(false);

        // Set first voice as default if no voice is currently selected
        const currentVoiceId = watch('voiceId');
        if (!currentVoiceId && voiceList.length > 0) {
          setValue('voiceId', voiceList[0].id, { shouldValidate: true });
        }
      } else {
        const errorData = await response.json();
        if (errorData.error === 'Invalid Retell API key') {
          setVoicesError('Invalid API key. Please check your Retell API key and try again.');
        } else {
          setVoicesError('Failed to load voices: ' + (errorData.error || 'Unknown error'));
        }
        console.error('Failed to load voices with API key:', errorData);
      }
    } catch (error) {
      console.error('Error loading voices with API key:', error);
      setVoicesError('Failed to load voices. Please check your connection.');
    } finally {
      setVoicesLoading(false);
    }
  };

  // Load voices using the agent's own API key
  const loadVoicesWithAgentApiKey = async () => {
    try {
      setVoicesLoading(true);
      setVoicesError(null);
      setNeedsApiKeyForVoices(false);

      const token = localStorage.getItem('partner_token');
      if (!token) return;

      // Use a special endpoint that uses the agent's own API key
      const response = await fetch(`/api/partner/retell-agents/${agentId}/voices`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const voiceList = data.voices || [];
        setVoices(voiceList);

        // Set current voice as selected if it exists in the list
        const currentVoiceId = watch('voiceId');
        if (currentVoiceId && voiceList.find((v: any) => v.id === currentVoiceId)) {
          // Voice is already set correctly
        } else if (voiceList.length > 0) {
          // Set first voice as default if no voice is currently selected
          setValue('voiceId', voiceList[0].id, { shouldValidate: true });
        }
      } else {
        const errorData = await response.json();
        setVoicesError('Failed to load voices: ' + (errorData.error || 'Unknown error'));
        console.error('Failed to load voices with agent API key:', errorData);
      }
    } catch (error) {
      console.error('Error loading voices with agent API key:', error);
      setVoicesError('Failed to load voices. Please check your connection.');
    } finally {
      setVoicesLoading(false);
    }
  };

  // Form setup with default values
  const getDefaultValues = (): AgentFormData => ({
    customerId: '',
    knowledgeBaseIds: [],
    agentName: '',
    generalPrompt: '',
    voiceId: '', // Will be set to first available voice when voices load
    apiKey: '',
    language: 'multi',
    beginMessage: '',
    agentType: 'simple',
    states: [],
    startingState: '',
    generalTools: [],
    boostedKeywords: [],
    isOutbound: false,
    businessName: '',
    characterName: '',
    functionCalls: [],
    advancedSettings: {
      voiceSpeed: 1.0,
      voiceTemperature: 1.0,
      model: 'gpt-4o',
      modelTemperature: 0.2,
      modelHighPriority: false,
      interruptionSensitivity: 0.7,
      enableBackchannel: true,
      normalizeForSpeech: true,
      maxCallDurationMs: 3600000, // 1 hour
      endCallAfterSilenceMs: 600000, // 10 minutes
      webhookUrl: '',
    },
  });

  // Create dynamic validation schema based on current state
  const validationSchema = createValidationSchema(mode, apiKeyInfo?.hasApiKey || false);

  const formMethods = useForm<AgentFormData>({
    defaultValues: getDefaultValues(),
    resolver: zodResolver(validationSchema),
    mode: 'onSubmit' // Changed from 'onChange' to 'onSubmit' to allow submission attempt
  });

  const { handleSubmit, reset, setValue, watch, register, formState: { errors, isDirty } } = formMethods;

  // Debug form state (can be removed in production)
  console.log('Form errors:', errors);
  console.log('Form is dirty:', isDirty);

  // Watch for changes to track unsaved changes
  useEffect(() => {
    console.log('Form isDirty changed:', isDirty);
    setHasUnsavedChanges(isDirty);
  }, [isDirty]);

  // Load agent data for edit mode
  useEffect(() => {
    if (isOpen) {
      fetchCustomers(); // Load customers for both create and edit modes
      loadVoices(); // Load voices for both create and edit modes

      if (mode === 'edit' && agentId) {
        loadAgentData();
        fetchApiKeyInfo(agentId);
        // Don't set currentTab here - let it be set after agent data is loaded
      } else if (mode === 'create') {
        reset(getDefaultValues());
        setCurrentTab('setup');
        setApiKeyInfo(null); // Clear API key info for create mode
        fetchPartnerApiKey(); // Fetch partner's API key for pre-population
      }
    }
  }, [mode, agentId, isOpen]);

  // Set appropriate tab after agent data is loaded in edit mode
  useEffect(() => {
    if (mode === 'edit' && agentData) {
      if (!agentData.customerId) {
        // Agent has no customer - show setup tab to assign customer
        setCurrentTab('setup');
      } else {
        // Agent has customer - show customer tab to view assignment and knowledge bases
        setCurrentTab('customer');
      }
    }
  }, [mode, agentData]);

  // Set initial tab for edit mode based on whether agent has customer
  useEffect(() => {
    if (mode === 'edit' && agentData) {
      // If agent has no customer, start with setup tab to allow customer selection
      // Otherwise start with basic tab
      setCurrentTab(agentData.customerId ? 'basic' : 'setup');
    }
  }, [mode, agentData]);

  // Watch for customer selection changes to load knowledge bases
  const selectedCustomerId = watch('customerId');
  useEffect(() => {
    if (selectedCustomerId) {
      fetchKnowledgeBases(selectedCustomerId);

      // In edit mode, if agent doesn't have a customer yet, map it to the selected customer
      if (mode === 'edit' && agentData && !agentData.customerId) {
        mapAgentToCustomer(selectedCustomerId);
      }
    } else {
      setKnowledgeBases([]);
    }
  }, [selectedCustomerId, mode, agentData]);

  // Fetch Retell KB count when modal opens for create mode
  useEffect(() => {
    if (isOpen && mode === 'create') {
      fetchRetellKbCount();
    }
  }, [isOpen, mode]);

  // Load voices when modal opens
  useEffect(() => {
    if (isOpen && mode === 'create') {
      // In create mode, use partner's API key
      loadVoices();
    }
    // In edit mode, voices are loaded after agent data is loaded (in loadLiveRetellData)
  }, [isOpen, mode]);

  // Auto-load voices when API key is entered (for create mode when no partner API key exists)
  const currentApiKey = watch('apiKey');
  useEffect(() => {
    if (needsApiKeyForVoices && currentApiKey && currentApiKey.trim() !== '' && voices.length === 0) {
      // Debounce the API call to avoid too many requests
      const timeoutId = setTimeout(() => {
        loadVoicesWithApiKey(currentApiKey);
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
  }, [currentApiKey, needsApiKeyForVoices, voices.length]);

  const loadAgentData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      // First, get the agent data from our database to get API key info
      const dbResponse = await fetch(`/api/partner/retell-agents/${agentId}/details`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!dbResponse.ok) {
        throw new Error('Failed to load agent data from database');
      }

      const dbData = await dbResponse.json();
      setAgentData(dbData.agent);

      // Now use the agent's API key (or partner's API key) to fetch live data from Retell
      await loadLiveRetellData(dbData.agent);

    } catch (error) {
      console.error('Error loading agent data:', error);
      toast.error('Failed to load agent data');
    } finally {
      setIsLoading(false);
    }
  };

  // Load live data directly from Retell APIs
  const loadLiveRetellData = async (agent: any) => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      // Use a new endpoint that fetches live data from Retell
      const response = await fetch(`/api/partner/retell-agents/${agentId}/live-data`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        console.error('Failed to load live Retell data, using database data as fallback');
        // Fallback to database data
        const formData = transformAgentDataToFormData(agent);
        reset(formData);
        return;
      }

      const liveData = await response.json();

      // Transform live Retell data to form data
      const formData = transformLiveRetellDataToFormData(liveData, agent);
      reset(formData);

      // Load voices using the agent's API key
      if (liveData.hasValidApiKey) {
        await loadVoicesWithAgentApiKey();
      }

      // If agent has a customer, load knowledge bases for that customer
      if (agent.customerId) {
        fetchKnowledgeBases(agent.customerId);
      }

    } catch (error) {
      console.error('Error loading live Retell data:', error);
      // Fallback to database data
      const formData = transformAgentDataToFormData(agent);
      reset(formData);
    }
  };

  // Transform live Retell data to form data
  const transformLiveRetellDataToFormData = (liveData: any, agent: any): AgentFormData => {
    console.log('[RetellAgentModal] Transforming live data to form data:', {
      functionCallsFromLiveData: liveData.functionCalls,
      functionCallsCount: liveData.functionCalls?.length || 0
    });

    return {
      customerId: agent.customerId || '',
      knowledgeBaseIds: liveData.knowledgeBaseIds || [],
      agentName: liveData.agent_name || agent.name || '',
      generalPrompt: liveData.llm?.general_prompt || '',
      voiceId: liveData.voice_id || '',
      apiKey: agent.apiKey || '', // Keep the encrypted API key from database
      language: liveData.language || 'multi',
      beginMessage: liveData.llm?.begin_message || '',
      agentType: liveData.llm?.states && liveData.llm.states.length > 0 ? 'advanced' : 'simple',
      advancedSettings: {
        voiceSpeed: liveData.voice_speed || 1.0,
        voiceTemperature: liveData.voice_temperature || 1.0,
        voiceModel: liveData.voice_model || '',
        model: liveData.llm?.model || 'gpt-4o',
        modelTemperature: liveData.llm?.model_temperature || 0.2,
        modelHighPriority: liveData.llm?.model_high_priority || false,
        interruptionSensitivity: liveData.interruption_sensitivity || 0.7,
        enableBackchannel: liveData.enable_backchannel ?? true,
        normalizeForSpeech: liveData.normalize_for_speech ?? true,
        maxCallDurationMs: liveData.max_call_duration_ms || 3600000,
        endCallAfterSilenceMs: liveData.end_call_after_silence_ms || 600000,
        webhookUrl: liveData.webhook_url || '',
      },
      states: liveData.llm?.states || [],
      startingState: liveData.llm?.starting_state || '',
      generalTools: liveData.llm?.general_tools || [],
      boostedKeywords: liveData.boosted_keywords || [],
      isOutbound: false,
      businessName: '',
      characterName: '',
      functionCalls: liveData.functionCalls || [],
    };
  };

  const transformAgentDataToFormData = (agent: any): AgentFormData => {
    return {
      customerId: agent.customerId || '', // Include customer ID for edit mode
      knowledgeBaseIds: agent.knowledgeBaseIds || [], // Load existing knowledge base IDs from Retell
      agentName: agent.name || '',
      generalPrompt: agent.llm?.generalPrompt || '',
      voiceId: agent.voiceId || '',
      apiKey: agent.apiKey || '',
      language: agent.language || 'multi',
      beginMessage: agent.llm?.beginMessage || '',
      agentType: agent.llm?.states && agent.llm.states.length > 0 ? 'advanced' : 'simple',
      advancedSettings: {
        voiceSpeed: agent.voiceConfig?.speed || 1.0,
        voiceTemperature: agent.voiceConfig?.temperature || 1.0,
        voiceModel: agent.voiceConfig?.model || '',
        model: agent.llm?.model || 'gpt-4o',
        modelTemperature: agent.llm?.temperature || 0.2,
        modelHighPriority: agent.llm?.modelHighPriority || false,
        interruptionSensitivity: agent.callConfig?.interruptionSensitivity || 0.7,
        enableBackchannel: agent.callConfig?.enableBackchannel ?? true,
        normalizeForSpeech: agent.callConfig?.normalizeForSpeech ?? true,
        maxCallDurationMs: agent.callConfig?.maxCallDurationMs || 3600000,
        endCallAfterSilenceMs: agent.callConfig?.endCallAfterSilenceMs || 600000,
        webhookUrl: agent.webhookUrl || '',
      },
      states: agent.llm?.states || [],
      startingState: agent.llm?.startingState || '',
      generalTools: agent.llm?.generalTools || [],
      boostedKeywords: [],
      isOutbound: false,
      businessName: '',
      characterName: '',
      functionCalls: agent.functionCalls?.map((fc: any) => ({
        id: fc.id,
        appName: fc.appName,
        toolName: fc.toolName,
        customName: fc.customName,
        customDescription: fc.customDescription,
        isConfigured: true,
        webhookUrl: fc.webhookUrl,
        parameterValues: fc.parameterValues || {},
        parameters: fc.parameters || {
          type: "object" as const,
          properties: {},
          required: []
        },
        speakDuringExecution: fc.speakDuringExecution,
        speakAfterExecution: fc.speakAfterExecution,
        executionMessageDescription: fc.executionMessageDescription,
        timeoutMs: fc.timeoutMs,
        calendarId: fc.calendarId,
        calendarName: fc.calendarName
      })) || [],
    };
  };

  const onSubmit = async (data: AgentFormData) => {
    console.log('=== FORM SUBMISSION SUCCESS ===');
    console.log('Form data:', data);
    console.log('===============================');

    // Clear unsaved changes state immediately when form is submitted
    setHasUnsavedChanges(false);

    if (mode === 'create') {
      // For create mode, show summary modal first
      setPendingSubmissionData(data);
      setShowSummaryModal(true);
    } else {
      // For edit mode, proceed directly (no summary needed for updates)
      await performAgentSubmission(data);
    }
  };

  const performAgentSubmission = async (data: AgentFormData) => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const endpoint = mode === 'create'
        ? '/api/partner/retell-agents/create'
        : `/api/partner/retell-agents/${agentId}/update`;

      const method = mode === 'create' ? 'POST' : 'PATCH';

      // Prepare data for submission
      const submitData = { ...data };

      // In edit mode, if no API key is provided and there's an existing one, don't send empty string
      if (mode === 'edit' && (!submitData.apiKey || submitData.apiKey.trim() === '') && apiKeyInfo?.hasApiKey) {
        delete submitData.apiKey; // Don't send API key field if it's empty in edit mode
      }

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(submitData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to ${mode} agent`);
      }

      const result = await response.json();
      toast.success(`Agent ${mode === 'create' ? 'created' : 'updated'} successfully!`);

      // Update agent data
      setAgentData(result.agent);

      // Call onAgentSaved callback
      if (onAgentSaved) {
        onAgentSaved(result.agent);
      }

      setHasUnsavedChanges(false);
      setShowSummaryModal(false);
      setPendingSubmissionData(null);
    } catch (error) {
      console.error(`Error ${mode}ing agent:`, error);
      toast.error(error instanceof Error ? error.message : `Failed to ${mode} agent`);
      // Restore unsaved changes state if there was an error
      setHasUnsavedChanges(true);
    } finally {
      setIsSaving(false);
    }
  };

  // Prepare summary data for the confirmation modal
  const prepareSummaryData = (data: AgentFormData) => {
    const selectedCustomer = customers.find(c => c.customerId === data.customerId);
    const selectedVoice = voices.find(v => v.voice_id === data.voiceId);
    const selectedKnowledgeBases = knowledgeBases.filter(kb => data.knowledgeBaseIds?.includes(kb.id));

    return {
      agentName: data.agentName,
      generalPrompt: data.generalPrompt,
      customerId: data.customerId || '',
      customerName: selectedCustomer ?
        (selectedCustomer.companyName || `${selectedCustomer.firstName} ${selectedCustomer.lastName}` || selectedCustomer.email) :
        data.customerId || 'Unknown Customer',
      voiceId: data.voiceId,
      voiceName: selectedVoice?.name || data.voiceId,
      language: data.language || 'multi',
      beginMessage: data.beginMessage,
      advancedSettings: data.advancedSettings,
      functionCalls: data.functionCalls || [],
      knowledgeBaseIds: data.knowledgeBaseIds || [],
      knowledgeBases: selectedKnowledgeBases.map(kb => ({
        id: kb.id,
        name: kb.name,
        description: kb.description,
        fileCount: kb.totalFiles,
        totalSize: kb.totalSize,
        totalWebsiteUrls: kb.totalWebsiteUrls,
        totalWebsitePages: kb.totalWebsitePages,
        scrapedWebsitePages: kb.scrapedWebsitePages
      }))
    };
  };

  const onError = (errors: any) => {
    console.log('=== FORM VALIDATION FAILED ===');
    console.log('Form validation errors:', errors);
    console.log('Current form values:', formMethods.getValues());
    console.log('===============================');

    // Create user-friendly error messages
    const errorMessages: string[] = [];

    if (errors.agentName) {
      errorMessages.push(`Agent Name: ${errors.agentName.message}`);
    }
    if (errors.generalPrompt) {
      errorMessages.push(`System Prompt: ${errors.generalPrompt.message}`);
    }
    if (errors.voiceId) {
      errorMessages.push(`Voice: ${errors.voiceId.message}`);
    }
    if (errors.apiKey) {
      errorMessages.push(`API Key: ${errors.apiKey.message}`);
    }
    if (errors.states) {
      errorMessages.push(`States: ${errors.states.message || 'Invalid state configuration'}`);
    }
    if (errors.startingState) {
      errorMessages.push(`Starting State: ${errors.startingState.message}`);
    }
    if (errors.generalTools) {
      errorMessages.push(`Tools: ${errors.generalTools.message || 'Invalid tool configuration'}`);
    }
    if (errors.businessName) {
      errorMessages.push(`Business Name: ${errors.businessName.message}`);
    }
    if (errors.characterName) {
      errorMessages.push(`Character Name: ${errors.characterName.message}`);
    }

    if (errorMessages.length > 0) {
      toast.error(`Please fix the following errors:\n${errorMessages.join('\n')}`, {
        duration: 6000,
      });
    } else {
      toast.error('Please fill in all required fields correctly');
    }
  };

  const handleTabChange = (tab: TabType) => {
    setCurrentTab(tab);
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      setShowConfirmClose(true);
      return;
    }
    onClose();
  };

  // Confirm close with unsaved changes
  const confirmClose = () => {
    setShowConfirmClose(false);
    onClose();
  };

  // Cancel close
  const cancelClose = () => {
    setShowConfirmClose(false);
  };

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
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
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
              <Dialog.Panel className="w-full max-w-6xl h-[90vh] bg-gray-900 rounded-xl shadow-xl border border-gray-800 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-800">
                  <div>
                    <Dialog.Title className="text-xl font-semibold text-white">
                      {mode === 'create' ? 'Create New Agent' : 'Edit Agent'}
                    </Dialog.Title>
                    {mode === 'edit' && agentData && (
                      <p className="text-sm text-gray-400 mt-1">
                        {agentData.name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {hasUnsavedChanges && (
                      <span className="text-xs text-amber-400">Unsaved changes</span>
                    )}
                    <button
                      onClick={handleClose}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <FiX className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                {/* Work in Progress Warning */}
                <div className="mx-6 mt-4 p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FiAlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-medium text-amber-200">Work in Progress</h4>
                      <p className="text-xs text-amber-300 mt-1">
                        The Function Calls feature is currently under development. Please avoid using it in production until further notice.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex border-b border-gray-800">
                  {(mode === 'create' || (mode === 'edit' && !agentData?.customerId)) && (
                    <button
                      onClick={() => handleTabChange('setup')}
                      className={clsx(
                        'px-6 py-3 text-sm font-medium transition-colors',
                        currentTab === 'setup'
                          ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/10'
                          : 'text-gray-400 hover:text-white hover:bg-gray-800'
                      )}
                    >
                      {mode === 'create' ? 'Setup' : 'Customer & Setup'}
                    </button>
                  )}
                  {(mode === 'edit' && agentData?.customerId) && (
                    <button
                      onClick={() => handleTabChange('customer')}
                      className={clsx(
                        'px-6 py-3 text-sm font-medium transition-colors',
                        currentTab === 'customer'
                          ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/10'
                          : 'text-gray-400 hover:text-white hover:bg-gray-800'
                      )}
                    >
                      Customer & Knowledge
                    </button>
                  )}
                  <button
                    onClick={() => handleTabChange('basic')}
                    className={clsx(
                      'px-6 py-3 text-sm font-medium transition-colors',
                      currentTab === 'basic'
                        ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/10'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    )}
                  >
                    Basic Settings
                  </button>
                  <button
                    onClick={() => handleTabChange('advanced')}
                    className={clsx(
                      'px-6 py-3 text-sm font-medium transition-colors',
                      currentTab === 'advanced'
                        ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/10'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    )}
                  >
                    Advanced Settings
                  </button>
                  <button
                    onClick={() => handleTabChange('functions')}
                    className={clsx(
                      'px-6 py-3 text-sm font-medium transition-colors flex items-center gap-2',
                      currentTab === 'functions'
                        ? 'text-amber-400 border-b-2 border-yellow-400 bg-yellow-500/10'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    )}
                  >
                    <FiZap className="w-4 h-4" />
                    Function Calls
                  </button>

                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-hidden">
                  {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="flex items-center gap-3 text-gray-400">
                        <FiLoader className="w-6 h-6 animate-spin" />
                        <span>Loading agent data...</span>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit(onSubmit, onError)} className="h-full flex flex-col">
                      <div className="flex-1 overflow-y-auto p-6">
                        {/* Tab content */}
                        {currentTab === 'setup' && (mode === 'create' || (mode === 'edit' && !agentData?.customerId)) && (
                          <div className="space-y-8">
                            {/* Customer Selection */}
                            <div className="space-y-4">
                              <div className="flex items-center gap-3">
                                <FiUser className="w-5 h-5 text-blue-400" />
                                <h3 className="text-lg font-semibold text-white">
                                  {mode === 'create' ? 'Select Customer' : 'Assign Customer'}
                                </h3>
                              </div>
                              <p className="text-gray-400 text-sm">
                                {mode === 'create'
                                  ? 'Choose which customer this agent will belong to. This determines access to knowledge bases and integrations.'
                                  : 'This agent is not currently assigned to a customer. Assign it to a customer to enable knowledge bases and function calls.'
                                }
                              </p>

                              <div className="max-w-md">
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                  Customer *
                                </label>
                                <select
                                  {...register('customerId')}
                                  disabled={loadingCustomers}
                                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                                >
                                  <option value="">
                                    {loadingCustomers ? 'Loading customers...' : 'Select a customer'}
                                  </option>
                                  {customers
                                    .filter(customer => customer.customerId) // Only show customers with valid Customer records
                                    .map((customer) => (
                                    <option key={customer.id} value={customer.customerId}>
                                      {customer.companyName || `${customer.firstName} ${customer.lastName}` || customer.email}
                                    </option>
                                  ))}
                                </select>
                                {errors.customerId && (
                                  <p className="text-red-400 text-sm mt-1">{errors.customerId.message}</p>
                                )}
                              </div>

                              {selectedCustomerId && (
                                <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                                  <div className="flex items-center gap-2 text-green-400">
                                    <FiCheck className="w-4 h-4" />
                                    <span className="text-sm font-medium">
                                      {mode === 'create' ? 'Customer Selected' : 'Customer Assigned'}
                                    </span>
                                  </div>
                                  <p className="text-sm text-green-300 mt-1">
                                    {mode === 'create' ? 'Agent will be created for: ' : 'Agent is now assigned to: '}
                                    {customers.find(c => c.customerId === selectedCustomerId)?.companyName ||
                                    customers.find(c => c.customerId === selectedCustomerId)?.email}
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Knowledge Base Selection */}
                            {selectedCustomerId && (
                              <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                  <FiBook className="w-5 h-5 text-blue-400" />
                                  <h3 className="text-lg font-semibold text-white">Knowledge Bases</h3>
                                </div>
                                <p className="text-gray-400 text-sm">
                                  Select knowledge bases to enhance your agent's responses with custom information.
                                </p>

                                {/* Retell KB Pricing Information */}
                                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                                  <div className="flex items-start gap-3">
                                    <FiAlertTriangle className="w-5 h-5 text-blue-400 mt-0.5" />
                                    <div className="flex-1">
                                      <h4 className="font-medium text-blue-400 mb-2">Retell Knowledge Base Pricing</h4>
                                      <div className="space-y-1 text-sm text-blue-300">
                                        <p>• First 10 knowledge bases: <span className="font-semibold text-green-400">Free</span></p>
                                        <p>• Additional knowledge bases: <span className="font-semibold">$8.00/month each</span></p>
                                        <p>• Usage cost: <span className="font-semibold">$0.005/min</span> for calls with KB enabled</p>
                                        {loadingRetellKbCount ? (
                                          <p className="flex items-center gap-2">
                                            <FiLoader className="w-3 h-3 animate-spin" />
                                            Loading usage...
                                          </p>
                                        ) : (
                                          <p>
                                            • Current usage: <span className="font-semibold">{retellKbCount}/10 free</span>
                                            {retellKbCount >= 10 && (
                                              <span className="text-yellow-400"> (Additional KBs will be charged)</span>
                                            )}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Knotie KB Tool Alternative */}
                                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                                  <div className="flex items-start gap-3">
                                    <FiZap className="w-5 h-5 text-green-400 mt-0.5" />
                                    <div className="flex-1">
                                      <h4 className="font-medium text-green-400 mb-2">💡 Cost-Saving Alternative: Knotie Knowledge Base Tool</h4>
                                      <div className="space-y-1 text-sm text-green-300">
                                        <p>Instead of using Retell&apos;s native KB, you can use our <span className="font-semibold">Knowledge Base Query</span> function call:</p>
                                        <p>• Cost: <span className="font-semibold text-green-400">2 Knotie Credits per query</span> (no monthly fee!)</p>
                                        <p>• Works with your existing knowledge bases</p>
                                        <p>• Perfect for smaller knowledge bases with limited data</p>
                                      </div>
                                      <div className="mt-3 p-3 bg-gray-800/50 rounded-lg">
                                        <p className="text-xs text-gray-400 mb-2">
                                          <strong>How to set up:</strong>
                                        </p>
                                        <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
                                          <li>Go to the <span className="text-purple-400 font-medium">Functions</span> tab</li>
                                          <li>Click <span className="text-purple-400 font-medium">Add Function Call</span></li>
                                          <li>Select <span className="text-purple-400 font-medium">Internal Tools → Query Knowledge Base</span></li>
                                          <li>Configure the knowledge base ID in the function settings</li>
                                        </ol>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {loadingKnowledgeBases ? (
                                  <div className="flex items-center gap-2 text-gray-400">
                                    <FiLoader className="w-4 h-4 animate-spin" />
                                    <span className="text-sm">Loading knowledge bases...</span>
                                  </div>
                                ) : knowledgeBases.length > 0 ? (
                                  <div className="space-y-3">
                                    {knowledgeBases.map((kb) => (
                                      <div key={kb.id} className="flex items-start gap-3 p-4 bg-gray-800 border border-gray-700 rounded-lg hover:border-purple-500/50 transition-colors">
                                        <label className="flex items-start gap-3 flex-1 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            value={kb.id}
                                            {...register('knowledgeBaseIds')}
                                            className="mt-1 w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500 focus:ring-2"
                                          />
                                          <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                              <h4 className="text-white font-medium">{kb.name}</h4>
                                              {kb.isReady ? (
                                                <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">Ready</span>
                                              ) : (
                                                <span className="px-2 py-1 bg-yellow-500/20 text-red-400 text-xs rounded">Processing</span>
                                              )}
                                              {kb.providerMappings?.some(mapping => mapping.provider === 'retell' && mapping.syncStatus === 'active') && (
                                                <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded flex items-center gap-1">
                                                  <FiZap className="w-3 h-3" />
                                                  Retell KB Exists
                                                </span>
                                              )}
                                            </div>
                                            {kb.description && (
                                              <p className="text-gray-400 text-sm mt-1">{kb.description}</p>
                                            )}
                                            <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
                                              <span>{kb.totalFiles} files</span>
                                              {(kb.totalWebsiteUrls || 0) > 0 && (
                                                <span>{kb.totalWebsiteUrls} websites ({kb.totalWebsitePages || 0} pages)</span>
                                              )}
                                              <span>{(kb.totalSize / (1024 * 1024)).toFixed(2)} MB</span>
                                              {kb.isReady && (
                                                <span className="text-green-400">
                                                  {kb.readyFiles} files + {kb.scrapedWebsitePages || 0} pages ready
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </label>
                                        <button
                                          type="button"
                                          onClick={() => openKnowledgeBaseViewer(kb)}
                                          className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm"
                                        >
                                          <FiDatabase className="w-4 h-4" />
                                          View
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-center py-8">
                                    <FiDatabase className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                                    <h4 className="text-lg font-medium text-gray-400 mb-2">No Knowledge Bases Available</h4>
                                    <p className="text-gray-500">
                                      This customer has no knowledge bases configured yet.
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {currentTab === 'customer' && mode === 'edit' && agentData?.customerId && (
                          <div className="space-y-8">
                            {/* Current Customer Info */}
                            <div className="space-y-4">
                              <div className="flex items-center gap-3">
                                <FiUser className="w-5 h-5 text-blue-400" />
                                <h3 className="text-lg font-semibold text-white">Current Customer Assignment</h3>
                              </div>

                              {(() => {
                                const currentCustomer = customers.find(c => c.customerId === agentData.customerId);
                                return currentCustomer ? (
                                  <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                                    <div className="flex items-center gap-2 text-green-400 mb-2">
                                      <FiCheck className="w-4 h-4" />
                                      <span className="font-medium">Agent is assigned to:</span>
                                    </div>
                                    <p className="text-white font-medium">
                                      {currentCustomer.companyName || `${currentCustomer.firstName} ${currentCustomer.lastName}` || currentCustomer.email}
                                    </p>
                                    <p className="text-gray-400 text-sm mt-1">{currentCustomer.email}</p>
                                  </div>
                                ) : (
                                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                                    <div className="flex items-center gap-2 text-yellow-400 mb-2">
                                      <FiAlertTriangle className="w-4 h-4" />
                                      <span className="font-medium">Customer not found</span>
                                    </div>
                                    <p className="text-gray-400 text-sm">
                                      The assigned customer may have been deleted or is no longer accessible.
                                    </p>
                                  </div>
                                );
                              })()}
                            </div>

                            {/* Knowledge Base Section */}
                            <div className="space-y-4">
                              <div className="flex items-center gap-3">
                                <FiBook className="w-5 h-5 text-blue-400" />
                                <h3 className="text-lg font-semibold text-white">Knowledge Bases</h3>
                              </div>
                              <p className="text-gray-400 text-sm">
                                Knowledge bases currently attached to this agent from the assigned customer.
                              </p>

                              {/* Knotie KB Tool Alternative - Edit Mode */}
                              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                  <FiZap className="w-5 h-5 text-green-400 mt-0.5" />
                                  <div className="flex-1">
                                    <h4 className="font-medium text-green-400 mb-2">💡 Cost-Saving Tip: Use Knotie Knowledge Base Tool</h4>
                                    <div className="space-y-1 text-sm text-green-300">
                                      <p>Instead of Retell&apos;s native KB ($8/month + $0.005/min), use our <span className="font-semibold">Knowledge Base Query</span> function call:</p>
                                      <p>• Cost: <span className="font-semibold text-green-400">2 Knotie Credits per query</span> (no monthly fee!)</p>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-2">
                                      Set up via <span className="text-purple-400">Functions tab → Add Function Call → Internal Tools → Query Knowledge Base</span>
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {loadingKnowledgeBases ? (
                                <div className="flex items-center gap-2 text-gray-400">
                                  <FiLoader className="w-4 h-4 animate-spin" />
                                  <span className="text-sm">Loading knowledge bases...</span>
                                </div>
                              ) : knowledgeBases.length > 0 ? (
                                <div className="space-y-3">
                                  {knowledgeBases.map((kb) => (
                                    <div key={kb.id} className="flex items-start gap-3 p-4 bg-gray-800 border border-gray-700 rounded-lg">
                                      <label className="flex items-start gap-3 flex-1 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          value={kb.id}
                                          {...register('knowledgeBaseIds')}
                                          className="mt-1 w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500 focus:ring-2"
                                        />
                                        <div className="flex-1">
                                          <h4 className="font-medium text-white">{kb.name}</h4>
                                          <p className="text-sm text-gray-400 mt-1">{kb.description}</p>
                                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                            <span>{kb.totalFiles} documents</span>
                                            <span>Updated {new Date(kb.updatedAt).toLocaleDateString()}</span>
                                          </div>
                                        </div>
                                      </label>
                                      <button
                                        type="button"
                                        onClick={() => openKnowledgeBaseViewer(kb)}
                                        className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm"
                                      >
                                        <FiDatabase className="w-4 h-4" />
                                        View
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-center py-8">
                                  <FiDatabase className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                                  <h4 className="text-lg font-medium text-gray-400 mb-2">No Knowledge Bases Available</h4>
                                  <p className="text-gray-500">
                                    This customer has no knowledge bases configured yet.
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {currentTab === 'basic' && (
                          <BasicSettingsPanel
                            formMethods={formMethods}
                            errors={errors}
                            mode={mode}
                            apiKeyInfo={apiKeyInfo}
                            partnerApiKey={partnerApiKey}
                            voices={voices}
                            voicesLoading={voicesLoading}
                            voicesError={voicesError}
                            needsApiKeyForVoices={needsApiKeyForVoices}
                            loadVoicesWithApiKey={loadVoicesWithApiKey}
                            currentApiKey={currentApiKey}
                          />
                        )}
                        {currentTab === 'advanced' && (
                          <AdvancedSettingsPanel
                            formMethods={formMethods}
                            errors={errors}
                            isLoading={isLoading}
                            mode={mode}
                          />
                        )}
                        {currentTab === 'functions' && (
                          <FunctionCallsPanel
                            customerId={watch('customerId') || agentData?.customerId || ''}
                            agentId={agentId}
                            functionCalls={watch('functionCalls') || []}
                            onChange={(functionCalls) => setValue('functionCalls', functionCalls)}
                            mode={mode}
                          />
                        )}

                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between p-6 border-t border-gray-800">
                        <button
                          type="button"
                          onClick={handleClose}
                          className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                        >
                          Cancel
                        </button>
                        <div className="flex items-center gap-3">
                          <button
                            type="submit"
                            disabled={isSaving}

                            className={clsx(
                              'flex items-center gap-2 px-6 py-2 rounded-lg transition-colors',
                              isSaving
                                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-500 text-white'
                            )}
                          >
                            {isSaving ? (
                              <>
                                <FiLoader className="w-4 h-4 animate-spin" />
                                {mode === 'create' ? 'Creating...' : 'Saving...'}
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
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
      </Transition>



      {/* Confirmation Modal */}
      <Transition appear show={showConfirmClose} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={cancelClose}>
          <Transition.Child
            as="div"
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as="div"
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
                className="w-full max-w-md bg-gray-900 rounded-xl shadow-xl border border-gray-800 p-6"
              >
                <Dialog.Panel>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center">
                      <FiAlertTriangle className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-white">
                        Unsaved Changes
                      </Dialog.Title>
                      <p className="text-sm text-gray-400">
                        You have unsaved changes. Are you sure you want to close?
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 justify-end">
                    <button
                      onClick={cancelClose}
                      className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmClose}
                      className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
                    >
                      Close Anyway
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Agent Creation Summary Modal */}
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


    </>
  );
};

export default RetellAgentModal;
