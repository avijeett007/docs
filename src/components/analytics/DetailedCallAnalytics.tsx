'use client';

import React, { useState, useEffect } from 'react';
import {
  FiAlertCircle,
  FiInfo,
  FiRefreshCw,
  FiPhone,
  FiCalendar,
  FiClock,
  FiSearch,
  FiFilter,
  FiChevronLeft,
  FiChevronRight,
  FiMessageSquare,
  FiCheckCircle,
  FiXCircle,
  FiAlertTriangle,
  FiSmile,
  FiMeh,
  FiFrown,
  FiList,
  FiTag
} from 'react-icons/fi';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { format, parseISO } from 'date-fns';
import { usePartnerBranding } from '@/lib/partnerBranding';

interface DetailedCallAnalyticsProps {
  userId: string;
  agentId?: string;
}

interface CallData {
  id: string;
  agent_id: string;
  call_id: string;
  transcript_id: string;
  sentiment_score: number;
  agent_sentiment_score: number;
  customer_sentiment_score: number;
  topics: string[];
  labels: {
    domain: string[];
    call_category: string[];
    customer_status: string[];
    interaction_type: string[];
    product_interest: string[];
    conversion_signals: string[];
  };
  intent: string;
  outcome: string;
  key_moments: {
    text: string;
    type: string;
    importance: number;
  }[];
  summary: string;
  action_items: {
    action: string;
    customer: string | {
      id: string;
      name: string;
    };
  }[];
  follow_up_needed: boolean;
  booking_made: boolean;
  created_at: string;
  updated_at: string;
}

interface PaginationData {
  page: number;
  page_size: number;
  total_pages: number;
  has_more: boolean;
  next_page: number | null;
  prev_page: number | null;
}

interface CallAnalyticsResponse {
  agent_id?: string;
  calls: CallData[];
  total_calls: number;
  pagination: PaginationData;
}

interface DateRange {
  label: string;
  days: number;
}

const dateRanges: DateRange[] = [
  { label: '7 Days', days: 7 },
  { label: '30 Days', days: 30 },
  { label: '90 Days', days: 90 }
];

