'use client';

import React, { useState, useEffect } from 'react';
import { FiRefreshCw, FiDownload, FiUpload, FiCheck, FiX, FiAlertTriangle, FiInfo } from 'react-icons/fi';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface MigrationStatus {
  summary: {
    totalAgents: number;
    totalMigrated: number;
    migrationProgress: number;
    needsAttention: number;
  };
  vapi: {
    total: number;
    migrated: number;
    byStatus: Record<string, number>;
  };
  retell: {
    total: number;
    migrated: number;
    byStatus: Record<string, number>;
  };
  invalidAgents: Array<{
    id: string;
    name: string;
    provider: string;
    apiKeyErrorMessage?: string;
    apiKeyLastVerified?: string;
  }>;
}

interface WebhookStatus {
  summary: {
    totalAgents: number;
    totalWebhookEnabled: number;
    totalWebhookDisabled: number;
    webhookProgress: number;
  };
  vapi: {
    total: number;
    webhookEnabled: number;
    webhookDisabled: number;
  };
  retell: {
    total: number;
    webhookEnabled: number;
    webhookDisabled: number;
  };
  ultravox: {
    total: number;
    webhookEnabled: number;
    webhookDisabled: number;
  };
}

interface MigrationDashboardProps {
  onImportClick: () => void;
}

