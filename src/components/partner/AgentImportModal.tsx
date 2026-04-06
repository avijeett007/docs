'use client';

import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { FiX, FiSearch, FiDownload, FiCheck, FiEye, FiEyeOff } from 'react-icons/fi';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import UpgradeInterestModal from './UpgradeInterestModal';

interface ImportableAgent {
  id: string;
  name: string;
  status?: string;
  lastModified?: string;
  alreadyImported: boolean;
  details?: any;
}

interface AgentImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export default function AgentImportModal({ isOpen, onClose, onImportComplete }: AgentImportModalProps) {
  const [step, setStep] = useState<'provider' | 'apikey' | 'agents' | 'importing'>('provider');
  const [provider, setProvider] = useState<'vapi' | 'retell' | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [agents, setAgents] = useState<ImportableAgent[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchField, setSearchField] = useState<'all' | 'name' | 'id' | 'voice'>('all');
  const [importing, setImporting] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeModalData, setUpgradeModalData] = useState<{
    limitType: string;
    currentCount: number;
    maxCount: number;
    attemptedCount: number;
  } | null>(null);

  const handleClose = () => {
    if (!importing) {
      setStep('provider');
      setProvider(null);
      setApiKey('');
      setAgents([]);
      setSelectedAgents(new Set());
      setSearchQuery('');
      setSearchField('all');
      onClose();
    }
  };

  const handleProviderSelect = (selectedProvider: 'vapi' | 'retell') => {
    setProvider(selectedProvider);
    setStep('apikey');
  };

  const handleFetchAgents = async () => {
    if (!provider || !apiKey.trim()) {
      toast.error('Please provide an API key');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch('/api/partner/agents/import/list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          provider
        })
      });

      if (response.ok) {
        const data = await response.json();
        setAgents(data.agents);
        setStep('agents');
        
        if (data.availableForImport === 0) {
          toast('All agents from this provider have already been imported', {
            icon: 'ℹ️',
            style: {
              background: '#3B82F6',
              color: 'white',
            },
          });
        } else {
          toast.success(`Found ${data.availableForImport} agents available for import`);
        }
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to fetch agents');
      }
    } catch (error) {
      console.error('Error fetching agents:', error);
      toast.error('Failed to fetch agents');
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
        webhookMode: 'automatic' as const,
        forwardToPreExisting: true
      }));

      const response = await fetch('/api/partner/agents/import/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          provider,
          agents: agentsToImport
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Successfully imported ${result.summary.successful} agents!`);
        
        if (result.summary.failed > 0) {
          toast.error(`${result.summary.failed} agents failed to import`);
        }

        onImportComplete();
        handleClose();
      } else {
        const error = await response.json();

        // Check if it's an agent limit error
        if (response.status === 403 && error.validation &&
            (error.error?.includes('limit') || error.message?.includes('limit') || error.error === 'Import count exceeds limit')) {
          // Show upgrade modal instead of just error toast
          const providerName = provider === 'vapi' ? 'VAPI' :
                              provider === 'retell' ? 'Retell' :
                              provider === 'ultravox' ? 'Ultravox' :
                              provider === 'elevenlabs' ? 'ElevenLabs' :
                              provider || 'Unknown';

          setUpgradeModalData({
            limitType: `${providerName} agents`,
            currentCount: error.validation.current || 0,
            maxCount: error.validation.limit || 0,
            attemptedCount: selectedAgents.size,
          });
          setShowUpgradeModal(true);
        } else {
          toast.error(error.error || 'Import failed');
        }

        // Reset to agents selection step on error
        setStep('agents');
      }
    } catch (error) {
      console.error('Error importing agents:', error);
      toast.error('Import failed');
      // Reset to agents selection step on error
      setStep('agents');
    } finally {
      setImporting(false);
    }
  };

  const getVoiceString = (agent: ImportableAgent): string => {
    const d = agent.details;
    if (!d) return '';
    if (typeof d.voice === 'object' && d.voice) return String(d.voice.provider ?? d.voice.voiceId ?? '');
    if (typeof d.voiceId === 'string') return d.voiceId;
    return '';
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
    <>
    <Dialog open={isOpen} onClose={handleClose} className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-gray-900 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-gray-800">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-800">
            <Dialog.Title className="text-xl font-semibold text-white">
              Import Agents
            </Dialog.Title>
            <button
              onClick={handleClose}
              disabled={importing}
              className="p-2 text-gray-400 hover:text-white transition-colors disabled:cursor-not-allowed"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
            {step === 'provider' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-white mb-2">Select Provider</h3>
                  <p className="text-gray-400 mb-6">Choose which provider you want to import agents from.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => handleProviderSelect('vapi')}
                    className="p-6 border-2 border-gray-700 hover:border-blue-500 rounded-lg transition-colors text-left"
                  >
                    <div className="text-lg font-medium text-white mb-2">VAPI</div>
                    <div className="text-sm text-gray-400">Import agents from VAPI platform</div>
                  </button>

                  <button
                    onClick={() => handleProviderSelect('retell')}
                    className="p-6 border-2 border-gray-700 hover:border-blue-500 rounded-lg transition-colors text-left"
                  >
                    <div className="text-lg font-medium text-white mb-2">Retell AI</div>
                    <div className="text-sm text-gray-400">Import agents from Retell AI platform</div>
                  </button>
                </div>
              </div>
            )}

            {step === 'apikey' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-white mb-2">
                    Enter {provider?.toUpperCase()} API Key
                  </h3>
                  <p className="text-gray-400 mb-6">
                    Provide your {provider?.toUpperCase()} API key to fetch available agents.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      API Key
                    </label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={`Enter your ${provider?.toUpperCase()} API key`}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                      >
                        {showApiKey ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep('provider')}
                      className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleFetchAgents}
                      disabled={!apiKey.trim() || loading}
                      className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
                    >
                      {loading ? (
                        <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div>
                      ) : (
                        <FiSearch className="w-4 h-4" />
                      )}
                      <span>Fetch Agents</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {step === 'agents' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-white mb-2">Select Agents to Import</h3>
                    <p className="text-gray-400">
                      Found {agents.length} agents ({availableAgents.length} available for import)
                    </p>
                  </div>
                  
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
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                  <div className="flex items-center rounded-lg border border-gray-700 overflow-hidden shrink-0">
                    {(['all', 'name', 'id', 'voice'] as const).map((field) => (
                      <button
                        key={field}
                        onClick={() => setSearchField(field)}
                        className={clsx(
                          'px-3 py-2 text-xs font-medium capitalize transition-colors',
                          searchField === field
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-800 text-gray-400 hover:text-white'
                        )}
                      >
                        {field === 'all' ? 'All' : field === 'id' ? 'ID' : field === 'voice' ? 'Voice' : 'Name'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {filteredAgents.length === 0 && (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      No agents match &ldquo;{searchQuery}&rdquo;
                    </div>
                  )}
                  {filteredAgents.map((agent) => (
                    <div
                      key={agent.id}
                      className={clsx(
                        'p-4 border rounded-lg transition-colors',
                        agent.alreadyImported
                          ? 'border-gray-700 bg-gray-800/50'
                          : selectedAgents.has(agent.id)
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-gray-700 hover:border-gray-600'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {!agent.alreadyImported && (
                            <input
                              type="checkbox"
                              checked={selectedAgents.has(agent.id)}
                              onChange={() => handleAgentToggle(agent.id)}
                              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                            />
                          )}
                          <div>
                            <div className="font-medium text-white">{agent.name}</div>
                            <div className="text-sm text-gray-400">ID: {agent.id}</div>
                            {agent.lastModified && (
                              <div className="text-xs text-gray-500">
                                Modified: {new Date(agent.lastModified).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {agent.alreadyImported && (
                            <span className="flex items-center gap-1 text-xs text-green-400">
                              <FiCheck className="w-3 h-3" />
                              Imported
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => { setStep('apikey'); setSearchQuery(''); setSearchField('all'); }}
                    className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={selectedAgents.size === 0}
                    className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    <FiDownload className="w-4 h-4" />
                    <span>Import {selectedAgents.size} Agent{selectedAgents.size !== 1 ? 's' : ''}</span>
                  </button>
                </div>
              </div>
            )}

            {step === 'importing' && (
              <div className="text-center py-12">
                <div className="animate-spin h-12 w-12 border-4 border-blue-500 rounded-full border-t-transparent mx-auto mb-4"></div>
                <h3 className="text-lg font-medium text-white mb-2">Importing Agents...</h3>
                <p className="text-gray-400">
                  Please wait while we import {selectedAgents.size} agent{selectedAgents.size !== 1 ? 's' : ''} from {provider?.toUpperCase()}.
                </p>
              </div>
            )}
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>

    {/* Upgrade Interest Modal */}
    {showUpgradeModal && upgradeModalData && (
      <UpgradeInterestModal
        isOpen={showUpgradeModal}
        onClose={() => {
          setShowUpgradeModal(false);
          setUpgradeModalData(null);
        }}
        limitType={upgradeModalData.limitType}
        currentCount={upgradeModalData.currentCount}
        maxCount={upgradeModalData.maxCount}
        attemptedCount={upgradeModalData.attemptedCount}
      />
    )}
    </>
  );
}
