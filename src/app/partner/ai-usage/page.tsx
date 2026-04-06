'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Tab } from '@headlessui/react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { FiClock, FiPhoneCall, FiDollarSign, FiSettings, FiX, FiRefreshCw } from 'react-icons/fi';
import toast, { Toaster } from 'react-hot-toast';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';
import PartnerSidebar from '@/components/partner/PartnerSidebar';
import AnalyticsServiceAIUsage from '@/components/partner/AnalyticsServiceAIUsage';

// Check if we should use analytics service
const USE_ANALYTICS_SERVICE = process.env.NEXT_PUBLIC_USE_ANALYTICS_SERVICE_PARTNER_AI_USAGE === 'true';

interface VapiAgent {
  id: string;
  name: string;
  assistantId: string;
  customerId?: string;
  profitMultiplier: number;
}

interface RetellAgent {
  id: string;
  name: string;
  customerId?: string;
  profitMultiplier: number;
  voiceId: string;
  voiceModel: string;
}

interface AgentAnalytics {
  costBreakdown: {
    llm: number;
    stt: number;
    tts: number;
    vapi?: number;
    retell?: number;
    ultravox?: number;
    ghl?: number;
  };
  totalDuration: number;
  avgCost: number;
  callCount: number;
  failedCalls: number;
  avgDuration: number;
  totalCost: number;
  successRate: number;
}

interface RetellAgentAnalytics {
  productCosts: {
    product: string;
    cost: number;
  }[];
  totalDuration: number;
  avgCost: number;
  callCount: number;
  failedCalls: number;
  avgDuration: number;
  totalCost: number;
  successRate: number;
}

interface AgentUsage extends VapiAgent {
  analytics?: AgentAnalytics;
  isLoading?: boolean;
}

interface RetellAgentUsage extends RetellAgent {
  analytics?: RetellAgentAnalytics;
  isLoading?: boolean;
}

interface UltravoxAgent {
  id: string;
  name: string;
  customerId?: string;
  profitMultiplier: number;
}

interface UltravoxAgentAnalytics {
  totalDuration: number;
  avgCost: number;
  callCount: number;
  failedCalls: number;
  avgDuration: number;
  totalCost: number;
  successRate: number;
}

interface UltravoxAgentUsage extends UltravoxAgent {
  analytics?: UltravoxAgentAnalytics;
  isLoading?: boolean;
}

interface ElevenLabsAgent {
  id: string;
  name: string;
  customerId?: string;
  profitMultiplier: number;
}

interface ElevenLabsAgentAnalytics {
  totalDuration: number;
  avgCost: number;
  callCount: number;
  failedCalls: number;
  avgDuration: number;
  totalCost: number;
  successRate: number;
}

interface ElevenLabsAgentUsage extends ElevenLabsAgent {
  analytics?: ElevenLabsAgentAnalytics;
  isLoading?: boolean;
}

