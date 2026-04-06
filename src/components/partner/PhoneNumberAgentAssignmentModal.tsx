'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FiX, FiPhone, FiUser, FiSettings, FiCheckCircle, FiAlertCircle, FiPhoneIncoming, FiPhoneOutgoing, FiInfo } from 'react-icons/fi';

// Helper function to get provider-specific styling
const getProviderStyle = (provider: string) => {
  switch (provider) {
    case 'retell':
      return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
    case 'vapi':
      return 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
    case 'knova':
      return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
  }
};

interface AgentMapping {
  id: string;
  agentProvider: string;
  agentId: string;
  agentName: string | null;
  customerId: string;
  isActive: boolean;
  createdAt: string;
}

interface SipConfig {
  id: string;
  sipTrunkSid: string;
  originationUri: string;
  status: string;
}

interface PhoneNumber {
  id: string;
  phoneNumber: string;
  friendlyName?: string;
  provider: string;
  status: string;
  customer: {
    id: string;
    name: string;
    email: string;
  } | null;
  agentMappings: AgentMapping[];
  hasAgentAssignment: boolean;
  sipConfig: SipConfig | null;
  hasSipConfig: boolean;
  isAssigned: boolean;
}

interface UnifiedAgent {
  id: string;
  name: string;
  customerId: string | null;
  customerName?: string;
  isActive: boolean;
  provider: 'retell' | 'vapi' | 'knova';
}

interface PhoneNumberAgentAssignmentModalProps {
  isOpen: boolean;
  phoneNumber: PhoneNumber | null;
  onClose: () => void;
  onAssignmentComplete: () => void;
}

