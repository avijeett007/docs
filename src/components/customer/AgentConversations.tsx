'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Tab } from '@headlessui/react';
import { FiClock, FiPhoneCall, FiMessageSquare, FiFilter, FiPlay, FiPause, FiChevronDown, FiChevronRight, FiInbox } from 'react-icons/fi';
import NeonContainer from '@/components/NeonContainer';
import { formatDuration, formatDate } from '@/lib/utils';
import { useUser } from '@clerk/nextjs';
import { usePartnerBranding } from '@/lib/partnerBranding';

// Define types with proper type safety
interface Agent {
  id: string;
  name: string;
  customerId?: string;
  agentType: AgentType;
}

// Define agent types for future extensibility
type AgentType = 'vapi' | 'elevenlabs' | 'retell' | 'knotie-ai';

// Define pagination interface
interface PaginationInfo {
  hasMore: boolean;
  nextPaginationKey: string | null;
}

interface Conversation {
  id: string;
  assistantId: string;
  type: string;
  startedAt: string;
  endedAt: string;
  transcript: string;
  recordingUrl?: string;
  stereoRecordingUrl?: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
  cost: number;
  status: string;
  endedReason: string;
  messages: Message[];
}

interface Message {
  role: 'system' | 'user' | 'bot' | 'assistant';
  time: number;
  message: string;
  duration?: number;
  endTime?: number;
  secondsFromStart?: number;
}

interface ConversationListProps {
  conversations: Conversation[];
  onSelect: (conversation: Conversation) => void;
  selectedConversation: Conversation | null;
}

