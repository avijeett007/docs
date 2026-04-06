'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion as m, AnimatePresence } from 'framer-motion';
import { 
  FiPlus, FiMessageSquare, FiArrowRight, FiArrowLeft, FiCheck, FiMic, 
  FiPause, FiAlertCircle, FiPlay, FiSearch, FiPhoneIncoming, FiPhoneOutgoing,
  FiSmartphone, FiMail, FiPhone, FiUser, FiPlusCircle, FiCode, FiX
} from 'react-icons/fi';
import { useUser } from '@clerk/nextjs';
import { toast } from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import { StepProgress } from '@/components/ui/StepProgress';
import { AgentCard } from './AgentCard';
import { AGENT_STEPS } from '@/config/agentConfig';
import { saveAgentData, getAgents, getAgentById, deleteAgent, generateSystemPrompt, saveDraftAgent, getDraftAgents, clearDraftAgent } from '@/utils/agentStorage';
import type { AgentData, WeeklyWorkingHours } from '@/types/agent';
import { KnowledgebaseSelector } from '../knowledgebase/KnowledgebaseSelector';
import { PROMPT_TEMPLATES, generatePrompt } from '@/config/promptTemplates';
import { ActionModal } from './ActionModal';
import { ActionTile } from './ActionTile';
import { SettingsTile } from './SettingsTile';
import { WorkingHoursModal } from './WorkingHoursModal';
import { LiveChannels } from './LiveChannels';
import { saveWidgetConfig, getWidgetByAgentId } from '@/utils/widgetStorage';
import { saveWidgetDesign, getWidgetDesign, generateEmbedCode } from '@/utils/widgetDesignStorage';
import { WidgetDesigner } from './WidgetDesigner';
import type { WidgetConfig } from '@/types/widget';

type Voice = {
  id: string;
  displayName: string;
  provider: string;
  voiceType: string;
  sex: string;
  accent?: string;
};

interface SelectOption {
  icon: string;
  value: string;
  label: string;
  description?: string;
}

interface FormFieldProps {
  label: string;
  required?: boolean;
  tooltip?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

function FormField({
  label,
  required,
  tooltip,
  error,
  children,
  className = ''
}: FormFieldProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-200">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
            {tooltip && (
              <span className="ml-2 text-xs text-gray-400 font-normal">
                {tooltip}
              </span>
            )}
          </label>
        </div>
      )}
      {children}
      {error && (
        <p className="text-sm text-red-500 mt-1">{error}</p>
      )}
    </div>
  );
}

export default function Agent() {
  const { user } = useUser();
  const [agents, setAgents] = useState<Record<string, AgentData>>({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<Partial<AgentData>>({
    id: '',
    name: '',
    type: 'website',
    voice: '',
    warmupMessage: '',
    status: 'draft',
    businessName: '',
    purpose: '',
    knowledgeBase: '',
    systemPrompt: '',
    aiToSpeakFirst: false,
    enableBackchanneling: false,
    speechNormalization: false,
    sendEmailsToUsers: false,
    channels: {
      website: false,
      phone: false,
      mobile: false
    },
    webhookUrl: '',
    settings: {
      workingHours: false,
      maskPII: false,
      saveTranscripts: false,
      callAnalysis: false,
      designWidget: false,
      selectedPhone: undefined,
      widgetConfig: undefined,
      weeklyWorkingHours: undefined,
      tools: undefined
    },
    metadata: {
      clerkUserId: '',
      vectorDbCollection: '',
      livekitRoomPrefix: undefined
    },
    customerAttributes: [],
    customAttributes: '',
    lastModified: new Date().toISOString(),
    currentStep: 1
  });

  const [voices, setVoices] = useState<Voice[]>([]);
  const [filteredVoices, setFilteredVoices] = useState<Voice[]>([]);
  const [displayedVoices, setDisplayedVoices] = useState<Voice[]>([]);
  const [voiceSearch, setVoiceSearch] = useState('');
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [loadingPlayback, setLoadingPlayback] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const voicesPerPage = 9;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [userEditedPrompt, setUserEditedPrompt] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionModalType, setActionModalType] = useState<'transfer' | 'function'>('transfer');
  const [editingAction, setEditingAction] = useState<any>(null);
  const [showWorkingHoursModal, setShowWorkingHoursModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWidgetDesigner, setShowWidgetDesigner] = useState(false);

  // Filter voices when search changes
  useEffect(() => {
    const search = voiceSearch.toLowerCase();
    const filtered = voices.filter(voice => 
      voice.displayName.toLowerCase().includes(search) ||
      voice.provider.toLowerCase().includes(search) ||
      voice.voiceType.toLowerCase().includes(search) ||
      voice.sex.toLowerCase().includes(search) ||
      (voice.accent && voice.accent.toLowerCase().includes(search))
    );
    setFilteredVoices(filtered);
    setPage(1);
    setDisplayedVoices(filtered.slice(0, voicesPerPage));
  }, [voiceSearch, voices]);

  // Set up infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting) {
          setPage((p) => {
            const nextPage = p + 1;
            const start = (nextPage - 1) * voicesPerPage;
            const newVoices = filteredVoices.slice(start, start + voicesPerPage);
            if (newVoices.length > 0) {
              setDisplayedVoices(prev => [...prev, ...newVoices]);
              return nextPage;
            }
            return p;
          });
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [filteredVoices]);

  // Render voice grid with infinite scroll
  const renderVoiceGrid = () => {
    if (loadingVoices) {
      return (
        <div className="col-span-full flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      );
    }

    if (voices.length === 0) {
      return (
        <div className="col-span-full text-gray-400 text-center py-8">
          No voices available. Please upload a voice first.
        </div>
      );
    }

    if (filteredVoices.length === 0) {
      return (
        <div className="col-span-full text-gray-400 text-center py-8">
          No voices match your search.
        </div>
      );
    }

    return (
      <div 
        ref={scrollContainerRef}
        className="max-h-[400px] overflow-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-800"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
          {displayedVoices.map((voice) => (
            <m.div
              key={voice.id}
              className={`p-4 rounded-lg border ${
                formData.voice === voice.id
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-gray-700 hover:border-gray-600'
              } cursor-pointer transition-colors`}
              onClick={() => setFormData(prev => ({ ...prev, voice: voice.id }))}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-white truncate">{voice.displayName}</h4>
                  <div className="flex flex-wrap gap-2 mt-1 text-sm text-gray-400">
                    <span>{voice.provider}</span>
                    <span>•</span>
                    <span>{voice.sex}</span>
                    <span>•</span>
                    <span>{voice.voiceType}</span>
                    {voice.accent && (
                      <>
                        <span>•</span>
                        <span>{voice.accent}</span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleVoicePlayback(voice.id);
                  }}
                  className={`p-2 rounded-full flex-shrink-0 ml-2 ${
                    playingVoiceId === voice.id
                      ? 'bg-blue-500 text-white'
                      : loadingPlayback === voice.id
                      ? 'bg-gray-600 text-gray-300'
                      : playbackError === voice.id
                      ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  } transition-colors`}
                  disabled={loadingPlayback === voice.id}
                  aria-label={playingVoiceId === voice.id ? "Pause voice" : "Play voice"}
                >
                  {loadingPlayback === voice.id ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-b-transparent border-white/80" />
                  ) : playingVoiceId === voice.id ? (
                    <FiPause className="w-5 h-5" />
                  ) : playbackError === voice.id ? (
                    <FiAlertCircle className="w-5 h-5" />
                  ) : (
                    <FiPlay className="w-5 h-5" />
                  )}
                </button>
              </div>
            </m.div>
          ))}
        </div>
        {displayedVoices.length < filteredVoices.length && (
          <div ref={loadMoreRef} className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-b-transparent border-blue-500"></div>
          </div>
        )}
      </div>
    );
  };

  // Load agents on component mount
  useEffect(() => {
    const loadAgents = async () => {
      try {
        // Load saved agents
        const savedAgents = await getAgents();
        
        // Load draft agents
        const draftAgents = getDraftAgents();
        
        // Merge saved and draft agents, with drafts marked as drafts
        setAgents(prevAgents => {
          const mergedAgents: Record<string, AgentData> = {};
          
          // Add saved agents
          Object.entries(savedAgents).forEach(([id, agent]) => {
            const completeAgent: AgentData = {
              ...agent,
              id: id,
              name: agent.name || 'Untitled Agent',
              type: agent.type || 'website',
              voice: agent.voice || '',
              status: 'active',
              businessName: agent.businessName || '',
              purpose: agent.purpose || '',
              knowledgeBase: agent.knowledgeBase || '',
              systemPrompt: agent.systemPrompt || '',
              aiToSpeakFirst: agent.aiToSpeakFirst ?? false,
              enableBackchanneling: agent.enableBackchanneling ?? false,
              speechNormalization: agent.speechNormalization ?? false,
              sendEmailsToUsers: agent.sendEmailsToUsers ?? false,
              channels: {
                website: agent.channels?.website ?? false,
                phone: agent.channels?.phone ?? false,
                mobile: agent.channels?.mobile ?? false
              },
              settings: {
                workingHours: agent.settings?.workingHours ?? true,
                maskPII: agent.settings?.maskPII ?? false,
                saveTranscripts: agent.settings?.saveTranscripts ?? false,
                callAnalysis: agent.settings?.callAnalysis ?? false,
                designWidget: agent.settings?.designWidget ?? false,
                selectedPhone: agent.settings?.selectedPhone,
                widgetConfig: agent.settings?.widgetConfig,
                weeklyWorkingHours: agent.settings?.weeklyWorkingHours,
                tools: agent.settings?.tools
              },
              metadata: {
                clerkUserId: agent.metadata?.clerkUserId || '',
                vectorDbCollection: agent.metadata?.vectorDbCollection || '',
                livekitRoomPrefix: agent.metadata?.livekitRoomPrefix
              },
              customerAttributes: agent.customerAttributes ?? [],
              customAttributes: agent.customAttributes ?? ''
            };
            mergedAgents[id] = completeAgent;
          });
          
          // Add draft agents
          Object.entries(draftAgents).forEach(([id, agent]) => {
            if (!mergedAgents[id]) { // Only add if not already saved
              mergedAgents[id] = {
                ...agent,
                status: 'draft'
              };
            }
          });
          
          return mergedAgents;
        });
      } catch (error) {
        console.error('Error loading agents:', error);
        toast.error('Failed to load agents');
      }
    };
    loadAgents();
  }, []);

  // Auto-save form data with debouncing (local storage only)
  useEffect(() => {
    // Ensure we have a valid ID and are in create/edit mode
    if (!formData.id?.trim() || !showCreateForm) return;

    const debounceTimeout = setTimeout(() => {
      // Early return if we don't have required fields
      if (!formData.id?.trim()) {
        console.error('Cannot save agent without an ID');
        return;
      }

      const updatedData: AgentData = {
        id: formData.id.trim(), // Now TypeScript knows this is a non-empty string
        name: formData.name?.trim() || 'Untitled Agent',
        type: formData.type || 'website',
        voice: formData.voice || '',
        status: formData.status || 'draft',
        businessName: formData.businessName?.trim() || '',
        purpose: formData.purpose?.trim() || '',
        knowledgeBase: formData.knowledgeBase?.trim() || '',
        systemPrompt: formData.systemPrompt?.trim() || '',
        aiToSpeakFirst: formData.aiToSpeakFirst ?? false,
        enableBackchanneling: formData.enableBackchanneling ?? false,
        speechNormalization: formData.speechNormalization ?? false,
        sendEmailsToUsers: formData.sendEmailsToUsers ?? false,
        channels: {
          website: formData.channels?.website ?? false,
          phone: formData.channels?.phone ?? false,
          mobile: formData.channels?.mobile ?? false
        },
        webhookUrl: formData.webhookUrl?.trim() || '',
        lastModified: new Date().toISOString(),
        currentStep,
        settings: {
          workingHours: formData.settings?.workingHours ?? true,
          maskPII: formData.settings?.maskPII ?? false,
          saveTranscripts: formData.settings?.saveTranscripts ?? false,
          callAnalysis: formData.settings?.callAnalysis ?? false,
          designWidget: formData.settings?.designWidget ?? false,
          selectedPhone: formData.settings?.selectedPhone,
          widgetConfig: formData.settings?.widgetConfig,
          weeklyWorkingHours: formData.settings?.weeklyWorkingHours,
          tools: formData.settings?.tools
        },
        metadata: {
          clerkUserId: formData.metadata?.clerkUserId?.trim() || '',
          vectorDbCollection: formData.metadata?.vectorDbCollection?.trim() || '',
          livekitRoomPrefix: formData.metadata?.livekitRoomPrefix
        },
        customerAttributes: formData.customerAttributes ?? [],
        customAttributes: formData.customAttributes ?? '',
        warmupMessage: formData.warmupMessage,
        knowledgeBaseId: formData.knowledgeBaseId
      };

      saveDraftAgent(updatedData);
    }, 1000);

    return () => clearTimeout(debounceTimeout);
  }, [formData, currentStep, showCreateForm]);

  // Load draft data when editing
  useEffect(() => {
    if (selectedAgentId && showCreateForm) {
      const drafts = getDraftAgents();
      const draftData = drafts[selectedAgentId];
      if (draftData) {
        setFormData(draftData);
        setCurrentStep(draftData.currentStep || 1);
      }
    }
  }, [selectedAgentId, showCreateForm]);

  // Fetch voices when component mounts
  useEffect(() => {
    const fetchVoices = async () => {
      try {
        setLoadingVoices(true);
        const response = await fetch('/api/voices');
        if (!response.ok) {
          throw new Error(`Failed to fetch voices: ${response.statusText}`);
        }
        const data = await response.json();
        if (data.voices) {
          setVoices(data.voices);
        } else {
          throw new Error('No voices data received');
        }
      } catch (error) {
        console.error('Error fetching voices:', error);
        toast.error('Failed to load voices');
        setVoices([]); // Set empty array on error
      } finally {
        setLoadingVoices(false);
      }
    };

    if (user) { // Only fetch voices if user is logged in
      fetchVoices();
    }
  }, [user]); // Add user as dependency

  // Handle voice playback
  const handleVoicePlayback = async (voiceId: string) => {
    try {
      // If currently playing this voice, stop it
      if (playingVoiceId === voiceId && audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setPlayingVoiceId(null);
        return;
      }

      setLoadingPlayback(voiceId);
      setPlaybackError(null);

      const response = await fetch(`/api/voices/${voiceId}/play`);
      if (!response.ok) {
        throw new Error(`Failed to get voice URL: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (!data.url) {
        throw new Error('No playback URL received');
      }

      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      
      audioRef.current.src = data.url;
      await audioRef.current.play();
      setPlayingVoiceId(voiceId);
      
      audioRef.current.onended = () => {
        setPlayingVoiceId(null);
      };
    } catch (error) {
      console.error('Error playing voice sample:', error);
      setPlaybackError(voiceId);
      toast.error('Failed to play voice sample');
    } finally {
      setLoadingPlayback(null);
    }
  };

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Function to generate system prompt based on form data
  const generateSystemPrompt = useCallback(() => {
    const purpose = formData.purpose as string;
    if (!purpose || !PROMPT_TEMPLATES[purpose]) return '';

    const template = PROMPT_TEMPLATES[purpose].template;
    const attributes = Array.isArray(formData.customerAttributes) 
      ? formData.customerAttributes
        .filter(attr => attr !== 'others')
        .map(attr => {
          switch(attr) {
            case 'email': return 'email address';
            case 'phone': return 'phone number';
            case 'name': return 'full name';
            default: return attr;
          }
        })
        .concat(formData.customAttributes ? formData.customAttributes.split(',').map(s => s.trim()) : [])
        .join(', ')
      : '';

    return generatePrompt(template, {
      agentName: formData.name || '[Agent Name]',
      businessName: formData.businessName || '[Business Name]',
      attributes: attributes || '[Required Information]',
      enableBackchanneling: formData.enableBackchanneling || false
    });
  }, [formData]);

  // Update system prompt when form data changes
  useEffect(() => {
    if (!userEditedPrompt) {
      const newPrompt = generateSystemPrompt();
      if (newPrompt) {
        setFormData(prev => ({
          ...prev,
          systemPrompt: newPrompt
        }));
      }
    }
  }, [
    formData.purpose,
    formData.name,
    formData.businessName,
    formData.customerAttributes,
    formData.customAttributes,
    formData.enableBackchanneling,
    generateSystemPrompt,
    userEditedPrompt
  ]);

  const validateStep = (stepConfig: typeof AGENT_STEPS[0], data: Partial<AgentData>): boolean => {
    const fields = stepConfig.fields;
    return Object.entries(fields).every(([key, field]) => {
      if (field.required) {
        const value = data[key as keyof AgentData];
        return value !== undefined && value !== '' && value !== null;
      }
      return true;
    });
  };

  const handleNextStep = async (e: React.MouseEvent<HTMLButtonElement> | React.KeyboardEvent<HTMLButtonElement>) => {
    e.preventDefault();
    
    // Save current state to local storage before proceeding
    if (formData.id?.trim()) {
      const updatedData: AgentData = {
        id: formData.id.trim(),
        name: formData.name?.trim() || 'Untitled Agent',
        type: formData.type || 'website',
        voice: formData.voice || '',
        status: formData.status || 'draft',
        businessName: formData.businessName?.trim() || '',
        purpose: formData.purpose?.trim() || '',
        knowledgeBase: formData.knowledgeBase?.trim() || '',
        systemPrompt: formData.systemPrompt?.trim() || '',
        aiToSpeakFirst: formData.aiToSpeakFirst ?? false,
        enableBackchanneling: formData.enableBackchanneling ?? false,
        speechNormalization: formData.speechNormalization ?? false,
        sendEmailsToUsers: formData.sendEmailsToUsers ?? false,
        channels: {
          website: formData.channels?.website ?? false,
          phone: formData.channels?.phone ?? false,
          mobile: formData.channels?.mobile ?? false
        },
        webhookUrl: formData.webhookUrl?.trim() || '',
        lastModified: new Date().toISOString(),
        currentStep,
        settings: {
          workingHours: formData.settings?.workingHours ?? true,
          maskPII: formData.settings?.maskPII ?? false,
          saveTranscripts: formData.settings?.saveTranscripts ?? false,
          callAnalysis: formData.settings?.callAnalysis ?? false,
          designWidget: formData.settings?.designWidget ?? false,
          selectedPhone: formData.settings?.selectedPhone,
          widgetConfig: formData.settings?.widgetConfig,
          weeklyWorkingHours: formData.settings?.weeklyWorkingHours,
          tools: formData.settings?.tools
        },
        metadata: {
          clerkUserId: formData.metadata?.clerkUserId?.trim() || '',
          vectorDbCollection: formData.metadata?.vectorDbCollection?.trim() || '',
          livekitRoomPrefix: formData.metadata?.livekitRoomPrefix
        },
        customerAttributes: formData.customerAttributes ?? [],
        customAttributes: formData.customAttributes ?? '',
        warmupMessage: formData.warmupMessage,
        knowledgeBaseId: formData.knowledgeBaseId
      };

      await saveDraftAgent(updatedData);
    }

    // Validate current step before proceeding
    const stepConfig = AGENT_STEPS[currentStep - 1];
    if (!validateStep(stepConfig, formData)) {
      toast.error('Please fill in all required fields before proceeding');
      return;
    }

    // If it's the last step, submit the form
    if (currentStep === AGENT_STEPS.length) {
      handleSubmit(e);
      return;
    }

    // Move to next step
    setCurrentStep(prev => prev + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSubmitting(true);

      // Generate system prompt if not already set
      const systemPrompt = formData.systemPrompt || await generateSystemPrompt();
      
      // Ensure we have a valid ID
      if (!formData.id) {
        throw new Error('Agent ID is required');
      }

      // If website channel is enabled and widget is designed, prepare widget config
      let widgetConfig: WidgetConfig | undefined;
      if (formData.channels?.website && formData.settings?.designWidget) {
        // Get saved design from local storage using current draft ID
        const draftData = localStorage.getItem('knotie_ai_agent_drafts');
        const draftAgents = draftData ? JSON.parse(draftData) : {};
        const currentDraftId = Object.keys(draftAgents)[0];
        
        const savedDesign = getWidgetDesign(currentDraftId);
        if (savedDesign) {
          // Generate new embed code with the final agent ID
          const embedCode = generateEmbedCode(formData.id, savedDesign);
          
          const updatedWidgetConfig: WidgetConfig = {
            id: formData.id,
            agentId: formData.id,
            userId: savedDesign.userId || '',
            type: savedDesign.type || 'microphone',
            primaryColor: savedDesign.primaryColor || '#000000',
            secondaryColor: savedDesign.secondaryColor || '#1D4ED8',
            backgroundColor: savedDesign.backgroundColor || 'transparent',
            connectingColor: savedDesign.connectingColor || '#3B82F6',
            activeColor: savedDesign.activeColor || '#1D4ED8',
            endedColor: savedDesign.endedColor || '#ff0000',
            position: savedDesign.position || 'bottom-right',
            welcomeMessage: '',
            buttonText: '',
            size: 'medium',
            showParticles: true,
            showPulse: true,
            showBranding: savedDesign.showBranding ?? true,
            showTranscript: savedDesign.showTranscript ?? true,
            showAvatar: savedDesign.showAvatar ?? true,
            showName: savedDesign.showName ?? true,
            embedCode,
            callStatus: savedDesign.callStatus
          };
          
          widgetConfig = updatedWidgetConfig;
          
          // Save widget to database
          const widgetSaved = await saveWidgetConfig(updatedWidgetConfig);
          if (!widgetSaved) {
            throw new Error('Failed to save widget configuration');
          }
        }
      }
      
      // Prepare the complete agent data
      const completeAgentData: AgentData = {
        id: formData.id,  // We've already checked this is not undefined above
        name: formData.name || '',
        type: formData.type || 'website',
        voice: formData.voice || '',
        status: 'active',
        businessName: formData.businessName || '',
        purpose: formData.purpose || '',
        knowledgeBase: formData.knowledgeBase || '',
        systemPrompt: systemPrompt,
        aiToSpeakFirst: formData.aiToSpeakFirst ?? false,
        enableBackchanneling: formData.enableBackchanneling ?? false,
        speechNormalization: formData.speechNormalization ?? false,
        sendEmailsToUsers: formData.sendEmailsToUsers ?? false,
        channels: {
          website: formData.channels?.website ?? false,
          phone: formData.channels?.phone ?? false,
          mobile: formData.channels?.mobile ?? false
        },
        webhookUrl: formData.webhookUrl || '',
        lastModified: new Date().toISOString(),
        currentStep: formData.currentStep ?? 0,
        settings: {
          workingHours: true,
          maskPII: false,
          saveTranscripts: false,
          callAnalysis: false,
          designWidget: true,
          selectedPhone: formData.settings?.selectedPhone,
          widgetConfig: {
            id: widgetConfig?.id || '',
            agentId: widgetConfig?.agentId || '',
            userId: widgetConfig?.userId || '',
            primaryColor: widgetConfig?.primaryColor || '#000000',
            secondaryColor: widgetConfig?.secondaryColor || '#1D4ED8',
            backgroundColor: widgetConfig?.backgroundColor || 'transparent',
            connectingColor: widgetConfig?.connectingColor || '#3B82F6',
            activeColor: widgetConfig?.activeColor || '#1D4ED8',
            endedColor: widgetConfig?.endedColor || '#ff0000',
            position: widgetConfig?.position === 'center' ? 'center' : 
              (widgetConfig?.position === 'bottom-left' ? 'bottom-left' : 'bottom-right'),
            showBranding: widgetConfig?.showBranding ?? true,
            showTranscript: widgetConfig?.showTranscript ?? true,
            showAvatar: widgetConfig?.showAvatar ?? true,
            showName: widgetConfig?.showName ?? true,
            embedCode: widgetConfig?.embedCode
          },
          weeklyWorkingHours: formData.settings?.weeklyWorkingHours,
          tools: formData.settings?.tools
        },
        metadata: {
          clerkUserId: user?.id || '',
          livekitRoomPrefix: formData.metadata?.livekitRoomPrefix,
          vectorDbCollection: formData.metadata?.vectorDbCollection || ''
        },
        warmupMessage: formData.warmupMessage,
        knowledgeBaseId: formData.knowledgeBaseId,
        customerAttributes: formData.customerAttributes,
        customAttributes: formData.customAttributes
      };
      
      // Save agent data to API
      await saveAgentData(completeAgentData);
      
      // Clear the draft after successful save
      clearDraftAgent(formData.id);

      // Show success message
      toast.success('Agent saved successfully!');
      
      // Reset form and state
      setFormData({
        id: '',
        name: '',
        type: 'website',
        voice: '',
        warmupMessage: '',
        status: 'draft',
        businessName: '',
        purpose: '',
        knowledgeBase: '',
        systemPrompt: '',
        aiToSpeakFirst: false,
        enableBackchanneling: false,
        speechNormalization: false,
        sendEmailsToUsers: false,
        channels: {
          website: false,
          phone: false,
          mobile: false
        },
        webhookUrl: '',
        settings: {
          workingHours: false,
          maskPII: false,
          saveTranscripts: false,
          callAnalysis: false
        },
        metadata: {
          clerkUserId: '',
          vectorDbCollection: '',
          livekitRoomPrefix: undefined
        },
        customerAttributes: [],
        customAttributes: '',
        lastModified: new Date().toISOString(),
        currentStep: 1
      });
      setCurrentStep(1);
      setSelectedAgentId(null);
      setUserEditedPrompt(false);
      setShowWidgetDesigner(false);
      
      // Exit create/edit mode first
      setShowCreateForm(false);
      
      // Then refresh agents list
      const loadedAgents = await getAgents();
      setAgents((prev) => ({
        ...prev,
        ...loadedAgents
      }));
      
    } catch (error) {
      console.error('Error saving AI Employee:', error);
      toast.error('Failed to save AI Employee. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWidgetDesignSave = async (design: WidgetConfig) => {
    try {
      if (!selectedAgentId) {
        console.error('❌ [Agent] No AI Employee selected for saving widget design');
        toast.error('No AI Employee selected');
        return;
      }

      console.log('🎨 [Agent] Saving widget design for AI Employee:', selectedAgentId);
      console.log('📋 [Agent] Design config received:', design);

      // Save the widget design with default values for required boolean fields
      await saveWidgetDesign(selectedAgentId, {
        ...design,
        id: selectedAgentId,
        agentId: selectedAgentId,
        userId: design.userId ?? '',
        size: design.size || 'medium',
        showParticles: design.showParticles ?? true,
        showPulse: design.showPulse ?? true,
        showBranding: design.showBranding ?? true,
        showTranscript: design.showTranscript ?? true,
        showAvatar: design.showAvatar ?? true,
        showName: design.showName ?? true
      });

      console.log('✅ [Agent] Widget design saved successfully');
      toast.success('Widget design saved successfully');
      setShowWidgetDesigner(false);
    } catch (error) {
      console.error('❌ [Agent] Error saving widget design:', error);
      toast.error('Failed to save widget design');
    }
  };

  const handleGoLive = async () => {
    if (!user?.id) {
      toast.error('You must be logged in to create an agent');
      return;
    }

    // Generate a unique ID for the agent if it doesn't exist
    const agentId = formData.id || uuidv4();
    
    // Generate widget config if website channel is enabled
    let widgetConfig: WidgetConfig | undefined;
    if (formData.channels?.website && formData.settings?.designWidget) {
      // Get saved design from local storage or use defaults
      const savedDesign = formData.id ? getWidgetDesign(formData.id) : null;
      
      const defaultWidgetConfig: import('@/types/widget').WidgetConfig = {
        id: '',
        agentId: selectedAgentId || '',
        userId: '',
        type: 'microphone',
        primaryColor: '#000000',
        secondaryColor: '#1D4ED8',
        backgroundColor: 'transparent',
        connectingColor: '#3B82F6',
        activeColor: '#1D4ED8',
        endedColor: '#ff0000',
        position: 'bottom-right',
        welcomeMessage: '',
        buttonText: '',
        size: 'medium',
        showBranding: true,
        showTranscript: true,
        showAvatar: true,
        showName: true,
        embedCode: '',
        callStatus: undefined,
        showParticles: true,
        showPulse: true
      };

      const initialWidgetConfig: import('@/types/widget').WidgetConfig = {
        id: savedDesign?.id || '',
        agentId: savedDesign?.agentId || '',
        userId: savedDesign?.userId || '',
        type: savedDesign?.type ?? 'microphone',
        primaryColor: savedDesign?.primaryColor ?? formData.settings?.widgetConfig?.primaryColor ?? '#000000',
        secondaryColor: savedDesign?.secondaryColor ?? formData.settings?.widgetConfig?.secondaryColor ?? '#1D4ED8',
        backgroundColor: savedDesign?.backgroundColor || formData.settings?.widgetConfig?.backgroundColor || 'transparent',
        connectingColor: savedDesign?.connectingColor || formData.settings?.widgetConfig?.connectingColor || '#3B82F6',
        activeColor: savedDesign?.activeColor || formData.settings?.widgetConfig?.activeColor || '#1D4ED8',
        endedColor: savedDesign?.endedColor || '#ff0000',
        position: savedDesign?.position === 'center' ? 'center' : 
          (savedDesign?.position === 'bottom-left' ? 'bottom-left' : 'bottom-right'),
        welcomeMessage: '',
        buttonText: '',
        size: savedDesign?.size || 'medium',
        showBranding: savedDesign?.showBranding ?? true,
        showTranscript: savedDesign?.showTranscript ?? true,
        showAvatar: savedDesign?.showAvatar ?? true,
        showName: savedDesign?.showName ?? true,
        embedCode: savedDesign?.embedCode || '',
        callStatus: savedDesign?.callStatus,
        showParticles: true,
        showPulse: true
      };

      widgetConfig = initialWidgetConfig;
    }

    // Prepare the complete agent data
    const completeAgentData: AgentData = {
      id: agentId,
      name: formData.name || '',
      type: formData.type || 'website',
      voice: formData.voice || '',
      status: 'active',
      businessName: formData.businessName || '',
      purpose: formData.purpose || '',
      knowledgeBase: formData.knowledgeBase || '',
      systemPrompt: formData.systemPrompt || '',
      aiToSpeakFirst: formData.aiToSpeakFirst ?? false,
      enableBackchanneling: formData.enableBackchanneling ?? false,
      speechNormalization: formData.speechNormalization ?? false,
      sendEmailsToUsers: formData.sendEmailsToUsers ?? false,
      channels: {
        website: formData.channels?.website ?? false,
        phone: formData.channels?.phone ?? false,
        mobile: formData.channels?.mobile ?? false
      },
      webhookUrl: formData.webhookUrl || '',
      lastModified: new Date().toISOString(),
      currentStep: formData.currentStep ?? 0,
      settings: {
        workingHours: true,
        maskPII: false,
        saveTranscripts: false,
        callAnalysis: false,
        designWidget: true,
        selectedPhone: formData.settings?.selectedPhone,
        widgetConfig: {
          id: widgetConfig?.id || '',
          agentId: widgetConfig?.agentId || '',
          userId: widgetConfig?.userId || '',
          primaryColor: widgetConfig?.primaryColor || '#000000',
          secondaryColor: widgetConfig?.secondaryColor || '#1D4ED8',
          backgroundColor: widgetConfig?.backgroundColor || 'transparent',
          connectingColor: widgetConfig?.connectingColor || '#3B82F6',
          activeColor: widgetConfig?.activeColor || '#1D4ED8',
          endedColor: widgetConfig?.endedColor || '#ff0000',
          position: widgetConfig?.position === 'center' ? 'center' : 
            (widgetConfig?.position === 'bottom-left' ? 'bottom-left' : 'bottom-right'),
          showBranding: widgetConfig?.showBranding ?? true,
          showTranscript: widgetConfig?.showTranscript ?? true,
          showAvatar: widgetConfig?.showAvatar ?? true,
          showName: widgetConfig?.showName ?? true,
          embedCode: widgetConfig?.embedCode
        },
        weeklyWorkingHours: formData.settings?.weeklyWorkingHours,
        tools: formData.settings?.tools
      },
      metadata: {
        clerkUserId: user.id,
        livekitRoomPrefix: formData.metadata?.livekitRoomPrefix,
        vectorDbCollection: formData.metadata?.vectorDbCollection || ''
      },
      warmupMessage: formData.warmupMessage,
      knowledgeBaseId: formData.knowledgeBaseId,
      customerAttributes: formData.customerAttributes,
      customAttributes: formData.customAttributes
    };
    
    try {
      // Save the agent data
      await saveAgentData(completeAgentData);
      
      // Update agents list
      setAgents((prev) => ({
        ...prev,
        [agentId]: completeAgentData
      }));

      // Show success message
      toast.success('AI Employee is now live!');

      // Reset form and go back to list view
      setShowCreateForm(false);
    } catch (error) {
      console.error('Error creating AI Employee:', error);
      toast.error('Failed to create AI Employee. Please try again.');
    }
  };

  const steps = AGENT_STEPS.map(step => ({
    title: step.title,
    description: step.description || ''
  }));

  const handleStepClick = (step: number) => {
    // Only allow clicking on completed steps or the next step
    if (step <= currentStep) {
      setCurrentStep(step);
    }
  };

  const handleActionSelect = (type: 'transfer' | 'function') => {
    setActionModalType(type);
    setShowActionModal(true);
    setEditingAction(null);
  };

  const handleActionSave = (actionData: any) => {
    const actionId = editingAction?.id || uuidv4();
    const newAction = {
      ...actionData,
      id: actionId,
      type: actionModalType
    };

    setFormData(prev => ({
      ...prev,
      savedActions: prev.savedActions ? {
        ...prev.savedActions,
        [actionId]: newAction
      } : {
        [actionId]: newAction
      }
    }));

    setShowActionModal(false);
    setEditingAction(null);
  };

  const handleActionEdit = (action: any) => {
    setActionModalType(action.type);
    setEditingAction(action);
    setShowActionModal(true);
  };

  const handleActionDelete = (actionId: string) => {
    setFormData(prev => {
      const { [actionId]: _, ...rest } = prev.savedActions || {};
      return {
        ...prev,
        savedActions: rest
      };
    });
  };

  const handleWorkingHoursSave = (hours: WeeklyWorkingHours) => {
    setFormData(prev => ({
      ...prev,
      settings: {
        workingHours: true,
        weeklyWorkingHours: {
          monday: { enabled: true, startTime: hours.monday.startTime, endTime: hours.monday.endTime },
          tuesday: { enabled: true, startTime: hours.tuesday.startTime, endTime: hours.tuesday.endTime },
          wednesday: { enabled: true, startTime: hours.wednesday.startTime, endTime: hours.wednesday.endTime },
          thursday: { enabled: true, startTime: hours.thursday.startTime, endTime: hours.thursday.endTime },
          friday: { enabled: true, startTime: hours.friday.startTime, endTime: hours.friday.endTime },
          saturday: { enabled: false, startTime: hours.saturday.startTime, endTime: hours.saturday.endTime },
          sunday: { enabled: false, startTime: hours.sunday.startTime, endTime: hours.sunday.endTime }
        } as WeeklyWorkingHours,
        maskPII: prev.settings?.maskPII ?? false,
        saveTranscripts: prev.settings?.saveTranscripts ?? false,
        callAnalysis: prev.settings?.callAnalysis ?? false,
        designWidget: prev.settings?.designWidget ?? false,
        selectedPhone: prev.settings?.selectedPhone,
        widgetConfig: prev.settings?.widgetConfig,
        tools: prev.settings?.tools
      }
    }));
  };

  const handleEditAgent = async (id: string) => {
    try {
      const agent = await getAgentById(id);
      if (agent) {
        // Get the widget configuration if it exists
        if (agent.channels?.website) {
          // First check local storage for any unsaved design
          const savedDesign = getWidgetDesign(id);
          if (savedDesign) {
            agent.settings = {
              ...agent.settings,
              widgetConfig: {
                ...agent.settings?.widgetConfig,
                ...savedDesign
              }
            };
          } else {
            // If no local design, get from database
            const widget = await getWidgetByAgentId(id);
            if (widget) {
              agent.settings = {
                ...agent.settings,
                widgetConfig: widget
              };
            }
          }
        }

        setFormData({
          ...agent,
          channels: {
            website: agent.channels?.website ?? false,
            phone: agent.channels?.phone ?? false,
            mobile: agent.channels?.mobile ?? false
          },
          settings: {
            workingHours: agent.settings?.workingHours ?? true,
            maskPII: agent.settings?.maskPII ?? false,
            saveTranscripts: agent.settings?.saveTranscripts ?? false,
            callAnalysis: agent.settings?.callAnalysis ?? false,
            designWidget: agent.settings?.designWidget ?? false,
            selectedPhone: agent.settings?.selectedPhone,
            widgetConfig: agent.settings?.widgetConfig
          }
        });
        setSelectedAgentId(id);
        setCurrentStep(agent.currentStep || 1);
        setShowCreateForm(true);
      } else {
        toast.error('Failed to load agent data');
      }
    } catch (error) {
      console.error('Error loading agent:', error);
      toast.error('Failed to load agent data');
    }
  };

  const handleDeleteAgent = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this AI Employee?')) {
      try {
        // Get the agent to check if it's a draft
        const agent = agents[id];
        
        if (agent.status === 'draft') {
          // If it's a draft, just clear it from draft storage
          clearDraftAgent(id);
        } else {
          // If it's a published agent, delete from API
          await deleteAgent(id);
        }

        // Update local state
        setAgents(prev => {
          const updated = { ...prev };
          delete updated[id];
          return updated;
        });

        toast.success('AI Employee deleted successfully');
      } catch (error) {
        console.error('Error deleting AI Employee:', error);
        toast.error('Failed to delete AI Employee');
      }
    }
  };

  const renderForm = () => {
    const stepConfig = AGENT_STEPS[currentStep - 1];
    const isLastStep = currentStep === AGENT_STEPS.length;

    const renderGoLiveSettings = () => (
      <div className="flex flex-col gap-8">
        <LiveChannels
          channels={formData.channels || {
            website: false,
            phone: false,
            mobile: false
          }}
          settings={{
            designWidget: formData.settings?.designWidget,
            widgetConfig: formData.settings?.widgetConfig ? {
              id: formData.settings.widgetConfig.id || '',
              agentId: formData.settings.widgetConfig.agentId || '',
              userId: formData.settings.widgetConfig.userId || '',
              type: 'microphone',
              primaryColor: formData.settings.widgetConfig.primaryColor || '#000000',
              secondaryColor: formData.settings.widgetConfig.secondaryColor || '#1D4ED8',
              backgroundColor: formData.settings.widgetConfig.backgroundColor || 'transparent',
              connectingColor: formData.settings.widgetConfig.connectingColor || '#3B82F6',
              activeColor: formData.settings.widgetConfig.activeColor || '#1D4ED8',
              endedColor: formData.settings.widgetConfig.endedColor || '#ff0000',
              position: formData.settings.widgetConfig.position === 'center' ? 'center' : 
                (formData.settings.widgetConfig.position === 'bottom-left' ? 'bottom-left' : 'bottom-right'),
              welcomeMessage: '',
              buttonText: '',
              size: 'medium',
              showParticles: true,
              showPulse: true,
              showBranding: formData.settings.widgetConfig.showBranding ?? true,
              showTranscript: formData.settings.widgetConfig.showTranscript ?? true,
              showAvatar: formData.settings.widgetConfig.showAvatar ?? true,
              showName: formData.settings.widgetConfig.showName ?? true,
              embedCode: formData.settings.widgetConfig.embedCode || ''
            } : undefined,
            workingHours: formData.settings?.workingHours ?? true,
            maskPII: formData.settings?.maskPII ?? false,
            saveTranscripts: formData.settings?.saveTranscripts ?? false,
            callAnalysis: formData.settings?.callAnalysis ?? false,
            phoneNumber: formData.settings?.selectedPhone
          }}
          onChannelChange={(channels) => {
            setFormData(prev => ({
              ...prev,
              channels: {
                website: channels.website ?? false,
                phone: channels.phone ?? false,
                mobile: channels.mobile ?? false
              }
            }));
          }}
          onSettingChange={(settings) => {
            setFormData(prev => ({
              ...prev,
              settings: {
                ...(prev.settings || {}),
                designWidget: settings.designWidget,
                workingHours: settings.workingHours ?? false,
                maskPII: settings.maskPII ?? false,
                saveTranscripts: settings.saveTranscripts ?? false,
                callAnalysis: settings.callAnalysis ?? false,
                selectedPhone: settings.phoneNumber,
                widgetConfig: settings.widgetConfig ? {
                  id: settings.widgetConfig.id || '',
                  agentId: settings.widgetConfig.agentId || '',
                  userId: settings.widgetConfig.userId || '',
                  type: 'microphone',
                  primaryColor: settings.widgetConfig.primaryColor || '#000000',
                  secondaryColor: settings.widgetConfig.secondaryColor || '#1D4ED8',
                  backgroundColor: settings.widgetConfig.backgroundColor || '#1F2937',
                  connectingColor: settings.widgetConfig.connectingColor || '#3B82F6',
                  activeColor: settings.widgetConfig.activeColor || '#1D4ED8',
                  endedColor: settings.widgetConfig.endedColor || '#ff0000',
                  position: settings.widgetConfig.position === 'center' ? 'center' : 
                    (settings.widgetConfig.position === 'bottom-left' ? 'bottom-left' : 'bottom-right'),
                  welcomeMessage: '',
                  buttonText: '',
                  size: 'medium',
                  showParticles: true,
                  showPulse: true,
                  showBranding: settings.widgetConfig.showBranding ?? true,
                  showTranscript: settings.widgetConfig.showTranscript ?? true,
                  showAvatar: settings.widgetConfig.showAvatar ?? true,
                  showName: settings.widgetConfig.showName ?? true,
                  embedCode: settings.widgetConfig.embedCode || ''
                } : prev.settings?.widgetConfig,
                weeklyWorkingHours: prev.settings?.weeklyWorkingHours,
                tools: prev.settings?.tools
              }
            }));
          }}
        />
      </div>
    );

    return (
      <m.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        <div className="mb-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white">
                {currentStep === 1 ? 'Create New AI Employee' : 
                 currentStep === 2 ? 'Set Goals' :
                 currentStep === 3 ? 'Setup Employee Actions' :
                 'Configure Deployment Settings'}
              </h1>
              <p className="text-gray-400 mt-1">
                {currentStep === 1
                  ? 'Configure your employee\'s basic information'
                  : currentStep === 2
                  ? 'Set your employee\'s goals and purpose'
                  : currentStep === 3
                  ? 'Setup actions for your employee'
                  : 'Configure deployment settings'}
              </p>
            </div>
            <button
              onClick={() => setShowCreateForm(false)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>

          <StepProgress
            steps={steps}
            currentStep={currentStep}
            onStepClick={handleStepClick}
          />
        </div>

        <m.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="bg-gray-800/50 rounded-lg border border-gray-700 p-8"
        >
          <h3 className="text-xl font-medium text-white mb-6">{stepConfig.title}</h3>
          
          {isLastStep ? renderGoLiveSettings() : (
            <div className="space-y-6">
              {Object.entries(stepConfig.fields).map(([key, field]) => {
                const value = formData[key as keyof AgentData];
                
                if (field.type === 'tile-selector') {
                  const getIcon = (iconName: string) => {
                    switch (iconName) {
                      case 'phone-incoming':
                        return <FiPhoneIncoming className="w-6 h-6" />;
                      case 'phone-outgoing':
                        return <FiPhoneOutgoing className="w-6 h-6" />;
                      case 'message-square':
                        return <FiMessageSquare className="w-6 h-6" />;
                      case 'smartphone':
                        return <FiSmartphone className="w-6 h-6" />;
                      case 'message-mic':
                        return (
                          <div className="relative">
                            <FiMessageSquare className="w-6 h-6" />
                            <FiMic className="w-3.5 h-3.5 absolute -bottom-0.5 -right-0.5 text-current" />
                          </div>
                        );
                      default:
                        return null;
                    }
                  };

                  return (
                    <FormField
                      key={key}
                      label={field.label}
                      required={field.required}
                      tooltip={field.tooltip}
                      error={formErrors[key]}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                        {field.options.map((option: SelectOption) => (
                          <m.div
                            key={option.value}
                            className={`p-4 rounded-lg border ${
                              formData[key as keyof AgentData] === option.value
                                ? 'border-blue-500 bg-blue-500/10'
                                : 'border-gray-700 hover:border-gray-600'
                            } cursor-pointer transition-colors`}
                            onClick={() => setFormData(prev => ({
                              ...prev,
                              [key]: option.value
                            }))}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-white">{option.label}</h4>
                                <div className="flex flex-wrap gap-2 mt-1 text-sm text-gray-400">
                                  <span>{option.description}</span>
                                </div>
                              </div>
                              <div className="text-blue-500">
                                {formData[key as keyof AgentData] === option.value && (
                                  <FiCheck className="w-5 h-5" />
                                )}
                              </div>
                            </div>
                          </m.div>
                        ))}
                      </div>
                    </FormField>
                  );
                }

                if (field.type === 'attribute-selector') {
                  const getIcon = (iconName: string) => {
                    switch (iconName) {
                      case 'mail':
                        return <FiMail className="w-6 h-6" />;
                      case 'phone':
                        return <FiPhone className="w-6 h-6" />;
                      case 'user':
                        return <FiUser className="w-6 h-6" />;
                      case 'plus-circle':
                        return <FiPlusCircle className="w-6 h-6" />;
                      default:
                        return null;
                    }
                  };

                  return (
                    <FormField
                      key={key}
                      label={field.label}
                      required={field.required}
                      tooltip={field.tooltip}
                      error={formErrors[key]}
                    >
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2">
                        {field.options.map((option: SelectOption) => {
                          const isSelected = Array.isArray(value) 
                            ? value.includes(option.value)
                            : value === option.value;

                          return (
                            <m.div
                              key={option.value}
                              className={`p-4 rounded-lg border ${
                                isSelected
                                  ? 'border-blue-500 bg-blue-500/10'
                                  : 'border-gray-700 hover:border-gray-600'
                              } cursor-pointer transition-colors`}
                              onClick={() => {
                                let newValue;
                                if (Array.isArray(value)) {
                                  newValue = isSelected
                                    ? value.filter(v => v !== option.value)
                                    : [...value, option.value];
                                } else {
                                  newValue = isSelected ? [] : [option.value];
                                }
                                setFormData(prev => ({
                                  ...prev,
                                  [key]: newValue,
                                  // Clear custom attributes if 'others' is deselected
                                  ...(option.value === 'others' && !isSelected 
                                    ? { customAttributes: '' }
                                    : {})
                                }));
                              }}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                            >
                              <div className="flex flex-col items-center text-center space-y-2">
                                <div className={`p-3 rounded-lg ${
                                  isSelected
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-800 text-gray-400'
                                }`}>
                                  {getIcon(option.icon)}
                                </div>
                                <div>
                                  <h4 className="font-medium text-white">{option.label}</h4>
                                </div>
                              </div>
                            </m.div>
                          );
                        })}
                      </div>
                    </FormField>
                  );
                }

                if (field.type === 'textarea' && field.dependsOn) {
                  const dependentValue = formData[field.dependsOn.field as keyof AgentData];
                  const shouldShow = Array.isArray(dependentValue) && dependentValue.includes(field.dependsOn.value);

                  if (!shouldShow) return null;

                  return (
                    <FormField
                      key={key}
                      label={field.label}
                      required={field.required}
                      tooltip={field.tooltip}
                      error={formErrors[key]}
                    >
                      <textarea
                        value={value as string}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          [key]: e.target.value
                        }))}
                        placeholder="Enter attributes separated by commas (e.g., company, job title, location)"
                        className="mt-1 block w-full rounded-lg border-gray-600 bg-gray-700 text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors"
                        rows={3}
                      />
                    </FormField>
                  );
                }

                if (field.type === 'voice-selector') {
                  return (
                    <FormField
                      key={key}
                      label={field.label}
                      required={field.required}
                      tooltip={field.tooltip}
                      error={formErrors[key]}
                    >
                      <div className="space-y-4">
                        <div className="relative">
                          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search voices..."
                            value={voiceSearch}
                            onChange={(e) => setVoiceSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500 transition-colors"
                            aria-label="Search voices"
                          />
                        </div>
                        {renderVoiceGrid()}
                      </div>
                    </FormField>
                  );
                }

                if (field.type === 'knowledgebase-selector') {
                  return (
                    <div key={key} className="mt-4">
                      <label className="block text-sm font-medium text-gray-200 mb-2">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      {field.tooltip && (
                        <p className="text-xs text-gray-400 mb-2">{field.tooltip}</p>
                      )}
                      <KnowledgebaseSelector
                        value={formData[key as keyof AgentData] as string}
                        onChange={(value) => setFormData(prev => ({
                          ...prev,
                          [key]: value
                        }))}
                      />
                    </div>
                  );
                }

                if (field.type === 'action-selector') {
                  return (
                    <FormField
                      key={key}
                      label={field.label}
                      required={field.required}
                      tooltip={field.tooltip}
                      error={formErrors[key]}
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                        {field.options.map((option: SelectOption) => (
                          <m.div
                            key={option.value}
                            className="p-4 rounded-lg border border-gray-700 hover:border-gray-600 cursor-pointer transition-colors"
                            onClick={() => handleActionSelect(option.value as 'transfer' | 'function')}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <div className="flex items-start space-x-4">
                              <div className={`p-3 rounded-lg ${
                                option.value === 'transfer'
                                  ? 'bg-blue-500/10 text-blue-500'
                                  : 'bg-purple-500/10 text-purple-500'
                              }`}>
                                {option.value === 'transfer' ? (
                                  <FiPhone className="w-6 h-6" />
                                ) : (
                                  <FiCode className="w-6 h-6" />
                                )}
                              </div>
                              <div className="flex-1">
                                <h4 className="font-medium text-white">{option.label}</h4>
                                <p className="text-sm text-gray-400 mt-1">{option.description}</p>
                              </div>
                            </div>
                          </m.div>
                        ))}
                      </div>
                    </FormField>
                  );
                }

                if (field.type === 'action-tiles') {
                  const savedActions = formData.savedActions || {};
                  
                  return (
                    <div key={key} className="mt-8">
                      {Object.keys(savedActions).length > 0 && (
                        <>
                          <h3 className="text-lg font-medium text-white mb-4">{field.label}</h3>
                          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                            {Object.values(savedActions).map((action: any) => (
                              <ActionTile
                                key={action.id}
                                action={action}
                                onEdit={handleActionEdit}
                                onDelete={handleActionDelete}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  );
                }

                if (typeof value === 'boolean') {
                  return (
                    <div key={key} className="flex items-start space-x-3 mt-4">
                      <div className="flex items-center h-5">
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            [key]: e.target.checked
                          }))}
                          className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-800"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <label className="text-sm font-medium text-gray-200">
                          {field.label}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        {field.tooltip && (
                          <p className="text-xs text-gray-400 mt-0.5">{field.tooltip}</p>
                        )}
                      </div>
                    </div>
                  );
                }

                if (field.options) {
                  return (
                    <FormField
                      key={key}
                      label={field.label}
                      required={field.required}
                      tooltip={field.tooltip}
                      error={formErrors[key]}
                    >
                      <select
                        value={value as string}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          [key]: e.target.value
                        }))}
                        className="mt-1 block w-full rounded-lg border-gray-600 bg-gray-700 text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors"
                      >
                        <option value="">Select {field.label}</option>
                        {field.options.map((opt: SelectOption) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </FormField>
                  );
                }

                if (field.type === 'text' || field.type === 'url') {
                  return (
                    <FormField
                      key={key}
                      label={field.label}
                      required={field.required}
                      tooltip={field.tooltip}
                      error={formErrors[key]}
                      className="mt-4"
                    >
                      <input
                        type={field.type}
                        value={value as string}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          [key]: e.target.value
                        }))}
                        placeholder={field.placeholder}
                        className="block w-full rounded-lg border border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500 transition-colors"
                      />
                    </FormField>
                  );
                }

                if (key === 'systemPrompt') {
                  return (
                    <FormField
                      key={key}
                      label={field.label}
                      required={field.required}
                      tooltip={field.tooltip}
                      error={formErrors[key]}
                    >
                      <textarea
                        value={value as string}
                        onChange={(e) => {
                          setUserEditedPrompt(true);
                          setFormData(prev => ({
                            ...prev,
                            [key]: e.target.value
                          }));
                        }}
                        rows={6}
                        className="mt-1 block w-full rounded-lg border-gray-600 bg-gray-700 text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors"
                      />
                    </FormField>
                  );
                }

                return (
                  <FormField
                    key={key}
                    label={field.label}
                    required={field.required}
                    tooltip={field.tooltip}
                    error={formErrors[key]}
                  >
                    {key === 'systemPrompt' ? (
                      <textarea
                        value={value as string}
                        onChange={(e) => {
                          setUserEditedPrompt(true);
                          setFormData(prev => ({
                            ...prev,
                            [key]: e.target.value
                          }));
                        }}
                        rows={6}
                        className="mt-1 block w-full rounded-lg border-gray-600 bg-gray-700 text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors"
                      />
                    ) : (
                      <input
                        type="text"
                        value={value as string}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          [key]: e.target.value
                        }))}
                        className="mt-1 block w-full rounded-lg border-gray-600 bg-gray-700 text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors"
                      />
                    )}
                  </FormField>
                );
              })}
            </div>
          )}

          <div className="mt-8 flex items-center justify-between gap-4">
            {currentStep > 1 && (
              <m.button
                type="button"
                onClick={() => setCurrentStep(prev => prev - 1)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center px-4 py-2.5 border border-gray-600 rounded-lg text-sm font-medium 
                  text-gray-200 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 
                  transition-colors"
              >
                <FiArrowLeft className="mr-2 -ml-1 h-5 w-5" />
                Previous
              </m.button>
            )}
            <m.button
              type="submit"
              onClick={handleNextStep}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`inline-flex items-center px-4 py-2.5 rounded-lg text-sm font-medium ${
                isLastStep
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-gray-700 text-white hover:bg-gray-600'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ml-auto`}
            >
              {isLastStep ? (
                <>
                  Create Agent
                  <FiCheck className="ml-2 -mr-1 h-5 w-5" />
                </>
              ) : (
                <>
                  Next
                  <FiArrowRight className="ml-2 -mr-1 h-5 w-5" />
                </>
              )}
            </m.button>
          </div>
        </m.div>
      </m.div>
    );
  };

  const handleCreateAgent = () => {
    setSelectedAgentId(null);
    setFormData({
      id: uuidv4(), 
      name: '',
      type: 'website',
      voice: '',
      warmupMessage: '',
      status: 'draft',
      businessName: '',
      purpose: '',
      knowledgeBase: '',
      systemPrompt: '',
      aiToSpeakFirst: false,
      enableBackchanneling: false,
      speechNormalization: false,
      sendEmailsToUsers: false,
      channels: {
        website: false,
        phone: false,
        mobile: false
      },
      webhookUrl: '',
      settings: {
        workingHours: false,
        maskPII: false,
        saveTranscripts: false,
        callAnalysis: false
      },
      metadata: {
        clerkUserId: '',
        vectorDbCollection: '',
        livekitRoomPrefix: undefined
      },
      customerAttributes: [],
      customAttributes: '',
      lastModified: new Date().toISOString(),
      currentStep: 1
    });
    setCurrentStep(1);
    setShowCreateForm(true);
  };

  const renderAgentList = () => (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-semibold text-white">My AI Employees</h2>
          <p className="text-gray-400 mt-1">Create and manage your AI Employees</p>
        </div>
        <m.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleCreateAgent}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FiPlus className="w-5 h-5 mr-2" />
          Create A New AI Employee
        </m.button>
      </div>
      
      <AnimatePresence mode="popLayout">
        <div className="grid gap-4">
          {Object.entries(agents).length === 0 ? (
            <m.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-16 bg-gray-800/50 rounded-lg border border-gray-700"
            >
              <div className="flex justify-center mb-4">
                <FiMessageSquare className="w-16 h-16 text-gray-400" />
              </div>
              <h3 className="text-xl font-medium text-white mb-2">No AI Employees Created Yet</h3>
              <p className="text-gray-400 mb-8 max-w-md mx-auto">
                Create your first AI employee to start automating conversations and tasks
              </p>
              <m.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleCreateAgent}
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <FiPlus className="w-5 h-5 mr-2" />
                Create A New AI Employee
              </m.button>
            </m.div>
          ) : (
            Object.entries(agents).map(([id, agent]) => (
              <AgentCard
                key={id}
                agent={agent}
                onEdit={() => {
                  // Load draft if available when editing
                  const draftAgent = getDraftAgents()[id];
                  if (draftAgent) {
                    setFormData(draftAgent);
                  } else {
                    setFormData(agent);
                  }
                  setSelectedAgentId(id);
                  setCurrentStep(agent.currentStep || 1);
                  setShowCreateForm(true);
                }}
                onDelete={handleDeleteAgent}
              />
            ))
          )}
        </div>
      </AnimatePresence>
    </div>
  );

  return (
    <div className="p-6 text-white">
      <AnimatePresence mode="wait">
        {showCreateForm ? renderForm() : renderAgentList()}
      </AnimatePresence>
      {showActionModal && (
        <ActionModal
          type={actionModalType}
          isOpen={showActionModal}
          onClose={() => {
            setShowActionModal(false);
            setEditingAction(null);
          }}
          onSave={handleActionSave}
          initialData={editingAction}
          userId={user?.id as string}
        />
      )}
      {showWorkingHoursModal && (
        <WorkingHoursModal
          isOpen={showWorkingHoursModal}
          onClose={() => setShowWorkingHoursModal(false)}
          onSave={handleWorkingHoursSave}
          initialHours={formData.settings?.weeklyWorkingHours}
        />
      )}
      {showWidgetDesigner && selectedAgentId && (
        <WidgetDesigner
          agentId={selectedAgentId}
          onClose={() => setShowWidgetDesigner(false)}
          onSave={handleWidgetDesignSave}
        />
      )}
    </div>
  );
}