'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FiMessageSquare, FiInbox, FiClock, FiDownload, FiPhone, FiMonitor, FiArrowDownLeft, FiArrowUpRight, FiX, FiChevronDown, FiFilter } from 'react-icons/fi';
import { usePartnerBranding } from '@/lib/partnerBranding';
import { formatDistanceToNow, format } from 'date-fns';

interface Agent {
  id: string;
  name: string;
  assistantId: string;
  customerId?: string;
  type?: 'vapi' | 'retell';
}

interface Conversation {
  id: string;
  assistantId: string;
  type: string;
  startedAt: string;
  endedAt: string;
  transcript: string | any[]; // Can be string (VAPI/Retell) or array (ElevenLabs)
  recordingUrl: string;
  stereoRecordingUrl: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
  cost: number;
  status: string;
  endedReason: string;
  messages: any[];
  duration: number;
  sentiment?: {
    overall: number;
    customer: number;
    agent: number;
  };
  topics?: string[];
  // Audio processing status for async audio processing
  audioProcessingStatus?: string | null; // 'processing' | 'completed' | 'failed' | null
  // New fields for call direction and phone numbers
  direction?: string; // 'inbound' | 'outbound'
  fromNumber?: string;
  toNumber?: string;
  callType?: string; // 'phone_call' | 'web_call'
}

interface PaginationInfo {
  hasMore: boolean;
  nextPaginationKey: string | null;
  totalCount?: number;
}

// Helper function to format transcript for display
const formatTranscriptForDisplay = (transcript: any): string => {
  if (!transcript) return 'No transcript available';

  // If it's already a string, return as-is
  if (typeof transcript === 'string') {
    return transcript;
  }

  // If it's an array (ElevenLabs format), format it
  if (Array.isArray(transcript)) {
    return transcript.map((turn: any) => {
      const role = turn.role === 'user' ? 'User' : 'Assistant';
      const message = turn.message || '';
      const timeInCall = turn.time_in_call_secs ? ` [${turn.time_in_call_secs}s]` : '';
      return `${role}${timeInCall}: ${message}`;
    }).join('\n\n');
  }

  // If it's an object, try to extract meaningful content
  if (typeof transcript === 'object') {
    return JSON.stringify(transcript, null, 2);
  }

  return String(transcript);
};