export default function PhoneNumberAgentAssignmentModal({
  isOpen,
  phoneNumber,
  onClose,
  onAssignmentComplete
}: PhoneNumberAgentAssignmentModalProps) {
  const [eligibleAgents, setEligibleAgents] = useState<UnifiedAgent[]>([]);
  const [selectedInboundAgentId, setSelectedInboundAgentId] = useState<string>('');
  const [selectedOutboundAgentId, setSelectedOutboundAgentId] = useState<string>('');
  const [assignmentMode, setAssignmentMode] = useState<'single' | 'dual'>('single');
  const [assignmentType, setAssignmentType] = useState<'inbound' | 'outbound'>('inbound');
  const [enableInboundWebhook, setEnableInboundWebhook] = useState<boolean>(true); // Default to true for AI Receptionist
  const [enableSms, setEnableSms] = useState<boolean>(false); // SMS support for VAPI agents
  const [isLoading, setIsLoading] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compatibility, setCompatibility] = useState<{retell: boolean, vapi: boolean, knova: boolean}>({retell: false, vapi: false, knova: false});

  const loadEligibleAgents = useCallback(async () => {
    if (!phoneNumber) return;

    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        setError('Authentication required');
        return;
      }

      const response = await fetch(`/api/partner/phone-numbers/${phoneNumber.id}/eligible-agents`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();

      if (data.success) {
        setEligibleAgents(data.agents);
        setCompatibility(data.compatibility || {retell: false, vapi: false, knova: false});
      } else {
        setError(data.error || 'Failed to load eligible agents');
      }
    } catch (error) {
      console.error('Error loading eligible agents:', error);
      setError('Failed to load eligible agents');
    } finally {
      setIsLoading(false);
    }
  }, [phoneNumber]);

  // Load eligible agents when modal opens
  useEffect(() => {
    if (isOpen && phoneNumber) {
      loadEligibleAgents();
      // Reset assignment type to inbound for non-imported numbers
      if (!phoneNumber.provider.includes('imported')) {
        setAssignmentType('inbound');
      }
    }
  }, [isOpen, phoneNumber, loadEligibleAgents]);

  // Reset selected agents when assignment mode or type changes
  useEffect(() => {
    setSelectedInboundAgentId('');
    setSelectedOutboundAgentId('');
  }, [assignmentMode, assignmentType]);

  const handleAssignment = async () => {
    if (!phoneNumber) return;

    // Validate agent selection based on mode
    if (assignmentMode === 'dual') {
      if (!selectedInboundAgentId || !selectedOutboundAgentId) {
        setError('Please select both inbound and outbound agents for dual assignment');
        return;
      }
    } else {
      const selectedAgentId = assignmentType === 'inbound' ? selectedInboundAgentId : selectedOutboundAgentId;
      if (!selectedAgentId) {
        setError('Please select an agent');
        return;
      }
    }

    setIsAssigning(true);
    setError(null);

    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        setError('Authentication required');
        return;
      }

      // Determine agent provider based on selected agent(s)
      let agentProvider: string;
      if (assignmentMode === 'dual') {
        const inboundAgent = eligibleAgents.find(a => a.id === selectedInboundAgentId);
        const outboundAgent = eligibleAgents.find(a => a.id === selectedOutboundAgentId);

        if (!inboundAgent || !outboundAgent) {
          setError('Selected agents not found');
          return;
        }

        // For dual mode, both agents must be from the same provider
        if (inboundAgent.provider !== outboundAgent.provider) {
          setError('Both agents must be from the same provider for dual assignment');
          return;
        }

        agentProvider = inboundAgent.provider;
      } else {
        const selectedAgentId = assignmentType === 'inbound' ? selectedInboundAgentId : selectedOutboundAgentId;
        const selectedAgent = eligibleAgents.find(a => a.id === selectedAgentId);

        if (!selectedAgent) {
          setError('Selected agent not found');
          return;
        }

        agentProvider = selectedAgent.provider;
      }

      // Use reassign endpoint if phone number already has an agent assignment
      const endpoint = phoneNumber.hasAgentAssignment
        ? `/api/partner/phone-numbers/${phoneNumber.id}/reassign-agent`
        : `/api/partner/phone-numbers/${phoneNumber.id}/assign-agent`;

      // Prepare request body based on assignment mode and provider
      const requestBody: any = {
        agentProvider: agentProvider,
        enableInboundWebhook: enableInboundWebhook // Include webhook preference
      };

      // Add VAPI-specific options
      if (agentProvider === 'vapi') {
        requestBody.enableSms = enableSms;
      }

      if (assignmentMode === 'dual') {
        requestBody.assignmentType = 'dual';
        requestBody.inboundAgentId = selectedInboundAgentId;
        requestBody.outboundAgentId = selectedOutboundAgentId;
      } else {
        requestBody.assignmentType = assignmentType;
        requestBody.agentId = assignmentType === 'inbound' ? selectedInboundAgentId : selectedOutboundAgentId;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (data.success) {
        onAssignmentComplete();
        onClose();
      } else {
        setError(data.error || 'Failed to assign agent');
      }
    } catch (error) {
      console.error('Error assigning agent:', error);
      setError('Failed to assign agent');
    } finally {
      setIsAssigning(false);
    }
  };

  if (!isOpen || !phoneNumber) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FiSettings className="text-green-400 text-xl" />
            <h2 className="text-xl font-semibold text-white">
              {phoneNumber.hasAgentAssignment ? 'Reassign Agent' : 'Assign Agent to Phone Number'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <FiX className="text-xl" />
          </button>
        </div>

        {/* Phone Number Info */}
        <div className="bg-gray-700 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <FiPhone className="text-blue-400" />
            <div>
              <div className="text-white font-medium">{phoneNumber.phoneNumber}</div>
              {phoneNumber.friendlyName && (
                <div className="text-gray-400 text-sm">{phoneNumber.friendlyName}</div>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Provider:</span>
              <span className="text-white ml-2">{phoneNumber.provider}</span>
            </div>
            <div>
              <span className="text-gray-400">Status:</span>
              <span className="text-white ml-2">{phoneNumber.status}</span>
            </div>
            <div>
              <span className="text-gray-400">Customer:</span>
              <span className="text-white ml-2">
                {phoneNumber.customer ? phoneNumber.customer.name : 'Unassigned'}
              </span>
            </div>
            <div>
              <span className="text-gray-400">SIP Config:</span>
              <span className={`ml-2 ${phoneNumber.hasSipConfig ? 'text-green-400' : 'text-yellow-400'}`}>
                {phoneNumber.hasSipConfig ? 'Configured' : 'Will be configured'}
              </span>
            </div>
          </div>
        </div>

        {/* Current Assignment */}
        {phoneNumber.hasAgentAssignment && (
          <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-lg p-4 mb-6">
            <h3 className="text-yellow-400 font-medium mb-2">Current Assignment</h3>
            {phoneNumber.agentMappings.map((mapping) => (
              <div key={mapping.id} className="flex items-center gap-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-400/10 text-yellow-400">
                  {mapping.agentProvider.charAt(0).toUpperCase() + mapping.agentProvider.slice(1)}
                </span>
                <span className="text-white text-sm">{mapping.agentName || mapping.agentId}</span>
              </div>
            ))}
          </div>
        )}

        {/* Assignment Mode Selection - Only show for imported numbers */}
        {(phoneNumber.provider.includes('imported') || phoneNumber.provider === 'imported_twilio') && (
          <div className="mb-6">
            <label className="block text-gray-300 text-sm font-medium mb-3">
              Assignment Mode
            </label>
            <div className="flex gap-3 mb-4">
              <button
                type="button"
                onClick={() => setAssignmentMode('single')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                  assignmentMode === 'single'
                    ? 'border-blue-400 bg-blue-400/10 text-blue-400'
                    : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                }`}
              >
                <FiUser className="w-4 h-4" />
                Single Agent
              </button>
              <button
                type="button"
                onClick={() => setAssignmentMode('dual')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                  assignmentMode === 'dual'
                    ? 'border-purple-400 bg-purple-400/10 text-purple-400'
                    : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                }`}
              >
                <FiSettings className="w-4 h-4" />
                Dual Assignment
              </button>
            </div>

            {/* Single Assignment Type Selection */}
            {assignmentMode === 'single' && (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setAssignmentType('inbound')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                    assignmentType === 'inbound'
                      ? 'border-blue-400 bg-blue-400/10 text-blue-400'
                      : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  <FiPhoneIncoming className="w-4 h-4" />
                  Inbound Only
                </button>
                <button
                  type="button"
                  onClick={() => setAssignmentType('outbound')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                    assignmentType === 'outbound'
                      ? 'border-green-400 bg-green-400/10 text-green-400'
                      : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  <FiPhoneOutgoing className="w-4 h-4" />
                  Outbound Only
                </button>
              </div>
            )}

            <p className="text-gray-400 text-xs mt-2">
              {assignmentMode === 'dual'
                ? 'Assign different agents for inbound and outbound calls on the same number. Note: Knova agents only support inbound calls.'
                : assignmentType === 'inbound'
                ? 'Agent will handle incoming calls to this number'
                : 'Agent will be used when making outbound calls from this number. Note: Knova agents are not available for outbound.'
              }
            </p>
          </div>
        )}

        {/* Inbound Webhook Settings */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="enableInboundWebhook"
              checked={enableInboundWebhook}
              onChange={(e) => setEnableInboundWebhook(e.target.checked)}
              className="mt-1 w-4 h-4 text-green-400 bg-gray-700 border-gray-600 rounded focus:ring-green-400 focus:ring-2"
            />
            <div className="flex-1">
              <label htmlFor="enableInboundWebhook" className="text-white font-medium cursor-pointer">
                Enable Inbound Webhook (AI Receptionist) - Default: {enableInboundWebhook ? 'ON' : 'OFF'}
              </label>
              <div className="text-gray-400 text-sm mt-1">
                <p className="mb-2">
                  <span className="text-green-400 font-medium">Enable this</span> for AI Receptionist functionality where the agent processes incoming calls and responds automatically.
                </p>
                <p>
                  <span className="text-orange-400 font-bold">Disable if:</span>
                </p>
                <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                  <li><span className="font-medium">You are assigning this to your own configured agent</span></li>
                  <li><span className="font-medium">Not for AI Receptionist use case</span></li>
                  <li>You only need outbound calling or manual call handling without AI processing</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* VAPI SMS Settings - Only show if VAPI agents are available */}
        {compatibility.vapi && (
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="enableSms"
                checked={enableSms}
                onChange={(e) => setEnableSms(e.target.checked)}
                className="mt-1 w-4 h-4 text-purple-400 bg-gray-700 border-gray-600 rounded focus:ring-purple-400 focus:ring-2"
              />
              <div className="flex-1">
                <label htmlFor="enableSms" className="text-white font-medium cursor-pointer">
                  Enable SMS Support (VAPI Agents Only) - Default: {enableSms ? 'ON' : 'OFF'}
                </label>
                <div className="text-gray-400 text-sm mt-1">
                  <p className="mb-2">
                    <span className="text-purple-400 font-medium">Enable this</span> to allow VAPI agents to handle SMS messages in addition to voice calls.
                  </p>
                  <p className="text-yellow-400 text-xs">
                    Note: This setting only applies to VAPI agents. Retell agents do not support SMS functionality.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Agent Selection */}
        <div className="mb-6">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
              <p className="text-gray-400 mt-2">Loading eligible agents...</p>
            </div>
          ) : eligibleAgents.length === 0 ? (
            <div className="bg-gray-700 rounded-lg p-4 text-center">
              <FiAlertCircle className="text-yellow-400 text-2xl mx-auto mb-2" />
              <p className="text-gray-300">No eligible agents found</p>
              <p className="text-gray-400 text-sm mt-1">
                {phoneNumber.customer
                  ? 'Create a Retell, VAPI, or Knova agent for this customer or assign an unassigned agent'
                  : 'Assign this phone number to a customer first, or create an unassigned agent'
                }
              </p>
              <div className="text-xs text-gray-500 mt-2">
                Compatible providers: {compatibility.retell && 'Retell'} {(compatibility.retell && (compatibility.vapi || compatibility.knova)) && ' • '} {compatibility.vapi && 'VAPI'} {(compatibility.vapi && compatibility.knova) && ' • '} {compatibility.knova && 'Knova'}
              </div>
            </div>
          ) : assignmentMode === 'dual' ? (
            // Dual Assignment Mode - Show separate sections for inbound and outbound
            <div className="space-y-6">
              {/* Inbound Agent Selection */}
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-3">
                  <FiPhoneIncoming className="inline w-4 h-4 mr-2" />
                  Select Inbound Agent
                </label>
                <div className="space-y-2">
                  {eligibleAgents.map((agent) => (
                    <label
                      key={`inbound-${agent.id}`}
                      className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedInboundAgentId === agent.id
                          ? 'border-blue-400 bg-blue-400/10'
                          : 'border-gray-600 bg-gray-700 hover:border-gray-500'
                      }`}
                    >
                      <input
                        type="radio"
                        name="inbound-agent"
                        value={agent.id}
                        checked={selectedInboundAgentId === agent.id}
                        onChange={(e) => setSelectedInboundAgentId(e.target.value)}
                        className="sr-only"
                      />
                      <div className="flex items-center gap-3 flex-1">
                        <FiUser className="text-blue-400" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="text-white font-medium">{agent.name}</div>
                            <span className={`px-2 py-1 text-xs rounded-full font-medium ${getProviderStyle(agent.provider)}`}>
                              {agent.provider.toUpperCase()}
                            </span>
                            {agent.provider === 'knova' && (
                              <span className="text-xs text-amber-400">(Inbound Only)</span>
                            )}
                          </div>
                          <div className="text-gray-400 text-sm">
                            {agent.customerId ? `Customer: ${agent.customerName}` : 'Unassigned Agent'}
                          </div>
                          <div className="text-gray-400 text-xs">
                            Status: {agent.isActive ? 'Active' : 'Inactive'}
                          </div>
                        </div>
                      </div>
                      {selectedInboundAgentId === agent.id && (
                        <FiCheckCircle className="text-blue-400" />
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {/* Outbound Agent Selection */}
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-3">
                  <FiPhoneOutgoing className="inline w-4 h-4 mr-2" />
                  Select Outbound Agent
                </label>
                <div className="space-y-2">
                  {/* Filter out Knova agents for outbound - they only support inbound */}
                  {eligibleAgents.filter(agent => agent.provider !== 'knova').map((agent) => (
                    <label
                      key={`outbound-${agent.id}`}
                      className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedOutboundAgentId === agent.id
                          ? 'border-green-400 bg-green-400/10'
                          : 'border-gray-600 bg-gray-700 hover:border-gray-500'
                      }`}
                    >
                      <input
                        type="radio"
                        name="outbound-agent"
                        value={agent.id}
                        checked={selectedOutboundAgentId === agent.id}
                        onChange={(e) => setSelectedOutboundAgentId(e.target.value)}
                        className="sr-only"
                      />
                      <div className="flex items-center gap-3 flex-1">
                        <FiUser className="text-green-400" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="text-white font-medium">{agent.name}</div>
                            <span className={`px-2 py-1 text-xs rounded-full font-medium ${getProviderStyle(agent.provider)}`}>
                              {agent.provider.toUpperCase()}
                            </span>
                          </div>
                          <div className="text-gray-400 text-sm">
                            {agent.customerId ? `Customer: ${agent.customerName}` : 'Unassigned Agent'}
                          </div>
                          <div className="text-gray-400 text-xs">
                            Status: {agent.isActive ? 'Active' : 'Inactive'}
                          </div>
                        </div>
                      </div>
                      {selectedOutboundAgentId === agent.id && (
                        <FiCheckCircle className="text-green-400" />
                      )}
                    </label>
                  ))}
                  {eligibleAgents.filter(agent => agent.provider !== 'knova').length === 0 && (
                    <div className="p-3 bg-gray-700 rounded-lg text-gray-400 text-sm text-center">
                      No agents available for outbound calls. Knova agents only support inbound.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            // Single Assignment Mode - Show agents for selected type
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-3">
                {assignmentType === 'inbound' ? (
                  <>
                    <FiPhoneIncoming className="inline w-4 h-4 mr-2" />
                    Select Inbound Agent
                  </>
                ) : (
                  <>
                    <FiPhoneOutgoing className="inline w-4 h-4 mr-2" />
                    Select Outbound Agent
                  </>
                )}
              </label>
              <div className="space-y-2">
                {/* Filter out Knova agents for outbound mode - they only support inbound */}
                {eligibleAgents
                  .filter(agent => assignmentType === 'inbound' || agent.provider !== 'knova')
                  .map((agent) => {
                  const isSelected = assignmentType === 'inbound'
                    ? selectedInboundAgentId === agent.id
                    : selectedOutboundAgentId === agent.id;
                  const colorClass = assignmentType === 'inbound' ? 'blue' : 'green';

                  return (
                    <label
                      key={agent.id}
                      className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected
                          ? `border-${colorClass}-400 bg-${colorClass}-400/10`
                          : 'border-gray-600 bg-gray-700 hover:border-gray-500'
                      }`}
                    >
                      <input
                        type="radio"
                        name="agent"
                        value={agent.id}
                        checked={isSelected}
                        onChange={(e) => {
                          if (assignmentType === 'inbound') {
                            setSelectedInboundAgentId(e.target.value);
                          } else {
                            setSelectedOutboundAgentId(e.target.value);
                          }
                        }}
                        className="sr-only"
                      />
                      <div className="flex items-center gap-3 flex-1">
                        <FiUser className={`text-${colorClass}-400`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="text-white font-medium">{agent.name}</div>
                            <span className={`px-2 py-1 text-xs rounded-full font-medium ${getProviderStyle(agent.provider)}`}>
                              {agent.provider.toUpperCase()}
                            </span>
                            {agent.provider === 'knova' && assignmentType === 'inbound' && (
                              <span className="text-xs text-amber-400">(Inbound Only)</span>
                            )}
                          </div>
                          <div className="text-gray-400 text-sm">
                            {agent.customerId ? `Customer: ${agent.customerName}` : 'Unassigned Agent'}
                          </div>
                          <div className="text-gray-400 text-xs">
                            Status: {agent.isActive ? 'Active' : 'Inactive'}
                          </div>
                        </div>
                      </div>
                      {isSelected && (
                        <FiCheckCircle className={`text-${colorClass}-400`} />
                      )}
                    </label>
                  );
                })}
                {assignmentType === 'outbound' && eligibleAgents.filter(agent => agent.provider !== 'knova').length === 0 && (
                  <div className="p-3 bg-gray-700 rounded-lg text-gray-400 text-sm text-center">
                    No agents available for outbound calls. Knova agents only support inbound.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-400/10 border border-red-400/20 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2">
              <FiAlertCircle className="text-red-400" />
              <span className="text-red-400 text-sm">{error}</span>
            </div>
          </div>
        )}

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
            disabled={
              isAssigning ||
              (assignmentMode === 'dual'
                ? (!selectedInboundAgentId || !selectedOutboundAgentId)
                : (assignmentType === 'inbound' ? !selectedInboundAgentId : !selectedOutboundAgentId)
              )
            }
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isAssigning
              ? (phoneNumber.hasAgentAssignment ? 'Reassigning...' : 'Assigning...')
              : (phoneNumber.hasAgentAssignment
                  ? (assignmentMode === 'dual' ? 'Reassign Agents' : 'Reassign Agent')
                  : (assignmentMode === 'dual' ? 'Assign Agents' : 'Assign Agent')
                )
            }
          </button>
        </div>
      </div>
    </div>
  );
}
