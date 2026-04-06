'use client';

import React, { useState, useEffect } from 'react';
import { FiX, FiPhone, FiPhoneOff, FiMic, FiMicOff, FiVolume2, FiGlobe, FiPhoneIncoming, FiPhoneOutgoing, FiAlertTriangle } from 'react-icons/fi';
import toast from 'react-hot-toast';

interface PhoneNumber {
  id: string;
  phoneNumber: string;
  friendlyName?: string;
  provider: string;
  status: string;
  canReceiveInbound: boolean;
  canSendOutbound: boolean;
  inboundEnabled: boolean;
  outboundEnabled: boolean;
  customer: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface AgentTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  accessToken: string;
  agentName: string;
  agentId: string;
}

const AgentTestModal: React.FC<AgentTestModalProps> = ({
  isOpen,
  onClose,
  accessToken,
  agentName,
  agentId
}) => {
  // Test mode states
  const [testMode, setTestMode] = useState<'web' | 'inbound' | 'outbound' | null>(null);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [hasPhoneNumbers, setHasPhoneNumbers] = useState(false);
  const [loadingPhoneNumbers, setLoadingPhoneNumbers] = useState(false);

  // Web call states
  const [isCallActive, setIsCallActive] = useState(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const retellClientRef = React.useRef<any>(null);

  // Outbound call states
  const [outboundNumber, setOutboundNumber] = useState('');
  const [selectedFromNumber, setSelectedFromNumber] = useState<string>('');
  const [showOutboundConfirmation, setShowOutboundConfirmation] = useState(false);
  const [outboundCallInProgress, setOutboundCallInProgress] = useState(false);

  // Fetch phone numbers when modal opens
  useEffect(() => {
    if (isOpen && agentId) {
      fetchPhoneNumbers();
    }
  }, [isOpen, agentId]);

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

  // Reset states when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTestMode(null);
      setOutboundNumber('');
      setSelectedFromNumber('');
      setShowOutboundConfirmation(false);
      setOutboundCallInProgress(false);
      setError(null);
      setTranscript([]);
      if (retellClientRef.current) {
        try {
          retellClientRef.current.stopCall();
          retellClientRef.current = null;
        } catch (e) {
          console.error('Error stopping call:', e);
        }
      }
    }
  }, [isOpen]);

  const fetchPhoneNumbers = async () => {
    try {
      setLoadingPhoneNumbers(true);

      // Get the partner token from localStorage
      const token = localStorage.getItem('partner_token');
      if (!token) {
        console.error('[AgentTestModal] No partner token found');
        setHasPhoneNumbers(false);
        return;
      }

      const response = await fetch(`/api/partner/retell-agents/${agentId}/phone-numbers`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();

      if (data.success) {
        console.log('[AgentTestModal] Fetched phone numbers:', data.phoneNumbers);
        console.log('[AgentTestModal] Has phone numbers:', data.hasPhoneNumbers);

        // Debug filtering logic
        const inboundNumbers = (data.phoneNumbers || []).filter((p: any) => p.canReceiveInbound);
        const outboundNumbers = (data.phoneNumbers || []).filter((p: any) => p.canSendOutbound);
        console.log('[AgentTestModal] Inbound capable numbers:', inboundNumbers);
        console.log('[AgentTestModal] Outbound capable numbers:', outboundNumbers);

        setPhoneNumbers(data.phoneNumbers || []);
        setHasPhoneNumbers(data.hasPhoneNumbers || false);
      } else {
        console.error('Failed to fetch phone numbers:', data.error);
        setHasPhoneNumbers(false);
      }
    } catch (error) {
      console.error('Error fetching phone numbers:', error);
      setHasPhoneNumbers(false);
    } finally {
      setLoadingPhoneNumbers(false);
    }
  };

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

  const handleOutboundCall = async () => {
    if (!outboundNumber || !selectedFromNumber) {
      toast.error('Please enter a phone number and select a from number');
      return;
    }

    // Validate phone number format
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(outboundNumber)) {
      toast.error('Please enter a valid phone number in E.164 format (e.g., +1234567890)');
      return;
    }

    setShowOutboundConfirmation(true);
  };

  const confirmOutboundCall = async () => {
    try {
      setOutboundCallInProgress(true);
      setShowOutboundConfirmation(false);
      setError(null);

      // Get the partner token from localStorage
      const token = localStorage.getItem('partner_token');
      if (!token) {
        setError('Authentication required. Please refresh the page and try again.');
        setOutboundCallInProgress(false);
        return;
      }

      const response = await fetch(`/api/partner/retell-agents/${agentId}/test-outbound-call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          toNumber: outboundNumber,
          fromNumberId: selectedFromNumber,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Outbound call initiated successfully! You should receive a call shortly.');
        // Reset form
        setOutboundNumber('');
        setSelectedFromNumber('');
      } else {
        if (data.error === 'quota_exceeded') {
          toast.error('Your Retell account has reached its usage limit. Please upgrade your plan.');
        } else if (data.error === 'invalid_api_key') {
          toast.error('Your Retell API key appears to be invalid.');
        } else {
          toast.error(data.message || 'Failed to initiate outbound call');
        }
        setError(data.message || 'Failed to initiate outbound call');
      }
    } catch (error) {
      console.error('Error making outbound call:', error);
      toast.error('Failed to initiate outbound call');
      setError('Failed to initiate outbound call');
    } finally {
      setOutboundCallInProgress(false);
    }
  };

  const cancelOutboundCall = () => {
    setShowOutboundConfirmation(false);
  };

  if (!isOpen) return null;

  // Render test mode selection
  const renderTestModeSelection = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      <div className="text-center mb-8">
        <h3 className="text-2xl font-semibold text-white mb-2">Choose Test Method</h3>
        <p className="text-gray-400">Select how you'd like to test your agent</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl">
        {/* Web Call Option */}
        <button
          onClick={() => setTestMode('web')}
          className="bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg p-6 text-center transition-all duration-200 hover:border-blue-500"
        >
          <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiGlobe className="w-8 h-8 text-blue-400" />
          </div>
          <h4 className="text-lg font-semibold text-white mb-2">Web Call</h4>
          <p className="text-sm text-gray-400">Test using your browser's microphone</p>
        </button>

        {/* Inbound Call Option */}
        <button
          onClick={() => setTestMode('inbound')}
          disabled={!hasPhoneNumbers || loadingPhoneNumbers}
          className={`border rounded-lg p-6 text-center transition-all duration-200 ${
            hasPhoneNumbers && !loadingPhoneNumbers
              ? 'bg-gray-800 hover:bg-gray-700 border-gray-700 hover:border-green-500'
              : 'bg-gray-800/50 border-gray-700/50 cursor-not-allowed opacity-50'
          }`}
        >
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiPhoneIncoming className="w-8 h-8 text-green-400" />
          </div>
          <h4 className="text-lg font-semibold text-white mb-2">Inbound Call</h4>
          <p className="text-sm text-gray-400">
            {loadingPhoneNumbers ? 'Loading...' : hasPhoneNumbers ? 'Call the agent\'s phone number' : 'No phone numbers assigned'}
          </p>
        </button>

        {/* Outbound Call Option */}
        <button
          onClick={() => setTestMode('outbound')}
          disabled={!hasPhoneNumbers || loadingPhoneNumbers}
          className={`border rounded-lg p-6 text-center transition-all duration-200 ${
            hasPhoneNumbers && !loadingPhoneNumbers
              ? 'bg-gray-800 hover:bg-gray-700 border-gray-700 hover:border-orange-500'
              : 'bg-gray-800/50 border-gray-700/50 cursor-not-allowed opacity-50'
          }`}
        >
          <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiPhoneOutgoing className="w-8 h-8 text-orange-400" />
          </div>
          <h4 className="text-lg font-semibold text-white mb-2">Outbound Call</h4>
          <p className="text-sm text-gray-400">
            {loadingPhoneNumbers ? 'Loading...' : hasPhoneNumbers ? 'Agent calls your phone number' : 'No phone numbers assigned'}
          </p>
        </button>
      </div>

      {!hasPhoneNumbers && !loadingPhoneNumbers && (
        <div className="mt-6 text-center">
          <p className="text-gray-500 text-sm">
            To enable phone testing, assign a phone number to this agent in the{' '}
            <span className="text-blue-400">Phone Numbers</span> section.
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg max-w-4xl w-full border border-gray-800 flex flex-col h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">Test Agent</h2>
              <p className="text-sm text-gray-400">Testing: {agentName}</p>
            </div>
            {testMode && (
              <button
                onClick={() => setTestMode(null)}
                className="text-gray-400 hover:text-white text-sm underline"
              >
                ← Back to options
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        {!testMode ? renderTestModeSelection() : (
          <div className="flex-1 flex flex-col p-6 overflow-y-auto">
            {testMode === 'web' && (
              <div className="flex-1 flex flex-col items-center justify-center">
                {isLoading ? (
                  <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mb-4"></div>
                    <p className="text-gray-300">Connecting to agent...</p>
                  </div>
                ) : error ? (
                  <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-6 text-center">
                    <p className="text-red-400 mb-4">{error}</p>
                    <button
                      type="button"
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
                      type="button"
                      onClick={startCall}
                      className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-lg font-medium"
                    >
                      Start Web Call
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
                        type="button"
                        onClick={toggleMute}
                        className={`px-4 py-2 ${isMuted ? 'bg-amber-600 hover:bg-amber-700' : 'bg-gray-700 hover:bg-gray-600'} text-white rounded-lg flex items-center gap-2`}
                      >
                        {isMuted ? <FiMicOff className="w-4 h-4" /> : <FiMic className="w-4 h-4" />}
                        {isMuted ? 'Unmute' : 'Mute'}
                      </button>
                      <button
                        type="button"
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
            )}

            {testMode === 'inbound' && (
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="text-center mb-8">
                  <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FiPhoneIncoming className="w-12 h-12 text-green-400" />
                  </div>
                  <h3 className="text-2xl font-semibold text-white mb-2">Inbound Call Testing</h3>
                  <p className="text-gray-400">Call any of the numbers below to test your agent</p>
                </div>

                <div className="w-full max-w-2xl">
                  {phoneNumbers.filter(p => p.canReceiveInbound).map((phoneNumber) => (
                    <div key={phoneNumber.id} className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-3">
                            <span className="text-xl font-mono text-white">{phoneNumber.phoneNumber}</span>
                            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
                              {phoneNumber.provider.toUpperCase()}
                            </span>
                          </div>
                          {phoneNumber.friendlyName && (
                            <p className="text-sm text-gray-400 mt-1">{phoneNumber.friendlyName}</p>
                          )}
                          {phoneNumber.customer && (
                            <p className="text-xs text-gray-500 mt-1">
                              Assigned to: {phoneNumber.customer.name}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-green-400 font-medium">Ready for calls</div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {phoneNumbers.filter(p => p.inboundEnabled && p.canReceiveInbound).length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-gray-400">No inbound-enabled phone numbers found for this agent.</p>
                    </div>
                  )}
                </div>

                <div className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 max-w-2xl">
                  <div className="flex items-start gap-3">
                    <FiPhone className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-blue-400 font-medium mb-1">How to test:</h4>
                      <p className="text-sm text-gray-300">
                        Call any of the numbers above from your phone. The agent will answer and you can have a conversation to test its responses.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {testMode === 'outbound' && (
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="text-center mb-8">
                  <div className="w-24 h-24 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FiPhoneOutgoing className="w-12 h-12 text-orange-400" />
                  </div>
                  <h3 className="text-2xl font-semibold text-white mb-2">Outbound Call Testing</h3>
                  <p className="text-gray-400">Enter your phone number to receive a test call from the agent</p>
                </div>

                {!showOutboundConfirmation ? (
                  <div className="w-full max-w-md">
                    {/* Warning */}
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6">
                      <div className="flex items-start gap-3">
                        <FiAlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="text-amber-400 font-medium mb-1">Important Notice</h4>
                          <p className="text-sm text-gray-300">
                            This will make an actual outbound call. You are responsible for any charges.
                            Please ensure you enter a test number only.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* From Number Selection */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        From Number
                      </label>
                      <select
                        value={selectedFromNumber}
                        onChange={(e) => setSelectedFromNumber(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="">Select a phone number</option>
                        {phoneNumbers.filter(p => p.canSendOutbound).map((phoneNumber) => (
                          <option key={phoneNumber.id} value={phoneNumber.id}>
                            {phoneNumber.phoneNumber} {phoneNumber.friendlyName ? `(${phoneNumber.friendlyName})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* To Number Input */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Your Phone Number
                      </label>
                      <input
                        type="tel"
                        value={outboundNumber}
                        onChange={(e) => setOutboundNumber(e.target.value)}
                        placeholder="+1234567890"
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Use E.164 format (e.g., +1234567890)
                      </p>
                    </div>

                    {error && (
                      <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 mb-4">
                        <p className="text-red-400 text-sm">{error}</p>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleOutboundCall}
                      disabled={outboundCallInProgress || !outboundNumber || !selectedFromNumber}
                      className="w-full px-4 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium"
                    >
                      {outboundCallInProgress ? 'Initiating Call...' : 'Call Me'}
                    </button>
                  </div>
                ) : (
                  <div className="w-full max-w-md">
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-center">
                      <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FiAlertTriangle className="w-8 h-8 text-orange-400" />
                      </div>
                      <h4 className="text-xl font-semibold text-white mb-2">Confirm Outbound Call</h4>
                      <p className="text-gray-400 mb-4">
                        Are you sure you want to initiate a call to <span className="text-white font-mono">{outboundNumber}</span>?
                      </p>
                      <p className="text-sm text-amber-400 mb-6">
                        This will make an actual phone call and may incur charges.
                      </p>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={cancelOutboundCall}
                          className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={confirmOutboundCall}
                          disabled={outboundCallInProgress}
                          className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700 text-white rounded-lg"
                        >
                          {outboundCallInProgress ? 'Calling...' : 'Confirm Call'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentTestModal;
