'use client';

import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { FiX, FiSearch, FiDownload, FiCheck, FiEye, FiEyeOff, FiSettings } from 'react-icons/fi';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface ImportableAgent {
  id: string;
  name: string;
  status?: string;
  lastModified?: string;
  alreadyImported: boolean;
  details?: {
    voiceId?: string;
    language?: string;
    conversationConfig?: any;
  };
}

interface ElevenlabsImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export default function ElevenlabsImportModal({ isOpen, onClose, onImportComplete }: ElevenlabsImportModalProps) {
  const [step, setStep] = useState<'apikey' | 'agents' | 'importing'>('apikey');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [agents, setAgents] = useState<ImportableAgent[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchField, setSearchField] = useState<'all' | 'name' | 'id' | 'voice'>('all');
  const [importing, setImporting] = useState(false);

  const handleClose = () => {
    if (!importing) {
      setStep('apikey');
      setApiKey('');
      setAgents([]);
      setSelectedAgents(new Set());
      setSearchQuery('');
      setSearchField('all');
      onClose();
    }
  };

  const fetchAgents = async () => {
    if (!apiKey.trim()) {
      toast.error('Please enter your ElevenLabs API key');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch('/api/partner/elevenlabs-agents/import', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-API-Key': apiKey.trim()
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch agents');
      }

      const data = await response.json();
      setAgents(data.agents || []);
      setStep('agents');
    } catch (error: any) {
      console.error('Error fetching ElevenLabs agents:', error);
      toast.error(error.message || 'Failed to fetch agents from ElevenLabs');
    } finally {
      setLoading(false);
    }
  };

  const handleAgentToggle = (agentId: string) => {
    const newSelected = new Set(selectedAgents);
    if (newSelected.has(agentId)) {
      newSelected.delete(agentId);
    } else {
      newSelected.add(agentId);
    }
    setSelectedAgents(newSelected);
  };

  const handleSelectAll = () => {
    const visibleAvailable = filteredAgents.filter(agent => !agent.alreadyImported);
    const allSelected = visibleAvailable.every(agent => selectedAgents.has(agent.id));
    const newSelected = new Set(selectedAgents);
    if (allSelected) {
      visibleAvailable.forEach(agent => newSelected.delete(agent.id));
    } else {
      visibleAvailable.forEach(agent => newSelected.add(agent.id));
    }
    setSelectedAgents(newSelected);
  };

  const handleImport = async () => {
    if (selectedAgents.size === 0) {
      toast.error('Please select at least one agent to import');
      return;
    }

    try {
      setImporting(true);
      setStep('importing');
      
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const agentsToImport = Array.from(selectedAgents).map(agentId => ({
        id: agentId,
        enableWebhook: true,
        webhookMode: 'manual' as const, // ElevenLabs requires manual webhook setup
        forwardToPreExisting: true
      }));

      const response = await fetch('/api/partner/elevenlabs-agents/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          agents: agentsToImport
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to import agents');
      }

      const result = await response.json();
      
      // Show results
      const successful = result.results?.filter((r: any) => r.success).length || 0;
      const failed = result.results?.filter((r: any) => !r.success).length || 0;
      
      if (successful > 0) {
        toast.success(`Successfully imported ${successful} agent${successful > 1 ? 's' : ''}`);
      }
      
      if (failed > 0) {
        toast.error(`Failed to import ${failed} agent${failed > 1 ? 's' : ''}`);
      }

      onImportComplete();
      handleClose();
    } catch (error: any) {
      console.error('Error importing agents:', error);
      toast.error(error.message || 'Failed to import agents');
      setImporting(false);
      setStep('agents');
    }
  };

  const getVoiceString = (agent: ImportableAgent): string => {
    return agent.details?.voiceId ?? '';
  };

