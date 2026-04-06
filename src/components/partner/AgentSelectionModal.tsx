'use client';

import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { FiX, FiUser, FiCheck, FiAlertCircle, FiZap } from 'react-icons/fi';

interface RetellAgent {
  id: string;
  name: string;
  customerId: string | null;
  customer?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  isActive: boolean;
}

interface PhoneNumber {
  id: string;
  phoneNumber: string;
  friendlyName?: string;
  status: string;
}

interface AgentSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: string; // This is the actual Customer ID
  userOnboardingId: string; // This is the UserOnboarding ID needed for map-customer
  customerName: string;
  onAgentAssigned: (agent: RetellAgent, phoneNumber: PhoneNumber) => void;
}

export default function AgentSelectionModal({
  isOpen,
  onClose,
  customerId,
  userOnboardingId,
  customerName,
  onAgentAssigned
}: AgentSelectionModalProps) {
  const [agents, setAgents] = useState<RetellAgent[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState('');
  const [agentsWithPhoneNumbers, setAgentsWithPhoneNumbers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      loadData();
      setSelectedAgentId('');
      setError('');
    }
  }, [isOpen, customerId]);

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        setError('Authentication token not found');
        return;
      }

      // Load agents, customer phone numbers, and all partner phone numbers in parallel
      const [agentsResponse, phoneNumbersResponse, allPhoneNumbersResponse] = await Promise.all([
        fetch('/api/partner/retell-agents', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }),
        fetch(`/api/partner/customers/${customerId}/phone-numbers`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }),
        fetch('/api/partner/phone-numbers', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
      ]);

      if (!agentsResponse.ok) {
        throw new Error('Failed to load agents');
      }

      if (!phoneNumbersResponse.ok) {
        throw new Error('Failed to load phone numbers');
      }

      if (!allPhoneNumbersResponse.ok) {
        throw new Error('Failed to load all phone numbers');
      }

      const agentsData = await agentsResponse.json();
      const phoneNumbersData = await phoneNumbersResponse.json();
      const allPhoneNumbersData = await allPhoneNumbersResponse.json();

      // Filter agents: show agents assigned to this customer OR unassigned agents
      const filteredAgents = (agentsData || []).filter((agent: RetellAgent) =>
        agent.customerId === customerId || agent.customerId === null
      );
      setAgents(filteredAgents);
      setPhoneNumbers(phoneNumbersData.data?.phoneNumbers || []);

      // Extract agents that have phone numbers assigned from all phone numbers
      if (allPhoneNumbersData.success && allPhoneNumbersData.phoneNumbers) {
        const agentsWithPhones = new Set<string>();

        allPhoneNumbersData.phoneNumbers.forEach((phoneNumber: any) => {
          if (phoneNumber.agentMappings && phoneNumber.agentMappings.length > 0) {
            phoneNumber.agentMappings.forEach((mapping: any) => {
              if (mapping.agentProvider === 'retell' && mapping.status === 'active') {
                agentsWithPhones.add(mapping.agentId);
              }
            });
          }
        });

        setAgentsWithPhoneNumbers(agentsWithPhones);
        console.log('Agents with phone numbers:', Array.from(agentsWithPhones));
      }

    } catch (error: any) {
      console.error('Error loading data:', error);
      setError(error.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get the correct label and style for each agent
  const getAgentLabel = (agent: RetellAgent) => {
    if (agent.customerId === customerId) {
      // Agent is assigned to this customer
      if (agentsWithPhoneNumbers.has(agent.id)) {
        return {
          text: 'Already Assigned',
          className: 'text-xs bg-green-600 text-white px-2 py-1 rounded'
        };
      } else {
        return {
          text: 'Phone Number Not Assigned',
          className: 'text-xs bg-yellow-600 text-white px-2 py-1 rounded'
        };
      }
    } else {
      // Agent is not assigned to any customer
      return null; // No label for unassigned agents
    }
  };

  const handleAssignment = async () => {
    if (!selectedAgentId || phoneNumbers.length === 0) return;

    setAssigning(true);
    setError('');

    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        setError('Authentication token not found');
        return;
      }

      const selectedAgent = agents.find(a => a.id === selectedAgentId);
      const phoneNumber = phoneNumbers[0]; // Use the first phone number assigned to customer

      if (!selectedAgent || !phoneNumber) {
        setError('Selected agent or phone number not found');
        return;
      }

      // Step 1: Assign agent to customer (if not already assigned)
      if (!selectedAgent.customerId || selectedAgent.customerId !== customerId) {
        const mapCustomerResponse = await fetch(`/api/partner/retell-agents/${selectedAgentId}/map-customer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            userOnboardingId: userOnboardingId, // This endpoint expects userOnboardingId
            profitMultiplier: 1.2 // Default profit multiplier
          })
        });

        if (!mapCustomerResponse.ok) {
          const errorData = await mapCustomerResponse.json();
          throw new Error(errorData.error || 'Failed to assign agent to customer');
        }
      }

      // Step 2: Assign phone number to agent
      const assignPhoneResponse = await fetch(`/api/partner/phone-numbers/${phoneNumber.id}/assign-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          agentId: selectedAgentId,
          agentProvider: 'retell'
        })
      });

      if (!assignPhoneResponse.ok) {
        const errorData = await assignPhoneResponse.json();
        throw new Error(errorData.error || 'Failed to assign phone number to agent');
      }

      onAgentAssigned(selectedAgent, phoneNumber);
      onClose();

    } catch (error: any) {
      console.error('Error assigning agent:', error);
      setError(error.message || 'Failed to assign agent');
    } finally {
      setAssigning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-gray-800">
          <div className="flex items-center justify-between mb-6">
            <Dialog.Title className="text-lg font-semibold text-white flex items-center gap-2">
              <FiZap className="w-5 h-5 text-orange-500" />
              Select AI Agent
            </Dialog.Title>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          <div className="mb-4">
            <p className="text-gray-300 text-sm">
              Select an AI agent for <span className="font-medium text-white">{customerName}</span>
            </p>
            {phoneNumbers.length > 0 && (
              <p className="text-gray-400 text-xs mt-1">
                Will be connected to phone number: {phoneNumbers[0].phoneNumber}
              </p>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-400/10 border border-red-400/20 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2">
                <FiAlertCircle className="text-red-400 flex-shrink-0" />
                <span className="text-red-400 text-sm">{error}</span>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
              <p className="text-gray-400 mt-2">Loading agents...</p>
            </div>
          ) : phoneNumbers.length === 0 ? (
            <div className="text-center py-8">
              <FiAlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
              <p className="text-gray-400">No phone number assigned</p>
              <p className="text-gray-500 text-sm mt-1">Please assign a phone number first</p>
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center py-8">
              <FiUser className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No Retell agents found</p>
              <p className="text-gray-500 text-sm mt-1">Create a Retell agent first</p>
            </div>
          ) : (
            <>
              <div className="space-y-2 mb-6 max-h-60 overflow-y-auto">
                {agents.map((agent) => (
                  <label
                    key={agent.id}
                    className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedAgentId === agent.id
                        ? 'border-orange-500 bg-orange-500/10'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="agent"
                      value={agent.id}
                      checked={selectedAgentId === agent.id}
                      onChange={(e) => setSelectedAgentId(e.target.value)}
                      className="sr-only"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium">{agent.name}</span>
                        {(() => {
                          const label = getAgentLabel(agent);
                          return label ? (
                            <span className={label.className}>
                              {label.text}
                            </span>
                          ) : null;
                        })()}
                      </div>
                      <div className="text-gray-400 text-sm mt-1">
                        {agent.customerId
                          ? agent.customer
                            ? `Customer: ${agent.customer.firstName} ${agent.customer.lastName}`
                            : 'Assigned to customer'
                          : 'Unassigned Agent'
                        }
                      </div>
                    </div>
                    {selectedAgentId === agent.id && (
                      <FiCheck className="text-orange-500 ml-2" />
                    )}
                  </label>
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignment}
                  disabled={!selectedAgentId || assigning}
                  className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {assigning ? 'Assigning...' : 'Assign Agent'}
                </button>
              </div>
            </>
          )}
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
