'use client';

import React, { useState, useEffect } from 'react';
import { FiX, FiCheck, FiAlertCircle, FiPhone, FiDownload, FiLock, FiUsers } from 'react-icons/fi';

interface Provider {
  id: string;
  name: string;
  displayName: string;
  description: string;
  disabled?: boolean;
  disabledReason?: string;
  category?: string; // 'telephony' | 'agent_provider'
  credentialFields: Array<{
    key: string;
    label: string;
    type: string;
    placeholder: string;
    required: boolean;
    description: string;
  }>;
  hasSavedCredentials: boolean;
  savedCredential?: {
    id: string;
    accountIdentifier: string;
    lastValidated: string;
  };
}

interface Customer {
  id: string;
  name: string;
  email: string;
  customerId?: string; // The actual Customer ID from the Customer table
}

interface RetellAgentConfig {
  id: string;
  name: string;
  enableWebhook: boolean;
  webhookMode: 'automatic' | 'manual';
  preExistingWebhookUrl: string;
  forwardToPreExisting: boolean;
}

interface PhoneNumberImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export default function PhoneNumberImportModal({ isOpen, onClose, onImportComplete }: PhoneNumberImportModalProps) {
  // For telephony providers: 1→2→3→4(success). For agent providers: 1→2→3→4(customer/webhook)→5(success)
  const [step, setStep] = useState(1);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const saveCredentials = true; // Always save credentials automatically
  const [availableNumbers, setAvailableNumbers] = useState<any[]>([]);
  const [selectedNumbers, setSelectedNumbers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Retell-specific state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [profitMultiplier, setProfitMultiplier] = useState(1.2);
  const [importAgents, setImportAgents] = useState(true);
  const [agentConfigs, setAgentConfigs] = useState<RetellAgentConfig[]>([]);
  const [importProgress, setImportProgress] = useState<{ imported: number; total: number; agents: number } | null>(null);

  const isAgentProvider = selectedProvider?.category === 'agent_provider';

  useEffect(() => {
    if (isOpen) {
      loadProviders();
    }
  }, [isOpen]);

  const getToken = () => localStorage.getItem('partner_token');

  const loadProviders = async () => {
    try {
      const token = getToken();
      if (!token) return;

      const response = await fetch('/api/partner/phone-numbers/import/providers', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setProviders(data.data.providers);
      }
    } catch (error) {
      console.error('Error loading providers:', error);
    }
  };

  const loadCustomers = async () => {
    try {
      const token = getToken();
      if (!token) return;

      const response = await fetch('/api/partner/customers', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        let rawArray: any[] = [];
        if (Array.isArray(data)) {
          rawArray = data;
        } else if (data && typeof data === 'object') {
          rawArray = data.customers || data.data || [];
        }
        // Map UserOnboarding records to Customer interface and filter for valid Customer records
        const customersArray: Customer[] = rawArray
          .filter((c: any) => c.customerId) // Only show customers with valid Customer records
          .map((c: any) => ({
            id: c.id,
            name: c.companyName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email,
            email: c.email,
            customerId: c.customerId,
          }));
        setCustomers(customersArray);
      }
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const validateCredentials = async () => {
    if (!selectedProvider) return;

    setLoading(true);
    setError('');

    try {
      const token = getToken();
      if (!token) {
        setError('Authentication token not found');
        return;
      }

      // For agent providers (Retell), use the provider-specific list endpoint
      if (isAgentProvider && selectedProvider.id === 'retell') {
        const response = await fetch('/api/partner/phone-numbers/import/retell/list', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ apiKey: credentials.apiKey })
        });

        const data = await response.json();
        if (data.success) {
          setAvailableNumbers(data.data.numbers);
          // Build agent configs from unique agent IDs across all numbers
          const agentIdSet = new Set<string>();
          data.data.numbers.forEach((n: any) => {
            (n.associated_agent_ids || []).forEach((id: string) => agentIdSet.add(id));
          });
          setAgentConfigs(
            Array.from(agentIdSet).map((id) => ({
              id,
              name: id, // Will be resolved during import
              enableWebhook: true,
              webhookMode: 'automatic' as const,
              preExistingWebhookUrl: '',
              forwardToPreExisting: true,
            }))
          );
          // Pre-load customers for step 4
          loadCustomers();
          setStep(3);
        } else {
          setError(data.error || data.message || 'Invalid API key or failed to load numbers');
        }
      } else {
        // Existing telephony provider flow
        const response = await fetch('/api/partner/phone-numbers/import/validate-credentials', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            provider: selectedProvider.id,
            credentials
          })
        });

