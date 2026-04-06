'use client';

import React, { useState, useMemo } from 'react';
import { Dialog } from '@headlessui/react';
import { FiX, FiSearch, FiDownload, FiCheck, FiLoader, FiMessageCircle, FiEye, FiEyeOff, FiLayers } from 'react-icons/fi';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface RetellAgent {
  agent_id: string;
  agent_name: string;
  response_engine?: any;
  language: string;
  alreadyImported: boolean;
  version?: number;
  is_published?: boolean;
  version_title?: string;
}

interface Customer {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  companyName?: string;
}

interface RetellChatAgentImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  onImportComplete: () => void;
}

export default function RetellChatAgentImportModal({
  isOpen,
  onClose,
  customers,
  onImportComplete,
}: RetellChatAgentImportModalProps) {
  const [step, setStep] = useState<'apikey' | 'list' | 'configure' | 'importing'>('apikey');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [agents, setAgents] = useState<RetellAgent[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<RetellAgent | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [importing, setImporting] = useState(false);
  const [showAllVersions, setShowAllVersions] = useState(false);

  // Configuration for import
  const [customerId, setCustomerId] = useState('');
  const [creditConfig, setCreditConfig] = useState({
    billing_mode: 'per_conversation' as string,
    credits_per_unit: 1,
    minimum_credits: 1,
  });

  const handleClose = () => {
    if (!importing) {
      setStep('apikey');
      setApiKey('');
      setAgents([]);
      setSelectedAgent(null);
      setSearchQuery('');
      setCustomerId('');
      setShowAllVersions(false);
      onClose();
    }
  };

  const fetchAgentsFromRetell = async () => {
    if (!apiKey.trim()) {
      toast.error('Please enter your Retell API key');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch('/api/partner/retell-chat-agents/list-from-retell', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        setAgents(data.agents || []);
        const available = (data.agents || []).filter((a: RetellAgent) => !a.alreadyImported);
        if (available.length === 0) {
          toast('All Retell Chat agents have already been imported', { icon: 'ℹ️' });
        } else {
          toast.success(`Found ${available.length} chat agent(s) available for import`);
        }
        setStep('list');
      } else {
        const error = await response.json();
        if (response.status === 401) {
          toast.error('Invalid API key. Please check and try again.');
        } else {
          toast.error(error.error || 'Failed to fetch agents from Retell');
        }
      }
    } catch (error) {
      toast.error('Failed to fetch agents from Retell');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAgent = (agent: RetellAgent) => {
    if (agent.alreadyImported) return;
    // Always select the latest version for import, regardless of which version tile was clicked
    const latestVersion = getLatestVersion(agent.agent_id);
    setSelectedAgent(latestVersion || agent);
    setStep('configure');
  };

  const handleImport = async () => {
    if (!selectedAgent) return;
    try {
      setImporting(true);
      setStep('importing');
      const token = localStorage.getItem('partner_token');

      const response = await fetch('/api/partner/retell-chat-agents', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          retellAgentId: selectedAgent.agent_id,
          apiKey: apiKey.trim(),
          customerId: customerId || undefined,
          creditConfig,
        }),
      });

      if (response.ok) {
        toast.success(`Successfully imported "${selectedAgent.agent_name}"`);
        onImportComplete();
        handleClose();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Import failed');
        setStep('configure');
      }
    } catch (error) {
      toast.error('Import failed');
      setStep('configure');
    } finally {
      setImporting(false);
    }
  };

  const getCustomerName = (c: Customer) =>
    c.companyName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email;

  // Deduplicate agents: group by agent_id, keep only the latest version by default
  const deduplicatedAgents = useMemo(() => {
    if (showAllVersions) return agents;

    const latestByAgentId = new Map<string, RetellAgent>();
    for (const agent of agents) {
      const existing = latestByAgentId.get(agent.agent_id);
      if (!existing || (agent.version ?? 0) > (existing.version ?? 0)) {
        latestByAgentId.set(agent.agent_id, agent);
      }
    }
    return Array.from(latestByAgentId.values());
  }, [agents, showAllVersions]);

  // Count how many agents have multiple versions
  const hasMultipleVersions = useMemo(() => {
    const versionCounts = new Map<string, number>();
    for (const agent of agents) {
      versionCounts.set(agent.agent_id, (versionCounts.get(agent.agent_id) || 0) + 1);
    }
    return Array.from(versionCounts.values()).some(count => count > 1);
  }, [agents]);

  // Find the latest version for a given agent_id (used during import)
  const getLatestVersion = (agentId: string): RetellAgent | undefined => {
    const versions = agents.filter(a => a.agent_id === agentId);
    return versions.reduce((latest, current) =>
      (current.version ?? 0) > (latest.version ?? 0) ? current : latest
    , versions[0]);
  };

  const filteredAgents = deduplicatedAgents.filter(
    (a) =>
      a.agent_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.agent_id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onClose={handleClose} className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-gray-900 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-gray-800">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-800">
            <Dialog.Title className="text-xl font-semibold text-white">
              Import Retell Chat Agent
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
            {/* Step 1: API Key */}
            {step === 'apikey' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-white mb-2">
                    Enter Retell API Key
                  </h3>
                  <p className="text-gray-400 mb-6">
                    Provide your Retell API key to fetch available chat agents for import.
                    The key will be stored securely (encrypted) with each imported agent.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Retell API Key</label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Enter your Retell API key (key_...)"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white pr-12"
                        onKeyDown={(e) => e.key === 'Enter' && apiKey.trim() && fetchAgentsFromRetell()}
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                      >
                        {showApiKey ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Find your API key at{' '}
                      <a href="https://www.retellai.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300">
                        retellai.com/dashboard
                      </a>
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={fetchAgentsFromRetell}
                      disabled={!apiKey.trim() || loading}
                      className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors text-white font-medium"
                    >
                      {loading ? (
                        <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div>
                      ) : (
                        <FiSearch className="w-4 h-4" />
                      )}
                      <span>Fetch Chat Agents</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Agent List */}
            {step === 'list' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-white mb-2">Select a Chat Agent to Import</h3>
                    <p className="text-gray-400">
                      Found {deduplicatedAgents.length} chat agent{deduplicatedAgents.length !== 1 ? 's' : ''} ({deduplicatedAgents.filter(a => !a.alreadyImported).length} available for import)
                    </p>
                  </div>
                  {hasMultipleVersions && (
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={showAllVersions}
                        onChange={(e) => setShowAllVersions(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                      />
                      <span className="flex items-center gap-1 text-sm text-gray-300">
                        <FiLayers className="w-3.5 h-3.5" />
                        Show all versions
                      </span>
                    </label>
                  )}
                </div>

                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name or ID..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin h-6 w-6 border-2 border-emerald-500 rounded-full border-t-transparent"></div>
                    <span className="ml-3 text-gray-400">Fetching agents from Retell...</span>
                  </div>
                ) : filteredAgents.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <FiMessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                    <p>No chat agents found.</p>
                    <button onClick={fetchAgentsFromRetell} className="mt-3 text-emerald-400 hover:text-emerald-300 text-sm">
                      Retry
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                    {filteredAgents.map((agent) => (
                      <div
                        key={`${agent.agent_id}-v${agent.version ?? 0}`}
                        onClick={() => !agent.alreadyImported && handleSelectAgent(agent)}
                        className={clsx(
                          'p-4 border rounded-lg transition-colors',
                          agent.alreadyImported
                            ? 'border-gray-700 bg-gray-800/50 opacity-60'
                            : 'border-gray-700 hover:border-emerald-500 cursor-pointer'
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-white">{agent.agent_name}</span>
                              {/* Version badge */}
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-700 text-gray-300 border border-gray-600">
                                v{agent.version ?? 0}
                              </span>
                              {agent.is_published && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                  Published
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-400 mb-2 font-mono">ID: {agent.agent_id}</div>
                            <div className="space-y-1">
                              <div className="text-xs text-gray-500">
                                Engine: {agent.response_engine?.type || 'unknown'}
                              </div>
                              <div className="text-xs text-gray-500">
                                Language: {agent.language}
                              </div>
                              {showAllVersions && agent.version_title && (
                                <div className="text-xs text-gray-500">
                                  Title: {agent.version_title}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {agent.alreadyImported ? (
                              <span className="flex items-center gap-1 text-xs text-green-400">
                                <FiCheck className="w-3 h-3" />
                                Imported
                              </span>
                            ) : (
                              <FiDownload className="w-4 h-4 text-emerald-400" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => { setStep('apikey'); setSearchQuery(''); }}
                    className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Configure */}
            {step === 'configure' && selectedAgent && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-white mb-2">Configure Import</h3>
                  <p className="text-gray-400">Set up customer assignment and billing for this agent.</p>
                </div>

                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-400">Selected Agent</div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Latest Version (v{selectedAgent.version ?? 0})
                    </span>
                  </div>
                  <div className="text-lg font-medium text-white mt-1">{selectedAgent.agent_name}</div>
                  <div className="text-xs text-gray-400 mt-1">{selectedAgent.response_engine?.type || 'unknown'} · {selectedAgent.language}</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Assign to Customer (Optional)</label>
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                  >
                    <option value="">No customer assigned</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{getCustomerName(c)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Billing Mode</label>
                  <select
                    value={creditConfig.billing_mode}
                    onChange={(e) => setCreditConfig({ ...creditConfig, billing_mode: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                  >
                    <option value="per_conversation">Per Conversation</option>
                    <option value="per_message_pair">Per Message Pair</option>
                    <option value="per_10_messages">Per 10 Messages</option>
                    <option value="per_minute">Per Minute</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Credits per Unit</label>
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={creditConfig.credits_per_unit}
                      onChange={(e) => setCreditConfig({ ...creditConfig, credits_per_unit: parseFloat(e.target.value) || 1 })}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Minimum Credits</label>
                    <input
                      type="number"
                      min="1"
                      value={creditConfig.minimum_credits}
                      onChange={(e) => setCreditConfig({ ...creditConfig, minimum_credits: parseInt(e.target.value) || 1 })}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('list')}
                    className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleImport}
                    className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors text-white font-medium"
                  >
                    <FiDownload className="w-4 h-4" />
                    <span>Import Agent</span>
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Importing */}
            {step === 'importing' && (
              <div className="text-center py-12">
                <div className="animate-spin h-12 w-12 border-4 border-emerald-500 rounded-full border-t-transparent mx-auto mb-4"></div>
                <h3 className="text-lg font-medium text-white mb-2">Importing Chat Agent...</h3>
                <p className="text-gray-400">
                  Please wait while we import and configure the agent.
                </p>
                <div className="mt-4 text-sm text-gray-500">
                  This includes registering with analytics and configuring webhooks.
                </div>
              </div>
            )}
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}

