'use client';

import React, { useState, useEffect } from 'react';
import { FiPlay, FiLoader, FiCheckCircle, FiXCircle, FiClock, FiInfo, FiMic, FiMicOff, FiPhone, FiPhoneOff, FiVolume2 } from 'react-icons/fi';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface TestingPanelProps {
  agentId?: string;
  agentName: string;
  isAgentSaved: boolean;
  mode: 'create' | 'edit';
  onTestComplete?: (result: TestResult) => void;
}

interface TestResult {
  id: string;
  callId: string;
  status: 'completed' | 'failed' | 'in_progress';
  duration?: number;
  createdAt: string;
  errorMessage?: string;
}

interface TestCall {
  accessToken: string;
  callId: string;
  agentName: string;
  expiresAt: string;
}

interface AgentTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  accessToken: string;
  agentName: string;
}

// Simple Agent Test Modal Component
const AgentTestModal: React.FC<AgentTestModalProps> = ({
  isOpen,
  onClose,
  accessToken,
  agentName
}) => {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const retellClientRef = React.useRef<any>(null);

  // Clean up on unmount
  React.useEffect(() => {
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

  const startCall = async () => {
    if (!accessToken) return;

    try {
      setIsLoading(true);
      setError(null);

      // Import RetellWebClient dynamically
      const { RetellWebClient } = await import('retell-client-js-sdk');
      const client = new RetellWebClient();

      // Set up event listeners
      client.on('call_started', () => {
        console.log('Call started');
        setIsCallActive(true);
        setIsLoading(false);
      });

      client.on('call_ended', () => {
        console.log('Call ended');
        setIsCallActive(false);
        setIsAgentSpeaking(false);
      });

      client.on('agent_start_talking', () => {
        setIsAgentSpeaking(true);
      });

      client.on('agent_stop_talking', () => {
        setIsAgentSpeaking(false);
      });

      client.on('update', (update: any) => {
        if (update.transcript) {
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
        setIsLoading(false);
      });

      // Start the call
      await client.startCall({
        accessToken: accessToken,
      });

      retellClientRef.current = client;
    } catch (error: any) {
      console.error('Failed to start call:', error);
      setError(error.message || 'Failed to start call');
      setIsLoading(false);
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
      <div className="bg-gray-900 rounded-lg max-w-2xl w-full border border-gray-800 flex flex-col h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-white">Test Agent</h2>
            <p className="text-sm text-gray-400">Testing: {agentName}</p>
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
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          {isLoading ? (
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mb-4"></div>
              <p className="text-gray-300">Connecting to agent...</p>
            </div>
          ) : error ? (
            <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-6 text-center">
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={startCall}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                Try Again
              </button>
            </div>
          ) : !isCallActive ? (
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 bg-blue-500/20 rounded-full flex items-center justify-center mb-6">
                <FiPhone className="w-12 h-12 text-blue-400" />
              </div>
              <p className="text-gray-300 text-lg mb-6">Ready to test your agent</p>
              <button
                onClick={startCall}
                className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-lg font-medium"
              >
                Start Call
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center w-full">
              {/* Call Status */}
              <div className="relative mb-6">
                <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isAgentSpeaking ? 'bg-green-500/30' : 'bg-blue-500/20'
                }`}>
                  {isAgentSpeaking ? (
                    <FiVolume2 className="w-12 h-12 text-green-400" />
                  ) : (
                    <FiPhone className="w-12 h-12 text-blue-400" />
                  )}
                </div>
              </div>

              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-white mb-2">Call Active</h3>
                <p className="text-gray-400">
                  {isAgentSpeaking ? 'Agent is speaking...' : 'Agent is listening'}
                </p>
              </div>

              {/* Call Controls */}
              <div className="flex gap-4 mb-6">
                <button
                  onClick={toggleMute}
                  className={`px-4 py-2 ${isMuted ? 'bg-amber-600 hover:bg-amber-700' : 'bg-gray-700 hover:bg-gray-600'} text-white rounded-lg flex items-center gap-2`}
                >
                  {isMuted ? <FiMicOff className="w-4 h-4" /> : <FiMic className="w-4 h-4" />}
                  {isMuted ? 'Unmute' : 'Mute'}
                </button>
                <button
                  onClick={endCall}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2"
                >
                  <FiPhoneOff className="w-4 h-4" />
                  End Call
                </button>
              </div>

              {/* Transcript */}
              <div className="bg-gray-800/50 rounded-lg p-4 w-full max-w-md">
                <h4 className="text-white font-medium mb-2 text-center">Transcript</h4>
                <div className="max-h-32 overflow-y-auto text-sm">
                  {transcript.length === 0 ? (
                    <p className="text-gray-500 italic text-center">Transcript will appear here...</p>
                  ) : (
                    transcript.map((line, index) => (
                      <div key={index} className="mb-1 text-gray-300">
                        {line}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TestingPanel: React.FC<TestingPanelProps> = ({
  agentId,
  agentName,
  isAgentSaved,
  mode: _mode,
  onTestComplete: _onTestComplete
}) => {
  const [isCreatingTest, setIsCreatingTest] = useState(false);
  const [testHistory, setTestHistory] = useState<TestResult[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [currentTestCall, setCurrentTestCall] = useState<TestCall | null>(null);
  const [showWebCallModal, setShowWebCallModal] = useState(false);

  // Load test history when component mounts and agent is available
  useEffect(() => {
    if (agentId && isAgentSaved) {
      loadTestHistory();
    }
  }, [agentId, isAgentSaved]);

  const loadTestHistory = async () => {
    if (!agentId) return;
    
    setIsLoadingHistory(true);
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch(`/api/partner/retell-agents/${agentId}/test-history?limit=5`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTestHistory(data.tests || []);
      }
    } catch (error) {
      console.error('Error loading test history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const createTestCall = async () => {
    if (!agentId) {
      toast.error('Agent must be saved before testing');
      return;
    }

    setIsCreatingTest(true);
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch(`/api/partner/retell-agents/${agentId}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({})
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create test call');
      }

      const testCall: TestCall = await response.json();
      setCurrentTestCall(testCall);

      // Show the web call modal instead of opening a new tab
      setShowWebCallModal(true);

      toast.success('Test call created! You can now start testing in the modal.');

      // Refresh test history
      setTimeout(() => {
        loadTestHistory();
      }, 2000);
      
    } catch (error) {
      console.error('Error creating test call:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create test call');
    } finally {
      setIsCreatingTest(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <FiCheckCircle className="w-4 h-4 text-green-400" />;
      case 'failed':
        return <FiXCircle className="w-4 h-4 text-red-400" />;
      case 'in_progress':
        return <FiLoader className="w-4 h-4 text-blue-400 animate-spin" />;
      default:
        return <FiClock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-400';
      case 'failed':
        return 'text-red-400';
      case 'in_progress':
        return 'text-blue-400';
      default:
        return 'text-gray-400';
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hr ago`;
    return date.toLocaleDateString();
  };

  if (!isAgentSaved) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <FiInfo className="w-12 h-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">Save Agent First</h3>
        <p className="text-gray-400 max-w-md">
          You need to save the agent configuration before you can test it. 
          Click "Save Agent" or "Create Agent" to enable testing.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Test Call Section */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-medium text-white mb-4">Test Your Agent</h3>
        
        <div className="text-center">
          <button
            type="button"
            onClick={createTestCall}
            disabled={isCreatingTest || !agentId}
            className={clsx(
              'inline-flex items-center gap-3 px-8 py-4 rounded-lg font-medium transition-colors',
              isCreatingTest || !agentId
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-500 text-white'
            )}
          >
            {isCreatingTest ? (
              <>
                <FiLoader className="w-5 h-5 animate-spin" />
                Creating Test Call...
              </>
            ) : (
              <>
                <FiPlay className="w-5 h-5" />
                Start Test Call
              </>
            )}
          </button>
          
          <div className="mt-4 text-sm text-gray-400 space-y-2">
            <p>Click the button above to create a test web call for your agent.</p>
            <p>A new window will open where you can speak with your agent directly.</p>
          </div>
        </div>

        {/* Test Scenarios */}
        <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <h4 className="text-sm font-medium text-blue-400 mb-2">💡 Test Scenarios</h4>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>• Try greeting the agent and see how it responds</li>
            <li>• Test the main conversation flow you designed</li>
            <li>• Verify the voice quality and response speed</li>
            <li>• Try interrupting the agent to test interruption sensitivity</li>
            <li>• Test edge cases and unexpected user inputs</li>
          </ul>
        </div>
      </div>

      {/* Test History */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-white">Recent Test Results</h3>
          {testHistory.length > 0 && (
            <button
              type="button"
              onClick={loadTestHistory}
              disabled={isLoadingHistory}
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              {isLoadingHistory ? 'Refreshing...' : 'Refresh'}
            </button>
          )}
        </div>

        {isLoadingHistory ? (
          <div className="flex items-center justify-center py-8">
            <FiLoader className="w-6 h-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-400">Loading test history...</span>
          </div>
        ) : testHistory.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <FiClock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No test calls yet</p>
            <p className="text-sm mt-1">Start your first test call to see results here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {testHistory.map((test) => (
              <div
                key={test.id}
                className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(test.status)}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">
                        Test Call #{test.id.slice(-6)}
                      </span>
                      <span className={clsx('text-xs capitalize', getStatusColor(test.status))}>
                        {test.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {formatDate(test.createdAt)}
                      {test.duration && (
                        <span className="ml-2">• Duration: {formatDuration(test.duration)}</span>
                      )}
                    </div>
                    {test.errorMessage && (
                      <div className="text-xs text-red-400 mt-1">
                        Error: {test.errorMessage}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Current Test Call Info */}
      {currentTestCall && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <FiCheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-green-400">Test Call Created</h4>
              <p className="text-sm text-gray-300 mt-1">
                Your test call is ready! Check the new browser window to start testing.
              </p>
              <div className="text-xs text-gray-400 mt-2">
                Call ID: {currentTestCall.callId}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Web Call Modal */}
      {showWebCallModal && currentTestCall && (
        <AgentTestModal
          isOpen={showWebCallModal}
          onClose={() => setShowWebCallModal(false)}
          accessToken={currentTestCall.accessToken}
          agentName={agentName}
        />
      )}
    </div>
  );
};

export default TestingPanel;