        const data = await response.json();

        if (data.success) {
          const numbersResponse = await fetch('/api/partner/phone-numbers/import/list', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              provider: selectedProvider.id,
              credentials
            })
          });

          const numbersData = await numbersResponse.json();
          if (numbersData.success) {
            setAvailableNumbers(numbersData.data.numbers);
            setStep(3);
          } else {
            setError(numbersData.message || 'Failed to load phone numbers');
          }
        } else {
          setError(data.message || 'Invalid credentials');
        }
      }
    } catch (error) {
      setError('Failed to validate credentials');
    } finally {
      setLoading(false);
    }
  };

  const importNumbers = async () => {
    if (!selectedProvider || selectedNumbers.length === 0) return;

    setLoading(true);
    setError('');

    try {
      const token = getToken();
      if (!token) {
        setError('Authentication token not found');
        return;
      }

      if (isAgentProvider && selectedProvider.id === 'retell') {
        // Retell provider import — uses the retell/execute endpoint
        const selectedNumObjs = availableNumbers.filter(num => selectedNumbers.includes(num.phone_number));

        const numbersToImport = selectedNumObjs.map(num => ({
          phone_number: num.phone_number,
          phone_number_type: num.phone_number_type,
          nickname: num.nickname || undefined,
          inbound_agent_id: num.inbound_agent_id || undefined,
          outbound_agent_id: num.outbound_agent_id || undefined,
        }));

        // Collect unique agent IDs from selected numbers
        const selectedAgentIds = new Set<string>();
        selectedNumObjs.forEach(num => {
          (num.associated_agent_ids || []).forEach((id: string) => selectedAgentIds.add(id));
        });

        // Compute per-agent role: which numbers use this agent for inbound vs outbound
        const agentRoles = new Map<string, Set<'inbound' | 'outbound'>>();
        selectedNumObjs.forEach(num => {
          if (num.inbound_agent_id) {
            const roles = agentRoles.get(num.inbound_agent_id) || new Set<'inbound' | 'outbound'>();
            roles.add('inbound');
            agentRoles.set(num.inbound_agent_id, roles);
          }
          if (num.outbound_agent_id) {
            const roles = agentRoles.get(num.outbound_agent_id) || new Set<'inbound' | 'outbound'>();
            roles.add('outbound');
            agentRoles.set(num.outbound_agent_id, roles);
          }
        });

        const agentsPayload = importAgents
          ? agentConfigs
              .filter(a => selectedAgentIds.has(a.id))
              .map(a => {
                const roles = agentRoles.get(a.id);
                const role: 'inbound' | 'outbound' | 'both' =
                  !roles || (roles.has('inbound') && roles.has('outbound'))
                    ? 'both'
                    : roles.has('inbound') ? 'inbound' : 'outbound';
                return {
                  id: a.id,
                  role,
                  enableWebhook: a.enableWebhook,
                  webhookMode: a.webhookMode,
                  preExistingWebhookUrl: a.preExistingWebhookUrl || undefined,
                  forwardToPreExisting: a.forwardToPreExisting,
                };
              })
          : [];

        const response = await fetch('/api/partner/phone-numbers/import/retell/execute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            apiKey: credentials.apiKey,
            customerId: selectedCustomerId,
            profitMultiplier,
            numbers: numbersToImport,
            importAgents,
            agents: agentsPayload,
          })
        });

        const data = await response.json();

        if (data.success) {
          setImportProgress({
            imported: data.data?.importedNumbers || numbersToImport.length,
            total: numbersToImport.length,
            agents: data.data?.importedAgents || 0,
          });
          setStep(5);
          setTimeout(() => {
            onImportComplete();
            onClose();
            resetModal();
          }, 3000);
        } else {
          setError(data.message || data.error || 'Failed to import numbers');
        }
      } else {
        // Existing telephony provider flow
        const numbersToImport = availableNumbers
          .filter(num => selectedNumbers.includes(num.id))
          .map(num => ({
            id: num.id,
            phoneNumber: num.phoneNumber,
            friendlyName: num.friendlyName
          }));

        const response = await fetch('/api/partner/phone-numbers/import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            provider: selectedProvider.id,
            credentials,
            numbers: numbersToImport,
            saveCredentials
          })
        });

        const data = await response.json();

        if (data.success) {
          setStep(4);
          setTimeout(() => {
            onImportComplete();
            onClose();
            resetModal();
          }, 2000);
        } else {
          setError(data.message || 'Failed to import numbers');
        }
      }
    } catch (error) {
      setError('Failed to import numbers');
    } finally {
      setLoading(false);
    }
  };

  const resetModal = () => {
    setStep(1);
    setSelectedProvider(null);
    setCredentials({});
    setAvailableNumbers([]);
    setSelectedNumbers([]);
    setError('');
    setCustomers([]);
    setSelectedCustomerId('');
    setProfitMultiplier(1.2);
    setImportAgents(true);
    setAgentConfigs([]);
    setImportProgress(null);
  };

  const handleClose = () => {
    onClose();
    resetModal();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Import Phone Numbers</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
              <FiAlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-red-400 text-sm">{error}</span>
            </div>
          )}

          {/* Step 1: Provider Selection */}
          {step === 1 && (
            <div>
              <h3 className="text-lg font-medium text-white mb-4">Select Provider</h3>

              {/* Telephony Providers */}
              {providers.filter(p => p.category !== 'agent_provider').length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Telephony Providers</h4>
                  <div className="space-y-3">
                    {providers.filter(p => p.category !== 'agent_provider').map((provider) => (
                      <ProviderCard key={provider.id} provider={provider} selected={selectedProvider?.id === provider.id} onSelect={setSelectedProvider} />
                    ))}
                  </div>
                </div>
              )}

              {/* Agent Providers */}
              {providers.filter(p => p.category === 'agent_provider').length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <FiLock className="w-3 h-3" /> Agent Provider Numbers
                  </h4>
                  <p className="text-gray-500 text-xs mb-3">
                    Numbers purchased directly from an AI agent provider. These are locked to agents from the same provider account.
                  </p>
                  <div className="space-y-3">
                    {providers.filter(p => p.category === 'agent_provider').map((provider) => (
                      <ProviderCard key={provider.id} provider={provider} selected={selectedProvider?.id === provider.id} onSelect={setSelectedProvider} isAgentProvider />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Credentials */}
          {step === 2 && selectedProvider && (
            <div>
              <h3 className="text-lg font-medium text-white mb-4">
                Enter {selectedProvider.displayName} Credentials
              </h3>
              
              {selectedProvider.hasSavedCredentials && (
                <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <p className="text-green-400 text-sm">
                    ✓ You have saved credentials for this provider. You can use them or enter new ones.
                  </p>
                </div>
              )}

              <div className="space-y-4">
                {selectedProvider.credentialFields.map((field) => (
                  <div key={field.key}>
                    <label className="block text-gray-300 text-sm font-medium mb-2">
                      {field.label}
                      {field.required && <span className="text-red-400 ml-1">*</span>}
                    </label>
                    <input
                      type={field.type}
                      placeholder={field.placeholder}
                      value={credentials[field.key] || ''}
                      onChange={(e) => setCredentials(prev => ({
                        ...prev,
                        [field.key]: e.target.value
                      }))}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-gray-400 text-xs mt-1">{field.description}</p>
                  </div>
                ))}

                <div className="flex items-start p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                  <div className="flex items-start">
                    <div className="w-5 h-5 bg-blue-500/20 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0">
                      <svg className="w-3 h-3 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-blue-300 font-medium">
                        Credentials Saved Automatically
                      </p>
                      <p className="text-xs text-blue-200/80 mt-1">
                        Your credentials will be securely encrypted and saved for future imports and managing your voice AI agents.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Number Selection */}
          {step === 3 && (
            <div>
              <h3 className="text-lg font-medium text-white mb-4">Select Numbers to Import</h3>
              <p className="text-gray-400 text-sm mb-4">
                Found {availableNumbers.length} numbers. Select which ones to import.
              </p>

              {isAgentProvider && (
                <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-center gap-2">
                  <FiLock className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                  <span className="text-yellow-400 text-sm">These numbers are locked to {selectedProvider?.displayName} agents from this account.</span>
                </div>
              )}

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {availableNumbers.map((number) => {
                  const numberId = isAgentProvider ? number.phone_number : number.id;
                  const isAlreadyImported = isAgentProvider && number.already_imported;
                  return (
                    <div
                      key={numberId}
                      className={`flex items-center gap-3 p-3 border rounded-lg ${isAlreadyImported ? 'border-gray-700 opacity-60' : 'border-gray-600'}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedNumbers.includes(numberId)}
                        disabled={isAlreadyImported}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedNumbers(prev => [...prev, numberId]);
                          } else {
                            setSelectedNumbers(prev => prev.filter(id => id !== numberId));
                          }
                        }}
                        className="rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="text-white font-medium">
                          {isAgentProvider ? number.phone_number : number.phoneNumber}
                        </div>
                        {(isAgentProvider ? number.nickname : number.friendlyName) && (
                          <div className="text-gray-400 text-sm">{isAgentProvider ? number.nickname : number.friendlyName}</div>
                        )}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {isAlreadyImported ? (
                            <span className="text-yellow-400 text-xs">⚠ Already imported</span>
                          ) : isAgentProvider ? (
                            <span className="text-green-400 text-xs">✓ Available ({number.phone_number_type})</span>
                          ) : number.canImport ? (
                            <span className="text-green-400 text-xs">✓ Available</span>
                          ) : (
                            <span className="text-red-400 text-xs">✗ Unavailable</span>
                          )}
                          {isAgentProvider && number.associated_agent_ids?.length > 0 && (
                            <span className="text-blue-400 text-xs flex items-center gap-1">
                              <FiUsers className="w-3 h-3" />
                              {number.associated_agent_ids.length} agent{number.associated_agent_ids.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {isAgentProvider && (
                <div className="mt-4 flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg">
                  <input
                    type="checkbox"
                    checked={importAgents}
                    onChange={(e) => setImportAgents(e.target.checked)}
                    className="rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-white text-sm font-medium">Import associated agents</span>
                    <p className="text-gray-400 text-xs">Automatically import Retell agents linked to the selected numbers</p>
                  </div>
                </div>
              )}

              <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-blue-400 text-sm">
                  Selected {selectedNumbers.length} numbers.
                  {isAgentProvider
                    ? ' You will configure customer mapping and webhooks in the next step.'
                    : ' These will be imported to your partner inventory and can be assigned to customers later.'}
                </p>
              </div>
            </div>
          )}

          {/* Step 4: Customer & Webhook Setup (Agent Providers only) */}
          {step === 4 && isAgentProvider && (
            <div>
              <h3 className="text-lg font-medium text-white mb-4">Customer & Webhook Setup</h3>

              {/* Customer Selection */}
              <div className="mb-6">
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Select Customer <span className="text-red-400">*</span>
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a customer...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
                  ))}
                </select>
                <p className="text-yellow-400 text-xs mt-2 flex items-center gap-1">
                  <FiAlertCircle className="w-3 h-3" />
                  Required — the outbound webhook uses the customer to check AI credits.
                </p>
              </div>

              {/* Profit Multiplier */}
              <div className="mb-6">
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Profit Multiplier
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="10"
                  value={profitMultiplier}
                  onChange={(e) => setProfitMultiplier(parseFloat(e.target.value) || 1.2)}
                  className="w-32 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-gray-400 text-xs mt-1">Applied to AI usage costs for billing (default: 1.2x)</p>
              </div>

              {/* Per-Agent Webhook Configuration */}
              {importAgents && agentConfigs.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-3">Agent Webhook Configuration</h4>
                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {agentConfigs.map((agent, idx) => (
                      <div key={agent.id} className="p-3 border border-gray-600 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white text-sm font-medium">Agent: {agent.id.substring(0, 16)}...</span>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={agent.enableWebhook}
                              onChange={(e) => {
                                const updated = [...agentConfigs];
                                updated[idx] = { ...updated[idx], enableWebhook: e.target.checked };
                                setAgentConfigs(updated);
                              }}
                              className="rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
                            />
                            <span className="text-gray-400 text-xs">Enable analytics webhook</span>
                          </label>
                        </div>
                        {agent.enableWebhook && (
                          <div className="space-y-2 mt-2">
                            <div className="flex items-center gap-3">
                              <label className="text-gray-400 text-xs w-20">Mode:</label>
                              <select
                                value={agent.webhookMode}
                                onChange={(e) => {
                                  const updated = [...agentConfigs];
                                  updated[idx] = { ...updated[idx], webhookMode: e.target.value as 'automatic' | 'manual' };
                                  setAgentConfigs(updated);
                                }}
                                className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                              >
                                <option value="automatic">Automatic</option>
                                <option value="manual">Manual</option>
                              </select>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={agent.forwardToPreExisting}
                                onChange={(e) => {
                                  const updated = [...agentConfigs];
                                  updated[idx] = { ...updated[idx], forwardToPreExisting: e.target.checked };
                                  setAgentConfigs(updated);
                                }}
                                className="rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
                              />
                              <span className="text-gray-400 text-xs">Forward to pre-existing webhook URL</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Success (Telephony providers) */}
          {step === 4 && !isAgentProvider && (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiCheck className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Import Successful!</h3>
              <p className="text-gray-400">
                {selectedNumbers.length} phone numbers have been imported to your inventory.
              </p>
            </div>
          )}

          {/* Step 5: Success (Agent providers) */}
          {step === 5 && isAgentProvider && (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiCheck className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Import Successful!</h3>
              <p className="text-gray-400">
                {importProgress?.imported || selectedNumbers.length} phone numbers
                {importProgress?.agents ? ` and ${importProgress.agents} agents` : ''} have been imported.
              </p>
              <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-left">
                <p className="text-blue-400 text-sm">
                  ✓ Numbers are provider-locked to {selectedProvider?.displayName}<br />
                  ✓ Customer mapping configured<br />
                  {importProgress?.agents ? '✓ Agents imported with webhook configuration' : ''}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-700">
          <div className="flex items-center gap-2">
            {(isAgentProvider ? [1, 2, 3, 4, 5] : [1, 2, 3, 4]).map((stepNum) => (
              <div
                key={stepNum}
                className={`w-2 h-2 rounded-full ${
                  step >= stepNum ? 'bg-blue-500' : 'bg-gray-600'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-3">
            {step > 1 && step < (isAgentProvider ? 5 : 4) && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 text-gray-300 hover:text-white"
              >
                Back
              </button>
            )}

            {step === 1 && (
              <button
                onClick={() => selectedProvider && setStep(2)}
                disabled={!selectedProvider}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            )}

            {step === 2 && (
              <button
                onClick={validateCredentials}
                disabled={loading || !selectedProvider?.credentialFields.every(field =>
                  !field.required || credentials[field.key]
                )}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Validate & Load Numbers
              </button>
            )}

            {step === 3 && !isAgentProvider && (
              <button
                onClick={importNumbers}
                disabled={loading || selectedNumbers.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                <FiDownload className="w-4 h-4" />
                Import {selectedNumbers.length} Numbers
              </button>
            )}

            {step === 3 && isAgentProvider && (
              <button
                onClick={() => setStep(4)}
                disabled={selectedNumbers.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next: Customer Setup
              </button>
            )}

            {step === 4 && isAgentProvider && (
              <button
                onClick={importNumbers}
                disabled={loading || !selectedCustomerId}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                <FiDownload className="w-4 h-4" />
                Import {selectedNumbers.length} Numbers
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Reusable provider card for Step 1 */
function ProviderCard({
  provider,
  selected,
  onSelect,
  isAgentProvider,
}: {
  provider: Provider;
  selected: boolean;
  onSelect: (p: Provider) => void;
  isAgentProvider?: boolean;
}) {
  return (
    <div
      onClick={() => !provider.disabled && onSelect(provider)}
      className={`p-4 border rounded-lg transition-colors relative ${
        provider.disabled
          ? 'border-gray-700 opacity-50 cursor-not-allowed'
          : selected
          ? 'border-blue-500 bg-blue-500/10 cursor-pointer'
          : 'border-gray-600 hover:border-gray-500 cursor-pointer'
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <h4 className={`font-medium ${provider.disabled ? 'text-gray-400' : 'text-white'}`}>
            {provider.displayName}
            {isAgentProvider && (
              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30">
                <FiLock className="w-2.5 h-2.5 mr-1" />Provider Locked
              </span>
            )}
          </h4>
          <p className={`text-sm ${provider.disabled ? 'text-gray-500' : 'text-gray-400'}`}>
            {provider.description}
          </p>
          {provider.hasSavedCredentials && !provider.disabled && (
            <p className="text-green-400 text-xs mt-1">✓ Saved credentials available</p>
          )}
        </div>
        <FiPhone className={`w-6 h-6 ${provider.disabled ? 'text-gray-500' : 'text-gray-400'}`} />
      </div>
      {provider.disabled && provider.disabledReason && (
        <div className="absolute top-2 right-2">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
            {provider.disabledReason}
          </span>
        </div>
      )}
    </div>
  );
}
