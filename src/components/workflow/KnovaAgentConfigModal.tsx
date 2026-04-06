'use client';

import React, { useState, useEffect } from 'react';
import { FiX, FiSave, FiUser, FiMic, FiPhone, FiSettings, FiBook, FiLink, FiClock, FiMapPin, FiDatabase, FiShoppingBag, FiInfo, FiPlus, FiTrash2, FiUpload, FiVolume2, FiChevronRight } from 'react-icons/fi';
import { Dialog, Transition, Tab } from '@headlessui/react';
import { KnovaAgentNodeData } from '@/types/workflow';
import { BrowserStorageManager } from '@/lib/workflow/browserStorage';
import CustomModal from '@/components/ui/CustomModal';
import { useCustomModal } from '@/hooks/useCustomModal';

interface KnovaAgentConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: KnovaAgentNodeData) => void;
  initialConfig?: Partial<KnovaAgentNodeData>;
}

const voices = [
  { id: 'alloy', name: 'Alloy', description: 'Balanced and versatile' },
  { id: 'echo', name: 'Echo', description: 'Clear and articulate' },
  { id: 'fable', name: 'Fable', description: 'Warm and engaging' },
  { id: 'onyx', name: 'Onyx', description: 'Deep and authoritative' },
  { id: 'nova', name: 'Nova', description: 'Bright and energetic' },
  { id: 'shimmer', name: 'Shimmer', description: 'Smooth and professional' }
];

