'use client';

import React, { useState, useEffect } from 'react';
import { FiList, FiAlertCircle, FiInfo, FiSearch, FiFilter, FiChevronDown, FiChevronUp, FiPlay } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { usePartnerBranding } from '@/lib/partnerBranding';
import { subDays } from 'date-fns';

interface CallDetail {
  id: string;
  agent_name: string;
  timestamp: string;
  duration: number;
  sentiment_score: number;
  transcript: string;
  recording_url?: string;
  summary: string;
  key_moments: {
    timestamp: number;
    text: string;
    type: 'question' | 'answer' | 'objection' | 'interest';
  }[];
}

interface DateRange {
  label: string;
  days: number;
}

interface WhitelabelDetailedCallAnalyticsProps {
  selectedDateRange: DateRange;
}

const WhitelabelDetailedCallAnalytics: React.FC<WhitelabelDetailedCallAnalyticsProps> = ({ selectedDateRange }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [calls, setCalls] = useState<CallDetail[]>([]);
  const [selectedCall, setSelectedCall] = useState<CallDetail | null>(null);
  const [expandedSections, setExpandedSections] = useState<{[key: string]: boolean}>({});
  const { branding } = usePartnerBranding();
  const { primaryColor } = branding;

  const fetchCallDetails = async () => {
    setLoading(true);
    setError(null);

    try {
      const endDate = new Date().toISOString();
      const startDate = subDays(new Date(), selectedDateRange.days).toISOString();

      const response = await fetch(`/api/whitelabel/detailed-call-analytics?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch call details');
      }

      const data = await response.json();

      // Ensure data is an array
      const callsArray = Array.isArray(data) ? data : [];
      setCalls(callsArray);

      // Select the first call by default
      if (callsArray.length > 0) {
        setSelectedCall(callsArray[0]);

        // Initialize expanded sections
        const sections: {[key: string]: boolean} = {};
        callsArray[0].key_moments.forEach((_moment: any, index: number) => {
          sections[`moment-${index}`] = false;
        });
        setExpandedSections(sections);
      }
    } catch (err) {
      console.error('Error fetching call details:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCallDetails();
  }, [selectedDateRange.days]); // Only re-fetch when the actual days value changes

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 mb-4" style={{ borderColor: primaryColor }}></div>
        <p className="text-gray-400 text-sm">Loading call details for {selectedDateRange.label.toLowerCase()}...</p>
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

  if (!calls || !Array.isArray(calls) || calls.length === 0) {
    return (
      <div className="bg-gray-800/50 rounded-lg p-6 text-center">
        <FiInfo className="w-8 h-8 mx-auto mb-2 text-gray-400" />
        <p className="text-gray-400">No call details available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Filter */}
      <div className="bg-gray-800/50 rounded-lg p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FiSearch className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search calls..."
              className="block w-full pl-10 pr-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2"
              style={{ borderColor: `${primaryColor}40`, minWidth: '200px' }}
            />
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FiFilter className="text-gray-400" />
            </div>
            <select
              className="block w-full pl-10 pr-10 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white appearance-none focus:outline-none focus:ring-2"
              style={{ borderColor: `${primaryColor}40`, minWidth: '200px' }}
            >
              <option value="all">All Agents</option>
              {Array.isArray(calls) && calls.length > 0 &&
                Array.from(new Set(calls.map(call => call.agent_name))).map(agentName => (
                  <option key={agentName} value={agentName}>
                    {agentName}
                  </option>
                ))
              }
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Call List and Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Call List */}
        <div className="bg-gray-800/50 rounded-lg p-4 lg:col-span-1">
          <h3 className="text-lg font-medium text-white mb-4">Recent Calls</h3>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
            {Array.isArray(calls) && calls.length > 0 ? (
              calls.map((call, index) => (
                <motion.div
                  key={call.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedCall?.id === call.id
                      ? 'bg-gray-700 border-l-2'
                      : 'bg-gray-700/30 hover:bg-gray-700/50'
                  }`}
                  style={selectedCall?.id === call.id ? { borderLeftColor: primaryColor } : {}}
                  onClick={() => setSelectedCall(call)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-white font-medium">{call.agent_name}</div>
                      <div className="text-sm text-gray-400">
                        {new Date(call.timestamp).toLocaleDateString()} • {formatTime(call.duration)}
                      </div>
                    </div>
                    <div
                      className="px-2 py-1 text-xs rounded-full"
                      style={{
                        backgroundColor: `${primaryColor}20`,
                        color: primaryColor
                      }}
                    >
                      {call.sentiment_score >= 0.7 ? 'Positive' :
                       call.sentiment_score >= 0.4 ? 'Neutral' : 'Negative'}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-gray-400 line-clamp-2">
                    {call.summary}
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-4 text-gray-400">
                No calls available
              </div>
            )}
          </div>
        </div>

        {/* Call Details */}
        <div className="bg-gray-800/50 rounded-lg p-4 lg:col-span-2">
          {selectedCall ? (
            <div className="space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-medium text-white">{selectedCall.agent_name}</h3>
                  <div className="text-sm text-gray-400">
                    {new Date(selectedCall.timestamp).toLocaleString()} • {formatTime(selectedCall.duration)}
                  </div>
                </div>
                {selectedCall.recording_url && (
                  <button
                    className="flex items-center gap-1 px-3 py-1 rounded-lg"
                    style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
                  >
                    <FiPlay className="w-4 h-4" />
                    <span>Play Recording</span>
                  </button>
                )}
              </div>

              {/* Summary */}
              <div>
                <h4 className="text-white font-medium mb-2">Summary</h4>
                <div className="bg-gray-700/30 rounded-lg p-3 text-gray-300">
                  {selectedCall.summary}
                </div>
              </div>

              {/* Key Moments */}
              <div>
                <h4 className="text-white font-medium mb-2">Key Moments</h4>
                <div className="space-y-2">
                  {selectedCall.key_moments.map((moment, index) => (
                    <div
                      key={index}
                      className="bg-gray-700/30 rounded-lg overflow-hidden"
                    >
                      <div
                        className="flex items-center justify-between p-3 cursor-pointer"
                        onClick={() => toggleSection(`moment-${index}`)}
                      >
                        <div className="flex items-center">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center mr-3 text-xs"
                            style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
                          >
                            {formatTime(moment.timestamp)}
                          </div>
                          <div className="font-medium text-white">
                            {moment.type.charAt(0).toUpperCase() + moment.type.slice(1)}
                          </div>
                        </div>
                        {expandedSections[`moment-${index}`] ? (
                          <FiChevronUp className="text-gray-400" />
                        ) : (
                          <FiChevronDown className="text-gray-400" />
                        )}
                      </div>

                      {expandedSections[`moment-${index}`] && (
                        <div className="p-3 pt-0 border-t border-gray-700">
                          <p className="text-gray-300">{moment.text}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Transcript Preview */}
              <div>
                <h4 className="text-white font-medium mb-2">Transcript Preview</h4>
                <div className="bg-gray-700/30 rounded-lg p-3 text-gray-300 max-h-[200px] overflow-y-auto">
                  <p className="whitespace-pre-line">{selectedCall.transcript.substring(0, 500)}...</p>
                </div>
                <div className="mt-2 text-center">
                  <button
                    className="px-4 py-2 text-sm rounded-lg"
                    style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
                  >
                    View Full Transcript
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-12">
              <FiList className="w-12 h-12 text-gray-500 mb-4" />
              <p className="text-gray-400">Select a call to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WhitelabelDetailedCallAnalytics;
