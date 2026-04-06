'use client';

import React, { useState, useEffect } from 'react';
import { 
  FiBarChart, 
  FiSend, 
  FiSettings, 
  FiClock,
  FiCheckCircle,
  FiXCircle,
  FiAlertCircle
} from 'react-icons/fi';
import { useToast } from '@/hooks/use-toast';
import {
  ReportConfigResponse,
  ReportFrequency,
  ReportMetric,
  ReportPeriod,
  ReportLogEntry,
  ALL_REPORT_METRICS,
  UpdateReportConfigRequest,
  SendInstantReportRequest,
  ReportLogsResponse
} from '@/types/customerReport';

interface CustomerReportTabProps {
  customerId: string;
  customerName: string;
}

export default function CustomerReportTab({ 
  customerId, 
  customerName 
}: CustomerReportTabProps) {
  const { toast } = useToast();
  
  // State management
  const [config, setConfig] = useState<ReportConfigResponse | null>(null);
  const [logs, setLogs] = useState<ReportLogEntry[]>([]);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  // Form state
  const [frequency, setFrequency] = useState<ReportFrequency>('none');
  const [includedMetrics, setIncludedMetrics] = useState<ReportMetric[]>([
    'agentName',
    'totalCalls',
    'totalDuration',
    'avgDuration',
    'successRate',
    'failureRate'
  ]);
  const [isEnabled, setIsEnabled] = useState(true);
  const [instantPeriod, setInstantPeriod] = useState<ReportPeriod>('day');

  // Fetch initial data
  useEffect(() => {
    fetchConfig();
    fetchLogs();
  }, [customerId]);

  const fetchConfig = async () => {
    try {
      setIsLoadingConfig(true);
      const response = await fetch(`/api/partner/customers/${customerId}/report-config`);
      const data: ReportConfigResponse = await response.json();

      if (response.ok) {
        setConfig(data);
        setFrequency(data.frequency);
        setIncludedMetrics(data.includedMetrics);
        setIsEnabled(data.isEnabled);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load report configuration',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error fetching config:', error);
      toast({
        title: 'Error',
        description: 'Failed to load report configuration',
        variant: 'destructive'
      });
    } finally {
      setIsLoadingConfig(false);
    }
  };

  const fetchLogs = async () => {
    try {
      setIsLoadingLogs(true);
      const response = await fetch(`/api/partner/customers/${customerId}/report-logs`);
      const data: ReportLogsResponse = await response.json();

      if (response.ok) {
        setLogs(data.logs);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load report history',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
      toast({
        title: 'Error',
        description: 'Failed to load report history',
        variant: 'destructive'
      });
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleSaveConfig = async () => {
    if (includedMetrics.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please select at least one metric to include in reports',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsSaving(true);
      
      const requestData: UpdateReportConfigRequest = {
        frequency,
        includedMetrics,
        isEnabled
      };

      const response = await fetch(`/api/partner/customers/${customerId}/report-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });

      const data: ReportConfigResponse = await response.json();

      if (response.ok) {
        setConfig(data);
        toast({
          title: 'Success',
          description: 'Report configuration saved successfully'
        });
      } else {
        toast({
          title: 'Error',
          description: (data as any).error || 'Failed to save configuration',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error saving config:', error);
      toast({
        title: 'Error',
        description: 'Failed to save configuration',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendInstant = async () => {
    try {
      setIsSending(true);

      const requestData: SendInstantReportRequest = {
        period: instantPeriod
      };

      const response = await fetch(
        `/api/partner/customers/${customerId}/report-config/send-instant`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestData)
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        // Get customer email for success message
        const customerEmail = await fetch(`/api/partner/customers/${customerId}`)
          .then(r => r.json())
          .then(c => c.email)
          .catch(() => 'customer');
        
        toast({
          title: 'Report Sent Successfully',
          description: `Analytics report sent to ${customerName}${customerEmail !== 'customer' ? ` (${customerEmail})` : ''}`,
          duration: 5000,
        });
        // Refresh logs and config
        fetchLogs();
        fetchConfig();
      } else {
        // Enhanced error messaging
        const errorMsg = data.error || 'Failed to send report';
        const isServiceDown = response.status === 503 || errorMsg.includes('unavailable') || errorMsg.includes('503');
        
        toast({
          title: isServiceDown ? 'Service Temporarily Unavailable' : 'Failed to Send Report',
          description: isServiceDown 
            ? 'The analytics service is currently unavailable. Please try again in a few moments.'
            : errorMsg,
          variant: 'destructive',
          duration: 7000,
        });
      }
    } catch (error) {
      console.error('Error sending instant report:', error);
      toast({
        title: 'Error',
        description: 'Failed to send report',
        variant: 'destructive'
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleMetricToggle = (metric: ReportMetric) => {
    setIncludedMetrics(prev => {
      if (prev.includes(metric)) {
        // Don't allow removing the last metric
        if (prev.length === 1) {
          toast({
            title: 'Validation Error',
            description: 'At least one metric must be selected',
            variant: 'destructive'
          });
          return prev;
        }
        return prev.filter(m => m !== metric);
      } else {
        return [...prev, metric];
      }
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  if (isLoadingConfig) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section A: Report Configuration */}
      <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <FiSettings className="text-blue-400" size={20} />
          <h3 className="text-lg font-semibold text-white">Report Configuration</h3>
        </div>

        {/* Report Frequency */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Report Frequency
          </label>
          <div className="grid grid-cols-3 gap-3">
            {(['none', 'daily', 'weekly'] as ReportFrequency[]).map((freq) => (
              <button
                key={freq}
                onClick={() => setFrequency(freq)}
                className={`px-4 py-3 rounded-lg border-2 transition-all ${
                  frequency === freq
                    ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                    : 'border-gray-600 bg-gray-700/50 text-gray-400 hover:border-gray-500'
                }`}
              >
                <div className="font-medium capitalize">{freq}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Included Metrics */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Included Metrics
          </label>
          <div className="grid grid-cols-2 gap-3">
            {ALL_REPORT_METRICS.map((metric) => (
              <label
                key={metric.key}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-700 bg-gray-700/30 hover:bg-gray-700/50 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={includedMetrics.includes(metric.key)}
                  onChange={() => handleMetricToggle(metric.key)}
                  className="w-4 h-4 text-blue-500 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                />
                <span className="text-sm text-gray-300">{metric.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Enabled Toggle */}
        <div className="mb-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="w-5 h-5 text-blue-500 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
            />
            <span className="text-sm font-medium text-gray-300">
              Enable scheduled reports
            </span>
          </label>
        </div>

        {/* Status Indicators */}
        {config && (
          <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-900/50 rounded-lg">
            <div>
              <div className="text-xs text-gray-500 mb-1">Last Sent</div>
              <div className="text-sm text-gray-300">
                {config.lastSentAt ? formatDate(config.lastSentAt) : 'Never'}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Next Scheduled</div>
              <div className="text-sm text-gray-300">
                {config.nextScheduledAt ? formatDate(config.nextScheduledAt) : 'Not scheduled'}
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <button
          onClick={handleSaveConfig}
          disabled={isSaving}
          className="w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Saving...
            </>
          ) : (
            <>
              <FiSettings size={18} />
              Save Configuration
            </>
          )}
        </button>
      </div>

      {/* Section B: Send Instant Report */}
      <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <FiSend className="text-green-400" size={20} />
          <h3 className="text-lg font-semibold text-white">Send Instant Report</h3>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Period
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setInstantPeriod('day')}
              className={`px-4 py-3 rounded-lg border-2 transition-all ${
                instantPeriod === 'day'
                  ? 'border-green-500 bg-green-500/10 text-green-400'
                  : 'border-gray-600 bg-gray-700/50 text-gray-400 hover:border-gray-500'
              }`}
            >
              <div className="font-medium">Last 24 Hours</div>
            </button>
            <button
              onClick={() => setInstantPeriod('week')}
              className={`px-4 py-3 rounded-lg border-2 transition-all ${
                instantPeriod === 'week'
                  ? 'border-green-500 bg-green-500/10 text-green-400'
                  : 'border-gray-600 bg-gray-700/50 text-gray-400 hover:border-gray-500'
              }`}
            >
              <div className="font-medium">Last 7 Days</div>
            </button>
          </div>
        </div>

        <button
          onClick={handleSendInstant}
          disabled={isSending}
          className="w-full px-4 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {isSending ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Sending...
            </>
          ) : (
            <>
              <FiSend size={18} />
              Send Report Now
            </>
          )}
        </button>
      </div>

      {/* Section C: Report History */}
      <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <FiClock className="text-purple-400" size={20} />
          <h3 className="text-lg font-semibold text-white">Report History</h3>
        </div>

        {isLoadingLogs ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FiAlertCircle size={32} className="mx-auto mb-2 opacity-50" />
            <p>No reports sent yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase">Date Sent</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase">Type</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase">Period</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                    <td className="py-3 px-4 text-sm text-gray-300">
                      {formatDate(log.sentAt)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        log.reportType === 'instant'
                          ? 'bg-green-500/10 text-green-400'
                          : 'bg-blue-500/10 text-blue-400'
                      }`}>
                        {log.reportType === 'instant' ? 'Instant' : 'Scheduled'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-300 capitalize">
                      {log.period === 'day' ? 'Daily' : 'Weekly'}
                    </td>
                    <td className="py-3 px-4">
                      {log.emailStatus === 'sent' ? (
                        <div className="flex items-center gap-1.5 text-green-400">
                          <FiCheckCircle size={16} />
                          <span className="text-sm">Sent</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-red-400">
                          <FiXCircle size={16} />
                          <span className="text-sm">Failed</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
