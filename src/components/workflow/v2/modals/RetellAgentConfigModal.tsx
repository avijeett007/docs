'use client';

import React, { useState, useEffect } from 'react';
import { FiPhone, FiKey, FiMic, FiSettings } from 'react-icons/fi';
import BaseConfigModal from './BaseConfigModal';

interface RetellAgentConfig {
  apiKey: string;
  agentId: string;
  phoneNumber: string;
  voice: string;
  language: string;
  responseFormat: string;
  interruption: boolean;
  enableBackchannel: boolean;
  silenceTimeout: number;
  maxCallDuration: number;
  webhook: string;
}

interface RetellAgentConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: RetellAgentConfig) => void;
  initialConfig?: Partial<RetellAgentConfig>;
}

const VOICE_OPTIONS = [
  { value: 'Liam', label: 'Liam (Male, US)' },
  { value: 'Emma', label: 'Emma (Female, US)' },
  { value: 'Oliver', label: 'Oliver (Male, UK)' },
  { value: 'Sophia', label: 'Sophia (Female, UK)' },
  { value: 'Noah', label: 'Noah (Male, US)' },
  { value: 'Ava', label: 'Ava (Female, US)' },
  { value: 'William', label: 'William (Male, US)' },
  { value: 'Isabella', label: 'Isabella (Female, US)' },
];

const LANGUAGE_OPTIONS = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'en-AU', label: 'English (Australia)' },
  { value: 'es-ES', label: 'Spanish (Spain)' },
  { value: 'es-MX', label: 'Spanish (Mexico)' },
  { value: 'fr-FR', label: 'French (France)' },
  { value: 'de-DE', label: 'German (Germany)' },
  { value: 'it-IT', label: 'Italian (Italy)' },
  { value: 'pt-BR', label: 'Portuguese (Brazil)' },
];

export default function RetellAgentConfigModal({
  isOpen,
  onClose,
  onSave,
  initialConfig = {},
}: RetellAgentConfigModalProps) {
  const [config, setConfig] = useState<RetellAgentConfig>({
    apiKey: '',
    agentId: '',
    phoneNumber: '',
    voice: 'Liam',
    language: 'en-US',
    responseFormat: 'text',
    interruption: true,
    enableBackchannel: false,
    silenceTimeout: 5000,
    maxCallDuration: 1800,
    webhook: '',
    ...initialConfig,
  });

  useEffect(() => {
    if (isOpen && initialConfig) {
      setConfig({
        apiKey: '',
        agentId: '',
        phoneNumber: '',
        voice: 'Liam',
        language: 'en-US',
        responseFormat: 'text',
        interruption: true,
        enableBackchannel: false,
        silenceTimeout: 5000,
        maxCallDuration: 1800,
        webhook: '',
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
      apiKey: '',
      agentId: '',
      phoneNumber: '',
      voice: 'Liam',
      language: 'en-US',
      responseFormat: 'text',
      interruption: true,
      enableBackchannel: false,
      silenceTimeout: 5000,
      maxCallDuration: 1800,
      webhook: '',
    });
  };

  const canSave = config.apiKey.trim().length > 0 && config.agentId.trim().length > 0;

  return (
    <BaseConfigModal
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      title="Retell Agent Configuration"
      icon={<FiPhone className="w-5 h-5 text-green-400" />}
      canSave={canSave}
      onReset={handleReset}
    >
      <div className="space-y-6">
        {/* API Configuration */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-white flex items-center gap-2">
            <FiKey className="w-4 h-4 text-green-400" />
            API Configuration
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Retell API Key *
              </label>
              <input
                type="password"
                value={config.apiKey}
                onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="key_..."
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Agent ID *
              </label>
              <input
                type="text"
                value={config.agentId}
                onChange={(e) => setConfig(prev => ({ ...prev, agentId: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="agent_..."
                required
              />
            </div>
          </div>
        </div>

        {/* Phone Configuration */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-white flex items-center gap-2">
            <FiPhone className="w-4 h-4 text-blue-400" />
            Phone Configuration
          </h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              value={config.phoneNumber}
              onChange={(e) => setConfig(prev => ({ ...prev, phoneNumber: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="+1234567890"
            />
          </div>
        </div>

        {/* Voice & Language Configuration */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-white flex items-center gap-2">
            <FiMic className="w-4 h-4 text-purple-400" />
            Voice & Language
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Voice
              </label>
              <select
                value={config.voice}
                onChange={(e) => setConfig(prev => ({ ...prev, voice: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                {VOICE_OPTIONS.map(voice => (
                  <option key={voice.value} value={voice.value}>{voice.label}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Language
              </label>
              <select
                value={config.language}
                onChange={(e) => setConfig(prev => ({ ...prev, language: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                {LANGUAGE_OPTIONS.map(lang => (
                  <option key={lang.value} value={lang.value}>{lang.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Response Format
              </label>
              <select
                value={config.responseFormat}
                onChange={(e) => setConfig(prev => ({ ...prev, responseFormat: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="text">Text</option>
                <option value="ssml">SSML</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Webhook URL
              </label>
              <input
                type="url"
                value={config.webhook}
                onChange={(e) => setConfig(prev => ({ ...prev, webhook: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="https://your-webhook.com/retell"
              />
            </div>
          </div>
        </div>

        {/* Call Settings */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-white flex items-center gap-2">
            <FiSettings className="w-4 h-4 text-orange-400" />
            Call Settings
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Silence Timeout (ms)
              </label>
              <input
                type="number"
                value={config.silenceTimeout}
                onChange={(e) => setConfig(prev => ({ ...prev, silenceTimeout: parseInt(e.target.value) || 5000 }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                min="1000"
                max="30000"
                step="1000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Max Call Duration (seconds)
              </label>
              <input
                type="number"
                value={config.maxCallDuration}
                onChange={(e) => setConfig(prev => ({ ...prev, maxCallDuration: parseInt(e.target.value) || 1800 }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                min="60"
                max="7200"
                step="60"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors">
              <input
                type="checkbox"
                checked={config.interruption}
                onChange={(e) => setConfig(prev => ({ ...prev, interruption: e.target.checked }))}
                className="w-4 h-4 text-green-600 bg-gray-600 border-gray-500 rounded focus:ring-green-500 focus:ring-2"
              />
              <div>
                <span className="text-sm font-medium text-white">Enable Interruption</span>
                <p className="text-xs text-gray-400">Allow users to interrupt the agent while speaking</p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors">
              <input
                type="checkbox"
                checked={config.enableBackchannel}
                onChange={(e) => setConfig(prev => ({ ...prev, enableBackchannel: e.target.checked }))}
                className="w-4 h-4 text-green-600 bg-gray-600 border-gray-500 rounded focus:ring-green-500 focus:ring-2"
              />
              <div>
                <span className="text-sm font-medium text-white">Enable Backchannel</span>
                <p className="text-xs text-gray-400">Allow natural conversation flow with "mm-hmm" responses</p>
              </div>
            </label>
          </div>
        </div>

        {/* Configuration Preview */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-white">Configuration Preview</h3>
          <div className="p-3 bg-gray-900 rounded-lg border border-gray-600 max-h-40 overflow-y-auto">
            <pre className="text-xs text-gray-300 whitespace-pre-wrap">
              {JSON.stringify({
                ...config,
                apiKey: config.apiKey ? '••••••••' : ''
              }, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </BaseConfigModal>
  );
}