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
  FiTarget,
  FiSmile,
  FiActivity,
  FiShoppingCart,
  FiTag,
  FiMessageCircle
} from 'react-icons/fi';
import { Tab } from '@headlessui/react';
import { motion } from 'framer-motion';
import { subDays } from 'date-fns';
import clsx from 'clsx';
import { Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip as ChartTooltip,
  Legend as ChartLegend
} from 'chart.js';
import { usePartnerBranding } from '@/lib/partnerBranding';
import SentimentChart from '../analytics/SentimentChart';
import TopicsChart from '../analytics/TopicsChart';
import CallOutcomeChart from '../analytics/CallOutcomeChart';
import WhitelabelAgentAnalytics from './WhitelabelAgentAnalytics';
import WhitelabelActionPointAnalytics from './WhitelabelActionPointAnalytics';
import WhitelabelDetailedCallAnalytics from './WhitelabelDetailedCallAnalytics';

// Register Chart.js components for new charts
ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, ChartTooltip, ChartLegend);

interface WhitelabelAdvancedAnalyticsProps {
  customerId?: string;
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
  common_issues: { issue: string; count: number }[];
  product_interests: { product: string; count: number }[];
  call_outcome_stats: {
    successful: number;
    follow_up_needed: number;
    unsuccessful: number;
  };
  booking_metrics: {
    total_bookings: number;
    conversion_rate: number;
  };
  // New Phase 7 fields
  intent_distribution?: { intent: string; count: number }[];
  outcome_breakdown?: {
    successful: number;
    unsuccessful: number;
    escalated: number;
    inconclusive: number;
  };
  customer_satisfaction?: {
    satisfied: number;
    neutral: number;
    dissatisfied: number;
  };
  conversion_funnel?: {
    ready_to_buy: number;
    needs_more_info: number;
    not_interested: number;
  };
  sentiment_breakdown?: {
    avg_customer: number | null;
    avg_agent: number | null;
  };
  follow_up_rate?: number;
}

interface CustomerFeatures {
  enableAdvancedAnalytics: boolean;
  enableDetailedCallAnalysis: boolean;
  enableActionPointAnalysis: boolean;
}

const dateRanges: DateRange[] = [
  { label: '7 Days', days: 7 },
  { label: '30 Days', days: 30 },
  { label: '90 Days', days: 90 }
];

