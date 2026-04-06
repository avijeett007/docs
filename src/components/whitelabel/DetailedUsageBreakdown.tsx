/**
 * Detailed Usage Breakdown Component
 *
 * Shows call-level usage details with metrics, confidence scores, and billing transparency
 * for customers to understand their metered billing charges.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiPhone,
  FiClock,
  FiDollarSign,
  FiInfo,
  FiChevronDown,
  FiChevronRight,
  FiCheckCircle,
  FiAlertCircle,
  FiEye,
  FiCalendar,
  FiUser,
  FiActivity
} from 'react-icons/fi';

interface CallUsageDetail {
  id: string;
  callId: string;
  agentId: string;
  agentName: string;
  timestamp: string;
  duration: number;
  metrics: MetricDetection[];
  totalCost: number;
  provider: string;
  confidence: number;
}

interface MetricDetection {
  id: string;
  metricName: string;
  metricType: 'boolean' | 'string' | 'number';
  metricValue: any;
  detectedBy: 'provider_webhook' | 'internal_ai' | 'manual';
  confidenceScore?: number;
  quantity: number;
  unitPrice: number;
  totalCost: number;
  billingStatus: string;
  disputeMetadata?: {
    webhookData?: any;
    aiAnalysis?: any;
    originalTimestamp: string;
  };
}

interface UsageBreakdownProps {
  customerId: string;
  partnerId: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  subscriptionId?: string;
}

export default function DetailedUsageBreakdown({
  customerId,
  partnerId,
  billingPeriodStart,
  billingPeriodEnd,
  subscriptionId
}: UsageBreakdownProps) {
  const [usageData, setUsageData] = useState<CallUsageDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCalls, setExpandedCalls] = useState<Set<string>>(new Set());
  const [selectedMetric, setSelectedMetric] = useState<MetricDetection | null>(null);
  const [filterBy, setFilterBy] = useState<'all' | 'high_confidence' | 'disputed'>('all');

  useEffect(() => {
    fetchUsageDetails();
  }, [customerId, partnerId, billingPeriodStart, billingPeriodEnd, subscriptionId]);

  const fetchUsageDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        customerId,
        partnerId,
        billingPeriodStart,
        billingPeriodEnd,
        ...(subscriptionId && { subscriptionId })
      });

      const response = await fetch(`/api/whitelabel/billing/usage-details?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch usage details');
      }

      const data = await response.json();
      setUsageData(data.callDetails || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load usage details');
    } finally {
      setLoading(false);
    }
  };

  const toggleCallExpansion = (callId: string) => {
    const newExpanded = new Set(expandedCalls);
    if (newExpanded.has(callId)) {
      newExpanded.delete(callId);
    } else {
      newExpanded.add(callId);
    }
    setExpandedCalls(newExpanded);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4
    }).format(amount);
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60); // Remove decimal places
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return 'text-gray-400';
    if (confidence >= 0.9) return 'text-green-400';
    if (confidence >= 0.7) return 'text-amber-400';
    return 'text-red-400';
  };

  const getDetectionSourceIcon = (detectedBy: string) => {
    switch (detectedBy) {
      case 'provider_webhook':
        return <FiCheckCircle className="w-4 h-4 text-green-400" />;
      case 'internal_ai':
        return <FiActivity className="w-4 h-4 text-blue-400" />;
      case 'manual':
        return <FiUser className="w-4 h-4 text-purple-400" />;
      default:
        return <FiAlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const filteredUsageData = usageData.filter(call => {
    switch (filterBy) {
      case 'high_confidence':
        return call.confidence >= 0.8;
      case 'disputed':
        return call.metrics.some(m => m.billingStatus === 'disputed');
      default:
        return true;
    }
  });

  const totalCost = filteredUsageData.reduce((sum, call) => sum + call.totalCost, 0);
  const totalCalls = filteredUsageData.length;
  const totalMetrics = filteredUsageData.reduce((sum, call) => sum + call.metrics.length, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-400">Loading usage details...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <FiAlertCircle className="w-5 h-5 text-red-400" />
          <div>
            <h3 className="text-red-400 font-medium">Error Loading Usage Details</h3>
            <p className="text-red-300 text-sm mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <FiPhone className="w-5 h-5 text-blue-400" />
            <div>
              <p className="text-gray-400 text-sm">Total Calls</p>
              <p className="text-white text-xl font-semibold">{totalCalls}</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <FiActivity className="w-5 h-5 text-green-400" />
            <div>
              <p className="text-gray-400 text-sm">Metrics Detected</p>
              <p className="text-white text-xl font-semibold">{totalMetrics}</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <FiDollarSign className="w-5 h-5 text-amber-400" />
            <div>
              <p className="text-gray-400 text-sm">Total Cost</p>
              <p className="text-white text-xl font-semibold">{formatCurrency(totalCost)}</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <FiCheckCircle className="w-5 h-5 text-purple-400" />
            <div>
              <p className="text-gray-400 text-sm">Avg Confidence</p>
              <p className="text-white text-xl font-semibold">
                {filteredUsageData.length > 0
                  ? `${Math.round(filteredUsageData.reduce((sum, call) => sum + call.confidence, 0) / filteredUsageData.length * 100)}%`
                  : 'N/A'
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <label className="text-gray-400 text-sm">Filter by:</label>
          <select
            value={filterBy}
            onChange={(e) => setFilterBy(e.target.value as any)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Calls</option>
            <option value="high_confidence">High Confidence (≥80%)</option>
            <option value="disputed">Disputed Charges</option>
          </select>
        </div>

        <div className="text-gray-400 text-sm">
          Showing {filteredUsageData.length} of {usageData.length} calls
        </div>
      </div>

      {/* Usage Details */}
      <div className="space-y-4">
        {filteredUsageData.length === 0 ? (
          <div className="text-center py-8">
            <FiInfo className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-gray-400 text-lg font-medium">No Usage Data</h3>
            <p className="text-gray-500 text-sm mt-2">
              No calls found for the selected billing period and filters.
            </p>
          </div>
        ) : (
          filteredUsageData.map((call) => (
            <motion.div
              key={call.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden"
            >
              {/* Call Header */}
              <div
                className="p-4 cursor-pointer hover:bg-gray-800/70 transition-colors"
                onClick={() => toggleCallExpansion(call.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {expandedCalls.has(call.id) ? (
                        <FiChevronDown className="w-5 h-5 text-gray-400" />
                      ) : (
                        <FiChevronRight className="w-5 h-5 text-gray-400" />
                      )}
                      <FiPhone className="w-5 h-5 text-blue-400" />
                    </div>

                    <div>
                      <h3 className="text-white font-medium">{call.agentName}</h3>
                      <div className="flex items-center gap-4 text-sm text-gray-400 mt-1">
                        <span className="flex items-center gap-1">
                          <FiCalendar className="w-4 h-4" />
                          {new Date(call.timestamp).toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <FiClock className="w-4 h-4" />
                          {formatDuration(call.duration)}
                        </span>
                        <span className="capitalize">{call.provider}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-white font-semibold">{formatCurrency(call.totalCost)}</div>
                    <div className="text-sm text-gray-400 mt-1">
                      {call.metrics.length} metric{call.metrics.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded Call Details */}
              <AnimatePresence>
                {expandedCalls.has(call.id) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-gray-700"
                  >
                    <div className="p-4 space-y-4">
                      {/* Call Info */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">Call ID:</span>
                          <p className="text-white font-mono text-xs mt-1">{call.callId}</p>
                        </div>
                        <div>
                          <span className="text-gray-400">Agent ID:</span>
                          <p className="text-white font-mono text-xs mt-1">{call.agentId}</p>
                        </div>
                        <div>
                          <span className="text-gray-400">Overall Confidence:</span>
                          <p className={`font-semibold mt-1 ${getConfidenceColor(call.confidence)}`}>
                            {Math.round(call.confidence * 100)}%
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-400">Provider:</span>
                          <p className="text-white capitalize mt-1">{call.provider}</p>
                        </div>
                      </div>

                      {/* Metrics Breakdown */}
                      <div>
                        <h4 className="text-white font-medium mb-3">Detected Metrics</h4>
                        <div className="space-y-3">
                          {call.metrics.map((metric) => (
                            <div
                              key={metric.id}
                              className="bg-gray-900/50 rounded-lg p-3 border border-gray-600"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                  {getDetectionSourceIcon(metric.detectedBy)}
                                  <span className="text-white font-medium">{metric.metricName}</span>
                                  <span className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300">
                                    {metric.metricType}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <div className="text-white font-semibold">{formatCurrency(metric.totalCost)}</div>
                                  {metric.confidenceScore && (
                                    <div className={`text-xs ${getConfidenceColor(metric.confidenceScore)}`}>
                                      {Math.round(metric.confidenceScore * 100)}% confidence
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <span className="text-gray-400">Value:</span>
                                  <p className="text-white mt-1">
                                    {typeof metric.metricValue === 'boolean'
                                      ? (metric.metricValue ? 'Yes' : 'No')
                                      : String(metric.metricValue)
                                    }
                                  </p>
                                </div>
                                <div>
                                  <span className="text-gray-400">Quantity:</span>
                                  <p className="text-white mt-1">{metric.quantity}</p>
                                </div>
                                <div>
                                  <span className="text-gray-400">Unit Price:</span>
                                  <p className="text-white mt-1">{formatCurrency(metric.unitPrice)}</p>
                                </div>
                                <div>
                                  <span className="text-gray-400">Detection Source:</span>
                                  <p className="text-white mt-1 capitalize">
                                    {metric.detectedBy.replace('_', ' ')}
                                  </p>
                                </div>
                              </div>

                              {metric.disputeMetadata && (
                                <div className="mt-3 pt-3 border-t border-gray-600">
                                  <button
                                    onClick={() => setSelectedMetric(metric)}
                                    className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm"
                                  >
                                    <FiEye className="w-4 h-4" />
                                    View Detection Details
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))
        )}
      </div>

      {/* Metric Detail Modal */}
      <AnimatePresence>
        {selectedMetric && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedMetric(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white text-lg font-semibold">
                  Detection Details: {selectedMetric.metricName}
                </h3>
                <button
                  onClick={() => setSelectedMetric(null)}
                  className="text-gray-400 hover:text-white"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Detection Method:</span>
                    <p className="text-white mt-1 capitalize">
                      {selectedMetric.detectedBy.replace('_', ' ')}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400">Confidence Score:</span>
                    <p className={`mt-1 font-semibold ${getConfidenceColor(selectedMetric.confidenceScore)}`}>
                      {selectedMetric.confidenceScore
                        ? `${Math.round(selectedMetric.confidenceScore * 100)}%`
                        : 'N/A'
                      }
                    </p>
                  </div>
                </div>

                {selectedMetric.disputeMetadata?.aiAnalysis && (
                  <div>
                    <span className="text-gray-400">AI Analysis:</span>
                    <pre className="text-white text-xs mt-2 bg-gray-900 p-3 rounded overflow-x-auto">
                      {JSON.stringify(selectedMetric.disputeMetadata.aiAnalysis, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedMetric.disputeMetadata?.webhookData && (
                  <div>
                    <span className="text-gray-400">Original Webhook Data:</span>
                    <pre className="text-white text-xs mt-2 bg-gray-900 p-3 rounded overflow-x-auto">
                      {JSON.stringify(selectedMetric.disputeMetadata.webhookData, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info Panel */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <FiInfo className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="text-blue-400 font-medium mb-1">Understanding Your Usage Charges</p>
            <ul className="text-blue-300 space-y-1">
              <li>• <strong>Provider Webhook:</strong> Metrics detected directly by your AI provider</li>
              <li>• <strong>Internal AI:</strong> Metrics detected by our AI analysis of call transcripts</li>
              <li>• <strong>Confidence Score:</strong> How certain we are about the metric detection (higher is better)</li>
              <li>• <strong>Billing Status:</strong> Current status of the charge (pending, billed, disputed)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}