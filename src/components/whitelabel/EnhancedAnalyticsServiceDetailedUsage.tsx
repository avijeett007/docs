'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Tab } from '@headlessui/react';
import { FiClock, FiPhoneCall, FiDollarSign, FiCheckCircle, FiXCircle, FiTrendingUp, FiRefreshCw } from 'react-icons/fi';
import {
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, BarChart, Bar
} from 'recharts';
import { usePartnerBranding } from '@/lib/partnerBranding';

interface Agent {
  id: string;
  name: string;
  assistantId: string;
  customerId?: string;
  type?: 'vapi' | 'retell' | 'ultravox' | 'ghl';
}

interface AgentAnalytics {
  totalDuration: number;
  avgCost: number;
  callCount: number;
  failedCalls: number;
  avgDuration: number;
  totalCost: number;
  successRate: number;
  costBreakdown?: {
    llm: number;
    stt: number;
    tts: number;
    vapi?: number;
    retell?: number;
    ultravox?: number;
    ghl?: number;
  };
  callVolumeByDay?: Array<{
    date: string;
    calls: number;
  }>;
  endReasons?: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;
  callTypes?: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
}

interface AgentUsage extends Agent {
  analytics?: AgentAnalytics;
  isLoading?: boolean;
}



// Format duration from seconds to readable format
const formatDuration = (seconds: number) => {
  if (seconds === 0) return '0s';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.round(seconds % 60); // Remove decimal places

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    return `${remainingSeconds}s`;
  }
};

// Format currency - expects amount in dollars (API already converts V3 cents to dollars)
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

