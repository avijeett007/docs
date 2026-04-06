'use client';

import React, { useState, useEffect } from 'react';
import { FiCopy, FiPlay, FiPause, FiRefreshCw, FiTrash2, FiEye, FiDownload, FiSettings } from 'react-icons/fi';
import { WebhookManager, WebhookEndpoint } from '@/lib/workflow/webhookManager';
import { toast } from 'react-hot-toast';

interface WebhookPanelProps {
  workflowId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function WebhookPanel({ workflowId, isOpen, onClose }: WebhookPanelProps) {
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookEndpoint | null>(null);
  const [testPayload, setTestPayload] = useState('{\n  "test": true,\n  "timestamp": "' + new Date().toISOString() + '"\n}');
  const [testResult, setTestResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadWebhooks();
    }
  }, [isOpen, workflowId]);

  const loadWebhooks = () => {
    const workflowWebhooks = WebhookManager.getWebhooksByWorkflow(workflowId);
    setWebhooks(workflowWebhooks);
    
    // Auto-generate webhooks if none exist
    if (workflowWebhooks.length === 0) {
      generateDefaultWebhooks();
    }
  };

  const generateDefaultWebhooks = () => {
    const testWebhook = WebhookManager.generateWebhookUrl(workflowId, 'test');
    const prodWebhook = WebhookManager.generateWebhookUrl(workflowId, 'production');
    setWebhooks([testWebhook, prodWebhook]);
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${type} copied to clipboard`);
  };

  const toggleWebhookStatus = (webhookId: string, isActive: boolean) => {
    WebhookManager.updateWebhookStatus(webhookId, !isActive);
    loadWebhooks();
    toast.success(`Webhook ${!isActive ? 'activated' : 'deactivated'}`);
  };

  const regenerateWebhook = (webhookId: string) => {
    const updated = WebhookManager.regenerateWebhookUrl(webhookId);
    if (updated) {
      loadWebhooks();
      toast.success('Webhook URL regenerated');
    }
  };

  const deleteWebhook = (webhookId: string) => {
    if (confirm('Are you sure you want to delete this webhook?')) {
      WebhookManager.deleteWebhook(webhookId);
      loadWebhooks();
      toast.success('Webhook deleted');
    }
  };

  const testWebhook = async (webhookId: string) => {
    setIsLoading(true);
    setTestResult(null);
    
    try {
      const payload = JSON.parse(testPayload);
      const result = await WebhookManager.testWebhook(webhookId, payload);
      setTestResult(result);
      
      if (result.success) {
        toast.success('Webhook test successful');
      } else {
        toast.error('Webhook test failed');
      }
    } catch (error) {
      toast.error('Invalid JSON payload');
      setTestResult({
        success: false,
        statusCode: 400,
        response: { error: 'Invalid JSON payload' },
        processingTime: 0
      });
    } finally {
      setIsLoading(false);
    }
  };

  const exportLogs = (webhookId: string) => {
    const logs = WebhookManager.exportWebhookLogs(webhookId);
    if (logs) {
      const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `webhook-logs-${webhookId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Logs exported');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-white">Webhook Management</h2>
            <p className="text-sm text-gray-400">Manage webhook endpoints for workflow execution</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex h-[600px]">
          {/* Webhook List */}
          <div className="w-1/2 border-r border-gray-700 p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-white">Webhooks</h3>
              <button
                onClick={generateDefaultWebhooks}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm transition-colors"
              >
                + Add Webhook
              </button>
            </div>

            <div className="space-y-4">
              {webhooks.map((webhook) => {
                const stats = WebhookManager.getWebhookStats(webhook.id);
                return (
                  <div
                    key={webhook.id}
                    onClick={() => setSelectedWebhook(webhook)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedWebhook?.id === webhook.id
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          webhook.environment === 'production'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-yellow-500/20 text-amber-400'
                        }`}>
                          {webhook.environment}
                        </span>
                        <span className={`w-2 h-2 rounded-full ${
                          webhook.isActive ? 'bg-green-400' : 'bg-gray-400'
                        }`}></span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(webhook.url, 'Webhook URL');
                          }}
                          className="p-1 hover:bg-gray-600 rounded transition-colors"
                        >
                          <FiCopy className="w-3 h-3 text-gray-400" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleWebhookStatus(webhook.id, webhook.isActive);
                          }}
                          className="p-1 hover:bg-gray-600 rounded transition-colors"
                        >
                          {webhook.isActive ? (
                            <FiPause className="w-3 h-3 text-gray-400" />
                          ) : (
                            <FiPlay className="w-3 h-3 text-gray-400" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="text-xs text-gray-400 mb-2 font-mono truncate">
                      {webhook.url}
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Triggers: {stats.totalRequests}</span>
                      <span>Success: {stats.successfulRequests}</span>
                      <span>Failed: {stats.failedRequests}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Webhook Details */}
          <div className="w-1/2 p-6 overflow-y-auto">
            {selectedWebhook ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-white mb-4">Webhook Details</h3>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">URL</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={selectedWebhook.url}
                          readOnly
                          className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm font-mono"
                        />
                        <button
                          onClick={() => copyToClipboard(selectedWebhook.url, 'URL')}
                          className="p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                        >
                          <FiCopy className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Secret Key</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="password"
                          value={selectedWebhook.secretKey || ''}
                          readOnly
                          className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm font-mono"
                        />
                        <button
                          onClick={() => copyToClipboard(selectedWebhook.secretKey || '', 'Secret Key')}
                          className="p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                        >
                          <FiCopy className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Environment</label>
                        <div className={`px-3 py-2 rounded text-sm ${
                          selectedWebhook.environment === 'production'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-yellow-500/20 text-amber-400'
                        }`}>
                          {selectedWebhook.environment}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                        <div className={`px-3 py-2 rounded text-sm ${
                          selectedWebhook.isActive
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {selectedWebhook.isActive ? 'Active' : 'Inactive'}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Created</label>
                      <div className="px-3 py-2 bg-gray-700 rounded text-white text-sm">
                        {formatDate(selectedWebhook.createdAt)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-4">
                    <button
                      onClick={() => regenerateWebhook(selectedWebhook.id)}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm transition-colors"
                    >
                      <FiRefreshCw className="w-4 h-4" />
                      Regenerate
                    </button>
                    <button
                      onClick={() => exportLogs(selectedWebhook.id)}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm transition-colors"
                    >
                      <FiDownload className="w-4 h-4" />
                      Export Logs
                    </button>
                    <button
                      onClick={() => deleteWebhook(selectedWebhook.id)}
                      className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-white text-sm transition-colors"
                    >
                      <FiTrash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>

                {/* Test Section */}
                <div>
                  <h4 className="text-md font-medium text-white mb-3">Test Webhook</h4>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Test Payload</label>
                      <textarea
                        value={testPayload}
                        onChange={(e) => setTestPayload(e.target.value)}
                        rows={6}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm font-mono"
                        placeholder="Enter JSON payload..."
                      />
                    </div>

                    <button
                      onClick={() => testWebhook(selectedWebhook.id)}
                      disabled={isLoading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-white transition-colors"
                    >
                      <FiPlay className="w-4 h-4" />
                      {isLoading ? 'Testing...' : 'Test Webhook'}
                    </button>

                    {testResult && (
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-300 mb-1">Test Result</label>
                        <div className={`p-3 rounded border ${
                          testResult.success
                            ? 'border-green-500/50 bg-green-500/10'
                            : 'border-red-500/50 bg-red-500/10'
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-sm font-medium ${
                              testResult.success ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {testResult.success ? 'Success' : 'Failed'}
                            </span>
                            <span className="text-xs text-gray-400">
                              {testResult.processingTime}ms
                            </span>
                          </div>
                          <pre className="text-xs text-gray-300 overflow-auto max-h-32">
                            {JSON.stringify(testResult.response, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <FiSettings className="w-12 h-12 mx-auto mb-4" />
                  <p>Select a webhook to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
