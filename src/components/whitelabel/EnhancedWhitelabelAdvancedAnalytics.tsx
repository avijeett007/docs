'use client';

import React, { useState, useEffect, useRef } from 'react';
import '@/styles/analytics.css';
import {
  FiBarChart2,
  FiTrendingUp,
  FiCalendar,
  FiRefreshCw,
  FiAlertCircle,
  FiCheckCircle,
  FiInfo,
  FiList,
  FiUsers,
  FiActivity,
  FiTarget
} from 'react-icons/fi';
import { Tab } from '@headlessui/react';
import { motion } from 'framer-motion';
import { subDays } from 'date-fns';
import clsx from 'clsx';
import { usePartnerBranding } from '@/lib/partnerBranding';
import {
  PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';

interface EnhancedWhitelabelAdvancedAnalyticsProps {
  customerId?: string;
}

interface DateRange {
  label: string;
  days: number;
  period: string;
}

interface AdvancedAnalyticsData {
  customerId: string;
  agentCount: number;
  period: string;
  data: {
    sentimentAnalysis: {
      distribution: {
        positive: number;
        neutral: number;
        negative: number;
      };
      averageScore: number;
      trend: number[];
    };
    topicAnalysis: {
      topics: Array<{
        name: string;
        count: number;
      }>;
      topicTrends: Array<{
        name: string;
        count: number;
      }>;
    };
    keyMoments: {
      types: string[];
      frequency: Array<{
        type: string;
        count: number;
      }>;
    };
    actionItems: {
      common: Array<{
        action: string;
        count: number;
      }>;
      followUpRate: number;
    };
    callVolumeOverTime: {
      daily: Array<{
        date: string;
        calls: number;
      }>;
      hourly: Array<{
        hour: number;
        calls: number;
      }>;
    };
    conversionMetrics: {
      rate: number;
      opportunities: number;
      successful: number;
    };
  };
}

interface CustomerFeatures {
  enableAdvancedAnalytics: boolean;
  enableDetailedCallAnalysis: boolean;
  enableActionPointAnalysis: boolean;
}

const dateRanges: DateRange[] = [
  { label: '7 Days', days: 7, period: '7d' },
  { label: '30 Days', days: 30, period: '30d' },
  { label: '90 Days', days: 90, period: '90d' }
];

const EnhancedWhitelabelAdvancedAnalytics: React.FC<EnhancedWhitelabelAdvancedAnalyticsProps> = ({ customerId }) => {
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange>(dateRanges[1]); // Default to 30 days
  const [analyticsData, setAnalyticsData] = useState<AdvancedAnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [features, setFeatures] = useState<CustomerFeatures>({
    enableAdvancedAnalytics: false,
    enableDetailedCallAnalysis: false,
    enableActionPointAnalysis: false
  });
  const { branding } = usePartnerBranding();
  const primaryColor = branding.primaryColor || '#3B82F6';
  const secondaryColor = branding.secondaryColor || '#1E40AF';

  // Create a ref for the container element
  const containerRef = useRef<HTMLDivElement>(null);

  // Set CSS variables for the gradient colors
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.setProperty('--primary-color', primaryColor);
      containerRef.current.style.setProperty('--secondary-color', secondaryColor);
    }
  }, [primaryColor, secondaryColor]);

  // Fetch customer features
  useEffect(() => {
    const fetchCustomerFeatures = async () => {
      try {
        const response = await fetch('/api/whitelabel/customer/features');
        if (response.ok) {
          const data = await response.json();
          setFeatures({
            enableAdvancedAnalytics: data.enableAdvancedAnalytics || false,
            enableDetailedCallAnalysis: data.enableDetailedCallAnalysis || false,
            enableActionPointAnalysis: data.enableActionPointAnalysis || false
          });
        } else {
          console.error('Failed to fetch customer features');
        }
      } catch (err) {
        console.error('Error fetching customer features:', err);
      }
    };

    fetchCustomerFeatures();
  }, []);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('Fetching advanced analytics from analytics service:', {
        period: selectedDateRange.period
      });

      const response = await fetch(`/api/whitelabel/analytics/advanced?period=${selectedDateRange.period}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch analytics data');
      }

      const data = await response.json();
      console.log('Successfully loaded advanced analytics from analytics service:', data);
      setAnalyticsData(data);
    } catch (err) {
      console.error('Error fetching analytics data:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (features.enableAdvancedAnalytics) {
      fetchAnalyticsData();
    }
  }, [selectedDateRange, features.enableAdvancedAnalytics]);

  const handleRefresh = () => {
    fetchAnalyticsData();
  };

  // Format data for charts
  const formatSentimentData = () => {
    if (!analyticsData?.data.sentimentAnalysis) return [];
    
    const { distribution } = analyticsData.data.sentimentAnalysis;
    return [
      { name: 'Positive', value: distribution.positive, color: '#10B981' },
      { name: 'Neutral', value: distribution.neutral, color: '#F59E0B' },
      { name: 'Negative', value: distribution.negative, color: '#EF4444' }
    ].filter(item => item.value > 0);
  };

  const formatTopicsData = () => {
    if (!analyticsData?.data.topicAnalysis?.topics) return [];
    
    return analyticsData.data.topicAnalysis.topics
      .slice(0, 8) // Show top 8 topics
      .map((topic, index) => ({
        ...topic,
        color: `hsl(${(index * 45) % 360}, 70%, 60%)`
      }));
  };

  const formatKeyMomentsData = () => {
    if (!analyticsData?.data.keyMoments?.frequency) return [];
    
    return analyticsData.data.keyMoments.frequency
      .slice(0, 6) // Show top 6 key moments
      .map((moment, index) => ({
        ...moment,
        type: moment.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        color: `hsl(${(index * 60) % 360}, 70%, 60%)`
      }));
  };

  const formatCallVolumeData = () => {
    if (!analyticsData?.data.callVolumeOverTime?.daily) return [];
    
    return analyticsData.data.callVolumeOverTime.daily.map(day => ({
      ...day,
      date: new Date(day.date).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      })
    }));
  };

  return (
    <div className="space-y-6" ref={containerRef}>
      <div className="bg-gray-800/30 rounded-xl p-6 space-y-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-white flex items-center">
            <FiBarChart2 className="mr-2" style={{ color: primaryColor }} />
            Advanced Analytics
          </h3>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 bg-gray-800 rounded-lg p-1">
              {dateRanges.map((range) => (
                <button
                  key={range.label}
                  onClick={() => setSelectedDateRange(range)}
                  className={clsx(
                    "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                    selectedDateRange.label === range.label
                      ? "text-white"
                      : "text-gray-400 hover:text-white hover:bg-gray-700"
                  )}
                  style={selectedDateRange.label === range.label ? { backgroundColor: primaryColor } : {}}
                >
                  {range.label}
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
        </div>

        {!features.enableAdvancedAnalytics ? (
          <div className="bg-gray-800/50 rounded-lg p-6 text-center">
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-gray-700/50 flex items-center justify-center mb-4">
                <FiBarChart2 className="w-8 h-8" style={{ color: primaryColor }} />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Advanced Analytics Not Enabled</h3>
              <p className="text-gray-400 max-w-md">
                Advanced analytics is not enabled for your account. Please contact your partner for access.
              </p>
            </div>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: primaryColor }}></div>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-center">
            <FiAlertCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
            <p className="text-red-400">{error}</p>
          </div>
        ) : analyticsData ? (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-gray-400 text-sm">Conversion Rate</div>
                  <FiTarget className="w-5 h-5" style={{ color: primaryColor }} />
                </div>
                <div className="text-2xl font-semibold text-white">
                  {analyticsData.data.conversionMetrics.rate.toFixed(1)}%
                </div>
                <div className="mt-1 text-sm text-gray-400">
                  {analyticsData.data.conversionMetrics.successful} of {analyticsData.data.conversionMetrics.opportunities} opportunities
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-gray-400 text-sm">Avg Sentiment</div>
                  <FiActivity className="w-5 h-5" style={{ color: primaryColor }} />
                </div>
                <div className="text-2xl font-semibold text-white">
                  {analyticsData.data.sentimentAnalysis.averageScore.toFixed(2)}
                </div>
                <div className="mt-1 text-sm text-gray-400">
                  Sentiment Score (0-1 scale)
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
                className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-gray-400 text-sm">Follow-up Rate</div>
                  <FiCheckCircle className="w-5 h-5" style={{ color: primaryColor }} />
                </div>
                <div className="text-2xl font-semibold text-white">
                  {analyticsData.data.actionItems.followUpRate}%
                </div>
                <div className="mt-1 text-sm text-gray-400">
                  Action items requiring follow-up
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.3 }}
                className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-gray-400 text-sm">Active Agents</div>
                  <FiUsers className="w-5 h-5" style={{ color: primaryColor }} />
                </div>
                <div className="text-2xl font-semibold text-white">
                  {analyticsData.agentCount}
                </div>
                <div className="mt-1 text-sm text-gray-400">
                  AI agents with activity
                </div>
              </motion.div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sentiment Analysis Chart */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.4 }}
                className="bg-gray-800/50 rounded-lg p-6 border border-gray-700/50"
              >
                <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <FiActivity className="mr-2" style={{ color: primaryColor }} />
                  Sentiment Analysis
                </h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={formatSentimentData()}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, value, percent }) =>
                          `${name}: ${value} (${(percent * 100).toFixed(1)}%)`
                        }
                      >
                        {formatSentimentData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F9FAFB' }}
                        itemStyle={{ color: '#F9FAFB' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              {/* Top Topics Chart */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.5 }}
                className="bg-gray-800/50 rounded-lg p-6 border border-gray-700/50"
              >
                <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <FiList className="mr-2" style={{ color: primaryColor }} />
                  Top Topics
                </h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={formatTopicsData()}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis type="number" stroke="#9CA3AF" />
                      <YAxis
                        dataKey="name"
                        type="category"
                        stroke="#9CA3AF"
                        width={80}
                        tickFormatter={(value) => value.length > 12 ? `${value.substring(0, 12)}...` : value}
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
              </motion.div>

              {/* Key Moments Chart */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.6 }}
                className="bg-gray-800/50 rounded-lg p-6 border border-gray-700/50"
              >
                <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <FiTarget className="mr-2" style={{ color: primaryColor }} />
                  Key Moments
                </h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={formatKeyMomentsData()}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="count"
                        label={({ type, count, percent }) =>
                          `${type}: ${count} (${(percent * 100).toFixed(1)}%)`
                        }
                      >
                        {formatKeyMomentsData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F9FAFB' }}
                        itemStyle={{ color: '#F9FAFB' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              {/* Call Volume Over Time Chart */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.7 }}
                className="bg-gray-800/50 rounded-lg p-6 border border-gray-700/50"
              >
                <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <FiTrendingUp className="mr-2" style={{ color: primaryColor }} />
                  Call Volume Over Time
                </h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={formatCallVolumeData()}
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
                        dataKey="calls"
                        stroke={primaryColor}
                        fill={`${primaryColor}40`}
                        name="Calls"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            </div>

            {/* Action Items Section */}
            {features.enableActionPointAnalysis && analyticsData.data.actionItems.common.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.8 }}
                className="bg-gray-800/50 rounded-lg p-6 border border-gray-700/50"
              >
                <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <FiCheckCircle className="mr-2" style={{ color: primaryColor }} />
                  Common Action Items
                </h4>
                <div className="space-y-3">
                  {analyticsData.data.actionItems.common.slice(0, 5).map((item, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 bg-gray-700/30 rounded-lg">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white" style={{ backgroundColor: primaryColor }}>
                        {item.count}
                      </div>
                      <div className="flex-1">
                        <p className="text-gray-300 text-sm leading-relaxed">{item.action}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        ) : (
          <div className="bg-gray-800/50 rounded-lg p-6 text-center">
            <FiInfo className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-gray-400">No analytics data available for the selected period.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedWhitelabelAdvancedAnalytics;
