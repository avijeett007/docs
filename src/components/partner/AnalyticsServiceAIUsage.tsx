'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiClock, FiPhoneCall, FiDollarSign, FiRefreshCw, FiTrendingUp, FiActivity, FiBarChart, FiZap, FiTarget, FiUsers, FiCheckCircle } from 'react-icons/fi';
import toast, { Toaster } from 'react-hot-toast';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';
import PartnerSidebar from '@/components/partner/PartnerSidebar';

// Format duration in seconds to readable format with max 3 decimal places
const formatDuration = (seconds: number) => {
  if (isNaN(seconds) || seconds < 0) return '0s';

  // Round to max 3 decimal places first
  const roundedSeconds = parseFloat(seconds.toFixed(3));

  const hours = Math.floor(roundedSeconds / 3600);
  const minutes = Math.floor((roundedSeconds % 3600) / 60);
  const remainingSeconds = roundedSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${Math.floor(remainingSeconds)}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${Math.floor(remainingSeconds)}s`;
  } else {
    // For seconds less than 1 minute, show with decimals if needed but max 3 decimal places
    if (remainingSeconds % 1 === 0) {
      return `${Math.floor(remainingSeconds)}s`;
    } else {
      return `${parseFloat(remainingSeconds.toFixed(3))}s`;
    }
  }
};

// Helper function to format numbers with max 3 decimal places
const formatNumber = (num: number, maxDecimals: number = 3): string => {
  if (isNaN(num) || num === null || num === undefined) return '0';

  // If it's a whole number, return as is
  if (num % 1 === 0) return num.toString();

  // Otherwise, limit decimal places and remove trailing zeros
  return parseFloat(num.toFixed(maxDecimals)).toString();
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

interface Agent {
  id: string;
  name: string;
  assistantId?: string;
  customerId?: string;
  profitMultiplier?: number;
  type: 'vapi' | 'retell' | 'ultravox' | 'ghl' | 'elevenlabs' | 'retell_chat';
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
    telephony?: number;
  };
}

interface SummaryData {
  totalCost: number;
  totalDuration: number;
  totalCalls: number;
  failedCalls: number;
  successRate: number;
  avgDuration: number;
  avgCost: number;
  avgCostPerMinute: number;
  productCosts: Array<{ product: string; cost: number }>;
}

interface AgentWithAnalytics extends Agent {
  analytics?: AgentAnalytics;
  isLoading?: boolean;
  actualCost?: number;
  billableCost?: number;
  profitAmount?: number;
  profitMargin?: number;
}

export default function AnalyticsServiceAIUsage() {
  const router = useRouter();
  const [partnerName, setPartnerName] = useState('');
  const [agents, setAgents] = useState<AgentWithAnalytics[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month'>('month');
  const [selectedProvider, setSelectedProvider] = useState<'all' | 'vapi' | 'retell' | 'ultravox' | 'ghl' | 'elevenlabs' | 'retell_chat'>('all');
  const [selectedAgent, setSelectedAgent] = useState<AgentWithAnalytics | null>(null);

  // Summary state
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Agent analytics state
  const [agentAnalytics, setAgentAnalytics] = useState<Record<string, AgentAnalytics>>({});
  const [loadingAgents, setLoadingAgents] = useState<Set<string>>(new Set());
  const [allAgentsLoaded, setAllAgentsLoaded] = useState(false);

  // Lazy loading states for charts
  const [providerChartLoading, setProviderChartLoading] = useState(false);
  const [providerChartLoaded, setProviderChartLoaded] = useState(false);
  const [agentChartLoading, setAgentChartLoading] = useState(false);
  const [agentChartLoaded, setAgentChartLoaded] = useState(false);

  // Check authentication on mount
  useEffect(() => {
    const token = localStorage.getItem('partner_token');
    if (!token) {
      router.push('/partner/login');
      return;
    }

    fetchInitialData(token);
  }, [router]);

  // Fetch summary when period changes (no auto-loading of agent analytics)
  useEffect(() => {
    fetchSummary();

    // Reset chart loading states when period changes
    if (agents.length > 0) {
      console.log(`Period changed to ${selectedPeriod}, resetting chart states`);
      setProviderChartLoaded(false);
      setAgentChartLoaded(false);
      // Clear existing agent analytics to force reload when requested
      setAgents(prev => prev.map(agent => ({ ...agent, analytics: undefined })));
      setAgentAnalytics({});
    }
  }, [selectedPeriod, agents.length]);

  const fetchInitialData = async (token: string) => {
    try {
      setInitialLoading(true);

      // Step 1: Fetch partner info and summary first (fast)
      const [partnerResponse] = await Promise.all([
        fetch('/api/partner/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetchSummary() // Load summary immediately
      ]);

      if (partnerResponse.ok) {
        const partnerData = await partnerResponse.json();
        setPartnerName(partnerData.partner?.businessName || 'Partner');
      }

      // Step 2: Load agents in background
      setAgentsLoading(true);
      await loadAgents(token);

    } catch (error) {
      console.error('Error fetching initial data:', error);
      setError('Failed to load data');
    } finally {
      setInitialLoading(false);
    }
  };

  const loadAgents = async (token: string) => {
    try {
      console.log('Loading agents...');

      // Fetch all agents
      const [vapiResponse, retellResponse, ultravoxResponse, ghlResponse, elevenLabsResponse, retellChatResponse] = await Promise.all([
        fetch('/api/partner/vapi-agents', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/partner/retell-agents', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/partner/ultravox-agents', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/partner/ghl-agents', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/partner/elevenlabs-agents', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/partner/retell-chat-agents', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const allAgents: AgentWithAnalytics[] = [];

      if (vapiResponse.ok) {
        const vapiData = await vapiResponse.json();
        console.log('VAPI response:', vapiData);
        // API returns agents directly, not wrapped in agents property
        const vapiAgents = Array.isArray(vapiData) ? vapiData : [];
        allAgents.push(...vapiAgents.map((agent: any) => ({
          ...agent,
          type: 'vapi' as const
        })));
      } else {
        console.error('VAPI agents fetch failed:', vapiResponse.status);
      }

      if (retellResponse.ok) {
        const retellData = await retellResponse.json();
        console.log('Retell response:', retellData);
        // API returns agents directly, not wrapped in agents property
        const retellAgents = Array.isArray(retellData) ? retellData : [];
        allAgents.push(...retellAgents.map((agent: any) => ({
          ...agent,
          type: 'retell' as const
        })));
      } else {
        console.error('Retell agents fetch failed:', retellResponse.status);
      }

      if (ultravoxResponse.ok) {
        const ultravoxData = await ultravoxResponse.json();
        console.log('Ultravox response:', ultravoxData);
        // API returns agents directly, not wrapped in agents property
        const ultravoxAgents = Array.isArray(ultravoxData) ? ultravoxData : [];
        allAgents.push(...ultravoxAgents.map((agent: any) => ({
          ...agent,
          type: 'ultravox' as const
        })));
      } else {
        console.error('Ultravox agents fetch failed:', ultravoxResponse.status);
      }

      if (ghlResponse.ok) {
        const ghlData = await ghlResponse.json();
        console.log('GHL response:', ghlData);
        // API returns agents directly, not wrapped in agents property
        const ghlAgents = Array.isArray(ghlData.agents) ? ghlData.agents : [];
        allAgents.push(...ghlAgents.map((agent: any) => ({
          ...agent,
          type: 'ghl' as const
        })));
      } else {
        console.error('GHL agents fetch failed:', ghlResponse.status);
      }

      if (elevenLabsResponse.ok) {
        const elevenLabsData = await elevenLabsResponse.json();
        console.log('ElevenLabs response:', elevenLabsData);
        // API returns agents wrapped in agents property
        const elevenLabsAgents = Array.isArray(elevenLabsData.agents) ? elevenLabsData.agents : [];
        allAgents.push(...elevenLabsAgents.map((agent: any) => ({
          ...agent,
          type: 'elevenlabs' as const
        })));
      } else {
        console.error('ElevenLabs agents fetch failed:', elevenLabsResponse.status);
      }

      if (retellChatResponse.ok) {
        const retellChatData = await retellChatResponse.json();
        console.log('Retell Chat response:', retellChatData);
        const retellChatAgents = Array.isArray(retellChatData) ? retellChatData : (retellChatData.agents || []);
        allAgents.push(...retellChatAgents.map((agent: any) => ({
          ...agent,
          type: 'retell_chat' as const
        })));
      } else {
        console.error('Retell Chat agents fetch failed:', retellChatResponse.status);
      }

      console.log(`Found ${allAgents.length} total agents`);
      setAgents(allAgents);

      // No auto-loading of analytics - will be loaded on demand

    } catch (error) {
      console.error('Error loading agents:', error);
    } finally {
      setAgentsLoading(false);
    }
  };

  const loadAllAgentAnalytics = async (agentsList: AgentWithAnalytics[]) => {
    try {
      console.log('Loading analytics for all agents...');
      setAllAgentsLoaded(false); // Reset loading state

      // Clear existing analytics to show loading state
      setAgents(prev => prev.map(agent => ({ ...agent, analytics: undefined, isLoading: true })));

      const promises = agentsList.map(agent => fetchAgentAnalytics(agent.id, false));
      await Promise.allSettled(promises);
      setAllAgentsLoaded(true);
      console.log('All agent analytics loaded');
    } catch (error) {
      console.error('Error loading all agent analytics:', error);
    }
  };

  // Load analytics for provider breakdown chart
  const loadProviderChartData = async () => {
    try {
      setProviderChartLoading(true);
      console.log('Loading provider chart data...');

      toast.loading('Loading provider breakdown...', { id: 'provider-chart' });

      // Load analytics for all agents (without individual toasts)
      const promises = agents.map(agent => fetchAgentAnalytics(agent.id, false));
      await Promise.allSettled(promises);

      setProviderChartLoaded(true);
      toast.success('Provider breakdown loaded', { id: 'provider-chart' });
    } catch (error) {
      console.error('Error loading provider chart data:', error);
      toast.error('Failed to load provider breakdown', { id: 'provider-chart' });
    } finally {
      setProviderChartLoading(false);
    }
  };

  // Load analytics for agent breakdown chart
  const loadAgentChartData = async () => {
    try {
      setAgentChartLoading(true);
      console.log('Loading agent chart data...');

      toast.loading('Loading agent breakdown...', { id: 'agent-chart' });

      // Load analytics for all agents (without individual toasts)
      const promises = agents.map(agent => fetchAgentAnalytics(agent.id, false));
      await Promise.allSettled(promises);

      setAgentChartLoaded(true);
      toast.success('Agent breakdown loaded', { id: 'agent-chart' });
    } catch (error) {
      console.error('Error loading agent chart data:', error);
      toast.error('Failed to load agent breakdown', { id: 'agent-chart' });
    } finally {
      setAgentChartLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      setSummaryLoading(true);
      const token = localStorage.getItem('partner_token');

      console.log('Fetching summary for period:', selectedPeriod);
      const response = await fetch(`/api/partner/analytics/summary?period=${selectedPeriod}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Summary data received:', data);
        setSummary(data);
        // Only show toast for manual refreshes, not initial load
        if (!initialLoading) {
          toast.success('Summary updated');
        }
      } else {
        console.error('Summary fetch failed:', response.status);
        throw new Error('Failed to fetch summary');
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
      if (!initialLoading) {
        toast.error('Failed to load summary');
      }
    } finally {
      setSummaryLoading(false);
    }
  };

  const fetchAgentAnalytics = async (agentId: string, showToast: boolean = true) => {
    try {
      setLoadingAgents(prev => new Set(prev).add(agentId));
      const token = localStorage.getItem('partner_token');

      // Show loading toast for individual agent loads
      if (showToast) {
        const agent = agents.find(a => a.id === agentId);
        toast.loading(`Loading analytics for ${agent?.name || 'agent'}...`, { id: `loading-${agentId}` });
      }

      const response = await fetch(`/api/partner/analytics/agent/${agentId}?period=${selectedPeriod}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        const analytics = processAnalyticsData(data);

        // Find the agent to get profit multiplier
        const agent = agents.find(a => a.id === agentId);
        const profitMultiplier = agent?.profitMultiplier || 1.2;

        // Calculate profit metrics
        const actualCost = analytics.totalCost / profitMultiplier; // Reverse the multiplier to get actual cost
        const billableCost = analytics.totalCost; // This is what partner charges
        const profitAmount = billableCost - actualCost;
        const profitMargin = actualCost > 0 ? (profitAmount / actualCost) * 100 : 0;

        // Update agent with analytics and profit data
        setAgents(prev => prev.map(a =>
          a.id === agentId ? {
            ...a,
            analytics,
            actualCost,
            billableCost,
            profitAmount,
            profitMargin,
            isLoading: false
          } : a
        ));

        setAgentAnalytics(prev => ({ ...prev, [agentId]: analytics }));

        // Show success toast for individual loads
        if (showToast) {
          toast.success(`Analytics loaded for ${agent?.name || 'agent'}`, { id: `loading-${agentId}` });
        }
      } else {
        throw new Error('Failed to fetch agent analytics');
      }
    } catch (error) {
      console.error('Error fetching agent analytics:', error);
      if (showToast) {
        const agent = agents.find(a => a.id === agentId);
        toast.error(`Failed to load analytics for ${agent?.name || 'agent'}`, { id: `loading-${agentId}` });
      }
    } finally {
      setLoadingAgents(prev => {
        const newSet = new Set(prev);
        newSet.delete(agentId);
        return newSet;
      });
    }
  };

  const processAnalyticsData = (data: any): AgentAnalytics => {
    // Check if this is the new analytics service format (direct object) or legacy format (array)
    if (Array.isArray(data)) {
      // Legacy format for VAPI/Retell
      const costData = data.find(item => item.name === 'Product Costs')?.result || [];
      const durationData = data.find(item => item.name === 'Total Call Duration')?.result?.[0] || {};
      const avgCostData = data.find(item => item.name === 'Average Call Cost')?.result?.[0] || {};
      const callCountData = data.find(item => item.name === 'Number of Calls by Assistants')?.result?.[0] || {};
      const failedCallsData = data.find(item => item.name === 'Number of Failed Calls')?.result?.[0] || {};
      const avgDurationData = data.find(item => item.name === 'Average Call Duration by Assistant')?.result?.[0] || {};
      const totalSpentData = data.find(item => item.name === 'Total Spent')?.result?.[0] || {};

      // Process cost breakdown
      const costBreakdown = costData.reduce((acc: any, item: any) => {
        acc[item.product] = item.cost || 0;
        return acc;
      }, {});

      const totalCalls = parseInt(callCountData.countId || '0');
      const failedCalls = parseInt(failedCallsData.countId || '0');

      return {
        totalDuration: durationData.sumDuration || 0,
        avgCost: avgCostData.avgCost || 0,
        callCount: totalCalls,
        failedCalls,
        avgDuration: avgDurationData.avgDuration || 0,
        totalCost: totalSpentData.sumCost || 0,
        successRate: totalCalls ? ((totalCalls - failedCalls) / totalCalls) * 100 : 0,
        costBreakdown
      };
    } else {
      // New format for Ultravox/GHL/ElevenLabs (direct object from analytics service)
      // Handle both field name formats: totalCalls/calls, totalCost/cost, totalDuration/duration
      const totalCalls = data.totalCalls || data.calls || 0;
      const totalCost = data.totalCost || data.cost || 0;
      const totalDuration = data.totalDuration || data.duration || 0;
      const failedCalls = data.failedCalls || data.missed || 0;

      const result = {
        totalDuration: totalDuration,
        avgCost: data.avgCost || (totalCalls > 0 ? totalCost / totalCalls : 0),
        callCount: totalCalls,
        failedCalls: failedCalls,
        avgDuration: data.avgDuration || (totalCalls > 0 ? totalDuration / totalCalls : 0),
        totalCost: totalCost,
        successRate: data.successRate || (totalCalls > 0 ? ((totalCalls - failedCalls) / totalCalls) * 100 : 0),
        // For Ultravox/GHL/ElevenLabs, we don't show detailed cost breakdown since it's a unified model
        costBreakdown: {
          llm: totalCost * 0.7 || 0, // Approximate breakdown for display
          stt: totalCost * 0.15 || 0,
          tts: totalCost * 0.15 || 0,
          telephony: 0
        }
      };
      return result;
    }
  };

  // Filter agents based on selected provider
  const filteredAgents = agents.filter(agent => {
    if (selectedProvider === 'all') return true;
    return agent.type === selectedProvider;
  });

  // Calculate aggregated analytics for charts
  const getProviderBreakdown = () => {
    const breakdown: Record<string, number> = { vapi: 0, retell: 0, ultravox: 0, ghl: 0, elevenlabs: 0, retell_chat: 0 };
    agents.forEach(agent => {
      if (agent.analytics) {
        breakdown[agent.type] = (breakdown[agent.type] || 0) + agent.analytics.totalCost;
      }
    });
    return [
      { name: 'VAPI', value: breakdown.vapi, color: '#3B82F6' },
      { name: 'Retell', value: breakdown.retell, color: '#8B5CF6' },
      { name: 'Ultravox', value: breakdown.ultravox, color: '#9333EA' },
      { name: 'GHL', value: breakdown.ghl, color: '#10B981' },
      { name: 'ElevenLabs', value: breakdown.elevenlabs, color: '#F59E0B' },
      { name: 'Retell Chat', value: breakdown.retell_chat, color: '#EC4899' }
    ].filter(item => item.value > 0);
  };

  const getAgentCostBreakdown = () => {
    return agents
      .filter(agent => agent.analytics && agent.analytics.totalCost > 0)
      .map(agent => ({
        name: agent.name,
        cost: agent.analytics!.totalCost,
        calls: agent.analytics!.callCount,
        avgCostPerMinute: agent.analytics!.totalDuration > 0 ?
          agent.analytics!.totalCost / (agent.analytics!.totalDuration / 60) : 0,
        type: agent.type
      }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10); // Top 10 agents
  };

  const getSuccessFailureData = () => {
    if (!summary) return [];
    return [
      { name: 'Successful', value: summary.totalCalls - summary.failedCalls, color: '#10B981' },
      { name: 'Failed', value: summary.failedCalls, color: '#EF4444' }
    ].filter(item => item.value > 0);
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading Analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-xl mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <Toaster position="top-right" />

      <div className="flex">
        <PartnerSidebar
          partnerName={partnerName}
          onLogout={() => {
            localStorage.removeItem('partner_token');
            router.push('/partner/login');
          }}
        />

        <main className="flex-1 ml-64 p-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-4xl font-bold text-white mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    AI Usage Analytics
                  </h1>
                  <p className="text-gray-400 text-lg">
                    Welcome back, {partnerName}! Enhanced analytics powered by our analytics service.
                  </p>
                </div>

                <div className="flex items-center space-x-4">
                  <button
                    onClick={fetchSummary}
                    disabled={summaryLoading}
                    className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    <FiRefreshCw className={`w-4 h-4 ${summaryLoading ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="mb-8 flex flex-wrap gap-4">
              {/* Period Selection */}
              <div className="flex items-center space-x-2">
                <label className="text-gray-400 text-sm font-medium">Period:</label>
                <div className="flex space-x-1 bg-gray-800/50 rounded-lg p-1">
                  {(['day', 'week', 'month'] as const).map((period) => (
                    <button
                      key={period}
                      onClick={() => setSelectedPeriod(period)}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        selectedPeriod === period
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-400 hover:text-white hover:bg-gray-700'
                      }`}
                    >
                      {period.charAt(0).toUpperCase() + period.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Provider Filter */}
              <div className="flex items-center space-x-2">
                <label className="text-gray-400 text-sm font-medium">Provider:</label>
                <div className="flex space-x-1 bg-gray-800/50 rounded-lg p-1">
                  {(['all', 'vapi', 'retell', 'ultravox', 'ghl', 'elevenlabs', 'retell_chat'] as const).map((provider) => (
                    <button
                      key={provider}
                      onClick={() => setSelectedProvider(provider)}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        selectedProvider === provider
                          ? 'bg-purple-600 text-white'
                          : 'text-gray-400 hover:text-white hover:bg-gray-700'
                      }`}
                    >
                      {provider === 'all' ? 'All' : provider === 'elevenlabs' ? 'ElevenLabs' : provider === 'retell_chat' ? 'Retell Chat' : provider.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Enhanced Summary Cards */}
            {summary && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
                <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 backdrop-blur-sm rounded-xl p-6 border border-blue-500/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-300 text-sm font-medium">Total Calls</p>
                      <p className="text-3xl font-bold text-white">{summary.totalCalls}</p>
                    </div>
                    <div className="p-3 bg-blue-500/20 rounded-lg">
                      <FiPhoneCall className="w-6 h-6 text-blue-400" />
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 backdrop-blur-sm rounded-xl p-6 border border-green-500/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-300 text-sm font-medium">Total Cost</p>
                      <p className="text-3xl font-bold text-white">{formatCurrency(summary.totalCost)}</p>
                    </div>
                    <div className="p-3 bg-green-500/20 rounded-lg">
                      <FiDollarSign className="w-6 h-6 text-green-400" />
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-200 text-sm font-medium">Avg Duration</p>
                      <p className="text-3xl font-bold text-white">{formatDuration(summary.avgDuration)}</p>
                    </div>
                    <div className="p-3 bg-purple-500/20 rounded-lg">
                      <FiClock className="w-6 h-6 text-purple-300" />
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 backdrop-blur-sm rounded-xl p-6 border border-yellow-500/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-amber-200 text-sm font-medium">Success Rate</p>
                      <p className="text-3xl font-bold text-white">{formatNumber(summary.successRate, 1)}%</p>
                    </div>
                    <div className="p-3 bg-yellow-500/20 rounded-lg">
                      <FiTrendingUp className="w-6 h-6 text-amber-300" />
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/20 backdrop-blur-sm rounded-xl p-6 border border-orange-500/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-orange-200 text-sm font-medium">Cost/Min</p>
                      <p className="text-3xl font-bold text-white">{formatCurrency(summary.avgCostPerMinute || 0)}</p>
                    </div>
                    <div className="p-3 bg-orange-500/20 rounded-lg">
                      <FiActivity className="w-6 h-6 text-orange-300" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Analytics Charts */}
            {summary && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Product Cost Breakdown */}
                <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
                  <h3 className="text-lg font-semibold text-white mb-4">Product Cost Breakdown</h3>
                  {summary.productCosts.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={summary.productCosts}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="cost"
                            label={({ product, percent }) => `${product}: ${formatNumber(percent * 100, 0)}%`}
                            labelLine={false}
                          >
                            {summary.productCosts.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={['#3B82F6', '#10B981', '#F59E0B', '#EF4444'][index % 4]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: any) => formatCurrency(value)}
                            contentStyle={{
                              backgroundColor: '#1F2937',
                              border: '1px solid #374151',
                              borderRadius: '8px',
                              color: '#F9FAFB'
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-gray-400">
                      No product cost data available
                    </div>
                  )}
                </div>

                {/* Provider Cost Breakdown */}
                <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">Cost by Provider</h3>
                    {providerChartLoading && (
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-400"></div>
                    )}
                  </div>
                  {providerChartLoaded && getProviderBreakdown().length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={getProviderBreakdown()}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            label={({ name, percent }) => `${name}: ${formatNumber(percent * 100, 0)}%`}
                            labelLine={false}
                          >
                            {getProviderBreakdown().map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: any) => formatCurrency(value)}
                            contentStyle={{
                              backgroundColor: '#1F2937',
                              border: '1px solid #374151',
                              borderRadius: '8px',
                              color: '#F9FAFB'
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : providerChartLoading ? (
                    <div className="h-64 flex items-center justify-center">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-3"></div>
                        <p className="text-gray-400 text-sm">Loading provider analytics...</p>
                        <p className="text-gray-500 text-xs mt-1">This may take a moment</p>
                      </div>
                    </div>
                  ) : !providerChartLoaded ? (
                    <div className="h-64 flex items-center justify-center">
                      <div className="text-center">
                        <div className="mb-4">
                          <FiBarChart className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                          <p className="text-gray-400 mb-2">Provider Cost Breakdown</p>
                          <p className="text-gray-500 text-sm mb-4">Click to load cost breakdown by provider</p>
                        </div>
                        <button
                          onClick={loadProviderChartData}
                          disabled={providerChartLoading}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center space-x-2"
                        >
                          <FiBarChart className="w-4 h-4" />
                          <span>Load Provider Analytics</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-gray-400">
                      No provider data available
                    </div>
                  )}
                </div>

                {/* Success/Failure Rate */}
                <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
                  <h3 className="text-lg font-semibold text-white mb-4">Call Success Rate</h3>
                  {getSuccessFailureData().length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={getSuccessFailureData()}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            label={({ name, percent }) => `${name}: ${formatNumber(percent * 100, 0)}%`}
                            labelLine={false}
                          >
                            {getSuccessFailureData().map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#1F2937',
                              border: '1px solid #374151',
                              borderRadius: '8px',
                              color: '#F9FAFB'
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-gray-400">
                      No call data available
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Top Agents by Cost */}
            <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700 mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Top Agents by Cost</h3>
                {agentChartLoading && (
                  <div className="flex items-center space-x-2 text-blue-400">
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-400"></div>
                    <span className="text-sm">Loading analytics...</span>
                  </div>
                )}
              </div>

              {agentChartLoaded && getAgentCostBreakdown().length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={getAgentCostBreakdown()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis
                        dataKey="name"
                        stroke="#D1D5DB"
                        fontSize={12}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        tick={{ fill: '#D1D5DB' }}
                      />
                      <YAxis
                        stroke="#D1D5DB"
                        fontSize={12}
                        tick={{ fill: '#D1D5DB' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1F2937',
                          border: '1px solid #374151',
                          borderRadius: '8px'
                        }}
                        formatter={(value: any, name: string) => [
                          name === 'cost' ? formatCurrency(value) :
                          name === 'avgCostPerMinute' ? formatCurrency(value) + '/min' : value,
                          name === 'cost' ? 'Total Cost' :
                          name === 'calls' ? 'Total Calls' :
                          name === 'avgCostPerMinute' ? 'Cost per Minute' : name
                        ]}
                      />
                      <Bar dataKey="cost" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : agentChartLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-3"></div>
                    <p className="text-gray-400 text-sm">Loading agent analytics...</p>
                    <p className="text-gray-500 text-xs mt-1">This may take a moment</p>
                  </div>
                </div>
              ) : !agentChartLoaded ? (
                <div className="h-64 flex items-center justify-center">
                  <div className="text-center">
                    <div className="mb-4">
                      <FiBarChart className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-400 mb-2">Top Agents by Cost</p>
                      <p className="text-gray-500 text-sm mb-4">Click to load cost breakdown by agent</p>
                    </div>
                    <button
                      onClick={loadAgentChartData}
                      disabled={agentChartLoading}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center space-x-2"
                    >
                      <FiBarChart className="w-4 h-4" />
                      <span>Load Agent Analytics</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-400">
                  No agent cost data available yet
                </div>
              )}
            </div>

            {/* Agents Grid */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">AI Agents</h2>
                {agentsLoading && (
                  <div className="flex items-center space-x-2 text-blue-400">
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-400"></div>
                    <span className="text-sm">Loading agents...</span>
                  </div>
                )}
              </div>

              {agentsLoading && agents.length === 0 ? (
                <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-12 text-center border border-gray-700">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-xl text-gray-400 mb-2">Loading your AI agents...</p>
                  <p className="text-gray-500">Please wait while we fetch your agent data.</p>
                </div>
              ) : filteredAgents.length === 0 && !agentsLoading ? (
                <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-12 text-center border border-gray-700">
                  <FiUsers className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-xl text-gray-400 mb-2">No agents found</p>
                  <p className="text-gray-500">
                    {selectedProvider === 'all'
                      ? 'Create your first AI agent to start tracking usage!'
                      : `No ${selectedProvider.toUpperCase()} agents found. Try switching providers or create a new agent.`
                    }
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredAgents.map((agent) => {
                    const analytics = agentAnalytics[agent.id];
                    const isLoading = loadingAgents.has(agent.id);

                    return (
                      <div
                        key={agent.id}
                        className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700 hover:border-blue-500/50 transition-all group"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">
                            {agent.name}
                          </h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            agent.type === 'vapi'
                              ? 'bg-blue-500/20 text-blue-400'
                              : agent.type === 'retell'
                              ? 'bg-purple-500/20 text-purple-400'
                              : agent.type === 'elevenlabs'
                              ? 'bg-amber-500/20 text-amber-400'
                              : agent.type === 'retell_chat'
                              ? 'bg-pink-500/20 text-pink-400'
                              : 'bg-violet-500/20 text-violet-400'
                          }`}>
                            {agent.type === 'elevenlabs' ? 'ElevenLabs' : agent.type === 'retell_chat' ? 'Retell Chat' : agent.type.toUpperCase()}
                          </span>
                        </div>

                        {isLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                          </div>
                        ) : analytics ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-400 text-sm">Total Calls:</span>
                              <span className="text-white font-medium">{analytics.callCount}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-400 text-sm">Billable Cost:</span>
                              <span className="text-white font-medium">{formatCurrency(agent.billableCost || analytics.totalCost)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-400 text-sm">Actual Cost:</span>
                              <span className="text-gray-300 font-medium">{formatCurrency(agent.actualCost || analytics.totalCost)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-400 text-sm">Profit:</span>
                              <span className="text-green-400 font-medium">
                                {formatCurrency(agent.profitAmount || 0)} ({formatNumber(agent.profitMargin || 0, 1)}%)
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-400 text-sm">Avg Duration:</span>
                              <span className="text-white font-medium">{formatDuration(analytics.avgDuration)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-400 text-sm">Success Rate:</span>
                              <span className="text-green-400 font-medium">{formatNumber(analytics.successRate, 1)}%</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-400 text-sm">Cost/Min:</span>
                              <span className="text-blue-400 font-medium">
                                {analytics.totalDuration > 0 ?
                                  formatCurrency(analytics.totalCost / (analytics.totalDuration / 60)) :
                                  formatCurrency(0)
                                }/min
                              </span>
                            </div>

                            {/* Detailed Analytics Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAgent(agent);
                              }}
                              className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg text-sm transition-colors"
                            >
                              View Detailed Analytics
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-8">
                            <div className="text-center mb-4">
                              <FiBarChart className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                              <p className="text-gray-400 text-sm mb-1">Analytics not loaded</p>
                              <p className="text-gray-500 text-xs">Click to load usage data</p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                fetchAgentAnalytics(agent.id);
                              }}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors flex items-center space-x-2"
                            >
                              <FiBarChart className="w-4 h-4" />
                              <span>Load Analytics</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Detailed Agent Analytics Modal */}
            {selectedAgent && selectedAgent.analytics && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-gray-800 rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-white">
                      Detailed Analytics - {selectedAgent.name}
                    </h2>
                    <button
                      onClick={() => setSelectedAgent(null)}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Profit Analysis */}
                    <div className="bg-gray-700/50 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-white mb-4">Profit Analysis</h3>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Actual Cost:</span>
                          <span className="text-white font-medium">{formatCurrency(selectedAgent.actualCost || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Billable Cost:</span>
                          <span className="text-white font-medium">{formatCurrency(selectedAgent.billableCost || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Profit Amount:</span>
                          <span className="text-green-400 font-medium">{formatCurrency(selectedAgent.profitAmount || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Profit Margin:</span>
                          <span className="text-green-400 font-medium">{formatNumber(selectedAgent.profitMargin || 0, 1)}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Profit Multiplier:</span>
                          <span className="text-blue-400 font-medium">{selectedAgent.profitMultiplier || 1.2}x</span>
                        </div>
                      </div>
                    </div>

                    {/* Performance Metrics */}
                    <div className="bg-gray-700/50 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-white mb-4">Performance Metrics</h3>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Total Calls:</span>
                          <span className="text-white font-medium">{selectedAgent.analytics.callCount}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Failed Calls:</span>
                          <span className="text-red-400 font-medium">{selectedAgent.analytics.failedCalls}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Success Rate:</span>
                          <span className="text-green-400 font-medium">{formatNumber(selectedAgent.analytics.successRate, 1)}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Avg Duration:</span>
                          <span className="text-white font-medium">{formatDuration(selectedAgent.analytics.avgDuration)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Total Duration:</span>
                          <span className="text-white font-medium">{formatDuration(selectedAgent.analytics.totalDuration)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Cost Breakdown Chart */}
                    {selectedAgent.analytics.costBreakdown && Object.keys(selectedAgent.analytics.costBreakdown).length > 0 && (
                      <div className="bg-gray-700/50 rounded-lg p-6 lg:col-span-2">
                        <h3 className="text-lg font-semibold text-white mb-4">Cost Breakdown</h3>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={Object.entries(selectedAgent.analytics.costBreakdown).map(([key, value]) => ({
                                  name: key.toUpperCase(),
                                  value: value as number
                                }))}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                                label={({ name, percent }) => `${name}: ${formatNumber(percent * 100, 0)}%`}
                                labelLine={false}
                              >
                                {Object.entries(selectedAgent.analytics.costBreakdown).map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={['#3B82F6', '#10B981', '#F59E0B', '#EF4444'][index % 4]} />
                                ))}
                              </Pie>
                              <Tooltip
                                formatter={(value: any) => formatCurrency(value)}
                                contentStyle={{
                                  backgroundColor: '#1F2937',
                                  border: '1px solid #374151',
                                  borderRadius: '8px',
                                  color: '#F9FAFB'
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
