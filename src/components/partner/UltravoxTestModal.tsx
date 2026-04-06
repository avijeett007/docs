'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Dialog } from '@headlessui/react';
import { FiX, FiMic, FiMicOff, FiPhone, FiPhoneOff, FiVolume2, FiVolumeX, FiLoader } from 'react-icons/fi';
import clsx from 'clsx';
import { toast } from 'react-hot-toast';

// Dynamic import for Ultravox SDK
let UltravoxSession: any = null;

interface UltravoxTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentName: string;
}

interface CallState {
  status: 'idle' | 'connecting' | 'connected' | 'ended' | 'error';
  duration: number;
  isMuted: boolean;
  isSpeakerMuted: boolean;
  sessionStatus: string;
}

interface Transcript {
  text: string;
  isFinal: boolean;
  speaker: 'user' | 'agent' | 'system';
  medium: 'voice' | 'text';
  timestamp: Date;
}

const UltravoxTestModal: React.FC<UltravoxTestModalProps> = ({
  isOpen,
  onClose,
  agentId,
  agentName
}) => {
  const [callState, setCallState] = useState<CallState>({
    status: 'idle',
    duration: 0,
    isMuted: false,
    isSpeakerMuted: false,
    sessionStatus: 'disconnected'
  });
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [ultravoxSession, setUltravoxSession] = useState<any>(null);
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptsEndRef = useRef<HTMLDivElement>(null);

  // Load Ultravox SDK
  useEffect(() => {
    if (isOpen && !isSDKLoaded) {
      loadUltravoxSDK();
    }
  }, [isOpen, isSDKLoaded]);

  // Auto-scroll transcripts
  useEffect(() => {
    transcriptsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (ultravoxSession) {
        try {
          ultravoxSession.leaveCall();
        } catch (error) {
          console.error('Error leaving Ultravox call:', error);
        }
      }
    };
  }, [ultravoxSession]);

  const loadUltravoxSDK = async () => {
    try {
      console.log('Loading Ultravox SDK...');

      // Try to import the Ultravox SDK dynamically
      try {
        const ultravoxModule = await import('ultravox-client');
        UltravoxSession = ultravoxModule.UltravoxSession || (ultravoxModule as any).default?.UltravoxSession;
        console.log('Ultravox SDK loaded successfully from npm package');
        setIsSDKLoaded(true);
        return;
      } catch (importError) {
        console.warn('Failed to load Ultravox SDK from npm package:', importError);

        // Fallback to CDN loading
        console.log('Trying CDN fallback...');
        await loadUltravoxFromCDN();
      }
    } catch (error) {
      console.error('Error loading Ultravox SDK:', error);
      toast.error('Failed to load Ultravox SDK. Please check your internet connection.');
    }
  };

  const loadUltravoxFromCDN = async () => {
    return new Promise((resolve, reject) => {
      // Check if already loaded via CDN
      if (typeof window !== 'undefined' && (window as any).UltravoxSession) {
        UltravoxSession = (window as any).UltravoxSession;
        setIsSDKLoaded(true);
        resolve(true);
        return;
      }

      // Remove CDN loading to prevent quota exceeded errors
      reject(new Error('CDN loading disabled to prevent quota issues'));
      return;

      // Unreachable code - commented out to prevent build errors
      /*
      script.onload = () => {
        console.log('Ultravox SDK loaded from CDN');
        if (typeof window !== 'undefined' && (window as any).UltravoxSession) {
          UltravoxSession = (window as any).UltravoxSession;
          setIsSDKLoaded(true);
          resolve(true);
        } else {
          reject(new Error('UltravoxSession not found on window after CDN load'));
        }
      };
      script.onerror = () => {
        reject(new Error('Failed to load Ultravox SDK from CDN'));
      };
      document.head.appendChild(script);
      */
    });
  };

  const createTestCall = async () => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication required');
        return null;
      }

      const response = await fetch(`/api/partner/ultravox-agents/${agentId}/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ testType: 'web' })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create test call');
      }

      const data = await response.json();
      return data.testCall;
    } catch (error) {
      console.error('Error creating test call:', error);
      throw error;
    }
  };

  const initializeUltravoxSession = (joinUrl: string) => {
    try {
      if (!UltravoxSession) {
        throw new Error('Ultravox SDK not loaded');
      }

      console.log('Initializing Ultravox session...');
      const session = new UltravoxSession();

      // Set up event listeners
      session.addEventListener('status', () => {
        console.log('Session status changed:', session.status);
        setCallState(prev => ({
          ...prev,
          sessionStatus: session.status,
          status: session.status === 'connected' ? 'connected' :
                  session.status === 'connecting' ? 'connecting' :
                  session.status === 'disconnected' ? 'ended' : prev.status
        }));

        if (session.status === 'connected') {
          addTranscript('system', 'Call connected');
          startDurationTimer();
        } else if (session.status === 'disconnected') {
          addTranscript('system', 'Call ended');
          stopDurationTimer();
        }
      });

      session.addEventListener('transcripts', () => {
        console.log('Transcripts updated:', session.transcripts);
        const newTranscripts = session.transcripts.map((t: any) => ({
          text: t.text,
          isFinal: t.isFinal,
          speaker: t.speaker,
          medium: t.medium,
          timestamp: new Date()
        }));
        setTranscripts(newTranscripts);
      });

      setUltravoxSession(session);

      // Join the call
      console.log('Joining call with URL:', joinUrl);
      session.joinCall(joinUrl);

      return session;
    } catch (error) {
      console.error('Error initializing Ultravox session:', error);
      throw error;
    }
  };

  const addTranscript = (speaker: 'user' | 'agent' | 'system', text: string) => {
    const transcript: Transcript = {
      text,
      isFinal: true,
      speaker,
      medium: 'voice',
      timestamp: new Date()
    };
    setTranscripts(prev => [...prev, transcript]);
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

  const handleStartTest = async () => {
    if (!UltravoxSession) {
      toast.error('Ultravox SDK not loaded');
      return;
    }

    setLoading(true);
    try {
      setCallState(prev => ({ ...prev, status: 'connecting', duration: 0 }));
      setTranscripts([]);
      addTranscript('system', 'Creating test call...');

      // Create test call
      const call = await createTestCall();

      if (!call.callUrl) {
        throw new Error('No join URL received from test call');
      }

      addTranscript('system', 'Connecting to agent...');

      // Initialize and join the call using Ultravox SDK
      initializeUltravoxSession(call.callUrl);

      toast.success('Test call initiated successfully');
    } catch (error: any) {
      console.error('Error starting test call:', error);
      setCallState(prev => ({ ...prev, status: 'error' }));
      toast.error(error.message || 'Failed to start test call');
      addTranscript('system', `Error: ${error.message || 'Failed to start test call'}`);
    } finally {
      setLoading(false);
    }
  };

  const endCall = async () => {
    if (ultravoxSession) {
      try {
        await ultravoxSession.leaveCall();
        setCallState(prev => ({ ...prev, status: 'ended' }));
        toast.success('Test call ended');
      } catch (error) {
        console.error('Error ending call:', error);
      }
    }
  };

  const toggleMute = () => {
    if (ultravoxSession) {
      try {
        const newMutedState = !callState.isMuted;
        if (newMutedState) {
          ultravoxSession.muteMic();
        } else {
          ultravoxSession.unmuteMic();
        }
        setCallState(prev => ({ ...prev, isMuted: newMutedState }));
        addTranscript('system', newMutedState ? 'Microphone muted' : 'Microphone unmuted');
      } catch (error) {
        console.error('Error toggling mute:', error);
      }
    }
  };

  const toggleSpeaker = () => {
    if (ultravoxSession) {
      try {
        const newMutedState = !callState.isSpeakerMuted;
        if (newMutedState) {
          ultravoxSession.muteSpeaker();
        } else {
          ultravoxSession.unmuteSpeaker();
        }
        setCallState(prev => ({ ...prev, isSpeakerMuted: newMutedState }));
        addTranscript('system', newMutedState ? 'Speaker muted' : 'Speaker unmuted');
      } catch (error) {
        console.error('Error toggling speaker:', error);
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

                {/* Session Status */}
                {callState.sessionStatus !== 'disconnected' && (
                  <div className="text-xs text-gray-500">
                    Session: {callState.sessionStatus}
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
              {!isSDKLoaded ? (
                <div className="flex items-center gap-2 text-gray-400">
                  <div className="animate-spin h-5 w-5 border-2 border-blue-500 rounded-full border-t-transparent"></div>
                  <span>Loading Ultravox SDK...</span>
                </div>
              ) : callState.status === 'idle' || callState.status === 'ended' || callState.status === 'error' ? (
                <button
                  onClick={handleStartTest}
                  disabled={!isSDKLoaded || loading}
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors"
                >
                  {loading ? (
                    <>
                      <FiLoader className="w-5 h-5 animate-spin" />
                      <span>Starting...</span>
                    </>
                  ) : (
                    <>
                      <FiPhone className="w-5 h-5" />
                      <span>Start Test Call</span>
                    </>
                  )}
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
                    onClick={toggleSpeaker}
                    className={clsx(
                      "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors",
                      callState.isSpeakerMuted
                        ? "bg-red-600 hover:bg-red-500 text-white"
                        : "bg-gray-700 hover:bg-gray-600 text-white"
                    )}
                  >
                    {callState.isSpeakerMuted ? <FiVolumeX className="w-5 h-5" /> : <FiVolume2 className="w-5 h-5" />}
                    {callState.isSpeakerMuted ? 'Unmute Speaker' : 'Mute Speaker'}
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
          </div>

          {/* Transcripts */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-4">
              {transcripts.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <p>No conversation yet. Start a call to begin testing the agent.</p>
                </div>
              ) : (
                transcripts.map((transcript, index) => (
                  <div
                    key={index}
                    className={clsx(
                      "p-3 rounded-lg max-w-[80%]",
                      transcript.speaker === 'user' && "bg-blue-600 text-white ml-auto",
                      transcript.speaker === 'agent' && "bg-gray-700 text-white",
                      transcript.speaker === 'system' && "bg-gray-800 text-gray-300 text-sm text-center mx-auto"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {transcript.speaker !== 'system' && (
                        <span className="text-xs opacity-75 capitalize">
                          {transcript.speaker}:
                        </span>
                      )}
                      <span className="flex-1">{transcript.text}</span>
                    </div>
                    <div className="text-xs opacity-50 mt-1">
                      {transcript.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                ))
              )}
              <div ref={transcriptsEndRef} />
            </div>
          </div>

          {/* Instructions */}
          <div className="p-6 border-t border-gray-800 bg-gray-800/50">
            <h4 className="text-sm font-medium text-white mb-2">Ultravox Testing Instructions:</h4>
            <ul className="text-sm text-gray-400 space-y-1">
              <li>• Click "Start Test Call" to begin testing the agent</li>
              <li>• Allow microphone access when prompted by your browser</li>
              <li>• Speak naturally to test the agent's responses</li>
              <li>• Use mute/unmute controls to manage audio</li>
              <li>• Click "End Call" when you're finished testing</li>
            </ul>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default UltravoxTestModal;
