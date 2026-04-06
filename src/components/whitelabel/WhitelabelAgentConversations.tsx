'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { usePartnerBranding } from '@/lib/partnerBranding';
import { FiClock, FiPhone, FiMessageSquare, FiCalendar, FiChevronDown, FiChevronUp, FiDownload, FiRefreshCw, FiAlertCircle } from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';

interface Conversation {
  id: string;
  agentId: string;
  agentName: string;
  caller: string;
  duration: number;
  status: string;
  timestamp: string;
  transcript?: string;
  summary?: string;
  sentiment?: string;
}

interface AgentConversationsProps {
  agentId?: string;
  agentName?: string;
}

// Helper function to calculate duration from timestamps
const calculateDuration = (startTime: string | number, endTime: string | number): number => {
  if (!startTime || !endTime) return 0;

  const start = typeof startTime === 'string' ? new Date(startTime).getTime() : startTime;
  const end = typeof endTime === 'string' ? new Date(endTime).getTime() : endTime;

  return Math.floor((end - start) / 1000);
};

const WhitelabelAgentConversations: React.FC<AgentConversationsProps> = ({ agentId, agentName }) => {
  const { branding } = usePartnerBranding();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('7d');
  const [expandedConversation, setExpandedConversation] = useState<string | null>(null);

  // Check if analytics service is enabled for whitelabel conversations
  const useAnalyticsService = process.env.NEXT_PUBLIC_USE_ANALYTICS_SERVICE_WHITELABEL_CONVERSATIONS === 'true';

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {

      let response;

      if (useAnalyticsService) {
        // Use analytics service endpoint
        const queryParams = new URLSearchParams();
        if (agentId) {
          queryParams.append('agentId', agentId);
        }
        queryParams.append('period', period);

        response = await fetch(`/api/whitelabel/analytics-conversations?${queryParams.toString()}`);
      } else {
        // Use legacy API endpoint
        const queryParams = new URLSearchParams();
        if (agentId) {
          queryParams.append('agentId', agentId);
        }
        queryParams.append('period', period);

        response = await fetch(`/api/whitelabel/conversations?${queryParams.toString()}`);
      }

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.userFriendlyMessage ||
                            errorData.message ||
                            `Failed to fetch conversations: ${response.status}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (useAnalyticsService && data.data) {
        // Process analytics service data format
        const processedData = data.data.map((conv: any) => ({
          id: conv.id,
          agentId: conv.assistantId || conv.agentId,
          agentName: conv.agentName || 'Voice AI Assistant',
          caller: conv.phoneNumber || conv.caller || '+1 (xxx) xxx-xxxx',
          duration: conv.duration || calculateDuration(conv.startedAt, conv.endedAt),
          status: conv.status || 'completed',
          timestamp: conv.startedAt || conv.createdAt || new Date().toISOString(),
          transcript: conv.transcript || '',
          summary: conv.summary || 'No summary available',
          sentiment: conv.sentiment || 'neutral',
          messages: conv.messages || []
        }));

        setConversations(processedData);
      } else if (data.data) {
        // Process legacy API data based on the metadata
        const metadata = data.metadata || {};
        const agentType = metadata.agentType || 'unknown';

        if (agentType === 'vapi') {
          // Process VAPI data
          const processedData = data.data.map((conv: any) => {
            // Extract summary from analysis if available
            const summary = conv.analysis?.summary || conv.summary || 'No summary available';

            // Process messages if available
            let messages = conv.messages || [];
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
                }).filter(Boolean);
              } catch (e) {
                console.error('Error parsing transcript:', e);
                messages = [];
              }
            }

            return {
              id: conv.id,
              agentId: conv.assistantId,
              agentName: 'Voice AI Assistant',
              caller: conv.phoneNumber || '+1 (xxx) xxx-xxxx',
              duration: conv.duration || 0,
              status: conv.status || 'completed',
              timestamp: conv.createdAt || conv.startedAt || new Date().toISOString(),
              transcript: conv.transcript || '',
              summary: summary,
              sentiment: 'neutral',
              messages: messages
            };
          });

          setConversations(processedData);
        } else if (agentType === 'retell') {
          // Process Retell data
          const processedData = data.data.map((conv: any) => {
            // Extract summary from call_analysis if available
            const summary = conv.call_analysis?.call_summary ||
                           conv.call_analysis?.summary ||
                           'No summary available';

            // Calculate duration
            const startTime = conv.start_timestamp ? new Date(conv.start_timestamp) : new Date();
            const endTime = conv.end_timestamp ? new Date(conv.end_timestamp) : new Date();
            const durationSeconds = Math.round((endTime.getTime() - startTime.getTime()) / 1000);

            // Extract transcript
            const transcript = conv.transcript || '';

            return {
              id: conv.call_id || '',
              agentId: conv.agent_id || '',
              agentName: 'Voice AI Assistant',
              caller: conv.caller_id || '+1 (xxx) xxx-xxxx',
              duration: durationSeconds,
              status: conv.call_status === 'ended' ? 'completed' : 'failed',
              timestamp: startTime.toISOString(),
              transcript: transcript,
              summary: summary,
              sentiment: 'neutral'
            };
          });

          setConversations(processedData);
        } else {
          // Handle unknown agent type
          setConversations(data.data || []);
        }
      } else if (data.conversations) {
        // Fallback to conversations field if data field is not available
        setConversations(data.conversations);
      } else {
        // Handle case where data might be in a different format
        setConversations([]);
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [agentId, period]);

  useEffect(() => {
    fetchConversations();
  }, [agentId, period, fetchConversations]);

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60); // Remove decimal places
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch (e) {
      return 'Unknown time';
    }
  };

  const getSentimentColor = (sentiment?: string) => {
    if (!sentiment) return 'bg-gray-500';

    switch (sentiment.toLowerCase()) {
      case 'positive':
        return 'bg-green-500';
      case 'negative':
        return 'bg-red-500';
      case 'neutral':
      default:
        return 'bg-blue-500';
    }
  };

  const toggleConversation = (id: string) => {
    if (expandedConversation === id) {
      setExpandedConversation(null);
    } else {
      setExpandedConversation(id);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2" style={{ borderColor: branding.primaryColor }}></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
        <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4 bg-red-500/20">
          <FiAlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">Unable to Load Conversations</h3>
        <p className="text-red-400 mb-4">{error}</p>
        <button
          onClick={fetchConversations}
          className="px-4 py-2 rounded-lg text-white flex items-center justify-center mx-auto"
          style={{ backgroundColor: branding.primaryColor }}
        >
          <FiRefreshCw className="mr-2" /> Try Again
        </button>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-8 text-center">
        <div
          className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4"
          style={{ backgroundColor: `${branding.primaryColor}20` }}
        >
          <FiMessageSquare className="w-8 h-8" style={{ color: branding.primaryColor }} />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">No Conversations Yet</h3>
        <p className="text-gray-400 max-w-md mx-auto">
          {agentId
            ? `This agent hasn't handled any calls in the selected time period.`
            : `Your AI voice agents haven't handled any calls yet.`}
        </p>
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => setPeriod('30d')}
            className="px-4 py-2 rounded-lg text-white flex items-center justify-center mx-2"
            style={{ backgroundColor: branding.primaryColor }}
          >
            <FiCalendar className="mr-2" /> View Last 30 Days
          </button>
          <button
            onClick={fetchConversations}
            className="px-4 py-2 rounded-lg bg-gray-700 text-white flex items-center justify-center mx-2"
          >
            <FiRefreshCw className="mr-2" /> Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-white">
          {agentName ? `${agentName} Conversations` : 'All Conversations'}
        </h2>
        <div className="flex items-center space-x-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
            style={{ borderColor: `${branding.primaryColor}40` }}
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
          <button
            onClick={fetchConversations}
            className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white"
            title="Refresh"
          >
            <FiRefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {conversations.map((conversation) => (
          <div
            key={conversation.id}
            className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden"
          >
            <div
              className="p-4 cursor-pointer hover:bg-gray-800/80 transition-colors"
              onClick={() => toggleConversation(conversation.id)}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center mr-3"
                    style={{ backgroundColor: `${branding.primaryColor}20` }}
                  >
                    <FiPhone style={{ color: branding.primaryColor }} />
                  </div>
                  <div>
                    <div className="text-white font-medium">{conversation.caller}</div>
                    <div className="text-gray-400 text-sm flex items-center">
                      <FiClock className="mr-1" /> {formatDuration(conversation.duration)} • {formatTimestamp(conversation.timestamp)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center">
                  {conversation.sentiment && (
                    <div className="flex items-center mr-4">
                      <div className={`w-2 h-2 rounded-full ${getSentimentColor(conversation.sentiment)} mr-2`}></div>
                      <span className="text-gray-400 text-sm capitalize">{conversation.sentiment}</span>
                    </div>
                  )}
                  {expandedConversation === conversation.id ? (
                    <FiChevronUp className="text-gray-400" />
                  ) : (
                    <FiChevronDown className="text-gray-400" />
                  )}
                </div>
              </div>
            </div>

            {expandedConversation === conversation.id && (
              <div className="border-t border-gray-700 p-4">
                {conversation.summary && (
                  <div className="mb-4">
                    <div className="text-gray-400 text-sm mb-1">Summary</div>
                    <div className="text-white">{conversation.summary}</div>
                  </div>
                )}

                {conversation.transcript && (
                  <div>
                    <div className="text-gray-400 text-sm mb-1">Transcript</div>
                    <div className="bg-gray-900/50 rounded-lg p-3 text-gray-300 text-sm max-h-60 overflow-y-auto">
                      {conversation.transcript}
                    </div>
                  </div>
                )}

                <div className="mt-4 flex justify-end">
                  <button
                    className="px-3 py-1.5 rounded-lg text-sm flex items-center bg-gray-700 text-white hover:bg-gray-600 transition-colors"
                  >
                    <FiDownload className="mr-1.5" /> Download Transcript
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default WhitelabelAgentConversations;
