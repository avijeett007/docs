'use client';

import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { FiX, FiSave, FiLoader } from 'react-icons/fi';
import { toast } from 'react-hot-toast';

interface UltravoxAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (agent: any) => void;
  mode: 'create' | 'edit';
  agentId?: string;
}

interface AgentFormData {
  agentName: string;
  systemPrompt: string;
  temperature: number;
  model: string;
  voice: string;
  languageHint: string;
  recordingEnabled: boolean;
  maxDuration: string;
  timeExceededMessage: string;
  apiKey: string;
}

export default function UltravoxAgentModal({
  isOpen,
  onClose,
  onSave,
  mode,
  agentId
}: UltravoxAgentModalProps) {
  const [formData, setFormData] = useState<AgentFormData>({
    agentName: '',
    systemPrompt: 'You are a helpful AI assistant.',
    temperature: 0.7,
    model: 'fixie-ai/ultravox',
    voice: '',
    languageHint: 'en-US',
    recordingEnabled: true,
    maxDuration: '1800s',
    timeExceededMessage: 'I apologize, but our conversation time has ended. Thank you for chatting with me!',
    apiKey: ''
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when modal opens/closes
  useEffect(() => {
    const fetchAgentData = async () => {
      if (isOpen) {
        if (mode === 'create') {
          setFormData({
            agentName: '',
            systemPrompt: 'You are a helpful AI assistant.',
            temperature: 0.7,
            model: 'fixie-ai/ultravox',
            voice: '',
            languageHint: 'en-US',
            recordingEnabled: true,
            maxDuration: '1800s',
            timeExceededMessage: 'I apologize, but our conversation time has ended. Thank you for chatting with me!',
            apiKey: ''
          });
        } else if (mode === 'edit' && agentId) {
          // Fetch agent data for editing
          const token = localStorage.getItem('partner_token');
          if (token) {
            try {
              const response = await fetch(`/api/partner/ultravox-agents/${agentId}`, {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              });

              if (response.ok) {
                const agent = await response.json();
                setFormData({
                  agentName: agent.name || '',
                  systemPrompt: agent.systemPrompt || 'You are a helpful AI assistant.',
                  temperature: agent.temperature || 0.7,
                  model: agent.model || 'fixie-ai/ultravox',
                  voice: agent.voice || '',
                  languageHint: agent.languageHint || 'en-US',
                  recordingEnabled: agent.recordingEnabled ?? true,
                  maxDuration: agent.maxDuration || '1800s',
                  timeExceededMessage: agent.timeExceededMessage || 'I apologize, but our conversation time has ended. Thank you for chatting with me!',
                  apiKey: '' // Don't pre-fill API key for security
                });
              }
            } catch (error) {
              console.error('Error fetching agent data:', error);
            }
          }
        }
        setErrors({});
      }
    };

    fetchAgentData();
  }, [isOpen, mode, agentId]);

  const handleInputChange = (field: keyof AgentFormData, value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.agentName.trim()) {
      newErrors.agentName = 'Agent name is required';
    }

    if (!formData.systemPrompt.trim()) {
      newErrors.systemPrompt = 'System prompt is required';
    }

    if (formData.temperature < 0 || formData.temperature > 1) {
      newErrors.temperature = 'Temperature must be between 0 and 1';
    }

    if (!formData.model.trim()) {
      newErrors.model = 'Model is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const endpoint = mode === 'create'
        ? '/api/partner/ultravox-agents'
        : `/api/partner/ultravox-agents/${agentId}`;
      
      const method = mode === 'create' ? 'POST' : 'PATCH';

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save agent');
      }

      const data = await response.json();
      onSave(data.agent || data);
      onClose();
    } catch (error: any) {
      console.error('Error saving agent:', error);
      toast.error(error.message || 'Failed to save agent');
    } finally {
      setLoading(false);
    }
  };

  const voiceOptions = [
    { value: '', label: 'Default Voice' },
    { value: 'voice_1', label: 'Voice 1 - Professional' },
    { value: 'voice_2', label: 'Voice 2 - Friendly' },
    { value: 'voice_3', label: 'Voice 3 - Energetic' },
  ];

  const modelOptions = [
    { value: 'fixie-ai/ultravox', label: 'Ultravox (Default)' },
    { value: 'fixie-ai/ultravox-v0_3', label: 'Ultravox v0.3' },
  ];

  const languageOptions = [
    { value: 'en-US', label: 'English (US)' },
    { value: 'en-GB', label: 'English (UK)' },
    { value: 'es-ES', label: 'Spanish' },
    { value: 'fr-FR', label: 'French' },
    { value: 'de-DE', label: 'German' },
    { value: 'it-IT', label: 'Italian' },
    { value: 'pt-BR', label: 'Portuguese (Brazil)' },
  ];

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <Dialog.Title className="text-xl font-semibold text-white">
              {mode === 'create' ? 'Create Ultravox Agent' : 'Edit Ultravox Agent'}
            </Dialog.Title>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <FiX className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white">Basic Information</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Agent Name *
                </label>
                <input
                  type="text"
                  value={formData.agentName}
                  onChange={(e) => handleInputChange('agentName', e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter agent name"
                />
                {errors.agentName && (
                  <p className="text-red-400 text-sm mt-1">{errors.agentName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  System Prompt *
                </label>
                <textarea
                  value={formData.systemPrompt}
                  onChange={(e) => handleInputChange('systemPrompt', e.target.value)}
                  rows={4}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter system prompt for the agent"
                />
                {errors.systemPrompt && (
                  <p className="text-red-400 text-sm mt-1">{errors.systemPrompt}</p>
                )}
              </div>
            </div>

            {/* Model Configuration */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white">Model Configuration</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Model
                  </label>
                  <select
                    value={formData.model}
                    onChange={(e) => handleInputChange('model', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {modelOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Temperature
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={formData.temperature}
                    onChange={(e) => handleInputChange('temperature', parseFloat(e.target.value))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.temperature && (
                    <p className="text-red-400 text-sm mt-1">{errors.temperature}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Voice & Language */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white">Voice & Language</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Voice
                  </label>
                  <select
                    value={formData.voice}
                    onChange={(e) => handleInputChange('voice', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {voiceOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Language
                  </label>
                  <select
                    value={formData.languageHint}
                    onChange={(e) => handleInputChange('languageHint', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {languageOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Call Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white">Call Settings</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Max Duration
                  </label>
                  <input
                    type="text"
                    value={formData.maxDuration}
                    onChange={(e) => handleInputChange('maxDuration', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 1800s"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="recordingEnabled"
                    checked={formData.recordingEnabled}
                    onChange={(e) => handleInputChange('recordingEnabled', e.target.checked)}
                    className="mr-2"
                  />
                  <label htmlFor="recordingEnabled" className="text-sm text-gray-300">
                    Enable Recording
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Time Exceeded Message
                </label>
                <textarea
                  value={formData.timeExceededMessage}
                  onChange={(e) => handleInputChange('timeExceededMessage', e.target.value)}
                  rows={2}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Message when call time limit is reached"
                />
              </div>
            </div>

            {/* API Key (Optional) */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white">API Key (Optional)</h3>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Agent-specific API Key
                </label>
                <input
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) => handleInputChange('apiKey', e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Leave empty to use partner API key"
                />
                <p className="text-xs text-gray-400 mt-1">
                  If provided, this API key will be used instead of the partner-level API key
                </p>
              </div>
            </div>

            {/* Tracking Information for Create Mode */}
            {mode === 'create' && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="text-blue-400 mt-0.5">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-blue-400 mb-1">Webhook Tracking Setup</h4>
                    <p className="text-xs text-gray-300 leading-relaxed">
                      After creating this agent, we'll automatically add a tracking identifier to the system prompt
                      to enable webhook analytics. This identifier is invisible to users and doesn't affect the AI's
                      responses. It allows us to track which agent generated each call for accurate analytics and billing.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 mt-8">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-gray-300 hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-6 py-2 rounded-lg flex items-center space-x-2"
            >
              {loading ? (
                <>
                  <FiLoader className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <FiSave className="w-4 h-4" />
                  <span>{mode === 'create' ? 'Create Agent' : 'Save Changes'}</span>
                </>
              )}
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
