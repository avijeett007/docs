import React, { useState, useEffect } from 'react';
import { FiAlertTriangle, FiX, FiUser, FiPhone } from 'react-icons/fi';

interface AgentMapping {
  id: string;
  agentProvider: string;
  agentId: string;
  agentName: string | null;
  customerId: string;
  status: string;
}

interface PhoneNumber {
  id: string;
  phoneNumber: string;
  friendlyName?: string;
  customer: {
    id: string;
    name: string;
    email: string;
  } | null;
  agentMappings: AgentMapping[];
  hasAgentAssignment: boolean;
}

interface CustomerUnassignConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  phoneNumber: PhoneNumber | null;
  onUnassignComplete: () => void;
}

export default function CustomerUnassignConfirmModal({
  isOpen,
  onClose,
  phoneNumber,
  onUnassignComplete
}: CustomerUnassignConfirmModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Get agents that will be affected (assigned to the same customer)
  const affectedAgents = phoneNumber?.agentMappings.filter(
    mapping => mapping.status === 'active' && mapping.customerId === phoneNumber.customer?.id
  ) || [];

  const handleUnassign = async () => {
    if (!phoneNumber || !phoneNumber.customer) return;

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        setError('Authentication token not found');
        return;
      }

      const response = await fetch(`/api/partner/phone-numbers/${phoneNumber.id}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          customerId: null // Unassign by setting to null
        })
      });

      const data = await response.json();

      if (data.success) {
        onUnassignComplete();
        onClose();
      } else {
        setError(data.message || 'Failed to unassign customer');
      }
    } catch (error) {
      console.error('Error unassigning customer:', error);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const resetModal = () => {
    setError('');
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      resetModal();
    }
  }, [isOpen]);

  if (!isOpen || !phoneNumber) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FiAlertTriangle className="text-red-400 text-xl" />
            <h2 className="text-xl font-semibold text-white">
              Unassign Customer - Confirmation Required
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <FiX className="text-xl" />
          </button>
        </div>

        {/* Warning Content */}
        <div className="mb-6">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <FiAlertTriangle className="text-red-400 text-lg mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-red-400 font-medium mb-2">Warning: This action will impact functionality</h3>
                <p className="text-gray-300 text-sm mb-3">
                  Unassigning this phone number from the customer will:
                </p>
                <ul className="text-gray-300 text-sm space-y-1 list-disc list-inside">
                  <li>Remove customer access to this phone number</li>
                  <li>Impact any billing or usage tracking for this customer</li>
                  <li>May affect customer portal functionality</li>
                  {affectedAgents.length > 0 && (
                    <li className="text-yellow-400 font-medium">
                      Automatically unassign {affectedAgents.length} agent(s) currently using this number
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>

          {/* Phone Number Info */}
          <div className="bg-gray-700/50 rounded-lg p-4 mb-4">
            <h4 className="text-white font-medium mb-2">Phone Number Details</h4>
            <div className="text-gray-300 text-sm">
              <div className="flex items-center gap-2 mb-1">
                <FiPhone className="text-blue-400" />
                <span>{phoneNumber.phoneNumber}</span>
                {phoneNumber.friendlyName && (
                  <span className="text-gray-400">({phoneNumber.friendlyName})</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <FiUser className="text-green-400" />
                <span>Currently assigned to: {phoneNumber.customer?.name} ({phoneNumber.customer?.email})</span>
              </div>
            </div>
          </div>

          {/* Affected Agents */}
          {affectedAgents.length > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
              <h4 className="text-yellow-400 font-medium mb-2">
                Agents that will be automatically unassigned:
              </h4>
              <div className="space-y-2">
                {affectedAgents.map((agent) => (
                  <div key={agent.id} className="flex items-center gap-2 text-sm">
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-400/20 text-yellow-400">
                      {agent.agentProvider.charAt(0).toUpperCase() + agent.agentProvider.slice(1)}
                    </span>
                    <span className="text-gray-300">{agent.agentName || agent.agentId}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUnassign}
            disabled={loading}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Unassigning...' : 'Confirm Unassign Customer'}
          </button>
        </div>
      </div>
    </div>
  );
}