const DetailedCallAnalytics: React.FC<DetailedCallAnalyticsProps> = ({ userId, agentId }) => {
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange>(dateRanges[0]);
  const [callsData, setCallsData] = useState<CallAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [selectedCall, setSelectedCall] = useState<CallData | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterOutcome, setFilterOutcome] = useState<string>('all');
  const { branding } = usePartnerBranding();
  const primaryColor = branding.primaryColor || '#3B82F6';
  const secondaryColor = branding.secondaryColor || '#1E40AF';

  const fetchCallsData = async (page: number = 1) => {
    setLoading(true);
    setError(null);

    try {
      const endDate = new Date().toISOString();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - selectedDateRange.days);

      let url = `/api/customer/detailed-call-analytics?start_date=${encodeURIComponent(startDate.toISOString())}&end_date=${encodeURIComponent(endDate)}&page=${page}&page_size=${pageSize}`;

      if (agentId) {
        url += `&agent_id=${agentId}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch detailed call analytics data');
      }

      const data = await response.json();
      setCallsData(data);
      setCurrentPage(page);
    } catch (err) {
      console.error('Error fetching detailed call analytics data:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCallsData(1);
  }, [selectedDateRange, pageSize, agentId]);

  const handleRefresh = () => {
    fetchCallsData(currentPage);
  };

  const handlePageChange = (page: number) => {
    fetchCallsData(page);
  };

  const handleCallSelect = (call: CallData) => {
    setSelectedCall(call);
  };

  const handleBackToList = () => {
    setSelectedCall(null);
  };

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMM d, yyyy h:mm a');
    } catch (error) {
      return 'Invalid date';
    }
  };

  // Helper functions for sentiment and outcome icons/colors
  const getSentimentIcon = (score: number) => {
    if (score >= 0.3) {
      return <FiSmile className="text-green-500" />;
    } else if (score >= -0.3) {
      return <FiMeh className="text-amber-500" />;
    } else {
      return <FiFrown className="text-red-500" />;
    }
  };

  const getOutcomeIcon = (outcome: string) => {
    switch (outcome.toLowerCase()) {
      case 'successful':
        return <FiCheckCircle className="text-green-500" />;
      case 'escalated':
        return <FiAlertTriangle className="text-amber-500" />;
      case 'unsuccessful':
        return <FiXCircle className="text-red-500" />;
      default:
        return <FiInfo className="text-blue-500" />;
    }
  };

  const getOutcomeColor = (outcome: string) => {
    switch (outcome.toLowerCase()) {
      case 'successful':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'escalated':
        return 'bg-yellow-500/10 text-amber-500 border-yellow-500/20';
      case 'unsuccessful':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    }
  };

  const filteredCalls = callsData?.calls.filter(call => {
    // Apply search filter
    const searchMatch = searchTerm === '' ||
      call.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      call.intent.toLowerCase().includes(searchTerm.toLowerCase()) ||
      call.topics.some(topic => topic.toLowerCase().includes(searchTerm.toLowerCase()));

    // Apply outcome filter
    const outcomeMatch = filterOutcome === 'all' ||
      call.outcome.toLowerCase() === filterOutcome.toLowerCase();

    return searchMatch && outcomeMatch;
  }) || [];

  return (
    <div className="space-y-6">
      {loading && !callsData ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-center">
          <FiAlertCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
          <p className="text-red-400">{error}</p>
        </div>
      ) : callsData && callsData.calls.length === 0 ? (
        <div className="bg-gray-800/50 rounded-lg p-6 text-center">
          <FiInfo className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-gray-400">No call data available for the selected period.</p>
        </div>
      ) : (
        <>
          {/* Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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

            {!selectedCall && (
              <div className="flex flex-col md:flex-row gap-2">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search calls..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-64"
                  />
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                </div>

                <select
                  value={filterOutcome}
                  onChange={(e) => setFilterOutcome(e.target.value)}
                  className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Outcomes</option>
                  <option value="successful">Successful</option>
                  <option value="unsuccessful">Unsuccessful</option>
                  <option value="escalated">Escalated</option>
                </select>
              </div>
            )}
          </div>

          {selectedCall ? (
            <CallDetail
              call={selectedCall}
              onBack={handleBackToList}
              primaryColor={primaryColor}
              secondaryColor={secondaryColor}
            />
          ) : (
            <>
              {/* Call List */}
              <div className="space-y-4">
                {filteredCalls.length === 0 ? (
                  <div className="bg-gray-800/50 rounded-lg p-6 text-center">
                    <FiInfo className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-gray-400">No calls match your search criteria.</p>
                  </div>
                ) : (
                  filteredCalls.map((call) => (
                    <motion.div
                      key={call.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50 hover:border-blue-500/30 transition-colors cursor-pointer"
                      onClick={() => handleCallSelect(call)}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-full bg-gray-700">
                            <FiPhone className="w-4 h-4 text-blue-400" />
                          </div>
                          <div>
                            <div className="font-medium text-white">{call.intent}</div>
                            <div className="text-sm text-gray-400">{formatDate(call.created_at)}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={clsx("px-3 py-1 rounded-full text-xs font-medium border", getOutcomeColor(call.outcome))}>
                            {call.outcome.charAt(0).toUpperCase() + call.outcome.slice(1)}
                          </div>
                          <div className="flex items-center gap-1 text-sm text-gray-400">
                            {getSentimentIcon(call.sentiment_score)}
                            <span>{call.sentiment_score.toFixed(1)}</span>
                          </div>
                        </div>
                      </div>

                      <p className="text-gray-300 text-sm line-clamp-2 mb-3">{call.summary}</p>

                      <div className="flex flex-wrap gap-2">
                        {call.topics.slice(0, 3).map((topic, index) => (
                          <div key={index} className="px-2 py-1 bg-gray-700/50 rounded-md text-xs text-gray-300">
                            {topic}
                          </div>
                        ))}
                        {call.topics.length > 3 && (
                          <div className="px-2 py-1 bg-gray-700/50 rounded-md text-xs text-gray-300">
                            +{call.topics.length - 3} more
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              {/* Pagination */}
              {callsData && callsData.pagination.total_pages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <div className="text-sm text-gray-400">
                    Showing {filteredCalls.length} of {callsData.total_calls} calls
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                    >
                      <FiChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="text-sm text-gray-300">
                      Page {currentPage} of {callsData.pagination.total_pages}
                    </div>
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === callsData.pagination.total_pages}
                      className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                    >
                      <FiChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

interface CallDetailProps {
  call: CallData;
  onBack: () => void;
  primaryColor: string;
  secondaryColor: string;
}

const CallDetail: React.FC<CallDetailProps> = ({ call, onBack, primaryColor, secondaryColor }) => {
  // Helper functions for sentiment and outcome icons/colors
  const getSentimentIcon = (score: number) => {
    if (score >= 0.3) {
      return <FiSmile className="text-green-500" />;
    } else if (score >= -0.3) {
      return <FiMeh className="text-amber-500" />;
    } else {
      return <FiFrown className="text-red-500" />;
    }
  };

  const getOutcomeIcon = (outcome: string) => {
    switch (outcome.toLowerCase()) {
      case 'successful':
        return <FiCheckCircle className="text-green-500" />;
      case 'escalated':
        return <FiAlertTriangle className="text-amber-500" />;
      case 'unsuccessful':
        return <FiXCircle className="text-red-500" />;
      default:
        return <FiInfo className="text-blue-500" />;
    }
  };

  const getOutcomeColor = (outcome: string) => {
    switch (outcome.toLowerCase()) {
      case 'successful':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'escalated':
        return 'bg-yellow-500/10 text-amber-500 border-yellow-500/20';
      case 'unsuccessful':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    }
  };
  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
      >
        <FiChevronLeft className="w-4 h-4" />
        <span>Back to call list</span>
      </button>

      <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-semibold text-white">{call.intent}</h3>
            <div className="text-sm text-gray-400 mt-1">
              {format(parseISO(call.created_at), 'MMMM d, yyyy h:mm a')}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={clsx("px-4 py-1.5 rounded-full text-sm font-medium border flex items-center gap-2", getOutcomeColor(call.outcome))}>
              {getOutcomeIcon(call.outcome)}
              <span>{call.outcome.charAt(0).toUpperCase() + call.outcome.slice(1)}</span>
            </div>
            {call.booking_made && (
              <div className="px-4 py-1.5 rounded-full text-sm font-medium bg-green-500/10 text-green-500 border border-green-500/20 flex items-center gap-2">
                <FiCalendar className="w-4 h-4" />
                <span>Booking Made</span>
              </div>
            )}
            {call.follow_up_needed && (
              <div className="px-4 py-1.5 rounded-full text-sm font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center gap-2">
                <FiClock className="w-4 h-4" />
                <span>Follow-up Needed</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-gray-800/70 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-2">Overall Sentiment</div>
            <div className="flex items-center gap-2">
              {getSentimentIcon(call.sentiment_score)}
              <div className="text-2xl font-semibold text-white">{call.sentiment_score.toFixed(1)}</div>
            </div>
          </div>
          <div className="bg-gray-800/70 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-2">Agent Sentiment</div>
            <div className="flex items-center gap-2">
              {getSentimentIcon(call.agent_sentiment_score)}
              <div className="text-2xl font-semibold text-white">{call.agent_sentiment_score.toFixed(1)}</div>
            </div>
          </div>
          <div className="bg-gray-800/70 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-2">Customer Sentiment</div>
            <div className="flex items-center gap-2">
              {getSentimentIcon(call.customer_sentiment_score)}
              <div className="text-2xl font-semibold text-white">{call.customer_sentiment_score.toFixed(1)}</div>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h4 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
            <FiMessageSquare className="w-5 h-5" style={{ color: primaryColor }} />
            Summary
          </h4>
          <div className="bg-gray-800/70 rounded-lg p-4 text-gray-300">
            {call.summary}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h4 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
              <FiTag className="w-5 h-5" style={{ color: primaryColor }} />
              Topics
            </h4>
            <div className="bg-gray-800/70 rounded-lg p-4">
              <div className="flex flex-wrap gap-2">
                {call.topics.map((topic, index) => (
                  <div key={index} className="px-3 py-1.5 bg-gray-700/50 rounded-md text-sm text-gray-300">
                    {topic}
                  </div>
                ))}
                {call.topics.length === 0 && (
                  <div className="text-gray-400">No topics identified</div>
                )}
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
              <FiList className="w-5 h-5" style={{ color: primaryColor }} />
              Labels
            </h4>
            <div className="bg-gray-800/70 rounded-lg p-4">
              <div className="space-y-3">
                {Object.entries(call.labels).map(([category, values]) => (
                  values.length > 0 && (
                    <div key={category}>
                      <div className="text-sm text-gray-400 mb-1">{formatLabelCategory(category)}</div>
                      <div className="flex flex-wrap gap-2">
                        {values.map((value, index) => (
                          <div key={index} className="px-2 py-1 bg-gray-700/30 rounded-md text-xs text-gray-300">
                            {value}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                ))}
                {Object.values(call.labels).every(arr => arr.length === 0) && (
                  <div className="text-gray-400">No labels identified</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
              <FiMessageSquare className="w-5 h-5" style={{ color: primaryColor }} />
              Key Moments
            </h4>
            <div className="bg-gray-800/70 rounded-lg p-4 max-h-80 overflow-y-auto">
              {call.key_moments.length > 0 ? (
                <div className="space-y-3">
                  {call.key_moments.map((moment, index) => (
                    <div key={index} className="p-3 bg-gray-700/30 rounded-lg">
                      <div className="text-white">{moment.text}</div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="text-sm text-gray-400">{moment.type}</div>
                        <div className="text-sm text-gray-400">Importance: {moment.importance}/5</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-400">No key moments identified</div>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
              <FiCheckCircle className="w-5 h-5" style={{ color: primaryColor }} />
              Action Items
            </h4>
            <div className="bg-gray-800/70 rounded-lg p-4 max-h-80 overflow-y-auto">
              {call.action_items.length > 0 ? (
                <div className="space-y-3">
                  {call.action_items.map((item, index) => (
                    <div key={index} className="p-3 bg-gray-700/30 rounded-lg">
                      <div className="text-white">{item.action}</div>
                      <div className="text-sm text-gray-400 mt-1">
                        Customer: {typeof item.customer === 'string' ? item.customer : item.customer?.name || 'Unknown'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-400">No action items identified</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper function to format label categories
const formatLabelCategory = (category: string): string => {
  return category
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export default DetailedCallAnalytics;
