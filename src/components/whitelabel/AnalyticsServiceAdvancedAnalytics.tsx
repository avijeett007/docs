'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FiFilter, FiChevronDown, FiDownload, FiTrendingUp, FiMessageSquare, FiTarget } from 'react-icons/fi';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area, LineChart, Line
} from 'recharts';
import { usePartnerBranding } from '@/lib/partnerBranding';

interface Agent {
  id: string;
  name: string;
  assistantId: string;
  customerId?: string;
  type?: 'vapi' | 'retell';
}

interface AdvancedAnalyticsData {
  customerId: string;
  agentCount: number;
  period: string;
  data: {
    sentimentAnalysis: {
      distribution: {
        positive: number;
        neutral: number;
        negative: number;
      };
      averageScore: number;
      trend: number[];
    };
    topicAnalysis: {
      topics: Array<{
        name: string;
        count: number;
      }>;
      topicTrends: Array<{
        name: string;
        count: number;
      }>;
    };
    keyMoments: {
      types: string[];
      frequency: Array<{
        type: string;
        count: number;
      }>;
    };
    actionItems: {
      common: Array<{
        action: string;
        count: number;
      }>;
      followUpRate: number;
    };
    callVolumeOverTime: {
      daily: Array<{
        date: string;
        calls: number;
      }>;
      hourly: Array<{
        hour: number;
        calls: number;
      }>;
    };
    conversionMetrics: {
      rate: number;
      opportunities: number;
      successful: number;
    };
  };
}

interface SentimentData {
  sentiment: string;
  count: number;
}

interface TopicData {
  topic: string;
  count: number;
}

interface KeyMomentData {
  type: string;
  count: number;
}

interface ActionItemData {
  action: string;
  count: number;
}

interface CallVolumeData {
  date: string;
  count: number;
}

