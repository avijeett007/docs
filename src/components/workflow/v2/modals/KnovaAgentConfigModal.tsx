'use client';

import React, { useState, useEffect } from 'react';
import { FiUser, FiMic, FiPhone, FiCpu, FiMessageCircle, FiTool } from 'react-icons/fi';
import BaseConfigModal from './BaseConfigModal';

interface KnovaAgentConfig {
  agentType: string;
  channel: string;
  voice: string;
  model: string;
  systemPrompt: string;
  tools: string[];
  knowledgebase: string | null;
  temperature: number;
  maxTokens: number;
  responseFormat: string;
}

interface KnovaAgentConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: KnovaAgentConfig) => void;
  initialConfig?: Partial<KnovaAgentConfig>;
}

const VOICE_OPTIONS = [
  { value: 'default', label: 'Default Voice' },
  { value: 'alloy', label: 'Alloy' },
  { value: 'echo', label: 'Echo' },
  { value: 'fable', label: 'Fable' },
  { value: 'onyx', label: 'Onyx' },
  { value: 'nova', label: 'Nova' },
  { value: 'shimmer', label: 'Shimmer' },
];

const MODEL_OPTIONS = [
  { value: 'gpt-4', label: 'GPT-4' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet' },
  { value: 'claude-3-opus', label: 'Claude 3 Opus' },
];

const TOOL_OPTIONS = [
  { value: 'web_search', label: 'Web Search' },
  { value: 'calculator', label: 'Calculator' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'email', label: 'Email' },
  { value: 'crm_integration', label: 'CRM Integration' },
  { value: 'knowledge_base', label: 'Knowledge Base' },
];

export default function KnovaAgentConfigModal({
  isOpen,
  onClose,
  onSave,
  initialConfig = {},
}: KnovaAgentConfigModalProps) {
  const [config, setConfig] = useState<KnovaAgentConfig>({
    agentType: 'voice',
    channel: 'phone',
    voice: 'default',
    model: 'gpt-4',
    systemPrompt: '',
    tools: [],
    knowledgebase: null,
    temperature: 0.7,
    maxTokens: 2000,
    responseFormat: 'text',
    ...initialConfig,
  });

  useEffect(() => {
    if (isOpen && initialConfig) {
      setConfig({
        agentType: 'voice',
        channel: 'phone',
        voice: 'default',
        model: 'gpt-4',
        systemPrompt: '',
        tools: [],
        knowledgebase: null,
        temperature: 0.7,
        maxTokens: 2000,
        responseFormat: 'text',
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
      agentType: 'voice',
      channel: 'phone',
      voice: 'default',
      model: 'gpt-4',
      systemPrompt: '',
      tools: [],
      knowledgebase: null,
      temperature: 0.7,
      maxTokens: 2000,
      responseFormat: 'text',
    });
  };

  const toggleTool = (tool: string) => {
    setConfig(prev => ({
      ...prev,
      tools: prev.tools.includes(tool)
        ? prev.tools.filter(t => t !== tool)
        : [...prev.tools, tool]
    }));
  };

  const canSave = config.systemPrompt.trim().length > 0;

  return (
    <BaseConfigModal
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      title="Knova Agent Configuration"
      icon={<FiUser className="w-5 h-5 text-indigo-400" />}
      canSave={canSave}
      onReset={handleReset}
    >
      <div className="space-y-6">
        {/* Agent Type & Channel */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-white flex items-center gap-2">
            <FiMic className="w-4 h-4 text-indigo-400" />
            Agent Configuration
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Agent Type
              </label>
              <select
                value={config.agentType}
                onChange={(e) => setConfig(prev => ({ ...prev, agentType: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="voice">Voice Assistant</option>
                <option value="chat">Chat Assistant</option>
                <option value="hybrid">Hybrid (Voice + Chat)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <FiPhone className="w-4 h-4" />
                Channel
              </label>
              <select
                value={config.channel}
                onChange={(e) => setConfig(prev => ({ ...prev, channel: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="phone">Phone</option>
                <option value="web">Web</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="telegram">Telegram</option>
                <option value="discord">Discord</option>
              </select>
            </div>
          </div>
        </div>

        {/* AI Model & Voice */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-white flex items-center gap-2">
            <FiCpu className="w-4 h-4 text-purple-400" />
            AI Configuration
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                AI Model
              </label>
              <select
                value={config.model}
                onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {MODEL_OPTIONS.map(model => (
                  <option key={model.value} value={model.value}>{model.label}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Voice
              </label>
              <select
                value={config.voice}
                onChange={(e) => setConfig(prev => ({ ...prev, voice: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {VOICE_OPTIONS.map(voice => (
                  <option key={voice.value} value={voice.value}>{voice.label}</option>
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
                <span>0 (Deterministic)</span>
                <span className="text-white font-medium">{config.temperature}</span>
                <span>2 (Creative)</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Max Tokens
              </label>
              <input
                type="number"
                value={config.maxTokens}
                onChange={(e) => setConfig(prev => ({ ...prev, maxTokens: parseInt(e.target.value) || 2000 }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                min="100"
                max="8000"
                step="100"
              />
            </div>
          </div>
        </div>

        {/* System Prompt */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-white flex items-center gap-2">
            <FiMessageCircle className="w-4 h-4 text-green-400" />
            System Prompt *
          </h3>
          
          <div>
            <textarea
              value={config.systemPrompt}
              onChange={(e) => setConfig(prev => ({ ...prev, systemPrompt: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
              rows={4}
              placeholder="Define the agent's personality, role, and behavior instructions..."
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              This prompt defines how your agent will behave and respond to users.
            </p>
          </div>
        </div>

        {/* Tools & Capabilities */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-white flex items-center gap-2">
            <FiTool className="w-4 h-4 text-orange-400" />
            Tools & Capabilities
          </h3>
          
          <div className="grid grid-cols-2 gap-2">
            {TOOL_OPTIONS.map(tool => (
              <label key={tool.value} className="flex items-center gap-2 p-2 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors">
                <input
                  type="checkbox"
                  checked={config.tools.includes(tool.value)}
                  onChange={() => toggleTool(tool.value)}
                  className="w-4 h-4 text-indigo-600 bg-gray-600 border-gray-500 rounded focus:ring-indigo-500 focus:ring-2"
                />
                <span className="text-sm text-white">{tool.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Knowledge Base */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-white">Knowledge Base</h3>
          
          <div>
            <select
              value={config.knowledgebase || ''}
              onChange={(e) => setConfig(prev => ({ ...prev, knowledgebase: e.target.value || null }))}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">No Knowledge Base</option>
              <option value="general">General Knowledge</option>
              <option value="company">Company Knowledge</option>
              <option value="product">Product Documentation</option>
              <option value="support">Support Articles</option>
            </select>
          </div>
        </div>

        {/* Configuration Preview */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-white">Configuration Preview</h3>
          <div className="p-3 bg-gray-900 rounded-lg border border-gray-600 max-h-40 overflow-y-auto">
            <pre className="text-xs text-gray-300 whitespace-pre-wrap">
              {JSON.stringify(config, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </BaseConfigModal>
  );
}