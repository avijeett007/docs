'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { FiPhone, FiPhoneOff, FiMic, FiMicOff, FiLoader } from 'react-icons/fi';
import clsx from 'clsx';

// Separate component that uses useSearchParams
const TestCallContent: React.FC = () => {
  const searchParams = useSearchParams();
  const [isCallActive, setIsCallActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [retellWebClient, setRetellWebClient] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [sdkLoading, setSdkLoading] = useState(true);

  const accessToken = searchParams?.get('token') || null;
  const agentName = searchParams?.get('agent') || 'AI Agent';

  useEffect(() => {
    if (!accessToken) {
      setError('No access token provided');
      return;
    }

    // Check if Retell SDK is already loaded
    if ((window as any).RetellWebClient) {
      console.log('Retell SDK already loaded');
      setSdkLoading(false);
      return;
    }

    // Load Retell Web SDK
    const script = document.createElement('script');
    script.src = 'https://web.retellai.com/retell-client-js-sdk@latest.js';
    script.async = true;
    script.onload = () => {
      console.log('Retell SDK loaded successfully');
      setSdkLoading(false);
    };
    script.onerror = (error) => {
      console.error('Failed to load Retell SDK:', error);
      setError('Failed to load Retell SDK. Please check your internet connection and try again.');
      setSdkLoading(false);
    };
    document.head.appendChild(script);

    return () => {
      if (retellWebClient) {
        try {
          retellWebClient.stopCall();
        } catch (error) {
          console.error('Error stopping call:', error);
        }
      }
      // Only remove script if it exists in the DOM
      if (script && script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [accessToken, retellWebClient]);

  const startCall = async () => {
    if (!accessToken) {
      setError('No access token available');
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);

      // Wait for Retell SDK to load if it's not ready yet
      let attempts = 0;
      const maxAttempts = 10;
      while (!(window as any).RetellWebClient && attempts < maxAttempts) {
        console.log(`Waiting for Retell SDK to load... (attempt ${attempts + 1})`);
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }

      // Initialize Retell Web Client
      const RetellWebClient = (window as any).RetellWebClient;
      if (!RetellWebClient) {
        throw new Error('Retell SDK failed to load. Please refresh the page and try again.');
      }

      const client = new RetellWebClient();
      setRetellWebClient(client);

      // Set up event listeners
      client.on('call_started', () => {
        console.log('Call started');
        setIsCallActive(true);
        setIsConnecting(false);
        addToTranscript('📞 Call connected! You can now speak with the agent.');
      });

      client.on('call_ended', () => {
        console.log('Call ended');
        setIsCallActive(false);
        setIsConnecting(false);
        addToTranscript('📞 Call ended.');
      });

      client.on('agent_start_talking', () => {
        console.log('Agent started talking');
        addToTranscript('🤖 Agent is speaking...');
      });

      client.on('agent_stop_talking', () => {
        console.log('Agent stopped talking');
      });

      client.on('update', (update: any) => {
        console.log('Update:', update);
        if (update.transcript) {
          update.transcript.forEach((entry: any) => {
            if (entry.role === 'agent') {
              addToTranscript(`🤖 Agent: ${entry.content}`);
            } else if (entry.role === 'user') {
              addToTranscript(`👤 You: ${entry.content}`);
            }
          });
        }
      });

      client.on('error', (error: any) => {
        console.error('Call error:', error);
        setError(`Call error: ${error.message || 'Unknown error'}`);
        setIsCallActive(false);
        setIsConnecting(false);
      });

      // Start the call
      await client.startCall({
        accessToken: accessToken,
      });

    } catch (error: any) {
      console.error('Error starting call:', error);
      setError(`Failed to start call: ${error.message}`);
      setIsConnecting(false);
    }
  };

  const endCall = () => {
    if (retellWebClient) {
      retellWebClient.stopCall();
    }
    setIsCallActive(false);
    setIsConnecting(false);
  };

  const toggleMute = () => {
    if (retellWebClient) {
      if (isMuted) {
        retellWebClient.unmute();
      } else {
        retellWebClient.mute();
      }
      setIsMuted(!isMuted);
    }
  };

  const addToTranscript = (message: string) => {
    setTranscript(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  if (!accessToken) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Invalid Test Call</h1>
          <p className="text-gray-400">No access token provided. Please create a new test call.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Test Call</h1>
          <p className="text-gray-400">Testing agent: <span className="text-blue-400">{agentName}</span></p>
        </div>

        {/* SDK Loading State */}
        {sdkLoading && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <FiLoader className="w-5 h-5 animate-spin text-blue-400" />
              <p className="text-blue-400">Loading Retell SDK...</p>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Call Controls */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-center gap-4">
            {!isCallActive && !isConnecting && (
              <button
                onClick={startCall}
                disabled={sdkLoading}
                className={clsx(
                  "flex items-center gap-3 px-8 py-4 rounded-lg font-medium transition-colors",
                  sdkLoading
                    ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                    : "bg-green-600 hover:bg-green-500 text-white"
                )}
              >
                <FiPhone className="w-5 h-5" />
                {sdkLoading ? 'Loading SDK...' : 'Start Call'}
              </button>
            )}

            {isConnecting && (
              <div className="flex items-center gap-3 px-8 py-4 bg-blue-600 rounded-lg font-medium">
                <FiLoader className="w-5 h-5 animate-spin" />
                Connecting...
              </div>
            )}

            {isCallActive && (
              <>
                <button
                  onClick={toggleMute}
                  className={clsx(
                    'flex items-center gap-3 px-6 py-3 rounded-lg font-medium transition-colors',
                    isMuted
                      ? 'bg-red-600 hover:bg-red-500'
                      : 'bg-gray-600 hover:bg-gray-500'
                  )}
                >
                  {isMuted ? <FiMicOff className="w-5 h-5" /> : <FiMic className="w-5 h-5" />}
                  {isMuted ? 'Unmute' : 'Mute'}
                </button>

                <button
                  onClick={endCall}
                  className="flex items-center gap-3 px-6 py-3 bg-red-600 hover:bg-red-500 rounded-lg font-medium transition-colors"
                >
                  <FiPhoneOff className="w-5 h-5" />
                  End Call
                </button>
              </>
            )}
          </div>

          {/* Call Status */}
          <div className="text-center mt-4">
            {isConnecting && (
              <p className="text-blue-400">Connecting to agent...</p>
            )}
            {isCallActive && (
              <p className="text-green-400">Call active - Speak naturally with the agent</p>
            )}
            {!isCallActive && !isConnecting && (
              <p className="text-gray-400">Click "Start Call" to begin testing</p>
            )}
          </div>
        </div>

        {/* Transcript */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Call Transcript</h2>
          <div className="bg-gray-900 rounded-lg p-4 h-64 overflow-y-auto">
            {transcript.length === 0 ? (
              <p className="text-gray-400 text-center">Transcript will appear here during the call...</p>
            ) : (
              <div className="space-y-2">
                {transcript.map((entry, index) => (
                  <div key={index} className="text-sm">
                    <span className="text-gray-400">{entry}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <h3 className="text-blue-400 font-medium mb-2">💡 Testing Tips</h3>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>• Make sure your microphone is enabled in your browser</li>
            <li>• Speak clearly and wait for the agent to respond</li>
            <li>• Try interrupting the agent to test interruption sensitivity</li>
            <li>• Test different conversation scenarios</li>
            <li>• Check the transcript to see how well the agent understood you</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

// Main component with Suspense boundary
const TestCallPage: React.FC = () => {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading test call...</div>
      </div>
    }>
      <TestCallContent />
    </Suspense>
  );
};

export default TestCallPage;