// Download utility functions
const downloadTranscript = (conversation: Conversation) => {
  const transcript = formatTranscriptForDisplay(conversation.transcript);
  const date = new Date(conversation.startedAt).toLocaleDateString();
  const time = new Date(conversation.startedAt).toLocaleTimeString();

  // Create formatted transcript content
  const content = `Conversation Transcript
Date: ${date}
Time: ${time}
Duration: ${formatDuration(conversation.duration)}
Status: ${conversation.status}
${conversation.summary ? `Summary: ${conversation.summary}` : ''}

--- TRANSCRIPT ---
${transcript}

--- END TRANSCRIPT ---`;

  // Create and download file
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `transcript-${conversation.id}-${date.replace(/\//g, '-')}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const downloadRecording = async (conversation: Conversation) => {
  const recordingUrl = conversation.recordingUrl || conversation.stereoRecordingUrl;

  // Check if audio is still processing
  if (conversation.audioProcessingStatus === 'processing') {
    alert('Audio is still being processed. Please wait and try again in a few moments.');
    return;
  }

  if (conversation.audioProcessingStatus === 'failed') {
    alert('Audio processing failed. No recording is available for this conversation.');
    return;
  }

  if (!recordingUrl) {
    alert('No recording available for this conversation');
    return;
  }

  try {
    // Use our backend proxy to download the recording
    const response = await fetch(`/api/whitelabel/conversations/${conversation.id}/download-recording`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to fetch recording');
    }

    // Get the filename from the Content-Disposition header
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = `recording-${conversation.id}.wav`; // default filename

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    }

    // Create blob and download
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading recording:', error);
    alert('Failed to download recording. Please try again.');
  }
};

// Format duration helper (moved up to be available for download function)
const formatDuration = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const AnalyticsServiceAgentConversations: React.FC = () => {
  const { branding } = usePartnerBranding();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [selectedLimit, setSelectedLimit] = useState(50);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paginationInfo, setPaginationInfo] = useState<PaginationInfo>({
    hasMore: false,
    nextPaginationKey: null
  });
  // State for customer features
  const [customerFeatures, setCustomerFeatures] = useState<{
    showPricingInformation?: boolean;
  }>({ showPricingInformation: false });

  // Helper function to format cost from cents to dollars
  const formatCost = (costInCents: number): string => {
    const costInDollars = costInCents / 100;
    return `$${costInDollars.toFixed(2)}`;
  };

  // Fetch customer features
  useEffect(() => {
    const fetchCustomerFeatures = async () => {
      try {
        const response = await fetch('/api/whitelabel/customer/features');
        if (response.ok) {
          const data = await response.json();
          setCustomerFeatures({
            showPricingInformation: data.showPricingInformation
          });
        }
      } catch (error) {
        console.error('Error fetching customer features:', error);
        // Default to not showing pricing if there's an error
        setCustomerFeatures({ showPricingInformation: false });
      }
    };

    fetchCustomerFeatures();
  }, []);

  // Fetch all agents
  const fetchAllAgents = useCallback(async () => {
    try {
      const response = await fetch('/api/whitelabel/agents');
      if (!response.ok) {
        throw new Error('Failed to fetch agents');
      }

      const data = await response.json();
      const agentsWithType = (data.agents || []).map((agent: Agent) => ({
        ...agent,
        type: agent.type || 'vapi'
      }));

      setAgents(agentsWithType);
      
      // Auto-select first agent if none selected
      if (agentsWithType.length > 0 && !selectedAgent) {
        setSelectedAgent(agentsWithType[0]);
      }
    } catch (error) {
      console.error('Error fetching agents:', error);
      setError('Failed to load agents');
    }
  }, [selectedAgent]);

  // Fetch conversations from analytics service
  const fetchConversations = useCallback(async (agentId?: string, period: string = '7d', paginationKey?: string, append: boolean = false, isTransition: boolean = false) => {
    try {
      if (append) {
        setIsLoadingMore(true);
      } else if (isTransition) {
        setIsTransitioning(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      console.log(`🔄 Fetching conversations from analytics service:`, { agentId, period, paginationKey, limit: selectedLimit });

      // Build query string with cache-busting timestamp
      let queryString = `period=${period}&limit=${selectedLimit}`;
      if (agentId) {
        queryString += `&agentId=${agentId}`;
      }
      if (paginationKey) {
        queryString += `&pagination_key=${paginationKey}`;
      }

      // Add cache-busting timestamp to ensure fresh data
      const timestamp = Date.now();
      queryString += `&_t=${timestamp}`;

      const response = await fetch(`/api/whitelabel/analytics/conversations?${queryString}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch conversations: ${response.status}`);
      }

      const result = await response.json();

      // Update conversations list
      if (append) {
        setConversations(prev => [...prev, ...(result.data || [])]);
      } else {
        const newConversations = result.data || [];
        setConversations(newConversations);

        // Handle selected conversation intelligently
        if (newConversations.length > 0) {
          // Check if current selected conversation still exists in new data
          const currentSelectedExists = selectedConversation &&
            newConversations.find((conv: Conversation) => conv.id === selectedConversation.id);

          if (!currentSelectedExists) {
            // If current selection doesn't exist in new data, select the first one
            setSelectedConversation(newConversations[0]);
          }
          // If current selection exists, keep it (no need to change)
        } else {
          // No conversations available, clear selection
          setSelectedConversation(null);
        }
      }

      // Update pagination info
      setPaginationInfo({
        hasMore: result.pagination?.hasMore || false,
        nextPaginationKey: result.pagination?.nextPaginationKey || null,
        totalCount: result.pagination?.totalCount
      });

      console.log('Successfully loaded conversations from analytics service:', {
        count: result.data?.length || 0,
        hasMore: result.pagination?.hasMore || false
      });

    } catch (error) {
      console.error('Error fetching conversations from analytics service:', error);
      setError('Failed to load conversations');
      if (!append) {
        setConversations([]);
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      setIsTransitioning(false);
    }
  }, [selectedConversation, selectedLimit]);

  // Load agents when component mounts
  useEffect(() => {
    fetchAllAgents();
  }, [fetchAllAgents]);

  // Load conversations when agent, period, or limit changes
  useEffect(() => {
    if (selectedAgent) {
      fetchConversations(selectedAgent.id, selectedPeriod, undefined, false, true);
    }
  }, [selectedAgent, selectedPeriod, selectedLimit, fetchConversations]);

  // Handle agent selection
  const handleAgentSelect = (agent: Agent | null) => {
    setSelectedAgent(agent);
    // Don't clear selectedConversation immediately - let the fetch handle it
    // This prevents flickering when switching agents
  };

  // Handle load more
  const handleLoadMore = () => {
    if (paginationInfo.hasMore && paginationInfo.nextPaginationKey) {
      fetchConversations(selectedAgent?.id, selectedPeriod, paginationInfo.nextPaginationKey, true);
    }
  };

  // Helper function to safely parse dates
  const safeParseDate = (dateValue: string | number | null | undefined): Date => {
    if (!dateValue) return new Date();

    // If it's a number, treat it as Unix timestamp
    if (typeof dateValue === 'number') {
      return new Date(dateValue);
    }

    // If it's a string, try to parse it
    if (typeof dateValue === 'string') {
      const parsed = new Date(dateValue);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    // Fallback to current date
    return new Date();
  };



  // Get sentiment color
  const getSentimentColor = (sentiment?: { overall: number }) => {
    if (!sentiment) return 'text-gray-400';
    if (sentiment.overall > 0.1) return 'text-green-400';
    if (sentiment.overall < -0.1) return 'text-red-400';
    return 'text-amber-400';
  };

  // Get sentiment label
  const getSentimentLabel = (sentiment?: { overall: number }) => {
    if (!sentiment) return 'Unknown';
    if (sentiment.overall > 0.1) return 'Positive';
    if (sentiment.overall < -0.1) return 'Negative';
    return 'Neutral';
  };

  // Helper function to check if summary is meaningful
  const hasMeaningfulSummary = (summary: string | undefined) => {
    if (!summary) return false;
    const trimmedSummary = summary.trim().toLowerCase();
    const defaultValues = [
      'no summary available',
      'knova conversation',
      'conversation',
      'summary not available',
      'n/a',
      'analysis failed due to an error',
      'analysis failed',
      'failed to analyze'
    ];
    return trimmedSummary.length > 0 && !defaultValues.includes(trimmedSummary);
  };

  // Handle conversation click - open modal
  const handleConversationClick = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setIsModalOpen(true);
  };

  // Close modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        handleCloseModal();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isModalOpen]);

  // Error state - must be after all hooks
  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400 text-lg mb-4">{error}</p>
        <button
          onClick={() => fetchConversations(selectedAgent?.id, selectedPeriod)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // Helper to find agent name for a conversation
  const findAgentName = (conversation: Conversation): string => {
    let foundAgent = agents.find(a => a.assistantId === conversation.assistantId);
    if (!foundAgent) foundAgent = agents.find(a => a.id === conversation.assistantId);
    if (!foundAgent && selectedAgent) foundAgent = selectedAgent;
    return foundAgent?.name || 'Agent';
  };

  // Get status badge styles
  const getStatusBadge = (status: string) => {
    const s = (status || 'completed').toLowerCase();
    if (s === 'completed' || s === 'ended') return { bg: 'bg-green-900/30', text: 'text-green-400', border: 'border-green-700/30', label: 'Completed' };
    if (s === 'failed' || s === 'error') return { bg: 'bg-red-900/30', text: 'text-red-400', border: 'border-red-700/30', label: 'Failed' };
    if (s === 'in-progress' || s === 'active') return { bg: 'bg-blue-900/30', text: 'text-blue-400', border: 'border-blue-700/30', label: 'Active' };
    return { bg: 'bg-gray-800/50', text: 'text-gray-400', border: 'border-gray-700/30', label: status || 'Completed' };
  };

  return (
    <div className="h-[calc(100vh-200px)] flex flex-col">
      {/* Slide-over Detail Panel */}
      {isModalOpen && selectedConversation && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={handleCloseModal} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-gray-900 border-l border-gray-700 shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200">
            {/* Panel Header */}
            <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-700/50 px-5 py-3 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                  selectedConversation.type === 'chat_conversation' ? 'bg-indigo-600' :
                  selectedConversation.callType === 'web_call' ? 'bg-purple-600' :
                  selectedConversation.direction === 'inbound' ? 'bg-green-600' : 'bg-blue-600'
                }`}>
                  {selectedConversation.type === 'chat_conversation' ? <FiMessageSquare className="h-3.5 w-3.5 text-white" /> :
                   selectedConversation.callType === 'web_call' ? <FiMonitor className="h-3.5 w-3.5 text-white" /> :
                   selectedConversation.direction === 'inbound' ? <FiArrowDownLeft className="h-3.5 w-3.5 text-white" /> :
                   <FiArrowUpRight className="h-3.5 w-3.5 text-white" />}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {selectedConversation.type === 'chat_conversation' ? 'Chat' :
                     selectedConversation.callType === 'web_call' ? 'Web Call' :
                     selectedConversation.direction === 'inbound' ? 'Inbound Call' : 'Outbound Call'}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {format(safeParseDate(selectedConversation.startedAt || selectedConversation.createdAt), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              </div>
              <button onClick={handleCloseModal} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
                <FiX className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-800/60 rounded-lg p-3 border border-gray-700/40">
                  <div className="text-xs text-gray-500 mb-1">Duration</div>
                  <div className="text-sm font-medium text-white">{formatDuration(selectedConversation.duration)}</div>
                </div>
                <div className="bg-gray-800/60 rounded-lg p-3 border border-gray-700/40">
                  <div className="text-xs text-gray-500 mb-1">Status</div>
                  <div className="text-sm font-medium text-white capitalize">{selectedConversation.status || 'completed'}</div>
                </div>
                {customerFeatures.showPricingInformation && selectedConversation.cost > 0 && (
                  <div className="bg-gray-800/60 rounded-lg p-3 border border-gray-700/40">
                    <div className="text-xs text-gray-500 mb-1">Cost</div>
                    <div className="text-sm font-medium text-white">{formatCost(selectedConversation.cost)}</div>
                  </div>
                )}
              </div>

              {/* Call Details */}
              <div className="bg-gray-800/40 rounded-lg border border-gray-700/40 divide-y divide-gray-700/40">
                {selectedConversation.fromNumber && (
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs text-gray-500">From</span>
                    <span className="text-sm text-white">{selectedConversation.fromNumber}</span>
                  </div>
                )}
                {selectedConversation.toNumber && (
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs text-gray-500">To</span>
                    <span className="text-sm text-white">{selectedConversation.toNumber}</span>
                  </div>
                )}
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs text-gray-500">Agent</span>
                  <span className="text-sm text-white">{findAgentName(selectedConversation)}</span>
                </div>
                {selectedConversation.direction && (
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs text-gray-500">Direction</span>
                    <span className="text-sm text-white capitalize">{selectedConversation.direction}</span>
                  </div>
                )}
                {selectedConversation.endedReason && (
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs text-gray-500">End Reason</span>
                    <span className="text-sm text-white capitalize">{selectedConversation.endedReason.replace(/_/g, ' ')}</span>
                  </div>
                )}
              </div>

              {/* AI Summary */}
              {hasMeaningfulSummary(selectedConversation.summary) && (
                <div>
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">AI Summary</h4>
                  <p className="text-sm text-gray-300 leading-relaxed bg-gray-800/40 rounded-lg p-3 border border-gray-700/40">
                    {selectedConversation.summary}
                  </p>
                </div>
              )}

              {/* Recording */}
              {selectedConversation.recordingUrl && (() => {
                const recordingUrl = selectedConversation.recordingUrl.endsWith('.wav')
                  ? `${selectedConversation.recordingUrl}.ogg`
                  : selectedConversation.recordingUrl;
                return (
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Recording</h4>
                    <audio key={selectedConversation.id} controls className="w-full">
                      <source src={recordingUrl} type="audio/ogg; codecs=opus" />
                      <source src={recordingUrl} type="audio/ogg" />
                      <source src={selectedConversation.recordingUrl} type="audio/mpeg" />
                      <source src={selectedConversation.recordingUrl} type="audio/wav" />
                    </audio>
                  </div>
                );
              })()}

              {/* Transcript */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Transcript</h4>
                  <button onClick={() => downloadTranscript(selectedConversation)} className="flex items-center space-x-1 text-xs text-gray-400 hover:text-white transition-colors">
                    <FiDownload className="h-3 w-3" />
                    <span>Download</span>
                  </button>
                </div>
                <div className="bg-gray-800/40 rounded-lg border border-gray-700/40 p-3 max-h-80 overflow-y-auto space-y-3">
                  {selectedConversation.messages && selectedConversation.messages.length > 0 ? (
                    selectedConversation.messages.map((message: any, index: number) => {
                      const isUser = message.role === 'user';
                      return (
                        <div key={index} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] rounded-lg px-3 py-2 ${isUser ? 'bg-blue-600/80 text-white' : 'bg-gray-700/80 text-gray-200'}`}
                            style={isUser ? { backgroundColor: branding.primaryColor + 'cc' } : {}}>
                            <div className="text-[10px] text-gray-300/70 mb-0.5">{isUser ? 'Customer' : 'AI'}</div>
                            <div className="text-sm leading-relaxed">{message.message}</div>
                          </div>
                        </div>
                      );
                    })
                  ) : selectedConversation.transcript ? (
                    <pre className="whitespace-pre-wrap text-sm text-gray-300 leading-relaxed">{formatTranscriptForDisplay(selectedConversation.transcript)}</pre>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">No transcript available</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-0 bg-gray-800/30 rounded-lg border border-gray-700/50">
        {/* Compact header + inline filters */}
        <div className="px-4 py-3 border-b border-gray-700/50">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center space-x-3">
              <h3 className="text-sm font-semibold text-white whitespace-nowrap">Conversations</h3>
              <span className="text-xs text-gray-500">
                {paginationInfo.totalCount !== undefined
                  ? `${conversations.length} of ${paginationInfo.totalCount}`
                  : conversations.length > 0 ? `${conversations.length} loaded` : ''}
              </span>
            </div>

            <div className="flex items-center space-x-2 flex-wrap">
              {/* Agent filter */}
              <select
                value={selectedAgent?.id || ''}
                onChange={(e) => handleAgentSelect(agents.find(a => a.id === e.target.value) || null)}
                className="bg-gray-700/60 border border-gray-600/50 text-white rounded-md px-2.5 py-1.5 text-xs appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500/50 min-w-[120px]"
              >
                <option value="">All Agents</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>{agent.name}</option>
                ))}
              </select>

              {/* Period filter */}
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="bg-gray-700/60 border border-gray-600/50 text-white rounded-md px-2.5 py-1.5 text-xs appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              >
                <option value="1d">24h</option>
                <option value="7d">7 days</option>
                <option value="30d">30 days</option>
                <option value="90d">90 days</option>
              </select>

              {/* Limit filter */}
              <select
                value={selectedLimit}
                onChange={(e) => setSelectedLimit(Number(e.target.value))}
                className="bg-gray-700/60 border border-gray-600/50 text-white rounded-md px-2.5 py-1.5 text-xs appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto min-h-0 relative">
          {/* Transitioning overlay */}
          {isTransitioning && (
            <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center z-10">
              <div className="flex items-center space-x-2 text-white">
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500"></div>
                <span className="text-xs">Loading...</span>
              </div>
            </div>
          )}

          {isLoading && conversations.length === 0 ? (
            <div className="p-4 space-y-2">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="animate-pulse flex items-center space-x-4 py-2">
                  <div className="h-3 bg-gray-700 rounded w-24"></div>
                  <div className="h-3 bg-gray-700 rounded w-16"></div>
                  <div className="h-3 bg-gray-700 rounded w-20"></div>
                  <div className="h-3 bg-gray-700 rounded flex-1"></div>
                </div>
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <FiInbox className="h-8 w-8 text-gray-600 mb-3" />
              <p className="text-gray-500 text-sm">No conversations found</p>
              <p className="text-gray-600 text-xs mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-[5]">
                <tr className="bg-gray-800/90 backdrop-blur-sm border-b border-gray-700/50">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">Time</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-2.5">Type</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-2.5">From / To</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-2.5">Duration</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-2.5">Status</th>
                  {customerFeatures.showPricingInformation && (
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-2.5">Cost</th>
                  )}
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-2.5">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/30">
                {conversations.map((conversation) => {
                  const statusBadge = getStatusBadge(conversation.status);
                  const isSelected = selectedConversation?.id === conversation.id && isModalOpen;
                  return (
                    <tr
                      key={conversation.id}
                      onClick={() => handleConversationClick(conversation)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-900/20 border-l-2 border-l-blue-500' : 'hover:bg-gray-700/20 border-l-2 border-l-transparent'
                      }`}
                    >
                      {/* Time */}
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="text-xs text-white">
                          {format(safeParseDate(conversation.startedAt || conversation.createdAt), 'MMM d, h:mm a')}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          {formatDistanceToNow(safeParseDate(conversation.startedAt || conversation.createdAt), { addSuffix: true })}
                        </div>
                      </td>

                      {/* Type / Direction */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                            conversation.type === 'chat_conversation' ? 'bg-indigo-600/80' :
                            conversation.callType === 'web_call' ? 'bg-purple-600/80' :
                            conversation.direction === 'inbound' ? 'bg-green-600/80' : 'bg-blue-600/80'
                          }`}>
                            {conversation.type === 'chat_conversation' ? <FiMessageSquare className="h-2.5 w-2.5 text-white" /> :
                             conversation.callType === 'web_call' ? <FiMonitor className="h-2.5 w-2.5 text-white" /> :
                             conversation.direction === 'inbound' ? <FiArrowDownLeft className="h-2.5 w-2.5 text-white" /> :
                             <FiArrowUpRight className="h-2.5 w-2.5 text-white" />}
                          </div>
                          <span className="text-xs text-gray-300 capitalize">
                            {conversation.type === 'chat_conversation' ? 'Chat' :
                             conversation.callType === 'web_call' ? 'Web' :
                             conversation.direction || 'outbound'}
                          </span>
                        </div>
                      </td>

                      {/* From / To */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="text-xs text-gray-300">{conversation.fromNumber || '—'}</div>
                        {conversation.toNumber && (
                          <div className="text-[10px] text-gray-500">→ {conversation.toNumber}</div>
                        )}
                      </td>

                      {/* Duration */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="text-xs text-gray-300">{formatDuration(conversation.duration)}</span>
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded ${statusBadge.bg} ${statusBadge.text} border ${statusBadge.border}`}>
                          {statusBadge.label}
                        </span>
                      </td>

                      {/* Cost */}
                      {customerFeatures.showPricingInformation && (
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="text-xs text-gray-300">
                            {conversation.cost > 0 ? formatCost(conversation.cost) : '—'}
                          </span>
                        </td>
                      )}

                      {/* Summary */}
                      <td className="px-3 py-2.5 max-w-xs">
                        <p className="text-xs text-gray-400 truncate">
                          {conversation.summary || 'No summary'}
                        </p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Load More footer */}
        {paginationInfo.hasMore && (
          <div className="px-4 py-2.5 border-t border-gray-700/50 flex items-center justify-center">
            <button
              onClick={handleLoadMore}
              className="px-4 py-1.5 text-xs text-gray-300 rounded-md bg-gray-700/40 hover:bg-gray-700/70 hover:text-white transition-colors"
              disabled={isLoadingMore}
            >
              {isLoadingMore ? (
                <span className="flex items-center space-x-2">
                  <span className="animate-spin rounded-full h-3 w-3 border-t border-b border-white"></span>
                  <span>Loading...</span>
                </span>
              ) : (
                'Load More'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsServiceAgentConversations;
