'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Tab } from '@headlessui/react';
import { FiClock, FiPhoneCall, FiDollarSign, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import {
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { formatDuration, formatCurrency } from '@/lib/utils';
import { analyticsCache } from '@/lib/cache';
import { usePartnerBranding } from '@/lib/partnerBranding';

interface Agent {
  id: string;
  name: string;
  assistantId: string;
  customerId?: string;
  type?: 'vapi' | 'retell' | 'ultravox';  // Keep for internal use only
}

interface AgentAnalytics {
  totalDuration: number;
  avgCost: number;
  callCount: number;
  failedCalls: number;
  avgDuration: number;
  totalCost: number;
  successRate: number;
  failureReasons?: { reason: string; count: number }[];
}

interface AgentUsage extends Agent {
  analytics?: AgentAnalytics;
  isLoading?: boolean;
}

interface TimeSeriesDataPoint {
  time: string;
  hour: number;
  count: number;
}

declare global {
  interface Window {
    callTimeSeriesData?: {
      agentType: string;
      agentId: string;
      data: any[];
      metadata: {
        timeField: string;
        timeFormat: string;
      };
    };
  }
}

const DetailedUsage: React.FC = () => {
  const { branding } = usePartnerBranding();
  const { primaryColor, secondaryColor } = branding;

  const [agents, setAgents] = useState<AgentUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentUsage | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month'>('month');
  // These states are kept for future use when we implement filtering by agent type
  const [hasLoadedAllTypes, setHasLoadedAllTypes] = useState(false);
  // State for customer features
  const [customerFeatures, setCustomerFeatures] = useState<{
    showPricingInformation?: boolean;
  }>({ showPricingInformation: true });

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
        // Default to showing pricing if there's an error
        setCustomerFeatures({ showPricingInformation: true });
      }
    };

    fetchCustomerFeatures();
  }, []);

  useEffect(() => {
    // Load both types of agents when component mounts
    const loadAllAgents = async () => {
      setLoading(true);

      try {
        // Fetch VAPI agents
        const vapiResponse = await fetch('/api/whitelabel/vapi-agents');
        let vapiAgents: Agent[] = [];

        if (vapiResponse.ok) {
          const data = await vapiResponse.json();
          vapiAgents = data.map((agent: Agent) => ({
            ...agent,
            type: 'vapi'
          }));
        }

        // Fetch Retell agents
        const retellResponse = await fetch('/api/whitelabel/retell-agents');
        let retellAgents: Agent[] = [];

        if (retellResponse.ok) {
          const data = await retellResponse.json();
          retellAgents = data.map((agent: Agent) => ({
            ...agent,
            type: 'retell'
          }));
        }

        // Fetch Ultravox agents
        const ultravoxResponse = await fetch('/api/whitelabel/ultravox-agents');
        let ultravoxAgents: Agent[] = [];

        if (ultravoxResponse.ok) {
          const data = await ultravoxResponse.json();
          ultravoxAgents = data.map((agent: Agent) => ({
            ...agent,
            type: 'ultravox'
          }));
        }

        // Combine all agents
        const combined = [...vapiAgents, ...retellAgents, ...ultravoxAgents];
        setAgents(combined);
        setHasLoadedAllTypes(true);
        setError(null);
      } catch (error) {
        console.error('Error fetching agents:', error);
        setError('An unexpected error occurred. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadAllAgents();
  }, []);

  const processAnalyticsData = (data: any[], agentId: string): AgentAnalytics => {
    const durationData = data.find(d => d.name === "Total Call Duration")?.result.find((r: any) => r.assistantId === agentId) || {};
    const avgCostData = data.find(d => d.name === "Average Call Cost")?.result.find((r: any) => r.assistantId === agentId) || {};
    const callsData = data.find(d => d.name === "Number of Calls by Assistants")?.result.find((r: any) => r.assistantId === agentId) || {};
    const avgDurationData = data.find(d => d.name === "Average Call Duration by Assistant")?.result.find((r: any) => r.assistantId === agentId) || {};
    const totalSpentData = data.find(d => d.name === "Total Spent")?.result.find((r: any) => r.assistantId === agentId) || {};

    const failedCallsData = data.find(d => d.name === "Number of Failed Calls")?.result
      .filter((r: any) => r.assistantId === agentId) || [];

    const successEvalData = data.find(d => d.name === "Success Evaluation")?.result
      .filter((r: any) => r.assistantId === agentId) || [];

    const totalCalls = parseInt(callsData.countId || '0');
    const successfulCalls = successEvalData
      .filter((r: any) => r['analysis.successEvaluation'] === 'true')
      .reduce((acc: number, curr: any) => acc + parseInt(curr.countId || '0'), 0);

    // Group failure reasons
    const failureReasons = failedCallsData.reduce((acc: any[], curr: any) => {
      const reason = curr.endedReason || 'Unknown';
      const count = parseInt(curr.countId || '0');
      const existing = acc.find(r => r.reason === reason);
      if (existing) {
        existing.count += count;
      } else {
        acc.push({ reason, count });
      }
      return acc;
    }, []);

    return {
      totalDuration: durationData.sumDuration || 0,
      avgCost: avgCostData.avgCost || 0,
      callCount: totalCalls,
      failedCalls: failedCallsData.reduce((acc: number, curr: any) => acc + parseInt(curr.countId || '0'), 0),
      avgDuration: avgDurationData.avgDuration || 0,
      totalCost: totalSpentData.sumCost || 0,
      successRate: totalCalls ? (successfulCalls / totalCalls) * 100 : 0,
      failureReasons: failureReasons.length > 0 ? failureReasons : undefined
    };
  };

  const fetchAnalytics = async (agent: AgentUsage, period: string) => {
    const cacheKey = `customer_analytics_${agent.type}_${agent.id}_${period}`;
    const cachedData = analyticsCache.get<AgentAnalytics>(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    try {
      const endpoint = agent.type === 'vapi'
        ? `/api/whitelabel/vapi-agents/${agent.id}/analytics?period=${period}`
        : agent.type === 'retell'
        ? `/api/whitelabel/retell-agents/${agent.id}/analytics?period=${period}`
        : `/api/whitelabel/ultravox-agents/${agent.id}/analytics?period=${period}`;

      const response = await fetch(endpoint);

      if (!response.ok) {
        throw new Error(`Failed to fetch analytics`);
      }

      const data = await response.json();
      const analytics = processAnalyticsData(data, agent.id);
      analyticsCache.set(cacheKey, analytics);
      return analytics;
    } catch (error) {
      console.error(`Error fetching analytics:`, error);
      throw error;
    }
  };

  const handleAgentClick = async (agent: AgentUsage) => {
    setSelectedAgent(agent);

    setAgents(prev => prev.map(a =>
      a.id === agent.id ? { ...a, isLoading: true } : a
    ));

    try {
      const analytics = await fetchAnalytics(agent, selectedPeriod);
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
    setSelectedPeriod(period);
    if (selectedAgent) {
      await handleAgentClick(selectedAgent);
    }
  };

  const AgentTile = ({ agent }: { agent: AgentUsage }) => (
    <div
      onClick={() => handleAgentClick(agent)}
      className={`p-6 rounded-lg cursor-pointer transition-all duration-300 ${
        selectedAgent?.id === agent.id
          ? `bg-opacity-20 border`
          : 'bg-gray-800/50 hover:bg-gray-800 border-gray-700 border'
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
        </div>
      ) : agent.analytics ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center text-gray-400">
              <FiPhoneCall className="mr-2" />
              <span>Total Calls</span>
            </div>
            <span className="text-white">{agent.analytics.callCount}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center text-gray-400">
              <FiClock className="mr-2" />
              <span>Total Minutes</span>
            </div>
            <span className="text-white">{formatDuration(agent.analytics.totalDuration)}</span>
          </div>

          {customerFeatures.showPricingInformation && (
            <div className="flex items-center justify-between">
              <div className="flex items-center text-gray-400">
                <FiDollarSign className="mr-2" />
                <span>Total Cost</span>
              </div>
              <span className="text-white">{formatCurrency(agent.analytics.totalCost)}</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center text-gray-400">
              <FiCheckCircle className="mr-2" />
              <span>Success Rate</span>
            </div>
            <span className="text-white">{agent.analytics.successRate.toFixed(1)}%</span>
          </div>
        </div>
      ) : (
        <div className="text-gray-400">Click to view analytics</div>
      )}
    </div>
  );

  const DetailedView = ({ agent }: { agent: AgentUsage }) => {
    const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesDataPoint[]>([]);
    const [isLoadingTimeSeriesData, setIsLoadingTimeSeriesData] = useState(false);

    const processTimeSeriesData = useCallback(() => {
      try {
        // Only process time series data if analytics is available
        if (!agent.analytics) return;

        // Check if we have data in the global window variable
        if (!window.callTimeSeriesData ||
            window.callTimeSeriesData.agentId !== agent.id ||
            window.callTimeSeriesData.agentType !== agent.type) {
          return;
        }

        const { data, metadata } = window.callTimeSeriesData;
        const { timeField, timeFormat } = metadata;

        // Process the data to create time series
        const timeSeriesMap = new Map<number, number>();

        // Initialize all hours with 0 count
        for (let i = 0; i < 24; i++) {
          timeSeriesMap.set(i, 0);
        }

        // Filter data to match the analytics period and count
        // For VAPI agents, we need to ensure we're only counting completed calls
        // that match what's reported in the analytics
        let filteredData = data;

        if (agent.type === 'vapi') {
          // Filter to include only completed calls to match analytics
          filteredData = data.filter((item: any) =>
            item.status === 'completed' ||
            item.status === 'ended'
          );

          // If the filtered count still doesn't match analytics, limit to the most recent calls
          if (filteredData.length > agent.analytics.callCount) {
            filteredData = filteredData.slice(0, agent.analytics.callCount);
          }
        }

        // Count calls by hour
        filteredData.forEach((item: any) => {
          let timestamp: Date;

          if (timeFormat === 'iso') {
            timestamp = new Date(item[timeField]);
          } else if (timeFormat === 'unix') {
            timestamp = new Date(parseInt(item[timeField], 10));
          } else {
            return;
          }

          const hour = timestamp.getHours();
          timeSeriesMap.set(hour, (timeSeriesMap.get(hour) || 0) + 1);
        });

        // Convert map to array for Recharts
        const timeSeriesArray = Array.from(timeSeriesMap.entries()).map(([hour, count]) => ({
          time: `${hour}:00`,
          hour,
          count
        }));

        // Sort by hour
        timeSeriesArray.sort((a, b) => a.hour - b.hour);

        // Verify total count matches analytics
        const totalCount = timeSeriesArray.reduce((sum, point) => sum + point.count, 0);
        console.log(`Time series total count: ${totalCount}, Analytics count: ${agent.analytics.callCount}`);

        setTimeSeriesData(timeSeriesArray);
      } catch (error) {
        console.error('Error processing time series data:', error);
      }
    }, [agent.id, agent.type, agent.analytics]);

    useEffect(() => {
      processTimeSeriesData();
    }, [processTimeSeriesData]);

    if (!agent.analytics) return null;

    const analytics = agent.analytics;

    // Ensure we don't have negative values in the call status data
    const successfulCalls = Math.max(0, agent.analytics.callCount - agent.analytics.failedCalls);
    const failedCalls = Math.max(0, agent.analytics.failedCalls);

    const callStatusData = [
      { name: 'Successful', value: successfulCalls },
      { name: 'Failed', value: failedCalls }
    ];

    // Filter out any entries with zero value to avoid empty segments
    const filteredCallStatusData = callStatusData.filter(item => item.value > 0);

    const COLORS = [primaryColor || '#6366f1', secondaryColor || '#8b5cf6']; // Primary and secondary colors

    // Function to fetch conversation data for time series
    const fetchTimeSeriesData = async () => {
      if (!agent.id || !agent.type) return;

      setIsLoadingTimeSeriesData(true);

      try {
        // Fetch conversations data for time series
        const period = 'month'; // Default to month view
        const response = await fetch(`/api/whitelabel/conversations?agentId=${agent.id}&period=${period}&agentType=${agent.type}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch ${agent.type} conversations for time series`);
        }

        const responseData = await response.json();

        if (!responseData || !responseData.data || !responseData.metadata) {
          throw new Error('Invalid response data format');
        }

        // Store in global window variable
        window.callTimeSeriesData = {
          agentType: agent.type,
          agentId: agent.id,
          data: responseData.data,
          metadata: responseData.metadata
        };

        // Process the data
        processTimeSeriesData();
      } catch (error) {
        console.error('Error fetching time series data:', error);
      } finally {
        setIsLoadingTimeSeriesData(false);
      }
    };

    return (
      <div className="mt-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
            <h4 className="text-gray-400 mb-2">Total Calls</h4>
            <div className="text-2xl font-bold text-white">{analytics.callCount}</div>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
            <h4 className="text-gray-400 mb-2">Total Minutes</h4>
            <div className="text-2xl font-bold text-white">{formatDuration(analytics.totalDuration)}</div>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
            <h4 className="text-gray-400 mb-2">Average Call Duration</h4>
            <div className="text-2xl font-bold text-white">{formatDuration(analytics.avgDuration)}</div>
          </div>

          {customerFeatures.showPricingInformation && (
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <h4 className="text-gray-400 mb-2">Average Cost per Call</h4>
              <div className="text-2xl font-bold text-white">{formatCurrency(analytics.avgCost)}</div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
            <h4 className="text-gray-400 mb-4">Call Success Rate</h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={filteredCallStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value, percent }) =>
                      `${name}: ${value} (${(percent * 100).toFixed(1)}%)`
                    }
                  >
                    {filteredCallStatusData.map((entry, index) => {
                      // Use primary color for "Successful" and secondary color for "Failed"
                      const color = entry.name === 'Successful' ? COLORS[0] : COLORS[1];
                      return <Cell key={`cell-${index}`} fill={color} />;
                    })}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
            <h4 className="text-gray-400 mb-4">Call Time Distribution</h4>
            {isLoadingTimeSeriesData ? (
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                <div className="h-4 bg-gray-700 rounded w-1/2"></div>
              </div>
            ) : timeSeriesData.length === 0 ? (
              <button
                className="px-4 py-2 rounded-lg text-white"
                style={{ backgroundColor: primaryColor }}
                onClick={fetchTimeSeriesData}
              >
                Fetch Call Data
              </button>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={timeSeriesData}
                    margin={{
                      top: 10,
                      right: 30,
                      left: 0,
                      bottom: 0,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="count" stroke={primaryColor} fill={primaryColor} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {analytics.failureReasons && analytics.failureReasons.length > 0 && (
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <h4 className="text-gray-400 mb-4">Failure Reasons</h4>
              <div className="space-y-4">
                {analytics.failureReasons.map((reason, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center text-gray-400">
                      <FiXCircle className="mr-2 text-red-500" />
                      <span className="capitalize">{reason.reason}</span>
                    </div>
                    <span className="text-white">{reason.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="text-gray-400">Loading your AI agents...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-white">AI Agent Usage Analytics</h2>

        <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
          {/* Time Period Selector */}
          <Tab.Group>
            <Tab.List className="flex space-x-2 rounded-xl bg-gray-800/50 p-1">
              {['day', 'week', 'month'].map((period) => (
                <Tab
                  key={period}
                  onClick={() => handlePeriodChange(period as 'day' | 'week' | 'month')}
                  className={({ selected }) =>
                    `px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                      selected
                        ? 'text-white'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                    }`
                  }
                  style={
                    { backgroundColor: selectedPeriod === period ? `${primaryColor}20` : undefined,
                      color: selectedPeriod === period ? primaryColor : undefined }
                  }
                >
                  {period.charAt(0).toUpperCase() + period.slice(1)}
                </Tab>
              ))}
            </Tab.List>
          </Tab.Group>
        </div>
      </div>

      {agents.length === 0 ? (
        <div className="bg-gray-800/50 rounded-lg p-8 text-center">
          <p className="text-gray-400 mb-4">No AI agents assigned to your account.</p>
          <p className="text-gray-500">Contact your partner to get AI agents assigned.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map(agent => (
              <AgentTile key={agent.id} agent={agent} />
            ))}
          </div>

          {selectedAgent && (
            <DetailedView agent={selectedAgent} />
          )}
        </>
      )}
    </div>
  );
};

export default DetailedUsage;
