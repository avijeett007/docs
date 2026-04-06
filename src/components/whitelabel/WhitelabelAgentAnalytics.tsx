'use client';

import React, { useState, useEffect } from 'react';
import { FiBarChart2, FiAlertCircle, FiInfo } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { usePartnerBranding } from '@/lib/partnerBranding';
import { subDays } from 'date-fns';

interface AgentPerformance {
  agent_id: string;
  agent_name: string;
  call_count: number;
  avg_duration: number;
  avg_sentiment: number;
  success_rate: number;
}

interface DateRange {
  label: string;
  days: number;
}

interface WhitelabelAgentAnalyticsProps {
  selectedDateRange: DateRange;
}

const WhitelabelAgentAnalytics: React.FC<WhitelabelAgentAnalyticsProps> = ({ selectedDateRange }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [agentData, setAgentData] = useState<AgentPerformance[]>([]);
  const { branding } = usePartnerBranding();
  const { primaryColor } = branding;

  const fetchAgentAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      const endDate = new Date().toISOString();
      const startDate = subDays(new Date(), selectedDateRange.days).toISOString();

      const response = await fetch(`/api/whitelabel/agent-analytics?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch agent analytics');
      }

      const data = await response.json();
      setAgentData(data);
    } catch (err) {
      console.error('Error fetching agent analytics:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgentAnalytics();
  }, [selectedDateRange.days]); // Only re-fetch when the actual days value changes

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 mb-4" style={{ borderColor: primaryColor }}></div>
        <p className="text-gray-400 text-sm">Loading agent analytics for {selectedDateRange.label.toLowerCase()}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-center">
        <FiAlertCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (!agentData || agentData.length === 0) {
    return (
      <div className="bg-gray-800/50 rounded-lg p-6 text-center">
        <FiInfo className="w-8 h-8 mx-auto mb-2 text-gray-400" />
        <p className="text-gray-400">No agent analytics data available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-800/50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-white mb-4">Agent Performance</h3>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Agent</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Calls</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Avg. Duration</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Sentiment</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Success Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {agentData.map((agent, index) => (
                <motion.tr 
                  key={agent.agent_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="hover:bg-gray-700/30"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{agent.agent_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{agent.call_count}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{agent.avg_duration.toFixed(1)} min</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div 
                        className="h-2 rounded-full w-16 bg-gray-700"
                        style={{ 
                          background: `linear-gradient(90deg, ${primaryColor}${Math.round(agent.avg_sentiment * 100)} 0%, transparent 0%)` 
                        }}
                      ></div>
                      <span className="ml-2 text-sm text-gray-300">{(agent.avg_sentiment).toFixed(2)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div 
                        className="h-2 rounded-full w-16 bg-gray-700"
                        style={{ 
                          background: `linear-gradient(90deg, ${primaryColor}${Math.round(agent.success_rate * 100)} 0%, transparent 0%)` 
                        }}
                      ></div>
                      <span className="ml-2 text-sm text-gray-300">{(agent.success_rate * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800/50 rounded-lg p-6">
          <h3 className="text-lg font-medium text-white mb-4">Top Performing Agent</h3>
          {agentData.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center mr-3"
                    style={{ backgroundColor: `${primaryColor}20` }}
                  >
                    <FiBarChart2 style={{ color: primaryColor }} />
                  </div>
                  <div>
                    <div className="text-white font-medium">{agentData[0].agent_name}</div>
                    <div className="text-sm text-gray-400">{agentData[0].call_count} calls</div>
                  </div>
                </div>
                <div className="text-2xl font-semibold" style={{ color: primaryColor }}>
                  {(agentData[0].success_rate * 100).toFixed(0)}%
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Avg. Duration</span>
                  <span className="text-white">{agentData[0].avg_duration.toFixed(1)} min</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Avg. Sentiment</span>
                  <span className="text-white">{agentData[0].avg_sentiment.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-gray-800/50 rounded-lg p-6">
          <h3 className="text-lg font-medium text-white mb-4">Agent Comparison</h3>
          <div className="text-center text-gray-400 py-8">
            Detailed agent comparison charts coming soon
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhitelabelAgentAnalytics;
