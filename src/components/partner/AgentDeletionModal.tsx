'use client';

import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiAlertTriangle, FiX, FiTrash2, FiDatabase, FiGlobe } from 'react-icons/fi';
import clsx from 'clsx';

interface AgentDeletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  agent: {
    id: string;
    name: string;
    customerId: string | null;
    customer: {
      firstName?: string;
      lastName?: string;
      email: string;
    } | null;
  } | null;
  onDeleteFromPortal: (agentId: string) => Promise<void>;
  onDeleteEverywhere: (agentId: string) => Promise<void>;
  isLoading?: boolean;
}

export default function AgentDeletionModal({
  isOpen,
  onClose,
  agent,
  onDeleteFromPortal,
  onDeleteEverywhere,
  isLoading = false
}: AgentDeletionModalProps) {
  const [selectedOption, setSelectedOption] = useState<'portal' | 'everywhere' | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleOptionSelect = (option: 'portal' | 'everywhere') => {
    setSelectedOption(option);
    setShowConfirmation(true);
  };

  const handleConfirm = async () => {
    if (!agent || !selectedOption) return;

    try {
      if (selectedOption === 'portal') {
        await onDeleteFromPortal(agent.id);
      } else {
        await onDeleteEverywhere(agent.id);
      }
      handleClose();
    } catch (error) {
      console.error('Error deleting agent:', error);
    }
  };

  const handleClose = () => {
    setSelectedOption(null);
    setShowConfirmation(false);
    onClose();
  };

  const getCustomerDisplayName = () => {
    if (!agent?.customer) return null;

    const { firstName, lastName, email } = agent.customer;

    if (firstName || lastName) {
      return `${firstName || ''} ${lastName || ''}`.trim();
    }
    return email;
  };

  if (!agent) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog
          as={motion.div}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          open={isOpen}
          onClose={handleClose}
          className="relative z-50"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
          />

          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel
              as={motion.div}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-gray-900 rounded-lg shadow-xl border border-gray-700"
            >
              {!showConfirmation ? (
                // Option Selection Screen
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-500/20 rounded-lg">
                        <FiTrash2 className="w-5 h-5 text-red-400" />
                      </div>
                      <div>
                        <Dialog.Title className="text-lg font-semibold text-white">
                          Delete Agent
                        </Dialog.Title>
                        <p className="text-sm text-gray-400">
                          {agent.name}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleClose}
                      className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <FiX className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    {/* Delete from Portal Option */}
                    <button
                      onClick={() => handleOptionSelect('portal')}
                      className="w-full p-4 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-gray-600 rounded-lg transition-all text-left group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg group-hover:bg-blue-500/30 transition-colors">
                          <FiDatabase className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium text-white mb-1">Delete from Portal</h3>
                          <p className="text-sm text-gray-300 leading-relaxed">
                            Remove agent from your portal only. The agent will remain in Retell but stop sending webhooks to our system.
                          </p>
                        </div>
                      </div>
                    </button>

                    {/* Delete Everywhere Option */}
                    <button
                      onClick={() => handleOptionSelect('everywhere')}
                      disabled={true}
                      className="w-full p-4 bg-gray-800/50 border border-gray-700/50 rounded-lg text-left opacity-50 cursor-not-allowed"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-red-500/20 rounded-lg">
                          <FiGlobe className="w-5 h-5 text-red-400" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium text-white mb-1">Delete Everywhere</h3>
                          <p className="text-sm text-gray-300 leading-relaxed">
                            Delete agent from both portal and Retell. This action cannot be undone.
                          </p>
                          <p className="text-xs text-amber-400 mt-2 font-medium">
                            Coming Soon
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-700">
                    <button
                      onClick={handleClose}
                      className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                // Confirmation Screen
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-500/20 rounded-lg">
                        <FiAlertTriangle className="w-5 h-5 text-red-400" />
                      </div>
                      <div>
                        <Dialog.Title className="text-lg font-semibold text-white">
                          Confirm Deletion
                        </Dialog.Title>
                        <p className="text-sm text-gray-400">
                          {selectedOption === 'portal' ? 'Delete from Portal' : 'Delete Everywhere'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowConfirmation(false)}
                      className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <FiX className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                      <h4 className="font-medium text-white mb-2">Important Warnings</h4>
                      <ul className="text-sm text-white space-y-1">
                        <li>• This action may impact your billing if the agent has custom metrics</li>
                        {agent.customerId && (
                          <li>• Customer "{getCustomerDisplayName()}" will no longer see this agent in their portal</li>
                        )}
                        <li>• Agent webhooks will be disabled to prevent further data collection</li>
                      </ul>
                    </div>

                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                      <h4 className="font-medium text-white mb-2">Agent Details</h4>
                      <div className="text-sm space-y-1">
                        <p><span className="text-gray-400">Name:</span> <span className="text-gray-200">{agent.name}</span></p>
                        <p><span className="text-gray-400">ID:</span> <span className="text-gray-200 font-mono text-xs">{agent.id}</span></p>
                        {agent.customerId && (
                          <p><span className="text-gray-400">Customer:</span> <span className="text-gray-200">{getCustomerDisplayName()}</span></p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={() => setShowConfirmation(false)}
                      disabled={isLoading}
                      className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleConfirm}
                      disabled={isLoading}
                      className={clsx(
                        'flex-1 px-4 py-2 rounded-lg transition-colors disabled:opacity-50',
                        'bg-red-600 hover:bg-red-700 text-white'
                      )}
                    >
                      {isLoading ? 'Deleting...' : 'Confirm Delete'}
                    </button>
                  </div>
                </div>
              )}
            </Dialog.Panel>
          </div>
        </Dialog>
      )}
    </AnimatePresence>
  );
}