export default function MigrationDashboard({ onImportClick }: MigrationDashboardProps) {
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [webhookStatus, setWebhookStatus] = useState<WebhookStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [webhookLoading, setWebhookLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [webhookMigrating, setWebhookMigrating] = useState(false);

  useEffect(() => {
    fetchMigrationStatus();
    fetchWebhookStatus();
  }, []);

  const fetchMigrationStatus = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch('/api/partner/agents/migration-status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      } else {
        toast.error('Failed to fetch migration status');
      }
    } catch (error) {
      console.error('Error fetching migration status:', error);
      toast.error('Failed to fetch migration status');
    } finally {
      setLoading(false);
    }
  };

  const fetchWebhookStatus = async () => {
    try {
      setWebhookLoading(true);
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch('/api/partner/agents/webhook-stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setWebhookStatus(data);
      } else {
        toast.error('Failed to fetch webhook status');
      }
    } catch (error) {
      console.error('Error fetching webhook status:', error);
      toast.error('Failed to fetch webhook status');
    } finally {
      setWebhookLoading(false);
    }
  };

  const handleBulkMigration = async (provider: 'vapi' | 'retell' | 'all') => {
    try {
      setMigrating(true);
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch('/api/partner/agents/migrate-bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          provider,
          verifyKeys: true
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Migration completed! ${result.summary.totalMigrated} agents migrated successfully.`);

        // Refresh status
        await fetchMigrationStatus();
      } else {
        const error = await response.json();
        toast.error(`Migration failed: ${error.error}`);
      }
    } catch (error) {
      console.error('Error in bulk migration:', error);
      toast.error('Migration failed');
    } finally {
      setMigrating(false);
    }
  };

  const handleBulkWebhookEnable = async (provider: 'vapi' | 'retell' | 'ultravox' | 'all') => {
    try {
      setWebhookMigrating(true);
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch('/api/partner/agents/webhook-bulk-enable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          provider
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Webhook migration completed! ${result.summary.totalSuccessful} agents enabled successfully.`);

        // Refresh both statuses
        await Promise.all([fetchMigrationStatus(), fetchWebhookStatus()]);
      } else {
        const error = await response.json();
        toast.error(`Webhook migration failed: ${error.error}`);
      }
    } catch (error) {
      console.error('Error in bulk webhook enable:', error);
      toast.error('Webhook migration failed');
    } finally {
      setWebhookMigrating(false);
    }
  };

  const getStatusColor = (statusKey: string) => {
    switch (statusKey) {
      case 'valid': return 'text-green-400';
      case 'invalid': return 'text-red-400';
      case 'expired': return 'text-orange-400';
      case 'rate_limited': return 'text-amber-400';
      case 'not_set': return 'text-gray-400';
      case 'migrated_from_partner': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusLabel = (statusKey: string) => {
    switch (statusKey) {
      case 'valid': return 'Valid';
      case 'invalid': return 'Invalid';
      case 'expired': return 'Expired';
      case 'rate_limited': return 'Rate Limited';
      case 'not_set': return 'Not Set';
      case 'migrated_from_partner': return 'Migrated';
      default: return statusKey;
    }
  };

  if (loading || webhookLoading) {
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

  if (!status || !webhookStatus) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="text-center text-gray-400">
          <FiAlertTriangle className="w-12 h-12 mx-auto mb-4" />
          <p>Failed to load migration status</p>
          <button
            onClick={fetchMigrationStatus}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Migration Overview */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold">Migration Status</h3>
          <button
            onClick={() => {
              fetchMigrationStatus();
              fetchWebhookStatus();
            }}
            disabled={loading || webhookLoading}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <FiRefreshCw className={clsx('w-5 h-5', (loading || webhookLoading) && 'animate-spin')} />
          </button>
        </div>

        {/* Progress Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-white">{status.summary.totalAgents}</div>
            <div className="text-sm text-gray-400">Total Agents</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-400">{status.summary.totalMigrated}</div>
            <div className="text-sm text-gray-400">Migrated</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-400">{status.summary.migrationProgress}%</div>
            <div className="text-sm text-gray-400">Progress</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-red-400">{status.summary.needsAttention}</div>
            <div className="text-sm text-gray-400">Need Attention</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>Migration Progress</span>
            <span>{status.summary.migrationProgress}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${status.summary.migrationProgress}%` }}
            ></div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleBulkMigration('all')}
            disabled={migrating || status.summary.migrationProgress === 100}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {migrating ? (
              <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div>
            ) : (
              <FiDownload className="w-4 h-4" />
            )}
            <span>Migrate All Agents</span>
          </button>
          
          <button
            onClick={onImportClick}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg transition-colors"
          >
            <FiUpload className="w-4 h-4" />
            <span>Import New Agents</span>
          </button>
        </div>
      </div>

      {/* Webhook Migration Overview */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold">Webhook Migration Status</h3>
          <div className="flex items-center gap-2 text-sm text-orange-400">
            <FiAlertTriangle className="w-4 h-4" />
            <span>Required for analytics</span>
          </div>
        </div>

        {/* Webhook Progress Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-white">{webhookStatus.summary.totalAgents}</div>
            <div className="text-sm text-gray-400">Total Agents</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-400">{webhookStatus.summary.totalWebhookEnabled}</div>
            <div className="text-sm text-gray-400">Webhook Enabled</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-400">{webhookStatus.summary.webhookProgress}%</div>
            <div className="text-sm text-gray-400">Progress</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-red-400">{webhookStatus.summary.totalWebhookDisabled}</div>
            <div className="text-sm text-gray-400">Need Migration</div>
          </div>
        </div>

        {/* Webhook Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>Webhook Migration Progress</span>
            <span>{webhookStatus.summary.webhookProgress}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${webhookStatus.summary.webhookProgress}%` }}
            ></div>
          </div>
        </div>

        {/* Webhook Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleBulkWebhookEnable('all')}
            disabled={webhookMigrating || webhookStatus.summary.webhookProgress === 100}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {webhookMigrating ? (
              <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div>
            ) : (
              <FiCheck className="w-4 h-4" />
            )}
            <span>Enable Webhooks for All Agents</span>
          </button>

          <div className="text-sm text-gray-400 flex items-center gap-2">
            <FiInfo className="w-4 h-4" />
            <span>Existing webhook URLs will be preserved</span>
          </div>
        </div>
      </div>

      {/* Webhook Provider Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* VAPI Webhook Status */}
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold">VAPI Webhooks</h4>
            <button
              onClick={() => handleBulkWebhookEnable('vapi')}
              disabled={webhookMigrating || webhookStatus.vapi.webhookDisabled === 0}
              className="text-sm px-3 py-1 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded transition-colors"
            >
              Enable VAPI
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-green-400">Enabled</span>
              <span className="text-sm text-gray-300">{webhookStatus.vapi.webhookEnabled}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-red-400">Disabled</span>
              <span className="text-sm text-gray-300">{webhookStatus.vapi.webhookDisabled}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Total</span>
              <span className="text-sm text-gray-300">{webhookStatus.vapi.total}</span>
            </div>
          </div>
        </div>

        {/* Retell Webhook Status */}
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold">Retell Webhooks</h4>
            <button
              onClick={() => handleBulkWebhookEnable('retell')}
              disabled={webhookMigrating || webhookStatus.retell.webhookDisabled === 0}
              className="text-sm px-3 py-1 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded transition-colors"
            >
              Enable Retell
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-green-400">Enabled</span>
              <span className="text-sm text-gray-300">{webhookStatus.retell.webhookEnabled}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-red-400">Disabled</span>
              <span className="text-sm text-gray-300">{webhookStatus.retell.webhookDisabled}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Total</span>
              <span className="text-sm text-gray-300">{webhookStatus.retell.total}</span>
            </div>
          </div>
        </div>

        {/* Ultravox Webhook Status */}
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold">Ultravox Webhooks</h4>
            <button
              onClick={() => handleBulkWebhookEnable('ultravox')}
              disabled={webhookMigrating || webhookStatus.ultravox.webhookDisabled === 0}
              className="text-sm px-3 py-1 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded transition-colors"
            >
              Enable Ultravox
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-green-400">Enabled</span>
              <span className="text-sm text-gray-300">{webhookStatus.ultravox.webhookEnabled}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-red-400">Disabled</span>
              <span className="text-sm text-gray-300">{webhookStatus.ultravox.webhookDisabled}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Total</span>
              <span className="text-sm text-gray-300">{webhookStatus.ultravox.total}</span>
            </div>
          </div>
        </div>
      </div>

      {/* API Key Migration Provider Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* VAPI Status */}
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold">VAPI Agents</h4>
            <button
              onClick={() => handleBulkMigration('vapi')}
              disabled={migrating || status.vapi.total === status.vapi.migrated}
              className="text-sm px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded transition-colors"
            >
              Migrate VAPI
            </button>
          </div>
          
          <div className="space-y-2">
            {Object.entries(status.vapi.byStatus).map(([statusKey, count]) => (
              count > 0 && (
                <div key={statusKey} className="flex justify-between items-center">
                  <span className={clsx('text-sm', getStatusColor(statusKey))}>
                    {getStatusLabel(statusKey)}
                  </span>
                  <span className="text-sm text-gray-300">{count}</span>
                </div>
              )
            ))}
          </div>
        </div>

        {/* Retell Status */}
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold">Retell Agents</h4>
            <button
              onClick={() => handleBulkMigration('retell')}
              disabled={migrating || status.retell.total === status.retell.migrated}
              className="text-sm px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded transition-colors"
            >
              Migrate Retell
            </button>
          </div>
          
          <div className="space-y-2">
            {Object.entries(status.retell.byStatus).map(([statusKey, count]) => (
              count > 0 && (
                <div key={statusKey} className="flex justify-between items-center">
                  <span className={clsx('text-sm', getStatusColor(statusKey))}>
                    {getStatusLabel(statusKey)}
                  </span>
                  <span className="text-sm text-gray-300">{count}</span>
                </div>
              )
            ))}
          </div>
        </div>
      </div>

      {/* Agents Needing Attention */}
      {status.invalidAgents.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FiAlertTriangle className="w-5 h-5 text-red-400" />
            Agents Needing Attention
          </h4>
          
          <div className="space-y-3">
            {status.invalidAgents.map((agent) => (
              <div key={`${agent.provider}-${agent.id}`} className="bg-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-white">{agent.name}</div>
                    <div className="text-sm text-gray-400">
                      {agent.provider.toUpperCase()} • {agent.id}
                    </div>
                    {agent.apiKeyErrorMessage && (
                      <div className="text-sm text-red-400 mt-1">
                        {agent.apiKeyErrorMessage}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {agent.apiKeyLastVerified && (
                      <>Last verified: {new Date(agent.apiKeyLastVerified).toLocaleDateString()}</>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
