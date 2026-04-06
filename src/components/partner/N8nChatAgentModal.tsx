'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { FiX, FiLoader, FiMessageCircle, FiSettings, FiExternalLink, FiCopy, FiCheck, FiAlertTriangle } from 'react-icons/fi';
import { useForm } from 'react-hook-form';
// import { zodResolver } from '@hookform/resolvers/zod'; // Temporarily disabled
import { z } from 'zod';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface Customer {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  companyName?: string;
  monthlyCallVolume?: number;
  estimatedPrice?: number;
  priceBreakdown?: any;
  orderStatus?: string;
  userId?: string;
  isOnboardingCompleted?: boolean;
  customerId?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface N8nChatAgent {
  id: string;
  name: string;
  description?: string;
  customer_id: string;
  integration_mode: 'custom_node' | 'proxy';
  n8n_webhook_url?: string;
  webhook_secret: string;
  status: 'active' | 'inactive' | 'testing';
  credit_config?: {
    billing_mode: 'per_conversation' | 'per_message_pair' | 'per_10_messages' | 'per_minute';
    credits_per_unit: number;
    minimum_credits: number;
  };
}

interface N8nChatAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<any>;
  customers: Customer[];
  editingAgent?: N8nChatAgent | null;
}

// Credit billing configuration schema
const creditConfigSchema = z.object({
  billing_mode: z.enum(['per_conversation', 'per_message_pair', 'per_10_messages', 'per_minute'], {
    required_error: 'Billing mode is required'
  }).default('per_conversation'),
  credits_per_unit: z.number().min(0.1, 'Credits per unit must be at least 0.1').default(1),
  minimum_credits: z.number().min(1, 'Minimum credits must be at least 1').default(1),
});

// Validation schema
const agentSchema = z.object({
  name: z.string().min(1, 'Agent name is required'),
  description: z.string().optional(),
  customer_id: z.string().min(1, 'Customer selection is required'),
  integration_mode: z.enum(['custom_node', 'proxy'], {
    required_error: 'Integration mode is required'
  }),
  n8n_webhook_url: z.string().url('Valid webhook URL is required').optional(),
  status: z.enum(['active', 'inactive', 'testing']).default('testing'),
  credit_config: creditConfigSchema.default({
    billing_mode: 'per_conversation',
    credits_per_unit: 1,
    minimum_credits: 1
  }),
}).refine((data) => {
  // For proxy mode, n8n_webhook_url is required
  if (data.integration_mode === 'proxy' && !data.n8n_webhook_url) {
    return false;
  }
  return true;
}, {
  message: "N8N Webhook URL is required for proxy mode",
  path: ["n8n_webhook_url"]
});

type AgentFormData = z.infer<typeof agentSchema>;

