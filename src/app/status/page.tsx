'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle2, ExternalLink, Monitor, RefreshCw, AlertTriangle, Clock, Zap } from 'lucide-react';
import Footer from '@/components/Footer';
import PublicHeader from '@/components/PublicHeader';

interface UptimeMonitor {
  id: number;
  name: string;
  type: string;
  status: number; // 0=DOWN, 1=UP, 2=PENDING, 3=MAINTENANCE
  uptime: number;
  responseTime: number | null;
  lastCheck: string | null;
  message: string;
}

interface UptimeGroup {
  id: number;
  name: string;
  monitors: UptimeMonitor[];
}

interface UptimeData {
  title: string;
  description: string;
  lastUpdated: string;
  incident: any;
  maintenance: any[];
  groups: UptimeGroup[];
}

export default function StatusPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<UptimeData | null>(null);

  const fetchStatusData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/uptime-status');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.error) {
        throw new Error(result.details || result.error);
      }

      setData(result);
    } catch (err) {
      console.error('Failed to fetch status data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load status data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatusData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStatusData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    fetchStatusData();
  };

  const getStatusColor = (status: number) => {
    switch (status) {
      case 1: return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 0: return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 2: return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 3: return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    }
  };

  const getStatusText = (status: number) => {
    switch (status) {
      case 1: return 'Operational';
      case 0: return 'Down';
      case 2: return 'Pending';
      case 3: return 'Maintenance';
      default: return 'Unknown';
    }
  };

  const getStatusIcon = (status: number) => {
    switch (status) {
      case 1: return <CheckCircle2 className="h-4 w-4" />;
      case 0: return <AlertTriangle className="h-4 w-4" />;
      case 2: return <Clock className="h-4 w-4" />;
      case 3: return <Monitor className="h-4 w-4" />;
      default: return <Monitor className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black text-white">
      <PublicHeader />
      <main className="relative isolate">
        {/* Background */}
        <div
          className="absolute inset-x-0 top-4 -z-10 flex transform-gpu justify-center overflow-hidden blur-3xl"
          aria-hidden="true"
        >
          <div
            className="aspect-[1108/632] w-[69.25rem] flex-none bg-gradient-to-r from-[#80caff] to-[#4f46e5] opacity-20"
            style={{
              clipPath:
                'polygon(73.6% 51.7%, 91.7% 11.8%, 100% 46.4%, 97.4% 82.2%, 92.5% 84.9%, 75.7% 64%, 55.3% 47.5%, 46.5% 49.4%, 45% 62.9%, 50.3% 87.2%, 21.3% 64.1%, 0.1% 100%, 5.4% 51.1%, 21.4% 63.9%, 58.9% 0.2%, 73.6% 51.7%)',
            }}
          />
        </div>

        {/* Content */}
        <div className="px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-6xl">
            {/* Header */}
            <div className="text-center mb-12">
              <div className="flex items-center justify-center gap-3 mb-6">
                <div className="relative">
                  <Monitor className="h-10 w-10 text-blue-400" />
                  <div className="absolute -top-1 -right-1 h-4 w-4 bg-green-400 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="h-3 w-3 text-gray-900" />
                  </div>
                </div>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">
                  System Status
                </h1>
              </div>
              <p className="text-xl text-gray-300 mb-8">
                Real-time status and performance monitoring for Knotie-AI Pro
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
                <button
                  onClick={handleRefresh}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed rounded-lg transition-colors duration-200"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  {isLoading ? 'Refreshing...' : 'Refresh Status'}
                </button>
                <a
                  href="https://uptime.knotie.ai/status/knotie-ai-pro"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-6 py-3 border border-gray-600 hover:border-gray-500 rounded-lg transition-colors duration-200"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open in New Tab
                </a>
              </div>

              {data?.lastUpdated && (
                <p className="text-sm text-gray-400">
                  Last updated: {new Date(data.lastUpdated).toLocaleString()}
                </p>
              )}
            </div>

            {/* Status Container */}
            <div className="relative bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700/50 overflow-hidden shadow-2xl">
              {/* Loading Overlay */}
              {isLoading && (
                <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm z-10 flex items-center justify-center">
                  <div className="text-center">
                    <RefreshCw className="h-8 w-8 text-blue-400 animate-spin mx-auto mb-4" />
                    <p className="text-gray-300">Loading system status...</p>
                  </div>
                </div>
              )}

              {/* Error State */}
              {error && !isLoading && (
                <div className="p-8 text-center">
                  <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-red-400 mb-2">Failed to Load Status</h3>
                  <p className="text-gray-400 mb-4">{error}</p>
                  <button
                    onClick={handleRefresh}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {/* Status Content */}
              {data && !isLoading && !error && (
                <div className="p-6">
                  {/* Incident Banner */}
                  {data.incident && (
                    <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <h3 className="font-semibold text-yellow-400">{data.incident.title}</h3>
                          <p className="text-gray-300 mt-1">{data.incident.content}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Monitor Groups */}
                  <div className="space-y-6">
                    {data.groups.map((group) => (
                      <div key={group.id} className="space-y-3">
                        <h3 className="text-lg font-semibold text-gray-200">{group.name}</h3>
                        <div className="grid gap-3">
                          {group.monitors.map((monitor) => (
                            <div
                              key={monitor.id}
                              className={`p-4 rounded-lg border ${getStatusColor(monitor.status)}`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  {getStatusIcon(monitor.status)}
                                  <div>
                                    <h4 className="font-medium">{monitor.name}</h4>
                                    <p className="text-sm opacity-75">{getStatusText(monitor.status)}</p>
                                  </div>
                                </div>
                                <div className="text-right text-sm">
                                  <div className="flex items-center gap-4">
                                    {monitor.uptime > 0 && (
                                      <div className="text-center">
                                        <div className="font-semibold">{monitor.uptime}%</div>
                                        <div className="text-xs opacity-75">Uptime (24h)</div>
                                      </div>
                                    )}
                                    {monitor.responseTime && (
                                      <div className="text-center">
                                        <div className="font-semibold flex items-center gap-1">
                                          <Zap className="h-3 w-3" />
                                          {monitor.responseTime}ms
                                        </div>
                                        <div className="text-xs opacity-75">Response</div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Overall Status Summary */}
                  <div className="mt-8 pt-6 border-t border-gray-700">
                    <div className="text-center">
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700/50 rounded-full">
                        <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse"></div>
                        <span className="text-sm text-gray-300">
                          All systems operational
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Info */}
            <div className="mt-12 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800/50 rounded-full border border-gray-700/50">
                <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-300">
                  Monitoring powered by Knotie Infrastructure Team
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
