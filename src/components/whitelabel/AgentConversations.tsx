'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FiMessageSquare, FiPlay, FiPause, FiChevronDown, FiInbox, FiDownload, FiPhone, FiArrowDownLeft, FiArrowUpRight, FiFilter, FiX } from 'react-icons/fi';
import { usePartnerBranding } from '@/lib/partnerBranding';
import AnalyticsServiceAgentConversations from './AnalyticsServiceAgentConversations';

// Check if we should use analytics service
const USE_ANALYTICS_SERVICE = process.env.NEXT_PUBLIC_USE_ANALYTICS_SERVICE_WHITELABEL_CONVERSATIONS === 'true';

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

// Helper function to get time ago
const getTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'about 1 hour ago';
  } else if (diffInSeconds < 3600) {
    return 'about 5 hours ago';
  } else if (diffInSeconds < 86400) {
    return 'about 10 hours ago';
  } else if (diffInSeconds < 604800) {
    return 'about 20 hours ago';
  } else {
    return 'about 20 hours ago';
  }
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
Duration: ${formatDurationForDownload(conversation.startedAt, conversation.endedAt)}
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

// Helper function for formatting duration in downloads
const formatDurationForDownload = (startTime: string, endTime: string) => {
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

// Format duration from seconds (for conversation.duration field)
const formatDurationFromSeconds = (durationInSeconds: number) => {
  if (!durationInSeconds || durationInSeconds <= 0) return '0:00';

  if (durationInSeconds < 60) {
    return `0:${durationInSeconds.toString().padStart(2, '0')}`;
  }

  const minutes = Math.floor(durationInSeconds / 60);
  const seconds = Math.round(durationInSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// Format duration in minutes and seconds (from start/end times)
const formatDuration = (startTime: string, endTime: string) => {
  if (!startTime || !endTime) return 'Unknown';

  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const durationSeconds = Math.round((end - start) / 1000);

  if (durationSeconds < 60) {
    return `${durationSeconds}s`;
  }

  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// Define types with proper type safety
interface Agent {
  id: string;
  name: string;
  customerId?: string;
  agentType: AgentType;
}

// Define agent types for future extensibility
type AgentType = 'vapi' | 'elevenlabs' | 'retell' | 'knotie-ai' | 'n8n_chat' | 'retell_chat';

// Define pagination interface
interface PaginationInfo {
  hasMore: boolean;
  nextPaginationKey: string | null;
  totalCount?: number;
}

interface Conversation {
  id: string;
  assistantId: string;
  type: string;
  startedAt: string;
  endedAt: string;
  transcript: string | any[]; // Can be string (VAPI/Retell) or array (ElevenLabs)
  recordingUrl?: string;
  stereoRecordingUrl?: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
  cost: number;
  status: string;
  endedReason: string;
  messages: Message[];
  duration?: number; // Duration in seconds
  // New fields for call direction and phone numbers
  direction?: string; // 'inbound' | 'outbound'
  fromNumber?: string;
  toNumber?: string;
  callType?: string; // 'phone_call' | 'web_call'
  // AI metadata from analytics service
  ai_metadata?: {
    sentiment_score?: number;
    outcome?: string;
    intent?: string;
    follow_up_needed?: boolean;
    customer_name?: string;
    customer_status?: string;
    conversion_signal?: string;
    booking_made?: boolean;
    topics?: string[];
  };
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
        // Format date to be more readable - prioritize actual call start time
        const date = new Date(conversation.startedAt || conversation.createdAt);
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

// Audio player component is used within the ConversationDetail component
// This is kept for reference but commented out to avoid unused component warnings
/*
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
*/

// Conversation detail component
const ConversationDetail: React.FC<{ conversation: Conversation }> = ({ conversation }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { branding } = usePartnerBranding();
  const { primaryColor } = branding;

  // Fix recording URL: LiveKit saves .wav files as .wav.ogg
  const getRecordingUrl = (url: string | undefined) => {
    if (!url) return '';
    // If URL ends with .wav, append .ogg (LiveKit behavior)
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





  // Helper function to check if summary is meaningful
  const hasMeaningfulSummary = (summary: string | undefined) => {
    if (!summary) return false;
    const trimmedSummary = summary.trim().toLowerCase();
    // Check if summary is empty or has hardcoded/default values
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

  return (
    <div className="space-y-6">
      {/* AI Summary Section - Only show if meaningful summary exists */}
      {hasMeaningfulSummary(conversation.summary) && (
        <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700/50">
          <h3 className="text-lg font-semibold text-white mb-3">AI Summary</h3>
          <p className="text-gray-300 leading-relaxed">
            {conversation.summary}
          </p>
        </div>
      )}

      {/* Conversation Transcript Section */}
      <div className="bg-gray-800/50 rounded-lg border border-gray-700/50 overflow-hidden">
        <div className="p-4 border-b border-gray-700/50 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Conversation Transcript</h3>
          <button
            onClick={() => downloadTranscript(conversation)}
            className="flex items-center space-x-2 px-3 py-2 rounded-lg text-gray-300 hover:text-white bg-gray-700/50 hover:bg-gray-700 transition-colors text-sm"
          >
            <FiDownload className="h-4 w-4" />
            <span>Download</span>
          </button>
        </div>

        {/* Chat Messages */}
        <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
          {conversation.messages && conversation.messages.length > 0 ? (
            conversation.messages.filter(msg => msg.role !== 'system').map((message, index) => {
              const isUser = message.role === 'user';
              return (
                <div key={index} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div className="flex items-start space-x-3 max-w-[80%]">
                    {!isUser && (
                      <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-medium text-white">AI</span>
                      </div>
                    )}
                    <div
                      className={`rounded-lg p-3 ${isUser
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-white'
                      }`}
                      style={isUser ? { backgroundColor: primaryColor } : {}}
                    >
                      <div className="text-xs text-gray-300 mb-1">
                        {isUser ? 'Customer' : 'AI Assistant'}
                      </div>
                      <div className="text-sm leading-relaxed">{message.message}</div>
                    </div>
                    {isUser && (
                      <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-medium text-white">U</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center text-gray-400 py-8">
              {conversation.transcript ? (
                <pre className="text-left whitespace-pre-wrap text-sm text-gray-300 p-4 bg-gray-800/50 rounded-lg">
                  {conversation.transcript}
                </pre>
              ) : (
                'No transcript available'
              )}
            </div>
          )}
        </div>
      </div>

      {/* Call Recording Section */}
      {conversation.recordingUrl && (
        <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700/50">
          <h3 className="text-lg font-semibold text-white mb-4">Call Recording</h3>
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
          <div className="flex items-center space-x-4">
            <button
              onClick={handlePlayPause}
              className="w-12 h-12 rounded-full flex items-center justify-center text-white transition-colors"
              style={{ backgroundColor: primaryColor }}
            >
              {isPlaying ? (
                <FiPause className="h-5 w-5" />
              ) : (
                <FiPlay className="h-5 w-5 ml-1" />
              )}
            </button>
            <div className="flex-1">
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div className="bg-gray-500 h-2 rounded-full" style={{ width: '0%' }}></div>
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>0:00</span>
                <span>{formatDuration(conversation.startedAt, conversation.endedAt)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Conversation Information Section */}
      <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700/50">
        <h3 className="text-lg font-semibold text-white mb-4">
          {conversation.type === 'chat' || conversation.type === 'chat_conversation' ? 'Chat Information' : 'Call Information'}
        </h3>

        {/* Date and Duration */}
        <div className="flex items-center space-x-6 mb-4 text-sm">
          <div className="flex items-center space-x-2 text-gray-400">
            <div className="w-4 h-4 rounded-full bg-gray-600"></div>
            <span>{new Date(conversation.startedAt || conversation.createdAt).toLocaleDateString('en-US', {
              month: '2-digit',
              day: '2-digit',
              year: 'numeric'
            })}, {new Date(conversation.startedAt || conversation.createdAt).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            })}</span>
          </div>
          <div className="flex items-center space-x-2 text-gray-400">
            {conversation.type === 'chat' || conversation.type === 'chat_conversation' ? (
              <FiMessageSquare className="h-4 w-4" />
            ) : (
              <FiPhone className="h-4 w-4" />
            )}
            <span>{formatDuration(conversation.startedAt, conversation.endedAt)}</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="px-2 py-1 rounded text-xs font-medium bg-green-900/30 text-green-400 border border-green-700/50">
              {conversation.status === 'analyzed' ? 'Analyzed' : 'Completed'}
            </div>
          </div>
        </div>

        {/* Chat-specific info */}
        {(conversation.type === 'chat' || conversation.type === 'chat_conversation') ? (
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-sm text-gray-400 mb-2">Type</div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center">
                  <FiMessageSquare className="h-4 w-4 text-white" />
                </div>
                <span className="text-white font-medium">Chat Conversation</span>
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-2">Messages</div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center">
                  <span className="text-xs font-medium text-white">{conversation.messages?.length || 0}</span>
                </div>
                <span className="text-white font-medium">{conversation.messages?.length || 0} messages</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Phone Numbers and Direction (voice only) */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-sm text-gray-400 mb-2">Caller</div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                    <FiArrowUpRight className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-white font-medium">
                    {conversation.fromNumber || '+44 ******7890'}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-400 mb-2">Receiver</div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                    <FiPhone className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-white font-medium">
                    {conversation.toNumber || '+1 ******1223'}
                  </span>
                </div>
              </div>
            </div>

            {/* Direction and Agent */}
            <div className="grid grid-cols-2 gap-6 mt-6">
              <div>
                <div className="text-sm text-gray-400 mb-2">Direction</div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                    {conversation.direction === 'inbound' ? (
                      <FiArrowDownLeft className="h-4 w-4 text-white" />
                    ) : (
                      <FiArrowUpRight className="h-4 w-4 text-white" />
                    )}
                  </div>
                  <span className="text-white font-medium capitalize">
                    {conversation.direction || 'Outbound Call'}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-400 mb-2">Agent</div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                    <span className="text-xs font-medium text-white">
                      {conversation.callType === 'phone_call' ? 'V' : 'W'}
                    </span>
                  </div>
                  <span className="text-white font-medium">
                    {conversation.callType === 'phone_call' ? 'VAPI' : 'Web Agent'}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// AI filter state interface
interface AIFilters {
  outcome: string;
  intent: string;
  sentiment_min: string;
  follow_up_needed: string;
  conversion_signal: string;
}

const EMPTY_AI_FILTERS: AIFilters = {
  outcome: '',
  intent: '',
  sentiment_min: '',
  follow_up_needed: '',
  conversion_signal: '',
};

const AgentConversations: React.FC = () => {
  // All hooks must be called at the top level
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
  const { branding } = usePartnerBranding();
  const { primaryColor } = branding;

  // AI filter state
  const [aiFilters, setAiFilters] = useState<AIFilters>(EMPTY_AI_FILTERS);
  const [showAiFilters, setShowAiFilters] = useState(false);

  const hasActiveAiFilters = Object.values(aiFilters).some(v => v !== '');

  const clearAiFilters = () => {
    setAiFilters(EMPTY_AI_FILTERS);
  };

  // Define fetchAllAgents with useCallback
  const fetchAllAgents = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('Fetching agents for whitelabel portal...');

      // Use the unified agents endpoint that includes all agent types
      const agentsResponse = await fetch('/api/whitelabel/agents');

      let allAgents: Agent[] = [];

      if (agentsResponse.ok) {
        const agentsData = await agentsResponse.json();
        console.log('All agents fetched:', agentsData);
        allAgents = (agentsData.agents || []).map((agent: any) => ({
          ...agent,
          agentType: agent.type // Use the type from the API response
        }));
      } else {
        console.error('Failed to fetch agents:', agentsResponse.status);
        // Try to get error details
        try {
          const errorData = await agentsResponse.json();
          console.error('Agents error details:', errorData);
        } catch (e) {
          console.error('Could not parse agents error response');
        }
      }

      console.log('All agents:', allAgents);
      setAgents(allAgents);

      // If we have agents but none selected, select the first one
      if (allAgents.length > 0 && !selectedAgent) {
        console.log('Auto-selecting first agent:', allAgents[0]);
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
      console.log(`Fetching conversations for agent ${agentId} (type: ${agentType}), period: ${period}`);

      // Build AI filter query string
      const aiFilterParams = new URLSearchParams();
      if (aiFilters.outcome) aiFilterParams.set('outcome', aiFilters.outcome);
      if (aiFilters.intent) aiFilterParams.set('intent', aiFilters.intent);
      if (aiFilters.sentiment_min) aiFilterParams.set('sentiment_min', aiFilters.sentiment_min);
      if (aiFilters.follow_up_needed) aiFilterParams.set('follow_up_needed', aiFilters.follow_up_needed);
      if (aiFilters.conversion_signal) aiFilterParams.set('conversion_signal', aiFilters.conversion_signal);
      // Always request AI metadata when any filter is active
      if (hasActiveAiFilters) aiFilterParams.set('include_ai_metadata', 'true');
      const aiFilterStr = aiFilterParams.toString() ? `&${aiFilterParams.toString()}` : '';

      // For chat agents (N8N Chat, Retell Chat), use analytics service endpoint directly
      let url;
      if (agentType === 'n8n_chat' || agentType === 'retell_chat') {
        url = `/api/whitelabel/analytics/conversations?agentId=${agentId}&period=${period}${aiFilterStr}`;
        if (paginationKey) {
          url += `&pagination_key=${paginationKey}`;
        }
      } else {
        // Build the URL with query parameters for voice agents
        url = `/api/whitelabel/conversations?agentId=${agentId}&period=${period}&agentType=${agentType}${aiFilterStr}`;
        if (paginationKey) {
          url += `&pagination_key=${paginationKey}`;
        }
      }
      console.log('Conversations API URL:', url);

      // Fetch fresh data
      const response = await fetch(url);

      if (!response.ok) {
        console.error(`Failed to fetch conversations: ${response.status}`);
        // Try to get error details
        try {
          const errorData = await response.json();
          console.error('Conversations error details:', errorData);
        } catch (e) {
          console.error('Could not parse error response');
        }
        throw new Error(`Failed to fetch conversations: ${response.status}`);
      }

      const responseData = await response.json();
      console.log('Conversations API response:', responseData);

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

        // Log pagination details
        if (responseData.pagination.totalFetched) {
          console.log(`Pagination details: Total fetched: ${responseData.pagination.totalFetched}, Pages processed: ${responseData.pagination.pagesProcessed || 1}`);
        }
      } else {
        setPaginationInfo({ hasMore: false, nextPaginationKey: null });
      }

      // Process the data based on agent type
      let processedData: Conversation[] = [];

      console.log(`Processing ${data.length} conversations for agent type: ${agentType}`);

      if (agentType === 'n8n_chat' || agentType === 'retell_chat') {
        // Process chat data (from analytics service - N8N Chat and Retell Chat)
        console.log(`Processing ${agentType} conversations`);
        processedData = Array.isArray(data) ? data.map((conv: any) => {
          // N8N Chat conversations from analytics service should already be in the right format
          const processedConv = {
            ...conv,
            // Ensure we have the required fields
            id: conv.id || conv.conversation_id,
            assistantId: conv.assistantId || conv.agent_id,
            type: 'chat',
            startedAt: conv.startedAt || conv.created_at || new Date().toISOString(),
            endedAt: conv.endedAt || conv.updated_at || conv.startedAt || conv.created_at || new Date().toISOString(),
            transcript: conv.transcript || '',
            summary: conv.summary || 'No summary available',
            messages: conv.messages || [],
            cost: conv.cost || 0,
            status: conv.status || 'completed',
            endedReason: conv.endedReason || 'completed',
            createdAt: conv.createdAt || conv.created_at || new Date().toISOString(),
            updatedAt: conv.updatedAt || conv.updated_at || new Date().toISOString(),
          };

          console.log('Processed N8N Chat conversation:', {
            id: processedConv.id,
            summary: processedConv.summary?.substring(0, 50) + '...',
            messageCount: processedConv.messages?.length || 0
          });

          return processedConv;
        }) : [];
      } else if (agentType === 'vapi') {
        // Process VAPI data
        console.log('Processing VAPI conversations');
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

          const processedConv = {
            ...conv,
            summary: summary,
            messages: messages.map((msg: any) => ({
              ...msg,
              // Ensure we have a valid time
              time: msg.time || new Date(conv.startedAt).getTime() / 1000,
            })),
          };

          console.log('Processed VAPI conversation:', {
            id: processedConv.id,
            summary: processedConv.summary?.substring(0, 50) + '...',
            messageCount: processedConv.messages?.length || 0
          });

          return processedConv;
        }) : [];
      } else if (agentType === 'retell') {
        // Process Retell data
        console.log('Processing Retell conversations');
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

          const processedConv = {
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

          console.log('Processed Retell conversation:', {
            id: processedConv.id,
            summary: processedConv.summary?.substring(0, 50) + '...',
            messageCount: processedConv.messages?.length || 0
          });

          return processedConv;
        }) : [];
      }

      // If appending, combine with existing conversations
      if (append) {
        console.log(`Appending ${processedData.length} conversations to existing ${conversations.length} conversations`);
        setConversations(prevConversations => [...prevConversations, ...processedData]);
      } else {
        console.log(`Setting ${processedData.length} conversations`);
        setConversations(processedData);

        // If we have conversations but none selected, select the first one
        if (processedData.length > 0 && !selectedConversation) {
          console.log('Auto-selecting first conversation:', processedData[0].id);
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
  }, [selectedAgent, selectedConversation, selectedTimeRange, aiFilters, hasActiveAiFilters]);

  // Load agents when component mounts
  useEffect(() => {
    fetchAllAgents();
  }, [fetchAllAgents]);

  // Load conversations when selected agent or time range changes
  useEffect(() => {
    if (selectedAgent) {
      fetchConversations(selectedAgent.id, selectedTimeRange);
    }
  }, [selectedAgent, selectedTimeRange, fetchConversations]);

  // Check if we should use analytics service
  console.log('🔍 USE_ANALYTICS_SERVICE:', USE_ANALYTICS_SERVICE);
  if (USE_ANALYTICS_SERVICE) {
    console.log('✅ Using AnalyticsServiceAgentConversations component');
    return <AnalyticsServiceAgentConversations />;
  }
  console.log('❌ Using legacy AgentConversations component');

  // Handle agent selection
  const handleAgentSelect = (agent: Agent) => {
    console.log('Selected agent:', agent);
    setSelectedAgent(agent);
    setSelectedConversation(null);
    setConversations([]);
  };

  // Handle conversation selection
  const handleConversationSelect = (conversation: Conversation) => {
    setSelectedConversation(conversation);
  };

  // Handle loading more conversations
  const handleLoadMore = () => {
    if (selectedAgent && paginationInfo.hasMore && paginationInfo.nextPaginationKey) {
      console.log(`Loading more conversations with pagination key: ${paginationInfo.nextPaginationKey}`);
      fetchConversations(selectedAgent.id, selectedTimeRange, paginationInfo.nextPaginationKey, true);
    } else {
      console.log('Cannot load more conversations:', {
        hasSelectedAgent: !!selectedAgent,
        hasMore: paginationInfo.hasMore,
        hasPaginationKey: !!paginationInfo.nextPaginationKey
      });
    }
  };

  // Time range options
  const timeRangeOptions = [
    { value: '1d', label: 'Last 24 hours' },
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' }
  ];

  // If loading and no agents, show loading state
  if (isLoading && agents.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading conversations...</div>
      </div>
    );
  }

  // If no agents, show empty state
  if (agents.length === 0) {
    return (
      <div className="bg-gray-800/30 rounded-lg p-8 text-center">
        <h2 className="text-xl font-semibold text-white mb-4">No AI Agents Found</h2>
        <p className="text-gray-400 mb-4">You don't have any AI agents assigned to your account yet.</p>
        <p className="text-gray-500">Contact your partner to get AI agents assigned.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
      {/* Left side - Conversation Details */}
      <div className="lg:col-span-2">
        {selectedConversation ? (
          <ConversationDetail conversation={selectedConversation} />
        ) : (
          <div className="bg-gray-800/50 rounded-lg border border-gray-700/50 p-8 text-center h-full flex flex-col items-center justify-center">
            <FiMessageSquare className="h-12 w-12 text-gray-500 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No conversation selected</h3>
            <p className="text-gray-400">Select a conversation from the history to view details</p>
          </div>
        )}
      </div>

      {/* Right side - Call History */}
      <div className="lg:col-span-1">
        <div className="bg-gray-800/50 rounded-lg border border-gray-700/50 h-full flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-700/50">
            <h3 className="text-lg font-semibold text-white mb-1">Call History</h3>
            <p className="text-sm text-gray-400">Review and analyze conversations</p>
          </div>

          {/* Filters */}
          <div className="p-4 border-b border-gray-700/50 space-y-3">
            {/* Agent selector */}
            <div className="relative">
              <select
                value={selectedAgent?.id || ''}
                onChange={(e) => {
                  const agent = agents.find(a => a.id === e.target.value);
                  if (agent) handleAgentSelect(agent);
                }}
                className="w-full bg-gray-700/50 border border-gray-600 text-white rounded-lg px-3 py-2 pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-opacity-50 text-sm"
              >
                <option value="">All Agents</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                <FiChevronDown className="h-4 w-4" />
              </div>
            </div>

            {/* Time range filter */}
            <div className="relative">
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="w-full flex items-center justify-between bg-gray-700/50 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm"
              >
                <span>{timeRangeOptions.find(o => o.value === selectedTimeRange)?.label || 'Last 24h'}</span>
                <FiChevronDown className="h-4 w-4" />
              </button>

              {showFilterDropdown && (
                <div className="absolute right-0 mt-2 w-full bg-gray-800 rounded-md shadow-lg py-1 z-10 border border-gray-700">
                  {timeRangeOptions.map((option) => (
                    <button
                      key={option.value}
                      className={`block w-full text-left px-4 py-2 text-sm ${
                        selectedTimeRange === option.value ? 'text-white bg-gray-700' : 'text-gray-300 hover:bg-gray-700'
                      }`}
                      onClick={() => {
                        setSelectedTimeRange(option.value);
                        setShowFilterDropdown(false);
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* AI Filter toggle */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowAiFilters(!showAiFilters)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  hasActiveAiFilters
                    ? 'bg-indigo-900/40 text-indigo-300 border border-indigo-600/50'
                    : 'text-gray-400 border border-gray-600 hover:bg-gray-700/50'
                }`}
              >
                <FiFilter className="h-3 w-3" />
                AI Filters
                {hasActiveAiFilters && (
                  <span className="ml-1 w-4 h-4 rounded-full bg-indigo-500 text-white text-[10px] flex items-center justify-center">
                    {Object.values(aiFilters).filter(v => v !== '').length}
                  </span>
                )}
              </button>
              {hasActiveAiFilters && (
                <button
                  onClick={clearAiFilters}
                  className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
                >
                  <FiX className="h-3 w-3" /> Clear
                </button>
              )}
            </div>

            {/* AI Filter dropdowns */}
            {showAiFilters && (
              <div className="space-y-2 pt-1">
                {/* Outcome filter */}
                <select
                  value={aiFilters.outcome}
                  onChange={(e) => setAiFilters(prev => ({ ...prev, outcome: e.target.value }))}
                  className="w-full bg-gray-700/50 border border-gray-600 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1"
                  style={{ borderColor: aiFilters.outcome ? `${primaryColor}60` : undefined }}
                >
                  <option value="">All Outcomes</option>
                  <option value="successful">✅ Successful</option>
                  <option value="unsuccessful">❌ Unsuccessful</option>
                  <option value="escalated">⚠️ Escalated</option>
                  <option value="inconclusive">❓ Inconclusive</option>
                </select>

                {/* Intent filter */}
                <select
                  value={aiFilters.intent}
                  onChange={(e) => setAiFilters(prev => ({ ...prev, intent: e.target.value }))}
                  className="w-full bg-gray-700/50 border border-gray-600 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1"
                  style={{ borderColor: aiFilters.intent ? `${primaryColor}60` : undefined }}
                >
                  <option value="">All Intents</option>
                  <option value="inquiry">🔍 Inquiry</option>
                  <option value="complaint">😤 Complaint</option>
                  <option value="purchase">🛒 Purchase</option>
                  <option value="support">🛠️ Support</option>
                  <option value="booking">📅 Booking</option>
                  <option value="cancellation">🚫 Cancellation</option>
                  <option value="feedback">💬 Feedback</option>
                </select>

                {/* Sentiment filter */}
                <select
                  value={aiFilters.sentiment_min}
                  onChange={(e) => setAiFilters(prev => ({ ...prev, sentiment_min: e.target.value }))}
                  className="w-full bg-gray-700/50 border border-gray-600 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1"
                  style={{ borderColor: aiFilters.sentiment_min ? `${primaryColor}60` : undefined }}
                >
                  <option value="">Any Sentiment</option>
                  <option value="0.7">😊 Positive (≥0.7)</option>
                  <option value="0.4">😐 Neutral+ (≥0.4)</option>
                  <option value="0">😞 All incl. Negative</option>
                </select>

                {/* Follow-up filter */}
                <select
                  value={aiFilters.follow_up_needed}
                  onChange={(e) => setAiFilters(prev => ({ ...prev, follow_up_needed: e.target.value }))}
                  className="w-full bg-gray-700/50 border border-gray-600 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1"
                  style={{ borderColor: aiFilters.follow_up_needed ? `${primaryColor}60` : undefined }}
                >
                  <option value="">Follow-up: Any</option>
                  <option value="true">🔔 Needs Follow-up</option>
                  <option value="false">✅ No Follow-up</option>
                </select>

                {/* Conversion signal filter */}
                <select
                  value={aiFilters.conversion_signal}
                  onChange={(e) => setAiFilters(prev => ({ ...prev, conversion_signal: e.target.value }))}
                  className="w-full bg-gray-700/50 border border-gray-600 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1"
                  style={{ borderColor: aiFilters.conversion_signal ? `${primaryColor}60` : undefined }}
                >
                  <option value="">Conversion: Any</option>
                  <option value="ready_to_buy">🔥 Ready to Buy</option>
                  <option value="needs_more_info">ℹ️ Needs More Info</option>
                  <option value="not_interested">👎 Not Interested</option>
                </select>
              </div>
            )}
          </div>

          {/* Recent conversations header */}
          <div className="px-4 py-3 border-b border-gray-700/50">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-400">RECENT</span>
              <span className="text-xs text-gray-500">{conversations.length} TOTAL</span>
            </div>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {error ? (
              <div className="p-4">
                <div className="bg-red-900/20 border border-red-800 text-red-200 p-3 rounded-lg text-sm">
                  {error}
                </div>
              </div>
            ) : isLoading ? (
              <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gray-700 rounded-full"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-gray-700 rounded w-3/4"></div>
                        <div className="h-2 bg-gray-700 rounded w-1/2"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-center">
                <FiInbox className="h-8 w-8 text-gray-500 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">No conversations found</p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {conversations.map((conversation) => {
                  const date = new Date(conversation.startedAt || conversation.createdAt);
                  const timeAgo = getTimeAgo(date);
                  const isSelected = selectedConversation?.id === conversation.id;

                  return (
                    <div
                      key={conversation.id}
                      onClick={() => handleConversationSelect(conversation)}
                      className={`p-3 rounded-lg cursor-pointer transition-all border ${
                        isSelected
                          ? 'bg-blue-600/20 border-blue-500/50'
                          : 'border-transparent hover:bg-gray-700/30'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        {/* Type indicator - chat or voice direction */}
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          (conversation.type === 'chat' || conversation.type === 'chat_conversation')
                            ? 'bg-emerald-600'
                            : conversation.direction === 'inbound' ? 'bg-green-600' : 'bg-blue-600'
                        }`}>
                          {(conversation.type === 'chat' || conversation.type === 'chat_conversation') ? (
                            <FiMessageSquare className="h-4 w-4 text-white" />
                          ) : conversation.direction === 'inbound' ? (
                            <FiArrowDownLeft className="h-4 w-4 text-white" />
                          ) : (
                            <FiArrowUpRight className="h-4 w-4 text-white" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Time and status */}
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-400">{timeAgo}</span>
                            <div className="flex items-center space-x-1">
                              {conversation.callType === 'phone_call' && (
                                <FiPhone className="h-3 w-3 text-green-400" />
                              )}
                              <span className="text-xs text-gray-500">
                                {conversation.duration !== undefined ? formatDurationFromSeconds(conversation.duration) : formatDuration(conversation.startedAt, conversation.endedAt)}
                              </span>
                            </div>
                          </div>

                          {/* Summary */}
                          <p className="text-sm text-white mb-1 overflow-hidden" style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical'
                          }}>
                            {conversation.summary || 'No summary available'}
                          </p>

                          {/* Phone number */}
                          {conversation.fromNumber && (
                            <p className="text-xs text-gray-400">
                              📞 {conversation.fromNumber}
                            </p>
                          )}

                          {/* AI metadata badges */}
                          {conversation.ai_metadata && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {/* Sentiment dot */}
                              {conversation.ai_metadata.sentiment_score !== undefined && (
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                                  conversation.ai_metadata.sentiment_score >= 0.7
                                    ? 'bg-green-900/30 text-green-400'
                                    : conversation.ai_metadata.sentiment_score >= 0.4
                                    ? 'bg-yellow-900/30 text-yellow-400'
                                    : 'bg-red-900/30 text-red-400'
                                }`}>
                                  {conversation.ai_metadata.sentiment_score >= 0.7 ? '😊' : conversation.ai_metadata.sentiment_score >= 0.4 ? '😐' : '😞'}
                                  {' '}{(conversation.ai_metadata.sentiment_score * 100).toFixed(0)}%
                                </span>
                              )}
                              {/* Outcome badge */}
                              {conversation.ai_metadata.outcome && (
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                                  conversation.ai_metadata.outcome === 'successful' ? 'bg-green-900/30 text-green-400'
                                  : conversation.ai_metadata.outcome === 'escalated' ? 'bg-yellow-900/30 text-yellow-400'
                                  : conversation.ai_metadata.outcome === 'unsuccessful' ? 'bg-red-900/30 text-red-400'
                                  : 'bg-gray-700/50 text-gray-400'
                                }`}>
                                  {conversation.ai_metadata.outcome}
                                </span>
                              )}
                              {/* Intent tag */}
                              {conversation.ai_metadata.intent && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-indigo-900/30 text-indigo-300">
                                  {conversation.ai_metadata.intent}
                                </span>
                              )}
                              {/* Follow-up indicator */}
                              {conversation.ai_metadata.follow_up_needed && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-orange-900/30 text-orange-400">
                                  🔔 Follow-up
                                </span>
                              )}
                              {/* Conversion signal */}
                              {conversation.ai_metadata.conversion_signal === 'ready_to_buy' && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-900/30 text-emerald-400">
                                  🔥 Hot Lead
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Load more button */}
                {paginationInfo.hasMore && (
                  <div className="pt-3 text-center">
                    <button
                      onClick={handleLoadMore}
                      className="w-full px-4 py-2 text-sm text-white rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors"
                      disabled={isLoadingMore}
                    >
                      {isLoadingMore ? 'Loading...' : 'Load More'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentConversations;
