'use client';

import React, { useState, useEffect } from 'react';
import { FiLink, FiPlus, FiTrash2, FiClock, FiLock, FiGlobe } from 'react-icons/fi';
import BaseConfigModal from './BaseConfigModal';

interface WebhookTriggerConfig {
  url: string;
  method: string;
  headers: Record<string, string>;
  authentication: string;
  timeout: number;
}

interface WebhookTriggerConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: WebhookTriggerConfig) => void;
  initialConfig?: Partial<WebhookTriggerConfig>;
}

export default function WebhookTriggerConfigModal({
  isOpen,
  onClose,
  onSave,
  initialConfig = {},
}: WebhookTriggerConfigModalProps) {
  const [config, setConfig] = useState<WebhookTriggerConfig>({
    url: '',
    method: 'POST',
    headers: {},
    authentication: 'none',
    timeout: 30000,
    ...initialConfig,
  });

  const [newHeaderKey, setNewHeaderKey] = useState('');
  const [newHeaderValue, setNewHeaderValue] = useState('');

  useEffect(() => {
    if (isOpen && initialConfig) {
      setConfig({
        url: '',
        method: 'POST',
        headers: {},
        authentication: 'none',
        timeout: 30000,
        ...initialConfig,
      });
    }
  }, [isOpen, initialConfig]);

  const handleSave = () => {
    onSave(config);
    onClose();
  };

  const handleReset = () => {
    setConfig({
      url: '',
      method: 'POST',
      headers: {},
      authentication: 'none',
      timeout: 30000,
    });
  };

  const addHeader = () => {
    if (newHeaderKey && newHeaderValue) {
      setConfig(prev => ({
        ...prev,
        headers: { ...prev.headers, [newHeaderKey]: newHeaderValue }
      }));
      setNewHeaderKey('');
      setNewHeaderValue('');
    }
  };

  const removeHeader = (key: string) => {
    setConfig(prev => {
      const { [key]: removed, ...rest } = prev.headers;
      return { ...prev, headers: rest };
    });
  };

  const canSave = config.url.trim().length > 0;

  return (
    <BaseConfigModal
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      title="Webhook Trigger Configuration"
      icon={<FiLink className="w-5 h-5 text-emerald-400" />}
      canSave={canSave}
      onReset={handleReset}
    >
      <div className="space-y-6">
        {/* Basic Settings */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-white flex items-center gap-2">
            <FiGlobe className="w-4 h-4 text-emerald-400" />
            Endpoint Configuration
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Webhook URL *
              </label>
              <input
                type="url"
                value={config.url}
                onChange={(e) => setConfig(prev => ({ ...prev, url: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="https://api.example.com/webhook"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                HTTP Method
              </label>
              <select
                value={config.method}
                onChange={(e) => setConfig(prev => ({ ...prev, method: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <FiClock className="w-4 h-4" />
                Timeout (ms)
              </label>
              <input
                type="number"
                value={config.timeout}
                onChange={(e) => setConfig(prev => ({ ...prev, timeout: parseInt(e.target.value) || 30000 }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                min="1000"
                max="300000"
                step="1000"
              />
            </div>
          </div>
        </div>

        {/* Authentication */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-white flex items-center gap-2">
            <FiLock className="w-4 h-4 text-amber-400" />
            Authentication
          </h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Authentication Type
            </label>
            <select
              value={config.authentication}
              onChange={(e) => setConfig(prev => ({ ...prev, authentication: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="none">None</option>
              <option value="bearer">Bearer Token</option>
              <option value="basic">Basic Auth</option>
              <option value="api-key">API Key</option>
            </select>
          </div>
        </div>

        {/* Headers */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-white">HTTP Headers</h3>
          
          {/* Existing Headers */}
          {Object.entries(config.headers).length > 0 && (
            <div className="space-y-2">
              {Object.entries(config.headers).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2 p-2 bg-gray-700 rounded-lg">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <span className="text-sm text-gray-300 font-medium">{key}</span>
                    <span className="text-sm text-white">{value}</span>
                  </div>
                  <button
                    onClick={() => removeHeader(key)}
                    className="p-1 text-red-400 hover:text-red-300 hover:bg-red-600/20 rounded transition-colors"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {/* Add New Header */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newHeaderKey}
              onChange={(e) => setNewHeaderKey(e.target.value)}
              className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Header name"
            />
            <input
              type="text"
              value={newHeaderValue}
              onChange={(e) => setNewHeaderValue(e.target.value)}
              className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Header value"
            />
            <button
              onClick={addHeader}
              disabled={!newHeaderKey || !newHeaderValue}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              <FiPlus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Configuration Preview */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-white">Configuration Preview</h3>
          <div className="p-3 bg-gray-900 rounded-lg border border-gray-600">
            <pre className="text-xs text-gray-300 whitespace-pre-wrap">
              {JSON.stringify(config, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </BaseConfigModal>
  );
}