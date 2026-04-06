'use client';

import { useState } from 'react';
import { FiX, FiPhone, FiExternalLink, FiInfo } from 'react-icons/fi';

interface WhatsAppConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (config: WhatsAppConfig) => void;
  isConnecting: boolean;
}

interface WhatsAppConfig {
  wabaId: string;
  phoneNumberId?: string;
  displayPhoneNumber?: string;
}

export default function WhatsAppConfigModal({ 
  isOpen, 
  onClose, 
  onConnect, 
  isConnecting 
}: WhatsAppConfigModalProps) {
  const [config, setConfig] = useState<WhatsAppConfig>({
    wabaId: '',
    phoneNumberId: '',
    displayPhoneNumber: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const validateConfig = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!config.wabaId.trim()) {
      newErrors.wabaId = 'WhatsApp Business Account ID is required';
    } else if (!/^\d+$/.test(config.wabaId.trim())) {
      newErrors.wabaId = 'WABA ID must contain only numbers';
    }

    if (config.phoneNumberId && !/^\d+$/.test(config.phoneNumberId.trim())) {
      newErrors.phoneNumberId = 'Phone Number ID must contain only numbers';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleConnect = () => {
    if (validateConfig()) {
      onConnect({
        wabaId: config.wabaId.trim(),
        phoneNumberId: config.phoneNumberId?.trim() || undefined,
        displayPhoneNumber: config.displayPhoneNumber?.trim() || undefined
      });
    }
  };

  const handleInputChange = (field: keyof WhatsAppConfig, value: string) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#25D366]/20 border border-[#25D366]/30 flex items-center justify-center">
              <FiPhone className="w-5 h-5 text-[#25D366]" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Connect WhatsApp Business</h2>
              <p className="text-sm text-gray-400">Configure your WhatsApp Business Account</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isConnecting}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
          >
            <FiX className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Info Section */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <FiInfo className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="text-blue-300 font-medium mb-2">Before you continue:</p>
                <ul className="text-blue-200 space-y-1 list-disc list-inside">
                  <li>You need a verified WhatsApp Business Account</li>
                  <li>Your account must be approved for the WhatsApp Business API</li>
                  <li>You'll need your WABA ID from the Meta Business Manager</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Setup Instructions */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white">How to find your WABA ID:</h3>
            <div className="space-y-3 text-sm text-gray-300">
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-[#25D366] text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                <div>
                  <p className="font-medium">Go to Meta Business Manager</p>
                  <p className="text-gray-400">Visit business.facebook.com and log in to your account</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-[#25D366] text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                <div>
                  <p className="font-medium">Navigate to WhatsApp Accounts</p>
                  <p className="text-gray-400">Click on "WhatsApp Accounts" in the left sidebar</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-[#25D366] text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                <div>
                  <p className="font-medium">Copy your WABA ID</p>
                  <p className="text-gray-400">Find your WhatsApp Business Account and copy the ID (usually a long number)</p>
                </div>
              </div>
            </div>
            
            <a
              href="https://business.facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[#25D366] hover:text-[#25D366]/80 transition-colors text-sm"
            >
              Open Meta Business Manager
              <FiExternalLink className="w-4 h-4" />
            </a>
          </div>

          {/* Configuration Form */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white">Configuration</h3>
            
            {/* WABA ID - Required */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                WhatsApp Business Account ID (WABA ID) *
              </label>
              <input
                type="text"
                value={config.wabaId}
                onChange={(e) => handleInputChange('wabaId', e.target.value)}
                placeholder="e.g., 123456789012345"
                className={`w-full px-4 py-3 bg-gray-800 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors ${
                  errors.wabaId 
                    ? 'border-red-500 focus:ring-red-500/20' 
                    : 'border-gray-600 focus:border-[#25D366] focus:ring-[#25D366]/20'
                }`}
                disabled={isConnecting}
              />
              {errors.wabaId && (
                <p className="mt-2 text-sm text-red-400">{errors.wabaId}</p>
              )}
            </div>

            {/* Phone Number ID - Optional */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Phone Number ID (Optional)
              </label>
              <input
                type="text"
                value={config.phoneNumberId}
                onChange={(e) => handleInputChange('phoneNumberId', e.target.value)}
                placeholder="e.g., 987654321098765"
                className={`w-full px-4 py-3 bg-gray-800 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors ${
                  errors.phoneNumberId 
                    ? 'border-red-500 focus:ring-red-500/20' 
                    : 'border-gray-600 focus:border-[#25D366] focus:ring-[#25D366]/20'
                }`}
                disabled={isConnecting}
              />
              {errors.phoneNumberId && (
                <p className="mt-2 text-sm text-red-400">{errors.phoneNumberId}</p>
              )}
              <p className="mt-2 text-xs text-gray-500">
                If you have multiple phone numbers, specify which one to use
              </p>
            </div>

            {/* Display Phone Number - Optional */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Display Phone Number (Optional)
              </label>
              <input
                type="text"
                value={config.displayPhoneNumber}
                onChange={(e) => handleInputChange('displayPhoneNumber', e.target.value)}
                placeholder="e.g., +1 (555) 123-4567"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:border-[#25D366] focus:ring-[#25D366]/20 transition-colors"
                disabled={isConnecting}
              />
              <p className="mt-2 text-xs text-gray-500">
                Human-readable phone number for display purposes
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-700">
          <button
            onClick={onClose}
            disabled={isConnecting}
            className="px-6 py-2.5 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConnect}
            disabled={isConnecting || !config.wabaId.trim()}
            className="px-6 py-2.5 bg-[#25D366] hover:bg-[#25D366]/90 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isConnecting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Connecting...
              </>
            ) : (
              'Connect WhatsApp'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
