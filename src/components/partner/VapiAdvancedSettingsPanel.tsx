'use client';

import React, { useState } from 'react';
import { FiEye, FiEyeOff, FiInfo } from 'react-icons/fi';

interface VapiAdvancedSettingsPanelProps {
  register: any;
  errors: any;
  watch: any;
  setValue: any;
}

const VapiAdvancedSettingsPanel: React.FC<VapiAdvancedSettingsPanelProps> = ({
  register,
  errors,
  watch,
  setValue
}) => {
  const [showApiKey, setShowApiKey] = useState(false);

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-700 pb-4">
        <h3 className="text-lg font-semibold text-white mb-2">Advanced Settings</h3>
        <p className="text-gray-400 text-sm">
          Configure advanced parameters, call settings, and API keys for your VAPI agent.
        </p>
      </div>

      {/* Advanced Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Max Tokens
          </label>
          <input
            {...register('maxTokens', { valueAsNumber: true })}
            type="number"
            min="1"
            max="4000"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
            placeholder="500"
          />
          <p className="text-gray-500 text-xs mt-1">Maximum tokens per response</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Silence Timeout (seconds)
          </label>
          <input
            {...register('silenceTimeoutSeconds', { valueAsNumber: true })}
            type="number"
            min="10"
            max="3600"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
            placeholder="30"
          />
          <p className="text-gray-500 text-xs mt-1">Seconds before ending call due to silence</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Max Duration (seconds)
          </label>
          <input
            {...register('maxDurationSeconds', { valueAsNumber: true })}
            type="number"
            min="10"
            max="43200"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
            placeholder="600"
          />
          <p className="text-gray-500 text-xs mt-1">Maximum call duration (12 hours max)</p>
        </div>
      </div>

      {/* Call Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Background Sound
          </label>
          <select
            {...register('backgroundSound')}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="off">Off</option>
            <option value="office">Office</option>
            <option value="cafe">Cafe</option>
            <option value="nature">Nature</option>
          </select>
          <p className="text-gray-500 text-xs mt-1">Background ambiance during calls</p>
        </div>

        <div className="flex items-center">
          <label className="flex items-center gap-3 text-gray-300">
            <input
              {...register('recordingEnabled')}
              type="checkbox"
              className="w-5 h-5 text-blue-600 bg-gray-800 border-gray-700 rounded focus:ring-blue-500 focus:ring-2"
            />
            <span>Enable Call Recording</span>
          </label>
        </div>
      </div>

      {/* End Call Messages */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            End Call Message
          </label>
          <input
            {...register('endCallMessage')}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
            placeholder="Thank you for calling!"
          />
          <p className="text-gray-500 text-xs mt-1">Message played when call ends</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Voicemail Message
          </label>
          <input
            {...register('voicemailMessage')}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
            placeholder="Please leave a message..."
          />
          <p className="text-gray-500 text-xs mt-1">Message for voicemail scenarios</p>
        </div>
      </div>

      {/* API Keys Section */}
      <div className="space-y-6 pt-6 border-t border-gray-700">
        <h4 className="text-md font-semibold text-white">API Configuration</h4>
        
        {/* Private API Key */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            VAPI Private API Key *
          </label>
          <div className="relative">
            <input
              {...register('apiKey')}
              type={showApiKey ? 'text' : 'password'}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 pr-12 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
              placeholder="sk-..."
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
            >
              {showApiKey ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
            </button>
          </div>
          {errors.apiKey && (
            <p className="text-red-400 text-sm mt-1">{errors.apiKey.message}</p>
          )}
          <div className="text-gray-400 text-sm mt-1 space-y-1">
            <p>Required for creating and managing agents. This key is stored securely server-side.</p>
            <p>Private keys start with "sk-" (e.g., sk-1234567890abcdef...).</p>
            <p>
              Get your private key from{' '}
              <a
                href="https://dashboard.vapi.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                VAPI Dashboard → API Keys
              </a>
            </p>
          </div>
        </div>

        {/* Public Key removed from creation - will be added later for testing */}
        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <div className="flex items-start space-x-2">
            <FiInfo className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="text-blue-400 font-medium">Public Key for Testing</p>
              <p className="text-blue-300/80 mt-1">
                Public key will be requested later when you want to test the agent. This avoids VAPI's limitation
                where public keys only work with existing agents.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VapiAdvancedSettingsPanel;
