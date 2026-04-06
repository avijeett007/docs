'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { FiX, FiPlus, FiCopy, FiTrash2, FiCheck, FiHelpCircle, FiBook, FiChevronDown, FiChevronRight, FiCheckSquare, FiSquare } from 'react-icons/fi';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface Customer {
  id: string;
  customerId?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  companyName?: string;
}

interface McpToken {
  id: string;
  name: string;
  description?: string;
  scope: 'all' | Array<{ appName: string; toolName: string }>;
  tokenHash: string;
  expiresAt: string;
  usageLimit: number;
  isActive: boolean;
  createdAt: string;
  customer: Customer;
}

interface McpTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTokenCreated?: () => void;
}

const McpTokenModal: React.FC<McpTokenModalProps> = ({ isOpen, onClose, onTokenCreated }) => {
  const [currentTab, setCurrentTab] = useState<'list' | 'create'>('list');
  const [tokens, setTokens] = useState<McpToken[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  // Create form state
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [tokenName, setTokenName] = useState('');
  const [tokenDescription, setTokenDescription] = useState('');
  const [scopeType, setScopeType] = useState<'all' | 'specific'>('all');
  const [usageLimit, setUsageLimit] = useState(1000);
  const [expiresIn, setExpiresIn] = useState(2592000); // 30 days

  // Tool selection state
  const [availableApps, setAvailableApps] = useState<Record<string, Array<{ appName: string; toolName: string; displayName?: string; description?: string }>>>({});
  const [selectedTools, setSelectedTools] = useState<Array<{ appName: string; toolName: string }>>([]);
  const [isLoadingTools, setIsLoadingTools] = useState(false);
  const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set());

  // Token display state
  const [newlyCreatedToken, setNewlyCreatedToken] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [showDocumentation, setShowDocumentation] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchTokens();
      fetchCustomers();
    }
  }, [isOpen]);

  // Reset token copied state when token changes
  useEffect(() => {
    if (newlyCreatedToken) {
      setTokenCopied(false);
    }
  }, [newlyCreatedToken]);

  // Fetch available tools when customer changes and scope is specific
  useEffect(() => {
    if (selectedCustomerId && scopeType === 'specific') {
      fetchAvailableTools(selectedCustomerId);
    } else {
      setAvailableApps({});
      setSelectedTools([]);
      setExpandedApps(new Set());
    }
  }, [selectedCustomerId, scopeType]);

  const fetchAvailableTools = async (customerId: string) => {
    setIsLoadingTools(true);
    try {
      const token = localStorage.getItem('partner_token');
      const response = await fetch(`/api/partner/customers/${customerId}/tool-schemas`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setAvailableApps(data.data);
          // Expand first app by default if there are apps
          const appNames = Object.keys(data.data);
          if (appNames.length > 0) {
            setExpandedApps(new Set([appNames[0]]));
          }
        } else {
          setAvailableApps({});
        }
      } else {
        toast.error('Failed to fetch available tools');
        setAvailableApps({});
      }
    } catch (error) {
      console.error('Error fetching available tools:', error);
      toast.error('Failed to fetch tools');
      setAvailableApps({});
    } finally {
      setIsLoadingTools(false);
    }
  };

  const toggleAppExpanded = (appName: string) => {
    setExpandedApps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(appName)) {
        newSet.delete(appName);
      } else {
        newSet.add(appName);
      }
      return newSet;
    });
  };

  const toggleToolSelected = (appName: string, toolName: string) => {
    setSelectedTools(prev => {
      const exists = prev.some(t => t.appName === appName && t.toolName === toolName);
      if (exists) {
        return prev.filter(t => !(t.appName === appName && t.toolName === toolName));
      } else {
        return [...prev, { appName, toolName }];
      }
    });
  };

  const selectAllToolsForApp = (appName: string) => {
    const appTools = availableApps[appName] || [];
    setSelectedTools(prev => {
      // Remove all tools from this app first
      const filtered = prev.filter(t => t.appName !== appName);
      // Add all tools from this app
      return [...filtered, ...appTools.map(t => ({ appName: t.appName, toolName: t.toolName }))];
    });
  };

  const deselectAllToolsForApp = (appName: string) => {
    setSelectedTools(prev => prev.filter(t => t.appName !== appName));
  };

  const isToolSelected = (appName: string, toolName: string) => {
    return selectedTools.some(t => t.appName === appName && t.toolName === toolName);
  };

  const getSelectedCountForApp = (appName: string) => {
    return selectedTools.filter(t => t.appName === appName).length;
  };

  const fetchTokens = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('partner_token');
      const response = await fetch('/api/partner/mcp-tokens', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTokens(data.data || []);
      } else {
        toast.error('Failed to fetch MCP tokens');
      }
    } catch (error) {
      console.error('Error fetching tokens:', error);
      toast.error('Failed to fetch tokens');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const token = localStorage.getItem('partner_token');
      const response = await fetch('/api/partner/customers', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCustomers(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const createToken = async () => {
    if (!selectedCustomerId || !tokenName) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Validate that at least one tool is selected when scope is specific
    if (scopeType === 'specific' && selectedTools.length === 0) {
      toast.error('Please select at least one tool');
      return;
    }

    setIsCreating(true);
    try {
      const token = localStorage.getItem('partner_token');
      const response = await fetch('/api/partner/mcp-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          scope: scopeType === 'all' ? 'all' : selectedTools,
          name: tokenName,
          description: tokenDescription,
          expiresIn,
          usageLimit
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.data?.token) {
          // Set token and immediately show the popup
          setNewlyCreatedToken(data.data.token);
          setShowToken(true); // Immediately show the token popup
          setTokenCopied(false); // Reset copied state
          toast.success('MCP Token created successfully!');
          // Reset form
          setSelectedCustomerId('');
          setTokenName('');
          setTokenDescription('');
          setScopeType('all');
          setSelectedTools([]);
          setAvailableApps({});
          setUsageLimit(1000);
          setExpiresIn(2592000);
          fetchTokens();
          // NOTE: Don't call onTokenCreated here - it closes the modal!
          // We'll call it when user dismisses the token display modal
        } else {
          toast.error('Token created but not returned in response');
        }
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to create token');
      }
    } catch (error) {
      console.error('Error creating token:', error);
      toast.error('Failed to create token');
    } finally {
      setIsCreating(false);
    }
  };

  const copyToken = () => {
    if (newlyCreatedToken) {
      navigator.clipboard.writeText(newlyCreatedToken);
      setTokenCopied(true);
      toast.success('Token copied to clipboard!');
      // Reset copied state after 3 seconds
      setTimeout(() => setTokenCopied(false), 3000);
    }
  };

  const revokeToken = async (tokenId: string) => {
    if (!confirm('Are you sure you want to revoke this token? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('partner_token');
      const response = await fetch(`/api/partner/mcp-tokens/${tokenId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        toast.success('Token revoked successfully');
        fetchTokens();
      } else {
        toast.error('Failed to revoke token');
      }
    } catch (error) {
      console.error('Error revoking token:', error);
      toast.error('Failed to revoke token');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCustomerName = (customer: Customer) => {
    if (customer.companyName) return customer.companyName;
    if (customer.firstName || customer.lastName) {
      return `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
    }
    return customer.email;
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-6xl transform overflow-hidden rounded-2xl bg-gray-900 border border-purple-400/20 text-left align-middle shadow-xl transition-all">
                <div className="flex justify-between items-center p-6 border-b border-gray-700">
                  <Dialog.Title as="h3" className="text-xl font-semibold text-white">
                    🔌 MCP Token Manager
                  </Dialog.Title>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setShowDocumentation(true)}
                      className="flex items-center space-x-1 px-3 py-1.5 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg transition-colors"
                      title="How to use MCP tokens"
                    >
                      <FiHelpCircle className="w-5 h-5" />
                      <span className="text-sm">Help</span>
                    </button>
                    <button
                      onClick={onClose}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <FiX className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex border-b border-gray-700">
                  <button
                    onClick={() => setCurrentTab('list')}
                    className={clsx(
                      'px-6 py-3 text-sm font-medium transition-colors',
                      currentTab === 'list'
                        ? 'text-purple-400 border-b-2 border-purple-400'
                        : 'text-gray-400 hover:text-white'
                    )}
                  >
                    Token List
                  </button>
                  <button
                    onClick={() => setCurrentTab('create')}
                    className={clsx(
                      'px-6 py-3 text-sm font-medium transition-colors',
                      currentTab === 'create'
                        ? 'text-purple-400 border-b-2 border-purple-400'
                        : 'text-gray-400 hover:text-white'
                    )}
                  >
                    Create Token
                  </button>
                </div>

                <div className="p-6">
                  {currentTab === 'list' && (
                    <TokenListSection
                      tokens={tokens}
                      isLoading={isLoading}
                      onCreateClick={() => setCurrentTab('create')}
                      onRevokeToken={revokeToken}
                      getCustomerName={getCustomerName}
                      formatDate={formatDate}
                    />
                  )}

                  {currentTab === 'create' && (
                    <CreateTokenSection
                      customers={customers}
                      selectedCustomerId={selectedCustomerId}
                      setSelectedCustomerId={setSelectedCustomerId}
                      tokenName={tokenName}
                      setTokenName={setTokenName}
                      tokenDescription={tokenDescription}
                      setTokenDescription={setTokenDescription}
                      scopeType={scopeType}
                      setScopeType={setScopeType}
                      usageLimit={usageLimit}
                      setUsageLimit={setUsageLimit}
                      expiresIn={expiresIn}
                      setExpiresIn={setExpiresIn}
                      isCreating={isCreating}
                      onCancel={() => setCurrentTab('list')}
                      onSubmit={createToken}
                      getCustomerName={getCustomerName}
                      // Tool selection props
                      availableApps={availableApps}
                      selectedTools={selectedTools}
                      isLoadingTools={isLoadingTools}
                      expandedApps={expandedApps}
                      toggleAppExpanded={toggleAppExpanded}
                      toggleToolSelected={toggleToolSelected}
                      selectAllToolsForApp={selectAllToolsForApp}
                      deselectAllToolsForApp={deselectAllToolsForApp}
                      isToolSelected={isToolSelected}
                      getSelectedCountForApp={getSelectedCountForApp}
                    />
                  )}
                </div>

                {/* Token Display Modal - Nested inside Dialog.Panel like N8nTokenModal */}
                {newlyCreatedToken ? (
                  <Transition appear show={showToken} as={Fragment}>
                    <Dialog as="div" className="relative z-[9999]" onClose={() => {
                      setShowToken(false);
                      setNewlyCreatedToken(null);
                      setCurrentTab('list');
                      onTokenCreated?.(); // Notify parent when user dismisses the token display
                    }}>
                      <Transition.Child
                        as={Fragment}
                        enter="ease-out duration-300"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="ease-in duration-200"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                      >
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
                      </Transition.Child>

                      <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4">
                          <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                          >
                            <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-gray-900 border border-green-400/20 p-6 text-left align-middle shadow-xl transition-all">
                              <div className="flex justify-between items-start mb-4">
                                <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-white">
                                  ✅ MCP Token Created Successfully!
                                </Dialog.Title>
                                <button
                                  onClick={() => {
                                    setShowToken(false);
                                    setNewlyCreatedToken(null);
                                    setCurrentTab('list');
                                    onTokenCreated?.();
                                  }}
                                  className="text-gray-400 hover:text-white transition-colors"
                                >
                                  <FiX className="w-5 h-5" />
                                </button>
                              </div>

                              <div className="mt-2">
                                <p className="text-sm text-gray-300 mb-4">
                                  Your MCP token has been created. Copy it now as it won&apos;t be shown again.
                                </p>

                                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 mb-4">
                                  <div className="flex items-center justify-between">
                                    <code className="text-green-400 text-sm break-all flex-1 mr-4">
                                      {newlyCreatedToken}
                                    </code>
                                    <button
                                      onClick={copyToken}
                                      className="ml-4 p-2 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg transition-colors"
                                      title="Copy Token"
                                    >
                                      {tokenCopied ? <FiCheck className="w-4 h-4 text-green-400" /> : <FiCopy className="w-4 h-4" />}
                                    </button>
                                  </div>
                                </div>

                                <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4 mb-4">
                                  <h4 className="text-purple-400 font-medium mb-2">Next Steps:</h4>
                                  <ol className="text-sm text-gray-300 space-y-1 list-decimal list-inside">
                                    <li>Copy the token above</li>
                                    <li>Configure your MCP client with the server URL: <code className="text-green-400">https://mcp.knotie-ai.pro/api/mcp</code></li>
                                    <li>Use Bearer authentication with this token</li>
                                    <li>Start calling tools!</li>
                                  </ol>
                                </div>
                              </div>

                              <div className="mt-6 flex justify-end space-x-3">
                                <button
                                  onClick={copyToken}
                                  className={`px-4 py-2 rounded-lg transition-colors ${
                                    tokenCopied
                                      ? 'bg-green-600 hover:bg-green-700 text-white'
                                      : 'bg-purple-600 hover:bg-purple-700 text-white'
                                  }`}
                                >
                                  {tokenCopied ? 'Copied!' : 'Copy Token'}
                                </button>
                                <button
                                  onClick={() => {
                                    setShowToken(false);
                                    setNewlyCreatedToken(null);
                                    setCurrentTab('list');
                                    onTokenCreated?.();
                                  }}
                                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                                >
                                  Done
                                </button>
                              </div>
                            </Dialog.Panel>
                          </Transition.Child>
                        </div>
                      </div>
                    </Dialog>
                  </Transition>
                ) : null}

                {/* Documentation Modal */}
                <DocumentationModal
                  isOpen={showDocumentation}
                  onClose={() => setShowDocumentation(false)}
                />
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

// Token List Section Component
interface TokenListSectionProps {
  tokens: McpToken[];
  isLoading: boolean;
  onCreateClick: () => void;
  onRevokeToken: (tokenId: string) => void;
  getCustomerName: (customer: Customer) => string;
  formatDate: (date: string) => string;
}

const TokenListSection: React.FC<TokenListSectionProps> = ({
  tokens, isLoading, onCreateClick, onRevokeToken, getCustomerName, formatDate
}) => (
  <div>
    <div className="flex justify-between items-center mb-6">
      <h4 className="text-lg font-medium text-white">Active MCP Tokens</h4>
      <button
        onClick={onCreateClick}
        className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
      >
        <FiPlus className="w-4 h-4" />
        <span>Create Token</span>
      </button>
    </div>

    {isLoading ? (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400 mx-auto"></div>
        <p className="text-gray-400 mt-2">Loading tokens...</p>
      </div>
    ) : tokens.length === 0 ? (
      <div className="text-center py-8">
        <p className="text-gray-400">No MCP tokens created yet.</p>
        <button
          onClick={onCreateClick}
          className="mt-4 text-purple-400 hover:text-purple-300 transition-colors"
        >
          Create your first MCP token →
        </button>
      </div>
    ) : (
      <div className="space-y-4">
        {tokens.map((token) => (
          <div key={token.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h5 className="text-white font-medium">{token.name}</h5>
                  <span className={clsx(
                    'px-2 py-1 text-xs font-medium rounded-full',
                    token.isActive
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  )}>
                    {token.isActive ? 'Active' : 'Revoked'}
                  </span>
                </div>

                {token.description && (
                  <p className="text-gray-400 text-sm mb-2">{token.description}</p>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Customer:</span>
                    <p className="text-white">{getCustomerName(token.customer)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Scope:</span>
                    <p className="text-white">{token.scope === 'all' ? 'All Tools' : `${Array.isArray(token.scope) ? token.scope.length : 0} Tools`}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Usage Limit:</span>
                    <p className="text-white">{token.usageLimit}/hour</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Expires:</span>
                    <p className="text-white">{formatDate(token.expiresAt)}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2 ml-4">
                {token.isActive && (
                  <button
                    onClick={() => onRevokeToken(token.id)}
                    className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Revoke Token"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

// Create Token Section Component
interface CreateTokenSectionProps {
  customers: Customer[];
  selectedCustomerId: string;
  setSelectedCustomerId: (id: string) => void;
  tokenName: string;
  setTokenName: (name: string) => void;
  tokenDescription: string;
  setTokenDescription: (desc: string) => void;
  scopeType: 'all' | 'specific';
  setScopeType: (type: 'all' | 'specific') => void;
  usageLimit: number;
  setUsageLimit: (limit: number) => void;
  expiresIn: number;
  setExpiresIn: (expires: number) => void;
  isCreating: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  getCustomerName: (customer: Customer) => string;
  // Tool selection props
  availableApps: Record<string, Array<{ appName: string; toolName: string; displayName?: string; description?: string }>>;
  selectedTools: Array<{ appName: string; toolName: string }>;
  isLoadingTools: boolean;
  expandedApps: Set<string>;
  toggleAppExpanded: (appName: string) => void;
  toggleToolSelected: (appName: string, toolName: string) => void;
  selectAllToolsForApp: (appName: string) => void;
  deselectAllToolsForApp: (appName: string) => void;
  isToolSelected: (appName: string, toolName: string) => boolean;
  getSelectedCountForApp: (appName: string) => number;
}

const CreateTokenSection: React.FC<CreateTokenSectionProps> = ({
  customers, selectedCustomerId, setSelectedCustomerId, tokenName, setTokenName,
  tokenDescription, setTokenDescription, scopeType, setScopeType, usageLimit,
  setUsageLimit, expiresIn, setExpiresIn, isCreating, onCancel, onSubmit, getCustomerName,
  availableApps, selectedTools, isLoadingTools, expandedApps, toggleAppExpanded,
  toggleToolSelected, selectAllToolsForApp, deselectAllToolsForApp, isToolSelected, getSelectedCountForApp
}) => (
  <div>
    <h4 className="text-lg font-medium text-white mb-6">Create New MCP Token</h4>

    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Customer *</label>
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            required
          >
            <option value="">Select a customer</option>
            {customers.filter(c => c.customerId).map((customer) => (
              <option key={customer.id} value={customer.customerId}>{getCustomerName(customer)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Token Name *</label>
          <input
            type="text"
            value={tokenName}
            onChange={(e) => setTokenName(e.target.value)}
            placeholder="e.g., Production MCP Token"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
        <textarea
          value={tokenDescription}
          onChange={(e) => setTokenDescription(e.target.value)}
          placeholder="Optional description for this token"
          rows={3}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Tool Scope</label>
          <select
            value={scopeType}
            onChange={(e) => setScopeType(e.target.value as 'all' | 'specific')}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            disabled={!selectedCustomerId}
          >
            <option value="all">All Tools</option>
            <option value="specific">Specific Tools</option>
          </select>
          {!selectedCustomerId && scopeType === 'specific' && (
            <p className="text-xs text-gray-500 mt-1">Select a customer first</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Usage Limit (per hour)</label>
          <input
            type="number"
            value={usageLimit}
            onChange={(e) => setUsageLimit(parseInt(e.target.value) || 1000)}
            min="1"
            max="10000"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Expires In</label>
          <select
            value={expiresIn}
            onChange={(e) => setExpiresIn(parseInt(e.target.value))}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value={86400}>1 Day</option>
            <option value={604800}>7 Days</option>
            <option value={2592000}>30 Days</option>
            <option value={7776000}>90 Days</option>
            <option value={31536000}>1 Year</option>
          </select>
        </div>
      </div>

      {/* Tool Selection UI - Only show when scope is specific */}
      {scopeType === 'specific' && selectedCustomerId && (
        <div className="border border-purple-500/30 rounded-lg p-4 bg-purple-500/5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h5 className="text-white font-medium">Select Tools</h5>
              <p className="text-gray-400 text-sm">
                {selectedTools.length === 0
                  ? 'Select which tools this token can access'
                  : `${selectedTools.length} tool${selectedTools.length > 1 ? 's' : ''} selected`}
              </p>
            </div>
          </div>

          {isLoadingTools ? (
            <div className="text-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-400 mx-auto"></div>
              <p className="text-gray-400 mt-2 text-sm">Loading available tools...</p>
            </div>
          ) : Object.keys(availableApps).length === 0 ? (
            <div className="text-center py-6">
              <p className="text-gray-400 text-sm">No connected apps found for this customer.</p>
              <p className="text-gray-500 text-xs mt-1">The customer needs to connect apps through the portal first.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {Object.entries(availableApps).map(([appName, tools]) => (
                <div key={appName} className="border border-gray-700 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleAppExpanded(appName)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-800 hover:bg-gray-750 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      {expandedApps.has(appName) ? (
                        <FiChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <FiChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                      <span className="text-white font-medium capitalize">{appName}</span>
                      <span className="text-gray-500 text-sm">({tools.length} tools)</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-purple-400 text-sm">
                        {getSelectedCountForApp(appName)}/{tools.length} selected
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (getSelectedCountForApp(appName) === tools.length) {
                            deselectAllToolsForApp(appName);
                          } else {
                            selectAllToolsForApp(appName);
                          }
                        }}
                        className="text-xs px-2 py-1 rounded bg-purple-600/20 text-purple-400 hover:bg-purple-600/30"
                      >
                        {getSelectedCountForApp(appName) === tools.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                  </button>
                  {expandedApps.has(appName) && (
                    <div className="bg-gray-900 p-2 space-y-1">
                      {tools.map((tool) => (
                        <button
                          key={`${tool.appName}_${tool.toolName}`}
                          type="button"
                          onClick={() => toggleToolSelected(tool.appName, tool.toolName)}
                          className={clsx(
                            'w-full flex items-start space-x-3 px-3 py-2 rounded-lg text-left transition-colors',
                            isToolSelected(tool.appName, tool.toolName)
                              ? 'bg-purple-600/20 border border-purple-500/50'
                              : 'hover:bg-gray-800'
                          )}
                        >
                          {isToolSelected(tool.appName, tool.toolName) ? (
                            <FiCheckSquare className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                          ) : (
                            <FiSquare className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className={clsx(
                              'font-medium text-sm',
                              isToolSelected(tool.appName, tool.toolName) ? 'text-purple-300' : 'text-white'
                            )}>
                              {tool.displayName || tool.toolName}
                            </p>
                            {tool.description && (
                              <p className="text-gray-500 text-xs truncate">{tool.description}</p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end space-x-4">
        <button onClick={onCancel} className="px-6 py-2 text-gray-400 hover:text-white transition-colors">
          Cancel
        </button>
        <button
          onClick={onSubmit}
          disabled={isCreating || !selectedCustomerId || !tokenName || (scopeType === 'specific' && selectedTools.length === 0)}
          className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
        >
          {isCreating ? 'Creating...' : 'Create Token'}
        </button>
      </div>
    </div>
  </div>
);

// Documentation Modal Component
interface DocumentationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DocumentationModal: React.FC<DocumentationModalProps> = ({ isOpen, onClose }) => (
  <Transition appear show={isOpen} as={Fragment}>
    <Dialog as="div" className="relative z-[9999]" onClose={onClose}>
      <Transition.Child
        as={Fragment}
        enter="ease-out duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="ease-in duration-200"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
      </Transition.Child>

      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-gray-900 border border-purple-400/20 p-6 text-left align-middle shadow-xl transition-all max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center space-x-3">
                  <FiBook className="w-6 h-6 text-purple-400" />
                  <Dialog.Title as="h3" className="text-xl font-semibold text-white">
                    How to Use MCP Tokens
                  </Dialog.Title>
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                {/* What is MCP */}
                <section>
                  <h4 className="text-lg font-medium text-purple-400 mb-2">What is MCP?</h4>
                  <p className="text-gray-300 text-sm">
                    MCP (Model Context Protocol) is an open standard that allows AI applications to connect with external
                    tools and data sources. Your MCP token provides secure access to 100+ integrated tools through a
                    standardized JSON-RPC 2.0 interface.
                  </p>
                </section>

                {/* Server Details */}
                <section className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h4 className="text-lg font-medium text-purple-400 mb-3">Server Configuration</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-400">Server URL:</span>
                      <code className="text-green-400 bg-gray-900 px-2 py-1 rounded">https://mcp.knotie-ai.pro</code>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-400">Transport:</span>
                      <code className="text-blue-400 bg-gray-900 px-2 py-1 rounded">HTTP (Streamable)</code>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-400">Authentication:</span>
                      <code className="text-yellow-400 bg-gray-900 px-2 py-1 rounded">Bearer Token</code>
                    </div>
                  </div>
                </section>

                {/* N8N Setup */}
                <section>
                  <h4 className="text-lg font-medium text-purple-400 mb-3">Setup with N8N MCP Nodes</h4>
                  <ol className="text-sm text-gray-300 space-y-3 list-decimal list-inside">
                    <li>In your N8N workflow, add an <strong className="text-white">MCP Client</strong> node</li>
                    <li>Configure the MCP Client with these settings:
                      <pre className="mt-2 bg-gray-800 rounded-lg p-3 text-xs overflow-x-auto border border-gray-700">
{`{
  "serverUrl": "https://mcp.knotie-ai.pro/api/mcp",
  "transport": "http",
  "authentication": {
    "type": "bearer",
    "token": "YOUR_MCP_TOKEN"
  }
}`}
                      </pre>
                    </li>
                    <li>Use the <strong className="text-white">MCP Tool</strong> node to call any connected tool</li>
                  </ol>
                </section>

                {/* Claude Desktop Setup */}
                <section>
                  <h4 className="text-lg font-medium text-purple-400 mb-3">Setup with Claude Desktop</h4>
                  <ol className="text-sm text-gray-300 space-y-3 list-decimal list-inside">
                    <li>Open Claude Desktop settings and navigate to MCP configuration</li>
                    <li>Add a new MCP server with this configuration:
                      <pre className="mt-2 bg-gray-800 rounded-lg p-3 text-xs overflow-x-auto border border-gray-700">
{`{
  "mcpServers": {
    "knotie": {
      "url": "https://mcp.knotie-ai.pro/api/mcp",
      "transport": "http",
      "headers": {
        "Authorization": "Bearer YOUR_MCP_TOKEN"
      }
    }
  }
}`}
                      </pre>
                    </li>
                    <li>Restart Claude Desktop to apply the changes</li>
                  </ol>
                </section>

                {/* MCP Lifecycle */}
                <section>
                  <h4 className="text-lg font-medium text-purple-400 mb-3">MCP Protocol Lifecycle</h4>
                  <p className="text-sm text-gray-300 mb-3">
                    The MCP protocol follows a specific lifecycle. All methods use a single unified endpoint:
                  </p>
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 mb-3">
                    <code className="text-green-400">POST https://mcp.knotie-ai.pro/api/mcp</code>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                      <div className="flex items-center space-x-2">
                        <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded">1</span>
                        <code className="text-yellow-400">initialize</code>
                      </div>
                      <p className="text-gray-400 mt-1 ml-6">Client sends initialize request → Server responds with capabilities</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                      <div className="flex items-center space-x-2">
                        <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded">2</span>
                        <code className="text-yellow-400">notifications/initialized</code>
                      </div>
                      <p className="text-gray-400 mt-1 ml-6">Client sends notification (no id) → Server responds with 202 Accepted</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                      <div className="flex items-center space-x-2">
                        <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded">3</span>
                        <code className="text-yellow-400">tools/list</code>
                      </div>
                      <p className="text-gray-400 mt-1 ml-6">List all available tools for your customer</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                      <div className="flex items-center space-x-2">
                        <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded">4</span>
                        <code className="text-yellow-400">tools/call</code>
                      </div>
                      <p className="text-gray-400 mt-1 ml-6">Execute a tool with the specified parameters</p>
                    </div>
                  </div>
                </section>

                {/* Tool Naming */}
                <section className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                  <h4 className="text-purple-400 font-medium mb-2">💡 Tool Naming Convention</h4>
                  <p className="text-sm text-gray-300">
                    Tools are named in the format: <code className="text-green-400">appname_toolname</code><br />
                    Examples: <code className="text-yellow-400">gmail_send_email</code>, <code className="text-yellow-400">slack_post_message</code>, <code className="text-yellow-400">hubspot_create_contact</code>
                  </p>
                </section>

                {/* Credits Info */}
                <section className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                  <h4 className="text-yellow-400 font-medium mb-2">⚡ Credit Usage</h4>
                  <p className="text-sm text-gray-300">
                    Each tool call consumes <strong className="text-white">0.03 AI credits</strong>. Make sure you have
                    sufficient credits in your account before executing tool calls.
                  </p>
                </section>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                >
                  Got it!
                </button>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </div>
    </Dialog>
  </Transition>
);

export default McpTokenModal;

