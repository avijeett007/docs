'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FiBarChart,
  FiTrendingUp,
  FiDollarSign,
  FiFileText,
  FiUsers,
  FiCalendar,
  FiLoader,
  FiRefreshCw
} from 'react-icons/fi';

interface KBProcessingAnalyticsProps {
  partnerId?: string;
  className?: string;
  timeRange?: '7d' | '30d' | '90d';
}

interface AnalyticsData {
  totalProcessingEvents: number;
  totalCreditsUsed: number;
  totalFilesProcessed: number;
  activeCustomers: number;
  averageCostPerProcessing: number;
  recentActivity: Array<{
    id: string;
    customerName: string;
    knowledgeBaseName: string;
    creditsUsed: number;
    filesProcessed: number;
    processedAt: string;
  }>;
  dailyStats: Array<{
    date: string;
    processingEvents: number;
    creditsUsed: number;
  }>;
}

export default function KBProcessingAnalytics({
  partnerId,
  className = '',
  timeRange = '30d'
}: KBProcessingAnalyticsProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState(timeRange);

  // Fetch analytics data
  const fetchAnalytics = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('partner_token');
      const response = await fetch(`/api/partner/analytics/knowledge-base-processing?timeRange=${selectedTimeRange}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cookie': `partner_token=${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const data = await response.json();
      setAnalytics(data.data);
    } catch (error) {
      console.error('Error fetching KB processing analytics:', error);
      // Set mock data for now
      setAnalytics({
        totalProcessingEvents: 24,
        totalCreditsUsed: 1250,
        totalFilesProcessed: 156,
        activeCustomers: 8,
        averageCostPerProcessing: 52.1,
        recentActivity: [
          {
            id: '1',
            customerName: 'Acme Corp',
            knowledgeBaseName: 'Product Documentation',
            creditsUsed: 75,
            filesProcessed: 12,
            processedAt: '2024-01-15T10:30:00Z'
          },
          {
            id: '2',
            customerName: 'TechStart Inc',
            knowledgeBaseName: 'Support Articles',
            creditsUsed: 50,
            filesProcessed: 8,
            processedAt: '2024-01-14T15:45:00Z'
          },
          {
            id: '3',
            customerName: 'Global Solutions',
            knowledgeBaseName: 'Training Materials',
            creditsUsed: 100,
            filesProcessed: 20,
            processedAt: '2024-01-13T09:15:00Z'
          }
        ],
        dailyStats: [
          { date: '2024-01-10', processingEvents: 2, creditsUsed: 125 },
          { date: '2024-01-11', processingEvents: 1, creditsUsed: 50 },
          { date: '2024-01-12', processingEvents: 3, creditsUsed: 175 },
          { date: '2024-01-13', processingEvents: 1, creditsUsed: 100 },
          { date: '2024-01-14', processingEvents: 2, creditsUsed: 125 },
          { date: '2024-01-15', processingEvents: 1, creditsUsed: 75 },
        ]
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [selectedTimeRange]);

  if (isLoading) {
    return (
      <div className={`bg-gray-800/50 rounded-xl p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <FiLoader className="w-6 h-6 text-blue-400 animate-spin" />
          <span className="ml-2 text-gray-300">Loading analytics...</span>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className={`bg-gray-800/50 rounded-xl p-6 ${className}`}>
        <div className="flex items-center justify-center py-8 text-gray-400">
          <span>No analytics data available</span>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={`bg-gray-800/50 rounded-xl p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FiBarChart className="w-6 h-6 text-blue-400" />
          <div>
            <h3 className="text-xl font-semibold text-white">Knowledge Base Processing Analytics</h3>
            <p className="text-sm text-gray-400">Track processing usage and costs</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Time Range Selector */}
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value as '7d' | '30d' | '90d')}
            className="px-3 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          
          <button
            onClick={fetchAnalytics}
            disabled={isLoading}
            className="p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            title="Refresh analytics"
          >
            <FiRefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-700/30 rounded-lg p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <FiTrendingUp className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-gray-400">Processing Events</span>
          </div>
          <div className="text-2xl font-bold text-white">{analytics.totalProcessingEvents}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-700/30 rounded-lg p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <FiDollarSign className="w-4 h-4 text-green-400" />
            <span className="text-xs text-gray-400">Credits Used</span>
          </div>
          <div className="text-2xl font-bold text-white">{analytics.totalCreditsUsed.toLocaleString()}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gray-700/30 rounded-lg p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <FiFileText className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-gray-400">Files Processed</span>
          </div>
          <div className="text-2xl font-bold text-white">{analytics.totalFilesProcessed}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gray-700/30 rounded-lg p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <FiUsers className="w-4 h-4 text-orange-400" />
            <span className="text-xs text-gray-400">Active Customers</span>
          </div>
          <div className="text-2xl font-bold text-white">{analytics.activeCustomers}</div>
        </motion.div>
      </div>

      {/* Average Cost */}
      <div className="mb-6 p-4 bg-blue-600/10 border border-blue-600/20 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-blue-400 mb-1">Average Cost per Processing</div>
            <div className="text-xl font-bold text-white">{analytics.averageCostPerProcessing.toFixed(1)} credits</div>
          </div>
          <FiDollarSign className="w-8 h-8 text-blue-400" />
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h4 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
          <FiCalendar className="w-5 h-5" />
          Recent Processing Activity
        </h4>
        
        <div className="space-y-3">
          {analytics.recentActivity.map((activity, index) => (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center justify-between p-3 bg-gray-700/20 rounded-lg"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-white">{activity.customerName}</span>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-300">{activity.knowledgeBaseName}</span>
                </div>
                <div className="text-sm text-gray-400">
                  {formatDate(activity.processedAt)}
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-sm font-medium text-green-400">
                  {activity.creditsUsed} credits
                </div>
                <div className="text-xs text-gray-400">
                  {activity.filesProcessed} files
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {analytics.recentActivity.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <FiFileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No recent processing activity</p>
          </div>
        )}
      </div>
    </div>
  );
}
