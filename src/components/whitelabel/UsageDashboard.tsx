'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  FiActivity,
  FiBarChart,
  FiClock,
  FiDollarSign,
  FiTrendingUp,
  FiLoader,
  FiCalendar,
  FiInfo
} from 'react-icons/fi';
import { motion } from 'framer-motion';
import { usePartnerBranding } from '@/lib/partnerBranding';
import { PortalTheme, getThemeConfig } from '@/lib/portalThemes';

interface UsageProjection {
  subscriptionId: string;
  planName: string;
  metricType: string;
  metricName: string;
  billingCycle: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  currentUsage: number;
  includedUnits: number;
  projectedCost: number;
  calculation: {
    totalUsage: number;
    includedUsage: number;
    billableUsage: number;
    totalCost: number;
    minimumCharge: number;
    finalAmount: number;
    tierBreakdown: Array<{
      tier: number;
      upTo: number | null;
      usage: number;
      rate: number;
      cost: number;
    }>;
  };
}

interface MetricUsage {
  metricType: string;
  metricName: string;
  metricCategory?: string;
  events: any[];
  totalQuantity: number;
  totalCost: number;
}

interface UsageData {
  currentPeriod: {
    start: string;
    end: string;
    usage: any[];
  };
  meteredPlans: any[];
  usageProjections: UsageProjection[];
  unbilledUsage: any[];
  usageHistory: {
    period: {
      start: string;
      end: string;
    };
    byMetric: MetricUsage[];
    events: any[];
  };
  summary: {
    totalEvents: number;
    totalMetricTypes: number;
    activePlans: number;
    unbilledAmount: number;
  };
}

interface UsageDashboardProps {
  className?: string;
}

export default function UsageDashboard({ className = '' }: UsageDashboardProps) {
  const { branding } = usePartnerBranding();
  const theme = (branding.themePreference as PortalTheme) || PortalTheme.MODERN;
  const themeConfig = getThemeConfig(theme);

  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  // Fetch usage data
  const fetchUsageData = async () => {
    try {
      const response = await fetch('/api/whitelabel/usage', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch usage data');
      }

      const data = await response.json();
      if (data.success) {
        setUsageData(data.data);
      }
    } catch (error) {
      console.error('Error fetching usage data:', error);
      toast.error('Failed to load usage data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsageData();
  }, []);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Format billing cycle
  const formatBillingCycle = (cycle: string) => {
    return cycle.charAt(0).toUpperCase() + cycle.slice(1);
  };

  if (isLoading) {
    return (
      <div className={`${className}`}>
        <div className="flex items-center justify-center py-12">
          <FiLoader className="w-8 h-8 animate-spin text-gray-400" />
          <span className="ml-3 text-gray-400">Loading usage data...</span>
        </div>
      </div>
    );
  }

  if (!usageData) {
    return (
      <div className={`${className}`}>
        <div className="text-center py-12">
          <FiActivity className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No Usage Data</h3>
          <p className="text-gray-400">Usage tracking will appear here once you start using services.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Usage & Billing</h2>
        <p className="text-gray-400">
          Track your service usage and view billing projections
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-xl p-6`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Active Plans</p>
              <p className="text-2xl font-bold text-white">{usageData.summary.activePlans}</p>
            </div>
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <FiBarChart className="w-6 h-6 text-blue-400" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-xl p-6`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Usage Events</p>
              <p className="text-2xl font-bold text-white">{usageData.summary.totalEvents}</p>
            </div>
            <div className="p-3 bg-green-500/20 rounded-lg">
              <FiActivity className="w-6 h-6 text-green-400" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-xl p-6`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Metric Types</p>
              <p className="text-2xl font-bold text-white">{usageData.summary.totalMetricTypes}</p>
            </div>
            <div className="p-3 bg-purple-500/20 rounded-lg">
              <FiTrendingUp className="w-6 h-6 text-purple-400" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-xl p-6`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Unbilled Amount</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(usageData.summary.unbilledAmount)}
              </p>
            </div>
            <div className="p-3 bg-orange-500/20 rounded-lg">
              <FiDollarSign className="w-6 h-6 text-orange-400" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Active Metered Plans */}
      {usageData.usageProjections.length > 0 && (
        <div className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-xl p-6`}>
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <FiBarChart className="w-5 h-5" />
            Current Billing Period
          </h3>
          
          <div className="space-y-4">
            {usageData.usageProjections.map((projection, index) => (
              <motion.div
                key={projection.subscriptionId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-gray-800/50 rounded-lg p-4 border border-gray-700"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-white">{projection.planName}</h4>
                    <p className="text-sm text-gray-400">
                      {projection.metricName} • {formatBillingCycle(projection.billingCycle)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-white">
                      {formatCurrency(projection.projectedCost)}
                    </p>
                    <p className="text-xs text-gray-400">Projected Cost</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">Current Usage</p>
                    <p className="font-medium text-white">
                      {projection.currentUsage.toLocaleString()} units
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Included Units</p>
                    <p className="font-medium text-white">
                      {projection.includedUnits.toLocaleString()} units
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Billable Usage</p>
                    <p className="font-medium text-white">
                      {projection.calculation.billableUsage.toLocaleString()} units
                    </p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-700">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>Period: {formatDate(projection.currentPeriodStart)} - {formatDate(projection.currentPeriodEnd)}</span>
                    <span>Minimum: {formatCurrency(projection.calculation.minimumCharge)}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Usage History by Metric */}
      {usageData.usageHistory.byMetric.length > 0 && (
        <div className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-xl p-6`}>
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <FiActivity className="w-5 h-5" />
            Usage History
          </h3>
          
          <div className="space-y-4">
            {usageData.usageHistory.byMetric.map((metric, index) => (
              <motion.div
                key={`${metric.metricType}-${metric.metricName}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-gray-800/50 rounded-lg p-4 border border-gray-700"
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-medium text-white">{metric.metricName}</h4>
                    <p className="text-sm text-gray-400">
                      {metric.metricType}
                      {metric.metricCategory && ` • ${metric.metricCategory}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-white">
                      {metric.totalQuantity.toLocaleString()} units
                    </p>
                    {metric.totalCost > 0 && (
                      <p className="text-sm text-gray-400">
                        {formatCurrency(metric.totalCost)}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="text-xs text-gray-400">
                  {metric.events.length} events in period
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Info Message */}
      <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <FiInfo className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="text-sm">
          <p className="text-blue-400 font-medium mb-1">Usage-Based Billing</p>
          <p className="text-blue-300">
            Your usage is tracked in real-time and billed according to your active metered plans. 
            Charges are calculated at the end of each billing period and added to your invoice.
          </p>
        </div>
      </div>
    </div>
  );
}
