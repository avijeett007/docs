'use client';

import React, { useState, useEffect } from 'react';
import { FiMic, FiKey, FiPhone, FiUser } from 'react-icons/fi';
import BaseConfigModal from './BaseConfigModal';

interface VAPIAgentConfig {
  apiKey: string;
  assistantId: string;
  phoneNumber: string;
  voiceId: string;
  model: string;
  temperature: number;
  maxTokens: number;
  firstMessage: string;
  systemMessage: string;
}

interface VAPIAgentConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: VAPIAgentConfig) => void;
  initialConfig?: Partial<VAPIAgentConfig>;
}

const VOICE_OPTIONS = [
  { value: 'jennifer', label: 'Jennifer' },
  { value: 'mark', label: 'Mark' },
  { value: 'emily', label: 'Emily' },
  { value: 'josh', label: 'Josh' },
  { value: 'sage', label: 'Sage' },
  { value: 'ava', label: 'Ava' },
];

const MODEL_OPTIONS = [
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  { value: 'gpt-4', label: 'GPT-4' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
];

export default function VAPIAgentConfigModal({
  isOpen,
  onClose,
  onSave,
  initialConfig = {},
}: VAPIAgentConfigModalProps) {
  const [config, setConfig] = useState<VAPIAgentConfig>({
    apiKey: '',
    assistantId: '',
    phoneNumber: '',
    voiceId: 'jennifer',
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    maxTokens: 1000,
    firstMessage: 'Hello! How can I help you today?',
    systemMessage: '',
    ...initialConfig,
  });

  useEffect(() => {
    if (isOpen && initialConfig) {
      setConfig({
        apiKey: '',
        assistantId: '',
        phoneNumber: '',
        voiceId: 'jennifer',
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        maxTokens: 1000,
        firstMessage: 'Hello! How can I help you today?',
        systemMessage: '',
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
      assistantId: '',
      phoneNumber: '',
      voiceId: 'jennifer',
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 1000,
      firstMessage: 'Hello! How can I help you today?',
      systemMessage: '',
    });
  };

  const canSave = config.apiKey.trim().length > 0 && config.systemMessage.trim().length > 0;

  return (
    <BaseConfigModal
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      title="VAPI Agent Configuration"
      icon={<FiMic className="w-5 h-5 text-purple-400" />}
      canSave={canSave}
      onReset={handleReset}
    >
      <div className="space-y-6">
        {/* API Configuration */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-white flex items-center gap-2">
            <FiKey className="w-4 h-4 text-purple-400" />
            API Configuration
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                VAPI API Key *
              </label>
              <input
                type="password"
                value={config.apiKey}
                onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="sk-..."
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Assistant ID
              </label>
              <input
                type="text"
                value={config.assistantId}
                onChange={(e) => setConfig(prev => ({ ...prev, assistantId: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="Optional: Use existing assistant"
              />
            </div>
          </div>
        </div>

        {/* Phone Configuration */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-white flex items-center gap-2">
            <FiPhone className="w-4 h-4 text-green-400" />
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
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="+1234567890"
            />
          </div>
        </div>

        {/* Voice & Model Configuration */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-white flex items-center gap-2">
            <FiUser className="w-4 h-4 text-blue-400" />
            Voice & AI Configuration
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Voice
              </label>
              <select
                value={config.voiceId}
                onChange={(e) => setConfig(prev => ({ ...prev, voiceId: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                {VOICE_OPTIONS.map(voice => (
                  <option key={voice.value} value={voice.value}>{voice.label}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                AI Model
              </label>
              <select
                value={config.model}
                onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                {MODEL_OPTIONS.map(model => (
                  <option key={model.value} value={model.value}>{model.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Temperature
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={config.temperature}
                onChange={(e) => setConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>0</span>
                <span className="text-white font-medium">{config.temperature}</span>
                <span>2</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Max Tokens
              </label>
              <input
                type="number"
                value={config.maxTokens}
                onChange={(e) => setConfig(prev => ({ ...prev, maxTokens: parseInt(e.target.value) || 1000 }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                min="100"
                max="4000"
                step="100"
              />
            </div>
          </div>
        </div>

        {/* Messages Configuration */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-white">Messages Configuration</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                First Message
              </label>
              <input
                type="text"
                value={config.firstMessage}
                onChange={(e) => setConfig(prev => ({ ...prev, firstMessage: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="Hello! How can I help you today?"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                System Message *
              </label>
              <textarea
                value={config.systemMessage}
                onChange={(e) => setConfig(prev => ({ ...prev, systemMessage: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                rows={4}
                placeholder="Define the assistant's behavior and personality..."
                required
              />
            </div>
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