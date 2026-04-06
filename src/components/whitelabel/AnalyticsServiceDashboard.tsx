'use client';

import React, { useState, useEffect } from 'react';
import { FiPhoneCall, FiClock, FiUsers, FiBarChart2, FiTrendingUp, FiActivity } from 'react-icons/fi';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { usePartnerBranding } from '@/lib/partnerBranding';
import { formatDistanceToNow } from 'date-fns';

interface DashboardData {
  summary: {
    totalCalls: number;
    totalDuration: number;
    totalCost: number;
    averageCallDuration: number;
  };
  recentCalls: Array<{
    id: string;
    agent: string;
    caller: string;
    duration: string;
    status: string;
    time: string;
  }>;
  callTrend: Array<{
    day: string;
    calls: number;
  }>;
  agentCount: number;
}

const AnalyticsServiceDashboard: React.FC = () => {
  const { branding } = usePartnerBranding();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  // Fetch dashboard data from analytics service
  const fetchDashboardData = async (period: string = 'month') => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('Fetching dashboard data from analytics service:', { period });

      const response = await fetch(`/api/whitelabel/analytics/dashboard?period=${period}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch dashboard data: ${response.status}`);
      }

      const data = await response.json();
      setDashboardData(data);

      console.log('Successfully loaded dashboard data from analytics service:', {
        totalCalls: data.summary?.totalCalls || 0,
        recentCallsCount: data.recentCalls?.length || 0,
        agentCount: data.agentCount || 0
      });

    } catch (error) {
      console.error('Error fetching dashboard data from analytics service:', error);
      setError('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  // Load dashboard data when component mounts or period changes
  useEffect(() => {
    fetchDashboardData(selectedPeriod);
  }, [selectedPeriod]);

  // Format duration from seconds to readable format
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 3
    }).format(amount);
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
          onClick={() => fetchDashboardData(selectedPeriod)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400">No dashboard data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Dashboard 
          </h1>
          <p className="text-gray-400">
            Overview of your AI agent performance with enhanced analytics
          </p>
        </div>

        {/* Period Selection */}
        <div className="relative">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
          >
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
            <option value="quarter">Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gray-800/30 rounded-lg border border-gray-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Calls</p>
              <p className="text-2xl font-bold text-white">{dashboardData.summary.totalCalls}</p>
            </div>
            <div className="p-3 bg-blue-600/20 rounded-lg">
              <FiPhoneCall className="w-6 h-6 text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800/30 rounded-lg border border-gray-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Duration</p>
              <p className="text-2xl font-bold text-white">
                {formatDuration(dashboardData.summary.totalDuration * 60)}
              </p>
            </div>
            <div className="p-3 bg-green-600/20 rounded-lg">
              <FiClock className="w-6 h-6 text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800/30 rounded-lg border border-gray-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Active Agents</p>
              <p className="text-2xl font-bold text-white">{dashboardData.agentCount}</p>
            </div>
            <div className="p-3 bg-purple-600/20 rounded-lg">
              <FiUsers className="w-6 h-6 text-purple-400" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800/30 rounded-lg border border-gray-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Avg Duration</p>
              <p className="text-2xl font-bold text-white">
                {formatDuration(dashboardData.summary.averageCallDuration)}
              </p>
            </div>
            <div className="p-3 bg-yellow-600/20 rounded-lg">
              <FiActivity className="w-6 h-6 text-amber-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Call Volume Trend */}
        <div className="bg-gray-800/30 rounded-lg border border-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-white">Call Volume Trend</h3>
            <FiTrendingUp className="w-5 h-5 text-blue-400" />
          </div>
          
          {dashboardData.callTrend.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dashboardData.callTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="day" 
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
                    dataKey="calls" 
                    stroke="#3B82F6" 
                    strokeWidth={2}
                    dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">
              No call trend data available
            </div>
          )}
        </div>

        {/* Recent Calls */}
        <div className="bg-gray-800/30 rounded-lg border border-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-white">Recent Calls</h3>
            <FiBarChart2 className="w-5 h-5 text-green-400" />
          </div>
          
          {dashboardData.recentCalls.length > 0 ? (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {dashboardData.recentCalls.map((call) => (
                <div key={call.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-white text-sm font-medium">{call.agent}</span>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        call.status === 'Completed' 
                          ? 'bg-green-600/20 text-green-400' 
                          : 'bg-red-600/20 text-red-400'
                      }`}>
                        {call.status}
                      </span>
                    </div>
                    <div className="flex items-center space-x-4 text-xs text-gray-400">
                      <span>{call.caller}</span>
                      <span>{call.duration}</span>
                      <span>{call.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">
              No recent calls available
            </div>
          )}
        </div>
      </div>

      {/* Additional Insights */}
      <div className="bg-gray-800/30 rounded-lg border border-gray-800 p-6">
        <h3 className="text-lg font-medium text-white mb-4">Analytics Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400 mb-2">
              {dashboardData.summary.totalCalls > 0 ? 
                ((dashboardData.summary.totalCalls - 0) / Math.max(dashboardData.summary.totalCalls, 1) * 100).toFixed(1) : 0}%
            </div>
            <p className="text-gray-400 text-sm">Call Success Rate</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400 mb-2">
              {dashboardData.summary.averageCallDuration > 0 ? 
                formatDuration(dashboardData.summary.averageCallDuration) : '0m'}
            </div>
            <p className="text-gray-400 text-sm">Avg Call Duration</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400 mb-2">
              {dashboardData.agentCount}
            </div>
            <p className="text-gray-400 text-sm">Active AI Agents</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsServiceDashboard;
