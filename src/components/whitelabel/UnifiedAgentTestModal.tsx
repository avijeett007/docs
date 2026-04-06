'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Dialog } from '@headlessui/react';
import { FiX, FiMic, FiMicOff, FiPhone, FiPhoneOff, FiVolume2, FiVolumeX, FiLoader, FiThumbsUp, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { usePartnerBranding } from '@/lib/partnerBranding';

// Dynamic imports for provider SDKs
let Vapi: any = null;
let RetellWebClient: any = null;
let UltravoxSession: any = null;
const useConversation: any = null;

interface UnifiedAgentTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentName: string;
  agentType: 'vapi' | 'retell' | 'ultravox' | 'ghl' | 'knova' | 'elevenlabs' | 'n8n_chat';
  /** Phone number for Knova agents (used for telephony testing) */
  phoneNumber?: string | null;
  /** Callback when deployment is marked as completed (after happy feedback) */
  onDeploymentCompleted?: () => void;
}

interface CallState {
  status: 'idle' | 'connecting' | 'connected' | 'ended' | 'error';
  duration: number;
  isMuted: boolean;
  isSpeakerMuted: boolean;
  speakingStatus: 'idle' | 'user_speaking' | 'assistant_speaking';
}

interface FeedbackState {
  submitted: boolean;
  type: 'happy' | 'improvement' | null;
  sending: boolean;
}

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

const UnifiedAgentTestModal: React.FC<UnifiedAgentTestModalProps> = ({
  isOpen,
  onClose,
  agentId,
  agentName,
  agentType,
  phoneNumber,
  onDeploymentCompleted
}) => {
  const [callState, setCallState] = useState<CallState>({
    status: 'idle',
    duration: 0,
    isMuted: false,
    isSpeakerMuted: false,
    speakingStatus: 'idle'
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>({
    submitted: false,
    type: null,
    sending: false
  });

  // Get partner branding for styling
  const { branding } = usePartnerBranding();

  // Provider-specific instances
  const [vapiInstance, setVapiInstance] = useState<any>(null);
  const [retellInstance, setRetellInstance] = useState<any>(null);
  const [ultravoxInstance, setUltravoxInstance] = useState<any>(null);
  
  // Provider-specific data
  const [testData, setTestData] = useState<any>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Pre-load SDK for VAPI and Ultravox (like partner portal)
  useEffect(() => {
    if (isOpen && !isSDKLoaded && (agentType === 'vapi' || agentType === 'ultravox')) {
      loadProviderSDK();
    }
  }, [isOpen, isSDKLoaded, agentType]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Cleanup voice instances
    if (vapiInstance) {
      try {
        vapiInstance.stop();
      } catch (e) {
        console.error('Error stopping voice call:', e);
      }
    }

    if (retellInstance) {
      try {
        retellInstance.stopCall();
      } catch (e) {
        console.error('Error stopping voice call:', e);
      }
    }

    if (ultravoxInstance) {
      try {
        ultravoxInstance.leaveCall();
      } catch (e) {
        console.error('Error stopping voice call:', e);
      }
    }

    // Cleanup ElevenLabs conversation
    if ((window as any).currentElevenLabsConversation) {
      try {
        const conversation = (window as any).currentElevenLabsConversation;
        if (conversation && typeof conversation.endSession === 'function') {
          conversation.endSession();
        }
        (window as any).currentElevenLabsConversation = null;
      } catch (e) {
        console.error('Error stopping ElevenLabs conversation:', e);
      }
    }
  };

  const addMessage = (type: 'user' | 'assistant' | 'system', content: string) => {
    const message: Message = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, message]);
  };

  const startDurationTimer = () => {
    intervalRef.current = setInterval(() => {
      setCallState(prev => ({ ...prev, duration: prev.duration + 1 }));
    }, 1000);
  };

  const stopDurationTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const loadProviderSDK = async () => {
    try {
      setLoading(true);
      setError(null);

      switch (agentType) {
        case 'vapi':
          await loadVapiSDK();
          break;
        case 'retell':
          await loadRetellSDK();
          break;
        case 'ultravox':
          await loadUltravoxSDK();
          break;
        case 'ghl':
        case 'knova':
          // These are handled differently - no SDK loading needed
          setIsSDKLoaded(true);
          break;
        default:
          throw new Error(`Unsupported agent type: ${agentType}`);
      }
    } catch (error) {
      console.error('Error loading provider SDK:', error);
      setError(error instanceof Error ? error.message : 'Failed to load SDK');
    } finally {
      setLoading(false);
    }
  };

  const loadSDKForType = async (actualType: string) => {
    try {
      switch (actualType) {
        case 'vapi':
          if (!Vapi) {
            await loadVapiSDK();
          }
          break;
        case 'retell':
          if (!RetellWebClient) {
            await loadRetellSDK();
          }
          break;
        case 'ultravox':
          if (!UltravoxSession) {
            await loadUltravoxSDK();
          }
          break;
        case 'elevenlabs':
          if (!(window as any).ElevenLabsConversation) {
            await loadElevenLabsSDK();
          }
          break;
        default:
          throw new Error(`Unsupported agent type: ${actualType}`);
      }
      setIsSDKLoaded(true);
    } catch (error) {
      console.error(`Error loading ${actualType} SDK:`, error);
      throw new Error(`Failed to initialize voice connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const loadVapiSDK = async () => {
    try {
      if (Vapi) {
        setIsSDKLoaded(true);
        return;
      }

      console.log('Initializing voice connection...');

      try {
        const vapiModule = await import('@vapi-ai/web');
        Vapi = vapiModule.default || vapiModule;
        console.log('Voice connection initialized successfully');
        setIsSDKLoaded(true);
        return;
      } catch (importError) {
        console.warn('Failed to load from primary source:', importError);
        await loadVapiFromCDN();
      }
    } catch (error) {
      console.error('Error initializing voice connection:', error);
      throw new Error('Failed to initialize voice connection. Please check your internet connection.');
    }
  };

  const loadVapiFromCDN = async () => {
    // Remove CDN loading to prevent quota exceeded errors
    throw new Error('CDN loading disabled to prevent quota issues');
  };

  const loadRetellSDK = async () => {
    try {
      if (RetellWebClient) {
        console.log('Voice connection already initialized');
        return;
      }

      console.log('Initializing voice connection...');

      // Use the same import pattern as partner portal
      const retellModule = await import('retell-client-js-sdk');
      RetellWebClient = retellModule.RetellWebClient;

      console.log('Voice connection initialized successfully:', !!RetellWebClient);

      // Verify the SDK is properly loaded
      if (!RetellWebClient) {
        throw new Error('Voice connection failed to initialize');
      }

    } catch (error) {
      console.error('Error initializing voice connection:', error);
      throw new Error('Failed to initialize voice connection. Please check your internet connection.');
    }
  };

  const loadUltravoxSDK = async () => {
    try {
      if (UltravoxSession) {
        setIsSDKLoaded(true);
        return;
      }

      console.log('Initializing voice connection...');

      try {
        const ultravoxModule = await import('ultravox-client');
        UltravoxSession = ultravoxModule.UltravoxSession || (ultravoxModule as any).default?.UltravoxSession;
        console.log('Voice connection initialized successfully');
        setIsSDKLoaded(true);
        return;
      } catch (importError) {
        console.warn('Failed to load from primary source:', importError);
        await loadUltravoxFromCDN();
      }
    } catch (error) {
      console.error('Error initializing voice connection:', error);
      throw new Error('Failed to initialize voice connection. Please check your internet connection.');
    }
  };

  const loadUltravoxFromCDN = async () => {
    return new Promise((resolve, reject) => {
      if (typeof window !== 'undefined' && (window as any).UltravoxSession) {
        UltravoxSession = (window as any).UltravoxSession;
        setIsSDKLoaded(true);
        resolve(true);
        return;
      }

      const script = document.createElement('script');
      // Remove CDN loading to prevent quota exceeded errors
      reject(new Error('CDN loading disabled to prevent quota issues'));
      script.onload = () => {
        console.log('Voice connection loaded from backup source');
        if (typeof window !== 'undefined' && (window as any).UltravoxSession) {
          UltravoxSession = (window as any).UltravoxSession;
          setIsSDKLoaded(true);
          resolve(true);
        } else {
          reject(new Error('Voice connection failed to initialize'));
        }
      };
      script.onerror = () => reject(new Error('Failed to load voice connection from backup source'));
      document.head.appendChild(script);
    });
  };

  const loadElevenLabsSDK = async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).ElevenLabsConversation) {
        setIsSDKLoaded(true);
        return;
      }

      console.log('Initializing ElevenLabs voice connection...');

      try {
        // Use the client SDK instead of React hooks for unified modal
        const { Conversation } = await import('@elevenlabs/client');
        (window as any).ElevenLabsConversation = Conversation;
        console.log('ElevenLabs voice connection initialized successfully');
        setIsSDKLoaded(true);
        return;
      } catch (importError) {
        console.error('Failed to load ElevenLabs SDK:', importError);
        throw new Error('ElevenLabs SDK not available');
      }
    } catch (error) {
      console.error('Error initializing ElevenLabs voice connection:', error);
      throw new Error('Failed to initialize ElevenLabs voice connection. Please check your internet connection.');
    }
  };

  const createTestCall = async () => {
    try {
      const response = await fetch(`/api/whitelabel/agents/${agentId}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ agentType })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Failed to create test call');
      }

      const data = await response.json();
      console.log('Test call API response:', data);

      // Handle different response formats from whitelabel API
      const testCall = data.testCall || data;

      // Detect actual agent type from response
      let actualAgentType = agentType;
      if (data.provider) {
        actualAgentType = data.provider;
        console.log('Backend detected voice type:', actualAgentType, 'Frontend expected:', agentType);
      } else if (testCall.provider) {
        actualAgentType = testCall.provider;
        console.log('Backend detected voice type:', actualAgentType, 'Frontend expected:', agentType);
      }

      setTestData({ ...testCall, actualAgentType });
      return { ...testCall, actualAgentType };
    } catch (error) {
      console.error('Error creating test call:', error);
      throw error;
    }
  };

  const startCall = async () => {
    try {
      setLoading(true);
      setError(null);
      setCallState(prev => ({ ...prev, status: 'connecting', duration: 0 }));
      setMessages([]);

      addMessage('system', 'Preparing test call...');

      // Create test call and get actual agent type from backend
      const testCallResponse = await createTestCall();
      const actualType = testCallResponse.actualAgentType || agentType;

      console.log('Starting call with voice type:', actualType);

      // Handle unsupported agent types
      if (actualType === 'ghl' || actualType === 'knova') {
        setError('Live testing is not available for this agent type yet. This feature is coming soon!');
        return;
      }

      // Load the appropriate SDK dynamically based on actual agent type
      addMessage('system', 'Initializing voice connection...');
      await loadSDKForType(actualType);

      addMessage('system', 'Connecting to agent...');

      if (actualType === 'vapi') {
        // For VAPI, use the public key from response
        await startVapiCall(testCallResponse);
      } else {
        // For Retell and Ultravox, use the test call data
        const testCall = testCallResponse.testCall || testCallResponse;

        switch (actualType) {
          case 'retell':
            await startRetellCall(testCall);
            break;
          case 'ultravox':
            await startUltravoxCall(testCall);
            break;
          case 'elevenlabs':
            await startElevenLabsCall(testCall);
            break;
          default:
            throw new Error(`Unsupported agent type: ${actualType}`);
        }
      }
    } catch (error: any) {
      console.error('Error starting call:', error);
      setCallState(prev => ({ ...prev, status: 'error' }));
      setError(error.message || 'Failed to start test call');
      addMessage('system', `Error: ${error.message || 'Failed to start test call'}`);
    } finally {
      setLoading(false);
    }
  };

  const startVapiCall = async (testCall: any) => {
    if (!Vapi) throw new Error('SDK not loaded');

    // Ensure mediaDevices API is available for SDK
    if (!navigator.mediaDevices) {
      (navigator as any).mediaDevices = {};
    }

    if (!navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices = async () => {
        return []; // Return empty array as fallback
      };
    }

    const publicKey = testCall.publicKey;
    if (!publicKey) {
      throw new Error('Agent configuration incomplete. Please contact support.');
    }

    const vapi = new Vapi(publicKey);

    // Set up event listeners
    vapi.on('call-start', () => {
      setCallState(prev => ({ ...prev, status: 'connected', speakingStatus: 'idle' }));
      addMessage('system', 'Call started');
      startDurationTimer();
    });

    vapi.on('call-end', () => {
      setCallState(prev => ({ ...prev, status: 'ended', speakingStatus: 'idle' }));
      addMessage('system', 'Call ended');
      stopDurationTimer();
    });

    vapi.on('speech-start', () => {
      setCallState(prev => ({ ...prev, speakingStatus: 'assistant_speaking' }));
    });

    vapi.on('speech-end', () => {
      setCallState(prev => ({ ...prev, speakingStatus: 'idle' }));
    });

    vapi.on('message', (message: any) => {
      if (message.type === 'transcript' && message.transcript) {
        const role = message.transcript.role;
        const content = message.transcript.content;
        if (content && content.trim()) {
          addMessage(role === 'user' ? 'user' : 'assistant', content);
        }
      }
    });

    vapi.on('error', (error: any) => {
      console.error('Voice call error:', error);
      setError(error.message || 'Call error occurred');
      setCallState(prev => ({ ...prev, status: 'error' }));
      stopDurationTimer();
    });

    setVapiInstance(vapi);

    // Start the call with the agent ID
    await vapi.start(agentId);
  };

  const startRetellCall = async (testCall: any) => {
    // Ensure complete mediaDevices API is available for SDK
    if (!navigator.mediaDevices) {
      (navigator as any).mediaDevices = {};
    }

    if (!navigator.mediaDevices.getUserMedia) {
      // Create a polyfill that will work for .lvh.me domains
      navigator.mediaDevices.getUserMedia = async (constraints: any) => {
        // Try legacy getUserMedia APIs
        const legacyGetUserMedia = (navigator as any).getUserMedia ||
                                 (navigator as any).webkitGetUserMedia ||
                                 (navigator as any).mozGetUserMedia;

        if (legacyGetUserMedia) {
          return new Promise((resolve, reject) => {
            legacyGetUserMedia.call(navigator, constraints, resolve, reject);
          });
        }

        // If no legacy API available, throw a descriptive error
        throw new Error('getUserMedia not supported in this browser context');
      };
    }

    if (!navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices = async () => {
        return []; // Return empty array as fallback
      };
    }

    // Initialize voice client dynamically
    const { RetellWebClient } = await import('retell-client-js-sdk');
    const client = new RetellWebClient();

    // Set up event listeners (same as partner portal)
    client.on('call_started', () => {
      console.log('Call started');
      setCallState(prev => ({ ...prev, status: 'connected' }));
      addMessage('system', 'Call started');
      startDurationTimer();
    });

    client.on('call_ended', () => {
      console.log('Call ended');
      setCallState(prev => ({ ...prev, status: 'ended', speakingStatus: 'idle' }));
      addMessage('system', 'Call ended');
      stopDurationTimer();
    });

    client.on('agent_start_talking', () => {
      setCallState(prev => ({ ...prev, speakingStatus: 'assistant_speaking' }));
    });

    client.on('agent_stop_talking', () => {
      setCallState(prev => ({ ...prev, speakingStatus: 'idle' }));
    });

    client.on('update', (update: any) => {
      if (update.transcript) {
        const lines = update.transcript.split('\n')
          .filter((line: string) => line.trim() !== '');
        if (lines.length > 0) {
          // Parse the transcript to extract user and assistant messages
          lines.forEach((line: string) => {
            if (line.includes('User:')) {
              addMessage('user', line.replace('User:', '').trim());
            } else if (line.includes('Agent:')) {
              addMessage('assistant', line.replace('Agent:', '').trim());
            }
          });
        }
      }
    });

    client.on('error', (error: any) => {
      console.error('Call error:', error);
      setError(error.message || 'An error occurred during the call');
      setCallState(prev => ({ ...prev, status: 'error' }));
      stopDurationTimer();
    });

    // Start the call (exact same as partner portal)
    await client.startCall({
      accessToken: testCall.accessToken,
    });

    setRetellInstance(client);
  };

  const startUltravoxCall = async (testCall: any) => {
    if (!UltravoxSession) throw new Error('SDK not loaded');

    const session = new UltravoxSession();

    // Set up event listeners (exact same as partner portal)
    session.addEventListener('status', () => {
      setCallState(prev => ({
        ...prev,
        status: session.status === 'connected' ? 'connected' :
                session.status === 'connecting' ? 'connecting' :
                session.status === 'disconnected' ? 'ended' : prev.status
      }));

      if (session.status === 'connected') {
        addMessage('system', 'Call connected');
        startDurationTimer();
      } else if (session.status === 'disconnected') {
        addMessage('system', 'Call ended');
        stopDurationTimer();
      }
    });

    // Note: Transcript handling disabled for Ultravox to keep UX consistent
    // The transcription was printing new lines at each word, causing poor UX
    session.addEventListener('transcripts', () => {
      console.log('Transcripts updated:', session.transcripts);
      // Transcripts are logged but not displayed to maintain consistent UX
    });

    setUltravoxInstance(session);

    // Join the call (exact same as partner portal)
    console.log('Joining call with URL:', testCall.callUrl);
    session.joinCall(testCall.callUrl);
  };

  const startElevenLabsCall = async (testCall: any) => {
    const Conversation = (window as any).ElevenLabsConversation;
    if (!Conversation) throw new Error('ElevenLabs SDK not loaded');

    console.log('Starting ElevenLabs conversation with signed URL:', testCall.signedUrl);

    try {
      // Start the conversation using the signed URL
      const conversation = await Conversation.startSession({
        signedUrl: testCall.signedUrl,
        connectionType: 'websocket',
        onConnect: () => {
          console.log('ElevenLabs conversation connected');
          setCallState(prev => ({ ...prev, status: 'connected' }));
          addMessage('system', 'Connected to ElevenLabs agent. You can start speaking!');
        },
        onDisconnect: () => {
          console.log('ElevenLabs conversation disconnected');
          setCallState(prev => ({ ...prev, status: 'ended' }));
          addMessage('system', 'Conversation ended');
        },
        onMessage: (message: any) => {
          if (message.type === 'user_transcript') {
            addMessage('user', message.message || message.text || 'User spoke');
          } else if (message.type === 'agent_response') {
            addMessage('assistant', message.message || message.text || 'Agent responded');
          }
        },
        onError: (error: any) => {
          console.error('ElevenLabs conversation error:', error);
          setCallState(prev => ({ ...prev, status: 'error' }));
          addMessage('system', `Error: ${error.message || 'Connection failed'}`);
        }
      });

      // Store the conversation instance for cleanup
      (window as any).currentElevenLabsConversation = conversation;

      setCallState(prev => ({ ...prev, status: 'connecting' }));
      addMessage('system', 'Connecting to ElevenLabs agent...');

    } catch (error: any) {
      console.error('Error starting ElevenLabs conversation:', error);
      setCallState(prev => ({ ...prev, status: 'error' }));
      addMessage('system', `Failed to start conversation: ${error.message}`);
      throw error;
    }
  };

  const endCall = () => {
    try {
      if (vapiInstance) {
        vapiInstance.stop();
      } else if (retellInstance) {
        retellInstance.stopCall();
      } else if (ultravoxInstance) {
        ultravoxInstance.leaveCall();
      } else if ((window as any).currentElevenLabsConversation) {
        // End ElevenLabs conversation
        const conversation = (window as any).currentElevenLabsConversation;
        if (conversation && typeof conversation.endSession === 'function') {
          conversation.endSession();
        }
        (window as any).currentElevenLabsConversation = null;
      }
    } catch (error) {
      console.error('Error ending call:', error);
    }
  };

  const toggleMute = () => {
    setCallState(prev => ({ ...prev, isMuted: !prev.isMuted }));

    if (vapiInstance) {
      vapiInstance.setMuted(!callState.isMuted);
    } else if (retellInstance) {
      // Voice client handles muting differently
      console.log('Mute toggled for voice client');
    } else if (ultravoxInstance) {
      ultravoxInstance.setMicMuted(!callState.isMuted);
    } else if ((window as any).currentElevenLabsConversation) {
      // ElevenLabs mute handling
      const conversation = (window as any).currentElevenLabsConversation;
      if (conversation && typeof conversation.setMicrophoneMuted === 'function') {
        conversation.setMicrophoneMuted(!callState.isMuted);
      }
      console.log('ElevenLabs mute toggled:', !callState.isMuted);
    }
  };

  const toggleSpeaker = () => {
    setCallState(prev => ({ ...prev, isSpeakerMuted: !prev.isSpeakerMuted }));

    if (ultravoxInstance) {
      ultravoxInstance.setSpeakerMuted(!callState.isSpeakerMuted);
    }
    // Note: Some voice clients don't have direct speaker mute controls
  };

  const handleFeedback = async (type: 'happy' | 'improvement') => {
    setFeedback(prev => ({ ...prev, sending: true }));

    try {
      const response = await fetch('/api/whitelabel/agent-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId,
          agentName,
          feedbackType: type,
          phoneNumber
        })
      });

      if (response.ok) {
        setFeedback({ submitted: true, type, sending: false });

        // If user is happy, trigger deployment completion callback
        if (type === 'happy' && onDeploymentCompleted) {
          console.log('✅ Triggering deployment completion callback');
          onDeploymentCompleted();
        }
      } else {
        throw new Error('Failed to submit feedback');
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      setFeedback(prev => ({ ...prev, sending: false }));
      // Show error toast if available
    }
  };

  const handleClose = () => {
    if (callState.status === 'connected') {
      endCall();
    }
    cleanup();
    setCallState({
      status: 'idle',
      duration: 0,
      isMuted: false,
      isSpeakerMuted: false,
      speakingStatus: 'idle'
    });
    setMessages([]);
    setError(null);
    setIsSDKLoaded(false);
    setTestData(null);
    setFeedback({ submitted: false, type: null, sending: false });
    onClose();
  };

  // Render Knova agents with phone number for testing
  if (agentType === 'knova') {
    return (
      <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
        <div className="fixed inset-0 bg-black/90" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-gray-900 rounded-lg max-w-md w-full border border-gray-800">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
              <div>
                <Dialog.Title
                  className="text-xl font-semibold"
                  style={{ color: branding.primaryColor }}
                >
                  Test Your AI Receptionist
                </Dialog.Title>
                <p className="text-sm text-gray-400">{agentName}</p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="text-gray-400 hover:text-white"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {phoneNumber ? (
                <>
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
                    style={{ backgroundColor: `${branding.primaryColor}20` }}
                  >
                    <FiPhone className="w-10 h-10" style={{ color: branding.primaryColor }} />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2 text-center">
                    Call to Test Your Agent
                  </h3>
                  <p className="text-gray-400 mb-6 text-center">
                    Call the number below to test your AI Receptionist and experience how it handles conversations!
                  </p>

                  {/* Phone Number Display */}
                  <div
                    className="p-4 rounded-xl border-2 mb-6"
                    style={{
                      backgroundColor: `${branding.primaryColor}10`,
                      borderColor: `${branding.primaryColor}40`
                    }}
                  >
                    <p className="text-sm text-gray-400 text-center mb-1">Your AI Receptionist Number</p>
                    <p
                      className="text-2xl font-bold text-center tracking-wide"
                      style={{ color: branding.primaryColor }}
                    >
                      {phoneNumber}
                    </p>
                  </div>

                  {/* Click to call on mobile */}
                  <a
                    href={`tel:${phoneNumber.replace(/\s/g, '')}`}
                    className="block w-full py-3 rounded-lg font-medium text-white text-center transition-all hover:shadow-lg mb-6"
                    style={{
                      background: `linear-gradient(135deg, ${branding.primaryColor}, ${branding.secondaryColor})`
                    }}
                  >
                    <FiPhone className="inline-block w-5 h-5 mr-2 -mt-0.5" />
                    Call Now
                  </a>

                  {/* Feedback Section */}
                  {!feedback.submitted ? (
                    <div className="border-t border-gray-800 pt-6">
                      <p className="text-sm text-gray-400 text-center mb-4">
                        After testing, let us know how it went:
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleFeedback('happy')}
                          disabled={feedback.sending}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-green-500/30 bg-green-500/10 hover:bg-green-500/20 text-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {feedback.sending ? (
                            <FiLoader className="w-5 h-5 animate-spin" />
                          ) : (
                            <>
                              <FiThumbsUp className="w-5 h-5" />
                              <span className="font-medium">Happy with it</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleFeedback('improvement')}
                          disabled={feedback.sending}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-300 hover:text-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {feedback.sending ? (
                            <FiLoader className="w-5 h-5 animate-spin" />
                          ) : (
                            <>
                              <FiAlertCircle className="w-5 h-5" />
                              <span className="font-medium">Need improvement</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-t border-gray-800 pt-6">
                      <div className="flex items-center justify-center gap-2 text-green-400 mb-2">
                        <FiCheckCircle className="w-5 h-5" />
                        <span className="font-medium">Thank you for your feedback!</span>
                      </div>
                      {feedback.type === 'improvement' && (
                        <p className="text-sm text-gray-400 text-center">
                          Our team will reach out to you soon to discuss improvements.
                        </p>
                      )}
                    </div>
                  )}

                  <button
                    onClick={handleClose}
                    className="w-full mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FiPhone className="w-8 h-8 text-amber-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2 text-center">
                    Phone Number Pending
                  </h3>
                  <p className="text-gray-400 mb-4 text-center">
                    Your AI Receptionist is being set up. A phone number will be assigned shortly.
                    Check back soon to test your agent!
                  </p>

                  <button
                    onClick={handleClose}
                    className="w-full mt-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    );
  }

  // Render other unsupported agent types (GHL, N8N Chat)
  if (agentType === 'ghl' || agentType === 'n8n_chat') {
    return (
      <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
        <div className="fixed inset-0 bg-black/90" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-gray-900 rounded-lg max-w-md w-full border border-gray-800">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
              <div>
                <Dialog.Title className="text-xl font-semibold text-white">
                  Test Agent
                </Dialog.Title>
                <p className="text-sm text-gray-400">Testing: {agentName}</p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="text-gray-400 hover:text-white"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiLoader className="w-8 h-8 text-amber-500" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                {agentType === 'n8n_chat' ? 'Chat Agent' : 'Coming Soon'}
              </h3>
              <p className="text-gray-400 mb-4">
                {agentType === 'n8n_chat'
                  ? 'This is a chat-based AI agent. To test it, use the chat widget on your website or N8N workflow.'
                  : 'Live testing is not available for this agent type yet. This feature is coming in a future update.'
                }
              </p>
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Got it
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/90" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-gray-900 rounded-lg max-w-4xl w-full border border-gray-800 flex flex-col h-[80vh] overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
            <div>
              <Dialog.Title
                className="text-xl font-semibold"
                style={{ color: branding.primaryColor }}
              >
                Test Voice Agent
              </Dialog.Title>
              <p className="text-sm text-gray-400">Testing: {agentName}</p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="text-gray-400 hover:text-white"
            >
              <FiX className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 flex">
            {/* Left Panel - Call Controls */}
            <div className="w-1/3 border-r border-gray-800 p-6 flex flex-col">
              {/* Call Status */}
              <div className="text-center mb-6">
                <div className={clsx(
                  "w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors",
                  {
                    'bg-gray-700': callState.status === 'idle',
                    'bg-yellow-500/20': callState.status === 'connecting',
                    'bg-green-500/20': callState.status === 'connected',
                    'bg-red-500/20': callState.status === 'ended' || callState.status === 'error',
                  }
                )}>
                  {loading ? (
                    <FiLoader className="w-8 h-8 text-gray-400 animate-spin" />
                  ) : callState.status === 'connected' ? (
                    <FiPhone className="w-8 h-8 text-green-500" />
                  ) : callState.status === 'error' ? (
                    <FiPhoneOff className="w-8 h-8 text-red-500" />
                  ) : (
                    <FiPhone className="w-8 h-8 text-gray-400" />
                  )}
                </div>

                <div className="text-white font-semibold">
                  {callState.status === 'idle' && 'Ready to Test'}
                  {callState.status === 'connecting' && 'Connecting...'}
                  {callState.status === 'connected' && 'Connected'}
                  {callState.status === 'ended' && 'Call Ended'}
                  {callState.status === 'error' && 'Error'}
                </div>

                {callState.status === 'connected' && (
                  <div className="text-gray-400 text-sm mt-1">
                    {formatDuration(callState.duration)}
                  </div>
                )}
              </div>

              {/* Speaking Status */}
              {callState.status === 'connected' && (
                <div className="text-center mb-6">
                  <div className={clsx(
                    "text-sm px-3 py-1 rounded-full transition-colors",
                    {
                      'bg-blue-500/20 text-blue-400': callState.speakingStatus === 'user_speaking',
                      'bg-green-500/20 text-green-400': callState.speakingStatus === 'assistant_speaking',
                      'bg-gray-700 text-gray-400': callState.speakingStatus === 'idle',
                    }
                  )}>
                    {callState.speakingStatus === 'user_speaking' && 'You are speaking'}
                    {callState.speakingStatus === 'assistant_speaking' && 'Agent is speaking'}
                    {callState.speakingStatus === 'idle' && 'Listening...'}
                  </div>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 mb-6">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* Call Controls */}
              <div className="flex-1 flex flex-col justify-end">
                {callState.status === 'idle' || callState.status === 'error' ? (
                  <button
                    onClick={startCall}
                    disabled={loading}
                    className={clsx(
                      "w-full py-3 px-4 rounded-lg font-medium transition-colors mb-4",
                      loading
                        ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                        : "text-white"
                    )}
                    style={loading ? {} : {
                      backgroundColor: branding.primaryColor,
                      borderColor: branding.primaryColor
                    }}
                    onMouseEnter={(e) => {
                      if (!loading) {
                        e.currentTarget.style.opacity = '0.9';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!loading) {
                        e.currentTarget.style.opacity = '1';
                      }
                    }}
                  >
                    {loading ? 'Loading...' : 'Start Test Call'}
                  </button>
                ) : callState.status === 'connected' ? (
                  <>
                    {/* Control Buttons */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <button
                        onClick={toggleMute}
                        className={clsx(
                          "py-2 px-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2",
                          callState.isMuted
                            ? "bg-red-600 hover:bg-red-700 text-white"
                            : "bg-gray-700 hover:bg-gray-600 text-white"
                        )}
                      >
                        {callState.isMuted ? <FiMicOff className="w-4 h-4" /> : <FiMic className="w-4 h-4" />}
                        {callState.isMuted ? 'Unmute' : 'Mute'}
                      </button>

                      {agentType === 'ultravox' && (
                        <button
                          onClick={toggleSpeaker}
                          className={clsx(
                            "py-2 px-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2",
                            callState.isSpeakerMuted
                              ? "bg-red-600 hover:bg-red-700 text-white"
                              : "bg-gray-700 hover:bg-gray-600 text-white"
                          )}
                        >
                          {callState.isSpeakerMuted ? <FiVolumeX className="w-4 h-4" /> : <FiVolume2 className="w-4 h-4" />}
                          Speaker
                        </button>
                      )}
                    </div>

                    {/* End Call Button */}
                    <button
                      onClick={endCall}
                      className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                    >
                      End Call
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            {/* Right Panel - Conversation */}
            <div className="flex-1 flex flex-col">
              {/* Messages */}
              <div className="flex-1 p-6 overflow-y-auto">
                <h3
                  className="text-lg font-semibold mb-4"
                  style={{ color: branding.primaryColor }}
                >
                  Conversation
                </h3>

                {messages.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">
                    <p>Start a test call to see the conversation here.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={clsx(
                          "p-3 rounded-lg max-w-[80%]",
                          {
                            'text-white ml-auto': message.type === 'user',
                            'bg-gray-700 text-white': message.type === 'assistant',
                            'bg-gray-800 text-gray-400 text-sm text-center mx-auto': message.type === 'system',
                          }
                        )}
                        style={message.type === 'user' ? {
                          backgroundColor: branding.primaryColor
                        } : {}}
                      >
                        <p>{message.content}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div className="p-6 border-t border-gray-800 bg-gray-800/50">
                <h4 className="text-sm font-medium text-white mb-2">Testing Instructions:</h4>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>• Click "Start Test Call" to begin testing the agent</li>
                  <li>• Allow microphone access when prompted by your browser</li>
                  <li>• Speak naturally to test the agent's responses</li>
                  <li>• Use the mute button to control your microphone</li>
                  <li>• Click "End Call" when you're finished testing</li>
                </ul>
              </div>
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default UnifiedAgentTestModal;
