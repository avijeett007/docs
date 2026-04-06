'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FiFilter, FiChevronDown, FiDownload } from 'react-icons/fi';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { usePartnerBranding } from '@/lib/partnerBranding';
import AnalyticsServiceAdvancedAnalytics from './AnalyticsServiceAdvancedAnalytics';

// Check if we should use analytics service
const USE_ANALYTICS_SERVICE = process.env.NEXT_PUBLIC_USE_ANALYTICS_SERVICE_WHITELABEL_ADVANCED_ANALYTICS === 'true';

interface Agent {
  id: string;
  name: string;
  assistantId?: string;
  customerId?: string;
  type?: 'vapi' | 'retell' | 'ultravox' | 'ghl';
  description?: string;
  status?: string;
  createdAt?: string;
}

interface AnalyticsData {
  name: string;
  result: any[];
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

const AdvancedAnalytics: React.FC = () => {
  // All hooks must be called at the top level
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>('30d');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Analytics data states
  const [sentimentData, setSentimentData] = useState<SentimentData[]>([]);
  const [topicData, setTopicData] = useState<TopicData[]>([]);
  const [keyMomentData, setKeyMomentData] = useState<KeyMomentData[]>([]);
  const [actionItemData, setActionItemData] = useState<ActionItemData[]>([]);
  const [callVolumeData, setCallVolumeData] = useState<CallVolumeData[]>([]);

  const { branding } = usePartnerBranding();
  const { primaryColor, secondaryColor } = branding;

  // Define fetchAllAgents with useCallback
  const fetchAllAgents = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch all agents from the unified endpoint
      const response = await fetch('/api/whitelabel/agents');

      let allAgents: Agent[] = [];

      if (response.ok) {
        const data = await response.json();
        allAgents = (data.agents || []).map((agent: any) => ({
          id: agent.id,
          name: agent.name,
          type: agent.type,
          description: agent.description,
          status: agent.status,
          createdAt: agent.createdAt
        }));
        console.log(`Fetched ${allAgents.length} agents from unified endpoint`);
      } else {
        console.error('Failed to fetch agents:', response.status);
      }
      setAgents(allAgents);

      // If we have agents but none selected, select the first one
      if (allAgents.length > 0 && !selectedAgent) {
        setSelectedAgent(allAgents[0]);
      }
    } catch (error) {
      console.error('Error fetching agents:', error);
      setError('An unexpected error occurred. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedAgent]);

  // Define fetchAnalytics with useCallback
  const fetchAnalytics = useCallback(async (agentId: string, agentType: string, period: string) => {
    try {
      setIsLoading(true);
      setError(null);

      // Determine the endpoint based on agent type
      const endpoint = agentType === 'vapi'
        ? `/api/whitelabel/vapi-agents/${agentId}/analytics?period=${period}`
        : `/api/whitelabel/retell-agents/${agentId}/analytics?period=${period}`;

      const response = await fetch(endpoint);

      if (!response.ok) {
        throw new Error(`Failed to fetch analytics: ${response.status}`);
      }

      const data: AnalyticsData[] = await response.json();

      // Process sentiment data
      const sentimentAnalysis = data.find(d => d.name === "Sentiment Analysis");
      if (sentimentAnalysis && sentimentAnalysis.result) {
        const processedSentimentData: SentimentData[] = [
          { sentiment: 'Positive', count: 0 },
          { sentiment: 'Neutral', count: 0 },
          { sentiment: 'Negative', count: 0 }
        ];

        sentimentAnalysis.result.forEach((item: any) => {
          const sentiment = item['analysis.sentiment'] || 'neutral';
          const count = parseInt(item.countId || '0');

          if (sentiment.toLowerCase().includes('positive')) {
            processedSentimentData[0].count += count;
          } else if (sentiment.toLowerCase().includes('negative')) {
            processedSentimentData[2].count += count;
          } else {
            processedSentimentData[1].count += count;
          }
        });

        setSentimentData(processedSentimentData);
      }

      // Process topic data
      const topicAnalysis = data.find(d => d.name === "Topic Analysis");
      if (topicAnalysis && topicAnalysis.result) {
        const processedTopicData: TopicData[] = topicAnalysis.result
          .map((item: any) => ({
            topic: item['analysis.topic'] || 'Unknown',
            count: parseInt(item.countId || '0')
          }))
          .filter((item: TopicData) => item.topic !== 'Unknown' && item.count > 0)
          .sort((a: TopicData, b: TopicData) => b.count - a.count)
          .slice(0, 10); // Get top 10 topics

        setTopicData(processedTopicData);
      }

      // Process key moment data
      const keyMomentAnalysis = data.find(d => d.name === "Key Moments");
      if (keyMomentAnalysis && keyMomentAnalysis.result) {
        const processedKeyMomentData: KeyMomentData[] = keyMomentAnalysis.result
          .map((item: any) => ({
            type: item['analysis.keyMomentType'] || 'Other',
            count: parseInt(item.countId || '0')
          }))
          .filter((item: KeyMomentData) => item.count > 0)
          .sort((a: KeyMomentData, b: KeyMomentData) => b.count - a.count);

        setKeyMomentData(processedKeyMomentData);
      }

      // Process action item data
      const actionItemAnalysis = data.find(d => d.name === "Action Items");
      if (actionItemAnalysis && actionItemAnalysis.result) {
        const processedActionItemData: ActionItemData[] = actionItemAnalysis.result
          .map((item: any) => ({
            action: item['analysis.actionItem'] || 'Unknown',
            count: parseInt(item.countId || '0')
          }))
          .filter((item: ActionItemData) => item.action !== 'Unknown' && item.count > 0)
          .sort((a: ActionItemData, b: ActionItemData) => b.count - a.count)
          .slice(0, 10); // Get top 10 action items

        setActionItemData(processedActionItemData);
      }

      // Process call volume data
      const callVolumeAnalysis = data.find(d => d.name === "Call Volume Over Time");
      if (callVolumeAnalysis && callVolumeAnalysis.result) {
        const processedCallVolumeData: CallVolumeData[] = callVolumeAnalysis.result
          .map((item: any) => ({
            date: item.date || '',
            count: parseInt(item.countId || '0')
          }))
          .filter((item: CallVolumeData) => item.date)
          .sort((a: CallVolumeData, b: CallVolumeData) => {
            return new Date(a.date).getTime() - new Date(b.date).getTime();
          });

        setCallVolumeData(processedCallVolumeData);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setError('An unexpected error occurred. Please try again later.');
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
    if (selectedAgent && selectedAgent.type) {
      fetchAnalytics(selectedAgent.id, selectedAgent.type, selectedTimeRange);
    }
  }, [selectedAgent, selectedTimeRange, fetchAnalytics]);

  // Check if we should use analytics service
  if (USE_ANALYTICS_SERVICE) {
    return <AnalyticsServiceAdvancedAnalytics />;
  }

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

  // Colors for charts
  const COLORS = [
    primaryColor || '#6366f1',
    secondaryColor || '#8b5cf6',
    '#ec4899',
    '#14b8a6',
    '#f59e0b',
    '#ef4444',
    '#84cc16',
    '#06b6d4',
    '#f97316',
    '#8b5cf6'
  ];

  // If loading and no agents, show loading state
  if (isLoading && agents.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading analytics...</div>
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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-white">Advanced Analytics</h2>

        <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
          {/* Agent selector */}
          <div className="relative">
            <select
              value={selectedAgent?.id || ''}
              onChange={(e) => {
                const agent = agents.find(a => a.id === e.target.value);
                if (agent) handleAgentSelect(agent);
              }}
              className="bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2 pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-opacity-50"
              style={{ minWidth: '200px' }}
            >
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
              className="flex items-center space-x-2 bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2"
            >
              <FiFilter className="h-4 w-4" />
              <span>{timeRangeOptions.find(o => o.value === selectedTimeRange)?.label || 'Filter'}</span>
              <FiChevronDown className="h-4 w-4" />
            </button>

            {showFilterDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-md shadow-lg py-1 z-10 border border-gray-700">
                {timeRangeOptions.map((option) => (
                  <button
                    key={option.value}
                    className={`block w-full text-left px-4 py-2 text-sm ${
                      selectedTimeRange === option.value ? 'text-white' : 'text-gray-300 hover:bg-gray-700'
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

          {/* Export button */}
          <button
            className="flex items-center space-x-2 bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2"
            onClick={() => {
              // Export functionality would go here
              alert('Export functionality will be implemented in a future update.');
            }}
          >
            <FiDownload className="h-4 w-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {error ? (
        <div className="bg-red-900/20 border border-red-800 text-red-200 p-4 rounded-lg">
          {error}
        </div>
      ) : isLoading ? (
        <div className="animate-pulse space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-800/30 h-80 rounded-lg"></div>
            <div className="bg-gray-800/30 h-80 rounded-lg"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-800/30 h-80 rounded-lg"></div>
            <div className="bg-gray-800/30 h-80 rounded-lg"></div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Call Volume Over Time */}
          <div className="bg-gray-800/30 rounded-lg border border-gray-800 p-6">
            <h3 className="text-lg font-medium text-white mb-4">Call Volume Over Time</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={callVolumeData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F9FAFB' }}
                    itemStyle={{ color: '#F9FAFB' }}
                    labelStyle={{ color: '#F9FAFB' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke={primaryColor}
                    fill={`${primaryColor}40`}
                    name="Calls"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Sentiment Analysis */}
            <div className="bg-gray-800/30 rounded-lg border border-gray-800 p-6">
              <h3 className="text-lg font-medium text-white mb-4">Sentiment Analysis</h3>
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
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F9FAFB' }}
                      itemStyle={{ color: '#F9FAFB' }}
                      formatter={(value: any) => [`${value} calls`, 'Count']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Topics */}
            <div className="bg-gray-800/30 rounded-lg border border-gray-800 p-6">
              <h3 className="text-lg font-medium text-white mb-4">Top Topics</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topicData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis type="number" stroke="#9CA3AF" />
                    <YAxis
                      dataKey="topic"
                      type="category"
                      stroke="#9CA3AF"
                      width={100}
                      tickFormatter={(value) => value.length > 15 ? `${value.substring(0, 15)}...` : value}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F9FAFB' }}
                      itemStyle={{ color: '#F9FAFB' }}
                      formatter={(value: any) => [`${value} mentions`, 'Count']}
                    />
                    <Bar dataKey="count" fill={primaryColor} name="Mentions" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Key Moments */}
            <div className="bg-gray-800/30 rounded-lg border border-gray-800 p-6">
              <h3 className="text-lg font-medium text-white mb-4">Key Moments</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={keyMomentData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      fill="#8884d8"
                      paddingAngle={5}
                      dataKey="count"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {keyMomentData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F9FAFB' }}
                      itemStyle={{ color: '#F9FAFB' }}
                      formatter={(value: any) => [`${value} occurrences`, 'Count']}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Action Items */}
            <div className="bg-gray-800/30 rounded-lg border border-gray-800 p-6">
              <h3 className="text-lg font-medium text-white mb-4">Top Action Items</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={actionItemData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis type="number" stroke="#9CA3AF" />
                    <YAxis
                      dataKey="action"
                      type="category"
                      stroke="#9CA3AF"
                      width={100}
                      tickFormatter={(value) => value.length > 15 ? `${value.substring(0, 15)}...` : value}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F9FAFB' }}
                      itemStyle={{ color: '#F9FAFB' }}
                      formatter={(value: any) => [`${value} occurrences`, 'Count']}
                    />
                    <Bar dataKey="count" fill={secondaryColor || '#8b5cf6'} name="Occurrences" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedAnalytics;
