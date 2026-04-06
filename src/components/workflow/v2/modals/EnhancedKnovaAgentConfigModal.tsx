'use client';

import React, { useState, useEffect } from 'react';
import { FiUser, FiMic, FiPhone, FiCpu, FiMessageCircle, FiTool, FiSettings, FiChevronRight, FiCheck, FiSave, FiPlus, FiTrash2 } from 'react-icons/fi';
import PositionedModal from './PositionedModal';
import { KnovaAgentNodeData } from '@/types/workflow';

interface EnhancedKnovaAgentConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: KnovaAgentNodeData) => void;
  initialConfig?: Partial<KnovaAgentNodeData>;
  nodePosition?: { x: number; y: number };
}

const VOICE_OPTIONS = [
  { value: 'alloy', label: 'Alloy - Natural and clear' },
  { value: 'echo', label: 'Echo - Warm and conversational' },
  { value: 'fable', label: 'Fable - Expressive and engaging' },
  { value: 'onyx', label: 'Onyx - Deep and professional' },
  { value: 'nova', label: 'Nova - Bright and energetic' },
  { value: 'shimmer', label: 'Shimmer - Soft and friendly' },
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
];

export default function EnhancedKnovaAgentConfigModal({
  isOpen,
  onClose,
  onSave,
  initialConfig = {},
  nodePosition,
}: EnhancedKnovaAgentConfigModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [config, setConfig] = useState<KnovaAgentNodeData>({
    customerId: '',
    agentName: '',
    agentType: 'inbound',
    communicationChannel: 'web',
    voice: 'alloy',
    language: 'english',
    businessInfo: {
      name: '',
      location: '',
      hours: '',
      services: [],
      specialOffers: []
    },
    phoneNumber: '',
    knowledgeBase: [],
    integrations: [],
    instructions: '',
    customGreeting: '',
    sellsProducts: false,
    products: [],
    services: [],
    useKnowledgeBaseForProducts: false,
    productKnowledgeBase: [],
    agentOperationalHours: 'business',
    enableBackchannel: true,
    backchannelWords: ['uh-huh', 'yeah', 'mmhm', 'okay', 'gotcha', 'got you'],
    enableSpeechNormalization: true,
    voicemailDetection: 'hangup',
    voicemailMessage: 'Hi, this is {{agent_name}}, please give us a callback tomorrow at 10am.',
    enableCustomWords: false,
    customWords: {},
    enableBackgroundAudio: false,
    backgroundAudioType: 'ambient',
    backgroundAudioFile: '',
    selectedBackgroundAudio: '',
    ...initialConfig,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [availableKnowledgeBase, setAvailableKnowledgeBase] = useState<string[]>([
    'Product Catalog', 'FAQ Database', 'Company Policies', 'Technical Documentation'
  ]);
  const [availableIntegrations, setAvailableIntegrations] = useState<string[]>([
    'CRM Integration', 'Calendar Booking', 'Email Marketing', 'SMS Notifications'
  ]);

  useEffect(() => {
    if (isOpen) {
      // Only reset config when modal first opens, not on every render
      setConfig(prev => {
        const defaultConfig: KnovaAgentNodeData = {
          customerId: '',
          agentName: '',
          agentType: 'inbound' as 'inbound' | 'outbound',
          communicationChannel: 'web' as 'web' | 'telephony',
          voice: 'alloy',
          language: 'english',
          businessInfo: {
            name: '',
            location: '',
            hours: '',
            services: [],
            specialOffers: []
          },
          phoneNumber: '',
          knowledgeBase: [],
          integrations: [],
          instructions: '',
          customGreeting: '',
          sellsProducts: false,
          products: [],
          services: [],
          useKnowledgeBaseForProducts: false,
          productKnowledgeBase: [],
          agentOperationalHours: 'business' as 'business' | '24/7' | 'custom',
          enableBackchannel: true,
          backchannelWords: ['uh-huh', 'yeah', 'mmhm', 'okay', 'gotcha', 'got you'],
          enableSpeechNormalization: true,
          voicemailDetection: 'hangup' as 'hangup' | 'leave_message',
          voicemailMessage: 'Hi, this is {{agent_name}}, please give us a callback tomorrow at 10am.',
          enableCustomWords: false,
          customWords: {},
          enableBackgroundAudio: false,
          backgroundAudioType: 'ambient' as 'ambient' | 'thinking',
          backgroundAudioFile: '',
          selectedBackgroundAudio: '',
        };

        // Merge with initial config if provided, otherwise keep current state
        return initialConfig ? { ...defaultConfig, ...initialConfig } : prev.agentName ? prev : defaultConfig;
      });

      // Reset step to 1 when modal opens
      setCurrentStep(1);
      setErrors({});
    }
  }, [isOpen]); // Remove initialConfig from dependencies to prevent constant resets

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 1: // Basic
        if (!config.agentName?.trim()) newErrors.agentName = 'Agent name is required';
        break;
      case 2: // Voice & Phone
        if (config.communicationChannel === 'telephony' && !config.phoneNumber?.trim()) {
          newErrors.phoneNumber = 'Phone number is required for telephony';
        }
        break;
      case 3: // Business Info
        return true; // Optional
      case 4: // Knowledge Base
        return true; // Optional
      case 5: // Integrations
        return true; // Optional
      case 6: // Products/Services
        return true; // Optional
      case 7: // Advanced
        return true; // Optional
      case 8: // Summary
        if (!config.agentName?.trim()) newErrors.agentName = 'Agent name is required';
        if (!config.voice?.trim()) newErrors.voice = 'Voice selection is required';
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => prev - 1);
  };

  const handleSave = () => {
    if (validateStep(currentStep)) {
      onSave(config);
      onClose();
    }
  };

  const handleReset = () => {
    setCurrentStep(1);
    setErrors({});
    setConfig({
      customerId: '',
      agentName: '',
      agentType: 'inbound',
      communicationChannel: 'web',
      voice: 'alloy',
      language: 'english',
      businessInfo: {
        name: '',
        location: '',
        hours: '',
        services: [],
        specialOffers: []
      },
      phoneNumber: '',
      knowledgeBase: [],
      integrations: [],
      instructions: '',
      customGreeting: '',
      sellsProducts: false,
      products: [],
      services: [],
      useKnowledgeBaseForProducts: false,
      productKnowledgeBase: [],
      agentOperationalHours: 'business',
      enableBackchannel: true,
      backchannelWords: ['uh-huh', 'yeah', 'mmhm', 'okay', 'gotcha', 'got you'],
      enableSpeechNormalization: true,
      voicemailDetection: 'hangup',
      voicemailMessage: 'Hi, this is {{agent_name}}, please give us a callback tomorrow at 10am.',
      enableCustomWords: false,
      customWords: {},
      enableBackgroundAudio: false,
      backgroundAudioType: 'ambient',
      backgroundAudioFile: '',
      selectedBackgroundAudio: '',
    });
  };

  const steps = [
    { number: 1, title: 'Basic', description: 'Agent name and business details' },
    { number: 2, title: 'Voice & Phone', description: 'Voice and communication setup' },
    { number: 3, title: 'Business Info', description: 'Business information and services' },
    { number: 4, title: 'Knowledge Base', description: 'Knowledge base selection' },
    { number: 5, title: 'Integrations', description: 'Tool and integration selection' },
    { number: 6, title: 'Products/Services', description: 'Product and service configuration' },
    { number: 7, title: 'Advanced', description: 'Advanced features and customization' },
    { number: 8, title: 'Summary', description: 'Review and save configuration' },
  ];

  const canSave = config.agentName?.trim() && config.businessInfo?.name?.trim() && config.instructions?.trim();

  // Helper functions
  const updateConfig = (field: keyof KnovaAgentNodeData, value: any) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const updateBusinessInfo = (field: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      businessInfo: {
        name: prev.businessInfo?.name || '',
        location: prev.businessInfo?.location || '',
        hours: prev.businessInfo?.hours || '',
        services: prev.businessInfo?.services || [],
        specialOffers: prev.businessInfo?.specialOffers || [],
        ...prev.businessInfo,
        [field]: value
      }
    }));
  };

  const toggleKnowledgeBase = (kb: string) => {
    setConfig(prev => ({
      ...prev,
      knowledgeBase: prev.knowledgeBase.includes(kb)
        ? prev.knowledgeBase.filter(item => item !== kb)
        : [...prev.knowledgeBase, kb]
    }));
  };

  const toggleIntegration = (integration: string) => {
    setConfig(prev => ({
      ...prev,
      integrations: prev.integrations.includes(integration)
        ? prev.integrations.filter(item => item !== integration)
        : [...prev.integrations, integration]
    }));
  };

  const addService = () => {
    setConfig(prev => ({
      ...prev,
      businessInfo: {
        name: prev.businessInfo?.name || '',
        location: prev.businessInfo?.location || '',
        hours: prev.businessInfo?.hours || '',
        services: [...(prev.businessInfo?.services || []), ''],
        specialOffers: prev.businessInfo?.specialOffers || []
      }
    }));
  };

  const removeService = (index: number) => {
    setConfig(prev => ({
      ...prev,
      businessInfo: {
        name: prev.businessInfo?.name || '',
        location: prev.businessInfo?.location || '',
        hours: prev.businessInfo?.hours || '',
        services: prev.businessInfo?.services?.filter((_, i) => i !== index) || [],
        specialOffers: prev.businessInfo?.specialOffers || []
      }
    }));
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1: // Basic Configuration
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-white mb-4">Basic Agent Configuration</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Communication Channel <span className="text-red-400">*</span>
                </label>
                <select
                  value={config.communicationChannel || 'web'}
                  onChange={(e) => {
                    const channel = e.target.value;
                    updateConfig('communicationChannel', channel);
                    if (channel === 'web') {
                      updateConfig('agentType', 'inbound');
                    } else if (channel === 'telephony') {
                      updateConfig('agentType', 'outbound');
                    }
                  }}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="web">Web (Browser/Widget)</option>
                  <option value="telephony">Telephony (Phone Calls)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Agent Type <span className="text-red-400">*</span>
                </label>
                <select
                  value={config.agentType || 'inbound'}
                  onChange={(e) => updateConfig('agentType', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  disabled={config.communicationChannel === 'web'}
                >
                  <option value="inbound">Inbound Support</option>
                  {config.communicationChannel === 'telephony' && (
                    <option value="outbound">Outbound</option>
                  )}
                </select>
                {config.communicationChannel === 'web' && (
                  <p className="text-xs text-gray-500 mt-1">Web agents are always inbound support</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Agent Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={config.agentName || ''}
                  onChange={(e) => updateConfig('agentName', e.target.value)}
                  className={`w-full px-3 py-2 bg-gray-700 border rounded-lg text-white focus:outline-none focus:border-blue-500 ${
                    errors.agentName ? 'border-red-500' : 'border-gray-600'
                  }`}
                  placeholder="e.g., Sarah (the name the agent will introduce itself as)"
                />
                {errors.agentName && <p className="text-red-400 text-xs mt-1">{errors.agentName}</p>}
                <p className="text-xs text-gray-500 mt-1">This is the name the agent will use to introduce itself to customers</p>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-3 mb-3">
                <label className="block text-sm font-medium text-gray-300">
                  Custom Greeting Message
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!config.customGreeting}
                    onChange={(e) => {
                      if (e.target.checked) {
                        updateConfig('customGreeting', '');
                      }
                    }}
                    className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-xs text-green-400">Follow agent default best practices</span>
                </label>
              </div>
              <textarea
                value={config.customGreeting || ''}
                onChange={(e) => updateConfig('customGreeting', e.target.value)}
                rows={3}
                disabled={!config.customGreeting && config.customGreeting !== ''}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                placeholder="Hello! I'm your AI assistant. How can I help you today?"
              />
            </div>

            <div>
              <div className="flex items-center gap-3 mb-3">
                <label className="block text-sm font-medium text-gray-300">
                  Agent Instructions
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!config.instructions}
                    onChange={(e) => {
                      if (e.target.checked) {
                        updateConfig('instructions', '');
                      }
                    }}
                    className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-xs text-green-400">Follow agent default best practices</span>
                </label>
              </div>
              <textarea
                value={config.instructions || ''}
                onChange={(e) => updateConfig('instructions', e.target.value)}
                rows={4}
                disabled={!config.instructions && config.instructions !== ''}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                placeholder="You are a helpful AI assistant. Your goal is to..."
              />
            </div>
          </div>
        );

      case 2: // Voice & Phone Configuration
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-white mb-4">Voice & Phone Configuration</h3>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Voice Selection <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select
                  value={config.voice || 'alloy'}
                  onChange={(e) => updateConfig('voice', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  {VOICE_OPTIONS.map(voice => (
                    <option key={voice.value} value={voice.value}>
                      {voice.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    // Voice preview functionality placeholder
                    alert('Voice preview functionality will be implemented in the next update.');
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm transition-colors"
                >
                  🎵 Preview Voice
                </button>
              </div>
            </div>

            {/* Language Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Language Selection
              </label>
              <select
                value={config.language || 'english'}
                onChange={(e) => updateConfig('language', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <option value="multilingual">Multilingual</option>
                <option value="english">English</option>
                <option value="spanish">Spanish (Available but not tested)</option>
                <option value="german">German (Available but not tested)</option>
                <option value="hindi">Hindi (Available but not tested)</option>
                <option value="italian">Italian (Available but not tested)</option>
              </select>
            </div>

            {/* Backchannel Settings */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={config.enableBackchannel || false}
                  onChange={(e) => updateConfig('enableBackchannel', e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                />
                <label className="text-sm font-medium text-gray-300">
                  Enable Backchannel
                </label>
              </div>

              {config.enableBackchannel && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Backchannel Words
                  </label>
                  <textarea
                    value={config.backchannelWords?.join(', ') || ''}
                    onChange={(e) => {
                      const words = e.target.value.split(',').map(w => w.trim()).filter(w => w);
                      updateConfig('backchannelWords', words);
                    }}
                    rows={2}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="uh-huh, yeah, mmhm, okay, gotcha, got you"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Words the agent will use for backchanneling (separate with commas)
                  </p>
                </div>
              )}
            </div>

            {/* Speech Normalization */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <input
                  type="checkbox"
                  checked={config.enableSpeechNormalization || false}
                  onChange={(e) => updateConfig('enableSpeechNormalization', e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                />
                <label className="text-sm font-medium text-blue-400">
                  Enable Speech Normalization
                </label>
              </div>
              <p className="text-xs text-gray-400">
                Converts text elements like numbers, currency, and dates into human-like spoken forms.
                <button
                  onClick={() => alert('Speech normalization converts written text into natural speech patterns. For example:\n\n• "$100" becomes "one hundred dollars"\n• "2024" becomes "twenty twenty-four"\n• "Dr. Smith" becomes "Doctor Smith"\n\nThis makes the AI sound more natural and human-like.')}
                  className="text-blue-400 hover:text-blue-300 ml-1"
                >
                  (Learn more)
                </button>
              </p>
            </div>

            {/* Phone Configuration for Telephony */}
            {config.communicationChannel === 'telephony' && (
              <div className="space-y-4">
                <h4 className="text-md font-medium text-white">Phone Configuration</h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                    <h5 className="text-sm font-medium text-amber-400 mb-2">Option 1: Get Temporary Number</h5>
                    <p className="text-xs text-gray-400 mb-3">
                      Get a temporary number from our pool. Number will be decommissioned in 2-4 weeks.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('⚠️ WARNING: This temporary number will be decommissioned in 2-4 weeks. Please submit your Compliance Pack to purchase a permanent number. Do you want to proceed with a temporary number?')) {
                          const tempNumber = `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`;
                          updateConfig('phoneNumber', tempNumber);
                          alert(`Temporary number assigned: ${tempNumber}`);
                        }
                      }}
                      className="w-full px-3 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg text-white text-sm transition-colors"
                    >
                      Get Temporary Number
                    </button>
                  </div>

                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                    <h5 className="text-sm font-medium text-blue-400 mb-2">Option 2: Bring Your Own Number</h5>
                    <p className="text-xs text-gray-400 mb-3">
                      Use your existing SIP configuration
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        alert('SIP configuration form will be implemented in the next update. You will be able to enter your SIP URL, username, password, and other connection details.');
                      }}
                      className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm transition-colors"
                    >
                      Configure SIP
                    </button>
                  </div>
                </div>

                {config.phoneNumber && (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                    <p className="text-sm text-green-400">
                      ✅ Phone Number Configured: {config.phoneNumber}
                    </p>
                  </div>
                )}
                {errors.phoneNumber && <p className="text-red-400 text-xs mt-1">{errors.phoneNumber}</p>}

                {/* Voicemail Detection */}
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-white">Voicemail Detection Settings</h4>

                  <div className="space-y-3">
                    <label className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="voicemailDetection"
                        value="hangup"
                        checked={config.voicemailDetection === 'hangup'}
                        onChange={(e) => updateConfig('voicemailDetection', e.target.value)}
                        className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 focus:ring-blue-500"
                      />
                      <span className="text-white">Hang up: The agent will disconnect when it detects a voicemail</span>
                    </label>

                    <label className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="voicemailDetection"
                        value="leave_message"
                        checked={config.voicemailDetection === 'leave_message'}
                        onChange={(e) => updateConfig('voicemailDetection', e.target.value)}
                        className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 focus:ring-blue-500"
                      />
                      <span className="text-white">Leave a message: The agent will leave a message after it's agent's turn to speak</span>
                    </label>
                  </div>

                  {config.voicemailDetection === 'leave_message' && (
                    <div className="mt-4 p-4 bg-gray-800 rounded-lg">
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Static Message
                      </label>
                      <textarea
                        value={config.voicemailMessage || ''}
                        onChange={(e) => updateConfig('voicemailMessage', e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                        placeholder="Hi, this is {{agent_name}}, please give us a callback tomorrow at 10am."
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Use {'{'}agent_name{'}'} to insert the agent's name automatically
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );

      case 3: // Business Information
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-white mb-4">Business Information</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Business Name
                </label>
                <input
                  type="text"
                  value={config.businessInfo?.name || ''}
                  onChange={(e) => updateBusinessInfo('name', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="e.g., Acme Corporation"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Business Location
                </label>
                <input
                  type="text"
                  value={config.businessInfo?.location || ''}
                  onChange={(e) => updateBusinessInfo('location', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="e.g., New York, NY"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Business Hours
                </label>
                <input
                  type="text"
                  value={config.businessInfo?.hours || ''}
                  onChange={(e) => updateBusinessInfo('hours', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="e.g., Monday - Friday: 9 AM - 5 PM EST"
                />
              </div>
            </div>

            {/* Services Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-300">
                  Services Offered
                </label>
                <button
                  type="button"
                  onClick={addService}
                  className="flex items-center gap-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm transition-colors"
                >
                  <FiPlus className="w-4 h-4" />
                  Add Service
                </button>
              </div>

              <div className="space-y-2">
                {(config.businessInfo?.services || []).map((service, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={service}
                      onChange={(e) => {
                        const newServices = [...(config.businessInfo?.services || [])];
                        newServices[index] = e.target.value;
                        updateBusinessInfo('services', newServices);
                      }}
                      className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      placeholder="e.g., Web Development"
                    />
                    <button
                      type="button"
                      onClick={() => removeService(index)}
                      className="p-2 text-red-400 hover:text-red-300 transition-colors"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {(!config.businessInfo?.services || config.businessInfo.services.length === 0) && (
                  <p className="text-gray-500 text-sm italic">No services added yet. Click "Add Service" to get started.</p>
                )}
              </div>
            </div>

            {/* Special Offers Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-300">
                  Special Offers & Promotions
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const currentOffers = config.businessInfo?.specialOffers || [];
                    updateBusinessInfo('specialOffers', [...currentOffers, '']);
                  }}
                  className="flex items-center gap-2 px-3 py-1 bg-green-600 hover:bg-green-700 rounded-lg text-white text-sm transition-colors"
                >
                  <FiPlus className="w-4 h-4" />
                  Add Offer
                </button>
              </div>

              <div className="space-y-2">
                {(config.businessInfo?.specialOffers || []).map((offer, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={offer}
                      onChange={(e) => {
                        const newOffers = [...(config.businessInfo?.specialOffers || [])];
                        newOffers[index] = e.target.value;
                        updateBusinessInfo('specialOffers', newOffers);
                      }}
                      className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      placeholder="e.g., 20% off first consultation"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const newOffers = config.businessInfo?.specialOffers?.filter((_, i) => i !== index) || [];
                        updateBusinessInfo('specialOffers', newOffers);
                      }}
                      className="p-2 text-red-400 hover:text-red-300 transition-colors"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {(!config.businessInfo?.specialOffers || config.businessInfo.specialOffers.length === 0) && (
                  <p className="text-gray-500 text-sm italic">No special offers added yet. Click "Add Offer" to get started.</p>
                )}
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <h4 className="text-blue-400 font-medium mb-2">💡 Business Information Tips</h4>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• Business information helps the agent provide accurate details to customers</li>
                <li>• Services list helps the agent understand what you offer</li>
                <li>• Special offers can be mentioned during conversations to increase conversions</li>
                <li>• Business hours help set customer expectations for callbacks</li>
              </ul>
            </div>
          </div>
        );

      case 4: // Knowledge Base Selection
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-white mb-4">Knowledge Base Selection</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {availableKnowledgeBase.map(kb => (
                <label key={kb} className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600">
                  <input
                    type="checkbox"
                    checked={config.knowledgeBase.includes(kb)}
                    onChange={() => toggleKnowledgeBase(kb)}
                    className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-white">{kb}</span>
                </label>
              ))}
            </div>
          </div>
        );

      case 5: // Integrations
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-white mb-4">Tool & Integration Selection</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {availableIntegrations.map(integration => (
                <label key={integration} className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600">
                  <input
                    type="checkbox"
                    checked={config.integrations.includes(integration)}
                    onChange={() => toggleIntegration(integration)}
                    className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-white">{integration}</span>
                </label>
              ))}
            </div>
          </div>
        );

      case 6: // Products & Services Configuration
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-white mb-4">Products & Services Configuration</h3>

            {/* Selling Products Toggle */}
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-4">
                <input
                  type="checkbox"
                  checked={config.sellsProducts || false}
                  onChange={(e) => updateConfig('sellsProducts', e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                />
                <label className="text-sm font-medium text-white">
                  This agent sells products or services
                </label>
              </div>

              {config.sellsProducts && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={config.useKnowledgeBaseForProducts || false}
                      onChange={(e) => updateConfig('useKnowledgeBaseForProducts', e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                    />
                    <label className="text-sm text-gray-300">
                      Use knowledge base for product information (recommended for large catalogs)
                    </label>
                  </div>

                  {config.useKnowledgeBaseForProducts && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Product Knowledge Base
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {availableKnowledgeBase.map(kb => (
                          <label key={kb} className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600">
                            <input
                              type="checkbox"
                              checked={config.productKnowledgeBase?.includes(kb) || false}
                              onChange={() => {
                                const current = config.productKnowledgeBase || [];
                                const updated = current.includes(kb)
                                  ? current.filter(item => item !== kb)
                                  : [...current, kb];
                                updateConfig('productKnowledgeBase', updated);
                              }}
                              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                            />
                            <span className="text-white text-sm">{kb}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Manual Product Configuration */}
            {config.sellsProducts && !config.useKnowledgeBaseForProducts && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-sm font-medium text-white">
                    Product Catalog
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const currentProducts = config.products || [];
                      updateConfig('products', [...currentProducts, { name: '', price: '', description: '' }]);
                    }}
                    className="flex items-center gap-2 px-3 py-1 bg-green-600 hover:bg-green-700 rounded-lg text-white text-sm transition-colors"
                  >
                    <FiPlus className="w-4 h-4" />
                    Add Product
                  </button>
                </div>

                <div className="space-y-4">
                  {(config.products || []).map((product, index) => (
                    <div key={index} className="bg-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-white font-medium">Product {index + 1}</h4>
                        <button
                          type="button"
                          onClick={() => {
                            const newProducts = config.products?.filter((_, i) => i !== index) || [];
                            updateConfig('products', newProducts);
                          }}
                          className="p-1 text-red-400 hover:text-red-300 transition-colors"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-300 mb-1">
                            Product Name
                          </label>
                          <input
                            type="text"
                            value={product.name}
                            onChange={(e) => {
                              const newProducts = [...(config.products || [])];
                              newProducts[index] = { ...product, name: e.target.value };
                              updateConfig('products', newProducts);
                            }}
                            className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                            placeholder="e.g., Premium Consulting"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-300 mb-1">
                            Price
                          </label>
                          <input
                            type="text"
                            value={product.price}
                            onChange={(e) => {
                              const newProducts = [...(config.products || [])];
                              newProducts[index] = { ...product, price: e.target.value };
                              updateConfig('products', newProducts);
                            }}
                            className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                            placeholder="e.g., $99/hour"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1">
                          Description
                        </label>
                        <textarea
                          value={product.description}
                          onChange={(e) => {
                            const newProducts = [...(config.products || [])];
                            newProducts[index] = { ...product, description: e.target.value };
                            updateConfig('products', newProducts);
                          }}
                          rows={2}
                          className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                          placeholder="Brief description of the product or service"
                        />
                      </div>
                    </div>
                  ))}

                  {(!config.products || config.products.length === 0) && (
                    <p className="text-gray-500 text-sm italic">No products added yet. Click "Add Product" to get started.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        );

      case 7: // Advanced Settings
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-white mb-4">Advanced Settings</h3>

            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors">
                <input
                  type="checkbox"
                  checked={config.enableBackchannel || false}
                  onChange={(e) => updateConfig('enableBackchannel', e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-600 border-gray-500 rounded focus:ring-blue-500 focus:ring-2"
                />
                <div>
                  <span className="text-sm font-medium text-white">Enable Backchannel</span>
                  <p className="text-xs text-gray-400">Allow natural conversation flow with acknowledgments</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors">
                <input
                  type="checkbox"
                  checked={config.enableSpeechNormalization || false}
                  onChange={(e) => updateConfig('enableSpeechNormalization', e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-600 border-gray-500 rounded focus:ring-blue-500 focus:ring-2"
                />
                <div>
                  <span className="text-sm font-medium text-white">Speech Normalization</span>
                  <p className="text-xs text-gray-400">Improve speech recognition accuracy</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors">
                <input
                  type="checkbox"
                  checked={config.enableCustomWords || false}
                  onChange={(e) => updateConfig('enableCustomWords', e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-600 border-gray-500 rounded focus:ring-blue-500 focus:ring-2"
                />
                <div>
                  <span className="text-sm font-medium text-white">Custom Word Pronunciation</span>
                  <p className="text-xs text-gray-400">Teach the agent how to pronounce specific words</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors">
                <input
                  type="checkbox"
                  checked={config.enableBackgroundAudio || false}
                  onChange={(e) => updateConfig('enableBackgroundAudio', e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-600 border-gray-500 rounded focus:ring-blue-500 focus:ring-2"
                />
                <div>
                  <span className="text-sm font-medium text-white">Background Audio</span>
                  <p className="text-xs text-gray-400">Add ambient sounds or thinking audio</p>
                </div>
              </label>
            </div>

            {config.enableBackgroundAudio && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Background Audio Type
                </label>
                <select
                  value={config.backgroundAudioType || 'ambient'}
                  onChange={(e) => updateConfig('backgroundAudioType', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ambient">Ambient Sounds</option>
                  <option value="thinking">Thinking Sounds</option>
                </select>
              </div>
            )}

            {/* Operational Hours */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Agent Operational Hours
              </label>
              <select
                value={config.agentOperationalHours || 'business'}
                onChange={(e) => updateConfig('agentOperationalHours', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="business">Business Hours Only</option>
                <option value="24/7">24/7 Availability</option>
                <option value="custom">Custom Schedule</option>
              </select>
            </div>
          </div>
        );

      case 8: // Summary
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-white mb-4">Configuration Summary</h3>

            <div className="bg-gray-800 rounded-lg p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Basic Information</h4>
                  <div className="space-y-1 text-sm text-gray-400">
                    <div>Agent Name: <span className="text-white">{config.agentName || 'Not set'}</span></div>
                    <div>Type: <span className="text-white capitalize">{config.agentType}</span></div>
                    <div>Channel: <span className="text-white capitalize">{config.communicationChannel}</span></div>
                    <div>Voice: <span className="text-white capitalize">{config.voice}</span></div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Business Information</h4>
                  <div className="space-y-1 text-sm text-gray-400">
                    <div>Business: <span className="text-white">{config.businessInfo?.name || 'Not set'}</span></div>
                    <div>Location: <span className="text-white">{config.businessInfo?.location || 'Not set'}</span></div>
                    <div>Hours: <span className="text-white">{config.businessInfo?.hours || 'Not set'}</span></div>
                    <div>Services: <span className="text-white">{config.businessInfo?.services?.length || 0} configured</span></div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Knowledge & Integrations</h4>
                  <div className="space-y-1 text-sm text-gray-400">
                    <div>Knowledge Base: <span className="text-white">{config.knowledgeBase?.length || 0} selected</span></div>
                    <div>Integrations: <span className="text-white">{config.integrations?.length || 0} selected</span></div>
                    <div>Sells Products: <span className="text-white">{config.sellsProducts ? 'Yes' : 'No'}</span></div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Advanced Features</h4>
                  <div className="space-y-1 text-sm text-gray-400">
                    <div>Backchannel: <span className="text-white">{config.enableBackchannel ? 'Enabled' : 'Disabled'}</span></div>
                    <div>Speech Normalization: <span className="text-white">{config.enableSpeechNormalization ? 'Enabled' : 'Disabled'}</span></div>
                    <div>Background Audio: <span className="text-white">{config.enableBackgroundAudio ? 'Enabled' : 'Disabled'}</span></div>
                  </div>
                </div>
              </div>

              {config.communicationChannel === 'telephony' && (
                <div className="border-t border-gray-700 pt-4">
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Telephony Configuration</h4>
                  <div className="space-y-1 text-sm text-gray-400">
                    <div>Phone Number: <span className="text-white">{config.phoneNumber || 'Not configured'}</span></div>
                    <div>Voicemail Detection: <span className="text-white capitalize">{config.voicemailDetection?.replace('_', ' ')}</span></div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <h4 className="text-blue-400 font-medium mb-2">🎉 Ready to Save!</h4>
              <p className="text-sm text-gray-300">
                Your agent configuration is complete. Click "Save Configuration" to apply these settings to your workflow node.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <PositionedModal
      isOpen={isOpen}
      onClose={onClose}
      nodePosition={nodePosition}
      title="Knova Agent Configuration"
      icon={<FiUser className="w-5 h-5 text-indigo-400" />}
      maxWidth="max-w-4xl"
      maxHeight="max-h-[90vh]"
    >
      <div className="p-6">
      <div className="space-y-6">
        {/* Progress Steps */}
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div
              key={step.number}
              className={`flex items-center ${index < steps.length - 1 ? 'flex-1' : ''}`}
            >
              <div className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    currentStep >= step.number
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-600 text-gray-400'
                  }`}
                >
                  {currentStep > step.number ? <FiCheck className="w-4 h-4" /> : step.number}
                </div>
                <div className="ml-3 hidden sm:block">
                  <div className={`text-sm font-medium ${currentStep >= step.number ? 'text-white' : 'text-gray-400'}`}>
                    {step.title}
                  </div>
                  <div className="text-xs text-gray-500">{step.description}</div>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-4 ${currentStep > step.number ? 'bg-indigo-600' : 'bg-gray-600'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="min-h-[400px]">
          {renderStepContent()}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-6 border-t border-gray-600">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 1}
            className="px-4 py-2 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>

          <div className="flex items-center gap-3">
            {currentStep < steps.length ? (
              <button
                onClick={handleNext}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                Next
                <FiChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={!canSave}
                className={`px-6 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                  canSave
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                <FiCheck className="w-4 h-4" />
                Save Configuration
              </button>
            )}
          </div>
        </div>
        
        {/* Reset Button */}
        <div className="px-6 py-4 border-t border-gray-600 bg-gray-800/50">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2"
          >
            Reset Configuration
          </button>
        </div>
      </div>
      </div>
    </PositionedModal>
  );
}