'use client';

import React, { useState, useEffect } from 'react';
import {
  FiX,
  FiPlay,
  FiCopy,
  FiExternalLink,
  FiVideo,
  FiBook,
  FiSettings,
  FiUser,
  FiServer,
  FiKey,
  FiCheck,
  FiAlertCircle,
  FiPlus,
  FiEdit,
  FiTrash2,
  FiHelpCircle
} from 'react-icons/fi';
import toast from 'react-hot-toast';

interface WorkflowProduct {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: string;
  tags: string[];
  estimatedSetupTime: number | null;
  setupVideoUrl: string | null;
  documentationUrl: string | null;
  blogArticleUrl: string | null;
}

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface N8nInstance {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  connectionStatus: string;
  createdAt?: string;
}

interface N8nToken {
  id: string;
  customerName: string;
  customerId: string;
}

interface WorkflowDeploymentModalProps {
  product: WorkflowProduct;
  onClose: () => void;
  onSuccess: () => void;
}

const WorkflowDeploymentModal: React.FC<WorkflowDeploymentModalProps> = ({
  product,
  onClose,
  onSuccess
}) => {
  const [step, setStep] = useState<'setup' | 'deploy' | 'success'>('setup');
  const [deploymentMode, setDeploymentMode] = useState<'automatic' | 'manual'>('manual');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [n8nInstances, setN8nInstances] = useState<N8nInstance[]>([]);
  const [n8nTokens, setN8nTokens] = useState<N8nToken[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [selectedInstance, setSelectedInstance] = useState<string>('');
  const [selectedToken, setSelectedToken] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workflowJson, setWorkflowJson] = useState<any>(null);

  // N8N Instance Management
  const [showInstanceForm, setShowInstanceForm] = useState(false);
  const [instanceForm, setInstanceForm] = useState({
    name: '',
    baseUrl: '',
    apiKey: ''
  });
  const [showApiKeyHelp, setShowApiKeyHelp] = useState(false);

  // Fetch data on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('partner_token');
        if (!token) return;

        const headers = { 'Authorization': `Bearer ${token}` };

        // Fetch customers, N8N instances, and tokens in parallel
        const [customersRes, instancesRes, tokensRes] = await Promise.all([
          fetch('/api/partner/customers', { headers }),
          fetch('/api/partner/n8n-instances', { headers }),
          fetch('/api/partner/n8n-tokens', { headers })
        ]);

        if (customersRes.ok) {
          const customersData = await customersRes.json();
          setCustomers(customersData.data || []);
        }

        if (instancesRes.ok) {
          const instancesData = await instancesRes.json();
          setN8nInstances(instancesData.data || []);
        }

        if (tokensRes.ok) {
          const tokensData = await tokensRes.json();
          setN8nTokens(tokensData.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
        setError('Failed to load deployment options');
      }
    };

    fetchData();
  }, []);

  // N8N Instance Management Functions
  const handleAddInstance = async () => {
    if (!instanceForm.name || !instanceForm.baseUrl || !instanceForm.apiKey) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('partner_token');

      const response = await fetch('/api/partner/n8n-instances', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(instanceForm)
      });

      const data = await response.json();

      if (data.success) {
        setN8nInstances([...n8nInstances, data.data]);
        setSelectedInstance(data.data.id); // Auto-select the newly created instance
        setInstanceForm({ name: '', baseUrl: '', apiKey: '' });
        setShowInstanceForm(false);
        toast.success('N8N instance added successfully');
      } else {
        toast.error(data.error || 'Failed to add N8N instance');
      }
    } catch (error) {
      console.error('Failed to add N8N instance:', error);
      toast.error('Failed to add N8N instance');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteInstance = async (instanceId: string) => {
    try {
      const token = localStorage.getItem('partner_token');

      const response = await fetch(`/api/partner/n8n-instances/${instanceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setN8nInstances(n8nInstances.filter(instance => instance.id !== instanceId));
        if (selectedInstance === instanceId) {
          setSelectedInstance('');
        }
        toast.success('N8N instance deleted successfully');
      } else {
        toast.error('Failed to delete N8N instance');
      }
    } catch (error) {
      console.error('Failed to delete N8N instance:', error);
      toast.error('Failed to delete N8N instance');
    }
  };

  // Fetch workflow JSON when needed
  const fetchWorkflowJson = async () => {
    try {
      const response = await fetch(`/api/partner/n8n-workflow-products/${product.id}`);
      const data = await response.json();

      if (data.success) {
        setWorkflowJson(data.data.workflowJson);
      }
    } catch (error) {
      console.error('Failed to fetch workflow JSON:', error);
    }
  };

  const handleDeploy = async () => {
    if (deploymentMode === 'automatic') {
      // Automatic deployment is disabled
      setError('Automatic deployment is not available yet. Please use manual deployment.');
      return;
    } else {
      // Manual deployment - show workflow JSON
      await fetchWorkflowJson();
      setStep('deploy');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  const getSelectedCustomerName = () => {
    const customer = customers.find(c => c.id === selectedCustomer);
    return customer ? `${customer.firstName} ${customer.lastName}` : '';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg border border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-white">Deploy Workflow</h2>
            <p className="text-gray-400">{product.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <FiX className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {step === 'setup' && (
            <div className="space-y-6">
              {/* Getting Started Guide */}
              <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4">Getting Started with N8N Workflows</h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">1</div>
                    <div>
                      <h4 className="font-medium text-white">Install the Knotie N8N Node</h4>
                      <p className="text-gray-400 text-sm mt-1">Add the community node to your N8N instance via Settings → Community Nodes</p>
                      <code className="inline-block mt-2 px-2 py-1 bg-gray-800 text-green-400 text-sm rounded">n8n-nodes-knotie</code>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">2</div>
                    <div>
                      <h4 className="font-medium text-white">Create an N8N Token</h4>
                      <p className="text-gray-400 text-sm mt-1">Generate a secure token for a specific customer with access to their tools</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">3</div>
                    <div>
                      <h4 className="font-medium text-white">Configure Credentials</h4>
                      <p className="text-gray-400 text-sm mt-1">Set up Knotie API credentials in N8N with your token and ConnectHub URL</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">4</div>
                    <div>
                      <h4 className="font-medium text-white">Deploy Workflows</h4>
                      <p className="text-gray-400 text-sm mt-1">Create powerful automation workflows using the Knotie node with 100+ tools</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Product Info */}
              <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-2">{product.name}</h3>
                <p className="text-gray-400 mb-4">{product.description}</p>

                {/* Resources */}
                <div className="flex items-center gap-2 mb-4">
                  {product.setupVideoUrl && (
                    <a
                      href={product.setupVideoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm transition-colors"
                    >
                      <FiVideo className="w-4 h-4" />
                      Watch Setup Video
                    </a>
                  )}
                  {product.documentationUrl && (
                    <a
                      href={product.documentationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors"
                    >
                      <FiBook className="w-4 h-4" />
                      View Documentation
                    </a>
                  )}
                </div>

                {product.estimatedSetupTime && (
                  <p className="text-sm text-gray-400">
                    Estimated setup time: {product.estimatedSetupTime} minutes
                  </p>
                )}
              </div>

              {/* Deployment Mode */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Deployment Mode</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div
                    className="p-4 rounded-lg border cursor-not-allowed transition-colors border-gray-600 bg-gray-800/50 opacity-50"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <FiPlay className="w-5 h-5 text-gray-500" />
                      <h4 className="font-medium text-gray-400">Automatic Deployment</h4>
                      <span className="text-xs bg-yellow-600 text-yellow-100 px-2 py-1 rounded-full">Coming Soon</span>
                    </div>
                    <p className="text-sm text-gray-500">
                      Deploy directly to your N8N instance with customer credentials
                    </p>
                  </div>

                  <div
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      deploymentMode === 'manual'
                        ? 'border-blue-500 bg-blue-900/20'
                        : 'border-gray-600 hover:border-gray-500'
                    }`}
                    onClick={() => setDeploymentMode('manual')}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <FiCopy className="w-5 h-5 text-green-400" />
                      <h4 className="font-medium text-white">Manual Copy</h4>
                    </div>
                    <p className="text-sm text-gray-400">
                      Get the workflow JSON to manually import into N8N
                    </p>
                  </div>
                </div>
              </div>

              {/* Automatic Deployment Options */}
              {deploymentMode === 'automatic' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white">Deployment Configuration</h3>

                  {/* Customer Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      <FiUser className="inline w-4 h-4 mr-2" />
                      Select Customer
                    </label>
                    <select
                      value={selectedCustomer}
                      onChange={(e) => setSelectedCustomer(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Choose a customer...</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.firstName} {customer.lastName} ({customer.email})
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">
                      A Knotie token and N8N credentials will be automatically created for this customer
                    </p>
                  </div>

                  {/* N8N Instance Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      <FiServer className="inline w-4 h-4 mr-2" />
                      Select N8N Instance
                    </label>
                    <select
                      value={selectedInstance}
                      onChange={(e) => {
                        if (e.target.value === 'add_new') {
                          setShowInstanceForm(true);
                          setSelectedInstance('');
                        } else {
                          setSelectedInstance(e.target.value);
                        }
                      }}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Choose an N8N instance...</option>
                      <option value="add_new" className="text-blue-400">+ Add New N8N Instance</option>
                      {n8nInstances.map((instance) => (
                        <option key={instance.id} value={instance.id}>
                          {instance.name} ({instance.baseUrl})
                          {instance.connectionStatus === 'connected' ? ' ✓' : ' ⚠️'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Add Instance Form (inline) */}
                  {showInstanceForm && (
                    <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium text-white">Add New N8N Instance</h4>
                        <button
                          onClick={() => setShowInstanceForm(false)}
                          className="text-gray-400 hover:text-white"
                        >
                          <FiX className="w-4 h-4" />
                        </button>
                      </div>

                      {/* API Key Help */}
                      <div className="bg-blue-900/20 border border-blue-500 rounded-lg p-3 mb-4">
                        <div className="flex items-start gap-2">
                          <FiHelpCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                          <div className="text-sm">
                            <p className="text-white font-medium mb-1">How to get your N8N API Key:</p>
                            <ol className="text-gray-300 text-xs space-y-1 list-decimal list-inside">
                              <li>Go to your N8N instance Settings → API</li>
                              <li>Click "Create API Key" or use an existing one</li>
                              <li>Make sure it has workflow and credential management permissions</li>
                            </ol>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">Instance Name</label>
                          <input
                            type="text"
                            value={instanceForm.name}
                            onChange={(e) => setInstanceForm({...instanceForm, name: e.target.value})}
                            placeholder="e.g., Production N8N"
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">Base URL</label>
                          <input
                            type="url"
                            value={instanceForm.baseUrl}
                            onChange={(e) => setInstanceForm({...instanceForm, baseUrl: e.target.value})}
                            placeholder="https://your-n8n-instance.com"
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">API Key</label>
                          <input
                            type="password"
                            value={instanceForm.apiKey}
                            onChange={(e) => setInstanceForm({...instanceForm, apiKey: e.target.value})}
                            placeholder="Your N8N API Key"
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setShowInstanceForm(false);
                              setInstanceForm({ name: '', baseUrl: '', apiKey: '' });
                            }}
                            className="px-3 py-2 text-gray-400 hover:text-white text-sm transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleAddInstance}
                            disabled={loading}
                            className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                          >
                            {loading ? 'Adding...' : 'Add Instance'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 flex items-center gap-3">
                  <FiAlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <p className="text-red-400">{error}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeploy}
                  disabled={loading || deploymentMode === 'automatic'}
                  className={`px-6 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                    deploymentMode === 'automatic'
                      ? 'bg-gray-600 cursor-not-allowed text-gray-400'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Loading...
                    </>
                  ) : (
                    <>
                      <FiSettings className="w-4 h-4" />
                      {deploymentMode === 'automatic' ? 'Coming Soon' : 'Get Workflow JSON'}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}



          {step === 'deploy' && workflowJson && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Workflow JSON</h3>
                <p className="text-gray-400 mb-4">
                  Copy this JSON and import it into your N8N instance. Make sure to configure the Knotie credentials for customer: <strong>{getSelectedCustomerName()}</strong>
                </p>
              </div>

              <div className="relative">
                <pre className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-sm text-gray-300 overflow-auto max-h-96">
                  {JSON.stringify(workflowJson, null, 2)}
                </pre>
                <button
                  onClick={() => copyToClipboard(JSON.stringify(workflowJson, null, 2))}
                  className="absolute top-2 right-2 p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                  title="Copy to clipboard"
                >
                  <FiCopy className="w-4 h-4 text-gray-300" />
                </button>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
                <button
                  onClick={() => setStep('setup')}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={onSuccess}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  <FiCheck className="w-4 h-4" />
                  Done
                </button>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto">
                <FiCheck className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">Deployment Started!</h3>
                <p className="text-gray-400">
                  The workflow is being deployed to your N8N instance. You can monitor the progress in your deployments dashboard.
                </p>
              </div>
              <button
                onClick={onSuccess}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkflowDeploymentModal;
