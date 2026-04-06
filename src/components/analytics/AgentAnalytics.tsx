'use client';

import React, { useState, useEffect } from 'react';
import { FiUser, FiAlertCircle, FiInfo, FiRefreshCw } from 'react-icons/fi';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { usePartnerBranding } from '@/lib/partnerBranding';

interface AgentAnalyticsProps {
  userId: string;
}

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
  failureReasons?: { reason: string; count: number }[];
}

interface AgentWithAnalytics extends Agent {
  analytics?: AgentAnalytics;
  isLoading?: boolean;
}

const AgentAnalytics: React.FC<AgentAnalyticsProps> = ({ userId }) => {
  const [agents, setAgents] = useState<AgentWithAnalytics[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { branding } = usePartnerBranding();
  const { primaryColor, secondaryColor } = branding;

  const fetchAgents = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch VAPI agents
      const vapiResponse = await fetch('/api/customer/vapi-agents');
      
      if (!vapiResponse.ok) {
        throw new Error('Failed to fetch VAPI agents');
      }
      
      const vapiData = await vapiResponse.json();
      const vapiAgents: AgentWithAnalytics[] = vapiData.map((agent: any) => ({
        ...agent,
        type: 'vapi'
      }));
      
      // Fetch Retell agents
      const retellResponse = await fetch('/api/customer/retell-agents');
      
      if (!retellResponse.ok) {
        throw new Error('Failed to fetch Retell agents');
      }
      
      const retellData = await retellResponse.json();
      const retellAgents: AgentWithAnalytics[] = retellData.map((agent: any) => ({
        ...agent,
        type: 'retell'
      }));
      
      // Combine all agents
      const allAgents: AgentWithAnalytics[] = [...vapiAgents, ...retellAgents];
      
      setAgents(allAgents);
      
      // Set the first agent as selected
      if (allAgents.length > 0 && !selectedAgent) {
        setSelectedAgent(allAgents[0].id);
        await fetchAgentAnalytics(allAgents[0]);
      } else if (selectedAgent) {
        const agent = allAgents.find(a => a.id === selectedAgent);
        if (agent) {
          await fetchAgentAnalytics(agent);
        }
      }
    } catch (err) {
      console.error('Error fetching agents:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchAgentAnalytics = async (agent: AgentWithAnalytics) => {
    try {
      // Update the agent's loading state
      setAgents(prev => prev.map(a => 
        a.id === agent.id ? { ...a, isLoading: true } : a
      ));
      
      const endpoint = agent.type === 'vapi'
        ? `/api/customer/vapi-agents/${agent.id}/analytics?period=month`
        : `/api/customer/retell-agents/${agent.id}/analytics?period=month`;
      
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        throw new Error('Failed to fetch agent analytics');
      }
      
      const data = await response.json();
      
      // Process the analytics data
      const analytics = processAnalyticsData(data, agent.id);
      
      // Update the agent with analytics
      setAgents(prev => prev.map(a => 
        a.id === agent.id ? { ...a, analytics, isLoading: false } : a
      ));
    } catch (err) {
      console.error('Error fetching agent analytics:', err);
      
      // Update the agent's loading state
      setAgents(prev => prev.map(a => 
        a.id === agent.id ? { ...a, isLoading: false } : a
      ));
    }
  };

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
    
    // Extract failure reasons if available
    const failureReasons = data.find(d => d.name === "Failure Reasons")?.result
      .filter((r: any) => r.assistantId === agentId)
      .map((r: any) => ({
        reason: r['analysis.failureReason'] || 'Unknown',
        count: parseInt(r.countId || '0')
      })) || [];
    
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

  useEffect(() => {
    fetchAgents();
  }, []);

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const handleAgentSelect = (agentId: string) => {
    setSelectedAgent(agentId);
    const agent = agents.find(a => a.id === agentId);
    if (agent && !agent.analytics) {
      fetchAgentAnalytics(agent);
    }
  };

  const handleRefresh = () => {
    if (selectedAgent) {
      const agent = agents.find(a => a.id === selectedAgent);
      if (agent) {
        fetchAgentAnalytics(agent);
      }
    } else {
      fetchAgents();
    }
  };

  const selectedAgentData = selectedAgent ? agents.find(a => a.id === selectedAgent) : null;

  return (
    <div className="space-y-6">
      {loading && agents.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : error && agents.length === 0 ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-center">
          <FiAlertCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
          <p className="text-red-400">{error}</p>
        </div>
      ) : agents.length === 0 ? (
        <div className="bg-gray-800/50 rounded-lg p-6 text-center">
          <FiInfo className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-gray-400">No AI agents available. Please set up an agent first.</p>
        </div>
      ) : (
        <>
          {/* Agent Selection */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 overflow-x-auto pb-2">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => handleAgentSelect(agent.id)}
                  className={clsx(
                    "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                    selectedAgent === agent.id
                      ? "bg-blue-500 text-white"
                      : "bg-gray-800 text-gray-400 hover:text-white"
                  )}
                  style={selectedAgent === agent.id ? { backgroundColor: primaryColor } : {}}
                >
                  <div className="flex items-center">
                    <FiUser className="mr-2 h-4 w-4" />
                    {agent.name}
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={handleRefresh}
              className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white transition-colors"
              disabled={loading}
            >
              <FiRefreshCw className={clsx("w-4 h-4", loading && "animate-spin")} />
            </button>
          </div>
          
          {/* Agent Analytics */}
          {selectedAgentData ? (
            selectedAgentData.isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : selectedAgentData.analytics ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                    <div className="text-gray-400 text-sm mb-2">Total Calls</div>
                    <div className="text-2xl font-semibold text-white">
                      {selectedAgentData.analytics.callCount}
                    </div>
                    <div className="mt-1 text-sm text-gray-400">
                      {selectedAgentData.analytics.failedCalls} Failed Calls
                    </div>
                  </div>
                  
                  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                    <div className="text-gray-400 text-sm mb-2">Success Rate</div>
                    <div className="text-2xl font-semibold text-white">
                      {Math.round(selectedAgentData.analytics.successRate)}%
                    </div>
                    <div className="mt-1 text-sm text-gray-400">
                      Based on {selectedAgentData.analytics.callCount} total calls
                    </div>
                  </div>
                  
                  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                    <div className="text-gray-400 text-sm mb-2">Avg. Call Duration</div>
                    <div className="text-2xl font-semibold text-white">
                      {formatDuration(selectedAgentData.analytics.avgDuration)}
                    </div>
                    <div className="mt-1 text-sm text-gray-400">
                      Total: {formatDuration(selectedAgentData.analytics.totalDuration)}
                    </div>
                  </div>
                </div>
                
                {/* Cost Information */}
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                  <h4 className="text-lg font-medium text-white mb-4">Cost Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-800/70 p-4 rounded-lg">
                      <div className="text-gray-400 text-sm mb-1">Average Cost per Call</div>
                      <div className="text-xl font-semibold text-white">
                        {formatCurrency(selectedAgentData.analytics.avgCost)}
                      </div>
                    </div>
                    <div className="bg-gray-800/70 p-4 rounded-lg">
                      <div className="text-gray-400 text-sm mb-1">Total Cost</div>
                      <div className="text-xl font-semibold text-white">
                        {formatCurrency(selectedAgentData.analytics.totalCost)}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Failure Reasons */}
                {selectedAgentData.analytics.failureReasons && selectedAgentData.analytics.failureReasons.length > 0 && (
                  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                    <h4 className="text-lg font-medium text-white mb-4">Failure Reasons</h4>
                    <div className="space-y-2">
                      {selectedAgentData.analytics.failureReasons.map((reason, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-800/70 rounded-lg">
                          <div className="text-gray-300">{reason.reason}</div>
                          <div className="text-gray-400 text-sm">{reason.count} calls</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="bg-gray-800/50 rounded-lg p-6 text-center">
                <FiInfo className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-gray-400">No analytics data available for this agent.</p>
              </div>
            )
          ) : (
            <div className="bg-gray-800/50 rounded-lg p-6 text-center">
              <FiInfo className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="text-gray-400">Select an agent to view analytics.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AgentAnalytics;
