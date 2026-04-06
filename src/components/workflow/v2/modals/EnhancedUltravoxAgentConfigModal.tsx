'use client';

import React, { useState, useEffect } from 'react';
import { FiCpu, FiKey, FiZap, FiUser, FiPlus, FiRefreshCw } from 'react-icons/fi';
import PositionedModal from './PositionedModal';
import { UltravoxAgentData } from '@/types/workflow';

interface EnhancedUltravoxAgentConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: UltravoxAgentData) => void;
  initialConfig?: Partial<UltravoxAgentData>;
  nodePosition?: { x: number; y: number };
  customerId?: string;
}

export default function EnhancedUltravoxAgentConfigModal({
  isOpen,
  onClose,
  onSave,
  initialConfig = {},
  nodePosition,
  customerId,
}: EnhancedUltravoxAgentConfigModalProps) {
  const [step, setStep] = useState<'select' | 'import' | 'configure'>('select');
  const [selectedAgent, setSelectedAgent] = useState<UltravoxAgentData | null>(null);
  const [availableAgents, setAvailableAgents] = useState<UltravoxAgentData[]>([]);
  const [loading, setLoading] = useState(false);
  const [importConfig, setImportConfig] = useState({
    apiKey: '',
    agentId: '',
  });

  useEffect(() => {
    if (isOpen) {
      loadAvailableAgents();
      if (initialConfig.id) {
        // If we already have a configured agent, go directly to configure step
        setSelectedAgent(initialConfig as UltravoxAgentData);
        setStep('configure');
      }
    }
  }, [isOpen, initialConfig]);

  const loadAvailableAgents = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch('/api/partner/ultravox-agents', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cookie': `partner_token=${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Ultravox API Response:', data);
        console.log('Current customerId:', customerId);
        console.log('Ultravox Response keys:', Object.keys(data));
        console.log('Ultravox Is data an array?', Array.isArray(data));

        // Show all agents fetched for this partner
        // Try both data.data and data directly in case the structure varies
        const allAgents = data.data || data || [];
        console.log('All Ultravox agents for partner:', allAgents);
        setAvailableAgents(allAgents);
      }
    } catch (error) {
      console.error('Error loading Ultravox agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImportAgent = async () => {
    if (!importConfig.apiKey || !importConfig.agentId) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch('/api/partner/ultravox-agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Cookie': `partner_token=${token}`
        },
        body: JSON.stringify({
          apiKey: importConfig.apiKey,
          agentId: importConfig.agentId,
          customerId: customerId
        })
      });

      if (response.ok) {
        const newAgent = await response.json();
        setAvailableAgents(prev => [...prev, newAgent.data]);
        setImportConfig({ apiKey: '', agentId: '' });
        setStep('select');
      }
    } catch (error) {
      console.error('Error importing Ultravox agent:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAgent = (agent: UltravoxAgentData) => {
    setSelectedAgent(agent);
    setStep('configure');
  };

  const handleSave = () => {
    if (selectedAgent) {
      onSave({
        ...selectedAgent,
        customerId: customerId || selectedAgent.customerId
      });
      onClose();
    }
  };

  const renderSelectStep = () => (
    <div className="p-6 space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-white mb-2">Select Ultravox Agent</h3>
        <p className="text-gray-400">Choose an existing agent or import a new one</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Available Agents */}
          {availableAgents.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300">Available Agents</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                {availableAgents.map((agent) => (
                <div
                  key={agent.id}
                  onClick={() => handleSelectAgent(agent)}
                  className="p-4 bg-gray-700 border border-gray-600 rounded-lg cursor-pointer hover:border-blue-500 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h5 className="font-medium text-white">{agent.name}</h5>
                      <p className="text-sm text-gray-400">Model: {agent.model || 'Default'}</p>
                      <p className="text-sm text-gray-400">Voice: {agent.voice || 'Default'}</p>
                      <p className="text-sm text-gray-400">Temperature: {agent.temperature || 0.7}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          agent.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {agent.isActive ? 'Active' : 'Inactive'}
                        </span>
                        {agent.recordingEnabled && (
                          <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded-full">
                            Recording
                          </span>
                        )}
                      </div>
                    </div>
                    <FiUser className="w-5 h-5 text-blue-400" />
                  </div>
                </div>
              ))}
              </div>
            </div>
          )}

          {/* Import New Agent */}
          <div className="border-t border-gray-600 pt-4">
            <button
              onClick={() => setStep('import')}
              className="w-full p-4 border-2 border-dashed border-gray-600 rounded-lg hover:border-blue-500 transition-colors group"
            >
              <div className="flex items-center justify-center gap-2 text-gray-400 group-hover:text-blue-400">
                <FiPlus className="w-5 h-5" />
                <span>Import New Ultravox Agent</span>
              </div>
            </button>
          </div>

          {availableAgents.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <FiUser className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No Ultravox agents available. Import one to get started.</p>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between items-center pt-4 border-t border-gray-600">
        <button
          onClick={loadAvailableAgents}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white transition-colors"
        >
          <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  const renderImportStep = () => (
    <div className="p-6 space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-white mb-2">Import Ultravox Agent</h3>
        <p className="text-gray-400">Enter your Ultravox API key and agent ID</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Ultravox API Key *
          </label>
          <input
            type="password"
            value={importConfig.apiKey}
            onChange={(e) => setImportConfig(prev => ({ ...prev, apiKey: e.target.value }))}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your Ultravox API key"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Agent ID (Optional)
          </label>
          <input
            type="text"
            value={importConfig.agentId}
            onChange={(e) => setImportConfig(prev => ({ ...prev, agentId: e.target.value }))}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Leave empty to import all agents"
          />
        </div>

        <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <p className="text-sm text-blue-300">
            💡 This will import the agent(s) and assign them to the selected customer.
          </p>
        </div>
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-gray-600">
        <button
          onClick={() => setStep('select')}
          className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
        >
          Back
        </button>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImportAgent}
            disabled={!importConfig.apiKey || loading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            {loading ? 'Importing...' : 'Import Agent'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderConfigureStep = () => (
    <div className="p-6 space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-white mb-2">Configure Ultravox Agent</h3>
        <p className="text-gray-400">{selectedAgent?.name}</p>
      </div>

      {selectedAgent && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-800/50 border border-gray-600 rounded-lg">
              <h4 className="text-sm font-medium text-gray-300 mb-2">Agent Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Name:</span>
                  <span className="text-white">{selectedAgent.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Model:</span>
                  <span className="text-white">{selectedAgent.model || 'Default'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Voice:</span>
                  <span className="text-white">{selectedAgent.voice || 'Default'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Temperature:</span>
                  <span className="text-white">{selectedAgent.temperature || 0.7}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-800/50 border border-gray-600 rounded-lg">
              <h4 className="text-sm font-medium text-gray-300 mb-2">Status</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Active:</span>
                  <span className={selectedAgent.isActive ? 'text-green-400' : 'text-red-400'}>
                    {selectedAgent.isActive ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Recording:</span>
                  <span className={selectedAgent.recordingEnabled ? 'text-green-400' : 'text-gray-400'}>
                    {selectedAgent.recordingEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                {selectedAgent.maxDuration && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Max Duration:</span>
                    <span className="text-white">{selectedAgent.maxDuration}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {selectedAgent.systemPrompt && (
            <div className="p-4 bg-gray-800/50 border border-gray-600 rounded-lg">
              <h4 className="text-sm font-medium text-gray-300 mb-2">System Prompt</h4>
              <p className="text-sm text-white">{selectedAgent.systemPrompt}</p>
            </div>
          )}

          {selectedAgent.languageHint && (
            <div className="p-4 bg-gray-800/50 border border-gray-600 rounded-lg">
              <h4 className="text-sm font-medium text-gray-300 mb-2">Language Hint</h4>
              <p className="text-sm text-white">{selectedAgent.languageHint}</p>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between items-center pt-4 border-t border-gray-600">
        <button
          onClick={() => setStep('select')}
          className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
        >
          Back to Selection
        </button>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Use This Agent
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <PositionedModal
      isOpen={isOpen}
      onClose={onClose}
      nodePosition={nodePosition}
      title="Ultravox Agent Configuration"
      icon={<FiCpu className="w-5 h-5 text-blue-400" />}
      maxWidth="max-w-3xl"
      maxHeight="max-h-[85vh]"
    >
      {step === 'select' && renderSelectStep()}
      {step === 'import' && renderImportStep()}
      {step === 'configure' && renderConfigureStep()}
    </PositionedModal>
  );
}