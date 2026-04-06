'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { FiX, FiLoader, FiUser, FiCheck, FiBook, FiDatabase, FiAlertTriangle, FiZap, FiSettings } from 'react-icons/fi';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import VapiBasicSettingsPanel from './VapiBasicSettingsPanel';
import VapiAdvancedSettingsPanel from './VapiAdvancedSettingsPanel';
import VapiFunctionCallsPanel from './VapiFunctionCallsPanel';
import AgentCreationSummaryModal from './AgentCreationSummaryModal';

// Interfaces
interface Customer {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  companyName?: string;
  customerId?: string;
  customerPortalEnabled?: boolean;
  orderStatus?: string;
  // Computed fields
  name?: string;
  company?: string;
}

interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  fileCount: number;
  isActive: boolean;
}

interface VoiceSelection {
  provider: string;
  providerId: string;
  name: string;
}

interface FunctionCall {
  id?: string;
  appName: string;
  toolName: string;
  customName: string;
  customDescription: string;
  isConfigured?: boolean;
  webhookUrl?: string;
}

// Validation schema for basic agent info
const agentSchema = z.object({
  agentName: z.string().min(1, 'Agent name is required'),
  systemPrompt: z.string().min(1, 'System prompt is required'),
  firstMessage: z.string().optional(),
  model: z.string().optional(),
  modelProvider: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(4000).optional(),
  silenceTimeoutSeconds: z.number().min(10).max(3600).optional(),
  maxDurationSeconds: z.number().min(10).max(43200).optional(),
  backgroundSound: z.string().optional(),
  recordingEnabled: z.boolean().optional(),
  endCallMessage: z.string().optional(),
  voicemailMessage: z.string().optional(),
  apiKey: z.string().min(1, 'VAPI API key is required'),
  // Remove publicKey requirement from creation - will be added later for testing
});

type AgentFormData = z.infer<typeof agentSchema>;

interface VapiAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  agentId?: string;
  onAgentSaved?: (agent: any) => void;
}

