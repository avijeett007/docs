'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { FiX, FiPlus, FiCopy, FiTrash2, FiEdit3, FiEye, FiEyeOff } from 'react-icons/fi';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface Customer {
  id: string; // UserOnboarding ID
  customerId?: string; // Actual Customer table ID (used for Composio integration)
  firstName?: string;
  lastName?: string;
  email: string;
  companyName?: string;
}

interface N8nToken {
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

interface N8nTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const N8nTokenModal: React.FC<N8nTokenModalProps> = ({ isOpen, onClose }) => {
  const [currentTab, setCurrentTab] = useState<'list' | 'create'>('list');
  const [tokens, setTokens] = useState<N8nToken[]>([]);
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
  
  // Token display state
  const [newlyCreatedToken, setNewlyCreatedToken] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchTokens();
      fetchCustomers();
    }
  }, [isOpen]);

  // Auto-show token modal when token is created
  useEffect(() => {
    if (newlyCreatedToken && !showToken) {
      console.log('Auto-showing token modal');
      setShowToken(true);
    }
  }, [newlyCreatedToken]);

  const fetchTokens = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('partner_token');
      const response = await fetch('/api/partner/n8n-tokens', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTokens(data.data || []);
      } else {
        toast.error('Failed to fetch tokens');
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

    setIsCreating(true);
    try {
      const token = localStorage.getItem('partner_token');
      const response = await fetch('/api/partner/n8n-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          scope: scopeType === 'all' ? 'all' : [], // TODO: Add specific tool selection
          name: tokenName,
          description: tokenDescription,
          expiresIn,
          usageLimit
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Token creation response:', data); // Debug log
        console.log('Token value:', data.data?.token); // Debug log

        if (data.data?.token) {
          console.log('Setting token state:', data.data.token);
          setNewlyCreatedToken(data.data.token);
          toast.success('Token created successfully!');

          // Reset form
          setSelectedCustomerId('');
          setTokenName('');
          setTokenDescription('');
          setScopeType('all');
          setUsageLimit(1000);
          setExpiresIn(2592000);

          // Refresh tokens list
          fetchTokens();
          // Don't switch tabs immediately - let user see the token first
          // setCurrentTab('list');
        } else {
          console.error('No token in response:', data);
          toast.error('Token created but not returned in response');
        }
      } else {
        const errorData = await response.json();
        console.error('Token creation failed:', errorData);
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
      toast.success('Token copied to clipboard!');
    }
  };

  const revokeToken = async (tokenId: string) => {
    if (!confirm('Are you sure you want to revoke this token? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('partner_token');
      const response = await fetch(`/api/partner/n8n-tokens/${tokenId}`, {
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
              <Dialog.Panel className="w-full max-w-6xl transform overflow-hidden rounded-2xl bg-gray-900 border border-blue-400/20 text-left align-middle shadow-xl transition-all">
                <div className="flex justify-between items-center p-6 border-b border-gray-700">
                  <Dialog.Title as="h3" className="text-xl font-semibold text-white">
                    🔗 N8N Token Manager
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <FiX className="w-6 h-6" />
                  </button>
                </div>

                {/* Tab Navigation */}
                <div className="flex border-b border-gray-700">
                  <button
                    onClick={() => setCurrentTab('list')}
                    className={clsx(
                      'px-6 py-3 text-sm font-medium transition-colors',
                      currentTab === 'list'
                        ? 'text-blue-400 border-b-2 border-blue-400'
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
                        ? 'text-blue-400 border-b-2 border-blue-400'
                        : 'text-gray-400 hover:text-white'
                    )}
                  >
                    Create Token
                  </button>
                </div>

                <div className="p-6">
                  {currentTab === 'list' ? (
                    <div>
                      <div className="flex justify-between items-center mb-6">
                        <h4 className="text-lg font-medium text-white">Active Tokens</h4>
                        <button
                          onClick={() => setCurrentTab('create')}
                          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                        >
                          <FiPlus className="w-4 h-4" />
                          <span>Create Token</span>
                        </button>
                      </div>

                      {isLoading ? (
                        <div className="text-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
                          <p className="text-gray-400 mt-2">Loading tokens...</p>
                        </div>
                      ) : tokens.length === 0 ? (
                        <div className="text-center py-8">
                          <p className="text-gray-400">No tokens created yet.</p>
                          <button
                            onClick={() => setCurrentTab('create')}
                            className="mt-4 text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            Create your first token →
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
                                  
                                  {token.description ? (
                                    <p className="text-gray-400 text-sm mb-2">{token.description}</p>
                                  ) : null}
                                  
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
                                  {token.isActive ? (
                                    <button
                                      onClick={() => revokeToken(token.id)}
                                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                                      title="Revoke Token"
                                    >
                                      <FiTrash2 className="w-4 h-4" />
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}

                  {currentTab === 'create' ? (
                    <div>
                      <h4 className="text-lg font-medium text-white mb-6">Create New N8N Token</h4>
                      
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              Customer *
                            </label>
                            <select
                              value={selectedCustomerId}
                              onChange={(e) => setSelectedCustomerId(e.target.value)}
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              required
                            >
                              <option value="">Select a customer</option>
                              {customers
                                .filter(customer => customer.customerId) // Only show customers with Customer table ID
                                .map((customer) => (
                                <option key={customer.id} value={customer.customerId}>
                                  {getCustomerName(customer)}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              Token Name *
                            </label>
                            <input
                              type="text"
                              value={tokenName}
                              onChange={(e) => setTokenName(e.target.value)}
                              placeholder="e.g., Production N8N Token"
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Description
                          </label>
                          <textarea
                            value={tokenDescription}
                            onChange={(e) => setTokenDescription(e.target.value)}
                            placeholder="Optional description for this token"
                            rows={3}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              Tool Scope
                            </label>
                            <select
                              value={scopeType}
                              onChange={(e) => setScopeType(e.target.value as 'all' | 'specific')}
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="all">All Tools</option>
                              <option value="specific" disabled>Specific Tools (Coming Soon)</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              Usage Limit (per hour)
                            </label>
                            <input
                              type="number"
                              value={usageLimit}
                              onChange={(e) => setUsageLimit(parseInt(e.target.value) || 1000)}
                              min="1"
                              max="10000"
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              Expires In (days)
                            </label>
                            <select
                              value={expiresIn}
                              onChange={(e) => setExpiresIn(parseInt(e.target.value))}
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value={86400}>1 Day</option>
                              <option value={604800}>7 Days</option>
                              <option value={2592000}>30 Days</option>
                              <option value={7776000}>90 Days</option>
                              <option value={31536000}>1 Year</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex justify-end space-x-4">
                          <button
                            onClick={() => setCurrentTab('list')}
                            className="px-6 py-2 text-gray-400 hover:text-white transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => createToken()}
                            disabled={isCreating || !selectedCustomerId || !tokenName}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                          >
                            {isCreating ? 'Creating...' : 'Create Token'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Token Display Modal */}
                {newlyCreatedToken ? (
                  <Transition appear show={showToken} as={Fragment}>
                    <Dialog as="div" className="relative z-[9999]" onClose={() => setShowToken(false)}>
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
                                  ✅ Token Created Successfully!
                                </Dialog.Title>
                                <button
                                  onClick={() => {
                                    setShowToken(false);
                                    setCurrentTab('list');
                                  }}
                                  className="text-gray-400 hover:text-white transition-colors"
                                >
                                  <FiX className="w-5 h-5" />
                                </button>
                              </div>

                              <div className="mt-2">
                                <p className="text-sm text-gray-300 mb-4">
                                  Your N8N token has been created. Copy it now as it won't be shown again.
                                </p>

                                <div className="bg-gray-800 border border-gray-600 rounded-lg p-4 mb-4">
                                  <div className="flex items-center justify-between">
                                    <code className="text-green-400 text-sm font-mono break-all">
                                      {newlyCreatedToken}
                                    </code>
                                    <button
                                      onClick={copyToken}
                                      className="ml-4 p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors"
                                      title="Copy Token"
                                    >
                                      <FiCopy className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>

                                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-4">
                                  <h4 className="text-blue-400 font-medium mb-2">Next Steps:</h4>
                                  <ol className="text-sm text-gray-300 space-y-1 list-decimal list-inside">
                                    <li>Copy the token above</li>
                                    <li>Install the Knotie N8N node in your N8N instance</li>
                                    <li>Use this token in the node's authentication settings</li>
                                    <li>Start building workflows with 100+ integrated tools</li>
                                  </ol>
                                </div>

                                <p className="text-xs text-gray-400">
                                  This token provides access to all tools integrated by your selected customer.
                                </p>
                              </div>

                              <div className="mt-6 flex justify-end space-x-4">
                                <button
                                  onClick={copyToken}
                                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                                >
                                  Copy Token
                                </button>
                                <button
                                  onClick={() => {
                                    setShowToken(false);
                                    setCurrentTab('list');
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
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default N8nTokenModal;