  const filteredAgents = agents.filter(agent => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const name = (agent.name ?? '').toLowerCase();
    const id = (agent.id ?? '').toLowerCase();
    const voice = getVoiceString(agent).toLowerCase();
    switch (searchField) {
      case 'name': return name.includes(q);
      case 'id': return id.includes(q);
      case 'voice': return voice.includes(q);
      default: return name.includes(q) || id.includes(q) || voice.includes(q);
    }
  });
  const availableAgents = agents.filter(agent => !agent.alreadyImported);
  const filteredAvailable = filteredAgents.filter(agent => !agent.alreadyImported);

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-gray-700">
            <Dialog.Title className="text-lg font-semibold text-white">
              Import ElevenLabs Agents
            </Dialog.Title>
            <button
              onClick={handleClose}
              disabled={importing}
              className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6">
            {step === 'apikey' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    ElevenLabs API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Enter your ElevenLabs API key"
                      className="w-full px-3 py-2 pr-10 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onKeyPress={(e) => e.key === 'Enter' && fetchAgents()}
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      {showApiKey ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Your API key is used only to fetch your agents and is not stored.
                  </p>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={fetchAgents}
                    disabled={loading || !apiKey.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                        Fetching...
                      </>
                    ) : (
                      <>
                        <FiSearch className="w-4 h-4" />
                        Fetch Agents
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {step === 'agents' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-300">
                    Found {agents.length} agent{agents.length !== 1 ? 's' : ''} 
                    ({availableAgents.length} available for import)
                  </p>
                  {availableAgents.length > 0 && (
                    <button
                      onClick={handleSelectAll}
                      className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      {filteredAvailable.length > 0 && filteredAvailable.every(a => selectedAgents.has(a.id)) ? 'Deselect All' : 'Select All'}
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={searchField === 'all' ? 'Search by name, ID, or voice...' : `Search by ${searchField}...`}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-10 pr-4 py-2 text-white text-sm placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                  <div className="flex items-center rounded-lg border border-gray-600 overflow-hidden shrink-0">
                    {(['all', 'name', 'id', 'voice'] as const).map((field) => (
                      <button
                        key={field}
                        onClick={() => setSearchField(field)}
                        className={clsx(
                          'px-3 py-2 text-xs font-medium capitalize transition-colors',
                          searchField === field
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700 text-gray-400 hover:text-white'
                        )}
                      >
                        {field === 'all' ? 'All' : field === 'id' ? 'ID' : field === 'voice' ? 'Voice' : 'Name'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="max-h-96 overflow-y-auto space-y-2">
                  {filteredAgents.length === 0 && (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      No agents match &ldquo;{searchQuery}&rdquo;
                    </div>
                  )}
                  {filteredAgents.map((agent) => (
                    <div
                      key={agent.id}
                      className={clsx(
                        'flex items-center justify-between p-3 rounded-lg border',
                        agent.alreadyImported
                          ? 'bg-gray-700/50 border-gray-600 opacity-60'
                          : selectedAgents.has(agent.id)
                          ? 'bg-blue-600/20 border-blue-500'
                          : 'bg-gray-700 border-gray-600 hover:border-gray-500'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedAgents.has(agent.id)}
                          onChange={() => handleAgentToggle(agent.id)}
                          disabled={agent.alreadyImported}
                          className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                        />
                        <div>
                          <h3 className="font-medium text-white">{agent.name}</h3>
                          <div className="flex items-center gap-4 text-xs text-gray-400">
                            <span>ID: {agent.id}</span>
                            {agent.details?.language && (
                              <span>Language: {agent.details.language}</span>
                            )}
                            {agent.details?.voiceId && (
                              <span>Voice: {agent.details.voiceId}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {agent.alreadyImported && (
                          <span className="px-2 py-1 bg-green-600/20 text-green-400 text-xs rounded">
                            Already Imported
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
                  <button
                    onClick={() => { setStep('apikey'); setSearchQuery(''); setSearchField('all'); }}
                    className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={selectedAgents.size === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    <FiDownload className="w-4 h-4" />
                    Import {selectedAgents.size} Agent{selectedAgents.size !== 1 ? 's' : ''}
                  </button>
                </div>
              </div>
            )}

            {step === 'importing' && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">Importing Agents...</h3>
                <p className="text-gray-400">
                  Please wait while we import your selected agents from ElevenLabs.
                </p>
              </div>
            )}
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
