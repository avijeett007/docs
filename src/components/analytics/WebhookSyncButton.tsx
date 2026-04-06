'use client';

import React, { useState, useEffect } from 'react';
import { FiRefreshCw, FiCheck, FiX, FiClock, FiAlertCircle } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';

interface WebhookSyncButtonProps {
  agentId: string;
  agentName: string;
  provider: 'retell' | 'retell_chat' | 'vapi' | 'elevenlabs' | 'ultravox';
  className?: string;
  showStatus?: boolean;
  onSyncComplete?: (result: any) => void;
}

interface SyncStatus {
  last_sync_date?: string;
  sync_status?: 'never_synced' | 'completed' | 'failed' | 'in_progress';
  sync_in_progress?: boolean;
  missed_calls_found?: number;
  missed_calls_processed?: number;
  last_sync_error?: string;
}

export const WebhookSyncButton: React.FC<WebhookSyncButtonProps> = ({
  agentId,
  agentName,
  provider,
  className = '',
  showStatus = false,
  onSyncComplete
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  // Fetch sync status
  const fetchSyncStatus = async () => {
    try {
      setStatusLoading(true);
      const response = await fetch(`/api/partner/webhook-sync/agent/${agentId}/status`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('partnerJwt')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSyncStatus(data);
      }
    } catch (error) {
      console.error('Error fetching sync status:', error);
    } finally {
      setStatusLoading(false);
    }
  };

  // Load sync status on mount if showStatus is true
  useEffect(() => {
    if (showStatus) {
      fetchSyncStatus();
    }
  }, [agentId, showStatus]);

  // Handle sync request
  const handleSync = async () => {
    try {
      setIsLoading(true);
      
      const response = await fetch(`/api/partner/webhook-sync/agent/${agentId}/sync?days_back=1`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('partnerJwt')}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`Analytics sync requested for ${agentName}. Processing will begin shortly.`);
        
        // Update sync status to show in progress
        setSyncStatus(prev => ({
          ...prev,
          sync_in_progress: true,
          sync_status: 'in_progress'
        }));

        // Poll for completion
        pollSyncStatus();
        
        if (onSyncComplete) {
          onSyncComplete(result);
        }
      } else {
        toast.error(result.message || 'Failed to request sync');
      }
    } catch (error) {
      console.error('Error requesting sync:', error);
      toast.error('Failed to request analytics sync');
    } finally {
      setIsLoading(false);
    }
  };

  // Poll sync status until completion
  const pollSyncStatus = async () => {
    const maxAttempts = 30; // 5 minutes max
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch(`/api/partner/webhook-sync/agent/${agentId}/status`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('partnerJwt')}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setSyncStatus(data);

          if (!data.sync_in_progress && attempts < maxAttempts) {
            if (data.sync_status === 'completed') {
              const missedCalls = data.missed_calls_found || 0;
              const processedCalls = data.missed_calls_processed || 0;
              
              if (missedCalls > 0) {
                toast.success(`✅ Sync completed! Found and processed ${processedCalls} missed calls.`);
              } else {
                toast.success('✅ Sync completed! No missed calls found.');
              }
            } else if (data.sync_status === 'failed') {
              toast.error(`❌ Sync failed: ${data.last_sync_error || 'Unknown error'}`);
            }
            return;
          }
        }

        attempts++;
        if (attempts < maxAttempts && syncStatus?.sync_in_progress) {
          setTimeout(poll, 10000); // Poll every 10 seconds
        }
      } catch (error) {
        console.error('Error polling sync status:', error);
      }
    };

    setTimeout(poll, 5000); // Start polling after 5 seconds
  };

  const getSyncStatusIcon = () => {
    if (statusLoading) return <FiClock className="w-4 h-4 animate-pulse" />;
    
    switch (syncStatus?.sync_status) {
      case 'completed':
        return <FiCheck className="w-4 h-4 text-green-400" />;
      case 'failed':
        return <FiX className="w-4 h-4 text-red-400" />;
      case 'in_progress':
        return <FiRefreshCw className="w-4 h-4 animate-spin text-blue-400" />;
      case 'never_synced':
      default:
        return <FiAlertCircle className="w-4 h-4 text-yellow-400" />;
    }
  };

  const getSyncStatusText = () => {
    if (statusLoading) return 'Loading...';
    
    if (!syncStatus) return 'Never synced';
    
    switch (syncStatus.sync_status) {
      case 'completed':
        const lastSync = syncStatus.last_sync_date 
          ? new Date(syncStatus.last_sync_date).toLocaleDateString()
          : 'Unknown';
        return `Last synced: ${lastSync}`;
      case 'failed':
        return `Failed: ${syncStatus.last_sync_error || 'Unknown error'}`;
      case 'in_progress':
        return 'Syncing...';
      case 'never_synced':
      default:
        return 'Never synced';
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleSync}
        disabled={isLoading || syncStatus?.sync_in_progress}
        className={clsx(
          'flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md transition-colors',
          'hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed',
          className
        )}
      >
        {isLoading || syncStatus?.sync_in_progress ? (
          <FiRefreshCw className="w-4 h-4 animate-spin" />
        ) : (
          <FiRefreshCw className="w-4 h-4" />
        )}
        <span>
          {isLoading || syncStatus?.sync_in_progress ? 'Syncing...' : 'Sync Analytics'}
        </span>
      </button>
      
      {showStatus && (
        <div className="flex items-center gap-2 px-3 py-1 text-xs text-gray-400">
          {getSyncStatusIcon()}
          <span>{getSyncStatusText()}</span>
        </div>
      )}
    </div>
  );
};
