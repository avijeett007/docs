'use client';

import React from 'react';
import { FiMic, FiPlay, FiLoader } from 'react-icons/fi';
import clsx from 'clsx';
import VapiVoiceSelector from './VapiVoiceSelector';

interface VoiceSelection {
  provider: string;
  providerId: string;
  name: string;
}

interface VapiBasicSettingsPanelProps {
  register: any;
  errors: any;
  selectedVoice: VoiceSelection | null;
  onVoiceSelect: (voice: VoiceSelection) => void;
}

const VapiBasicSettingsPanel: React.FC<VapiBasicSettingsPanelProps> = ({
  register,
  errors,
  selectedVoice,
  onVoiceSelect
}) => {
  return (
    <div className="space-y-6">
      <div className="border-b border-gray-700 pb-4">
        <h3 className="text-lg font-semibold text-white mb-2">Basic Settings</h3>
        <p className="text-gray-400 text-sm">
          Configure the core settings for your VAPI agent including name, system prompt, and voice.
        </p>
      </div>

      {/* Agent Name and First Message */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Agent Name *
          </label>
          <input
            {...register('agentName')}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
            placeholder="Enter agent name"
          />
          {errors.agentName && (
            <p className="text-red-400 text-sm mt-1">{errors.agentName.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            First Message
          </label>
          <input
            {...register('firstMessage')}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
            placeholder="Hello! How can I help you today?"
          />
        </div>
      </div>

      {/* System Prompt */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          System Prompt *
        </label>
        <textarea
          {...register('systemPrompt')}
          rows={4}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
          placeholder="Enter the system prompt that defines the agent's behavior..."
        />
        {errors.systemPrompt && (
          <p className="text-red-400 text-sm mt-1">{errors.systemPrompt.message}</p>
        )}
      </div>

      {/* Voice Selection */}
      <VapiVoiceSelector
        selectedVoice={selectedVoice}
        onVoiceSelect={onVoiceSelect}
      />
      {errors.voiceId && (
        <p className="text-red-400 text-sm mt-1">{errors.voiceId.message}</p>
      )}

      {/* Model Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Model Provider
          </label>
          <select
            {...register('modelProvider')}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="groq">Groq</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Model
          </label>
          <select
            {...register('model')}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="gpt-4o">GPT-4o</option>
            <option value="gpt-4o-mini">GPT-4o Mini</option>
            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
            <option value="claude-3-opus-20240229">Claude 3 Opus</option>
            <option value="claude-3-sonnet-20240229">Claude 3 Sonnet</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Temperature
          </label>
          <input
            {...register('temperature', { valueAsNumber: true })}
            type="number"
            step="0.1"
            min="0"
            max="2"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
            placeholder="0.7"
          />
        </div>
      </div>
    </div>
  );
};

export default VapiBasicSettingsPanel;
