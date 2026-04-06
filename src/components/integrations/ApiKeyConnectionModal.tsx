'use client';

import React, { useState } from 'react';
import { FiX, FiLoader, FiCheck, FiAlertCircle, FiEye, FiEyeOff } from 'react-icons/fi';
import { usePartnerBranding } from '@/lib/partnerBranding';

interface Tool {
  id: string;
  name: string;
  displayName: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  category: string;
  provider: string;
  authMethod?: string; // Optional to match main Tool interface
}

interface ApiKeyConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  tool: Tool | null;
  onConnectionSuccess: () => void;
}

const ApiKeyConnectionModal: React.FC<ApiKeyConnectionModalProps> = ({
  isOpen,
  onClose,
  tool,
  onConnectionSuccess,
}) => {
  const { branding } = usePartnerBranding();
  const { primaryColor } = branding;
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const getApiKeyPlaceholder = (toolName: string) => {
    switch (toolName?.toLowerCase()) {
      case 'firecrawl':
        return 'fc-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      case 'shopify':
        return 'shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      default:
        return 'Enter your API key';
    }
  };

  const getApiKeyInstructions = (toolName: string) => {
    switch (toolName?.toLowerCase()) {
      case 'firecrawl':
        return 'You can find your Firecrawl API key in your Firecrawl dashboard under API Keys section.';
      case 'shopify':
        return 'You can find your Shopify API key in your Shopify admin under Apps > Private apps.';
      default:
        return 'Please enter your API key for this service.';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() || !tool) return;

    setIsConnecting(true);
    setError('');

    try {
      const response = await fetch('/api/whitelabel/integrations/apps/connect-apikey', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appName: tool.name,
          apiKey: apiKey.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect');
      }

      setSuccess(true);
      setTimeout(() => {
        onConnectionSuccess();
        handleClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleClose = () => {
    setApiKey('');
    setShowApiKey(false);
    setError('');
    setSuccess(false);
    setIsConnecting(false);
    onClose();
  };

  if (!isOpen || !tool) return null;

  const IconComponent = tool.icon;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-800/95 to-gray-900/95 backdrop-blur-sm rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-gray-700/50">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700/50">
          <div className="flex items-center space-x-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center border"
              style={{ backgroundColor: `${tool.color}20`, borderColor: `${tool.color}30` }}
            >
              <IconComponent
                className="w-5 h-5"
                style={{ color: tool.color }}
              />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                Connect {tool.displayName}
              </h3>
              <p className="text-sm text-gray-400">{tool.description}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-300 transition-colors p-1 rounded-lg hover:bg-gray-700/50"
            disabled={isConnecting}
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {success ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-500/20 border border-green-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiCheck className="w-8 h-8 text-green-400" />
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">
                Successfully Connected!
              </h4>
              <p className="text-gray-300">
                {tool.displayName} has been connected to your account.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="apiKey" className="block text-sm font-medium text-white mb-2">
                  API Key
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    id="apiKey"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={getApiKeyPlaceholder(tool.name)}
                    className="w-full px-3 py-2 pr-10 bg-gray-900/60 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent backdrop-blur-sm"
                    style={{
                      focusRingColor: primaryColor,
                      '--tw-ring-color': primaryColor
                    } as any}
                    required
                    disabled={isConnecting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-300 transition-colors"
                    disabled={isConnecting}
                  >
                    {showApiKey ? (
                      <FiEyeOff className="w-4 h-4" />
                    ) : (
                      <FiEye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="mt-2 text-sm text-gray-400">
                  {getApiKeyInstructions(tool.name)}
                </p>
              </div>

              {error && (
                <div className="flex items-center space-x-2 text-red-300 bg-red-500/10 border border-red-500/30 p-3 rounded-lg">
                  <FiAlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-4 py-2 text-gray-300 bg-gray-700/50 hover:bg-gray-600/50 border border-gray-600/50 rounded-lg transition-colors"
                  disabled={isConnecting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!apiKey.trim() || isConnecting}
                  className="flex-1 px-4 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-2 hover:scale-105"
                  style={{
                    backgroundColor: primaryColor,
                    boxShadow: `0 4px 20px ${primaryColor}30`
                  }}
                >
                  {isConnecting ? (
                    <>
                      <FiLoader className="w-4 h-4 animate-spin" />
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <span>Connect</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApiKeyConnectionModal;
