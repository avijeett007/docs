'use client';

import React, { useState, useEffect } from 'react';
import { FiActivity, FiAlertTriangle, FiCheckCircle, FiXCircle, FiRefreshCw, FiTrendingUp } from 'react-icons/fi';
import clsx from 'clsx';

interface HealthStatus {
  status: 'healthy' | 'warning' | 'critical';
  metrics: {
    timestamp: Date;
    totalAgents: number;
    migratedAgents: number;
    migrationProgress: number;
    errorCount: number;
    averageResponseTime?: number;
  };
  activeAlerts: number;
  criticalAlerts: number;
}

interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  resolved: boolean;
  metadata?: Record<string, any>;
}

export default function MigrationMonitoringDashboard() {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    fetchMonitoringData();
    
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(fetchMonitoringData, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchMonitoringData = async () => {
    try {
      setLoading(true);
      
      // Fetch health status
      const healthResponse = await fetch('/api/admin/migration/monitoring?action=status');
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        setHealthStatus(healthData.data);
      }

      // Fetch alerts
      const alertsResponse = await fetch('/api/admin/migration/monitoring?action=alerts');
      if (alertsResponse.ok) {
        const alertsData = await alertsResponse.json();
        setAlerts(alertsData.data.alerts);
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching monitoring data:', error);
    } finally {
      setLoading(false);
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      const response = await fetch('/api/admin/migration/monitoring', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'resolve_alert',
          alertId
        })
      });

      if (response.ok) {
        // Refresh alerts
        fetchMonitoringData();
      }
    } catch (error) {
      console.error('Error resolving alert:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-400';
      case 'warning': return 'text-amber-400';
      case 'critical': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <FiCheckCircle className="w-5 h-5" />;
      case 'warning': return <FiAlertTriangle className="w-5 h-5" />;
      case 'critical': return <FiXCircle className="w-5 h-5" />;
      default: return <FiActivity className="w-5 h-5" />;
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'critical': return <FiXCircle className="w-4 h-4 text-red-400" />;
      case 'warning': return <FiAlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'info': return <FiActivity className="w-4 h-4 text-blue-400" />;
      default: return <FiActivity className="w-4 h-4 text-gray-400" />;
    }
  };

  if (loading && !healthStatus) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-700 rounded w-5/6"></div>
            <div className="h-4 bg-gray-700 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Migration System Monitoring</h2>
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <span className="text-sm text-gray-400">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchMonitoringData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 rounded-lg transition-colors"
          >
            <FiRefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* System Status Overview */}
      {healthStatus && (
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className={getStatusColor(healthStatus.status)}>
              {getStatusIcon(healthStatus.status)}
            </div>
            <h3 className="text-xl font-semibold text-white">System Status</h3>
            <span className={clsx(
              'px-3 py-1 rounded-full text-sm font-medium',
              healthStatus.status === 'healthy' ? 'bg-green-500/20 text-green-400' :
              healthStatus.status === 'warning' ? 'bg-yellow-500/20 text-amber-400' :
              'bg-red-500/20 text-red-400'
            )}>
              {healthStatus.status.toUpperCase()}
            </span>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="text-2xl font-bold text-white">{healthStatus.metrics.totalAgents}</div>
              <div className="text-sm text-gray-400">Total Agents</div>
            </div>
            
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-400">{healthStatus.metrics.migratedAgents}</div>
              <div className="text-sm text-gray-400">Migrated Agents</div>
            </div>
            
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-400">{healthStatus.metrics.migrationProgress.toFixed(1)}%</div>
              <div className="text-sm text-gray-400">Migration Progress</div>
            </div>
            
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-400">{healthStatus.activeAlerts}</div>
              <div className="text-sm text-gray-400">Active Alerts</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-400 mb-2">
              <span>Migration Progress</span>
              <span>{healthStatus.metrics.migrationProgress.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${healthStatus.metrics.migrationProgress}%` }}
              ></div>
            </div>
          </div>

          {/* Additional Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Error Count (1h): </span>
              <span className="text-white">{healthStatus.metrics.errorCount}</span>
            </div>
            {healthStatus.metrics.averageResponseTime && (
              <div>
                <span className="text-gray-400">Avg Response Time: </span>
                <span className="text-white">{healthStatus.metrics.averageResponseTime}ms</span>
              </div>
            )}
            <div>
              <span className="text-gray-400">Critical Alerts: </span>
              <span className="text-white">{healthStatus.criticalAlerts}</span>
            </div>
          </div>
        </div>
      )}

      {/* Active Alerts */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <FiAlertTriangle className="w-5 h-5 text-amber-400" />
          <h3 className="text-xl font-semibold text-white">Active Alerts</h3>
          <span className="px-2 py-1 bg-gray-700 rounded-full text-xs text-gray-300">
            {alerts.filter(a => !a.resolved).length}
          </span>
        </div>

        {alerts.filter(a => !a.resolved).length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <FiCheckCircle className="w-12 h-12 mx-auto mb-4 text-green-400" />
            <p>No active alerts. System is running smoothly!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.filter(a => !a.resolved).map((alert) => (
              <div
                key={alert.id}
                className={clsx(
                  'p-4 rounded-lg border-l-4',
                  alert.type === 'critical' ? 'bg-red-500/10 border-red-500' :
                  alert.type === 'warning' ? 'bg-yellow-500/10 border-yellow-500' :
                  'bg-blue-500/10 border-blue-500'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {getAlertIcon(alert.type)}
                    <div>
                      <h4 className="font-medium text-white">{alert.title}</h4>
                      <p className="text-sm text-gray-300 mt-1">{alert.message}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        {new Date(alert.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => resolveAlert(alert.id)}
                    className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white text-xs rounded transition-colors"
                  >
                    Resolve
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-xl font-semibold text-white mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="/api/health/migration"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            <FiActivity className="w-4 h-4 text-blue-400" />
            <span className="text-white">Health Check</span>
          </a>
          
          <a
            href="/partner/agents/migration"
            className="flex items-center gap-2 p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            <FiTrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-white">Migration Dashboard</span>
          </a>
          
          <button
            onClick={fetchMonitoringData}
            className="flex items-center gap-2 p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            <FiRefreshCw className="w-4 h-4 text-amber-400" />
            <span className="text-white">Refresh Data</span>
          </button>
        </div>
      </div>
    </div>
  );
}
