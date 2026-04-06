'use client';

import React, { useState, useEffect } from 'react';
import { FiDatabase, FiDownload, FiTrash2, FiRefreshCw, FiEye, FiEyeOff } from 'react-icons/fi';
import { BrowserStorageManager } from '@/lib/workflow/browserStorage';

export default function StorageDebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState({ workflowCount: 0, agentConfigCount: 0, totalSize: '0 KB' });
  const [data, setData] = useState<any>(null);

  const refreshData = () => {
    const newStats = BrowserStorageManager.getStorageStats();
    const exportedData = BrowserStorageManager.exportData();
    setStats(newStats);
    setData(exportedData);
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleExport = () => {
    const exportedData = BrowserStorageManager.exportData();
    const blob = new Blob([JSON.stringify(exportedData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `knotie-workflow-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClearAll = () => {
    if (confirm('Are you sure you want to clear all stored workflow and agent data? This cannot be undone.')) {
      BrowserStorageManager.clearAllData();
      refreshData();
      alert('All data cleared successfully!');
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white text-sm shadow-lg transition-all"
      >
        <FiDatabase className="w-4 h-4" />
        Storage Debug
        {isOpen ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
      </button>

      {/* Debug Panel */}
      {isOpen && (
        <div className="absolute bottom-12 right-0 w-96 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-4 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-white">Browser Storage Debug</h3>
            <button
              onClick={refreshData}
              className="p-1 text-gray-400 hover:text-white"
            >
              <FiRefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded p-2 text-center">
              <div className="text-lg font-bold text-blue-400">{stats.workflowCount}</div>
              <div className="text-xs text-gray-400">Workflows</div>
            </div>
            <div className="bg-green-500/10 border border-green-500/20 rounded p-2 text-center">
              <div className="text-lg font-bold text-green-400">{stats.agentConfigCount}</div>
              <div className="text-xs text-gray-400">Agents</div>
            </div>
            <div className="bg-purple-500/10 border border-purple-500/20 rounded p-2 text-center">
              <div className="text-lg font-bold text-purple-400">{stats.totalSize}</div>
              <div className="text-xs text-gray-400">Size</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={handleExport}
              className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm"
            >
              <FiDownload className="w-3 h-3" />
              Export
            </button>
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1 px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-sm"
            >
              <FiTrash2 className="w-3 h-3" />
              Clear All
            </button>
          </div>

          {/* Data Preview */}
          {data && (
            <div className="space-y-3">
              {data.workflows.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Recent Workflows</h4>
                  <div className="space-y-1">
                    {data.workflows.slice(-3).map((workflow: any) => (
                      <div key={workflow.workflow_uuid} className="bg-gray-800 rounded p-2">
                        <div className="text-xs text-white font-medium">{workflow.name}</div>
                        <div className="text-xs text-gray-400">
                          Customer: {workflow.customer_id} | UUID: {workflow.workflow_uuid.slice(-8)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(workflow.updated_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.agentConfigs.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Recent Agent Configs</h4>
                  <div className="space-y-1">
                    {data.agentConfigs.slice(-3).map((agent: any) => (
                      <div key={agent.agent_uuid} className="bg-gray-800 rounded p-2">
                        <div className="text-xs text-white font-medium">{agent.agentName || 'Unnamed Agent'}</div>
                        <div className="text-xs text-gray-400">
                          {agent.communicationChannel} | {agent.agentType}
                        </div>
                        <div className="text-xs text-gray-500">
                          UUID: {agent.agent_uuid.slice(-8)} | {new Date(agent.updated_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
