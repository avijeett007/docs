'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Tab } from '@headlessui/react';
import { FiClock, FiPhoneCall, FiDollarSign, FiCheckCircle, FiXCircle, FiTrendingUp } from 'react-icons/fi';
import {
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { formatDuration, formatCurrency } from '@/lib/utils';
import { usePartnerBranding } from '@/lib/partnerBranding';

interface Agent {
  id: string;
  name: string;
  assistantId: string;
  customerId?: string;
  type?: 'vapi' | 'retell';
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
  };
}

interface AgentUsage extends Agent {
  analytics?: AgentAnalytics;
  isLoading?: boolean;
}

const AnalyticsServiceDetailedUsage: React.FC = () => {
  const { branding } = usePartnerBranding();
  const { primaryColor, secondaryColor } = branding;
  const [agents, setAgents] = useState<AgentUsage[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentUsage | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month'>('month');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        type: agent.type || 'vapi' // Default to vapi if type not specified
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

  // Process analytics data from the new analytics service format
  const processAnalyticsData = (data: any[], agentId: string): AgentAnalytics => {
    // Find relevant data from the analytics response
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
  };

  // Fetch analytics using the new analytics service
  const fetchAnalytics = async (agent: AgentUsage, period: string) => {
    try {
      console.log('Fetching analytics from analytics service for agent:', agent.id);
      
      const response = await fetch(`/api/whitelabel/analytics/agent/${agent.id}?period=${period}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch analytics`);
      }

      const data = await response.json();
      const analytics = processAnalyticsData(data, agent.id);
      
      console.log('Successfully processed analytics from service:', analytics);
      return analytics;
    } catch (error) {
      console.error(`Error fetching analytics from service:`, error);
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
      // Clear existing analytics data to show loading state
      setAgents(prev => prev.map(a =>
        a.id === selectedAgent.id ? { ...a, analytics: undefined, isLoading: true } : a
      ));

      // Fetch new analytics for the selected period
      await handleAgentClick(selectedAgent);
    }
  };

  // Load agents when component mounts
  useEffect(() => {
    fetchAllAgents();
  }, [fetchAllAgents]);

  const AgentTile = ({ agent }: { agent: AgentUsage }) => (
    <div
      onClick={() => handleAgentClick(agent)}
      className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 border border-gray-700 hover:border-blue-500 transition-all cursor-pointer group"
    >
      <div className="flex flex-col h-full">
        <h3 className="text-lg font-semibold mb-4 group-hover:text-blue-400 transition-colors">{agent.name}</h3>
        {agent.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : agent.analytics ? (
          <div className="flex-1 space-y-4">
            <div className="flex items-center text-gray-300 group-hover:text-gray-200 transition-colors">
              <FiClock className="w-5 h-5 mr-2" />
              <span>Avg Duration: {formatDuration(agent.analytics.avgDuration)}</span>
            </div>
            <div className="flex items-center text-gray-300 group-hover:text-gray-200 transition-colors">
              <FiPhoneCall className="w-5 h-5 mr-2" />
              <span>Total Calls: {agent.analytics.callCount}</span>
            </div>
            <div className="flex items-center text-gray-300 group-hover:text-gray-200 transition-colors">
              <FiDollarSign className="w-5 h-5 mr-2" />
              <span>Total Cost: {formatCurrency(agent.analytics.totalCost)}</span>
            </div>
            <div className="flex items-center text-green-400">
              <FiTrendingUp className="w-5 h-5 mr-2" />
              <span>Success Rate: {agent.analytics.successRate.toFixed(1)}%</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-8">
            <p className="text-gray-400">Click to load analytics</p>
          </div>
        )}
      </div>
    </div>
  );

  const DetailedView = ({ agent }: { agent: AgentUsage }) => {
    const currentAgent = agents.find(a => a.id === agent.id);
    const usage = currentAgent?.analytics;

    if (!usage) return null;

    const costBreakdownData = usage.costBreakdown ? [
      { name: 'LLM', value: usage.costBreakdown.llm, color: '#0088FE' },
      { name: 'STT', value: usage.costBreakdown.stt, color: '#00C49F' },
      { name: 'TTS', value: usage.costBreakdown.tts, color: '#FFBB28' },
      { name: 'VAPI', value: usage.costBreakdown.vapi || 0, color: '#FF8042' },
    ].filter(item => item.value > 0) : [];

    return (
      <div className="mt-8 bg-gray-800/30 rounded-lg border border-gray-800 p-6">
        <h2 className="text-2xl font-bold text-white mb-6">Detailed Analytics - {agent.name}</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Cost Breakdown Chart */}
          {costBreakdownData.length > 0 && (
            <div className="bg-gray-800/50 rounded-lg p-6">
              <h3 className="text-lg font-medium text-white mb-4">Cost Breakdown</h3>
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

          {/* Summary Stats */}
          <div className="bg-gray-800/50 rounded-lg p-6">
            <h3 className="text-lg font-medium text-white mb-4">Summary Statistics</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Total Calls:</span>
                <span className="text-white font-medium">{usage.callCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Success Rate:</span>
                <span className="text-green-400 font-medium">{usage.successRate.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Failed Calls:</span>
                <span className="text-red-400 font-medium">{usage.failedCalls}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Avg Duration:</span>
                <span className="text-white font-medium">{formatDuration(usage.avgDuration)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Avg Cost:</span>
                <span className="text-white font-medium">{formatCurrency(usage.avgCost)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Total Cost:</span>
                <span className="text-white font-medium">{formatCurrency(usage.totalCost)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400 text-lg mb-4">{error}</p>
        <button
          onClick={fetchAllAgents}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">
          AI Usage Analytics 
        </h1>
        
        {/* Period Selection */}
        <div className="flex space-x-2">
          {(['day', 'week', 'month'] as const).map((period) => (
            <button
              key={period}
              onClick={() => handlePeriodChange(period)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                selectedPeriod === period
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              {period.charAt(0).toUpperCase() + period.slice(1)}
            </button>
          ))}
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

export default AnalyticsServiceDetailedUsage;