const N8nChatAgentModal: React.FC<N8nChatAgentModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  customers,
  editingAgent
}) => {
  const [loading, setLoading] = useState(false);
  const [webhookSecret, setWebhookSecret] = useState('');
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookTestResult, setWebhookTestResult] = useState<'success' | 'failed' | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
    getValues
  } = useForm<any>({
    // resolver: zodResolver(agentSchema), // Temporarily disabled for build
    defaultValues: {
      name: '',
      description: '',
      customer_id: '',
      integration_mode: 'proxy',
      n8n_webhook_url: '',
      status: 'testing' as const,
      credit_config: {
        billing_mode: 'per_conversation' as const,
        credits_per_unit: 1,
        minimum_credits: 1
      }
    }
  });

  const watchedIntegrationMode = watch('integration_mode');
  const watchedWebhookUrl = watch('n8n_webhook_url');

  // Generate webhook secret on mount or when editing
  useEffect(() => {
    if (editingAgent) {
      // Populate form with existing data
      setValue('name', editingAgent.name);
      setValue('description', editingAgent.description || '');
      setValue('customer_id', editingAgent.customer_id);
      setValue('integration_mode', editingAgent.integration_mode);
      setValue('n8n_webhook_url', editingAgent.n8n_webhook_url || '');
      setValue('status', editingAgent.status);

      // Set credit configuration with defaults if not present
      const creditConfig = editingAgent.credit_config || {
        billing_mode: 'per_conversation',
        credits_per_unit: 1,
        minimum_credits: 1
      };
      setValue('credit_config.billing_mode', creditConfig.billing_mode);
      setValue('credit_config.credits_per_unit', creditConfig.credits_per_unit);
      setValue('credit_config.minimum_credits', creditConfig.minimum_credits);

      setWebhookSecret(editingAgent.webhook_secret);
    } else {
      // Generate new webhook secret for new agents
      const secret = generateWebhookSecret();
      setWebhookSecret(secret);
    }
  }, [editingAgent, setValue]);

  const generateWebhookSecret = () => {
    return 'wh_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  };

  const testWebhookConnection = async () => {
    const webhookUrl = getValues('n8n_webhook_url');
    if (!webhookUrl) {
      toast.error('Please enter a webhook URL first');
      return;
    }

    setTestingWebhook(true);
    setWebhookTestResult(null);

    try {
      // Test webhook connectivity
      const response = await fetch('/api/partner/n8n-chat-agents/test-webhook', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('partner_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          webhook_url: webhookUrl,
          webhook_secret: webhookSecret
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setWebhookTestResult('success');
          toast.success('Webhook connection test successful!');
        } else {
          setWebhookTestResult('failed');
          toast.error(`Webhook test failed: ${result.test_result?.error_message || result.message}`);
        }
      } else {
        setWebhookTestResult('failed');
        const errorData = await response.json().catch(() => ({}));
        toast.error(`Webhook test failed: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      setWebhookTestResult('failed');
      toast.error('Failed to test webhook connection');
    } finally {
      setTestingWebhook(false);
    }
  };

  const onFormSubmit = async (data: AgentFormData) => {
    setLoading(true);
    try {
      const agentData = {
        ...data,
        webhook_secret: webhookSecret
      };

      await onSubmit(agentData);
      reset();
      setWebhookSecret('');
      setWebhookTestResult(null);
    } catch (error) {
      // Error handling is done in the parent component
    } finally {
      setLoading(false);
    }
  };

  const copyWebhookSecret = () => {
    navigator.clipboard.writeText(webhookSecret);
    toast.success('Webhook secret copied to clipboard!');
  };

  const getCustomerDisplayName = (customer: Customer) => {
    if (customer.companyName) {
      return customer.companyName;
    }
    if (customer.firstName || customer.lastName) {
      return `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
    }
    return customer.email || customer.id;
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
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-gray-800 p-6 text-left align-middle shadow-xl transition-all border border-gray-700">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <FiMessageCircle className="w-6 h-6 text-blue-400" />
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-white">
                      {editingAgent ? 'Edit N8N Chat Agent' : 'Create N8N Chat Agent'}
                    </Dialog.Title>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <FiX className="w-6 h-6" />
                  </button>
                </div>

                <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
                  {/* Basic Information */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-300 border-b border-gray-700 pb-2">
                      Basic Information
                    </h4>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Agent Name *
                      </label>
                      <input
                        {...register('name')}
                        type="text"
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., Customer Support Chat Agent"
                      />
                      {errors.name && (
                        <p className="mt-1 text-sm text-red-400">{(errors.name as any)?.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Description
                      </label>
                      <textarea
                        {...register('description')}
                        rows={3}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Brief description of what this chat agent does..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Customer *
                      </label>
                      <select
                        {...register('customer_id')}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select a customer...</option>
                        {customers
                          .filter(customer => customer.customerId) // Only show customers with valid Customer records
                          .map((customer) => (
                            <option key={customer.id} value={customer.customerId}>
                              {getCustomerDisplayName(customer)}
                            </option>
                          ))}
                      </select>
                      {errors.customer_id && (
                        <p className="mt-1 text-sm text-red-400">{(errors.customer_id as any)?.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Integration Mode */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-300 border-b border-gray-700 pb-2">
                      Integration Configuration
                    </h4>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-3">
                        Integration Mode *
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Proxy Mode - ENABLED */}
                        <label className={clsx(
                          'relative flex cursor-pointer rounded-lg border p-4 focus:outline-none',
                          watchedIntegrationMode === 'proxy'
                            ? 'border-green-500 bg-green-500/10'
                            : 'border-gray-600 bg-gray-700/50'
                        )}>
                          <input
                            {...register('integration_mode')}
                            type="radio"
                            value="proxy"
                            className="sr-only"
                          />
                          <div className="flex items-center justify-between w-full">
                            <div className="text-sm">
                              <div className="flex items-center gap-2 mb-1">
                                <FiSettings className="w-4 h-4 text-green-400" />
                                <span className="font-medium text-white">Proxy Mode</span>
                                <span className="px-2 py-1 text-xs bg-green-600/20 text-green-400 rounded-full">
                                  ENABLED
                                </span>
                              </div>
                              <p className="text-gray-400 text-xs">
                                Direct integration with enhanced analytics
                              </p>
                            </div>
                          </div>
                        </label>

                        {/* Knotie Chat Node - UPCOMING */}
                        <div className="relative flex rounded-lg border border-gray-700 p-4 bg-gray-800/50 opacity-60">
                          <div className="flex items-center justify-between w-full">
                            <div className="text-sm">
                              <div className="flex items-center gap-2 mb-1">
                                <FiSettings className="w-4 h-4 text-yellow-400" />
                                <span className="font-medium text-gray-300">Knotie Chat Node</span>
                                <span className="px-2 py-1 text-xs bg-yellow-600/20 text-yellow-400 rounded-full">
                                  UPCOMING
                                </span>
                              </div>
                              <p className="text-gray-500 text-xs">
                                Custom N8N node with advanced features
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Widget Information (Read-only) */}
                      <div className="mt-6">
                        <h5 className="text-sm font-medium text-gray-300 mb-3">Widget</h5>
                        <div className="relative flex rounded-lg border border-blue-500 p-4 bg-blue-500/10">
                          <div className="flex items-center justify-between w-full">
                            <div className="text-sm">
                              <div className="flex items-center gap-2 mb-1">
                                <FiExternalLink className="w-4 h-4 text-blue-400" />
                                <span className="font-medium text-white">N8N Official Widget</span>
                                <span className="px-2 py-1 text-xs bg-blue-600/20 text-blue-400 rounded-full">
                                  DEFAULT
                                </span>
                              </div>
                              <p className="text-gray-400 text-xs">
                                Uses standard N8N Chat Trigger widget with Knotie proxy integration
                              </p>
                            </div>
                          </div>
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                          The widget type is automatically configured based on your integration mode. You can create custom widgets after agent creation.
                        </p>
                      </div>
                      {errors.integration_mode && (
                        <p className="mt-1 text-sm text-red-400">{(errors.integration_mode as any)?.message}</p>
                      )}
                    </div>

                    {/* Proxy Mode Configuration */}
                    {watchedIntegrationMode === 'proxy' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          N8N Webhook URL *
                        </label>
                        <div className="flex gap-2">
                          <input
                            {...register('n8n_webhook_url')}
                            type="url"
                            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="https://your-n8n-instance.com/webhook/your-webhook-id"
                          />
                          <button
                            type="button"
                            onClick={testWebhookConnection}
                            disabled={testingWebhook || !watchedWebhookUrl}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-md text-sm font-medium flex items-center gap-2 transition-colors"
                          >
                            {testingWebhook ? (
                              <FiLoader className="w-4 h-4 animate-spin" />
                            ) : webhookTestResult === 'success' ? (
                              <FiCheck className="w-4 h-4" />
                            ) : webhookTestResult === 'failed' ? (
                              <FiAlertTriangle className="w-4 h-4" />
                            ) : (
                              'Test'
                            )}
                          </button>
                        </div>
                        {errors.n8n_webhook_url && (
                          <p className="mt-1 text-sm text-red-400">{(errors.n8n_webhook_url as any)?.message}</p>
                        )}
                        <p className="mt-1 text-xs text-gray-400">
                          This is your N8N Chat Trigger webhook URL that will receive messages via Knotie proxy
                        </p>
                      </div>
                    )}

                    {/* Webhook Secret */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Webhook Secret
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={webhookSecret}
                          readOnly
                          className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={copyWebhookSecret}
                          className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-md text-sm font-medium flex items-center gap-2 transition-colors"
                        >
                          <FiCopy className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                        <div className="flex items-start gap-2">
                          <FiSettings className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                          <div className="text-xs text-blue-300">
                            <p className="font-medium mb-1">For N8N Chat Trigger Basic Auth:</p>
                            <p><strong>Username:</strong> knotie</p>
                            <p><strong>Password:</strong> {webhookSecret}</p>
                            <p className="text-blue-400 mt-1">Configure this in your N8N Chat Trigger credentials</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Status
                      </label>
                      <select
                        {...register('status')}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="testing">Testing</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>

                  {/* Credit Billing Configuration */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-300 border-b border-gray-700 pb-2">
                      Credit Billing Configuration
                    </h4>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Billing Mode
                      </label>
                      <select
                        {...register('credit_config.billing_mode')}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="per_conversation">Per Conversation (Recommended)</option>
                        <option value="per_message_pair">Per Message Exchange</option>
                        <option value="per_10_messages">Per 10 Messages</option>
                        <option value="per_minute">Per Minute (Like Voice)</option>
                      </select>
                      <p className="mt-1 text-xs text-gray-400">
                        Choose how credits are calculated for this chat agent
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Credits Per Unit
                        </label>
                        <input
                          {...register('credit_config.credits_per_unit', { valueAsNumber: true })}
                          type="number"
                          step="0.1"
                          min="0.1"
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="1.0"
                        />
                        {(errors.credit_config as any)?.credits_per_unit && (
                          <p className="mt-1 text-sm text-red-400">{(errors.credit_config as any)?.credits_per_unit?.message}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Minimum Credits
                        </label>
                        <input
                          {...register('credit_config.minimum_credits', { valueAsNumber: true })}
                          type="number"
                          min="1"
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="1"
                        />
                        {(errors.credit_config as any)?.minimum_credits && (
                          <p className="mt-1 text-sm text-red-400">{(errors.credit_config as any)?.minimum_credits?.message}</p>
                        )}
                      </div>
                    </div>

                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                      <div className="flex items-start gap-2">
                        <FiSettings className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-yellow-300">
                          <p className="font-medium mb-1">Credit Billing Information:</p>
                          <p><strong>Default:</strong> 1 credit per conversation (like voice agents: 1 credit per minute)</p>
                          <p><strong>Per Message Pair:</strong> Credits deducted for each user message + bot response</p>
                          <p><strong>Per 10 Messages:</strong> 1 credit for every 10 messages in conversation</p>
                          <p><strong>Per Minute:</strong> Credits based on conversation duration (like voice calls)</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Submit Buttons */}
                  <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-700">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-md font-medium flex items-center gap-2 transition-colors"
                    >
                      {loading && <FiLoader className="w-4 h-4 animate-spin" />}
                      {editingAgent ? 'Update Agent' : 'Create Agent'}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default N8nChatAgentModal;
