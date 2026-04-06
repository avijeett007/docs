'use client';

import React, { useState, useEffect } from 'react';
import { 
  FiX, 
  FiServer, 
  FiCheck, 
  FiAlertCircle,
  FiEye,
  FiEyeOff,
  FiRefreshCw
} from 'react-icons/fi';

interface N8nInstance {
  id: string;
  name: string;
  baseUrl: string;
  description: string | null;
  isActive: boolean;
  connectionStatus: string;
  connectionError: string | null;
  n8nVersion: string | null;
}

interface N8nInstanceModalProps {
  instance?: N8nInstance | null;
  onClose: () => void;
  onSuccess: () => void;
}

const N8nInstanceModal: React.FC<N8nInstanceModalProps> = ({
  instance,
  onClose,
  onSuccess
}) => {
  const [formData, setFormData] = useState({
    name: '',
    baseUrl: '',
    apiKey: '',
    description: '',
    isActive: true,
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    version?: string;
  } | null>(null);

  // Initialize form data
  useEffect(() => {
    if (instance) {
      setFormData({
        name: instance.name,
        baseUrl: instance.baseUrl,
        apiKey: '', // Don't pre-fill API key for security
        description: instance.description || '',
        isActive: instance.isActive,
      });
    }
  }, [instance]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
    setError(null);
    setTestResult(null);
  };

  const testConnection = async () => {
    if (!formData.baseUrl || !formData.apiKey) {
      setError('Base URL and API Key are required for testing');
      return;
    }

    setTesting(true);
    setTestResult(null);
    setError(null);

    try {
      const token = localStorage.getItem('partner_token');
      const response = await fetch('/api/partner/n8n-instances/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          baseUrl: formData.baseUrl,
          apiKey: formData.apiKey,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setTestResult({
          success: true,
          message: 'Connection successful!',
          version: data.data?.version,
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Connection failed',
        });
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      setTestResult({
        success: false,
        message: 'Connection test failed. Please check your configuration.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.baseUrl || !formData.apiKey) {
      setError('Name, Base URL, and API Key are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('partner_token');
      const url = instance 
        ? `/api/partner/n8n-instances/${instance.id}`
        : '/api/partner/n8n-instances';
      
      const method = instance ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        onSuccess();
      } else {
        setError(data.error || 'Failed to save instance');
      }
    } catch (error) {
      console.error('Failed to save instance:', error);
      setError('Failed to save instance. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <FiServer className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-bold text-white">
              {instance ? 'Edit N8N Instance' : 'Add N8N Instance'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <FiX className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Instance Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="My N8N Instance"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Base URL */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Base URL *
            </label>
            <input
              type="url"
              name="baseUrl"
              value={formData.baseUrl}
              onChange={handleInputChange}
              placeholder="https://your-n8n-instance.com"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              The base URL of your N8N instance (without /api/v1)
            </p>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              API Key *
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                name="apiKey"
                value={formData.apiKey}
                onChange={handleInputChange}
                placeholder={instance ? 'Enter new API key (leave blank to keep current)' : 'n8n_api_key_here'}
                className="w-full px-3 py-2 pr-10 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required={!instance}
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showApiKey ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Your N8N API key (requires paid plan or self-hosted with API enabled)
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Optional description for this instance"
              rows={3}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Active Status */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              name="isActive"
              checked={formData.isActive}
              onChange={handleInputChange}
              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
            />
            <label className="text-sm font-medium text-gray-300">
              Active (available for workflow deployments)
            </label>
          </div>

          {/* Test Connection */}
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-white">Connection Test</h3>
              <button
                type="button"
                onClick={testConnection}
                disabled={testing || !formData.baseUrl || !formData.apiKey}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
              >
                <FiRefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
            </div>

            {testResult && (
              <div className={`flex items-center gap-2 p-3 rounded-lg ${
                testResult.success 
                  ? 'bg-green-900/20 border border-green-500' 
                  : 'bg-red-900/20 border border-red-500'
              }`}>
                {testResult.success ? (
                  <FiCheck className="w-4 h-4 text-green-400 flex-shrink-0" />
                ) : (
                  <FiAlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                )}
                <div>
                  <p className={`text-sm ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                    {testResult.message}
                  </p>
                  {testResult.version && (
                    <p className="text-xs text-gray-400 mt-1">
                      N8N Version: {testResult.version}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 flex items-center gap-3">
              <FiAlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {instance ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>
                  <FiCheck className="w-4 h-4" />
                  {instance ? 'Update Instance' : 'Create Instance'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default N8nInstanceModal;