const AnalyticsServiceAdvancedAnalytics: React.FC = () => {
  const { branding } = usePartnerBranding();
  const { primaryColor } = branding;
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState('30d');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Analytics data state - using the new structure
  const [analyticsData, setAnalyticsData] = useState<AdvancedAnalyticsData | null>(null);

  // Processed data for charts
  const [sentimentData, setSentimentData] = useState<SentimentData[]>([]);
  const [topicData, setTopicData] = useState<TopicData[]>([]);
  const [keyMomentData, setKeyMomentData] = useState<KeyMomentData[]>([]);
  const [actionItemData, setActionItemData] = useState<ActionItemData[]>([]);
  const [callVolumeData, setCallVolumeData] = useState<CallVolumeData[]>([]);

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

  // Fetch advanced analytics from the analytics service
  const fetchAdvancedAnalytics = useCallback(async (agentId?: string, period: string = '30d') => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('Fetching advanced analytics from analytics service:', { agentId, period });

      // Build query string
      let queryString = `period=${period}`;
      if (agentId) {
        queryString += `&agentId=${agentId}`;
      }

      const response = await fetch(`/api/whitelabel/analytics/advanced?${queryString}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch advanced analytics: ${response.status}`);
      }

      const data: AdvancedAnalyticsData = await response.json();
      setAnalyticsData(data);

      // Process sentiment data
      const sentimentDistribution = data.data.sentimentAnalysis.distribution;
      const processedSentimentData: SentimentData[] = [
        { sentiment: 'Positive', count: sentimentDistribution.positive },
        { sentiment: 'Neutral', count: sentimentDistribution.neutral },
        { sentiment: 'Negative', count: sentimentDistribution.negative }
      ].filter(item => item.count > 0);
      setSentimentData(processedSentimentData);

      // Process topic data
      const processedTopicData: TopicData[] = data.data.topicAnalysis.topics.map(topic => ({
        topic: topic.name,
        count: topic.count
      }));
      setTopicData(processedTopicData);

      // Process key moments data
      const processedKeyMomentData: KeyMomentData[] = data.data.keyMoments.frequency.map(moment => ({
        type: moment.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        count: moment.count
      }));
      setKeyMomentData(processedKeyMomentData);

      // Process action items data
      const processedActionItemData: ActionItemData[] = data.data.actionItems.common.map(item => ({
        action: item.action,
        count: item.count
      }));
      setActionItemData(processedActionItemData);

      // Process call volume data
      const processedCallVolumeData: CallVolumeData[] = data.data.callVolumeOverTime.daily.map(day => ({
        date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count: day.calls
      }));
      setCallVolumeData(processedCallVolumeData);

      console.log('Successfully loaded advanced analytics from service:', {
        sentiment: processedSentimentData.length,
        topics: processedTopicData.length,
        keyMoments: processedKeyMomentData.length,
        actionItems: processedActionItemData.length,
        callVolume: processedCallVolumeData.length
      });

    } catch (error) {
      console.error('Error fetching advanced analytics:', error);
      setError('Failed to load advanced analytics');

      // Clear data on error
      setAnalyticsData(null);
      setSentimentData([]);
      setTopicData([]);
      setKeyMomentData([]);
      setActionItemData([]);
      setCallVolumeData([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load agents when component mounts
  useEffect(() => {
    fetchAllAgents();
  }, [fetchAllAgents]);

  // Load analytics when selected agent or time range changes
  useEffect(() => {
    if (selectedAgent || agents.length > 0) {
      fetchAdvancedAnalytics(selectedAgent?.id, selectedTimeRange);
    }
  }, [selectedAgent, selectedTimeRange, fetchAdvancedAnalytics, agents.length]);

  // Handle agent selection
  const handleAgentSelect = (agent: Agent) => {
    setSelectedAgent(agent);
  };

  // Time range options
  const timeRangeOptions = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' }
  ];

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400 text-lg mb-4">{error}</p>
        <button
          onClick={() => fetchAdvancedAnalytics(selectedAgent?.id, selectedTimeRange)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Advanced Analytics 
          </h1>
          <p className="text-gray-400">
            AI-powered insights from your voice conversations
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          {/* Agent Selection */}
          <div className="relative">
            <select
              value={selectedAgent?.id || ''}
              onChange={(e) => {
                const agent = agents.find(a => a.id === e.target.value);
                if (agent) handleAgentSelect(agent);
              }}
              className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 min-w-[200px]"
            >
              <option value="">All Agents</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>

          {/* Time Range Selection */}
          <div className="relative">
            <select
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
            >
              {timeRangeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )}

      {/* Summary Cards */}
      {!isLoading && analyticsData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-gray-800/30 rounded-lg border border-gray-800 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Conversion Rate</p>
                <p className="text-2xl font-bold text-white">{analyticsData.data.conversionMetrics.rate.toFixed(1)}%</p>
              </div>
              <div className="p-3 bg-green-600/20 rounded-lg">
                <FiTarget className="w-6 h-6 text-green-400" />
              </div>
            </div>
            <p className="text-gray-500 text-xs mt-2">
              {analyticsData.data.conversionMetrics.successful} of {analyticsData.data.conversionMetrics.opportunities} opportunities
            </p>
          </div>

          <div className="bg-gray-800/30 rounded-lg border border-gray-800 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Avg Sentiment</p>
                <p className="text-2xl font-bold text-white">{analyticsData.data.sentimentAnalysis.averageScore.toFixed(2)}</p>
              </div>
              <div className="p-3 bg-blue-600/20 rounded-lg">
                <FiTrendingUp className="w-6 h-6 text-blue-400" />
              </div>
            </div>
            <p className="text-gray-500 text-xs mt-2">Sentiment Score (0-1 scale)</p>
          </div>

          <div className="bg-gray-800/30 rounded-lg border border-gray-800 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Follow-up Rate</p>
                <p className="text-2xl font-bold text-white">{analyticsData.data.actionItems.followUpRate}%</p>
              </div>
              <div className="p-3 bg-yellow-600/20 rounded-lg">
                <FiMessageSquare className="w-6 h-6 text-amber-400" />
              </div>
            </div>
            <p className="text-gray-500 text-xs mt-2">Action items requiring follow-up</p>
          </div>

          <div className="bg-gray-800/30 rounded-lg border border-gray-800 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Active Agents</p>
                <p className="text-2xl font-bold text-white">{analyticsData.agentCount}</p>
              </div>
              <div className="p-3 bg-purple-600/20 rounded-lg">
                <FiTarget className="w-6 h-6 text-purple-400" />
              </div>
            </div>
            <p className="text-gray-500 text-xs mt-2">AI agents with activity</p>
          </div>
        </div>
      )}

      {/* Analytics Content */}
      {!isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sentiment Analysis */}
          <div className="bg-gray-800/30 rounded-lg border border-gray-800 p-6">
            <div className="flex items-center mb-4">
              <FiTrendingUp className="w-5 h-5 mr-2 text-blue-400" />
              <h3 className="text-lg font-medium text-white">Sentiment Analysis</h3>
            </div>
            {sentimentData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sentimentData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      fill="#8884d8"
                      paddingAngle={5}
                      dataKey="count"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {sentimentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={
                          entry.sentiment === 'Positive' ? '#10B981' :
                          entry.sentiment === 'Negative' ? '#EF4444' :
                          '#F59E0B'
                        } />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-400">
                No sentiment data available
              </div>
            )}
          </div>

          {/* Topic Analysis */}
          <div className="bg-gray-800/30 rounded-lg border border-gray-800 p-6">
            <div className="flex items-center mb-4">
              <FiMessageSquare className="w-5 h-5 mr-2 text-green-400" />
              <h3 className="text-lg font-medium text-white">Top Topics</h3>
            </div>
            {topicData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topicData.slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="topic" 
                      stroke="#9CA3AF"
                      fontSize={12}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis stroke="#9CA3AF" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1F2937', 
                        border: '1px solid #374151',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="count" fill={primaryColor || "#10B981"} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-400">
                No topic data available
              </div>
            )}
          </div>

          {/* Key Moments */}
          <div className="bg-gray-800/30 rounded-lg border border-gray-800 p-6">
            <div className="flex items-center mb-4">
              <FiTarget className="w-5 h-5 mr-2 text-amber-400" />
              <h3 className="text-lg font-medium text-white">Key Moments</h3>
            </div>
            {keyMomentData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={keyMomentData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="type" 
                      stroke="#9CA3AF"
                      fontSize={12}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis stroke="#9CA3AF" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1F2937', 
                        border: '1px solid #374151',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="count" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-400">
                No key moments data available
              </div>
            )}
          </div>

          {/* Call Volume Over Time */}
          <div className="bg-gray-800/30 rounded-lg border border-gray-800 p-6">
            <div className="flex items-center mb-4">
              <FiTrendingUp className="w-5 h-5 mr-2 text-purple-400" />
              <h3 className="text-lg font-medium text-white">Call Volume Trend</h3>
            </div>
            {callVolumeData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={callVolumeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#9CA3AF"
                      fontSize={12}
                    />
                    <YAxis stroke="#9CA3AF" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1F2937', 
                        border: '1px solid #374151',
                        borderRadius: '8px'
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke={primaryColor || "#8B5CF6"}
                      strokeWidth={2}
                      dot={{ fill: primaryColor || '#8B5CF6', strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-400">
                No call volume data available
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Items Section */}
      {!isLoading && actionItemData.length > 0 && (
        <div className="bg-gray-800/30 rounded-lg border border-gray-800 p-6">
          <h3 className="text-lg font-medium text-white mb-4">AI-Generated Action Items</h3>
          <div className="space-y-3">
            {actionItemData.slice(0, 5).map((item, index) => (
              <div key={index} className="flex items-start space-x-3 p-3 bg-gray-800/50 rounded-lg">
                <div
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
                  style={{ backgroundColor: primaryColor || '#3B82F6' }}
                >
                  {item.count}
                </div>
                <p className="text-gray-300 text-sm">{item.action}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsServiceAdvancedAnalytics;
