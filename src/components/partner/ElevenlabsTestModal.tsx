'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Dialog } from '@headlessui/react';
import { FiX, FiMic, FiMicOff, FiPhone, FiPhoneOff, FiVolume2, FiVolumeX, FiLoader } from 'react-icons/fi';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface ElevenlabsTestModalProps {
  isOpen: boolean;
  onClose: () => void;
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

const ElevenlabsTestModal: React.FC<ElevenlabsTestModalProps> = ({
  isOpen,
  onClose,
  agentId,
  agentName
}) => {
  const [callState, setCallState] = useState<CallState>({
    status: 'idle',
    duration: 0,
    isMuted: false,
    volume: 0.8,
    speakingStatus: 'idle'
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [conversation, setConversation] = useState<any>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Monitor conversation status
  useEffect(() => {
    if (conversation?.status === 'connected') {
      setCallState(prev => ({ ...prev, status: 'connected' }));
      startDurationTimer();
    } else if (conversation?.status === 'disconnected') {
      setCallState(prev => ({ ...prev, status: 'ended' }));
      stopDurationTimer();
    }
  }, [conversation?.status]);

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

    // Cleanup conversation instance
    if (conversation) {
      try {
        conversation.endSession();
        setConversation(null);
      } catch (e) {
        console.error('Error ending conversation:', e);
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



  const getSignedUrl = async () => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`/api/partner/elevenlabs-agents/${agentId}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get test configuration');
      }

      const data = await response.json();
      return data.signedUrl;
    } catch (error) {
      console.error('Error getting signed URL:', error);
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

      // Get signed URL for the agent
      addMessage('system', 'Getting test configuration...');
      const url = await getSignedUrl();
      setSignedUrl(url);

      // Request microphone permission
      addMessage('system', 'Requesting microphone access...');
      await navigator.mediaDevices.getUserMedia({ audio: true });

      addMessage('system', 'Connecting to agent...');

      // Dynamically import ElevenLabs SDK
      const { Conversation } = await import('@elevenlabs/client');

      // Start conversation with ElevenLabs SDK using signed URL
      const newConversation = await Conversation.startSession({
        signedUrl: url,
        connectionType: 'websocket',
        onConnect: () => {
          console.log('ElevenLabs conversation connected');
          setCallState(prev => ({ ...prev, status: 'connected' }));
          addMessage('system', 'Connected to agent');
          startDurationTimer();
        },
        onDisconnect: () => {
          console.log('ElevenLabs conversation disconnected');
          setCallState(prev => ({ ...prev, status: 'ended' }));
          addMessage('system', 'Disconnected from agent');
          stopDurationTimer();
        },
        onMessage: (message: any) => {
          console.log('ElevenLabs message:', message);
          if (message.type === 'agent_response') {
            addMessage('assistant', message.message);
          } else if (message.type === 'user_transcript') {
            addMessage('user', message.message);
          }
        },
        onError: (error: any) => {
          console.error('ElevenLabs conversation error:', error);
          setError(error.message || 'Conversation error');
          addMessage('system', `Error: ${error.message || 'Conversation error'}`);
        },
        onStatusChange: ({ status }: { status: string }) => {
          console.log('ElevenLabs status change:', status);
        },
        onModeChange: ({ mode }: { mode: string }) => {
          console.log('ElevenLabs mode change:', mode);
          setCallState(prev => ({
            ...prev,
            speakingStatus: mode === 'speaking' ? 'assistant_speaking' : mode === 'listening' ? 'user_speaking' : 'idle'
          }));
        }
      });

      setConversation(newConversation);
      const conversationId = newConversation.getId();
      addMessage('system', `Conversation started (${conversationId})`);

    } catch (error: any) {
      console.error('Error starting call:', error);
      setCallState(prev => ({ ...prev, status: 'error' }));
      setError(error.message || 'Failed to start test call');
      addMessage('system', `Error: ${error.message || 'Failed to start test call'}`);
    } finally {
      setLoading(false);
    }
  };

  const endCall = async () => {
    try {
      if (conversation) {
        await conversation.endSession();
        setConversation(null);
      }
      setCallState(prev => ({ ...prev, status: 'ended', speakingStatus: 'idle' }));
      addMessage('system', 'Call ended');
      stopDurationTimer();
    } catch (error) {
      console.error('Error ending call:', error);
    }
  };

  const toggleMute = () => {
    const newMutedState = !callState.isMuted;
    setCallState(prev => ({ ...prev, isMuted: newMutedState }));
    if (conversation) {
      conversation.setMicMuted(newMutedState);
    }
    addMessage('system', newMutedState ? 'Microphone muted' : 'Microphone unmuted');
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
      volume: 0.8,
      speakingStatus: 'idle'
    });
    setMessages([]);
    setError(null);
    setSignedUrl(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/90" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-gray-900 rounded-lg max-w-4xl w-full border border-gray-800 flex flex-col h-[80vh] overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
            <div>
              <Dialog.Title className="text-xl font-semibold text-white">
                Test ElevenLabs Agent
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
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                    )}
                  >
                    {loading ? 'Loading...' : 'Start Test Call'}
                  </button>
                ) : callState.status === 'connected' ? (
                  <>
                    {/* Control Buttons */}
                    <div className="grid grid-cols-1 gap-3 mb-4">
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
                <h3 className="text-lg font-semibold text-white mb-4">
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
                            'bg-blue-600 text-white ml-auto': message.type === 'user',
                            'bg-gray-700 text-white': message.type === 'assistant',
                            'bg-gray-800 text-gray-400 text-sm text-center mx-auto': message.type === 'system',
                          }
                        )}
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

export default ElevenlabsTestModal;
