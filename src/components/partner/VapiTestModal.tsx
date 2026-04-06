'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Dialog } from '@headlessui/react';
import { FiX, FiMic, FiMicOff, FiPhone, FiPhoneOff, FiVolume2, FiVolumeX } from 'react-icons/fi';
import clsx from 'clsx';
import toast from 'react-hot-toast';

// Dynamic import for VAPI SDK
let Vapi: any = null;

interface VapiTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  publicKey: string;
  agentId: string;
  agentName: string;
}

interface CallState {
  status: 'idle' | 'connecting' | 'connected' | 'ended' | 'error';
  duration: number;
  isMuted: boolean;
  volume: number;
  speakingStatus: 'idle' | 'user_speaking' | 'assistant_speaking';
}

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

const VapiTestModal: React.FC<VapiTestModalProps> = ({
  isOpen,
  onClose,
  publicKey,
  agentId,
  agentName
}) => {
  const [callState, setCallState] = useState<CallState>({
    status: 'idle',
    duration: 0,
    isMuted: false,
    volume: 0,
    speakingStatus: 'idle'
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [vapiInstance, setVapiInstance] = useState<any>(null);
  const [isVapiLoaded, setIsVapiLoaded] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load VAPI SDK
  useEffect(() => {
    if (isOpen && !isVapiLoaded) {
      loadVapiSDK();
    }
  }, [isOpen, isVapiLoaded]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (vapiInstance) {
        try {
          vapiInstance.stop();
        } catch (error) {
          console.error('Error stopping VAPI instance:', error);
        }
      }
    };
  }, [vapiInstance]);

  const loadVapiSDK = async () => {
    try {
      // Check if VAPI is already loaded
      if (Vapi) {
        initializeVapi();
        return;
      }

      console.log('Loading VAPI SDK...');

      // Try to import the VAPI SDK dynamically
      try {
        const vapiModule = await import('@vapi-ai/web');
        Vapi = vapiModule.default || vapiModule;
        console.log('VAPI SDK loaded successfully from npm package');
        setIsVapiLoaded(true);
        initializeVapi();
        return;
      } catch (importError) {
        console.warn('Failed to load VAPI SDK from npm package:', importError);

        // Fallback to CDN loading
        console.log('Trying CDN fallback...');
        await loadVapiFromCDN();
      }
    } catch (error) {
      console.error('Error loading VAPI SDK:', error);
      toast.error('Failed to load VAPI SDK. Please check your internet connection.');
    }
  };

  const loadVapiFromCDN = async () => {
    // Remove CDN loading to prevent quota exceeded errors
    throw new Error('CDN loading disabled to prevent quota issues');
  };

  const initializeVapi = () => {
    try {
      if (Vapi) {
        console.log('Initializing VAPI with public key:', publicKey?.substring(0, 8) + '...');
        const vapi = new Vapi(publicKey);

        // Set up event listeners
        vapi.on('call-start', () => {
          console.log('Call started');
          setCallState(prev => ({ ...prev, status: 'connected', speakingStatus: 'idle' }));
          addMessage('system', 'Call started');
          startDurationTimer();
        });

        vapi.on('call-end', () => {
          console.log('Call ended');
          setCallState(prev => ({ ...prev, status: 'ended', speakingStatus: 'idle' }));
          addMessage('system', 'Call ended');
          stopDurationTimer();
        });

        vapi.on('speech-start', () => {
          console.log('Assistant speech started');
          setCallState(prev => ({ ...prev, speakingStatus: 'assistant_speaking' }));
        });

        vapi.on('speech-end', () => {
          console.log('Assistant speech ended');
          setCallState(prev => ({ ...prev, speakingStatus: 'idle' }));
        });

        vapi.on('volume-level', (volume: number) => {
          setCallState(prev => ({ ...prev, volume }));

          // Use volume level to detect user speaking (simple heuristic)
          if (volume > 0.1 && callState.speakingStatus !== 'assistant_speaking') {
            setCallState(prev => ({ ...prev, speakingStatus: 'user_speaking' }));
          } else if (volume <= 0.05 && callState.speakingStatus === 'user_speaking') {
            setCallState(prev => ({ ...prev, speakingStatus: 'idle' }));
          }
        });

        vapi.on('message', (message: any) => {
          console.log('Message received:', message);
          
          if (message.type === 'transcript' && message.transcript) {
            if (message.transcript.role === 'user') {
              addMessage('user', message.transcript.content);
            } else if (message.transcript.role === 'assistant') {
              addMessage('assistant', message.transcript.content);
            }
          }
        });

        vapi.on('error', (error: any) => {
          console.error('VAPI error:', error);
          setCallState(prev => ({ ...prev, status: 'error' }));
          addMessage('system', `Error: ${error.message || 'Unknown error'}`);
          toast.error('Call error occurred');
        });

        setVapiInstance(vapi);
      } else {
        throw new Error('VAPI SDK not loaded');
      }
    } catch (error) {
      console.error('Error initializing VAPI:', error);
      toast.error('Failed to initialize VAPI. Please refresh the page and try again.');
      setCallState(prev => ({ ...prev, status: 'error' }));
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

  const startCall = async () => {
    if (!vapiInstance) {
      toast.error('VAPI not initialized');
      return;
    }

    try {
      setCallState(prev => ({ ...prev, status: 'connecting', duration: 0 }));
      setMessages([]);
      addMessage('system', 'Connecting to agent...');
      
      await vapiInstance.start(agentId);
    } catch (error) {
      console.error('Error starting call:', error);
      setCallState(prev => ({ ...prev, status: 'error' }));
      toast.error('Failed to start call');
    }
  };

  const endCall = () => {
    if (vapiInstance) {
      try {
        vapiInstance.stop();
      } catch (error) {
        console.error('Error ending call:', error);
      }
    }
  };

  const toggleMute = () => {
    if (vapiInstance) {
      try {
        const newMutedState = !callState.isMuted;
        vapiInstance.setMuted(newMutedState);
        setCallState(prev => ({
          ...prev,
          isMuted: newMutedState,
          speakingStatus: newMutedState ? 'idle' : prev.speakingStatus
        }));
        addMessage('system', newMutedState ? 'Microphone muted' : 'Microphone unmuted');
      } catch (error) {
        console.error('Error toggling mute:', error);
      }
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleClose = () => {
    if (callState.status === 'connected' || callState.status === 'connecting') {
      endCall();
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="relative bg-gray-900 rounded-xl w-full max-w-2xl max-h-[90vh] shadow-xl border border-gray-800 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-800">
            <div>
              <Dialog.Title className="text-xl font-semibold text-white">
                Test Agent: {agentName}
              </Dialog.Title>
              <div className="text-gray-400 text-sm mt-1 space-y-1">
                <div>
                  Status: <span className={clsx(
                    'capitalize',
                    callState.status === 'connected' && 'text-green-400',
                    callState.status === 'connecting' && 'text-amber-400',
                    callState.status === 'error' && 'text-red-400',
                    callState.status === 'idle' && 'text-gray-400',
                    callState.status === 'ended' && 'text-gray-400'
                  )}>
                    {callState.status}
                  </span>
                  {callState.status === 'connected' && (
                    <span className="ml-2 text-blue-400">
                      {formatDuration(callState.duration)}
                    </span>
                  )}
                </div>

                {/* Speaking Status Indicator */}
                {callState.status === 'connected' && (
                  <div className="flex items-center gap-2">
                    <div className={clsx(
                      'w-2 h-2 rounded-full transition-all duration-300',
                      callState.speakingStatus === 'assistant_speaking' && 'bg-blue-400 animate-pulse',
                      callState.speakingStatus === 'user_speaking' && 'bg-green-400 animate-pulse',
                      callState.speakingStatus === 'idle' && 'bg-gray-600'
                    )} />
                    <span className={clsx(
                      'text-xs transition-colors duration-300',
                      callState.speakingStatus === 'assistant_speaking' && 'text-blue-400',
                      callState.speakingStatus === 'user_speaking' && 'text-green-400',
                      callState.speakingStatus === 'idle' && 'text-gray-500'
                    )}>
                      {callState.speakingStatus === 'assistant_speaking' && 'Assistant speaking...'}
                      {callState.speakingStatus === 'user_speaking' && 'Assistant is speaking...'}
                      {callState.speakingStatus === 'idle' && 'Listening...'}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <FiX className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Call Controls */}
          <div className="p-6 border-b border-gray-800">
            <div className="flex items-center justify-center gap-4">
              {!isVapiLoaded ? (
                <div className="flex items-center gap-2 text-gray-400">
                  <div className="animate-spin h-5 w-5 border-2 border-blue-500 rounded-full border-t-transparent"></div>
                  <span>Loading VAPI SDK...</span>
                </div>
              ) : callState.status === 'idle' || callState.status === 'ended' || callState.status === 'error' ? (
                <button
                  onClick={startCall}
                  disabled={!isVapiLoaded}
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors"
                >
                  <FiPhone className="w-5 h-5" />
                  Start Call
                </button>
              ) : (
                <>
                  <button
                    onClick={toggleMute}
                    className={clsx(
                      "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors",
                      callState.isMuted 
                        ? "bg-red-600 hover:bg-red-500 text-white"
                        : "bg-gray-700 hover:bg-gray-600 text-white"
                    )}
                  >
                    {callState.isMuted ? <FiMicOff className="w-5 h-5" /> : <FiMic className="w-5 h-5" />}
                    {callState.isMuted ? 'Unmute' : 'Mute'}
                  </button>
                  
                  <button
                    onClick={endCall}
                    className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 rounded-lg text-white font-medium transition-colors"
                  >
                    <FiPhoneOff className="w-5 h-5" />
                    End Call
                  </button>
                </>
              )}
            </div>

            {/* Volume Indicator */}
            {callState.status === 'connected' && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <FiVolume2 className="w-4 h-4 text-gray-400" />
                <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-100"
                    style={{ width: `${Math.min(callState.volume * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <p>No messages yet. Start a call to begin testing the agent.</p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={clsx(
                      "p-3 rounded-lg max-w-[80%]",
                      message.type === 'user' && "bg-blue-600 text-white ml-auto",
                      message.type === 'assistant' && "bg-gray-700 text-white",
                      message.type === 'system' && "bg-gray-800 text-gray-300 text-sm text-center mx-auto"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {message.type !== 'system' && (
                        <span className="text-xs opacity-75 capitalize">
                          {message.type}:
                        </span>
                      )}
                      <span className="flex-1">{message.content}</span>
                    </div>
                    <div className="text-xs opacity-50 mt-1">
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Instructions */}
          <div className="p-6 border-t border-gray-800 bg-gray-800/50">
            <h4 className="text-sm font-medium text-white mb-2">Testing Instructions:</h4>
            <ul className="text-sm text-gray-400 space-y-1">
              <li>• Click "Start Call" to begin testing the agent</li>
              <li>• Speak naturally to test the agent's responses</li>
              <li>• Use the mute button to control your microphone</li>
              <li>• Click "End Call" when you're finished testing</li>
            </ul>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default VapiTestModal;
