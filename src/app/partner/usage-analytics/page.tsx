'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  FiClock,
  FiPhone,
  FiDollarSign,
  FiActivity
} from 'react-icons/fi';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { useRouter } from 'next/navigation';
import GuidedPartnerSidebar from '@/components/partner/GuidedPartnerSidebar';
import { UserGuideProvider } from '@/context/UserGuideContext';

interface UsageAnalytics {
  totalCreditsUsed: number;
  totalCalls: number;
  totalDuration: number;
  averageCallDuration: number;
  currentBalance: number;
  costBreakdown: Record<string, number>;
  usageByProvider: Record<string, {
    credits: number;
    calls: number;
    duration: number;
  }>;
  dailyUsage: Array<{
    date: string;
    credits: number;
    calls: number;
    duration: number;
  }>;
  efficiency: {
    costPerMinute: number;
    costPerCall: number;
    efficiencyScore: number;
    efficiencyRating: string;
    averageCallDurationMinutes: number;
  };
}

export default function UsageAnalyticsPage() {
  const router = useRouter();
  const [analytics, setAnalytics] = useState<UsageAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30'); // days
  const [selectedProvider, setSelectedProvider] = useState('all');
  const [partnerName, setPartnerName] = useState('Partner');

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const params = new URLSearchParams();

      // Calculate date range
      if (dateRange !== 'all') {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(dateRange));

        params.append('startDate', startDate.toISOString());
        params.append('endDate', endDate.toISOString());
      }

      if (selectedProvider !== 'all') {
        params.append('provider', selectedProvider);
      }

      const response = await fetch(`/api/partner/usage-analytics?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setAnalytics(data.data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedProvider]);

  useEffect(() => {
    // Check authentication and get partner info
    const token = localStorage.getItem('partner_token');
    if (!token) {
      router.push('/partner/login');
      return;
    }

    // Fetch partner info
    const fetchPartnerInfo = async () => {
      try {
        const response = await fetch('/api/partner/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setPartnerName(data.businessName || 'Partner');
        }
      } catch (error) {
        console.error('Error fetching partner info:', error);
      }
    };

    fetchPartnerInfo();
    fetchAnalytics();
  }, [dateRange, selectedProvider, router, fetchAnalytics]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const getEfficiencyColor = (rating: string) => {
    switch (rating) {
      case 'excellent': return 'text-green-500';
      case 'good': return 'text-blue-500';
      case 'fair': return 'text-amber-500';
      case 'poor': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const providerColors = {
    vapi: '#3B82F6',
    retell: '#10B981',
    ultravox: '#8B5CF6'
  };

  const handleLogout = () => {
    localStorage.removeItem('partner_token');
    router.push('/partner/login');
  };

  if (loading) {
    return (
      <UserGuideProvider>
        <div className="min-h-screen bg-gray-900 text-white">
          <GuidedPartnerSidebar partnerName={partnerName} onLogout={handleLogout} />
        <main className="flex-1 pl-64 min-h-screen">
          <div className="p-8">
            <div className="flex items-center justify-center h-64">
              <div className="text-white">Loading analytics...</div>
            </div>
          </div>
        </main>
        </div>
      </UserGuideProvider>
    );
  }

  return (
    <UserGuideProvider>
      <div className="min-h-screen bg-gray-900 text-white">
        <GuidedPartnerSidebar partnerName={partnerName} onLogout={handleLogout} />
      <main className="flex-1 pl-64 min-h-screen">
        <div className="p-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">Usage Analytics</h1>
            <p className="text-gray-400">Monitor your AI agent usage and costs</p>
          </div>
          
          <div className="flex gap-4">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="all">All time</option>
            </select>

            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Providers</option>
              <option value="vapi">VAPI</option>
              <option value="retell">Retell</option>
              <option value="ultravox">Ultravox</option>
            </select>
          </div>
        </div>

        {analytics && (
          <>
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-800 rounded-lg p-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Credits Used</p>
                    <p className="text-2xl font-bold text-white">{formatNumber(analytics.totalCreditsUsed)}</p>
                  </div>
                  <FiDollarSign className="text-blue-500 text-2xl" />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-gray-800 rounded-lg p-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Total Calls</p>
                    <p className="text-2xl font-bold text-white">{formatNumber(analytics.totalCalls)}</p>
                  </div>
                  <FiPhone className="text-green-500 text-2xl" />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-gray-800 rounded-lg p-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Total Duration</p>
                    <p className="text-2xl font-bold text-white">{formatDuration(analytics.totalDuration)}</p>
                  </div>
                  <FiClock className="text-purple-500 text-2xl" />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-gray-800 rounded-lg p-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Efficiency</p>
                    <p className={`text-2xl font-bold capitalize ${getEfficiencyColor(analytics.efficiency.efficiencyRating)}`}>
                      {analytics.efficiency.efficiencyRating}
                    </p>
                  </div>
                  <FiActivity className="text-amber-500 text-2xl" />
                </div>
              </motion.div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Daily Usage Chart */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Daily Usage Trend</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics.dailyUsage}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="date" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1F2937', 
                          border: '1px solid #374151',
                          borderRadius: '8px'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="credits" 
                        stroke="#3B82F6" 
                        strokeWidth={2}
                        name="Credits Used"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Provider Usage Distribution */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Usage by Provider</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={Object.entries(analytics.usageByProvider).map(([provider, data]) => ({
                          name: provider.toUpperCase(),
                          value: data.credits,
                          color: providerColors[provider as keyof typeof providerColors] || '#6B7280'
                        }))}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {Object.entries(analytics.usageByProvider).map(([provider], index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={providerColors[provider as keyof typeof providerColors] || '#6B7280'} 
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Efficiency Metrics */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Efficiency Metrics</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <p className="text-gray-400 text-sm">Cost per Call</p>
                  <p className="text-xl font-bold text-white">{analytics.efficiency.costPerCall} credits</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-400 text-sm">Cost per Minute</p>
                  <p className="text-xl font-bold text-white">{analytics.efficiency.costPerMinute} credits</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-400 text-sm">Avg Call Duration</p>
                  <p className="text-xl font-bold text-white">{analytics.efficiency.averageCallDurationMinutes} min</p>
                </div>
              </div>
            </div>

            {/* Provider Breakdown Table */}
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <div className="p-6 border-b border-gray-700">
                <h3 className="text-lg font-semibold text-white">Provider Breakdown</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Provider</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Credits Used</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Total Calls</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Total Duration</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Avg Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {Object.entries(analytics.usageByProvider).map(([provider, data]) => (
                      <tr key={provider} className="hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-white uppercase">{provider}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                          {formatNumber(data.credits)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                          {formatNumber(data.calls)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                          {formatDuration(data.duration)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                          {data.calls > 0 ? formatDuration(Math.round(data.duration / data.calls)) : '0s'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
        </div>
        </div>
      </main>
      </div>
    </UserGuideProvider>
  );
}