const WhitelabelAdvancedAnalytics: React.FC<WhitelabelAdvancedAnalyticsProps> = ({ customerId }) => {
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange>(dateRanges[0]);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
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
      const endDate = new Date().toISOString();
      const startDate = subDays(new Date(), selectedDateRange.days).toISOString();

      const response = await fetch(`/api/whitelabel/advanced-analytics?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`);

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
    if (features.enableAdvancedAnalytics) {
      fetchAnalyticsData();
    }
  }, [selectedDateRange.days, features.enableAdvancedAnalytics]); // Only re-fetch when the actual days value changes

  const handleRefresh = () => {
    fetchAnalyticsData();
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
        ) : (
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
                disabled={!features.enableActionPointAnalysis}
                className={({ selected }) =>
                  clsx(
                    'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                    'ring-white/60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2',
                    selected
                      ? 'text-white shadow'
                      : 'text-gray-400 hover:bg-gray-800/30 hover:text-white',
                    !features.enableActionPointAnalysis && 'opacity-50 cursor-not-allowed',
                    {
                      [`bg-gradient-custom`]: selected
                    }
                  )
                }
              >
                Action Points
              </Tab>
              <Tab
                disabled={!features.enableDetailedCallAnalysis}
                className={({ selected }) =>
                  clsx(
                    'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                    'ring-white/60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2',
                    selected
                      ? 'text-white shadow'
                      : 'text-gray-400 hover:bg-gray-800/30 hover:text-white',
                    !features.enableDetailedCallAnalysis && 'opacity-50 cursor-not-allowed',
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
                  <div className="flex flex-col items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 mb-4" style={{ borderColor: primaryColor }}></div>
                    <p className="text-gray-400 text-sm">Loading analytics for {selectedDateRange.label.toLowerCase()}...</p>
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
                          <FiCheckCircle className="w-5 h-5" style={{ color: primaryColor }} />
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
                          <FiCalendar className="w-5 h-5" style={{ color: primaryColor }} />
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
                          <FiTrendingUp className="w-5 h-5" style={{ color: primaryColor }} />
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

                    {/* AI-Enriched Analytics Section */}
                    {(analyticsData.intent_distribution?.length || analyticsData.outcome_breakdown || analyticsData.customer_satisfaction || analyticsData.conversion_funnel || analyticsData.sentiment_breakdown) && (
                      <>
                        <div className="border-t border-gray-700/50 pt-6 mt-6">
                          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <FiActivity className="w-5 h-5" style={{ color: primaryColor }} />
                            AI-Powered Insights
                          </h3>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Intent Distribution - Donut Chart */}
                          {analyticsData.intent_distribution && analyticsData.intent_distribution.length > 0 && (
                            <motion.div
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.4, delay: 0.6 }}
                              className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50"
                            >
                              <h4 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                                <FiTarget className="w-4 h-4" style={{ color: primaryColor }} />
                                Intent Distribution
                              </h4>
                              <div className="h-64">
                                <Doughnut
                                  data={{
                                    labels: analyticsData.intent_distribution.slice(0, 8).map(i => i.intent),
                                    datasets: [{
                                      data: analyticsData.intent_distribution.slice(0, 8).map(i => i.count),
                                      backgroundColor: [
                                        '#6366F1', '#8B5CF6', '#A78BFA', '#C4B5FD',
                                        '#818CF8', '#7C3AED', '#5B21B6', '#4C1D95'
                                      ],
                                      borderWidth: 1,
                                      borderColor: 'rgba(0,0,0,0.2)',
                                    }]
                                  }}
                                  options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    cutout: '55%',
                                    plugins: {
                                      legend: { position: 'right', labels: { color: 'rgba(255,255,255,0.7)', font: { size: 11 }, padding: 10 } },
                                      tooltip: { backgroundColor: 'rgba(0,0,0,0.7)', titleColor: '#fff', bodyColor: '#fff' }
                                    }
                                  } as any}
                                />
                              </div>
                            </motion.div>
                          )}

                          {/* Outcome Breakdown - 4-segment Bar */}
                          {analyticsData.outcome_breakdown && (
                            <motion.div
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.4, delay: 0.7 }}
                              className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50"
                            >
                              <h4 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                                <FiCheckCircle className="w-4 h-4" style={{ color: primaryColor }} />
                                Detailed Outcome Breakdown
                              </h4>
                              <div className="h-64">
                                <Bar
                                  data={{
                                    labels: ['Successful', 'Unsuccessful', 'Escalated', 'Inconclusive'],
                                    datasets: [{
                                      label: 'Calls',
                                      data: [
                                        analyticsData.outcome_breakdown.successful || 0,
                                        analyticsData.outcome_breakdown.unsuccessful || 0,
                                        analyticsData.outcome_breakdown.escalated || 0,
                                        analyticsData.outcome_breakdown.inconclusive || 0,
                                      ],
                                      backgroundColor: ['#10B981', '#EF4444', '#F59E0B', '#6B7280'],
                                      borderRadius: 6,
                                    }]
                                  }}
                                  options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                      legend: { display: false },
                                      tooltip: { backgroundColor: 'rgba(0,0,0,0.7)', titleColor: '#fff', bodyColor: '#fff' }
                                    },
                                    scales: {
                                      y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: 'rgba(255,255,255,0.7)' } },
                                      x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.7)' } }
                                    }
                                  } as any}
                                />
                              </div>
                            </motion.div>
                          )}

                          {/* Customer Satisfaction - Horizontal Bar */}
                          {analyticsData.customer_satisfaction && (
                            <motion.div
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.4, delay: 0.8 }}
                              className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50"
                            >
                              <h4 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                                <FiSmile className="w-4 h-4" style={{ color: primaryColor }} />
                                Customer Satisfaction
                              </h4>
                              <div className="h-64">
                                <Doughnut
                                  data={{
                                    labels: ['Satisfied', 'Neutral', 'Dissatisfied'],
                                    datasets: [{
                                      data: [
                                        analyticsData.customer_satisfaction.satisfied || 0,
                                        analyticsData.customer_satisfaction.neutral || 0,
                                        analyticsData.customer_satisfaction.dissatisfied || 0,
                                      ],
                                      backgroundColor: ['#10B981', '#F59E0B', '#EF4444'],
                                      borderWidth: 1,
                                      borderColor: 'rgba(0,0,0,0.2)',
                                    }]
                                  }}
                                  options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    cutout: '60%',
                                    plugins: {
                                      legend: { position: 'bottom', labels: { color: 'rgba(255,255,255,0.7)', padding: 15 } },
                                      tooltip: { backgroundColor: 'rgba(0,0,0,0.7)', titleColor: '#fff', bodyColor: '#fff' }
                                    }
                                  } as any}
                                />
                              </div>
                            </motion.div>
                          )}

                          {/* Conversion Funnel */}
                          {analyticsData.conversion_funnel && (
                            <motion.div
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.4, delay: 0.9 }}
                              className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50"
                            >
                              <h4 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                                <FiShoppingCart className="w-4 h-4" style={{ color: primaryColor }} />
                                Conversion Funnel
                              </h4>
                              <div className="h-64">
                                <Bar
                                  data={{
                                    labels: ['Ready to Buy', 'Needs More Info', 'Not Interested'],
                                    datasets: [{
                                      label: 'Customers',
                                      data: [
                                        analyticsData.conversion_funnel.ready_to_buy || 0,
                                        analyticsData.conversion_funnel.needs_more_info || 0,
                                        analyticsData.conversion_funnel.not_interested || 0,
                                      ],
                                      backgroundColor: ['#10B981', '#3B82F6', '#6B7280'],
                                      borderRadius: 6,
                                    }]
                                  }}
                                  options={{
                                    indexAxis: 'y' as const,
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                      legend: { display: false },
                                      tooltip: { backgroundColor: 'rgba(0,0,0,0.7)', titleColor: '#fff', bodyColor: '#fff' }
                                    },
                                    scales: {
                                      x: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: 'rgba(255,255,255,0.7)' } },
                                      y: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.7)' } }
                                    }
                                  } as any}
                                />
                              </div>
                            </motion.div>
                          )}

                          {/* Sentiment Breakdown - Customer vs Agent */}
                          {analyticsData.sentiment_breakdown && (analyticsData.sentiment_breakdown.avg_customer !== null || analyticsData.sentiment_breakdown.avg_agent !== null) && (
                            <motion.div
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.4, delay: 1.0 }}
                              className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50"
                            >
                              <h4 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                                <FiMessageCircle className="w-4 h-4" style={{ color: primaryColor }} />
                                Sentiment Breakdown
                              </h4>
                              <div className="h-64">
                                <Bar
                                  data={{
                                    labels: ['Customer Sentiment', 'Agent Sentiment'],
                                    datasets: [{
                                      label: 'Avg Score',
                                      data: [
                                        analyticsData.sentiment_breakdown.avg_customer ?? 0,
                                        analyticsData.sentiment_breakdown.avg_agent ?? 0,
                                      ],
                                      backgroundColor: ['#3B82F6', '#10B981'],
                                      borderRadius: 6,
                                      barThickness: 40,
                                    }]
                                  }}
                                  options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                      legend: { display: false },
                                      tooltip: {
                                        backgroundColor: 'rgba(0,0,0,0.7)', titleColor: '#fff', bodyColor: '#fff',
                                        callbacks: { label: (ctx: any) => `Score: ${ctx.raw?.toFixed(2)}` }
                                      }
                                    },
                                    scales: {
                                      y: { beginAtZero: true, max: 1, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: 'rgba(255,255,255,0.7)' } },
                                      x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.7)' } }
                                    }
                                  } as any}
                                />
                              </div>
                            </motion.div>
                          )}

                          {/* Follow-up Rate Card */}
                          {analyticsData.follow_up_rate !== undefined && (
                            <motion.div
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.4, delay: 1.1 }}
                              className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50 flex flex-col items-center justify-center"
                            >
                              <h4 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                                <FiTrendingUp className="w-4 h-4" style={{ color: primaryColor }} />
                                Follow-up Rate
                              </h4>
                              <div className="text-5xl font-bold text-white mb-2">
                                {analyticsData.follow_up_rate.toFixed(1)}%
                              </div>
                              <p className="text-gray-400 text-sm">of calls require follow-up</p>
                            </motion.div>
                          )}
                        </div>

                        {/* Common Issues & Product Interests */}
                        {((analyticsData.common_issues && analyticsData.common_issues.length > 0) || (analyticsData.product_interests && analyticsData.product_interests.length > 0)) && (
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                            {/* Common Issues */}
                            {analyticsData.common_issues && analyticsData.common_issues.length > 0 && (
                              <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: 1.2 }}
                                className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50"
                              >
                                <h4 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                                  <FiTag className="w-4 h-4" style={{ color: primaryColor }} />
                                  Common Issues
                                </h4>
                                <div className="space-y-2">
                                  {analyticsData.common_issues.slice(0, 8).map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between">
                                      <span className="text-gray-300 text-sm truncate mr-2">{item.issue}</span>
                                      <span className="text-gray-400 text-sm font-mono">{item.count}</span>
                                    </div>
                                  ))}
                                </div>
                              </motion.div>
                            )}

                            {/* Product Interests */}
                            {analyticsData.product_interests && analyticsData.product_interests.length > 0 && (
                              <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: 1.3 }}
                                className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50"
                              >
                                <h4 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                                  <FiShoppingCart className="w-4 h-4" style={{ color: primaryColor }} />
                                  Product Interests
                                </h4>
                                <div className="space-y-2">
                                  {analyticsData.product_interests.slice(0, 8).map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between">
                                      <span className="text-gray-300 text-sm truncate mr-2">{item.product}</span>
                                      <span className="text-gray-400 text-sm font-mono">{item.count}</span>
                                    </div>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </div>
                        )}
                      </>
                    )}
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
                <WhitelabelAgentAnalytics selectedDateRange={selectedDateRange} />
              </Tab.Panel>

              {/* Action Points Panel */}
              <Tab.Panel>
                {features.enableActionPointAnalysis ? (
                  <WhitelabelActionPointAnalytics selectedDateRange={selectedDateRange} />
                ) : (
                  <div className="bg-gray-800/50 rounded-lg p-6 text-center">
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="w-16 h-16 rounded-full bg-gray-700/50 flex items-center justify-center mb-4">
                        <FiCheckCircle className="w-8 h-8" style={{ color: primaryColor }} />
                      </div>
                      <h3 className="text-xl font-semibold text-white mb-2">Action Points Not Enabled</h3>
                      <p className="text-gray-400 max-w-md">
                        Action point analysis is not enabled for your account. Please contact your partner for access.
                      </p>
                    </div>
                  </div>
                )}
              </Tab.Panel>

              {/* Detailed Call Analytics Panel */}
              <Tab.Panel>
                {features.enableDetailedCallAnalysis ? (
                  <WhitelabelDetailedCallAnalytics selectedDateRange={selectedDateRange} />
                ) : (
                  <div className="bg-gray-800/50 rounded-lg p-6 text-center">
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="w-16 h-16 rounded-full bg-gray-700/50 flex items-center justify-center mb-4">
                        <FiList className="w-8 h-8" style={{ color: primaryColor }} />
                      </div>
                      <h3 className="text-xl font-semibold text-white mb-2">Call Details Not Enabled</h3>
                      <p className="text-gray-400 max-w-md">
                        Detailed call analysis is not enabled for your account. Please contact your partner for access.
                      </p>
                    </div>
                  </div>
                )}
              </Tab.Panel>
            </Tab.Panels>
          </Tab.Group>
        )}
      </div>
    </div>
  );
};

export default WhitelabelAdvancedAnalytics;