const EnhancedAnalyticsServiceDetailedUsage: React.FC = () => {
  const { branding } = usePartnerBranding();
  const { primaryColor } = branding;
  
  const [agents, setAgents] = useState<AgentUsage[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentUsage | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month'>('month');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Conversation analytics state
  const [conversationAnalytics, setConversationAnalytics] = useState<Map<string, {
    endReasons: Array<{ reason: string; count: number; percentage: number; }>;
    callTypes: Array<{ type: string; count: number; percentage: number; }>;
    isLoading: boolean;
  }>>(new Map());
  
  // Customer features state
  const [customerFeatures, setCustomerFeatures] = useState<{
    showPricingInformation?: boolean;
  }>({ showPricingInformation: false });

  // Fetch customer features
  useEffect(() => {
    const fetchCustomerFeatures = async () => {
      try {
        const response = await fetch('/api/whitelabel/customer/features');
        if (response.ok) {
          const data = await response.json();
          setCustomerFeatures({
            showPricingInformation: data.showPricingInformation || false
          });
        }
      } catch (error) {
        console.error('Error fetching customer features:', error);
        setCustomerFeatures({ showPricingInformation: false });
      }
    };

    fetchCustomerFeatures();
  }, []);

  // Fetch all agents
  const fetchAllAgents = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/whitelabel/agents');
      if (!response.ok) {
        throw new Error('Failed to fetch agents');
      }

      const data = await response.json();
      const agentsWithType = (data.agents || []).map((agent: Agent) => ({
        ...agent,
        type: agent.type || 'vapi' // Default to vapi for backward compatibility
      }));

      setAgents(agentsWithType);
      console.log('Loaded agents from analytics service:', agentsWithType.length);
    } catch (error) {
      console.error('Error fetching agents:', error);
      setError('Failed to load agents');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Process analytics data from the analytics service
  const processAnalyticsData = (data: any): AgentAnalytics => {
    // Check if this is the new analytics service format (direct object) or legacy format (array)
    if (Array.isArray(data)) {
      // Legacy format for VAPI/Retell (still supported for backward compatibility)
      const costData = data.find(item => item.name === 'LLM, STT, TTS, VAPI Costs')?.result?.[0] || {};
      const durationData = data.find(item => item.name === 'Total Call Duration')?.result?.[0] || {};
      const avgCostData = data.find(item => item.name === 'Average Call Cost')?.result?.[0] || {};
      const callCountData = data.find(item => item.name === 'Number of Calls by Assistants')?.result?.[0] || {};
      const failedCallsData = data.find(item => item.name === 'Number of Failed Calls')?.result?.[0] || {};
      const avgDurationData = data.find(item => item.name === 'Average Call Duration by Assistant')?.result?.[0] || {};
      const totalSpentData = data.find(item => item.name === 'Total Spent')?.result?.[0] || {};
      const successData = data.find(item => item.name === 'Success Evaluation')?.result || [];

      const totalCalls = parseInt(callCountData.countId || '0');
      const failedCalls = parseInt(failedCallsData.countId || '0');
      const successfulCalls = successData.reduce((acc: number, curr: any) => {
        if (curr['analysis.successEvaluation'] === 'true') {
          return acc + parseInt(curr.countId || '0');
        }
        return acc;
      }, 0);

      return {
        totalDuration: durationData.sumDuration || 0,
        avgCost: avgCostData.avgCost || 0,
        callCount: totalCalls,
        failedCalls,
        avgDuration: avgDurationData.avgDuration || 0,
        totalCost: totalSpentData.sumCost || 0,
        successRate: totalCalls ? (successfulCalls / totalCalls) * 100 : 0,
        costBreakdown: {
          llm: costData['costBreakdown.llm'] || 0,
          stt: costData['costBreakdown.stt'] || 0,
          tts: costData['costBreakdown.tts'] || 0,
          vapi: costData['costBreakdown.vapi'] || 0
        }
      };
    } else {
      // New format for all providers (direct object from analytics service)
      return {
        totalDuration: data.totalDuration || 0,
        avgCost: data.avgCost || 0,
        callCount: data.totalCalls || 0,
        failedCalls: data.failedCalls || 0,
        avgDuration: data.avgDuration || 0,
        totalCost: data.totalCost || 0,
        successRate: data.successRate || 0,
        // Use actual cost breakdown if available, otherwise approximate
        costBreakdown: data.costBreakdown || {
          llm: data.totalCost * 0.7 || 0, // Approximate breakdown for display
          stt: data.totalCost * 0.15 || 0,
          tts: data.totalCost * 0.15 || 0,
          vapi: 0,
          retell: 0,
          ultravox: 0,
          ghl: 0
        }
      };
    }
  };

  // Fetch conversation analytics for end reasons and call types
  const fetchConversationAnalytics = async (agentId: string, period: string) => {
    try {
      console.log(`🔄 Fetching conversation analytics for agent: ${agentId}, period: ${period}`);

      // Set loading state
      setConversationAnalytics(prev => new Map(prev.set(agentId, {
        endReasons: [],
        callTypes: [],
        isLoading: true
      })));

      // Add cache-busting timestamp to ensure fresh data
      const timestamp = Date.now();
      const response = await fetch(`/api/whitelabel/analytics/conversations?period=${period}&agentId=${agentId}&limit=1000&_t=${timestamp}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      if (!response.ok) {
        console.error(`❌ Failed to fetch conversations for analytics: ${response.status} ${response.statusText}`);
        return;
      }

      const data = await response.json();
      const conversations = data.conversations || data.data || [];

      // Analyze end reasons and call types
      const endReasonCounts = new Map<string, number>();
      const callTypeCounts = new Map<string, number>();

      conversations.forEach((conv: any) => {
        // Count end reasons
        const endReason = conv.endedReason || conv.outcome || conv.status || 'unknown';
        endReasonCounts.set(endReason, (endReasonCounts.get(endReason) || 0) + 1);

        // Count call types
        const callType = conv.type || conv.callType || conv.channel || 'unknown';
        callTypeCounts.set(callType, (callTypeCounts.get(callType) || 0) + 1);
      });

      const totalConversations = conversations.length;

      // Format end reasons
      const endReasons = Array.from(endReasonCounts.entries()).map(([reason, count]) => {
        let formattedReason = reason;
        if (reason === 'customer-ended-call') formattedReason = 'Customer Ended Call';
        else if (reason === 'assistant-ended-call') formattedReason = 'Assistant Ended Call';
        else if (reason === 'user_hangup') formattedReason = 'User Hangup';
        else if (reason === 'assistant_hangup') formattedReason = 'Assistant Hangup';
        else if (reason === 'call_timeout') formattedReason = 'Call Timeout';
        else if (reason === 'max_duration_reached') formattedReason = 'Max Duration Reached';
        else if (reason === 'silence_timeout') formattedReason = 'Silence Timeout';
        else if (reason === 'error') formattedReason = 'Error';
        else if (reason === 'completed') formattedReason = 'Completed';
        else if (reason === 'pipeline-error-openai-llm-failed') formattedReason = 'AI Error';
        else if (reason === 'pipeline-error-voice-failed') formattedReason = 'Voice Error';
        else if (reason === 'exceeded-max-duration') formattedReason = 'Max Duration Exceeded';
        else if (reason === 'inactivity-timeout') formattedReason = 'Inactivity Timeout';
        else formattedReason = reason.replace(/-/g, ' ').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

        return {
          reason: formattedReason,
          count,
          percentage: totalConversations > 0 ? Math.round((count / totalConversations) * 100) : 0
        };
      }).sort((a, b) => b.count - a.count);

      // Format call types
      const callTypes = Array.from(callTypeCounts.entries()).map(([type, count]) => {
        let formattedType = type;
        if (type === 'webCall') formattedType = 'Web Call';
        else if (type === 'phoneCall') formattedType = 'Phone Call';
        else if (type === 'inboundCall') formattedType = 'Inbound Call';
        else if (type === 'outboundCall') formattedType = 'Outbound Call';
        else if (type === 'call') formattedType = 'Voice Call';
        else if (type === 'web') formattedType = 'Web Call';
        else if (type === 'phone') formattedType = 'Phone Call';
        else formattedType = type.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

        return {
          type: formattedType,
          count,
          percentage: totalConversations > 0 ? Math.round((count / totalConversations) * 100) : 0
        };
      }).sort((a, b) => b.count - a.count);

      // Update state with results
      setConversationAnalytics(prev => new Map(prev.set(agentId, {
        endReasons,
        callTypes,
        isLoading: false
      })));

      console.log('Successfully processed conversation analytics:', { endReasons, callTypes });

    } catch (error) {
      console.error('Error fetching conversation analytics:', error);

      // Set error state
      setConversationAnalytics(prev => new Map(prev.set(agentId, {
        endReasons: [],
        callTypes: [],
        isLoading: false
      })));
    }
  };

  // Fetch analytics using the analytics service
  const fetchAnalytics = async (agent: AgentUsage, period: string) => {
    try {
      console.log(`🔄 Fetching analytics from analytics service for agent: ${agent.id}, period: ${period}`);

      // Add cache-busting timestamp to ensure fresh data
      const timestamp = Date.now();
      const response = await fetch(`/api/whitelabel/analytics/agent/${agent.id}?period=${period}&_t=${timestamp}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch analytics: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const analytics = processAnalyticsData(data);

      console.log(`✅ Successfully processed analytics from service for period ${period}:`, analytics);
      return analytics;
    } catch (error) {
      console.error(`❌ Error fetching analytics from service for period ${period}:`, error);
      throw error;
    }
  };

  const handleAgentClick = async (agent: AgentUsage) => {
    setSelectedAgent(agent);

    setAgents(prev => prev.map(a =>
      a.id === agent.id ? { ...a, isLoading: true } : a
    ));

    try {
      // Fetch both analytics and conversation analytics in parallel
      const [analytics] = await Promise.all([
        fetchAnalytics(agent, selectedPeriod),
        fetchConversationAnalytics(agent.id, selectedPeriod) // Auto lazy load conversation analytics
      ]);

      setAgents(prev => prev.map(a =>
        a.id === agent.id ? { ...a, analytics, isLoading: false } : a
      ));
    } catch (error) {
      setAgents(prev => prev.map(a =>
        a.id === agent.id ? { ...a, isLoading: false } : a
      ));
    }
  };

  const handlePeriodChange = async (period: 'day' | 'week' | 'month') => {
    console.log(`🔄 Period changing from ${selectedPeriod} to ${period}`);

    // Set the new period immediately
    setSelectedPeriod(period);

    if (selectedAgent) {
      // Clear ALL existing data to prevent stale state
      setAgents(prev => prev.map(a =>
        a.id === selectedAgent.id ? {
          ...a,
          analytics: undefined,
          isLoading: true
        } : a
      ));

      // Clear conversation analytics data completely
      setConversationAnalytics(prev => {
        const newMap = new Map(prev);
        newMap.delete(selectedAgent.id); // Remove completely to force fresh fetch
        return newMap;
      });

      // Add a small delay to ensure state is cleared before fetching
      await new Promise(resolve => setTimeout(resolve, 100));

      try {
        // Fetch fresh analytics for the new period
        console.log(`🔄 Fetching fresh analytics for period: ${period}`);

        // Fetch both analytics and conversation analytics with the new period
        const [analytics] = await Promise.all([
          fetchAnalytics(selectedAgent, period), // Use the new period directly
          fetchConversationAnalytics(selectedAgent.id, period) // Use the new period directly
        ]);

        // Update with fresh data
        setAgents(prev => prev.map(a =>
          a.id === selectedAgent.id ? {
            ...a,
            analytics,
            isLoading: false
          } : a
        ));

        console.log(`✅ Successfully updated analytics for period: ${period}`);
      } catch (error) {
        console.error(`❌ Error fetching analytics for period ${period}:`, error);
        setAgents(prev => prev.map(a =>
          a.id === selectedAgent.id ? {
            ...a,
            isLoading: false
          } : a
        ));
      }
    }
  };

  // Refresh all data
  const refreshData = async () => {
    setIsRefreshing(true);
    await fetchAllAgents();
    if (selectedAgent) {
      await handleAgentClick(selectedAgent);
    }
    setIsRefreshing(false);
  };

  // Load agents when component mounts
  useEffect(() => {
    fetchAllAgents();
  }, [fetchAllAgents]);

  // Agent Tile Component
  const AgentTile = ({ agent }: { agent: AgentUsage }) => (
    <div
      onClick={() => handleAgentClick(agent)}
      className={`p-6 rounded-lg cursor-pointer transition-all duration-300 border ${
        selectedAgent?.id === agent.id
          ? 'bg-opacity-20 border-2'
          : 'bg-gray-800/50 hover:bg-gray-800 border-gray-700'
      }`}
      style={{
        backgroundColor: selectedAgent?.id === agent.id ? `${primaryColor}20` : '',
        borderColor: selectedAgent?.id === agent.id ? primaryColor : ''
      }}
    >
      <h3 className="text-lg font-semibold text-white mb-4">{agent.name}</h3>

      {agent.isLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-700 rounded w-3/4"></div>
          <div className="h-4 bg-gray-700 rounded w-1/2"></div>
          <div className="h-4 bg-gray-700 rounded w-2/3"></div>
        </div>
      ) : agent.analytics ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center text-gray-400">
              <FiPhoneCall className="mr-2" />
              <span>Total Calls</span>
            </div>
            <span className="text-white font-medium">{agent.analytics.callCount}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center text-gray-400">
              <FiClock className="mr-2" />
              <span>Total Duration</span>
            </div>
            <span className="text-white font-medium">{formatDuration(agent.analytics.totalDuration)}</span>
          </div>

          {customerFeatures.showPricingInformation && (
            <div className="flex items-center justify-between">
              <div className="flex items-center text-gray-400">
                <FiDollarSign className="mr-2" />
                <span>Total Cost</span>
              </div>
              <span className="text-white font-medium">{formatCurrency(agent.analytics.totalCost)}</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center text-gray-400">
              <FiCheckCircle className="mr-2" />
              <span>Success Rate</span>
            </div>
            <span className="text-green-400 font-medium">{agent.analytics.successRate.toFixed(1)}%</span>
          </div>
        </div>
      ) : (
        <div className="text-gray-400 text-center py-4">Click to view analytics</div>
      )}
    </div>
  );

  // Detailed View Component
  const DetailedView = ({ agent }: { agent: AgentUsage }) => {
    const currentAgent = agents.find(a => a.id === agent.id);
    const analytics = currentAgent?.analytics;
    const conversationData = conversationAnalytics.get(agent.id);

    if (!analytics) return null;

    // Prepare data for charts
    const successfulCalls = Math.max(0, analytics.callCount - analytics.failedCalls);
    const failedCalls = Math.max(0, analytics.failedCalls);

    const callStatusData = [
      { name: 'Successful', value: successfulCalls, color: primaryColor || '#10B981' },
      { name: 'Failed', value: failedCalls, color: '#EF4444' }
    ].filter(item => item.value > 0);

    const costBreakdownData = analytics.costBreakdown ? [
      { name: 'AI Model', value: analytics.costBreakdown.llm, color: '#3B82F6' },
      { name: 'Speech-to-Text', value: analytics.costBreakdown.stt, color: '#10B981' },
      { name: 'Text-to-Speech', value: analytics.costBreakdown.tts, color: '#F59E0B' },
      { name: 'Platform Cost', value: (
        analytics.costBreakdown.vapi ||
        analytics.costBreakdown.retell ||
        analytics.costBreakdown.ultravox ||
        analytics.costBreakdown.ghl ||
        0
      ), color: '#8B5CF6' },
    ].filter(item => item.value > 0) : [];

    // Prepare conversation analytics data for charts
    const endReasonsChartData = conversationData?.endReasons?.slice(0, 5).map((reason, index) => ({
      name: reason.reason,
      value: reason.count,
      color: `hsl(${(index * 60) % 360}, 70%, 60%)`
    })) || [];

    const callTypesChartData = conversationData?.callTypes?.map((type, index) => ({
      name: type.type,
      value: type.count,
      color: `hsl(${(index * 120) % 360}, 70%, 60%)`
    })) || [];

    return (
      <div className="mt-8 space-y-8">
        <h2 className="text-2xl font-bold text-white mb-6">Detailed Analytics - {agent.name}</h2>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
            <h4 className="text-gray-400 mb-2">Total Calls</h4>
            <div className="text-2xl font-bold text-white">{analytics.callCount}</div>
            <div className="text-sm text-gray-500 mt-1">
              {successfulCalls} successful, {failedCalls} failed
            </div>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
            <h4 className="text-gray-400 mb-2">Total Duration</h4>
            <div className="text-2xl font-bold text-white">{formatDuration(analytics.totalDuration)}</div>
            <div className="text-sm text-gray-500 mt-1">
              Avg: {formatDuration(analytics.avgDuration)}
            </div>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
            <h4 className="text-gray-400 mb-2">Success Rate</h4>
            <div className="text-2xl font-bold text-green-400">{analytics.successRate.toFixed(1)}%</div>
            <div className="text-sm text-gray-500 mt-1">
              {successfulCalls} of {analytics.callCount} calls
            </div>
          </div>

          {customerFeatures.showPricingInformation && (
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <h4 className="text-gray-400 mb-2">Total Cost</h4>
              <div className="text-2xl font-bold text-white">{formatCurrency(analytics.totalCost)}</div>
              <div className="text-sm text-gray-500 mt-1">
                Avg: {formatCurrency(analytics.avgCost)} per call
              </div>
            </div>
          )}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Call Success Rate Chart */}
          {callStatusData.length > 0 && (
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <h4 className="text-gray-400 mb-4">Call Success Rate</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={callStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value, percent }) =>
                        `${name}: ${value} (${(percent * 100).toFixed(1)}%)`
                      }
                    >
                      {callStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Cost Breakdown Chart */}
          {customerFeatures.showPricingInformation && costBreakdownData.length > 0 && (
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <h4 className="text-gray-400 mb-4">Cost Breakdown</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={costBreakdownData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {costBreakdownData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* Conversation Analytics Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Call End Reasons Chart */}
          <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
            <h4 className="text-gray-400 mb-4">Call End Reasons</h4>
            {conversationData?.isLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-gray-600 border-t-blue-500 rounded-full mr-3"></div>
                <span className="text-gray-400">Analyzing conversations...</span>
              </div>
            ) : endReasonsChartData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={endReasonsChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value, percent }) =>
                        `${name}: ${value} (${(percent * 100).toFixed(1)}%)`
                      }
                    >
                      {endReasonsChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-400">
                No conversation data available
              </div>
            )}
          </div>

          {/* Call Types Chart */}
          <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
            <h4 className="text-gray-400 mb-4">Call Types</h4>
            {conversationData?.isLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-gray-600 border-t-blue-500 rounded-full mr-3"></div>
                <span className="text-gray-400">Analyzing conversations...</span>
              </div>
            ) : callTypesChartData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={callTypesChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value, percent }) =>
                        `${name}: ${value} (${(percent * 100).toFixed(1)}%)`
                      }
                    >
                      {callTypesChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-400">
                No conversation data available
              </div>
            )}
          </div>
        </div>

        {/* Conversation Analytics Details */}
        {conversationData && !conversationData.isLoading && (conversationData.endReasons.length > 0 || conversationData.callTypes.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* End Reasons Details */}
            {conversationData.endReasons.length > 0 && (
              <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
                <h4 className="text-gray-400 mb-4">End Reasons Breakdown</h4>
                <div className="space-y-3">
                  {conversationData.endReasons.slice(0, 5).map((reason, index) => (
                    <div key={reason.reason} className="flex items-center justify-between">
                      <div className="flex items-center flex-1">
                        <div
                          className="w-3 h-3 rounded-full mr-3"
                          style={{ backgroundColor: `hsl(${(index * 60) % 360}, 70%, 60%)` }}
                        />
                        <span className="text-sm text-gray-300 flex-1">{reason.reason}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-white">{reason.count}</span>
                        <span className="text-xs text-gray-400">({reason.percentage}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Call Types Details */}
            {conversationData.callTypes.length > 0 && (
              <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
                <h4 className="text-gray-400 mb-4">Call Types Breakdown</h4>
                <div className="space-y-3">
                  {conversationData.callTypes.map((type, index) => (
                    <div key={type.type} className="flex items-center justify-between">
                      <div className="flex items-center flex-1">
                        <div
                          className="w-3 h-3 rounded-full mr-3"
                          style={{ backgroundColor: `hsl(${(index * 120) % 360}, 70%, 60%)` }}
                        />
                        <span className="text-sm text-gray-300 flex-1">{type.type}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-white">{type.count}</span>
                        <span className="text-xs text-gray-400">({type.percentage}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Additional Analytics Section */}
        <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
          <h4 className="text-gray-400 mb-4">Performance Insights</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-white mb-2">
                {analytics.callCount > 0 ? Math.round(analytics.totalDuration / analytics.callCount / 60) : '0'}
              </div>
              <div className="text-sm text-gray-400">Avg Minutes per Call</div>
            </div>

            {customerFeatures.showPricingInformation && (
              <div className="text-center">
                <div className="text-2xl font-bold text-white mb-2">
                  {formatCurrency(analytics.avgCost)}
                </div>
                <div className="text-sm text-gray-400">Avg Cost per Call</div>
              </div>
            )}

            <div className="text-center">
              <div className="text-2xl font-bold text-green-400 mb-2">
                {analytics.successRate.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-400">Success Rate</div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
          <h4 className="text-gray-400 mb-4">Quick Actions</h4>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => window.open('/whitelabel/conversations', '_blank')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              View Conversations
            </button>
            <button
              onClick={() => window.open('/whitelabel/dashboard', '_blank')}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Dashboard Overview
            </button>
            {customerFeatures.showPricingInformation && (
              <button
                onClick={() => alert('Billing details coming soon!')}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                View Billing
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: primaryColor }}></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400 text-lg mb-4">{error}</p>
        <button
          onClick={fetchAllAgents}
          className="px-6 py-2 rounded-lg transition-colors text-white"
          style={{ backgroundColor: primaryColor }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">
          AI Usage Analytics
        </h1>
        
        <div className="flex items-center space-x-4">
          {/* Refresh Button */}
          <button
            onClick={refreshData}
            disabled={isRefreshing}
            className="p-2 bg-gray-800 border border-gray-700 rounded-lg text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
            title="Refresh data"
          >
            <FiRefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          
          {/* Period Selection */}
          <div className="flex space-x-2">
            {(['day', 'week', 'month'] as const).map((period) => (
              <button
                key={period}
                onClick={() => handlePeriodChange(period)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  selectedPeriod === period
                    ? 'text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
                style={{
                  backgroundColor: selectedPeriod === period ? primaryColor : undefined
                }}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {agents.length === 0 ? (
        <div className="bg-gray-800/50 rounded-lg p-8 text-center border border-gray-700">
          <p className="text-gray-400 mb-4">No AI agents assigned to your account.</p>
          <p className="text-gray-500">Contact your partner to get AI agents assigned.</p>
        </div>
      ) : (
        <>
          {/* Agent Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map(agent => (
              <AgentTile key={agent.id} agent={agent} />
            ))}
          </div>

          {/* Detailed View */}
          {selectedAgent && (
            <DetailedView agent={selectedAgent} />
          )}
        </>
      )}
    </div>
  );
};

export default EnhancedAnalyticsServiceDetailedUsage;