export default function KnovaAgentConfigModal({
  isOpen,
  onClose,
  onSave,
  initialConfig
}: KnovaAgentConfigModalProps) {
  const [config, setConfig] = useState<KnovaAgentNodeData>({
    agentName: '',
    agentType: 'inbound',
    communicationChannel: 'web',
    voice: 'alloy',
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
    sellsProducts: false,
    useKnowledgeBaseForProducts: false,
    products: [],
    productKnowledgeBase: [],
    language: 'english',
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
    selectedBackgroundAudio: ''
  });

  const [loading, setLoading] = useState(false);
  const [currentTab, setCurrentTab] = useState(0);
  const [isResizing, setIsResizing] = useState(false);
  const [modalSize, setModalSize] = useState({ width: 1200, height: 800 });
  const [availableKnowledgeBase, setAvailableKnowledgeBase] = useState<string[]>([
    'Product Catalog', 'FAQ Database', 'Company Policies', 'Technical Documentation'
  ]);
  const [availableIntegrations, setAvailableIntegrations] = useState<string[]>([
    'CRM Integration', 'Calendar Booking', 'Email Marketing', 'SMS Notifications'
  ]);

  const modal = useCustomModal();

  // Tab definitions with summary tab
  const tabs = [
    { name: 'Basic', icon: FiUser },
    { name: 'Voice & Phone', icon: FiMic },
    { name: 'Business Info', icon: FiMapPin },
    { name: 'Knowledge Base', icon: FiDatabase },
    { name: 'Integrations', icon: FiLink },
    { name: 'Products/Services', icon: FiShoppingBag },
    { name: 'Advanced', icon: FiSettings },
    { name: 'Summary', icon: FiSettings }
  ];

  // Load saved state from localStorage on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('knova_agent_config_draft');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setConfig(prev => ({ ...prev, ...parsed }));
      } catch (error) {
        console.error('Error loading saved config:', error);
      }
    }

    if (initialConfig) {
      setConfig(prev => ({
        ...prev,
        ...initialConfig,
        businessInfo: {
          name: initialConfig.businessInfo?.name || prev.businessInfo?.name || '',
          location: initialConfig.businessInfo?.location || prev.businessInfo?.location || '',
          hours: initialConfig.businessInfo?.hours || prev.businessInfo?.hours || '',
          services: initialConfig.businessInfo?.services || prev.businessInfo?.services || [],
          specialOffers: initialConfig.businessInfo?.specialOffers || prev.businessInfo?.specialOffers || []
        }
      }));
    }
  }, [initialConfig]);

  // Save state to localStorage whenever config changes
  useEffect(() => {
    localStorage.setItem('knova_agent_config_draft', JSON.stringify(config));
  }, [config]);

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

  // Navigation functions
  const canProceedToNext = () => {
    switch (currentTab) {
      case 0: // Basic tab
        return config.agentName && config.voice && config.agentType && config.communicationChannel;
      case 1: // Voice & Phone tab
        if (config.communicationChannel === 'telephony') {
          return config.phoneNumber; // Phone number required for telephony
        }
        return true;
      case 2: // Business Info tab
        return true; // Optional for now
      case 3: // Knowledge Base tab
        return true; // Optional
      case 4: // Integrations tab
        return true; // Optional
      case 5: // Products/Services tab
        return true; // Optional
      case 6: // Advanced tab
        return true; // Optional
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (canProceedToNext() && currentTab < tabs.length - 1) {
      setCurrentTab(currentTab + 1);
    } else if (!canProceedToNext()) {
      modal.showWarning('Required Fields Missing', 'Please fill in all required fields before proceeding to the next step.');
    }
  };

  const handlePrevious = () => {
    if (currentTab > 0) {
      setCurrentTab(currentTab - 1);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      if (!config.agentName || !config.voice || !config.agentType || !config.communicationChannel) {
        throw new Error('Please fill in all required fields');
      }

      const urlParams = new URLSearchParams(window.location.search);
      const customerId = urlParams.get('customer') || '';
      const partnerId = localStorage.getItem('partner_id') || 'demo_partner';
      const workflowUuid = localStorage.getItem('current_workflow_uuid') || '';

      if (partnerId && customerId && workflowUuid) {
        BrowserStorageManager.saveAgentConfig(config, partnerId, customerId, workflowUuid);
      }

      // Clear the draft from localStorage
      localStorage.removeItem('knova_agent_config_draft');

      onSave(config);
      onClose();
    } catch (error) {
      modal.showError('Configuration Error', error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Handle modal close - ask to save draft
  const handleClose = () => {
    if (config.agentName || config.voice !== 'alloy' || config.communicationChannel !== 'web') {
      modal.showConfirm(
        'Save Draft?',
        'You have unsaved changes. Would you like to save them as a draft? You can continue editing later.',
        () => {
          // Keep the draft and close
          onClose();
        },
        'Keep Draft',
        'Discard Changes'
      );
    } else {
      // No changes, just close
      localStorage.removeItem('knova_agent_config_draft');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div
        className="bg-gray-900 rounded-2xl border border-blue-400/20 shadow-xl flex flex-col resize overflow-auto"
        style={{
          width: `${modalSize.width}px`,
          height: `${modalSize.height}px`,
          minWidth: '800px',
          minHeight: '600px',
          maxWidth: '95vw',
          maxHeight: '95vh'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-lg">
              🤖
            </div>
            <div>
              <h3 className="text-lg font-medium text-white">Configure AI Agent</h3>
              <p className="text-sm text-gray-400">
                Step {currentTab + 1} of {tabs.length}: {tabs[currentTab]?.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-gray-500">
              Resizable Modal
            </div>
            <button onClick={handleClose} className="rounded-lg p-2 text-gray-400 hover:text-gray-300">
              <FiX className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="px-4 py-2 border-b border-gray-700 flex-shrink-0">
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentTab + 1) / tabs.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Tab.Group selectedIndex={currentTab} onChange={setCurrentTab}>
            <Tab.List className="flex space-x-1 rounded-xl bg-gray-800 p-1 m-4 mb-2 flex-shrink-0">
              {tabs.map((tab, index) => (
                <Tab
                  key={tab.name}
                  className={({ selected }) =>
                    `flex-1 rounded-lg py-3 px-2 text-xs font-medium leading-5 text-white transition-all
                     ${selected
                       ? 'bg-blue-600 shadow'
                       : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                     }`
                  }
                >
                  <div className="flex items-center justify-center gap-1 flex-col sm:flex-row">
                    <tab.icon className="w-4 h-4" />
                    <span className="hidden lg:inline text-xs">{tab.name}</span>
                    {/* Show step number on smaller screens */}
                    <span className="lg:hidden text-xs">{index + 1}</span>
                  </div>
                </Tab>
              ))}
            </Tab.List>

            <Tab.Panels className="flex-1 overflow-hidden">
              {/* Basic Configuration Tab */}
              <Tab.Panel className="h-full overflow-y-auto px-4 pb-4">
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
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                        placeholder="e.g., Sarah (the name the agent will introduce itself as)"
                      />
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
              </Tab.Panel>

              {/* Voice & Phone Tab */}
              <Tab.Panel className="h-full overflow-y-auto px-4 pb-4">
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
                        {voices.map(voice => (
                          <option key={voice.id} value={voice.id}>
                            {voice.name} - {voice.description}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          modal.showInfo(
                            'Voice Preview',
                            'Voice preview functionality will be implemented in the next update. You will be able to hear a sample of the selected voice before confirming.'
                          );
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
                        onClick={() => modal.showInfo(
                          'Speech Normalization',
                          'Speech normalization converts written text into natural speech patterns. For example:\n\n• "$100" becomes "one hundred dollars"\n• "2024" becomes "twenty twenty-four"\n• "Dr. Smith" becomes "Doctor Smith"\n\nThis makes the AI sound more natural and human-like.'
                        )}
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
                              modal.showConfirm(
                                'Get Temporary Number',
                                '⚠️ WARNING: This temporary number will be decommissioned in 2-4 weeks. Please submit your Compliance Pack to purchase a permanent number. Do you want to proceed with a temporary number?',
                                () => {
                                  const tempNumber = `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`;
                                  updateConfig('phoneNumber', tempNumber);
                                  modal.showSuccess(
                                    'Number Assigned',
                                    `Temporary number assigned: ${tempNumber}`
                                  );
                                },
                                'Get Number',
                                'Cancel'
                              );
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
                              modal.showInfo(
                                'SIP Configuration',
                                'SIP configuration form will be implemented in the next update. You will be able to enter your SIP URL, username, password, and other connection details.'
                              );
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
              </Tab.Panel>

              {/* Business Info Tab */}
              <Tab.Panel className="h-full overflow-y-auto px-4 pb-4">
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
              </Tab.Panel>

              <Tab.Panel className="h-full overflow-y-auto px-4 pb-4">
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
              </Tab.Panel>

              <Tab.Panel className="h-full overflow-y-auto px-4 pb-4">
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
              </Tab.Panel>

              <Tab.Panel className="h-full overflow-y-auto px-4 pb-4">
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
                                  placeholder="e.g., $200/hour"
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
                                placeholder="Brief description of the product or service..."
                              />
                            </div>
                          </div>
                        ))}

                        {(!config.products || config.products.length === 0) && (
                          <div className="text-center py-8 text-gray-500">
                            <FiShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>No products added yet. Click "Add Product" to get started.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Information Panel */}
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                    <h4 className="text-green-400 font-medium mb-2">🛍️ Product Configuration Tips</h4>
                    <ul className="text-sm text-gray-300 space-y-1">
                      <li>• <strong>Knowledge Base:</strong> Best for large product catalogs (100+ items)</li>
                      <li>• <strong>Manual Entry:</strong> Best for small catalogs or key products/services</li>
                      <li>• <strong>Pricing:</strong> Include currency and billing frequency (e.g., "$99/month")</li>
                      <li>• <strong>Descriptions:</strong> Keep concise but highlight key benefits</li>
                      <li>• The agent will use this information to answer product questions and make recommendations</li>
                    </ul>
                  </div>
                </div>
              </Tab.Panel>

              <Tab.Panel className="h-full overflow-y-auto px-4 pb-4">
                <div className="space-y-6">
                  <h3 className="text-lg font-medium text-white mb-4">Advanced Settings</h3>

                  {/* Custom System Prompt */}
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <label className="block text-sm font-medium text-gray-300">
                        Custom System Prompt
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!config.advancedSettings?.customSystemPrompt}
                          onChange={(e) => {
                            if (e.target.checked) {
                              updateConfig('advancedSettings', {
                                ...config.advancedSettings,
                                customSystemPrompt: ''
                              });
                            }
                          }}
                          className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-xs text-green-400">Use default system prompt (recommended)</span>
                      </label>
                    </div>
                    <textarea
                      value={config.advancedSettings?.customSystemPrompt || ''}
                      onChange={(e) => {
                        updateConfig('advancedSettings', {
                          ...config.advancedSettings,
                          customSystemPrompt: e.target.value
                        });
                      }}
                      rows={6}
                      disabled={!config.advancedSettings?.customSystemPrompt && config.advancedSettings?.customSystemPrompt !== ''}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                      placeholder="You are a helpful AI assistant for [Business Name]. Your role is to..."
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Custom system prompt overrides the default behavior. Only modify if you have specific requirements.
                    </p>
                  </div>

                  {/* Custom Word Learning */}
                  <div className="bg-gray-800 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-4">
                      <input
                        type="checkbox"
                        checked={config.enableCustomWords || false}
                        onChange={(e) => updateConfig('enableCustomWords', e.target.checked)}
                        className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                      />
                      <label className="text-sm font-medium text-white">
                        Enable Custom Word Learning
                      </label>
                    </div>

                    {config.enableCustomWords && (
                      <div>
                        <p className="text-sm text-gray-400 mb-3">
                          Teach the agent how to pronounce specific words or names correctly.
                        </p>

                        <div className="space-y-3">
                          {Object.entries(config.customWords || {}).map(([word, pronunciation], index) => (
                            <div key={index} className="flex items-center gap-3">
                              <input
                                type="text"
                                value={word}
                                onChange={(e) => {
                                  const newWords = { ...config.customWords };
                                  delete newWords[word];
                                  newWords[e.target.value] = pronunciation;
                                  updateConfig('customWords', newWords);
                                }}
                                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                                placeholder="Word to learn"
                              />
                              <span className="text-gray-400">→</span>
                              <input
                                type="text"
                                value={pronunciation}
                                onChange={(e) => {
                                  const newWords = { ...config.customWords };
                                  newWords[word] = e.target.value;
                                  updateConfig('customWords', newWords);
                                }}
                                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                                placeholder="How to pronounce it"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const newWords = { ...config.customWords };
                                  delete newWords[word];
                                  updateConfig('customWords', newWords);
                                }}
                                className="p-2 text-red-400 hover:text-red-300 transition-colors"
                              >
                                <FiTrash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}

                          <button
                            type="button"
                            onClick={() => {
                              const newWords = { ...config.customWords, '': '' };
                              updateConfig('customWords', newWords);
                            }}
                            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm transition-colors"
                          >
                            <FiPlus className="w-4 h-4" />
                            Add Custom Word
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Background Audio */}
                  <div className="bg-gray-800 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-4">
                      <input
                        type="checkbox"
                        checked={config.enableBackgroundAudio || false}
                        onChange={(e) => updateConfig('enableBackgroundAudio', e.target.checked)}
                        className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                      />
                      <label className="text-sm font-medium text-white">
                        Enable Background Audio
                      </label>
                    </div>

                    {config.enableBackgroundAudio && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Background Audio Type
                          </label>
                          <div className="space-y-2">
                            <label className="flex items-center gap-3">
                              <input
                                type="radio"
                                name="backgroundAudioType"
                                value="ambient"
                                checked={config.backgroundAudioType === 'ambient'}
                                onChange={(e) => updateConfig('backgroundAudioType', e.target.value)}
                                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 focus:ring-blue-500"
                              />
                              <span className="text-white text-sm">Ambient sounds (subtle background noise)</span>
                            </label>

                            <label className="flex items-center gap-3">
                              <input
                                type="radio"
                                name="backgroundAudioType"
                                value="thinking"
                                checked={config.backgroundAudioType === 'thinking'}
                                onChange={(e) => updateConfig('backgroundAudioType', e.target.value)}
                                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 focus:ring-blue-500"
                              />
                              <span className="text-white text-sm">Thinking sounds (when agent is processing)</span>
                            </label>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Custom Audio File (Optional)
                          </label>
                          <div className="flex items-center gap-3">
                            <input
                              type="text"
                              value={config.backgroundAudioFile || ''}
                              onChange={(e) => updateConfig('backgroundAudioFile', e.target.value)}
                              className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                              placeholder="https://example.com/audio.mp3"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                modal.showInfo(
                                  'Audio Upload',
                                  'Audio file upload functionality will be implemented in the next update. For now, you can provide a direct URL to an audio file.'
                                );
                              }}
                              className="px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg text-white text-sm transition-colors"
                            >
                              <FiUpload className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Provide a URL to a custom audio file, or leave empty to use default sounds.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Voice AI Configuration (for Voice AI agencies) */}
                  <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                    <h4 className="text-purple-400 font-medium mb-3 flex items-center gap-2">
                      <FiSettings className="w-4 h-4" />
                      Voice AI Configuration (Advanced)
                    </h4>

                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-300 mb-1">
                            Sample Rate (Hz)
                          </label>
                          <input
                            type="number"
                            value={config.advancedSettings?.voiceAIConfig?.audio_config?.sample_rate || 16000}
                            onChange={(e) => {
                              updateConfig('advancedSettings', {
                                ...config.advancedSettings,
                                voiceAIConfig: {
                                  ...config.advancedSettings?.voiceAIConfig,
                                  audio_config: {
                                    ...config.advancedSettings?.voiceAIConfig?.audio_config,
                                    sample_rate: parseInt(e.target.value)
                                  }
                                }
                              });
                            }}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-300 mb-1">
                            Channels
                          </label>
                          <select
                            value={config.advancedSettings?.voiceAIConfig?.audio_config?.channels || 1}
                            onChange={(e) => {
                              updateConfig('advancedSettings', {
                                ...config.advancedSettings,
                                voiceAIConfig: {
                                  ...config.advancedSettings?.voiceAIConfig,
                                  audio_config: {
                                    ...config.advancedSettings?.voiceAIConfig?.audio_config,
                                    channels: parseInt(e.target.value)
                                  }
                                }
                              });
                            }}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                          >
                            <option value={1}>Mono (1)</option>
                            <option value={2}>Stereo (2)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-300 mb-1">
                            Bitrate (kbps)
                          </label>
                          <input
                            type="number"
                            value={config.advancedSettings?.voiceAIConfig?.audio_config?.bitrate || 64000}
                            onChange={(e) => {
                              updateConfig('advancedSettings', {
                                ...config.advancedSettings,
                                voiceAIConfig: {
                                  ...config.advancedSettings?.voiceAIConfig,
                                  audio_config: {
                                    ...config.advancedSettings?.voiceAIConfig?.audio_config,
                                    bitrate: parseInt(e.target.value)
                                  }
                                }
                              });
                            }}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-300 mb-2">
                            Voice Activity Detection
                          </label>
                          <div className="flex items-center gap-3 mb-2">
                            <input
                              type="checkbox"
                              checked={config.advancedSettings?.voiceAIConfig?.voice_activity_detection?.enabled || true}
                              onChange={(e) => {
                                updateConfig('advancedSettings', {
                                  ...config.advancedSettings,
                                  voiceAIConfig: {
                                    ...config.advancedSettings?.voiceAIConfig,
                                    voice_activity_detection: {
                                      ...config.advancedSettings?.voiceAIConfig?.voice_activity_detection,
                                      enabled: e.target.checked
                                    }
                                  }
                                });
                              }}
                              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                            />
                            <span className="text-white text-sm">Enable VAD</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={config.advancedSettings?.voiceAIConfig?.voice_activity_detection?.threshold || 0.5}
                            onChange={(e) => {
                              updateConfig('advancedSettings', {
                                ...config.advancedSettings,
                                voiceAIConfig: {
                                  ...config.advancedSettings?.voiceAIConfig,
                                  voice_activity_detection: {
                                    ...config.advancedSettings?.voiceAIConfig?.voice_activity_detection,
                                    threshold: parseFloat(e.target.value)
                                  }
                                }
                              });
                            }}
                            className="w-full"
                          />
                          <p className="text-xs text-gray-500">Threshold: {config.advancedSettings?.voiceAIConfig?.voice_activity_detection?.threshold || 0.5}</p>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-300 mb-2">
                            Interruption Handling
                          </label>
                          <div className="flex items-center gap-3 mb-2">
                            <input
                              type="checkbox"
                              checked={config.advancedSettings?.voiceAIConfig?.interruption_handling?.enabled || true}
                              onChange={(e) => {
                                updateConfig('advancedSettings', {
                                  ...config.advancedSettings,
                                  voiceAIConfig: {
                                    ...config.advancedSettings?.voiceAIConfig,
                                    interruption_handling: {
                                      ...config.advancedSettings?.voiceAIConfig?.interruption_handling,
                                      enabled: e.target.checked
                                    }
                                  }
                                });
                              }}
                              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                            />
                            <span className="text-white text-sm">Enable Interruptions</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={config.advancedSettings?.voiceAIConfig?.interruption_handling?.threshold || 0.3}
                            onChange={(e) => {
                              updateConfig('advancedSettings', {
                                ...config.advancedSettings,
                                voiceAIConfig: {
                                  ...config.advancedSettings?.voiceAIConfig,
                                  interruption_handling: {
                                    ...config.advancedSettings?.voiceAIConfig?.interruption_handling,
                                    threshold: parseFloat(e.target.value)
                                  }
                                }
                              });
                            }}
                            className="w-full"
                          />
                          <p className="text-xs text-gray-500">Threshold: {config.advancedSettings?.voiceAIConfig?.interruption_handling?.threshold || 0.3}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                      <p className="text-amber-400 text-xs">
                        ⚠️ <strong>Advanced Users Only:</strong> These settings affect voice AI performance. Only modify if you understand the technical implications.
                      </p>
                    </div>
                  </div>
                </div>
              </Tab.Panel>

              {/* Summary Tab */}
              <Tab.Panel className="h-full overflow-y-auto px-4 pb-4">
                <div className="space-y-6">
                  <h3 className="text-lg font-medium text-white mb-4">Configuration Summary</h3>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Basic Configuration */}
                    <div className="bg-gray-800 rounded-lg p-4">
                      <h4 className="text-md font-medium text-blue-400 mb-3 flex items-center gap-2">
                        <FiUser className="w-4 h-4" />
                        Basic Configuration
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Agent Name:</span>
                          <span className="text-white">{config.agentName || 'Not set'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Communication:</span>
                          <span className="text-white capitalize">{config.communicationChannel}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Agent Type:</span>
                          <span className="text-white capitalize">{config.agentType}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Voice:</span>
                          <span className="text-white capitalize">{config.voice}</span>
                        </div>
                      </div>
                    </div>

                    {/* Voice & Phone Configuration */}
                    <div className="bg-gray-800 rounded-lg p-4">
                      <h4 className="text-md font-medium text-green-400 mb-3 flex items-center gap-2">
                        <FiMic className="w-4 h-4" />
                        Voice & Phone
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Language:</span>
                          <span className="text-white capitalize">{config.language}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Backchannel:</span>
                          <span className="text-white">{config.enableBackchannel ? 'Enabled' : 'Disabled'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Speech Normalization:</span>
                          <span className="text-white">{config.enableSpeechNormalization ? 'Enabled' : 'Disabled'}</span>
                        </div>
                        {config.communicationChannel === 'telephony' && (
                          <div className="flex justify-between">
                            <span className="text-gray-400">Phone Number:</span>
                            <span className="text-white">{config.phoneNumber || 'Not configured'}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Knowledge Base */}
                    <div className="bg-gray-800 rounded-lg p-4">
                      <h4 className="text-md font-medium text-purple-400 mb-3 flex items-center gap-2">
                        <FiDatabase className="w-4 h-4" />
                        Knowledge Base
                      </h4>
                      <div className="text-sm">
                        {config.knowledgeBase.length > 0 ? (
                          <ul className="space-y-1">
                            {config.knowledgeBase.map((kb, index) => (
                              <li key={index} className="text-white">• {kb}</li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-gray-400">No knowledge base selected</span>
                        )}
                      </div>
                    </div>

                    {/* Integrations */}
                    <div className="bg-gray-800 rounded-lg p-4">
                      <h4 className="text-md font-medium text-orange-400 mb-3 flex items-center gap-2">
                        <FiLink className="w-4 h-4" />
                        Integrations
                      </h4>
                      <div className="text-sm">
                        {config.integrations.length > 0 ? (
                          <ul className="space-y-1">
                            {config.integrations.map((integration, index) => (
                              <li key={index} className="text-white">• {integration}</li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-gray-400">No integrations selected</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Configuration Status */}
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                    <h4 className="text-blue-400 font-medium mb-2">Configuration Status</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${config.agentName ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-gray-300">Basic Configuration</span>
                        <span className={config.agentName ? 'text-green-400' : 'text-red-400'}>
                          {config.agentName ? 'Complete' : 'Required'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${
                          config.communicationChannel === 'telephony' ?
                            (config.phoneNumber ? 'bg-green-500' : 'bg-red-500') :
                            'bg-green-500'
                        }`} />
                        <span className="text-gray-300">Voice & Phone</span>
                        <span className={
                          config.communicationChannel === 'telephony' ?
                            (config.phoneNumber ? 'text-green-400' : 'text-red-400') :
                            'text-green-400'
                        }>
                          {config.communicationChannel === 'telephony' ?
                            (config.phoneNumber ? 'Complete' : 'Phone Required') :
                            'Complete'
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Tab.Panel>
            </Tab.Panels>
          </Tab.Group>
        </div>

        {/* Footer with Navigation */}
        <div className="flex items-center justify-between p-4 border-t border-gray-700 flex-shrink-0">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
            disabled={loading}
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            {currentTab > 0 && (
              <button
                onClick={handlePrevious}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
                disabled={loading}
              >
                Previous
              </button>
            )}

            {currentTab < tabs.length - 1 ? (
              <button
                onClick={handleNext}
                disabled={!canProceedToNext() || loading}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-white transition-colors"
              >
                Next
                <FiChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={loading || !canProceedToNext()}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg text-white transition-colors"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <FiSave className="w-4 h-4" />
                    Save Agent
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        <CustomModal
          isOpen={modal.isOpen}
          onClose={modal.hideModal}
          onConfirm={modal.config.onConfirm}
          title={modal.config.title}
          message={modal.config.message}
          type={modal.config.type}
          confirmText={modal.config.confirmText}
          cancelText={modal.config.cancelText}
          showCancel={modal.config.showCancel}
        />
      </div>
    </div>
  );
}