const VapiAgentModal: React.FC<VapiAgentModalProps> = ({
  isOpen,
  onClose,
  mode,
  agentId,
  onAgentSaved
}) => {
  // State management
  const [activeTab, setActiveTab] = useState('customer');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [showSummary, setShowSummary] = useState(false);
  const [pendingSubmissionData, setPendingSubmissionData] = useState<any>(null);

  // Data states
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<VoiceSelection | null>(null);
  const [functionCalls, setFunctionCalls] = useState<FunctionCall[]>([]);

  // Selection states
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [selectedKnowledgeBases, setSelectedKnowledgeBases] = useState<string[]>([]);

  // Loading states
  const [customersLoading, setCustomersLoading] = useState(false);
  const [knowledgeBasesLoading, setKnowledgeBasesLoading] = useState(false);
  // Function calls loading is handled by FunctionCallsPanel

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
    getValues
  } = useForm<AgentFormData>({
    resolver: zodResolver(agentSchema),
    defaultValues: {
      agentName: '',
      systemPrompt: '',
      firstMessage: 'Hello! How can I help you today?',
      model: 'gpt-4o',
      modelProvider: 'openai',
      temperature: 0.7,
      maxTokens: 500,
      silenceTimeoutSeconds: 30,
      maxDurationSeconds: 600,
      backgroundSound: 'off',
      recordingEnabled: true,
      endCallMessage: '',
      voicemailMessage: '',
    }
  });

  // Load initial data when modal opens
  useEffect(() => {
    if (isOpen) {
      loadInitialData();
      if (mode === 'edit' && agentId) {
        loadAgentData();
      } else if (mode === 'create') {
        reset();
        setSelectedCustomer('');
        setSelectedKnowledgeBases([]);
        setFunctionCalls([]);
        setActiveTab('customer');
      }
    }
  }, [isOpen, mode, agentId, reset]);

  // Load knowledge bases when customer is selected
  useEffect(() => {
    if (selectedCustomer) {
      loadKnowledgeBases();
    } else {
      setKnowledgeBases([]);
      setSelectedKnowledgeBases([]);
    }
  }, [selectedCustomer]);

  // Load all required data
  const loadInitialData = async () => {
    await loadCustomers();
  };

  // Load customers
  const loadCustomers = async () => {
    try {
      setCustomersLoading(true);
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch('/api/partner/customers', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const responseData = await response.json();
        // Handle the nested data structure from the API
        const customersArray = responseData.success && Array.isArray(responseData.data)
          ? responseData.data
          : Array.isArray(responseData)
            ? responseData
            : [];
        // Successfully loaded customers
        setCustomers(customersArray);
      } else {
        console.error('Failed to load customers:', response.status);
        setCustomers([]);
      }
    } catch (error) {
      console.error('Error loading customers:', error);
      setCustomers([]);
    } finally {
      setCustomersLoading(false);
    }
  };

  // Load knowledge bases
  const loadKnowledgeBases = async () => {
    try {
      setKnowledgeBasesLoading(true);
      const token = localStorage.getItem('partner_token');
      if (!token || !selectedCustomer) {
        return;
      }

      const response = await fetch(`/api/partner/customers/${selectedCustomer}/knowledge-bases`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setKnowledgeBases(data.data?.knowledgeBases || []);
      } else {
        console.error('Failed to fetch knowledge bases:', response.status);
        toast.error('Failed to load knowledge bases');
      }
    } catch (error) {
      console.error('Error loading knowledge bases:', error);
      toast.error('Failed to load knowledge bases');
    } finally {
      setKnowledgeBasesLoading(false);
    }
  };



  // Function calls are managed by FunctionCallsPanel component, no separate loading needed

  const loadAgentData = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch(`/api/partner/vapi-agents/${agentId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        
        // Populate form with existing data
        setValue('agentName', data.name || '');
        setValue('systemPrompt', data.model?.messages?.[0]?.content || '');
        setValue('firstMessage', data.firstMessage || '');
        setValue('model', data.model?.model || 'gpt-4o');
        setValue('modelProvider', data.model?.provider || 'openai');
        setValue('temperature', data.model?.temperature || 0.7);
        setValue('maxTokens', data.model?.maxTokens || 500);
        setValue('silenceTimeoutSeconds', data.silenceTimeoutSeconds || 30);
        setValue('maxDurationSeconds', data.maxDurationSeconds || 600);
        setValue('backgroundSound', data.backgroundSound || 'off');
        setValue('recordingEnabled', data.recordingEnabled ?? true);
        setValue('endCallMessage', data.endCallMessage || '');
        setValue('voicemailMessage', data.voicemailMessage || '');

        // Set voice selection
        if (data.voice) {
          setSelectedVoice({
            provider: data.voice.provider || 'openai',
            providerId: data.voice.voiceId || '',
            name: data.voice.name || data.voice.voiceId || '',
          });
        }

        // Set selections
        setSelectedCustomer(data.customerId || '');
        setSelectedKnowledgeBases(data.knowledgeBaseIds || []);
        setFunctionCalls(data.functionCalls || []);
      }
    } catch (error) {
      console.error('Error loading agent data:', error);
      toast.error('Failed to load agent data');
    } finally {
      setIsLoading(false);
    }
  };

  // Validation functions
  const validateStep = (step: string): boolean => {
    switch (step) {
      case 'customer':
        return selectedCustomer !== '';
      case 'knowledge-base':
        return true; // Knowledge bases are optional
      case 'basic-settings':
        const values = getValues();
        return !!(values.agentName && values.systemPrompt && selectedVoice?.providerId);
      case 'advanced-settings':
        const advancedValues = getValues();
        return !!(advancedValues.apiKey); // API key is required

      case 'function-calls':
        return true; // Function calls are optional
      default:
        return true;
    }
  };

  const getStepStatus = (step: string): 'complete' | 'current' | 'upcoming' => {
    const steps = ['customer', 'knowledge-base', 'basic-settings', 'advanced-settings', 'function-calls'];
    const currentIndex = steps.indexOf(activeTab);
    const stepIndex = steps.indexOf(step);

    if (stepIndex < currentIndex) {
      return validateStep(step) ? 'complete' : 'current';
    } else if (stepIndex === currentIndex) {
      return 'current';
    } else {
      return 'upcoming';
    }
  };

  // Prepare summary data for the confirmation modal
  const prepareSummaryData = (data: AgentFormData) => {
    const selectedCustomerData = Array.isArray(customers) ? customers.find(c => c.customerId === selectedCustomer) : null;
    // Voice data is now handled by selectedVoice state
    const selectedKnowledgeBasesData = Array.isArray(knowledgeBases) ? knowledgeBases.filter(kb => selectedKnowledgeBases.includes(kb.id)) : [];

    return {
      agentName: data.agentName,
      generalPrompt: data.systemPrompt,
      customerId: selectedCustomer || '',
      customerName: selectedCustomerData ?
        (selectedCustomerData.companyName ||
         (selectedCustomerData.firstName && selectedCustomerData.lastName
           ? `${selectedCustomerData.firstName} ${selectedCustomerData.lastName}`
           : selectedCustomerData.name || selectedCustomerData.email)) :
        selectedCustomer || 'Unknown Customer',
      voiceId: selectedVoice?.providerId || '',
      voiceName: selectedVoice?.name || 'No voice selected',
      voiceProvider: selectedVoice?.provider || '',
      language: 'en', // Default language for VAPI
      beginMessage: data.firstMessage,
      advancedSettings: {
        model: data.model,
        modelProvider: data.modelProvider,
        temperature: data.temperature,
        maxTokens: data.maxTokens,
        silenceTimeoutSeconds: data.silenceTimeoutSeconds,
        maxDurationSeconds: data.maxDurationSeconds,
        backgroundSound: data.backgroundSound,
        recordingEnabled: data.recordingEnabled,
        endCallMessage: data.endCallMessage,
        voicemailMessage: data.voicemailMessage
      },
      functionCalls: functionCalls || [],
      knowledgeBaseIds: selectedKnowledgeBases || [],
      knowledgeBases: selectedKnowledgeBasesData.map(kb => ({
        id: kb.id,
        name: kb.name,
        description: kb.description,
        fileCount: kb.fileCount,
        totalSize: 0, // VAPI doesn't provide size info
        totalWebsiteUrls: 0,
        totalWebsitePages: 0,
        scrapedWebsitePages: 0
      }))
    };
  };

  const performAgentSubmission = async (data: AgentFormData) => {
    try {
      setIsSaving(true);
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      // Validate voice selection
      if (!selectedVoice || !selectedVoice.provider || !selectedVoice.providerId) {
        toast.error('Please select a voice before creating the agent');
        return;
      }

      console.log('[VapiAgentModal] Voice selection configured');

      // Prepare the complete agent data
      const agentData = {
        ...data,
        customerId: selectedCustomer,
        knowledgeBaseIds: selectedKnowledgeBases,
        functionCalls: functionCalls,
        // Add voice information
        voiceId: selectedVoice.providerId,
        voiceProvider: selectedVoice.provider,
        // API key and public key are already in data from the form
      };

      const url = mode === 'create'
        ? '/api/partner/vapi-agents/create'
        : `/api/partner/vapi-agents/${agentId}/update`;

      const method = mode === 'create' ? 'POST' : 'PATCH';

      console.log('[VapiAgentModal] Sending agent data to API');

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(agentData)
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Agent ${mode === 'create' ? 'created' : 'updated'} successfully!`);

        onAgentSaved?.(result.agent);
        setShowSummary(false);
        setPendingSubmissionData(null);
        onClose();
      } else {
        const error = await response.json();
        toast.error(error.message || `Failed to ${mode} agent`);
      }
    } catch (error) {
      console.error(`Error ${mode}ing agent:`, error);
      toast.error(`Failed to ${mode} agent`);
    } finally {
      setIsSaving(false);
    }
  };

  const onSubmit = async (data: AgentFormData) => {
    if (mode === 'create') {
      // For create mode, show summary modal first
      setPendingSubmissionData(data);
      setShowSummary(true);
    } else {
      // For edit mode, proceed directly (no summary needed for updates)
      await performAgentSubmission(data);
    }
  };

  const handleClose = () => {
    if (!isSaving) {
      reset();
      onClose();
    }
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
                <Dialog.Panel className="w-full max-w-6xl transform overflow-hidden rounded-2xl bg-gray-900 text-left align-middle shadow-xl transition-all border border-gray-800">
                  {/* Header */}
                  <div className="flex items-center justify-between p-6 border-b border-gray-800">
                    <Dialog.Title as="h3" className="text-xl font-semibold text-white">
                      {mode === 'create' ? 'Create VAPI Agent' : 'Edit VAPI Agent'}
                    </Dialog.Title>
                    <button
                      onClick={handleClose}
                      disabled={isSaving}
                      className="p-2 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                    >
                      <FiX className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="flex h-[600px]">
                    {/* Sidebar Navigation */}
                    <div className="w-64 bg-gray-800 border-r border-gray-700 p-4">
                      <nav className="space-y-2">
                        {[
                          { id: 'customer', label: 'Customer', icon: FiUser },
                          { id: 'knowledge-base', label: 'Knowledge Base', icon: FiDatabase },
                          { id: 'basic-settings', label: 'Basic Settings', icon: FiSettings },
                          { id: 'advanced-settings', label: 'Advanced Settings', icon: FiZap },
                          { id: 'function-calls', label: 'Function Calls', icon: FiAlertTriangle },
                        ].map((tab) => {
                          const status = getStepStatus(tab.id);
                          const Icon = tab.icon;

                          return (
                            <button
                              key={tab.id}
                              onClick={() => setActiveTab(tab.id)}
                              className={clsx(
                                'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors',
                                activeTab === tab.id
                                  ? 'bg-blue-600 text-white'
                                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                              )}
                            >
                              <Icon className="w-4 h-4" />
                              <span className="flex-1">{tab.label}</span>
                              {status === 'complete' && (
                                <FiCheck className="w-4 h-4 text-green-400" />
                              )}
                            </button>
                          );
                        })}
                      </nav>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 overflow-y-auto">
                      {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="flex items-center gap-3 text-gray-400">
                            <FiLoader className="w-6 h-6 animate-spin" />
                            <span>Loading agent data...</span>
                          </div>
                        </div>
                      ) : (
                        <form onSubmit={handleSubmit(onSubmit)} className="h-full">
                          <div className="p-6 h-full flex flex-col">
                            {/* Tab Content */}
                            <div className="flex-1 overflow-y-auto">
                              {activeTab === 'customer' && (
                                <div className="space-y-6">
                                  <div className="border-b border-gray-700 pb-4">
                                    <h3 className="text-lg font-semibold text-white mb-2">Select Customer</h3>
                                    <p className="text-gray-400 text-sm">
                                      Choose which customer this agent will be assigned to. This determines access permissions and billing.
                                    </p>
                                  </div>

                                  {customersLoading ? (
                                    <div className="flex items-center justify-center h-32">
                                      <FiLoader className="w-6 h-6 animate-spin text-gray-400" />
                                    </div>
                                  ) : !Array.isArray(customers) || customers.length === 0 ? (
                                    <div className="text-center py-8">
                                      <FiUser className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                                      <p className="text-gray-400">No customers found</p>
                                      <p className="text-gray-500 text-sm">Create a customer first to assign agents</p>
                                    </div>
                                  ) : (
                                    <div className="grid gap-3">
                                      {customers
                                        .filter(customer => customer.customerId) // Only show customers with valid Customer records
                                        .map((customer) => (
                                        <div
                                          key={customer.id}
                                          onClick={() => {
                                            console.log('[VapiAgentModal] Customer selected');
                                            setSelectedCustomer(customer.customerId!);
                                          }}
                                          className={clsx(
                                            'p-4 rounded-lg border cursor-pointer transition-colors',
                                            selectedCustomer === customer.customerId
                                              ? 'border-blue-500 bg-blue-500/10'
                                              : 'border-gray-700 hover:border-gray-600 bg-gray-800'
                                          )}
                                        >
                                          <div className="flex items-center justify-between">
                                            <div>
                                              <h4 className="font-medium text-white">
                                                {customer.firstName && customer.lastName
                                                  ? `${customer.firstName} ${customer.lastName}`
                                                  : customer.name || customer.email}
                                              </h4>
                                              <p className="text-gray-400 text-sm">{customer.email}</p>
                                              {customer.companyName && (
                                                <p className="text-gray-500 text-sm">{customer.companyName}</p>
                                              )}
                                            </div>
                                            {selectedCustomer === customer.customerId && (
                                              <FiCheck className="w-5 h-5 text-blue-400" />
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}

                              {activeTab === 'knowledge-base' && (
                                <div className="space-y-6">
                                  <div className="border-b border-gray-700 pb-4">
                                    <h3 className="text-lg font-semibold text-white mb-2">Knowledge Base</h3>
                                    <p className="text-gray-400 text-sm">
                                      Select knowledge bases to provide context and information to your agent.
                                    </p>
                                    <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                      <div className="flex items-start space-x-2">
                                        <FiAlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                                        <div className="text-sm">
                                          <p className="text-amber-400 font-medium">VAPI Knowledge Base Limitation</p>
                                          <p className="text-amber-300/80 mt-1">
                                            VAPI uses a custom knowledge base approach. Website URLs in your knowledge bases
                                            will be converted to our custom query endpoint. Only uploaded files and documents
                                            are directly supported by VAPI's native system.
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {knowledgeBasesLoading ? (
                                    <div className="flex items-center justify-center h-32">
                                      <FiLoader className="w-6 h-6 animate-spin text-gray-400" />
                                    </div>
                                  ) : !Array.isArray(knowledgeBases) || knowledgeBases.length === 0 ? (
                                    <div className="text-center py-8">
                                      <FiBook className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                                      <p className="text-gray-400">No knowledge bases found</p>
                                      <p className="text-gray-500 text-sm">Create knowledge bases to enhance your agent's capabilities</p>
                                    </div>
                                  ) : (
                                    <div className="grid gap-3">
                                      {knowledgeBases.map((kb) => (
                                        <div
                                          key={kb.id}
                                          onClick={() => {
                                            if (selectedKnowledgeBases.includes(kb.id)) {
                                              setSelectedKnowledgeBases(selectedKnowledgeBases.filter(id => id !== kb.id));
                                            } else {
                                              setSelectedKnowledgeBases([...selectedKnowledgeBases, kb.id]);
                                            }
                                          }}
                                          className={clsx(
                                            'p-4 rounded-lg border cursor-pointer transition-colors',
                                            selectedKnowledgeBases.includes(kb.id)
                                              ? 'border-blue-500 bg-blue-500/10'
                                              : 'border-gray-700 hover:border-gray-600 bg-gray-800'
                                          )}
                                        >
                                          <div className="flex items-center justify-between">
                                            <div>
                                              <h4 className="font-medium text-white">{kb.name}</h4>
                                              {kb.description && (
                                                <p className="text-gray-400 text-sm">{kb.description}</p>
                                              )}
                                              <p className="text-gray-500 text-sm">{kb.fileCount} files</p>
                                            </div>
                                            {selectedKnowledgeBases.includes(kb.id) && (
                                              <FiCheck className="w-5 h-5 text-blue-400" />
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}

                              {activeTab === 'basic-settings' && (
                                <VapiBasicSettingsPanel
                                  register={register}
                                  errors={errors}
                                  selectedVoice={selectedVoice}
                                  onVoiceSelect={setSelectedVoice}
                                />
                              )}

                              {activeTab === 'advanced-settings' && (
                                <VapiAdvancedSettingsPanel
                                  register={register}
                                  errors={errors}
                                  watch={watch}
                                  setValue={setValue}
                                />
                              )}

                              {activeTab === 'function-calls' && (
                                <VapiFunctionCallsPanel
                                  customerId={selectedCustomer}
                                  agentId={agentId}
                                  functionCalls={functionCalls}
                                  onChange={setFunctionCalls}
                                  isLoading={false}
                                  mode={mode}
                                />
                              )}
                            </div>
                            {/* Footer with navigation */}
                            <div className="border-t border-gray-700 pt-4 mt-6">
                              <div className="flex justify-between items-center">
                                <div className="flex gap-2">
                                  {activeTab !== 'customer' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const tabs = ['customer', 'knowledge-base', 'basic-settings', 'advanced-settings', 'function-calls'];
                                        const currentIndex = tabs.indexOf(activeTab);
                                        if (currentIndex > 0) {
                                          setActiveTab(tabs[currentIndex - 1]);
                                        }
                                      }}
                                      className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                                    >
                                      Previous
                                    </button>
                                  )}
                                </div>

                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (validateStep(activeTab)) {
                                        const tabs = ['customer', 'knowledge-base', 'basic-settings', 'advanced-settings', 'function-calls'];
                                        const currentIndex = tabs.indexOf(activeTab);
                                        if (currentIndex < tabs.length - 1) {
                                          // Go to next tab
                                          setActiveTab(tabs[currentIndex + 1]);
                                        } else {
                                          // Last tab
                                          const formData = getValues();
                                          if (mode === 'create') {
                                            // Show summary modal for create mode
                                            setPendingSubmissionData(formData);
                                            setShowSummary(true);
                                          } else {
                                            // Direct submission for edit mode
                                            performAgentSubmission(formData);
                                          }
                                        }
                                      } else {
                                        toast.error('Please complete the current step before proceeding');
                                      }
                                    }}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                                  >
                                    {activeTab === 'function-calls'
                                      ? (mode === 'create' ? 'Review & Create' : 'Update Agent')
                                      : 'Next'
                                    }
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </form>
                      )}
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Agent Creation Summary Modal */}
      {showSummary && pendingSubmissionData && (
        <AgentCreationSummaryModal
          isOpen={showSummary}
          onClose={() => {
            // Return to configuration instead of closing everything
            setShowSummary(false);
            // Keep pendingSubmissionData so user doesn't lose their config
            // setPendingSubmissionData(null);
          }}
          onConfirm={() => performAgentSubmission(pendingSubmissionData)}
          agentData={prepareSummaryData(pendingSubmissionData)}
          isCreating={isSaving}
        />
      )}
    </>
  );
};

export default VapiAgentModal;