export default function AIUsageTracking() {
  // All hooks must be called at the top level
  const router = useRouter();
  const [partnerName, setPartnerName] = useState('');
  const [agents, setAgents] = useState<AgentUsage[]>([]);
  const [retellAgents, setRetellAgents] = useState<RetellAgentUsage[]>([]);
  const [ultravoxAgents, setUltravoxAgents] = useState<UltravoxAgentUsage[]>([]);
  const [elevenLabsAgents, setElevenLabsAgents] = useState<ElevenLabsAgentUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retellError, setRetellError] = useState<string | null>(null);
  const [ultravoxError, setUltravoxError] = useState<string | null>(null);
  const [elevenLabsError, setElevenLabsError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentUsage | null>(null);
  const [selectedRetellAgent, setSelectedRetellAgent] = useState<RetellAgentUsage | null>(null);
  const [selectedUltravoxAgent, setSelectedUltravoxAgent] = useState<UltravoxAgentUsage | null>(null);
  const [selectedElevenLabsAgent, setSelectedElevenLabsAgent] = useState<ElevenLabsAgentUsage | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month'>('month');

  // Modal loading state
  const [modalLoading, setModalLoading] = useState<{
    [period: string]: boolean;
  }>({});

  // Overall modal loading state - prevents flickering
  const [isModalDataLoading, setIsModalDataLoading] = useState(false);
  const [retellSummary, setRetellSummary] = useState<{
    totalCost: number;
    totalDuration: number;
    totalCalls: number;
    failedCalls: number;
    successRate: number;
    avgDuration: number;
    avgCost: number;
    productCosts: {
      product: string;
      cost: number;
    }[];
    isLoading: boolean;
  }>({
    totalCost: 0,
    totalDuration: 0,
    totalCalls: 0,
    failedCalls: 0,
    successRate: 0,
    avgDuration: 0,
    avgCost: 0,
    productCosts: [],
    isLoading: false
  });

  // Function definitions must come before early return
  const fetchAgents = async (token: string) => {
    try {
      const response = await fetch('/api/partner/vapi-agents', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const data = await response.json();
        if (data.error === 'VAPI_API_KEY_MISSING') {
          setError('Please update your API keys & onboard Agents first to view AI usage.');
        } else {
          setError('Failed to fetch VAPI agents. Please try again later.');
        }
        return;
      }

      const data = await response.json();
      setAgents(data);
      setError(null);
    } catch (error) {
      console.error('Error fetching agents:', error);
      setError('An unexpected error occurred. Please try again later.');
    }
  };

  const fetchRetellAgents = async (token: string) => {
    try {
      const response = await fetch('/api/partner/retell-agents', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const data = await response.json();
        if (data.error === 'RETELL_API_KEY_MISSING') {
          setRetellError('Please update your API keys & onboard Agents first to view AI usage.');
        } else {
          setRetellError('Failed to fetch Retell agents. Please try again later.');
        }
        return;
      }

      const data = await response.json();
      setRetellAgents(data);
      setRetellError(null);
    } catch (error) {
      console.error('Error fetching Retell agents:', error);
      setRetellError('An unexpected error occurred. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUltravoxAgents = async (token: string) => {
    try {
      const response = await fetch('/api/partner/ultravox-agents', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const data = await response.json();
        if (data.error === 'ULTRAVOX_API_KEY_MISSING') {
          setUltravoxError('Please update your API keys & onboard Agents first to view AI usage.');
        } else {
          setUltravoxError('Failed to fetch Ultravox agents. Please try again later.');
        }
        return;
      }

      const data = await response.json();
      setUltravoxAgents(data);
      setUltravoxError(null);
    } catch (error) {
      console.error('Error fetching Ultravox agents:', error);
      setUltravoxError('An unexpected error occurred. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const fetchElevenLabsAgents = async (token: string) => {
    try {
      const response = await fetch('/api/partner/elevenlabs-agents', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const data = await response.json();
        if (data.error === 'ELEVENLABS_API_KEY_MISSING') {
          setElevenLabsError('Please update your API keys & onboard Agents first to view AI usage.');
        } else {
          setElevenLabsError('Failed to fetch ElevenLabs agents. Please try again later.');
        }
        return;
      }

      const data = await response.json();
      setElevenLabsAgents(data);
      setElevenLabsError(null);
    } catch (error) {
      console.error('Error fetching ElevenLabs agents:', error);
      setElevenLabsError('An unexpected error occurred. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const fetchRetellSummary = async (period: string) => {
    try {
      setRetellSummary(prev => ({ ...prev, isLoading: true }));
      const token = localStorage.getItem('partner_token');

      // Check if we should use the analytics service
      if (USE_ANALYTICS_SERVICE) {
        console.log('Using analytics service for Retell summary');
        const response = await fetch(`/api/partner/analytics/summary?period=${period}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch Retell summary from analytics service');
        }

        const data = await response.json();
        setRetellSummary({
          totalCost: data.totalCost,
          totalDuration: data.totalDuration,
          totalCalls: data.totalCalls,
          failedCalls: data.failedCalls,
          successRate: data.successRate,
          avgDuration: data.avgDuration,
          avgCost: data.avgCost,
          productCosts: data.productCosts || [],
          isLoading: false
        });
      } else {
        // Legacy provider API approach
        console.log('Using legacy provider API for Retell summary');
        const response = await fetch(`/api/partner/retell-agents/summary?period=${period}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch Retell summary');
        }

        const data = await response.json();
        setRetellSummary({
          totalCost: data.totalCost,
          totalDuration: data.totalDuration,
          totalCalls: data.totalCalls,
          failedCalls: data.failedCalls,
          successRate: data.successRate,
          avgDuration: data.avgDuration,
          avgCost: data.avgCost,
          productCosts: data.productCosts || [],
          isLoading: false
        });
      }
    } catch (error) {
      console.error('Error fetching Retell summary:', error);
      setRetellSummary(prev => ({ ...prev, isLoading: false }));
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('partner_token');
    if (!token) {
      router.push('/partner/login');
      return;
    }

    const name = localStorage.getItem('partner_name');
    if (name) setPartnerName(name);

    fetchAgents(token);
    fetchRetellAgents(token);
    fetchUltravoxAgents(token);
    fetchElevenLabsAgents(token);
  }, [router]);

  useEffect(() => {
    if (retellAgents.length > 0) {
      fetchRetellSummary(selectedPeriod);
    }
  }, [retellAgents, selectedPeriod]);

  // Check if we should use analytics service
  if (USE_ANALYTICS_SERVICE) {
    return <AnalyticsServiceAIUsage />;
  }





  const processAnalyticsData = (data: any[], agentId: string): AgentAnalytics => {
    // Check if we're using analytics service (new format) or legacy format
    const isAnalyticsService = USE_ANALYTICS_SERVICE;

    if (isAnalyticsService) {
      // New analytics service format - data is already structured
      const costBreakdownData = data.find(d => d.name === "Product Costs")?.result || [];
      const durationData = data.find(d => d.name === "Total Call Duration")?.result.find((r: any) => r.agentId === agentId) || {};
      const avgCostData = data.find(d => d.name === "Average Call Cost")?.result.find((r: any) => r.agentId === agentId) || {};
      const callsData = data.find(d => d.name === "Number of Calls by Assistants")?.result.find((r: any) => r.agentId === agentId) || {};
      const avgDurationData = data.find(d => d.name === "Average Call Duration by Assistant")?.result.find((r: any) => r.agentId === agentId) || {};
      const totalSpentData = data.find(d => d.name === "Total Spent")?.result.find((r: any) => r.agentId === agentId) || {};

      const failedCallsData = data.find(d => d.name === "Number of Failed Calls")?.result
        .filter((r: any) => r.agentId === agentId && r.endedReason === "failed") || [];

      const successEvalData = data.find(d => d.name === "Success Evaluation")?.result
        .filter((r: any) => r.agentId === agentId) || [];

      const totalCalls = parseInt(callsData.countId || '0');
      const successfulCalls = successEvalData
        .filter((r: any) => r['analysis.successEvaluation'] === 'true')
        .reduce((acc: number, curr: any) => acc + parseInt(curr.countId || '0'), 0);

      // Process cost breakdown from product costs
      const costBreakdown = costBreakdownData.reduce((acc: any, item: any) => {
        const product = item.product?.toLowerCase();
        if (product) {
          acc[product] = item.cost || 0;
        }
        return acc;
      }, { llm: 0, stt: 0, tts: 0, vapi: 0 });

      return {
        costBreakdown,
        totalDuration: durationData.sumDuration || 0,
        avgCost: avgCostData.avgCost || 0,
        callCount: totalCalls,
        failedCalls: failedCallsData.reduce((acc: number, curr: any) => acc + parseInt(curr.countId || '0'), 0),
        avgDuration: parseFloat(avgDurationData.avgDuration) || 0,
        totalCost: totalSpentData.sumCost || 0,
        successRate: totalCalls ? (successfulCalls / totalCalls) * 100 : 0,
      };
    } else {
      // Legacy format - use assistantId
      const costBreakdownData = data.find(d => d.name === "LLM, STT, TTS, VAPI Costs")?.result.find((r: any) => r.assistantId === agentId) || {};
      const durationData = data.find(d => d.name === "Total Call Duration")?.result.find((r: any) => r.assistantId === agentId) || {};
      const avgCostData = data.find(d => d.name === "Average Call Cost")?.result.find((r: any) => r.assistantId === agentId) || {};
      const callsData = data.find(d => d.name === "Number of Calls by Assistants")?.result.find((r: any) => r.assistantId === agentId) || {};
      const avgDurationData = data.find(d => d.name === "Average Call Duration by Assistant")?.result.find((r: any) => r.assistantId === agentId) || {};
      const totalSpentData = data.find(d => d.name === "Total Spent")?.result.find((r: any) => r.assistantId === agentId) || {};

      const failedCallsData = data.find(d => d.name === "Number of Failed Calls")?.result
        .filter((r: any) => r.assistantId === agentId && r.endedReason === "failed") || [];

      const successEvalData = data.find(d => d.name === "Success Evaluation")?.result
        .filter((r: any) => r.assistantId === agentId) || [];

      const totalCalls = parseInt(callsData.countId || '0');
      const successfulCalls = successEvalData
        .filter((r: any) => r['analysis.successEvaluation'] === 'true')
        .reduce((acc: number, curr: any) => acc + parseInt(curr.countId || '0'), 0);

      return {
        costBreakdown: {
          llm: costBreakdownData.sumCostBreakdownLlm || 0,
          stt: costBreakdownData.sumCostBreakdownStt || 0,
          tts: costBreakdownData.sumCostBreakdownTts || 0,
          vapi: costBreakdownData.sumCostBreakdownVapi || 0,
        },
        totalDuration: durationData.sumDuration || 0,
        avgCost: avgCostData.avgCost || 0,
        callCount: totalCalls,
        failedCalls: failedCallsData.reduce((acc: number, curr: any) => acc + parseInt(curr.countId || '0'), 0),
        avgDuration: parseFloat(avgDurationData.avgDuration) || 0,
        totalCost: totalSpentData.sumCost || 0,
        successRate: totalCalls ? (successfulCalls / totalCalls) * 100 : 0,
      };
    }
  };

  const fetchAnalytics = async (agentId: string, period: string) => {
    console.log(`🔄 FRESH API CALL: Fetching analytics for agent ${agentId}, period: ${period} (cache disabled)`);

    try {
      const token = localStorage.getItem('partner_token');

      // Check if we should use the analytics service
      if (USE_ANALYTICS_SERVICE) {
        console.log('Using analytics service for partner AI usage');
        const response = await fetch(`/api/partner/analytics/agent/${agentId}?period=${period}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
          console.error(`Analytics service error: ${response.status} ${response.statusText}`);
          throw new Error('Failed to fetch analytics from analytics service');
        }

        const data = await response.json();
        console.log(`📊 Analytics data received for ${agentId}:`, data);
        const analytics = processAnalyticsData(data, agentId);
        return analytics;
      }

      // Legacy provider API approach
      console.log('Using legacy provider API for partner AI usage');
      const response = await fetch(`/api/partner/vapi-agents/${agentId}/analytics?period=${period}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        console.error(`Legacy API error: ${response.status} ${response.statusText}`);
        throw new Error('Failed to fetch analytics');
      }

      const data = await response.json();
      console.log(`📊 Legacy analytics data received for ${agentId}:`, data);
      const analytics = processAnalyticsData(data, agentId);
      return analytics;
    } catch (error) {
      console.error('Error fetching analytics:', error);
      throw error;
    }
  };

  const fetchRetellAnalytics = async (agentId: string, period: string) => {
    console.log(`🔄 FRESH API CALL: Fetching Retell analytics for agent ${agentId}, period: ${period} (cache disabled)`);

    try {
      const token = localStorage.getItem('partner_token');

      // Check if we should use the analytics service
      if (USE_ANALYTICS_SERVICE) {
        console.log('Using analytics service for partner Retell analytics');
        const response = await fetch(`/api/partner/analytics/agent/${agentId}?period=${period}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
          console.error(`Retell analytics service error: ${response.status} ${response.statusText}`);
          throw new Error('Failed to fetch Retell analytics from analytics service');
        }

        const data = await response.json();
        console.log(`📊 Retell analytics data received for ${agentId}:`, data);
        const analytics = processRetellAnalyticsData(data, agentId);
        return analytics;
      }

      // Legacy provider API approach
      console.log('Using legacy provider API for partner Retell analytics');
      const response = await fetch(`/api/partner/retell-agents/${agentId}/analytics?period=${period}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        console.error(`Legacy Retell API error: ${response.status} ${response.statusText}`);
        throw new Error('Failed to fetch Retell analytics');
      }

      const data = await response.json();
      console.log(`📊 Legacy Retell analytics data received for ${agentId}:`, data);
      const analytics = processRetellAnalyticsData(data, agentId);
      return analytics;
    } catch (error) {
      console.error('Error fetching Retell analytics:', error);
      throw error;
    }
  };

  const fetchUltravoxAnalytics = async (agentId: string, period: string) => {
    console.log(`🔄 FRESH API CALL: Fetching Ultravox analytics for agent ${agentId}, period: ${period} (cache disabled)`);

    try {
      const token = localStorage.getItem('partner_token');

      // Always use analytics service for Ultravox
      console.log('Using analytics service for partner Ultravox analytics');
      const response = await fetch(`/api/partner/analytics/agent/${agentId}?period=${period}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        console.error(`Ultravox analytics service error: ${response.status} ${response.statusText}`);
        throw new Error('Failed to fetch Ultravox analytics from analytics service');
      }

      const data = await response.json();
      console.log(`📊 Ultravox analytics data received for ${agentId}:`, data);
      const analytics = processUltravoxAnalyticsData(data);
      return analytics;
    } catch (error) {
      console.error('Error fetching Ultravox analytics:', error);
      throw error;
    }
  };

  const processRetellAnalyticsData = (data: any[], agentId: string): RetellAgentAnalytics => {
    // Extract product costs
    const productCosts = data.find(d => d.name === "Product Costs")?.result || [];

    // Extract other analytics data
    const totalDuration = data.find(d => d.name === "Total Call Duration")?.result.find((r: any) => r.agentId === agentId)?.sumDuration || 0;
    const avgCost = data.find(d => d.name === "Average Call Cost")?.result.find((r: any) => r.agentId === agentId)?.avgCost || 0;
    const callCount = parseInt(data.find(d => d.name === "Number of Calls by Assistants")?.result.find((r: any) => r.agentId === agentId)?.countId || '0');
    const failedCalls = parseInt(data.find(d => d.name === "Number of Failed Calls")?.result.find((r: any) => r.agentId === agentId && r.endedReason === "failed")?.countId || '0');
    const avgDuration = data.find(d => d.name === "Average Call Duration by Assistant")?.result.find((r: any) => r.agentId === agentId)?.avgDuration || 0;
    const totalCost = data.find(d => d.name === "Total Spent")?.result.find((r: any) => r.agentId === agentId)?.sumCost || 0;

    // Calculate success rate
    const successfulCalls = callCount - failedCalls;
    const successRate = callCount > 0 ? (successfulCalls / callCount) * 100 : 0;

    return {
      productCosts,
      totalDuration,
      avgCost,
      callCount,
      failedCalls,
      avgDuration,
      totalCost,
      successRate
    };
  };

  const processUltravoxAnalyticsData = (data: any): UltravoxAgentAnalytics => {
    // Ultravox analytics come in a different format from the analytics service
    return {
      totalDuration: data.totalDuration || 0,
      avgCost: data.avgCost || 0,
      callCount: data.totalCalls || 0,
      failedCalls: data.failedCalls || 0,
      avgDuration: data.avgDuration || 0,
      totalCost: data.totalCost || 0,
      successRate: data.successRate || 0
    };
  };

  const handleAgentClick = async (agent: AgentUsage) => {
    console.log(`🖱️ Agent clicked: ${agent.name} (${agent.id}) - forcing fresh data load`);

    // Set modal loading state to prevent flickering
    setIsModalDataLoading(true);

    // Set selected agent for modal display
    setSelectedAgent(agent);

    // Show loading state for the clicked agent
    setAgents(prev => prev.map(a =>
      a.id === agent.id ? { ...a, isLoading: true } : a
    ));

    try {
      // Always load fresh day data (no cache)
      const dayAnalytics = await fetchAnalytics(agent.id, 'day');

      // Update agent with data
      setAgents(prev => prev.map(a =>
        a.id === agent.id ? { ...a, analytics: dayAnalytics, isLoading: false } : a
      ));

      // Set period to day
      setSelectedPeriod('day');

      // Data is ready, stop modal loading
      setIsModalDataLoading(false);

      toast.success(`Fresh analytics loaded for ${agent.name}`);

    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load analytics. Please try again.');
      setAgents(prev => prev.map(a =>
        a.id === agent.id ? { ...a, isLoading: false } : a
      ));
      setIsModalDataLoading(false); // Stop loading on error
    }
  };

  const handleRetellAgentClick = async (agent: RetellAgentUsage) => {
    console.log(`🖱️ Retell agent clicked: ${agent.name} (${agent.id}) - forcing fresh data load`);

    // Set modal loading state to prevent flickering
    setIsModalDataLoading(true);

    // Set selected agent for modal display
    setSelectedRetellAgent(agent);

    // Show loading state for the clicked agent
    setRetellAgents(prev => prev.map(a =>
      a.id === agent.id ? { ...a, isLoading: true } : a
    ));

    try {
      // Always load fresh day data (no cache)
      const dayAnalytics = await fetchRetellAnalytics(agent.id, 'day');

      // Update agent with data
      setRetellAgents(prev => prev.map(a =>
        a.id === agent.id ? { ...a, analytics: dayAnalytics, isLoading: false } : a
      ));

      // Set period to day
      setSelectedPeriod('day');

      // Data is ready, stop modal loading
      setIsModalDataLoading(false);

      toast.success(`Fresh Retell analytics loaded for ${agent.name}`);

    } catch (error) {
      console.error('Error fetching Retell analytics:', error);
      toast.error('Failed to load Retell analytics. Please try again.');
      setRetellAgents(prev => prev.map(a =>
        a.id === agent.id ? { ...a, isLoading: false } : a
      ));
      setIsModalDataLoading(false); // Stop loading on error
    }
  };

  const handleUltravoxAgentClick = async (agent: UltravoxAgentUsage) => {
    console.log(`🖱️ Ultravox agent clicked: ${agent.name} (${agent.id}) - forcing fresh data load`);

    // Set modal loading state to prevent flickering
    setIsModalDataLoading(true);

    // Set selected agent for modal display
    setSelectedUltravoxAgent(agent);

    // Show loading state for the clicked agent
    setUltravoxAgents(prev => prev.map(a =>
      a.id === agent.id ? { ...a, isLoading: true } : a
    ));

    try {
      // Always load fresh day data (no cache)
      const dayAnalytics = await fetchUltravoxAnalytics(agent.id, 'day');

      // Update agent with data
      setUltravoxAgents(prev => prev.map(a =>
        a.id === agent.id ? { ...a, analytics: dayAnalytics, isLoading: false } : a
      ));

      // Set period to day
      setSelectedPeriod('day');

      // Data is ready, stop modal loading
      setIsModalDataLoading(false);

      toast.success(`Fresh Ultravox analytics loaded for ${agent.name}`);

    } catch (error) {
      console.error('Error fetching Ultravox analytics:', error);
      toast.error('Failed to load Ultravox analytics. Please try again.');
      setUltravoxAgents(prev => prev.map(a =>
        a.id === agent.id ? { ...a, isLoading: false } : a
      ));
      setIsModalDataLoading(false); // Stop loading on error
    }
  };

  const handleElevenLabsAgentClick = async (agent: ElevenLabsAgentUsage) => {
    console.log(`🖱️ ElevenLabs agent clicked: ${agent.name} (${agent.id}) - forcing fresh data load`);

    // Set modal loading state to prevent flickering
    setIsModalDataLoading(true);

    setSelectedElevenLabsAgent(agent);

    // Mark this specific agent as loading
    setElevenLabsAgents(prev => prev.map(a =>
      a.id === agent.id ? { ...a, isLoading: true } : a
    ));

    try {
      // TODO: Implement ElevenLabs analytics fetching
      // For now, just simulate loading
      await new Promise(resolve => setTimeout(resolve, 1000));

      const mockAnalytics: ElevenLabsAgentAnalytics = {
        totalDuration: 0,
        avgCost: 0,
        callCount: 0,
        failedCalls: 0,
        avgDuration: 0,
        totalCost: 0,
        successRate: 0
      };

      setElevenLabsAgents(prev => prev.map(a =>
        a.id === agent.id ? { ...a, analytics: mockAnalytics, isLoading: false } : a
      ));

      setIsModalDataLoading(false);

      toast.success(`Fresh ElevenLabs analytics loaded for ${agent.name}`);

    } catch (error) {
      console.error('Error fetching ElevenLabs analytics:', error);
      toast.error('Failed to load ElevenLabs analytics. Please try again.');
      setElevenLabsAgents(prev => prev.map(a =>
        a.id === agent.id ? { ...a, isLoading: false } : a
      ));
      setIsModalDataLoading(false); // Stop loading on error
    }
  };

  const handlePeriodChange = async (period: 'day' | 'week' | 'month') => {
    // Don't do anything if clicking the same period that's already selected
    if (period === selectedPeriod) {
      console.log(`Period ${period} is already selected, skipping API call`);
      return;
    }

    console.log(`🔄 Period change: ${selectedPeriod} → ${period} (forcing fresh API call)`);
    const previousPeriod = selectedPeriod;

    try {
      if (selectedAgent) {
        console.log(`Fetching fresh data for VAPI agent ${selectedAgent.id} period ${period}`);
        // Always show loading state for fresh data
        setModalLoading(prev => ({ ...prev, [period]: true }));

        // Fetch fresh data with user feedback
        toast.loading(`Loading fresh ${period} analytics...`, { id: `loading-${period}` });

        const analytics = await fetchAnalytics(selectedAgent.id, period);

        // Only update period after data is ready to prevent flickering
        setSelectedPeriod(period);
        setAgents(prev => prev.map(a =>
          a.id === selectedAgent.id ? { ...a, analytics } : a
        ));

        toast.success(`Fresh ${period} analytics loaded`, { id: `loading-${period}` });
      }

      if (selectedRetellAgent) {
        console.log(`Fetching fresh data for Retell agent ${selectedRetellAgent.id} period ${period}`);
        // Always show loading state for fresh data
        setModalLoading(prev => ({ ...prev, [period]: true }));

        // Fetch fresh data with user feedback
        toast.loading(`Loading fresh ${period} Retell analytics...`, { id: `loading-retell-${period}` });

        const analytics = await fetchRetellAnalytics(selectedRetellAgent.id, period);

        // Only update period after data is ready to prevent flickering
        setSelectedPeriod(period);
        setRetellAgents(prev => prev.map(a =>
          a.id === selectedRetellAgent.id ? { ...a, analytics } : a
        ));

        toast.success(`Fresh ${period} Retell analytics loaded`, { id: `loading-retell-${period}` });
      }

      if (selectedUltravoxAgent) {
        console.log(`Fetching fresh data for Ultravox agent ${selectedUltravoxAgent.id} period ${period}`);
        // Always show loading state for fresh data
        setModalLoading(prev => ({ ...prev, [period]: true }));

        // Fetch fresh data with user feedback
        toast.loading(`Loading fresh ${period} Ultravox analytics...`, { id: `loading-ultravox-${period}` });

        const analytics = await fetchUltravoxAnalytics(selectedUltravoxAgent.id, period);

        // Only update period after data is ready to prevent flickering
        setSelectedPeriod(period);
        setUltravoxAgents(prev => prev.map(a =>
          a.id === selectedUltravoxAgent.id ? { ...a, analytics } : a
        ));

        toast.success(`Fresh ${period} Ultravox analytics loaded`, { id: `loading-ultravox-${period}` });
      }
    } catch (error) {
      console.error('Error changing period:', error);
      toast.error(`Failed to load ${period} analytics`);
      // Revert to previous period on error
      setSelectedPeriod(previousPeriod);
    } finally {
      setModalLoading(prev => ({ ...prev, [period]: false }));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('partner_token');
    localStorage.removeItem('partner_name');
    localStorage.removeItem('partner_email');
    router.push('/partner/login');
  };

  const handleSettingsClick = () => {
    router.push('/partner/settings');
  };

  // General number formatting function to ensure max 3 decimal places
  const formatNumber = (num: number, maxDecimals: number = 3) => {
    if (isNaN(num) || num === null || num === undefined) return '0';

    // If it's a whole number, return as is
    if (num % 1 === 0) return num.toString();

    // Otherwise, limit decimal places
    return parseFloat(num.toFixed(maxDecimals)).toString();
  };

  const formatCurrency = (amount: number) => {
    // Ensure amount is a valid number and handle edge cases
    const validAmount = isNaN(amount) || amount === null || amount === undefined ? 0 : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(validAmount);
  };

  const formatDuration = (seconds: number | string) => {
    // Convert to number and handle string inputs
    let numSeconds: number;
    if (typeof seconds === 'string') {
      numSeconds = parseFloat(seconds);
    } else {
      numSeconds = seconds;
    }

    if (isNaN(numSeconds) || numSeconds < 0) return '0s';

    // Round to max 3 decimal places first
    const roundedSeconds = parseFloat(numSeconds.toFixed(3));

    // For very short durations (less than 1 minute), show seconds with decimals if needed
    if (roundedSeconds < 60) {
      // If it's a whole number, show without decimals
      if (roundedSeconds % 1 === 0) {
        return `${Math.floor(roundedSeconds)}s`;
      }
      // Otherwise show with up to 3 decimal places, removing trailing zeros
      return `${formatNumber(roundedSeconds)}s`;
    }

    // For longer durations, show minutes and seconds
    const minutes = Math.floor(roundedSeconds / 60);
    const remainingSeconds = Math.floor(roundedSeconds % 60);

    if (minutes === 0) {
      return `${remainingSeconds}s`;
    }

    return `${minutes}m ${remainingSeconds}s`;
  };

  const AgentTile = ({ agent }: { agent: AgentUsage }) => (
    <div
      onClick={() => handleAgentClick(agent)}
      className={`p-6 cursor-pointer transition-all hover:scale-[1.02] bg-gray-800/50 rounded-lg relative border border-gray-700/50 hover:border-blue-500/50 ${
        agent.isLoading ? 'opacity-50' : ''
      } hover:shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all hover:border-blue-500/50 group`}
    >
      {agent.isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 rounded-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )}
      <div className="flex flex-col h-full">
        <h3 className="text-lg font-semibold mb-4 text-white group-hover:text-blue-400 transition-colors" style={{color: '#ffffff'}}>{agent.name}</h3>
        {agent.analytics ? (
          <div className="flex-1 space-y-4">
            <div className="flex items-center text-gray-300 group-hover:text-green-200 transition-colors">
              <FiClock className="w-5 h-5 mr-2" />
              <span className="text-gray-300 group-hover:text-gray-200">Avg Duration: {formatDuration(agent.analytics.avgDuration)}</span>
            </div>
            <div className="flex items-center text-gray-300 group-hover:text-blue-200 transition-colors">
              <FiPhoneCall className="w-5 h-5 mr-2" />
              <span className="text-gray-300 group-hover:text-gray-200">Total Calls: {agent.analytics.callCount}</span>
            </div>
            <div className="flex items-center text-gray-300 group-hover:text-red-200 transition-colors">
              <FiDollarSign className="w-5 h-5 mr-2" />
              <span className="text-gray-300 group-hover:text-gray-200">Total Cost: {formatCurrency(agent.analytics.totalCost)}</span>
            </div>
            <div className="flex items-center text-green-400 group-hover:text-green-300 transition-colors">
              <FiDollarSign className="w-5 h-5 mr-2" />
              <span className="text-green-400 group-hover:text-green-300">Avg Cost/Call: {formatCurrency(agent.analytics.avgCost)}</span>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 group-hover:text-gray-300 transition-colors">
            Click to view analytics
          </div>
        )}
      </div>
    </div>
  );

  const RetellAgentTile = ({ agent }: { agent: RetellAgentUsage }) => (
    <div
      onClick={() => handleRetellAgentClick(agent)}
      className={`p-6 cursor-pointer transition-all hover:scale-[1.02] bg-gray-800/50 rounded-lg relative border border-gray-700/50 hover:border-indigo-500/50 ${
        agent.isLoading ? 'opacity-50' : ''
      } hover:shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all hover:border-indigo-500/50 group`}
    >
      {agent.isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 rounded-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )}
      <div className="flex flex-col h-full">
        <h3 className="text-lg font-semibold mb-4 text-white group-hover:text-indigo-400 transition-colors" style={{color: '#ffffff'}}>{agent.name}</h3>
        {agent.analytics ? (
          <div className="flex-1 space-y-4">
            <div className="flex items-center text-gray-300 group-hover:text-gray-200 transition-colors">
              <FiClock className="w-5 h-5 mr-2" />
              <span className="text-gray-300 group-hover:text-gray-200">Avg Duration: {formatDuration(agent.analytics.avgDuration)}</span>
            </div>
            <div className="flex items-center text-gray-300 group-hover:text-gray-200 transition-colors">
              <FiPhoneCall className="w-5 h-5 mr-2" />
              <span className="text-gray-300 group-hover:text-gray-200">Total Calls: {agent.analytics.callCount}</span>
            </div>
            <div className="flex items-center text-gray-300 group-hover:text-gray-200 transition-colors">
              <FiDollarSign className="w-5 h-5 mr-2" />
              <span className="text-gray-300 group-hover:text-gray-200">Total Cost: {formatCurrency(agent.analytics.totalCost)}</span>
            </div>
            <div className="flex items-center text-green-400 group-hover:text-green-300 transition-colors">
              <FiDollarSign className="w-5 h-5 mr-2" />
              <span className="text-green-400 group-hover:text-green-300">Avg Cost/Call: {formatCurrency(agent.analytics.avgCost)}</span>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 group-hover:text-gray-300 transition-colors">
            Click to view analytics
          </div>
        )}
      </div>
    </div>
  );

  const UltravoxAgentTile = ({ agent }: { agent: UltravoxAgentUsage }) => (
    <div
      onClick={() => handleUltravoxAgentClick(agent)}
      className={`p-6 cursor-pointer transition-all hover:scale-[1.02] bg-gray-800/50 rounded-lg relative border border-gray-700/50 hover:border-purple-500/50 ${
        agent.isLoading ? 'opacity-50' : ''
      } hover:shadow-[0_0_15px_rgba(147,51,234,0.3)] transition-all hover:border-purple-500/50 group`}
    >
      {agent.isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 rounded-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
        </div>
      )}
      <div className="flex flex-col h-full">
        <h3 className="text-lg font-semibold mb-4 text-white group-hover:text-purple-400 transition-colors" style={{color: '#ffffff'}}>{agent.name}</h3>
        {agent.analytics ? (
          <div className="flex-1 space-y-4">
            <div className="flex items-center text-gray-300 group-hover:text-gray-200 transition-colors">
              <FiClock className="w-5 h-5 mr-2" />
              <span className="text-gray-300 group-hover:text-gray-200">Avg Duration: {formatDuration(agent.analytics.avgDuration)}</span>
            </div>
            <div className="flex items-center text-gray-300 group-hover:text-gray-200 transition-colors">
              <FiPhoneCall className="w-5 h-5 mr-2" />
              <span className="text-gray-300 group-hover:text-gray-200">Total Calls: {agent.analytics.callCount}</span>
            </div>
            <div className="flex items-center text-gray-300 group-hover:text-gray-200 transition-colors">
              <FiDollarSign className="w-5 h-5 mr-2" />
              <span className="text-gray-300 group-hover:text-gray-200">Total Cost: {formatCurrency(agent.analytics.totalCost)}</span>
            </div>
            <div className="flex items-center text-green-400 group-hover:text-green-300 transition-colors">
              <FiDollarSign className="w-5 h-5 mr-2" />
              <span className="text-green-400 group-hover:text-green-300">Avg Cost/Call: {formatCurrency(agent.analytics.avgCost)}</span>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 group-hover:text-gray-300 transition-colors">
            Click to view analytics
          </div>
        )}
      </div>
    </div>
  );

  const ElevenLabsAgentTile = ({ agent }: { agent: ElevenLabsAgentUsage }) => (
    <div
      onClick={() => handleElevenLabsAgentClick(agent)}
      className={`p-6 cursor-pointer transition-all hover:scale-[1.02] bg-gray-800/50 rounded-lg relative border border-gray-700/50 hover:border-green-500/50 ${
        agent.isLoading ? 'opacity-50' : ''
      } hover:shadow-[0_0_15px_rgba(34,197,94,0.3)] transition-all hover:border-green-500/50 group`}
    >
      {agent.isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 rounded-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
        </div>
      )}
      <div className="flex flex-col h-full">
        <h3 className="text-lg font-semibold mb-4 text-white group-hover:text-green-400 transition-colors" style={{color: '#ffffff'}}>{agent.name}</h3>
        {agent.analytics ? (
          <div className="flex-1 space-y-4">
            <div className="flex items-center text-gray-300 group-hover:text-gray-200 transition-colors">
              <FiClock className="w-5 h-5 mr-2" />
              <span className="text-gray-300 group-hover:text-gray-200">Avg Duration: {formatDuration(agent.analytics.avgDuration)}</span>
            </div>
            <div className="flex items-center text-gray-300 group-hover:text-gray-200 transition-colors">
              <FiPhoneCall className="w-5 h-5 mr-2" />
              <span className="text-gray-300 group-hover:text-gray-200">Calls: {agent.analytics.callCount}</span>
            </div>
            <div className="flex items-center text-gray-300 group-hover:text-gray-200 transition-colors">
              <FiDollarSign className="w-5 h-5 mr-2" />
              <span className="text-gray-300 group-hover:text-gray-200">Total Cost: ${formatNumber(agent.analytics.totalCost)}</span>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 group-hover:text-gray-300 transition-colors">
            Click to view analytics
          </div>
        )}
      </div>
    </div>
  );

  const AnalyticsModal = () => {
    if (!selectedAgent) return null;

    // Get the latest analytics from the agents array, not from selectedAgent
    const currentAgent = agents.find(a => a.id === selectedAgent.id);
    const usage = currentAgent?.analytics;
    const isLoading = currentAgent?.isLoading || isModalDataLoading;

    const costBreakdownData = usage?.costBreakdown ? [
      { name: 'LLM', value: usage.costBreakdown.llm },
      { name: 'STT', value: usage.costBreakdown.stt },
      { name: 'TTS', value: usage.costBreakdown.tts },
      { name: 'VAPI', value: usage.costBreakdown.vapi },
    ] : [];

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

    return (
      <Transition appear show={!!selectedAgent} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => {
            setSelectedAgent(null);
            setIsModalDataLoading(false);
          }}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/80" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-5xl transform overflow-hidden rounded-2xl bg-gray-900/95 p-8 text-white shadow-xl transition-all border border-gray-700">
                  <div className="flex justify-between items-center mb-8">
                    <Dialog.Title className="text-2xl font-bold text-white">
                      {selectedAgent?.name} Analytics
                    </Dialog.Title>
                    <button
                      onClick={() => {
                        setSelectedAgent(null);
                        setIsModalDataLoading(false);
                      }}
                      className="p-2 rounded-lg hover:bg-gray-700/50 transition-colors text-gray-400 hover:text-white"
                    >
                      <FiX className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="flex gap-4 mb-8">
                    {(['day', 'week', 'month'] as const).map((period) => {
                      const isLoading = modalLoading[period];

                      return (
                        <button
                          key={period}
                          onClick={() => handlePeriodChange(period)}
                          disabled={isLoading}
                          className={`px-6 py-2 rounded-lg capitalize font-medium transition-all flex items-center gap-2 relative ${
                            selectedPeriod === period
                              ? 'bg-blue-600 text-white shadow-lg'
                              : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white disabled:opacity-50'
                          }`}
                        >
                          {isLoading && (
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-current"></div>
                          )}
                          {period}
                        </button>
                      );
                    })}
                  </div>

                  {isLoading || isModalDataLoading ? (
                    <div className="flex items-center justify-center py-32">
                      <div className="text-center">
                        <div className="relative">
                          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-6"></div>
                          <div className="absolute inset-0 rounded-full h-16 w-16 border-4 border-blue-200 border-t-transparent mx-auto animate-pulse"></div>
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">Loading Analytics</h3>
                        <p className="text-gray-400">Please wait while we fetch your data...</p>
                        <div className="mt-4 flex justify-center space-x-1">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                        </div>
                      </div>
                    </div>
                  ) : !usage ? (
                    <div className="flex items-center justify-center py-20">
                      <div className="text-center">
                        <p className="text-gray-400 text-lg">No analytics data available</p>
                        <p className="text-gray-500 text-sm mt-2">Click the agent tile to load analytics</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Cost Breakdown Pie Chart */}
                      <div className="bg-gray-800/70 rounded-xl p-6 shadow-lg border border-gray-700">
                        <h3 className="text-xl font-semibold mb-6 text-white">Cost Breakdown</h3>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={costBreakdownData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, value, x, y }) => (
                                  <text x={x} y={y} fill="#e5e7eb" textAnchor="middle" dominantBaseline="central" fontSize="12">
                                    {`${name} (${formatCurrency(value)})`}
                                  </text>
                                )}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                              >
                                {costBreakdownData.map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip
                                formatter={(value) => formatCurrency(value as number)}
                                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.5rem' }}
                                itemStyle={{ color: '#fff' }}
                              />
                              <Legend
                                formatter={(value) => <span className="text-gray-200">{value}</span>}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                    {/* Call Statistics */}
                    <div className="bg-gray-800/70 rounded-xl p-6 shadow-lg border border-gray-700">
                      <h3 className="text-xl font-semibold mb-6 text-white">Call Statistics</h3>
                      <div className="space-y-6">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-300">Total Calls:</span>
                          <span className="text-xl font-semibold text-white">{usage.callCount}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-300">Failed Calls:</span>
                          <span className="text-xl font-semibold text-red-400">{usage.failedCalls}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-300">Success Rate:</span>
                          <span className="text-xl font-semibold text-green-400">
                            {formatNumber(usage.successRate, 1)}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-300">Average Duration:</span>
                          <span className="text-xl font-semibold text-white">{formatDuration(usage.avgDuration)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Cost Comparison Bar Chart */}
                    <div className="bg-gray-800/70 rounded-xl p-6 shadow-lg border border-gray-700 col-span-2">
                      <h3 className="text-xl font-semibold mb-6 text-white">Cost Analysis</h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={[
                              {
                                name: 'Costs',
                                actual: usage.totalCost,
                                billed: usage.totalCost * (selectedAgent.profitMultiplier || 1.2),
                                profit: (usage.totalCost * (selectedAgent.profitMultiplier || 1.2)) - usage.totalCost,
                              }
                            ]}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="name" stroke="#9ca3af" />
                            <YAxis stroke="#9ca3af" />
                            <Tooltip
                              formatter={(value) => formatCurrency(value as number)}
                              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.5rem' }}
                              itemStyle={{ color: '#fff' }}
                            />
                            <Legend formatter={(value) => <span className="text-gray-200">{value}</span>} />
                            <Bar dataKey="actual" name="Actual Cost" fill="#6366f1" />
                            <Bar dataKey="billed" name="Billed Cost" fill="#10b981" />
                            <Bar dataKey="profit" name="Profit" fill="#f59e0b" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                  )}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    );
  };

  const RetellAnalyticsModal = () => {
    if (!selectedRetellAgent) return null;

    // Get the latest analytics from the retellAgents array, not from selectedRetellAgent
    const currentAgent = retellAgents.find(a => a.id === selectedRetellAgent.id);
    const usage = currentAgent?.analytics;
    const isLoading = currentAgent?.isLoading || isModalDataLoading;

    const productCostsData = usage?.productCosts || [];

    return (
      <Transition appear show={!!selectedRetellAgent} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => {
            setSelectedRetellAgent(null);
            setIsModalDataLoading(false);
          }}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/80" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-5xl transform overflow-hidden rounded-2xl bg-gray-900/95 p-8 text-white shadow-xl transition-all border border-gray-700">
                  <div className="flex justify-between items-center mb-8">
                    <Dialog.Title className="text-2xl font-bold text-white">
                      {selectedRetellAgent?.name} Analytics
                    </Dialog.Title>
                    <button
                      onClick={() => {
                        setSelectedRetellAgent(null);
                        setIsModalDataLoading(false);
                      }}
                      className="p-2 rounded-lg hover:bg-gray-700/50 transition-colors text-gray-400 hover:text-white"
                    >
                      <FiX className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="flex gap-4 mb-8">
                    {(['day', 'week', 'month'] as const).map((period) => {
                      const isLoading = modalLoading[period];

                      return (
                        <button
                          key={period}
                          onClick={() => handlePeriodChange(period)}
                          disabled={isLoading}
                          className={`px-6 py-2 rounded-lg capitalize font-medium transition-all flex items-center gap-2 relative ${
                            selectedPeriod === period
                              ? 'bg-blue-600 text-white shadow-lg'
                              : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white disabled:opacity-50'
                          }`}
                        >
                          {isLoading && (
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-current"></div>
                          )}
                          {period}
                        </button>
                      );
                    })}
                  </div>

                  {isLoading || isModalDataLoading ? (
                    <div className="flex items-center justify-center py-32">
                      <div className="text-center">
                        <div className="relative">
                          <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-500 border-t-transparent mx-auto mb-6"></div>
                          <div className="absolute inset-0 rounded-full h-16 w-16 border-4 border-indigo-200 border-t-transparent mx-auto animate-pulse"></div>
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">Loading Retell Analytics</h3>
                        <p className="text-gray-400">Processing data from multiple pages...</p>
                        <div className="mt-4 flex justify-center space-x-1">
                          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                        </div>
                      </div>
                    </div>
                  ) : !usage ? (
                    <div className="flex items-center justify-center py-20">
                      <div className="text-center">
                        <p className="text-gray-400 text-lg">No Retell analytics data available</p>
                        <p className="text-gray-500 text-sm mt-2">Click the agent tile to load analytics</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Product Costs Bar Chart */}
                      <div className="bg-gray-800/70 rounded-xl p-6 shadow-lg border border-gray-700">
                        <h3 className="text-xl font-semibold mb-6 text-white">Product Costs</h3>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={productCostsData}
                              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                              <XAxis dataKey="product" stroke="#9ca3af" />
                              <YAxis stroke="#9ca3af" />
                              <Tooltip
                                formatter={(value) => formatCurrency(value as number)}
                                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.5rem' }}
                                itemStyle={{ color: '#fff' }}
                              />
                              <Legend formatter={(value) => <span className="text-gray-200">{value}</span>} />
                              <Bar dataKey="cost" name="Cost" fill="#6366f1" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                    {/* Call Statistics */}
                    <div className="bg-gray-800/70 rounded-xl p-6 shadow-lg border border-gray-700">
                      <h3 className="text-xl font-semibold mb-6 text-white">Call Statistics</h3>
                      <div className="space-y-6">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-300">Total Calls:</span>
                          <span className="text-xl font-semibold text-white">{usage.callCount}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-300">Failed Calls:</span>
                          <span className="text-xl font-semibold text-red-400">{usage.failedCalls}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-300">Success Rate:</span>
                          <span className="text-xl font-semibold text-green-400">
                            {formatNumber(usage.successRate, 1)}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-300">Average Duration:</span>
                          <span className="text-xl font-semibold text-white">{formatDuration(usage.avgDuration)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Cost Comparison Bar Chart */}
                    <div className="bg-gray-800/70 rounded-xl p-6 shadow-lg border border-gray-700 col-span-2">
                      <h3 className="text-xl font-semibold mb-6 text-white">Cost Analysis</h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={[
                              {
                                name: 'Costs',
                                actual: usage.totalCost,
                                billed: usage.totalCost * (selectedRetellAgent.profitMultiplier || 1.2),
                                profit: (usage.totalCost * (selectedRetellAgent.profitMultiplier || 1.2)) - usage.totalCost,
                              }
                            ]}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="name" stroke="#9ca3af" />
                            <YAxis stroke="#9ca3af" />
                            <Tooltip
                              formatter={(value) => formatCurrency(value as number)}
                              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.5rem' }}
                              itemStyle={{ color: '#fff' }}
                            />
                            <Legend formatter={(value) => <span className="text-gray-200">{value}</span>} />
                            <Bar dataKey="actual" name="Actual Cost" fill="#6366f1" />
                            <Bar dataKey="billed" name="Billed Cost" fill="#10b981" />
                            <Bar dataKey="profit" name="Profit" fill="#f59e0b" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                  )}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    );
  };

  const UltravoxAnalyticsModal = () => {
    if (!selectedUltravoxAgent) return null;

    // Get the latest analytics from the ultravoxAgents array, not from selectedUltravoxAgent
    const currentAgent = ultravoxAgents.find(a => a.id === selectedUltravoxAgent.id);
    const usage = currentAgent?.analytics;
    const isLoading = currentAgent?.isLoading || isModalDataLoading;

    return (
      <Transition appear show={!!selectedUltravoxAgent} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => {
            setSelectedUltravoxAgent(null);
            setIsModalDataLoading(false);
          }}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/80" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-5xl transform overflow-hidden rounded-2xl bg-gray-900/95 p-8 text-white shadow-xl transition-all border border-gray-700">
                  <div className="flex justify-between items-center mb-8">
                    <Dialog.Title className="text-2xl font-bold text-white">
                      {selectedUltravoxAgent?.name} Analytics
                    </Dialog.Title>
                    <button
                      onClick={() => {
                        setSelectedUltravoxAgent(null);
                        setIsModalDataLoading(false);
                      }}
                      className="p-2 rounded-lg hover:bg-gray-700/50 transition-colors text-gray-400 hover:text-white"
                    >
                      <FiX className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="flex gap-4 mb-8">
                    {(['day', 'week', 'month'] as const).map((period) => {
                      const isLoading = modalLoading[period];

                      return (
                        <button
                          key={period}
                          onClick={() => handlePeriodChange(period)}
                          disabled={isLoading}
                          className={`px-6 py-2 rounded-lg capitalize font-medium transition-all flex items-center gap-2 relative ${
                            selectedPeriod === period
                              ? 'bg-blue-600 text-white shadow-lg'
                              : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white disabled:opacity-50'
                          }`}
                        >
                          {isLoading && (
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-current"></div>
                          )}
                          {period}
                        </button>
                      );
                    })}
                  </div>

                  {isLoading || isModalDataLoading ? (
                    <div className="flex items-center justify-center py-32">
                      <div className="text-center">
                        <div className="relative">
                          <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-500 border-t-transparent mx-auto mb-6"></div>
                          <div className="absolute inset-0 rounded-full h-16 w-16 border-4 border-purple-200 border-t-transparent mx-auto animate-pulse"></div>
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">Loading Ultravox Analytics</h3>
                        <p className="text-gray-400">Processing voice AI data...</p>
                        <div className="mt-4 flex justify-center space-x-1">
                          <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                          <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                        </div>
                      </div>
                    </div>
                  ) : !usage ? (
                    <div className="flex items-center justify-center py-20">
                      <div className="text-center">
                        <p className="text-gray-400 text-lg">No Ultravox analytics data available</p>
                        <p className="text-gray-500 text-sm mt-2">Click the agent tile to load analytics</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Call Statistics */}
                      <div className="bg-gray-800/70 rounded-xl p-6 shadow-lg border border-gray-700">
                        <h3 className="text-xl font-semibold mb-6 text-white">Call Statistics</h3>
                        <div className="space-y-6">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-300">Total Calls:</span>
                            <span className="text-xl font-semibold text-white">{usage.callCount}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-300">Failed Calls:</span>
                            <span className="text-xl font-semibold text-red-400">{usage.failedCalls}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-300">Success Rate:</span>
                            <span className="text-xl font-semibold text-green-400">
                              {formatNumber(usage.successRate, 1)}%
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-300">Average Duration:</span>
                            <span className="text-xl font-semibold text-white">{formatDuration(usage.avgDuration)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Cost Analysis */}
                      <div className="bg-gray-800/70 rounded-xl p-6 shadow-lg border border-gray-700">
                        <h3 className="text-xl font-semibold mb-6 text-white">Cost Analysis</h3>
                        <div className="space-y-6">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-300">Total Cost:</span>
                            <span className="text-xl font-semibold text-white">{formatCurrency(usage.totalCost)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-300">Average Cost/Call:</span>
                            <span className="text-xl font-semibold text-green-400">{formatCurrency(usage.avgCost)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-300">Cost per Minute:</span>
                            <span className="text-xl font-semibold text-purple-400">0.05¢/min</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-300">Total Duration:</span>
                            <span className="text-xl font-semibold text-white">{formatDuration(usage.totalDuration)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Profit Analysis */}
                      <div className="bg-gray-800/70 rounded-xl p-6 shadow-lg border border-gray-700 col-span-2">
                        <h3 className="text-xl font-semibold mb-6 text-white">Profit Analysis</h3>
                        <div className="grid grid-cols-3 gap-6">
                          <div className="text-center">
                            <p className="text-gray-300 mb-2">Actual Cost</p>
                            <p className="text-2xl font-bold text-white">{formatCurrency(usage.totalCost)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-gray-300 mb-2">Billed Cost</p>
                            <p className="text-2xl font-bold text-green-400">
                              {formatCurrency(usage.totalCost * (selectedUltravoxAgent.profitMultiplier || 1.2))}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-gray-300 mb-2">Profit</p>
                            <p className="text-2xl font-bold text-amber-400">
                              {formatCurrency((usage.totalCost * (selectedUltravoxAgent.profitMultiplier || 1.2)) - usage.totalCost)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    );
  };

  const ElevenLabsAnalyticsModal = () => {
    if (!selectedElevenLabsAgent) return null;

    // Get the latest analytics from the elevenLabsAgents array, not from selectedElevenLabsAgent
    const currentAgent = elevenLabsAgents.find(a => a.id === selectedElevenLabsAgent.id);
    const usage = currentAgent?.analytics;
    const isLoading = currentAgent?.isLoading || isModalDataLoading;

    return (
      <Transition appear show={!!selectedElevenLabsAgent} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => {
            setSelectedElevenLabsAgent(null);
            setIsModalDataLoading(false);
          }}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-75" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-5xl transform overflow-hidden rounded-2xl bg-gray-900/95 p-8 text-white shadow-xl transition-all border border-gray-700">
                  <div className="flex justify-between items-center mb-8">
                    <Dialog.Title className="text-2xl font-bold text-white">
                      {selectedElevenLabsAgent?.name} Analytics
                    </Dialog.Title>
                    <button
                      onClick={() => {
                        setSelectedElevenLabsAgent(null);
                        setIsModalDataLoading(false);
                      }}
                      className="p-2 rounded-lg hover:bg-gray-700/50 transition-colors text-gray-400 hover:text-white"
                    >
                      <FiX className="w-6 h-6" />
                    </button>
                  </div>

                  {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                      <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-green-500"></div>
                    </div>
                  ) : !usage ? (
                    <div className="text-center py-20">
                      <p className="text-gray-400 text-lg">No analytics data available yet.</p>
                      <p className="text-gray-500 text-sm mt-2">Analytics will appear after your first calls.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Call Statistics */}
                      <div className="bg-gray-800/70 rounded-xl p-6 shadow-lg border border-gray-700">
                        <h3 className="text-xl font-semibold mb-6 text-white">Call Statistics</h3>
                        <div className="space-y-6">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-300">Total Calls:</span>
                            <span className="text-xl font-semibold text-white">{usage.callCount}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-300">Failed Calls:</span>
                            <span className="text-xl font-semibold text-red-400">{usage.failedCalls}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-300">Success Rate:</span>
                            <span className="text-xl font-semibold text-green-400">
                              {formatNumber(usage.successRate, 1)}%
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-300">Average Duration:</span>
                            <span className="text-xl font-semibold text-white">{formatDuration(usage.avgDuration)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Cost Analysis */}
                      <div className="bg-gray-800/70 rounded-xl p-6 shadow-lg border border-gray-700">
                        <h3 className="text-xl font-semibold mb-6 text-white">Cost Analysis</h3>
                        <div className="space-y-6">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-300">Total Cost:</span>
                            <span className="text-xl font-semibold text-white">{formatCurrency(usage.totalCost)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-300">Average Cost/Call:</span>
                            <span className="text-xl font-semibold text-green-400">{formatCurrency(usage.avgCost)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-300">Total Duration:</span>
                            <span className="text-xl font-semibold text-white">{formatDuration(usage.totalDuration)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Profit Analysis */}
                      <div className="bg-gray-800/70 rounded-xl p-6 shadow-lg border border-gray-700 col-span-2">
                        <h3 className="text-xl font-semibold mb-6 text-white">Profit Analysis</h3>
                        <div className="grid grid-cols-3 gap-6">
                          <div className="text-center">
                            <p className="text-gray-300 mb-2">Actual Cost</p>
                            <p className="text-2xl font-bold text-white">{formatCurrency(usage.totalCost)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-gray-300 mb-2">Billed Cost</p>
                            <p className="text-2xl font-bold text-green-400">
                              {formatCurrency(usage.totalCost * (selectedElevenLabsAgent.profitMultiplier || 1.2))}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-gray-300 mb-2">Profit</p>
                            <p className="text-2xl font-bold text-amber-400">
                              {formatCurrency((usage.totalCost * (selectedElevenLabsAgent.profitMultiplier || 1.2)) - usage.totalCost)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex">
      <PartnerSidebar partnerName={partnerName} onLogout={handleLogout} />

      <main className="flex-1 pl-64 transition-all duration-300">
        <div className="p-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-3xl font-bold text-white">AI Usage Analytics</h1>
              {error && error.includes('VAPI_API_KEY_MISSING') && (
                <button
                  onClick={handleSettingsClick}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-white"
                >
                  <FiSettings className="w-5 h-5" />
                  <span>Update API Key</span>
                </button>
              )}
              {retellError && retellError.includes('RETELL_API_KEY_MISSING') && (
                <button
                  onClick={handleSettingsClick}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-white"
                >
                  <FiSettings className="w-5 h-5" />
                  <span>Update API Key</span>
                </button>
              )}
            </div>

            <Tab.Group>
                <Tab.List className="flex space-x-2 rounded-xl bg-gray-800/50 backdrop-blur-sm p-1 mb-8">
                  <Tab className={({ selected }) =>
                    `w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-colors
                     ${selected
                       ? 'bg-blue-600 text-white shadow'
                       : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'}`
                  }>
                    VAPI Agents
                  </Tab>
                  <Tab className={({ selected }) =>
                    `w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-colors
                     ${selected
                       ? 'bg-blue-600 text-white shadow'
                       : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'}`
                  }>
                    Retell Agents
                  </Tab>
                  <Tab className={({ selected }) =>
                    `w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-colors
                     ${selected
                       ? 'bg-blue-600 text-white shadow'
                       : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'}`
                  }>
                    Ultravox Agents
                  </Tab>
                  <Tab className={({ selected }) =>
                    `w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-colors
                     ${selected
                       ? 'bg-blue-600 text-white shadow'
                       : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'}`
                  }>
                    ElevenLabs Agents
                  </Tab>
                  {['Knotie-AI'].map((name) => (
                    <Tab key={name} disabled className="w-full rounded-lg py-2.5 text-sm font-medium leading-5 text-gray-500 cursor-not-allowed">
                      {name} Agents
                    </Tab>
                  ))}
                </Tab.List>

                <Tab.Panels>
                  <Tab.Panel>
                    {error ? (
                      <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6 text-center">
                        <p className="text-lg text-red-400">{error}</p>
                        {error.includes('VAPI_API_KEY_MISSING') && (
                          <button
                            onClick={handleSettingsClick}
                            className="mt-4 flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors mx-auto text-white"
                          >
                            <FiSettings className="w-5 h-5" />
                            <span>Update API Key</span>
                          </button>
                        )}
                      </div>
                    ) : agents.length === 0 ? (
                      <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-8 text-center">
                        <p className="text-lg text-gray-400">No VAPI AI Agents found. Create your first agent to start tracking usage!</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {agents.map((agent) => (
                          <AgentTile key={agent.id} agent={agent} />
                        ))}
                      </div>
                    )}
                  </Tab.Panel>
                  <Tab.Panel>
                    {retellError ? (
                      <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6 text-center">
                        <p className="text-lg text-red-400">{retellError}</p>
                        {retellError.includes('RETELL_API_KEY_MISSING') && (
                          <button
                            onClick={handleSettingsClick}
                            className="mt-4 flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors mx-auto text-white"
                          >
                            <FiSettings className="w-5 h-5" />
                            <span>Update API Key</span>
                          </button>
                        )}
                      </div>
                    ) : retellAgents.length === 0 ? (
                      <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-8 text-center">
                        <p className="text-lg text-gray-400">No Retell AI Agents found. Create your first agent to start tracking usage!</p>
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                          <h2 className="text-lg font-bold text-white">Retell Agents Summary</h2>
                          <div className="flex items-center gap-2">
                            {retellSummary.isLoading ? (
                              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
                            ) : (
                              <button
                                onClick={() => fetchRetellSummary(selectedPeriod)}
                                className="p-2 rounded-full hover:bg-gray-700/50 transition-colors text-gray-400 hover:text-white"
                                title="Refresh summary"
                              >
                                <FiRefreshCw className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 pb-2">
                          <div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 rounded-lg p-5 shadow-lg border border-indigo-500/30 min-w-[200px] hover:shadow-[0_0_20px_rgba(99,102,241,0.4)] transition-all hover:border-indigo-500/50 group">
                            <div className="flex items-center gap-3 mb-3">
                              <FiDollarSign className="w-6 h-6 text-indigo-400 group-hover:text-indigo-300 transition-colors" />
                              <h3 className="text-lg font-bold text-white group-hover:text-indigo-200 transition-colors">Total Cost</h3>
                            </div>
                            <p className="text-2xl font-bold text-white group-hover:text-indigo-200 transition-colors">{formatCurrency(retellSummary.totalCost)}</p>
                            <p className="text-sm text-gray-400 mt-1">Avg: {formatCurrency(retellSummary.avgCost)}/call</p>
                          </div>
                          <div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 rounded-lg p-5 shadow-lg border border-blue-500/30 min-w-[200px] hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] transition-all hover:border-blue-500/50 group">
                            <div className="flex items-center gap-3 mb-3">
                              <FiClock className="w-6 h-6 text-blue-400 group-hover:text-blue-300 transition-colors" />
                              <h3 className="text-lg font-bold text-white group-hover:text-blue-200 transition-colors" style={{color: '#ffffff'}}>Total Duration</h3>
                            </div>
                            <p className="text-2xl font-bold text-white group-hover:text-blue-200 transition-colors" style={{color: '#ffffff'}}>{formatDuration(retellSummary.totalDuration)}</p>
                            <p className="text-sm text-gray-400 mt-1" style={{color: '#9ca3af'}}>Avg: {formatDuration(retellSummary.avgDuration)}/call</p>
                          </div>
                          <div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 rounded-lg p-5 shadow-lg border border-purple-500/30 min-w-[200px] hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] transition-all hover:border-purple-500/50 group">
                            <div className="flex items-center gap-3 mb-3">
                              <FiPhoneCall className="w-6 h-6 text-purple-400 group-hover:text-purple-300 transition-colors" />
                              <h3 className="text-lg font-bold text-white group-hover:text-purple-200 transition-colors" style={{color: '#ffffff'}}>Total Calls</h3>
                            </div>
                            <p className="text-2xl font-bold text-white group-hover:text-purple-200 transition-colors" style={{color: '#ffffff'}}>{retellSummary.totalCalls}</p>
                            <p className="text-sm text-gray-400 mt-1" style={{color: '#9ca3af'}}>{retellSummary.failedCalls} failed</p>
                          </div>
                          <div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 rounded-lg p-5 shadow-lg border border-green-500/30 min-w-[200px] hover:shadow-[0_0_20px_rgba(34,197,94,0.4)] transition-all hover:border-green-500/50 group">
                            <div className="flex items-center gap-3 mb-3">
                              <FiRefreshCw className="w-6 h-6 text-green-400 group-hover:text-green-300 transition-colors" />
                              <h3 className="text-lg font-bold text-white group-hover:text-green-200 transition-colors" style={{color: '#ffffff'}}>Success Rate</h3>
                            </div>
                            <p className="text-2xl font-bold text-white group-hover:text-green-200 transition-colors" style={{color: '#ffffff'}}>{formatNumber(retellSummary.successRate, 1)}%</p>
                            <p className="text-sm text-gray-400 mt-1">{retellSummary.totalCalls - retellSummary.failedCalls} successful</p>
                          </div>
                        </div>

                        {retellSummary.productCosts.length > 0 && (
                          <div className="mb-8">
                            <h3 className="text-lg font-semibold text-white mb-4">Cost Breakdown</h3>
                            <div className="bg-gray-800/50 p-4 rounded-lg">
                              <div className="grid grid-cols-2 gap-2">
                                {retellSummary.productCosts.map((item, index) => (
                                  <div key={index} className="flex justify-between items-center p-3 rounded bg-gray-700/30">
                                    <span className="text-gray-300">{item.product}</span>
                                    <span className="text-white font-medium">{formatCurrency(item.cost)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {retellAgents.map((agent) => (
                            <RetellAgentTile key={agent.id} agent={agent} />
                          ))}
                        </div>
                      </div>
                    )}
                  </Tab.Panel>
                  <Tab.Panel>
                    {ultravoxError ? (
                      <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6 text-center">
                        <p className="text-lg text-red-400">{ultravoxError}</p>
                        {ultravoxError.includes('ULTRAVOX_API_KEY_MISSING') && (
                          <button
                            onClick={handleSettingsClick}
                            className="mt-4 flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors mx-auto text-white"
                          >
                            <FiSettings className="w-5 h-5" />
                            <span>Update API Key</span>
                          </button>
                        )}
                      </div>
                    ) : ultravoxAgents.length === 0 ? (
                      <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-8 text-center">
                        <p className="text-lg text-gray-400">No Ultravox AI Agents found. Create your first agent to start tracking usage!</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {ultravoxAgents.map((agent) => (
                          <UltravoxAgentTile key={agent.id} agent={agent} />
                        ))}
                      </div>
                    )}
                  </Tab.Panel>
                  <Tab.Panel>
                    {elevenLabsError ? (
                      <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-8 text-center">
                        <p className="text-lg text-red-400 mb-4">{elevenLabsError}</p>
                        {elevenLabsError.includes('API key') && (
                          <button
                            onClick={() => router.push('/partner/ai-agents/elevenlabs')}
                            className="mt-4 flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors mx-auto text-white"
                          >
                            <FiSettings className="w-5 h-5" />
                            <span>Update API Key</span>
                          </button>
                        )}
                      </div>
                    ) : elevenLabsAgents.length === 0 ? (
                      <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-8 text-center">
                        <p className="text-lg text-gray-400">No ElevenLabs AI Agents found. Create your first agent to start tracking usage!</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {elevenLabsAgents.map((agent) => (
                          <ElevenLabsAgentTile key={agent.id} agent={agent} />
                        ))}
                      </div>
                    )}
                  </Tab.Panel>
                  {['Knotie-AI'].map((name) => (
                    <Tab.Panel key={name}>
                      <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-8 text-center">
                        <p className="text-lg text-gray-400">{name} analytics coming soon</p>
                      </div>
                    </Tab.Panel>
                  ))}
                </Tab.Panels>
              </Tab.Group>
          </div>
        </div>
      </main>

      <AnalyticsModal />
      <RetellAnalyticsModal />
      <UltravoxAnalyticsModal />
      <ElevenLabsAnalyticsModal />

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'rgba(31, 41, 55, 0.95)',
            color: '#fff',
            border: '1px solid rgba(55, 65, 81, 0.5)',
            borderRadius: '12px',
            backdropFilter: 'blur(10px)',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </div>
  );
}
