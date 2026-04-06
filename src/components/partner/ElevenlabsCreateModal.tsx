'use client';

import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { FiX, FiPlus } from 'react-icons/fi';
import toast from 'react-hot-toast';

interface ElevenlabsCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateComplete: () => void;
}

export default function ElevenlabsCreateModal({ isOpen, onClose, onCreateComplete }: ElevenlabsCreateModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    systemPrompt: 'You are a helpful AI assistant.',
    language: 'en',
    voiceId: '',
    llmModel: 'gpt-4o-mini',
    temperature: 0.7,
    maxDurationSeconds: 600,
    apiKey: ''
  });

  const handleClose = () => {
    if (!loading) {
      setFormData({
        name: '',
        systemPrompt: 'You are a helpful AI assistant.',
        language: 'en',
        voiceId: '',
        llmModel: 'gpt-4o-mini',
        temperature: 0.7,
        maxDurationSeconds: 600,
        apiKey: ''
      });
      onClose();
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error('Agent name is required');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch('/api/partner/elevenlabs-agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          systemPrompt: formData.systemPrompt,
          language: formData.language,
          voiceId: formData.voiceId || null,
          llmModel: formData.llmModel,
          temperature: formData.temperature,
          maxDurationSeconds: formData.maxDurationSeconds,
          apiKey: formData.apiKey || null,
          webhookEnabled: false, // User can configure later
          profitMultiplier: 1.2
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create agent');
      }

      const result = await response.json();
      toast.success('Agent created successfully');
      onCreateComplete();
      handleClose();
    } catch (error: any) {
      console.error('Error creating agent:', error);
      toast.error(error.message || 'Failed to create agent');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-gray-700">
            <Dialog.Title className="text-lg font-semibold text-white">
              Create ElevenLabs Agent
            </Dialog.Title>
            <button
              onClick={handleClose}
              disabled={loading}
              className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 max-h-[calc(90vh-120px)] overflow-y-auto">
            <div className="space-y-4">
              {/* Agent Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Agent Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter agent name"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* System Prompt */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  System Prompt
                </label>
                <textarea
                  value={formData.systemPrompt}
                  onChange={(e) => handleInputChange('systemPrompt', e.target.value)}
                  placeholder="Enter system prompt"
                  rows={4}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Language */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Language
                </label>
                <select
                  value={formData.language}
                  onChange={(e) => handleInputChange('language', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="it">Italian</option>
                  <option value="pt">Portuguese</option>
                  <option value="pl">Polish</option>
                  <option value="tr">Turkish</option>
                  <option value="ru">Russian</option>
                  <option value="nl">Dutch</option>
                  <option value="cs">Czech</option>
                  <option value="ar">Arabic</option>
                  <option value="zh">Chinese</option>
                  <option value="ja">Japanese</option>
                  <option value="hu">Hungarian</option>
                  <option value="ko">Korean</option>
                </select>
              </div>

              {/* Voice ID */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Voice ID (Optional)
                </label>
                <input
                  type="text"
                  value={formData.voiceId}
                  onChange={(e) => handleInputChange('voiceId', e.target.value)}
                  placeholder="Enter ElevenLabs voice ID"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Leave empty to use default voice
                </p>
              </div>

              {/* LLM Model */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  LLM Model
                </label>
                <select
                  value={formData.llmModel}
                  onChange={(e) => handleInputChange('llmModel', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </select>
              </div>

              {/* Temperature */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Temperature: {formData.temperature}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={formData.temperature}
                  onChange={(e) => handleInputChange('temperature', parseFloat(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>More Focused</span>
                  <span>More Creative</span>
                </div>
              </div>

              {/* Max Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Max Duration (seconds)
                </label>
                <input
                  type="number"
                  min="60"
                  max="3600"
                  value={formData.maxDurationSeconds}
                  onChange={(e) => handleInputChange('maxDurationSeconds', parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* API Key */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  ElevenLabs API Key (Optional)
                </label>
                <input
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) => handleInputChange('apiKey', e.target.value)}
                  placeholder="Enter ElevenLabs API key"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Leave empty to use partner-level API key
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 p-6 border-t border-gray-700">
            <button
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={loading || !formData.name.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Creating...
                </>
              ) : (
                <>
                  <FiPlus className="w-4 h-4" />
                  Create Agent
                </>
              )}
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
