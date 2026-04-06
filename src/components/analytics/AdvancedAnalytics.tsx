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
  FiList
} from 'react-icons/fi';
import { Tab } from '@headlessui/react';
import { motion } from 'framer-motion';
import { subDays } from 'date-fns';
import clsx from 'clsx';
import { usePartnerBranding } from '@/lib/partnerBranding';
import SentimentChart from './SentimentChart';
import TopicsChart from './TopicsChart';
import CallOutcomeChart from './CallOutcomeChart';
import AgentAnalytics from './AgentAnalytics';
import ActionPointAnalytics from './ActionPointAnalytics';
import DetailedCallAnalytics from './DetailedCallAnalytics';

interface AdvancedAnalyticsProps {
  userId: string;
}

interface DateRange {
  label: string;
  days: number;
}

interface AnalyticsData {
  customer_id: string;
  sentiment_history: {
    timestamp: string;
    sentiment_score: number;
    call_id: string;
  }[];
  top_topics: {
    topic: string;
    count: number;
  }[];
  common_issues: any[];
  product_interests: any[];
  call_outcome_stats: {
    successful: number;
    follow_up_needed: number;
    unsuccessful: number;
  };
  booking_metrics: {
    total_bookings: number;
    conversion_rate: number;
  };
}

const dateRanges: DateRange[] = [
  { label: '7 Days', days: 7 },
  { label: '30 Days', days: 30 },
  { label: '90 Days', days: 90 }
];

