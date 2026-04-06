import React, { useState, useEffect, useRef } from 'react';
import { FiMic, FiMicOff, FiPhone, FiPhoneOff, FiVolume2 } from 'react-icons/fi';

interface WebCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  demoId: string;
  demoName: string;
}

const WebCallModal: React.FC<WebCallModalProps> = ({
  isOpen,
  onClose,
  demoId,
  demoName
}) => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [error, setError] = useState<{title: string; message: string} | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [characterName, setCharacterName] = useState('');
  const [isOutbound, setIsOutbound] = useState(false);

  const retellClientRef = useRef<any>(null);

  // Add animation keyframes to the global styles
  useEffect(() => {
    // Add custom animation styles to the document head
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes pulse-slow {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.05); opacity: 0.9; }
        100% { transform: scale(1); opacity: 1; }
      }
      @keyframes ping-slow {
        0% { transform: scale(1); opacity: 0.8; }
        75%, 100% { transform: scale(1.5); opacity: 0; }
      }
      @keyframes ping-slower {
        0% { transform: scale(1); opacity: 0.6; }
        75%, 100% { transform: scale(1.8); opacity: 0; }
      }
      @keyframes fade-in {
        0% { opacity: 0; }
        100% { opacity: 1; }
      }
      @keyframes slide-up {
        0% { transform: translateY(10px); opacity: 0; }
        100% { transform: translateY(0); opacity: 1; }
      }
      .animate-pulse-slow {
        animation: pulse-slow 2s ease-in-out infinite;
      }
      .animate-ping-slow {
        animation: ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite;
      }
      .animate-ping-slower {
        animation: ping-slower 2.5s cubic-bezier(0, 0, 0.2, 1) infinite;
      }
      .animate-fade-in {
        animation: fade-in 0.5s ease-out forwards;
      }
      .animate-slide-up {
        animation: slide-up 0.5s ease-out forwards;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (retellClientRef.current) {
        try {
          retellClientRef.current.stopCall();
        } catch (e) {
          console.error('Error stopping call:', e);
        }
      }
    };
  }, []);

  // Request access token when modal opens
  useEffect(() => {
    if (isOpen && demoId) {
      requestAccessToken();
    }
  }, [isOpen, demoId]);

  // Add animation keyframes to the global styles
  useEffect(() => {
    // Add custom animation styles to the document head
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes ping-slow {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.2); opacity: 0.5; }
        100% { transform: scale(1.4); opacity: 0; }
      }
      @keyframes ping-slower {
        0% { transform: scale(1); opacity: 0.8; }
        50% { transform: scale(1.4); opacity: 0.4; }
        100% { transform: scale(1.8); opacity: 0; }
      }
      .animate-ping-slow {
        animation: ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite;
      }
      .animate-ping-slower {
        animation: ping-slower 3s cubic-bezier(0, 0, 0.2, 1) infinite;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const requestAccessToken = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get token from localStorage
      const token = localStorage.getItem('partner_token');
      if (!token) {
        throw new Error('You are not logged in. Please log in and try again.');
      }

      const response = await fetch(`/api/partner/demos/${demoId}/connect`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.log('Error response data:', errorData);
        
        // Handle structured error responses
        if (errorData.title && errorData.message) {
          throw new Error(JSON.stringify({
            title: errorData.title,
            message: errorData.message
          }));
        } else if (errorData.error === 'quota_exceeded') {
          throw new Error(JSON.stringify({
            title: 'Usage Limit Reached',
            message: 'Your Retell account has reached its usage limit. Please upgrade your plan to continue using the demo.'
          }));
        } else {
          throw new Error(`Failed to connect to demo: ${response.statusText}`);
        }
      }

      const data = await response.json();

      console.log('Response data:', data);

      if (!data.connection || !data.connection.access_token) {
        throw new Error('No access token returned from server');
      }

      setAccessToken(data.connection.access_token);
      setBusinessName(data.connection.demo.businessName || '');
      setCharacterName(data.connection.demo.characterName || '');
      setIsOutbound(data.connection.demo.isOutbound || false);
    } catch (error: any) {
      console.error('Error getting access token:', error);
      
      // Try to parse structured error from JSON string
      try {
        const errorObj = JSON.parse(error.message);
        if (errorObj.title && errorObj.message) {
          setError(errorObj);
          return;
        }
      } catch (e) {
        // Not a JSON string, continue with normal error handling
      }
      
      // Check for specific error patterns
      const errorMsg = error.message || '';
      
      if (errorMsg.includes('quota') || errorMsg.includes('Trial over') || 
          errorMsg.includes('add payment') || errorMsg.includes('Forbidden')) {
        setError({
          title: 'Usage Limit Reached',
          message: 'Your Retell account has reached its usage limit. Please upgrade your plan to continue using the demo.'
        });
      } else if (errorMsg.includes('API key') || errorMsg.includes('Invalid API')) {
        setError({
          title: 'Invalid API Key',
          message: 'Your Retell API key appears to be invalid. Please check your settings and update your API key.'
        });
      } else if (errorMsg.includes('agent not found') || errorMsg.includes('Agent Not Found')) {
        setError({
          title: 'Agent Not Found',
          message: 'The AI agent for this demo could not be found. It may have been deleted from your Retell account.'
        });
      } else {
        setError({
          title: 'Connection Error',
          message: errorMsg || 'Failed to connect to the demo. Please try again later.'
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const startCall = async () => {
    if (!accessToken) return;

    try {
      // Import RetellWebClient dynamically
      const { RetellWebClient } = await import('retell-client-js-sdk');

      const client = new RetellWebClient();

      // Set up the client

      // Set up event listeners
      client.on('call_started', () => {
        console.log('Call started');
        setIsCallActive(true);

        // Log that the call has started
        console.log('Call started and connected successfully');
      });

      client.on('call_ended', () => {
        console.log('Call ended');
        setIsCallActive(false);
        setIsAgentSpeaking(false);
      });

      client.on('agent_start_talking', () => {
        console.log('Agent started talking');
        setIsAgentSpeaking(true);
      });

      client.on('agent_stop_talking', () => {
        console.log('Agent stopped talking');
        setIsAgentSpeaking(false);
      });

      // Add listener for metadata events
      client.on('metadata', (metadata: any) => {
        console.log('Received metadata:', metadata);
      });

      // Add listener for node transition events
      client.on('node_transition', (event: any) => {
        console.log('Node transition:', event);
      });

      client.on('update', (update: any) => {
        console.log('Received update:', update);
        if (update.transcript) {
          console.log('Transcript:', update.transcript);
          const lines = update.transcript.split('\n')
            .filter((line: string) => line.trim() !== '');
          if (lines.length > 0) {
            setTranscript(lines);
          }
        }
      });

      client.on('error', (error: any) => {
        console.error('Call error:', error);
        setError(error.message || 'An error occurred during the call');
        setIsCallActive(false);
      });

      // Start the call
      await client.startCall({
        accessToken: accessToken,
      });

      retellClientRef.current = client;
    } catch (error: any) {
      console.error('Failed to start call:', error);
      setError(error.message || 'Failed to start call');
    }
  };

  const endCall = () => {
    if (retellClientRef.current) {
      try {
        retellClientRef.current.stopCall();
        retellClientRef.current = null;
      } catch (e) {
        console.error('Error stopping call:', e);
      }
    }
  };

  const toggleMute = () => {
    if (retellClientRef.current) {
      try {
        if (isMuted) {
          retellClientRef.current.unmute();
        } else {
          retellClientRef.current.mute();
        }
        setIsMuted(!isMuted);
      } catch (e) {
        console.error('Error toggling mute:', e);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg max-w-3xl w-full border border-gray-800 flex flex-col h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-white">{demoName}</h2>
            <p className="text-sm text-gray-400">
              {isOutbound
                ? `Outbound call to ${characterName} from ${businessName}`
                : `Inbound call to ${businessName}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Call Status and Controls */}
          <div className="w-full flex flex-col items-center justify-center flex-1">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-80 w-full animate-fade-in">
                <div className="animate-spin rounded-full h-24 w-24 border-t-4 border-b-4 border-blue-500 mb-8"></div>
                <p className="text-gray-300 text-xl">Connecting to demo...</p>
              </div>
            ) : error ? (
              <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-8 mb-4 max-w-md mx-auto text-center animate-fade-in">
                <div className="flex items-start gap-3">
                  <div className="text-red-400 mt-1 flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-red-300">{error.title}</p>
                    <p className="text-xs text-red-200 mt-2 leading-relaxed">{error.message}</p>
                    
                    {error.title === 'Usage Limit Reached' && (
                      <a 
                        href="https://app.retellai.com/billing" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="mt-3 inline-block text-xs text-blue-400 hover:text-blue-300 underline"
                      >
                        Upgrade your Retell plan →
                      </a>
                    )}
                  </div>
                </div>
                <button
                  onClick={requestAccessToken}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : !isCallActive ? (
              <div className="flex flex-col items-center justify-center py-12 w-full animate-fade-in">
                <div className="w-32 h-32 bg-blue-500/20 rounded-full flex items-center justify-center mb-8 transition-all duration-500 hover:scale-105 animate-pulse-slow">
                  <FiPhone className="w-16 h-16 text-blue-400" />
                </div>
                <p className="text-gray-300 text-xl mb-6">Ready to start demo call</p>
                <button
                  onClick={startCall}
                  className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-lg font-medium"
                >
                  Start Call
                </button>

                {/* Demo Features */}
                <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-6 w-full max-w-4xl">
                  <div className="bg-gray-800 p-4 rounded-lg text-center">
                    <div className="bg-blue-500/20 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                      <span className="text-blue-400 text-xl">🌐</span>
                    </div>
                    <h4 className="text-white font-medium mb-1">Multilingual</h4>
                    <p className="text-gray-400 text-sm">Supports English & Spanish</p>
                  </div>

                  <div className="bg-gray-800 p-4 rounded-lg text-center">
                    <div className="bg-green-500/20 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                      <span className="text-green-400 text-xl">🎭</span>
                    </div>
                    <h4 className="text-white font-medium mb-1">Natural Voice</h4>
                    <p className="text-gray-400 text-sm">Human-like conversation</p>
                  </div>

                  <div className="bg-gray-800 p-4 rounded-lg text-center">
                    <div className="bg-purple-500/20 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                      <span className="text-purple-400 text-xl">🧠</span>
                    </div>
                    <h4 className="text-white font-medium mb-1">Context Aware</h4>
                    <p className="text-gray-400 text-sm">Remembers conversation</p>
                  </div>

                  <div className="bg-gray-800 p-4 rounded-lg text-center">
                    <div className="bg-yellow-500/20 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                      <span className="text-amber-400 text-xl">⚡</span>
                    </div>
                    <h4 className="text-white font-medium mb-1">Fast Response</h4>
                    <p className="text-gray-400 text-sm">Low latency replies</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 w-full animate-fade-in">
                {/* Phone Icon */}
                <div className="relative mb-8">
                  {/* Pulse animation rings */}
                  {isAgentSpeaking && (
                    <>
                      <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping-slow"></div>
                      <div className="absolute inset-0 rounded-full bg-green-500/10 animate-ping-slower"></div>
                    </>
                  )}

                  {/* Center icon */}
                  <div
                    className={`relative z-10 w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 ${isAgentSpeaking ? 'bg-green-500/30 animate-pulse-slow' : 'bg-blue-500/20'}`}
                  >
                    {isAgentSpeaking ? (
                      <FiVolume2 className="w-16 h-16 text-green-400" />
                    ) : (
                      <FiPhone className="w-16 h-16 text-blue-400" />
                    )}
                  </div>
                </div>

                {/* Status text */}
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-semibold text-white mb-2">
                    Call in progress
                  </h3>
                  <p className="text-gray-400 text-lg animate-pulse-slow">
                    {isAgentSpeaking ? `${businessName} is speaking...` : `${businessName} is listening`}
                  </p>
                </div>

                {/* Quick Tips */}
                <div className="bg-gray-800/50 rounded-lg p-4 mb-8 max-w-md w-full">
                  <h4 className="text-center text-white font-medium mb-3">Quick Tips</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-start gap-2">
                      <span className="text-blue-400">•</span>
                      <span className="text-gray-300">Use a headset for best quality</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-blue-400">•</span>
                      <span className="text-gray-300">Speak clearly at a normal pace</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-blue-400">•</span>
                      <span className="text-gray-300">Try "Hola" for Spanish support</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-blue-400">•</span>
                      <span className="text-gray-300">You can interrupt while speaking</span>
                    </div>
                  </div>
                </div>

                {/* Call controls */}
                <div className="flex gap-4">
                  <button
                    onClick={toggleMute}
                    className={`px-6 py-3 ${isMuted ? 'bg-amber-600 hover:bg-amber-700' : 'bg-gray-700 hover:bg-gray-600'} text-white rounded-lg transition-colors flex items-center justify-center gap-2`}
                  >
                    {isMuted ? (
                      <>
                        <FiMicOff className="w-5 h-5" />
                        <span>Unmute</span>
                      </>
                    ) : (
                      <>
                        <FiMic className="w-5 h-5" />
                        <span>Mute</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={endCall}
                    className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <FiPhoneOff className="w-5 h-5" />
                    <span>End Call</span>
                  </button>
                </div>

                {/* Transcript placeholder */}
                <div className="mt-8 bg-gray-800/50 rounded-lg p-4 max-w-lg mx-auto">
                  <h4 className="text-white font-medium mb-2 text-center">Transcript</h4>
                  <div className="max-h-32 overflow-y-auto p-2 font-mono text-sm">
                    {transcript.length === 0 ? (
                      <p className="text-gray-500 italic">Transcript will appear here during the call...</p>
                    ) : (
                      transcript.map((line, index) => {
                        // Determine if line is from user or agent
                        const isUserLine = line.startsWith('User:');
                        const isAgentLine = line.startsWith('Agent:');

                        if (!isUserLine && !isAgentLine) {
                          return <p key={index} className="text-gray-500 mb-2">{line}</p>;
                        }

                        return (
                          <div
                            key={index}
                            className={`mb-2 ${isUserLine ? 'text-blue-300' : 'text-green-300'} animate-slide-up`}
                            style={{ animationDelay: `${index * 0.1}s` }}
                          >
                            <p>{line}</p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WebCallModal;