// Component to display the list of conversations
const ConversationList: React.FC<ConversationListProps> = ({ conversations, onSelect, selectedConversation }) => {
  const { branding } = usePartnerBranding();
  const { primaryColor } = branding;

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <FiInbox className="h-8 w-8 mb-2" />
        <p>No conversations found</p>
        <p className="text-xs mt-1">Try changing the time filter</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[calc(100vh-250px)] overflow-y-auto pr-2">
      {conversations.map((conversation) => {
        // Format date to be more readable
        const date = new Date(conversation.createdAt || conversation.startedAt);
        const formattedDate = date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
        const formattedTime = date.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        });

        return (
          <div
            key={conversation.id}
            onClick={() => onSelect(conversation)}
            className={`p-3 rounded-lg cursor-pointer transition-all border ${selectedConversation?.id === conversation.id
              ? 'bg-opacity-20'
              : 'border-gray-800 hover:border-gray-700 bg-gray-800/30 hover:bg-gray-800/50'
            }`}
            style={{
              backgroundColor: selectedConversation?.id === conversation.id ? `${primaryColor}20` : '',
              borderColor: selectedConversation?.id === conversation.id ? primaryColor : ''
            }}
          >
            <div className="flex justify-between items-start mb-1">
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full mr-2"
                  style={{ backgroundColor: conversation.status === 'completed' ? '#10B981' : '#F59E0B' }}
                />
                <span className="text-xs text-gray-400">{formattedDate}</span>
              </div>
              <span className="text-xs text-gray-500">{formattedTime}</span>
            </div>

            <div className="mt-1">
              <p className="text-sm text-white truncate">
                {conversation.summary || 'No summary available'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {conversation.messages?.length || 0} messages
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Audio player component
const AudioPlayer: React.FC<{ audioUrl: string }> = ({ audioUrl }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const { branding } = usePartnerBranding();
  const { primaryColor } = branding;

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      const handleEnded = () => setIsPlaying(false);
      audio.addEventListener('ended', handleEnded);
      return () => {
        audio.removeEventListener('ended', handleEnded);
      };
    }
  }, []);

  return (
    <div className="flex items-center space-x-2 mt-4">
      <button
        onClick={togglePlayPause}
        className="p-2 rounded-full"
        style={{ backgroundColor: `${primaryColor}20` }}
      >
        {isPlaying ? (
          <FiPause className="h-4 w-4" style={{ color: primaryColor }} />
        ) : (
          <FiPlay className="h-4 w-4" style={{ color: primaryColor }} />
        )}
      </button>
      <audio ref={audioRef} src={audioUrl} className="hidden" />
      <div className="text-sm text-gray-400">
        {isPlaying ? 'Playing audio...' : 'Play recording'}
      </div>
    </div>
  );
};

// Conversation detail component
const ConversationDetail: React.FC<{ conversation: Conversation }> = ({ conversation }) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'transcript'>('summary');
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { branding } = usePartnerBranding();
  const { primaryColor } = branding;

  // Fix recording URL: LiveKit saves .wav files as .wav.ogg
  const getRecordingUrl = (url: string | undefined) => {
    if (!url) return '';
    return url.endsWith('.wav') ? `${url}.ogg` : url;
  };

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Format duration in minutes and seconds
  const formatDuration = (startTime: string, endTime: string) => {
    if (!startTime || !endTime) return 'Unknown';

    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const durationSeconds = Math.round((end - start) / 1000);

    if (durationSeconds < 60) {
      return `${durationSeconds} seconds`;
    }

    const minutes = Math.floor(durationSeconds / 60);
    const seconds = durationSeconds % 60;
    return `${minutes} min${minutes !== 1 ? 's' : ''} ${seconds} sec${seconds !== 1 ? 's' : ''}`;
  };

  return (
    <div className="bg-gray-800/30 rounded-lg border border-gray-800 overflow-hidden">
      {/* Conversation metadata */}
      <div className="p-4 border-b border-gray-800">
        <h3 className="text-lg font-medium text-white mb-2">Conversation Summary</h3>
        <p className="text-sm text-gray-300">
          {conversation.summary || 'No summary available'}
        </p>

        {conversation.recordingUrl && (
          <div className="mt-4">
            <audio
              key={conversation.id}
              ref={audioRef}
              className="hidden"
              onEnded={() => setIsPlaying(false)}
            >
              <source src={getRecordingUrl(conversation.recordingUrl)} type="audio/ogg; codecs=opus" />
              <source src={getRecordingUrl(conversation.recordingUrl)} type="audio/ogg" />
              <source src={conversation.recordingUrl} type="audio/mpeg" />
              <source src={conversation.recordingUrl} type="audio/wav" />
              Your browser does not support the audio element.
            </audio>
            <button
              onClick={handlePlayPause}
              className="flex items-center space-x-2 px-3 py-2 rounded-lg text-white"
              style={{ backgroundColor: primaryColor }}
            >
              {isPlaying ? (
                <>
                  <FiPause className="h-4 w-4" />
                  <span>Pause Recording</span>
                </>
              ) : (
                <>
                  <FiPlay className="h-4 w-4" />
                  <span>Play Recording</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        <button
          className={`flex-1 py-3 text-sm font-medium ${activeTab === 'summary' ? 'text-white border-b-2' : 'text-gray-400 hover:text-gray-300'}`}
          style={{ borderColor: activeTab === 'summary' ? primaryColor : 'transparent' }}
          onClick={() => setActiveTab('summary')}
        >
          Summary
        </button>
        <button
          className={`flex-1 py-3 text-sm font-medium ${activeTab === 'transcript' ? 'text-white border-b-2' : 'text-gray-400 hover:text-gray-300'}`}
          style={{ borderColor: activeTab === 'transcript' ? primaryColor : 'transparent' }}
          onClick={() => setActiveTab('transcript')}
        >
          Transcript
        </button>
      </div>

      {/* Tab content */}
      <div className="p-4 max-h-[calc(100vh-400px)] overflow-y-auto">
        {activeTab === 'summary' ? (
          <div>
            <h4 className="text-sm font-medium text-white mb-2">Details</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Date</span>
                <span className="text-white">
                  {new Date(conversation.createdAt || conversation.startedAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Time</span>
                <span className="text-white">
                  {new Date(conversation.createdAt || conversation.startedAt).toLocaleTimeString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Duration</span>
                <span className="text-white">
                  {formatDuration(conversation.startedAt, conversation.endedAt)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Status</span>
                <span className="text-white capitalize">{conversation.status || 'completed'}</span>
              </div>
              {conversation.cost !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Cost</span>
                  <span className="text-white">${conversation.cost.toFixed(4)}</span>
                </div>
              )}
              {conversation.endedReason && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Ended Reason</span>
                  <span className="text-white capitalize">{conversation.endedReason.replace(/-/g, ' ')}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {conversation.messages && conversation.messages.length > 0 ? (
              conversation.messages.filter(msg => msg.role !== 'system').map((message, index) => {
                const isUser = message.role === 'user';
                return (
                  <div key={index} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${isUser
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-white'
                      }`}
                    >
                      <div className="text-xs text-gray-300 mb-1">
                        {isUser ? 'You' : 'Assistant'}
                      </div>
                      <div className="text-sm">{message.message}</div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center text-gray-400">
                {conversation.transcript ? (
                  <pre className="text-left whitespace-pre-wrap text-xs text-gray-300 p-3 bg-gray-800/50 rounded">
                    {conversation.transcript}
                  </pre>
                ) : (
                  'No transcript available'
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const AgentConversations: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>('7d');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paginationInfo, setPaginationInfo] = useState<PaginationInfo>({ hasMore: false, nextPaginationKey: null });
  // User context is needed for authentication in API calls
  const { user } = useUser();
  const { branding } = usePartnerBranding();
  const { primaryColor } = branding;

  // Define fetchAllAgents with useCallback
  const fetchAllAgents = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch both VAPI and Retell agents in parallel
      const [vapiResponse, retellResponse] = await Promise.all([
        fetch('/api/customer/vapi-agents'),
        fetch('/api/customer/retell-agents')
      ]);

      let vapiAgents: Agent[] = [];
      let retellAgents: Agent[] = [];

      // Process VAPI agents
      if (vapiResponse.ok) {
        const vapiData = await vapiResponse.json();
        vapiAgents = vapiData.map((agent: any) => ({
          ...agent,
          agentType: 'vapi' // Add agent type to distinguish
        }));
      } else {
        console.error('Failed to fetch VAPI agents:', vapiResponse.status);
      }

      // Process Retell agents
      if (retellResponse.ok) {
        const retellData = await retellResponse.json();
        retellAgents = retellData.map((agent: any) => ({
          ...agent,
          agentType: 'retell' // Add agent type to distinguish
        }));
      } else {
        console.error('Failed to fetch Retell agents:', retellResponse.status);
      }

      // Combine all agents
      const allAgents = [...vapiAgents, ...retellAgents];
      setAgents(allAgents);

      // If we have agents but none selected, select the first one
      if (allAgents.length > 0 && !selectedAgent) {
        setSelectedAgent(allAgents[0]);
      }

      // If the previously selected agent is not in the new list, select the first one
      if (selectedAgent && !allAgents.find((a: Agent) => a.id === selectedAgent.id)) {
        setSelectedAgent(allAgents.length > 0 ? allAgents[0] : null);
        setConversations([]);
      }
    } catch (error) {
      console.error('Error fetching agents:', error);
      setError('An unexpected error occurred. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedAgent]);

  // Define fetchConversations with useCallback
  const fetchConversations = useCallback(async (agentId: string, period: string, paginationKey?: string, append: boolean = false) => {
    try {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }

      // Get the agent type from the selected agent
      const agentType = selectedAgent?.agentType || 'vapi';

      // Build the URL with query parameters
      let url = `/api/customer/conversations?agentId=${agentId}&period=${period}`;
      if (paginationKey) {
        url += `&pagination_key=${paginationKey}`;
      }

      // Fetch fresh data
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch conversations: ${response.status}`);
      }

      const responseData = await response.json();

      // Check if the response has the expected structure
      if (!responseData || (typeof responseData === 'object' && !responseData.data)) {
        console.error(`Error fetching conversations: Invalid response format`, responseData);
        if (!append) {
          setConversations([]);
        }
        return;
      }

      // Get the actual data array from the response
      const data = responseData.data || [];

      // Update pagination info if available
      if (responseData.pagination) {
        setPaginationInfo({
          hasMore: responseData.pagination.hasMore || false,
          nextPaginationKey: responseData.pagination.nextPaginationKey || null
        });
      } else {
        setPaginationInfo({ hasMore: false, nextPaginationKey: null });
      }

      // Process the data based on agent type
      let processedData: Conversation[] = [];

      if (agentType === 'vapi') {
        // Process VAPI data
        processedData = Array.isArray(data) ? data.map((conv: any) => {
          // Ensure we have a valid messages array
          let messages = conv.messages || [];

          // If we have a transcript but no messages, try to parse the transcript
          if ((!messages || messages.length === 0) && conv.transcript) {
            try {
              // Simple parsing of transcript into messages
              const lines = conv.transcript.split('\n');
              messages = lines.map((line: string, index: number) => {
                const isUserLine = line.startsWith('Customer:') || line.startsWith('User:');
                return {
                  role: isUserLine ? 'user' : 'assistant',
                  message: line.replace(/^(Customer:|User:|Assistant:|AI:)\s*/, ''),
                  time: new Date(conv.startedAt).getTime() / 1000 + index * 30, // Approximate time
                };
              }).filter(Boolean); // Filter out any null values
            } catch (e) {
              console.error('Error parsing transcript:', e);
              messages = [];
            }
          }

          // Extract summary from analysis if available
          const summary = conv.analysis?.summary || conv.summary || '';

          return {
            ...conv,
            summary: summary,
            messages: messages.map((msg: any) => ({
              ...msg,
              // Ensure we have a valid time
              time: msg.time || new Date(conv.startedAt).getTime() / 1000,
            })),
          };
        }) : [];
      } else if (agentType === 'retell') {
        // Process Retell data
        processedData = Array.isArray(data) ? data.map((conv: any) => {
          // Map Retell data to our Conversation interface
          const startTime = conv.start_timestamp ? new Date(conv.start_timestamp) : new Date();
          const endTime = conv.end_timestamp ? new Date(conv.end_timestamp) : new Date();

          // Extract messages from Retell format
          let messages = [];
          if (conv.transcript_object && Array.isArray(conv.transcript_object)) {
            messages = conv.transcript_object.map((item: any) => ({
              role: item.role === 'user' ? 'user' : 'assistant',
              message: item.content || '',
              time: item.words && item.words.length > 0 ? item.words[0].start : 0,
            }));
          } else if (conv.transcript && typeof conv.transcript === 'string') {
            // Fallback to parsing the plain transcript if transcript_object is not available
            const lines = conv.transcript.split('\n');
            messages = lines.map((line: string, index: number) => {
              const isUserLine = line.startsWith('User:');
              const isAgentLine = line.startsWith('Agent:');
              if (isUserLine || isAgentLine) {
                return {
                  role: isUserLine ? 'user' : 'assistant',
                  message: line.replace(/^(User:|Agent:)\s*/, '').trim(),
                  time: index * 5, // Approximate time
                };
              }
              return null;
            }).filter(Boolean);
          }

          // Extract summary from call_analysis if available
          const summary = conv.call_analysis?.call_summary ||
                         conv.call_analysis?.summary ||
                         'No summary available';

          return {
            id: conv.call_id || '',
            assistantId: conv.agent_id || '',
            type: 'call',
            startedAt: startTime.toISOString(),
            endedAt: endTime.toISOString(),
            transcript: conv.transcript || '',
            recordingUrl: conv.recording_url || '',
            summary: summary,
            createdAt: startTime.toISOString(),
            updatedAt: endTime.toISOString(),
            cost: typeof conv.call_cost?.combined_cost === 'number' ? conv.call_cost.combined_cost / 100 : 0, // Convert to dollars
            status: conv.call_status === 'ended' ? 'completed' : 'failed',
            endedReason: conv.disconnection_reason || '',
            messages: messages,
          };
        }) : [];
      }

      // If appending, combine with existing conversations
      if (append) {
        setConversations(prevConversations => [...prevConversations, ...processedData]);
      } else {
        setConversations(processedData);

        // If we have conversations but none selected, select the first one
        if (processedData.length > 0 && !selectedConversation) {
          setSelectedConversation(processedData[0]);
        }
      }
    } catch (error) {
      console.error(`Error fetching conversations:`, error);
      setError('An unexpected error occurred. Please try again later.');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [selectedAgent, selectedConversation]);

  // Fetch agents on component mount
  useEffect(() => {
    fetchAllAgents();
  }, [fetchAllAgents]);

  // Fetch conversations when agent or period changes
  useEffect(() => {
    if (selectedAgent) {
      // Reset pagination info when changing agent or time range
      setPaginationInfo({ hasMore: false, nextPaginationKey: null });
      fetchConversations(selectedAgent.id, selectedTimeRange);
    }
  }, [selectedAgent, selectedTimeRange, fetchConversations]);

  // Function to load more conversations
  const handleLoadMore = useCallback(() => {
    if (selectedAgent && paginationInfo.nextPaginationKey) {
      fetchConversations(selectedAgent.id, selectedTimeRange, paginationInfo.nextPaginationKey, true);
    }
  }, [selectedAgent, selectedTimeRange, paginationInfo.nextPaginationKey, fetchConversations]);

  const handleAgentSelect = (agent: Agent) => {
    setSelectedAgent(agent);
    setSelectedConversation(null);
  };

  const handleConversationSelect = (conversation: Conversation) => {
    setSelectedConversation(conversation);
  };

  if (isLoading && !conversations.length) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: primaryColor }}></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 p-4 bg-red-500/10 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="w-full bg-gray-900 rounded-xl overflow-hidden shadow-xl">
      <div className="flex flex-col md:flex-row h-full">
        {/* Agents sidebar */}
        <div className="w-full md:w-1/4 border-r border-gray-800 p-4">
          <h2 className="text-lg font-medium text-white mb-4">Agents</h2>
          <div className="space-y-2 max-h-[calc(100vh-250px)] overflow-y-auto pr-2">
            {agents.length === 0 ? (
              <div className="text-center p-4 text-gray-400">
                No agents found
              </div>
            ) : (
              agents.map((agent) => (
                <div
                  key={agent.id}
                  onClick={() => handleAgentSelect(agent)}
                  className={`p-3 rounded-lg cursor-pointer transition-all flex items-center ${
                    selectedAgent?.id === agent.id
                      ? 'bg-opacity-20 border'
                      : 'hover:bg-gray-800'
                  }`}
                  style={{
                    backgroundColor: selectedAgent?.id === agent.id ? `${primaryColor}20` : '',
                    borderColor: selectedAgent?.id === agent.id ? primaryColor : ''
                  }}
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mr-3"
                       style={{ backgroundColor: `${primaryColor}30` }}>
                    {agent.agentType === 'vapi' ? (
                      <FiPhoneCall className="w-4 h-4" style={{ color: primaryColor }} />
                    ) : (
                      <FiMessageSquare className="w-4 h-4" style={{ color: primaryColor }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {agent.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {agent.agentType === 'vapi' ? 'Voice AI' : 'Retell AI'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Conversations list */}
        <div className="w-full md:w-1/3 border-r border-gray-800 p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-white">Conversations</h2>

            <div className="relative">
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-gray-800 text-gray-200 hover:bg-gray-700 transition-colors text-xs"
              >
                <FiFilter className="h-3 w-3" />
                <span>{selectedTimeRange === '7d' ? 'Last 7 Days' : selectedTimeRange === '30d' ? 'Last 30 Days' : 'All Time'}</span>
                <FiChevronDown className="h-3 w-3" />
              </button>

              {showFilterDropdown && (
                <div className="absolute right-0 mt-2 w-40 bg-gray-800 rounded-lg shadow-lg z-10 border border-gray-700">
                  <div className="py-1">
                    {['7d', '30d', 'all'].map((range) => (
                      <button
                        key={range}
                        className="w-full text-left px-4 py-2 text-xs text-gray-200 hover:bg-gray-700"
                        onClick={() => {
                          setSelectedTimeRange(range);
                          setShowFilterDropdown(false);
                        }}
                      >
                        {range === '7d' ? 'Last 7 Days' : range === '30d' ? 'Last 30 Days' : 'All Time'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {selectedAgent ? (
            <>
              <ConversationList
                conversations={conversations}
                onSelect={handleConversationSelect}
                selectedConversation={selectedConversation}
              />

              {/* Pagination - Load More button */}
              {paginationInfo.hasMore && (
                <div className="mt-4 text-center">
                  <button
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="px-4 py-2 text-sm rounded-lg transition-colors"
                    style={{
                      backgroundColor: isLoadingMore ? `${primaryColor}50` : primaryColor,
                      color: 'white',
                      opacity: isLoadingMore ? 0.7 : 1
                    }}
                  >
                    {isLoadingMore ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                        Loading...
                      </div>
                    ) : (
                      'Load More'
                    )}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center p-4 text-gray-400">
              Select an agent to view conversations
            </div>
          )}
        </div>

        {/* Conversation details */}
        <div className="w-full md:w-5/12 p-4">
          <h2 className="text-lg font-medium text-white mb-4">Conversation Details</h2>
          {selectedConversation ? (
            <ConversationDetail conversation={selectedConversation} />
          ) : (
            <div className="text-center p-4 text-gray-400">
              Select a conversation to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentConversations;