const AdvancedAnalytics: React.FC<AdvancedAnalyticsProps> = ({ userId }) => {
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange>(dateRanges[0]);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
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

  const fetchAnalyticsData = async () => {
    setLoading(true);
    setError(null);

    try {
      const endDate = new Date().toISOString();
      const startDate = subDays(new Date(), selectedDateRange.days).toISOString();

      const response = await fetch(`/api/customer/advanced-analytics?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch analytics data');
      }

      const data = await response.json();
      setAnalyticsData(data);
    } catch (err) {
      console.error('Error fetching analytics data:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, [selectedDateRange]);

  const handleRefresh = () => {
    fetchAnalyticsData();
  };

  return (
    <div className="space-y-6" ref={containerRef}>
      <div className="bg-gray-800/30 rounded-xl p-6 space-y-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-white flex items-center">
            <FiBarChart2 className="mr-2 text-blue-400" />
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
                      ? "bg-blue-500 text-white"
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

        <Tab.Group>
          <Tab.List className="flex space-x-1 rounded-xl bg-gray-800/50 p-1 mb-6">
            <Tab
              className={({ selected }) =>
                clsx(
                  'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                  'ring-white/60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2',
                  selected
                    ? 'text-white shadow'
                    : 'text-gray-400 hover:bg-gray-800/30 hover:text-white',
                  {
                    [`bg-gradient-custom`]: selected
                  }
                )
              }

            >
              Overall Analytics
            </Tab>
            <Tab
              className={({ selected }) =>
                clsx(
                  'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                  'ring-white/60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2',
                  selected
                    ? 'text-white shadow'
                    : 'text-gray-400 hover:bg-gray-800/30 hover:text-white',
                  {
                    [`bg-gradient-custom`]: selected
                  }
                )
              }

            >
              Agent Analytics
            </Tab>
            <Tab
              className={({ selected }) =>
                clsx(
                  'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                  'ring-white/60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2',
                  selected
                    ? 'text-white shadow'
                    : 'text-gray-400 hover:bg-gray-800/30 hover:text-white',
                  {
                    [`bg-gradient-custom`]: selected
                  }
                )
              }
            >
              Action Points
            </Tab>
            <Tab
              className={({ selected }) =>
                clsx(
                  'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                  'ring-white/60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2',
                  selected
                    ? 'text-white shadow'
                    : 'text-gray-400 hover:bg-gray-800/30 hover:text-white',
                  {
                    [`bg-gradient-custom`]: selected
                  }
                )
              }
            >
              <div className="flex items-center justify-center gap-1">
                <FiList className="w-4 h-4" />
                <span>Call Details</span>
              </div>
            </Tab>
          </Tab.List>

          <Tab.Panels>
            {/* Overall Analytics Panel */}
            <Tab.Panel>
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              ) : error ? (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-center">
                  <FiAlertCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
                  <p className="text-red-400">{error}</p>
                </div>
              ) : analyticsData ? (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-gray-400 text-sm">Call Outcomes</div>
                        <FiCheckCircle className="w-5 h-5 text-green-500" />
                      </div>
                      <div className="text-2xl font-semibold text-white">
                        {analyticsData.call_outcome_stats.successful || 0} Successful
                      </div>
                      <div className="mt-1 text-sm text-gray-400">
                        {analyticsData.call_outcome_stats.follow_up_needed || 0} Need Follow-up • {analyticsData.call_outcome_stats.unsuccessful || 0} Unsuccessful
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.1 }}
                      className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-gray-400 text-sm">Bookings</div>
                        <FiCalendar className="w-5 h-5 text-blue-500" />
                      </div>
                      <div className="text-2xl font-semibold text-white">
                        {analyticsData.booking_metrics.total_bookings || 0} Total
                      </div>
                      <div className="mt-1 text-sm text-gray-400">
                        {analyticsData.booking_metrics.conversion_rate?.toFixed(1) || 0}% Conversion Rate
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.2 }}
                      className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-gray-400 text-sm">Sentiment</div>
                        <FiTrendingUp className="w-5 h-5 text-teal-500" />
                      </div>
                      <div className="text-2xl font-semibold text-white">
                        {analyticsData.sentiment_history.length > 0
                          ? (analyticsData.sentiment_history.reduce((sum, item) => sum + item.sentiment_score, 0) / analyticsData.sentiment_history.length).toFixed(2)
                          : 'N/A'
                        }
                      </div>
                      <div className="mt-1 text-sm text-gray-400">
                        Average Sentiment Score (0-1)
                      </div>
                    </motion.div>
                  </div>

                  {/* Charts */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.3 }}
                      className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50"
                    >
                      <h4 className="text-lg font-medium text-white mb-4">Sentiment History</h4>
                      <div className="h-64">
                        <SentimentChart
                          data={analyticsData.sentiment_history}
                          primaryColor={primaryColor}
                          secondaryColor={secondaryColor}
                        />
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.4 }}
                      className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50"
                    >
                      <h4 className="text-lg font-medium text-white mb-4">Top Topics</h4>
                      <div className="h-64">
                        <TopicsChart
                          data={analyticsData.top_topics}
                          primaryColor={primaryColor}
                          secondaryColor={secondaryColor}
                        />
                      </div>
                    </motion.div>
                  </div>

                  {/* Call Outcomes */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.5 }}
                    className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50"
                  >
                    <h4 className="text-lg font-medium text-white mb-4">Call Outcomes</h4>
                    <div className="h-64">
                      <CallOutcomeChart
                        data={analyticsData.call_outcome_stats}
                        primaryColor={primaryColor}
                        secondaryColor={secondaryColor}
                      />
                    </div>
                  </motion.div>
                </div>
              ) : (
                <div className="bg-gray-800/50 rounded-lg p-6 text-center">
                  <FiInfo className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-gray-400">No analytics data available for the selected period.</p>
                </div>
              )}
            </Tab.Panel>

            {/* Agent Analytics Panel */}
            <Tab.Panel>
              <AgentAnalytics userId={userId} />
            </Tab.Panel>

            {/* Action Points Panel */}
            <Tab.Panel>
              <ActionPointAnalytics userId={userId} />
            </Tab.Panel>

            {/* Detailed Call Analytics Panel */}
            <Tab.Panel>
              <DetailedCallAnalytics userId={userId} />
            </Tab.Panel>
          </Tab.Panels>
        </Tab.Group>
      </div>
    </div>
  );
};

export default AdvancedAnalytics;
