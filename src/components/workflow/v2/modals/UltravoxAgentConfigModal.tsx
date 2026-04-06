'use client';

import React, { useState, useEffect } from 'react';
import { FiCpu, FiKey, FiMic, FiSettings } from 'react-icons/fi';
import BaseConfigModal from './BaseConfigModal';

interface UltravoxAgentConfig {
  apiKey: string;
  modelId: string;
  voice: string;
  language: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  enableStreaming: boolean;
  responseTimeout: number;
  silenceDetection: boolean;
  noiseReduction: boolean;
}

interface UltravoxAgentConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: UltravoxAgentConfig) => void;
  initialConfig?: Partial<UltravoxAgentConfig>;
}

const VOICE_OPTIONS = [
  { value: 'default', label: 'Default Voice' },
  { value: 'neural-male', label: 'Neural Male' },
  { value: 'neural-female', label: 'Neural Female' },
  { value: 'studio-male', label: 'Studio Male' },
  { value: 'studio-female', label: 'Studio Female' },
  { value: 'whisper-male', label: 'Whisper Male' },
  { value: 'whisper-female', label: 'Whisper Female' },
];

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
];

const MODEL_OPTIONS = [
  { value: 'ultravox-v0_3', label: 'Ultravox v0.3' },
  { value: 'ultravox-v0_2', label: 'Ultravox v0.2' },
  { value: 'ultravox-turbo', label: 'Ultravox Turbo' },
  { value: 'ultravox-lite', label: 'Ultravox Lite' },
];

export default function UltravoxAgentConfigModal({
  isOpen,
  onClose,
  onSave,
  initialConfig = {},
}: UltravoxAgentConfigModalProps) {
  const [config, setConfig] = useState<UltravoxAgentConfig>({
    apiKey: '',
    modelId: 'ultravox-v0_3',
    voice: 'default',
    language: 'en',
    temperature: 0.7,
    maxTokens: 1000,
    systemPrompt: '',
    enableStreaming: true,
    responseTimeout: 10000,
    silenceDetection: true,
    noiseReduction: false,
    ...initialConfig,
  });

  useEffect(() => {
    if (isOpen && initialConfig) {
      setConfig({
        apiKey: '',
        modelId: 'ultravox-v0_3',
        voice: 'default',
        language: 'en',
        temperature: 0.7,
        maxTokens: 1000,
        systemPrompt: '',
        enableStreaming: true,
        responseTimeout: 10000,
        silenceDetection: true,
        noiseReduction: false,
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
      modelId: 'ultravox-v0_3',
      voice: 'default',
      language: 'en',
      temperature: 0.7,
      maxTokens: 1000,
      systemPrompt: '',
      enableStreaming: true,
      responseTimeout: 10000,
      silenceDetection: true,
      noiseReduction: false,
    });
  };

  const canSave = config.apiKey.trim().length > 0 && config.systemPrompt.trim().length > 0;

  return (
    <BaseConfigModal
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      title="Ultravox Agent Configuration"
      icon={<FiCpu className="w-5 h-5 text-blue-400" />}
      canSave={canSave}
      onReset={handleReset}
    >
      <div className="space-y-6">
        {/* API Configuration */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-white flex items-center gap-2">
            <FiKey className="w-4 h-4 text-blue-400" />
            API Configuration
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Ultravox API Key *
              </label>
              <input
                type="password"
                value={config.apiKey}
                onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="uv_..."
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Model ID
              </label>
              <select
                value={config.modelId}
                onChange={(e) => setConfig(prev => ({ ...prev, modelId: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {MODEL_OPTIONS.map(model => (
                  <option key={model.value} value={model.value}>{model.label}</option>
                ))}
              </select>
            </div>
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
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {LANGUAGE_OPTIONS.map(lang => (
                  <option key={lang.value} value={lang.value}>{lang.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* AI Parameters */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-white flex items-center gap-2">
            <FiCpu className="w-4 h-4 text-green-400" />
            AI Parameters
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
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
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min="100"
                max="4000"
                step="100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Response Timeout (ms)
              </label>
              <input
                type="number"
                value={config.responseTimeout}
                onChange={(e) => setConfig(prev => ({ ...prev, responseTimeout: parseInt(e.target.value) || 10000 }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min="1000"
                max="30000"
                step="1000"
              />
            </div>
          </div>
        </div>

        {/* System Prompt */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-white">System Prompt *</h3>
          
          <div>
            <textarea
              value={config.systemPrompt}
              onChange={(e) => setConfig(prev => ({ ...prev, systemPrompt: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              rows={4}
              placeholder="Define the agent's behavior, personality, and capabilities..."
              required
            />
          </div>
        </div>

        {/* Advanced Settings */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-white flex items-center gap-2">
            <FiSettings className="w-4 h-4 text-orange-400" />
            Advanced Settings
          </h3>
          
          <div className="space-y-3">
            <label className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors">
              <input
                type="checkbox"
                checked={config.enableStreaming}
                onChange={(e) => setConfig(prev => ({ ...prev, enableStreaming: e.target.checked }))}
                className="w-4 h-4 text-blue-600 bg-gray-600 border-gray-500 rounded focus:ring-blue-500 focus:ring-2"
              />
              <div>
                <span className="text-sm font-medium text-white">Enable Streaming</span>
                <p className="text-xs text-gray-400">Real-time response streaming for lower latency</p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors">
              <input
                type="checkbox"
                checked={config.silenceDetection}
                onChange={(e) => setConfig(prev => ({ ...prev, silenceDetection: e.target.checked }))}
                className="w-4 h-4 text-blue-600 bg-gray-600 border-gray-500 rounded focus:ring-blue-500 focus:ring-2"
              />
              <div>
                <span className="text-sm font-medium text-white">Silence Detection</span>
                <p className="text-xs text-gray-400">Automatically detect when user stops speaking</p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors">
              <input
                type="checkbox"
                checked={config.noiseReduction}
                onChange={(e) => setConfig(prev => ({ ...prev, noiseReduction: e.target.checked }))}
                className="w-4 h-4 text-blue-600 bg-gray-600 border-gray-500 rounded focus:ring-blue-500 focus:ring-2"
              />
              <div>
                <span className="text-sm font-medium text-white">Noise Reduction</span>
                <p className="text-xs text-gray-400">Filter background noise from audio input</p>
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