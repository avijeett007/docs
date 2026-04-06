'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { FiX, FiLoader, FiCode } from 'react-icons/fi';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

interface Customer {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  companyName?: string;
  customerId?: string;
}

interface ByoAgent {
  id: string;
  name: string;
  description?: string;
  framework: 'livekit' | 'pipecat';
  customer_id: string;
  status: 'active' | 'inactive' | 'revoked';
  tool_definitions: Array<{ appName: string; toolName: string }>;
}

interface ByoAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<any>;
  customers: Customer[];
  editingAgent?: ByoAgent | null;
}

interface FormData {
  name: string;
  description: string;
  customer_id: string;
  framework: 'livekit' | 'pipecat';
  status: 'active' | 'inactive';
}

const ByoAgentModal: React.FC<ByoAgentModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  customers,
  editingAgent
}) => {
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<FormData>({
    defaultValues: {
      name: '',
      description: '',
      customer_id: '',
      framework: 'livekit',
      status: 'active',
    }
  });

  useEffect(() => {
    if (editingAgent) {
      setValue('name', editingAgent.name);
      setValue('description', editingAgent.description || '');
      setValue('customer_id', editingAgent.customer_id);
      setValue('framework', editingAgent.framework);
      setValue('status', editingAgent.status === 'revoked' ? 'inactive' : editingAgent.status);
    } else {
      reset({
        name: '',
        description: '',
        customer_id: '',
        framework: 'livekit',
        status: 'active',
      });
    }
  }, [editingAgent, setValue, reset]);

  const onFormSubmit = async (data: FormData) => {
    if (!data.name.trim()) {
      toast.error('Agent name is required');
      return;
    }
    if (!data.customer_id) {
      toast.error('Please select a customer');
      return;
    }
    setLoading(true);
    try {
      await onSubmit(data);
      reset();
    } catch (error) {
      // Error handling is done in the parent component
    } finally {
      setLoading(false);
    }
  };

  const getCustomerDisplayName = (customer: Customer) => {
    if (customer.companyName) return customer.companyName;
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
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-gray-800 p-6 text-left align-middle shadow-xl transition-all border border-gray-700">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <FiCode className="w-6 h-6 text-blue-400" />
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-white">
                      {editingAgent ? 'Edit BYO Agent' : 'Create BYO Agent'}
                    </Dialog.Title>
                  </div>
                  <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                    <FiX className="w-6 h-6" />
                  </button>
                </div>

                <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-5">
                  {/* Agent Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Agent Name *
                    </label>
                    <input
                      {...register('name', { required: 'Agent name is required' })}
                      type="text"
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., AI Receptionist"
                    />
                    {errors.name && (
                      <p className="mt-1 text-sm text-red-400">{errors.name.message}</p>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Description
                    </label>
                    <textarea
                      {...register('description')}
                      rows={2}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Brief description of what this agent does..."
                    />
                  </div>

                  {/* Customer Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Customer *
                    </label>
                    <select
                      {...register('customer_id', { required: 'Customer selection is required' })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={!!editingAgent}
                    >
                      <option value="">Select a customer...</option>
                      {customers
                        .filter(customer => customer.customerId)
                        .map((customer) => (
                          <option key={customer.id} value={customer.customerId}>
                            {getCustomerDisplayName(customer)}
                          </option>
                        ))}
                    </select>
                    {errors.customer_id && (
                      <p className="mt-1 text-sm text-red-400">{errors.customer_id.message}</p>
                    )}
                    {editingAgent && (
                      <p className="mt-1 text-xs text-gray-500">Customer cannot be changed after creation. Use reassign from the agent menu.</p>
                    )}
                  </div>

                  {/* Framework Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">
                      Agent Framework *
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="relative cursor-pointer">
                        <input
                          {...register('framework')}
                          type="radio"
                          value="livekit"
                          className="peer sr-only"
                          disabled={!!editingAgent}
                        />
                        <div className="p-3 rounded-lg border border-gray-600 peer-checked:border-purple-500 peer-checked:bg-purple-500/10 hover:border-gray-500 transition-colors">
                          <div className="text-sm font-medium text-white">LiveKit Agents</div>
                          <div className="text-xs text-gray-400 mt-1">Python framework for real-time voice AI</div>
                        </div>
                      </label>
                      <label className="relative cursor-pointer">
                        <input
                          {...register('framework')}
                          type="radio"
                          value="pipecat"
                          className="peer sr-only"
                          disabled={!!editingAgent}
                        />
                        <div className="p-3 rounded-lg border border-gray-600 peer-checked:border-orange-500 peer-checked:bg-orange-500/10 hover:border-gray-500 transition-colors">
                          <div className="text-sm font-medium text-white">Pipecat</div>
                          <div className="text-xs text-gray-400 mt-1">Open-source voice & multimodal AI framework</div>
                        </div>
                      </label>
                    </div>
                    {editingAgent && (
                      <p className="mt-1 text-xs text-gray-500">Framework cannot be changed after creation.</p>
                    )}
                  </div>

                  {/* Status (only for editing) */}
                  {editingAgent && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Status
                      </label>
                      <select
                        {...register('status')}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  )}

                  {/* Info box */}
                  {!editingAgent && (
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <div className="text-xs text-blue-300">
                        <p className="font-medium mb-1">What happens next:</p>
                        <p>After creating the agent, you&apos;ll receive an <strong>API token</strong> and <strong>webhook secret</strong>. Use these with the <code className="bg-gray-700 px-1 rounded">knotie-connect</code> Python library to connect your self-hosted agent.</p>
                      </div>
                    </div>
                  )}

                  {/* Submit Buttons */}
                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-700">
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

export default ByoAgentModal;

