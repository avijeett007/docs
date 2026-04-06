'use client';

import React, { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { FiX, FiSave, FiLoader, FiEye, FiEyeOff, FiCheck, FiAlertTriangle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface ApiKeyManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentName: string;
  provider: 'vapi' | 'retell' | 'ultravox' | 'elevenlabs';
  currentStatus?: string;
  onApiKeyUpdated?: () => void;
}

export default function ApiKeyManagementModal({
  isOpen,
  onClose,
  agentId,
  agentName,
  provider,
  currentStatus = 'not_set',
  onApiKeyUpdated
}: ApiKeyManagementModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    message: string;
  } | null>(null);

  const handleClose = () => {
    setApiKey('');
    setShowApiKey(false);
    setValidationResult(null);
    onClose();
  };

  const validateApiKey = async () => {
    if (!apiKey.trim()) {
      setValidationResult({
        isValid: false,
        message: 'Please enter an API key'
      });
      return;
    }

    setIsValidating(true);
    setValidationResult(null);

    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      // Test the API key by making a simple API call
      const testEndpoint = provider === 'vapi'
        ? 'https://api.vapi.ai/assistant'
        : provider === 'retell'
        ? 'https://api.retellai.com/list-agents'
        : provider === 'elevenlabs'
        ? 'https://api.elevenlabs.io/v1/user'
        : 'https://api.ultravox.ai/api/agents';

      const response = await fetch('/api/partner/agents/validate-api-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          provider,
          testEndpoint,
          agentId: provider === 'elevenlabs' ? agentId : undefined
        })
      });

      const result = await response.json();

      if (response.ok && result.valid) {
        setValidationResult({
          isValid: true,
          message: 'API key is valid and working!'
        });
      } else {
        setValidationResult({
          isValid: false,
          message: result.error || 'API key validation failed'
        });
      }
    } catch (error) {
      console.error('Error validating API key:', error);
      setValidationResult({
        isValid: false,
        message: 'Failed to validate API key. Please try again.'
      });
    } finally {
      setIsValidating(false);
    }
  };

  const saveApiKey = async () => {
    if (!apiKey.trim()) {
      toast.error('Please enter an API key');
      return;
    }

    setIsLoading(true);

    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const endpoint = provider === 'vapi'
        ? `/api/partner/vapi-agents/${agentId}/api-key`
        : provider === 'retell'
        ? `/api/partner/retell-agents/${agentId}/api-key`
        : provider === 'elevenlabs'
        ? `/api/partner/elevenlabs-agents/${agentId}/api-key`
        : `/api/partner/ultravox-agents/${agentId}/api-key`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          apiKey: apiKey.trim()
        })
      });

      if (response.ok) {
        toast.success('API key updated successfully!');
        if (onApiKeyUpdated) {
          onApiKeyUpdated();
        }
        handleClose();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update API key');
      }
    } catch (error) {
      console.error('Error saving API key:', error);
      toast.error('Failed to update API key');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'valid': return 'text-green-400';
      case 'invalid': return 'text-red-400';
      case 'expired': return 'text-orange-400';
      case 'not_set': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'valid': return <FiCheck className="w-4 h-4" />;
      case 'invalid': 
      case 'expired': return <FiAlertTriangle className="w-4 h-4" />;
      default: return null;
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md bg-gray-900 rounded-xl shadow-xl border border-gray-800 p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <Dialog.Title className="text-lg font-semibold text-white">
                      Manage API Key
                    </Dialog.Title>
                    <p className="text-sm text-gray-400 mt-1">
                      {agentName} ({provider.toUpperCase()})
                    </p>
                  </div>
                  <button
                    onClick={handleClose}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <FiX className="w-5 h-5" />
                  </button>
                </div>

                {/* Current Status */}
                <div className="mb-6 p-3 bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-gray-300">Current Status:</span>
                    <div className={clsx('flex items-center gap-1', getStatusColor(currentStatus))}>
                      {getStatusIcon(currentStatus)}
                      <span className="text-sm capitalize">{currentStatus.replace('_', ' ')}</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    {currentStatus === 'not_set' && 'This agent is using the partner-level API key as fallback.'}
                    {currentStatus === 'valid' && 'This agent has a valid individual API key.'}
                    {currentStatus === 'invalid' && 'This agent\'s API key is invalid or expired.'}
                  </p>
                </div>

                {/* API Key Input */}
                <div className="mb-4">
                  <label htmlFor="apiKey" className="block text-sm font-medium text-gray-300 mb-2">
                    {provider.toUpperCase()} API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      id="apiKey"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={`Enter your ${provider.toUpperCase()} API key...`}
                      className="w-full px-3 py-2 pr-10 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      {showApiKey ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Validation Result */}
                {validationResult && (
                  <div className={clsx(
                    'mb-4 p-3 rounded-lg border',
                    validationResult.isValid 
                      ? 'bg-green-500/10 border-green-500 text-green-400'
                      : 'bg-red-500/10 border-red-500 text-red-400'
                  )}>
                    <div className="flex items-center gap-2">
                      {validationResult.isValid ? (
                        <FiCheck className="w-4 h-4" />
                      ) : (
                        <FiAlertTriangle className="w-4 h-4" />
                      )}
                      <span className="text-sm">{validationResult.message}</span>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={validateApiKey}
                    disabled={isValidating || !apiKey.trim()}
                    className={clsx(
                      'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors',
                      isValidating || !apiKey.trim()
                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-500 text-white'
                    )}
                  >
                    {isValidating ? (
                      <>
                        <FiLoader className="w-4 h-4 animate-spin" />
                        Validating...
                      </>
                    ) : (
                      'Validate Key'
                    )}
                  </button>

                  <button
                    onClick={saveApiKey}
                    disabled={isLoading || !apiKey.trim()}
                    className={clsx(
                      'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors',
                      isLoading || !apiKey.trim()
                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-500 text-white'
                    )}
                  >
                    {isLoading ? (
                      <>
                        <FiLoader className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <FiSave className="w-4 h-4" />
                        Save Key
                      </>
                    )}
                  </button>
                </div>

                {/* Help Text */}
                <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
                  <p className="text-xs text-gray-400">
                    <strong>Note:</strong> Setting an individual API key for this agent will override the partner-level fallback. 
                    This allows for better security, usage tracking, and cost allocation per agent.
                  </p>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
